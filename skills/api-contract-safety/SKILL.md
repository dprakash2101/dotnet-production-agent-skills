---
name: api-contract-safety
description: Use when changing or reviewing existing API routes, versions, verbs, headers, request/response DTOs, serialization, status codes, error shapes, authorization, or public interfaces.
---

# API contract safety

Treat routes, verbs, headers, query/path parameters, request and response schemas, JSON names, serialization rules, status codes, error bodies, enums, auth requirements, and public interfaces as contracts.

Before editing, locate controller/endpoint definitions, DTOs, serializers/converters, validators, OpenAPI generation, clients, contract/integration tests, and known consumers. Record current observable behavior, including defaults, optionality, casing, null handling, and error responses.

Prefer additive, backward-compatible changes. Do not rename/remove fields, change type or meaning, make optional input required, alter enum wire values, change status/error behavior, or tighten auth unless required. Distinguish missing, null, empty, and default values when clients can observe the difference.

When a breaking change is unavoidable, identify affected consumers and use the repository's versioning/migration/deprecation approach. Test serialized wire behavior and representative failures, not only C# object equality. Update API documentation/generated clients only when part of the repository's established workflow.
