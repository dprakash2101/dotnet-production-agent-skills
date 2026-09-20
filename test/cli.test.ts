import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
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
    assert.match(result.stdout, /Usage: dotnet-agent-skills/);
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
