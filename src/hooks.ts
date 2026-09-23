import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type HookTarget = "codex" | "copilot" | "claude" | "cursor" | "antigravity";
export type HookState = "missing" | "unchanged" | "modified";

const OWNER = "dotnet-production-agent-skills";
const COMMAND = "node .agent-guardrails/guard.mjs";
const SCRIPT_DIRECTORY = ".agent-guardrails";
const SCRIPT_NAME = "guard.mjs";

interface JsonObject { [key: string]: unknown }

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(file: string): Promise<JsonObject> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!isObject(parsed)) throw new Error("root must be a JSON object");
    return parsed;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return {};
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid hook configuration ${file}: ${detail}`);
  }
}

function locations(projectRoot: string, target: HookTarget): { config: string; script: string } {
  const configs: Record<HookTarget, string> = {
    codex: ".codex/hooks.json",
    copilot: ".github/hooks/dotnet-production-agent-skills.json",
    claude: ".claude/settings.json",
    cursor: ".cursor/hooks.json",
    antigravity: ".agents/hooks.json",
  };
  return { config: path.join(projectRoot, configs[target]), script: path.join(projectRoot, SCRIPT_DIRECTORY, SCRIPT_NAME) };
}

function handler(target: HookTarget): JsonObject {
  return { type: "command", command: `${COMMAND} ${target}`, timeout: 10 };
}

function managedGroup(target: HookTarget): JsonObject {
  return { matcher: target === "antigravity" ? "run_command|view_file|write_to_file|replace_file_content|multi_replace_file_content" : "Bash|PowerShell|Read|Write|Edit", hooks: [handler(target)] };
}

function containsManaged(value: unknown): boolean {
  return JSON.stringify(value).includes(COMMAND);
}

function withoutManaged(value: unknown): unknown[] {
  return Array.isArray(value) ? value.filter((entry) => !containsManaged(entry)) : [];
}

function mergeConfig(current: JsonObject, target: HookTarget, install: boolean): JsonObject {
  if (target === "copilot") {
    return install ? {
      version: 1,
      description: `${OWNER} project command guardrails`,
      hooks: { preToolUse: [{ type: "command", command: `${COMMAND} copilot`, timeoutSec: 10 }] },
    } : {};
  }
  if (target === "antigravity") {
    const next = { ...current };
    if (install) next[OWNER] = { enabled: true, PreToolUse: [managedGroup(target)] };
    else delete next[OWNER];
    return next;
  }

  const hooks = isObject(current.hooks) ? { ...current.hooks } : {};
  const event = target === "cursor" ? "preToolUse" : "PreToolUse";
  const entries = withoutManaged(hooks[event]);
  if (install) entries.push(target === "cursor"
    ? { command: `${COMMAND} cursor`, timeout: 10, matcher: "Shell|Read|Write", failClosed: true }
    : managedGroup(target));
  if (entries.length) hooks[event] = entries;
  else delete hooks[event];
  const next = { ...current };
  if (target === "cursor") next.version = typeof current.version === "number" ? current.version : 1;
  if (Object.keys(hooks).length) next.hooks = hooks;
  else delete next.hooks;
  return next;
}

async function expectedScript(packageRoot: string): Promise<string> {
  return readFile(path.join(packageRoot, "hooks", SCRIPT_NAME), "utf8");
}

export async function inspectHooks(projectRoot: string, packageRoot: string, target: HookTarget): Promise<{ target: HookTarget; state: HookState; config: string; script: string }> {
  const files = locations(projectRoot, target);
  try {
    const [current, script] = await Promise.all([readJson(files.config), readFile(files.script, "utf8")]);
    const expected = mergeConfig(current, target, true);
    const configMatches = JSON.stringify(current) === JSON.stringify(expected);
    return { target, state: configMatches && script === await expectedScript(packageRoot) ? "unchanged" : "modified", ...files };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { target, state: "missing", ...files };
    throw error;
  }
}

export async function changeHooks(projectRoot: string, packageRoot: string, target: HookTarget, action: "install" | "uninstall", dryRun: boolean): Promise<"install" | "update" | "remove" | "skip"> {
  const files = locations(projectRoot, target);
  const current = await readJson(files.config);
  const next = mergeConfig(current, target, action === "install");
  const hasConfigChange = JSON.stringify(current) !== JSON.stringify(next);
  let scriptMatches = false;
  try { scriptMatches = await readFile(files.script, "utf8") === await expectedScript(packageRoot); } catch { /* missing */ }
  if (action === "install") {
    if (!hasConfigChange && scriptMatches) return "skip";
    if (!dryRun) {
      await mkdir(path.dirname(files.config), { recursive: true });
      await mkdir(path.dirname(files.script), { recursive: true });
      await writeFile(files.config, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      await cp(path.join(packageRoot, "hooks", SCRIPT_NAME), files.script);
    }
    return Object.keys(current).length ? "update" : "install";
  }
  if (!hasConfigChange) return "skip";
  if (!dryRun) {
    if (Object.keys(next).length) await writeFile(files.config, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    else await rm(files.config, { force: true });
  }
  return "remove";
}

export function hookTargets(target: string): HookTarget[] {
  if (target === "all") return ["codex", "copilot", "claude", "cursor", "antigravity"];
  return target === "shared" ? [] : [target as HookTarget];
}

export async function removeSharedHookScript(projectRoot: string, dryRun: boolean): Promise<void> {
  if (!dryRun) await rm(path.join(projectRoot, SCRIPT_DIRECTORY), { recursive: true, force: true });
}
