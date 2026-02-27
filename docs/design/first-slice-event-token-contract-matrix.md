# First-Slice Event Token Contract Matrix (Settlement + Map Loops)

## Scope

- This contract covers first-slice required default rendering keys for `tick`, `build`, `train`, `scout`, and hostile map dispatch/resolve flows.
- Scope guard: constrained to `docs/design/first-vertical-slice.md`; no new mechanics are introduced.
- Source of truth inputs:
  - `backend/src/app/config/seeds/v1/narrative/first-slice-content-key-manifest.json`
  - `backend/src/app/config/seeds/v1/narrative/event-feed-messages.json`

## Retention Rationale

- Next 1-5 minute goal: players act and immediately see legible event feedback with resolved placeholders (`action -> feedback`) for each core loop action.
- Session goal: maintain clear progression readability across settlement growth and one hostile map interaction without key/token mismatch failures.
- Return hook: deterministic event wording and tokenized outcomes preserve trust in progress logs, so players return to continue build/train/hostile timing plans.
- Churn risk mitigated: opaque or broken event copy caused by missing tokens/unstable key names.

## Contract Rules

- `canonical_key` entries below are the required default coverage set for first-slice rendering.
- `required_tokens` is authoritative from narrative seed `tokens`; `(none)` means literal placeholder text with no token substitution required.
- Legacy aliases are compatibility-only lookup inputs and must not be selected as primary default keys.
- `deferred_post_slice_keys` are explicitly excluded from required default rendering coverage.

## Canonical Key -> Required Token Matrix

### Tick Loop (`tick`)

| canonical_key | required_tokens |
| --- | --- |
| `event.tick.passive_income` | `settlement_name, food_gain, wood_gain, stone_gain, iron_gain` |
| `event.tick.storage_near_cap` | `settlement_name, resource_label` |
| `event.tick.producer_unlocked_hint` | `building_label, resource_label, settlement_name` |
| `event.tick.passive_gain_success` | `settlement_name, duration_ms` |
| `event.tick.passive_gain_reasoned` | `settlement_name, reason_codes, duration_ms` |
| `event.tick.passive_gain_stalled` | `settlement_name, duration_ms` |
| `event.tick.passive_gain_capped` | `settlement_name` |

### Build Loop (`build`)

| canonical_key | required_tokens |
| --- | --- |
| `event.build.upgrade_started` | `settlement_name, building_label, from_level, to_level` |
| `event.build.upgrade_completed` | `settlement_name, building_label, new_level` |
| `event.build.queue_blocked_resources` | `settlement_name, building_label` |
| `event.build.success` | `settlement_name, building_label, from_level, to_level` |
| `event.build.failure_insufficient_resources` | `building_id, missing_resources_by_id, required_cost_by_id, available_stock_by_id` |
| `event.build.failure_cooldown` | `building_id, cooldown_ends_at` |
| `event.build.failure_invalid_state` | `building_id, invalid_reason` |

### Train Loop (`train`)

| canonical_key | required_tokens |
| --- | --- |
| `event.train.started` | `settlement_name, quantity, unit_label` |
| `event.train.completed` | `settlement_name, quantity, unit_label` |
| `event.train.queue_full` | `settlement_name` |
| `event.train.success` | `settlement_name, quantity, unit_label` |
| `event.train.failure_insufficient_resources` | `unit_id, missing_resources_by_id, required_cost_by_id` |
| `event.train.failure_cooldown` | `unit_id, queue_available_at, cooldown_remaining_ms` |
| `event.train.failure_invalid_state` | `unit_id, invalid_reason` |

### Scout Loop (`scout`)

| canonical_key | required_tokens |
| --- | --- |
| `event.scout.dispatched` | `settlement_name, target_tile_label` |
| `event.scout.report_empty` | `target_tile_label` |
| `event.scout.report_hostile` | `target_tile_label, hostile_force_estimate` |
| `event.scout.dispatched_success` | `settlement_name, target_tile_label` |
| `event.scout.return_empty` | `target_tile_label` |
| `event.scout.return_hostile` | `target_tile_label, hostile_force_estimate` |

### Hostile Loop (`hostile_dispatch_and_resolve`)

| canonical_key | required_tokens |
| --- | --- |
| `event.world.hostile_foreign_settlement_spotted` | `target_tile_label` |
| `event.world.hostile_dispatch_target_required` | `(none)` |
| `event.world.hostile_dispatch_accepted` | `army_name, origin_settlement_name, target_tile_label` |
| `event.world.hostile_dispatch_en_route` | `army_name, target_tile_label, eta_seconds` |
| `event.world.hostile_dispatch_failed` | `error_code, target_tile_label, message` |
| `event.world.hostile_dispatch_failed_source_target_not_foreign` | `source_settlement_name` |
| `event.world.hostile_dispatch_failed_max_active_marches_reached` | `source_settlement_name` |
| `event.world.hostile_dispatch_failed_path_blocked_impassable` | `target_tile_label` |
| `event.world.hostile_dispatch_failed_march_already_exists` | `march_id` |
| `event.world.hostile_march_arrived_outer_works` | `army_name, target_tile_label` |
| `event.world.hostile_march_arrived_gate_contested` | `army_name, target_tile_label` |
| `event.combat.hostile_resolve_attacker_win` | `army_name, target_tile_label` |
| `event.combat.hostile_resolve_defender_win` | `army_name, target_tile_label` |
| `event.combat.hostile_resolve_tie_defender_holds` | `target_tile_label` |
| `event.combat.hostile_loss_report` | `attacker_units_lost, attacker_units_dispatched, defender_garrison_lost, defender_strength` |
| `event.combat.hostile_garrison_broken` | `target_tile_label` |
| `event.combat.hostile_counterfire_heavy` | `(none)` |
| `event.world.hostile_retreat_ordered` | `army_name, target_tile_label, settlement_name` |
| `event.world.hostile_retreat_in_motion` | `army_name` |
| `event.world.hostile_retreat_completed` | `army_name, settlement_name, attacker_units_remaining` |
| `event.world.hostile_defeat_force_shattered` | `target_tile_label, army_name` |
| `event.world.hostile_defeat_command_silent` | `army_name` |
| `event.world.hostile_post_battle_return_started` | `army_name, settlement_name` |
| `event.world.hostile_post_battle_returned` | `army_name, settlement_name` |

## Legacy Alias -> Canonical Mapping (Explicit)

| canonical_key | legacy_alias_keys |
| --- | --- |
| `event.tick.passive_income` | `event.economy.tick_passive_income` |
| `event.tick.storage_near_cap` | `event.economy.storage_near_cap` |
| `event.tick.producer_unlocked_hint` | `event.economy.producer_unlocked_hint` |
| `event.build.upgrade_started` | `event.buildings.upgrade_started` |
| `event.build.upgrade_completed` | `event.buildings.upgrade_completed` |
| `event.build.queue_blocked_resources` | `event.buildings.queue_blocked_resources` |
| `event.train.started` | `event.units.training_started` |
| `event.train.completed` | `event.units.training_completed` |
| `event.train.queue_full` | `event.units.training_queue_full` |
| `event.scout.dispatched` | `event.world.scout_dispatched` |
| `event.scout.report_empty` | `event.world.scout_report_empty` |
| `event.scout.report_hostile` | `event.world.scout_report_hostile` |
| `event.world.hostile_dispatch_en_route` | `event.world.march_started` |
| `event.world.hostile_post_battle_returned` | `event.world.march_returned` |
| `event.world.hostile_retreat_completed` | `event.world.march_returned` |
| `event.world.hostile_defeat_force_shattered` | `event.world.march_returned` |
| `event.combat.hostile_resolve_attacker_win` | `event.combat.placeholder_skirmish_win` |
| `event.combat.hostile_resolve_defender_win` | `event.combat.placeholder_skirmish_loss` |
| `event.combat.hostile_resolve_tie_defender_holds` | `event.combat.placeholder_skirmish_loss` |

## Post-Slice Keys Excluded From Required Default Rendering Coverage

| key | slice_status | exclusion_reason |
| --- | --- | --- |
| `event.world.gather_started` | `data_stub_post_slice` | Gather node loop is post-slice and must not be loaded into default first-session content routing. |
| `event.world.gather_completed` | `data_stub_post_slice` | Gather node completion copy is outside the first playable settlement + hostile loop. |
| `event.world.ambush_triggered` | `data_stub_post_slice` | Ambush branch outcomes are deferred until post-slice world-map depth work. |
| `event.world.ambush_resolved` | `data_stub_post_slice` | Ambush resolution templates remain deferred with gather/encounter systems. |
| `event.hero.assigned` | `data_stub_post_slice` | Hero attachment templates are explicitly post-slice per first-vertical-slice scope. |
| `event.hero.unassigned` | `data_stub_post_slice` | Hero detach lifecycle copy is deferred with hero runtime feature rollout. |
| `event.hero.ability_activated` | `data_stub_post_slice` | Hero ability activation events are outside first-slice scope. |
| `event.hero.cooldown_complete` | `data_stub_post_slice` | Hero cooldown event templates are deferred with post-slice hero systems. |

## Alignment Notes

- Backend: emit canonical keys for new payloads and include aliases only for compatibility lookup paths.
- Frontend: seed default rendering from canonical matrix only; resolve aliases via declared deterministic order (`canonical_key`, then declared `legacy_keys`).
- Content: keep template token lists in sync with this matrix when placeholder copy is replaced.
