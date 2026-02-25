# Agent Model Budgeting

Model assignments and token budgets are defined in `coordination/policies/model-policy.yaml`.

Guidelines:
- Use stronger/default account model for lead/backend/QA/platform baseline work
- Use `gpt-5.3-codex-spark` for lightweight tasks and lower-priority roles where speed/cost wins
- Keep high reasoning on lead/backend/escalation paths, but avoid unsupported model IDs in account-constrained environments
- Track estimated token usage in `coordination/runtime/agent-stats.json`

Runtime behavior:
- The daemon resolves model selection per work item from `model-policy.yaml` (agent-specific settings first, then agent catalog fallback).
- Model choice is both agent-driven and task-aware:
  - Base selection: per-agent mapping in `agent_models`.
  - Lightweight override: if `lightweight_task_override` conditions match (role, priority, effort, token budget), daemon swaps to the configured fast model.
  - Per-task upgrade: if work item priority is `critical` or `retry_count > 0`, daemon applies `escalation_upgrade.critical_or_repeated_failure` when configured.
- The worker passes the selected model to Codex CLI via `--model`.
- If a configured model fails with model-access/model-availability errors and `fallback_model` is configured, the worker retries once with the fallback model.
- In this ChatGPT-account setup, fallback model is intentionally unset because `gpt-5-mini` is not available via Codex for this account.
- If pinned model access is rejected, worker can automatically retry with default account model; you can also force this behavior via `REDKEEPERS_USE_DEFAULT_MODEL=1`.
- `coordination/runtime/run-history.jsonl` records `model_requested`, `model_used`, and `fallback_used` for each run.
