# BigQuery query safety

## Execution and results

`ExecuteQueryAsync` creates a query job and obtains its results. Use explicit `CreateQueryJobAsync` plus result retrieval when the application needs to persist or expose job identity, attach options/labels, separate submission from waiting, or resume a long-running workflow.

Treat `BigQueryResults` as a pageable result source. Iterate in a bounded manner and map rows incrementally. If the business operation genuinely needs a large result, prefer a destination table or an export/analytics pipeline over retaining all rows in application memory.

## Parameters and cost

Use `BigQueryParameter` with an explicit type when inference could be ambiguous, especially for nulls, arrays, numeric precision, dates, and timestamps. Parameters represent values, not arbitrary SQL syntax or table/column names.

Restrict partitions with predicates the optimizer can use. Avoid selecting unused nested/repeated fields. Preserve repository maximum-bytes-billed, dry-run estimation, labels, location, and priority settings.

## Time values

- `TIMESTAMP`: an instant on the global timeline. Map with an offset/UTC-aware representation and preserve UTC semantics.
- `DATETIME`: calendar date and clock time without timezone. Do not attach local/UTC meaning unless the domain supplies a timezone.
- `DATE` and `TIME`: keep their narrower semantics rather than round-tripping through an assumed local `DateTime`.
