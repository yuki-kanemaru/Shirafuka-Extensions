// チャット系サイトで、Enterを改行、Ctrl+Enter（Macは⌘+Enter）を送信にする。
// 機能フラグ（shirafuka.features.ctrlEnterSend）で有効・無効を切り替えられる。
(() => {
  "use strict";

  const Core = globalThis.ShirafukaCtrlEnterCore;
  const ANCESTOR_SCAN_LIMIT = 8;

  let running = false;
  let site = null;

  function isVisible(element) {
    if (!element || element.getClientRects().length === 0) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  // contenteditable は子孫へ継承されるため、属性を持つ要素そのものだけを編集領域とみなす。
  function isEditable(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.tagName === "TEXTAREA") return !element.disabled && !element.readOnly;
    return element.getAttribute("contenteditable") === "true";
  }

  function findEditable(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    for (const node of path) {
      if (isEditable(node)) return node;
    }
    return isEditable(event.target) ? event.target : null;
  }

  function isUsableButton(element) {
    if (!(element instanceof HTMLElement) || element.tagName !== "BUTTON") return false;
    if (element.disabled || element.getAttribute("aria-disabled") === "true") return false;
    return isVisible(element);
  }

  function nearbyButtons(composer) {
    const buttons = [];
    let node = composer.parentElement;
    for (let depth = 0; node && depth < ANCESTOR_SCAN_LIMIT; depth += 1) {
      buttons.push(...node.querySelectorAll("button"));
      node = node.parentElement;
    }
    return buttons;
  }

  function findSendButton(composer) {
    for (const selector of site.sendButtons) {
      const button = document.querySelector(selector);
      if (isUsableButton(button)) return button;
    }

    const form = composer.closest("form");
    const submit = form?.querySelector('button[type="submit"], button[data-testid*="send" i]');
    if (isUsableButton(submit)) return submit;

    // 表示言語でaria-labelが変わっても拾えるよう、編集欄の近くのボタンだけを見る。
    for (const button of nearbyButtons(composer)) {
      if (!isUsableButton(button)) continue;
      if (Core.isSendLabel(button.getAttribute("aria-label"))) return button;
    }
    return null;
  }

  // サイト本来のEnter処理を借りるための合成キーイベント。
  // 自分たちのkeydownハンドラは isTrusted === false を無視するので再帰しない。
  function dispatchEnter(composer, { shift = false } = {}) {
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      composed: true,
      shiftKey: shift,
      ctrlKey: false,
      metaKey: false,
      altKey: false
    });
    // KeyboardEventの初期化辞書はkeyCode/whichを受け付けないため、参照された場合に備えて上書きする。
    for (const [property, value] of [["keyCode", 13], ["which", 13]]) {
      try {
        Object.defineProperty(event, property, { get: () => value });
      } catch {
        // 定義できない環境では key / code だけに頼る。
      }
    }
    composer.dispatchEvent(event);
    return event;
  }

  function dispatchEnterKeyUp(composer) {
    composer.dispatchEvent(new KeyboardEvent("keyup", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      composed: true
    }));
  }

  function sendMessage(composer) {
    const button = findSendButton(composer);
    if (button) {
      button.click();
      return;
    }
    // 送信ボタンを見つけられない場合の保険。Enterで送信するサイトならこれで送れる。
    const event = dispatchEnter(composer);
    if (!event.defaultPrevented) dispatchEnterKeyUp(composer);
  }

  function insertTextareaNewline(textarea) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.setRangeText("\n", start, end, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function insertNewline(composer) {
    if (composer.tagName === "TEXTAREA") {
      insertTextareaNewline(composer);
      return;
    }

    // まずはサイト本来のShift+Enter処理（ProseMirrorのhard_break等）に任せる。
    const before = composer.innerHTML;
    dispatchEnter(composer, { shift: true });
    if (composer.innerHTML !== before) return;

    // サイトがShift+Enterを扱わない場合の保険。
    try {
      if (document.execCommand("insertLineBreak")) return;
    } catch {
      // execCommand未対応の環境は次の手段へ。
    }
    try {
      document.execCommand("insertText", false, "\n");
    } catch {
      // これ以上打つ手がない場合は何もしない（Enterは既に抑止済み）。
    }
  }

  // メンションやスラッシュメニューなどの入力補完が開いている間は、
  // Enterを「候補の決定」としてサイトへ譲る（改行にしない）。
  function hasOpenSuggestion(composer) {
    if (composer.getAttribute("aria-activedescendant")) return true;
    if (composer.getAttribute("aria-expanded") === "true") return true;
    return Boolean(composer.closest('[role="combobox"][aria-expanded="true"]'));
  }

  function onKeyDown(event) {
    if (!running) return;
    // 自分で発火した合成イベントを再処理しない。
    if (event.isTrusted === false) return;

    const action = Core.decideAction(event);
    if (!action) return;

    const composer = findEditable(event);
    if (!composer || !isVisible(composer)) return;

    // 候補選択中のEnterだけはサイトの決定操作を優先する（Ctrl+Enterの送信は妨げない）。
    if (action === "newline" && hasOpenSuggestion(composer)) return;

    // サイト側のEnter処理より先に止める（windowのキャプチャ段階で受けている）。
    event.preventDefault();
    event.stopPropagation();

    if (action === "send") sendMessage(composer);
    else insertNewline(composer);
  }

  function start() {
    if (running) return;
    site = Core.resolveSite(location.href);
    if (!site) return;
    running = true;
    window.addEventListener("keydown", onKeyDown, true);
  }

  function stop() {
    if (!running) return;
    running = false;
    window.removeEventListener("keydown", onKeyDown, true);
    site = null;
  }

  async function init() {
    const features = await ShirafukaShared.getFeatures();
    if (features.ctrlEnterSend) start();
    ShirafukaShared.onFeaturesChanged((next) => {
      if (next.ctrlEnterSend) start();
      else stop();
    });
  }

  void init();
})();
