#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const recovery = `Follow safe-terminal: verify the intended project directory (installed hook project: ${JSON.stringify(projectRoot)}), inspect the first actionable error, and make one evidence-based correction. Keep project commands in that project; never move into Git/dotnet installation folders or change PATH to recover. After at most three distinct corrections, stop and report the blocker.`;
// Inspect only explicit directory selections, not executable paths or arbitrary
// command arguments. Calling a fully qualified executable is valid.
const installationPath = /(?:^|\/)(?:Program Files(?: \(x86\))?\/(?:Git|dotnet)|ProgramData\/chocolatey|usr\/(?:local\/)?(?:bin|share\/dotnet|lib\/git-core)|opt\/(?:git|dotnet))(?:\/|$)/i;
const isInstallation = value => installationPath.test(String(value).replaceAll("\\", "/"));
const selectedDirectories = [args.cwd, args.workdir, args.working_directory, args.workingDirectory, input.cwd];
const directorySelection = /(?:^|[\n;&|]\s*)\s*(?:cd(?:\s+\/d)?|Set-Location(?:\s+-(?:Path|LiteralPath))?|Push-Location)\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))|\bgit\s+(?:-C\s+|--(?:git-dir|work-tree)(?:=|\s+))(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/gi;
for (const match of command.matchAll(directorySelection)) selectedDirectories.push(match.slice(1).find(value => value !== undefined));
const terminalTool = /^(?:bash|powershell|shell|run_in_terminal|run_command|Bash|PowerShell)$/i.test(tool);
const wrongDirectory = command && (terminalTool || !tool) && selectedDirectories.some(isInstallation);

// Command failures can be reported either as tool failures or as a successful
// tool result containing a nonzero shell exit. Never copy raw output into feedback.
const event = process.argv[3] ?? input.hook_event_name ?? "";
if (host === "copilot" && /^(?:postToolUse|postToolUseFailure)$/i.test(event)) {
  const result = input.toolResult ?? input.tool_result ?? {};
  const output = String(result.textResultForLlm ?? result.text_result_for_llm ?? "");
  const failed = /failure/i.test(event) || /(?:exited? (?:with (?:code|status) )?|exit code[:=]?\s*)[1-9]\d*\b|command not found|not recognized as (?:an? )?(?:internal|name)|MSB1003|not a git repository/i.test(output);
  if (command && terminalTool && failed) {
    const message = `Command failed; do not repeat it unchanged. ${recovery}`;
    if (/failure/i.test(event)) {
      // Copilot command failure hooks use exit 2 + stdout as model context.
      process.stdout.write(`${message}\n`);
      process.exit(2);
    }
    process.stdout.write(`${JSON.stringify({ additionalContext: message })}\n`);
  } else process.stdout.write("{}\n");
  process.exit(0);
}

// These checks are best-effort protection, not a shell sandbox. Account for
// common option order, quoting and Git global options without executing input.
const checks = [
  [/(?:^|[\n;&|])\s*(?:\^U|\u0015)\s*(?=\S)/, "Incorrect command: a Ctrl+U marker was prepended. Follow safe-terminal: remove the marker and retry the intended command once as plain text from the verified project working directory. Do not move into the Git or dotnet installation directory, guess executable paths, or change PATH to recover."],
  [/\bgit\s+(?:(?:-C|--git-dir|--work-tree|-c)\s+(?:"[^"]*"|'[^']*'|\S+)\s+)*(?:push)\b[^\n;&|]*(?:--force(?:-with-lease)?|-f)\b/i, "Force-push is blocked. Use a normal push or request explicit human approval."],
  [/\bgit\s+(?:(?:-C|--git-dir|--work-tree|-c)\s+(?:"[^"]*"|'[^']*'|\S+)\s+)*(?:reset\b[^\n;&|]*--hard\b|clean\s+-[^\s]*f[^\s]*|branch\s+-D(?:\s|$))/i, "Destructive Git operations are blocked. Preserve work and request explicit human approval."],
  [/(?:^|[;&|]\s*)rm\s+-(?=[a-z]*r)(?=[a-z]*f)[a-z]+\s+["']?(?:\/|~|\$HOME)(?:["']?)(?:\s|$)/i, "Recursive deletion of a broad system or home path is blocked."],
  [/(?:^|[;&|]\s*)Remove-Item\b(?=[^\n;&|]*-Recurse\b)(?=[^\n;&|]*-Force\b)[^\n;&|]*["']?(?:\$env:USERPROFILE|\$HOME|~|\/)(?:["']?)(?:\s|$)/i, "Recursive deletion of a broad system or home path is blocked."],
  [/\b(?:cat|type|Get-Content|more|less|head|tail)\s+[^\n;&|]*(?:\.env(?:\.(?!example\b)[\w.-]+)?(?:["'\s]|$)|id_(?:rsa|ed25519)|\.pem\b|\.pfx\b|secrets\.json\b)/i, "Reading credential-bearing files through the shell is blocked."],
];

const sensitivePath = /(?:^|\/)(?:\.env(?:\.(?!example$)[^/]*)?|id_(?:rsa|ed25519)|[^/]*\.(?:pem|pfx)|secrets\.json)$/i;
let reason = sensitivePath.test(file) ? "Direct access to a credential-bearing file is blocked." : "";
if (!reason && command) reason = checks.find(([pattern]) => pattern.test(command))?.[1] ?? "";
if (!reason && wrongDirectory) reason = `Incorrect working directory: a tool installation folder was selected for a project command. ${recovery}`;

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
