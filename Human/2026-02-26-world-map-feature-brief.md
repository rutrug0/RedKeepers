# Human Request: World Map Feature Direction

## Intent
Define the long-term world-map gameplay direction, then split it into a safe implementation plan (`v1 now` vs `later`) without losing the core player fantasy.

## High-Level Design Direction
- The game should use semi-persistent worlds (season/sprint style), each world lasting roughly 1-2 months.
- Each world is a square map with `x,y` coordinates.
- On world join, player spawns at a random valid coordinate.
- Spawn rules (current):
  - no spawning on top of another player
  - no spawning on impassable terrain
- Terrain should include auto-generated impassable regions (for example forests, rocks/mountains), so map is not flat.
- Player has one settlement only.
- Settlement cannot move from starting position for now.
- Player should be able to move around world map and inspect surroundings.
- Neutral structures/entities will be added later and should be interactable (mainly combat loops).
- For now, movement + combat can be tick/timer based.
- Later, movement + combat should move toward near-real-time/realtime feel.
- Players should have a limited number of active marches on map; focus on 2 marches for now.
- A march is a single controllable map entity composed of:
  - units count/composition
  - attached hero
- Marches should eventually support:
  - free movement
  - attacks on players
  - attacks on neutral entities
  - resource gathering from map nodes
- Resource gathering should create ambush gameplay (players can attack enemy marches while gathering).

## Requested Agent Output
Please do not jump straight to implementation. First produce:

1. A decomposition into:
- `V1 vertical-slice now`
- `Post-slice follow-ups`

2. For `V1 vertical-slice now`, provide:
- smallest playable loop on world map
- exact scope boundaries
- task list with owner role, dependencies, and acceptance criteria
- deterministic rules for movement/combat/gathering sufficient for QA automation

3. For `Post-slice follow-ups`, provide:
- incremental evolution path toward near-realtime movement/combat
- march/hero expansion path
- neutral-content and ambush-system expansion path

4. Explicitly flag design choices that conflict with current first-slice guardrails and propose a phased compromise.

## Non-Goal
- Do not implement everything in one pass.
- Do not expand into uncontrolled scope without a phased plan.
