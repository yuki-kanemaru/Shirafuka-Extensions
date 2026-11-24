import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/content/bookwalker.js", import.meta.url), "utf8");
const css = await readFile(new URL("../src/content/bookwalker.css", import.meta.url), "utf8");

test("対象はBookWalkerのチェック要素だけをクリックする", () => {
  assert.match(source, /span\.a-check\[data-on-class="a-check--on"\]\[data-off-class="a-check"\]/);
  assert.match(source, /element\.offsetParent !== null/);
});

test("ボタンは「シリーズ予約購入」の左隣へ1つだけ追加する", () => {
  assert.match(source, /const BUTTON_ID = "bw-all-check-btn"/);
  assert.match(source, /if \(!running \|\| document\.getElementById\(BUTTON_ID\)\) return;/);
  assert.match(source, /reservationDiv\.parentNode\.insertBefore\(buttonDiv, reservationDiv\)/);
  assert.match(css, /\.btn-series-reservation#bw-all-check-btn/);
});

test("ページ読み込み時に勝手に全選択しない", () => {
  assert.doesNotMatch(source, /autoClickOnLoad/);
  assert.match(source, /button\.addEventListener\("click"/);
});

test("機能フラグで有効・無効を切り替えられる", () => {
  assert.match(source, /ShirafukaShared\.getFeatures\(\)/);
  assert.match(source, /features\.bookwalkerAllCheck/);
  assert.match(source, /ShirafukaShared\.onFeaturesChanged/);
  assert.match(source, /document\.getElementById\(BUTTON_ID\)\?\.remove\(\)/);
});
