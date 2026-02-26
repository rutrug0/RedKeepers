import { strict as assert } from "node:assert";
import { test } from "node:test";

import { DeterministicFirstSliceUnitTrainCommandHandler } from "../application/first-slice-unit-train-command-handler";
import {
  SettlementUnitTrainEndpointHandler,
  SettlementUnitTrainValidationError,
} from "./settlement-unit-train-endpoint";

test("POST /settlements/{settlementId}/units/{unitId}/train returns accepted response with placeholder event key", () => {
  const endpoint = new SettlementUnitTrainEndpointHandler(
    new DeterministicFirstSliceUnitTrainCommandHandler(),
  );

  const response = endpoint.handlePostTrain({
    path: {
      settlementId: "settlement_alpha",
      unitId: "watch_levy",
    },
    body: {
      settlement_id: "settlement_alpha",
      unit_id: "watch_levy",
      flow_version: "v1",
      quantity: 2,
      requested_at: "2026-02-25T18:10:00.000Z",
      barracks_level: 1,
      resource_stock_by_id: {
        food: 500,
        wood: 500,
        stone: 500,
        iron: 500,
      },
    },
  });

  assert.equal(response.flow, "settlement.unit_train_v1");
  assert.equal(response.status, "accepted");
  assert.equal(response.schema_version, "rk-v1-unit-train-command-result");
  assert.equal(response.placeholder_events[0].payload.event_key, "event.units.training_started");
});

test("POST /settlements/{settlementId}/units/{unitId}/train maps insufficient_resources to consistent error_code", () => {
  const endpoint = new SettlementUnitTrainEndpointHandler(
    new DeterministicFirstSliceUnitTrainCommandHandler(),
  );

  const response = endpoint.handlePostTrain({
    path: {
      settlementId: "settlement_alpha",
      unitId: "watch_levy",
    },
    body: {
      settlement_id: "settlement_alpha",
      unit_id: "watch_levy",
      flow_version: "v1",
      quantity: 2,
      requested_at: "2026-02-25T18:10:00.000Z",
      barracks_level: 1,
      resource_stock_by_id: {
        food: 0,
        wood: 0,
        stone: 0,
        iron: 0,
      },
    },
  });

  assert.equal(response.status, "failed");
  if (response.status !== "failed") {
    return;
  }
  assert.equal(response.failure_code, "insufficient_resources");
  assert.equal(response.error_code, "insufficient_resources");
});

test("POST /settlements/{settlementId}/units/{unitId}/train maps cooldown to consistent error_code", () => {
  const endpoint = new SettlementUnitTrainEndpointHandler(
    new DeterministicFirstSliceUnitTrainCommandHandler(),
  );

  const response = endpoint.handlePostTrain({
    path: {
      settlementId: "settlement_alpha",
      unitId: "watch_levy",
    },
    body: {
      settlement_id: "settlement_alpha",
      unit_id: "watch_levy",
      flow_version: "v1",
      quantity: 1,
      requested_at: "2026-02-25T18:10:00.000Z",
      barracks_level: 1,
      queue_available_at: "2026-02-25T18:11:30.000Z",
      resource_stock_by_id: {
        food: 500,
        wood: 500,
        stone: 500,
        iron: 500,
      },
    },
  });

  assert.equal(response.status, "failed");
  if (response.status !== "failed") {
    return;
  }
  assert.equal(response.failure_code, "cooldown");
  assert.equal(response.error_code, "cooldown");
});

test("POST /settlements/{settlementId}/units/{unitId}/train rejects path/body unit mismatch", () => {
  const endpoint = new SettlementUnitTrainEndpointHandler(
    new DeterministicFirstSliceUnitTrainCommandHandler(),
  );

  assert.throws(
    () =>
      endpoint.handlePostTrain({
        path: {
          settlementId: "settlement_alpha",
          unitId: "watch_levy",
        },
        body: {
          settlement_id: "settlement_alpha",
          unit_id: "pikeman",
          flow_version: "v1",
          quantity: 1,
          requested_at: "2026-02-25T18:10:00.000Z",
          barracks_level: 1,
        },
      }),
    (error: unknown) =>
      error instanceof SettlementUnitTrainValidationError &&
      error.code === "unit_id_mismatch",
  );
});
