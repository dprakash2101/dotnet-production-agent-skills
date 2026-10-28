---
name: performance-diagnostics-dotnet
description: Use when investigating or improving measured .NET performance, allocations, garbage collection, thread-pool starvation, latency, or throughput.
---

# Performance Diagnostics Dotnet

Establish the workload, baseline, target, environment and measurement method before changing code. Separate CPU, allocation/GC, contention, thread-pool, database and external dependency hypotheses using evidence.

Use existing profiling tools and representative workloads. Choose bounded diagnostic collection appropriate to the environment; production dump capture may include sensitive data and requires appropriate authorization. Compare like-for-like measurements and account for warmup, variability and collection overhead.

Change the smallest proven bottleneck while preserving behavior. Verify correctness and measure again. Avoid speculative micro-optimizations, premature pooling, or adding complexity unsupported by measured benefit. Report measurements, environment and residual uncertainty.
