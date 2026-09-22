---
name: unit-testing
description: Use when adding or improving focused .NET unit tests for changed business behavior or regression fixes. Prefer parameterized cases and avoid trivial redundant tests that increase CI time.
---

# .NET unit testing

Follow the test framework, assertion style, mocking library, naming, fixture, and data-builder conventions already present. Do not introduce a competing framework without necessity.

Aim for roughly 90-100% meaningful coverage of new or materially changed testable production business logic when practical, not the legacy repository. Coverage is a signal: maximize useful behavioral confidence with maintainable tests and reasonable CI time, not raw test count or percentage.

Cover applicable happy paths, validation, boundaries, null/empty cases, important branches, error behavior, and customer/region/flow-specific conditions. When shared behavior changes, verify both changed and representative unchanged consumers.

For a bug, first add a test that reproduces the failure when practical, then verify it passes after the fix. Test observable outcomes and collaborations at stable boundaries rather than private implementation details. Keep tests deterministic; control time, randomness, environment, and external I/O through existing seams.

When several cases exercise the same behavior with different inputs, use the repository framework's parameterized form—such as xUnit `Theory`, NUnit `TestCase`, or MSTest `DataRow`. Keep failure cases legible. Do not combine unrelated scenarios into one giant data-driven test merely to reduce method count.

Do not repeatedly test framework behavior, duplicate the same branch through implementation details, or add assertions that cannot catch a meaningful regression. Mock only meaningful boundaries and avoid excessive setup; prefer real value objects and pure collaborators where cheap.

Run the narrowest affected test first. Consider CI cost before adding slow combinations, large fixtures, or redundant integration coverage. Do not rewrite unrelated tests or mask a product defect by weakening assertions.

For a clearly user- or repository-identified POC, tests are optional; validate feasibility instead. Restore normal test expectations when experimental code becomes production code.
