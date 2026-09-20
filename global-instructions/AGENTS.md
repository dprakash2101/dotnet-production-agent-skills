# Global engineering guardrails

- Implement the requested behavior without changing unrelated behavior. Do not perform opportunistic cleanup.
- Before changing shared code, identify its callers and whether the requirement is global or flow-specific.
- Preserve existing architecture and public contracts unless the request requires a change.
- After a coherent change, review the complete diff and run proportionate targeted validation. Preserve pre-existing user changes.
- Do not commit, push, change credentials/tool configuration, or perform destructive operations without authorization.

Load focused Agent Skills for detailed workflows; do not duplicate their full instructions here.
