---
name: safe-terminal
description: Run and recover from terminal commands safely, especially after malformed, corrupted, or unexpectedly failing CLI commands. Use for shell troubleshooting or commands that could affect tools, credentials, configuration, or data.
---

# Safe terminal

Before execution, verify the command, working directory, resolved target, quoting, and likely side effects. Prefer read-only inspection before mutation and narrow explicit paths over broad globs or unresolved variables.

When a command fails:

1. Inspect the exact command and exact error.
2. Look for control characters, stray prefixes such as `^Q` or `^git`, quoting errors, wrong directory, and malformed syntax.
3. Correct and retry the intended command once.
4. Investigate the environment only if the corrected command exposes an environment failure.

Do not respond to malformed input by changing `PATH`, shell profiles, installations, credentials, authentication, or tool configuration. Require evidence and appropriate permission before any such change.

For destructive or hard-to-recover actions, resolve and display exact targets first, prefer a reversible operation, and obtain approval when scope is not already explicit. Never use a home directory, repository root, filesystem root, or an unvalidated variable as a recursive deletion target.
