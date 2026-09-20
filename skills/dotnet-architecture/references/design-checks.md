# Design checks

## New HTTP integration

- Separate business orchestration from protocol details.
- Follow the repository's `IHttpClientFactory`, typed/named client, resilience, authentication, and serialization conventions.
- Define timeouts and propagate cancellation. Retry only transient failures and only when the operation is safe to repeat.
- Keep request-specific state out of pooled handlers. Avoid capturing typed clients in singletons.
- Decide how upstream errors map to domain results and API responses without leaking sensitive content.

## Background work or messaging

- Define ownership, shutdown/cancellation, idempotency, retry/dead-letter behavior, ordering, concurrency, and observability.
- Create scopes inside singleton hosted services for scoped dependencies.
- Avoid unobserved fire-and-forget tasks.

## Public API

- Define route, verb, auth policy, request/response schema, status/error behavior, pagination, versioning, and compatibility.
- Prefer additive evolution. Plan migration when a breaking change is unavoidable.

## Data

- Define transaction boundary, consistency needs, indexes/query shape, concurrency behavior, migration compatibility, and rollback/roll-forward strategy.
