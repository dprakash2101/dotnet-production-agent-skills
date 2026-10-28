---
name: deployment-readiness-dotnet
description: Use when reviewing or preparing .NET application deployment, container hosting, readiness, configuration, rollout, or rollback.
---

# Deployment Readiness Dotnet

Inspect the existing deployment pipeline, target runtime, image, configuration, traffic routing and infrastructure ownership. Do not deploy or modify live infrastructure without authorization.

Verify SDK/runtime and target framework compatibility, required configuration and secrets, non-root execution where supported, proxy/TLS settings, resource limits, health and readiness checks, and bounded graceful shutdown. Ensure readiness reflects ability to accept work without turning transient dependency faults into restart loops.

For changes affecting schemas or contracts, establish deployment order, mixed-version compatibility, rollback or roll-forward path, and observable recovery signals. Report prerequisites, commands actually run, and unverified environment assumptions.
