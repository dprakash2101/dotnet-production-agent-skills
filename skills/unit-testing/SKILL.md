---
name: unit-testing
description: Add or improve focused automated tests for production .NET behavior. Use for new or materially changed testable business logic and regression fixes; optional for explicitly identified POCs.
---

# .NET unit testing

Follow the test framework, assertion style, mocking library, naming, fixture, and data-builder conventions already present. Do not introduce a competing framework without necessity.

Aim for roughly 90-100% coverage of new or materially changed testable business logic, not the legacy repository. Coverage is a signal: prefer meaningful behavioral assertions over tests written only to increase a number.

Cover applicable happy paths, validation, boundaries, null/empty cases, important branches, error behavior, and customer/region/flow-specific conditions. When shared behavior changes, verify both changed and representative unchanged consumers.

For a bug, first add a test that reproduces the failure when practical, then verify it passes after the fix. Test observable outcomes and collaborations at stable boundaries rather than private implementation details. Keep tests deterministic; control time, randomness, environment, and external I/O through existing seams.

Run the narrowest affected test first. Do not rewrite unrelated tests or mask a product defect by weakening assertions.

For a clearly user- or repository-identified POC, tests are optional; validate feasibility instead. Restore normal test expectations when experimental code becomes production code.
