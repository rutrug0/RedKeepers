import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  HeroRuntimeActionModifierSource,
  SharedActionModifierAggregationService,
} from "../../heroes/application/shared-action-modifier-aggregation.ts";
import { InMemoryHeroRuntimePersistenceRepository } from "../../heroes/infra/in-memory-hero-runtime-persistence-repository.ts";
import { InMemoryWorldMapTileStateRepository } from "../infra/in-memory-world-map-tile-state-repository.ts";
import { DeterministicWorldMapScoutSelectService } from "./world-map-scout-select-service.ts";

test("scout resolver uses shared numeric modifier aggregation and lifecycle path for hero runtime instances", () => {
  const heroRuntimeRepository = new InMemoryHeroRuntimePersistenceRepository({
    initial_snapshot: {
      runtime_states: [],
      assignment_bindings: [],
      modifier_instances: [
        {
          modifier_instance_id: "mod_scout_detail",
          player_id: "player_world",
          hero_id: "hero_scout",
          ability_id: "ability_scout",
          modifier_id: "mod_scout_detail",
          domain: "scout",
          stat_key: "scout_report_detail_mult",
          op: "mul",
          value: "1.2",
          trigger_window: "next_scout_action",
          remaining_charges: 1,
          assignment_context_type: "scout_detachment",
          assignment_context_id: "scout_8",
          activated_at: new Date("2026-02-26T12:00:00.000Z"),
          status: "active",
        },
      ],
    },
  });
  const modifierAggregation = new SharedActionModifierAggregationService([
    new HeroRuntimeActionModifierSource(heroRuntimeRepository),
  ], heroRuntimeRepository);

  const worldMapRepository = new InMemoryWorldMapTileStateRepository([
    {
      settlement_id: "settlement_world",
      tile_id: "tile_hostile",
      tile_state: "tile_state_hostile_hint",
      tile_revision: 4,
      target_tile_label: "Burnt Causeway",
      hostile_force_estimate: "light raider column",
    },
  ]);
  const scoutService = new DeterministicWorldMapScoutSelectService(worldMapRepository, {
    action_modifier_aggregation: modifierAggregation,
  });

  const response = scoutService.handleScoutSelect({
    settlement_id: "settlement_world",
    tile_id: "tile_hostile",
    player_id: "player_world",
    assignment_context_type: "scout_detachment",
    assignment_context_id: "scout_8",
    action_trigger_window: "next_scout_action",
    resolved_at: new Date("2026-02-26T12:03:00.000Z"),
  });

  assert.equal(response.interaction_outcome, "outcome_scout_report_hostile");
  if (response.interaction_outcome !== "outcome_scout_report_hostile") {
    return;
  }
  assert.equal(
    response.event.tokens.hostile_force_estimate,
    "light raider column (verified)",
  );

  const consumedRows = heroRuntimeRepository.listModifierInstances({
    player_id: "player_world",
    status: "consumed",
  });
  assert.equal(consumedRows.length, 1);
  assert.equal(consumedRows[0].modifier_instance_id, "mod_scout_detail");
});
