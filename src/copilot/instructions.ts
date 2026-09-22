import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const start = "<!-- dotnet-production-agent-skills:start -->";
const end = "<!-- dotnet-production-agent-skills:end -->";
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../copilot/production-instructions.md");

export type InstructionState = "missing" | "unmanaged" | "unchanged" | "outdated" | "malformed";

export async function instructionsPath(base: string): Promise<string> {
  return path.join(base, ".github", "copilot-instructions.md");
}

async function optionalRead(file: string): Promise<string | null> {
  try { return await readFile(file, "utf8"); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function section(text: string): { from: number; to: number } | null {
  const from = text.indexOf(start);
  const closing = text.indexOf(end);
  if ((from < 0) !== (closing < 0) || (from >= 0 && (closing < from || text.indexOf(start, from + start.length) >= 0 || text.indexOf(end, closing + end.length) >= 0))) {
    throw new Error("malformed managed Copilot instructions section");
  }
  return from < 0 ? null : { from, to: closing + end.length };
}

export async function inspectInstructions(base: string): Promise<{ path: string; state: InstructionState }> {
  const file = await instructionsPath(base);
  const existing = await optionalRead(file);
  if (existing === null) return { path: file, state: "missing" };
  let bounds;
  try { bounds = section(existing); }
  catch { return { path: file, state: "malformed" }; }
  if (!bounds) return { path: file, state: "unmanaged" };
  const canonical = (await readFile(source, "utf8")).trim();
  const managed = existing.slice(bounds.from + start.length, bounds.to - end.length).trim();
  return { path: file, state: managed === canonical ? "unchanged" : "outdated" };
}

export async function changeInstructions(base: string, operation: "install" | "uninstall", dryRun: boolean): Promise<string> {
  const file = await instructionsPath(base);
  const existing = await optionalRead(file);
  const bounds = section(existing ?? "");
  if (operation === "uninstall") {
    if (!bounds || existing === null) return "skip";
    const remaining = `${existing.slice(0, bounds.from).trimEnd()}${existing.slice(bounds.to).trimStart()}`.trim();
    if (!dryRun) {
      if (remaining) await writeFile(file, `${remaining}\n`, "utf8");
      else await rm(file);
    }
    return "remove";
  }
  const canonical = (await readFile(source, "utf8")).trim();
  const managed = `${start}\n${canonical}\n${end}`;
  const next = bounds && existing !== null
    ? `${existing.slice(0, bounds.from)}${managed}${existing.slice(bounds.to)}`
    : `${existing?.trimEnd() ? `${existing.trimEnd()}\n\n` : ""}${managed}\n`;
  if (next === existing) return "skip";
  if (!dryRun) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, next, "utf8");
  }
  return bounds ? "update" : "install";
}
