---
name: dependency-upgrades
description: Upgrade or evaluate NuGet and .NET dependencies with controlled compatibility and supply-chain risk. Use for package/framework upgrades or vulnerability remediation; not for adding a routine dependency as part of an unrelated feature.
---

# .NET dependency upgrades

Establish why the upgrade is needed, current and target versions, affected projects, transitive changes, framework compatibility, advisories, release notes, and known breaking changes. Prefer official package/release sources.

Keep the version change narrow. Preserve central package management, lock files, source mappings, private feeds, and repository update conventions. Do not combine an upgrade with unrelated refactoring or upgrade adjacent packages without dependency evidence.

Inspect restore output and dependency graph for downgrades, conflicts, unexpected transitive packages, build/analyzer changes, and assets copied to output. Never weaken source verification or add insecure feeds/credentials to make restore pass.

Adapt code only for documented compatibility needs. Run affected tests/builds and integration/contract checks proportionate to the package's reach. For framework/runtime upgrades, also assess deployment environment, container/base image, hosting bundle, SDK pinning, serialization, and behavioral defaults.

Document unresolved breaking risks and rollback strategy.
