---
name: redis-dotnet
description: Implement, review, or troubleshoot Redis caching in .NET and ASP.NET Core, including StackExchange.Redis, IDistributedCache, key design, expiration, cache invalidation, performance, and secure handling of cached tokens or secrets.
---

# Redis caching for .NET

Inspect the application's existing cache abstraction, Redis client registration, serializers, and failure policy before changing code. Reuse established helpers and avoid adding a second connection or serialization scheme without a reason.

- Choose a stable namespaced key with environment and tenant/customer isolation where needed. Do not place access tokens, secret keys, passwords, or sensitive personal data in key names; keys appear in diagnostics and operational tools.
- Set an explicit TTL from the data's real validity. For access tokens, expire the cache entry before the token's expiry with a small safety margin, and handle refresh races across instances. Define invalidation when source data changes. Avoid unbounded or permanently cached entries by default.
- Keep values small and version serialized payloads when schemas can change. Do not cache null/error responses without a deliberate short-lived policy. Avoid large scans, blocking commands, and per-request connection creation; bound timeouts and concurrency.
- **Never store access tokens, refresh tokens, API keys, secret keys, passwords, or other credentials in Redis as plaintext values.** Prefer caching a non-sensitive reference when possible. If a credential must be cached, encrypt it before writing and decrypt only after reading with the repository's established, vetted encryption helper. Keep encryption keys outside Redis in the existing secret-management system; use authenticated encryption and support key rotation. Do not invent cryptography or silently replace an existing helper.
- Protect Redis transport with TLS and restrict access using the deployment's network and least-privilege authentication controls. Encryption in transit or at rest does not replace application-level protection of sensitive cached values. Do not log cache values, credentials, connection strings, or decrypted payloads.
- Decide whether a Redis miss or outage should fall back to the source, fail closed, or surface an error based on the flow. Avoid a thundering herd on misses and keep any lock or refresh mechanism bounded. Add retries only when requested or required by existing architecture.
- Test expiration, invalidation, tenant isolation, concurrent cache misses, serialization changes, and Redis failure behavior where relevant. For credential caching, verify the stored bytes cannot reveal the plaintext and that decrypt failures and key rotation are handled safely.
