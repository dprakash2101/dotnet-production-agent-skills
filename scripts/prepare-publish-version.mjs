#!/usr/bin/env node

/**
 * Resolve and apply the package version for npm publish CI.
 *
 * Env:
 *   EVENT_NAME     release | workflow_dispatch | ...
 *   RELEASE_TAG    GitHub release tag (e.g. v1.2.3) when EVENT_NAME=release
 *   BUMP           keep | patch | minor | major | prerelease (workflow_dispatch)
 *   PREID          prerelease identifier (default: beta)
 *   DIST_TAG_INPUT optional npm dist-tag override
 *   GITHUB_OUTPUT  optional; writes version=, dist_tag=, changed=
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const PACKAGE_JSON = path.resolve("package.json");
const PACKAGE_LOCK = path.resolve("package-lock.json");
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readPackage() {
  return readJson(PACKAGE_JSON);
}

function writePackage(pkg) {
  writeJson(PACKAGE_JSON, pkg);
}

function normalizeReleaseTag(tag) {
  const raw = String(tag ?? "").trim();
  if (!raw) throw new Error("RELEASE_TAG is required for release events");
  const version = raw.startsWith("v") ? raw.slice(1) : raw;
  if (!SEMVER.test(version)) {
    throw new Error(`Release tag must be semver (optionally prefixed with v), got: ${raw}`);
  }
  return version;
}

function npmVersion(args) {
  const result = spawnSync("npm", ["version", ...args, "--no-git-tag-version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "npm version failed").trim());
  }
  return readPackage().version;
}

/**
 * The release tag is the source of truth for release events. package.json is
 * the source of truth only for workflow_dispatch. Align package-lock.json to
 * the resolved publish version without an additional semver bump.
 */
function syncLockfile(version) {
  if (!existsSync(PACKAGE_LOCK)) return false;

  const lock = readJson(PACKAGE_LOCK);
  let changed = false;

  if (lock.version !== version) {
    console.log(`Aligning package-lock.json version ${lock.version ?? "(missing)"} -> ${version}`);
    lock.version = version;
    changed = true;
  }

  if (lock.packages && typeof lock.packages === "object") {
    const root = lock.packages[""];
    if (root && typeof root === "object" && root.version !== version) {
      console.log(
        `Aligning package-lock.json packages[""].version ${root.version ?? "(missing)"} -> ${version}`,
      );
      root.version = version;
      changed = true;
    }
  }

  if (changed) writeJson(PACKAGE_LOCK, lock);
  return changed;
}

function defaultDistTag(version) {
  const match = version.match(SEMVER);
  const prerelease = match?.[4];
  if (!prerelease) return "latest";
  const id = prerelease.split(".")[0] ?? "next";
  if (id === "beta" || id === "next" || id === "alpha" || id === "rc") return id;
  return "next";
}

function appendOutput(version, distTag, changed) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) {
    console.log(JSON.stringify({ version, dist_tag: distTag, changed }));
    return;
  }
  writeFileSync(
    output,
    `version=${version}\ndist_tag=${distTag}\nchanged=${changed ? "true" : "false"}\n`,
    { flag: "a" },
  );
}

function main() {
  const eventName = process.env.EVENT_NAME ?? "";
  let version;
  let changed = false;

  if (eventName === "release") {
    version = normalizeReleaseTag(process.env.RELEASE_TAG);
    const current = readPackage().version;
    if (current !== version) {
      console.log(`Aligning package.json version ${current} -> ${version} from release tag`);
      const pkg = readPackage();
      pkg.version = version;
      writePackage(pkg);
      changed = true;
    } else {
      console.log(`Keeping package.json version ${version}`);
    }
    if (syncLockfile(version)) changed = true;
  } else if (eventName === "workflow_dispatch") {
    const bump = (process.env.BUMP ?? "patch").trim();
    const allowed = new Set(["keep", "patch", "minor", "major", "prerelease"]);
    if (!allowed.has(bump)) {
      throw new Error(`Unsupported BUMP '${bump}'. Expected: ${[...allowed].join(", ")}`);
    }

    if (bump === "keep") {
      version = readPackage().version;
      if (!SEMVER.test(version)) {
        throw new Error(`package.json version is not valid semver: ${version}`);
      }
      console.log(`Keeping current package.json version ${version}`);
      if (syncLockfile(version)) changed = true;
    } else {
      const before = readPackage().version;
      if (bump === "prerelease") {
        const preid = (process.env.PREID ?? "beta").trim() || "beta";
        version = npmVersion(["prerelease", `--preid=${preid}`]);
      } else {
        version = npmVersion([bump]);
      }
      changed = true;
      console.log(`Bumped package version ${before} -> ${version} (${bump})`);
      // npm version normally updates the lockfile; still reconcile drift.
      if (syncLockfile(version)) changed = true;
    }
  } else {
    throw new Error(`Unsupported EVENT_NAME '${eventName}' for version preparation`);
  }

  if (!SEMVER.test(version)) {
    throw new Error(`Resolved version is not valid semver: ${version}`);
  }

  const requestedTag = (process.env.DIST_TAG_INPUT ?? "").trim();
  const distTag = requestedTag || defaultDistTag(version);
  appendOutput(version, distTag, changed);
  console.log(`Publish version=${version} dist_tag=${distTag} changed=${changed}`);
}

try {
  main();
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
