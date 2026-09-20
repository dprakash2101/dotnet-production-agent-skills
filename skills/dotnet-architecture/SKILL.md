---
name: dotnet-architecture
description: Design or assess architecture for substantial .NET and ASP.NET Core changes. Use for new APIs, major features, new integrations, or layering decisions; not for routine localized edits that preserve an established design.
---

# .NET architecture

First identify the repository's existing boundaries and conventions. Preserve an intentional existing architecture; do not impose a new pattern for a small change.

Default ASP.NET Core separation when the codebase has no contrary design:

```text
Controller -> business/application service -> data or external integration
```

- Controllers own routing, binding, validation coordination, auth integration, service invocation, and HTTP translation. Keep business rules, database access, external HTTP calls, and substantial transformation out of controllers.
- Services own business behavior and orchestration. Use focused domain/helper components only when they clarify reusable or complex behavior; do not abstract five straightforward lines.
- Data/integration components own persistence and transport details. Use established repositories, DbContexts, typed/named clients, SDK wrappers, and registration patterns.

For a major change, define affected components and contracts, concurrency and failure boundaries, configuration, observability, migration/rollout needs, and test seams before implementation. The valid change set may be large, but unrelated cleanup remains out of scope.

Read [references/design-checks.md](references/design-checks.md) only when designing a new integration, background process, or public API.
