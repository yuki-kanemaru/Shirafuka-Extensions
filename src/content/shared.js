// コンテンツスクリプト共通の機能フラグ読み出し。
// ESモジュール版（src/lib/features.js）と同じ既定値・同じ正規化を持つ。
(() => {
  "use strict";

  const FEATURE_KEY = "shirafuka.features";
  const DEFAULTS = Object.freeze({
    calendarPresets: true,
    bookwalkerAllCheck: true,
    ctrlEnterSend: true
  });

  function normalizeFeatures(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      calendarPresets: source.calendarPresets !== false,
      bookwalkerAllCheck: source.bookwalkerAllCheck !== false,
      ctrlEnterSend: source.ctrlEnterSend !== false
    };
  }

  async function getFeatures() {
    try {
      const stored = await chrome.storage.sync.get(FEATURE_KEY);
      return normalizeFeatures(stored[FEATURE_KEY]);
    } catch {
      return { ...DEFAULTS };
    }
  }

  function onFeaturesChanged(listener) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !changes[FEATURE_KEY]) return;
      listener(normalizeFeatures(changes[FEATURE_KEY].newValue));
    });
  }

  globalThis.ShirafukaShared = Object.freeze({
    FEATURE_KEY,
    DEFAULTS,
    normalizeFeatures,
    getFeatures,
    onFeaturesChanged
  });
})();
