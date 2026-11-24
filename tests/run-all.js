// サンドボックス環境では `node --test` がテストファイルごとに子プロセスを起動できず EPERM になる。
// そのため全テストを1プロセスへ読み込んで実行する。
import "./manifest.test.js";
import "./preset.test.js";
import "./context-lifecycle.test.js";
import "./features.test.js";
import "./bookwalker.test.js";
import "./ctrl-enter.test.js";
