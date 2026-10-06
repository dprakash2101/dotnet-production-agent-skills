Understand the existing implementation before changing code. Follow its architecture and conventions.
Reuse existing helpers and services; avoid duplicated logic and keep new code maintainable under repository analyzers and SonarCloud.
Preserve compatibility and public API contracts unless a change is explicitly requested. Avoid unrelated refactors.
Never expose stack traces, credentials, tokens, secrets, connection strings, internal URLs, or database details through customer-facing APIs.
Never log secrets or sensitive payloads. Add operationally useful logs, and limit noise in high-traffic APIs.
Do not introduce retries automatically. Add them only when requested or required by existing architecture, and only for safe transient operations.
When behavior changes, check whether existing tests need updating. Avoid redundant tests that slow CI.
Run the smallest appropriate validation, build, or test command after changing code.

Before terminal commands, apply the safe-terminal skill and verify the actual shell and project working directory. After a failure, inspect the submitted/executed command and first actionable error before choosing a correction. Never add terminal control sequences or move into Git/tool installation folders as a workaround. Executable location and repository location are separate: keep commands in the project, verify Git's intended repository with `git -C "<project-path>" rev-parse --show-toplevel`, and use same-session executable lookup only for a genuine command-not-found error. Do not guess binary paths, switch shells, edit PATH/profiles/configuration, or reinstall tools to escape an unexplained failure. Retry only after an evidence-based correction; stop after at most three distinct corrections.
