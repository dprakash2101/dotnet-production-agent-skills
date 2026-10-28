import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { runStructured } from "./terminal.js";

const MAX_FRAME = 256 * 1024;
const PROTOCOL_VERSION = "2025-11-25";
const tool = {
  name: "run_process",
  description: "Run an executable and explicit argument array directly, without interactive terminal typing or shell parsing. cwd must remain inside the pinned workspace. This can modify files or contact external systems under the server's inherited permissions; workspace cwd confinement is not a sandbox. No automatic retries. Windows .cmd/.bat shims and shell pipelines are unsupported.",
  inputSchema: { type: "object", properties: { executable: { type: "string", minLength: 1 }, args: { type: "array", items: { type: "string" }, maxItems: 4096 }, cwd: { type: "string", description: "Optional directory relative to the pinned workspace." }, timeoutMs: { type: "integer", minimum: 1, maximum: 300000 } }, required: ["executable", "args"], additionalProperties: false },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function send(message: unknown): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(`${JSON.stringify(message)}\n`, error => error ? reject(error) : resolve());
  });
}

async function respond(id: string | number | null, result: unknown): Promise<void> {
  await send({ jsonrpc: "2.0", id, result });
}

async function fail(id: string | number | null, code: number, message: string): Promise<void> {
  await send({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function startTerminalServer(project: string): Promise<void> {
  const workspace = await realpath(project);
  if (!(await stat(workspace)).isDirectory()) throw new Error("Server project must be a directory");
  let initialized = false;
  let ready = false;
  let active: { id: string | number | null; controller: AbortController } | null = null;
  let activeCompletion: Promise<void> | null = null;
  let stopping = false;
  const abortActive = () => active?.controller.abort();
  const shutdown = () => { stopping = true; abortActive(); process.stdin.destroy(); };
  process.stdin.on("end", abortActive);
  process.stdin.on("close", abortActive);
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  async function handle(frame: Buffer): Promise<void> {
    let message: unknown;
    try { message = JSON.parse(frame.toString("utf8")); } catch { await fail(null, -32700, "Invalid JSON"); return; }
    if (!object(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string"
      || ("id" in message && typeof message.id !== "string" && typeof message.id !== "number")) {
      await fail(null, -32600, "Invalid JSON-RPC request"); return;
    }
    const id = typeof message.id === "string" || typeof message.id === "number" ? message.id : null;
    if (!("id" in message)) {
      if (message.method === "notifications/initialized" && initialized) ready = true;
      if (message.method === "notifications/cancelled" && object(message.params) && active && message.params.requestId === active.id) active.controller.abort();
      return;
    }
    if (message.method === "ping") { await respond(id, {}); return; }
    if (message.method === "initialize") {
      if (initialized) { await fail(id, -32600, "Already initialized"); return; }
      if (!object(message.params) || typeof message.params.protocolVersion !== "string" || !object(message.params.capabilities)
        || !object(message.params.clientInfo) || typeof message.params.clientInfo.name !== "string" || typeof message.params.clientInfo.version !== "string") {
        await fail(id, -32602, "Invalid initialize parameters"); return;
      }
      initialized = true;
      await respond(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "dotnet-production-agent-skills-terminal", version: "1.0.0" }, instructions: "Use run_process for noninteractive executable calls to avoid terminal typing corruption. Explicit executable and args only; normal host approvals still apply. Do not blindly retry uncertain or side-effecting operations." });
      return;
    }
    if (!ready) { await fail(id, -32002, "Initialize and send notifications/initialized first"); return; }
    if (message.method === "tools/list") { await respond(id, { tools: [tool] }); return; }
    if (message.method !== "tools/call") { await fail(id, -32601, "Method not found"); return; }
    if (!object(message.params) || message.params.name !== tool.name || !object(message.params.arguments)) {
      await fail(id, -32602, "Expected run_process tool arguments"); return;
    }
    const args = message.params.arguments;
    if (Object.keys(args).some(key => !["executable", "args", "cwd", "timeoutMs"].includes(key))
      || typeof args.executable !== "string" || args.executable.length === 0 || args.executable.length > 32768
      || !Array.isArray(args.args) || args.args.length > 4096 || args.args.some(value => typeof value !== "string" || value.includes("\0"))
      || (args.cwd !== undefined && (typeof args.cwd !== "string" || args.cwd.includes("\0") || path.isAbsolute(args.cwd)))
      || (args.timeoutMs !== undefined && (typeof args.timeoutMs !== "number" || !Number.isInteger(args.timeoutMs) || args.timeoutMs < 1 || args.timeoutMs > 300000))) {
      await fail(id, -32602, "Invalid run_process arguments"); return;
    }
    if (active) { await fail(id, -32000, "SERVER_BUSY: one process is already running"); return; }
    let cwd: string;
    try {
      cwd = await realpath(path.resolve(workspace, args.cwd as string | undefined ?? "."));
      const relative = path.relative(workspace, cwd);
      if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !(await stat(cwd)).isDirectory()) throw new Error("outside");
    } catch { await fail(id, -32602, "cwd must resolve to an existing directory inside the pinned workspace"); return; }
    const controller = new AbortController();
    active = { id, controller };
    activeCompletion = (async () => {
      try {
        const result = await runStructured({ project: cwd, executable: args.executable as string, args: args.args as string[], signal: controller.signal, ...(typeof args.timeoutMs === "number" ? { timeoutMs: args.timeoutMs } : {}) });
        await respond(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: result.exitCode !== 0 || result.cancelled || result.timedOut || result.spawnError !== null || result.signal !== null });
      } catch {
        await respond(id, { content: [{ type: "text", text: "Execution could not start. Check the executable and arguments; Windows batch shims require an already verified interpreter and script. No shell fallback or retry was attempted." }], isError: true });
      } finally { active = null; }
    })().catch(() => { /* The client may have closed stdout during cancellation. */ });
  }

  // Keep reading cancellation messages during execution. Extra process requests
  // receive SERVER_BUSY instead of entering an unbounded queue.
  let pending = Buffer.alloc(0);
  try {
  for await (const chunk of process.stdin) {
    pending = Buffer.concat([pending, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    let boundary: number;
    while ((boundary = pending.indexOf(10)) !== -1) {
      if (boundary > MAX_FRAME) { await fail(null, -32600, "Input frame exceeds 256 KiB"); process.stdin.destroy(); return; }
      const frame = pending.subarray(0, boundary);
      pending = pending.subarray(boundary + 1);
      await handle(frame);
    }
    if (pending.length > MAX_FRAME) { await fail(null, -32600, "Input frame exceeds 256 KiB"); process.stdin.destroy(); return; }
  }
  if (pending.length) await fail(null, -32700, "Input ended before a newline-delimited frame completed");
  } catch (error) {
    if (!stopping) throw error;
  } finally {
    abortActive();
    await activeCompletion;
    process.stdin.off("end", abortActive);
    process.stdin.off("close", abortActive);
    process.off("SIGTERM", shutdown);
    process.off("SIGINT", shutdown);
  }
}
