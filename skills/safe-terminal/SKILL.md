---
name: safe-terminal
description: Apply before terminal or Git execution and when recovering from malformed commands, executable lookup failures, wrong working directories, or shell errors. Preserve repository context, diagnose the actual error, and prevent speculative installation-path or environment workarounds.
---

# Safe terminal

Before execution, verify the command, shell, working directory, resolved target, quoting, and likely side effects. Prefer read-only inspection before mutation and narrow explicit paths over broad globs or unresolved variables.

## Keep executable location separate from repository context

Keep the working directory anchored to the user's project. The directory containing `git.exe`, a shell executable, or other CLI binaries is **not** the repository. Never `cd` into a tool installation directory or set the terminal tool's `cwd`/`workdir` there to recover a project command. Never use Git's installation directory as `git -C`, `--git-dir`, or `--work-tree`.

- Use the terminal tool's explicit working-directory parameter when available. Otherwise use shell-correct navigation to the verified project path and stop if navigation fails. Do not assume a previous terminal call's `cd` persists.
- For Git repository operations, establish the intended project from workspace/task evidence, then verify `git -C "<project-path>" rev-parse --show-toplevel`. Confirm that the returned root is the intended repository before mutation; a successful command in an unrelated repository is not success. Allow a subdirectory or linked worktree; do not require `.git` to be a directory.
- If a command fails with “not a git repository,” Git already started. Investigate the project path and repository context, not installation or `PATH`. If the root is unknown or ambiguous, stop and ask for the project location; do not search installation folders, initialize a repository, or guess another checkout.
- A resolved absolute executable path may be used only after same-session lookup establishes a genuine executable-resolution problem. Invoke that binary **from the project directory**, retain the requested arguments, and use the actual shell's quoting/invocation syntax. Do not confuse invoking an installed binary with running a project command from its installation folder.
- If an explicit project path still selects an unexpected repository, inspect only relevant overrides (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR`), without dumping the environment. Do not clear them, set replacement overrides, or edit configuration without understanding their purpose and obtaining authorization where required.

## Inspect what the shell actually ran

When a command fails, compare the submitted text, the command displayed by the terminal, and the executable named in the error. A copied command can contain invisible bytes or terminal control sequences, while the shell or tool host may strip or interpret them before execution. A caret rendering such as `^X` is a clue to inspect, not proof that it reached the shell as part of the executable name.

- If a leading or embedded control character, escape sequence, pasted prompt, line break, or malformed token **survived into the executable or arguments**, reconstruct a clean command from the intended tokens. Show the meaningful correction and retry once.
- If the error names the expected executable, do not claim a prefix caused the failure merely because the submitted text contains one. Diagnose that executable's availability in the actual shell and process environment.
- Treat multiple visible anomalies independently. Removing one does not establish that the next failure has the same cause.

Check typos, flags, quoting, shell-specific syntax, working directory, paths, and missing arguments only where the command or output supports them. Preserve the user's requested operation and options; do not drop build, restore, test, or safety flags just to make the command run.

Submit plain command text. Do not prepend terminal keyboard shortcuts, control bytes, escape sequences, or copied prompt text to clear or repair a command line. If submitted and executed text differ repeatedly, inspect the terminal/tool transport or report that blocker; do not keep adding control sequences.

## Diagnose an unavailable executable

For a command-not-found error, use read-only checks in the **same shell/session** that failed. In PowerShell, use `Get-Command <name> -All` and, where useful, `where.exe <name>`; in cmd use `where <name>`; in POSIX shells use `command -v <name>`. Check the current `PATH` without printing credentials or unrelated environment values. If the tool is found, distinguish a typo or wrong shell from an executable that is present but absent from that process's `PATH`. If it is not found, report that the tool is unavailable in this environment; do not guess its installation path or repeatedly run the same command.

Use an already configured shell or approved tool runner only when evidence shows it resolves the issue without changing project configuration; preserve and reverify the project directory in that environment. Do not switch shells just to bypass a parsing error, execution policy, or approval. Do not respond to a malformed command by installing software, editing `PATH` or shell profiles, changing credentials, or changing tool configuration. Require evidence and appropriate authorization for environment changes.

Use [shell recovery examples](references/shell-recovery.md) when choosing shell-specific diagnostics or distinguishing executable lookup from repository/path failures.

## Correct, retry, verify

1. Inspect the exact attempted command and first actionable error; distinguish shell parsing, executable lookup, and tool-level failure.
2. Make the smallest evidence-based correction. State what changed when it is material.
3. Retry only if the cause is corrected and the original operation is authorized. Check the new output as a new failure, rather than assuming the previous diagnosis still applies.
4. Stop after a bounded number of distinct corrections (at most three for the same logical command). Report the unresolved blocker and the relevant checks without dumping secrets or verbose logs.

Never silently substitute a different operation. Ask before a correction changes the requested result or has new side effects.

## Destructive-action safety

For destructive or hard-to-recover actions, resolve and display exact targets first, prefer a reversible operation, and obtain approval when scope is not already explicit. Never use a home directory, repository root, filesystem root, or an unvalidated variable as a recursive deletion target.
