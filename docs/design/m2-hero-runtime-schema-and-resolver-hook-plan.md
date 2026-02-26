# M2 Backend Hero Runtime Schema and Resolver Hook Plan (Deferred)

Status: Design-only. Do not implement before first-slice sign-off (`docs/design/vertical-slice-done-v1.md`).

Related backlog item: `RK-AUTO-BACKLOG-0003-F01-F03`

## Scope and Constraints

- This plan defines post-slice backend data contracts and integration hooks only.
- Hero effects must flow through shared numeric modifier resolution (no hero-only combat/scout codepaths).
- Runtime events must expose stable client-facing content keys for assignment, ability activation, and cooldown completion.

## Runtime Schema Plan

### 1) Hero Runtime State

`heroes.hero_runtime_states_v1`

| column | type | notes |
| --- | --- | --- |
| `hero_runtime_id` | string (stable id) | Primary key (`player_id::hero_id` allowed) |
| `player_id` | string | Ownership scope |
| `hero_id` | string | FK to `heroes.hero_definitions_v1.hero_id` |
| `active_ability_id` | string | FK to `heroes.active_abilities_v1.ability_id` |
| `unlock_state` | enum | `locked`, `unlocked` |
| `readiness_state` | enum | `ready`, `on_cooldown` |
| `assignment_context_type` | enum | `none`, `army`, `scout_detachment`, `siege_column` |
| `assignment_context_id` | string nullable | Links hero to active army/scout/siege context |
| `cooldown_started_at` | instant nullable | Set when active ability fires |
| `cooldown_ends_at` | instant nullable | Drives readiness transitions |
| `last_ability_activated_at` | instant nullable | Feed/report metadata |
| `revision` | int | Optimistic concurrency |
| `updated_at` | instant | Last write time |

Constraints:
- One runtime row per `player_id + hero_id`.
- `readiness_state=ready` requires `cooldown_ends_at IS NULL`.
- `readiness_state=on_cooldown` requires `cooldown_ends_at > now`.
- `assignment_context_id` required when `assignment_context_type != none`.

### 2) Hero Assignment Projection

`heroes.hero_assignment_bindings_v1`

| column | type | notes |
| --- | --- | --- |
| `assignment_id` | string (stable id) | Primary key |
| `player_id` | string | Ownership scope |
| `hero_id` | string | Assigned hero |
| `assignment_context_type` | enum | `army`, `scout_detachment`, `siege_column` |
| `assignment_context_id` | string | Target context id |
| `is_active` | bool | Exactly one active binding per hero |
| `assigned_at` | instant | Assignment timestamp |
| `unassigned_at` | instant nullable | Null while active |

Constraints:
- Unique active binding per hero (`player_id + hero_id + is_active=true`).
- Unique active hero per context (`player_id + assignment_context_type + assignment_context_id + is_active=true`).
- `assignment_context_id` must resolve to a context owned by the same player.

### 3) Hero Modifier Runtime Instances

`heroes.hero_modifier_instances_v1`

| column | type | notes |
| --- | --- | --- |
| `modifier_instance_id` | string | Primary key |
| `player_id` | string | Ownership scope |
| `hero_id` | string | Source hero |
| `ability_id` | string | Source active ability |
| `modifier_id` | string | FK to `heroes.ability_modifiers_v1.modifier_id` |
| `domain` | enum | `combat`, `scout`, `siege`, `logistics` |
| `stat_key` | string | Shared numeric stat key |
| `op` | enum | `add`, `mul` |
| `value` | decimal | Numeric value |
| `trigger_window` | string | From modifier template (`battle_start`, `next_scout_action`, etc.) |
| `remaining_charges` | int | `0` for timed-only modifiers |
| `assignment_context_type` | enum | Copied from assignment at activation |
| `assignment_context_id` | string | Copied from assignment at activation |
| `activated_at` | instant | Instance creation time |
| `expires_at` | instant nullable | Null for charge-scoped modifiers |
| `consumed_at` | instant nullable | Set when one-time modifier is consumed |
| `status` | enum | `active`, `consumed`, `expired` |

Constraints:
- Values are copied from existing shared modifier tables; no custom hero stat formula fields.
- One active modifier per `player_id + assignment_context + stat_key` when `stack_rule=exclusive_by_stat`.

## Resolver Hook Integration Plan

### Existing Action-Resolution Anchors

- `world_map.scout_select_v1` already emits a single outcome + event content key and should keep that shape when scout modifiers are applied.
- Combat/scout calculations should continue consuming resolved numeric stats, not hero-specific branches.
- Seeded hero ability modifiers (`heroes.ability_modifiers_v1`) remain the source of stat keys/ops/values.

### Shared Principle

Hero ability effects enter the same numeric modifier aggregation used by unit/civilization modifiers. Combat/scout resolvers consume already-resolved numeric stats and never branch on hero identity.

## Hook Points (post-slice)

1. Assignment mutation (`assign` / `unassign`):
- Writes `hero_runtime_states_v1` + `hero_assignment_bindings_v1` atomically.
- Emits `event.hero.assigned` (and optional `event.hero.unassigned` for parity).

2. Ability activation (`pre_dispatch`, `battle_start`):
- Validates `readiness_state=ready` and active assignment target scope.
- Expands ability modifier ids into `hero_modifier_instances_v1` rows.
- Sets cooldown fields in `hero_runtime_states_v1`.
- Emits `event.hero.ability_activated`.

3. Action resolution (`combat` / `scout`):
- Existing action resolver queries shared modifier sources, now including active hero modifier instances by `domain + assignment_context + trigger_window`.
- Resolved numeric bundle is passed into combat/scout calculators.
- Charge-based rows are consumed in the shared post-resolution consumption step.

4. Cooldown completion (`tick`):
- Tick runner checks `hero_runtime_states_v1` where `readiness_state=on_cooldown` and `cooldown_ends_at <= now`.
- Transition to `ready`, clear cooldown fields.
- Emit `event.hero.cooldown_complete`.

## Client Event Keys (stable)

`heroes.hero_runtime_event_tokens_v1`

| event_key | required_tokens | source action |
| --- | --- | --- |
| `event.hero.assigned` | `hero_id`, `assignment_context_type`, `assignment_context_id` | hero assignment mutation |
| `event.hero.ability_activated` | `hero_id`, `ability_id`, `assignment_context_type`, `assignment_context_id`, `cooldown_ends_at` | active ability activation |
| `event.hero.cooldown_complete` | `hero_id`, `ability_id` | cooldown transition to ready |

Notes:
- Keep content keys additive and stable for feed rendering.
- Narrative text remains placeholder-driven via existing event template approach.

## Minimal Post-Slice Implementation Order

1. Add hero runtime state repositories and schema migrations for the 3 runtime tables.
2. Add shared modifier aggregator input port for runtime hero modifier instances.
3. Add assignment and activation command handlers that only write runtime state + events.
4. Add cooldown tick handler and event emission.
5. Add contract tests proving combat/scout math receives hero modifiers through shared aggregation only.
