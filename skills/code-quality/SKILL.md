---
name: code-quality
description: Use when improving or reviewing modified .NET code for SonarCloud/Roslyn findings, duplication, complexity, maintainability, or existing helper reuse. Avoid unrelated legacy cleanup.
---

# .NET code quality

Write new and materially modified code cleanly on the first pass. Optimize it for reliability, security, maintainability, readability, testability, low cognitive complexity, and low duplication. Inspect and obey repository-specific SonarCloud/SonarQube configuration, quality profiles or suppressions represented in source, analyzers, `.editorconfig`, nullable settings, language version, and conventions; repository rules take precedence over generic assumptions.

Before adding substantial logic, search the relevant feature, layer, and shared components for materially equivalent behavior. Reuse an existing sound implementation when its contract and scope match. When multiple callers genuinely need the same meaningful business or technical behavior, consider a focused helper, service method, extension, mapper, utility, or shared component. Search usages and preserve every caller's behavior before changing shared code.

Do not extract an abstraction because two trivial lines look alike, combine unrelated concepts in a global helper, or refactor a large area to remove insignificant duplication.

Prefer clear names, focused methods, guard clauses, accurate null handling, structured logging, correct async/cancellation, dependency injection, safe disposal, and immutable/read-only state where useful. Design exception paths, resource ownership, and async behavior alongside the happy path. Keep code straightforward to test.

Avoid deep nesting, giant methods, unexplained magic values, unnecessary static state, swallowed or over-broad exceptions, dead/commented code, complex LINQ that obscures intent, sync-over-async, secret logging, hardcoded credentials, unjustified allocations on hot paths, and analyzer suppression as a substitute for a fix.

Apply Clean-as-You-Code: introduce no new issues, vulnerabilities, security hotspots, or avoidable duplication in changed code. Improve a pre-existing issue only when the requested change materially touches it or it blocks safe implementation. Do not turn feature work into a historical Sonar cleanup. Run the repository's configured analyzer/Sonar-equivalent check when available and proportionate; do not invent a generic rule set when the repository defines one.
