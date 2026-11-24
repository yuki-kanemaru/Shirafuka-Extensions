// BookWalkerの作品一覧ページで、購入対象のチェックをまとめて付ける。
// 機能フラグ（shirafuka.features.bookwalkerAllCheck）で有効・無効を切り替えられる。
(() => {
  "use strict";

  const BUTTON_ID = "bw-all-check-btn";
  const CHECK_SELECTOR = 'span.a-check[data-on-class="a-check--on"][data-off-class="a-check"]';
  const CLICK_INTERVAL_MS = 100;

  let observer = null;
  let running = false;

  function clickAllCheckboxes() {
    const checkElements = document.querySelectorAll(CHECK_SELECTOR);
    if (checkElements.length === 0) return;

    checkElements.forEach((element, index) => {
      setTimeout(() => {
        if (element.offsetParent !== null) element.click();
      }, index * CLICK_INTERVAL_MS);
    });
  }

  function createButton() {
    if (!running || document.getElementById(BUTTON_ID)) return;
    const actionsDiv = document.querySelector(".o-list--actions");
    if (!actionsDiv) return;

    const buttonDiv = document.createElement("div");
    buttonDiv.className = "btn-series-reservation";
    buttonDiv.id = BUTTON_ID;

    const button = document.createElement("a");
    button.href = "javascript:void(0)";
    button.className = "a-basic-btn--reserve";
    button.setAttribute("data-ga-category", "bw_all_check");

    const textSpan = document.createElement("span");
    textSpan.className = "btn-txt";
    textSpan.textContent = "全てチェック";
    button.appendChild(textSpan);
    buttonDiv.appendChild(button);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      button.classList.add("executing");
      textSpan.textContent = "実行中...";
      clickAllCheckboxes();

      setTimeout(() => {
        button.classList.remove("executing");
        button.classList.add("completed");
        textSpan.textContent = "完了！";
      }, 500);

      setTimeout(() => {
        button.classList.remove("completed");
        textSpan.textContent = "全てチェック";
      }, 2500);
    });

    const reservationDiv = actionsDiv.querySelector(".btn-series-reservation");
    if (reservationDiv) reservationDiv.parentNode.insertBefore(buttonDiv, reservationDiv);
    else actionsDiv.insertBefore(buttonDiv, actionsDiv.firstChild);
  }

  function start() {
    if (running) return;
    running = true;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(createButton, 500), { once: true });
    } else {
      setTimeout(createButton, 500);
    }

    observer = new MutationObserver((mutations) => {
      if (!mutations.some((mutation) => mutation.type === "childList")) return;
      if (!document.getElementById(BUTTON_ID) && document.querySelector(".o-list--actions")) {
        setTimeout(createButton, 100);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stop() {
    if (!running) return;
    running = false;
    observer?.disconnect();
    observer = null;
    document.getElementById(BUTTON_ID)?.remove();
  }

  async function init() {
    const features = await ShirafukaShared.getFeatures();
    if (features.bookwalkerAllCheck) start();
    ShirafukaShared.onFeaturesChanged((next) => {
      if (next.bookwalkerAllCheck) start();
      else stop();
    });
  }

  void init();
})();
