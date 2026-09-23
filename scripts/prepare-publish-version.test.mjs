import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resolver = path.join(repository, "scripts", "prepare-publish-version.mjs");

test("release tag overrides an already-published package.json version", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "dotnet-agent-release-"));
  await writeFile(path.join(fixture, "package.json"), JSON.stringify({
    name: "dotnet-production-agent-skills",
    version: "0.2.1",
  }, null, 2));
  await writeFile(path.join(fixture, "package-lock.json"), JSON.stringify({
    name: "dotnet-production-agent-skills",
    version: "0.2.1",
    lockfileVersion: 3,
    packages: { "": { name: "dotnet-production-agent-skills", version: "0.2.1" } },
  }, null, 2));
  const output = path.join(fixture, "github-output.txt");

  const result = spawnSync(process.execPath, [resolver], {
    cwd: fixture,
    encoding: "utf8",
    env: {
      ...process.env,
      EVENT_NAME: "release",
      RELEASE_TAG: "v0.3.0",
      DIST_TAG_INPUT: "",
      GITHUB_OUTPUT: output,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(output, "utf8"), /^version=0\.3\.0$/m);
  assert.match(await readFile(output, "utf8"), /^dist_tag=latest$/m);
  assert.equal(JSON.parse(await readFile(path.join(fixture, "package.json"), "utf8")).version, "0.3.0");
  const lock = JSON.parse(await readFile(path.join(fixture, "package-lock.json"), "utf8"));
  assert.equal(lock.version, "0.3.0");
  assert.equal(lock.packages[""].version, "0.3.0");
});

test("release events reject missing or invalid tags instead of falling back to package.json", async () => {
  for (const tag of ["", "release-0.3"]) {
    const fixture = await mkdtemp(path.join(tmpdir(), "dotnet-agent-release-invalid-"));
    await writeFile(path.join(fixture, "package.json"), JSON.stringify({ version: "0.2.1" }));
    const result = spawnSync(process.execPath, [resolver], {
      cwd: fixture,
      encoding: "utf8",
      env: { ...process.env, EVENT_NAME: "release", RELEASE_TAG: tag },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /RELEASE_TAG is required|Release tag must be semver/);
    assert.equal(JSON.parse(await readFile(path.join(fixture, "package.json"), "utf8")).version, "0.2.1");
  }
});
