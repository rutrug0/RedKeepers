import { strict as assert } from "node:assert";
import { test } from "node:test";

import { DeterministicFirstSliceBuildingUpgradeCommandHandler } from "../application/first-slice-building-upgrade-command-handler";
import {
  SettlementBuildingUpgradeEndpointHandler,
  SettlementBuildingUpgradeValidationError,
} from "./settlement-building-upgrade-endpoint";

test("POST /settlements/{settlementId}/buildings/{buildingId}/upgrade returns accepted response with placeholder event key", () => {
  const endpoint = new SettlementBuildingUpgradeEndpointHandler(
    new DeterministicFirstSliceBuildingUpgradeCommandHandler(),
  );

  const response = endpoint.handlePostUpgrade({
    path: {
      settlementId: "settlement_alpha",
      buildingId: "grain_plot",
    },
    body: {
      settlement_id: "settlement_alpha",
      building_id: "grain_plot",
      flow_version: "v1",
      current_level: 1,
      requested_at: "2026-02-25T18:10:00.000Z",
      resource_stock_by_id: {
        food: 500,
        wood: 500,
        stone: 500,
        iron: 500,
      },
    },
  });

  assert.equal(response.flow, "settlement.building_upgrade_v1");
  assert.equal(response.status, "accepted");
  assert.equal(response.schema_version, "rk-v1-building-upgrade-command-result");
  assert.equal(response.placeholder_events[0].payload.event_key, "event.buildings.upgrade_started");
});

test("POST /settlements/{settlementId}/buildings/{buildingId}/upgrade maps insufficient_resources to consistent error_code", () => {
  const endpoint = new SettlementBuildingUpgradeEndpointHandler(
    new DeterministicFirstSliceBuildingUpgradeCommandHandler(),
  );

  const response = endpoint.handlePostUpgrade({
    path: {
      settlementId: "settlement_alpha",
      buildingId: "grain_plot",
    },
    body: {
      settlement_id: "settlement_alpha",
      building_id: "grain_plot",
      flow_version: "v1",
      current_level: 2,
      requested_at: "2026-02-25T18:10:00.000Z",
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

test("POST /settlements/{settlementId}/buildings/{buildingId}/upgrade maps cooldown to consistent error_code", () => {
  const endpoint = new SettlementBuildingUpgradeEndpointHandler(
    new DeterministicFirstSliceBuildingUpgradeCommandHandler(),
  );

  const response = endpoint.handlePostUpgrade({
    path: {
      settlementId: "settlement_alpha",
      buildingId: "grain_plot",
    },
    body: {
      settlement_id: "settlement_alpha",
      building_id: "grain_plot",
      flow_version: "v1",
      current_level: 2,
      requested_at: "2026-02-25T18:10:00.000Z",
      cooldown_ends_at: "2026-02-25T18:11:30.000Z",
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

test("POST /settlements/{settlementId}/buildings/{buildingId}/upgrade rejects path/body building mismatch", () => {
  const endpoint = new SettlementBuildingUpgradeEndpointHandler(
    new DeterministicFirstSliceBuildingUpgradeCommandHandler(),
  );

  assert.throws(
    () =>
      endpoint.handlePostUpgrade({
        path: {
          settlementId: "settlement_alpha",
          buildingId: "grain_plot",
        },
        body: {
          settlement_id: "settlement_alpha",
          building_id: "quarry",
          flow_version: "v1",
          current_level: 1,
          requested_at: "2026-02-25T18:10:00.000Z",
        },
      }),
    (error: unknown) =>
      error instanceof SettlementBuildingUpgradeValidationError &&
      error.code === "building_id_mismatch",
  );
});
