import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, opendir, readFile, rename, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const TTL = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 64;
const CATEGORIES = new Set(["suspected-transport-corruption", "transport-corruption", "wrong-directory", "executable-unavailable", "shell-syntax", "application-failure", "uncertain-completion", "unknown"]);
const digest = value => createHash("sha256").update(value).digest("hex");
// Separate users without persisting their home path, project, or session ID.
const DIRECTORY = path.join(tmpdir(), `dotnet-agent-recovery-${digest(homedir()).slice(0, 16)}`);
const EMPTY = { repeated: false, attempts: 0 };
let lastSweep = 0;

function keys(args) {
  if (typeof args.sessionId !== "string" || !args.sessionId.trim()) return null;
  const project = path.resolve(String(args.projectRoot ?? process.cwd()));
  return {
    file: path.join(DIRECTORY, `${digest(JSON.stringify([project, args.sessionId]))}.json`),
    fingerprint: digest(JSON.stringify([String(args.command ?? ""), String(args.cwd ?? project), String(args.shell ?? "")])),
    context: digest(JSON.stringify([String(args.cwd ?? project), String(args.shell ?? "")])),
    now: Number.isFinite(args.now) ? args.now : Date.now(),
  };
}

async function prepare() {
  await mkdir(DIRECTORY, { recursive: true, mode: 0o700 });
  const directory = await lstat(DIRECTORY);
  if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error("unavailable state directory");
  await cleanupExpired();
}

// Physical retention is best effort: scan at most 256 directory entries once
// per process interval. Acquire the writer lock before rechecking/removing a
// stale file, so cleanup cannot delete a newly refreshed session's state.
async function cleanupExpired() {
  const now = Date.now();
  if (now - lastSweep < 5 * 60 * 1000) return;
  lastSweep = now;
  try {
    let scanned = 0;
    for await (const entry of await opendir(DIRECTORY)) {
      if (++scanned > 256) break;
      if (!/^[a-f0-9]{64}\.json$/.test(entry.name) || !entry.isFile()) continue;
      const file = path.join(DIRECTORY, entry.name);
      let handle;
      try {
        if (now - (await lstat(file)).mtimeMs < TTL) continue;
        handle = await open(`${file}.lock`, "wx", 0o600);
        const current = await lstat(file);
        if (current.isFile() && !current.isSymbolicLink() && now - current.mtimeMs >= TTL) await rm(file);
      } catch { /* Busy or unavailable state is left for another sweep. */ }
      finally {
        if (handle) {
          await handle.close();
          await rm(`${file}.lock`, { force: true });
        }
      }
    }
  } catch { /* Cache housekeeping must not prevent command execution. */ }
}

async function readState(file, now) {
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 32768) return {};
    const parsed = JSON.parse(await readFile(file, "utf8"));
    if (parsed?.version !== 1 || !parsed.entries || typeof parsed.entries !== "object" || Array.isArray(parsed.entries)) return {};
    const entries = Object.entries(parsed.entries).filter(([key, value]) =>
      /^[a-f0-9]{64}$/.test(key) && value && typeof value === "object"
      && Number.isSafeInteger(value.attempts) && value.attempts > 0 && value.attempts <= 1000000
      && Number.isFinite(value.updated) && value.updated <= now + 5 * 60 * 1000 && now - value.updated < TTL
      && CATEGORIES.has(value.category) && /^[a-f0-9]{64}$/.test(value.context));
    entries.sort((a, b) => b[1].updated - a[1].updated);
    return Object.fromEntries(entries.slice(0, MAX_ENTRIES));
  } catch (error) {
    // An unreadable or stale cache must never block a legitimate command.
    return {};
  }
}

async function withLock(file, operation) {
  const lock = `${file}.lock`;
  let handle;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      handle = await open(lock, "wx", 0o600);
      break;
    } catch (error) {
      if (error.code !== "EEXIST" || attempt === 19) throw error;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  try { return await operation(); }
  finally {
    await handle.close();
    await rm(lock, { force: true });
  }
}

async function writeState(file, entries) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(`${JSON.stringify({ version: 1, entries })}\n`, "utf8"); }
    finally { await handle.close(); }
    await rename(temporary, file);
  } finally { await rm(temporary, { force: true }); }
}

/** Return prior failed attempts for an identical command/context in this session. */
export async function inspectRetry(args) {
  const key = keys(args);
  if (!key) return { ...EMPTY, available: false };
  try {
    await prepare();
    // A writer that crashed can leave a lock behind. Do not enforce a cached
    // failure when the matching state cannot also be cleared after diagnostics.
    // Bound the wait and fail open rather than deleting an unknown writer lock.
    return await withLock(key.file, async () => {
      const entries = await readState(key.file, key.now);
      const previous = entries[key.fingerprint];
      return previous ? { repeated: true, attempts: previous.attempts, category: previous.category, available: true } : { ...EMPTY, available: true };
    });
  } catch { return { ...EMPTY, available: false }; }
}

/** Record a single failure event. Call only once for each failed execution. */
export async function recordFailure(args) {
  const key = keys(args);
  if (!key) return { recorded: false, attempts: 0, available: false };
  try {
    await prepare();
    return await withLock(key.file, async () => {
      const entries = await readState(key.file, key.now);
      const attempts = Math.min((entries[key.fingerprint]?.attempts ?? 0) + 1, 1000000);
      const updated = Math.max(key.now, entries[key.fingerprint]?.updated ?? key.now);
      delete entries[key.fingerprint];
      entries[key.fingerprint] = { attempts, category: CATEGORIES.has(args.category) ? args.category : "unknown", updated, context: key.context };
      const bounded = Object.fromEntries(Object.entries(entries).reverse().sort((a, b) => b[1].updated - a[1].updated).slice(0, MAX_ENTRIES));
      await writeState(key.file, bounded);
      return { recorded: true, attempts, available: true };
    });
  } catch { return { recorded: false, attempts: 0, available: false }; }
}

/** A confirmed successful execution clears only its matching failure. */
export async function clearFailure(args) {
  const key = keys(args);
  if (!key) return { cleared: false, available: false };
  try {
    await prepare();
    return await withLock(key.file, async () => {
      const entries = await readState(key.file, key.now);
      const existed = Boolean(entries[key.fingerprint]);
      delete entries[key.fingerprint];
      if (Object.keys(entries).length) await writeState(key.file, entries);
      else await rm(key.file, { force: true });
      return { cleared: existed, available: true };
    });
  } catch { return { cleared: false, available: false }; }
}

/** Permit another attempt after the caller verifies a read-only context diagnostic. */
export async function clearContextFailures(args) {
  const key = keys(args);
  if (!key) return { cleared: 0, available: false };
  try {
    await prepare();
    return await withLock(key.file, async () => {
      const entries = await readState(key.file, key.now);
      const retained = Object.fromEntries(Object.entries(entries).filter(([, value]) => value.context !== key.context));
      const cleared = Object.keys(entries).length - Object.keys(retained).length;
      if (Object.keys(retained).length) await writeState(key.file, retained);
      else await rm(key.file, { force: true });
      return { cleared, available: true };
    });
  } catch { return { cleared: 0, available: false }; }
}
