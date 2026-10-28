---
name: observability-dotnet
description: Use when designing or reviewing .NET metrics, distributed traces, OpenTelemetry propagation, sampling, redaction, or operational alerts.
---

# Observability Dotnet

Inspect existing telemetry instrumentation, exporter configuration, service naming, sampling and retention conventions first. Identify the operational question and who will act on the signal.

- Propagate trace context across HTTP and messaging boundaries using established instrumentation. Use bounded, meaningful spans and avoid duplicating framework instrumentation.
- Define metrics for actionable throughput, failure, latency and saturation; avoid customer IDs, request IDs, URLs with unbounded values, and other high-cardinality metric labels.
- Never record secrets or raw sensitive payloads in logs, traces, metrics, baggage or exception attributes. Follow approved redaction and retention policies.
- Select sampling and alerts based on volume, severity and cost; ensure critical failure signals remain observable. Test propagation and sensitive-data exclusion where changed.
