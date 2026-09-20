# Pub/Sub .NET client decisions

Use the installed package documentation as the exact API contract.

## Client and lifetime

- `PublisherClient` and `SubscriberClient` are optimized for continuous processing, are expensive to create, and normally live for the application lifetime for a topic/subscription.
- For request-driven or CPU-throttled environments without continuous processing, assess the lower-level `PublisherServiceApiClient` or `SubscriberServiceApiClient` rather than assuming a streaming client is appropriate.
- Configure credentials through ADC, an attached workload identity, or the repository's approved credential provider. A local credential path is development configuration, not source code.

## Subscriber handler

Treat the handler result as a delivery decision, not as business success reporting:

- `Ack`: durable success or a deliberately terminal outcome whose redelivery would not help.
- `Nack`: processing did not reach a safe completion point and redelivery is appropriate.

Pub/Sub can redeliver even acknowledged work, so an acknowledgement is not a substitute for idempotency. If exactly-once delivery is enabled, still reason about application retries and side effects outside the Pub/Sub acknowledgement boundary.

## Publisher completion and shutdown

Treat the task returned for a published message as the observable delivery result from the client. Await it or retain and observe it through an established bounded pipeline. A process that exits with unobserved or queued publishes can lose work.

Batching trades latency for throughput. Publisher-side flow control must bound queued messages/bytes according to memory and upstream backpressure requirements. Ordering keys serialize affected work and change failure/retry behavior; use them only when ordering is part of the contract.

During graceful shutdown, stop intake and give the publisher a bounded opportunity to complete queued work through the client-supported shutdown/disposal mechanism. Record failed or unresolved outcomes without logging payloads.

## Subscriber flow control and shutdown

Set outstanding element and byte limits from handler latency, memory, and downstream capacity. Account for the client library's stream behavior rather than assuming a configured fetch value is a process-wide hard cap.

On shutdown, stop receiving new work and choose deliberately between waiting for processing and promptly nacking in-flight messages. Align host shutdown timeout with client shutdown/disposal settings. Observe and report unrecoverable receive-task faults.
