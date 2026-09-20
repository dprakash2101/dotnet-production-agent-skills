---
name: distributed-workflows
description: Design or change .NET message handlers, background services, retries, idempotent operations, and multi-system workflows. Use when work crosses process/service boundaries or can execute more than once.
---

# Distributed workflows

Assume timeouts, partial failure, duplicate delivery, reordering, and ambiguous outcomes. Define the consistency and ownership boundary before coding.

- Make repeatable operations idempotent with a stable operation/message key and durable deduplication when needed. Do not rely on in-memory flags across instances.
- Before adding application-level retry, account for retries and redelivery already provided by the client or platform. Retry only transient failures when another attempt is actually needed, with bounds, backoff/jitter, cancellation, and dead-letter/escalation behavior. Ensure retried side effects are safe.
- Separate database commit from message publication deliberately; use the repository's outbox/inbox or equivalent pattern when atomic intent matters.
- Define ordering and concurrency per entity/key. Protect against duplicate and concurrent processing.
- In `BackgroundService`, honor shutdown, avoid `async void`/unobserved tasks, create scopes for scoped dependencies, and surface terminal failures.
- Attach correlation/trace identifiers and structured outcome metrics without sensitive payloads.

Test duplicate execution, retry exhaustion, cancellation/shutdown, partial failure, and recovery—not just the happy path.
