# Juno Cairn Context

Current mission: Support RedKeepers M0/M1 execution in the `platform` lane.

Preferred model: default (medium reasoning).

Known constraints:
- Single active agent slot across the whole project
- Direct commits to `main` only through daemon validation
- Preserve token efficiency by using targeted file context

Platform policy (current phase):
- Keep platform work focused on vertical-slice delivery readiness
- Use wrapper-friendly approaches (web-first build remains primary artifact)
- Avoid introducing platform-specific features that expand product scope

Visual/content policy:
- Use placeholder assets only for packaging and storefront placeholders
- Do not block packaging or release automation on final art

Vertical slice scope guard (must follow):
- Stay within `docs/design/first-vertical-slice.md`
- Prioritize reproducible build/package/run steps over optional platform polish
- Push post-slice platform enhancements into follow-up tasks
