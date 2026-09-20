---
name: ef-core-safety
description: Design, implement, or review Entity Framework Core queries, writes, migrations, and DbContext usage. Use only when a .NET task changes EF Core persistence behavior or investigates database performance/correctness.
---

# EF Core safety

Understand the entity model, mappings, query shape, indexes, tracking needs, transaction boundary, concurrency behavior, and migration history before editing.

- Keep `DbContext` scoped to a unit of work and never use one instance concurrently. Await each operation before starting the next.
- Project only needed data; avoid accidental N+1 queries, client evaluation assumptions, unbounded result sets, premature materialization, and unnecessary tracking (`AsNoTracking` for read-only work when consistent with the repository).
- Propagate cancellation to async database calls. Use async methods for request-path I/O.
- Make transaction boundaries explicit when multiple writes must be atomic. Account for execution-strategy retries and external side effects; do not assume a database transaction covers remote calls.
- Handle optimistic concurrency deliberately when lost updates matter. Design retry/merge behavior rather than blindly overwriting.
- Treat migrations as production contracts: inspect generated operations, data loss, locks, defaults/backfills, deployment ordering, mixed-version compatibility, and rollback/roll-forward strategy.

Validate query behavior and SQL/performance when risk warrants it. Test provider-specific behavior with the appropriate provider; do not assume an in-memory provider reproduces relational semantics.
