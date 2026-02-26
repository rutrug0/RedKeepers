# Hero Runtime Migrations

`20260226_000001_create_hero_runtime_tables_v1.sql` defines:

- `heroes.hero_runtime_states_v1`
- `heroes.hero_assignment_bindings_v1`
- `heroes.hero_modifier_instances_v1`

Constraint coverage in this migration:

- `hero_runtime_states_v1`
  - one row per `(player_id, hero_id)`
  - `assignment_context_id` required when `assignment_context_type != 'none'`
  - readiness/cooldown consistency checks (`ready` vs `on_cooldown`)
  - non-negative revision for optimistic concurrency
- `hero_assignment_bindings_v1`
  - one active binding per hero (`player_id + hero_id` where `is_active=true`)
  - one active hero per context (`player_id + assignment_context_type + assignment_context_id` where `is_active=true`)
  - active/inactive timestamp consistency
- `hero_modifier_instances_v1`
  - runtime modifier lifecycle timestamp/status consistency
  - non-negative `remaining_charges`
  - index for runtime reads by `(player_id, assignment_context_type, assignment_context_id, status)`
  - conditional FK hooks to `hero_definitions_v1`, `active_abilities_v1`, and `ability_modifiers_v1` when those tables already exist

Notes:

- Context ownership validation ("assignment context belongs to the same player") remains an application/repository check because context rows are module-owned outside this migration.
- `exclusive_by_stat` uniqueness for modifier instances is also enforced in repository writes, because stack rule source data lives outside runtime instance rows.
