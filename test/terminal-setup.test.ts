import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { changeTerminalServer, inspectTerminalServer } from "../src/terminal-setup.js";

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(tmpdir(), "terminal-setup-"));
  const project = path.join(root, "my project");
  const packageRoot = path.join(root, "package installation");
  await mkdir(project);
  await mkdir(path.join(packageRoot, "dist", "src"), { recursive: true });
  await writeFile(path.join(packageRoot, "dist", "src", "cli.js"), "// test entrypoint\n");
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, project, packageRoot, config: path.join(project, ".mcp.json"), marker: path.join(project, ".dotnet-terminal-server.json") };
}

test("terminal setup preserves unrelated MCP configuration and removes only its server", async t => {
  const f = await fixture(t);
  const unrelated = { description: "team configuration", mcpServers: { team: { command: "team-mcp", args: ["arg"] } } };
  await writeFile(f.config, JSON.stringify(unrelated));
  assert.equal((await changeTerminalServer(f.project, f.packageRoot, "install", false)).action, "install");
  const config = JSON.parse(await readFile(f.config, "utf8"));
  assert.deepEqual(config.mcpServers.team, unrelated.mcpServers.team);
  assert.equal(config.description, unrelated.description);
  assert.deepEqual(config.mcpServers["dotnet-terminal"], {
    type: "stdio", command: process.execPath,
    args: [path.join(f.packageRoot, "dist", "src", "cli.js"), "terminal", "serve", "--project", f.project], tools: ["run_process"],
  });
  assert.equal((await changeTerminalServer(f.project, f.packageRoot, "install", false)).action, "skip");
  assert.deepEqual(await inspectTerminalServer(f.project), { path: f.config, state: "unchanged", entrypointExists: true, activation: "unknown" });
  assert.equal((await changeTerminalServer(f.project, f.packageRoot, "uninstall", false)).action, "remove");
  assert.deepEqual(JSON.parse(await readFile(f.config, "utf8")), unrelated);
  await assert.rejects(readFile(f.marker), { code: "ENOENT" });
});

test("terminal setup dry-run does not create or remove configuration", async t => {
  const f = await fixture(t);
  assert.equal((await changeTerminalServer(f.project, f.packageRoot, "install", true)).action, "install");
  await assert.rejects(readFile(f.config), { code: "ENOENT" });
  await assert.rejects(readFile(f.marker), { code: "ENOENT" });
  await changeTerminalServer(f.project, f.packageRoot, "install", false);
  const before = await readFile(f.config, "utf8");
  assert.equal((await changeTerminalServer(f.project, f.packageRoot, "uninstall", true)).action, "remove");
  assert.equal(await readFile(f.config, "utf8"), before);
  await changeTerminalServer(f.project, f.packageRoot, "uninstall", false);
  await assert.rejects(readFile(f.config), { code: "ENOENT" });
  assert.equal((await changeTerminalServer(f.project, f.packageRoot, "uninstall", false)).action, "skip");
});

test("terminal setup updates owned package paths and adopts only exact unmarked configuration", async t => {
  const f = await fixture(t);
  await changeTerminalServer(f.project, f.packageRoot, "install", false);
  const upgraded = path.join(f.root, "upgraded package");
  await mkdir(path.join(upgraded, "dist", "src"), { recursive: true });
  await writeFile(path.join(upgraded, "dist", "src", "cli.js"), "// upgraded\n");
  assert.equal((await changeTerminalServer(f.project, upgraded, "install", false)).action, "update");
  assert.equal(JSON.parse(await readFile(f.config, "utf8")).mcpServers["dotnet-terminal"].args[0], path.join(upgraded, "dist", "src", "cli.js"));
  await rm(f.marker);
  assert.equal((await changeTerminalServer(f.project, upgraded, "install", false)).action, "update");
  assert.equal((await inspectTerminalServer(f.project)).state, "unchanged");
});

test("terminal setup preserves customized and unmanaged same-name servers", async t => {
  const f = await fixture(t);
  await changeTerminalServer(f.project, f.packageRoot, "install", false);
  const data = JSON.parse(await readFile(f.config, "utf8"));
  data.mcpServers["dotnet-terminal"].args.push("--custom");
  await writeFile(f.config, JSON.stringify(data));
  const before = await readFile(f.config, "utf8");
  for (const operation of ["install", "uninstall"] as const) await assert.rejects(changeTerminalServer(f.project, f.packageRoot, operation, false), /Modified.*preserved/);
  assert.equal(await readFile(f.config, "utf8"), before);
  assert.equal((await inspectTerminalServer(f.project)).state, "modified");
  await rm(f.marker);
  for (const operation of ["install", "uninstall"] as const) await assert.rejects(changeTerminalServer(f.project, f.packageRoot, operation, false), /Unmanaged.*preserved/);
  assert.equal(await readFile(f.config, "utf8"), before);
});

test("terminal setup rejects malformed configuration and stale ownership metadata", async t => {
  const f = await fixture(t);
  for (const content of ["{malformed", "[]", "null", '{"mcpServers":null}', '{"mcpServers":[]}']) {
    await writeFile(f.config, content);
    await assert.rejects(changeTerminalServer(f.project, f.packageRoot, "install", false), /Invalid/);
    assert.equal(await readFile(f.config, "utf8"), content);
  }
  await rm(f.config);
  await changeTerminalServer(f.project, f.packageRoot, "install", false);
  await writeFile(f.marker, JSON.stringify({ schemaVersion: 1, digest: "0".repeat(64) }));
  await assert.rejects(changeTerminalServer(f.project, f.packageRoot, "install", false), /Modified.*preserved/);
  await writeFile(f.marker, "{}");
  await assert.rejects(changeTerminalServer(f.project, f.packageRoot, "uninstall", false), /Invalid.*ownership/);
  assert.equal((await inspectTerminalServer(f.project)).state, "malformed");
});

test("terminal inspection reports missing entrypoints without claiming activation", async t => {
  const f = await fixture(t);
  assert.equal((await inspectTerminalServer(f.project)).state, "missing");
  await changeTerminalServer(f.project, f.packageRoot, "install", false);
  await rm(path.join(f.packageRoot, "dist", "src", "cli.js"));
  const report = await inspectTerminalServer(f.project);
  assert.equal(report.entrypointExists, false);
  assert.equal(report.activation, "unknown");
  await assert.rejects(changeTerminalServer(f.project, f.packageRoot, "install", false), /entrypoint is unavailable/);
});

test("terminal setup preserves bare top-level MCP servers instead of mixing formats", async t => {
  const f = await fixture(t);
  const bare = JSON.stringify({ team: { command: "node", args: [] } });
  await writeFile(f.config, bare);
  await assert.rejects(changeTerminalServer(f.project, f.packageRoot, "install", false), /Bare top-level MCP server configuration preserved/);
  assert.equal(await readFile(f.config, "utf8"), bare);
  await assert.rejects(readFile(f.marker), { code: "ENOENT" });
});
