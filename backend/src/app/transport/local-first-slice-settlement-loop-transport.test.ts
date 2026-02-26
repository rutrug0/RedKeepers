import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE,
} from "../../modules/buildings";
import {
  POST_SETTLEMENT_TICK_ROUTE,
} from "../../modules/economy";
import {
  POST_SETTLEMENT_UNIT_TRAIN_ROUTE,
} from "../../modules/units";
import {
  InMemoryWorldMapLifecycleStateRepository,
  InMemoryWorldMapMarchStateRepository,
  POST_WORLD_MAP_GATHER_MARCH_POLL_ROUTE,
  POST_WORLD_MAP_GATHER_MARCH_START_ROUTE,
  POST_WORLD_MAP_LIFECYCLE_ADVANCE_ROUTE,
  POST_WORLD_MAP_SETTLEMENT_ATTACK_ROUTE,
  POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE,
  POST_WORLD_MAP_TILE_INTERACT_ROUTE,
} from "../../modules/world_map";
import {
  createDeterministicFirstSliceSettlementLoopLocalRpcTransport,
} from "./local-first-slice-settlement-loop-transport";

test("local first-slice transport exposes all settlement loop routes and serves tick requests", () => {
  const transport = createDeterministicFirstSliceSettlementLoopLocalRpcTransport();

  assert.deepStrictEqual(
    transport.getRegisteredRoutes().sort(),
    [
      POST_SETTLEMENT_TICK_ROUTE,
      POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE,
      POST_SETTLEMENT_UNIT_TRAIN_ROUTE,
      POST_WORLD_MAP_LIFECYCLE_ADVANCE_ROUTE,
      POST_WORLD_MAP_SETTLEMENT_ATTACK_ROUTE,
      POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE,
      POST_WORLD_MAP_TILE_INTERACT_ROUTE,
      POST_WORLD_MAP_GATHER_MARCH_START_ROUTE,
      POST_WORLD_MAP_GATHER_MARCH_POLL_ROUTE,
    ].sort(),
  );

  const response = transport.invoke(POST_SETTLEMENT_TICK_ROUTE, {
    path: { settlementId: "settlement_alpha" },
    body: {
      settlement_id: "settlement_alpha",
      flow_version: "v1",
      tick_started_at: "2026-02-26T18:00:00.000Z",
      tick_ended_at: "2026-02-26T18:01:00.000Z",
    },
  });

  assert.equal(response.status_code, 200);
  if (response.status_code !== 200) {
    return;
  }
  assert.equal(response.body.flow, "settlement.tick_v1");
  assert.equal(response.body.status, "accepted");
});

test("local first-slice transport serves deterministic world-map lifecycle transitions and archive summary", () => {
  const transport = createDeterministicFirstSliceSettlementLoopLocalRpcTransport({
    world_map_lifecycle_state_repository: new InMemoryWorldMapLifecycleStateRepository([
      {
        world_id: "world_alpha",
        world_revision: 7,
        lifecycle_state: "world_lifecycle_open",
        season_number: 5,
        season_length_days: 1,
        season_started_at: new Date("2026-02-25T00:00:00.000Z"),
        state_changed_at: new Date("2026-02-25T00:00:00.000Z"),
        joinable_world_state: {
          joinable_player_ids: ["player_01", "player_02"],
          active_settlement_ids: ["settlement_01", "settlement_02"],
          active_march_ids: ["march_01"],
        },
      },
    ]),
  });

  const response = transport.invoke(POST_WORLD_MAP_LIFECYCLE_ADVANCE_ROUTE, {
    path: {
      worldId: "world_alpha",
    },
    body: {
      world_id: "world_alpha",
      flow_version: "v1",
      observed_at: "2026-02-26T00:06:30.000Z",
    },
  });

  assert.equal(response.status_code, 200);
  if (response.status_code !== 200) {
    return;
  }
  assert.equal(response.body.status, "accepted");
  assert.equal(response.body.flow, "world_map.lifecycle_v1");
  assert.deepStrictEqual(
    response.body.events.map((event) => event.content_key),
    [
      "event.world.lifecycle_locked",
      "event.world.lifecycle_archived",
      "event.world.lifecycle_reset",
      "event.world.lifecycle_opened",
    ],
  );
  assert.equal(response.body.latest_archive?.archive_id, "world_alpha:season:5");
});

test("local first-slice transport keeps insufficient_resources error_code for building upgrade failures", () => {
  const transport = createDeterministicFirstSliceSettlementLoopLocalRpcTransport();

  const response = transport.invoke(POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE, {
    path: {
      settlementId: "settlement_alpha",
      buildingId: "grain_plot",
    },
    body: {
      settlement_id: "settlement_alpha",
      building_id: "grain_plot",
      flow_version: "v1",
      current_level: 1,
      requested_at: "2026-02-26T18:05:00.000Z",
      resource_stock_by_id: {
        food: 0,
        wood: 0,
        stone: 0,
        iron: 0,
      },
    },
  });

  assert.equal(response.status_code, 200);
  if (response.status_code !== 200) {
    return;
  }
  assert.equal(response.body.status, "failed");
  if (response.body.status !== "failed") {
    return;
  }
  assert.equal(response.body.error_code, "insufficient_resources");
});

test("local first-slice transport keeps cooldown error_code for unit train failures", () => {
  const transport = createDeterministicFirstSliceSettlementLoopLocalRpcTransport();

  const response = transport.invoke(POST_SETTLEMENT_UNIT_TRAIN_ROUTE, {
    path: {
      settlementId: "settlement_alpha",
      unitId: "watch_levy",
    },
    body: {
      settlement_id: "settlement_alpha",
      unit_id: "watch_levy",
      flow_version: "v1",
      quantity: 1,
      requested_at: "2026-02-26T18:10:00.000Z",
      barracks_level: 1,
      queue_available_at: "2026-02-26T18:12:00.000Z",
      resource_stock_by_id: {
        food: 500,
        wood: 500,
        stone: 500,
        iron: 500,
      },
    },
  });

  assert.equal(response.status_code, 200);
  if (response.status_code !== 200) {
    return;
  }
  assert.equal(response.body.status, "failed");
  if (response.body.status !== "failed") {
    return;
  }
  assert.equal(response.body.error_code, "cooldown");
});

test("local first-slice transport serves deterministic world-map march snapshots", () => {
  const transport = createDeterministicFirstSliceSettlementLoopLocalRpcTransport({
    world_map_march_state_repository: new InMemoryWorldMapMarchStateRepository([
      {
        march_id: "march_alpha",
        settlement_id: "settlement_alpha",
        march_revision: 1,
        march_state: "march_state_in_transit",
        origin: { x: 0, y: 0 },
        target: { x: 2, y: 0 },
        departed_at: new Date("2026-02-26T19:00:00.000Z"),
        seconds_per_tile: 30,
        attacker_strength: 120,
        defender_strength: 100,
      },
    ]),
  });

  const response = transport.invoke(POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE, {
    path: {
      marchId: "march_alpha",
    },
    body: {
      march_id: "march_alpha",
      flow_version: "v1",
      observed_at: "2026-02-26T19:00:15.500Z",
    },
  });

  assert.equal(response.status_code, 200);
  if (response.status_code !== 200) {
    return;
  }
  assert.equal(response.body.flow, "world_map.march_snapshot_v1");
  assert.equal(response.body.march_state, "march_state_in_transit");
  assert.equal(response.body.interpolation_window !== undefined, true);
});

test("local first-slice transport serves deterministic hostile settlement attack contracts", () => {
  const transport = createDeterministicFirstSliceSettlementLoopLocalRpcTransport();

  const response = transport.invoke(POST_WORLD_MAP_SETTLEMENT_ATTACK_ROUTE, {
    path: {
      targetSettlementId: "settlement_hostile",
    },
    body: {
      flow_version: "v1",
      march_id: "march_attack_alpha",
      source_settlement_id: "settlement_alpha",
      source_settlement_name: "Cinderwatch Hold",
      target_settlement_id: "settlement_hostile",
      target_settlement_name: "Ruin Holdfast",
      target_tile_label: "Ruin Holdfast",
      origin: {
        x: 0,
        y: 0,
      },
      target: {
        x: 2,
        y: 1,
      },
      defender_garrison_strength: 40,
      dispatched_units: [
        {
          unit_id: "watch_levy",
          unit_count: 10,
          unit_attack: 5,
        },
      ],
      departed_at: "2026-02-26T19:30:00.000Z",
    },
  });

  assert.equal(response.status_code, 200);
  if (response.status_code !== 200) {
    return;
  }
  assert.equal(response.body.status, "accepted");
  if (response.body.status !== "accepted") {
    return;
  }
  assert.equal(response.body.flow, "world_map.hostile_attack_v1");
  assert.deepStrictEqual(
    response.body.events.map((event) => event.payload_key),
    ["dispatch_sent", "march_arrived", "combat_resolved"],
  );
  assert.equal(
    response.body.event_payloads.dispatch_sent.content_key,
    "event.world.march_started",
  );
  assert.equal(
    response.body.event_payloads.march_arrived.content_key,
    "event.world.march_returned",
  );
  assert.equal(
    response.body.event_payloads.combat_resolved.content_key,
    "event.combat.placeholder_skirmish_win",
  );
  assert.equal(response.body.losses.attacker_units_lost, 2);
  assert.equal(response.body.losses.defender_garrison_lost, 40);
});

test("local first-slice transport keeps unavailable_tile error_code for world-map scout failures", () => {
  const transport = createDeterministicFirstSliceSettlementLoopLocalRpcTransport({
    resolve_tile_available: () => false,
  });

  const response = transport.invoke(POST_WORLD_MAP_TILE_INTERACT_ROUTE, {
    path: {
      tileId: "tile_0412_0198",
    },
    body: {
      settlement_id: "settlement_alpha",
      tile_id: "tile_0412_0198",
      interaction_type: "scout",
      flow_version: "v1",
    },
  });

  assert.equal(response.status_code, 200);
  if (response.status_code !== 200) {
    return;
  }
  assert.equal(response.body.status, "failed");
  if (response.body.status !== "failed") {
    return;
  }
  assert.equal(response.body.error_code, "unavailable_tile");
});

test("local first-slice transport serves deterministic gather start and poll contracts", () => {
  const transport = createDeterministicFirstSliceSettlementLoopLocalRpcTransport();

  const startResponse = transport.invoke(POST_WORLD_MAP_GATHER_MARCH_START_ROUTE, {
    path: {
      marchId: "march_gather_alpha",
    },
    body: {
      world_id: "world_alpha",
      world_seed: "seed_world_alpha",
      march_id: "march_gather_alpha",
      settlement_id: "settlement_alpha",
      node_id: "neutral_node_forage_1",
      flow_version: "v1",
      departed_at: "2026-02-26T19:00:00.000Z",
      travel_seconds_per_leg: 30,
      escort_strength: 0,
    },
  });

  assert.equal(startResponse.status_code, 200);
  if (startResponse.status_code !== 200) {
    return;
  }
  assert.equal(startResponse.body.status, "accepted");
  if (startResponse.body.status !== "accepted") {
    return;
  }
  assert.equal(startResponse.body.flow, "world_map.neutral_gathering_v1");
  assert.deepStrictEqual(
    startResponse.body.events.map((event) => event.content_key),
    ["event.world.gather_started"],
  );

  const pollResponse = transport.invoke(POST_WORLD_MAP_GATHER_MARCH_POLL_ROUTE, {
    path: {
      marchId: "march_gather_alpha",
    },
    body: {
      march_id: "march_gather_alpha",
      flow_version: "v1",
      observed_at: "2026-02-26T19:02:00.000Z",
    },
  });

  assert.equal(pollResponse.status_code, 200);
  if (pollResponse.status_code !== 200) {
    return;
  }
  assert.equal(pollResponse.body.status, "accepted");
  if (pollResponse.body.status !== "accepted") {
    return;
  }
  assert.equal(pollResponse.body.march_state, "gather_march_resolved");
  assert.deepStrictEqual(pollResponse.body.resource_ledger.resource_delta_by_id, {
    food: 0,
    wood: 0,
    stone: 0,
    iron: 0,
  });
  assert.equal(pollResponse.body.resource_ledger.resource_stock_by_id.food, 300);
  assert.equal(
    pollResponse.body.events.some((event) => event.content_key === "event.world.gather_completed"),
    true,
  );
});

test("local first-slice transport keeps gather failure error_code contract for unknown, duplicate, and depleted nodes", () => {
  const transport = createDeterministicFirstSliceSettlementLoopLocalRpcTransport({
    world_map_neutral_node_spawn_input: {
      world_id: "world_alpha",
      world_seed: "seed_world_alpha",
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
          depletion_cycles: 1,
        },
      ],
    },
  });

  const unknownNodeResponse = transport.invoke(POST_WORLD_MAP_GATHER_MARCH_START_ROUTE, {
    path: {
      marchId: "march_gather_unknown_node",
    },
    body: {
      world_id: "world_alpha",
      world_seed: "seed_world_alpha",
      march_id: "march_gather_unknown_node",
      settlement_id: "settlement_alpha",
      node_id: "neutral_node_missing",
      flow_version: "v1",
      escort_strength: 5,
    },
  });
  assert.equal(unknownNodeResponse.status_code, 200);
  if (unknownNodeResponse.status_code === 200) {
    assert.equal(unknownNodeResponse.body.status, "failed");
    if (unknownNodeResponse.body.status === "failed") {
      assert.equal(unknownNodeResponse.body.error_code, "neutral_node_not_found");
    }
  }

  const accepted = transport.invoke(POST_WORLD_MAP_GATHER_MARCH_START_ROUTE, {
    path: {
      marchId: "march_gather_dupe",
    },
    body: {
      world_id: "world_alpha",
      world_seed: "seed_world_alpha",
      march_id: "march_gather_dupe",
      settlement_id: "settlement_alpha",
      node_id: "neutral_node_forage_1",
      flow_version: "v1",
      escort_strength: 0,
      departed_at: "2026-02-26T19:00:00.000Z",
      travel_seconds_per_leg: 30,
    },
  });
  assert.equal(accepted.status_code, 200);
  if (accepted.status_code === 200) {
    assert.equal(accepted.body.status, "accepted");
  }

  const duplicate = transport.invoke(POST_WORLD_MAP_GATHER_MARCH_START_ROUTE, {
    path: {
      marchId: "march_gather_dupe",
    },
    body: {
      world_id: "world_alpha",
      world_seed: "seed_world_alpha",
      march_id: "march_gather_dupe",
      settlement_id: "settlement_alpha",
      node_id: "neutral_node_forage_1",
      flow_version: "v1",
      escort_strength: 0,
    },
  });
  assert.equal(duplicate.status_code, 200);
  if (duplicate.status_code === 200) {
    assert.equal(duplicate.body.status, "failed");
    if (duplicate.body.status === "failed") {
      assert.equal(duplicate.body.error_code, "gather_march_already_exists");
    }
  }

  const resolveToDeplete = transport.invoke(POST_WORLD_MAP_GATHER_MARCH_POLL_ROUTE, {
    path: {
      marchId: "march_gather_dupe",
    },
    body: {
      march_id: "march_gather_dupe",
      flow_version: "v1",
      observed_at: "2026-02-26T19:02:00.000Z",
    },
  });
  assert.equal(resolveToDeplete.status_code, 200);

  const depleted = transport.invoke(POST_WORLD_MAP_GATHER_MARCH_START_ROUTE, {
    path: {
      marchId: "march_after_depletion",
    },
    body: {
      world_id: "world_alpha",
      world_seed: "seed_world_alpha",
      march_id: "march_after_depletion",
      settlement_id: "settlement_alpha",
      node_id: "neutral_node_forage_1",
      flow_version: "v1",
      escort_strength: 5,
    },
  });
  assert.equal(depleted.status_code, 200);
  if (depleted.status_code === 200) {
    assert.equal(depleted.body.status, "failed");
    if (depleted.body.status === "failed") {
      assert.equal(depleted.body.error_code, "neutral_node_depleted");
    }
  }
});
