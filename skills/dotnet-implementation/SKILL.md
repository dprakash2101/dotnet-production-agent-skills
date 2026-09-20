---
name: dotnet-implementation
description: Implement production .NET or ASP.NET Core behavior within an existing codebase. Use for features, enhancements, fixes after diagnosis, and requested refactoring; not for review-only or investigation-only work.
---

# Safe .NET implementation

Use this sequence: understand -> trace -> identify impact -> implement -> review diff -> validate.

Start from the relevant entry point and follow the actual path: controller/handler -> service -> mapper/helper -> persistence or external integration. Keep a small working set and expand only when evidence requires it.

Before changing shared helpers, extensions, middleware, models, mappers, DI registration, auth, configuration, serialization, or common libraries, find their usages and load `shared-code-impact`.

Implement the requested behavior without changing unrelated behavior. If a rule applies to one API, customer, reseller, country, region, sender, integration, feature flag, or workflow, encode that scope rather than making it global. Do not modernize adjacent code or reformat unrelated files.

Follow current project language version, nullable settings, analyzers, conventions, and libraries. Preserve architectural layers and public contracts. Propagate cancellation through cancellable I/O; avoid sync-over-async and `async void`; respect DI lifetimes; use structured logs without secrets; dispose owned resources; keep configuration validated and externalized.

For conditional runtime guidance, read only the relevant section of [references/runtime-safety.md](references/runtime-safety.md).

Add meaningful tests for new or materially changed testable business logic. Validate once after a coherent change, escalating from focused tests/builds only as risk or evidence requires.
