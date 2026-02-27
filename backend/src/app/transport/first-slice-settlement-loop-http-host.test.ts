import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE,
} from "../../modules/buildings/api/settlement-building-upgrade-endpoint.ts";
import {
  POST_WORLD_MAP_SETTLEMENT_ATTACK_ROUTE,
} from "../../modules/world_map/api/world-map-settlement-attack-endpoint.ts";
import {
  startDeterministicFirstSliceSettlementLoopHttpHost,
} from "./first-slice-settlement-loop-http-host.ts";

test("deterministic first-slice HTTP host serves settlement and hostile map actions over transport routes", async () => {
  const host = await startDeterministicFirstSliceSettlementLoopHttpHost({
    host: "127.0.0.1",
    port: 0,
  });

  try {
    assert.equal(host.route_templates.includes(POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE), true);
    assert.equal(host.route_templates.includes(POST_WORLD_MAP_SETTLEMENT_ATTACK_ROUTE), true);

    const settlementResponse = await postJson(
      host.base_url,
      "/settlements/settlement_alpha/buildings/grain_plot/upgrade",
      {
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
    );

    assert.equal(settlementResponse.status_code, 200);
    assert.equal(isRecord(settlementResponse.body), true);
    if (isRecord(settlementResponse.body)) {
      assert.equal(settlementResponse.body.status, "failed");
      assert.equal(settlementResponse.body.error_code, "insufficient_resources");
    }

    const hostileResponse = await postJson(
      host.base_url,
      "/world-map/settlements/settlement_hostile/attack",
      {
        flow_version: "v1",
        march_id: "march_attack_blocked_http",
        source_settlement_id: "settlement_alpha",
        target_settlement_id: "settlement_hostile",
        origin: {
          x: 0,
          y: 2,
        },
        target: {
          x: 4,
          y: 2,
        },
        defender_garrison_strength: 40,
        dispatched_units: [
          {
            unit_id: "watch_levy",
            unit_count: 10,
            unit_attack: 5,
          },
        ],
      },
    );

    assert.equal(hostileResponse.status_code, 200);
    assert.equal(isRecord(hostileResponse.body), true);
    if (isRecord(hostileResponse.body)) {
      assert.equal(hostileResponse.body.status, "failed");
      assert.equal(hostileResponse.body.error_code, "path_blocked_impassable");
    }
  } finally {
    await host.stop();
  }
});

async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<{
  readonly status_code: number;
  readonly body: unknown;
}> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let parsedBody: unknown = {};
  try {
    parsedBody = await response.json();
  } catch {
    parsedBody = {};
  }

  return {
    status_code: response.status,
    body: parsedBody,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
