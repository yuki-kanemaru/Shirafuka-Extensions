# 自作Chrome拡張の統合 調査と実装記録（2026-11-10）

対象: `C:\Users\ron06\Documents\Program`（実体は `D:\Program` へのジャンクション）
統合先: `D:\Program\Shirafuka-Extensions`

## 1. 見つかった自作拡張（4件）

`manifest.json` を持つもののうち、`submodules` 配下の Discord RPC サンプルを除いた4件。

| # | フォルダ | 名前 / 版 | 対象サイト | 権限 | 保存 | UI |
|---|---|---|---|---|---|---|
| 1 | `BookWalker-All-Checking` | BookWalker All Checking 1.0.0 | `bookwalker.jp/series/*/list/*` | host: bookwalker.jp | なし | ページ内ボタン |
| 2 | `CalStack/extension` | CalStack 0.3.1 | `calendar.google.com/calendar/*` | storage, host: calendar | `storage.local` | ポップアップ＋ページ内の印 |
| 3 | `From-to-Notion` | From to Notion 0.1.0 | `docs.google.com/forms/*` | なし | なし | ページ内ボタン＋トースト |
| 4 | `google-calendar-preset-switcher` | Calendar Presets 0.5.5 | `calendar.google.com/*` | storage, host: calendar | `storage.sync` | ポップアップ＋サイドバー欄 |

- 4件とも Manifest V3、**バックグラウンド（service worker）なし**、コンテンツスクリプトのみ。
- 実際に読み込まれているのは Vivaldi の `Secure Preferences` 上で #1 と #4 の2件のみ（#2・#3 は未読み込み）。
- #1・#2・#4 は GitHub リポジトリあり（`shirafukayayoi/...`）。#3 は Git 管理外。
- #4 は未コミットの変更あり。統合時は HEAD ではなく作業ツリーの内容を採用した。
- #1 のアイコンは 16/32/48/128 すべて同一の 726KB PNG（合計約2.9MB）だった。

## 2. 実装範囲（決定）

ユーザーの判断により **#4 Calendar Presets と #1 BookWalker All Checking の2機能**を統合した。
CalStack（#2）と From to Notion（#3）は対象外。

このリポジトリを正本とし、各 GitHub リポジトリは履歴として残す。

## 3. 統合時に検討した衝突点と、実際の扱い

| # | 論点 | 結論 |
|---|---|---|
| A | 再描画ループ | **発生しない。** CalStack を外したため、`calendar.google.com` 上で監視し合う拡張は1つだけになった |
| B | メッセージ応答の競合 | **不要になったが保険を入れた。** リスナーは1つだけなので競合しないが、将来の追加に備えて `presets:` 名前空間だけに応答し、他の type には `false` を返す |
| C | ポップアップの二重化 | **統合した。** 1つのポップアップに「機能」「カレンダープリセット」の節を置き、開いているタブに応じて表示を切り替える |
| D | 保存キー | **名前空間化しない。** CalStack を外したため衝突相手がなく、旧 Preset 拡張の `presets` / `showBookingPages` をそのまま使えば保存済みプリセットを移行なしで引き継げる。新規キーは機能フラグの `shirafuka.features` のみ |
| E | CSS | 接頭辞（`cps-*` / `#bw-all-check-btn`）が分かれているため、そのまま流用 |
| F | グローバル変数 | `CalendarDomAdapter` と `ShirafukaShared` のみ。読み込み順は manifest の `js` 配列で保証 |
| G | 権限 | `storage` ＋ `calendar.google.com` ＋ `bookwalker.jp` の3つに収まった |
| H | 無効化手段 | **機能フラグを追加した。** ポップアップのスイッチで各機能を個別に停止でき、開いているタブへ即時反映される |

## 4. 実装した構成

```
manifest.json
src/
  content/
    shared.js                 機能フラグの読み出し（ESモジュール不可のため classic script）
    calendar-dom-adapter.js   GoogleカレンダーのDOM操作（旧 content/calendar-dom-adapter.js）
    calendar.js               プリセット欄と切り替え（機能フラグ対応・start/stop化）
    calendar.css              旧 content/calendar.css
    bookwalker.js             「全てチェック」ボタン（機能フラグ対応・start/stop化）
    bookwalker.css            旧 styles.css
  lib/
    features.js               機能フラグ（ポップアップ側）
    messages.js               `presets:` 名前空間のメッセージ種別
    preset.js                 プリセット判定
  popup/                      統合ポップアップ（HTML/CSS/JS）
  icons/                      16/32/48/128 と生成スクリプト
tests/
  run-all.js                  全テストを1プロセスで実行
  manifest.test.js            権限・content_scripts・参照ファイルの実在
  preset.test.js              プリセット判定
  context-lifecycle.test.js   Context失効時の停止、ARIA、CSS、名前空間、機能フラグ
  features.test.js            コンテンツ側とポップアップ側の既定値・正規化の一致
  bookwalker.test.js          対象セレクタ、ボタン配置、自動実行しないこと
  browser/smoke.mjs           実Chromiumへ読み込む動作確認
```

### 機能フラグの二重実装について

コンテンツスクリプトは Manifest V3 でESモジュールを読み込めないため、同じ既定値・正規化を
`src/content/shared.js`（classic）と `src/lib/features.js`（ES module）に持たせている。
両者がずれると「ポップアップではオンなのにページでは動かない」という厄介な不具合になるため、
`tests/features.test.js` が `vm` で `shared.js` を実行し、既定値と正規化結果の一致を検証している。

## 5. 検証結果

### 単体テスト（26件・すべて成功）

```powershell
npm test   # node tests/run-all.js
```

`node --test` はサンドボックス下でテストファイルごとに子プロセスを起動できず `EPERM` になるため、
全テストを1プロセスへ読み込む `tests/run-all.js` を用意した。

### 実ブラウザー確認（14項目・すべて成功）

`node tests/browser/smoke.mjs` で Chromium へ実際に読み込み、`https://bookwalker.jp/**` と
`https://calendar.google.com/**` をローカルの疑似ページへ差し替えて確認した。

- 拡張機能が読み込まれる（IDを取得）
- BookWalker: 「全てチェック」ボタンが追加され、押すと全作品（3/3）がチェックされる
- ポップアップ: 2つの機能トグルが表示され、既定値は両方オン
- 機能フラグ: オフでボタンが消え、オンへ戻すと復活する
- カレンダー: プリセット欄がサイドバーへ挿入され、`All` / `None` で表示カレンダーが切り替わる
- いずれのページでもスクリプトエラーなし

## 6. 残っている確認（実データ）

疑似ページでは確認できない部分は、実際のアカウントで見る必要がある。

1. 実カレンダーでプリセットが切り替わる（日本語表示・月/週/日表示）
2. 旧 Preset 拡張で保存したプリセットが引き継がれている
3. 実 BookWalker の作品一覧で「全てチェック」が全選択できる
4. 旧2拡張を無効化した状態で、ボタンや欄が二重に出ない

## 7. 今後の拡張候補

- CalStack を入れる場合は、`calendar.google.com` 上で監視し合う2つの `MutationObserver` が
  再描画ループを作らないよう、互いの生成物を監視対象から除外する必要がある（調査時の最大の懸念点）。
- From to Notion を入れる場合は `docs.google.com` の権限が増える。クリップボード書き込みは
  コンテンツスクリプトのままでも動くため、追加の権限は不要。

## 8. 追記: Ctrl+Enter送信（2026-11-24 / v1.1.0）

### 仕様

- 対象は ChatGPT（`chatgpt.com` / `chat.openai.com`）、Claude（`claude.ai`）、Gemini（`gemini.google.com`）、
  Google Chat（`chat.google.com` と Gmail内の `mail.google.com/chat/*`）。Gmailのメール作成画面は対象外。
- **Enter は改行、Ctrl+Enter（Macは⌘+Enter）は送信**に置き換える。Shift+Enter と Alt+Enter はサイトへ任せる。
- IME変換中（`isComposing` / `keyCode === 229`）のEnterは変換確定なので触らない。
- メンションなどの入力補完が開いている間（`aria-activedescendant` / `aria-expanded="true"`）は、
  Enterを候補の決定としてサイトへ譲る。Ctrl+Enterの送信はそのまま動く。

「Enterのまま送信できて、Ctrl+Enterでも送れる」だけでは既存動作と区別が付かず意味がないため、
Enter側を改行へ置き換える仕様にした。これは一般的な「Ctrl+Enterで送信」拡張と同じ挙動。

### 実装方針

- キー判定とサイト定義は `src/content/ctrl-enter-core.js`（DOM非依存・classic script）。
  コンテンツスクリプトはESモジュールを読めないため、既存の `shared.js` と同じ二重実装を避けて
  core を別ファイルに切り出し、`vm` で直接テストしている。
- 編集欄はセレクタに依存せず、keydown の `composedPath()` から `contenteditable="true"` か
  `textarea` を特定する（contenteditable は子孫へ継承されるので、属性を持つ要素だけを見る）。
- 送信は (1) サイト定義の送信ボタン → (2) フォームのsubmit → (3) 編集欄から8階層以内で
  `aria-label` が送信系のボタン → (4) サイト本来のEnter処理を合成イベントで発火、の順。
- 改行はサイト本来のShift+Enter処理を合成イベントで発火し、DOMが変わらなければ
  `execCommand("insertLineBreak")` → `execCommand("insertText")` へ落とす。
- `window` のキャプチャ段階でkeydownを受け、`preventDefault()` と `stopPropagation()` で
  サイト側のEnter処理を止める。自前の合成イベントは `isTrusted === false` で無視して再帰を防ぐ。

### 実サイトで確認したこと

ヘッドレスでログイン不要の範囲だけ確認した。

- Gemini の編集欄は `div.ql-editor[contenteditable="true"]`、送信ボタンは
  `aria-label="プロンプトを送信"`（classに `send-button` は付かない）。この表記を判定に追加した。
- ChatGPT・Claude は未ログインだとCloudflareの待機画面になり、セレクタを確認できなかった。
- Google Chat はログイン画面へリダイレクトされ、確認できなかった。

### 検証

- `npm test` 42件成功（サイト解決・キー判定・補完ガード・マニフェスト・機能フラグ）。
- `node tests/browser/smoke.mjs` 22項目成功。実Chromiumへ拡張を読み込み、
  ChatGPT / Google Chat / Gemini 相当の疑似ページで Enter=改行、Ctrl+Enter=送信、
  機能フラグのオン・オフ、メンション候補中のEnter委譲を確認した。

### 残っている確認（実アカウント）

1. ChatGPT・Claude・Gemini・Google Chat の実画面で Enter が改行になる
2. Ctrl+Enter で1回だけ送信される（二重送信しない）
3. ログイン済みGoogle Chat（Gmail内を含む）で動く
4. 絵文字ピッカーなど、aria属性を出さない補完UIでのEnterの扱い

