import { MESSAGE } from "../lib/messages.js";
import { SPECIAL_PRESET } from "../lib/preset.js";
import { loadFeatures, saveFeatures } from "../lib/features.js";

const $ = (selector) => document.querySelector(selector);
const status = $("#status");
const list = $("#presets");
const form = $("#save-form");
const nameInput = $("#preset-name");
const bookingPagesToggle = $("#show-booking-pages");
const calendarPanel = $("#calendar-panel");
const hint = $("#hint");
const featureCalendar = $("#feature-calendar");
const featureBookwalker = $("#feature-bookwalker");
const featureCtrlEnter = $("#feature-ctrl-enter");

let features = null;
let activeTab = null;

// manifest.json の content_scripts（ctrl-enter.js）と同じ対象。増やすときは両方を揃える。
const CHAT_SITE_PATTERN = /^https:\/\/(?:chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|chat\.google\.com|mail\.google\.com\/chat)\//;

const isCalendarTab = (tab) => Boolean(tab?.url?.startsWith("https://calendar.google.com/"));
const isBookwalkerListTab = (tab) => Boolean(tab?.url && /^https:\/\/bookwalker\.jp\/series\/[^/]+\/list\//.test(tab.url));
const isChatTab = (tab) => Boolean(tab?.url && CHAT_SITE_PATTERN.test(tab.url));

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function send(type, payload = {}) {
  if (!activeTab?.id || !isCalendarTab(activeTab)) {
    throw new Error("Google CalendarのタブでPopupを開いてください。");
  }
  let response;
  try {
    response = await chrome.tabs.sendMessage(activeTab.id, { type, ...payload });
  } catch {
    throw new Error("Google Calendarを再読み込みしてから、もう一度お試しください。");
  }
  if (!response?.ok) throw new Error(response?.error ?? "Google Calendarから応答がありません。");
  return response;
}

function addPresetButton(container, { id, name, icon = "" }, activeId, deletable = false) {
  const row = document.createElement("div");
  row.className = "preset";
  const button = document.createElement("button");
  button.type = "button";
  button.classList.toggle("active", id === activeId);
  button.textContent = `${id === activeId ? "●" : "○"} ${icon} ${name}`.replace(/\s+/g, " ");
  button.addEventListener("click", () => applyPreset(id, name));
  row.append(button);
  if (deletable) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete";
    remove.title = `${name}を削除`;
    remove.setAttribute("aria-label", `${name}を削除`);
    remove.textContent = "×";
    remove.addEventListener("click", () => deletePreset(id));
    row.append(remove);
  }
  container.append(row);
}

async function loadPresets() {
  list.replaceChildren();
  setStatus("Google Calendarの状態を読み込み中…");
  try {
    const { presets, activePresetId, showBookingPages } = await send(MESSAGE.GET_STATE);
    bookingPagesToggle.checked = showBookingPages;
    addPresetButton(list, { id: SPECIAL_PRESET.ALL, name: "All", icon: "✓" }, activePresetId);
    addPresetButton(list, { id: SPECIAL_PRESET.NONE, name: "None", icon: "—" }, activePresetId);
    presets.forEach((preset) => addPresetButton(list, preset, activePresetId, true));
    setStatus(activePresetId ? "現在の表示状態と一致しています。" : "一致するプリセットはありません。");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function applyPreset(id, name) {
  document.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  setStatus("切り替え中…");
  try {
    const result = await send(MESSAGE.APPLY_PRESET, { presetId: id });
    await loadPresets();
    if (result.failures.length) {
      setStatus(`${result.changed}件を更新、${result.failures.length}件は更新できませんでした。`, true);
    } else {
      setStatus(`✓ ${name}`);
    }
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    document.querySelectorAll("button").forEach((button) => { button.disabled = false; });
  }
}

async function deletePreset(id) {
  try {
    await send(MESSAGE.DELETE_PRESET, { presetId: id });
    await loadPresets();
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderFeatures() {
  featureCalendar.checked = features.calendarPresets;
  featureBookwalker.checked = features.bookwalkerAllCheck;
  featureCtrlEnter.checked = features.ctrlEnterSend;
}

function renderHint() {
  if (isCalendarTab(activeTab)) {
    hint.hidden = true;
    return;
  }
  hint.hidden = false;
  if (isBookwalkerListTab(activeTab)) {
    hint.textContent = features.bookwalkerAllCheck
      ? "このページで「全てチェック」ボタンが使えます。"
      : "BookWalker 一括チェックは無効です。上のスイッチで有効にしてください。";
    return;
  }
  if (isChatTab(activeTab)) {
    hint.textContent = features.ctrlEnterSend
      ? "Enterは改行、Ctrl+Enter（Macは⌘+Enter）で送信します。"
      : "Ctrl+Enter送信は無効です。上のスイッチで有効にしてください。";
    return;
  }
  hint.textContent = "Googleカレンダー・BookWalkerの作品一覧・対応チャットを開くと操作できます。";
}

async function renderCalendarPanel() {
  const calendar = isCalendarTab(activeTab);
  calendarPanel.hidden = !calendar;
  if (!calendar) {
    // カレンダー以外のタブでは操作対象がないため、読み込み中の表示を残さない。
    setStatus("");
    return;
  }

  if (!features.calendarPresets) {
    list.replaceChildren();
    bookingPagesToggle.disabled = true;
    nameInput.disabled = true;
    setStatus("カレンダープリセットは無効です。上のスイッチで有効にしてください。");
    return;
  }

  bookingPagesToggle.disabled = false;
  nameInput.disabled = false;
  await loadPresets();
}

async function render() {
  activeTab = await getActiveTab();
  renderFeatures();
  renderHint();
  await renderCalendarPanel();
}

async function updateFeature(key, value) {
  features = await saveFeatures({ [key]: value });
  renderFeatures();
  await renderCalendarPanel();
  renderHint();
  setStatus("設定を保存しました。");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("保存中…");
  try {
    await send(MESSAGE.SAVE_CURRENT_PRESET, { name: nameInput.value });
    nameInput.value = "";
    await loadPresets();
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.querySelector("#refresh").addEventListener("click", () => { void render(); });

bookingPagesToggle.addEventListener("change", async () => {
  bookingPagesToggle.disabled = true;
  try {
    await send(MESSAGE.SET_BOOKING_PAGES_VISIBILITY, { visible: bookingPagesToggle.checked });
    setStatus(bookingPagesToggle.checked ? "予約ページ欄を表示しました。" : "予約ページ欄を隠しました。");
  } catch (error) {
    bookingPagesToggle.checked = !bookingPagesToggle.checked;
    setStatus(error.message, true);
  } finally {
    bookingPagesToggle.disabled = false;
  }
});

featureCalendar.addEventListener("change", () => { void updateFeature("calendarPresets", featureCalendar.checked); });
featureBookwalker.addEventListener("change", () => { void updateFeature("bookwalkerAllCheck", featureBookwalker.checked); });
featureCtrlEnter.addEventListener("change", () => { void updateFeature("ctrlEnterSend", featureCtrlEnter.checked); });

async function init() {
  try {
    features = await loadFeatures();
  } catch {
    features = { calendarPresets: true, bookwalkerAllCheck: true, ctrlEnterSend: true };
  }
  await render();
}

void init();
