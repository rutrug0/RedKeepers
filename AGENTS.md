# RedKeepers Agent Coordination Notes

This repository is operated by a head daemon that schedules one AI agent at a time.

## Core Rules

- Single active agent slot, no parallel execution.
- Work must be represented as structured backlog items.
- Agents keep role-specific context in `agents/<agent-id>/`.
- Commits to `main` are performed only through daemon guardrails.
- Blockers and repeated failures are escalated to Mara Voss.
- Use placeholder art only for now (wireframes, temporary icons, neutral silhouettes, labeled mock images). Final art production is deferred and may replace placeholders later.
- Agents should propose follow-up work in their `outbox.json` entries (`proposed_work_items`) so the daemon can replenish the backlog continuously.

## Primary Runtime

Use `python tools/orchestrator.py run` to process the queue.
