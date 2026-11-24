// 統合版の見た目を確認するためのスクリーンショット撮影。
// 実行: node tests/browser/screenshots.mjs
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const outputDir = path.join(root, "output");

function loadPlaywright() {
  const bases = [
    process.env.PLAYWRIGHT_MODULE_PATH,
    path.join(root, "package.json"),
    "C:/Users/ron06/Documents/Program/codex-web-debug-tools/package.json"
  ].filter(Boolean);
  for (const base of bases) {
    try {
      return createRequire(base)("playwright");
    } catch {
      // 次の候補へ
    }
  }
  throw new Error("playwright が見つかりません。PLAYWRIGHT_MODULE_PATH を指定してください。");
}

function findChromiumExecutable() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  if (!existsSync(base)) return undefined;
  const versions = readdirSync(base)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const name of versions) {
    const exe = path.join(base, name, "chrome-win64", "chrome.exe");
    if (existsSync(exe)) return exe;
  }
  return undefined;
}

const calendarHtml = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>Google カレンダー</title>
<style>
  body { font-family: "Google Sans Text", "Noto Sans JP", sans-serif; margin: 0; background: #fff; color: #1f1f1f; }
  .app { display: flex; height: 100vh; }
  .sidebar { width: 320px; padding: 12px; border-right: 1px solid #e0e0e0; }
  .section { padding: 8px 0; }
  h2 { font-size: 13px; font-weight: 500; margin: 8px 0; color: #444746; }
  label { display: flex; gap: 10px; align-items: center; padding: 6px 8px; font-size: 14px; border-radius: 40px; }
  .main { flex: 1; padding: 24px; background: #f8fafd; }
  .main h1 { font-size: 18px; font-weight: 400; color: #444746; }
</style></head>
<body>
  <div class="app">
    <div class="sidebar">
      <div class="section">
        <h2>カレンダー リスト</h2>
        <div data-id="c2Nob29s"><label><input type="checkbox" aria-label="学校" checked>学校</label></div>
        <div data-id="d29yaw=="><label><input type="checkbox" aria-label="仕事" checked>仕事</label></div>
        <div data-id="cGVyc29uYWw="><label><input type="checkbox" aria-label="個人">個人</label></div>
      </div>
    </div>
    <div class="main"><h1>週の予定</h1></div>
  </div>
</body></html>`;

const bookwalkerHtml = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>作品一覧</title>
<style>
  body { font-family: "Noto Sans JP", sans-serif; margin: 0; background: #fff; color: #222; }
  .wrap { padding: 24px 32px; }
  h1 { font-size: 20px; margin: 0 0 16px; }
  .o-list--actions { display: flex; gap: 10px; margin-bottom: 20px; }
  .a-basic-btn--reserve { display: inline-block; padding: 9px 18px; border: 1px solid #c9c9c9; border-radius: 4px; background: #fff; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
  .a-check { display: inline-block; width: 20px; height: 20px; border: 1px solid #888; border-radius: 2px; text-align: center; line-height: 20px; cursor: pointer; }
  .a-check--on { background: #1a73e8; border-color: #1a73e8; color: #fff; }
</style></head>
<body><div class="wrap">
  <h1>作品一覧</h1>
  <div class="o-list--actions">
    <div class="btn-series-reservation"><a class="a-basic-btn--reserve"><span class="btn-txt">シリーズ予約購入</span></a></div>
  </div>
  <ul>
    <li><span class="a-check" data-on-class="a-check--on" data-off-class="a-check" onclick="this.classList.toggle('a-check--on')">□</span> 作品1</li>
    <li><span class="a-check" data-on-class="a-check--on" data-off-class="a-check" onclick="this.classList.toggle('a-check--on')">□</span> 作品2</li>
    <li><span class="a-check" data-on-class="a-check--on" data-off-class="a-check" onclick="this.classList.toggle('a-check--on')">□</span> 作品3</li>
  </ul>
</div></body></html>`;

const { chromium } = loadPlaywright();

async function waitForExtensionId(userDataDir, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const file of ["Default/Preferences", "Default/Secure Preferences"]) {
      const full = path.join(userDataDir, file);
      if (!existsSync(full)) continue;
      try {
        const json = JSON.parse(await readFile(full, "utf8"));
        for (const [id, value] of Object.entries(json?.extensions?.settings ?? {})) {
          if (typeof value?.path === "string" && path.resolve(value.path).toLowerCase() === root.toLowerCase()) {
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
}const userDataDir = await mkdtemp(path.join(tmpdir(), "shirafuka-shot-"));
await mkdir(outputDir, { recursive: true });

let context;
try {
  context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: findChromiumExecutable(),
    headless: false,
    viewport: { width: 1100, height: 760 },
    args: [
      `--disable-extensions-except=${root}`,
      `--load-extension=${root}`,
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });

  await context.route("https://calendar.google.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: calendarHtml }));
  await context.route("https://bookwalker.jp/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: bookwalkerHtml }));

  const calendar = await context.newPage();
  await calendar.goto("https://calendar.google.com/calendar/u/0/r/week");
  await calendar.waitForSelector("#calendar-preset-switcher-root", { timeout: 8000 });
  await calendar.waitForTimeout(400);
  await calendar.screenshot({ path: path.join(outputDir, "calendar-presets.png") });

  const bookwalker = await context.newPage();
  await bookwalker.goto("https://bookwalker.jp/series/5101/list/");
  await bookwalker.waitForSelector("#bw-all-check-btn", { timeout: 8000 });
  await bookwalker.click("#bw-all-check-btn");
  await bookwalker.waitForTimeout(900);
  await bookwalker.screenshot({ path: path.join(outputDir, "bookwalker-all-check.png") });

  // ポップアップは拡張機能IDが分からないと開けないため、Preferencesから拾う
  const extensionId = await waitForExtensionId(userDataDir);
  if (extensionId) {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 360, height: 520 });
    await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popup.waitForTimeout(600);
    await popup.screenshot({ path: path.join(outputDir, "popup.png"), fullPage: true });
  } else {
    console.log("拡張機能IDを取得できなかったため、ポップアップの撮影は省略しました。");
  }

  console.log(`スクリーンショットを保存しました: ${outputDir}`);
} finally {
  await context?.close().catch(() => {});
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}
