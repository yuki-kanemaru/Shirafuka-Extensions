import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Content ScriptはStorageアクセスをContext安全ラッパーへ集約する", async () => {
  const source = await readFile(new URL("../src/content/calendar.js", import.meta.url), "utf8");
  assert.match(source, /async function storageGet\(keys\)/);
  assert.match(source, /async function storageSet\(items\)/);
  assert.equal((source.match(/chrome\.storage\.sync\.get/g) || []).length, 1);
  assert.equal((source.match(/chrome\.storage\.sync\.set/g) || []).length, 1);
});

test("無効化されたContextの未処理Promiseを停止処理へ送る", async () => {
  const source = await readFile(new URL("../src/content/calendar.js", import.meta.url), "utf8");
  assert.match(source, /addEventListener\("unhandledrejection", onUnhandledRejection\)/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /observer\?\.disconnect\(\)/);
});

test("プリセット欄はアクセシブルな折りたたみ状態を再描画後も維持する", async () => {
  const source = await readFile(new URL("../src/content/calendar.js", import.meta.url), "utf8");
  assert.match(source, /aria-controls="\$\{PRESET_LIST_ID\}"/);
  assert.match(source, /toggle\.setAttribute\("aria-expanded", String\(expanded\)\)/);
  assert.match(source, /content\.hidden = !expanded/);
  assert.match(source, /let isSectionExpanded = true/);
  assert.match(source, /setSectionExpanded\(root, isSectionExpanded\)/);
});

test("プリセット欄はGoogleカレンダーに合わせた行密度でActive背景を持たない", async () => {
  const css = await readFile(new URL("../src/content/calendar.css", import.meta.url), "utf8");
  assert.match(css, /\.cps-section-toggle \{[^}]*height: 32px/);
  assert.match(css, /\.cps-preset-row \{[^}]*min-height: 32px/);
  assert.match(css, /"Google Sans Text"/);
  assert.doesNotMatch(css, /\.cps-preset-row\.cps-active/);
});

test("プリセットの選択状態は左側のチェックマークで表示する", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../src/content/calendar.js", import.meta.url), "utf8"),
    readFile(new URL("../src/content/calendar.css", import.meta.url), "utf8")
  ]);
  assert.match(source, /control\.className = "cps-checkbox-control"/);
  assert.match(source, /row\.append\(control, name\)/);
  assert.match(source, /name\.textContent = item\.name/);
  assert.doesNotMatch(source, /input\.role = "switch"/);
  assert.doesNotMatch(source, /item\.icon \|\|/);
  assert.match(css, /\.cps-checkbox-control input:checked \+ \.cps-checkbox-box/);
  assert.match(css, /\.cps-preset-row \{[^}]*font-size: 14px/);
  assert.match(css, /\.cps-checkbox-box \{[^}]*width: 18px; height: 18px/);
  assert.match(css, /stroke-width: 4/);
});

test("メッセージは自分の名前空間だけに応答する", async () => {
  const source = await readFile(new URL("../src/content/calendar.js", import.meta.url), "utf8");
  assert.match(source, /startsWith\("presets:"\)/);
  assert.match(source, /return false;/);
});

test("機能フラグで有効・無効を切り替えられる", async () => {
  const source = await readFile(new URL("../src/content/calendar.js", import.meta.url), "utf8");
  assert.match(source, /ShirafukaShared\.getFeatures\(\)/);
  assert.match(source, /features\.calendarPresets/);
  assert.match(source, /ShirafukaShared\.onFeaturesChanged/);
  assert.match(source, /function stop\(\)/);
});
