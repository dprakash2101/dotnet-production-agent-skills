---
name: safe-terminal
description: Run and recover from terminal commands safely, especially after malformed, corrupted, unexpectedly failing, or unavailable CLI commands. Use for shell troubleshooting or commands that could affect tools, credentials, configuration, or data.
---

# Safe terminal

Before execution, verify the command, shell, working directory, resolved target, quoting, and likely side effects. Prefer read-only inspection before mutation and narrow explicit paths over broad globs or unresolved variables.

## Inspect what the shell actually ran

When a command fails, compare the submitted text, the command displayed by the terminal, and the executable named in the error. A copied command can contain invisible bytes or terminal control sequences, while the shell or tool host may strip or interpret them before execution. A caret rendering such as `^X` is a clue to inspect, not proof that it reached the shell as part of the executable name.

- If a leading or embedded control character, escape sequence, pasted prompt, line break, or malformed token **survived into the executable or arguments**, reconstruct a clean command from the intended tokens. Show the meaningful correction and retry once.
- If the error names the expected executable, do not claim a prefix caused the failure merely because the submitted text contains one. Diagnose that executable's availability in the actual shell and process environment.
- Treat multiple visible anomalies independently. Removing one does not establish that the next failure has the same cause.

Check typos, flags, quoting, shell-specific syntax, working directory, paths, and missing arguments only where the command or output supports them. Preserve the user's requested operation and options; do not drop build, restore, test, or safety flags just to make the command run.

## Diagnose an unavailable executable

For a command-not-found error, use read-only checks in the **same shell/session** that failed. In PowerShell, use `Get-Command <name> -All` and, where useful, `where.exe <name>`; in cmd use `where <name>`; in POSIX shells use `command -v <name>`. Check the current `PATH` without printing credentials or unrelated environment values. If the tool is found, distinguish a typo or wrong shell from an executable that is present but absent from that process's `PATH`. If it is not found, report that the tool is unavailable in this environment; do not guess its installation path or repeatedly run the same command.

Use an already configured shell or approved tool runner when it resolves the issue without changing project configuration. Do not respond to a malformed command by installing software, editing `PATH` or shell profiles, changing credentials, or changing tool configuration. Require evidence and appropriate authorization for environment changes.

## Correct, retry, verify

1. Inspect the exact attempted command and first actionable error; distinguish shell parsing, executable lookup, and tool-level failure.
2. Make the smallest evidence-based correction. State what changed when it is material.
3. Retry only if the cause is corrected and the original operation is authorized. Check the new output as a new failure, rather than assuming the previous diagnosis still applies.
4. Stop after a bounded number of distinct corrections (at most three for the same logical command). Report the unresolved blocker and the relevant checks without dumping secrets or verbose logs.

Never silently substitute a different operation. Ask before a correction changes the requested result or has new side effects.

## Destructive-action safety

For destructive or hard-to-recover actions, resolve and display exact targets first, prefer a reversible operation, and obtain approval when scope is not already explicit. Never use a home directory, repository root, filesystem root, or an unvalidated variable as a recursive deletion target.
