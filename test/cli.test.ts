import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(repository, "dist", "src", "cli.js");

function runAt(home: string, cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}

function run(home: string, ...args: string[]) {
  return runAt(home, repository, ...args);
}

function gitAt(home: string, cwd: string, ...args: string[]) {
  return spawnSync("git", ["-c", "user.name=Hook Test", "-c", "user.email=hook@example.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd, encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home, GIT_CONFIG_NOSYSTEM: "1" },
  });
}

test("Git commit-msg hook rejects final trailers and allows ordinary commits", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-git-hook-home-"));
  const project = await mkdtemp(path.join(tmpdir(), "dotnet-git-hook-project-"));
  assert.equal(gitAt(home, project, "init", "--quiet").status, 0);
  const install = runAt(home, project, "git-hook");
  assert.equal(install.status, 0, install.stderr);
  assert.match(runAt(home, project, "git-hook").stdout, /verified/);
  const messages = [
    "Feature\n\nCo-authored-by: Copilot <copilot@example.invalid>",
    "Feature\r\n\r\nCO-AUTHORED-BY: Agent <agent@example.invalid>\r\n",
  ];
  for (const message of messages) {
    const result = gitAt(home, project, "commit", "--allow-empty", "-m", message);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Commit rejected/);
  }
  const messageFile = path.join(project, "message.txt");
  await writeFile(messageFile, messages[0]!);
  assert.notEqual(gitAt(home, project, "commit", "--allow-empty", "-F", messageFile).status, 0);
  assert.notEqual(gitAt(home, project, "commit", "--allow-empty", "-m", "Feature", "--trailer", "Co-authored-by: Copilot <copilot@example.invalid>").status, 0);
  assert.notEqual(gitAt(home, project, "rev-parse", "--verify", "HEAD").status, 0, "Rejected commits must not create history");
  const valid = gitAt(home, project, "commit", "--allow-empty", "-m", "Explain the co-authored-by policy\n\nSigned-off-by: Developer <dev@example.invalid>");
  assert.equal(valid.status, 0, valid.stderr);
});

test("Git hook installer respects custom hooksPath, preserves conflicts, and supports dry-run", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-git-hook-home-"));
  const project = await mkdtemp(path.join(tmpdir(), "dotnet-git-hook-project-"));
  assert.equal(gitAt(home, project, "init", "--quiet").status, 0);
  assert.equal(gitAt(home, project, "config", "core.hooksPath", ".custom-hooks").status, 0);
  const hook = path.join(project, ".custom-hooks", "commit-msg");
  const dryRun = runAt(home, project, "git-hook", "--dry-run");
  assert.equal(dryRun.status, 0, dryRun.stderr);
  await assert.rejects(readFile(hook), { code: "ENOENT" });
  assert.equal(runAt(home, home, "git-hook", "--project", project).status, 0);
  assert.equal(gitAt(home, project, "config", "core.hooksPath").stdout.trim(), ".custom-hooks");
  await writeFile(hook, "#!/bin/sh\n# existing team hook\nexit 0\n");
  const conflict = runAt(home, project, "git-hook", "--force", "--yes");
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /Existing commit-msg hook preserved/);
  assert.match(await readFile(hook, "utf8"), /existing team hook/);
  assert.notEqual(runAt(home, home, "git-hook").status, 0, "Non-repositories must fail");
});

test("copy install, doctor, conflict protection, and uninstall", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-skills-"));
  const installedSkill = path.join(home, ".agents", "skills", "code-quality", "SKILL.md");

  const install = run(home, "install", "--target", "all");
  assert.equal(install.status, 0, install.stderr);
  assert.match(await readFile(installedSkill, "utf8"), /name: code-quality/);
  assert.match(await readFile(path.join(home, ".claude", "skills", "code-quality", "SKILL.md"), "utf8"), /name: code-quality/);

  const doctor = run(home, "doctor", "--target", "all", "--json");
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.equal((JSON.parse(doctor.stdout) as { healthy: boolean }).healthy, true);

  await writeFile(installedSkill, "locally edited\n", "utf8");
  const update = run(home, "update", "--target", "shared");
  assert.equal(update.status, 1);
  assert.match(update.stderr, /not overwritten/);
  assert.equal(await readFile(installedSkill, "utf8"), "locally edited\n");

  const uninstall = run(home, "uninstall", "--target", "shared");
  assert.equal(uninstall.status, 1);
  assert.match(uninstall.stderr, /not removed/);

  const forced = run(home, "uninstall", "--target", "shared", "--force", "--yes");
  assert.equal(forced.status, 0, forced.stderr);
});

test("dry-run does not create an installation", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-skills-dry-"));
  const result = run(home, "install", "--target", "cursor", "--dry-run");
  assert.equal(result.status, 0, result.stderr);
  const listed = run(home, "list", "--target", "cursor", "--json");
  const output = JSON.parse(listed.stdout) as { installations: { skills: { state: string }[] }[] };
  assert.equal(output.installations[0]?.skills[0]?.state, "missing");
});

test("doctor reports a missing installation as unhealthy", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-skills-missing-"));
  const result = run(home, "doctor", "--target", "shared", "--json");
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stdout) as { healthy: boolean; installations: { skills: { state: string }[] }[] };
  assert.equal(output.healthy, false);
  assert.ok(output.installations[0]?.skills.every((skill) => skill.state === "missing"));
});

test("update retires an unchanged managed skill that is no longer packaged", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-skills-stale-"));
  assert.equal(run(home, "install", "--target", "shared").status, 0);

  const destination = path.join(home, ".agents", "skills");
  const manifestPath = path.join(destination, ".dotnet-agent-skills.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    skills: Record<string, unknown>;
  };
  const staleName = "retired-skill";
  const original = path.join(destination, "code-quality");
  const stale = path.join(destination, staleName);
  await rename(original, stale);
  manifest.skills[staleName] = manifest.skills["code-quality"];
  delete manifest.skills["code-quality"];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const update = run(home, "update", "--target", "shared");
  assert.equal(update.status, 0, update.stderr);
  await assert.rejects(readFile(path.join(stale, "SKILL.md"), "utf8"), { code: "ENOENT" });
  const updated = JSON.parse(await readFile(manifestPath, "utf8")) as { skills: Record<string, unknown> };
  assert.equal(staleName in updated.skills, false);
});

test("update preserves a locally modified stale skill unless force is confirmed", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-skills-stale-modified-"));
  assert.equal(run(home, "install", "--target", "shared").status, 0);

  const destination = path.join(home, ".agents", "skills");
  const manifestPath = path.join(destination, ".dotnet-agent-skills.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { skills: Record<string, unknown> };
  const staleName = "retired-skill";
  const stale = path.join(destination, staleName);
  await rename(path.join(destination, "code-quality"), stale);
  manifest.skills[staleName] = manifest.skills["code-quality"];
  delete manifest.skills["code-quality"];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(stale, "SKILL.md"), "locally edited stale skill\n", "utf8");

  const refused = run(home, "update", "--target", "shared");
  assert.equal(refused.status, 1);
  assert.equal(await readFile(path.join(stale, "SKILL.md"), "utf8"), "locally edited stale skill\n");

  const forced = run(home, "update", "--target", "shared", "--force", "--yes");
  assert.equal(forced.status, 0, forced.stderr);
  const backupRoot = path.join(home, ".agents", ".dotnet-agent-skills-backups");
  const backupBatches = await readdir(backupRoot);
  assert.equal(backupBatches.length, 1);
  assert.equal(
    await readFile(path.join(backupRoot, backupBatches[0]!, staleName, "SKILL.md"), "utf8"),
    "locally edited stale skill\n",
  );
});

test("uninstall refuses manifest skill names that can escape the destination", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-skills-traversal-"));
  const destination = path.join(home, ".agents", "skills");
  const outside = path.join(home, "outside");
  await mkdir(destination, { recursive: true });
  await mkdir(outside);
  await writeFile(path.join(outside, "keep.txt"), "keep\n", "utf8");
  await writeFile(path.join(destination, ".dotnet-agent-skills.json"), JSON.stringify({
    schemaVersion: 1,
    packageVersion: "test",
    skills: { "../../outside": { digest: "ignored", mode: "copy", source: null } },
  }), "utf8");

  const result = run(home, "uninstall", "--target", "shared", "--force", "--yes");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsafe skill name/);
  assert.equal(await readFile(path.join(outside, "keep.txt"), "utf8"), "keep\n");
});

test("an explicit project path equal to cwd still uses project scope and target layout", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-skills-project-home-"));
  const project = await mkdtemp(path.join(tmpdir(), "dotnet-agent-skills-project-"));
  const result = runAt(home, project, "install", "--target", "copilot", "--project", project);
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    await readFile(path.join(project, ".github", "skills", "code-quality", "SKILL.md"), "utf8"),
    /name: code-quality/,
  );
  await assert.rejects(readFile(path.join(home, ".copilot", "skills", "code-quality", "SKILL.md"), "utf8"), { code: "ENOENT" });
});

test("help works globally and after a command without creating an installation", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-skills-help-"));
  for (const args of [["--help"], ["install", "--help"]]) {
    const result = run(home, ...args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: dotnet-production-agent-skills/);
  }
  await assert.rejects(readFile(path.join(home, ".agents", "skills", ".dotnet-agent-skills.json"), "utf8"), {
    code: "ENOENT",
  });
});

test("multi-target update preflights every conflict before changing any target", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-skills-update-preflight-"));
  assert.equal(run(home, "install", "--target", "all").status, 0);

  const sharedSkill = path.join(home, ".agents", "skills", "code-quality");
  const claudeSkill = path.join(home, ".claude", "skills", "code-quality", "SKILL.md");
  await rm(sharedSkill, { recursive: true });
  await writeFile(claudeSkill, "locally edited\n", "utf8");

  const result = run(home, "update", "--target", "all");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not overwritten/);
  await assert.rejects(readFile(path.join(sharedSkill, "SKILL.md"), "utf8"), { code: "ENOENT" });
  assert.equal(await readFile(claudeSkill, "utf8"), "locally edited\n");
});

test("multi-target uninstall preflights every conflict before removing any target", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-skills-uninstall-preflight-"));
  assert.equal(run(home, "install", "--target", "all").status, 0);

  const sharedSkill = path.join(home, ".agents", "skills", "code-quality", "SKILL.md");
  const claudeSkill = path.join(home, ".claude", "skills", "code-quality", "SKILL.md");
  await writeFile(claudeSkill, "locally edited\n", "utf8");

  const result = run(home, "uninstall", "--target", "all");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not removed/);
  assert.match(await readFile(sharedSkill, "utf8"), /name: code-quality/);
  assert.equal(await readFile(claudeSkill, "utf8"), "locally edited\n");
});

test("reinstall skips unchanged skills and updates when packaged digest changes", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-idempotent-"));
  const fixture = await mkdtemp(path.join(repository, "package-fixture-"));
  try {
  await cp(path.join(repository, "skills"), path.join(fixture, "skills"), { recursive: true });
  await cp(path.join(repository, "copilot"), path.join(fixture, "copilot"), { recursive: true });
  await cp(path.join(repository, "dist", "src"), path.join(fixture, "dist", "src"), { recursive: true });
  await cp(path.join(repository, "package.json"), path.join(fixture, "package.json"));
  const fixtureCli = path.join(fixture, "dist", "src", "cli.js");
  const execute = (...args: string[]) => spawnSync(process.execPath, [fixtureCli, ...args], {
    cwd: repository, encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  assert.equal(execute("install", "--target", "shared").status, 0);
  const repeated = execute("install", "--target", "shared");
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.match(repeated.stdout, /skip\s+.*code-quality/);
  assert.doesNotMatch(repeated.stdout, /replace\s+/);
  const packagedSkill = path.join(fixture, "skills", "code-quality", "SKILL.md");
  await writeFile(packagedSkill, `${await readFile(packagedSkill, "utf8")}\nNew packaged guidance.\n`);
  const update = execute("update", "--target", "shared");
  assert.equal(update.status, 0, update.stderr);
  assert.match(update.stdout, /replace\s+.*code-quality/);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

test("forced uninstall backs up locally modified managed skills", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-uninstall-backup-"));
  assert.equal(run(home, "install", "--target", "shared").status, 0);
  const edited = path.join(home, ".agents", "skills", "code-quality", "SKILL.md");
  await writeFile(edited, "local edit\n");
  assert.equal(run(home, "uninstall", "--target", "shared").status, 1);
  const result = run(home, "uninstall", "--target", "shared", "--force", "--yes");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /backup\s+/);
  const backupRoot = path.join(home, ".agents", ".dotnet-agent-skills-backups");
  const [batch] = await readdir(backupRoot);
  assert.equal(await readFile(path.join(backupRoot, batch!, "code-quality", "SKILL.md"), "utf8"), "local edit\n");
});

test("Copilot managed instructions preserve user text through install, update and uninstall", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-copilot-home-"));
  const project = await mkdtemp(path.join(tmpdir(), "dotnet-agent-copilot-project-"));
  const file = path.join(project, ".github", "copilot-instructions.md");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "My team rules.\n");
  const args = ["--target", "copilot", "--project", project];
  const dry = runAt(home, project, "install", ...args, "--dry-run");
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(await readFile(file, "utf8"), "My team rules.\n");
  assert.equal(runAt(home, project, "install", ...args).status, 0);
  const first = await readFile(file, "utf8");
  assert.match(first, /My team rules\./);
  assert.match(first, /dotnet-production-agent-skills:start/);
  assert.equal(runAt(home, project, "install", ...args).status, 0);
  assert.equal(await readFile(file, "utf8"), first);
  await writeFile(file, first.replace("Understand the existing implementation", "Review the existing implementation"));
  assert.equal(runAt(home, project, "update", ...args).status, 0);
  assert.equal(await readFile(file, "utf8"), first);
  assert.equal(runAt(home, project, "doctor", ...args, "--json").status, 0);
  assert.equal(runAt(home, project, "uninstall", ...args).status, 0);
  assert.equal(await readFile(file, "utf8"), "My team rules.\n");
});

test("project all installs native hooks for every coding agent and Antigravity skills", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-hooks-home-"));
  const project = await mkdtemp(path.join(tmpdir(), "dotnet-agent-hooks-project-"));
  const result = runAt(home, project, "install", "--target", "all", "--project", project);
  assert.equal(result.status, 0, result.stderr);
  const configs = [
    ".codex/hooks.json",
    ".github/hooks/dotnet-production-agent-skills.json",
    ".claude/settings.json",
    ".cursor/hooks.json",
    ".agents/hooks.json",
  ];
  for (const config of configs) assert.match(await readFile(path.join(project, config), "utf8"), /guard\.mjs/);
  assert.match(await readFile(path.join(project, ".agents", "skills", "code-quality", "SKILL.md"), "utf8"), /name: code-quality/);
  const doctor = runAt(home, project, "doctor", "--target", "all", "--project", project, "--json");
  assert.equal(doctor.status, 0, doctor.stderr);
  const report = JSON.parse(doctor.stdout) as { hooks: { target: string; state: string }[] };
  assert.deepEqual(report.hooks.map((hook) => hook.target), ["codex", "copilot", "claude", "cursor", "antigravity"]);
  assert.ok(report.hooks.every((hook) => hook.state === "unchanged"));
});

test("hook install preserves unrelated host hooks and uninstall removes only managed entries", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-hook-merge-home-"));
  const project = await mkdtemp(path.join(tmpdir(), "dotnet-agent-hook-merge-project-"));
  const config = path.join(project, ".cursor", "hooks.json");
  await mkdir(path.dirname(config), { recursive: true });
  await writeFile(config, `${JSON.stringify({ version: 1, hooks: { afterFileEdit: [{ command: "custom-format" }] } }, null, 2)}\n`);
  const args = ["--target", "cursor", "--project", project];
  assert.equal(runAt(home, project, "install", ...args).status, 0);
  let installed = await readFile(config, "utf8");
  assert.match(installed, /custom-format/);
  assert.match(installed, /guard\.mjs cursor/);
  assert.equal(runAt(home, project, "uninstall", ...args).status, 0);
  installed = await readFile(config, "utf8");
  assert.match(installed, /custom-format/);
  assert.doesNotMatch(installed, /guard\.mjs/);
});

test("project hook dry-run creates no hook files", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-hook-dry-home-"));
  const project = await mkdtemp(path.join(tmpdir(), "dotnet-agent-hook-dry-project-"));
  const result = runAt(home, project, "install", "--target", "antigravity", "--project", project, "--dry-run");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /would install antigravity project hooks/);
  await assert.rejects(readFile(path.join(project, ".agents", "hooks.json"), "utf8"), { code: "ENOENT" });
  await assert.rejects(readFile(path.join(project, ".agent-guardrails", "guard.mjs"), "utf8"), { code: "ENOENT" });
});

test("all-target uninstall removes every managed hook configuration and shared script", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "dotnet-agent-hook-uninstall-home-"));
  const project = await mkdtemp(path.join(tmpdir(), "dotnet-agent-hook-uninstall-project-"));
  const args = ["--target", "all", "--project", project];
  assert.equal(runAt(home, project, "install", ...args).status, 0);
  assert.equal(runAt(home, project, "uninstall", ...args).status, 0);
  for (const config of [
    ".codex/hooks.json",
    ".github/hooks/dotnet-production-agent-skills.json",
    ".claude/settings.json",
    ".cursor/hooks.json",
    ".agents/hooks.json",
  ]) {
    const content = await readFile(path.join(project, config), "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    assert.doesNotMatch(content, /guard\.mjs|dotnet-production-agent-skills/);
  }
  await assert.rejects(readFile(path.join(project, ".agent-guardrails", "guard.mjs"), "utf8"), { code: "ENOENT" });
});

test("guardrail blocks destructive commands and sensitive files for every host", async () => {
  const guard = path.join(repository, "hooks", "guard.mjs");
  const cases = [
    ["codex", { tool_name: "Bash", tool_input: { command: "git push --force origin main" } }],
    ["copilot", { toolName: "bash", toolArgs: { command: "git reset --hard" } }],
    ["claude", { tool_name: "Read", tool_input: { file_path: "/repo/.env" } }],
    ["cursor", { tool_name: "Shell", tool_input: { command: "git clean -fd" } }],
    ["antigravity", { toolCall: { name: "run_command", args: { CommandLine: "rm -rf /" } } }],
  ] as const;
  for (const [host, payload] of cases) {
    const blocked = spawnSync(process.execPath, [guard, host], { input: JSON.stringify(payload), encoding: "utf8" });
    assert.equal(blocked.status, 0, blocked.stderr);
    assert.match(blocked.stdout, /deny/);
  }
  const allowed = spawnSync(process.execPath, [guard, "antigravity"], {
    input: JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine: "dotnet test" } } }), encoding: "utf8",
  });
  assert.match(allowed.stdout, /allow/);
});

test("doctor accepts multiline YAML frontmatter and rejects invalid metadata", async () => {
  const { validateSkills } = await import("../src/skills/validation.js");
  const root = await mkdtemp(path.join(tmpdir(), "dotnet-agent-yaml-"));
  const good = path.join(root, "good-skill");
  const bad = path.join(root, "bad-skill");
  await mkdir(good);
  await mkdir(bad);
  await writeFile(path.join(good, "SKILL.md"), "---\nname: good-skill\ndescription: >\n  Use when creating or modifying\n  ASP.NET Core APIs.\n---\n# Body\n");
  await writeFile(path.join(bad, "SKILL.md"), "---\nname: bad-skill\ndescription: [broken\n---\n# Body\n");
  assert.deepEqual(await validateSkills(root, ["good-skill"]), []);
  assert.match((await validateSkills(root, ["bad-skill"])).join(" "), /invalid YAML/);
});
