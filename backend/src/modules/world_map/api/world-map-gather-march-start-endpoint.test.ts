import { strict as assert } from "node:assert";
import { test } from "node:test";

import { DeterministicWorldMapNeutralGatheringService } from "../application";
import {
  InMemoryWorldMapGatherMarchStateRepository,
  InMemoryWorldMapNeutralNodeStateRepository,
} from "../infra";
import { WorldMapGatherMarchStartEndpointHandler } from "./world-map-gather-march-start-endpoint";

test("POST /world-map/gather-marches/{marchId}/start returns accepted gather-start payload for seeded neutral node", () => {
  const nodeRepository = new InMemoryWorldMapNeutralNodeStateRepository();
  const marchRepository = new InMemoryWorldMapGatherMarchStateRepository();
  const service = new DeterministicWorldMapNeutralGatheringService(
    nodeRepository,
    marchRepository,
  );
  service.spawnNeutralNodes({
    world_id: "world_alpha",
    world_seed: "seed_alpha",
    map_size: 16,
    spawn_table: [
      {
        node_type: "neutral_node_forage",
        node_label: "Forager's Grove",
        spawn_count: 1,
        yield_ranges: [{ resource_id: "food", min_amount: 80, max_amount: 80 }],
        gather_duration_seconds: 30,
        ambush_risk_pct: 20,
        ambush_base_strength: 10,
        depletion_cycles: 2,
      },
    ],
  });
  const endpoint = new WorldMapGatherMarchStartEndpointHandler(service);

  const response = endpoint.handlePostGatherStartContract({
    path: { marchId: "march_alpha" },
    body: {
      world_id: "world_alpha",
      world_seed: "seed_alpha",
      march_id: "march_alpha",
      settlement_id: "settlement_alpha",
      node_id: "neutral_node_forage_1",
      flow_version: "v1",
      army_name: "Foragers",
      departed_at: "2026-02-26T18:00:00.000Z",
      travel_seconds_per_leg: 30,
      escort_strength: 25,
    },
  });

  assert.equal(response.status, "accepted");
  if (response.status !== "accepted") {
    return;
  }
  assert.equal(response.flow, "world_map.neutral_gathering_v1");
  assert.equal(response.march_id, "march_alpha");
  assert.equal(response.march_state, "gather_march_in_progress");
  assert.deepStrictEqual(
    response.events.map((event) => event.content_key),
    ["event.world.gather_started"],
  );
});

test("POST /world-map/gather-marches/{marchId}/start maps unknown neutral node to stable error code", () => {
  const service = new DeterministicWorldMapNeutralGatheringService(
    new InMemoryWorldMapNeutralNodeStateRepository(),
    new InMemoryWorldMapGatherMarchStateRepository(),
  );
  const endpoint = new WorldMapGatherMarchStartEndpointHandler(service);

  const response = endpoint.handlePostGatherStartContract({
    path: { marchId: "march_unknown_node" },
    body: {
      world_id: "world_alpha",
      world_seed: "seed_alpha",
      march_id: "march_unknown_node",
      settlement_id: "settlement_alpha",
      node_id: "neutral_node_missing",
      flow_version: "v1",
      escort_strength: 10,
    },
  });

  assert.equal(response.status, "failed");
  if (response.status !== "failed") {
    return;
  }
  assert.equal(response.error_code, "neutral_node_not_found");
  assert.equal(response.flow, "world_map.neutral_gathering_v1");
});

test("POST /world-map/gather-marches/{marchId}/start maps duplicate march ids to stable error code", () => {
  const nodeRepository = new InMemoryWorldMapNeutralNodeStateRepository();
  const marchRepository = new InMemoryWorldMapGatherMarchStateRepository();
  const service = new DeterministicWorldMapNeutralGatheringService(
    nodeRepository,
    marchRepository,
  );
  service.spawnNeutralNodes({
    world_id: "world_alpha",
    world_seed: "seed_alpha",
    map_size: 16,
    spawn_table: [
      {
        node_type: "neutral_node_forage",
        node_label: "Forager's Grove",
        spawn_count: 1,
        yield_ranges: [{ resource_id: "food", min_amount: 80, max_amount: 80 }],
        gather_duration_seconds: 30,
        ambush_risk_pct: 20,
        ambush_base_strength: 10,
        depletion_cycles: 2,
      },
    ],
  });
  const endpoint = new WorldMapGatherMarchStartEndpointHandler(service);

  const accepted = endpoint.handlePostGatherStartContract({
    path: { marchId: "march_dupe" },
    body: {
      world_id: "world_alpha",
      world_seed: "seed_alpha",
      march_id: "march_dupe",
      settlement_id: "settlement_alpha",
      node_id: "neutral_node_forage_1",
      flow_version: "v1",
      escort_strength: 5,
    },
  });
  assert.equal(accepted.status, "accepted");

  const duplicate = endpoint.handlePostGatherStartContract({
    path: { marchId: "march_dupe" },
    body: {
      world_id: "world_alpha",
      world_seed: "seed_alpha",
      march_id: "march_dupe",
      settlement_id: "settlement_alpha",
      node_id: "neutral_node_forage_1",
      flow_version: "v1",
      escort_strength: 5,
    },
  });
  assert.equal(duplicate.status, "failed");
  if (duplicate.status !== "failed") {
    return;
  }
  assert.equal(duplicate.error_code, "gather_march_already_exists");
});

test("POST /world-map/gather-marches/{marchId}/start maps depleted neutral nodes to stable error code", () => {
  const nodeRepository = new InMemoryWorldMapNeutralNodeStateRepository();
  const marchRepository = new InMemoryWorldMapGatherMarchStateRepository();
  const service = new DeterministicWorldMapNeutralGatheringService(
    nodeRepository,
    marchRepository,
  );
  service.spawnNeutralNodes({
    world_id: "world_alpha",
    world_seed: "seed_alpha",
    map_size: 16,
    spawn_table: [
      {
        node_type: "neutral_node_forage",
        node_label: "Forager's Grove",
        spawn_count: 1,
        yield_ranges: [{ resource_id: "food", min_amount: 80, max_amount: 80 }],
        gather_duration_seconds: 30,
        ambush_risk_pct: 20,
        ambush_base_strength: 10,
        depletion_cycles: 1,
      },
    ],
  });
  const endpoint = new WorldMapGatherMarchStartEndpointHandler(service);

  endpoint.handlePostGatherStartContract({
    path: { marchId: "march_first_cycle" },
    body: {
      world_id: "world_alpha",
      world_seed: "seed_alpha",
      march_id: "march_first_cycle",
      settlement_id: "settlement_alpha",
      node_id: "neutral_node_forage_1",
      flow_version: "v1",
      departed_at: "2026-02-26T18:00:00.000Z",
      travel_seconds_per_leg: 30,
      escort_strength: 0,
    },
  });
  service.advanceGatherMarch({
    march_id: "march_first_cycle",
    observed_at: new Date("2026-02-26T18:02:00.000Z"),
  });

  const response = endpoint.handlePostGatherStartContract({
    path: { marchId: "march_after_depletion" },
    body: {
      world_id: "world_alpha",
      world_seed: "seed_alpha",
      march_id: "march_after_depletion",
      settlement_id: "settlement_alpha",
      node_id: "neutral_node_forage_1",
      flow_version: "v1",
      escort_strength: 5,
    },
  });

  assert.equal(response.status, "failed");
  if (response.status !== "failed") {
    return;
  }
  assert.equal(response.error_code, "neutral_node_depleted");
});
