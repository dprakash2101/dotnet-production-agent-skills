---
name: exception-handling
description: Design or review .NET exception handling, including catch boundaries, recovery, translation, cancellation, and logging ownership. Use when adding or changing exception paths or centralized handlers; load the API reference only for customer-facing HTTP boundaries.
---

# .NET exception handling

Follow the repository's exception taxonomy and handling boundaries. Catch only when the current layer can recover, translate to its own contract, add safe context, perform required cleanup, or make a deliberate retry decision. Otherwise allow the exception to propagate to the owning boundary.

Do not swallow failures, use `catch (Exception)` throughout the call stack, throw generic exceptions for expected domain outcomes, or use exceptions for normal control flow. Preserve the original stack with `throw;` when rethrowing. Wrap only when the new exception adds a meaningful abstraction and retain the original as `InnerException`.

Distinguish validation/domain failures, authentication/authorization, missing resources, conflicts, cancellation, timeouts, transient dependency failures, permanent dependency failures, and unexpected defects. Do not convert caller cancellation into an error. Keep cleanup exception-safe with `using`/`await using` or `finally` where ownership requires it.

Define one layer to own final exception logging. A lower layer may log a failure it fully handles or add diagnostic context, but avoid logging and rethrowing the same exception at every layer. Include the exception object in structured internal logs and keep correlation/trace identifiers.

Test recovery, propagation, translation, cleanup, and cancellation behavior at the owning boundary. For a customer-facing HTTP API, read [references/customer-facing-api.md](references/customer-facing-api.md) before designing or changing its exception mapping.
