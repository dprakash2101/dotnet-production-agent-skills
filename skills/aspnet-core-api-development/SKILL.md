---
name: aspnet-core-api-development
description: Use when building a new ASP.NET Core customer-facing API endpoint or version, including routing, header and request validation, service boundaries, authorization, error responses, and OpenAPI. Use api-contract-safety when modifying an existing contract.
---

# New customer-facing ASP.NET Core APIs

Follow the repository architecture, endpoint style, validation framework, error contract, authorization model, serialization, versioning, and OpenAPI conventions first. When no established pattern conflicts, keep the conceptual flow:

```text
Request -> middleware/authentication -> controller/endpoint -> transport validation
        -> service/business logic -> integration/data access -> response
```

Keep controllers/endpoints thin: bind and validate transport input, apply authorization integration, invoke a service, and translate the result. Put business rules in the application/domain layer and persistence or remote SDK calls behind the established integration/data-access boundary.

## Headers

For required headers, distinguish missing, empty/whitespace, malformed, too long, and unsupported values. Validate correlation IDs and country/site/environment headers against the actual contract and trust boundary. Reuse or create a focused filter, middleware, binder, or validator when the same header policy genuinely spans endpoints; do not scatter duplicate controller checks or make flow-specific policy global.

## Request and response contracts

Validate required/null/empty values, lengths, formats, ranges, enum values, nested objects, collection size/items, and cross-field rules. Keep transport-shape validation separate from deeper business decisions when that improves ownership and reuse. Do not trust client-supplied identity, tenant, role, price, or ownership fields.

Return the established stable customer-facing validation and error shape. Never expose implementation details. Preserve declared status codes, content types, JSON names/null behavior, pagination limits, date/time semantics, and backward compatibility. Add OpenAPI metadata and examples only through the repository's established mechanism.

Propagate cancellation through service and I/O boundaries. Apply rate limits, idempotency, feature flags, health behavior, and telemetry only when the endpoint's requirements or repository architecture call for them.

Test observable HTTP behavior: valid request, header/request validation, authorization boundaries, important business outcomes, sanitized failures, serialization, and cancellation where relevant. Always compose with `api-contract-safety` and `exception-handling` for the public contract and failure boundary. Load `production-logging` and provider-specific skills only when those concerns are part of the endpoint.
