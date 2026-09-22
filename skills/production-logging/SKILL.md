---
name: production-logging
description: Use when adding, reviewing, or reducing .NET structured logs, exception telemetry, correlation IDs, sensitive-data exposure, or high-traffic API logging costs.
---

# Production logging for .NET

Follow the repository's logging, telemetry, redaction, sampling, and correlation conventions. Emit structured templates with stable property names and values as arguments:

```csharp
logger.LogInformation("Order {OrderNumber} processed for {CustomerNumber}", orderNumber, customerNumber);
```

Do not use interpolation/concatenation that defeats structured fields. Prefer source-generated logging for proven hot paths when the repository uses it; do not add ceremony to cold code without value.

Log events that support operations: unexpected failures, dependency failures, important business failures, operationally useful retries and final exhaustion, significant state transitions, security-relevant events, safe correlation identifiers, and meaningful latency anomalies. Choose `Trace`, `Debug`, `Information`, `Warning`, `Error`, or `Critical` from operational severity—not habit.

Avoid per-item success noise in high-volume paths, local-variable narration, whole request/response or message bodies, large collections, duplicate exception logs at multiple layers, and values with no diagnostic action. Consider ingestion, indexing, retention, and alert cost before adding high-cardinality fields or frequent logs.

Never log credentials, tokens, API keys, connection strings, authentication headers, secrets, or unredacted sensitive payloads. Minimize PII and customer identifiers; hash/redact only through approved repository mechanisms and remember that hashes may remain identifying.

Define one layer to own the exception event. Lower layers may add context by wrapping or enriching traces, but should not repeatedly log and rethrow the same failure. Include exceptions as exception arguments so stacks remain available internally. Preserve trace/correlation IDs across boundaries and prefer OpenTelemetry spans/metrics for high-volume timing or cardinality that does not belong in logs.

Test/red-team log output when a change touches sensitive input or centralized failure handling. Verify useful fields exist and prohibited data does not.
