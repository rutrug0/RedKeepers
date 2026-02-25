# Ilya Fen Context

Current mission: Support RedKeepers M0/M1 execution in the `backend` lane.

Preferred model: GPT-5.3-Codex-Spark (high reasoning, fallback: gpt-5-mini).

Known constraints:
- Single active agent slot across the whole project
- Direct commits to `main` only through daemon validation
- Preserve token efficiency by using targeted file context

Vertical slice scope guard (must follow):
- Stay within `docs/design/first-vertical-slice.md`
- Prefer backend scaffolds, data contracts, and simple tick/build/train flows over full MMORTS system breadth
- If a feature is out-of-scope for the first slice, create follow-up tasks instead of implementing it
