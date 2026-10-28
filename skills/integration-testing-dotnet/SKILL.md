---
name: integration-testing-dotnet
description: Use when implementing or reviewing .NET integration tests across HTTP, persistence, messaging, or external services.
---

# Integration Testing Dotnet

Follow the repository test framework and existing fixture conventions. Identify the boundary and behavior that must be verified; use unit tests for isolated logic and integration tests where configuration, serialization, persistence, or host wiring matters.

- For ASP.NET Core HTTP tests, use the established test host or WebApplicationFactory when appropriate. Exercise routing, authentication and resource authorization, validation, status codes, headers, serialization and sanitized failures over HTTP.
- Use an isolated database and the real provider when provider behavior matters; avoid assuming an in-memory substitute represents relational constraints, transactions or SQL translation. Apply the actual migration path where relevant.
- Use an existing emulator or isolated service for messaging and external dependencies when practical; otherwise substitute the boundary deliberately and state what is not covered. Never connect a test to production resources.
- Isolate test data and resource names; clean up owned resources. Control time and parallelism, bound waiting, and avoid tests that depend on execution order or arbitrary sleeps.
- Cover representative success and failure paths, cancellation and concurrency where material. Run the narrow affected suite and report unavailable dependencies or skipped checks.
