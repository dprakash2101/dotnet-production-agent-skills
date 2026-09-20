---
name: bug-investigation
description: Diagnose a .NET defect from symptom to root cause and minimal fix. Use for unexpected behavior, exceptions, regressions, data loss, or production defects; diagnosis alone does not authorize code changes.
---

# Bug investigation

Follow: symptom -> flow -> data -> divergence -> root cause -> minimal fix -> impact check -> validation.

1. Restate the observed and expected behavior, conditions, evidence, and affected scope. Distinguish facts from hypotheses.
2. Reproduce when practical or identify the narrowest trustworthy evidence. Do not edit from an error message alone.
3. Trace the actual execution path from entry point through the relevant service and integration/data boundary.
4. For data or mapping defects, follow the value through request DTO -> mapper -> domain model -> business logic -> outgoing model/external system. Find the exact transition where it changes or disappears.
5. Test competing hypotheses with targeted inspection, logs, or tests. Identify cause, not merely the line that throws.
6. Search callers before changing shared code. Determine whether the behavior is global or flow-specific.
7. If implementation is authorized, make the smallest fix that addresses the cause and add a regression test when practical.

Do not fix unrelated warnings or failures. Report uncertainty, reproduction gaps, and unrelated failures explicitly.
