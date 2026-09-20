---
name: git-workflow
description: Perform safe Git branch, stage, commit, and push operations for engineering work. Use only when the user requests Git operations or they are an explicit required step; never infer permission to commit or push.
---

# Safe Git workflow

Inspect status, current branch, and relevant diffs before mutation. Preserve unrelated user changes and stage explicit intended paths or hunks only.

Branch names:

- `feature/<JIRA-ID>/<meaningful-name>`
- `fix/<JIRA-ID>/<meaningful-name>`

Reuse a Jira ID from the current branch or user input. Never invent one; ask if the requested operation requires an unavailable ID.

Commit messages begin with the Jira ID, for example `XDCI-12345 Add order webhook retry handling`. Do not add co-author, AI, or agent attribution.

Before committing, review staged status and diff, confirm validation, and scan for secrets/artifacts. Do not include unrelated changes. Do not change Git identity, credentials, credential helpers, or authentication configuration.

Never force-push unless explicitly requested and the target/ref consequences are understood. Pushing, rebasing, resetting, deleting branches/tags, and other remote or destructive actions require clear scope and authorization.
