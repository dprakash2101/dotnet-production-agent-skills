---
name: code-quality
description: Improve or assess quality of changed C#/.NET code under Clean-as-You-Code and analyzer/Sonar expectations. Use for requested quality work or while polishing a substantive implementation; do not trigger repository-wide legacy cleanup.
---

# .NET code quality

Optimize changed code for reliability, security, maintainability, readability, testability, low complexity, and low duplication. Respect the repository's configured analyzers, Sonar rules, `.editorconfig`, language version, and conventions.

Prefer clear names, focused methods, guard clauses, accurate null handling, structured logging, correct async/cancellation, dependency injection, safe disposal, and immutable/read-only state where useful.

Avoid deep nesting, giant methods, unexplained magic values, unnecessary static state, swallowed or over-broad exceptions, dead/commented code, complex LINQ that obscures intent, sync-over-async, secret logging, hardcoded credentials, unjustified allocations on hot paths, and analyzer suppression as a substitute for a fix.

Apply Clean-as-You-Code: introduce no new issues and improve an existing issue only when directly touched or required by the request. Do not turn feature work into a legacy quality campaign. Simplify only where behavior remains demonstrably unchanged.
