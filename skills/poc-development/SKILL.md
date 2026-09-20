---
name: poc-development
description: Build a clearly identified .NET proof of concept or experiment to test technical feasibility. Use only when the user or repository context explicitly marks the work as POC, spike, prototype, or experimental.
---

# POC development

Define the hypothesis, success criteria, time/scope boundary, and what evidence the experiment must produce. Build the smallest representative vertical slice and keep experimental code isolated from production paths where practical.

Unit tests and production hardening are optional for a POC. Prioritize executable evidence, integration feasibility, important constraints, and reproducible setup. Still avoid credentials, unsafe destructive actions, and unrelated repository changes.

Label shortcuts and unknowns: security, resilience, error handling, scalability, observability, migration, compatibility, operations, and test gaps. Do not silently classify ordinary work as a POC to avoid tests.

If the result is promoted to production, reassess architecture and contracts, remove shortcuts, add normal automated tests and validation, and review the result as production code rather than incrementally blessing the prototype.
