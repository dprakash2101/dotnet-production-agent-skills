# Release notes

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
