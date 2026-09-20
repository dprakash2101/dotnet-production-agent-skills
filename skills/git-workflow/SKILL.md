---
name: git-workflow
description: Perform safe Git branch, stage, commit, and push operations for engineering work. Use only when the user requests Git operations or they are an explicit required step; never infer permission to commit or push.
---

# Fast, safe Git workflow

Minimize terminal calls and token-heavy output without weakening review. Batch compatible Git commands into the fewest practical invocations, and reuse branch, status, diff, validation, and remote facts already established in the current task when no intervening operation could have changed them. Do not issue one tool call per Git command by default.

For a fresh preflight, prefer one combined inspection such as `git status --short --branch` instead of separate status and branch commands. Inspect only the relevant diff; do not repeat a full diff review that was just completed.

Preserve unrelated user changes and stage explicit intended paths or hunks only. After staging, use one focused staged check that detects whitespace errors and confirms the staged scope, such as `git diff --cached --check --stat`. Expand to the full staged diff only when it has not already been reviewed or the staged scope is surprising.

Branch names:

- `feature/<JIRA-ID>/<meaningful-name>`
- `fix/<JIRA-ID>/<meaningful-name>`

Reuse a Jira ID from the current branch or user input. Never invent one; ask if the requested operation requires an unavailable ID.

Commit messages begin with the Jira ID, for example `XDCI-12345 Add order webhook retry handling`. Do not add co-author, AI, or agent attribution.

Before committing, confirm required validation and scan the intended changes for secrets/artifacts. Do not include unrelated changes. Do not change Git identity, credentials, credential helpers, or authentication configuration.

When the user authorizes both commit and push, treat them as one continuous workflow: do not pause between them or rerun status/branch checks unless the commit result is ambiguous, hooks changed the worktree, or another actor may have changed repository state. Push the committed current branch with `git push -u <authorized-remote> HEAD`; this avoids another branch-name lookup. Inspect remotes only when the destination is not already known, and obtain any host-required approval before external transfer.

Do not run a final status merely for ceremony. Commit and push output normally provide sufficient confirmation; recheck only to investigate an error, hook mutation, partial operation, or when the user explicitly requests a clean-tree report.

Group already-authorized sequential operations in one terminal invocation using `&&`, so execution stops at the first failure and later mutations do not run. Do not add banners, `echo` separators, or duplicate inspection commands that inflate output. Keep separate calls only where the result of one step must be reviewed before authorizing or deciding the next step.

## Efficient default

When the exact paths and diff were reviewed, validation passed, the commit message is known, and commit plus push are both authorized, use at most two terminal invocations:

1. `git status --short --branch` for the fresh preflight.
2. A short-circuiting sequence that stages only the intended paths, checks the staged scope, commits, and pushes `HEAD`, for example: `git add -- <paths> && git diff --cached --check --stat && git commit -m "<message>" && git push -u <authorized-remote> HEAD`.

If the preflight facts are already known from the current task, skip the first invocation and run only the combined mutation sequence. For a commit without push, omit the final push segment. For read-only review, combine compatible output in one invocation or use multi-purpose forms such as `git status --short --branch` and `git diff --check --stat` instead of separate branch, status, whitespace, and summary calls.

Do not use the combined mutation sequence when staging needs hunk selection, changes have not been reviewed, validation is incomplete, the remote is unknown, push was not authorized, or the environment requires separate approvals. In those cases, split only the steps needed to resolve that uncertainty.

Never force-push unless explicitly requested and the target/ref consequences are understood. Pushing, rebasing, resetting, deleting branches/tags, and other remote or destructive actions require clear scope and authorization.
