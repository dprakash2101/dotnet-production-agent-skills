Understand the existing implementation before changing code. Follow its architecture and conventions.
Reuse existing helpers and services; avoid duplicated logic and keep new code maintainable under repository analyzers and SonarCloud.
Preserve compatibility and public API contracts unless a change is explicitly requested. Avoid unrelated refactors.
Never expose stack traces, credentials, tokens, secrets, connection strings, internal URLs, or database details through customer-facing APIs.
Never log secrets or sensitive payloads. Add operationally useful logs, and limit noise in high-traffic APIs.
Do not introduce retries automatically. Add them only when requested or required by existing architecture, and only for safe transient operations.
When behavior changes, check whether existing tests need updating. Avoid redundant tests that slow CI.
Run the smallest appropriate validation, build, or test command after changing code.
