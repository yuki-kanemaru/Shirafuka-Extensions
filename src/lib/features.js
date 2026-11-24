// この拡張の機能フラグ。ポップアップとコンテンツスクリプトの双方から同じ既定値を参照する。
// コンテンツスクリプトはESモジュールを読み込めないため、同じ内容を src/content/shared.js に持つ。
// 両者の一致は tests/features.test.js で検証している。
export const FEATURE_KEY = "shirafuka.features";

export const FEATURE_DEFAULTS = Object.freeze({
  calendarPresets: true,
  bookwalkerAllCheck: true,
  ctrlEnterSend: true
});

export function normalizeFeatures(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    calendarPresets: source.calendarPresets !== false,
    bookwalkerAllCheck: source.bookwalkerAllCheck !== false,
    ctrlEnterSend: source.ctrlEnterSend !== false
  };
}

export async function loadFeatures() {
  const stored = await chrome.storage.sync.get(FEATURE_KEY);
  return normalizeFeatures(stored[FEATURE_KEY]);
}

export async function saveFeatures(patch) {
  const current = await loadFeatures();
  const next = normalizeFeatures({ ...current, ...patch });
  await chrome.storage.sync.set({ [FEATURE_KEY]: next });
  return next;
}
