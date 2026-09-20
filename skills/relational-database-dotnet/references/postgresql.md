# PostgreSQL with Npgsql

Use the repository's supported Npgsql version. For modern Npgsql, prefer one long-lived `NpgsqlDataSource` per configuration; it owns the connection pool and is thread-safe. Open/dispose short-lived logical connections for transaction-scoped work.

- Prefer PostgreSQL-native positional placeholders (`$1`, `$2`) in new direct SQL when consistent with repository conventions; parameters carry values separately and enable correct binary typing/preparation.
- Specify `NpgsqlDbType` when nulls, arrays, JSON, ranges, enums, timestamps, or inference are ambiguous. Preserve configured type mappings.
- Understand `timestamp with time zone` as an instant and `timestamp without time zone` as a civil/local value. Keep UTC/domain timezone decisions explicit.
- Use provider cancellation and command timeout, recognizing cancellation may race with command completion. Classify PostgreSQL SQLSTATE codes rather than matching localized message text.
- For pagination at scale, prefer a stable indexed keyset predicate over large offsets when the API contract allows it.
- Inspect locks, isolation, unique constraints, `ON CONFLICT`, row counts, and concurrency semantics before changing writes.

Do not disable pooling to fix a leak; dispose logical connections and diagnose pool pressure. Use provider-supported resilience only within the application's retry/idempotency policy.
