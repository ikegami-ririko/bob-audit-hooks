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
| `PostToolUse` | 全ツール (`.*`) | ツール名・入力・実行結果を記録 |
| `Stop` | ターン完了時 | AI応答サマリーを記録 |

`log-tools.mjs` はstdinからJSONペイロードを受け取り、セッションIDごとに2種類のファイルを `.bob/logs/` へ追記します。タイムスタンプはJST (UTC+9) です。

- `tool_audit_<session_id>.log` : 人が読むためのタイムライン形式
- `tool_audit_<session_id>.jsonl` : プログラム解析用のJSON Lines

## 使い方

1. このリポジトリをダウンロードする(`git clone git@github.com:ikegami-ririko/bob-audit-hooks.git` または GitHub の **Code → Download ZIP**)
2. ダウンロードした中の `.bob/` フォルダを、フックを有効にしたいプロジェクトのディレクトリ直下にコピーする
   ```bash
   cp -r bob-audit-hooks/.bob /path/to/your-project/
   ```
   - 対象プロジェクトに既に `.bob/settings.json` がある場合は上書きされるため、`hooks` の項目だけをマージする
3. Node.js をインストールする
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

- ログにはツールの実行結果(ファイル内容やコマンド出力)がそのまま入るため、コミットしないこと。`.bob/.gitignore` で除外済み
- `mcp.json` はローカルのポート・トークンを含むためコミットしない
- フックのタイムアウトは10秒。失敗してもBobの動作は止まらない(スクリプトは常に `exit 0`)
