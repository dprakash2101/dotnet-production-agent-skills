---
name: dotnet-security
description: Threat-model, implement, or review security-sensitive .NET and ASP.NET Core behavior. Use for authentication, authorization, secrets, untrusted input, uploads, outbound URLs, cryptography, or an explicit security review; not for routine style review.
---

# .NET security

Identify assets, trust boundaries, actors, entry points, and plausible abuse cases before changing controls. Follow the repository's established identity, authorization, secret, data-protection, validation, and audit patterns.

- Authorize the specific action and resource server-side; never trust client-provided ownership, tenant, role, price, path, or redirect data.
- Validate untrusted input at the boundary and encode for the output context. Use parameterized database APIs; avoid dynamic SQL, command, template, and expression construction from input.
- For outbound requests, constrain schemes/hosts and protect against SSRF, redirect bypasses, and access to internal/metadata endpoints.
- For files, enforce size/type/name/path rules, generate safe storage names, keep uploads outside executable/static roots unless intended, and apply the established malware/content checks.
- Use platform cryptography and data-protection/key-management APIs. Do not invent algorithms, embed keys, log tokens, or return sensitive exception details.
- Preserve secure cookie, CORS, CSRF, HTTPS, proxy/header, and authentication middleware behavior. Do not broaden origins or disable validation to solve integration errors.
- Bound expensive operations and apply rate/abuse controls where risk requires them. Avoid unsafe polymorphic deserialization and over-posting.

Test both allowed and denied paths, tenant/resource isolation, missing/invalid credentials, and relevant malformed input. Report unresolved assumptions and recommend deterministic controls such as secret scanning, dependency scanning, and authorization integration tests.
