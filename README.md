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

1. Node.js をインストールする
2. リポジトリルートをBobのワークスペースとして開く(`node .bob/hooks/log-tools.mjs` は相対パス実行のため)
3. Bobを通常通り使うと `.bob/logs/` にログが生成される

## 注意

- ログにはツールの実行結果(ファイル内容やコマンド出力)がそのまま入るため、コミットしないこと。`.bob/.gitignore` で除外済み
- `mcp.json` はローカルのポート・トークンを含むためコミットしない
- フックのタイムアウトは10秒。失敗してもBobの動作は止まらない(スクリプトは常に `exit 0`)
