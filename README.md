# bob-audit-hooks

IBM Bob のライフサイクルフックで、ツール実行とターン完了を監査ログとして記録するための設定です。

## 構成

```
.
├── README.md
├── .gitignore               # .bob/ と README.md 以外を除外
└── .bob/
    ├── settings.json        # フック定義
    ├── hooks/
    │   └── log-tools.mjs    # ログ出力スクリプト (Node.js)
    ├── .gitignore           # logs/ と mcp.json を除外
    └── logs/                # 出力先 (git管理外)
```

## 動作

| イベント | 対象 | 動作 |
|---|---|---|
| `SessionStart` | セッション開始・再開時 | `.bob/logs/` と当セッションのログファイルを作成し、開始を記録 |
| `UserPromptSubmit` | プロンプト送信時 | ユーザーが入力したプロンプトを記録 |
| `PreToolUse` | 全ツール (`.*`) | ツール実行前の呼び出し・入力を記録 |
| `PostToolUse` | 全ツール (`.*`) | ツール名・入力・実行結果を記録 |
| `Stop` | ターン完了時 | AI応答サマリーを記録 |

`log-tools.mjs` はstdinからJSONペイロードを受け取り、セッションIDごとに2種類のファイルを `.bob/logs/` へ追記します。タイムスタンプはJST (UTC+9) です。

- `tool_audit_<session_id>.log` : 人が読むためのタイムライン形式
- `tool_audit_<session_id>.jsonl` : プログラム解析用のJSON Lines

## 使い方

1. このリポジトリをダウンロードする
   - ZIP: GitHub の **Code → Download ZIP** で取得して展開する。フォルダ名は `bob-audit-hooks-main` になる
   - git: `git clone git@github.com:ikegami-ririko/bob-audit-hooks.git`。フォルダ名は `bob-audit-hooks` になる
2. ダウンロードした中の `.bob/` の内容を、フックを有効にしたいプロジェクトの `.bob/` に配置する
   - **プロジェクト内にまだ `.bob/` がない場合**：そのままフォルダーごとコピーします。
   - **すでにプロジェクト内に `.bob/` が存在する場合（通常はこちら）**：
     - `hooks/` フォルダーおよび `logs/` フォルダーをプロジェクトの `.bob/` 配下にコピーします。
     - 既存の `.bob/settings.json` がある場合は、`settings.json` の `hooks` 設定部分をマージ（追記）してください（上書きすると既存のモードや他の設定が消えてしまいます）。

   **フォルダー/ファイルコピーの例：**
   ```bash
   # macOS / Linux: ZIPで取得した場合 (.bob/ 内へ内容をマージコピー)
   cp -R bob-audit-hooks-main/.bob/ /path/to/your-project/.bob/

   # macOS / Linux: git cloneした場合 (.bob/ 内へ内容をマージコピー)
   cp -R bob-audit-hooks/.bob/ /path/to/your-project/.bob/
   ```
   ```bat
   :: Windows (cmd): ZIPで取得した場合 (.bob 配下にマージ)
   xcopy /E /I /Y bob-audit-hooks-main\.bob C:\path\to\your-project\.bob

   :: Windows (cmd): git cloneした場合 (.bob 配下にマージ)
   xcopy /E /I /Y bob-audit-hooks\.bob C:\path\to\your-project\.bob
   ```
   - Windows ではエクスプローラーで `hooks` や `logs` フォルダを既存の `.bob` フォルダへドラッグ＆ドロップして配置しても構いません。
   - すでに `.bob/settings.json` がある場合は、ファイルの丸ごと上書きを避け、後述の通り `hooks` のJSONブロックのみをエディタで追記・マージしてください。
3. Node.js をインストールする
   - Windows では `cmd` から `node -v` が通ること(PATH に `node` があること)を確認する
4. コピー先のプロジェクトをBobのワークスペースとして開く(`node .bob/hooks/log-tools.mjs` は相対パス実行のため)
5. Bobを通常通り使うと `.bob/logs/` にログが生成される

## 出力イメージ

出力先は `.bob/logs/` です。セッションごとにファイルが分かれます。

```
.bob/logs/
├── tool_audit_<session_id>.log
└── tool_audit_<session_id>.jsonl
```

### `.log` (タイムライン形式)

ツールの種類ごとにアイコンと見出しが付き、1件ずつ区切り線で区切られます。

```
================================================================================
[2026-01-01 09:00:00 JST] 🟢 【セッション開始 (SessionStart)】 Session: <session_id>
  開始種別 : startup
  cwd      : /path/to/your-project
--------------------------------------------------------------------------------

================================================================================
[2026-01-01 09:00:02 JST] 💬 【ユーザープロンプト (UserPromptSubmit)】 Session: <session_id>
pom.xml を探して、テストを実行して
--------------------------------------------------------------------------------

================================================================================
[2026-01-01 09:00:04 JST] 🔍 【ファイル探索】 glob
  ツール   : glob
  対象     : **/pom.xml
--- [実行結果] ---
src/app/pom.xml
src/lib/pom.xml
--------------------------------------------------------------------------------

================================================================================
[2026-01-01 09:00:10 JST] 💻 【コマンド実行】 execute_command
  コマンド : mvn -q test
--- [実行結果] ---
Tests run: 12, Failures: 0, Errors: 0, Skipped: 0
--------------------------------------------------------------------------------

================================================================================
[2026-01-01 09:00:30 JST] 🏁 【ターン完了 (Stop)】 Session: <session_id>
--- [AI応答サマリー] ---
テストが全件成功しました。
--------------------------------------------------------------------------------
```

ツールの種類と見出しの対応は次のとおりです。

| ツール | 見出し |
|---|---|
| `SessionStart` | 🟢 【セッション開始】 |
| `UserPromptSubmit` | 💬 【ユーザープロンプト】 |
| `start_subtask` | 🚀 【サブタスク起動】 |
| `spawn_subagent` | 🤖 【サブエージェント】 |
| `execute_command` | 💻 【コマンド実行】 |
| `write_file` / `apply_diff` / `search_and_replace` / `insert_content` | 📝 【ファイル編集】 |
| `read_file` / `glob` / `grep` / `list_files` | 🔍 【ファイル探索】 |
| `mcp__*` | 🔌 【MCPツール】 |
| 上記以外 | 🔧 【ツール名】 |

### `.jsonl` (解析用)

1行が1イベントです。

```json
{"timestamp":"2026-01-01T09:00:04.767+09:00","session_id":"<session_id>","cwd":"/path/to/your-project","event":"PostToolUse","tool_name":"glob","tool_input":{"pattern":"**/pom.xml"},"tool_response":"src/app/pom.xml\nsrc/lib/pom.xml","last_assistant_message":null}
```

## 注意

- ログにはユーザーのプロンプトやツールの実行結果(ファイル内容やコマンド出力)がそのまま入るため、コミットしないこと。`.bob/.gitignore` で除外済み
- `mcp.json` はローカルのポート・トークンを含むためコミットしない
- フックのタイムアウトは10秒。失敗してもBobの動作は止まらない(スクリプトは常に `exit 0`)
- フックのコマンドは macOS / Linux では `sh -c`、Windows では `cmd /c` で実行される。`settings.json` の `node .bob/hooks/log-tools.mjs` はどちらでもそのまま動く
- ログはUTF-8で出力される。Windowsでは UTF-8 対応のエディタ(VS Code など)で開くこと。古いメモ帳などでは文字化けすることがある
