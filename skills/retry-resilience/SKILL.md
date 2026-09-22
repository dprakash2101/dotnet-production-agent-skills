---
name: retry-resilience
description: >
  Use when the user explicitly requests retry behavior or when reviewing existing
  retry and resilience logic for transient HTTP, database, Pub/Sub, or cloud API
  dependencies. Do not introduce new retries unless requested or required by
  existing architecture.
---

# Retry and resilience in .NET

Inspect existing policies, timeouts, cancellation, and failure semantics first. Retry only transient failures on operations safe to repeat, or operations with a reliable idempotency key. Bound attempts, total time, and concurrency; use backoff with jitter where appropriate. Honor server retry guidance when supported.

Never retry validation failures or permanent authorization errors. Avoid layered retries that multiply calls and costs. Account for duplicate messages and ambiguous outcomes. Test the retry boundary with representative transient and permanent failures, and report the operational tradeoff.
