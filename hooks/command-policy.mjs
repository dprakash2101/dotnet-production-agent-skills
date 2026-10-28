// Shared best-effort policy for terminal hooks and direct process execution.
// Pure checks: never evaluates or executes command input.
import path from "node:path";

const checks = [
  [/(?:^|[\n;&|])\s*(?:\^U|\u0015)\s*(?=\S)/, "Incorrect command: a Ctrl+U marker was prepended. Follow safe-terminal: remove the marker and retry the intended command once as plain text from the verified project working directory. Do not move into the Git or dotnet installation directory, guess executable paths, or change PATH to recover."],
  [/\bgit\s+(?:(?:-C|--git-dir|--work-tree|-c)\s+(?:"[^"]*"|'[^']*'|\S+)\s+)*(?:push)\b[^\n;&|]*(?:--force(?:-with-lease)?|-f)\b/i, "Force-push is blocked. Use a normal push or request explicit human approval."],
  [/\bgit\s+(?:(?:-C|--git-dir|--work-tree|-c)\s+(?:"[^"]*"|'[^']*'|\S+)\s+)*(?:reset\b[^\n;&|]*--hard\b|clean\s+-[^\s]*f[^\s]*|branch\s+-D(?:\s|$))/i, "Destructive Git operations are blocked. Preserve work and request explicit human approval."],
  [/(?:^|[;&|]\s*)rm\s+-(?=[a-z]*r)(?=[a-z]*f)[a-z]+\s+["']?(?:\/|~|\$HOME)(?:["']?)(?:\s|$)/i, "Recursive deletion of a broad system or home path is blocked."],
  [/(?:^|[;&|]\s*)Remove-Item\b(?=[^\n;&|]*-Recurse\b)(?=[^\n;&|]*-Force\b)[^\n;&|]*["']?(?:\$env:USERPROFILE|\$HOME|~|\/)(?:["']?)(?:\s|$)/i, "Recursive deletion of a broad system or home path is blocked."],
  [/\b(?:cat|type|Get-Content|more|less|head|tail)\s+[^\n;&|]*(?:\.env(?:\.(?!example\b)[\w.-]+)?(?:["'\s]|$)|id_(?:rsa|ed25519)|\.pem\b|\.pfx\b|secrets\.json\b)/i, "Reading credential-bearing files through the shell is blocked."],
];

const sensitivePath = /(?:^|\/)(?:\.env(?:\.(?!example$)[^/]*)?|id_(?:rsa|ed25519)|[^/]*\.(?:pem|pfx)|secrets\.json)$/i;

export function evaluateCommand({ command = "", file = "" } = {}) {
  if (sensitivePath.test(String(file).replaceAll("\\", "/"))) return "Direct access to a credential-bearing file is blocked.";
  return checks.find(([pattern]) => pattern.test(String(command)))?.[1] ?? "";
}

export function evaluateProcess(executable, args = []) {
  const name = path.win32.basename(path.posix.basename(executable)).replace(/\.exe$/i, "");
  // This representation is inspected only; it is never passed to a shell.
  const token = value => /^[a-zA-Z0-9_./:\\=$~-]+$/.test(value) ? value : JSON.stringify(value);
  return evaluateCommand({ command: [name, ...args.map(token)].join(" ") });
}
