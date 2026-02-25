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

## Manual Browser Verification Checklist (Pending visual run)

1. Desktop width (`>=1221px`)
- Confirm three-column shell layout renders (`settlement`, `world map`, `event feed` all visible).
- Confirm sticky region nav remains usable while scrolling.
- Confirm placeholder markers and wireframe visuals are visible (no final art imagery/assets).

2. Tablet width (`861px` to `1220px`)
- Confirm `event-feed-panel` moves below the first row (`grid-column: 1 / -1` behavior).
- Confirm map side panels reflow into three columns under map stage.
- Confirm controls remain readable/clickable (minimum touch target pattern still visually intact).

3. Mobile width (`<=860px`)
- Confirm top bar stacks vertically.
- Confirm region tabs collapse to one-column button stack.
- Confirm main app panels render one column and remain scroll-accessible.
- Confirm resource cards become single-column and map stage height reduces without overflow clipping critical controls.

4. Keyboard/interaction smoke
- Tab to region tabs, use arrow keys/Home/End, then `Enter`/`Space` to activate panel focus/scroll.
- Confirm active tab state updates while scrolling between panels (IntersectionObserver behavior).

## Placeholder-Art Policy Compliance Checks (Pending visual confirmation)

Policy reference:
- `docs/design/first-vertical-slice.md` -> In Scope: "Placeholder art only (replaceable later)"

Checks:
- No final branded artwork or production art assets introduced in `client-web/` scaffold.
- UI uses neutral wireframe markers (`wire-bar`, `wire-icon`, `wire-silhouette`, labeled placeholder actions/slots).
- Map viewport uses CSS gradients/grids and labeled markers, not final map illustrations.
- Event feed and notification tiles remain placeholder text content.

## Result

- Static QA precheck: PASS
- Manual browser verification: NOT RUN in CLI-only session (follow-up visual pass can execute checklist above)
