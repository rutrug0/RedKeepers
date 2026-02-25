# Human Inbox

Drop instruction files here to direct the autonomous team.

How it works:
- Daemon checks `Human/` first on each scheduling cycle.
- For each new instruction file, daemon creates a critical lead-triage work item.
- Lead agent decomposes the instruction into concrete backlog tasks (owners, dependencies, acceptance criteria).
- After successful triage completion, daemon deletes the processed instruction file.

Tips:
- Use one file per request (e.g. `2026-02-25-new-feature.md`).
- Keep requests explicit and outcome-oriented.
- If you want strict scope, reference `docs/design/first-vertical-slice.md` in your instruction.
