# Customer-facing API exception handling

Use centralized exception handling or middleware and the repository's stable error contract. Detailed diagnostic information belongs in protected internal telemetry; the customer receives a predictable sanitized response.

Never expose stack traces, SQL, connection strings, internal hostnames, file paths, credentials, tokens, secrets, dependency payloads, implementation-specific infrastructure details, or raw internal exception information. Do not return `exception.Message` unless that exact value is explicitly designed and reviewed as customer-safe.

Map failures by domain meaning and the existing API contract, commonly:

- transport/domain validation -> documented client error;
- authentication/authorization -> established challenge/forbid behavior without leaking protected resource existence;
- missing resource -> not found when disclosure is permitted;
- conflict/business rule -> stable conflict/domain code;
- dependency unavailable or timed out -> sanitized response consistent with the contract;
- caller cancellation -> repository-standard cancellation behavior;
- unexpected failure -> generic internal error.

Separate public error code/title/detail from internal exception type/message/data. Preserve a safe correlation identifier so support can find internal diagnostics. Test status, sanitized body, content type, and correlation propagation for representative failures.
