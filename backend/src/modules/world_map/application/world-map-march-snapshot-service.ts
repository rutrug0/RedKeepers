import type {
  WorldMapMarchCombatOutcome,
  WorldMapMarchMapCoordinate,
  WorldMapMarchSnapshotResponseDto,
  WorldMapMarchState,
} from "../domain";
import { WORLD_MAP_MARCH_SNAPSHOT_FLOW } from "../domain";
import type {
  WorldMapMarchRuntimeState,
  WorldMapMarchStateRepository,
} from "../ports";

const DEFAULT_SECONDS_PER_TILE = 30;
const DEFAULT_SNAPSHOT_INTERVAL_MS = 1000;

export interface WorldMapMarchSnapshotInput {
  readonly march_id: string;
  readonly observed_at?: Date;
}

export interface WorldMapMarchSnapshotService {
  emitMarchSnapshot(input: WorldMapMarchSnapshotInput): WorldMapMarchSnapshotResponseDto;
}

export class WorldMapMarchNotFoundError extends Error {
  readonly status_code = 404;
  readonly code = "march_not_found" as const;

  constructor(message: string) {
    super(message);
    this.name = "WorldMapMarchNotFoundError";
  }
}

interface WorldMapMarchTravelTiming {
  readonly distance_tiles: number;
  readonly duration_ms: number;
  readonly arrives_at: Date;
}

export class DeterministicWorldMapMarchSnapshotService
  implements WorldMapMarchSnapshotService
{
  private readonly defaultSecondsPerTile: number;
  private readonly snapshotIntervalMs: number;

  constructor(
    private readonly marchStateRepository: WorldMapMarchStateRepository,
    options?: {
      readonly default_seconds_per_tile?: number;
      readonly snapshot_interval_ms?: number;
    },
  ) {
    this.defaultSecondsPerTile = normalizeMinimumPositiveInteger(
      options?.default_seconds_per_tile,
      DEFAULT_SECONDS_PER_TILE,
    );
    this.snapshotIntervalMs = normalizeMinimumPositiveInteger(
      options?.snapshot_interval_ms,
      DEFAULT_SNAPSHOT_INTERVAL_MS,
    );
  }

  emitMarchSnapshot(input: WorldMapMarchSnapshotInput): WorldMapMarchSnapshotResponseDto {
    const marchId = normalizeNonEmpty(input.march_id, "march_unknown");
    const observedAt = input.observed_at ?? new Date();

    const persistedRuntimeState = this.marchStateRepository.readMarchRuntimeState({
      march_id: marchId,
    });
    if (persistedRuntimeState === null) {
      throw new WorldMapMarchNotFoundError(
        `March '${marchId}' is not registered in runtime state.`,
      );
    }

    const runtimeState = normalizeRuntimeState(
      persistedRuntimeState,
      this.defaultSecondsPerTile,
    );
    const travel = computeTravelTiming(runtimeState);
    const authoritativeState = this.resolveAuthoritativeState(
      runtimeState,
      travel,
      observedAt,
    );
    const snapshotEmittedAt = resolveSnapshotEmittedAt({
      state: authoritativeState,
      observed_at: observedAt,
      arrives_at: travel.arrives_at,
      snapshot_interval_ms: this.snapshotIntervalMs,
    });
    const position = resolveAuthoritativePositionAt(
      authoritativeState,
      travel,
      snapshotEmittedAt,
    );
    const interpolationWindow = createInterpolationWindow({
      state: authoritativeState,
      travel,
      snapshot_emitted_at: snapshotEmittedAt,
      snapshot_interval_ms: this.snapshotIntervalMs,
    });

    return {
      flow: WORLD_MAP_MARCH_SNAPSHOT_FLOW,
      snapshot_id: createSnapshotId(authoritativeState.march_id, snapshotEmittedAt),
      snapshot_emitted_at: snapshotEmittedAt,
      march_id: authoritativeState.march_id,
      march_revision: authoritativeState.march_revision,
      march_state: authoritativeState.march_state,
      origin: { ...authoritativeState.origin },
      target: { ...authoritativeState.target },
      departed_at: authoritativeState.departed_at,
      arrives_at: travel.arrives_at,
      authoritative_position: {
        ...position,
        distance_tiles: travel.distance_tiles,
        traveled_tiles: position.traveled_tiles,
        remaining_tiles: Math.max(0, travel.distance_tiles - position.traveled_tiles),
        progress_ratio: toProgressRatio(position.traveled_tiles, travel.distance_tiles),
      },
      interpolation_window: interpolationWindow,
      next_authoritative_snapshot_at: interpolationWindow?.segment_ends_at,
      resolution: createResolutionSummary(authoritativeState, travel),
    };
  }

  private resolveAuthoritativeState(
    state: WorldMapMarchRuntimeState,
    travel: WorldMapMarchTravelTiming,
    observedAt: Date,
  ): WorldMapMarchRuntimeState {
    if (state.march_state === "march_state_resolved") {
      return state;
    }

    if (observedAt.getTime() < travel.arrives_at.getTime()) {
      return state;
    }

    const resolvedState = this.marchStateRepository.saveMarchRuntimeState({
      ...state,
      march_state: "march_state_resolved",
      march_revision: state.march_revision + 1,
      resolved_at: travel.arrives_at,
      resolution_outcome: resolveCombatOutcome(
        state.attacker_strength,
        state.defender_strength,
      ),
    });

    return normalizeRuntimeState(resolvedState, this.defaultSecondsPerTile);
  }
}

function resolveSnapshotEmittedAt(input: {
  readonly state: WorldMapMarchRuntimeState;
  readonly observed_at: Date;
  readonly arrives_at: Date;
  readonly snapshot_interval_ms: number;
}): Date {
  if (input.state.march_state === "march_state_resolved") {
    return input.state.resolved_at ?? input.arrives_at;
  }

  const departedAtMs = input.state.departed_at.getTime();
  const arrivesAtMs = input.arrives_at.getTime();
  const observedAtMs = input.observed_at.getTime();
  const boundedObservedMs = Math.max(
    departedAtMs,
    Math.min(observedAtMs, arrivesAtMs),
  );
  const quantizedMs = Math.floor(boundedObservedMs / input.snapshot_interval_ms)
    * input.snapshot_interval_ms;
  return new Date(Math.max(departedAtMs, Math.min(quantizedMs, arrivesAtMs)));
}

function createInterpolationWindow(input: {
  readonly state: WorldMapMarchRuntimeState;
  readonly travel: WorldMapMarchTravelTiming;
  readonly snapshot_emitted_at: Date;
  readonly snapshot_interval_ms: number;
}):
  | WorldMapMarchSnapshotResponseDto["interpolation_window"]
  | undefined {
  if (input.state.march_state === "march_state_resolved") {
    return undefined;
  }

  const segmentStartedAtMs = input.snapshot_emitted_at.getTime();
  const segmentEndsAtMs = Math.min(
    input.travel.arrives_at.getTime(),
    segmentStartedAtMs + input.snapshot_interval_ms,
  );

  return {
    from_position: toMapCoordinate(
      resolveRoutePositionByElapsedTiles(
        input.state,
        input.travel,
        resolveTraveledTiles(input.state, input.travel, segmentStartedAtMs),
      ),
    ),
    to_position: toMapCoordinate(
      resolveRoutePositionByElapsedTiles(
        input.state,
        input.travel,
        resolveTraveledTiles(input.state, input.travel, segmentEndsAtMs),
      ),
    ),
    segment_started_at: new Date(segmentStartedAtMs),
    segment_ends_at: new Date(segmentEndsAtMs),
  };
}

function resolveAuthoritativePositionAt(
  state: WorldMapMarchRuntimeState,
  travel: WorldMapMarchTravelTiming,
  snapshotEmittedAt: Date,
): {
  readonly x: number;
  readonly y: number;
  readonly traveled_tiles: number;
} {
  if (state.march_state === "march_state_resolved") {
    return {
      x: state.target.x,
      y: state.target.y,
      traveled_tiles: travel.distance_tiles,
    };
  }

  const traveledTiles = resolveTraveledTiles(
    state,
    travel,
    snapshotEmittedAt.getTime(),
  );
  const coordinate = resolveRoutePositionByElapsedTiles(state, travel, traveledTiles);

  return {
    x: coordinate.x,
    y: coordinate.y,
    traveled_tiles: traveledTiles,
  };
}

function resolveTraveledTiles(
  state: WorldMapMarchRuntimeState,
  travel: WorldMapMarchTravelTiming,
  observedAtMs: number,
): number {
  if (travel.distance_tiles === 0) {
    return 0;
  }

  const elapsedMs = Math.max(0, observedAtMs - state.departed_at.getTime());
  const tileDurationMs = Math.max(1, travel.duration_ms / travel.distance_tiles);
  return Math.min(travel.distance_tiles, elapsedMs / tileDurationMs);
}

function resolveRoutePositionByElapsedTiles(
  state: WorldMapMarchRuntimeState,
  travel: WorldMapMarchTravelTiming,
  traveledTiles: number,
): {
  readonly x: number;
  readonly y: number;
} {
  if (travel.distance_tiles <= 0 || traveledTiles <= 0) {
    return {
      x: state.origin.x,
      y: state.origin.y,
    };
  }

  if (traveledTiles >= travel.distance_tiles) {
    return {
      x: state.target.x,
      y: state.target.y,
    };
  }

  const totalXDistance = Math.abs(state.target.x - state.origin.x);
  const totalYDistance = Math.abs(state.target.y - state.origin.y);
  const xSign = Math.sign(state.target.x - state.origin.x);
  const ySign = Math.sign(state.target.y - state.origin.y);

  if (traveledTiles <= totalXDistance) {
    return {
      x: state.origin.x + xSign * traveledTiles,
      y: state.origin.y,
    };
  }

  const yTiles = Math.min(totalYDistance, traveledTiles - totalXDistance);
  return {
    x: state.origin.x + xSign * totalXDistance,
    y: state.origin.y + ySign * yTiles,
  };
}

function toMapCoordinate(input: {
  readonly x: number;
  readonly y: number;
}): WorldMapMarchMapCoordinate {
  return {
    x: input.x,
    y: input.y,
  };
}

function createResolutionSummary(
  state: WorldMapMarchRuntimeState,
  travel: WorldMapMarchTravelTiming,
): WorldMapMarchSnapshotResponseDto["resolution"] | undefined {
  if (state.march_state !== "march_state_resolved") {
    return undefined;
  }

  return {
    resolved_at: state.resolved_at ?? travel.arrives_at,
    combat_outcome:
      state.resolution_outcome
      ?? resolveCombatOutcome(state.attacker_strength, state.defender_strength),
    attacker_strength: state.attacker_strength,
    defender_strength: state.defender_strength,
  };
}

function createSnapshotId(marchId: string, snapshotAt: Date): string {
  return `${marchId}:${snapshotAt.getTime()}`;
}

function computeTravelTiming(state: WorldMapMarchRuntimeState): WorldMapMarchTravelTiming {
  const distanceTiles = Math.abs(state.target.x - state.origin.x)
    + Math.abs(state.target.y - state.origin.y);
  const durationMs = distanceTiles * state.seconds_per_tile * 1000;

  return {
    distance_tiles: distanceTiles,
    duration_ms: durationMs,
    arrives_at: new Date(state.departed_at.getTime() + durationMs),
  };
}

function normalizeRuntimeState(
  state: WorldMapMarchRuntimeState,
  defaultSecondsPerTile: number,
): WorldMapMarchRuntimeState {
  return {
    ...state,
    march_id: normalizeNonEmpty(state.march_id, "march_unknown"),
    settlement_id: normalizeNonEmpty(state.settlement_id, "settlement_unknown"),
    march_revision: normalizeNonNegativeInteger(state.march_revision),
    march_state: normalizeMarchState(state.march_state),
    origin: {
      x: normalizeFiniteNumber(state.origin.x),
      y: normalizeFiniteNumber(state.origin.y),
    },
    target: {
      x: normalizeFiniteNumber(state.target.x),
      y: normalizeFiniteNumber(state.target.y),
    },
    departed_at: new Date(state.departed_at.getTime()),
    seconds_per_tile: normalizeMinimumPositiveInteger(
      state.seconds_per_tile,
      defaultSecondsPerTile,
    ),
    attacker_strength: normalizeFiniteNumber(state.attacker_strength),
    defender_strength: normalizeFiniteNumber(state.defender_strength),
    resolved_at:
      state.resolved_at === undefined ? undefined : new Date(state.resolved_at.getTime()),
    resolution_outcome: normalizeResolutionOutcome(state.resolution_outcome),
  };
}

function normalizeMarchState(value: WorldMapMarchState): WorldMapMarchState {
  if (value === "march_state_resolved") {
    return "march_state_resolved";
  }
  return "march_state_in_transit";
}

function normalizeResolutionOutcome(
  value: WorldMapMarchCombatOutcome | undefined,
): WorldMapMarchCombatOutcome | undefined {
  if (value === "attacker_win" || value === "defender_win") {
    return value;
  }
  return undefined;
}

function normalizeNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function normalizeMinimumPositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.trunc(value));
}

function normalizeFiniteNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function normalizeNonEmpty(value: string, fallback: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function resolveCombatOutcome(
  attackerStrength: number,
  defenderStrength: number,
): WorldMapMarchCombatOutcome {
  return attackerStrength > defenderStrength ? "attacker_win" : "defender_win";
}

function toProgressRatio(traveledTiles: number, distanceTiles: number): number {
  if (distanceTiles <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, traveledTiles / distanceTiles));
}
