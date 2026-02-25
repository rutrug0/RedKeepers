import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  createSettlementResourceProjectionServiceFromStarterData,
  DeterministicSettlementResourceProjectionService,
  SETTLEMENT_RESOURCE_TICK_PROJECTED_EVENT_TYPE,
} from "./settlement-resource-projection-service";

test("tickSettlementResources projects deterministic starter passive deltas", () => {
  const service = new DeterministicSettlementResourceProjectionService();
  const tickStartedAt = new Date("2026-02-25T18:00:00.000Z");
  const tickEndedAt = new Date("2026-02-25T18:30:00.000Z");

  const projection = service.tickSettlementResources({
    settlement_id: "settlement_alpha",
    settlement_name: "Ashkeep",
    tick_started_at: tickStartedAt,
    tick_ended_at: tickEndedAt,
    resource_stock: {
      food: 100,
      wood: 100,
      stone: 100,
      iron: 100,
    },
  });

  assert.deepStrictEqual(projection.resource_delta_by_id, {
    food: 3,
    wood: 2,
    stone: 1,
    iron: 0,
  });
  assert.deepStrictEqual(projection.resource_stock_by_id, {
    food: 103,
    wood: 102,
    stone: 101,
    iron: 100,
  });
  assert.equal(projection.duration_ms, 30 * 60 * 1000);
  assert.equal(projection.placeholder_events.length, 1);
  assert.equal(
    projection.placeholder_events[0].type,
    SETTLEMENT_RESOURCE_TICK_PROJECTED_EVENT_TYPE,
  );
  assert.equal(
    projection.placeholder_events[0].payload.event_key,
    "event.economy.tick_passive_income",
  );
  assert.ok(
    projection.resources
      .find((resource) => resource.resource_id === "iron")
      ?.reason_codes.includes("passive_prod_elapsed_floor"),
  );
});

test("tickSettlementResources uses starter defaults when values are unavailable", () => {
  const service = new DeterministicSettlementResourceProjectionService({
    resource_definitions_by_id: {
      food: {
        resource_id: "food",
        starting_stock: 400,
        base_storage_cap: 1200,
        base_passive_prod_per_h: 7,
        slice_status: "playable_now",
      },
    },
  });

  const projection = service.tickSettlementResources({
    settlement_id: "settlement_beta",
    tick_started_at: new Date("2026-02-25T19:00:00.000Z"),
    tick_ended_at: new Date("2026-02-25T20:00:00.000Z"),
    resource_stock: {
      food: 25,
    },
  });

  const food = projection.resources.find((resource) => resource.resource_id === "food");
  const wood = projection.resources.find((resource) => resource.resource_id === "wood");
  assert.ok(food);
  assert.ok(wood);
  assert.equal(food?.updated_stock, 32);
  assert.equal(wood?.updated_stock, 264);
  assert.ok(wood?.reason_codes.includes("default_resource_definition_seed"));
  assert.ok(wood?.reason_codes.includes("default_stock_starting_seed"));
  assert.ok(wood?.reason_codes.includes("default_storage_cap_seed"));
  assert.ok(wood?.reason_codes.includes("default_passive_prod_seed"));
});

test("tickSettlementResources clamps negative tick windows and stock overflow", () => {
  const service = new DeterministicSettlementResourceProjectionService();

  const projection = service.tickSettlementResources({
    settlement_id: "settlement_gamma",
    tick_started_at: new Date("2026-02-25T20:30:00.000Z"),
    tick_ended_at: new Date("2026-02-25T20:00:00.000Z"),
    resource_stock: {
      wood: 120,
    },
    storage_caps: {
      wood: 100,
    },
  });

  const wood = projection.resources.find((resource) => resource.resource_id === "wood");
  assert.ok(wood);
  assert.equal(projection.duration_ms, 0);
  assert.ok(projection.projection_reason_codes.includes("tick_window_clamped_to_zero"));
  assert.equal(wood?.previous_stock, 100);
  assert.equal(wood?.updated_stock, 100);
  assert.equal(wood?.delta, 0);
  assert.ok(wood?.reason_codes.includes("stock_clamped_to_cap"));
});

test("createSettlementResourceProjectionServiceFromStarterData keeps playable starter rows only", () => {
  const service = createSettlementResourceProjectionServiceFromStarterData({
    entries_by_id: {
      food: {
        resource_id: "food",
        starting_stock: 500,
        base_storage_cap: 1300,
        base_passive_prod_per_h: 9,
        slice_status: "playable_now",
      },
      wood: {
        resource_id: "wood",
        starting_stock: 600,
        base_storage_cap: 1300,
        base_passive_prod_per_h: 11,
        slice_status: "balance_stub",
      },
    },
  });

  const projection = service.tickSettlementResources({
    settlement_id: "settlement_delta",
    tick_started_at: new Date("2026-02-25T21:00:00.000Z"),
    tick_ended_at: new Date("2026-02-25T22:00:00.000Z"),
  });

  const food = projection.resources.find((resource) => resource.resource_id === "food");
  const wood = projection.resources.find((resource) => resource.resource_id === "wood");
  assert.ok(food);
  assert.ok(wood);
  assert.equal(food?.previous_stock, 500);
  assert.equal(wood?.previous_stock, 260);
  assert.ok(wood?.reason_codes.includes("default_resource_definition_seed"));
});
