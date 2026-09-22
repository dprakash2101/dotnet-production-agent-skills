---
name: relational-database-dotnet
description: Use when implementing, reviewing, or troubleshooting .NET PostgreSQL or Oracle SQL, ADO.NET providers, parameterized queries, connections, transactions, mapping, or database performance. Compose with ef-core-safety for EF Core.
---

# Relational database access for .NET

Follow the repository's established data integration/data-access layer. Keep SQL and provider calls out of controllers. Inspect current provider version, connection factory/data source, mapping conventions, transaction ownership, and command timeout behavior before changing access code.

- Parameterize every runtime value; never concatenate untrusted input into SQL. Dynamic identifiers require a trusted allowlist and correct provider quoting.
- Reuse the provider's thread-safe data source/pool, but open a logical connection late and dispose it promptly. Dispose commands, readers, transactions, and provider resources with `using`/`await using` as supported.
- Use async database APIs on asynchronous paths and propagate cancellation. Set a deliberate command timeout consistent with upstream deadlines; distinguish cancellation from timeout and dependency failure.
- Keep transactions as short as practical and include only operations that share the atomic boundary. Commit explicitly; ensure failure disposes/rolls back. Do not hold a transaction open across avoidable remote calls.
- Map database nulls, precision, text/binary sizes, date/time zones, and provider-specific types explicitly. Do not rely on machine culture or silent narrowing conversions.
- Select only needed columns, bound result sets, page with a stable order, avoid per-row queries, and inspect execution plans/index implications when query shape or volume warrants it.
- Keep connection strings and credentials in approved configuration/secret stores. Log safe operation identifiers and timing, not SQL values, connection strings, or sensitive result data.

Do not add custom retries merely because transient failures are possible. Add them only when explicitly requested or required by existing architecture. Prefer provider/framework resilience. Before retrying, classify transient errors and prove idempotency, transaction boundaries, timeout budget, duplicate-write safety, bounded attempts, backoff/jitter, cancellation, and observability. Never retry permanent errors or unsafe writes blindly.

Read only the matching provider reference: [PostgreSQL](references/postgresql.md) or [Oracle](references/oracle.md).

For EF Core work, load `ef-core-safety` for ORM behavior. Load this skill and only the matching provider reference as well when the task depends on provider-specific SQL, type mapping, connection, transaction, or resilience semantics; do not load both for provider-agnostic EF Core changes.
