#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

type Command = "install" | "update" | "list" | "doctor" | "uninstall";
type Target = "all" | "shared" | "codex" | "copilot" | "claude" | "cursor";
type Scope = "user" | "project";
type InstallMode = "copy" | "link";
type InstallationState = "missing" | "unmanaged" | "unchanged" | "modified";
type InspectionState = InstallationState | "stale";

interface Options {
  target: Target;
  scope: Scope;
  project: string;
  mode: InstallMode;
  dryRun: boolean;
  force: boolean;
  yes: boolean;
  json: boolean;
  help?: boolean;
}

interface SkillRecord {
  digest: string;
  mode: InstallMode;
  source: string | null;
}

interface InstallManifest {
  schemaVersion: 1;
  packageVersion: string | null;
  target?: string;
  skills: Record<string, SkillRecord>;
}

interface Destination {
  target: string;
  directory: string;
}

interface State {
  state: InstallationState;
  kind: "missing" | "link" | "directory" | "file";
  installedPath: string;
}

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SKILLS_ROOT = path.join(PACKAGE_ROOT, "skills");
const GLOBAL_INSTRUCTIONS_SOURCE = path.join(PACKAGE_ROOT, "global-instructions", "AGENTS.md");
const COPILOT_INSTRUCTIONS_RELATIVE = path.join(".github", "copilot-instructions.md");
const COPILOT_INSTRUCTIONS_MANIFEST = ".dotnet-agent-skills-instructions.json";
const MANIFEST_NAME = ".dotnet-agent-skills.json";
const SUPPORTED_TARGETS = new Set<Target>(["all", "shared", "codex", "copilot", "claude", "cursor"]);

interface InstructionsManifest {
  schemaVersion: 1;
  digest: string;
  packageVersion: string | null;
}

interface InstructionsState {
  path: string;
  state: InstallationState;
  managed: boolean;
}

function wantsCopilotInstructions(target: Target): boolean {
  return target === "copilot" || target === "all";
}

function copilotInstructionsPath(projectRoot: string): string {
  return path.join(projectRoot, COPILOT_INSTRUCTIONS_RELATIVE);
}

function copilotInstructionsManifestPath(projectRoot: string): string {
  return path.join(projectRoot, ".github", COPILOT_INSTRUCTIONS_MANIFEST);
}

function digestText(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function usage(): string {
  return `Usage: dotnet-agent-skills <command> [options]

Commands:
  install      Install canonical skills
  update       Refresh a managed installation without overwriting local edits
  list         List packaged skills and installation state
  doctor       Validate packaged skills and inspect installation health
  uninstall    Remove only skills tracked by this package

Options:
  --target <all|shared|codex|copilot|claude|cursor>  Default: all
  --scope <user|project>                             Default: user
  --project <path>                                   Project root; implies project scope
  --mode <copy|link>                                 Default: copy
  --dry-run                                          Show planned changes only
  --force                                            Permit replacement/removal of conflicts
  --yes                                              Confirm --force non-interactively
  --json                                             JSON output for list/doctor
  -h, --help                                         Show help

For --target all, one shared .agents/skills installation serves Codex, Copilot,
and Cursor; a second .claude/skills installation serves Claude Code.

Project-scope --target copilot|all also installs a thin always-on file at
.github/copilot-instructions.md from global-instructions/AGENTS.md (skill
bodies stay on-demand).`;
}

function requireValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

function parseArgs(argv: readonly string[]): { command: string | undefined; options: Options } {
  const options: Options = {
    target: "all",
    scope: "user",
    project: process.cwd(),
    mode: "copy",
    dryRun: false,
    force: false,
    yes: false,
    json: false,
  };

  let projectSpecified = false;
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument) continue;
    if (argument === "--target") options.target = requireValue(argv, index, argument) as Target;
    else if (argument === "--scope") options.scope = requireValue(argv, index, argument) as Scope;
    else if (argument === "--project") {
      options.project = requireValue(argv, index, argument);
      projectSpecified = true;
    }
    else if (argument === "--mode") options.mode = requireValue(argv, index, argument) as InstallMode;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--force") options.force = true;
    else if (argument === "--yes") options.yes = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "-h" || argument === "--help") options.help = true;
    else throw new Error(`unknown option: ${argument}`);
    if (["--target", "--scope", "--project", "--mode"].includes(argument)) index += 1;
  }

  if (projectSpecified) options.scope = "project";
  options.project = path.resolve(options.project);
  if (!SUPPORTED_TARGETS.has(options.target)) throw new Error(`unsupported target: ${options.target}`);
  if (options.scope !== "user" && options.scope !== "project") throw new Error("scope must be user or project");
  if (options.mode !== "copy" && options.mode !== "link") throw new Error("mode must be copy or link");
  return { command: argv[0], options };
}

function destinations(options: Options): Destination[] {
  const base = options.scope === "user" ? homedir() : options.project;
  const table: Record<Exclude<Target, "all">, string> = options.scope === "user"
    ? {
        shared: ".agents/skills",
        codex: ".agents/skills",
        copilot: ".copilot/skills",
        claude: ".claude/skills",
        cursor: ".cursor/skills",
      }
    : {
        shared: ".agents/skills",
        codex: ".agents/skills",
        copilot: ".github/skills",
        claude: ".claude/skills",
        cursor: ".cursor/skills",
      };
  const targets: Exclude<Target, "all">[] = options.target === "all" ? ["shared", "claude"] : [options.target];
  const unique = new Map<string, Destination>();
  for (const target of targets) {
    const relative = table[target];
    unique.set(relative, { target, directory: path.join(base, relative) });
  }
  return [...unique.values()];
}

async function packagedSkills(): Promise<string[]> {
  const entries = await readdir(SKILLS_ROOT, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function pathKind(target: string): Promise<State["kind"]> {
  try {
    const stat = await lstat(target);
    return stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "directory" : "file";
  } catch (error) {
    if (isMissing(error)) return "missing";
    throw error;
  }
}

async function digestDirectory(directory: string): Promise<string> {
  const hash = createHash("sha256");
  async function visit(current: string, relative = ""): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativeName = path.posix.join(relative, entry.name);
      const fullName = path.join(current, entry.name);
      hash.update(relativeName);
      if (entry.isDirectory()) await visit(fullName, relativeName);
      else if (entry.isSymbolicLink()) hash.update(`link:${await readlink(fullName)}`);
      else hash.update(await readFile(fullName));
    }
  }
  await visit(directory);
  return hash.digest("hex");
}

async function readManifest(directory: string): Promise<InstallManifest> {
  try {
    const manifest = JSON.parse(await readFile(path.join(directory, MANIFEST_NAME), "utf8")) as InstallManifest;
    if (manifest.schemaVersion !== 1 || !manifest.skills || typeof manifest.skills !== "object" || Array.isArray(manifest.skills)) {
      throw new Error("unsupported or malformed manifest schema");
    }
    for (const name of Object.keys(manifest.skills)) assertSafeSkillName(directory, name);
    return manifest;
  } catch (error) {
    if (isMissing(error)) return { schemaVersion: 1, packageVersion: null, skills: {} };
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid ${path.join(directory, MANIFEST_NAME)}: ${detail}`);
  }
}

function assertSafeSkillName(directory: string, name: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`unsafe skill name in ${path.join(directory, MANIFEST_NAME)}: ${JSON.stringify(name)}`);
  }
  const resolvedDirectory = path.resolve(directory);
  const resolvedSkill = path.resolve(directory, name);
  if (path.dirname(resolvedSkill) !== resolvedDirectory) {
    throw new Error(`skill path escapes installation directory: ${JSON.stringify(name)}`);
  }
}

async function writeManifest(directory: string, manifest: InstallManifest, dryRun: boolean): Promise<void> {
  if (dryRun) return;
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function readInstructionsManifest(projectRoot: string): Promise<InstructionsManifest | null> {
  try {
    const manifest = JSON.parse(
      await readFile(copilotInstructionsManifestPath(projectRoot), "utf8"),
    ) as InstructionsManifest;
    if (manifest.schemaVersion !== 1 || typeof manifest.digest !== "string" || !manifest.digest) {
      throw new Error("unsupported or malformed instructions manifest");
    }
    return manifest;
  } catch (error) {
    if (isMissing(error)) return null;
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid ${copilotInstructionsManifestPath(projectRoot)}: ${detail}`);
  }
}

async function currentInstructionsState(projectRoot: string): Promise<InstructionsState> {
  const instructionsPath = copilotInstructionsPath(projectRoot);
  const kind = await pathKind(instructionsPath);
  const managed = await readInstructionsManifest(projectRoot);
  if (kind === "missing") {
    return { path: instructionsPath, state: "missing", managed: managed !== null };
  }
  if (kind !== "file") {
    return { path: instructionsPath, state: "modified", managed: managed !== null };
  }
  const digest = digestText(await readFile(instructionsPath, "utf8"));
  if (!managed) return { path: instructionsPath, state: "unmanaged", managed: false };
  return {
    path: instructionsPath,
    state: digest === managed.digest ? "unchanged" : "modified",
    managed: true,
  };
}

async function installCopilotInstructions(
  options: Options,
  packageVersion: string,
  state: InstructionsState,
  action: "install" | "replace" | "conflict",
): Promise<void> {
  const sourceContents = await readFile(GLOBAL_INSTRUCTIONS_SOURCE, "utf8");
  const sourceDigest = digestText(sourceContents);

  console.log(`${options.dryRun ? `would ${action === "install" ? "install" : "replace"}` : action === "install" ? "install" : "replace"}  ${state.path}`);
  if (options.dryRun) return;

  if (action === "conflict") {
    const backup = await moveToBackup(
      path.join(options.project, ".github"),
      "copilot-instructions.md",
      state.path,
    );
    console.log(`backup     ${backup}`);
  }

  await mkdir(path.dirname(state.path), { recursive: true });
  await writeFile(state.path, sourceContents, "utf8");
  await writeFile(
    copilotInstructionsManifestPath(options.project),
    `${JSON.stringify({ schemaVersion: 1, digest: sourceDigest, packageVersion } satisfies InstructionsManifest, null, 2)}\n`,
    "utf8",
  );
}

async function uninstallCopilotInstructions(options: Options, state: InstructionsState): Promise<void> {
  const manifestPath = copilotInstructionsManifestPath(options.project);
  const hasManifest = await pathKind(manifestPath) !== "missing";

  if (state.state !== "missing") {
    console.log(`${options.dryRun ? "would remove" : "remove"}   ${state.path}`);
    if (!options.dryRun) {
      if (state.state === "modified" || state.state === "unmanaged") {
        const backup = await moveToBackup(
          path.join(options.project, ".github"),
          "copilot-instructions.md",
          state.path,
        );
        console.log(`backup     ${backup}`);
      } else {
        await rm(state.path, { force: true });
      }
    }
  }

  if (hasManifest) {
    console.log(`${options.dryRun ? "would remove" : "remove"}   ${manifestPath}`);
    if (!options.dryRun) await rm(manifestPath, { force: true });
  }
}

async function currentState(destination: string, name: string, record?: SkillRecord): Promise<State> {
  const installedPath = path.join(destination, name);
  const kind = await pathKind(installedPath);
  if (kind === "missing") return { state: "missing", kind, installedPath };
  if (!record) return { state: "unmanaged", kind, installedPath };
  if (kind === "link") {
    const actual = await realpath(installedPath).catch(() => null);
    return { state: actual === record.source ? "unchanged" : "modified", kind, installedPath };
  }
  if (kind !== "directory") return { state: "modified", kind, installedPath };
  const digest = await digestDirectory(installedPath);
  return { state: digest === record.digest ? "unchanged" : "modified", kind, installedPath };
}

async function confirmForce(conflicts: readonly unknown[], options: Options): Promise<void> {
  if (conflicts.length === 0 || !options.force || options.dryRun || options.yes) return;
  if (!process.stdin.isTTY) throw new Error("--force in a non-interactive shell also requires --yes");
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`Replace or remove ${conflicts.length} conflicting path(s)? [y/N] `);
  prompt.close();
  if (!/^y(es)?$/i.test(answer.trim())) throw new Error("operation cancelled");
}

async function moveToBackup(destination: string, name: string, target: string): Promise<string> {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const backupDirectory = path.join(path.dirname(destination), ".dotnet-agent-skills-backups", `${stamp}-${randomUUID()}`);
  const backup = path.join(backupDirectory, name);
  await mkdir(backupDirectory, { recursive: true });
  await rename(target, backup);
  return backup;
}

interface InstallPlan {
  destination: Destination;
  manifest: InstallManifest;
  skills: { name: string; state: State; action: "install" | "replace" | "conflict" }[];
  retirements: { name: string; state: State }[];
}

async function installOrUpdate(options: Options, command: "install" | "update"): Promise<void> {
  const skills = await packagedSkills();
  const packaged = new Set(skills);
  const packageJson = JSON.parse(await readFile(path.join(PACKAGE_ROOT, "package.json"), "utf8")) as { version: string };
  const destinationPlans: InstallPlan[] = [];

  for (const destination of destinations(options)) {
    const manifest = await readManifest(destination.directory);
    const plans: { name: string; state: State; action: "install" | "replace" | "conflict" }[] = [];
    for (const name of skills) {
      const state = await currentState(destination.directory, name, manifest.skills[name]);
      const action = state.state === "missing" ? "install" : state.state === "unchanged" ? "replace" : "conflict";
      plans.push({ name, state, action });
    }

    const retirements: { name: string; state: State }[] = [];
    if (command === "update") {
      for (const [name, record] of Object.entries(manifest.skills)) {
        if (!packaged.has(name)) retirements.push({ name, state: await currentState(destination.directory, name, record) });
      }
    }

    destinationPlans.push({ destination, manifest, skills: plans, retirements });
  }

  const instructionsEnabled = options.scope === "project" && wantsCopilotInstructions(options.target);
  const instructionsState = instructionsEnabled ? await currentInstructionsState(options.project) : null;
  const instructionsAction = instructionsState
    ? instructionsState.state === "missing"
      ? "install" as const
      : instructionsState.state === "unchanged"
        ? "replace" as const
        : "conflict" as const
    : null;

  const conflicts = [
    ...destinationPlans.flatMap((plan) => [
      ...plan.skills.filter((skill) => skill.action === "conflict"),
      ...plan.retirements.filter((retirement) => retirement.state.state === "modified"),
    ]),
    ...(instructionsAction === "conflict" && instructionsState
      ? [{ state: { installedPath: instructionsState.path } }]
      : []),
  ];
  if (conflicts.length > 0 && !options.force) {
    conflicts.forEach((plan) => console.error(`conflict   ${plan.state.installedPath}`));
    throw new Error("existing or locally modified skills were not overwritten; review them or use --force");
  }
  await confirmForce(conflicts, options);

  for (const { destination, manifest, skills: plans, retirements } of destinationPlans) {
    if (!options.dryRun) await mkdir(destination.directory, { recursive: true });

    for (const plan of plans) {
      const source = path.join(SKILLS_ROOT, plan.name);
      const target = plan.state.installedPath;
      if (plan.action !== "install") {
        console.log(`${options.dryRun ? "would replace" : "replace"}  ${target}`);
        if (!options.dryRun) {
          if (plan.action === "conflict") {
            const backup = await moveToBackup(destination.directory, plan.name, target);
            console.log(`backup     ${backup}`);
          } else await rm(target, { recursive: true, force: true });
        }
      } else console.log(`${options.dryRun ? "would install" : "install"}  ${target}`);

      if (!options.dryRun) {
        if (options.mode === "link") await symlink(source, target, process.platform === "win32" ? "junction" : "dir");
        else await cp(source, target, { recursive: true, errorOnExist: true });
      }
      manifest.skills[plan.name] = {
        digest: await digestDirectory(source),
        mode: options.mode,
        source: options.mode === "link" ? await realpath(source) : null,
      };
    }
    for (const retirement of retirements) {
      if (retirement.state.state !== "missing") {
        console.log(`${options.dryRun ? "would retire" : "retire"}   ${retirement.state.installedPath}`);
        if (!options.dryRun) {
          if (retirement.state.state === "modified") {
            const backup = await moveToBackup(
              destination.directory,
              retirement.name,
              retirement.state.installedPath,
            );
            console.log(`backup     ${backup}`);
          } else {
            await rm(retirement.state.installedPath, { recursive: true, force: true });
          }
        }
      }
      delete manifest.skills[retirement.name];
    }
    manifest.packageVersion = packageJson.version;
    manifest.target = destination.target;
    await writeManifest(destination.directory, manifest, options.dryRun);
  }

  if (instructionsState && instructionsAction) {
    await installCopilotInstructions(options, packageJson.version, instructionsState, instructionsAction);
  }
}

async function uninstall(options: Options): Promise<void> {
  const destinationPlans: {
    destination: Destination;
    manifest: InstallManifest;
    skills: { name: string; state: State }[];
  }[] = [];

  for (const destination of destinations(options)) {
    const manifest = await readManifest(destination.directory);
    const plans: { name: string; state: State }[] = [];
    for (const [name, record] of Object.entries(manifest.skills)) {
      const state = await currentState(destination.directory, name, record);
      if (state.state === "missing") delete manifest.skills[name];
      else plans.push({ name, state });
    }
    destinationPlans.push({ destination, manifest, skills: plans });
  }

  const instructionsEnabled = options.scope === "project" && wantsCopilotInstructions(options.target);
  const instructionsState = instructionsEnabled ? await currentInstructionsState(options.project) : null;
  const instructionsManifestKind = instructionsEnabled
    ? await pathKind(copilotInstructionsManifestPath(options.project))
    : "missing";
  const hasInstructionsWork = instructionsState !== null
    && (instructionsState.state !== "missing" || instructionsManifestKind !== "missing");

  const conflicts = [
    ...destinationPlans.flatMap((plan) =>
      plan.skills.filter((skill) => skill.state.state === "modified").map((skill) => skill.state.installedPath),
    ),
    ...(instructionsState && (instructionsState.state === "modified" || instructionsState.state === "unmanaged")
      ? [instructionsState.path]
      : []),
  ];
  if (conflicts.length > 0 && !options.force) {
    conflicts.forEach((conflictPath) => console.error(`modified   ${conflictPath}`));
    throw new Error("locally modified managed skills were not removed; use --force after review");
  }
  await confirmForce(conflicts.map((conflictPath) => ({ path: conflictPath })), options);

  for (const { destination, manifest, skills: plans } of destinationPlans) {
    for (const plan of plans) {
      console.log(`${options.dryRun ? "would remove" : "remove"}   ${plan.state.installedPath}`);
      if (!options.dryRun) await rm(plan.state.installedPath, { recursive: true, force: true });
      delete manifest.skills[plan.name];
    }
    if (!options.dryRun) {
      const manifestPath = path.join(destination.directory, MANIFEST_NAME);
      if (Object.keys(manifest.skills).length === 0) await rm(manifestPath, { force: true });
      else await writeManifest(destination.directory, manifest, false);
    }
  }

  if (hasInstructionsWork && instructionsState) {
    await uninstallCopilotInstructions(options, instructionsState);
  }
}

async function inspect(options: Options): Promise<{
  packagedSkills: string[];
  installations: (Destination & { packageVersion: string | null; skills: { name: string; state: InspectionState; mode: InstallMode | null }[] })[];
  copilotInstructions: InstructionsState | null;
}> {
  const skills = await packagedSkills();
  const packaged = new Set(skills);
  const installations = [];
  for (const destination of destinations(options)) {
    const manifest = await readManifest(destination.directory);
    const states: { name: string; state: InspectionState; mode: InstallMode | null }[] = [];
    for (const name of skills) {
      const state = await currentState(destination.directory, name, manifest.skills[name]);
      states.push({ name, state: state.state, mode: manifest.skills[name]?.mode ?? null });
    }
    for (const [name, record] of Object.entries(manifest.skills)) {
      if (!packaged.has(name)) states.push({ name, state: "stale" as const, mode: record.mode });
    }
    installations.push({ ...destination, packageVersion: manifest.packageVersion, skills: states });
  }
  const copilotInstructions = options.scope === "project" && wantsCopilotInstructions(options.target)
    ? await currentInstructionsState(options.project)
    : null;
  return { packagedSkills: skills, installations, copilotInstructions };
}

async function validateCanonical(): Promise<string[]> {
  const errors: string[] = [];
  if (!existsSync(GLOBAL_INSTRUCTIONS_SOURCE)) {
    errors.push("global-instructions/AGENTS.md: missing always-on instructions source");
  }
  for (const name of await packagedSkills()) {
    const skillFile = path.join(SKILLS_ROOT, name, "SKILL.md");
    if (!existsSync(skillFile)) {
      errors.push(`${name}: missing SKILL.md`);
      continue;
    }
    const contents = await readFile(skillFile, "utf8");
    const match = contents.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!match?.[1]) errors.push(`${name}: invalid frontmatter delimiters`);
    else {
      const declaredName = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
      const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
      if (declaredName !== name) errors.push(`${name}: frontmatter name does not match directory`);
      if (!description) errors.push(`${name}: missing description`);
    }
  }
  return errors;
}

function countStates(skills: readonly { state: InspectionState }[]): Record<string, number> {
  return skills.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.state] = (counts[entry.state] ?? 0) + 1;
    return counts;
  }, {});
}

async function main(): Promise<void> {
  try {
    const argv = process.argv.slice(2);
    if (argv.length === 1 && (argv[0] === "-h" || argv[0] === "--help")) {
      console.log(usage());
      return;
    }
    const parsed = parseArgs(argv);
    if (parsed.options.help || !parsed.command) {
      console.log(usage());
      return;
    }
    const commands = new Set<Command>(["install", "update", "list", "doctor", "uninstall"]);
    if (!commands.has(parsed.command as Command)) throw new Error(`unknown command: ${parsed.command}`);
    const command = parsed.command as Command;

    if (command === "install" || command === "update") await installOrUpdate(parsed.options, command);
    else if (command === "uninstall") await uninstall(parsed.options);
    else {
      const report = await inspect(parsed.options);
      const validationErrors = command === "doctor" ? await validateCanonical() : [];
      const unhealthySkills = report.installations.flatMap((entry) => entry.skills)
        .filter((entry) => entry.state !== "unchanged");
      const unhealthyInstructions = report.copilotInstructions !== null
        && report.copilotInstructions.state !== "unchanged";
      const output = {
        ...report,
        validationErrors,
        healthy: validationErrors.length === 0 && unhealthySkills.length === 0 && !unhealthyInstructions,
      };
      if (parsed.options.json) console.log(JSON.stringify(output, null, 2));
      else {
        console.log(`Packaged skills (${report.packagedSkills.length}): ${report.packagedSkills.join(", ")}`);
        for (const installation of report.installations) {
          const summary = Object.entries(countStates(installation.skills))
            .map(([key, value]) => `${key}=${value}`).join(" ");
          console.log(`${installation.target.padEnd(7)} ${installation.directory} ${summary}`);
        }
        if (report.copilotInstructions) {
          console.log(`instr   ${report.copilotInstructions.path} ${report.copilotInstructions.state}`);
        }
        validationErrors.forEach((error) => console.error(`error: ${error}`));
      }
      if (command === "doctor" && !output.healthy) process.exitCode = 1;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`error: ${detail}`);
    process.exitCode = 1;
  }
}

await main();
