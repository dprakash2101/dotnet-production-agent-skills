---
name: http-client-integrations
description: Use when implementing or reviewing .NET outbound HTTP integrations, HttpClient lifetime, timeouts, response handling, or existing resilience policies.
---

# Http Client Integrations

Inspect the existing typed or named clients, dependency injection, target framework, handlers, configuration, authentication and upstream contract before changing behavior.

- Reuse the repository client factory and intended handler lifetimes. Dispose owned response messages and streams; propagate cancellation through outbound I/O and bound response size where needed.
- Validate URI construction and redirects across trust boundaries; do not log credentials, sensitive bodies, or authorization headers. Map upstream failures to the owning application boundary without leaking internal details.
- Distinguish caller cancellation, timeout, transport failure, unsuccessful status, and invalid payload. Define total time budgets consistent with upstream deadlines.
- Do not introduce retries unless requested or required by existing architecture. Inspect framework and handler defaults: retrying unsafe methods or stacking policies can duplicate writes. If retries are required, establish idempotency, bounded attempts, cancellation, backoff and observability.
- Test serialization, auth, representative status codes, cancellation, timeout and disposal using the established test seam. Avoid testing only mocked implementation details.
