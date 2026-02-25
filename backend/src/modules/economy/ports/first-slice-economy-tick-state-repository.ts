import type { Instant } from "../../../shared";
import type { FirstSliceResourceId, SettlementResourceTickReasonCode } from "../application/settlement-resource-projection-service";

export interface FirstSliceEconomyTickState {
  readonly settlement_id: string;
  readonly settlement_name: string;
  readonly tick_started_at: Instant;
  readonly tick_ended_at: Instant;
  readonly duration_ms: number;
  readonly resource_stock_by_id: Readonly<Record<FirstSliceResourceId, number>>;
  readonly resource_delta_by_id: Readonly<Record<FirstSliceResourceId, number>>;
  readonly projection_reason_codes: readonly SettlementResourceTickReasonCode[];
}

export interface FirstSliceEconomyTickStateRepository {
  readLatestTickState(input: {
    readonly settlement_id: string;
  }): FirstSliceEconomyTickState | null;

  saveTickState(state: FirstSliceEconomyTickState): FirstSliceEconomyTickState;
}
