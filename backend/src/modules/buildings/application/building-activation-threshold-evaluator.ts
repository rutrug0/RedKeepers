export type BuildingActivationThresholdPhase = "reveal" | "unlock";
export type BuildingActivationThresholdKey =
  | "resource_stock_ratio"
  | "resource_stock_ratio_any"
  | "building_level_min";
export type BuildingActivationThresholdOperation = "gte" | "lte" | "eq";

export interface StarterBuildingActivationThresholdDefinition {
  readonly activation_rule_id: string;
  readonly activation_package_id: string;
  readonly building_id: string;
  readonly threshold_phase: BuildingActivationThresholdPhase;
  readonly threshold_key: BuildingActivationThresholdKey;
  readonly scope: string;
  readonly operation: BuildingActivationThresholdOperation;
  readonly value: number;
  readonly value_display_format: string;
  readonly ui_locked_hint: string;
  readonly slice_status?: string;
}

export interface StarterBuildingActivationThresholdsTable {
  readonly rows: readonly StarterBuildingActivationThresholdDefinition[];
}

export interface BuildingActivationThresholdEvaluationInput {
  readonly resource_stock_by_id?: Readonly<Record<string, number | undefined>>;
  readonly resource_storage_cap_by_id?: Readonly<Record<string, number | undefined>>;
  readonly building_level_by_id?: Readonly<Record<string, number | undefined>>;
  readonly resource_groups_by_id?: Readonly<
    Record<string, readonly string[] | undefined>
  >;
}

export interface BuildingActivationThresholdPhaseEvaluation {
  readonly building_id: string;
  readonly threshold_phase: BuildingActivationThresholdPhase;
  readonly is_met: boolean;
  readonly required_rule_ids: readonly string[];
  readonly failed_rule_ids: readonly string[];
}

export interface BuildingActivationThresholdEvaluationResult {
  readonly phase_evaluations: readonly BuildingActivationThresholdPhaseEvaluation[];
}

export interface BuildingActivationThresholdEvaluator {
  evaluate(
    input: BuildingActivationThresholdEvaluationInput,
  ): BuildingActivationThresholdEvaluationResult;
}

const DEFAULT_RESOURCE_GROUPS: Readonly<Record<string, readonly string[]>> = {
  nonfood_core: ["wood", "stone", "iron"],
};

export const createBuildingActivationThresholdEvaluatorFromStarterData = (
  table: StarterBuildingActivationThresholdsTable,
): DeterministicBuildingActivationThresholdEvaluator =>
  new DeterministicBuildingActivationThresholdEvaluator({
    thresholds: table.rows,
  });

export class DeterministicBuildingActivationThresholdEvaluator
  implements BuildingActivationThresholdEvaluator
{
  private readonly thresholds: readonly StarterBuildingActivationThresholdDefinition[];

  constructor(options?: {
    readonly thresholds?: readonly StarterBuildingActivationThresholdDefinition[];
  }) {
    this.thresholds = [...(options?.thresholds ?? [])];
  }

  evaluate(
    input: BuildingActivationThresholdEvaluationInput,
  ): BuildingActivationThresholdEvaluationResult {
    const mergedResourceGroups = mergeResourceGroups(input.resource_groups_by_id);
    const groupedByPhase = new Map<
      string,
      {
        building_id: string;
        threshold_phase: BuildingActivationThresholdPhase;
        rules: StarterBuildingActivationThresholdDefinition[];
      }
    >();

    for (const threshold of this.thresholds) {
      const phaseKey = `${threshold.building_id}::${threshold.threshold_phase}`;
      const group = groupedByPhase.get(phaseKey);
      if (group) {
        group.rules.push(threshold);
        continue;
      }
      groupedByPhase.set(phaseKey, {
        building_id: threshold.building_id,
        threshold_phase: threshold.threshold_phase,
        rules: [threshold],
      });
    }

    const evaluations: BuildingActivationThresholdPhaseEvaluation[] = [];
    const sortedGroups = Array.from(groupedByPhase.values()).sort((left, right) => {
      if (left.building_id === right.building_id) {
        return left.threshold_phase.localeCompare(right.threshold_phase);
      }
      return left.building_id.localeCompare(right.building_id);
    });

    for (const group of sortedGroups) {
      const failedRuleIds: string[] = [];
      const requiredRuleIds: string[] = [];

      for (const rule of group.rules) {
        requiredRuleIds.push(rule.activation_rule_id);
        if (!evaluateRule(rule, input, mergedResourceGroups)) {
          failedRuleIds.push(rule.activation_rule_id);
        }
      }

      evaluations.push({
        building_id: group.building_id,
        threshold_phase: group.threshold_phase,
        is_met: failedRuleIds.length === 0,
        required_rule_ids: requiredRuleIds,
        failed_rule_ids: failedRuleIds,
      });
    }

    return {
      phase_evaluations: evaluations,
    };
  }
}

function evaluateRule(
  rule: StarterBuildingActivationThresholdDefinition,
  input: BuildingActivationThresholdEvaluationInput,
  resourceGroups: Readonly<Record<string, readonly string[]>>,
): boolean {
  if (rule.threshold_key === "resource_stock_ratio") {
    const resourceId = parseScopedReference(rule.scope, "resource");
    if (resourceId === undefined) {
      return false;
    }
    const ratio = computeResourceStockRatio(resourceId, input);
    return compare(rule.operation, ratio, rule.value);
  }

  if (rule.threshold_key === "resource_stock_ratio_any") {
    const groupId = parseScopedReference(rule.scope, "resource_group");
    if (groupId === undefined) {
      return false;
    }

    const resourceIds = resourceGroups[groupId];
    if (resourceIds === undefined || resourceIds.length === 0) {
      return false;
    }

    return resourceIds.some((resourceId) => {
      const ratio = computeResourceStockRatio(resourceId, input);
      return compare(rule.operation, ratio, rule.value);
    });
  }

  if (rule.threshold_key === "building_level_min") {
    const buildingId = parseScopedReference(rule.scope, "building");
    if (buildingId === undefined) {
      return false;
    }
    const level = toNonNegativeInteger(input.building_level_by_id?.[buildingId]);
    return compare(rule.operation, level, rule.value);
  }

  return false;
}

function mergeResourceGroups(
  overrideGroups: Readonly<Record<string, readonly string[] | undefined>> | undefined,
): Readonly<Record<string, readonly string[]>> {
  if (overrideGroups === undefined) {
    return DEFAULT_RESOURCE_GROUPS;
  }

  const merged: Record<string, readonly string[]> = {
    ...DEFAULT_RESOURCE_GROUPS,
  };

  for (const [groupId, value] of Object.entries(overrideGroups)) {
    if (value === undefined) {
      continue;
    }
    merged[groupId] = value;
  }

  return merged;
}

function computeResourceStockRatio(
  resourceId: string,
  input: BuildingActivationThresholdEvaluationInput,
): number {
  const stock = toNonNegativeFinite(input.resource_stock_by_id?.[resourceId]);
  const storageCap = toNonNegativeFinite(input.resource_storage_cap_by_id?.[resourceId]);
  if (storageCap <= 0) {
    return 0;
  }
  return stock / storageCap;
}

function compare(
  operation: BuildingActivationThresholdOperation,
  left: number,
  right: number,
): boolean {
  if (operation === "gte") {
    return left >= right;
  }
  if (operation === "lte") {
    return left <= right;
  }
  if (operation === "eq") {
    return left === right;
  }
  return false;
}

function parseScopedReference(scope: string, expectedPrefix: string): string | undefined {
  const prefix = `${expectedPrefix}:`;
  if (!scope.startsWith(prefix)) {
    return undefined;
  }
  const scopedId = scope.slice(prefix.length);
  if (scopedId.trim().length === 0) {
    return undefined;
  }
  return scopedId;
}

function toNonNegativeFinite(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value;
}

function toNonNegativeInteger(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  const normalized = Math.trunc(value);
  if (normalized <= 0) {
    return 0;
  }
  return normalized;
}
