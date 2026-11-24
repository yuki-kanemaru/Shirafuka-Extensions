import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function loadCore() {
  const source = await readFile(new URL("../src/content/ctrl-enter-core.js", import.meta.url), "utf8");
  const context = vm.createContext({ URL, console });
  vm.runInContext(source, context);
  return context.ShirafukaCtrlEnterCore;
}

const press = (overrides = {}) => ({
  key: "Enter",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  isComposing: false,
  keyCode: 13,
  repeat: false,
  ...overrides
});

test("対応4サイトのホストだけを解決する", async () => {
  const core = await loadCore();
  assert.equal(core.siteId("https://chatgpt.com/c/abc"), "chatgpt");
  assert.equal(core.siteId("https://chat.openai.com/"), "chatgpt");
  assert.equal(core.siteId("https://claude.ai/chat/123"), "claude");
  assert.equal(core.siteId("https://gemini.google.com/app"), "gemini");
  assert.equal(core.siteId("https://chat.google.com/room/abc"), "googlechat");
  assert.equal(core.siteId("https://mail.google.com/chat/u/0/#chat/space/abc"), "googlechat");
});

test("Gmailのメール画面など対象外のURLは解決しない", async () => {
  const core = await loadCore();
  for (const href of [
    "https://mail.google.com/mail/u/0/#inbox",
    "https://www.google.com/",
    "https://chatgpt.com.evil.example/",
    "http://chatgpt.com/",
    "https://claude.ai.evil.example/",
    "not a url",
    ""
  ]) {
    assert.equal(core.siteId(href), null, href);
  }
});

test("Enterは改行、Ctrl+Enterと⌘+Enterは送信にする", async () => {
  const core = await loadCore();
  assert.equal(core.decideAction(press()), "newline");
  assert.equal(core.decideAction(press({ ctrlKey: true })), "send");
  assert.equal(core.decideAction(press({ metaKey: true })), "send");
  assert.equal(core.decideAction(press({ key: "NumpadEnter" })), "newline");
});

test("Shift+Enter・Alt+Enterはサイトの既定動作へ任せる", async () => {
  const core = await loadCore();
  assert.equal(core.decideAction(press({ shiftKey: true })), null);
  assert.equal(core.decideAction(press({ altKey: true })), null);
  assert.equal(core.decideAction(press({ ctrlKey: true, shiftKey: true })), "send");
});

test("IME変換中のEnterとEnter以外のキーは触らない", async () => {
  const core = await loadCore();
  assert.equal(core.decideAction(press({ isComposing: true })), null);
  assert.equal(core.decideAction(press({ keyCode: 229 })), null);
  assert.equal(core.decideAction(press({ key: "a" })), null);
  assert.equal(core.decideAction(null), null);
});

test("Ctrl+Enterの押しっぱなしでは二重送信しない", async () => {
  const core = await loadCore();
  assert.equal(core.decideAction(press({ ctrlKey: true, repeat: true })), null);
});

test("全サイトに送信ボタンの手掛かりがある", async () => {
  const core = await loadCore();
  // vm の別realmで作られた配列はプロトタイプが異なるため、ホスト側の配列へ作り直す。
  assert.deepEqual(
    Array.from(core.SITES, (site) => site.id),
    ["chatgpt", "claude", "gemini", "googlechat"]
  );
  for (const site of core.SITES) {
    assert.ok(site.hosts.length > 0, `${site.id}: hosts`);
    assert.ok(site.sendButtons.length > 0, `${site.id}: sendButtons`);
  }
});

test("manifestの対象URLはすべてサイト定義で解決できる", async () => {
  const [core, manifest] = await Promise.all([
    loadCore(),
    readFile(new URL("../manifest.json", import.meta.url), "utf8").then(JSON.parse)
  ]);
  const script = manifest.content_scripts.find((entry) => entry.js.includes("src/content/ctrl-enter.js"));
  assert.ok(script, "ctrl-enter.js のContent Script登録");
  for (const pattern of script.matches) {
    const sample = pattern.replace(/\*$/, "sample/");
    assert.notEqual(core.siteId(sample), null, `${pattern} -> ${sample}`);
  }
});

test("Content Scriptは対象サイトでキャプチャ段階のkeydownを監視する", async () => {
  const source = await readFile(new URL("../src/content/ctrl-enter.js", import.meta.url), "utf8");
  assert.match(source, /window\.addEventListener\("keydown", onKeyDown, true\)/);
  assert.match(source, /window\.removeEventListener\("keydown", onKeyDown, true\)/);
  // 自前で発火する合成イベントを再処理しない。
  assert.match(source, /event\.isTrusted === false/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
});

test("日本語・英語の送信ボタン表記を判定できる", async () => {
  const core = await loadCore();
  for (const label of ["Send", "Send message", "Send prompt", "送信", "メッセージを送信", "プロンプトを送信"]) {
    assert.equal(core.isSendLabel(label), true, label);
  }
  for (const label of ["", "  ", "添付", "音声入力", "フィードバックを送信", null, undefined]) {
    assert.equal(core.isSendLabel(label), false, String(label));
  }
});

test("送信はサイトの送信ボタン、見つからなければEnter合成で行う", async () => {
  const source = await readFile(new URL("../src/content/ctrl-enter.js", import.meta.url), "utf8");
  assert.match(source, /Core\.isSendLabel\(button\.getAttribute\("aria-label"\)\)/);
  assert.match(source, /for \(const selector of site\.sendButtons\)/);
  assert.match(source, /button\.click\(\)/);
  assert.match(source, /const event = dispatchEnter\(composer\);/);
});

test("改行はShift+Enterの合成とexecCommandで行う", async () => {
  const source = await readFile(new URL("../src/content/ctrl-enter.js", import.meta.url), "utf8");
  assert.match(source, /dispatchEnter\(composer, \{ shift: true \}\)/);
  assert.match(source, /execCommand\("insertLineBreak"\)/);
  assert.match(source, /execCommand\("insertText", false, "\\n"\)/);
  assert.match(source, /setRangeText\("\\n", start, end, "end"\)/);
});

test("入力補完中のEnterはサイトの決定操作へ譲る", async () => {
  const source = await readFile(new URL("../src/content/ctrl-enter.js", import.meta.url), "utf8");
  assert.match(source, /function hasOpenSuggestion\(composer\)/);
  assert.match(source, /aria-activedescendant/);
  assert.match(source, /role="combobox"\]\[aria-expanded="true"/);
  assert.match(source, /action === "newline" && hasOpenSuggestion\(composer\)/);
});

test("機能フラグで有効・無効を切り替えられる", async () => {
  const source = await readFile(new URL("../src/content/ctrl-enter.js", import.meta.url), "utf8");
  assert.match(source, /ShirafukaShared\.getFeatures\(\)/);
  assert.match(source, /features\.ctrlEnterSend/);
  assert.match(source, /ShirafukaShared\.onFeaturesChanged/);
  assert.match(source, /window\.removeEventListener/);
});

test("ポップアップはCtrl+Enter送信のスイッチを持つ", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("../src/popup/popup.html", import.meta.url), "utf8"),
    readFile(new URL("../src/popup/popup.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="feature-ctrl-enter"/);
  assert.match(html, /Ctrl\+Enterで送信/);
  assert.match(js, /featureCtrlEnter\.checked = features\.ctrlEnterSend/);
  assert.match(js, /updateFeature\("ctrlEnterSend"/);
});
