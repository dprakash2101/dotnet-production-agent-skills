# .NET runtime safety

Read only the sections relevant to the current change.

## Async and cancellation

- Return `Task`/`Task<T>` except true event handlers. Await work instead of using `.Result`, `.Wait()`, or `GetAwaiter().GetResult()`.
- Accept and forward `CancellationToken` across async I/O when the calling contract supports it. Do not convert caller cancellation into an error log or generic failure.
- Avoid fire-and-forget work in request flows. If durable work is required, use the established queue/background mechanism.
- Do not run concurrent operations on objects documented as non-thread-safe, including a single EF Core `DbContext`.

## Dependency injection and disposal

- Do not inject scoped or transient disposable services into singletons. In hosted services, create a scope per unit of scoped work.
- Let DI dispose services it creates. Explicitly dispose only resources the code owns; use `await using` for `IAsyncDisposable` where appropriate.
- Keep constructors cheap; avoid service-locator calls unless required by an established factory pattern.

## HTTP and resilience

- Use the established factory/typed/named client. Do not create and dispose a new raw `HttpClient` per request.
- Do not store request-specific data in pooled handlers or capture a typed/factory client in a long-lived singleton.
- Set deliberate timeouts. Retry only transient failures; use bounded backoff/jitter and honor cancellation/`Retry-After` when supported.
- Never automatically retry non-idempotent work without an idempotency mechanism or explicit safety proof.
- Dispose request/response/content objects that the code owns, and avoid buffering large payloads unnecessarily.

## Logging and exceptions

- Use structured templates with stable property names. Do not interpolate structured values into the message string.
- Never log secrets, tokens, credentials, connection strings, or sensitive payloads. Avoid duplicate logging at every layer.
- Catch only when adding recovery, translation, cleanup, or useful context. Preserve the original exception/stack; do not swallow failures.
- Map expected domain failures deliberately; let centralized handling cover unexpected exceptions.

## Configuration and nullability

- Use the repository's options/configuration pattern, validate required settings at an appropriate boundary, and keep secrets outside source control.
- Treat nullable warnings as design feedback. Use guards and accurate annotations rather than indiscriminate null-forgiving operators.

## Concurrency and performance

- Prefer immutable/local state. Protect shared mutable state and reason about atomicity, ordering, and duplicate execution.
- Measure before optimizing. Avoid unbounded concurrency, unnecessary materialization, repeated enumeration, and large allocations on hot paths.

## Authentication and authorization

- Authenticate identity and authorize the specific resource/action. Do not trust client-supplied ownership or role fields.
- Preserve policy, scheme, claim, and middleware ordering. Default to denying access when required context is missing.
