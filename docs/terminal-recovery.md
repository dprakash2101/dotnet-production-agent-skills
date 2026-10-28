# Terminal recovery runtime

The package provides terminal diagnosis and recovery feedback across command ecosystems. The host remains responsible for permissions and loading hooks. No live Copilot or Windows host was available for validation.

## Direct execution setup

```sh
dotnet-production-agent-skills terminal setup --project "/path/to/project"
dotnet-production-agent-skills terminal capabilities --project "/path/to/project"
```

Setup adds an owned `dotnet-terminal` server to portable `.mcp.json`, with an absolute Node executable and package entrypoint. Copilot CLI and supported VS Code Copilot harnesses can load this format. Confirm server trust and `run_process` availability in the host. No auto-approval settings are written. The package must remain available at that path; rerun setup when its installation path changes. Preview with `--dry-run`; remove with `terminal remove --project PATH`. Both preserve unrelated servers and reject customized managed entries.

`run_process` accepts JSON such as `{"executable":"git","args":["status"],"cwd":"."}`. The host starts a stdio server and the server spawns the requested process directly, bypassing interactive terminal typing entirely. After observed or suspected transport corruption, session hooks reject further terminal submissions when this owned server configuration is present and its entrypoints exist, and direct the agent to this tool. Configuration readiness does not prove activation; unavailable tools remain explicit integration blockers.

The MCP server implements the 2025-11-25 handshake protocol, not every MCP revision. It bounds input and capture, executes at most one process at a time, and rejects selected directories escaping the pinned workspace, including symlink escapes. Directory confinement is not a filesystem sandbox: invoked processes inherit the server's permissions. Existing best-effort command policy is checked before spawn. Host authorization remains required.

## Components

- `hooks/diagnosis.mjs`: pure bounded evidence classification. Returns category, confidence, fixed-label evidence, next action, message, and conservative retry safety. It never executes corrections or copies raw evidence into its messages.
- `hooks/session-state.mjs`: optional session-scoped retry history in the OS temporary directory. Stores hashes rather than command text, output, paths, or session IDs. Entries expire after 24 hours; physical cleanup is bounded and best effort. Locks and atomic writes protect concurrent hooks. At most 64 fingerprints are retained per session. Missing session IDs and unavailable storage degrade without blocking commands.
- `hooks/guard.mjs`: normalizes host payloads, applies pre-command checks, sends Copilot recovery context, and rejects unchanged failed attempts until relevant diagnostics succeed. Authoritative success clears a matching failure. Native successful diagnostic responses require positive directory/executable evidence rather than assuming tool success means process success.
- `terminal capabilities`: reports local runtime, configuration structure, configured events, and explicit unknowns for activation, host schema support, and terminal execution evidence. Finding files does not prove a host loaded them.
- `terminal diagnose --input evidence.json`: diagnoses a JSON evidence object without running its contents.
- `terminal serve --project PATH`: JSON-RPC stdio server exposing direct `run_process`, with structured arguments, process lifecycle handling, and destructive-tool annotations.
- `terminal run --project PATH -- EXECUTABLE ARGS...`: explicit process execution with `shell:false`, bounded capture, timeout handling, actual exit status, and diagnosis. It never retries automatically.

## Evidence example

```json
{
  "command": "git status",
  "submittedCommand": "git status",
  "executedCommand": "^Ugit status",
  "shell": "powershell",
  "error": "^Ugit: command not found"
}
```

This supports a transport-corruption diagnosis because execution identity differs in a recognized corruption pattern and the shell reports resolution failure. A displayed `^U` by itself does not establish that diagnosis. Never invent executed-command evidence. A numeric `exitCode` supplied to the diagnosis engine must be authoritative process evidence, not an inferred tool-success status.

## Recovery decisions

| Evidence | Response |
| --- | --- |
| Confirmed process exit 0 | Verify result; ignore cosmetic interruption markers. |
| Known submitted/executed mismatch plus resolution error | Investigate terminal transport; preserve intended operation. |
| Missing project manifest or repository context | Verify intended workspace/package directory. |
| Executable-resolution error | Inspect resolution in the failing environment. |
| Shell parser diagnostic | Verify shell and correct only supported syntax. |
| Tool-specific build/test/service error | Investigate the application error. |
| Timeout, interruption, mismatched execution, unknown completion | Verify result before repeating possible side effects. |
| Insufficient evidence | Collect evidence instead of guessing. |

Pre-command retry blocking is an aid against loops, not a security boundary. The fingerprint is exact and an altered command is a new attempt. A successful narrow read-only diagnostic allows fresh investigation; it does not prove the original error was fixed. No state is shared across unrelated sessions or project roots.

## Boundaries

Native hook payloads vary. Copilot tool results can contain text without structured shell exit evidence; hooks must not mistake tool-return success for command success. Verified transport comparison is available only when the host supplies executed-command evidence. This package does not install a VS Code extension, observe PTY bytes, or repair terminal transport itself. Its MCP execution path avoids that transport instead. The explicit runner avoids interactive input handling for commands routed through it.

The shell-free runner does not interpret pipes, redirects, shell builtins, aliases, profiles, or Windows `.cmd`/`.bat` launchers. Use an already verified interpreter and script where appropriate; do not guess installation paths or silently switch to shell mode. Captured output is returned to the caller and can contain application secrets; it is not persisted in retry state. Timeout handling bounds the runner and reports possible remaining descendants rather than claiming a process tree was terminated.

Optional editor-side execution evidence remains a separate adapter requiring live host validation. VS Code exposes shell integration execution events, but availability and confidence vary. Host configuration and process observations are reported separately throughout this runtime.

## Research basis

- [VS Code report: extra `^U` characters and incorrect agent recovery](https://github.com/microsoft/vscode/issues/320947).
- [VS Code report: displayed interruption despite successful command](https://github.com/microsoft/vscode/issues/311217).
- [VS Code report: missing first command character](https://github.com/microsoft/vscode/issues/274234).
- [VS Code shell integration and detection quality](https://code.visualstudio.com/docs/terminal/shell-integration).
- [Copilot project MCP configuration](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers).
- [VS Code portable MCP configuration](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).
- [Copilot hook events and feedback contracts](https://docs.github.com/en/copilot/reference/hooks-reference).
- [VS Code terminal execution API](https://code.visualstudio.com/api/references/vscode-api).

Reports motivate test scenarios; they do not establish the cause of every similar failure.
