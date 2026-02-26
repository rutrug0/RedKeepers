import { strict as assert } from "node:assert";
import { test } from "node:test";

import { DeterministicSettlementResourceProjectionService } from "../application/settlement-resource-projection-service";
import {
  SettlementTickEndpointHandler,
  SettlementTickValidationError,
} from "./settlement-tick-endpoint";

test("POST /settlements/{settlementId}/tick returns deterministic projection with placeholder event key", () => {
  const endpoint = new SettlementTickEndpointHandler(
    new DeterministicSettlementResourceProjectionService({
      default_settlement_name: "Ashkeep",
    }),
  );

  const response = endpoint.handlePostTick({
    path: { settlementId: "settlement_alpha" },
    body: {
      settlement_id: "settlement_alpha",
      flow_version: "v1",
      tick_started_at: "2026-02-25T18:00:00.000Z",
      tick_ended_at: "2026-02-25T18:30:00.000Z",
      resource_stock_by_id: {
        food: 100,
        wood: 100,
        stone: 100,
        iron: 100,
      },
      passive_prod_per_h_by_id: {
        food: 120,
        wood: 60,
        stone: 30,
        iron: 10,
      },
      storage_cap_by_id: {
        food: 500,
        wood: 500,
        stone: 500,
        iron: 500,
      },
    },
  });

  assert.equal(response.flow, "settlement.tick_v1");
  assert.equal(response.status, "accepted");
  assert.equal(response.schema_version, "rk-v1-settlement-resource-tick");
  assert.equal(response.duration_ms, 1_800_000);
  assert.equal(response.resource_delta_by_id.food, 60);
  assert.equal(response.resource_stock_by_id.food, 160);
  assert.equal(response.placeholder_events.length, 1);
  assert.equal(
    response.placeholder_events[0].payload.event_key,
    "event.economy.tick_passive_income",
  );
});

test("POST /settlements/{settlementId}/tick rejects mismatched settlement identifiers", () => {
  const endpoint = new SettlementTickEndpointHandler(
    new DeterministicSettlementResourceProjectionService(),
  );

  assert.throws(
    () =>
      endpoint.handlePostTick({
        path: { settlementId: "settlement_alpha" },
        body: {
          settlement_id: "settlement_beta",
          flow_version: "v1",
          tick_started_at: "2026-02-25T18:00:00.000Z",
          tick_ended_at: "2026-02-25T18:30:00.000Z",
        },
      }),
    (error: unknown) =>
      error instanceof SettlementTickValidationError &&
      error.code === "settlement_id_mismatch",
  );
});

test("POST /settlements/{settlementId}/tick rejects invalid tick timestamps", () => {
  const endpoint = new SettlementTickEndpointHandler(
    new DeterministicSettlementResourceProjectionService(),
  );

  assert.throws(
    () =>
      endpoint.handlePostTick({
        path: { settlementId: "settlement_alpha" },
        body: {
          settlement_id: "settlement_alpha",
          flow_version: "v1",
          tick_started_at: "not-a-date",
          tick_ended_at: "2026-02-25T18:30:00.000Z",
        },
      }),
    (error: unknown) =>
      error instanceof SettlementTickValidationError &&
      error.code === "invalid_tick_started_at",
  );
});
