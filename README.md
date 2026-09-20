# .NET Engineering Agent Skills

A portable, composable Agent Skills library for careful day-to-day .NET and ASP.NET Core engineering in existing production systems.

The library's invariant is simple:

> Implement the requested behavior without changing unrelated behavior.

Task size changes investigation depth and validation breadth, not safety standards.

## Format and compatibility

Each skill is a lowercase directory under `skills/` containing a `SKILL.md` with required `name` and `description` frontmatter. Conditional detail lives in linked `references/` files. This is the portable subset of the [Agent Skills specification](https://agentskills.io/specification), which is used by [Codex](https://developers.openai.com/docs/build-skills) and supported by [GitHub Copilot](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills).

The repository intentionally omits host-specific `allowed-tools` and invocation metadata. This keeps authorization with the host and makes the same skill folders usable across agents.

## Skills

| Skill | Purpose | Typical automatic relevance |
| --- | --- | --- |
| `task-router` | Selects a proportionate workflow without lengthy classification. | Ambiguous or multi-part engineering requests |
| `context-reset` | Drops obsolete intent when the user redirects in-progress work. | A new instruction replaces the active objective |
| `safe-terminal` | Prevents unsafe shell recovery and handles malformed commands. | CLI failures, destructive commands, environment/tool troubleshooting |
| `dotnet-architecture` | Preserves or designs controller/service/integration boundaries. | Major features, new APIs/integrations, architecture decisions |
| `dotnet-implementation` | Implements scoped production .NET changes safely. | Features, enhancements, fixes after diagnosis, requested refactors |
| `bug-investigation` | Traces symptoms and data to a demonstrated root cause. | Bugs, regressions, exceptions, incorrect mappings/data |
| `shared-code-impact` | Finds consumers and constrains shared-component changes. | Helpers, middleware, models, mappers, DI, auth, serialization |
| `api-contract-safety` | Protects observable HTTP and public interface behavior. | Routes, DTOs, JSON, status codes, enums, auth, versioning |
| `code-quality` | Applies Clean-as-You-Code and modern C# quality practices. | Requested quality work or final implementation polish |
| `unit-testing` | Adds meaningful tests for changed production behavior. | New business logic, branches, and regression fixes |
| `targeted-validation` | Chooses the narrowest useful test/build progression. | Completion of code-changing work |
| `diff-review` | Audits the final diff for scope and accidental changes. | Before declaring implementation complete or staging |
| `git-workflow` | Safely branches, stages, commits, and pushes. | Explicit Git requests only |
| `production-hotfix` | Optimizes urgent fixes for predictability and low blast radius. | Explicit incidents/hotfixes |
| `poc-development` | Tests feasibility with clearly bounded production exceptions. | Explicit POCs, spikes, prototypes, experiments |
| `code-review` | Reports concrete, prioritized .NET review findings. | Review/PR/diff requests |
| `ef-core-safety` | Protects query, DbContext, transaction, and migration behavior. | EF Core persistence changes or investigations |
| `distributed-workflows` | Handles retries, idempotency, messages, and background work. | Cross-service flows, queues, hosted services, duplicate execution |
| `dependency-upgrades` | Controls NuGet/framework upgrade and supply-chain risk. | Package, SDK, framework, or vulnerability upgrades |
| `production-debugging` | Uses production evidence safely without implying mutation authority. | Live/production-like diagnosis |
| `dotnet-security` | Threat-models and checks sensitive .NET trust boundaries. | Auth, untrusted input, uploads, outbound URLs, secrets, explicit security work |

Descriptions are deliberately discriminating. High-frequency instructions stay short; `dotnet-implementation` and `dotnet-architecture` link to topic detail that should be read only when relevant.

## Composition examples

Skills are selected by relevance, not loaded as a mandatory bundle.

| Scenario | Suggested composition |
| --- | --- |
| Small bug | `bug-investigation` -> `dotnet-implementation` -> `unit-testing` -> `diff-review` -> `targeted-validation` |
| Minor enhancement | `dotnet-implementation` + `api-contract-safety` or `shared-code-impact` only if touched -> tests/review/validation |
| Major feature | `dotnet-architecture` -> `dotnet-implementation` + domain-specific skill(s) -> `unit-testing` -> `diff-review` -> `targeted-validation` |
| Production hotfix | `production-hotfix` + `bug-investigation` -> narrow implementation/regression test -> diff/targeted validation |
| POC | `poc-development`; add architecture/integration guidance only where it helps answer the hypothesis |
| Git commit/push | Complete `diff-review` and `targeted-validation`, then use `git-workflow`; push only when explicitly requested |

`task-router` is useful when the path is unclear, but agents should skip it when the request already maps cleanly to a workflow.

## Context and token efficiency

The library uses progressive disclosure in three layers:

1. Hosts initially see only each skill's name and precise description.
2. A matching task loads only that skill's concise `SKILL.md`.
3. Detailed references load only for the active topic.

The workflows tell agents to start at the relevant entry point, trace the actual call path, keep a small file working set, search usages before shared edits, avoid repeated reads/searches/builds, and shrink the working set after redirection. Major tasks may expand based on evidence; localized tasks should not trigger repository-wide exploration.

## Install and synchronize

Validate the checkout first:

```sh
python3 scripts/validate_skills.py
```

Install symlinks into the shared personal location discovered by current Codex and GitHub Copilot:

```sh
./scripts/install-skills.sh
```

Symlink mode is the default and is the recommended synchronization strategy: pull updates in this central repository and every installed skill immediately points at the new version. Existing conflicts are never overwritten silently.

Other options:

```sh
# Copilot-specific personal location
./scripts/install-skills.sh --host copilot

# Repository-scoped installation
./scripts/install-skills.sh --target /path/to/repository/.agents/skills

# Independent snapshot rather than symlinks
./scripts/install-skills.sh --target /path/to/repository/.agents/skills --mode copy
```

Use `--force` only deliberately: the installer moves each conflict to a timestamped backup before installing. Run the validator in CI to prevent invalid skill metadata or broken local links from being merged. Copied installations do not auto-update; rerun with `--force` after reviewing central changes, or use a normal vendoring/subtree process when repositories require pinned reviewable versions.

For GitHub Copilot, `.agents/skills`, `.github/skills`, and personal `~/.copilot/skills` are supported discovery locations. Codex supports repository or personal `.agents/skills` and follows symlinked skill directories. Host behavior evolves, so review the linked official documentation before changing distribution conventions.

## Minimal global instructions

Skills are loaded conditionally, so a few invariants that must apply to every task belong in global/repository instructions. A deliberately small template is provided at [`global-instructions/AGENTS.md`](global-instructions/AGENTS.md). Copy or merge it into the target repository's applicable `AGENTS.md`; for Copilot-only repositories, adapt the same five rules into `.github/copilot-instructions.md`.

Keep only universal guardrails global: preserve unrelated behavior, inspect shared impact, preserve architecture/contracts, review/validate the diff, and require authorization for Git/destructive/tool-configuration actions. Detailed .NET rules should remain skills so they do not consume every task's context.

## Limits

Agent Skills guide model behavior; they cannot technically guarantee compliance. A host may fail to select a relevant skill, truncate discovery metadata, interpret instructions differently, lack required tools, or be overridden by higher-priority instructions. Skills also cannot prove undiscoverable downstream consumers, make unit tests complete, enforce branch protection, grant permissions, or prevent every unsafe command.

Use deterministic controls for hard guarantees: CI builds/tests/analyzers, API contract tests, secret scanning, protected branches, required reviews, least-privilege credentials, deployment gates, database permissions, and sandbox/approval policies. Keep the small global guardrails for invariants that should not depend on skill routing.

## Maintenance

- Keep each description specific enough to avoid accidental activation.
- Put a rule in one owning skill; link or name that skill instead of copying its full text.
- Add a separate skill only for a distinct reusable workflow.
- Keep references one level below `SKILL.md` and load them conditionally.
- Validate, inspect the repository diff, and test installer changes before release.
- Revise from observed failures; do not accumulate speculative universal rules.
