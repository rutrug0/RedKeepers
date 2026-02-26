BEGIN;

CREATE SCHEMA IF NOT EXISTS heroes;

DO $$
BEGIN
  CREATE TYPE heroes.hero_unlock_state_v1 AS ENUM ('locked', 'unlocked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE heroes.hero_readiness_state_v1 AS ENUM ('ready', 'on_cooldown');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE heroes.hero_assignment_context_type_v1 AS ENUM (
    'none',
    'army',
    'scout_detachment',
    'siege_column'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE heroes.hero_assignment_bound_context_type_v1 AS ENUM (
    'army',
    'scout_detachment',
    'siege_column'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE heroes.hero_modifier_domain_v1 AS ENUM (
    'combat',
    'scout',
    'siege',
    'logistics'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE heroes.hero_modifier_op_v1 AS ENUM ('add', 'mul');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE heroes.hero_modifier_status_v1 AS ENUM ('active', 'consumed', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS heroes.hero_runtime_states_v1 (
  hero_runtime_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  hero_id TEXT NOT NULL,
  active_ability_id TEXT NOT NULL,
  unlock_state heroes.hero_unlock_state_v1 NOT NULL,
  readiness_state heroes.hero_readiness_state_v1 NOT NULL,
  assignment_context_type heroes.hero_assignment_context_type_v1 NOT NULL,
  assignment_context_id TEXT NULL,
  cooldown_started_at TIMESTAMPTZ NULL,
  cooldown_ends_at TIMESTAMPTZ NULL,
  last_ability_activated_at TIMESTAMPTZ NULL,
  revision INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT hero_runtime_states_player_hero_unique_v1
    UNIQUE (player_id, hero_id),
  CONSTRAINT hero_runtime_states_assignment_context_consistency_v1
    CHECK (
      (assignment_context_type = 'none' AND assignment_context_id IS NULL)
      OR
      (assignment_context_type <> 'none' AND assignment_context_id IS NOT NULL)
    ),
  CONSTRAINT hero_runtime_states_readiness_cooldown_consistency_v1
    CHECK (
      (readiness_state = 'ready' AND cooldown_started_at IS NULL AND cooldown_ends_at IS NULL)
      OR
      (
        readiness_state = 'on_cooldown'
        AND cooldown_started_at IS NOT NULL
        AND cooldown_ends_at IS NOT NULL
        AND cooldown_ends_at > cooldown_started_at
      )
    ),
  CONSTRAINT hero_runtime_states_cooldown_future_guard_v1
    CHECK (
      readiness_state <> 'on_cooldown'
      OR cooldown_ends_at > CURRENT_TIMESTAMP
    ),
  CONSTRAINT hero_runtime_states_revision_non_negative_v1
    CHECK (revision >= 0)
);

CREATE INDEX IF NOT EXISTS hero_runtime_states_player_readiness_idx_v1
  ON heroes.hero_runtime_states_v1 (player_id, readiness_state, cooldown_ends_at);

DO $$
BEGIN
  IF to_regclass('heroes.hero_definitions_v1') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'hero_runtime_states_hero_fk_v1'
    )
  THEN
    ALTER TABLE heroes.hero_runtime_states_v1
      ADD CONSTRAINT hero_runtime_states_hero_fk_v1
      FOREIGN KEY (hero_id)
      REFERENCES heroes.hero_definitions_v1(hero_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('heroes.active_abilities_v1') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'hero_runtime_states_active_ability_fk_v1'
    )
  THEN
    ALTER TABLE heroes.hero_runtime_states_v1
      ADD CONSTRAINT hero_runtime_states_active_ability_fk_v1
      FOREIGN KEY (active_ability_id)
      REFERENCES heroes.active_abilities_v1(ability_id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS heroes.hero_assignment_bindings_v1 (
  assignment_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  hero_id TEXT NOT NULL,
  assignment_context_type heroes.hero_assignment_bound_context_type_v1 NOT NULL,
  assignment_context_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL,
  unassigned_at TIMESTAMPTZ NULL,
  CONSTRAINT hero_assignment_bindings_active_consistency_v1
    CHECK (
      (is_active AND unassigned_at IS NULL)
      OR
      ((NOT is_active) AND unassigned_at IS NOT NULL)
    ),
  CONSTRAINT hero_assignment_bindings_timestamp_consistency_v1
    CHECK (
      unassigned_at IS NULL
      OR unassigned_at >= assigned_at
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS hero_assignment_bindings_active_hero_unique_v1
  ON heroes.hero_assignment_bindings_v1 (player_id, hero_id)
  WHERE is_active;

CREATE UNIQUE INDEX IF NOT EXISTS hero_assignment_bindings_active_context_unique_v1
  ON heroes.hero_assignment_bindings_v1 (
    player_id,
    assignment_context_type,
    assignment_context_id
  )
  WHERE is_active;

CREATE INDEX IF NOT EXISTS hero_assignment_bindings_player_hero_idx_v1
  ON heroes.hero_assignment_bindings_v1 (player_id, hero_id, assigned_at DESC);

DO $$
BEGIN
  IF to_regclass('heroes.hero_definitions_v1') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'hero_assignment_bindings_hero_fk_v1'
    )
  THEN
    ALTER TABLE heroes.hero_assignment_bindings_v1
      ADD CONSTRAINT hero_assignment_bindings_hero_fk_v1
      FOREIGN KEY (hero_id)
      REFERENCES heroes.hero_definitions_v1(hero_id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS heroes.hero_modifier_instances_v1 (
  modifier_instance_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  hero_id TEXT NOT NULL,
  ability_id TEXT NOT NULL,
  modifier_id TEXT NOT NULL,
  domain heroes.hero_modifier_domain_v1 NOT NULL,
  stat_key TEXT NOT NULL,
  op heroes.hero_modifier_op_v1 NOT NULL,
  value NUMERIC(28, 10) NOT NULL,
  trigger_window TEXT NOT NULL,
  remaining_charges INTEGER NOT NULL,
  assignment_context_type heroes.hero_assignment_bound_context_type_v1 NOT NULL,
  assignment_context_id TEXT NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  consumed_at TIMESTAMPTZ NULL,
  status heroes.hero_modifier_status_v1 NOT NULL,
  CONSTRAINT hero_modifier_instances_remaining_charges_non_negative_v1
    CHECK (remaining_charges >= 0),
  CONSTRAINT hero_modifier_instances_expires_window_v1
    CHECK (expires_at IS NULL OR expires_at >= activated_at),
  CONSTRAINT hero_modifier_instances_consumed_window_v1
    CHECK (consumed_at IS NULL OR consumed_at >= activated_at),
  CONSTRAINT hero_modifier_instances_status_consumed_consistency_v1
    CHECK (
      (status = 'active' AND consumed_at IS NULL)
      OR
      (status = 'consumed' AND consumed_at IS NOT NULL)
      OR
      (status = 'expired')
    )
);

CREATE INDEX IF NOT EXISTS hero_modifier_instances_context_status_idx_v1
  ON heroes.hero_modifier_instances_v1 (
    player_id,
    assignment_context_type,
    assignment_context_id,
    status
  );

CREATE INDEX IF NOT EXISTS hero_modifier_instances_hero_activation_idx_v1
  ON heroes.hero_modifier_instances_v1 (player_id, hero_id, activated_at DESC);

DO $$
BEGIN
  IF to_regclass('heroes.hero_definitions_v1') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'hero_modifier_instances_hero_fk_v1'
    )
  THEN
    ALTER TABLE heroes.hero_modifier_instances_v1
      ADD CONSTRAINT hero_modifier_instances_hero_fk_v1
      FOREIGN KEY (hero_id)
      REFERENCES heroes.hero_definitions_v1(hero_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('heroes.active_abilities_v1') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'hero_modifier_instances_ability_fk_v1'
    )
  THEN
    ALTER TABLE heroes.hero_modifier_instances_v1
      ADD CONSTRAINT hero_modifier_instances_ability_fk_v1
      FOREIGN KEY (ability_id)
      REFERENCES heroes.active_abilities_v1(ability_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('heroes.ability_modifiers_v1') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'hero_modifier_instances_modifier_fk_v1'
    )
  THEN
    ALTER TABLE heroes.hero_modifier_instances_v1
      ADD CONSTRAINT hero_modifier_instances_modifier_fk_v1
      FOREIGN KEY (modifier_id)
      REFERENCES heroes.ability_modifiers_v1(modifier_id);
  END IF;
END
$$;

COMMIT;
