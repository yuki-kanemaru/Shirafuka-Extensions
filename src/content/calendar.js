// Googleカレンダーの表示カレンダーをプリセットで切り替える。
// 機能フラグ（shirafuka.features.calendarPresets）で有効・無効を切り替えられる。
(() => {
  "use strict";

  const MESSAGE = {
    GET_STATE: "presets:getState",
    SAVE_CURRENT_PRESET: "presets:saveCurrent",
    DELETE_PRESET: "presets:delete",
    APPLY_PRESET: "presets:apply",
    SET_BOOKING_PAGES_VISIBILITY: "presets:setBookingPages"
  };
  const SPECIAL = { ALL: "__all__", NONE: "__none__" };
  const ROOT_ID = "calendar-preset-switcher-root";
  const PRESET_LIST_ID = "calendar-preset-switcher-list";

  let observer = null;
  let renderTimer = null;
  let isSectionExpanded = true;
  let running = false;

  function isInvalidatedContext(error) {
    return /Extension context invalidated/i.test(error?.message || "");
  }

  function onUnhandledRejection(event) {
    if (!isInvalidatedContext(event.reason)) return;
    event.preventDefault();
    stop();
  }

  function assertExtensionContext() {
    if (!chrome.runtime?.id) throw new Error("Extension context invalidated.");
  }

  async function storageGet(keys) {
    assertExtensionContext();
    try {
      return await chrome.storage.sync.get(keys);
    } catch (error) {
      if (isInvalidatedContext(error)) stop();
      throw error;
    }
  }

  async function storageSet(items) {
    assertExtensionContext();
    try {
      await chrome.storage.sync.set(items);
    } catch (error) {
      if (isInvalidatedContext(error)) stop();
      throw error;
    }
  }

  const normalizeIds = (ids) => [...new Set(ids)].sort();
  const idsEqual = (a, b) => {
    const left = normalizeIds(a);
    const right = normalizeIds(b);
    return left.length === right.length && left.every((id, index) => id === right[index]);
  };

  async function getPresets() {
    const { presets = [] } = await storageGet("presets");
    return Array.isArray(presets) ? presets : [];
  }

  async function getShowBookingPages() {
    const result = await storageGet("showBookingPages");
    return result.showBookingPages === true;
  }

  function activePresetId(calendars, presets) {
    const selected = calendars.filter((item) => item.selected).map((item) => item.id);
    const match = presets.find((preset) => idsEqual(selected, preset.calendarIds));
    if (match) return match.id;
    if (idsEqual(selected, calendars.map((item) => item.id))) return SPECIAL.ALL;
    if (!selected.length) return SPECIAL.NONE;
    return null;
  }

  async function getState() {
    const calendars = CalendarDomAdapter.getCalendars();
    if (!calendars.length) throw new Error("カレンダー一覧が見つかりません。左サイドバーを開いてください。");
    const [presets, showBookingPages] = await Promise.all([getPresets(), getShowBookingPages()]);
    return { calendars, presets, showBookingPages, activePresetId: activePresetId(calendars, presets) };
  }

  async function applyPreset(presetId) {
    const { calendars, presets } = await getState();
    let targetIds;
    if (presetId === SPECIAL.ALL) targetIds = calendars.map((item) => item.id);
    else if (presetId === SPECIAL.NONE) targetIds = [];
    else {
      const preset = presets.find((item) => item.id === presetId);
      if (!preset) throw new Error("プリセットが見つかりません。");
      const available = new Set(calendars.map((item) => item.id));
      targetIds = preset.calendarIds.filter((id) => available.has(id));
    }
    const result = await CalendarDomAdapter.applySelection(targetIds);
    void renderControls();
    return result;
  }

  async function handleMessage(message) {
    if (message.type === MESSAGE.GET_STATE) return getState();
    if (message.type === MESSAGE.APPLY_PRESET) return applyPreset(message.presetId);
    if (message.type === MESSAGE.SAVE_CURRENT_PRESET) {
      const { calendars, presets } = await getState();
      const name = String(message.name || "").trim();
      if (!name) throw new Error("プリセット名を入力してください。");
      const preset = {
        id: crypto.randomUUID(),
        name,
        icon: "📅",
        calendarIds: calendars.filter((item) => item.selected).map((item) => item.id).sort()
      };
      await storageSet({ presets: [...presets, preset] });
      await renderControls();
      return { preset };
    }
    if (message.type === MESSAGE.DELETE_PRESET) {
      const presets = await getPresets();
      await storageSet({ presets: presets.filter((item) => item.id !== message.presetId) });
      await renderControls();
      return { deleted: true };
    }
    if (message.type === MESSAGE.SET_BOOKING_PAGES_VISIBILITY) {
      const showBookingPages = message.visible === true;
      await storageSet({ showBookingPages });
      CalendarDomAdapter.setBookingPagesVisible(showBookingPages);
      await renderControls();
      return { showBookingPages };
    }
    throw new Error("未対応のメッセージです。");
  }

  // 他の機能のメッセージを奪わないよう、自分の名前空間だけに応答する。
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!String(message?.type || "").startsWith("presets:")) return false;
    if (!running) {
      sendResponse({ ok: false, error: "カレンダープリセットは無効です。ポップアップで有効にしてください。" });
      return false;
    }
    handleMessage(message)
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "操作に失敗しました。" }));
    return true;
  });

  function setSectionExpanded(root, expanded) {
    const toggle = root.querySelector(".cps-section-toggle");
    const content = root.querySelector(".cps-section-content");
    if (!toggle || !content) return;
    isSectionExpanded = expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
    content.hidden = !expanded;
  }

  async function renderControls() {
    if (!running) return;
    let root = document.getElementById(ROOT_ID);
    try {
      const showBookingPages = await getShowBookingPages();
      CalendarDomAdapter.setBookingPagesVisible(showBookingPages);
      const anchor = CalendarDomAdapter.findInjectionAnchor();
      if (!anchor) return;
      if (!root) {
        root = document.createElement("section");
        root.id = ROOT_ID;
        root.innerHTML = `
          <button class="cps-section-toggle" type="button" aria-expanded="true" aria-controls="${PRESET_LIST_ID}">
            <span class="cps-title">Calendar Presets</span>
            <svg class="cps-chevron" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"></path>
            </svg>
          </button>
          <div id="${PRESET_LIST_ID}" class="cps-section-content">
            <div class="cps-presets" aria-label="カレンダープリセット"></div>
            <div class="cps-status" role="status"></div>
          </div>`;
        const toggle = root.querySelector(".cps-section-toggle");
        toggle.addEventListener("click", () => {
          setSectionExpanded(root, toggle.getAttribute("aria-expanded") !== "true");
        });
        setSectionExpanded(root, isSectionExpanded);
        anchor.insertAdjacentElement("afterend", root);
      } else if (root.previousElementSibling !== anchor) {
        anchor.insertAdjacentElement("afterend", root);
      }
      const presetList = root.querySelector(".cps-presets");
      const status = root.querySelector(".cps-status");
      const state = await getState();
      presetList.replaceChildren();
      const items = [
        { id: SPECIAL.ALL, name: "All" },
        { id: SPECIAL.NONE, name: "None" },
        ...state.presets
      ];
      for (const item of items) {
        const isActive = item.id === state.activePresetId;
        const row = document.createElement("label");
        row.className = `cps-preset-row${isActive ? " cps-active" : ""}`;
        const control = document.createElement("span");
        control.className = "cps-checkbox-control";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = isActive;
        input.setAttribute("aria-label", `${item.name}プリセット`);
        const box = document.createElement("span");
        box.className = "cps-checkbox-box";
        box.setAttribute("aria-hidden", "true");
        box.innerHTML = `<svg viewBox="0 0 24 24" focusable="false"><path d="M1.73 12.91 8.1 19.28 22.79 4.59"></path></svg>`;
        control.append(input, box);
        const name = document.createElement("span");
        name.className = "cps-preset-name";
        name.textContent = item.name;
        row.append(control, name);
        input.addEventListener("change", async () => {
          input.disabled = true;
          status.textContent = "切り替え中…";
          try {
            const targetId = input.checked ? item.id : SPECIAL.NONE;
            const result = await applyPreset(targetId);
            status.textContent = result.failures.length
              ? `${result.failures.length}件を変更できませんでした`
              : `✓ ${input.checked ? item.name : "None"}`;
          } catch (error) {
            input.checked = !input.checked;
            status.textContent = error.message;
          } finally {
            input.disabled = false;
          }
        });
        presetList.append(row);
      }
      status.textContent = "";
    } catch (error) {
      if (isInvalidatedContext(error)) {
        stop();
        return;
      }
      const status = root?.querySelector(".cps-status");
      if (status) status.textContent = error.message;
    }
  }

  function onStorageChanged(_changes, area) {
    if (area !== "sync" || !running) return;
    void renderControls();
  }

  function start() {
    if (running || !globalThis.CalendarDomAdapter) return;
    running = true;
    globalThis.addEventListener("unhandledrejection", onUnhandledRejection);
    chrome.storage.onChanged.addListener(onStorageChanged);
    observer = new MutationObserver((mutations) => {
      const hasExternalChange = mutations.some((mutation) =>
        !(mutation.target instanceof Element) || !mutation.target.closest(`#${ROOT_ID}`)
      );
      if (!hasExternalChange) return;
      clearTimeout(renderTimer);
      renderTimer = setTimeout(() => void renderControls(), 250);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["checked"]
    });
    void renderControls();
  }

  function stop() {
    if (!running) return;
    running = false;
    clearTimeout(renderTimer);
    observer?.disconnect();
    observer = null;
    globalThis.removeEventListener("unhandledrejection", onUnhandledRejection);
    chrome.storage.onChanged.removeListener(onStorageChanged);
    document.getElementById(ROOT_ID)?.remove();
    document.querySelectorAll(".cps-booking-pages-hidden").forEach((section) => {
      section.classList.remove("cps-booking-pages-hidden");
    });
  }

  async function init() {
    const features = await ShirafukaShared.getFeatures();
    if (features.calendarPresets) start();
    ShirafukaShared.onFeaturesChanged((next) => {
      if (next.calendarPresets) start();
      else stop();
    });
  }

  void init();
})();
