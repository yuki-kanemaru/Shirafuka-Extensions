import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

test("必要最小限の権限だけを要求する", () => {
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.host_permissions, [
    "https://calendar.google.com/*",
    "https://bookwalker.jp/*",
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://chat.google.com/*",
    "https://mail.google.com/chat/*"
  ]);
  assert.equal("oauth2" in manifest, false);
  assert.equal("background" in manifest, false);
});

test("ManifestはカレンダーとBookWalkerのContent Scriptを登録する", () => {
  const [calendar, bookwalker] = manifest.content_scripts;
  assert.deepEqual(calendar.matches, ["https://calendar.google.com/*"]);
  assert.deepEqual(calendar.js, [
    "src/content/shared.js",
    "src/content/calendar-dom-adapter.js",
    "src/content/calendar.js"
  ]);
  assert.deepEqual(calendar.css, ["src/content/calendar.css"]);

  assert.deepEqual(bookwalker.matches, ["https://bookwalker.jp/series/*/list/*"]);
  assert.deepEqual(bookwalker.js, ["src/content/shared.js", "src/content/bookwalker.js"]);
  assert.deepEqual(bookwalker.css, ["src/content/bookwalker.css"]);
});

test("Manifestは4つのチャットサイトへCtrl+Enter送信のContent Scriptを登録する", () => {
  const chat = manifest.content_scripts.find((script) => script.js.includes("src/content/ctrl-enter.js"));
  assert.ok(chat, "ctrl-enter.js が登録されている");
  assert.deepEqual(chat.matches, [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://chat.google.com/*",
    "https://mail.google.com/chat/*"
  ]);
  assert.deepEqual(chat.js, [
    "src/content/shared.js",
    "src/content/ctrl-enter-core.js",
    "src/content/ctrl-enter.js"
  ]);
  assert.equal(chat.run_at, "document_start");
  assert.equal("css" in chat, false);
});

test("Manifestは各表示サイズの拡張機能アイコンを登録する", () => {
  const expected = {
    "16": "src/icons/icon-16.png",
    "32": "src/icons/icon-32.png",
    "48": "src/icons/icon-48.png",
    "128": "src/icons/icon-128.png"
  };
  assert.deepEqual(manifest.icons, expected);
  assert.deepEqual(manifest.action.default_icon, expected);
  assert.equal(manifest.action.default_popup, "src/popup/popup.html");
});

test("Manifestが参照するファイルはすべて存在する", async () => {
  const files = new Set();
  Object.values(manifest.icons ?? {}).forEach((file) => files.add(file));
  Object.values(manifest.action?.default_icon ?? {}).forEach((file) => files.add(file));
  if (manifest.action?.default_popup) files.add(manifest.action.default_popup);
  for (const script of manifest.content_scripts) {
    (script.js ?? []).forEach((file) => files.add(file));
    (script.css ?? []).forEach((file) => files.add(file));
  }

  assert.ok(files.size > 0);
  for (const file of files) {
    await access(new URL(`../${file}`, import.meta.url));
  }
});

test("Content Scriptは共通スクリプトを先に読み込む", () => {
  for (const script of manifest.content_scripts) {
    assert.equal(script.js[0], "src/content/shared.js");
  }
});
