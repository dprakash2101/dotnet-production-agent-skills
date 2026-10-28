import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectTerminalServer } from "./terminal-setup.js";

const OUTPUT_LIMIT = 64 * 1024;
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface ExecutionResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  cancelled: boolean;
  truncated: boolean;
  stdout: string;
  stderr: string;
  spawnError: string | null;
}

async function projectDirectory(value: string | undefined): Promise<string> {
  if (!value) throw new Error("--project requires an explicit project directory");
  const directory = path.resolve(value);
  if (!(await stat(directory)).isDirectory()) throw new Error("--project must name a directory");
  return directory;
}

// The runner never invokes a shell and never retries. It is an explicit execution
// path, not a way to intercept arbitrary host terminal calls or bypass permissions.
async function execute(executable: string, args: string[], cwd: string, timeoutMs: number, cancellation?: AbortSignal): Promise<ExecutionResult> {
  return new Promise((resolve, reject) => {
    if (cancellation?.aborted) {
      resolve({ exitCode: null, signal: null, timedOut: false, cancelled: true, truncated: false, stdout: "", stderr: "", spawnError: "ABORTED" });
      return;
    }
    const child = spawn(executable, args, { cwd, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let captured = 0;
    let truncated = false;
    let timedOut = false;
    let cancelled = false;
    let spawnError: string | null = null;
    let escalation: NodeJS.Timeout | undefined;
    function capture(chunks: Buffer[], value: Buffer): void {
      const available = OUTPUT_LIMIT - captured;
      if (value.length > available) truncated = true;
      if (available > 0) {
        const kept = value.subarray(0, available);
        chunks.push(kept);
        captured += kept.length;
      }
    }
    child.stdout.on("data", (value: Buffer) => capture(stdout, value));
    child.stderr.on("data", (value: Buffer) => capture(stderr, value));
    child.on("error", (error: NodeJS.ErrnoException) => {
      // Do not retain raw errors containing arbitrary command arguments.
      spawnError = error.code ?? "SPAWN_ERROR";
    });
    function stopChild(): void {
      child.kill("SIGTERM");
      if (escalation) return;
      escalation = setTimeout(() => {
        child.kill("SIGKILL");
        // Descendants can retain inherited pipes after the direct child exits.
        child.stdout.destroy();
        child.stderr.destroy();
      }, 250);
      escalation.unref();
    }
    const abort = () => { cancelled = true; stopChild(); };
    cancellation?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => { timedOut = true; stopChild(); }, timeoutMs);
    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      if (escalation) clearTimeout(escalation);
      cancellation?.removeEventListener("abort", abort);
      resolve({ exitCode, signal, timedOut, cancelled, truncated, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), spawnError });
    });
    child.stdout.on("error", reject);
    child.stderr.on("error", reject);
  });
}

async function diagnosis(evidence: Record<string, unknown>): Promise<unknown> {
  const moduleUrl = pathToFileURL(path.join(PACKAGE_ROOT, "hooks", "diagnosis.mjs")).href;
  const engine = await import(moduleUrl) as { diagnose: (input: Record<string, unknown>) => unknown };
  return engine.diagnose(evidence);
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}


export interface StructuredRunOptions {
  project: string;
  executable: string;
  args: string[];
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function runStructured(options: StructuredRunOptions) {
  if (!options || typeof options.project !== "string" || typeof options.executable !== "string" || !Array.isArray(options.args)
    || options.args.some(value => typeof value !== "string" || value.includes("\0"))) throw new Error("Invalid structured execution arguments");
  const executable = options.executable;
  if (!executable || /[\u0000-\u001f]/.test(executable) || /^\^U/.test(executable)) throw new Error("A plain executable without control prefixes is required");
  if (process.platform === "win32" && /\.(?:cmd|bat)$/i.test(executable)) {
    throw new Error("Windows .cmd/.bat shims are unsupported by the shell-free runner. Use an already verified interpreter and script path from the project directory; do not guess installation paths. No shell fallback was attempted.");
  }
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) throw new Error("timeoutMs must be an integer between 1 and 300000");
  const cwd = await projectDirectory(options.project);
  const policyUrl = pathToFileURL(path.join(PACKAGE_ROOT, "hooks", "command-policy.mjs")).href;
  const policy = await import(policyUrl) as { evaluateProcess: (executable: string, args: string[]) => string };
  const denial = policy.evaluateProcess(executable, options.args);
  if (denial) {
    return { exitCode: null, signal: null, timedOut: false, cancelled: false, truncated: false, stdout: "", stderr: denial, spawnError: "POLICY_DENIED", diagnosis: await diagnosis({ command: executable, error: denial, exitCode: null }), scope: "explicit runner invocation only", descendantsMayRemain: false };
  }
  const result = await execute(executable, options.args, cwd, timeoutMs, options.signal);
  const diagnosed = await diagnosis({ command: executable, cwd, shell: "none", output: `${result.stdout}\n${result.stderr}`, error: result.cancelled ? "execution cancelled; completion unknown" : result.timedOut ? "execution timed out; completion unknown" : result.spawnError === "ENOENT" ? "command not found" : result.spawnError ?? (result.signal ? "execution interrupted; completion unknown" : ""), exitCode: result.cancelled || result.timedOut || result.signal ? null : result.exitCode });
  return { ...result, diagnosis: diagnosed, scope: "explicit runner invocation only", descendantsMayRemain: result.cancelled || result.timedOut || result.signal !== null,
    ...(process.platform === "win32" && result.spawnError ? { recoveryGuidance: "Executable resolution failed. Some Windows tools such as npm use .cmd/.bat shims, which this shell-free runner does not execute. Check resolution in the failing environment and use an already verified interpreter and script if appropriate. Do not guess paths; no shell fallback was attempted." } : {}) };
}

export async function terminalMain(argv: string[]): Promise<void> {
  const [command, ...options] = argv;
  if (!command || command === "--help" || command === "-h") {
    console.log("Usage: dotnet-production-agent-skills terminal capabilities [--project path]\n       dotnet-production-agent-skills terminal serve --project path\n       dotnet-production-agent-skills terminal setup --project path\n       dotnet-production-agent-skills terminal remove --project path\n       dotnet-production-agent-skills terminal diagnose --input evidence.json\n       dotnet-production-agent-skills terminal run --project path [--timeout-ms 30000] -- executable [args...]\n\nThe runner does not interpret shell pipelines or operators. Windows .cmd/.bat shims require an already verified interpreter and script; no shell fallback is performed.");
    return;
  }
  let project: string | undefined;
  let input: string | undefined;
  let timeoutMs = 30_000;
  let executableArgs: string[] = [];
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (option === "--") {
      executableArgs = options.slice(index + 1);
      break;
    }
    if (!["--project", "--input", "--timeout-ms"].includes(option ?? "")) throw new Error(`unknown terminal option: ${option}`);
    const value = options[++index];
    if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
    if (option === "--project") project = value;
    else if (option === "--input") input = value;
    else {
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 300_000) throw new Error("--timeout-ms must be an integer between 1 and 300000");
      timeoutMs = Number(value);
    }
  }
  if (command === "capabilities") {
    if (input || executableArgs.length) throw new Error("capabilities accepts only --project");
    const cwd = await projectDirectory(project ?? process.cwd());
    let events: string[] = [];
    let configuration: "missing" | "valid" | "invalid" = "missing";
    try {
      const config: unknown = JSON.parse(await readFile(path.join(cwd, ".github/hooks/dotnet-production-agent-skills.json"), "utf8"));
      if (!config || typeof config !== "object" || !('version' in config) || config.version !== 1 || !('hooks' in config) || !config.hooks || typeof config.hooks !== "object" || Array.isArray(config.hooks)) configuration = "invalid";
      else {
        const entries = Object.entries(config.hooks);
        const validHandler = (handler: unknown): boolean => {
          if (!handler || typeof handler !== "object" || Array.isArray(handler)) return false;
          const item = handler as Record<string, unknown>;
          return ["command", "bash", "powershell", "exec"].some(key => typeof item[key] === "string" && (item[key] as string).trim().length > 0)
            || (item.type === "http" && typeof item.url === "string");
        };
        configuration = entries.every(([, handlers]) => Array.isArray(handlers) && handlers.every(validHandler)) ? "valid" : "invalid";
        if (configuration === "valid") events = entries.filter(([, handlers]) => (handlers as unknown[]).length > 0).map(([event]) => event);
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) configuration = "invalid";
    }
    const probe = await execute("copilot", ["--version"], cwd, 1500);
    const terminalServer = await inspectTerminalServer(cwd);
    print({ terminalServer, platform: process.platform, nodeVersion: process.version, shellHint: process.env.SHELL ? path.basename(process.env.SHELL) : process.platform === "win32" ? "unknown Windows shell" : "unknown", project: cwd, runner: { shell: false, explicitInvocationRequired: true, outputLimitBytes: OUTPUT_LIMIT, shellPipelinesSupported: false, windowsBatchFilesSupported: false, windowsShimGuidance: "For .cmd/.bat shims, use an already verified interpreter and script path; do not guess installation paths. There is no automatic shell fallback." }, copilot: { executableAvailable: probe.spawnError === null && !probe.timedOut && probe.exitCode === 0, configuration, configurationValidation: "basic structure only; host schema support unverified", configuredEvents: events, activation: "unknown", payloadSupport: "unverified", terminalExecutionEvidence: "unavailable-to-cli" } });
    return;
  }
  if (command === "serve") {
    if (!project || input || executableArgs.length) throw new Error("serve requires --project path");
    const server = await import("./terminal-server.js");
    await server.startTerminalServer(await projectDirectory(project));
    return;
  }
  if (command === "diagnose") {
    if (!input || project || executableArgs.length) throw new Error("diagnose requires --input evidence.json");
    if ((await stat(path.resolve(input))).size > 256 * 1024) throw new Error("evidence input exceeds 256 KiB");
    const contents = await readFile(path.resolve(input));
    if (contents.byteLength > 256 * 1024) throw new Error("evidence input exceeds 256 KiB");
    const evidence: unknown = JSON.parse(contents.toString("utf8"));
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) throw new Error("evidence must be a JSON object");
    print(await diagnosis(evidence as Record<string, unknown>));
    return;
  }
  if (command !== "run") throw new Error(`unknown terminal command: ${command}`);
  if (input) throw new Error("run does not accept --input");
  const cwd = await projectDirectory(project);
  const executable = executableArgs[0];
  if (!executable || /[\u0000-\u001f]/.test(executable)) throw new Error("run requires a plain executable after --");
  if (process.platform === "win32" && /\.(?:cmd|bat)$/i.test(executable)) {
    throw new Error("Windows .cmd/.bat shims are unsupported by the shell-free runner. Use an already verified interpreter and script path from the project directory; do not guess installation paths. No shell fallback was attempted.");
  }
  const result = await runStructured({ project: cwd, executable, args: executableArgs.slice(1), timeoutMs });
  print(result);
  process.exitCode = result.timedOut ? 124 : result.spawnError ? 127 : result.signal ? 128 : result.exitCode ?? 1;
}
