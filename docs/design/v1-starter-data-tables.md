# V1 Starter Economy, Building, and Unit Data Tables

This document converts the v1 faction concept into implementation-ready starter tables for M1. It stays inside the first vertical slice guardrails by:

- keeping differences stat/timing-based
- marking non-slice content as data stubs
- avoiding new civilization-specific mechanics/UI flows

## Scope and Data Conventions

- First playable slice target: `cinder_throne_legates` only (`slice_status = playable_now`)
- Other civilizations are included as `balance_stub` rows to protect schema stability and support later activation
- Units/buildings marked `data_stub_post_slice` are defined now but should not be enabled in the first playable slice
- Time units: seconds (`_s`)
- Production/upkeep units: per hour (`_per_h`)
- Multipliers use decimal form (`1.10` = +10%, `0.90` = -10%)
- Combat stats are normalized starter values (not final formula tuning)

## Field Annotations (Module Ownership + Frontend Needs)

### Resource Table Fields (`economy`)

| Field | Type | Backend Owner | Frontend Need | Notes |
| --- | --- | --- | --- | --- |
| `resource_id` | string | `economy` | hidden key | Stable enum/seed key |
| `display_name` | string | `economy` | primary label | Placeholder text allowed |
| `short_label` | string | `economy` | compact HUD label | 3-8 chars |
| `icon_key` | string | `economy` | icon lookup | Placeholder icon token |
| `starting_stock` | int | `economy` | numeric value | New settlement start amount |
| `base_storage_cap` | int | `economy` | numeric value | Slice uses flat base cap (no storage building yet) |
| `base_passive_prod_per_h` | int | `economy` | rate display | Safety floor to prevent dead starts |
| `producer_building_id` | string | `economy` | tooltip link | Cross-ref to `buildings` table |
| `slice_status` | enum | `economy` | optional badge/filter | `playable_now`, `balance_stub` |

### Building Tables Fields (`buildings`)

| Field | Type | Backend Owner | Frontend Need | Notes |
| --- | --- | --- | --- | --- |
| `building_id` | string | `buildings` | hidden key | Stable enum/seed key |
| `family_id` | string | `buildings` | tab/grouping | `economy`, `military`, `defense`, `logistics` |
| `display_name` | string | `buildings` | card title | Placeholder text allowed |
| `max_level_v1` | int | `buildings` | level cap text | Per-line cap |
| `build_time_l1_s` | int | `buildings` | duration display | Level 1 base |
| `build_time_mult_per_level` | decimal | `buildings` | hidden (tooltip optional) | Geometric scaling |
| `cost_*_l1` | int | `buildings` | cost row | Level 1 cost by resource |
| `cost_mult_per_level` | decimal | `buildings` | hidden (tooltip optional) | Geometric scaling |
| `stat_key` | string | `buildings` | stat label mapping | Effect row key |
| `value_l1` | number | `buildings` | stat value | Level 1 effect |
| `scaling_mode` | enum | `buildings` | hidden | `mult_per_level`, `add_per_level`, `step_levels` |
| `scaling_value` | string/number | `buildings` | tooltip text | Numeric or step rule |
| `slice_status` | enum | `buildings` | badge/filter | `playable_now`, `data_stub_post_slice` |

### Unit Tables Fields (`units`)

| Field | Type | Backend Owner | Frontend Need | Notes |
| --- | --- | --- | --- | --- |
| `unit_id` | string | `units` | hidden key | Stable enum/seed key |
| `display_name` | string | `units` | card/list label | Placeholder text allowed |
| `role` | enum | `units` | filter/badge | `infantry`, `ranged`, `scout`, `cavalry`, `siege` |
| `train_building_id` | string | `units` | tooltip link | Usually `barracks` in starter set |
| `train_time_s` | int | `units` | duration display | Base before modifiers |
| `cost_*` | int | `units` | cost row | Base recruit cost |
| `upkeep_food_per_h` | int | `units` | upkeep stat | Uses food upkeep only in v1 |
| `hp` | int | `units` | combat stat | Normalized starter value |
| `attack` | int | `units` | combat stat | Generic attack score |
| `def_vs_*` | int | `units` | combat stat | Defense profile by attacker class |
| `speed_tiles_per_h` | decimal | `units` | mobility stat | Map movement baseline |
| `carry` | int | `units` | raid/logistics stat | Resource carry capacity |
| `vision_tiles` | int | `units` | scouting stat | World map visibility radius |
| `structure_damage` | int | `units` | siege stat | Non-siege usually `0` |
| `slice_status` | enum | `units` | badge/filter | `playable_now`, `data_stub_post_slice`, `balance_stub` |

### Civilization Modifier Fields (`economy` / `buildings` / `units`)

| Field | Type | Backend Owner | Frontend Need | Notes |
| --- | --- | --- | --- | --- |
| `civ_id` | string | varies by `module_owner` | civ badge/filter | Stable civilization key |
| `module_owner` | enum | `economy`/`buildings`/`units` | hidden | Module that applies modifier |
| `modifier_key` | string | varies by `module_owner` | tooltip label | Stable rule key |
| `scope` | string | varies by `module_owner` | hidden (debug/admin) | Selector target (unit tag/building family/etc.) |
| `operation` | enum | varies by `module_owner` | hidden | `mult`, `add`, `set`, `clamp_min`, `clamp_max` |
| `value` | number | varies by `module_owner` | tooltip value | Modifier magnitude |
| `condition` | string | varies by `module_owner` | tooltip text | Plain condition token string |
| `slice_status` | enum | varies by `module_owner` | badge/filter | `playable_now`, `balance_stub` |

## Starter Resource Set (`economy.resource_definitions`)

| resource_id | display_name | short_label | icon_key | starting_stock | base_storage_cap | base_passive_prod_per_h | producer_building_id | slice_status |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |
| `food` | Food | FOOD | `res_food_placeholder` | 300 | 1000 | 6 | `grain_plot` | `playable_now` |
| `wood` | Wood | WOOD | `res_wood_placeholder` | 260 | 1000 | 4 | `timber_camp` | `playable_now` |
| `stone` | Stone | STONE | `res_stone_placeholder` | 220 | 1000 | 2 | `stone_quarry` | `playable_now` |
| `iron` | Iron | IRON | `res_iron_placeholder` | 140 | 1000 | 1 | `iron_pit` | `playable_now` |

## Core Building Families (`buildings.building_families`)

| family_id | display_name | purpose_summary | primary_backend_owner | frontend_tab | slice_status |
| --- | --- | --- | --- | --- | --- |
| `economy` | Economy | Resource production and throughput | `buildings` | `Economy` | `playable_now` |
| `military` | Military | Unit training and military efficiency | `buildings` | `Military` | `playable_now` |
| `defense` | Defense | Settlement durability and garrison strength | `buildings` | `Defense` | `data_stub_post_slice` |
| `logistics` | Logistics | March readiness and world-map support | `buildings` | `Logistics` | `playable_now` |

## Starter Building Lines (`buildings.building_lines`)

Level cost/time formulas:

- `level_cost(resource) = round(cost_l1 * cost_mult_per_level^(level-1))`
- `level_build_time_s = round(build_time_l1_s * build_time_mult_per_level^(level-1))`

| building_id | display_name | family_id | max_level_v1 | build_time_l1_s | build_time_mult_per_level | cost_food_l1 | cost_wood_l1 | cost_stone_l1 | cost_iron_l1 | cost_mult_per_level | slice_status |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `grain_plot` | Grain Plot | `economy` | 10 | 90 | 1.45 | 40 | 60 | 20 | 0 | 1.55 | `playable_now` |
| `timber_camp` | Timber Camp | `economy` | 10 | 90 | 1.45 | 50 | 40 | 20 | 0 | 1.55 | `playable_now` |
| `stone_quarry` | Stone Quarry | `economy` | 10 | 110 | 1.48 | 60 | 30 | 40 | 0 | 1.58 | `playable_now` |
| `iron_pit` | Iron Pit | `economy` | 10 | 130 | 1.50 | 70 | 40 | 30 | 20 | 1.60 | `playable_now` |
| `barracks` | Barracks | `military` | 10 | 180 | 1.55 | 90 | 120 | 80 | 40 | 1.60 | `playable_now` |
| `rally_post` | Rally Post | `logistics` | 10 | 150 | 1.52 | 80 | 80 | 60 | 20 | 1.58 | `playable_now` |
| `palisade` | Palisade | `defense` | 10 | 160 | 1.55 | 60 | 100 | 120 | 20 | 1.62 | `data_stub_post_slice` |

## Starter Building Effects (`buildings.building_effects`)

Effect formulas:

- `mult_per_level`: `value(level) = value_l1 * scaling_value^(level-1)`
- `add_per_level`: `value(level) = value_l1 + scaling_value * (level-1)`
- `step_levels`: parse `scaling_value` token list (e.g. `+1@3,+1@6`)

| building_id | stat_key | value_l1 | scaling_mode | scaling_value | display_format | notes |
| --- | --- | ---: | --- | --- | --- | --- |
| `grain_plot` | `resource_prod_food_per_h` | 26 | `mult_per_level` | 1.34 | `per_hour` | Primary food source |
| `timber_camp` | `resource_prod_wood_per_h` | 24 | `mult_per_level` | 1.34 | `per_hour` | Primary wood source |
| `stone_quarry` | `resource_prod_stone_per_h` | 20 | `mult_per_level` | 1.33 | `per_hour` | Slower early ramp |
| `iron_pit` | `resource_prod_iron_per_h` | 16 | `mult_per_level` | 1.32 | `per_hour` | Highest strategic bottleneck |
| `barracks` | `unit_train_time_mult_all` | 0.97 | `add_per_level` | -0.03 | `multiplier` | Clamp min 0.70 in code |
| `barracks` | `unit_queue_capacity` | 2 | `step_levels` | `+1@4,+1@7` | `integer` | Starter queue cap = 2 |
| `rally_post` | `march_prep_time_s` | 30 | `add_per_level` | -2 | `seconds` | Clamp min 10 in code |
| `rally_post` | `army_move_speed_mult` | 1.00 | `add_per_level` | 0.02 | `multiplier` | Applies to outgoing marches |
| `palisade` | `wall_hp` | 220 | `mult_per_level` | 1.40 | `integer` | Defense family stub for post-slice |
| `palisade` | `garrison_defense_mult` | 1.05 | `add_per_level` | 0.02 | `multiplier` | Clamp max 1.25 in code |

## Baseline Starter Unit Roster (`units.unit_lines`)

Notes:

- `ram_team` is included as a v1 data stub to preserve shared roster shape without forcing siege gameplay into the first slice
- Training requirements beyond `barracks` are intentionally omitted in the slice; backend can add level gates later

| unit_id | display_name | role | train_building_id | train_time_s | cost_food | cost_wood | cost_stone | cost_iron | upkeep_food_per_h | hp | attack | def_vs_infantry | def_vs_ranged | def_vs_cavalry | speed_tiles_per_h | carry | vision_tiles | structure_damage | slice_status |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `watch_levy` | Watch Levy | `infantry` | `barracks` | 45 | 35 | 20 | 10 | 0 | 1 | 40 | 12 | 16 | 10 | 14 | 6.0 | 30 | 1 | 0 | `playable_now` |
| `bow_crew` | Bow Crew | `ranged` | `barracks` | 55 | 30 | 35 | 10 | 0 | 1 | 28 | 16 | 8 | 14 | 7 | 6.0 | 20 | 2 | 0 | `playable_now` |
| `trail_scout` | Trail Scout | `scout` | `barracks` | 40 | 25 | 30 | 0 | 10 | 1 | 18 | 4 | 5 | 6 | 5 | 12.0 | 10 | 4 | 0 | `playable_now` |
| `light_raider` | Light Raider | `cavalry` | `barracks` | 80 | 60 | 40 | 20 | 20 | 2 | 38 | 20 | 12 | 10 | 14 | 14.0 | 55 | 2 | 0 | `playable_now` |
| `ram_team` | Ram Team | `siege` | `barracks` | 180 | 110 | 80 | 70 | 40 | 3 | 75 | 8 | 18 | 12 | 8 | 4.0 | 0 | 1 | 55 | `data_stub_post_slice` |

## Civilization Activation and Slice Status (`economy/buildings/units`)

| civ_id | display_name | first_slice_availability | notes |
| --- | --- | --- | --- |
| `cinder_throne_legates` | Cinder Throne Legates | `playable_now` | Primary onboarding civilization |
| `mirebound_covenant` | Mirebound Covenant | `balance_stub` | Data-complete modifiers/variants, UI locked in slice |
| `graveforge_clans` | Graveforge Clans | `balance_stub` | Data-complete modifiers/variants, UI locked in slice |

## Civilization Global Modifiers (`economy` / `buildings` / `units`)

These are stat/timing overlays only. No row here requires a civilization-exclusive UI flow.

| civ_id | module_owner | modifier_key | scope | operation | value | condition | slice_status |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| `cinder_throne_legates` | `units` | `unit_upkeep_food_per_h` | `all_units` | `mult` | 0.85 | `stationed_at_home_settlement=true` | `playable_now` |
| `cinder_throne_legates` | `units` | `army_move_speed_mult` | `all_armies` | `mult` | 1.10 | `route_between_owned_settlements=true` | `playable_now` |
| `cinder_throne_legates` | `buildings` | `structure_hp_mult` | `family:defense` | `mult` | 1.10 | `always` | `playable_now` |
| `cinder_throne_legates` | `units` | `structure_damage` | `role:siege` | `mult` | 1.08 | `always` | `playable_now` |
| `cinder_throne_legates` | `units` | `carry` | `role:cavalry` | `mult` | 0.92 | `always` | `playable_now` |
| `mirebound_covenant` | `economy` | `raid_resource_yield` | `raid_return_total` | `mult` | 1.08 | `always` | `balance_stub` |
| `mirebound_covenant` | `units` | `terrain_move_penalty_mult` | `all_armies` | `mult` | 0.50 | `terrain=wetland` | `balance_stub` |
| `mirebound_covenant` | `units` | `vision_tiles` | `role:scout` | `add` | 1 | `terrain=wetland` | `balance_stub` |
| `mirebound_covenant` | `units` | `structure_damage` | `role:siege` | `mult` | 0.90 | `always` | `balance_stub` |
| `graveforge_clans` | `buildings` | `building_cost_stone` | `family:military` | `mult` | 0.90 | `always` | `balance_stub` |
| `graveforge_clans` | `buildings` | `building_cost_iron` | `family:military` | `mult` | 0.90 | `always` | `balance_stub` |
| `graveforge_clans` | `buildings` | `building_cost_stone` | `family:defense` | `mult` | 0.90 | `always` | `balance_stub` |
| `graveforge_clans` | `buildings` | `building_cost_iron` | `family:defense` | `mult` | 0.90 | `always` | `balance_stub` |
| `graveforge_clans` | `buildings` | `build_time_mult` | `family:military` | `mult` | 1.10 | `always` | `balance_stub` |
| `graveforge_clans` | `buildings` | `build_time_mult` | `family:defense` | `mult` | 1.10 | `always` | `balance_stub` |
| `graveforge_clans` | `units` | `train_time_s` | `tag:heavy_infantry` | `mult` | 1.12 | `queue_size<5` | `balance_stub` |
| `graveforge_clans` | `units` | `train_time_s` | `tag:heavy_infantry` | `mult` | 0.92 | `queue_size>=5` | `balance_stub` |
| `graveforge_clans` | `units` | `hp` | `tag:heavy_infantry` | `mult` | 1.12 | `always` | `balance_stub` |

## Civilization Flavor Unit Mapping (`units.unit_variants`)

Flavor units use shared core combat systems and shared unit table fields. Each row maps to a baseline line plus stat modifiers.

| civ_id | variant_unit_id | display_name | base_unit_id | role | slice_status |
| --- | --- | --- | --- | --- | --- |
| `cinder_throne_legates` | `brand_levies` | Brand Levies | `watch_levy` | `infantry` | `playable_now` |
| `cinder_throne_legates` | `tribunal_crossmen` | Tribunal Crossmen | `bow_crew` | `ranged` | `playable_now` |
| `cinder_throne_legates` | `ash_riders` | Ash Riders | `light_raider` | `cavalry` | `playable_now` |
| `cinder_throne_legates` | `ember_rams` | Ember Rams | `ram_team` | `siege` | `data_stub_post_slice` |
| `mirebound_covenant` | `reed_stalkers` | Reed Stalkers | `trail_scout` | `scout` | `balance_stub` |
| `mirebound_covenant` | `bog_spearmen` | Bog Spearmen | `watch_levy` | `infantry` | `balance_stub` |
| `mirebound_covenant` | `rot_slingers` | Rot Slingers | `bow_crew` | `ranged` | `balance_stub` |
| `mirebound_covenant` | `mire_hounds` | Mire Hounds | `light_raider` | `cavalry` | `balance_stub` |
| `graveforge_clans` | `pit_guard` | Pit Guard | `watch_levy` | `infantry` | `balance_stub` |
| `graveforge_clans` | `chainthrowers` | Chainthrowers | `bow_crew` | `ranged` | `balance_stub` |
| `graveforge_clans` | `tithe_boars` | Tithe Boars | `light_raider` | `cavalry` | `balance_stub` |
| `graveforge_clans` | `woe_trebuchet` | Woe Trebuchet | `ram_team` | `siege` | `balance_stub` |

## Civilization Flavor Unit Modifiers (`units.unit_variant_modifiers`)

Formula application order (recommended):

1. Start from `units.unit_lines`
2. Apply civilization global modifiers
3. Apply variant-specific modifiers below
4. Clamp to rules (minimum train time, etc.)

| variant_unit_id | modifier_key | operation | value | condition |
| --- | --- | --- | ---: | --- |
| `brand_levies` | `cost_total` | `mult` | 0.90 | `always` |
| `brand_levies` | `train_time_s` | `mult` | 0.85 | `always` |
| `brand_levies` | `attack` | `mult` | 0.88 | `always` |
| `brand_levies` | `def_vs_infantry` | `mult` | 1.08 | `always` |
| `brand_levies` | `hp` | `mult` | 1.05 | `stationed_at_home_settlement=true` |
| `tribunal_crossmen` | `attack` | `mult` | 1.08 | `always` |
| `tribunal_crossmen` | `vision_tiles` | `add` | 1 | `stationed_at_home_settlement=true` |
| `tribunal_crossmen` | `def_vs_ranged` | `mult` | 1.10 | `stationed_at_home_settlement=true` |
| `ash_riders` | `speed_tiles_per_h` | `mult` | 0.95 | `always` |
| `ash_riders` | `def_vs_cavalry` | `mult` | 1.15 | `always` |
| `ash_riders` | `attack` | `mult` | 0.95 | `target_is_settlement=false` |
| `ember_rams` | `train_time_s` | `mult` | 0.90 | `always` |
| `ember_rams` | `structure_damage` | `mult` | 1.05 | `always` |
| `reed_stalkers` | `speed_tiles_per_h` | `mult` | 1.10 | `always` |
| `reed_stalkers` | `vision_tiles` | `add` | 1 | `always` |
| `reed_stalkers` | `retreat_escape_chance` | `add` | 0.12 | `always` |
| `bog_spearmen` | `cost_total` | `mult` | 0.92 | `always` |
| `bog_spearmen` | `def_vs_cavalry` | `mult` | 1.18 | `always` |
| `bog_spearmen` | `hp` | `mult` | 0.92 | `always` |
| `rot_slingers` | `attack` | `mult` | 0.92 | `always` |
| `rot_slingers` | `combat_postfight_attrition_duration_s` | `add` | 300 | `hit_confirmed=true` |
| `mire_hounds` | `speed_tiles_per_h` | `mult` | 1.12 | `always` |
| `mire_hounds` | `carry` | `mult` | 0.75 | `always` |
| `mire_hounds` | `attack` | `mult` | 1.05 | `target_retreating=true` |
| `pit_guard` | `hp` | `mult` | 1.22 | `always` |
| `pit_guard` | `attack` | `mult` | 1.10 | `always` |
| `pit_guard` | `speed_tiles_per_h` | `mult` | 0.82 | `always` |
| `pit_guard` | `train_time_s` | `mult` | 1.20 | `always` |
| `chainthrowers` | `attack` | `mult` | 1.12 | `always` |
| `chainthrowers` | `def_vs_infantry` | `mult` | 1.08 | `always` |
| `chainthrowers` | `speed_tiles_per_h` | `mult` | 0.90 | `always` |
| `tithe_boars` | `attack` | `mult` | 1.18 | `always` |
| `tithe_boars` | `speed_tiles_per_h` | `mult` | 0.88 | `always` |
| `tithe_boars` | `post_combat_recovery_time_s` | `add` | 120 | `charge_committed=true` |
| `woe_trebuchet` | `structure_damage` | `mult` | 1.25 | `always` |
| `woe_trebuchet` | `train_time_s` | `mult` | 1.30 | `always` |
| `woe_trebuchet` | `speed_tiles_per_h` | `mult` | 0.75 | `always` |

## Implementation Notes (M1-safe)

- Backend ownership split:
  - `economy` owns resources, passive production, raid yield modifiers
  - `buildings` owns building line/effect tables and building-family cost/time modifiers
  - `units` owns baseline units, variant overlays, upkeep/training/combat stat modifiers
- Frontend should treat all `display_name`/`icon_key` values as placeholders and bind badges from `slice_status`
- Recommended first-slice enable list:
  - civilization: `cinder_throne_legates`
  - buildings: all `playable_now` rows
  - units: all `playable_now` rows
  - hide `data_stub_post_slice` and `balance_stub` in default player UI
