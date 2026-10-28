import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const terminal = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/terminal.js")).href;
function invoke(...args: string[]) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", `const {terminalMain}=await import(${JSON.stringify(terminal)});try{await terminalMain(process.argv.slice(1));}catch(error){console.error(error.message);process.exitCode=1;}`, ...args], { encoding: "utf8", timeout: 10000 });
}

test("terminal runner keeps metacharacters as arguments and uses the explicit project", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal project "));
  const argument = "hello; $(echo should-not-execute) & spaces";
  const result = invoke("run", "--project", project, "--", process.execPath, "-e", "console.log(JSON.stringify({cwd:process.cwd(),arg:process.argv[1]}))", argument);
  assert.equal(result.status, 0, result.stderr);
  const value = JSON.parse(result.stdout);
  assert.deepEqual(JSON.parse(value.stdout), { cwd: project, arg: argument });
  assert.equal(value.exitCode, 0);
  assert.equal(value.diagnosis.category, "success");
});

test("terminal runner reports actual failure, missing executable, and invalid directory", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal-errors-"));
  const failed = invoke("run", "--project", project, "--", process.execPath, "-e", "process.exit(7)");
  assert.equal(failed.status, 7);
  assert.equal(JSON.parse(failed.stdout).exitCode, 7);
  const absent = invoke("run", "--project", project, "--", "nonexistent-terminal-executable-920482");
  assert.equal(absent.status, 127);
  assert.equal(JSON.parse(absent.stdout).spawnError, "ENOENT");
  assert.equal(JSON.parse(absent.stdout).diagnosis.category, "executable-unavailable");
  assert.notEqual(invoke("run", "--project", path.join(project, "missing"), "--", process.execPath).status, 0);
  assert.notEqual(invoke("run", "--", process.execPath).status, 0);
});

test("terminal runner bounds output and reports timeout as uncertain completion", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal-bounds-"));
  const noisy = invoke("run", "--project", project, "--", process.execPath, "-e", "process.stdout.write('x'.repeat(100000))");
  assert.equal(noisy.status, 0);
  const result = JSON.parse(noisy.stdout);
  assert.equal(result.truncated, true);
  assert.ok(Buffer.byteLength(result.stdout) <= 65536);
  const hanging = invoke("run", "--project", project, "--timeout-ms", "150", "--", process.execPath, "-e", "setInterval(()=>{},1000)");
  assert.equal(hanging.status, 124);
  assert.equal(JSON.parse(hanging.stdout).timedOut, true);
  assert.equal(JSON.parse(hanging.stdout).diagnosis.category, "uncertain-completion");
  assert.notEqual(invoke("run", "--project", project, "--timeout-ms", "300001", "--", process.execPath).status, 0);
  const descendants = invoke("run", "--project", project, "--timeout-ms", "150", "--", process.execPath, "-e", "require('node:child_process').spawn(process.execPath,['-e','setTimeout(()=>{},900)'],{stdio:['ignore',1,2]})");
  assert.equal(descendants.status, 124);
  assert.equal(JSON.parse(descendants.stdout).descendantsMayRemain, true);
});

test("terminal capabilities distinguish configured hooks from proven activation", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal-capabilities-"));
  await mkdir(path.join(project, ".github/hooks"), { recursive: true });
  await writeFile(path.join(project, ".github/hooks/dotnet-production-agent-skills.json"), JSON.stringify({ version: 1, hooks: { preToolUse: [{ command: "example" }] } }));
  const result = invoke("capabilities", "--project", project);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.copilot.configuration, "valid");
  assert.deepEqual(report.copilot.configuredEvents, ["preToolUse"]);
  assert.equal(report.copilot.activation, "unknown");
  assert.equal(report.runner.shell, false);
  assert.equal(report.runner.shellPipelinesSupported, false);
  assert.equal(report.runner.windowsBatchFilesSupported, false);
  await writeFile(path.join(project, ".github/hooks/dotnet-production-agent-skills.json"), JSON.stringify({ version: 99, hooks: { preToolUse: ["invalid handler"] } }));
  assert.equal(JSON.parse(invoke("capabilities", "--project", project).stdout).copilot.configuration, "invalid");
});

test("Windows runner rejects batch shims with actionable guidance", { skip: process.platform !== "win32" }, async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal-windows-shim-"));
  for (const executable of ["npm.cmd", "build.bat"]) {
    const result = invoke("run", "--project", project, "--", executable, "test");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /already verified interpreter and script/);
    assert.match(result.stderr, /No shell fallback/);
  }
  const missing = invoke("run", "--project", project, "--", "nonexistent-terminal-executable-920482");
  assert.match(JSON.parse(missing.stdout).recoveryGuidance, /no shell fallback/);
});

test("terminal diagnose accepts structured evidence without exposing raw errors", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal-diagnose-"));
  const input = path.join(project, "evidence.json");
  await writeFile(input, JSON.stringify({ command: "python", exitCode: 0, output: "^C SECRET_VALUE" }));
  const result = invoke("diagnose", "--input", input);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).category, "success");
  assert.doesNotMatch(result.stdout, /SECRET_VALUE/);
});

test("structured runner preserves destructive-command and credential-file policy", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "terminal-policy-"));
  await writeFile(path.join(project, ".env"), "CONTROLLED_TEST_FIXTURE");
  for (const command of [["git", "reset", "--hard"], ["cat", ".env"]]) {
    const result = invoke("run", "--project", project, "--", ...command);
    assert.notEqual(result.status, 0);
    assert.equal(JSON.parse(result.stdout).spawnError, "POLICY_DENIED");
    assert.equal(JSON.parse(result.stdout).stdout, "");
    assert.doesNotMatch(result.stdout, /CONTROLLED_TEST_FIXTURE/);
  }
});
