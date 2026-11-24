import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { FEATURE_DEFAULTS, FEATURE_KEY, normalizeFeatures } from "../src/lib/features.js";

// vm の別realmで作られたオブジェクトはプロトタイプが異なるため、比較前に素の値へ戻す。
const plain = (value) => JSON.parse(JSON.stringify(value));

async function loadShared({ get } = {}) {
  const source = await readFile(new URL("../src/content/shared.js", import.meta.url), "utf8");
  const context = vm.createContext({
    chrome: {
      storage: {
        sync: { get: get ?? (async () => ({})) },
        onChanged: { addListener() {} }
      }
    },
    console
  });
  vm.runInContext(source, context);
  return context.ShirafukaShared;
}

test("コンテンツ側とポップアップ側で既定値が一致する", async () => {
  const shared = await loadShared();
  assert.equal(shared.FEATURE_KEY, FEATURE_KEY);
  assert.deepEqual(plain(shared.DEFAULTS), plain(FEATURE_DEFAULTS));
});

test("正規化の結果が両実装で一致する", async () => {
  const shared = await loadShared();
  const samples = [
    undefined,
    null,
    {},
    { calendarPresets: false },
    { bookwalkerAllCheck: false },
    { ctrlEnterSend: false },
    { calendarPresets: false, bookwalkerAllCheck: false, ctrlEnterSend: false },
    { calendarPresets: "no" },
    { ctrlEnterSend: "no" },
    { unexpected: true }
  ];
  for (const sample of samples) {
    assert.deepEqual(plain(shared.normalizeFeatures(sample)), normalizeFeatures(sample));
  }
});

test("未設定なら全機能を有効として扱う", async () => {
  const shared = await loadShared();
  assert.deepEqual(plain(await shared.getFeatures()), { calendarPresets: true, bookwalkerAllCheck: true, ctrlEnterSend: true });
});

test("保存済みの設定を読み出す", async () => {
  const shared = await loadShared({
    get: async () => ({ [FEATURE_KEY]: { calendarPresets: false } })
  });
  assert.deepEqual(plain(await shared.getFeatures()), { calendarPresets: false, bookwalkerAllCheck: true, ctrlEnterSend: true });
});

test("Storageが使えない場合は既定値へ戻す", async () => {
  const shared = await loadShared({
    get: async () => { throw new Error("storage unavailable"); }
  });
  assert.deepEqual(plain(await shared.getFeatures()), { calendarPresets: true, bookwalkerAllCheck: true, ctrlEnterSend: true });
});
