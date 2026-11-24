// Ctrl+Enter送信の対象サイト定義と、押されたキーから行う操作の判定。
// コンテンツスクリプトはESモジュールを読み込めないため classic script として置き、
// globalThis.ShirafukaCtrlEnterCore 経由で src/content/ctrl-enter.js から使う。
// DOMに触れない純粋な処理だけを置き、tests/ctrl-enter.test.js から直接検証する。
(() => {
  "use strict";

  // サイトごとの送信ボタンの手掛かり（上から順に試す）。
  // セレクタは変わりやすいため、どれも一致しなければ ctrl-enter.js 側の汎用処理
  // （フォームのsubmit・編集欄近くのaria-label「送信」・Enterの合成）へ落とす。
  // 編集欄そのものはどのサイトも contenteditable（またはtextarea）なので、
  // セレクタに頼らず keydown の発生元から特定する。
  const SITES = Object.freeze([
    {
      id: "chatgpt",
      label: "ChatGPT",
      hosts: Object.freeze(["chatgpt.com", "chat.openai.com"]),
      sendButtons: Object.freeze([
        "#composer-submit-button",
        '[data-testid="send-button"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label="Send message"]'
      ])
    },
    {
      id: "claude",
      label: "Claude",
      hosts: Object.freeze(["claude.ai"]),
      sendButtons: Object.freeze([
        'button[aria-label="Send message"]',
        '[data-testid="send-button"]',
        'button[type="submit"]'
      ])
    },
    {
      id: "gemini",
      label: "Gemini",
      hosts: Object.freeze(["gemini.google.com"]),
      // 実際の送信ボタンは class に send を含まず、日本語UIでは aria-label="プロンプトを送信"。
      sendButtons: Object.freeze([
        'button[aria-label="プロンプトを送信"]',
        "button.send-button",
        'button[aria-label="Send message"]'
      ])
    },
    {
      id: "googlechat",
      label: "Google Chat",
      hosts: Object.freeze(["chat.google.com", "mail.google.com"]),
      // Gmail内のChatだけを対象にし、Gmailのメール作成画面には触れない。
      pathPrefixes: Object.freeze({ "mail.google.com": "/chat" }),
      // 送信ボタンのaria-labelは表示言語で変わるため、ここでは英語表記だけ拾い、
      // 日本語UIは isSendLabel（送信／メッセージを送信）で補う。
      sendButtons: Object.freeze([
        'button[aria-label="Send"]',
        'button[aria-label="Send message"]'
      ])
    }
  ]);

  // 送信ボタンのaria-label判定。表示言語によって表記が変わるため、既知の言い回しを並べる。
  const SEND_LABEL = /^(send|送信|メッセージを送信|プロンプトを送信)/i;

  function isSendLabel(label) {
    return typeof label === "string" && SEND_LABEL.test(label.trim());
  }

  function resolveSite(href) {
    let url;
    try {
      url = new URL(href);
    } catch {
      return null;
    }
    if (url.protocol !== "https:") return null;

    const host = url.hostname.toLowerCase();
    for (const site of SITES) {
      if (!site.hosts.includes(host)) continue;
      const prefix = site.pathPrefixes?.[host];
      if (prefix && !url.pathname.startsWith(prefix)) continue;
      return site;
    }
    return null;
  }

  function siteId(href) {
    return resolveSite(href)?.id ?? null;
  }

  // Enter: 改行 / Ctrl+Enter・⌘+Enter: 送信 / Shift+Enter・Alt+Enter: サイトに任せる。
  // IME変換中のEnterは確定操作なので、必ずサイトへ渡す。
  function decideAction(event) {
    if (!event) return null;
    if (event.key !== "Enter" && event.key !== "NumpadEnter") return null;
    if (event.isComposing === true) return null;
    if (event.keyCode === 229) return null;

    if (event.ctrlKey === true || event.metaKey === true) {
      // 押しっぱなしの自動リピートで二重送信しない。
      return event.repeat === true ? null : "send";
    }
    if (event.shiftKey === true || event.altKey === true) return null;
    return "newline";
  }

  globalThis.ShirafukaCtrlEnterCore = Object.freeze({
    SITES,
    resolveSite,
    siteId,
    decideAction,
    isSendLabel
  });
})();
