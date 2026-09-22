---
name: google-bigquery-dotnet
description: Use when implementing, modifying, reviewing, troubleshooting, or optimizing Google BigQuery integrations in .NET, including BigQueryClient, authentication, parameterized queries, DATE/DATETIME/TIMESTAMP types, query costs, serialization, and result mapping.
---

# Google BigQuery for .NET

Follow existing integration/data-access boundaries and the installed `Google.Cloud.BigQuery.V2` version. Reuse `BigQueryClient` according to repository lifetime conventions. Authenticate with Application Default Credentials and deployed workload/service identities; never embed service-account keys.

Use parameterized Standard SQL for every untrusted or runtime value. Never concatenate values into SQL. Identifiers cannot generally be value parameters, so select them only from an explicit trusted allowlist when dynamic identifiers are unavoidable.

- Select named columns rather than `SELECT *`. Apply partition filters and clustering-compatible predicates, and avoid scanning repeated data. Query design directly affects cloud cost.
- Choose immediate query execution versus explicit query jobs based on existing patterns and whether job ID, polling, labels, destination tables, or long-running lifecycle control is needed.
- Pass cancellation through async job creation/result retrieval where supported. Do not block async calls or add polling loops when the client already provides completion behavior.
- Page or stream results and project only required data. Do not call materializing helpers for an unbounded or potentially large result set; cap exports and use destination tables/storage workflows when appropriate.
- Map nulls deliberately and validate schema/type assumptions. Treat BigQuery `TIMESTAMP` as an absolute instant and `DATETIME` as a timezone-free civil value; do not silently convert between them using a machine-local timezone.
- Classify API, quota, permission, invalid-query, timeout, and cancellation failures. Preserve useful job/correlation IDs in safe structured logs, but do not log credentials, full sensitive SQL, or parameter values by default.

Do not add custom query/job retries merely because failures can be transient. Add them only when explicitly requested or required by existing architecture, prefer client/platform resilience, and account for job identity, duplicate submission, cost, timeout budget, bounded attempts, cancellation, and ambiguous completion. Never retry permission, invalid-query, or other permanent failures.

Before finalizing, inspect estimated/scanned bytes or repository query safeguards when available, and test mapping boundaries, nulls, pagination, cancellation, and date/time semantics relevant to the query.

Read [references/query-safety.md](references/query-safety.md) for job, pagination, and date/time decision details.
