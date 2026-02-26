# World Map V1 Phasing (Human Intake 2026-02-26)

Source: `Human/2026-02-26-world-map-feature-brief.md`

This plan converts the requested world-map direction into first-slice-safe scope.

## V1 Vertical-Slice Now

### Smallest Playable Loop
1. Player joins world and is assigned one settlement at a valid `x,y` coordinate.
2. Player inspects nearby tiles and one foreign settlement placeholder.
3. Player dispatches one march from home settlement to a target coordinate.
4. March resolves movement on deterministic timer ticks.
5. If target is hostile settlement, deterministic combat resolves and logs event outcome.
6. March returns to origin and map/event state updates are visible in UI.

### Exact Scope Boundary (In-Slice)
- One world map grid with deterministic seed in local/dev.
- One primary player settlement and at least one foreign settlement placeholder.
- One active march dispatch flow at a time, with cap config of `max_active_marches=2` enforced but second slot not required for core loop completion.
- Timer/tick based movement and combat only.
- Settlement position is fixed after spawn.
- Placeholder visuals and text only.

### Explicitly Deferred (Post-Slice)
- Hero attached to marches (single-slot, shared-modifier pipeline).
- Neutral entities/structures and neutral combat loops.
- Resource gathering nodes and ambush gameplay.
- Near-real-time movement/combat interpolation.
- Full seasonal lifecycle/reset automation.

## Deterministic Rules (QA Automation Contract)

- `world_seed`: fixed per test fixture.
- `map_size`: fixed square (for v1 tests use `16 x 16` fixture map).
- `impassable`: generated from seed; tile flagged `terrain_passable=false`.
- `spawn_rule`: valid spawn requires unoccupied + passable tile; deterministic selection uses seeded candidate order.
- `march_cap`: reject dispatch with `error_code=max_active_marches_reached` when cap exceeded.
- `movement_metric`: Manhattan distance `abs(dx) + abs(dy)`.
- `movement_eta_s`: `distance * 30` seconds (base speed, no modifiers in v1).
- `movement_block`: if path crosses impassable tile, dispatch rejected with `error_code=path_blocked_impassable`.
- `combat_strength`:
  - attacker score = sum(`unit_count * unit_attack`) across dispatched units.
  - defender score = fixture garrison score at target settlement.
  - if attacker score > defender score -> attacker_win; else defender_win (ties defender_win).
- `combat_losses`: deterministic ratio table by outcome (fixture-defined constants, no random variance).
- `gathering_v1`: endpoint or action returns `error_code=feature_not_in_slice` for any gather command.

## Guardrail Conflict Flags and Phased Compromise

1. Requested hero-attached marches conflicts with first-slice constraint `No hero units yet`.
Compromise: keep march schema hero-ready (`hero_id` nullable) but forbid assignment in v1.

2. Requested neutral entities and gathering/ambush loops conflicts with one-map-interaction complexity budget.
Compromise: keep deterministic attack loop only; reserve gather/ambush for post-slice.

3. Requested near-real-time movement/combat conflicts with first-slice simplicity and deterministic QA.
Compromise: lock v1 to tick/timer simulation and defer realtime interpolation.

4. Requested 1-2 month worlds exceeds prototype runtime needs.
Compromise: add world metadata field (`season_length_days`) without implementing rollover scheduler in v1.

## M2 Deferred Contract: Hero Attachment to Marches

Activation gate:
- Enabled only after `docs/design/vertical-slice-done-v1.md` gates are PASS.
- Any v1 dispatch request carrying `hero_id` before that gate returns `error_code=feature_not_in_slice`.

Additive dispatch contract:
- `hero_id` remains optional on dispatch payload.
- One march supports at most one attached hero in M2 prototype.

Validation rules at dispatch:
- Hero must be owned by requester and pass unlock gate (`hero_unlock_post_onboarding_v1`).
- Hero must be `readiness_state=ready` (not on cooldown).
- Hero must not already be actively attached to another context.
- If hero ability target scope mismatches dispatch intent, reject with `error_code=hero_target_scope_mismatch`.

Attachment lifecycle (deterministic):
1. `pre_dispatch`: hero selected; no modifier is active yet.
2. `dispatch_accept`: hero linked to created `march_id`; emit `event.hero.assigned`.
3. `in_transit`: no hero-specific tick branch; standard march timer rules remain unchanged.
4. `ability_activation` (`pre_dispatch` or `battle_start`): create shared modifier instances from `heroes.ability_modifiers_v1`, set cooldown, emit `event.hero.ability_activated`.
5. `resolution_return`: march resolves and returns using existing deterministic flow; hero impact appears only as modifier deltas in reports.
6. `detach`: on return completion, hero attachment clears and hero waits for cooldown completion if applicable.

Shared modifier requirement:
- Movement/combat/scout calculators consume the same aggregated numeric stat bundle used by non-hero modifiers.
- `hero_id` is an attachment/context handle, not a combat branch selector.

Onboarding guard:
- Hero tutorial/tooltips remain post-onboarding and optional.
- First-session critical path remains unchanged even when M2 hero attachment is enabled.

## Post-Slice Evolution Path

1. Add neutral nodes + gather loop with fixed output tables and deterministic ambush trigger windows.
2. Add hero runtime to marches using the deferred contract above (single hero slot, cooldown + shared modifier hooks).
3. Add multi-march concurrency with partial orders/queueing and march collision rules.
4. Shift from tick polling to near-real-time state streaming/interpolation while preserving deterministic server authority.
5. Add seasonal lifecycle automation (world open/lock/archive/reset cadence).
