---
name: google-cloud-pubsub-dotnet
description: Implement or review Google Cloud Pub/Sub publishers and pull subscribers in .NET. Use only for Google.Cloud.PubSub.V1 messaging, subscriber workers, acknowledgement behavior, or Pub/Sub delivery concerns.
---

# Google Cloud Pub/Sub for .NET

Follow the repository's integration abstractions and the installed `Google.Cloud.PubSub.V1` version. Use `PublisherClient`/`SubscriberClient` for continuous high-throughput processing and lower-level service clients only when the hosting model or required control justifies them. Reuse expensive clients at the appropriate lifetime.

Bind project, topic, subscription, emulator, flow-control, and shutdown settings through the repository's configuration pattern. Validate required names and operational bounds at startup where practical; do not silently fall back to a production resource or accept unbounded defaults because configuration is missing.

Assume messages can be delivered more than once. Make handlers idempotent where repeated side effects matter, using a stable message/business key and durable deduplication when required. Do not rely on an in-memory flag across instances.

## Publishers

- Await and observe publish completion; a queued client-side publish is not yet durable success. Handle failed publishes and ambiguous outcomes without assuming a retry cannot duplicate a message.
- Configure batching, publisher flow control, and ordering keys from latency, memory, ordering, and downstream requirements. Bound producer pressure rather than allowing unbounded queued work.
- On graceful shutdown, stop accepting new messages and allow a bounded flush/disposal period. Surface messages that could not be published; do not report success before completion.
- Use platform/client retry behavior unless the application has an explicit, idempotent retry policy. Do not wrap `PublishAsync` in an arbitrary retry loop.

## Subscribers

- Return `Ack` only after the operation has reached the intended durable success state. Return `Nack` or allow redelivery for retryable incomplete processing; distinguish permanent poison messages and configured dead-letter behavior.
- Let the client manage acknowledgement deadline extension within deliberate bounds. Align maximum processing/extension and shutdown timeouts with actual work; do not acknowledge early merely to avoid redelivery.
- Bound concurrency and outstanding bytes/messages using flow control based on downstream capacity. Do not create arbitrary application retry loops around semantics already supplied by Pub/Sub or its client.
- In `BackgroundService`, keep the receive task observed, propagate shutdown, stop intake, allow bounded in-flight completion, and use a scope per unit of scoped work. Treat forced shutdown as potentially leaving unacknowledged work.
- Classify transient dependency failures separately from invalid messages and permanent business outcomes. Ensure any explicit retries are bounded, cancelable, observable, and safe for duplicate execution.
- Use structured logs and traces with message ID, ordering key, subscription, attempt/outcome, and correlation identifiers where safe. Do not log payloads, attributes containing secrets, or customer data by default.
- Use Application Default Credentials or workload/service identities in deployed environments. Do not embed or commit service-account keys; preserve emulator and repository configuration conventions.

Test publish completion/failure, bounded producer flow, shutdown flushing, successful ack, retryable nack/redelivery, duplicate delivery, idempotency, cancellation, subscriber flow-control limits, and dead-letter/poison behavior as applicable.

Read [references/client-patterns.md](references/client-patterns.md) when choosing client type, configuring a hosted subscriber, or tuning publisher/subscriber flow control and shutdown.
