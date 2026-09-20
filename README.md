# .NET Production Agent Skills

A vendor-neutral Agent Skills library for production .NET and ASP.NET Core work, with a small TypeScript installer for Codex, GitHub Copilot, Claude Code, and Cursor.

The repository has one source of truth:

```text
skills/ (canonical Agent Skills)
  -> TypeScript install/sync adapter
     -> host discovery directories
```

Canonical skills use the portable [`SKILL.md` format](https://agentskills.io/specification). They deliberately avoid vendor-only tool permissions and invocation metadata. Host-specific behavior is confined to installation paths, so guidance is maintained once rather than copied into four trees.

The core invariant is: implement the requested behavior without changing unrelated behavior. Task size changes investigation and validation depth, not safety standards.

## Skills catalog

| Skill | Focus |
| --- | --- |
| `task-router` | Select the smallest appropriate engineering workflow when the path is unclear. |
| `context-reset` | Reorient safely when a new instruction replaces work in progress. |
| `safe-terminal` | Run and recover from shell commands without broad or accidental mutation. |
| `dotnet-architecture` | Preserve or design boundaries for substantial .NET changes. |
| `dotnet-implementation` | Implement scoped production .NET behavior in an existing codebase. |
| `bug-investigation` | Trace a symptom to a demonstrated root cause before proposing a fix. |
| `shared-code-impact` | Find consumers and constrain changes to shared components. |
| `api-contract-safety` | Protect observable HTTP and public interface behavior. |
| `aspnet-core-api-development` | Create customer-facing APIs with thin endpoints, validation, services, and stable responses. |
| `api-endpoint-deprecation` | Manage endpoint deprecation, migration, usage verification, approval, and removal. |
| `exception-handling` | Set recovery, translation, cancellation, and logging boundaries for general .NET exceptions. |
| `production-logging` | Produce useful, structured, sensitive-data-safe, cost-aware production logs. |
| `code-quality` | Apply Clean-as-You-Code, analyzer, and Sonar expectations to changed code. |
| `unit-testing` | Maximize useful behavioral confidence without duplicate or slow tests. |
| `targeted-validation` | Progress from narrow checks to broader validation in proportion to risk. |
| `diff-review` | Audit the final diff for scope, regressions, secrets, and accidental changes. |
| `git-workflow` | Perform explicitly requested branch, stage, commit, and push operations safely. |
| `production-hotfix` | Minimize blast radius for an explicitly identified production incident. |
| `poc-development` | Build a bounded experiment to answer a defined technical question. |
| `code-review` | Report prioritized correctness, regression, security, and test findings. |
| `ef-core-safety` | Protect EF Core query, `DbContext`, transaction, and migration behavior. |
| `relational-database-dotnet` | Guide ADO.NET/provider access for PostgreSQL and Oracle. |
| `google-cloud-pubsub-dotnet` | Build production publishers and pull subscribers with correct delivery semantics. |
| `google-bigquery-dotnet` | Query BigQuery safely with parameterization, correct types, pagination, and cost awareness. |
| `google-firestore-dotnet` | Model and access Firestore documents with concurrency, index, and read-cost awareness. |
| `distributed-workflows` | Handle retries, idempotency, background work, and partial failure across systems. |
| `dependency-management` | Add, remove, assess, or upgrade .NET/NuGet dependencies conservatively. |
| `production-debugging` | Diagnose production-like failures from safe operational evidence. |
| `dotnet-security` | Threat-model and protect sensitive .NET trust boundaries. |

Descriptions are intentionally narrow so an ordinary controller task does not load Pub/Sub, BigQuery, Firestore, PostgreSQL, and Oracle guidance.

## Composition and progressive context

Hosts initially discover only skill names and descriptions. A matching task loads its concise `SKILL.md`; detailed references load only when the active scenario needs them.

The cloud/database layout follows that rule:

```text
google-cloud-pubsub-dotnet/
  SKILL.md
  references/client-patterns.md
google-bigquery-dotnet/
  SKILL.md
  references/query-safety.md
google-firestore-dotnet/
  SKILL.md
relational-database-dotnet/
  SKILL.md
  references/postgresql.md
  references/oracle.md
```

Provider skills own only provider behavior. They compose with `production-logging`, `exception-handling`, `unit-testing`, or `distributed-workflows` when those concerns are actually present instead of repeating generic rules. `relational-database-dotnet` shares common ADO.NET safety while loading only the PostgreSQL or Oracle reference required. EF Core tasks continue to use `ef-core-safety`, adding the provider skill only when provider-specific behavior matters.

Typical compositions include:

| Scenario | Suggested skills |
| --- | --- |
| Small defect | `bug-investigation` -> `dotnet-implementation` -> focused `unit-testing` -> diff/validation |
| New customer API | `aspnet-core-api-development` + `api-contract-safety` + `exception-handling` |
| Pub/Sub worker | `google-cloud-pubsub-dotnet` + `distributed-workflows` + logging/tests as needed |
| PostgreSQL ADO.NET change | `relational-database-dotnet` + PostgreSQL reference |
| EF Core provider issue | `ef-core-safety` + the relevant relational provider reference |

## Quality policy

### Sonar and Clean-as-You-Code

`code-quality` tells the agent to inspect repository-specific SonarCloud/SonarQube settings, analyzers, `.editorconfig`, nullable settings, suppressions, and language version before coding. Those rules take precedence over generic assumptions. New and materially changed code is designed proactively for reliability, security, maintainability, nullability, async/resource correctness, testability, low cognitive complexity, and meaningful duplication avoidance.

The skill follows Sonar's [Clean as You Code](https://docs.sonarsource.com/sonarqube-cloud/standards/about-new-code/) model: it does not turn an unrelated task into a cleanup of every historical finding. Before adding substantial logic, agents search the relevant scope for equivalent behavior. They reuse or extract a focused abstraction only when concepts genuinely match, after checking callers and preserving behavior.

### Unit-test optimization

`unit-testing` targets roughly 90–100% meaningful coverage of new or materially changed business logic where practical, not maximum test count. It prefers framework-supported parameterized tests for the same behavior across inputs, focused regression tests for fixes, observable behavior over implementation detail, and mocks only at meaningful boundaries. It avoids retesting framework behavior, duplicating the same branch, and excessive setup that increases CI time without confidence.

### Endpoint deprecation

`api-endpoint-deprecation` treats removal as an explicit breaking change:

```text
ACTIVE -> DEPRECATED -> MIGRATION WINDOW -> USAGE VERIFIED
       -> REMOVAL APPROVED -> REMOVED
```

The workflow considers versioning, metadata and headers, OpenAPI/developer documentation, replacement guidance, consumer communication, telemetry, compatibility, routing, and feature flags. It searches code, tests, documentation, and known internal consumers, but never equates "no repository reference" with "no external consumer." Actual deletion requires explicit direction or approval.

### Dependency management

`dependency-management` separates additions, unused-package removal, compatibility repair, security remediation, and upgrades. Removal checks direct and transitive use, tooling, analyzers, source generators, reflection/configuration loading, and test-only use—not just a text search. Upgrades target the smallest compatible version, review breaking changes and transitive conflicts, and do not blindly chase latest versions or warnings. Package sources, credentials, and private-feed authentication are never changed without explicit permission.

Database skills do not add custom retries merely because transient faults exist. Retry behavior is introduced only when requested or already required by the architecture, with idempotency, transaction boundaries, duplicate writes, timeouts, classification, bounded backoff/jitter, cancellation, and observability considered first. Provider/framework resilience is preferred over hand-written loops.

## TypeScript CLI

The runtime CLI is written in TypeScript, compiled to dependency-free Node.js ESM, and requires Node.js 18 or newer. It supports:

```text
install    install the packaged canonical skills
update     refresh managed skills and retire removed packaged skills
list       show packaged skills and installation state
doctor     validate canonical metadata and report installation health
uninstall remove only skills tracked by this package
```

The npm package name is `dotnet-production-agent-skills`; the installed executable is `dotnet-agent-skills`.

### Local checkout

The package is not published to npm yet. From a checkout:

```sh
npm install
npm run build
node dist/src/cli.js doctor --target all
node dist/src/cli.js install --target all --dry-run
node dist/src/cli.js install --target codex
```

After a future npm publication, the intended experience is:

```sh
npx dotnet-production-agent-skills install --target all
npx dotnet-production-agent-skills doctor --target copilot
npx dotnet-production-agent-skills update --target all
npx dotnet-production-agent-skills list --target cursor
npx dotnet-production-agent-skills uninstall --target claude
```

The shell and PowerShell wrappers invoke `install` from a built checkout:

```sh
./scripts/install-skills.sh --target all
./scripts/install-skills.ps1 --target all
```

### Targets and scope

| Target | User scope | Project scope |
| --- | --- | --- |
| `shared` / `codex` | `~/.agents/skills` | `<project>/.agents/skills` |
| `copilot` | `~/.copilot/skills` | `<project>/.github/skills` |
| `claude` | `~/.claude/skills` | `<project>/.claude/skills` |
| `cursor` | `~/.cursor/skills` | `<project>/.cursor/skills` |
| `all` | shared `.agents` plus `.claude` | project `.agents` plus `.claude` |

User scope is the default. Use `--scope project` in the current directory or `--project /path/to/repository`. Other options are `--mode copy|link`, `--dry-run`, `--force`, `--yes`, and `--json` for `list`/`doctor`.

`all` minimizes copies by using `.agents/skills` for Codex, Copilot, and Cursor and `.claude/skills` for Claude Code. Because Copilot and Cursor can also scan Claude-compatible locations, a host may discover the same skill twice when both trees are visible. Prefer a single explicit target when deterministic host-specific discovery matters.

### Conservative installation behavior

Copy mode is the default: it works across Windows, macOS, and Linux and does not leave an `npx` installation pointing into an ephemeral package cache. Link mode is opt-in and best suited to a persistent local checkout; symlink/junction permissions and host support vary.

The CLI records managed paths and content digests in `.dotnet-agent-skills.json`. It does not silently overwrite an unmanaged path or a locally modified managed skill. Conflicts stop the command unless `--force` is supplied; interactive force asks for confirmation, and non-interactive force also requires `--yes`. Replaced conflicts are moved to a timestamped backup. `update` also detects skills removed from the package, and `uninstall` removes only tracked installations while protecting modified content. Use `--dry-run` before a material install, update, or removal.

## Compatibility

Compatibility below distinguishes the portable skill format from discovery-path adaptation. It reflects the linked documentation as reviewed for this repository; agent products evolve, so verify current host behavior before publishing or changing installation defaults.

| Agent | Natively supported | Supported through this adapter | Unsupported or documented limits |
| --- | --- | --- | --- |
| [OpenAI Codex](https://developers.openai.com/docs/build-skills) | Portable `SKILL.md` skills in project/user `.agents/skills`; documented symlink discovery. | CLI installs canonical skills into the native location by copy or link. | Broad marketplace-style distribution may be better served by Codex plugins; this package does not add vendor-specific plugin metadata. |
| [GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) | Agent Skills in project `.github/skills`, `.agents/skills`, and compatible locations; personal support depends on the Copilot surface. | CLI chooses `.github/skills` for project scope and `.copilot/skills` for user scope, or shares `.agents/skills` via `all`. | Discovery and personal-skill behavior vary across Copilot surfaces; this repository does not claim every IDE/cloud surface loads every location or follows symlinks. GitHub's `gh skill` ecosystem is a separate distribution option. |
| [Claude Code](https://code.claude.com/docs/en/skills) | The same `SKILL.md` shape in project/user `.claude/skills`; documented symlinked skill directories. | CLI copies or links the canonical `skills/` tree into `.claude/skills`. | `.agents/skills` is not documented as a Claude Code discovery path. Personal local skills are not automatically available in every Claude cloud/Cowork context; committed project skills are the portable route there. |
| [Cursor](https://cursor.com/docs/skills) | Agent Skills in `.agents/skills` and `.cursor/skills`, with documented compatibility discovery for other agent directories. | CLI uses `.cursor/skills` for an explicit target or shared `.agents/skills` for `all`. | Only Cursor's own user-level skill location is documented for Cursor cloud synchronization; `.agents` should be treated as local unless current docs say otherwise. Symlink behavior is not claimed where undocumented. |

No row claims behavioral equivalence across model hosts: selection, tool access, context limits, and higher-priority instructions remain host-controlled.

The implementation guidance was also checked against primary documentation for [Google Cloud Pub/Sub for .NET](https://docs.cloud.google.com/dotnet/docs/reference/Google.Cloud.PubSub.V1/latest), [BigQuery for .NET](https://docs.cloud.google.com/dotnet/docs/reference/Google.Cloud.BigQuery.V2/latest/Google.Cloud.BigQuery.V2.BigQueryClient), [Firestore for .NET](https://docs.cloud.google.com/dotnet/docs/reference/Google.Cloud.Firestore/latest/Google.Cloud.Firestore.FirestoreDb), [Npgsql](https://www.npgsql.org/doc/basic-usage.html), [Oracle ODP.NET asynchronous programming](https://docs.oracle.com/en/database/oracle/oracle-database/26/odpnt/featAsyncPipelining.html), [`IHttpClientFactory`](https://learn.microsoft.com/en-us/dotnet/core/extensions/httpclient-factory), [.NET dependency-injection lifetimes](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes), and [ASP.NET Core hosted services](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/host/hosted-services).

## Additional .NET skills worth considering

The current library already covers cancellation propagation, async/sync-over-async, `HttpClientFactory`, DI lifetimes, scoped services in `BackgroundService`, graceful shutdown, concurrency, idempotency, EF Core query shape/N+1 risks, pagination, configuration, dates, and nullable references within focused existing skills. Splitting each topic into a standalone skill would create noisy triggering and duplicate context.

Three future skills have enough distinct workflow to consider after observing repeated demand:

- `dotnet-observability`: coordinate OpenTelemetry traces, metrics, baggage/correlation, health checks, sampling, and service-level signals. This is broader than logging and benefits from an end-to-end instrumentation workflow.
- `dotnet-performance-diagnostics`: measure allocations, GC, thread-pool starvation, contention, and hot paths before optimizing. A measurement-first workflow would guard against speculative micro-optimization.
- `configuration-and-feature-rollout`: handle options validation, secrets references, feature flags, staged rollout, rollback, and startup failure policy when repositories repeatedly need release-safety work.

These are recommendations, not implemented skills. Add them only when real tasks justify distinct triggering and reusable instructions.

## Validation and maintenance

Validate canonical skills and the TypeScript package with:

```sh
python3 scripts/validate_skills.py
npm test
npm run validate
npm pack --dry-run
```

Keep universal instructions small; [`global-instructions/AGENTS.md`](global-instructions/AGENTS.md) is a minimal template. Put a rule in one owning skill and refer to it elsewhere instead of copying it. Add a new skill only for a distinct workflow, keep references one level below `SKILL.md`, and inspect the final repository diff before release.

Skills guide agent behavior but cannot guarantee selection or compliance. Use CI builds/tests/analyzers, API contract tests, secret scanning, protected branches, required review, least-privilege credentials, deployment gates, database permissions, and sandbox/approval policy for deterministic enforcement.
