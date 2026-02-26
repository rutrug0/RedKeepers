import { strict as assert } from "node:assert";
import { test } from "node:test";

import { InMemoryWorldMapGatherMarchStateRepository, InMemoryWorldMapNeutralNodeStateRepository } from "../infra";
import { DeterministicWorldMapNeutralGatheringService, WorldMapNeutralNodeDepletedError } from "./world-map-neutral-gathering-service";

test("neutral node spawn table stays deterministic and idempotent for a fixed seed", () => {
  const nodeRepository = new InMemoryWorldMapNeutralNodeStateRepository();
  const marchRepository = new InMemoryWorldMapGatherMarchStateRepository();
  const service = new DeterministicWorldMapNeutralGatheringService(
    nodeRepository,
    marchRepository,
  );

  const first = service.spawnNeutralNodes({
    world_id: "world_spawn",
    world_seed: "seed_spawn_alpha",
    map_size: 8,
    spawn_table: [
      {
        node_type: "neutral_node_lumber",
        node_label: "Abandoned Lumber Camp",
        spawn_count: 2,
        yield_ranges: [{ resource_id: "wood", min_amount: 90, max_amount: 120 }],
        gather_duration_seconds: 60,
        ambush_risk_pct: 30,
        ambush_base_strength: 25,
        depletion_cycles: 3,
      },
      {
        node_type: "neutral_node_quarry",
        node_label: "Collapsed Quarry",
        spawn_count: 1,
        yield_ranges: [{ resource_id: "stone", min_amount: 70, max_amount: 70 }],
        gather_duration_seconds: 45,
        ambush_risk_pct: 15,
        ambush_base_strength: 20,
        depletion_cycles: 2,
      },
    ],
  });
  const second = service.spawnNeutralNodes({
    world_id: "world_spawn",
    world_seed: "seed_spawn_alpha",
    map_size: 8,
    spawn_table: [
      {
        node_type: "neutral_node_lumber",
        node_label: "Abandoned Lumber Camp",
        spawn_count: 2,
        yield_ranges: [{ resource_id: "wood", min_amount: 90, max_amount: 120 }],
        gather_duration_seconds: 60,
        ambush_risk_pct: 30,
        ambush_base_strength: 25,
        depletion_cycles: 3,
      },
      {
        node_type: "neutral_node_quarry",
        node_label: "Collapsed Quarry",
        spawn_count: 1,
        yield_ranges: [{ resource_id: "stone", min_amount: 70, max_amount: 70 }],
        gather_duration_seconds: 45,
        ambush_risk_pct: 15,
        ambush_base_strength: 20,
        depletion_cycles: 2,
      },
    ],
  });

  assert.equal(first.length, 3);
  assert.deepEqual(second, first);
  assert.deepEqual(
    first.map((node) => node.node_id),
    ["neutral_node_lumber_1", "neutral_node_lumber_2", "neutral_node_quarry_1"],
  );
  assert.deepEqual(first[0].yield_ranges[0].resource_id, "wood");
});

test("gather loop resolves deterministic ambush outcomes and emits required event keys", () => {
  const nodeRepository = new InMemoryWorldMapNeutralNodeStateRepository();
  const marchRepository = new InMemoryWorldMapGatherMarchStateRepository();
  const service = new DeterministicWorldMapNeutralGatheringService(
    nodeRepository,
    marchRepository,
  );

  service.spawnNeutralNodes({
    world_id: "world_gather",
    world_seed: "seed_gather_alpha",
    map_size: 16,
    spawn_table: [
      {
        node_type: "neutral_node_forage",
        node_label: "Forager's Grove",
        spawn_count: 1,
        yield_ranges: [{ resource_id: "food", min_amount: 120, max_amount: 120 }],
        gather_duration_seconds: 30,
        ambush_risk_pct: 100,
        ambush_base_strength: 20,
        depletion_cycles: 2,
      },
    ],
  });

  const startedLowEscort = service.startGatherMarch({
    world_id: "world_gather",
    world_seed: "seed_gather_alpha",
    march_id: "march_low_guard",
    settlement_id: "settlement_alpha",
    army_name: "Foragers",
    node_id: "neutral_node_forage_1",
    departed_at: new Date("2026-02-26T10:00:00.000Z"),
    travel_seconds_per_leg: 30,
    escort_strength: 0,
  });
  assert.deepEqual(
    startedLowEscort.events.map((event) => event.content_key),
    ["event.world.gather_started"],
  );

  const resolvedLowEscort = service.advanceGatherMarch({
    march_id: "march_low_guard",
    observed_at: new Date("2026-02-26T10:02:00.000Z"),
  });
  assert.equal(resolvedLowEscort.march_state, "gather_march_resolved");
  assert.equal(resolvedLowEscort.ambush.ambush_triggered, true);
  assert.equal(resolvedLowEscort.ambush.outcome, "ambush_intercepted");
  assert.deepEqual(
    resolvedLowEscort.events.map((event) => event.content_key),
    [
      "event.world.ambush_triggered",
      "event.world.ambush_resolved",
      "event.world.gather_completed",
    ],
  );
  assert.deepEqual(resolvedLowEscort.gathered_yield, []);

  service.startGatherMarch({
    world_id: "world_gather",
    world_seed: "seed_gather_alpha",
    march_id: "march_high_guard",
    settlement_id: "settlement_alpha",
    army_name: "Shielded Foragers",
    node_id: "neutral_node_forage_1",
    departed_at: new Date("2026-02-26T10:10:00.000Z"),
    travel_seconds_per_leg: 30,
    escort_strength: 999,
  });
  const resolvedHighEscort = service.advanceGatherMarch({
    march_id: "march_high_guard",
    observed_at: new Date("2026-02-26T10:12:00.000Z"),
  });

  assert.equal(resolvedHighEscort.ambush.ambush_triggered, true);
  assert.equal(resolvedHighEscort.ambush.outcome, "ambush_repelled");
  assert.deepEqual(resolvedHighEscort.gathered_yield, [
    { resource_id: "food", amount: 120 },
  ]);
  assert.ok(
    resolvedHighEscort.events.some(
      (event) => event.content_key === "event.world.gather_completed",
    ),
  );

  assert.throws(
    () => {
      service.startGatherMarch({
        world_id: "world_gather",
        world_seed: "seed_gather_alpha",
        march_id: "march_after_depletion",
        settlement_id: "settlement_alpha",
        node_id: "neutral_node_forage_1",
        escort_strength: 10,
      });
    },
    (error) => error instanceof WorldMapNeutralNodeDepletedError,
  );
});
