import { strict as assert } from "node:assert";
import { test } from "node:test";

import { InMemoryHeroRuntimePersistenceRepository } from "./in-memory-hero-runtime-persistence-repository";

test("applyAssignmentMutation updates runtime and bindings atomically", () => {
  const repository = new InMemoryHeroRuntimePersistenceRepository();
  const seededAt = new Date("2026-02-26T12:00:00.000Z");

  repository.ensureRuntimeState({
    hero_runtime_id: "player_a::hero_forge",
    player_id: "player_a",
    hero_id: "hero_forge",
    active_ability_id: "ability_iron_banner",
    unlock_state: "unlocked",
    readiness_state: "ready",
    updated_at: seededAt,
  });

  const assignedAt = new Date("2026-02-26T12:01:00.000Z");
  const assignResult = repository.applyAssignmentMutation({
    player_id: "player_a",
    hero_id: "hero_forge",
    expected_revision: 0,
    now: assignedAt,
    assignment: {
      assignment_id: "bind_hero_forge_army_1",
      assignment_context_type: "army",
      assignment_context_id: "army_1",
    },
  });
  assert.equal(assignResult.status, "applied");
  if (assignResult.status !== "applied") {
    return;
  }

  assert.equal(assignResult.result.runtime_state.revision, 1);
  assert.equal(assignResult.result.runtime_state.assignment_context_type, "army");
  assert.equal(assignResult.result.runtime_state.assignment_context_id, "army_1");
  assert.equal(assignResult.result.active_binding?.assignment_id, "bind_hero_forge_army_1");
  assert.deepStrictEqual(assignResult.result.deactivated_assignment_ids, []);

  const activeBinding = repository.readActiveAssignmentBinding({
    player_id: "player_a",
    hero_id: "hero_forge",
  });
  assert.notEqual(activeBinding, null);
  assert.equal(activeBinding?.is_active, true);

  const unassignedAt = new Date("2026-02-26T12:02:00.000Z");
  const unassignResult = repository.applyAssignmentMutation({
    player_id: "player_a",
    hero_id: "hero_forge",
    expected_revision: 1,
    now: unassignedAt,
    assignment: null,
  });
  assert.equal(unassignResult.status, "applied");
  if (unassignResult.status !== "applied") {
    return;
  }

  assert.equal(unassignResult.result.runtime_state.revision, 2);
  assert.equal(unassignResult.result.runtime_state.assignment_context_type, "none");
  assert.equal(unassignResult.result.runtime_state.assignment_context_id, undefined);
  assert.deepStrictEqual(unassignResult.result.deactivated_assignment_ids, [
    "bind_hero_forge_army_1",
  ]);
  assert.equal(unassignResult.result.active_binding, null);

  assert.equal(
    repository.readActiveAssignmentBinding({
      player_id: "player_a",
      hero_id: "hero_forge",
    }),
    null,
  );
});

test("applyAssignmentMutation enforces optimistic concurrency", () => {
  const repository = new InMemoryHeroRuntimePersistenceRepository();
  repository.ensureRuntimeState({
    hero_runtime_id: "player_b::hero_sable",
    player_id: "player_b",
    hero_id: "hero_sable",
    active_ability_id: "ability_shadow_walk",
    unlock_state: "unlocked",
    readiness_state: "ready",
    revision: 3,
    updated_at: new Date("2026-02-26T12:05:00.000Z"),
  });

  const mutationResult = repository.applyAssignmentMutation({
    player_id: "player_b",
    hero_id: "hero_sable",
    expected_revision: 2,
    now: new Date("2026-02-26T12:06:00.000Z"),
    assignment: {
      assignment_id: "bind_hero_sable_scout_1",
      assignment_context_type: "scout_detachment",
      assignment_context_id: "scout_1",
    },
  });

  assert.equal(mutationResult.status, "conflict");
  if (mutationResult.status !== "conflict") {
    return;
  }
  assert.equal(mutationResult.conflict_code, "revision_conflict");
  assert.equal(
    repository.readRuntimeState({
      player_id: "player_b",
      hero_id: "hero_sable",
    })?.revision,
    3,
  );
  assert.equal(
    repository.readActiveAssignmentBinding({
      player_id: "player_b",
      hero_id: "hero_sable",
    }),
    null,
  );
});

test("applyAbilityActivation writes cooldown and modifier rows with revision checks", () => {
  const repository = new InMemoryHeroRuntimePersistenceRepository();
  repository.ensureRuntimeState({
    hero_runtime_id: "player_c::hero_valen",
    player_id: "player_c",
    hero_id: "hero_valen",
    active_ability_id: "ability_battlecry",
    unlock_state: "unlocked",
    readiness_state: "ready",
    updated_at: new Date("2026-02-26T12:10:00.000Z"),
  });

  const assignResult = repository.applyAssignmentMutation({
    player_id: "player_c",
    hero_id: "hero_valen",
    expected_revision: 0,
    now: new Date("2026-02-26T12:11:00.000Z"),
    assignment: {
      assignment_id: "bind_hero_valen_army_5",
      assignment_context_type: "army",
      assignment_context_id: "army_5",
    },
  });
  assert.equal(assignResult.status, "applied");
  if (assignResult.status !== "applied") {
    return;
  }

  const activationResult = repository.applyAbilityActivation({
    player_id: "player_c",
    hero_id: "hero_valen",
    ability_id: "ability_battlecry",
    expected_revision: assignResult.result.runtime_state.revision,
    activated_at: new Date("2026-02-26T12:12:00.000Z"),
    cooldown_ends_at: new Date("2026-02-26T12:14:00.000Z"),
    assignment_context_type: "army",
    assignment_context_id: "army_5",
    modifiers: [
      {
        modifier_instance_id: "mod_inst_1",
        modifier_id: "mod_atk_mul_10",
        domain: "combat",
        stat_key: "attack_power",
        op: "mul",
        value: "1.10",
        trigger_window: "battle_start",
        remaining_charges: 0,
        exclusive_by_stat: true,
      },
      {
        modifier_instance_id: "mod_inst_2",
        modifier_id: "mod_morale_add_5",
        domain: "combat",
        stat_key: "morale_flat",
        op: "add",
        value: "5.0",
        trigger_window: "battle_start",
        remaining_charges: 0,
      },
    ],
  });

  assert.equal(activationResult.status, "applied");
  if (activationResult.status !== "applied") {
    return;
  }

  assert.equal(activationResult.result.runtime_state.readiness_state, "on_cooldown");
  assert.equal(activationResult.result.runtime_state.revision, 2);
  assert.equal(
    activationResult.result.runtime_state.cooldown_started_at?.toISOString(),
    "2026-02-26T12:12:00.000Z",
  );
  assert.equal(
    activationResult.result.runtime_state.cooldown_ends_at?.toISOString(),
    "2026-02-26T12:14:00.000Z",
  );
  assert.deepStrictEqual(
    activationResult.result.created_modifier_instance_ids,
    ["mod_inst_1", "mod_inst_2"],
  );

  const activeModifiers = repository.listModifierInstances({
    player_id: "player_c",
    hero_id: "hero_valen",
    assignment_context_type: "army",
    assignment_context_id: "army_5",
    status: "active",
  });
  assert.equal(activeModifiers.length, 2);
});

test("applyAbilityActivation rejects exclusive stat collisions", () => {
  const repository = new InMemoryHeroRuntimePersistenceRepository({
    initial_snapshot: {
      runtime_states: [
        {
          hero_runtime_id: "player_d::hero_ember",
          player_id: "player_d",
          hero_id: "hero_ember",
          active_ability_id: "ability_firebrand",
          unlock_state: "unlocked",
          readiness_state: "ready",
          assignment_context_type: "army",
          assignment_context_id: "army_3",
          revision: 4,
          updated_at: new Date("2026-02-26T12:20:00.000Z"),
        },
      ],
      assignment_bindings: [
        {
          assignment_id: "bind_hero_ember_army_3",
          player_id: "player_d",
          hero_id: "hero_ember",
          assignment_context_type: "army",
          assignment_context_id: "army_3",
          is_active: true,
          assigned_at: new Date("2026-02-26T12:19:00.000Z"),
        },
      ],
      modifier_instances: [
        {
          modifier_instance_id: "mod_existing",
          player_id: "player_d",
          hero_id: "hero_ember",
          ability_id: "ability_firebrand",
          modifier_id: "mod_attack_existing",
          domain: "combat",
          stat_key: "attack_power",
          op: "mul",
          value: "1.05",
          trigger_window: "battle_start",
          remaining_charges: 0,
          assignment_context_type: "army",
          assignment_context_id: "army_3",
          activated_at: new Date("2026-02-26T12:19:30.000Z"),
          status: "active",
        },
      ],
    },
  });

  const result = repository.applyAbilityActivation({
    player_id: "player_d",
    hero_id: "hero_ember",
    ability_id: "ability_firebrand",
    expected_revision: 4,
    activated_at: new Date("2026-02-26T12:21:00.000Z"),
    cooldown_ends_at: new Date("2026-02-26T12:23:00.000Z"),
    assignment_context_type: "army",
    assignment_context_id: "army_3",
    modifiers: [
      {
        modifier_instance_id: "mod_conflict",
        modifier_id: "mod_attack_new",
        domain: "combat",
        stat_key: "attack_power",
        op: "mul",
        value: "1.20",
        trigger_window: "battle_start",
        remaining_charges: 0,
        exclusive_by_stat: true,
      },
    ],
  });

  assert.equal(result.status, "conflict");
  if (result.status !== "conflict") {
    return;
  }
  assert.equal(result.conflict_code, "modifier_exclusive_stat_conflict");

  assert.equal(
    repository.readRuntimeState({
      player_id: "player_d",
      hero_id: "hero_ember",
    })?.revision,
    4,
  );
  assert.equal(
    repository.listModifierInstances({
      player_id: "player_d",
      hero_id: "hero_ember",
      assignment_context_type: "army",
      assignment_context_id: "army_3",
      status: "active",
    }).length,
    1,
  );
});

test("applyModifierLifecycle updates charge- and expiry-based runtime modifier states", () => {
  const repository = new InMemoryHeroRuntimePersistenceRepository({
    initial_snapshot: {
      runtime_states: [],
      assignment_bindings: [],
      modifier_instances: [
        {
          modifier_instance_id: "mod_charge_once",
          player_id: "player_e",
          hero_id: "hero_rime",
          ability_id: "ability_cold_mark",
          modifier_id: "mod_charge_once",
          domain: "scout",
          stat_key: "scout_report_detail_mult",
          op: "mul",
          value: "1.2",
          trigger_window: "next_scout_action",
          remaining_charges: 1,
          assignment_context_type: "scout_detachment",
          assignment_context_id: "scout_7",
          activated_at: new Date("2026-02-26T13:00:00.000Z"),
          status: "active",
        },
        {
          modifier_instance_id: "mod_timed",
          player_id: "player_e",
          hero_id: "hero_rime",
          ability_id: "ability_cold_mark",
          modifier_id: "mod_timed",
          domain: "scout",
          stat_key: "scout_report_detail_mult",
          op: "mul",
          value: "1.05",
          trigger_window: "next_scout_action",
          remaining_charges: 0,
          assignment_context_type: "scout_detachment",
          assignment_context_id: "scout_7",
          activated_at: new Date("2026-02-26T13:00:00.000Z"),
          expires_at: new Date("2026-02-26T13:01:00.000Z"),
          status: "active",
        },
      ],
    },
  });

  const lifecycleResult = repository.applyModifierLifecycle({
    player_id: "player_e",
    now: new Date("2026-02-26T13:02:00.000Z"),
    mutations: [
      {
        modifier_instance_id: "mod_charge_once",
        remaining_charges: 0,
        status: "consumed",
      },
      {
        modifier_instance_id: "mod_timed",
        remaining_charges: 0,
        status: "expired",
      },
    ],
  });

  assert.equal(lifecycleResult.status, "applied");
  if (lifecycleResult.status !== "applied") {
    return;
  }
  assert.deepStrictEqual(lifecycleResult.result.updated_modifier_instance_ids, [
    "mod_charge_once",
    "mod_timed",
  ]);

  const consumedRows = repository.listModifierInstances({
    player_id: "player_e",
    status: "consumed",
  });
  const expiredRows = repository.listModifierInstances({
    player_id: "player_e",
    status: "expired",
  });

  assert.equal(consumedRows.length, 1);
  assert.equal(consumedRows[0].modifier_instance_id, "mod_charge_once");
  assert.equal(consumedRows[0].remaining_charges, 0);
  assert.equal(
    consumedRows[0].consumed_at?.toISOString(),
    "2026-02-26T13:02:00.000Z",
  );

  assert.equal(expiredRows.length, 1);
  assert.equal(expiredRows[0].modifier_instance_id, "mod_timed");
  assert.equal(expiredRows[0].remaining_charges, 0);
  assert.equal(expiredRows[0].consumed_at, undefined);
});
