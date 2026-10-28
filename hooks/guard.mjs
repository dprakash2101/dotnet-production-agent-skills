#!/usr/bin/env node
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { diagnose } from "./diagnosis.mjs";
import { evaluateCommand } from "./command-policy.mjs";
import { recordFailure, inspectRetry, clearFailure, clearContextFailures } from "./session-state.mjs";

const host = process.argv[2] ?? "unknown";
let input = {};
try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected object");
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
const terminalTool = /^(?:bash|powershell|shell|run_in_terminal|runInTerminal|execute[/.]runInTerminal|run_command)$/i.test(tool);
const wrongDirectory = command && (terminalTool || !tool) && selectedDirectories.some(isInstallation);

const cwd = String(args.cwd ?? args.workdir ?? args.working_directory ?? args.workingDirectory ?? input.cwd ?? projectRoot);
const shell = String(args.shell ?? (/powershell/i.test(tool) ? "powershell" : /bash/i.test(tool) ? "bash" : "unknown"));
const sessionId = input.sessionId ?? input.session_id;
const context = { projectRoot, sessionId, command, cwd, shell };
const transportContext = { projectRoot, sessionId, command: "__transport_route__", cwd: projectRoot, shell: "any" };
async function structuredRunnerConfigured() {
  try {
    const config = JSON.parse(await readFile(path.join(projectRoot, ".mcp.json"), "utf8"));
    const marker = JSON.parse(await readFile(path.join(projectRoot, ".dotnet-terminal-server.json"), "utf8"));
    const entry = config?.mcpServers?.["dotnet-terminal"];
    const stable = value => Array.isArray(value) ? `[${value.map(stable).join(",")}]`
      : value && typeof value === "object" ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}` : JSON.stringify(value);
    const digest = createHash("sha256").update(stable(entry) ?? "").digest("hex");
    if (marker.schemaVersion !== 1 || marker.digest !== digest || entry?.type !== "stdio"
      || typeof entry.command !== "string" || !path.isAbsolute(entry.command) || !Array.isArray(entry.args)
      || entry.args.length !== 5 || entry.args[1] !== "terminal" || entry.args[2] !== "serve"
      || entry.args[3] !== "--project" || path.resolve(entry.args[4]) !== projectRoot
      || typeof entry.args[0] !== "string" || !path.isAbsolute(entry.args[0])
      || !Array.isArray(entry.tools) || !entry.tools.includes("run_process")) return false;
    return (await stat(entry.command)).isFile() && (await stat(entry.args[0])).isFile();
  } catch { return false; }
}
const event = process.argv[3] ?? input.hook_event_name ?? "";
if (host === "copilot" && /^(?:postToolUse|postToolUseFailure)$/i.test(event)) {
  const result = input.toolResult ?? input.tool_result ?? {};
  const output = String(result.textResultForLlm ?? result.text_result_for_llm ?? "");
  const explicitExit = result.exitCode ?? result.exit_code ?? input.exitCode;
  const reportedExit = output.match(/(?:exit(?:ed)? (?:with (?:exit )?(?:code|status) )?|exit code[:=]?\s*)(-?\d+)\b/i);
  const exitCode = Number.isInteger(explicitExit) ? explicitExit : undefined;
  const reportedFailure = reportedExit && Number(reportedExit[1]) !== 0;
  const diagnosis = diagnose({ command, cwd, shell, output, error: input.error,
    exitCode, submittedCommand: command, executedCommand: result.executedCommand ?? result.executed_command });
  const isFailureEvent = /failure/i.test(event);
  if (command && terminalTool) {
    if (diagnosis.category === "success") await clearFailure(context);
    // Native Copilot success means the tool returned, not that the shell exited
    // zero. Only positive output from narrow read-only diagnostics clears state.
    const directoryDiagnostic = /^(?:pwd|Get-Location|git(?: -C (?:"[^"]+"|'[^']+'|\S+))? rev-parse --show-toplevel)\s*$/i.test(command);
    const lookup = command.match(/^(?:command -v|Get-Command) ([\w.-]+)(?: -All)?\s*$/i);
    const normalizedOutput = output.replaceAll("\\", "/");
    const positiveOutput = directoryDiagnostic ? normalizedOutput.includes(cwd.replaceAll("\\", "/"))
      : lookup ? output.includes(lookup[1]) : false;
    const returned = result.resultType === "success" || result.result_type === "success";
    const verifiedDiagnostic = (directoryDiagnostic || lookup) && (diagnosis.category === "success"
      || returned && !isFailureEvent && !reportedFailure && diagnosis.category === "unknown" && positiveOutput);
    if (verifiedDiagnostic) await clearContextFailures(context);
  }
  const failed = command && terminalTool && diagnosis.category !== "success"
    && (isFailureEvent || result.resultType === "failure" || result.result_type === "failure" || diagnosis.category !== "unknown" && diagnosis.category !== "uncertain-completion" || reportedFailure || exitCode !== undefined && exitCode !== 0);
  if (failed) {
    await recordFailure({ ...context, category: diagnosis.category });
    if (["transport-corruption", "suspected-transport-corruption"].includes(diagnosis.category)) {
      await recordFailure({ ...transportContext, category: diagnosis.category });
    }
    const message = `Command failed; do not repeat it unchanged. Diagnosis: ${diagnosis.category} (${diagnosis.confidence}). ${diagnosis.message} ${recovery}`;
    if (isFailureEvent) {
      process.stdout.write(`${message}\n`);
      process.exit(2);
    }
    process.stdout.write(`${JSON.stringify({ additionalContext: message })}\n`);
  } else process.stdout.write("{}\n");
  process.exit(0);
}

// These checks are best-effort protection, not a shell sandbox. Account for
// common option order, quoting and Git global options without executing input.
let reason = evaluateCommand({ command, file });
if (!reason && command && terminalTool) {
  const transport = await inspectRetry(transportContext);
  if (transport.repeated && await structuredRunnerConfigured()) {
    reason = "Terminal transport previously corrupted command input in this session. Use the dotnet-terminal run_process MCP tool with executable, args, and project cwd instead of submitting another command through the interactive terminal. This tool starts the process directly without typing into the terminal. Preserve authorization and arguments; if the MCP tool is unavailable, report that integration blocker rather than retrying the damaged transport.";
  }
  const previous = await inspectRetry(context);
  if (!reason && previous.repeated) reason = `Unchanged retry blocked after ${previous.category ?? "a failure"}. Inspect the first error and run a relevant read-only diagnostic before repeating this command. A successful verified directory or executable lookup permits another attempt. ${recovery}`;
}
if (!reason && wrongDirectory) reason = `Incorrect working directory: a tool installation folder was selected for a project command. ${recovery}`;

function response(decision, message = "") {
  if (host === "cursor") return decision === "deny"
    ? { permission: "deny", user_message: message, agent_message: message }
    : { permission: "allow" };
  if (host === "antigravity") return { decision, ...(message ? { reason: message } : {}) };
  if (host === "copilot") return decision === "deny"
    ? { permissionDecision: "deny", permissionDecisionReason: message }
    : {};
  return decision === "deny" ? {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: message },
  } : {};
}

process.stdout.write(`${JSON.stringify(response(reason ? "deny" : "allow", reason))}\n`);
