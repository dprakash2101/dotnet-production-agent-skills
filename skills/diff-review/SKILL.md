---
name: diff-review
description: Review the final working-tree diff for scope, regressions, secrets, and accidental changes. Use before declaring code-changing work complete or before staging a commit.
---

# Diff review

Inspect, at minimum:

```text
git status --short
git diff --stat
git diff
```

Also inspect staged changes when anything is staged. For every changed file ask: why did this file change, and how does it serve the request?

Check for accidental deletion, unrelated formatting/renaming/refactoring, generated artifacts, debug code, commented-out code, secrets, configuration drift, unintended public/API behavior, over-broad shared changes, missing tests, and user modifications that predated the task.

Revert only accidental agent-created changes, and only when ownership is clear. Never discard or overwrite user changes because they are unrelated. If changes overlap and cannot be safely separated, stop and explain the conflict.

Finish when the requested behavior is present, unrelated behavior is preserved, appropriate tests/validation are complete or honestly reported, and no unnecessary file remains changed. Stop there; do not continue cleanup.
