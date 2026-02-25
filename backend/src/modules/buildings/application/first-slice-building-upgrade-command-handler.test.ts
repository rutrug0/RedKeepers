import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  BUILDING_UPGRADE_COMMAND_ACCEPTED_EVENT_TYPE,
  createFirstSliceBuildingUpgradeCommandHandlerFromStarterData,
  DeterministicFirstSliceBuildingUpgradeCommandHandler,
} from "./first-slice-building-upgrade-command-handler";

test("handleUpgradeCommand accepts first-slice grain_plot upgrades with placeholder event key", () => {
  const handler = new DeterministicFirstSliceBuildingUpgradeCommandHandler();
  const requestedAt = new Date("2026-02-25T18:00:00.000Z");

  const result = handler.handleUpgradeCommand({
    settlement_id: "settlement_alpha",
    settlement_name: "Ashkeep",
    building_id: "grain_plot",
    current_level: 0,
    requested_at: requestedAt,
    resource_stock: {
      food: 100,
      wood: 100,
      stone: 100,
      iron: 100,
    },
  });

  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") {
    return;
  }

  assert.equal(result.building_id, "grain_plot");
  assert.equal(result.from_level, 0);
  assert.equal(result.to_level, 1);
  assert.equal(result.upgrade_duration_s, 90);
  assert.deepStrictEqual(result.resource_cost_by_id, {
    food: 40,
    wood: 60,
    stone: 20,
    iron: 0,
  });
  assert.deepStrictEqual(result.resource_stock_after_by_id, {
    food: 60,
    wood: 40,
    stone: 80,
    iron: 100,
  });
  assert.equal(result.placeholder_events.length, 1);
  assert.equal(result.placeholder_events[0].type, BUILDING_UPGRADE_COMMAND_ACCEPTED_EVENT_TYPE);
  assert.equal(result.placeholder_events[0].payload.event_key, "event.buildings.upgrade_started");
});

test("handleUpgradeCommand fails with insufficient_resources when stock is below upgrade cost", () => {
  const handler = new DeterministicFirstSliceBuildingUpgradeCommandHandler();
  const result = handler.handleUpgradeCommand({
    settlement_id: "settlement_alpha",
    building_id: "grain_plot",
    current_level: 0,
    requested_at: new Date("2026-02-25T18:05:00.000Z"),
    resource_stock: {
      food: 30,
      wood: 30,
      stone: 10,
      iron: 0,
    },
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") {
    return;
  }

  assert.equal(result.failure_code, "insufficient_resources");
  if (result.failure_code !== "insufficient_resources") {
    return;
  }
  assert.deepStrictEqual(result.missing_resources_by_id, {
    food: 10,
    wood: 30,
    stone: 10,
    iron: 0,
  });
});

test("handleUpgradeCommand fails with cooldown when cooldown window is active", () => {
  const handler = new DeterministicFirstSliceBuildingUpgradeCommandHandler();
  const requestedAt = new Date("2026-02-25T18:10:00.000Z");
  const cooldownEndsAt = new Date("2026-02-25T18:12:00.000Z");

  const result = handler.handleUpgradeCommand({
    settlement_id: "settlement_alpha",
    building_id: "grain_plot",
    current_level: 0,
    requested_at: requestedAt,
    cooldown_ends_at: cooldownEndsAt,
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") {
    return;
  }

  assert.equal(result.failure_code, "cooldown");
  if (result.failure_code !== "cooldown") {
    return;
  }

  assert.equal(result.cooldown_remaining_ms, 120000);
});

test("handleUpgradeCommand fails with invalid_state when max level is reached", () => {
  const handler = new DeterministicFirstSliceBuildingUpgradeCommandHandler();
  const result = handler.handleUpgradeCommand({
    settlement_id: "settlement_alpha",
    building_id: "grain_plot",
    current_level: 10,
    requested_at: new Date("2026-02-25T18:20:00.000Z"),
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") {
    return;
  }

  assert.equal(result.failure_code, "invalid_state");
  if (result.failure_code !== "invalid_state") {
    return;
  }
  assert.equal(result.invalid_reason, "max_level_reached");
});

test("createFirstSliceBuildingUpgradeCommandHandlerFromStarterData only accepts playable starter rows", () => {
  const handler = createFirstSliceBuildingUpgradeCommandHandlerFromStarterData({
    entries_by_id: {
      grain_plot: {
        building_id: "grain_plot",
        display_name: "Stub Grain Plot",
        max_level_v1: 20,
        build_time_l1_s: 1,
        build_time_mult_per_level: 1,
        cost_food_l1: 1,
        cost_wood_l1: 1,
        cost_stone_l1: 1,
        cost_iron_l1: 1,
        cost_mult_per_level: 1,
        slice_status: "balance_stub",
      },
    },
  });

  const result = handler.handleUpgradeCommand({
    settlement_id: "settlement_alpha",
    building_id: "grain_plot",
    current_level: 0,
    requested_at: new Date("2026-02-25T18:25:00.000Z"),
    resource_stock: {
      food: 100,
      wood: 100,
      stone: 100,
      iron: 100,
    },
  });

  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") {
    return;
  }

  assert.equal(result.building_label, "Grain Plot");
  assert.deepStrictEqual(result.resource_cost_by_id, {
    food: 40,
    wood: 60,
    stone: 20,
    iron: 0,
  });
});
