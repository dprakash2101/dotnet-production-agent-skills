# Shell recovery examples

Use these as diagnostic patterns, not commands to run unconditionally. Replace placeholders only with paths established from task/workspace evidence. Keep checks read-only and in the failing shell; do not print the full environment.

## Choose the diagnostic for the actual shell

| Check | PowerShell | cmd.exe | Bash / POSIX shell |
| --- | --- | --- | --- |
| Current directory | `Get-Location` | `cd` | `pwd` |
| Executable resolution | `Get-Command git -All` | `where git` | `command -v git` |
| Verify project repository | `git -C "<project-path>" rev-parse --show-toplevel` | Same | Same |

When navigation is required, use `Set-Location -LiteralPath '<project-path>' -ErrorAction Stop` in PowerShell, `cd /d "<project-path>"` in cmd (including drive changes), or `cd -- "<project-path>"` in Bash. Stop on failure; never run the project operation after failed navigation. Prefer a tool-provided working directory instead.

If same-session lookup proves a bare executable name cannot resolve but identifies the installed binary, keep the project working directory and invoke the resolved executable. PowerShell requires `& '<resolved-git.exe-path>' -C '<project-path>' status`; cmd uses `"<resolved-git.exe-path>" -C "<project-path>" status`; Bash uses `"<resolved-git-path>" -C "<project-path>" status`. Pass arguments separately; do not evaluate a generated command string. These are conditional examples, not permission to guess binary locations.

## Classify failures before recovery

| Evidence | Next step | Do not infer or do |
| --- | --- | --- |
| Executed executable token contains pasted prompt/control text | Reconstruct plain intended tokens; retry once if authorized | Guess an installation path or alter PATH |
| Submitted text looks corrupted, but error names the intended executable | Inspect actual executable resolution in that session | Assume the visible corruption caused command-not-found |
| Git reports that the directory is not a repository | Verify workspace path and root using `git -C` | Reinstall Git, move into its installation, or run `git init` |
| Quoted executable path produces a PowerShell parsing/invocation error | Correct invocation syntax with `&`; retain arguments and project path | Switch shells or concatenate executable and arguments into one string |
| Project path has spaces or cmd is on another drive | Correct quoting/navigation, verify the resulting directory | Treat the executable's containing folder as the project |
| Verified project returns an unexpected Git root | Inspect relevant repository overrides and workspace identity | Clear overrides blindly or mutate the other repository |
| New session starts in a tool installation folder | Set explicit verified project context before repository operations | Assume a prior session's `cd` persisted |
| Clean command still cannot resolve and no binary is found | Report tool unavailable in that shell/environment | Retry repeatedly or silently install/reconfigure |

## Sources and enforcement boundary

- [Git command options and environment](https://git-scm.com/docs/git): `-C` selects command context; executable location does not select a repository.
- [Git repository-root inspection](https://git-scm.com/docs/git-rev-parse): `--show-toplevel` reports the working tree root.
- [PowerShell call operator](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_operators#call-operator-): invoke a quoted executable with `&` and separate arguments.
- [cmd directory navigation](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cd): `/d` changes the drive as well as the directory.
- [VS Code agent skills](https://code.visualstudio.com/docs/agent-customization/agent-skills) and [instructions](https://code.visualstudio.com/docs/agent-customization/custom-instructions): keep critical recovery rules in project instructions as well as the focused skill.
- [VS Code hooks](https://code.visualstudio.com/docs/agent-customization/hooks): host-supported hooks can enforce policy independently of model guidance; schemas and behavior differ by harness.

Treat this skill as behavioral guidance, not a sandbox or guaranteed block. Existing package hooks do not enforce repository-directory recovery. Verify hook support and actual payloads before adding enforcement; do not invent a portable hook format or claim instruction text guarantees compliance.
