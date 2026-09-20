---
name: targeted-validation
description: Choose and run proportionate validation after a coherent code change. Use near completion of implementation, fixes, refactors, or dependency changes; not after every edit.
---

# Targeted validation

Validate after a coherent implementation and diff inspection. Choose the lowest-cost command that provides relevant confidence, then broaden only for risk, dependency reach, or failures:

```text
affected test(s) -> affected test project -> affected project build -> solution build/test
```

Use repository-provided scripts and CI-equivalent options when available. Include analyzers, formatting, contract/integration tests, coverage, or packaging only when the change or project workflow calls for them. A targeted compile during implementation is reasonable when it resolves real uncertainty.

Do not repeatedly run an unchanged expensive suite. Do not fix unrelated failures. Re-run only validation invalidated by subsequent edits.

Report exact commands and outcomes. For failures, distinguish caused-by-change, pre-existing/unrelated, and inconclusive/environmental results, with concise evidence. Never claim success for a check that was not run.
