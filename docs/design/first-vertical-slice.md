# First Vertical Slice Scope (Anti-Creep Guardrails)

This document defines the first playable vertical slice boundary for RedKeepers. Agents must treat it as a hard scope guard.

## Goal

Deliver one end-to-end playable prototype loop that proves:
- web-first UI shell can host gameplay screens
- core settlement progression loop feels coherent
- stat-driven civilization approach works in data
- backend/client contracts can evolve without rework

This slice should prove direction, not completeness.

## In Scope (First Vertical Slice)

- Single player-facing prototype flow (local/dev environment)
- One playable civilization profile (others may exist as data stubs)
- Civilization differences represented primarily by stats/timings/modifiers
- Placeholder art only (replaceable later)
- One settlement loop:
  - resource generation/tick (real or mock-simulated)
  - building upgrade flow (small subset)
  - unit training flow (small subset)
- World map panel/view with limited interaction (e.g. scout/select/inspect placeholder tiles)
- Event feed / notifications as placeholder text
- Basic validation/smoke checks for the above

## Hard Constraints (Keep It Small)

- No hero units yet (planned later, per-civilization)
- No civilization-specific core mechanics requiring custom tutorials or bespoke UI flows
- No alliances/guild systems
- No diplomacy systems beyond placeholders/text stubs
- No real PvP combat system (combat may be deferred or represented as a simplified placeholder outcome)
- No monetization/shop/inventory systems
- No chat/social systems
- No final art/audio pipeline work
- No production infrastructure scaling work

## Complexity Budget (Initial Slice)

Prefer caps like these unless a task explicitly updates this document:
- 1 playable civilization profile
- 3-4 core resources
- 4-6 buildings in slice
- 3-5 units in slice
- 1 settlement
- 1 map interaction flow

If a proposal exceeds these caps, split it into:
- `in-scope now` (deliverable in the slice)
- `post-slice follow-up` tasks

## Agent Tasking Rules

- If a task introduces a new mechanic, ask: can this be expressed as a stat/timing modifier instead?
- If a task is valuable but out of scope, do not implement it now; create a follow-up backlog item.
- Prefer placeholders and stubs over full systems when proving integration.
- Favor data-driven implementations (tables/config/docs) over bespoke logic for civ differences.

## Definition of Done (Slice-Level)

The first vertical slice is successful when a tester can:
1. Open the client shell
2. See a settlement state (placeholder art allowed)
3. Observe/update resources over time or via simulated ticks
4. Start/complete at least one building upgrade
5. Train at least one unit type
6. View the world map panel and perform one simple interaction
7. See event/log feedback reflecting those actions

## Deferred Features (Track as Follow-Ups)

- Hero units (unique per civilization)
- Additional civilizations as fully playable options
- Rich combat resolution
- Alliances/diplomacy systems
- Final art generation and art pipeline replacement pass
