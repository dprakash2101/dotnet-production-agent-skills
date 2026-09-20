# Global engineering guardrails

- Implement the requested behavior without changing unrelated behavior. Do not perform opportunistic cleanup.
- Before changing shared code, identify its callers and whether the requirement is global or flow-specific.
- Preserve existing architecture and public contracts unless the request requires a change.
- After a coherent change, review the complete diff and run proportionate targeted validation. Preserve pre-existing user changes.
- Do not commit, push, change credentials/tool configuration, or perform destructive operations without authorization.

## Skill routing

Load focused Agent Skills by name; do not paste their full bodies into context.

- Start ambiguous work with `task-router`.
- Default code changes: `dotnet-implementation`; close with `diff-review` and `targeted-validation`.
- New major work: `dotnet-architecture`. New customer APIs: `aspnet-core-api-development`, `api-contract-safety`, `exception-handling`.
- Load cloud, database, security, or logging skills only when that subject is in scope. Never preload the full catalog.
