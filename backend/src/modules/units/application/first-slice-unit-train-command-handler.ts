import type { IntegrationEvent, Instant } from "../../../shared";

export const FIRST_SLICE_UNIT_IDS = ["watch_levy"] as const;
export type FirstSliceUnitId = (typeof FIRST_SLICE_UNIT_IDS)[number];

export const FIRST_SLICE_RESOURCE_IDS = ["food", "wood", "stone", "iron"] as const;
export type FirstSliceResourceId = (typeof FIRST_SLICE_RESOURCE_IDS)[number];

export const UNIT_TRAIN_COMMAND_ACCEPTED_EVENT_TYPE =
  "Units.TrainCommandAccepted" as const;

export interface StarterUnitLineDefinition {
  readonly unit_id: string;
  readonly display_name: string;
  readonly train_building_id: string;
  readonly train_time_s: number;
  readonly cost_food: number;
  readonly cost_wood: number;
  readonly cost_stone: number;
  readonly cost_iron: number;
  readonly slice_status?: string;
}

export interface StarterUnitLinesTable {
  readonly entries_by_id: Readonly<Record<string, StarterUnitLineDefinition>>;
}

type FirstSliceResourceValues = Readonly<Record<FirstSliceResourceId, number>>;

export interface FirstSliceUnitTrainCommandInput {
  readonly settlement_id: string;
  readonly settlement_name?: string;
  readonly unit_id: string;
  readonly quantity: number;
  readonly requested_at: Instant;
  readonly resource_stock?: Readonly<Record<string, number | undefined>>;
  readonly barracks_level: number;
  readonly queue_available_at?: Instant;
  readonly training_time_multiplier?: number;
  readonly correlation_id?: string;
}

export type FirstSliceUnitTrainFailureCode =
  | "insufficient_resources"
  | "cooldown"
  | "invalid_state";

export type FirstSliceUnitTrainInvalidReason =
  | "unit_not_supported"
  | "quantity_invalid"
  | "barracks_not_ready";

interface FirstSliceUnitTrainFailureResultBase {
  readonly schema_version: "rk-v1-unit-train-command-result";
  readonly status: "failed";
  readonly failure_code: FirstSliceUnitTrainFailureCode;
  readonly settlement_id: string;
  readonly unit_id: string;
}

export interface FirstSliceUnitTrainInsufficientResourcesFailureResult
  extends FirstSliceUnitTrainFailureResultBase
{
  readonly failure_code: "insufficient_resources";
  readonly quantity: number;
  readonly required_cost_by_id: FirstSliceResourceValues;
  readonly available_stock_by_id: FirstSliceResourceValues;
  readonly missing_resources_by_id: FirstSliceResourceValues;
}

export interface FirstSliceUnitTrainCooldownFailureResult
  extends FirstSliceUnitTrainFailureResultBase
{
  readonly failure_code: "cooldown";
  readonly queue_available_at: Instant;
  readonly cooldown_remaining_ms: number;
}

export interface FirstSliceUnitTrainInvalidStateFailureResult
  extends FirstSliceUnitTrainFailureResultBase
{
  readonly failure_code: "invalid_state";
  readonly invalid_reason: FirstSliceUnitTrainInvalidReason;
}

export type FirstSliceUnitTrainFailureResult =
  | FirstSliceUnitTrainInsufficientResourcesFailureResult
  | FirstSliceUnitTrainCooldownFailureResult
  | FirstSliceUnitTrainInvalidStateFailureResult;

export interface FirstSliceUnitTrainPlaceholderEventPayload {
  readonly schema_version: "rk-v1-unit-train-command-event";
  readonly event_key: "event.units.training_started";
  readonly settlement_id: string;
  readonly settlement_name: string;
  readonly unit_id: FirstSliceUnitId;
  readonly unit_label: string;
  readonly quantity: number;
  readonly training_complete_at_iso: string;
  readonly resource_cost_by_id: FirstSliceResourceValues;
}

export interface FirstSliceUnitTrainAcceptedResult {
  readonly schema_version: "rk-v1-unit-train-command-result";
  readonly status: "accepted";
  readonly settlement_id: string;
  readonly settlement_name: string;
  readonly unit_id: FirstSliceUnitId;
  readonly unit_label: string;
  readonly quantity: number;
  readonly training_duration_s: number;
  readonly training_complete_at: Instant;
  readonly resource_cost_by_id: FirstSliceResourceValues;
  readonly resource_stock_after_by_id: FirstSliceResourceValues;
  readonly placeholder_events: readonly IntegrationEvent<FirstSliceUnitTrainPlaceholderEventPayload>[];
}

export type FirstSliceUnitTrainCommandResult =
  | FirstSliceUnitTrainAcceptedResult
  | FirstSliceUnitTrainFailureResult;

export interface FirstSliceUnitTrainCommandHandler {
  handleTrainCommand(input: FirstSliceUnitTrainCommandInput): FirstSliceUnitTrainCommandResult;
}

interface NormalizedUnitLineDefinition {
  readonly unit_id: FirstSliceUnitId;
  readonly display_name: string;
  readonly train_building_id: string;
  readonly train_time_s: number;
  readonly cost_food: number;
  readonly cost_wood: number;
  readonly cost_stone: number;
  readonly cost_iron: number;
}

const DEFAULT_FIRST_SLICE_UNIT_LINES: Readonly<
  Record<FirstSliceUnitId, NormalizedUnitLineDefinition>
> = {
  watch_levy: {
    unit_id: "watch_levy",
    display_name: "Watch Levy",
    train_building_id: "barracks",
    train_time_s: 45,
    cost_food: 35,
    cost_wood: 20,
    cost_stone: 10,
    cost_iron: 0,
  },
};

export const createFirstSliceUnitTrainCommandHandlerFromStarterData = (
  unitLinesTable: StarterUnitLinesTable,
  options?: {
    readonly default_settlement_name?: string;
  },
): DeterministicFirstSliceUnitTrainCommandHandler => {
  const playableDefinitions: Record<string, StarterUnitLineDefinition> = {};
  for (const unitId of FIRST_SLICE_UNIT_IDS) {
    const definition = unitLinesTable.entries_by_id[unitId];
    if (definition?.slice_status === "playable_now") {
      playableDefinitions[unitId] = definition;
    }
  }

  return new DeterministicFirstSliceUnitTrainCommandHandler({
    unit_lines_by_id: playableDefinitions,
    default_settlement_name: options?.default_settlement_name,
  });
};

export class DeterministicFirstSliceUnitTrainCommandHandler
  implements FirstSliceUnitTrainCommandHandler
{
  private readonly unitLines: Readonly<Record<FirstSliceUnitId, NormalizedUnitLineDefinition>>;

  private readonly defaultSettlementName: string;

  constructor(options?: {
    readonly unit_lines_by_id?: Readonly<Record<string, StarterUnitLineDefinition>>;
    readonly default_settlement_name?: string;
  }) {
    const normalized: Record<FirstSliceUnitId, NormalizedUnitLineDefinition> = {
      ...DEFAULT_FIRST_SLICE_UNIT_LINES,
    };

    for (const unitId of FIRST_SLICE_UNIT_IDS) {
      const supplied = options?.unit_lines_by_id?.[unitId];
      if (
        supplied === undefined ||
        (supplied.slice_status !== undefined && supplied.slice_status !== "playable_now")
      ) {
        continue;
      }

      normalized[unitId] = {
        unit_id: unitId,
        display_name: supplied.display_name.trim() || normalized[unitId].display_name,
        train_building_id:
          supplied.train_building_id.trim() || normalized[unitId].train_building_id,
        train_time_s: clampMinimumInteger(supplied.train_time_s, normalized[unitId].train_time_s, 1),
        cost_food: clampMinimumInteger(supplied.cost_food, normalized[unitId].cost_food, 0),
        cost_wood: clampMinimumInteger(supplied.cost_wood, normalized[unitId].cost_wood, 0),
        cost_stone: clampMinimumInteger(supplied.cost_stone, normalized[unitId].cost_stone, 0),
        cost_iron: clampMinimumInteger(supplied.cost_iron, normalized[unitId].cost_iron, 0),
      };
    }

    this.unitLines = normalized;
    this.defaultSettlementName = options?.default_settlement_name ?? "Starter Settlement";
  }

  handleTrainCommand(input: FirstSliceUnitTrainCommandInput): FirstSliceUnitTrainCommandResult {
    const requestedAtMs = input.requested_at.getTime();
    if (
      input.queue_available_at !== undefined &&
      input.queue_available_at.getTime() > requestedAtMs
    ) {
      return {
        schema_version: "rk-v1-unit-train-command-result",
        status: "failed",
        failure_code: "cooldown",
        settlement_id: input.settlement_id,
        unit_id: input.unit_id,
        queue_available_at: input.queue_available_at,
        cooldown_remaining_ms: input.queue_available_at.getTime() - requestedAtMs,
      };
    }

    const definition = this.unitLines[input.unit_id as FirstSliceUnitId];
    if (definition === undefined) {
      return createInvalidStateFailure(input, "unit_not_supported");
    }

    const quantity = toPositiveInteger(input.quantity);
    if (quantity === undefined) {
      return createInvalidStateFailure(input, "quantity_invalid");
    }

    if (!Number.isFinite(input.barracks_level) || input.barracks_level < 1) {
      return createInvalidStateFailure(input, "barracks_not_ready");
    }

    const resourceStockById = toResourceValues(input.resource_stock);
    const requiredCostById = scaleResourceCost(definition, quantity);
    const missingResourcesById = computeMissingResources(
      resourceStockById,
      requiredCostById,
    );
    if (hasAnyMissingResource(missingResourcesById)) {
      return {
        schema_version: "rk-v1-unit-train-command-result",
        status: "failed",
        failure_code: "insufficient_resources",
        settlement_id: input.settlement_id,
        unit_id: input.unit_id,
        quantity,
        required_cost_by_id: requiredCostById,
        available_stock_by_id: resourceStockById,
        missing_resources_by_id: missingResourcesById,
      };
    }

    const resourceStockAfterById = subtractResourceValues(
      resourceStockById,
      requiredCostById,
    );
    const durationSeconds = computeTrainingDurationSeconds(
      definition.train_time_s,
      quantity,
      input.training_time_multiplier,
    );
    const trainingCompleteAt = new Date(requestedAtMs + durationSeconds * 1000);
    const settlementName = input.settlement_name ?? this.defaultSettlementName;

    const placeholderEvent: IntegrationEvent<FirstSliceUnitTrainPlaceholderEventPayload> = {
      type: UNIT_TRAIN_COMMAND_ACCEPTED_EVENT_TYPE,
      occurredAt: input.requested_at,
      correlationId: input.correlation_id,
      payload: {
        schema_version: "rk-v1-unit-train-command-event",
        event_key: "event.units.training_started",
        settlement_id: input.settlement_id,
        settlement_name: settlementName,
        unit_id: definition.unit_id,
        unit_label: definition.display_name,
        quantity,
        training_complete_at_iso: trainingCompleteAt.toISOString(),
        resource_cost_by_id: requiredCostById,
      },
    };

    return {
      schema_version: "rk-v1-unit-train-command-result",
      status: "accepted",
      settlement_id: input.settlement_id,
      settlement_name: settlementName,
      unit_id: definition.unit_id,
      unit_label: definition.display_name,
      quantity,
      training_duration_s: durationSeconds,
      training_complete_at: trainingCompleteAt,
      resource_cost_by_id: requiredCostById,
      resource_stock_after_by_id: resourceStockAfterById,
      placeholder_events: [placeholderEvent],
    };
  }
}

function createInvalidStateFailure(
  input: FirstSliceUnitTrainCommandInput,
  invalidReason: FirstSliceUnitTrainInvalidReason,
): FirstSliceUnitTrainInvalidStateFailureResult {
  return {
    schema_version: "rk-v1-unit-train-command-result",
    status: "failed",
    failure_code: "invalid_state",
    settlement_id: input.settlement_id,
    unit_id: input.unit_id,
    invalid_reason: invalidReason,
  };
}

function scaleResourceCost(
  definition: NormalizedUnitLineDefinition,
  quantity: number,
): FirstSliceResourceValues {
  return {
    food: definition.cost_food * quantity,
    wood: definition.cost_wood * quantity,
    stone: definition.cost_stone * quantity,
    iron: definition.cost_iron * quantity,
  };
}

function computeTrainingDurationSeconds(
  baseTrainTimeSeconds: number,
  quantity: number,
  multiplier: number | undefined,
): number {
  const normalizedMultiplier =
    multiplier !== undefined && Number.isFinite(multiplier) && multiplier > 0
      ? multiplier
      : 1;
  return Math.max(1, Math.ceil(baseTrainTimeSeconds * quantity * normalizedMultiplier));
}

function toResourceValues(
  values: Readonly<Record<string, number | undefined>> | undefined,
): FirstSliceResourceValues {
  const normalized: Record<FirstSliceResourceId, number> = {
    food: 0,
    wood: 0,
    stone: 0,
    iron: 0,
  };
  for (const resourceId of FIRST_SLICE_RESOURCE_IDS) {
    const raw = values?.[resourceId];
    normalized[resourceId] = toNonNegativeFinite(raw);
  }
  return normalized;
}

function computeMissingResources(
  available: FirstSliceResourceValues,
  required: FirstSliceResourceValues,
): FirstSliceResourceValues {
  return {
    food: Math.max(0, required.food - available.food),
    wood: Math.max(0, required.wood - available.wood),
    stone: Math.max(0, required.stone - available.stone),
    iron: Math.max(0, required.iron - available.iron),
  };
}

function subtractResourceValues(
  left: FirstSliceResourceValues,
  right: FirstSliceResourceValues,
): FirstSliceResourceValues {
  return {
    food: Math.max(0, left.food - right.food),
    wood: Math.max(0, left.wood - right.wood),
    stone: Math.max(0, left.stone - right.stone),
    iron: Math.max(0, left.iron - right.iron),
  };
}

function hasAnyMissingResource(missing: FirstSliceResourceValues): boolean {
  return (
    missing.food > 0 ||
    missing.wood > 0 ||
    missing.stone > 0 ||
    missing.iron > 0
  );
}

function toPositiveInteger(value: number): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.trunc(value);
  if (normalized < 1) {
    return undefined;
  }
  return normalized;
}

function toNonNegativeFinite(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  return value;
}

function clampMinimumInteger(value: number, fallback: number, minimum: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.trunc(value));
}
