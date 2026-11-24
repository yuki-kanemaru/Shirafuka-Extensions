# Shirafuka Extensions

自作のChrome拡張機能を1つにまとめた、自分用の拡張機能です。

- **カレンダープリセット** — Googleカレンダーの表示カレンダーを、名前を付けた組み合わせで一発切り替え
- **BookWalker 一括チェック** — 作品一覧ページで「全てチェック」ボタンを押すと、購入対象をまとめて選択
- **Ctrl+Enterで送信** — ChatGPT・Claude・Gemini・Google Chat で、Enterは改行、Ctrl+Enter（Macは⌘+Enter）で送信

いずれもポップアップのスイッチで個別に無効化できます。

## インストール

1. `chrome://extensions/`（Vivaldiは `vivaldi://extensions/`）を開く
2. 「デベロッパーモード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」を押す
4. このフォルダ（`manifest.json` がある場所）を選ぶ

読み込み後は同じ場所へ置いたままにしてください。移動すると読み込み直しが必要です。

> **以前の拡張機能を無効化してください。** `google-calendar-preset-switcher` と `BookWalker-All-Checking` を同時に有効にすると、同じボタンや欄が二重に表示され、設定の取り合いになります。

## 使い方

### カレンダープリセット

1. Googleカレンダーを開き、左サイドバーの「カレンダー リスト」の下に出る **Calendar Presets** 欄を使う
2. 表示したいカレンダーだけをオンにした状態で、ポップアップの「現在の表示状態を保存」に名前を付けて保存
3. 以後はプリセット欄の行をクリックするだけで切り替わる（`All` / `None` も常に表示）
4. ポップアップからも同じ操作ができ、`予約ページ欄を表示` で予約ページの欄を隠せる

プリセットは `chrome.storage.sync` に保存されるため、同じGoogleアカウントのChrome間で共有されます。以前の Preset 拡張と同じキー（`presets` / `showBookingPages`）を使うので、**保存済みのプリセットはそのまま引き継がれます**。

### BookWalker 一括チェック

1. BookWalkerの作品一覧ページ（`https://bookwalker.jp/series/*/list/*`）を開く
2. 「シリーズ予約購入」の左隣に出る「全てチェック」ボタンを押す
3. 100ms間隔で順にチェックが付く

ページを開いただけでは何も選択されません（誤操作防止）。

### Ctrl+Enterで送信

対象は ChatGPT（`chatgpt.com` / `chat.openai.com`）、Claude（`claude.ai`）、Gemini（`gemini.google.com`）、Google Chat（`chat.google.com` と Gmail内の `/chat`）です。

1. 対象サイトの入力欄で文章を書く
2. **Enter は改行**、**Ctrl+Enter（Macは⌘+Enter）で送信**
3. Shift+Enter は従来どおり改行、IME変換中のEnterは変換確定のまま
4. メンション候補などの入力補完が開いている間は、Enterは候補の決定を優先します

送信は次の順で試します。サイトのUIが変わって動かなくなったら、ページを再読み込みしてください。

1. サイトごとに登録した送信ボタンのセレクタをクリック
2. 入力欄を含むフォームの送信ボタン、または入力欄の近くにある `aria-label` が「送信」「Send」「メッセージを送信」「プロンプトを送信」のボタンをクリック
3. それでも見つからなければ、サイト本来のEnter処理を合成イベントで呼び出す

> 送信ボタンを押す方式のため、サイトが入力内容をまだ受け取っていない瞬間（変換直後など）にCtrl+Enterを押すと、何も起きないことがあります。その場合はもう一度押してください。

## 機能のオン・オフ

ポップアップの「機能」欄で切り替えます。切り替えると開いているタブへすぐ反映され、ページの再読み込みは不要です。

- オフにすると、その機能のボタン・欄・キー操作はページから取り除かれます
- 設定は `chrome.storage.sync` の `shirafuka.features` に保存されます

## ファイル構成

```
manifest.json                 拡張機能の定義
src/
  content/
    shared.js                 機能フラグの読み出し（コンテンツスクリプト共通）
    calendar-dom-adapter.js   GoogleカレンダーのDOM操作
    calendar.js               プリセット欄と切り替え処理
    calendar.css              プリセット欄のスタイル
    bookwalker.js             「全てチェック」ボタンと一括選択
    bookwalker.css            ボタンのスタイル
    ctrl-enter-core.js        対象サイト定義とキー判定（DOM非依存）
    ctrl-enter.js             Enter=改行 / Ctrl+Enter=送信の組み込み
  lib/
    features.js               機能フラグ（ポップアップ側）
    messages.js               メッセージ種別（`presets:` 名前空間）
    preset.js                 プリセットの判定ロジック
  popup/                      統合ポップアップ
  icons/                      アイコンと生成スクリプト
tests/                        自動テスト
docs/feasibility.md           統合時の調査メモ
```

## 開発

```powershell
npm test          # 単体テスト（42件）
npm run check     # 構文チェック
node tests/browser/smoke.mjs   # 実際のChromiumへ読み込む動作確認（22項目）
```

`tests/browser/smoke.mjs` は Playwright を使います。このリポジトリの依存には含めていないため、`PLAYWRIGHT_MODULE_PATH` で導入先を指定するか、既定の探索先（`C:\Users\ron06\Documents\Program\codex-web-debug-tools`）に Playwright がある状態で実行してください。Chromiumは `CHROMIUM_PATH` で明示できます。

> `npm test` は `node --test` ではなく `node tests/run-all.js` を使っています。DSHのサンドボックス下では `node --test` がテストファイルごとに子プロセスを起動できず `EPERM` になるためです。

アイコンの再生成:

```powershell
pwsh -NoProfile -File src/icons/generate-icons.ps1
```

## 権限

- `storage` — プリセットと機能フラグの保存
- `https://calendar.google.com/*` — プリセット欄の挿入と表示カレンダーの切り替え
- `https://bookwalker.jp/*` — 「全てチェック」ボタンの挿入
- `https://chatgpt.com/*` `https://chat.openai.com/*` `https://claude.ai/*` `https://gemini.google.com/*` `https://chat.google.com/*` `https://mail.google.com/chat/*` — Ctrl+Enter送信の組み込み

外部サーバーへの送信、Google API、追加の認証は使いません。カレンダーの予定データやチャットの内容を保存・送信することもありません。

## 元にした拡張機能

- [google-calendar-preset-switcher](https://github.com/shirafukayayoi/google-calendar-preset-switcher) v0.5.5
- [BookWalker-All-Checking](https://github.com/shirafukayayoi/BookWalker-All-Checking) v1.0.0

このリポジトリを正本とし、以降の変更はここへ行います。
