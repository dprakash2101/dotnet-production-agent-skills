#!/usr/bin/env node

const host = process.argv[2] ?? "unknown";
let input = {};
try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
} catch {
  process.stderr.write("Guardrail input was not valid JSON.\n");
  process.exit(2);
}

const tool = input.tool_name ?? input.toolName ?? input.toolCall?.name ?? "";
let args = input.tool_input ?? input.toolArgs ?? input.toolCall?.args ?? {};
if (typeof args === "string") {
  try { args = JSON.parse(args); } catch { args = {}; }
}
if (!args || typeof args !== "object" || Array.isArray(args)) args = {};
const command = String(args.command ?? args.CommandLine ?? args.script ?? "").trim();
const file = String(args.file_path ?? args.path ?? args.TargetFile ?? args.AbsolutePath ?? "").replaceAll("\\", "/");

// These checks are best-effort protection, not a shell sandbox. Account for
// common option order, quoting and Git global options without executing input.
const checks = [
  [/\bgit\s+(?:(?:-C|--git-dir|--work-tree|-c)\s+(?:"[^"]*"|'[^']*'|\S+)\s+)*(?:push)\b[^\n;&|]*(?:--force(?:-with-lease)?|-f)\b/i, "Force-push is blocked. Use a normal push or request explicit human approval."],
  [/\bgit\s+(?:(?:-C|--git-dir|--work-tree|-c)\s+(?:"[^"]*"|'[^']*'|\S+)\s+)*(?:reset\b[^\n;&|]*--hard\b|clean\s+-[^\s]*f[^\s]*|branch\s+-D(?:\s|$))/i, "Destructive Git operations are blocked. Preserve work and request explicit human approval."],
  [/(?:^|[;&|]\s*)rm\s+-(?=[a-z]*r)(?=[a-z]*f)[a-z]+\s+["']?(?:\/|~|\$HOME)(?:["']?)(?:\s|$)/i, "Recursive deletion of a broad system or home path is blocked."],
  [/(?:^|[;&|]\s*)Remove-Item\b(?=[^\n;&|]*-Recurse\b)(?=[^\n;&|]*-Force\b)[^\n;&|]*["']?(?:\$env:USERPROFILE|\$HOME|~|\/)(?:["']?)(?:\s|$)/i, "Recursive deletion of a broad system or home path is blocked."],
  [/\b(?:cat|type|Get-Content|more|less|head|tail)\s+[^\n;&|]*(?:\.env(?:\.(?!example\b)[\w.-]+)?(?:["'\s]|$)|id_(?:rsa|ed25519)|\.pem\b|\.pfx\b|secrets\.json\b)/i, "Reading credential-bearing files through the shell is blocked."],
];

const sensitivePath = /(?:^|\/)(?:\.env(?:\.(?!example$)[^/]*)?|id_(?:rsa|ed25519)|[^/]*\.(?:pem|pfx)|secrets\.json)$/i;
let reason = sensitivePath.test(file) ? "Direct access to a credential-bearing file is blocked." : "";
if (!reason && command) reason = checks.find(([pattern]) => pattern.test(command))?.[1] ?? "";

function response(decision, message = "") {
  if (host === "cursor") return decision === "deny"
    ? { permission: "deny", user_message: message, agent_message: message }
    : { permission: "allow" };
  if (host === "antigravity") return { decision, ...(message ? { reason: message } : {}) };
  if (host === "copilot") return decision === "deny"
    ? { permissionDecision: "deny", permissionDecisionReason: message }
    : { permissionDecision: "allow" };
  return decision === "deny" ? {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: message },
  } : {};
}

process.stdout.write(`${JSON.stringify(response(reason ? "deny" : "allow", reason))}\n`);
