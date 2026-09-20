---
name: dependency-management
description: Assess, remove, add, or upgrade .NET/NuGet dependencies safely. Use for unused-package cleanup, package warnings, framework compatibility, vulnerability remediation, or explicit dependency changes; not for routine product code with no dependency decision.
---

# .NET dependency management

First determine whether the task is removal, addition, compatibility repair, security remediation, or upgrade. Preserve central package management, lock files, source mappings, private feeds, and repository conventions. Never change package sources, NuGet credentials, or private-feed authentication without explicit permission.

## Apparently unused dependencies

Do not remove a package based only on text search. Check direct code usage, transitive requirements, MSBuild targets, build tooling, source generators, analyzers, runtime/reflection or configuration-driven loading, project SDK behavior, and test-only usage. Inspect restore/build artifacts or dependency graphs when they clarify why the package exists.

After removal, restore and run the narrowest builds/tests that exercise compile-time, generated, and runtime integration. Report dependencies that remain uncertain instead of guessing.

## New dependencies

Before adding a package, confirm existing framework or repository capabilities do not already meet the need. Check target-framework compatibility, maintenance and support status, security advisories, license constraints where the repository tracks them, transitive impact, and whether the package is required at runtime, build time, or only in tests. Choose the narrowest established package and version that satisfies the requirement; do not add a broad dependency for a trivial helper.

## Deprecated, outdated, or vulnerable dependencies

Establish the current and target versions, affected projects, target .NET compatibility, transitive changes, advisories, official release notes, deprecation status, and breaking changes. Prefer the smallest compatible change that addresses the actual need; do not upgrade every package to latest or blindly downgrade/upgrade to silence warnings.

For a major version, identify required code/configuration migrations before editing. Inspect restore output for downgrades, conflicts, duplicate transitive versions, analyzer changes, and unexpected output assets. For SDK/runtime upgrades, include deployment environment, container/base image, hosting bundle, SDK pinning, serialization, and changed defaults.

Keep dependency work separate from unrelated refactoring. Validate the affected build and behavior, and document unresolved compatibility or rollback concerns.
