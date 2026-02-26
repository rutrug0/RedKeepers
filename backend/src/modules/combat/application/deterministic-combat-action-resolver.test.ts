import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  HeroRuntimeActionModifierSource,
  SharedActionModifierAggregationService,
} from "../../heroes/application";
import { InMemoryHeroRuntimePersistenceRepository } from "../../heroes/infra";
import { DeterministicCombatActionResolver } from "./deterministic-combat-action-resolver";

test("combat resolver consumes shared resolved stats and runs shared modifier lifecycle updates", () => {
  const repository = new InMemoryHeroRuntimePersistenceRepository({
    initial_snapshot: {
      runtime_states: [],
      assignment_bindings: [],
      modifier_instances: [
        {
          modifier_instance_id: "mod_attack_charge",
          player_id: "player_combat",
          hero_id: "hero_front",
          ability_id: "ability_front",
          modifier_id: "mod_attack_charge",
          domain: "combat",
          stat_key: "attack_power",
          op: "mul",
          value: "1.20",
          trigger_window: "battle_start",
          remaining_charges: 1,
          assignment_context_type: "army",
          assignment_context_id: "army_11",
          activated_at: new Date("2026-02-26T12:00:00.000Z"),
          status: "active",
        },
        {
          modifier_instance_id: "mod_defense_add",
          player_id: "player_combat",
          hero_id: "hero_rear",
          ability_id: "ability_rear",
          modifier_id: "mod_defense_add",
          domain: "combat",
          stat_key: "defense_power",
          op: "add",
          value: "15",
          trigger_window: "battle_start",
          remaining_charges: 0,
          assignment_context_type: "army",
          assignment_context_id: "army_11",
          activated_at: new Date("2026-02-26T12:00:00.000Z"),
          status: "active",
        },
      ],
    },
  });

  const aggregation = new SharedActionModifierAggregationService([
    new HeroRuntimeActionModifierSource(repository),
  ], repository);
  const resolver = new DeterministicCombatActionResolver(aggregation);

  const result = resolver.resolveCombatAction({
    player_id: "player_combat",
    assignment_context_type: "army",
    assignment_context_id: "army_11",
    resolved_at: new Date("2026-02-26T12:02:00.000Z"),
    base_stats: {
      attack_power: 100,
      defense_power: 80,
    },
  });

  assert.equal(result.resolved_attack_power, 120);
  assert.equal(result.resolved_defense_power, 95);
  assert.equal(result.modifier_lifecycle_status, "applied");
  assert.deepStrictEqual(result.lifecycle_updated_modifier_instance_ids, [
    "mod_attack_charge",
  ]);

  const consumedRows = repository.listModifierInstances({
    player_id: "player_combat",
    status: "consumed",
  });
  assert.equal(consumedRows.length, 1);
  assert.equal(consumedRows[0].modifier_instance_id, "mod_attack_charge");
});
