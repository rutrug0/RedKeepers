import { strict as assert } from "node:assert";
import { test } from "node:test";

import { InMemoryFirstSliceEconomyTickStateRepository } from "../infra/in-memory-first-slice-economy-tick-state-repository";
import { DeterministicSettlementResourceLedgerService } from "./settlement-resource-ledger-service";

test("resource ledger service seeds settlement stock and applies deterministic deltas", () => {
  const repository = new InMemoryFirstSliceEconomyTickStateRepository();
  const service = new DeterministicSettlementResourceLedgerService(repository);

  const first = service.applyResourceDelta({
    settlement_id: "settlement_alpha",
    occurred_at: new Date("2026-02-26T18:00:00.000Z"),
    resource_delta_by_id: {
      food: 120,
      wood: 0,
      stone: 0,
      iron: 0,
    },
  });
  assert.deepEqual(first.resource_delta_by_id, {
    food: 120,
    wood: 0,
    stone: 0,
    iron: 0,
  });
  assert.deepEqual(first.resource_stock_by_id, {
    food: 420,
    wood: 260,
    stone: 220,
    iron: 140,
  });

  const second = service.applyResourceDelta({
    settlement_id: "settlement_alpha",
    occurred_at: new Date("2026-02-26T18:01:00.000Z"),
    resource_delta_by_id: {
      food: -999,
      wood: 15,
      stone: 0,
      iron: 0,
    },
  });
  assert.deepEqual(second.resource_delta_by_id, {
    food: -420,
    wood: 15,
    stone: 0,
    iron: 0,
  });
  assert.deepEqual(second.resource_stock_by_id, {
    food: 0,
    wood: 275,
    stone: 220,
    iron: 140,
  });
});
