import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  createFirstSliceUnitTrainCommandHandlerFromStarterData,
  DeterministicFirstSliceUnitTrainCommandHandler,
  UNIT_TRAIN_COMMAND_ACCEPTED_EVENT_TYPE,
} from "./first-slice-unit-train-command-handler";

test("handleTrainCommand accepts first-slice watch_levy training with placeholder event key", () => {
  const handler = new DeterministicFirstSliceUnitTrainCommandHandler();
  const requestedAt = new Date("2026-02-25T19:00:00.000Z");

  const result = handler.handleTrainCommand({
    settlement_id: "settlement_alpha",
    settlement_name: "Ashkeep",
    unit_id: "watch_levy",
    quantity: 2,
    requested_at: requestedAt,
    barracks_level: 1,
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

  assert.equal(result.unit_id, "watch_levy");
  assert.equal(result.quantity, 2);
  assert.equal(result.training_duration_s, 90);
  assert.deepStrictEqual(result.resource_cost_by_id, {
    food: 70,
    wood: 40,
    stone: 20,
    iron: 0,
  });
  assert.deepStrictEqual(result.resource_stock_after_by_id, {
    food: 30,
    wood: 60,
    stone: 80,
    iron: 100,
  });
  assert.equal(result.placeholder_events.length, 1);
  assert.equal(result.placeholder_events[0].type, UNIT_TRAIN_COMMAND_ACCEPTED_EVENT_TYPE);
  assert.equal(result.placeholder_events[0].payload.event_key, "event.units.training_started");
});

test("handleTrainCommand fails with insufficient_resources when stock is below train cost", () => {
  const handler = new DeterministicFirstSliceUnitTrainCommandHandler();
  const result = handler.handleTrainCommand({
    settlement_id: "settlement_alpha",
    unit_id: "watch_levy",
    quantity: 2,
    requested_at: new Date("2026-02-25T19:05:00.000Z"),
    barracks_level: 1,
    resource_stock: {
      food: 50,
      wood: 30,
      stone: 15,
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
    food: 20,
    wood: 10,
    stone: 5,
    iron: 0,
  });
});

test("handleTrainCommand fails with cooldown when barracks queue is still busy", () => {
  const handler = new DeterministicFirstSliceUnitTrainCommandHandler();
  const requestedAt = new Date("2026-02-25T19:10:00.000Z");
  const queueAvailableAt = new Date("2026-02-25T19:11:30.000Z");

  const result = handler.handleTrainCommand({
    settlement_id: "settlement_alpha",
    unit_id: "watch_levy",
    quantity: 1,
    requested_at: requestedAt,
    barracks_level: 1,
    queue_available_at: queueAvailableAt,
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") {
    return;
  }
  assert.equal(result.failure_code, "cooldown");
  if (result.failure_code !== "cooldown") {
    return;
  }
  assert.equal(result.cooldown_remaining_ms, 90000);
});

test("handleTrainCommand fails with invalid_state when barracks is unavailable", () => {
  const handler = new DeterministicFirstSliceUnitTrainCommandHandler();
  const result = handler.handleTrainCommand({
    settlement_id: "settlement_alpha",
    unit_id: "watch_levy",
    quantity: 1,
    requested_at: new Date("2026-02-25T19:15:00.000Z"),
    barracks_level: 0,
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") {
    return;
  }
  assert.equal(result.failure_code, "invalid_state");
  if (result.failure_code !== "invalid_state") {
    return;
  }
  assert.equal(result.invalid_reason, "barracks_not_ready");
});

test("createFirstSliceUnitTrainCommandHandlerFromStarterData only accepts playable starter rows", () => {
  const handler = createFirstSliceUnitTrainCommandHandlerFromStarterData({
    entries_by_id: {
      watch_levy: {
        unit_id: "watch_levy",
        display_name: "Stub Levy",
        train_building_id: "barracks",
        train_time_s: 1,
        cost_food: 1,
        cost_wood: 1,
        cost_stone: 1,
        cost_iron: 1,
        slice_status: "balance_stub",
      },
    },
  });

  const result = handler.handleTrainCommand({
    settlement_id: "settlement_alpha",
    unit_id: "watch_levy",
    quantity: 1,
    requested_at: new Date("2026-02-25T19:20:00.000Z"),
    barracks_level: 1,
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
  assert.equal(result.unit_label, "Watch Levy");
  assert.deepStrictEqual(result.resource_cost_by_id, {
    food: 35,
    wood: 20,
    stone: 10,
    iron: 0,
  });
});
