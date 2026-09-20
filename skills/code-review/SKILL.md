---
name: code-review
description: Review .NET changes for concrete correctness, regression, security, contract, concurrency, and test risks. Use for review requests, pull requests, or diffs; do not modify code unless separately requested.
---

# .NET code review

Read the request/acceptance criteria, repository guidance, diff, and enough surrounding code to understand changed paths and consumers. Inspect shared usages when the diff changes common components.

Prioritize findings by impact: correctness/regression, security/data exposure, API or persistence compatibility, concurrency/lifetime/resource faults, resilience/transaction/idempotency mistakes, and missing tests for risky behavior. Consider analyzer/style issues only when material or configured as required.

Each finding should state the concrete failure mode, conditions that trigger it, impact, and precise file/line evidence. Avoid vague preferences, speculative claims without a plausible path, and requests for unrelated cleanup. Check whether tests already cover the concern before reporting it.

Return findings in severity order. If none are found, say so and identify meaningful residual risks or unverified validation. A review request authorizes inspection and reporting, not edits, commits, or pushes.
