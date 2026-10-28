# Release notes

## Unreleased — Cross-tool terminal recovery

- Add an opt-in direct stdio MCP `run_process` tool to avoid interactive-terminal typing, managed project setup/removal, and session redirection after observed or suspected corruption.
- Add shared evidence-based diagnosis across command ecosystems, session-scoped unchanged-retry tracking, capability reporting, and an explicit shell-free command runner.
- Package and preserve the complete hook runtime bundle during updates and uninstall.
- Reject literal `^U`/Ctrl+U command prefixes with a `safe-terminal` correction message.
- Detect common explicit tool-installation directory selections in terminal arguments, navigation, and Git directory options; allow fully qualified executable invocation from the project.
- Install Copilot post-tool feedback for failed commands without copying raw output or executing replacement commands.
- Anchor Copilot hook execution to the repository root; migrate the exact previous generated handler while preserving customized handlers and unrelated hooks.
- Validation: TypeScript build and 37 skills passed; 79 automated tests passed and one Windows-only test was skipped on Linux. Coverage includes installed hook execution, migration, idempotency, uninstall, corrective messages, and allowed commands. Live Copilot activation remains untested.

## v0.4.0 — Safer hook management and expanded .NET skills

Prepared for release with [PR #15](https://github.com/dprakash2101/dotnet-production-agent-skills/pull/15); not yet published to npm.

### New

- Add six focused skills: `integration-testing-dotnet`, `http-client-integrations`, `observability-dotnet`, `performance-diagnostics-dotnet`, `background-services-dotnet`, and `deployment-readiness-dotnet`.
- Expand existing skills with practical guidance for contracts, migrations, diagnostics, distributed workflows, security, validation, and repository-specific conventions.

### Improved

- Recognize additional destructive command variants and JSON-encoded tool arguments in the project guard. Document that its checks are best-effort and depend on the host loading the hook.
- Preserve unrelated hook handlers and Copilot hook entries during updates. Detect modified guard scripts before replacing them, and remove only owned files during uninstall.
- Use the same YAML-based skill validation for the CLI and standalone validator, with checks for instruction bodies, description lengths, and linked resources.
- Make Jira naming and coverage expectations follow the repository's own policies instead of imposing fixed conventions.

### Compatibility and upgrade

- Existing targets, scopes, modes, and CLI options remain supported. Project hooks are a best-effort safeguard, not a sandbox; verify that your agent host loads and trusts them.
- Unmodified guards from the previous release migrate automatically. Customized or unrecognized guards without an ownership record require manual review; uninstall preserves untracked legacy scripts.
- After publication, update user skills with `npx dotnet-production-agent-skills@0.4.0 update --target all`. For a project installation, add `--scope project` and review local changes before updating.

### Validation

`npm run validate` passed: 37 skills validated and all 32 tests passed. Documentation catalog syntax and Git whitespace checks passed. Live agent-host activation was not tested.

## v0.3.3 — Strict coding-agent authorship rules

Prepared for release after PR #13 is merged; not yet published to npm.

### Improved

- Add an opt-in `git-hook` CLI command that installs a Git `commit-msg` hook rejecting case-insensitive `Co-authored-by:` lines in final commit messages. Respect `core.hooksPath`, support dry-run and explicit project paths, and preserve existing hooks without changing Git configuration.
- Strengthen the `git-workflow` skill, managed Copilot project instructions, and global engineering guardrails to prohibit `Co-authored-by:` trailers, equivalent co-author metadata, AI/agent signatures, and generated-by footers in commits and pull requests.
- Cover indirect attribution through commit trailers, templates, API fields, and Git author/committer identity overrides.
- Require inspection of complete proposed commit/PR messages before creation and new commits before pushing. If tooling inserts attribution, stop before publishing and report the blocker without bypassing hooks or rewriting existing commits.

### Compatibility and upgrade

- Existing CLI targets, scopes, flags, and copy/link modes are unchanged. Git hook installation is separate from skill installation and updates.
- After publication, run `npx dotnet-production-agent-skills@0.3.3 git-hook` inside each repository to opt in. Node.js must be available when Git runs. Existing hook managers require manual integration.
- The Git hook rejects co-author trailers locally; AI footers and PR text remain covered by agent instructions. API-created commits and hook bypasses require a server-side required check for merge enforcement.
- After publication, update installed skills with `npx dotnet-production-agent-skills@0.3.3 update --target all`. Add `--scope project` to refresh that project's managed Copilot instructions and installed skills. Review local edits before updating.

### Validation

`npm run validate` passed: all 31 skills validated, the TypeScript build passed, and all 23 tests passed. Git hook tests cover real commits with inline, file-based, and trailer-based messages, installer idempotency, conflict preservation, custom hook paths, and dry-run behavior. Whitespace checks passed.

## v0.3.2 — Repository-safe terminal recovery

Released in [`dotnet-production-agent-skills@0.3.2`](https://www.npmjs.com/package/dotnet-production-agent-skills/v/0.3.2).

### Improved

- Keep terminal commands anchored to the intended project. Never recover a failed project command by moving into Git or another tool's installation directory.
- Separate executable lookup from repository selection. Verify the intended Git root before mutations, preserve linked-worktree support, and inspect relevant Git overrides when an explicit project path selects an unexpected repository.
- Diagnose the submitted/executed command and first actionable error before retrying. Submit plain command text, preserve requested arguments, and avoid speculative shell, PATH, profile, configuration, or installation changes.
- Include the core recovery rules in managed Copilot project instructions and global engineering guidance, and connect Git workflows to `safe-terminal`.

### Documentation

- Add `references/shell-recovery.md` with PowerShell, Command Prompt, and Bash diagnostics, quoting/invocation examples, failure classification, and primary documentation sources.
- Advertise the reference in both the README and hosted skills catalog.
- Refresh the website release-notes page with clearer publication status and a new layout.

### Compatibility and upgrade

- CLI targets, scopes, flags, and copy/link modes are unchanged.
- These changes strengthen agent guidance; existing hooks do not enforce the new repository-directory recovery rules.
- Update installed skills with `npx dotnet-production-agent-skills@0.3.2 update --target all`. Run the update in project scope (`--scope project`) to refresh that project's managed Copilot instructions and installed skills. Review local edits before updating.

### Validation

`npm run validate` passed: 31 skills validated and 21 tests passed. Five recovery scenarios were evaluated independently as proposed commands; Windows commands were not executed on Windows. Catalog metadata, reference paths, and whitespace checks passed.

## v0.3.0 — Multi-agent hooks and Antigravity

### New

- Added `antigravity` as a first-class CLI target using `.agents/skills` and native project hooks in `.agents/hooks.json`.
- Project installs can now configure command guardrails for Codex, GitHub Copilot, Claude Code, Cursor, and Google Antigravity. `--target all --scope project` installs all five adapters.
- Added a shared, dependency-free guard script that blocks force-push, destructive Git operations, broad recursive deletion, and direct access to common credential-bearing files.
- `list` and `doctor` report each project hook installation. Updates are idempotent, unrelated existing hook entries are preserved, and uninstall removes only package-managed entries.

### Compatibility

- Existing targets, scopes, copy/link modes, dry runs, conflict handling, and managed Copilot instructions remain supported.
- Hooks are installed only for project scope. User-scope behavior is unchanged.

### Release pipeline

- GitHub release tags are authoritative for release-triggered npm publishes. A `v0.3.0` release aligns both package files to `0.3.0` before checking npm availability or publishing, even when the tagged commit still contains an already-published version.
- The workflow now fails early if the resolved tag version and `package.json` ever disagree, preventing an old package version from being checked or published accidentally.

## v0.3.1 — Safe terminal diagnostics

Released in [`dotnet-production-agent-skills@0.3.1`](https://www.npmjs.com/package/dotnet-production-agent-skills/v/0.3.1).

### Improved

- Updated `safe-terminal` to distinguish malformed or control-character input from an executable that is unavailable in the current shell.
- Added read-only executable lookup guidance for PowerShell, Command Prompt, and POSIX shells, plus evidence-based retry and environment-change safeguards.

## Unreleased — Redis caching skill

Proposed in [PR #6](https://github.com/dprakash2101/dotnet-production-agent-skills/pull/6); this change is not yet published to npm.

### New

- Added `redis-dotnet` guidance for .NET and ASP.NET Core Redis caching: key design, expiration, invalidation, concurrency, failure handling, and targeted validation.
- The skill prohibits plaintext credentials in Redis. Credential ciphertext must be bound to the cache key, trusted tenant/account, and credential purpose using authenticated associated data or equivalent purpose isolation, with encryption keys outside Redis. Tests must reject ciphertext copied to another key, tenant/account, or purpose.
- Added the skill to the README and website catalog.

## v0.2.0 — Copilot instructions and safer skill management

The implementation was merged in [PR #4](https://github.com/dprakash2101/dotnet-production-agent-skills/pull/4) and published as [`dotnet-production-agent-skills@0.2.0`](https://www.npmjs.com/package/dotnet-production-agent-skills/v/0.2.0). These notes document that release; the release notes page is a follow-up documentation change.

### New

- Copilot project installs manage an always-on engineering section in `.github/copilot-instructions.md`. Existing team instructions outside the managed markers remain intact; uninstall removes only the managed section.
- A `retry-resilience` skill covers explicitly requested retries and reviews of existing retry policies. Its guidance avoids introducing retries automatically.
- The CLI has a separate Copilot hooks interface for future command guardrails. No hooks are installed by this change.

### Improved

- Repeated installs skip unchanged managed skills. An updated packaged skill replaces an unchanged installed copy.
- Forced uninstall backs up locally edited managed skills and reports the backup path.
- `doctor` parses YAML frontmatter, accepts multiline descriptions, checks skill metadata and local references, reports packaged updates and Copilot instruction state, and exits nonzero for installation or validation errors.
- Skill descriptions now give agents clearer cues for selecting task-specific guidance. Copilot installation output includes skill discovery commands.
- CLI help displays the published executable name, `dotnet-production-agent-skills`.

### Compatibility and upgrade

- Targets (`all`, `shared`, `codex`, `copilot`, `claude`, `cursor`), user and project scopes, copy and link modes, and existing CLI flags remain supported.
- Copilot instructions are added only for project-scope Copilot installs (including `--target all --scope project`). User-scope Copilot installs continue to install skills in `~/.copilot/skills`.
- Review any local skill edits before updating. The CLI still requires `--force --yes` for noninteractive replacement of conflicts, with a backup of the replaced content.
- The CLI now depends on the `yaml` npm package. Install the package normally so npm resolves its runtime dependency.

### Validation

`npm run validate` passed: 30 packaged skills validated and 14 CLI tests passed. The CLI help, Copilot install dry run, doctor output, package dry run, and `git diff --check` were also exercised.
