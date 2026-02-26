import type { Instant } from "../../../shared";
import type { FirstSliceEconomyTickState, FirstSliceEconomyTickStateRepository } from "../ports";
import {
  FIRST_SLICE_RESOURCE_IDS,
  type FirstSliceResourceId,
  type SettlementResourceProjectionService,
  DeterministicSettlementResourceProjectionService,
} from "./settlement-resource-projection-service";

export interface SettlementResourceLedgerDeltaInput {
  readonly settlement_id: string;
  readonly settlement_name?: string;
  readonly occurred_at: Instant;
  readonly resource_delta_by_id: Readonly<Record<string, number | undefined>>;
}

export interface SettlementResourceLedgerSnapshot {
  readonly settlement_id: string;
  readonly settlement_name: string;
  readonly resource_delta_by_id: Readonly<Record<FirstSliceResourceId, number>>;
  readonly resource_stock_by_id: Readonly<Record<FirstSliceResourceId, number>>;
}

export interface SettlementResourceLedgerService {
  applyResourceDelta(input: SettlementResourceLedgerDeltaInput): SettlementResourceLedgerSnapshot;
}

export class DeterministicSettlementResourceLedgerService
  implements SettlementResourceLedgerService
{
  private readonly projectionService: SettlementResourceProjectionService;

  constructor(
    private readonly tickStateRepository: FirstSliceEconomyTickStateRepository,
    options?: {
      readonly projection_service?: SettlementResourceProjectionService;
    },
  ) {
    this.projectionService =
      options?.projection_service ?? new DeterministicSettlementResourceProjectionService();
  }

  applyResourceDelta(input: SettlementResourceLedgerDeltaInput): SettlementResourceLedgerSnapshot {
    const settlementId = normalizeNonEmpty(input.settlement_id, "settlement_unknown");
    const occurredAt = new Date(input.occurred_at.getTime());
    const currentState =
      this.tickStateRepository.readLatestTickState({
        settlement_id: settlementId,
      }) ?? this.seedSettlementState(settlementId, input.settlement_name, occurredAt);

    const resourceDeltaById = normalizeResourceValues(input.resource_delta_by_id);
    const resourceStockById = applyDeltaToStock(
      currentState.resource_stock_by_id,
      resourceDeltaById,
    );
    const appliedDeltaById = computeAppliedDelta(
      currentState.resource_stock_by_id,
      resourceStockById,
    );

    const nextTickStartAt = new Date(currentState.tick_ended_at.getTime());
    const nextTickEndAt = new Date(
      Math.max(
        nextTickStartAt.getTime() + 1,
        occurredAt.getTime(),
      ),
    );
    const savedState = this.tickStateRepository.saveTickState({
      settlement_id: settlementId,
      settlement_name: resolveSettlementName(currentState, input.settlement_name),
      tick_started_at: nextTickStartAt,
      tick_ended_at: nextTickEndAt,
      duration_ms: nextTickEndAt.getTime() - nextTickStartAt.getTime(),
      resource_stock_by_id: resourceStockById,
      resource_delta_by_id: appliedDeltaById,
      projection_reason_codes: [],
    });

    return {
      settlement_id: savedState.settlement_id,
      settlement_name: savedState.settlement_name,
      resource_delta_by_id: { ...savedState.resource_delta_by_id },
      resource_stock_by_id: { ...savedState.resource_stock_by_id },
    };
  }

  private seedSettlementState(
    settlementId: string,
    settlementName: string | undefined,
    occurredAt: Instant,
  ): FirstSliceEconomyTickState {
    const projection = this.projectionService.tickSettlementResources({
      settlement_id: settlementId,
      settlement_name: settlementName,
      tick_started_at: occurredAt,
      tick_ended_at: occurredAt,
    });
    return this.tickStateRepository.saveTickState({
      settlement_id: projection.settlement_id,
      settlement_name: projection.settlement_name,
      tick_started_at: projection.tick_started_at,
      tick_ended_at: projection.tick_ended_at,
      duration_ms: projection.duration_ms,
      resource_stock_by_id: { ...projection.resource_stock_by_id },
      resource_delta_by_id: { ...projection.resource_delta_by_id },
      projection_reason_codes: [...projection.projection_reason_codes],
    });
  }
}

function normalizeNonEmpty(value: string, fallback: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function resolveSettlementName(
  currentState: FirstSliceEconomyTickState,
  overrideSettlementName: string | undefined,
): string {
  if (overrideSettlementName === undefined) {
    return currentState.settlement_name;
  }

  const normalized = overrideSettlementName.trim();
  return normalized.length > 0 ? normalized : currentState.settlement_name;
}

function normalizeResourceValues(
  input: Readonly<Record<string, number | undefined>>,
): Readonly<Record<FirstSliceResourceId, number>> {
  const normalized: Record<FirstSliceResourceId, number> = {
    food: 0,
    wood: 0,
    stone: 0,
    iron: 0,
  };
  for (const resourceId of FIRST_SLICE_RESOURCE_IDS) {
    const value = input[resourceId];
    normalized[resourceId] = toFiniteInteger(value);
  }
  return normalized;
}

function applyDeltaToStock(
  stockById: Readonly<Record<FirstSliceResourceId, number>>,
  deltaById: Readonly<Record<FirstSliceResourceId, number>>,
): Readonly<Record<FirstSliceResourceId, number>> {
  const nextStock: Record<FirstSliceResourceId, number> = {
    food: 0,
    wood: 0,
    stone: 0,
    iron: 0,
  };
  for (const resourceId of FIRST_SLICE_RESOURCE_IDS) {
    nextStock[resourceId] = Math.max(
      0,
      stockById[resourceId] + deltaById[resourceId],
    );
  }
  return nextStock;
}

function computeAppliedDelta(
  previousStockById: Readonly<Record<FirstSliceResourceId, number>>,
  nextStockById: Readonly<Record<FirstSliceResourceId, number>>,
): Readonly<Record<FirstSliceResourceId, number>> {
  const appliedDelta: Record<FirstSliceResourceId, number> = {
    food: 0,
    wood: 0,
    stone: 0,
    iron: 0,
  };
  for (const resourceId of FIRST_SLICE_RESOURCE_IDS) {
    appliedDelta[resourceId] = nextStockById[resourceId] - previousStockById[resourceId];
  }
  return appliedDelta;
}

function toFiniteInteger(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value);
}
