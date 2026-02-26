export const AMBUSH_RESOLUTION_OUTCOMES = [
  "ambush_not_triggered",
  "ambush_repelled",
  "ambush_intercepted",
] as const;

export type AmbushResolutionOutcome = (typeof AMBUSH_RESOLUTION_OUTCOMES)[number];

export interface DeterministicAmbushResolutionInput {
  readonly deterministic_seed: string;
  readonly encounter_id: string;
  readonly ambush_risk_pct: number;
  readonly escort_strength: number;
  readonly ambush_base_strength: number;
}

export interface DeterministicAmbushResolutionResult {
  readonly ambush_triggered: boolean;
  readonly ambush_roll: number;
  readonly ambush_strength: number;
  readonly escort_strength: number;
  readonly outcome: AmbushResolutionOutcome;
}

export class DeterministicAmbushResolutionService {
  resolveAmbush(
    input: DeterministicAmbushResolutionInput,
  ): DeterministicAmbushResolutionResult {
    const deterministicSeed = normalizeNonEmpty(input.deterministic_seed, "world_seed_unknown");
    const encounterId = normalizeNonEmpty(input.encounter_id, "encounter_unknown");
    const ambushRiskPct = normalizeRiskPercent(input.ambush_risk_pct);
    const escortStrength = normalizeNonNegativeInteger(input.escort_strength);
    const baseAmbushStrength = normalizeNonNegativeInteger(input.ambush_base_strength);

    const hashSeed = `${deterministicSeed}:${encounterId}`;
    const rollHash = hashDeterministicSeed(`${hashSeed}:ambush_roll`);
    const strengthHash = hashDeterministicSeed(`${hashSeed}:ambush_strength`);
    const ambushRoll = rollHash % 100;
    const strengthVariance = strengthHash % 21;
    const ambushStrength = baseAmbushStrength + strengthVariance;
    const ambushTriggered = ambushRiskPct > 0 && ambushRoll < ambushRiskPct;

    if (!ambushTriggered) {
      return {
        ambush_triggered: false,
        ambush_roll: ambushRoll,
        ambush_strength: ambushStrength,
        escort_strength: escortStrength,
        outcome: "ambush_not_triggered",
      };
    }

    return {
      ambush_triggered: true,
      ambush_roll: ambushRoll,
      ambush_strength: ambushStrength,
      escort_strength: escortStrength,
      outcome: escortStrength > ambushStrength ? "ambush_repelled" : "ambush_intercepted",
    };
  }
}

function normalizeNonEmpty(value: string, fallback: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeRiskPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.trunc(value)));
}

function normalizeNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function hashDeterministicSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
