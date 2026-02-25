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
