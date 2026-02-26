import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  type HeroRuntimeMigrationRunner,
  type HeroRuntimeSqlExecutionResult,
  resolveHeroRuntimeMigrationRunner,
} from "./hero-runtime-migration-runner";

const migrationRunnerResolution = resolveHeroRuntimeMigrationRunner();

const assertCommandSucceeded = (
  result: HeroRuntimeSqlExecutionResult,
  context: string,
): void => {
  assert.equal(
    result.exit_code,
    0,
    `${context} failed (exit=${String(result.exit_code)}).\nSTDERR:\n${result.stderr}\nSTDOUT:\n${result.stdout}`,
  );
};

const assertCommandFailed = (
  result: HeroRuntimeSqlExecutionResult,
  expectedErrorFragment: string,
  context: string,
): void => {
  assert.notEqual(result.exit_code, 0, `${context} unexpectedly succeeded.`);
  const output = `${result.stderr}\n${result.stdout}`;
  assert.ok(
    output.includes(expectedErrorFragment),
    `${context} failed, but output did not include expected fragment "${expectedErrorFragment}".\nOutput:\n${output}`,
  );
};

const queryBoolean = (
  migrationRunner: HeroRuntimeMigrationRunner,
  sql: string,
): boolean => {
  const queryResult = migrationRunner.runSql(sql, { tuples_only: true });
  assertCommandSucceeded(queryResult, "boolean query");
  const normalized = queryResult.stdout.trim().toLowerCase();
  if (normalized === "t") {
    return true;
  }
  if (normalized === "f") {
    return false;
  }
  throw new Error(`Expected boolean query output, received "${queryResult.stdout}".`);
};

const assertHeroRuntimeObjectsPresent = (
  migrationRunner: HeroRuntimeMigrationRunner,
): void => {
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regclass('heroes.hero_runtime_states_v1') IS NOT NULL;",
    ),
    true,
  );
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regclass('heroes.hero_assignment_bindings_v1') IS NOT NULL;",
    ),
    true,
  );
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regclass('heroes.hero_modifier_instances_v1') IS NOT NULL;",
    ),
    true,
  );
};

const assertHeroRuntimeObjectsAbsent = (
  migrationRunner: HeroRuntimeMigrationRunner,
): void => {
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regclass('heroes.hero_runtime_states_v1') IS NULL;",
    ),
    true,
  );
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regclass('heroes.hero_assignment_bindings_v1') IS NULL;",
    ),
    true,
  );
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regclass('heroes.hero_modifier_instances_v1') IS NULL;",
    ),
    true,
  );
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regtype('heroes.hero_unlock_state_v1') IS NULL;",
    ),
    true,
  );
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regtype('heroes.hero_readiness_state_v1') IS NULL;",
    ),
    true,
  );
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regtype('heroes.hero_assignment_context_type_v1') IS NULL;",
    ),
    true,
  );
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regtype('heroes.hero_assignment_bound_context_type_v1') IS NULL;",
    ),
    true,
  );
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regtype('heroes.hero_modifier_domain_v1') IS NULL;",
    ),
    true,
  );
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regtype('heroes.hero_modifier_op_v1') IS NULL;",
    ),
    true,
  );
  assert.equal(
    queryBoolean(
      migrationRunner,
      "SELECT to_regtype('heroes.hero_modifier_status_v1') IS NULL;",
    ),
    true,
  );
};

test(
  "hero runtime migration applies on selected postgres runtime and enforces runtime constraints",
  { skip: migrationRunnerResolution.skip_reason ?? false },
  () => {
    assert.notEqual(
      migrationRunnerResolution.runner,
      null,
      "Expected a resolved migration runner when test is not skipped.",
    );
    const migrationRunner = migrationRunnerResolution.runner as HeroRuntimeMigrationRunner;

    migrationRunner.prepare();

    assertCommandSucceeded(
      migrationRunner.resetHeroRuntimeObjects(),
      "initial hero runtime object reset",
    );
    assertHeroRuntimeObjectsAbsent(migrationRunner);

    assertCommandSucceeded(migrationRunner.applyMigration(), "migration apply");
    assertHeroRuntimeObjectsPresent(migrationRunner);

    assertCommandSucceeded(
      migrationRunner.runSql(`
        INSERT INTO heroes.hero_runtime_states_v1 (
          hero_runtime_id,
          player_id,
          hero_id,
          active_ability_id,
          unlock_state,
          readiness_state,
          assignment_context_type,
          assignment_context_id,
          cooldown_started_at,
          cooldown_ends_at,
          last_ability_activated_at,
          revision,
          updated_at
        ) VALUES (
          'runtime_player_a_hero_forge',
          'player_a',
          'hero_forge',
          'ability_iron_banner',
          'unlocked',
          'ready',
          'none',
          NULL,
          NULL,
          NULL,
          NULL,
          0,
          CURRENT_TIMESTAMP
        );
      `),
      "insert baseline runtime row",
    );

    assertCommandFailed(
      migrationRunner.runSql(`
        INSERT INTO heroes.hero_runtime_states_v1 (
          hero_runtime_id,
          player_id,
          hero_id,
          active_ability_id,
          unlock_state,
          readiness_state,
          assignment_context_type,
          assignment_context_id,
          cooldown_started_at,
          cooldown_ends_at,
          last_ability_activated_at,
          revision,
          updated_at
        ) VALUES (
          'runtime_duplicate_player_a_hero_forge',
          'player_a',
          'hero_forge',
          'ability_iron_banner',
          'unlocked',
          'ready',
          'none',
          NULL,
          NULL,
          NULL,
          NULL,
          0,
          CURRENT_TIMESTAMP
        );
      `),
      "hero_runtime_states_player_hero_unique_v1",
      "duplicate runtime row insert",
    );

    assertCommandFailed(
      migrationRunner.runSql(`
        INSERT INTO heroes.hero_runtime_states_v1 (
          hero_runtime_id,
          player_id,
          hero_id,
          active_ability_id,
          unlock_state,
          readiness_state,
          assignment_context_type,
          assignment_context_id,
          cooldown_started_at,
          cooldown_ends_at,
          last_ability_activated_at,
          revision,
          updated_at
        ) VALUES (
          'runtime_invalid_ready_with_cooldown',
          'player_a',
          'hero_sable',
          'ability_shadow_walk',
          'unlocked',
          'ready',
          'none',
          NULL,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP + INTERVAL '5 minutes',
          CURRENT_TIMESTAMP,
          0,
          CURRENT_TIMESTAMP
        );
      `),
      "hero_runtime_states_readiness_cooldown_consistency_v1",
      "ready-state cooldown consistency guard",
    );

    assertCommandFailed(
      migrationRunner.runSql(`
        INSERT INTO heroes.hero_runtime_states_v1 (
          hero_runtime_id,
          player_id,
          hero_id,
          active_ability_id,
          unlock_state,
          readiness_state,
          assignment_context_type,
          assignment_context_id,
          cooldown_started_at,
          cooldown_ends_at,
          last_ability_activated_at,
          revision,
          updated_at
        ) VALUES (
          'runtime_invalid_expired_cooldown',
          'player_a',
          'hero_valen',
          'ability_battlecry',
          'unlocked',
          'on_cooldown',
          'none',
          NULL,
          CURRENT_TIMESTAMP - INTERVAL '2 minutes',
          CURRENT_TIMESTAMP - INTERVAL '1 minute',
          CURRENT_TIMESTAMP,
          0,
          CURRENT_TIMESTAMP
        );
      `),
      "hero_runtime_states_cooldown_future_guard_v1",
      "cooldown future guard",
    );

    assertCommandSucceeded(
      migrationRunner.runSql(`
        INSERT INTO heroes.hero_assignment_bindings_v1 (
          assignment_id,
          player_id,
          hero_id,
          assignment_context_type,
          assignment_context_id,
          is_active,
          assigned_at,
          unassigned_at
        ) VALUES (
          'bind_hero_forge_army_1',
          'player_a',
          'hero_forge',
          'army',
          'army_1',
          TRUE,
          CURRENT_TIMESTAMP,
          NULL
        );
      `),
      "insert baseline active assignment",
    );

    assertCommandFailed(
      migrationRunner.runSql(`
        INSERT INTO heroes.hero_assignment_bindings_v1 (
          assignment_id,
          player_id,
          hero_id,
          assignment_context_type,
          assignment_context_id,
          is_active,
          assigned_at,
          unassigned_at
        ) VALUES (
          'bind_hero_forge_scout_2',
          'player_a',
          'hero_forge',
          'scout_detachment',
          'scout_2',
          TRUE,
          CURRENT_TIMESTAMP,
          NULL
        );
      `),
      "hero_assignment_bindings_active_hero_unique_v1",
      "active assignment uniqueness per hero",
    );

    assertCommandFailed(
      migrationRunner.runSql(`
        INSERT INTO heroes.hero_assignment_bindings_v1 (
          assignment_id,
          player_id,
          hero_id,
          assignment_context_type,
          assignment_context_id,
          is_active,
          assigned_at,
          unassigned_at
        ) VALUES (
          'bind_hero_ember_army_1',
          'player_a',
          'hero_ember',
          'army',
          'army_1',
          TRUE,
          CURRENT_TIMESTAMP,
          NULL
        );
      `),
      "hero_assignment_bindings_active_context_unique_v1",
      "active assignment uniqueness per context",
    );

    assertCommandFailed(
      migrationRunner.runSql(`
        INSERT INTO heroes.hero_modifier_instances_v1 (
          modifier_instance_id,
          player_id,
          hero_id,
          ability_id,
          modifier_id,
          domain,
          stat_key,
          op,
          value,
          trigger_window,
          remaining_charges,
          assignment_context_type,
          assignment_context_id,
          activated_at,
          expires_at,
          consumed_at,
          status
        ) VALUES (
          'modifier_invalid_negative_charges',
          'player_a',
          'hero_forge',
          'ability_iron_banner',
          'modifier_attack_boost',
          'combat',
          'attack_power',
          'mul',
          1.1500000000,
          'battle_start',
          -1,
          'army',
          'army_1',
          CURRENT_TIMESTAMP,
          NULL,
          NULL,
          'active'
        );
      `),
      "hero_modifier_instances_remaining_charges_non_negative_v1",
      "modifier remaining charge guard",
    );

    assertCommandFailed(
      migrationRunner.runSql(`
        INSERT INTO heroes.hero_modifier_instances_v1 (
          modifier_instance_id,
          player_id,
          hero_id,
          ability_id,
          modifier_id,
          domain,
          stat_key,
          op,
          value,
          trigger_window,
          remaining_charges,
          assignment_context_type,
          assignment_context_id,
          activated_at,
          expires_at,
          consumed_at,
          status
        ) VALUES (
          'modifier_invalid_consumed_without_timestamp',
          'player_a',
          'hero_forge',
          'ability_iron_banner',
          'modifier_morale_boost',
          'combat',
          'morale_flat',
          'add',
          5.0000000000,
          'battle_start',
          0,
          'army',
          'army_1',
          CURRENT_TIMESTAMP,
          NULL,
          NULL,
          'consumed'
        );
      `),
      "hero_modifier_instances_status_consumed_consistency_v1",
      "modifier consumed timestamp consistency guard",
    );

    assertCommandSucceeded(
      migrationRunner.resetHeroRuntimeObjects(),
      "post-assertion reset",
    );
    assertHeroRuntimeObjectsAbsent(migrationRunner);

    assertCommandSucceeded(migrationRunner.applyMigration(), "re-apply after reset");
    assertHeroRuntimeObjectsPresent(migrationRunner);

    assertCommandSucceeded(
      migrationRunner.resetHeroRuntimeObjects(),
      "final reset for repeatable execution",
    );
    assertHeroRuntimeObjectsAbsent(migrationRunner);
  },
);
