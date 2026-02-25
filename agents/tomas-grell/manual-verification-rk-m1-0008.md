# RK-M1-0008 Manual Verification Notes (Client Shell)

Date: 2026-02-25 (UTC)
Owner: Tomas Grell (QA)
Scope guard: `docs/design/first-vertical-slice.md` (placeholder art only, web-first shell, basic smoke validation)

## Purpose

Manual checks for the M1 client shell wireframe focused on:
- responsive layout behavior
- placeholder-art policy compliance

## Static Precheck (Completed)

Source files reviewed:
- `client-web/index.html`
- `client-web/styles.css`
- `client-web/app.js`

Findings:
- Client shell includes the expected slice panels: settlement, world map, event feed.
- Placeholder language is explicitly present in UI labels/content (e.g. `Placeholder`, `wireframe`, placeholder actions/feeds).
- Wireframe/placeholder visual tokens are used (`wire-*` classes, dashed outlines, text labels) rather than final art assets.
- Responsive CSS breakpoints exist for desktop/tablet/mobile transitions at `1220px` and `860px`.
- Reduced-motion handling exists (`@media (prefers-reduced-motion: reduce)`).

## Manual Browser Verification Checklist (Blocked in sandbox)

1. Desktop width (`>=1221px`)
- Status: BLOCKED (visual browser process launch denied by sandbox policy and Chromium runtime access errors).
- Planned checks (not executable in this environment):
- Confirm three-column shell layout renders (`settlement`, `world map`, `event feed` all visible).
- Confirm sticky region nav remains usable while scrolling.
- Confirm placeholder markers and wireframe visuals are visible (no final art imagery/assets).

2. Tablet width (`861px` to `1220px`)
- Status: BLOCKED (same environment constraint).
- Planned checks (not executable in this environment):
- Confirm `event-feed-panel` moves below the first row (`grid-column: 1 / -1` behavior).
- Confirm map side panels reflow into three columns under map stage.
- Confirm controls remain readable/clickable (minimum touch target pattern still visually intact).

3. Mobile width (`<=860px`)
- Status: BLOCKED (same environment constraint).
- Planned checks (not executable in this environment):
- Confirm top bar stacks vertically.
- Confirm region tabs collapse to one-column button stack.
- Confirm main app panels render one column and remain scroll-accessible.
- Confirm resource cards become single-column and map stage height reduces without overflow clipping critical controls.

4. Keyboard/interaction smoke
- Status: BLOCKED (same environment constraint).
- Planned checks (not executable in this environment):
- Tab to region tabs, use arrow keys/Home/End, then `Enter`/`Space` to activate panel focus/scroll.
- Confirm active tab state updates while scrolling between panels (IntersectionObserver behavior).

## Attempted Browser Execution Evidence

Attempts made in this run:
- `node agents/tomas-grell/artifacts/rk-m1-0008-f01/run-visual-smoke.js` -> failed with `Error: spawn EPERM` when trying to launch Chromium.
- Python subprocess launch of Chromium/Edge headless (`--screenshot` path test) -> process exits before render with:
  - `FATAL: ... platform_channel.cc ... Access is denied. (0x5)`
  - `ERROR: crash server failed to launch, self-terminating`

Impact:
- Manual browser checks cannot be executed inside current sandboxed CLI session.
- No screenshots can be produced from this environment.

## Placeholder-Art Policy Compliance Checks (Partial: static only)

Policy reference:
- `docs/design/first-vertical-slice.md` -> In Scope: "Placeholder art only (replaceable later)"

Checks:
- No final branded artwork or production art assets introduced in `client-web/` scaffold.
- UI uses neutral wireframe markers (`wire-bar`, `wire-icon`, `wire-silhouette`, labeled placeholder actions/slots).
- Map viewport uses CSS gradients/grids and labeled markers, not final map illustrations.
- Event feed and notification tiles remain placeholder text content.

Status:
- Static/source verification: PASS
- Visual in-browser confirmation: BLOCKED in current environment (requires non-sandbox browser run)

## Result

- Static QA precheck: PASS
- Manual browser verification: BLOCKED (sandbox policy/runtime restrictions prevent Chromium/Edge visual run)
