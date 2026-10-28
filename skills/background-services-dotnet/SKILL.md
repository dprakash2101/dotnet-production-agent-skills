---
name: background-services-dotnet
description: Use when designing or changing .NET hosted services, background workers, bounded queues, scheduled work, shutdown, or worker dependency lifetimes.
---

# Background Services Dotnet

Follow the existing hosting and scheduling architecture. Define ownership, concurrency, backpressure, cancellation, failure recovery and durable state before implementation.

- Observe the worker task and propagate shutdown. Stop intake and allow bounded in-flight completion before disposal; define what happens to unfinished work.
- Resolve scoped dependencies inside a scope per appropriate unit of work. Do not share scoped or non-thread-safe state concurrently.
- Bound queues and concurrency according to downstream capacity. Treat restarts, duplicate work and ambiguous outcomes explicitly; make side effects idempotent where required.
- Classify poison work and permanent failures separately from transient failures. Do not add retries unless explicitly requested or required by existing architecture.
- Test cancellation, host shutdown, capacity, failure handling and representative duplicate work with deterministic coordination.
