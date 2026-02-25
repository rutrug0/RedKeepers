# Agent Model Budgeting

Model assignments and token budgets are defined in `coordination/policies/model-policy.yaml`.

Guidelines:
- Reserve high-reasoning `codex-5.3` for lead/backend and escalations
- Use lower-cost models for design/content drafting
- Track estimated token usage in `coordination/runtime/agent-stats.json`
