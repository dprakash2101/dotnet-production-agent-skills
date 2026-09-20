# Oracle Database with ODP.NET

Use the repository's supported `Oracle.ManagedDataAccess.Core`/ODP.NET version and deployment constraints. Provider capability varies by version, especially true async I/O and cancellation, so verify the installed version rather than assuming current documentation applies.

- Use bind variables and set `BindByName` deliberately where command text and repository conventions expect named binding. Specify `OracleDbType`, size, direction, precision, and scale where inference could change semantics or plan reuse.
- Open late and dispose promptly so logical connections return to the enabled pool. Preserve pool, wallet, proxy-authentication, and managed identity/token configuration.
- Treat empty-string/null behavior, `NUMBER` precision, `DATE`, `TIMESTAMP`, `TIMESTAMP WITH TIME ZONE`, LOB streaming, REF CURSORs, and array binding as provider-specific mapping decisions.
- Set command timeout/cancellation based on supported APIs and understand their interaction with pipelining and server execution. A canceled client wait does not always prove server work stopped.
- Avoid fetching large LOBs or result sets eagerly. Configure fetch/array sizes only from measured workload needs.
- Classify failures by Oracle error code and operation context; do not parse message text. Account for commit ambiguity before any retry.

Keep transactions local and short. Never retry a write after a connection/commit failure unless duplicate execution and the commit outcome are safely resolved.
