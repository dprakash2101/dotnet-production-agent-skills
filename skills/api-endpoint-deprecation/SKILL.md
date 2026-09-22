---
name: api-endpoint-deprecation
description: Use when planning, implementing, or reviewing API deprecation, replacement versions, sunset headers, migration windows, consumer verification, or endpoint removal.
---

# Safe API endpoint deprecation

Treat endpoint removal as a breaking change. A replacement endpoint does not authorize deleting the old one. Use the repository's API governance and a lifecycle such as:

```text
ACTIVE -> DEPRECATED -> CUSTOMER MIGRATION WINDOW -> USAGE VERIFICATION
       -> REMOVAL APPROVED -> REMOVED
```

When deprecating, identify the replacement and compatibility differences. Apply supported API versioning, OpenAPI/developer-portal deprecation metadata, response headers where appropriate, migration documentation, routing/feature-flag strategy, customer/consumer communication, and a realistic sunset window.

Before proposed removal:

- search routes, clients, tests, docs, generated SDKs, gateway/configuration, and internal repository references;
- identify known internal and external consumers and owners;
- inspect usage telemetry, access logs, dashboards, and monitoring over the agreed window where available;
- confirm the replacement is deployed, documented, and functionally sufficient;
- define rollback/compatibility handling and obtain the required product/API-owner approval.

No code reference is not proof that no customer calls the endpoint. Do not remove the route, DTOs, handlers, tests, or documentation without explicit user direction to perform removal. A request to add or document a replacement alone is insufficient.

During removal, preserve unrelated versions/routes, update contract tests and generated artifacts through established workflows, and verify the retired route behavior intentionally. Record approval and evidence in the repository's normal change process rather than inventing a new governance system.
