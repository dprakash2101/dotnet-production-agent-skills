import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const terminal = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/terminal.js")).href;
const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "regression-client", version: "1" } } };
const initialized = { jsonrpc: "2.0", method: "notifications/initialized" };
function call(id: number, args: unknown) { return { jsonrpc: "2.0", id, method: "tools/call", params: { name: "run_process", arguments: args } }; }
async function exchange(project: string, messages: unknown[], prefix = "", delayed: unknown[] = []) {
  const child = spawn(process.execPath, ["--input-type=module", "-e", `const {terminalMain}=await import(${JSON.stringify(terminal)});await terminalMain(['serve','--project',${JSON.stringify(project)}]);`], { stdio: ["pipe", "pipe", "pipe"] });
  const expected = messages.filter(message => typeof message === "object" && message !== null && "id" in message).length + (prefix ? 1 : 0);
  const replies: any[] = [];
  let stderr = "";
  let pending = "";
  child.stderr.setEncoding("utf8").on("data", value => { stderr += value; });
  child.stdin.on("error", () => {});
  const timeout = setTimeout(() => child.kill("SIGKILL"), 8000);
  const delayedTimer = setTimeout(() => { for (const message of delayed) child.stdin.write(`${JSON.stringify(message)}\n`); }, 200);
  child.stdout.setEncoding("utf8").on("data", value => {
    pending += value;
    let index;
    while ((index = pending.indexOf("\n")) !== -1) {
      replies.push(JSON.parse(pending.slice(0, index)));
      pending = pending.slice(index + 1);
    }
    if (replies.length >= expected) child.stdin.end();
  });
  child.stdin.write(prefix + messages.map(value => JSON.stringify(value)).join("\n") + "\n");
  const status = await new Promise<number | null>((resolve, reject) => { child.on("close", resolve); child.on("error", reject); });
  clearTimeout(timeout);
  clearTimeout(delayedTimer);
  assert.equal(status, 0, stderr);
  assert.equal(replies.length, expected);
  assert.ok(replies.every(message => message.jsonrpc === "2.0"));
  return replies.sort((left, right) => (left.id === null ? -1 : left.id) - (right.id === null ? -1 : right.id));
}

test("MCP server negotiates supported protocol and executes structured calls without PTY typing", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal-mcp-"));
  await mkdir(path.join(project, "subdirectory"));
  const value = "^U npm; $(echo accidental-shell) & spaces";
  const replies = await exchange(project, [init, initialized, { jsonrpc: "2.0", id: 2, method: "tools/list" }, call(3, { executable: process.execPath, args: ["-e", "console.log(JSON.stringify({cwd:process.cwd(),argument:process.argv[1]}))", value], cwd: "subdirectory" }), { jsonrpc: "2.0", id: 4, method: "ping" }]);
  assert.equal(replies[0].result.protocolVersion, "2025-11-25");
  const tool = replies[1].result.tools[0];
  assert.equal(tool.name, "run_process");
  assert.equal(tool.annotations.destructiveHint, true);
  assert.equal(tool.annotations.readOnlyHint, false);
  const result = replies[2].result;
  assert.equal(result.isError, false);
  assert.deepEqual(JSON.parse(result.structuredContent.stdout), { cwd: path.join(project, "subdirectory"), argument: value });
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  assert.deepEqual(replies[3].result, {});
});

test("MCP validates arguments and initialization before execution", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal-mcp-invalid-"));
  const marker = path.join(project, "must-not-exist");
  const unsafeArgs = ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)},'unexpected')`];
  const replies = await exchange(project, [call(0, { executable: process.execPath, args: unsafeArgs }), init, initialized, call(2, { executable: process.execPath, args: unsafeArgs, extra: true }), call(3, { executable: process.execPath, args: "invalid" }), call(4, { executable: process.execPath, args: unsafeArgs, timeoutMs: 0 })]);
  assert.equal(replies[0].error.code, -32002);
  for (const reply of replies.slice(2)) assert.equal(reply.error.code, -32602);
  await assert.rejects(stat(marker), { code: "ENOENT" });
});

test("MCP confines selected cwd and reports timeout without replaying the command", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal-mcp-root-"));
  const outside = await mkdtemp(path.join(tmpdir(), "terminal-mcp-outside-"));
  await symlink(outside, path.join(project, "outside-link"), process.platform === "win32" ? "junction" : "dir");
  const replies = await exchange(project, [init, initialized, call(2, { executable: process.execPath, args: [], cwd: ".." }), call(3, { executable: process.execPath, args: [], cwd: "outside-link" }), call(4, { executable: process.execPath, args: ["-e", "setInterval(()=>{},1000)"], timeoutMs: 100 })]);
  assert.equal(replies[1].error.code, -32602);
  assert.equal(replies[2].error.code, -32602);
  assert.equal(replies[3].result.isError, true);
  assert.equal(replies[3].result.structuredContent.timedOut, true);
  assert.equal(replies[3].result.structuredContent.diagnosis.category, "uncertain-completion");
});

test("MCP reports parse errors without copying raw input and bounds frames", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal-mcp-frames-"));
  const replies = await exchange(project, [init, initialized], "SECRET_INVALID_JSON\n");
  assert.equal(replies[0].error.code, -32700);
  assert.doesNotMatch(JSON.stringify(replies), /SECRET_INVALID_JSON/);
  const oversized = await exchange(project, [], "x".repeat(256 * 1024 + 1) + "\n");
  assert.equal(oversized[0].error.code, -32600);
});

test("MCP direct execution preserves destructive command policy before spawning", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal-mcp-policy-"));
  const replies = await exchange(project, [init, initialized, call(2, { executable: "git", args: ["reset", "--hard"] })]);
  assert.equal(replies[1].result.isError, true);
  assert.equal(replies[1].result.structuredContent.spawnError, "POLICY_DENIED");
  assert.equal(replies[1].result.structuredContent.stdout, "");
});


test("MCP remains responsive to cancellation and rejects parallel process calls", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal-mcp-cancel-"));
  const replies = await exchange(project, [init, initialized,
    call(2, { executable: process.execPath, args: ["-e", "setInterval(()=>{},1000)"], timeoutMs: 5000 }),
    call(3, { executable: process.execPath, args: ["-e", "process.exit(0)"] }),
  ], "", [{ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 2, reason: "test cancellation" } }]);
  assert.equal(replies[1].result.isError, true);
  assert.equal(replies[1].result.structuredContent.cancelled, true);
  assert.equal(replies[1].result.structuredContent.timedOut, false);
  assert.equal(replies[2].error.code, -32000);
  assert.match(replies[2].error.message, /SERVER_BUSY/);
});
