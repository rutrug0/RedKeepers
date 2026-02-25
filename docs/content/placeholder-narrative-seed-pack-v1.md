# RedKeepers V1 Placeholder Narrative Seed Pack

Status: Replaceable placeholder text for M1 integration. All entries below are intended to be swapped later without changing stable identifiers.

Primary references:
- `docs/design/factions-and-civilizations.md`
- `docs/design/v1-starter-data-tables.md`
- `docs/design/first-vertical-slice.md`

## Format Notes

- `key` values are stable content/template keys for UI/frontend/backend integration.
- Tokens use `{token_name}` syntax.
- `slice_status_scope` reflects expected M1 usage (`playable_now` vs `balance_stub`/`data_stub_post_slice`).
- Base `display_name` fields from design tables remain authoritative; flavor labels below are optional placeholder overlays/tooltips.

## 1. Civilization Intro Copy (Placeholder)

| key | civ_id | slice_status_scope | intro_text |
| --- | --- | --- | --- |
| `civ_intro.cinder_throne_legates` | `cinder_throne_legates` | `playable_now` | The Cinder Throne Legates hold the frontier by ash, ration, and decree. Their magistrates build roads before monuments, and their branded levies turn every settlement into a hard post that is costly to break. |
| `civ_intro.mirebound_covenant` | `mirebound_covenant` | `balance_stub` | The Mirebound Covenant survives where maps rot at the edges. Reed-cloaked bands move through drowned paths, trading open battles for patience, poison, and sudden strikes from bad ground. |
| `civ_intro.graveforge_clans` | `graveforge_clans` | `balance_stub` | The Graveforge Clans carve keeps from dead hills and pay their oaths in iron. Slow to rise and harder to move, their hosts grow into relentless armies once the forges burn steady. |

## 2. Starter Settlement Name Pools (12 Placeholder Names)

| key | category | civ_id | slice_status_scope | settlement_name | notes |
| --- | --- | --- | --- | --- | --- |
| `starter_settlement_name.cinder_01` | `starter_settlement_name_pool` | `cinder_throne_legates` | `playable_now` | Ashgate | Fortified road junction tone |
| `starter_settlement_name.cinder_02` | `starter_settlement_name_pool` | `cinder_throne_legates` | `playable_now` | Brandwatch | Garrison/watchpost tone |
| `starter_settlement_name.cinder_03` | `starter_settlement_name_pool` | `cinder_throne_legates` | `playable_now` | Cinder Toll | Administrative frontier tone |
| `starter_settlement_name.cinder_04` | `starter_settlement_name_pool` | `cinder_throne_legates` | `playable_now` | Ration Ford | Logistics/discipline tone |
| `starter_settlement_name.mire_01` | `starter_settlement_name_pool` | `mirebound_covenant` | `balance_stub` | Reedwake | Wetland route tone |
| `starter_settlement_name.mire_02` | `starter_settlement_name_pool` | `mirebound_covenant` | `balance_stub` | Fen Lantern | Marsh outpost tone |
| `starter_settlement_name.mire_03` | `starter_settlement_name_pool` | `mirebound_covenant` | `balance_stub` | Silt Hollow | Drowned-ground settlement tone |
| `starter_settlement_name.mire_04` | `starter_settlement_name_pool` | `mirebound_covenant` | `balance_stub` | Moss Sluice | Water-control settlement tone |
| `starter_settlement_name.graveforge_01` | `starter_settlement_name_pool` | `graveforge_clans` | `balance_stub` | Forgecut | Quarry/forge settlement tone |
| `starter_settlement_name.graveforge_02` | `starter_settlement_name_pool` | `graveforge_clans` | `balance_stub` | Blackpit Hold | Defensive quarry tone |
| `starter_settlement_name.graveforge_03` | `starter_settlement_name_pool` | `graveforge_clans` | `balance_stub` | Tithe Quarry | Clan-industry tone |
| `starter_settlement_name.graveforge_04` | `starter_settlement_name_pool` | `graveforge_clans` | `balance_stub` | Chain Anvil | Forge-war host tone |

## 3. Optional Placeholder Flavor Labels (Units/Buildings)

These are replaceable text overlays for tooltips/cards. Do not replace stable IDs or base table `display_name` values in data.

### Buildings (`building_id`)

| key | building_id | family_id | slice_status_scope | placeholder_flavor_label | tooltip_stub |
| --- | --- | --- | --- | --- | --- |
| `building_flavor.grain_plot` | `grain_plot` | `economy` | `playable_now` | Ashfield Plot | Thin-soil grain rows guarded by levy duty rotations. |
| `building_flavor.timber_camp` | `timber_camp` | `economy` | `playable_now` | Gallows Timber Camp | Road timber yard with rough-cut stockpiles and branded quotas. |
| `building_flavor.stone_quarry` | `stone_quarry` | `economy` | `playable_now` | Tribunal Quarry | Quarry crews cut stone under posted magistrate levy counts. |
| `building_flavor.iron_pit` | `iron_pit` | `economy` | `playable_now` | Cinder Iron Pit | Smoky extraction pit feeding tools, fittings, and war stock. |
| `building_flavor.barracks` | `barracks` | `military` | `playable_now` | Levy Barracks | Drill yard for musters, watch rotations, and rapid call-ups. |
| `building_flavor.rally_post` | `rally_post` | `logistics` | `playable_now` | Road Warden Post | Dispatch station for scouts, couriers, and march columns. |

### Base Units (`unit_id`)

| key | unit_id | role | train_building_id | slice_status_scope | placeholder_flavor_label | tooltip_stub |
| --- | --- | --- | --- | --- | --- | --- |
| `unit_flavor.watch_levy` | `watch_levy` | `infantry` | `barracks` | `playable_now` | Wall Watch Levy | Pressed townsfolk trained for gates, walls, and checkpoint fights. |
| `unit_flavor.bow_crew` | `bow_crew` | `ranged` | `barracks` | `playable_now` | Yard Bow Crew | Barracks archers drilled for steady volleys over palisades. |
| `unit_flavor.trail_scout` | `trail_scout` | `scout` | `barracks` | `playable_now` | Dust Trail Scout | Fast riders and runners used to mark roads and report movement. |
| `unit_flavor.light_raider` | `light_raider` | `cavalry` | `barracks` | `playable_now` | Spur Raider | Light cavalry for pursuit, interception, and short raids. |

### Civilization Variant Units (`variant_unit_id`)

| key | civ_id | variant_unit_id | base_unit_id | role | slice_status_scope | placeholder_tagline |
| --- | --- | --- | --- | --- | --- | --- |
| `variant_flavor.brand_levies` | `cinder_throne_legates` | `brand_levies` | `watch_levy` | `infantry` | `playable_now` | Branded levy ranks hardened by ration discipline and wall duty. |
| `variant_flavor.tribunal_crossmen` | `cinder_throne_legates` | `tribunal_crossmen` | `bow_crew` | `ranged` | `playable_now` | Tribunal marksmen tasked with breaking assaults before the gate. |
| `variant_flavor.ash_riders` | `cinder_throne_legates` | `ash_riders` | `light_raider` | `cavalry` | `playable_now` | Intercept cavalry assigned to patrol roads between owned settlements. |
| `variant_flavor.ember_rams` | `cinder_throne_legates` | `ember_rams` | `ram_team` | `siege` | `data_stub_post_slice` | Early siege crews pushing iron-bound rams under cinder screens. |
| `variant_flavor.reed_stalkers` | `mirebound_covenant` | `reed_stalkers` | `trail_scout` | `scout` | `balance_stub` | Wetland scouts that vanish into reeds before a counterstrike lands. |
| `variant_flavor.bog_spearmen` | `mirebound_covenant` | `bog_spearmen` | `watch_levy` | `infantry` | `balance_stub` | Marsh fighters set for ambush lanes and anti-cavalry stands. |
| `variant_flavor.rot_slingers` | `mirebound_covenant` | `rot_slingers` | `bow_crew` | `ranged` | `balance_stub` | Sling crews that wear enemies down over repeated skirmishes. |
| `variant_flavor.mire_hounds` | `mirebound_covenant` | `mire_hounds` | `light_raider` | `cavalry` | `balance_stub` | Fast beast riders built for pursuit and harassment, not hauling. |
| `variant_flavor.pit_guard` | `graveforge_clans` | `pit_guard` | `watch_levy` | `infantry` | `balance_stub` | Heavy clan infantry raised to hold quarry gates and breach lanes. |
| `variant_flavor.chainthrowers` | `graveforge_clans` | `chainthrowers` | `bow_crew` | `ranged` | `balance_stub` | Forge crews hurling weighted chain shot at close support range. |
| `variant_flavor.tithe_boars` | `graveforge_clans` | `tithe_boars` | `light_raider` | `cavalry` | `balance_stub` | Shock beasts for brutal charges and costly follow-through. |
| `variant_flavor.woe_trebuchet` | `graveforge_clans` | `woe_trebuchet` | `ram_team` | `siege` | `balance_stub` | Late heavy engine crews that turn quarry craft into siege work. |

## 4. Event Feed Message Templates (Placeholder, Replaceable)

| key | event_category | related_ids | slice_status_scope | template |
| --- | --- | --- | --- | --- |
| `event.economy.tick_passive_income` | `economy` | `resource_id:*` | `playable_now` | `{settlement_name} stores rise: +{food_gain} Food, +{wood_gain} Wood, +{stone_gain} Stone, +{iron_gain} Iron.` |
| `event.economy.storage_near_cap` | `economy` | `resource_id:{resource_id}` | `playable_now` | `{settlement_name} is nearly full on {resource_label}. Spend or upgrade production priorities before overflow wastes stock.` |
| `event.economy.producer_unlocked_hint` | `economy` | `building_id:{building_id}` | `playable_now` | `{building_label} can be improved to steady {resource_label} output in {settlement_name}.` |
| `event.buildings.upgrade_started` | `buildings` | `building_id:{building_id}` | `playable_now` | `{settlement_name}: work begins on {building_label} (Lv.{from_level} -> Lv.{to_level}).` |
| `event.buildings.upgrade_completed` | `buildings` | `building_id:{building_id}` | `playable_now` | `{settlement_name}: {building_label} reaches Lv.{new_level}. Crews return to regular duty.` |
| `event.buildings.queue_blocked_resources` | `buildings` | `building_id:{building_id};resource_id:*` | `playable_now` | `{settlement_name}: insufficient stores for {building_label}. Required materials have not been gathered.` |
| `event.buildings.family_military_ready` | `buildings` | `family_id:military;building_id:barracks` | `playable_now` | `{settlement_name}: the Barracks yard is ready for fresh musters.` |
| `event.buildings.family_logistics_ready` | `buildings` | `family_id:logistics;building_id:rally_post` | `playable_now` | `{settlement_name}: the Rally Post is staffed. Routes and march orders can be issued.` |
| `event.units.training_started` | `units` | `unit_id:{unit_id};building_id:barracks` | `playable_now` | `{settlement_name}: training begins for {quantity} {unit_label}.` |
| `event.units.training_completed` | `units` | `unit_id:{unit_id}` | `playable_now` | `{settlement_name}: {quantity} {unit_label} report ready for orders.` |
| `event.units.training_queue_full` | `units` | `building_id:barracks` | `playable_now` | `{settlement_name}: barracks queue is full. Resolve current musters before issuing more training orders.` |
| `event.units.variant_available_cinder` | `units` | `civ_id:cinder_throne_legates;variant_unit_id:{variant_unit_id}` | `playable_now` | `Cinder Tribunal notice: {variant_label} are now authorized for recruitment in {settlement_name}.` |
| `event.units.upkeep_warning_field_army` | `units` | `civ_id:{civ_id};resource_id:food` | `playable_now` | `{army_name} is straining {settlement_name}'s food stores while deployed. Field upkeep remains at full rate.` |
| `event.units.upkeep_reduced_garrison` | `units` | `civ_id:cinder_throne_legates;resource_id:food` | `playable_now` | `{settlement_name}: garrison ration discipline reduces stationed troop upkeep.` |
| `event.world.scout_dispatched` | `world_map` | `unit_id:trail_scout` | `playable_now` | `{settlement_name}: scouts ride out toward {target_tile_label}.` |
| `event.world.scout_report_empty` | `world_map` | `unit_id:trail_scout` | `playable_now` | `Scout report from {target_tile_label}: no active host detected. The roads remain quiet for now.` |
| `event.world.scout_report_hostile` | `world_map` | `unit_id:trail_scout` | `playable_now` | `Scout report from {target_tile_label}: hostile movement sighted ({hostile_force_estimate}).` |
| `event.world.march_started` | `world_map` | `unit_id:*;building_id:rally_post` | `playable_now` | `{army_name} marches from {origin_settlement_name} toward {target_tile_label}.` |
| `event.world.march_returned` | `world_map` | `unit_id:*` | `playable_now` | `{army_name} returns to {settlement_name} with {haul_summary}.` |
| `event.world.road_warden_speed_bonus` | `world_map` | `civ_id:cinder_throne_legates;modifier_key:army_move_speed_mult` | `playable_now` | `Road Wardens shorten the march. {army_name} gains speed on the route between owned settlements.` |
| `event.combat.placeholder_skirmish_win` | `combat_placeholder` | `unit_id:*` | `playable_now` | `{army_name} wins a brief skirmish near {target_tile_label}. Losses are light; survivors regroup for orders.` |
| `event.combat.placeholder_skirmish_loss` | `combat_placeholder` | `unit_id:*` | `playable_now` | `{army_name} is driven off near {target_tile_label}. Survivors fall back toward {settlement_name}.` |
| `event.settlement.new_settlement_founded` | `settlement` | `civ_id:{civ_id}` | `playable_now` | `A new holding is founded: {settlement_name}. Tents, stores, and watchfires are raised before dusk.` |
| `event.settlement.name_assigned` | `settlement` | `category:starter_settlement_name_pool` | `playable_now` | `Surveyors record the new holding as {settlement_name}. The name enters the ledger.` |

## 5. Integration Notes (M1)

- Prioritize `playable_now` rows in the first slice UI/event feed.
- `balance_stub` and `data_stub_post_slice` rows are present to stabilize keys and future content wiring.
- If the frontend needs a smaller initial seed, keep keys unchanged and subset by `slice_status_scope`.

