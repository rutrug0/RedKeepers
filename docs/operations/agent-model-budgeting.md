# Agent Model Budgeting

Model assignments and token budgets are defined in `coordination/policies/model-policy.yaml`.

Guidelines:
- Reserve high-reasoning `codex-5.3` for lead/backend and escalations
- Use `GPT-5.3-Codex-Spark` for lower-risk, high-throughput roles (design/content/QA), with fallback to `gpt-5-mini`
- Track estimated token usage in `coordination/runtime/agent-stats.json`

Runtime behavior:
- The daemon resolves model selection per work item from `model-policy.yaml` (agent-specific settings first, then agent catalog fallback).
- The worker passes the selected model to Codex CLI via `--model`.
- If a configured model fails with model-access/model-availability errors and `fallback_model` is configured, the worker retries once with the fallback model.
- `coordination/runtime/run-history.jsonl` records `model_requested`, `model_used`, and `fallback_used` for each run.
