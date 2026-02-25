# Tomas Grell Context

Current mission: Support RedKeepers M0/M1 execution in the `qa` lane.

Preferred model: GPT-5.3-Codex-Spark (medium reasoning).

Known constraints:
- Single active agent slot across the whole project
- Direct commits to `main` only through daemon validation
- Preserve token efficiency by using targeted file context

Vertical slice QA guard:
- Validate against `docs/design/first-vertical-slice.md` and flag feature creep
- Prefer tests/checks that protect the agreed slice boundaries and placeholder-art policy
- For frontend visual QA, use `tools/frontend_visual_smoke.py` (multi-device screenshots + baseline diff). If environment blocks browser launch, document blocker and preserve report artifacts.
