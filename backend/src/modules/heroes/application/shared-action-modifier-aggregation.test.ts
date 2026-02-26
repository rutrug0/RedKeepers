import { strict as assert } from "node:assert";
import { test } from "node:test";

import { InMemoryHeroRuntimePersistenceRepository } from "../infra";
import type { SharedActionModifierSource } from "./shared-action-modifier-aggregation";
import {
  HeroRuntimeActionModifierSource,
  SharedActionModifierAggregationService,
} from "./shared-action-modifier-aggregation";

test("resolveNumericStats aggregates hero runtime modifiers through shared source interface", () => {
  const repository = new InMemoryHeroRuntimePersistenceRepository({
    initial_snapshot: {
      runtime_states: [],
      assignment_bindings: [],
      modifier_instances: [
        {
          modifier_instance_id: "mod_hero_a_attack",
          player_id: "player_a",
          hero_id: "hero_a",
          ability_id: "ability_a",
          modifier_id: "mod_hero_a_attack",
          domain: "combat",
          stat_key: "attack_power",
          op: "mul",
          value: "1.10",
          trigger_window: "battle_start",
          remaining_charges: 0,
          assignment_context_type: "army",
          assignment_context_id: "army_1",
          activated_at: new Date("2026-02-26T12:00:00.000Z"),
          status: "active",
        },
        {
          modifier_instance_id: "mod_hero_b_attack",
          player_id: "player_a",
          hero_id: "hero_b",
          ability_id: "ability_b",
          modifier_id: "mod_hero_b_attack",
          domain: "combat",
          stat_key: "attack_power",
          op: "add",
          value: "8",
          trigger_window: "battle_start",
          remaining_charges: 0,
          assignment_context_type: "army",
          assignment_context_id: "army_1",
          activated_at: new Date("2026-02-26T12:00:00.000Z"),
          status: "active",
        },
      ],
    },
  });

  const staticSource: SharedActionModifierSource = {
    listNumericModifiers: () => [
      {
        source_id: "civ_static_attack",
        stat_key: "attack_power",
        op: "add",
        value: 5,
      },
      {
        source_id: "civ_static_defense",
        stat_key: "defense_power",
        op: "mul",
        value: 1.05,
      },
    ],
  };
  const service = new SharedActionModifierAggregationService([
    staticSource,
    new HeroRuntimeActionModifierSource(repository),
  ], repository);

  const resolution = service.resolveNumericStats({
    player_id: "player_a",
    domain: "combat",
    trigger_window: "battle_start",
    assignment_context_type: "army",
    assignment_context_id: "army_1",
    now: new Date("2026-02-26T12:05:00.000Z"),
    base_stats: {
      attack_power: 100,
      defense_power: 80,
    },
  });

  assert.ok(Math.abs((resolution.resolved_stats.attack_power ?? 0) - 124.3) < 1e-9);
  assert.equal(resolution.resolved_stats.defense_power, 84);
  assert.equal(resolution.applied_modifiers.length, 4);
});

test("shared post-resolution lifecycle applies charge and expiry mutations for hero runtime modifiers", () => {
  const repository = new InMemoryHeroRuntimePersistenceRepository({
    initial_snapshot: {
      runtime_states: [],
      assignment_bindings: [],
      modifier_instances: [
        {
          modifier_instance_id: "mod_scout_charge",
          player_id: "player_scout",
          hero_id: "hero_scout",
          ability_id: "ability_scout",
          modifier_id: "mod_scout_charge",
          domain: "scout",
          stat_key: "scout_report_detail_mult",
          op: "mul",
          value: "1.2",
          trigger_window: "next_scout_action",
          remaining_charges: 1,
          assignment_context_type: "scout_detachment",
          assignment_context_id: "scout_4",
          activated_at: new Date("2026-02-26T12:00:00.000Z"),
          status: "active",
        },
        {
          modifier_instance_id: "mod_scout_expire",
          player_id: "player_scout",
          hero_id: "hero_scout",
          ability_id: "ability_scout",
          modifier_id: "mod_scout_expire",
          domain: "scout",
          stat_key: "scout_report_detail_mult",
          op: "mul",
          value: "1.05",
          trigger_window: "next_scout_action",
          remaining_charges: 0,
          assignment_context_type: "scout_detachment",
          assignment_context_id: "scout_4",
          activated_at: new Date("2026-02-26T12:00:00.000Z"),
          expires_at: new Date("2026-02-26T12:01:00.000Z"),
          status: "active",
        },
      ],
    },
  });

  const service = new SharedActionModifierAggregationService([
    new HeroRuntimeActionModifierSource(repository),
  ], repository);
  const resolvedAt = new Date("2026-02-26T12:02:00.000Z");

  const resolution = service.resolveNumericStats({
    player_id: "player_scout",
    domain: "scout",
    trigger_window: "next_scout_action",
    assignment_context_type: "scout_detachment",
    assignment_context_id: "scout_4",
    now: resolvedAt,
    base_stats: {},
  });
  const lifecycleResult = service.applyPostResolutionLifecycle({
    player_id: "player_scout",
    now: resolvedAt,
    lifecycle_candidates: resolution.lifecycle_candidates,
  });

  assert.equal(lifecycleResult.status, "applied");
  if (lifecycleResult.status !== "applied") {
    return;
  }
  assert.deepStrictEqual(lifecycleResult.result.updated_modifier_instance_ids, [
    "mod_scout_charge",
    "mod_scout_expire",
  ]);

  const consumedRows = repository.listModifierInstances({
    player_id: "player_scout",
    status: "consumed",
  });
  const expiredRows = repository.listModifierInstances({
    player_id: "player_scout",
    status: "expired",
  });
  assert.equal(consumedRows.length, 1);
  assert.equal(consumedRows[0].modifier_instance_id, "mod_scout_charge");
  assert.equal(expiredRows.length, 1);
  assert.equal(expiredRows[0].modifier_instance_id, "mod_scout_expire");
});
