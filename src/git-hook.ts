import { spawnSync } from "node:child_process";
import { chmod, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function installGitHook(project: string, packageRoot: string, dryRun: boolean): Promise<string> {
  const result = spawnSync("git", ["rev-parse", "--git-path", "hooks/commit-msg"], { cwd: project, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || "Git repository required for git-hook.");
  const destination = path.resolve(project, result.stdout.trim());
  const source = await readFile(path.join(packageRoot, "hooks", "commit-msg"), "utf8");
  let exists = false;
  try {
    const entry = await lstat(destination);
    exists = true;
    if (!entry.isFile() || await readFile(destination, "utf8") !== source) {
      throw new Error(`Existing commit-msg hook preserved at ${destination}. Integrate the packaged hooks/commit-msg check into your hook manager manually.`);
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  if (dryRun) return `would ${exists ? "verify" : "install"} commit-msg hook: ${destination}`;
  if (!exists) {
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, source, { flag: "wx", mode: 0o755 });
  }
  await chmod(destination, 0o755);
  return `${exists ? "verified" : "installed"} commit-msg hook: ${destination}`;
}
