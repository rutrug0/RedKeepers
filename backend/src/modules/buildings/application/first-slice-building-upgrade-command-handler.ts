import type { IntegrationEvent, Instant } from "../../../shared";

export const FIRST_SLICE_BUILDING_IDS = ["grain_plot"] as const;
export type FirstSliceBuildingId = (typeof FIRST_SLICE_BUILDING_IDS)[number];

export const FIRST_SLICE_RESOURCE_IDS = ["food", "wood", "stone", "iron"] as const;
export type FirstSliceResourceId = (typeof FIRST_SLICE_RESOURCE_IDS)[number];

export const BUILDING_UPGRADE_COMMAND_ACCEPTED_EVENT_TYPE =
  "Buildings.UpgradeCommandAccepted" as const;

export interface StarterBuildingLineDefinition {
  readonly building_id: string;
  readonly display_name: string;
  readonly max_level_v1: number;
  readonly build_time_l1_s: number;
  readonly build_time_mult_per_level: number;
  readonly cost_food_l1: number;
  readonly cost_wood_l1: number;
  readonly cost_stone_l1: number;
  readonly cost_iron_l1: number;
  readonly cost_mult_per_level: number;
  readonly slice_status?: string;
}

export interface StarterBuildingLinesTable {
  readonly entries_by_id: Readonly<Record<string, StarterBuildingLineDefinition>>;
}

type FirstSliceResourceValues = Readonly<Record<FirstSliceResourceId, number>>;

export interface FirstSliceBuildingUpgradeCommandInput {
  readonly settlement_id: string;
  readonly settlement_name?: string;
  readonly building_id: string;
  readonly current_level: number;
  readonly requested_at: Instant;
  readonly resource_stock?: Readonly<Record<string, number | undefined>>;
  readonly cooldown_ends_at?: Instant;
  readonly active_upgrade_ends_at?: Instant;
  readonly correlation_id?: string;
}

export type FirstSliceBuildingUpgradeFailureCode =
  | "insufficient_resources"
  | "cooldown"
  | "invalid_state";

export type FirstSliceBuildingUpgradeInvalidReason =
  | "building_not_supported"
  | "current_level_invalid"
  | "max_level_reached"
  | "upgrade_already_in_progress";

interface FirstSliceBuildingUpgradeFailureResultBase {
  readonly schema_version: "rk-v1-building-upgrade-command-result";
  readonly status: "failed";
  readonly failure_code: FirstSliceBuildingUpgradeFailureCode;
  readonly settlement_id: string;
  readonly building_id: string;
}

export interface FirstSliceBuildingUpgradeInsufficientResourcesFailureResult
  extends FirstSliceBuildingUpgradeFailureResultBase
{
  readonly failure_code: "insufficient_resources";
  readonly required_cost_by_id: FirstSliceResourceValues;
  readonly available_stock_by_id: FirstSliceResourceValues;
  readonly missing_resources_by_id: FirstSliceResourceValues;
}

export interface FirstSliceBuildingUpgradeCooldownFailureResult
  extends FirstSliceBuildingUpgradeFailureResultBase
{
  readonly failure_code: "cooldown";
  readonly cooldown_ends_at: Instant;
  readonly cooldown_remaining_ms: number;
}

export interface FirstSliceBuildingUpgradeInvalidStateFailureResult
  extends FirstSliceBuildingUpgradeFailureResultBase
{
  readonly failure_code: "invalid_state";
  readonly invalid_reason: FirstSliceBuildingUpgradeInvalidReason;
}

export type FirstSliceBuildingUpgradeFailureResult =
  | FirstSliceBuildingUpgradeInsufficientResourcesFailureResult
  | FirstSliceBuildingUpgradeCooldownFailureResult
  | FirstSliceBuildingUpgradeInvalidStateFailureResult;

export interface FirstSliceBuildingUpgradePlaceholderEventPayload {
  readonly schema_version: "rk-v1-building-upgrade-command-event";
  readonly event_key: "event.buildings.upgrade_started";
  readonly settlement_id: string;
  readonly settlement_name: string;
  readonly building_id: FirstSliceBuildingId;
  readonly building_label: string;
  readonly from_level: number;
  readonly to_level: number;
  readonly upgrade_ends_at_iso: string;
  readonly resource_cost_by_id: FirstSliceResourceValues;
}

export interface FirstSliceBuildingUpgradeAcceptedResult {
  readonly schema_version: "rk-v1-building-upgrade-command-result";
  readonly status: "accepted";
  readonly settlement_id: string;
  readonly settlement_name: string;
  readonly building_id: FirstSliceBuildingId;
  readonly building_label: string;
  readonly from_level: number;
  readonly to_level: number;
  readonly upgrade_duration_s: number;
  readonly upgrade_ends_at: Instant;
  readonly resource_cost_by_id: FirstSliceResourceValues;
  readonly resource_stock_after_by_id: FirstSliceResourceValues;
  readonly placeholder_events: readonly IntegrationEvent<FirstSliceBuildingUpgradePlaceholderEventPayload>[];
}

export type FirstSliceBuildingUpgradeCommandResult =
  | FirstSliceBuildingUpgradeAcceptedResult
  | FirstSliceBuildingUpgradeFailureResult;

export interface FirstSliceBuildingUpgradeCommandHandler {
  handleUpgradeCommand(
    input: FirstSliceBuildingUpgradeCommandInput,
  ): FirstSliceBuildingUpgradeCommandResult;
}

interface NormalizedBuildingLineDefinition {
  readonly building_id: FirstSliceBuildingId;
  readonly display_name: string;
  readonly max_level_v1: number;
  readonly build_time_l1_s: number;
  readonly build_time_mult_per_level: number;
  readonly cost_food_l1: number;
  readonly cost_wood_l1: number;
  readonly cost_stone_l1: number;
  readonly cost_iron_l1: number;
  readonly cost_mult_per_level: number;
}

const DEFAULT_FIRST_SLICE_BUILDING_LINES: Readonly<
  Record<FirstSliceBuildingId, NormalizedBuildingLineDefinition>
> = {
  grain_plot: {
    building_id: "grain_plot",
    display_name: "Grain Plot",
    max_level_v1: 10,
    build_time_l1_s: 90,
    build_time_mult_per_level: 1.45,
    cost_food_l1: 40,
    cost_wood_l1: 60,
    cost_stone_l1: 20,
    cost_iron_l1: 0,
    cost_mult_per_level: 1.55,
  },
};

export const createFirstSliceBuildingUpgradeCommandHandlerFromStarterData = (
  buildingLinesTable: StarterBuildingLinesTable,
  options?: {
    readonly default_settlement_name?: string;
  },
): DeterministicFirstSliceBuildingUpgradeCommandHandler => {
  const playableDefinitions: Record<string, StarterBuildingLineDefinition> = {};
  for (const buildingId of FIRST_SLICE_BUILDING_IDS) {
    const definition = buildingLinesTable.entries_by_id[buildingId];
    if (definition?.slice_status === "playable_now") {
      playableDefinitions[buildingId] = definition;
    }
  }

  return new DeterministicFirstSliceBuildingUpgradeCommandHandler({
    building_lines_by_id: playableDefinitions,
    default_settlement_name: options?.default_settlement_name,
  });
};

export class DeterministicFirstSliceBuildingUpgradeCommandHandler
  implements FirstSliceBuildingUpgradeCommandHandler
{
  private readonly buildingLines: Readonly<
    Record<FirstSliceBuildingId, NormalizedBuildingLineDefinition>
  >;

  private readonly defaultSettlementName: string;

  constructor(options?: {
    readonly building_lines_by_id?: Readonly<Record<string, StarterBuildingLineDefinition>>;
    readonly default_settlement_name?: string;
  }) {
    const normalized: Record<FirstSliceBuildingId, NormalizedBuildingLineDefinition> = {
      ...DEFAULT_FIRST_SLICE_BUILDING_LINES,
    };

    for (const buildingId of FIRST_SLICE_BUILDING_IDS) {
      const supplied = options?.building_lines_by_id?.[buildingId];
      if (
        supplied === undefined ||
        (supplied.slice_status !== undefined && supplied.slice_status !== "playable_now")
      ) {
        continue;
      }

      normalized[buildingId] = {
        building_id: buildingId,
        display_name: supplied.display_name.trim() || normalized[buildingId].display_name,
        max_level_v1: clampMinimumInteger(
          supplied.max_level_v1,
          normalized[buildingId].max_level_v1,
          1,
        ),
        build_time_l1_s: clampMinimumInteger(
          supplied.build_time_l1_s,
          normalized[buildingId].build_time_l1_s,
          1,
        ),
        build_time_mult_per_level: clampMinimumNumber(
          supplied.build_time_mult_per_level,
          normalized[buildingId].build_time_mult_per_level,
          0.01,
        ),
        cost_food_l1: clampMinimumInteger(
          supplied.cost_food_l1,
          normalized[buildingId].cost_food_l1,
          0,
        ),
        cost_wood_l1: clampMinimumInteger(
          supplied.cost_wood_l1,
          normalized[buildingId].cost_wood_l1,
          0,
        ),
        cost_stone_l1: clampMinimumInteger(
          supplied.cost_stone_l1,
          normalized[buildingId].cost_stone_l1,
          0,
        ),
        cost_iron_l1: clampMinimumInteger(
          supplied.cost_iron_l1,
          normalized[buildingId].cost_iron_l1,
          0,
        ),
        cost_mult_per_level: clampMinimumNumber(
          supplied.cost_mult_per_level,
          normalized[buildingId].cost_mult_per_level,
          0.01,
        ),
      };
    }

    this.buildingLines = normalized;
    this.defaultSettlementName = options?.default_settlement_name ?? "Starter Settlement";
  }

  handleUpgradeCommand(
    input: FirstSliceBuildingUpgradeCommandInput,
  ): FirstSliceBuildingUpgradeCommandResult {
    const requestedAtMs = input.requested_at.getTime();

    if (
      input.cooldown_ends_at !== undefined &&
      input.cooldown_ends_at.getTime() > requestedAtMs
    ) {
      return {
        schema_version: "rk-v1-building-upgrade-command-result",
        status: "failed",
        failure_code: "cooldown",
        settlement_id: input.settlement_id,
        building_id: input.building_id,
        cooldown_ends_at: input.cooldown_ends_at,
        cooldown_remaining_ms: input.cooldown_ends_at.getTime() - requestedAtMs,
      };
    }

    const definition = this.buildingLines[input.building_id as FirstSliceBuildingId];
    if (definition === undefined) {
      return createInvalidStateFailure(input, "building_not_supported");
    }

    const fromLevel = toNonNegativeInteger(input.current_level);
    if (fromLevel === undefined) {
      return createInvalidStateFailure(input, "current_level_invalid");
    }

    if (
      input.active_upgrade_ends_at !== undefined &&
      input.active_upgrade_ends_at.getTime() > requestedAtMs
    ) {
      return createInvalidStateFailure(input, "upgrade_already_in_progress");
    }

    if (fromLevel >= definition.max_level_v1) {
      return createInvalidStateFailure(input, "max_level_reached");
    }

    const resourceCostById = computeScaledResourceCost(definition, fromLevel);
    const resourceStockById = toResourceValues(input.resource_stock);
    const missingResourcesById = computeMissingResources(
      resourceStockById,
      resourceCostById,
    );
    if (hasAnyMissingResource(missingResourcesById)) {
      return {
        schema_version: "rk-v1-building-upgrade-command-result",
        status: "failed",
        failure_code: "insufficient_resources",
        settlement_id: input.settlement_id,
        building_id: input.building_id,
        required_cost_by_id: resourceCostById,
        available_stock_by_id: resourceStockById,
        missing_resources_by_id: missingResourcesById,
      };
    }

    const resourceStockAfterById = subtractResourceValues(
      resourceStockById,
      resourceCostById,
    );
    const toLevel = fromLevel + 1;
    const upgradeDurationS = computeScaledDurationSeconds(definition, fromLevel);
    const upgradeEndsAt = new Date(requestedAtMs + upgradeDurationS * 1000);
    const settlementName = input.settlement_name ?? this.defaultSettlementName;

    const placeholderEvent: IntegrationEvent<FirstSliceBuildingUpgradePlaceholderEventPayload> = {
      type: BUILDING_UPGRADE_COMMAND_ACCEPTED_EVENT_TYPE,
      occurredAt: input.requested_at,
      correlationId: input.correlation_id,
      payload: {
        schema_version: "rk-v1-building-upgrade-command-event",
        event_key: "event.buildings.upgrade_started",
        settlement_id: input.settlement_id,
        settlement_name: settlementName,
        building_id: definition.building_id,
        building_label: definition.display_name,
        from_level: fromLevel,
        to_level: toLevel,
        upgrade_ends_at_iso: upgradeEndsAt.toISOString(),
        resource_cost_by_id: resourceCostById,
      },
    };

    return {
      schema_version: "rk-v1-building-upgrade-command-result",
      status: "accepted",
      settlement_id: input.settlement_id,
      settlement_name: settlementName,
      building_id: definition.building_id,
      building_label: definition.display_name,
      from_level: fromLevel,
      to_level: toLevel,
      upgrade_duration_s: upgradeDurationS,
      upgrade_ends_at: upgradeEndsAt,
      resource_cost_by_id: resourceCostById,
      resource_stock_after_by_id: resourceStockAfterById,
      placeholder_events: [placeholderEvent],
    };
  }
}

function createInvalidStateFailure(
  input: FirstSliceBuildingUpgradeCommandInput,
  invalidReason: FirstSliceBuildingUpgradeInvalidReason,
): FirstSliceBuildingUpgradeInvalidStateFailureResult {
  return {
    schema_version: "rk-v1-building-upgrade-command-result",
    status: "failed",
    failure_code: "invalid_state",
    settlement_id: input.settlement_id,
    building_id: input.building_id,
    invalid_reason: invalidReason,
  };
}

function computeScaledResourceCost(
  definition: NormalizedBuildingLineDefinition,
  fromLevel: number,
): FirstSliceResourceValues {
  return {
    food: computeScaledLevelValue(definition.cost_food_l1, definition.cost_mult_per_level, fromLevel),
    wood: computeScaledLevelValue(definition.cost_wood_l1, definition.cost_mult_per_level, fromLevel),
    stone: computeScaledLevelValue(
      definition.cost_stone_l1,
      definition.cost_mult_per_level,
      fromLevel,
    ),
    iron: computeScaledLevelValue(definition.cost_iron_l1, definition.cost_mult_per_level, fromLevel),
  };
}

function computeScaledDurationSeconds(
  definition: NormalizedBuildingLineDefinition,
  fromLevel: number,
): number {
  return computeScaledLevelValue(
    definition.build_time_l1_s,
    definition.build_time_mult_per_level,
    fromLevel,
    1,
  );
}

function computeScaledLevelValue(
  levelOneValue: number,
  multiplier: number,
  fromLevel: number,
  minimumValue = 0,
): number {
  if (!Number.isFinite(levelOneValue) || !Number.isFinite(multiplier)) {
    return minimumValue;
  }

  const scaled = Math.ceil(levelOneValue * Math.pow(multiplier, fromLevel));
  if (!Number.isFinite(scaled)) {
    return minimumValue;
  }
  return Math.max(minimumValue, scaled);
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

function toNonNegativeFinite(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  return value;
}

function toNonNegativeInteger(value: number): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.trunc(value);
  if (normalized < 0) {
    return undefined;
  }
  return normalized;
}

function clampMinimumNumber(value: number, fallback: number, minimum: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, value);
}

function clampMinimumInteger(value: number, fallback: number, minimum: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.trunc(value));
}
