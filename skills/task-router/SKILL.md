---
name: task-router
description: Use only when the user explicitly requests help selecting a workflow or skill for a complex software task; choose relevant skills from their descriptions without implementing a custom skill router.
---

# Task router

Choose the smallest matching workflow. Do not turn classification into a deliverable.

| Request | Load |
| --- | --- |
| Bug fix | `bug-investigation`, then implementation/testing/validation as needed |
| Minor enhancement | `dotnet-implementation`; add contract/shared-impact skills when touched |
| Major feature | `dotnet-architecture` and `dotnet-implementation` |
| New customer-facing API | `aspnet-core-api-development`, `api-contract-safety`, and `exception-handling`; add logging and provider skills only as touched |
| Refactoring | `shared-code-impact`, `unit-testing`, `targeted-validation` |
| Production hotfix | `production-hotfix` |
| POC/experiment | `poc-development` |
| Investigation only | `bug-investigation`; do not implement without authorization |
| Code review | `code-review` |
| Testing only | `unit-testing` |
| API deprecation/removal | `api-endpoint-deprecation` |
| Dependency work | `dependency-management` |
| Google Cloud data/messaging | Load only the matching Pub/Sub, BigQuery, or Firestore skill |
| PostgreSQL/Oracle access | `relational-database-dotnet` and only its matching provider reference; also load `ef-core-safety` when EF Core behavior is involved |
| Commit/push/branch work | `git-workflow` |

Add `api-contract-safety`, `exception-handling`, `production-logging`, `ef-core-safety`, `distributed-workflows`, `dependency-management`, or `production-debugging` only when their subject is actually involved. Never preload unrelated cloud or database provider guidance. End code-changing work with `diff-review` and proportionate `targeted-validation`.

For every category, preserve unrelated behavior, constrain the blast radius, and inspect shared dependencies. Task size changes investigation and validation depth, never safety standards.
