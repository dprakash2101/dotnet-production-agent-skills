import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rm, utimes, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { clearContextFailures, clearFailure, inspectRetry, recordFailure } from "../hooks/session-state.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");
const directory = path.join(tmpdir(), `dotnet-agent-recovery-${hash(homedir()).slice(0, 16)}`);
function fixture(t) {
  const args = { projectRoot: `/project-${randomUUID()}`, sessionId: `session-${randomUUID()}`, command: "npm test --token SECRET_VALUE", cwd: "/work/my project", shell: "bash", category: "application-failure" };
  const file = path.join(directory, `${hash(JSON.stringify([path.resolve(args.projectRoot), args.sessionId]))}.json`);
  t.after(async () => { await rm(file, { force: true }); await rm(`${file}.lock`, { force: true }); });
  return { args, file };
}

test("session state distinguishes failed commands, contexts, projects, and sessions", async t => {
  const { args } = fixture(t);
  assert.equal((await inspectRetry(args)).repeated, false);
  assert.equal((await recordFailure(args)).attempts, 1);
  assert.equal((await recordFailure(args)).attempts, 2);
  assert.deepEqual(await inspectRetry(args), { repeated: true, attempts: 2, category: "application-failure", available: true });
  for (const changed of [{ command: "npm test" }, { cwd: "/other" }, { shell: "pwsh" }, { projectRoot: "/other-project" }, { sessionId: "another-session" }]) {
    assert.equal((await inspectRetry({ ...args, ...changed })).repeated, false);
  }
  assert.equal((await clearFailure(args)).cleared, true);
  assert.equal((await inspectRetry(args)).repeated, false);
});

test("cache persists only digests, bounded counts, safe categories, and timestamps", async t => {
  const { args, file } = fixture(t);
  await recordFailure(args);
  const text = await readFile(file, "utf8");
  for (const raw of [args.projectRoot, args.sessionId, args.command, args.cwd, args.shell, "SECRET_VALUE"]) assert.equal(text.includes(raw), false, raw);
  const now = Date.now();
  for (let index = 0; index < 70; index++) await recordFailure({ ...args, command: `command-${index}`, now: now + index });
  const state = JSON.parse(await readFile(file, "utf8"));
  assert.equal(Object.keys(state.entries).length, 64);
  assert.equal((await inspectRetry({ ...args, command: "command-69", now: now + 100 })).repeated, true);
  assert.equal((await inspectRetry({ ...args, command: "command-0", now: now + 100 })).repeated, false);
  await recordFailure({ ...args, category: "untrusted SECRET_VALUE", now: now + 100 });
  assert.equal((await inspectRetry({ ...args, now: now + 100 })).category, "unknown");
});

test("expired and invalid state does not block new commands", async t => {
  const { args, file } = fixture(t);
  const now = Date.now();
  await recordFailure({ ...args, now });
  assert.equal((await inspectRetry({ ...args, now: now + 24 * 60 * 60 * 1000 })).repeated, false);
  await writeFile(file, "{malformed");
  assert.equal((await inspectRetry(args)).repeated, false);
  assert.equal((await recordFailure(args)).recorded, true);
  await writeFile(file, JSON.stringify({ version: 99, entries: { bogus: { attempts: 999 } } }));
  assert.equal((await inspectRetry(args)).repeated, false);
});

test("simultaneous failure events serialize without losing updates", async t => {
  const { args } = fixture(t);
  const results = await Promise.all(Array.from({ length: 12 }, () => recordFailure(args)));
  assert.ok(results.every(result => result.recorded));
  assert.equal((await inspectRetry(args)).attempts, 12);
});

test("missing sessions and contended locks degrade without blocking commands", async t => {
  const { args, file } = fixture(t);
  assert.equal((await recordFailure({ ...args, sessionId: "" })).recorded, false);
  assert.equal((await inspectRetry({ ...args, sessionId: undefined })).repeated, false);
  await recordFailure(args);
  await writeFile(`${file}.lock`, "");
  assert.equal((await recordFailure(args)).available, false);
  assert.equal((await clearFailure(args)).available, false);
  assert.deepEqual(await inspectRetry(args), { repeated: false, attempts: 0, available: false });
  assert.equal((await inspectRetry({ ...args, command: "new command" })).repeated, false);
});

test("verified diagnostics clear failures only in their session and shell context", async t => {
  const { args } = fixture(t);
  await recordFailure(args);
  await recordFailure({ ...args, command: "python tests.py" });
  await recordFailure({ ...args, shell: "pwsh" });
  await recordFailure({ ...args, cwd: "/another-directory" });
  assert.equal((await clearContextFailures(args)).cleared, 2);
  assert.equal((await inspectRetry(args)).repeated, false);
  assert.equal((await inspectRetry({ ...args, shell: "pwsh" })).repeated, true);
  assert.equal((await inspectRetry({ ...args, cwd: "/another-directory" })).repeated, true);
});

test("bounded housekeeping removes expired files while preserving locked and fresh state", async t => {
  const stale = fixture(t);
  const locked = fixture(t);
  const fresh = fixture(t);
  for (const entry of [stale, locked, fresh]) await recordFailure(entry.args);
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await utimes(stale.file, old, old);
  await utimes(locked.file, old, old);
  await writeFile(`${locked.file}.lock`, "");
  const freshModule = await import(`../hooks/session-state.mjs?cleanup=${randomUUID()}`);
  await freshModule.inspectRetry(fresh.args);
  await assert.rejects(readFile(stale.file), { code: "ENOENT" });
  assert.ok(await readFile(locked.file));
  assert.ok(await readFile(fresh.file));
});
