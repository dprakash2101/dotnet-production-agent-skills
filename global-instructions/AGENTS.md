# Global engineering guardrails

- Implement the requested behavior without changing unrelated behavior. Do not perform opportunistic cleanup.
- Before changing shared code, identify its callers and whether the requirement is global or flow-specific.
- Preserve existing architecture and public contracts unless the request requires a change.
- After a coherent change, review the complete diff and run proportionate targeted validation. Preserve pre-existing user changes.
- Do not commit, push, change credentials/tool configuration, or perform destructive operations without authorization.
- Never add `Co-authored-by:` trailers (case-insensitive), co-author metadata, AI/agent signatures, credits, or generated-by footers to commits or pull requests. Do not inject attribution through trailers, templates, API fields, or Git identity overrides. Inspect complete commit/PR messages before creation and new commits before pushing. If tooling adds attribution, stop before publishing and report it; do not bypass hooks or rewrite existing commits without authorization. Apply `git-workflow` for the full procedure.
- Before terminal execution, apply `safe-terminal`: verify shell and project context, diagnose the actual failure, and retry only after an evidence-based correction. Never move into Git/tool installation directories or inject terminal control sequences to recover a project command. Keep executable lookup separate from repository selection.

Load focused Agent Skills for detailed workflows; do not duplicate their full instructions here.
