import { err, ok } from "../../shared";
import type { AppError, Result } from "../../shared";
import {
  POST_SETTLEMENT_TICK_ROUTE,
} from "../../modules/economy";
import {
  createDeterministicFirstSliceSettlementLoopLocalRpcTransport,
} from "./local-first-slice-settlement-loop-transport";

export interface FirstSliceSettlementLoopTransportSmokeResult {
  readonly registered_routes: readonly string[];
  readonly route: typeof POST_SETTLEMENT_TICK_ROUTE;
  readonly flow: "settlement.tick_v1";
  readonly status: "accepted";
}

export const runFirstSliceSettlementLoopTransportSmoke = (): Result<
  FirstSliceSettlementLoopTransportSmokeResult,
  AppError
> => {
  const transport = createDeterministicFirstSliceSettlementLoopLocalRpcTransport();
  const response = transport.invoke(POST_SETTLEMENT_TICK_ROUTE, {
    path: {
      settlementId: "settlement_alpha",
    },
    body: {
      settlement_id: "settlement_alpha",
      flow_version: "v1",
      tick_started_at: "2026-02-26T00:00:00.000Z",
      tick_ended_at: "2026-02-26T00:01:00.000Z",
      resource_stock_by_id: {
        food: 100,
        wood: 100,
        stone: 100,
        iron: 100,
      },
      passive_prod_per_h_by_id: {
        food: 60,
        wood: 60,
        stone: 60,
        iron: 60,
      },
      storage_cap_by_id: {
        food: 1000,
        wood: 1000,
        stone: 1000,
        iron: 1000,
      },
    },
  });

  if (response.status_code !== 200) {
    return err({
      code: "first_slice_transport_smoke_transport_failure",
      message: `Expected status_code 200 from '${POST_SETTLEMENT_TICK_ROUTE}', received '${response.status_code}'.`,
      details: {
        response,
      },
    });
  }

  if (response.body.status !== "accepted") {
    return err({
      code: "first_slice_transport_smoke_unexpected_status",
      message: `Expected accepted tick response status, received '${response.body.status}'.`,
      details: {
        response_body: response.body,
      },
    });
  }

  return ok({
    registered_routes: transport.getRegisteredRoutes(),
    route: POST_SETTLEMENT_TICK_ROUTE,
    flow: response.body.flow,
    status: response.body.status,
  });
};
