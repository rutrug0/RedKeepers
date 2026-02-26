import { strict as assert } from "node:assert";
import { test } from "node:test";

import { runFirstSliceSettlementLoopTransportSmoke } from "./smoke";

test("first-slice settlement loop transport smoke invokes a wired client-facing route", () => {
  const result = runFirstSliceSettlementLoopTransportSmoke();

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.route, "/settlements/{settlementId}/tick");
  assert.equal(result.value.flow, "settlement.tick_v1");
  assert.equal(result.value.status, "accepted");
  assert.equal(result.value.registered_routes.length >= 4, true);
});
