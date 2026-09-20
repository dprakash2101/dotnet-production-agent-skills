---
name: task-router
description: Classify a software request just enough to select a safe, proportionate workflow. Use at the start of implementation, investigation, review, testing, or Git work when the needed workflow is not already obvious.
---

# Task router

Choose the smallest matching workflow. Do not turn classification into a deliverable.

| Request | Load |
| --- | --- |
| Bug fix | `bug-investigation`, then implementation/testing/validation as needed |
| Minor enhancement | `dotnet-implementation`; add contract/shared-impact skills when touched |
| Major feature | `dotnet-architecture` and `dotnet-implementation` |
| Refactoring | `shared-code-impact`, `unit-testing`, `targeted-validation` |
| Production hotfix | `production-hotfix` |
| POC/experiment | `poc-development` |
| Investigation only | `bug-investigation`; do not implement without authorization |
| Code review | `code-review` |
| Testing only | `unit-testing` |
| Commit/push/branch work | `git-workflow` |

Add `api-contract-safety`, `ef-core-safety`, `distributed-workflows`, `dependency-upgrades`, or `production-debugging` only when their subject is actually involved. End code-changing work with `diff-review` and proportionate `targeted-validation`.

For every category, preserve unrelated behavior, constrain the blast radius, and inspect shared dependencies. Task size changes investigation and validation depth, never safety standards.
