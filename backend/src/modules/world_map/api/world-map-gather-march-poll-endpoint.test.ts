import { strict as assert } from "node:assert";
import { test } from "node:test";

import { DeterministicWorldMapNeutralGatheringService } from "../application";
import {
  InMemoryWorldMapGatherMarchStateRepository,
  InMemoryWorldMapNeutralNodeStateRepository,
} from "../infra";
import { WorldMapGatherMarchPollEndpointHandler } from "./world-map-gather-march-poll-endpoint";

test("POST /world-map/gather-marches/{marchId}/poll returns deterministic gather and ambush resolution payload", () => {
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
        yield_ranges: [{ resource_id: "food", min_amount: 120, max_amount: 120 }],
        gather_duration_seconds: 30,
        ambush_risk_pct: 100,
        ambush_base_strength: 20,
        depletion_cycles: 2,
      },
    ],
  });
  service.startGatherMarch({
    world_id: "world_alpha",
    world_seed: "seed_alpha",
    march_id: "march_alpha",
    settlement_id: "settlement_alpha",
    node_id: "neutral_node_forage_1",
    departed_at: new Date("2026-02-26T18:00:00.000Z"),
    travel_seconds_per_leg: 30,
    escort_strength: 0,
  });
  const endpoint = new WorldMapGatherMarchPollEndpointHandler(service);

  const inProgress = endpoint.handlePostGatherPollContract({
    path: { marchId: "march_alpha" },
    body: {
      march_id: "march_alpha",
      flow_version: "v1",
      observed_at: "2026-02-26T18:00:30.000Z",
    },
  });
  assert.equal(inProgress.status, "accepted");
  if (inProgress.status !== "accepted") {
    return;
  }
  assert.equal(inProgress.march_state, "gather_march_in_progress");
  assert.equal(inProgress.events.length, 0);

  const resolved = endpoint.handlePostGatherPollContract({
    path: { marchId: "march_alpha" },
    body: {
      march_id: "march_alpha",
      flow_version: "v1",
      observed_at: "2026-02-26T18:02:00.000Z",
    },
  });
  assert.equal(resolved.status, "accepted");
  if (resolved.status !== "accepted") {
    return;
  }
  assert.equal(resolved.march_state, "gather_march_resolved");
  assert.equal(resolved.ambush.ambush_triggered, true);
  assert.equal(resolved.ambush.outcome, "ambush_intercepted");
  assert.deepStrictEqual(
    resolved.events.map((event) => event.content_key),
    [
      "event.world.ambush_triggered",
      "event.world.ambush_resolved",
      "event.world.gather_completed",
    ],
  );
});

test("POST /world-map/gather-marches/{marchId}/poll maps unknown march ids to stable error code", () => {
  const endpoint = new WorldMapGatherMarchPollEndpointHandler(
    new DeterministicWorldMapNeutralGatheringService(
      new InMemoryWorldMapNeutralNodeStateRepository(),
      new InMemoryWorldMapGatherMarchStateRepository(),
    ),
  );

  const response = endpoint.handlePostGatherPollContract({
    path: { marchId: "march_missing" },
    body: {
      march_id: "march_missing",
      flow_version: "v1",
    },
  });

  assert.equal(response.status, "failed");
  if (response.status !== "failed") {
    return;
  }
  assert.equal(response.error_code, "gather_march_not_found");
  assert.equal(response.flow, "world_map.neutral_gathering_v1");
});
