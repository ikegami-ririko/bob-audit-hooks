import fs from "node:fs";
import path from "node:path";

let raw = "";
for await (const chunk of process.stdin) {
  raw += chunk;
}

if (!raw.trim()) {
  process.exit(0);
}

try {
  const payload = JSON.parse(raw);
  const cwd = payload.cwd || process.cwd();
  const logDir = path.join(cwd, ".bob", "logs");

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // 日本時間 (JST: UTC+9) のタイムスタンプ生成 (YYYY-MM-DD HH:mm:ss)
  const now = new Date();
  const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = jstDate.toISOString().replace("T", " ").replace("Z", "").slice(0, 19);

  // 1. 案B: ツールごとに要約表示する見やすいタイムライン形式 (.log)
  let formattedLog = "";
  const toolName = payload.tool_name || "";
  const input = payload.tool_input || {};
  const rawResponse = payload.tool_response ?? "";
  const response = typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse, null, 2);

  if (payload.hook_event_name === "SessionStart") {
    formattedLog += `\n================================================================================\n`;
    formattedLog += `[${dateStr} JST] 🟢 【セッション開始 (SessionStart)】 Session: ${payload.session_id}\n`;
    formattedLog += `  開始種別 : ${payload.source || "unknown"}\n`;
    formattedLog += `  cwd      : ${cwd}\n`;
    formattedLog += `--------------------------------------------------------------------------------\n`;
  } else if (payload.hook_event_name === "UserPromptSubmit") {
    formattedLog += `\n================================================================================\n`;
    formattedLog += `[${dateStr} JST] 💬 【ユーザープロンプト (UserPromptSubmit)】 Session: ${payload.session_id}\n`;
    formattedLog += `${String(payload.prompt ?? "").trim()}\n`;
    formattedLog += `--------------------------------------------------------------------------------\n`;
  } else if (payload.hook_event_name === "Stop") {
    formattedLog += `\n================================================================================\n`;
    formattedLog += `[${dateStr} JST] 🏁 【ターン完了 (Stop)】 Session: ${payload.session_id}\n`;
    if (payload.last_assistant_message) {
      formattedLog += `--- [AI応答サマリー] ---\n${payload.last_assistant_message.trim()}\n`;
    }
    formattedLog += `--------------------------------------------------------------------------------\n`;
  } else if (payload.hook_event_name === "PostToolUse") {
    let headerTag = "[TOOL]";
    let summaryDetail = "";

    if (toolName === "start_subtask") {
      headerTag = "🚀 【サブタスク起動】";
      summaryDetail = `  タイトル : ${input.title || "（無題）"}\n  モード   : ${input.mode || "agent"}\n  指示内容 : ${(input.message || "").trim()}`;
    } else if (toolName === "spawn_subagent") {
      headerTag = "🤖 【サブエージェント】";
      summaryDetail = `  タイプ   : ${input.name || "general"}\n  タスク   : ${(input.description || "").trim()}`;
    } else if (toolName === "execute_command") {
      headerTag = "💻 【コマンド実行】";
      summaryDetail = `  コマンド : ${input.command || ""}`;
    } else if (["write_file", "apply_diff", "search_and_replace", "insert_content"].includes(toolName)) {
      headerTag = "📝 【ファイル編集】";
      summaryDetail = `  ツール   : ${toolName}\n  ファイル : ${input.path || ""}`;
      if (input.line_count) summaryDetail += ` (${input.line_count}行)`;
    } else if (["read_file", "glob", "grep", "list_files"].includes(toolName)) {
      headerTag = "🔍 【ファイル探索】";
      summaryDetail = `  ツール   : ${toolName}\n  対象     : ${input.path || input.pattern || JSON.stringify(input)}`;
    } else if (toolName.startsWith("mcp__")) {
      headerTag = "🔌 【MCPツール】";
      summaryDetail = `  ツール   : ${toolName}\n  パラメータ: ${JSON.stringify(input)}`;
    } else {
      headerTag = `🔧 【${toolName}】`;
      summaryDetail = `  入力     : ${JSON.stringify(input, null, 2)}`;
    }

    formattedLog += `\n================================================================================\n`;
    formattedLog += `[${dateStr} JST] ${headerTag} ${toolName}\n`;
    formattedLog += `${summaryDetail}\n`;

    if (response) {
      formattedLog += `--- [実行結果] ---\n`;
      // 長すぎる出力（例: 巨大ファイルのread結果など）は適度に折りたたむ
      const trimmedResponse = response.trim();
      formattedLog += `${trimmedResponse}\n`;
    }
    formattedLog += `--------------------------------------------------------------------------------\n`;
  }

  // セッションごとにファイルを分割 (ファイル名に使えない文字は除去)
  const sessionId = String(payload.session_id || "unknown").replace(/[^A-Za-z0-9_-]/g, "_");

  const humanLogFile = path.join(logDir, `tool_audit_${sessionId}.log`);
  fs.appendFileSync(humanLogFile, formattedLog, "utf8");

  // 2. プログラム解析用の JSONL ログも併せて保存
  const jsonlEntry = {
    timestamp: jstDate.toISOString().replace("Z", "+09:00"),
    session_id: payload.session_id,
    cwd: cwd,
    event: payload.hook_event_name,
    tool_name: payload.tool_name ?? null,
    tool_input: payload.tool_input ?? null,
    tool_response: payload.tool_response ?? null,
    prompt: payload.prompt ?? null,
    last_assistant_message: payload.last_assistant_message ?? null,
  };
  const jsonlLogFile = path.join(logDir, `tool_audit_${sessionId}.jsonl`);
  fs.appendFileSync(jsonlLogFile, JSON.stringify(jsonlEntry) + "\n", "utf8");
} catch (err) {
  console.error("Hook logging error:", err);
}

process.exit(0);
