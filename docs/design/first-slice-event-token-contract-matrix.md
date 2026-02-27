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
- `migration_key_status` has only two allowed values: `canonical-default` and `compatibility-only`.
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

## Canonical Namespace Migration Matrix (Default + Compatibility)

- This is the canonical migration matrix for first-slice runtime keys across `tick`, `build`, `train`, `scout`, and `hostile_dispatch_and_resolve`.
- Backend/frontend/content must treat this table as the single source of truth for namespace migration and default rendering eligibility.

| flow | runtime_key | migration_key_status | canonical_default_key | default_render_eligible | approved_compatibility_aliases |
| --- | --- | --- | --- | --- | --- |
| `tick` | `event.tick.passive_income` | `canonical-default` | `event.tick.passive_income` | `yes` | `event.economy.tick_passive_income` |
| `tick` | `event.economy.tick_passive_income` | `compatibility-only` | `event.tick.passive_income` | `no` | `(n/a)` |
| `tick` | `event.tick.storage_near_cap` | `canonical-default` | `event.tick.storage_near_cap` | `yes` | `event.economy.storage_near_cap` |
| `tick` | `event.economy.storage_near_cap` | `compatibility-only` | `event.tick.storage_near_cap` | `no` | `(n/a)` |
| `tick` | `event.tick.producer_unlocked_hint` | `canonical-default` | `event.tick.producer_unlocked_hint` | `yes` | `event.economy.producer_unlocked_hint` |
| `tick` | `event.economy.producer_unlocked_hint` | `compatibility-only` | `event.tick.producer_unlocked_hint` | `no` | `(n/a)` |
| `tick` | `event.tick.passive_gain_success` | `canonical-default` | `event.tick.passive_gain_success` | `yes` | `(none)` |
| `tick` | `event.tick.passive_gain_reasoned` | `canonical-default` | `event.tick.passive_gain_reasoned` | `yes` | `(none)` |
| `tick` | `event.tick.passive_gain_stalled` | `canonical-default` | `event.tick.passive_gain_stalled` | `yes` | `(none)` |
| `tick` | `event.tick.passive_gain_capped` | `canonical-default` | `event.tick.passive_gain_capped` | `yes` | `(none)` |
| `build` | `event.build.upgrade_started` | `canonical-default` | `event.build.upgrade_started` | `yes` | `event.buildings.upgrade_started` |
| `build` | `event.buildings.upgrade_started` | `compatibility-only` | `event.build.upgrade_started` | `no` | `(n/a)` |
| `build` | `event.build.upgrade_completed` | `canonical-default` | `event.build.upgrade_completed` | `yes` | `event.buildings.upgrade_completed` |
| `build` | `event.buildings.upgrade_completed` | `compatibility-only` | `event.build.upgrade_completed` | `no` | `(n/a)` |
| `build` | `event.build.queue_blocked_resources` | `canonical-default` | `event.build.queue_blocked_resources` | `yes` | `event.buildings.queue_blocked_resources` |
| `build` | `event.buildings.queue_blocked_resources` | `compatibility-only` | `event.build.queue_blocked_resources` | `no` | `(n/a)` |
| `build` | `event.build.success` | `canonical-default` | `event.build.success` | `yes` | `(none)` |
| `build` | `event.build.failure_insufficient_resources` | `canonical-default` | `event.build.failure_insufficient_resources` | `yes` | `(none)` |
| `build` | `event.build.failure_cooldown` | `canonical-default` | `event.build.failure_cooldown` | `yes` | `(none)` |
| `build` | `event.build.failure_invalid_state` | `canonical-default` | `event.build.failure_invalid_state` | `yes` | `(none)` |
| `train` | `event.train.started` | `canonical-default` | `event.train.started` | `yes` | `event.units.training_started` |
| `train` | `event.units.training_started` | `compatibility-only` | `event.train.started` | `no` | `(n/a)` |
| `train` | `event.train.completed` | `canonical-default` | `event.train.completed` | `yes` | `event.units.training_completed` |
| `train` | `event.units.training_completed` | `compatibility-only` | `event.train.completed` | `no` | `(n/a)` |
| `train` | `event.train.queue_full` | `canonical-default` | `event.train.queue_full` | `yes` | `event.units.training_queue_full` |
| `train` | `event.units.training_queue_full` | `compatibility-only` | `event.train.queue_full` | `no` | `(n/a)` |
| `train` | `event.train.success` | `canonical-default` | `event.train.success` | `yes` | `(none)` |
| `train` | `event.train.failure_insufficient_resources` | `canonical-default` | `event.train.failure_insufficient_resources` | `yes` | `(none)` |
| `train` | `event.train.failure_cooldown` | `canonical-default` | `event.train.failure_cooldown` | `yes` | `(none)` |
| `train` | `event.train.failure_invalid_state` | `canonical-default` | `event.train.failure_invalid_state` | `yes` | `(none)` |
| `scout` | `event.scout.dispatched` | `canonical-default` | `event.scout.dispatched` | `yes` | `event.world.scout_dispatched` |
| `scout` | `event.world.scout_dispatched` | `compatibility-only` | `event.scout.dispatched` | `no` | `(n/a)` |
| `scout` | `event.scout.report_empty` | `canonical-default` | `event.scout.report_empty` | `yes` | `event.world.scout_report_empty` |
| `scout` | `event.world.scout_report_empty` | `compatibility-only` | `event.scout.report_empty` | `no` | `(n/a)` |
| `scout` | `event.scout.report_hostile` | `canonical-default` | `event.scout.report_hostile` | `yes` | `event.world.scout_report_hostile` |
| `scout` | `event.world.scout_report_hostile` | `compatibility-only` | `event.scout.report_hostile` | `no` | `(n/a)` |
| `scout` | `event.scout.dispatched_success` | `canonical-default` | `event.scout.dispatched_success` | `yes` | `(none)` |
| `scout` | `event.scout.return_empty` | `canonical-default` | `event.scout.return_empty` | `yes` | `(none)` |
| `scout` | `event.scout.return_hostile` | `canonical-default` | `event.scout.return_hostile` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_foreign_settlement_spotted` | `canonical-default` | `event.world.hostile_foreign_settlement_spotted` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_dispatch_target_required` | `canonical-default` | `event.world.hostile_dispatch_target_required` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_dispatch_accepted` | `canonical-default` | `event.world.hostile_dispatch_accepted` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_dispatch_en_route` | `canonical-default` | `event.world.hostile_dispatch_en_route` | `yes` | `event.world.march_started` |
| `hostile_dispatch_and_resolve` | `event.world.march_started` | `compatibility-only` | `event.world.hostile_dispatch_en_route` | `no` | `(n/a)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_dispatch_failed` | `canonical-default` | `event.world.hostile_dispatch_failed` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_dispatch_failed_source_target_not_foreign` | `canonical-default` | `event.world.hostile_dispatch_failed_source_target_not_foreign` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_dispatch_failed_max_active_marches_reached` | `canonical-default` | `event.world.hostile_dispatch_failed_max_active_marches_reached` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_dispatch_failed_path_blocked_impassable` | `canonical-default` | `event.world.hostile_dispatch_failed_path_blocked_impassable` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_dispatch_failed_march_already_exists` | `canonical-default` | `event.world.hostile_dispatch_failed_march_already_exists` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_march_arrived_outer_works` | `canonical-default` | `event.world.hostile_march_arrived_outer_works` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_march_arrived_gate_contested` | `canonical-default` | `event.world.hostile_march_arrived_gate_contested` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.combat.hostile_resolve_attacker_win` | `canonical-default` | `event.combat.hostile_resolve_attacker_win` | `yes` | `event.combat.placeholder_skirmish_win` |
| `hostile_dispatch_and_resolve` | `event.combat.placeholder_skirmish_win` | `compatibility-only` | `event.combat.hostile_resolve_attacker_win` | `no` | `(n/a)` |
| `hostile_dispatch_and_resolve` | `event.combat.hostile_resolve_defender_win` | `canonical-default` | `event.combat.hostile_resolve_defender_win` | `yes` | `event.combat.placeholder_skirmish_loss` |
| `hostile_dispatch_and_resolve` | `event.combat.placeholder_skirmish_loss` | `compatibility-only` | `event.combat.hostile_resolve_defender_win` | `no` | `(n/a)` |
| `hostile_dispatch_and_resolve` | `event.combat.hostile_resolve_tie_defender_holds` | `canonical-default` | `event.combat.hostile_resolve_tie_defender_holds` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.combat.hostile_loss_report` | `canonical-default` | `event.combat.hostile_loss_report` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.combat.hostile_garrison_broken` | `canonical-default` | `event.combat.hostile_garrison_broken` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.combat.hostile_counterfire_heavy` | `canonical-default` | `event.combat.hostile_counterfire_heavy` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_retreat_ordered` | `canonical-default` | `event.world.hostile_retreat_ordered` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_retreat_in_motion` | `canonical-default` | `event.world.hostile_retreat_in_motion` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_retreat_completed` | `canonical-default` | `event.world.hostile_retreat_completed` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_defeat_force_shattered` | `canonical-default` | `event.world.hostile_defeat_force_shattered` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_defeat_command_silent` | `canonical-default` | `event.world.hostile_defeat_command_silent` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_post_battle_return_started` | `canonical-default` | `event.world.hostile_post_battle_return_started` | `yes` | `(none)` |
| `hostile_dispatch_and_resolve` | `event.world.hostile_post_battle_returned` | `canonical-default` | `event.world.hostile_post_battle_returned` | `yes` | `event.world.march_returned` |
| `hostile_dispatch_and_resolve` | `event.world.march_returned` | `compatibility-only` | `event.world.hostile_post_battle_returned` | `no` | `(n/a)` |

## First-Session Objective Sequence Contract (`tick -> build -> train -> scout -> attack -> resolve`)

### Retention Rationale

- Next 1-5 minute goal: complete one legible action per loop step and verify immediate event-feed confirmation with resolved tokens.
- Session goal: finish one full settlement-to-hostile-resolution cycle with no ambiguous state transitions.
- Return hook: queued growth + deterministic hostile outcomes make the next optimization attempt obvious on return.

### Snapshot Row Schema (Objective Gate Matrix v1)

| field | required | contract |
| --- | --- | --- |
| `canonical_objective_key` | yes | Stable objective id string; this is the only key used for objective progress snapshots. |
| `loop_step` | yes | One of `tick`, `build`, `train`, `scout`, `attack`, `resolve`. |
| `required_all_canonical_keys` | yes | Canonical-default content keys that must all be observed for objective completion. |
| `required_any_canonical_keys` | optional | Canonical-default alternatives; objective passes this branch when at least one is observed. |
| `compatibility_alias_lookup_keys` | yes | Alias lookup map (`canonical_key -> compatibility-only keys`) used only for fallback resolution, never direct default selection. |
| `required_runtime_tokens_by_canonical_key` | yes | Canonical key -> required token names (from narrative seed `tokens`). |

### Canonical Objective Gate Matrix (Locked for First Slice)

| order | canonical_objective_key | loop_step | required_all_canonical_keys | required_any_canonical_keys | compatibility_alias_lookup_keys | required_runtime_tokens_by_canonical_key |
| --- | --- | --- | --- | --- | --- | --- |
| `1` | `first_session.tick.observe_income.v1` | `tick` | `event.tick.passive_income`, `event.tick.passive_gain_success` | `(none)` | `event.tick.passive_income -> event.economy.tick_passive_income`; `event.tick.passive_gain_success -> (none)` | `event.tick.passive_income -> settlement_name, food_gain, wood_gain, stone_gain, iron_gain`; `event.tick.passive_gain_success -> settlement_name, duration_ms` |
| `2` | `first_session.build.complete_first_upgrade.v1` | `build` | `event.build.upgrade_started`, `event.build.upgrade_completed` | `(none)` | `event.build.upgrade_started -> event.buildings.upgrade_started`; `event.build.upgrade_completed -> event.buildings.upgrade_completed` | `event.build.upgrade_started -> settlement_name, building_label, from_level, to_level`; `event.build.upgrade_completed -> settlement_name, building_label, new_level` |
| `3` | `first_session.train.complete_first_batch.v1` | `train` | `event.train.started`, `event.train.completed` | `(none)` | `event.train.started -> event.units.training_started`; `event.train.completed -> event.units.training_completed` | `event.train.started -> settlement_name, quantity, unit_label`; `event.train.completed -> settlement_name, quantity, unit_label` |
| `4` | `first_session.scout.confirm_hostile_target.v1` | `scout` | `event.scout.dispatched_success`, `event.scout.return_hostile` | `(none)` | `event.scout.dispatched_success -> (none)`; `event.scout.return_hostile -> (none)` | `event.scout.dispatched_success -> settlement_name, target_tile_label`; `event.scout.return_hostile -> target_tile_label, hostile_force_estimate` |
| `5` | `first_session.attack.dispatch_hostile_march.v1` | `attack` | `event.world.hostile_dispatch_accepted`, `event.world.hostile_dispatch_en_route`, `event.world.hostile_march_arrived_outer_works` | `(none)` | `event.world.hostile_dispatch_accepted -> (none)`; `event.world.hostile_dispatch_en_route -> event.world.march_started`; `event.world.hostile_march_arrived_outer_works -> (none)` | `event.world.hostile_dispatch_accepted -> army_name, origin_settlement_name, target_tile_label`; `event.world.hostile_dispatch_en_route -> army_name, target_tile_label, eta_seconds`; `event.world.hostile_march_arrived_outer_works -> army_name, target_tile_label` |
| `6` | `first_session.resolve_hostile_outcome.v1` | `resolve` | `event.combat.hostile_loss_report` | `event.combat.hostile_resolve_attacker_win`, `event.combat.hostile_resolve_defender_win`, `event.combat.hostile_resolve_tie_defender_holds` | `event.combat.hostile_loss_report -> (none)`; `event.combat.hostile_resolve_attacker_win -> event.combat.placeholder_skirmish_win`; `event.combat.hostile_resolve_defender_win -> event.combat.placeholder_skirmish_loss`; `event.combat.hostile_resolve_tie_defender_holds -> (none)` | `event.combat.hostile_loss_report -> attacker_units_lost, attacker_units_dispatched, defender_garrison_lost, defender_strength`; `event.combat.hostile_resolve_attacker_win -> army_name, target_tile_label`; `event.combat.hostile_resolve_defender_win -> army_name, target_tile_label`; `event.combat.hostile_resolve_tie_defender_holds -> target_tile_label` |

### Objective Gate Key Guidance (Canonical-Default Only)

- Objective progression gates must reference only canonical-default first-slice keys.
- Compatibility aliases are lookup-only inputs and must resolve upstream before objective progression state is evaluated.
- Negative-state families remain required diagnostic coverage for first-slice objective tracking.

| negative_state_family | preserved_canonical_default_keys | usage |
| --- | --- | --- |
| `insufficient_resources` | `event.build.failure_insufficient_resources`, `event.train.failure_insufficient_resources` | Preserve explicit resource shortfall feedback while objective remains incomplete. |
| `cooldown` | `event.build.failure_cooldown`, `event.train.failure_cooldown` | Preserve wait-state visibility and avoid opaque progression stalls. |
| `invalid_target` | `event.world.hostile_dispatch_target_required`, `event.world.hostile_dispatch_failed_source_target_not_foreign` | Preserve invalid hostile target feedback before dispatch completion. |
| `combat_loss` | `event.combat.hostile_resolve_defender_win`, `event.combat.hostile_resolve_tie_defender_holds`, `event.combat.hostile_loss_report` | Preserve loss legibility even when resolve step does not end in attacker win. |

### Deferred and Excluded From Required Objective Coverage

- Post-slice objective families are deferred: `first_session.hero.*`, `first_session.ambush.*`, `first_session.gather.*`.
- Heroes remain deferred: `event.hero.assigned`, `event.hero.unassigned`, `event.hero.ability_activated`, `event.hero.cooldown_complete`.
- Ambush branch remains deferred: `event.world.ambush_triggered`, `event.world.ambush_resolved`.
- Gather branch remains deferred: `event.world.gather_started`, `event.world.gather_completed`.
- These deferred objective families and keys must not be required by first-session objective completion checks for this slice.

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
