import type {
  FirstSliceEconomyTickState,
  FirstSliceEconomyTickStateRepository,
} from "../ports";

export class InMemoryFirstSliceEconomyTickStateRepository
  implements FirstSliceEconomyTickStateRepository
{
  private readonly tickStatesBySettlementId = new Map<string, FirstSliceEconomyTickState>();

  readLatestTickState(input: {
    readonly settlement_id: string;
  }): FirstSliceEconomyTickState | null {
    const settlementId = input.settlement_id.trim();
    const savedState = this.tickStatesBySettlementId.get(settlementId);
    if (savedState === undefined) {
      return null;
    }

    return cloneFirstSliceEconomyTickState(savedState);
  }

  saveTickState(state: FirstSliceEconomyTickState): FirstSliceEconomyTickState {
    const normalized = normalizeEconomyTickState(state);
    this.tickStatesBySettlementId.set(normalized.settlement_id, normalized);
    return cloneFirstSliceEconomyTickState(normalized);
  }
}

function normalizeEconomyTickState(
  state: FirstSliceEconomyTickState,
): FirstSliceEconomyTickState {
  const normalizedSettlementId = state.settlement_id.trim();
  const normalizedSettlementName = state.settlement_name.trim();

  return {
    ...state,
    settlement_id: normalizedSettlementId,
    settlement_name: normalizedSettlementName,
    tick_started_at: new Date(state.tick_started_at.getTime()),
    tick_ended_at: new Date(state.tick_ended_at.getTime()),
    resource_stock_by_id: { ...state.resource_stock_by_id },
    resource_delta_by_id: { ...state.resource_delta_by_id },
    projection_reason_codes: [...state.projection_reason_codes],
  };
}

function cloneFirstSliceEconomyTickState(
  state: FirstSliceEconomyTickState,
): FirstSliceEconomyTickState {
  return {
    ...state,
    tick_started_at: new Date(state.tick_started_at.getTime()),
    tick_ended_at: new Date(state.tick_ended_at.getTime()),
    resource_stock_by_id: { ...state.resource_stock_by_id },
    resource_delta_by_id: { ...state.resource_delta_by_id },
    projection_reason_codes: [...state.projection_reason_codes],
  };
}
