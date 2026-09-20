---
name: safe-terminal
description: Run and recover from terminal commands safely, especially after malformed, corrupted, or unexpectedly failing CLI commands. Use for shell troubleshooting or commands that could affect tools, credentials, configuration, or data.
---

# Safe terminal

Before execution, verify the command, working directory, resolved target, quoting, and likely side effects. Prefer read-only inspection before mutation and narrow explicit paths over broad globs or unresolved variables.

## Automatic command correction

When a command is about to be executed or has just failed, detect and fix the problem **before** escalating to environment changes. Common causes include but are not limited to:

- **Control-character prefixes** — Agent hosts sometimes prepend `^Q` (XON), `^C`, `^M`, `^[`, or other stray bytes. For example `^Qgit add .` resolves to a nonexistent executable and the shell may search tool installation directories instead of running `git`. Strip the prefix, log what was removed, and re-execute.
- **Typos and misspellings** — `gti status`, `dontnet build`, `nmp install`. Map to the obvious intended command.
- **Wrong or missing flags** — `git commit` without `-m`, `dotnet test --filtre` instead of `--filter`.
- **Quoting and escaping errors** — Unmatched quotes, unescaped special characters, or shell-expansion issues.
- **Wrong working directory** — Command assumes a project root but the shell is in a subdirectory or vice versa.
- **Missing arguments** — Required positional arguments omitted.
- **Stale or incorrect paths** — File or directory references that do not exist or have moved.

In every case, correct only what is broken and preserve the original intent.

## Feedback loop

Follow a structured inspect → classify → correct → retry → verify cycle for every failure instead of retrying blindly or escalating to environment changes.

```text
┌──────────────────────────────────────────────────┐
│  1. INSPECT  — Read the exact command and error  │
│     ↓                                            │
│  2. CLASSIFY — Identify the single root cause:   │
│     control-char prefix? typo? quoting? flags?   │
│     wrong directory? missing arg? env problem?   │
│     ↓                                            │
│  3. CORRECT  — Fix only the identified cause     │
│     ↓                                            │
│  4. RETRY    — Execute the corrected command     │
│     ↓                                            │
│  5. VERIFY   — Did the retry succeed?            │
│     • YES → Continue with the task               │
│     • NO  → Return to step 1 with the new error  │
│             (max 3 iterations, then report)      │
└──────────────────────────────────────────────────┘
```

### Feedback-loop rules

- **At most 3 correction attempts** for the same logical command. After three failures, stop retrying and report the full error chain—each attempted command and its output—to the user.
- **Each iteration must identify a different root cause.** Retrying the same fix is not a correction.
- **Never escalate to environment mutation** (changing `PATH`, installing packages, editing shell profiles, modifying credentials) unless the loop conclusively shows a genuine environment gap **and** the user explicitly approves the change.
- **Preserve original intent.** If the corrected command differs in meaning from what was requested, confirm with the user before executing.

## Environment protection

Do not respond to malformed input by changing `PATH`, shell profiles, installations, credentials, authentication, or tool configuration. Require evidence and appropriate permission before any such change.

## Destructive-action safety

For destructive or hard-to-recover actions, resolve and display exact targets first, prefer a reversible operation, and obtain approval when scope is not already explicit. Never use a home directory, repository root, filesystem root, or an unvalidated variable as a recursive deletion target.
