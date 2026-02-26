import type { SharedActionModifierAggregationService } from "../../heroes/application";
import type { HeroAssignmentBoundContextType } from "../../heroes/ports";

export interface CombatActionResolutionInput {
  readonly player_id: string;
  readonly assignment_context_type: HeroAssignmentBoundContextType;
  readonly assignment_context_id: string;
  readonly resolved_at: Date;
  readonly trigger_window?: string;
  readonly base_stats?: Readonly<Record<string, number>>;
}

export interface CombatActionResolutionResult {
  readonly resolved_stats: Readonly<Record<string, number>>;
  readonly resolved_attack_power: number;
  readonly resolved_defense_power: number;
  readonly modifier_lifecycle_status: "applied" | "conflict";
  readonly lifecycle_updated_modifier_instance_ids: readonly string[];
  readonly modifier_lifecycle_conflict_code?: string;
}

export class DeterministicCombatActionResolver {
  constructor(
    private readonly actionModifierAggregation: SharedActionModifierAggregationService,
  ) {}

  resolveCombatAction(input: CombatActionResolutionInput): CombatActionResolutionResult {
    const baseStats = normalizeBaseStats(input.base_stats);
    const resolution = this.actionModifierAggregation.resolveNumericStats({
      player_id: input.player_id,
      domain: "combat",
      trigger_window: normalizeTriggerWindow(input.trigger_window),
      assignment_context_type: input.assignment_context_type,
      assignment_context_id: input.assignment_context_id,
      now: input.resolved_at,
      base_stats: baseStats,
    });

    const lifecycleResult = this.actionModifierAggregation.applyPostResolutionLifecycle({
      player_id: input.player_id,
      now: input.resolved_at,
      lifecycle_candidates: resolution.lifecycle_candidates,
    });

    return {
      resolved_stats: resolution.resolved_stats,
      resolved_attack_power: toResolvedStat(resolution.resolved_stats.attack_power),
      resolved_defense_power: toResolvedStat(resolution.resolved_stats.defense_power),
      modifier_lifecycle_status: lifecycleResult.status,
      lifecycle_updated_modifier_instance_ids: lifecycleResult.status === "applied"
        ? lifecycleResult.result.updated_modifier_instance_ids
        : [],
      modifier_lifecycle_conflict_code: lifecycleResult.status === "conflict"
        ? lifecycleResult.conflict_code
        : undefined,
    };
  }
}

function normalizeBaseStats(
  input: Readonly<Record<string, number>> | undefined,
): Readonly<Record<string, number>> {
  if (input === undefined) {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [statKey, value] of Object.entries(input)) {
    if (!Number.isFinite(value)) {
      continue;
    }
    normalized[statKey] = value;
  }
  return normalized;
}

function normalizeTriggerWindow(input: string | undefined): string {
  if (input === undefined) {
    return "battle_start";
  }

  const normalized = input.trim();
  return normalized.length > 0 ? normalized : "battle_start";
}

function toResolvedStat(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}
