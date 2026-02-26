import type { Instant } from "../../../shared";
import type {
  HeroAssignmentBoundContextType,
  HeroModifierDomain,
  HeroModifierLifecycleApplied,
  HeroModifierLifecycleMutationInput,
  HeroRuntimePersistenceRepository,
  HeroRuntimeWriteResult,
} from "../ports";

export type SharedNumericModifierOperation = "add" | "mul";

export interface SharedActionModifierSourceQuery {
  readonly player_id: string;
  readonly domain: HeroModifierDomain;
  readonly trigger_window: string;
  readonly assignment_context_type: HeroAssignmentBoundContextType;
  readonly assignment_context_id: string;
  readonly now: Instant;
}

export interface SharedActionModifierRecord {
  readonly source_id: string;
  readonly stat_key: string;
  readonly op: SharedNumericModifierOperation;
  readonly value: number;
  readonly lifecycle?: {
    readonly source_kind: "hero_runtime_instance";
    readonly modifier_instance_id: string;
    readonly remaining_charges: number;
    readonly expires_at?: Instant;
  };
}

export interface SharedActionModifierSource {
  listNumericModifiers(
    input: SharedActionModifierSourceQuery,
  ): readonly SharedActionModifierRecord[];
}

export interface SharedActionNumericResolutionInput
  extends SharedActionModifierSourceQuery
{
  readonly base_stats?: Readonly<Record<string, number>>;
}

export interface SharedActionModifierLifecycleCandidate {
  readonly source_kind: "hero_runtime_instance";
  readonly modifier_instance_id: string;
  readonly remaining_charges: number;
  readonly expires_at?: Instant;
  readonly was_applied: boolean;
}

export interface SharedActionNumericResolutionResult {
  readonly resolved_stats: Readonly<Record<string, number>>;
  readonly applied_modifiers: readonly SharedActionModifierRecord[];
  readonly lifecycle_candidates: readonly SharedActionModifierLifecycleCandidate[];
}

export class HeroRuntimeActionModifierSource implements SharedActionModifierSource {
  constructor(
    private readonly heroRuntimeRepository: HeroRuntimePersistenceRepository,
  ) {}

  listNumericModifiers(
    input: SharedActionModifierSourceQuery,
  ): readonly SharedActionModifierRecord[] {
    const activeModifiers = this.heroRuntimeRepository.listModifierInstances({
      player_id: input.player_id,
      assignment_context_type: input.assignment_context_type,
      assignment_context_id: input.assignment_context_id,
      status: "active",
    });

    const mapped: SharedActionModifierRecord[] = [];
    for (const modifier of activeModifiers) {
      if (modifier.domain !== input.domain) {
        continue;
      }
      if (modifier.trigger_window !== input.trigger_window) {
        continue;
      }

      const normalizedValue = parseNumericModifierValue(modifier.value);
      if (!Number.isFinite(normalizedValue)) {
        continue;
      }

      mapped.push({
        source_id: modifier.modifier_instance_id,
        stat_key: modifier.stat_key,
        op: modifier.op,
        value: normalizedValue,
        lifecycle: {
          source_kind: "hero_runtime_instance",
          modifier_instance_id: modifier.modifier_instance_id,
          remaining_charges: modifier.remaining_charges,
          expires_at: modifier.expires_at,
        },
      });
    }

    return mapped;
  }
}

export class SharedActionModifierAggregationService {
  constructor(
    private readonly sources: readonly SharedActionModifierSource[],
    private readonly heroRuntimeRepository?: HeroRuntimePersistenceRepository,
  ) {}

  resolveNumericStats(
    input: SharedActionNumericResolutionInput,
  ): SharedActionNumericResolutionResult {
    const now = normalizeInstant(input.now, "now");
    const baseStats = normalizeBaseStats(input.base_stats);
    const sourceModifiers: SharedActionModifierRecord[] = [];
    for (const source of this.sources) {
      sourceModifiers.push(...source.listNumericModifiers(input));
    }

    const appliedModifiers: SharedActionModifierRecord[] = [];
    const lifecycleCandidates: SharedActionModifierLifecycleCandidate[] = [];
    for (const modifier of sourceModifiers) {
      const lifecycle = modifier.lifecycle;
      const expiresAt = lifecycle?.expires_at;
      const isExpired = expiresAt !== undefined && expiresAt.getTime() <= now.getTime();

      if (lifecycle !== undefined) {
        lifecycleCandidates.push({
          source_kind: lifecycle.source_kind,
          modifier_instance_id: lifecycle.modifier_instance_id,
          remaining_charges: lifecycle.remaining_charges,
          expires_at: lifecycle.expires_at,
          was_applied: !isExpired,
        });
      }

      if (isExpired) {
        continue;
      }

      appliedModifiers.push(modifier);
    }

    return {
      resolved_stats: applyNumericModifiers(baseStats, appliedModifiers),
      applied_modifiers: appliedModifiers,
      lifecycle_candidates: lifecycleCandidates,
    };
  }

  applyPostResolutionLifecycle(input: {
    readonly player_id: string;
    readonly now: Instant;
    readonly lifecycle_candidates: readonly SharedActionModifierLifecycleCandidate[];
  }): HeroRuntimeWriteResult<HeroModifierLifecycleApplied> {
    if (this.heroRuntimeRepository === undefined) {
      return {
        status: "applied",
        result: {
          updated_modifier_instance_ids: [],
        },
      };
    }

    const mutations = buildLifecycleMutations(input);
    if (mutations.length === 0) {
      return {
        status: "applied",
        result: {
          updated_modifier_instance_ids: [],
        },
      };
    }

    return this.heroRuntimeRepository.applyModifierLifecycle({
      player_id: input.player_id,
      now: input.now,
      mutations,
    });
  }
}

function applyNumericModifiers(
  baseStats: Readonly<Record<string, number>>,
  modifiers: readonly SharedActionModifierRecord[],
): Readonly<Record<string, number>> {
  const addByStat = new Map<string, number>();
  const mulByStat = new Map<string, number>();
  const keySet = new Set<string>(Object.keys(baseStats));

  for (const modifier of modifiers) {
    keySet.add(modifier.stat_key);
    if (modifier.op === "add") {
      addByStat.set(
        modifier.stat_key,
        (addByStat.get(modifier.stat_key) ?? 0) + modifier.value,
      );
      continue;
    }

    mulByStat.set(
      modifier.stat_key,
      (mulByStat.get(modifier.stat_key) ?? 1) * modifier.value,
    );
  }

  const resolved: Record<string, number> = {};
  for (const statKey of keySet) {
    const base = baseStats[statKey] ?? 0;
    const additive = addByStat.get(statKey) ?? 0;
    const multiplier = mulByStat.get(statKey) ?? 1;
    resolved[statKey] = (base + additive) * multiplier;
  }

  return resolved;
}

function buildLifecycleMutations(input: {
  readonly now: Instant;
  readonly lifecycle_candidates: readonly SharedActionModifierLifecycleCandidate[];
}): readonly HeroModifierLifecycleMutationInput[] {
  const now = normalizeInstant(input.now, "now");
  const mutationByModifierId = new Map<string, HeroModifierLifecycleMutationInput>();

  for (const candidate of input.lifecycle_candidates) {
    const existing = mutationByModifierId.get(candidate.modifier_instance_id);
    if (existing !== undefined) {
      continue;
    }

    const isExpired = candidate.expires_at !== undefined
      && candidate.expires_at.getTime() <= now.getTime();
    if (isExpired) {
      mutationByModifierId.set(candidate.modifier_instance_id, {
        modifier_instance_id: candidate.modifier_instance_id,
        remaining_charges: candidate.remaining_charges,
        status: "expired",
      });
      continue;
    }

    if (!candidate.was_applied || candidate.remaining_charges <= 0) {
      continue;
    }

    const nextCharges = candidate.remaining_charges - 1;
    if (nextCharges <= 0) {
      mutationByModifierId.set(candidate.modifier_instance_id, {
        modifier_instance_id: candidate.modifier_instance_id,
        remaining_charges: 0,
        status: "consumed",
        consumed_at: now,
      });
      continue;
    }

    mutationByModifierId.set(candidate.modifier_instance_id, {
      modifier_instance_id: candidate.modifier_instance_id,
      remaining_charges: nextCharges,
      status: "active",
    });
  }

  return [...mutationByModifierId.values()];
}

function normalizeBaseStats(
  input: Readonly<Record<string, number>> | undefined,
): Readonly<Record<string, number>> {
  if (input === undefined) {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isFinite(value)) {
      continue;
    }
    normalized[key] = value;
  }
  return normalized;
}

function parseNumericModifierValue(input: string): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeInstant(value: Date, field: string): Date {
  const normalized = new Date(value.getTime());
  if (Number.isNaN(normalized.getTime())) {
    throw new Error(`Expected valid instant for '${field}'.`);
  }
  return normalized;
}
