# M2 Hero Units Prototype Concept (Deferred)

Status: Deferred. Not queueable during M0/M1 first-slice delivery.

Related backlog item: `RK-AUTO-BACKLOG-0003-F01`

## Scope Gate (Hard)

- This document is design-only and does not authorize implementation.
- Hero work stays unqueued until first vertical slice sign-off is complete in `docs/design/vertical-slice-done-v1.md`.
- Queue condition for hero prototype work:
  - Playable Loop Gate: PASS
  - Scope Gate: PASS
  - Quality Gate: PASS
  - Platform Gate: PASS
  - Release Readiness Gate: PASS

## Prototype Boundaries (M2)

- Keep heroes inside shared combat/logistics systems (no civilization-exclusive core mechanics).
- One hero profile per civilization for first prototype pass.
- One active ability per hero, expressed with shared numeric modifier templates.
- No hero gear system, no talent tree, no hero-only resource, no bespoke battle mode in prototype pass.
- Unlock heroes only after core settlement loop mastery (post-onboarding progression milestone), not in first-session flow.

## Data-Table Ready Definitions (M2 Prototype)

### Hero Unlock Gate (Post-Onboarding)

`heroes.unlock_gates_v1`

| unlock_gate_id | gate_name | min_settlement_level | min_barracks_level | min_completed_attacks | min_completed_scouts | tutorial_dependency | slice_status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hero_unlock_post_onboarding_v1` | Post-Onboarding Hero Access | 4 | 2 | 1 | 1 | `tutorial_core_v1_complete` | `data_stub_post_slice` |

Notes:
- Gate is intentionally post-onboarding and keeps first-slice tutorial flow unchanged.
- All values are minimum threshold checks with AND semantics.

### Shared Ability Modifier Templates

`heroes.ability_modifiers_v1`

| modifier_id | domain | stat_key | op | value | duration_s | charge_count | trigger_window | stack_rule | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `mod_army_attack_mult_1p12_90s` | `combat` | `army_attack_mult` | `mul` | `1.12` | 90 | 0 | `battle_start` | `exclusive_by_stat` | Applies at battle start for 90s |
| `mod_morale_loss_mult_0p85_90s` | `combat` | `morale_loss_taken_mult` | `mul` | `0.85` | 90 | 0 | `battle_start` | `exclusive_by_stat` | Reduces morale loss taken |
| `mod_scout_visibility_radius_add_1_next` | `scout` | `scout_visibility_radius` | `add` | `1` | 0 | 1 | `next_scout_action` | `exclusive_by_stat` | Consumed by next scout action |
| `mod_ambush_chance_mult_1p10_first_contact` | `scout` | `ambush_chance_mult` | `mul` | `1.10` | 0 | 1 | `first_contact` | `exclusive_by_stat` | Applied on first contact only |
| `mod_siege_durability_mult_1p18_next_march` | `siege` | `siege_durability_mult` | `mul` | `1.18` | 0 | 1 | `next_siege_march` | `exclusive_by_stat` | Consumed by next siege march |
| `mod_march_speed_penalty_mult_0p92_next_march` | `logistics` | `march_speed_penalty_mult` | `mul` | `0.92` | 0 | 1 | `next_siege_march` | `exclusive_by_stat` | Reduces penalty severity by 8% |

Template semantics:
- `duration_s = 0` means event-scoped usage (charge/trigger limited), not a timed buff.
- `charge_count = 0` means time-window modifier only; `charge_count = 1` means single-use.
- `stack_rule = exclusive_by_stat` keeps one active hero modifier per affected stat key.

### Hero Definitions and Active Ability Map

`heroes.hero_definitions_v1`

| hero_id | civilization_id | display_name | unlock_gate_id | active_ability_id | cooldown_s | slice_status |
| --- | --- | --- | --- | --- | --- | --- |
| `hero_legion_prefect` | `cinder_throne_legates` | Legion Prefect | `hero_unlock_post_onboarding_v1` | `ability_iron_mandate` | 21600 | `data_stub_post_slice` |
| `hero_fen_oracle` | `mirebound_covenant` | Fen Oracle | `hero_unlock_post_onboarding_v1` | `ability_rotwrit_veil` | 28800 | `data_stub_post_slice` |
| `hero_ashen_smith` | `graveforge_clans` | Ashen Smith | `hero_unlock_post_onboarding_v1` | `ability_anvil_oath` | 28800 | `data_stub_post_slice` |

`heroes.active_abilities_v1`

| ability_id | hero_id | ability_name | modifier_ids | target_scope | cast_timing | cooldown_s |
| --- | --- | --- | --- | --- | --- | --- |
| `ability_iron_mandate` | `hero_legion_prefect` | Iron Mandate | `mod_army_attack_mult_1p12_90s,mod_morale_loss_mult_0p85_90s` | `assigned_army` | `pre_dispatch_or_battle_start` | 21600 |
| `ability_rotwrit_veil` | `hero_fen_oracle` | Rotwrit Veil | `mod_scout_visibility_radius_add_1_next,mod_ambush_chance_mult_1p10_first_contact` | `assigned_scout_detachment` | `pre_dispatch` | 28800 |
| `ability_anvil_oath` | `hero_ashen_smith` | Anvil Oath | `mod_siege_durability_mult_1p18_next_march,mod_march_speed_penalty_mult_0p92_next_march` | `assigned_siege_column` | `pre_dispatch` | 28800 |

Scope checks:
- Exactly one active ability per hero for prototype scope.
- All effects use shared numeric modifier rows; no bespoke hero-only mechanics.

### Hero-to-March Assignment Path (Post-Slice)

`heroes.march_attachment_rules_v1`

| rule_id | stage | rule_check | result_on_pass | reject_code | notes |
| --- | --- | --- | --- | --- | --- |
| `rule_hero_feature_gate_post_slice` | `dispatch_submit` | Vertical-slice gates are all PASS and hero feature flag is enabled | Evaluate next rule | `feature_not_in_slice` | Keeps hero attachment unavailable during first-slice loop |
| `rule_hero_unlock_and_ready` | `dispatch_submit` | `unlock_state=unlocked` and `readiness_state=ready` | Allow hero attachment | `hero_unavailable` | Cooldown/lock uses shared runtime state only |
| `rule_single_hero_per_march` | `dispatch_submit` | `hero_id` is null or exactly one hero id value | Create one attachment | `hero_slot_invalid` | No multi-hero march composition in prototype |
| `rule_single_active_attachment_per_hero` | `dispatch_submit` | Hero has no other active assignment binding | Bind hero to this dispatch/march context | `hero_already_assigned` | Prevents hidden overlap power spikes |
| `rule_release_on_march_return` | `march_return_resolved` | Return resolution completed | Set `assignment_context_type=none` unless manually re-assigned | `n/a` | Attachment lifetime is tied to one march lifecycle |

`heroes.hero_march_lifecycle_v1`

| phase | hero_state | march_state | system_feedback | implementation_note |
| --- | --- | --- | --- | --- |
| `pre_dispatch_selected` | `ready`, assigned to pending dispatch context | `not_created` | Dispatch preview shows hero badge + ability readiness | Pure assignment; no modifiers active yet |
| `dispatch_committed` | `ready`, bound to `march_id` | `march_state_in_transit` | `event.hero.assigned` | `hero_id` copied into march payload for observability only |
| `ability_activated` | `on_cooldown` | `march_state_in_transit` or combat start | `event.hero.ability_activated` + cooldown timer | Modifier instances are created from `heroes.ability_modifiers_v1` |
| `march_resolved` | `on_cooldown` or `ready` | `march_state_resolved` | Combat report shows modifier deltas | Combat math still consumes shared resolved stats only |
| `return_complete` | detached (`assignment_context_type=none`) | `closed` | `event.hero.unassigned` (optional) | Hero can be attached to a new march |

Shared modifier contract for march flow:
- Hero abilities may activate at `pre_dispatch` or `battle_start`, but only by expanding `modifier_ids` into shared runtime modifier instances.
- March movement/combat/scout resolution reads the shared aggregated numeric stats; no hero-identity branch is added.
- Cooldown completion remains tick-driven and emits the same shared readiness event.

## Minimum Onboarding/Tutorial Impact

- No hero prompts in the first-slice tutorial path.
- At unlock, add only two short guidance steps:
  - Step 1: "Assign hero to army" contextual tooltip in dispatch panel.
  - Step 2: "Use one active ability" contextual tooltip with cooldown explanation.
- Success criteria for minimal impact:
  - New player can ignore heroes and still complete core session goals.
  - Hero tutorial adds <=2 minutes to first hero session.
  - No new mandatory glossary/tutorial branch in M0/M1.
  - March dispatch remains fully playable without hero interaction when the player skips hero guidance.

## Required UI Surface Changes (Post-Slice Only)

- Settlement/army UI:
  - Hero roster card (portrait placeholder, civilization badge, readiness/cooldown state).
  - Assign/unassign control in army dispatch modal.
- Dispatch/combat intent UI:
  - Single active ability slot with enabled/disabled states and short effect text.
- Feedback UI:
  - Event feed entries for `hero_assigned`, `hero_ability_activated`, `hero_ability_cooldown_complete`.
  - Combat report row showing hero impact deltas (modifier summary only).

## Retention Check

Motivation:
- Next 1-5 minutes: assign hero and trigger one ability for a visible combat/scout advantage.
- Session goal: plan one stronger action window around cooldown timing.
- Return hook: come back when cooldown completes to execute another high-impact timed action.

Satisfaction:
- Action -> feedback -> progress delta remains legible through immediate event feed/combat report updates.
- Failures should teach timing and target selection, not hidden rules.
- Progress is visible via readiness state, cooldown countdown, and outcome deltas.

Retention risk and mitigation:
- Risk: cooldown-only waiting feels like dead time.
  - Mitigation: set first-use tutorial reward and align cooldowns with existing build/train cadence windows.
- Risk: hero power feels unfair or opaque.
  - Mitigation: keep effects numeric, short, and visible before commit in dispatch UI.
- Risk: onboarding overload.
  - Mitigation: hero unlock after core loop mastery; no early mandatory hero steps.

## Deferred Follow-Up Hooks

- Add hero progression tiers only after prototype clarity and balance validation.
- Add second active ability slot only if first slot shows stable comprehension and retention uplift.
