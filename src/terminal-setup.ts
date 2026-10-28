import { createHash } from "node:crypto";
import { lstat, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonObject = Record<string, unknown>;
type Action = "install" | "update" | "skip" | "remove";
const SERVER = "dotnet-terminal";
const MARKER = ".dotnet-terminal-server.json";

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readObject(file: string): Promise<JsonObject | null> {
  let text;
  try { text = await readFile(file, "utf8"); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (!object(parsed)) throw new Error("root must be an object");
    return parsed;
  } catch { throw new Error(`Invalid terminal server configuration preserved: ${file}`); }
}

// Object key ordering and whitespace do not turn an otherwise unchanged server
// into a conflict. Arrays retain order because executable arguments are ordered.
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function servers(config: JsonObject): JsonObject {
  if (config.mcpServers === undefined) {
    const bareServers = Object.values(config).some(value => object(value)
      && ["command", "url", "type"].some(key => typeof value[key] === "string"));
    if (bareServers) {
      throw new Error("Bare top-level MCP server configuration preserved. Integrate dotnet-terminal manually or explicitly convert existing servers to mcpServers before setup; mixing formats may hide existing servers.");
    }
    return {};
  }
  if (!object(config.mcpServers)) throw new Error("Invalid mcpServers configuration preserved; expected an object.");
  return config.mcpServers;
}

function markerDigest(marker: JsonObject | null): string | null {
  if (marker === null) return null;
  if (marker.schemaVersion !== 1 || typeof marker.digest !== "string" || !/^[a-f0-9]{64}$/.test(marker.digest)
    || Object.keys(marker).some(key => !["schemaVersion", "digest"].includes(key))) {
    throw new Error("Invalid terminal server ownership marker preserved; review .dotnet-terminal-server.json.");
  }
  return marker.digest;
}

function expected(projectRoot: string, packageRoot: string): JsonObject {
  return {
    type: "stdio",
    command: process.execPath,
    args: [path.resolve(packageRoot, "dist", "src", "cli.js"), "terminal", "serve", "--project", path.resolve(projectRoot)],
    tools: ["run_process"],
  };
}

async function entrypointExists(entry: unknown): Promise<boolean> {
  if (!object(entry) || !Array.isArray(entry.args) || typeof entry.args[0] !== "string") return false;
  try { return (await lstat(entry.args[0])).isFile(); }
  catch { return false; }
}

export async function inspectTerminalServer(projectRoot: string): Promise<{
  path: string;
  state: "missing" | "unmanaged" | "unchanged" | "modified" | "malformed";
  entrypointExists: boolean;
  activation: "unknown";
}> {
  const file = path.resolve(projectRoot, ".mcp.json");
  try {
    const config = await readObject(file) ?? {};
    const entry = servers(config)[SERVER];
    const recorded = markerDigest(await readObject(path.resolve(projectRoot, MARKER)));
    const state = entry === undefined ? recorded === null ? "missing" : "modified"
      : recorded === null ? "unmanaged" : digest(entry) === recorded ? "unchanged" : "modified";
    return { path: file, state, entrypointExists: await entrypointExists(entry), activation: "unknown" };
  } catch { return { path: file, state: "malformed", entrypointExists: false, activation: "unknown" }; }
}

export async function changeTerminalServer(projectRoot: string, packageRoot: string, action: "install" | "uninstall", dryRun: boolean): Promise<{ action: Action; path: string }> {
  const project = path.resolve(projectRoot);
  const file = path.join(project, ".mcp.json");
  const markerFile = path.join(project, MARKER);
  if (!(await lstat(project)).isDirectory()) throw new Error("Terminal server project must be an existing directory.");
  const config = await readObject(file) ?? {};
  const existingServers = servers(config);
  const current = existingServers[SERVER];
  const canonical = expected(project, packageRoot);
  const recorded = markerDigest(await readObject(markerFile));
  if (recorded !== null && (current === undefined || recorded !== digest(current))) {
    throw new Error(`Modified terminal server configuration preserved: ${file}. Review its ownership marker before retrying.`);
  }
  if (current !== undefined && recorded === null && stable(current) !== stable(canonical)) {
    throw new Error(`Unmanaged terminal server configuration preserved: ${file}. Choose a separate server name or integrate manually.`);
  }
  if (action === "uninstall") {
    if (current === undefined) return { action: "skip", path: file };
    const retained = { ...existingServers };
    delete retained[SERVER];
    const next = { ...config };
    if (Object.keys(retained).length) next.mcpServers = retained;
    else delete next.mcpServers;
    if (!dryRun) {
      if (Object.keys(next).length) await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      else await rm(file, { force: true });
      if (recorded !== null) await rm(markerFile, { force: true });
    }
    return { action: "remove", path: file };
  }
  if (!await entrypointExists(canonical)) throw new Error("Terminal server entrypoint is unavailable; build or reinstall the package before setup.");
  const identical = current !== undefined && stable(current) === stable(canonical);
  if (identical && recorded !== null) return { action: "skip", path: file };
  if (!dryRun) {
    await writeFile(file, `${JSON.stringify({ ...config, mcpServers: { ...existingServers, [SERVER]: canonical } }, null, 2)}\n`, "utf8");
    await writeFile(markerFile, `${JSON.stringify({ schemaVersion: 1, digest: digest(canonical) }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }
  return { action: current === undefined ? "install" : "update", path: file };
}
