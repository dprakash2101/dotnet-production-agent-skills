---
name: shared-code-impact
description: Assess and constrain changes to shared .NET components. Use before modifying shared helpers, middleware, extensions, DTOs/models, mappers, DI registration, auth, serialization, SDKs, or common libraries.
---

# Shared-code impact

Before editing shared code:

1. Search all usages, registrations, implementations, overrides, tests, serialization points, and externally exposed consumers that are reasonably discoverable.
2. Identify existing behavior each consumer may rely on, including legacy, customer, reseller, region, integration, sender, flag, and workflow variants.
3. Decide whether the requirement is truly global. If not, prefer a scoped branch, strategy, adapter, overload, configuration, or caller-specific transformation consistent with the codebase.
4. Preserve defaults and compatibility. Avoid silently broadening validation, mapping, logging, retries, or exception behavior.
5. Test the changed scenario and representative unaffected consumers, especially default behavior.

Existing unusual or duplicated code is not permission to clean it up. If impact cannot be bounded with available evidence, state the uncertainty before making a high-blast-radius change.
