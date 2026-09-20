#!/usr/bin/env node

/**
 * Resolve and apply the package version for npm publish CI.
 *
 * Env:
 *   EVENT_NAME     release | workflow_dispatch | ...
 *   RELEASE_TAG    GitHub release tag (e.g. v1.2.3) when EVENT_NAME=release
 *   BUMP           patch | minor | major | prerelease (workflow_dispatch)
 *   PREID          prerelease identifier (default: beta)
 *   GITHUB_OUTPUT  optional; writes version= and dist_tag=
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const PACKAGE_JSON = path.resolve("package.json");
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function readPackage() {
  return JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
}

function writePackage(pkg) {
  writeFileSync(PACKAGE_JSON, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
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

function defaultDistTag(version) {
  const match = version.match(SEMVER);
  const prerelease = match?.[4];
  if (!prerelease) return "latest";
  const id = prerelease.split(".")[0] ?? "next";
  if (id === "beta" || id === "next" || id === "alpha" || id === "rc") return id;
  return "next";
}

function appendOutput(version, distTag) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) {
    console.log(JSON.stringify({ version, dist_tag: distTag }));
    return;
  }
  writeFileSync(output, `version=${version}\ndist_tag=${distTag}\n`, { flag: "a" });
}

function main() {
  const eventName = process.env.EVENT_NAME ?? "";
  let version;

  if (eventName === "release") {
    version = normalizeReleaseTag(process.env.RELEASE_TAG);
    const current = readPackage().version;
    if (current !== version) {
      console.log(`Aligning package.json version ${current} -> ${version} from release tag`);
      const pkg = readPackage();
      pkg.version = version;
      writePackage(pkg);
      // Keep package-lock.json in sync when present.
      spawnSync("npm", ["install", "--package-lock-only", "--ignore-scripts"], {
        encoding: "utf8",
        stdio: "inherit",
      });
    } else {
      console.log(`package.json already at release version ${version}`);
    }
  } else if (eventName === "workflow_dispatch") {
    const bump = (process.env.BUMP ?? "patch").trim();
    const allowed = new Set(["patch", "minor", "major", "prerelease"]);
    if (!allowed.has(bump)) {
      throw new Error(`Unsupported BUMP '${bump}'. Expected: ${[...allowed].join(", ")}`);
    }
    const before = readPackage().version;
    if (bump === "prerelease") {
      const preid = (process.env.PREID ?? "beta").trim() || "beta";
      version = npmVersion(["prerelease", `--preid=${preid}`]);
    } else {
      version = npmVersion([bump]);
    }
    console.log(`Bumped package version ${before} -> ${version} (${bump})`);
  } else {
    throw new Error(`Unsupported EVENT_NAME '${eventName}' for version preparation`);
  }

  if (!SEMVER.test(version)) {
    throw new Error(`Resolved version is not valid semver: ${version}`);
  }

  const requestedTag = (process.env.DIST_TAG_INPUT ?? "").trim();
  const distTag = requestedTag || defaultDistTag(version);
  appendOutput(version, distTag);
  console.log(`Publish version=${version} dist_tag=${distTag}`);
}

try {
  main();
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
