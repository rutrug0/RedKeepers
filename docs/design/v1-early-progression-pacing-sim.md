# V1 Early Progression Pacing Simulation (RK-M1-0006-F02)

Purpose: validate the first 2-6 hours of the first-slice settlement loop using the starter economy/building/unit tables and propose numeric tuning if pacing is too hard/soft.

## Scope + Assumptions (Slice-Safe)

- Uses `docs/design/v1-starter-data-tables.md` playable rows only (`cinder_throne_legates` slice civ)
- Single construction queue and single barracks training queue
- No raids, map rewards, quests, boosts, or premium acceleration
- Uses Cinder home-stationed upkeep modifier (`food upkeep * 0.85`)
- Uses baseline unit lines (`watch_levy`, `bow_crew`, `trail_scout`, `light_raider`) for cadence checks
  - Note: this is slightly conservative for Cinder levy-heavy play because `brand_levies` are cheaper/faster than baseline `watch_levy`
- Reference policy is onboarding-friendly/economy-first with light unit training reserve (not a perfect-optimization route)

## Reference Sim Findings (Current Values)

Observed issue: the first major pacing wall appears after the initial 4 producer builds plus one level-2 producer. The player can enter a long resource refill gap (mainly food/wood depending on the 5th build choice), delaying `barracks` and meaningful training cadence.

### Checkpoints (Current Tables)

| Checkpoint | Building State | Unit State | Notes |
| --- | --- | --- | --- |
| 30m | `grain_plot` L2, `timber_camp` L1, `stone_quarry` L1, `iron_pit` L1 | none | Queue idle after early spend; refill wait begins |
| 2h | Same as 30m | none | Still pre-`barracks` in reference route |
| 6h | `grain_plot` L2, `timber_camp` L2, `stone_quarry` L1, `iron_pit` L1, `barracks` L1 | 4x `watch_levy` | `rally_post` not reached |

Key timing markers (current values):

- `barracks` L1 completion: `4h 25m 44s`
- `rally_post` L1 completion: not reached within `6h` in the reference route
- Storage cap pressure: none observed in this run (no resource hit `1000`)

Checkpoint resource/rate snapshots (current values):

| Checkpoint | Food | Wood | Stone | Iron | Food/h | Wood/h | Stone/h | Iron/h |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 30m | 44.3 | 9.8 | 88.4 | 126.6 | 66.8 | 28.0 | 22.0 | 17.0 |
| 2h | 144.5 | 51.8 | 121.4 | 152.1 | 66.8 | 28.0 | 22.0 | 17.0 |
| 6h | 102.2 | 17.5 | 58.4 | 180.1 | 63.4 | 60.2 | 22.0 | 17.0 |

## Recommended Tuning Pass (Numeric Only, No New Mechanics)

Goal: remove the early dead-zone and bring `barracks` unlock/training into the 2h window while staying inside first-slice complexity limits.

### Proposed Changes (Pass A)

Starter liquidity (small one-time cushion):

- `food.starting_stock`: `300 -> 360`
- `wood.starting_stock`: `260 -> 320`
- `stone.starting_stock`: `220 -> 250`
- `food.base_passive_prod_per_h`: `6 -> 8`
- `wood.base_passive_prod_per_h`: `4 -> 6`

Producer cost ramp softening (keeps same formulas, lowers early L2-L4 spike):

- `grain_plot.cost_mult_per_level`: `1.55 -> 1.46`
- `timber_camp.cost_mult_per_level`: `1.55 -> 1.46`
- `stone_quarry.cost_mult_per_level`: `1.58 -> 1.50`
- `iron_pit.cost_mult_per_level`: `1.60 -> 1.52`

Military unlock smoothing:

- `barracks.cost_food_l1`: `90 -> 75`
- `barracks.cost_wood_l1`: `120 -> 105`
- `rally_post.cost_food_l1`: `80 -> 70`
- `rally_post.cost_wood_l1`: `80 -> 70`

## Checkpoints (Tuned Pass A, Same Reference Policy)

| Checkpoint | Building State | Unit State | Notes |
| --- | --- | --- | --- |
| 30m | `grain_plot` L2, `timber_camp` L2, `stone_quarry` L1, `iron_pit` L1 | none | Early queue remains active longer; dead-zone reduced |
| 2h | Above + `barracks` L1 | none | `barracks` online before 2h |
| 6h | Same building state as 2h | 5x `watch_levy`, 2x `bow_crew`, 2x `trail_scout` | Training cadence established; `rally_post` still delayed |

Key timing markers (tuned pass A):

- `barracks` L1 completion: `1h 47m 32s`
- `rally_post` L1 completion: not reached within `6h` in this reference run
- Storage cap pressure: none observed in this run

Checkpoint resource/rate snapshots (tuned pass A):

| Checkpoint | Food | Wood | Stone | Iron | Food/h | Wood/h | Stone/h | Iron/h |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 30m | 37.4 | 27.8 | 91.4 | 126.6 | 68.8 | 62.2 | 22.0 | 17.0 |
| 2h | 65.7 | 16.0 | 44.4 | 112.1 | 68.8 | 62.2 | 22.0 | 17.0 |
| 6h | 41.0 | 34.7 | 62.4 | 160.1 | 61.2 | 62.2 | 22.0 | 17.0 |

## Recommendation

- Do not approve the current values as-is for onboarding pacing.
- Apply Pass A and rerun after seed/config serialization to confirm:
  - `barracks` unlock consistently lands before `2h`
  - light training can start before `2h`
  - `rally_post` timing target is acceptable (or needs a narrow stone/rally cost pass)

This recommendation preserves first-slice constraints:

- no new mechanics
- no civ-specific UI/tutorial flow
- stat/timing-only tuning compatible with data-table implementation

## Serialized Seed Re-validation (RK-M1-0006-F02-F01, 2026-02-25 UTC)

Re-validation source files (serialized seed values):

- `backend/src/modules/economy/infra/seeds/v1/resource-definitions.json`
- `backend/src/modules/buildings/infra/seeds/v1/building-lines.json`
- `backend/src/modules/buildings/infra/seeds/v1/building-effects.json`
- `backend/src/modules/units/infra/seeds/v1/unit-lines.json`
- `backend/src/app/config/seeds/v1/civilizations/global-modifiers.json`

Reference route/policy used for deterministic parity with the prior run:

- Build queue: `grain_plot` L1 -> `timber_camp` L1 -> `stone_quarry` L1 -> `iron_pit` L1 -> `grain_plot` L2 -> `timber_camp` L2 -> `barracks` L1 -> `rally_post` L1
- Train queue after `barracks` is online (single queue): 5x `watch_levy`, 2x `bow_crew`, 2x `trail_scout` as resources allow
- Same slice assumptions as above (single queue per system, no quests/raids/boosts, Cinder home upkeep modifier)

### Checkpoints (Serialized Seed Values)

| Checkpoint | Building State | Unit State | Notes |
| --- | --- | --- | --- |
| 30m | `grain_plot` L2, `timber_camp` L1, `stone_quarry` L1, `iron_pit` L1 | none | Matches pre-pass baseline dead-zone pattern |
| 2h | Same as 30m | none | Still pre-`barracks` |
| 6h | `grain_plot` L2, `timber_camp` L2, `stone_quarry` L1, `iron_pit` L1, `barracks` L1 | 4x `watch_levy` | `rally_post` not reached |

Serialized checkpoint resource/rate snapshots:

| Checkpoint | Food | Wood | Stone | Iron | Food/h | Wood/h | Stone/h | Iron/h |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 30m | 44.3 | 9.8 | 88.4 | 126.6 | 66.8 | 28.0 | 22.0 | 17.0 |
| 2h | 144.5 | 51.8 | 121.4 | 152.1 | 66.8 | 28.0 | 22.0 | 17.0 |
| 6h | 101.8 | 17.6 | 58.4 | 180.1 | 63.4 | 60.2 | 22.0 | 17.0 |

Key timing markers (serialized seeds):

- `barracks` L1 completion: `4h 25m 42s`
- First `watch_levy` training start: `4h 42m 39s`
- First `watch_levy` completion: `4h 43m 23s`
- `rally_post` L1 completion: not reached within `6h`

### Target Verification (Against Tuned Pass A Intent)

- `barracks` before `2h`: `FAIL` (`4h 25m 42s`)
- First unit training cadence in/near the `2h` window: `FAIL` (first train start `4h 42m 39s`)
- `rally_post` timing acceptable without extra pass: `FAIL` (not reached by `6h`)

Conclusion: serialized seed/config values currently behave like the original pre-pass baseline, so the Pass A barracks improvement does not hold in serialized data yet. `rally_post` should not be approved on current serialized values.

Proposed narrow follow-up (after Pass A serialization is present): run a rally/stone-only micro pass and recheck `6h` timing with unchanged core mechanics. Candidate deltas:

- `rally_post.cost_food_l1`: `70 -> 64`
- `rally_post.cost_wood_l1`: `70 -> 64`
- `rally_post.cost_stone_l1`: `60 -> 52`

## Post-Serialization Rally/Stone Micro-Pass (RK-M1-0006-F02-F01-F02, 2026-02-25 UTC)

Execution target: confirm Pass A serialized values, rerun 30m/2h/6h checkpoints, and explicitly judge rally_post timing.

Inputs used (serialized data currently in repo at runtime):

- `backend/src/modules/economy/infra/seeds/v1/resource-definitions.json`
- `backend/src/modules/buildings/infra/seeds/v1/building-lines.json`
- `backend/src/modules/buildings/infra/seeds/v1/building-effects.json`
- `backend/src/modules/units/infra/seeds/v1/unit-lines.json`
- `backend/src/app/config/seeds/v1/civilizations/global-modifiers.json`

Reference policy used:

- Build queue: `grain_plot` L1 -> `timber_camp` L1 -> `stone_quarry` L1 -> `iron_pit` L1 -> `grain_plot` L2 -> `timber_camp` L2 -> `barracks` L1 -> `rally_post` L1
- Train queue after barracks online (single queue): `watch_levy` x5, `bow_crew` x2, `trail_scout` x2 in order
- Same slice assumptions (single build queue, single barracks queue, no boosts/raids/quest/prod systems)

### Checkpoints (Post-serialization replay, current)

| Checkpoint | Building State | Unit State | Notes |
| --- | --- | --- | --- |
| 30m | `grain_plot` L2, `timber_camp` L2, `stone_quarry` L1, `iron_pit` L1 | none | Dead-zone window still present; barracks still in progress |
| 2h | Above + `barracks` L1 | none | `barracks` online, still no completed units yet |
| 6h | `grain_plot` L2, `timber_camp` L2, `stone_quarry` L1, `iron_pit` L1, `barracks` L1 | 5x `watch_levy`, 2x `bow_crew`, 2x `trail_scout` | `rally_post` still not completed |

Checkpoint resource/rate snapshots (replayed against serialized inputs):

| Checkpoint | Food | Wood | Stone | Iron | Food/h | Wood/h | Stone/h | Iron/h |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 30m | 36.4 | 26.8 | 89.4 | 126.6 | 68.8 | 62.2 | 22.0 | 17.0 |
| 2h | 64.7 | 15.0 | 44.4 | 112.1 | 68.8 | 62.2 | 22.0 | 17.0 |
| 6h | 55.0 | 33.6 | 60.4 | 160.1 | 68.8 | 62.2 | 22.0 | 17.0 |

### Timing markers

- `barracks` L1 completion: `1h 48m 33s`
- `first watch_levy` training start: `2h 4m 51s`
- `first watch_levy` completion: `2h 5m 35s`
- `rally_post` L1 completion: not reached within `6h` at current rally costs

### Target verification (RK-M1-0006-F02-F01-F02)

- `barracks` before `2h`: `PASS` (`1h 48m 33s`)
- first training cadence (within opening window): `PASS` (first start `2h 4m 51s`, first completion `2h 5m 35s`)
- `rally_post` timing target (within `6h`): `FAIL` (still not reached)

### Micro-pass decision

- `rally_post` cannot be approved yet under current serialized tuning.
- Keep narrow numeric follow-up scoped to rally/build costs only:
  - `rally_post.cost_food_l1`: `64 -> 55`
  - `rally_post.cost_wood_l1`: `64 -> 33`
  - `rally_post.cost_stone_l1`: `52 -> 52` (no change for this pass)
- Re-run `RK-M1-0006-F02-F01-F02` after applying the above values and capture whether `rally_post` reaches L1 by `6h`.
