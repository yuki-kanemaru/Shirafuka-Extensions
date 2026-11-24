// 実際のChromiumへ拡張機能を読み込み、疑似ページで動作を確認するスモークテスト。
// 実行: node tests/browser/smoke.mjs
// Playwrightはこのリポジトリの依存に含めず、環境変数か既存の導入先から解決する。
import { createRequire } from "node:module";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(here, "..", "..");

const candidates = [
  process.env.PLAYWRIGHT_MODULE_PATH,
  path.join(extensionPath, "package.json"),
  "C:/Users/ron06/Documents/Program/codex-web-debug-tools/package.json"
].filter(Boolean);

function loadPlaywright() {
  for (const base of candidates) {
    try {
      const require = createRequire(base);
      return require("playwright");
    } catch {
      // 次の候補へ
    }
  }
  throw new Error("playwright が見つかりません。PLAYWRIGHT_MODULE_PATH を指定してください。");
}

const { chromium } = loadPlaywright();

// Playwright本体の想定リビジョンと導入済みブラウザーがずれる場合があるため、
// 導入済みのChromiumから新しいものを選ぶ（CHROMIUM_PATHで明示指定も可能）。
function findChromiumExecutable() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  if (!existsSync(root)) return undefined;
  const versions = readdirSync(root)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const name of versions) {
    const exe = path.join(root, name, "chrome-win64", "chrome.exe");
    if (existsSync(exe)) return exe;
  }
  return undefined;
}

const bookwalkerHtml = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>作品一覧</title>
<style>
  body { font-family: sans-serif; margin: 24px; }
  .o-list--actions { display: flex; gap: 8px; margin-bottom: 16px; }
  .a-basic-btn--reserve { display: inline-block; padding: 8px 16px; border: 1px solid #888; border-radius: 4px; }
  .a-check { display: inline-block; width: 20px; height: 20px; border: 1px solid #444; text-align: center; cursor: pointer; }
  .a-check--on { background: #28a745; color: #fff; }
</style></head>
<body>
  <div class="o-list--actions">
    <div class="btn-series-reservation">
      <a class="a-basic-btn--reserve"><span class="btn-txt">シリーズ予約購入</span></a>
    </div>
  </div>
  <ul>
    <li><span class="a-check" data-on-class="a-check--on" data-off-class="a-check" onclick="this.classList.toggle('a-check--on')">□</span> 作品1</li>
    <li><span class="a-check" data-on-class="a-check--on" data-off-class="a-check" onclick="this.classList.toggle('a-check--on')">□</span> 作品2</li>
    <li><span class="a-check" data-on-class="a-check--on" data-off-class="a-check" onclick="this.classList.toggle('a-check--on')">□</span> 作品3</li>
  </ul>
</body></html>`;

const calendarHtml = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>Google カレンダー</title>
<style>
  body { font-family: sans-serif; margin: 0; }
  .sidebar { width: 300px; padding: 12px; }
  .section { padding: 8px 0; }
  label { display: flex; gap: 8px; align-items: center; padding: 6px 8px; }
</style></head>
<body>
  <div class="sidebar">
    <div class="section">
      <h2>カレンダー リスト</h2>
      <div data-id="c2Nob29s"><label><input type="checkbox" aria-label="学校" checked>学校</label></div>
      <div data-id="d29yaw=="><label><input type="checkbox" aria-label="仕事" checked>仕事</label></div>
      <div data-id="cGVyc29uYWw="><label><input type="checkbox" aria-label="個人">個人</label></div>
    </div>
  </div>
</body></html>`;

// ChatGPT相当。素のEnterで送信、Shift+Enterで改行、Ctrl+Enterでは何もしない（実サイトの再現）。
const chatgptHtml = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>ChatGPT</title>
<style>
  body { font-family: sans-serif; margin: 24px; }
  #prompt-textarea { min-height: 80px; border: 1px solid #888; padding: 8px; }
</style></head>
<body>
  <div id="composer">
    <div id="prompt-textarea" contenteditable="true" role="textbox" aria-multiline="true"></div>
    <button id="composer-submit-button" aria-label="Send prompt">送信</button>
  </div>
  <script>
    window.__sendCount = 0;
    const editor = document.getElementById("prompt-textarea");
    function send() {
      window.__sendCount += 1;
      editor.textContent = "";
    }
    document.getElementById("composer-submit-button").addEventListener("click", send);
    editor.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      if (event.shiftKey) document.execCommand("insertLineBreak");
      else send();
    });
  </script>
</body></html>`;

// Google Chat相当。送信ボタンのaria-labelが日本語で、サイト固有セレクタに一致しない形。
const googleChatHtml = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>Google Chat</title>
<style>
  body { font-family: sans-serif; margin: 24px; }
  [contenteditable="true"] { min-height: 60px; border: 1px solid #888; padding: 8px; }
</style></head>
<body>
  <div class="chat-input">
    <div contenteditable="true" role="textbox" aria-label="メッセージを入力"></div>
    <button type="button" aria-label="メッセージを送信">送信</button>
  </div>
  <script>
    window.__sendCount = 0;
    const editor = document.querySelector('[contenteditable="true"]');
    const button = document.querySelector('button[aria-label="メッセージを送信"]');
    function send() {
      window.__sendCount += 1;
      editor.textContent = "";
    }
    button.addEventListener("click", send);
    editor.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      if (editor.getAttribute("aria-activedescendant")) {
        editor.textContent += "[mention]";
        editor.removeAttribute("aria-activedescendant");
        return;
      }
      if (event.shiftKey) document.execCommand("insertLineBreak");
      else send();
    });
  </script>
</body></html>`;

// Gemini相当。編集欄はrich-textarea内の.ql-editor、送信ボタンは日本語のaria-labelのみ。
const geminiHtml = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>Gemini</title>
<style>
  body { font-family: sans-serif; margin: 24px; }
  .ql-editor { min-height: 60px; border: 1px solid #888; padding: 8px; }
</style></head>
<body>
  <rich-textarea>
    <div class="ql-editor" contenteditable="true" role="textbox" aria-label="Gemini へのプロンプトを入力"></div>
  </rich-textarea>
  <button type="button" aria-label="プロンプトを送信">送信</button>
  <script>
    window.__sendCount = 0;
    const editor = document.querySelector(".ql-editor");
    function send() {
      window.__sendCount += 1;
      editor.textContent = "";
    }
    document.querySelector('button[aria-label="プロンプトを送信"]').addEventListener("click", send);
    editor.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      if (event.shiftKey) document.execCommand("insertLineBreak");
      else send();
    });
  </script>
</body></html>`;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function waitForExtensionId(userDataDir, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const file of ["Default/Preferences", "Default/Secure Preferences"]) {
      const full = path.join(userDataDir, file);
      if (!existsSync(full)) continue;
      try {
        const json = JSON.parse(await readFile(full, "utf8"));
        const settings = json?.extensions?.settings ?? {};
        for (const [id, value] of Object.entries(settings)) {
          if (typeof value?.path === "string" && path.resolve(value.path).toLowerCase() === extensionPath.toLowerCase()) {
            return id;
          }
        }
      } catch {
        // 書き込み途中のファイルは読み飛ばす
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

const userDataDir = await mkdtemp(path.join(tmpdir(), "shirafuka-ext-"));
let context;
try {
  context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: findChromiumExecutable(),
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });

  await context.route("https://bookwalker.jp/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: bookwalkerHtml }));
  await context.route("https://calendar.google.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: calendarHtml }));
  await context.route("https://chatgpt.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: chatgptHtml }));
  await context.route("https://chat.google.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: googleChatHtml }));
  await context.route("https://gemini.google.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: geminiHtml }));

  const extensionId = await waitForExtensionId(userDataDir);
  check("拡張機能がChromiumへ読み込まれる", Boolean(extensionId), extensionId ?? "IDを取得できません");

  // 1. BookWalker: ボタンが出て、押すと全チェックが付く
  const bw = await context.newPage();
  const bwErrors = [];
  bw.on("pageerror", (error) => bwErrors.push(error.message));
  await bw.goto("https://bookwalker.jp/series/5101/list/");
  let buttonAppeared = true;
  try {
    await bw.waitForSelector("#bw-all-check-btn", { timeout: 8000 });
  } catch {
    buttonAppeared = false;
  }
  check("BookWalker: 「全てチェック」ボタンが追加される", buttonAppeared);
  check("BookWalker: ページ内スクリプトのエラーがない", bwErrors.length === 0, bwErrors.join(" / "));

  if (buttonAppeared) {
    await bw.click("#bw-all-check-btn");
    await bw.waitForTimeout(800);
    const counts = await bw.evaluate(() => ({
      total: document.querySelectorAll(".a-check").length,
      on: document.querySelectorAll(".a-check--on").length
    }));
    check("BookWalker: 押すと全作品がチェックされる", counts.total > 0 && counts.on === counts.total, `${counts.on}/${counts.total}`);
  }

  // 2. ポップアップ: 機能トグルが表示される
  let popupOk = false;
  if (extensionId) {
    const popup = await context.newPage();
    const popupErrors = [];
    popup.on("pageerror", (error) => popupErrors.push(error.message));
    await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popup.waitForTimeout(500);
    const state = await popup.evaluate(() => ({
      hasCalendarToggle: Boolean(document.querySelector("#feature-calendar")),
      hasBookwalkerToggle: Boolean(document.querySelector("#feature-bookwalker")),
      hasCtrlEnterToggle: Boolean(document.querySelector("#feature-ctrl-enter")),
      calendarChecked: document.querySelector("#feature-calendar")?.checked,
      bookwalkerChecked: document.querySelector("#feature-bookwalker")?.checked,
      ctrlEnterChecked: document.querySelector("#feature-ctrl-enter")?.checked
    }));
    popupOk = state.hasCalendarToggle && state.hasBookwalkerToggle && state.hasCtrlEnterToggle;
    check("ポップアップ: 3つの機能トグルが表示される", popupOk, JSON.stringify(state));
    check("ポップアップ: 既定値はすべてオン",
      state.calendarChecked === true && state.bookwalkerChecked === true && state.ctrlEnterChecked === true);
    check("ポップアップ: スクリプトのエラーがない", popupErrors.length === 0, popupErrors.join(" / "));

    // 3. 機能フラグ: BookWalkerを切るとボタンが消え、戻すと復活する
    if (popupOk) {
      await popup.click('label[for="feature-bookwalker"]');
      await popup.waitForTimeout(600);
      await bw.reload();
      await bw.waitForTimeout(1500);
      const hiddenAfterOff = (await bw.$("#bw-all-check-btn")) === null;
      check("機能フラグ: オフにするとBookWalkerのボタンが出ない", hiddenAfterOff);

      await popup.click('label[for="feature-bookwalker"]');
      await popup.waitForTimeout(600);
      await bw.reload();
      let reappeared = true;
      try {
        await bw.waitForSelector("#bw-all-check-btn", { timeout: 8000 });
      } catch {
        reappeared = false;
      }
      check("機能フラグ: オンへ戻すとボタンが復活する", reappeared);
    }
  }

  // 4. カレンダー: プリセット欄が出て、None/Allで表示カレンダーが切り替わる
  const cal = await context.newPage();
  const calErrors = [];
  cal.on("pageerror", (error) => calErrors.push(error.message));
  await cal.goto("https://calendar.google.com/calendar/u/0/r/week");
  let sectionAppeared = true;
  try {
    await cal.waitForSelector("#calendar-preset-switcher-root", { timeout: 8000 });
  } catch {
    sectionAppeared = false;
  }
  check("カレンダー: プリセット欄がサイドバーへ挿入される", sectionAppeared);
  check("カレンダー: ページ内スクリプトのエラーがない", calErrors.length === 0, calErrors.join(" / "));

  if (sectionAppeared) {
    const rows = await cal.$$eval(".cps-preset-row", (elements) => elements.map((element) => element.textContent.trim()));
    check("カレンダー: All / None の行が表示される", rows.includes("All") && rows.includes("None"), rows.join(", "));

    await cal.click('.cps-preset-row:has-text("None")');
    await cal.waitForTimeout(600);
    const afterNone = await cal.$$eval('.section div[data-id] input[type="checkbox"]', (elements) => elements.filter((element) => element.checked).length);
    check("カレンダー: Noneで全カレンダーが非表示になる", afterNone === 0, `checked=${afterNone}`);

    await cal.click('.cps-preset-row:has-text("All")');
    await cal.waitForTimeout(600);
    const afterAll = await cal.$$eval('.section div[data-id] input[type="checkbox"]', (elements) => elements.filter((element) => element.checked).length);
    check("カレンダー: Allで全カレンダーが表示になる", afterAll === 3, `checked=${afterAll}`);
  }

  // 5. Ctrl+Enter送信: Enterは改行、Ctrl+Enterは送信
  const chat = await context.newPage();
  const chatErrors = [];
  chat.on("pageerror", (error) => chatErrors.push(error.message));
  await chat.goto("https://chatgpt.com/");
  await chat.waitForSelector("#prompt-textarea", { timeout: 8000 });
  await chat.click("#prompt-textarea");
  await chat.keyboard.type("テスト");
  await chat.keyboard.press("Enter");
  await chat.waitForTimeout(150);
  const afterEnter = await chat.evaluate(() => ({
    sends: window.__sendCount,
    text: document.getElementById("prompt-textarea").innerText
  }));
  check("Ctrl+Enter: Enterは送信せず改行する",
    afterEnter.sends === 0 && afterEnter.text.includes("\n"), JSON.stringify(afterEnter));

  await chat.keyboard.press("Control+Enter");
  await chat.waitForTimeout(200);
  const afterCtrlEnter = await chat.evaluate(() => ({
    sends: window.__sendCount,
    text: document.getElementById("prompt-textarea").innerText
  }));
  check("Ctrl+Enter: Ctrl+Enterで1回だけ送信される",
    afterCtrlEnter.sends === 1 && afterCtrlEnter.text === "", JSON.stringify(afterCtrlEnter));
  check("Ctrl+Enter: ページ内スクリプトのエラーがない", chatErrors.length === 0, chatErrors.join(" / "));

  // 日本語のaria-labelしかない送信ボタンでも、汎用探索で送信できる
  const gc = await context.newPage();
  await gc.goto("https://chat.google.com/room/sample");
  await gc.waitForSelector('[contenteditable="true"]', { timeout: 8000 });
  await gc.click('[contenteditable="true"]');
  await gc.keyboard.type("こんにちは");
  await gc.keyboard.press("Control+Enter");
  await gc.waitForTimeout(200);
  const gcAfterCtrl = await gc.evaluate(() => ({
    sends: window.__sendCount,
    text: document.querySelector('[contenteditable="true"]').innerText
  }));
  check("Ctrl+Enter: 日本語の送信ボタンでも送信できる",
    gcAfterCtrl.sends === 1 && gcAfterCtrl.text === "", JSON.stringify(gcAfterCtrl));

  await gc.keyboard.type("改行");
  await gc.keyboard.press("Enter");
  await gc.waitForTimeout(150);
  const gcAfterEnter = await gc.evaluate(() => ({
    sends: window.__sendCount,
    text: document.querySelector('[contenteditable="true"]').innerText
  }));
  check("Ctrl+Enter: Google ChatでもEnterは改行になる",
    gcAfterEnter.sends === 1 && gcAfterEnter.text.includes("\n"), JSON.stringify(gcAfterEnter));

  // メンション候補が開いている間のEnterは、改行ではなくサイトの決定操作に譲る
  await gc.evaluate(() => document.querySelector('[contenteditable="true"]').setAttribute("aria-activedescendant", "mention-1"));
  await gc.keyboard.type("@a");
  await gc.keyboard.press("Enter");
  await gc.waitForTimeout(150);
  const gcMention = await gc.evaluate(() => ({
    sends: window.__sendCount,
    text: document.querySelector('[contenteditable="true"]').innerText
  }));
  check("Ctrl+Enter: メンション候補中のEnterは決定に譲る",
    gcMention.sends === 1 && gcMention.text.includes("[mention]"), JSON.stringify(gcMention));

  // Gemini相当: 日本語のaria-label「プロンプトを送信」しか無いボタンでも送信できる
  const gm = await context.newPage();
  await gm.goto("https://gemini.google.com/app");
  await gm.waitForSelector(".ql-editor", { timeout: 8000 });
  await gm.click(".ql-editor");
  await gm.keyboard.type("テスト");
  await gm.keyboard.press("Control+Enter");
  await gm.waitForTimeout(200);
  const gmAfterCtrl = await gm.evaluate(() => ({
    sends: window.__sendCount,
    text: document.querySelector(".ql-editor").innerText
  }));
  check("Ctrl+Enter: Geminiの「プロンプトを送信」ボタンでも送信できる",
    gmAfterCtrl.sends === 1 && gmAfterCtrl.text === "", JSON.stringify(gmAfterCtrl));

  // 6. 機能フラグ: オフにするとEnterはサイト既定の送信へ戻る
  if (extensionId) {
    const popupForChat = await context.newPage();
    await popupForChat.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popupForChat.waitForTimeout(400);
    await popupForChat.click('label[for="feature-ctrl-enter"]');
    await popupForChat.waitForTimeout(500);
    await chat.reload();
    await chat.waitForTimeout(800);
    await chat.click("#prompt-textarea");
    await chat.keyboard.type("フラグオフ");
    await chat.keyboard.press("Enter");
    await chat.waitForTimeout(200);
    const offState = await chat.evaluate(() => ({
      sends: window.__sendCount,
      text: document.getElementById("prompt-textarea").innerText
    }));
    check("Ctrl+Enter: オフにするとEnterはサイト既定の送信に戻る",
      offState.sends === 1, JSON.stringify(offState));

    await popupForChat.click('label[for="feature-ctrl-enter"]');
    await popupForChat.waitForTimeout(400);
    await popupForChat.close();
  }
} catch (error) {
  check("スモークテストの実行", false, error?.message ?? String(error));
} finally {
  await context?.close().catch(() => {});
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);


