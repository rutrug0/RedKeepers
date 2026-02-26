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
      POST_WORLD_MAP_TILE_INTERACT_ROUTE,
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
