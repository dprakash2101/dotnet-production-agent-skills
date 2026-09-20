---
name: production-debugging
description: Investigate live or production-like .NET failures using logs, traces, metrics, dumps, and configuration evidence. Use for production diagnosis; do not mutate production state or deploy fixes without explicit authorization.
---

# .NET production debugging

Start with an incident timeline, impact, affected versions/instances/tenants, correlation identifiers, and recent deployments/configuration changes. Protect customer data and credentials in every query and output.

Form falsifiable hypotheses and request the smallest evidence needed: structured logs, distributed traces, relevant metrics, health/dependency signals, configuration provenance, or a narrowly captured dump/profile. Correlate by time and request/message identity; distinguish cause from downstream noise.

For high CPU, memory, thread-pool starvation, deadlock, or crash analysis, capture diagnostics with production-safe tooling and bounded duration/size. Account for collection overhead and retention/security rules. Never attach a debugger, restart, scale, change flags, clear queues/caches, or capture sensitive dumps without explicit authorization.

Conclude with verified facts, root cause or ranked hypotheses, evidence gaps, safe mitigation/fix options, and a validation/monitoring plan. Keep production diagnosis separate from authorization to change production.
