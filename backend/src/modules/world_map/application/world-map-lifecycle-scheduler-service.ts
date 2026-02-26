import {
  WORLD_MAP_LIFECYCLE_FLOW,
  type WorldMapLifecycleAdvanceResponseDto,
  type WorldMapLifecycleEvent,
  type WorldMapLifecycleEventContentKey,
  type WorldMapLifecycleSchedule,
  type WorldMapLifecycleState,
  type WorldMapSeasonArchiveSummary,
} from "../domain";
import type {
  WorldMapJoinableWorldState,
  WorldMapLifecycleRuntimeState,
  WorldMapLifecycleStateRepository,
} from "../ports";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_LOCK_TO_ARCHIVE_DELAY_SECONDS = 300;
const DEFAULT_ARCHIVE_TO_RESET_DELAY_SECONDS = 60;
const MAX_SEASON_ADVANCES_PER_CALL = 512;

export interface WorldMapLifecycleAdvanceInput {
  readonly world_id: string;
  readonly observed_at?: Date;
}

export interface WorldMapLifecycleSchedulerService {
  advanceLifecycle(
    input: WorldMapLifecycleAdvanceInput,
  ): WorldMapLifecycleAdvanceResponseDto;
}

export class WorldMapLifecycleNotFoundError extends Error {
  readonly status_code = 404;
  readonly code = "world_not_found" as const;

  constructor(message: string) {
    super(message);
    this.name = "WorldMapLifecycleNotFoundError";
  }
}

export class DeterministicWorldMapLifecycleSchedulerService
  implements WorldMapLifecycleSchedulerService
{
  private readonly lockToArchiveDelayMs: number;
  private readonly archiveToResetDelayMs: number;

  constructor(
    private readonly lifecycleRepository: WorldMapLifecycleStateRepository,
    options?: {
      readonly lock_to_archive_delay_seconds?: number;
      readonly archive_to_reset_delay_seconds?: number;
    },
  ) {
    this.lockToArchiveDelayMs = normalizeMinimumPositiveInteger(
      options?.lock_to_archive_delay_seconds,
      DEFAULT_LOCK_TO_ARCHIVE_DELAY_SECONDS,
    ) * 1000;
    this.archiveToResetDelayMs = normalizeMinimumPositiveInteger(
      options?.archive_to_reset_delay_seconds,
      DEFAULT_ARCHIVE_TO_RESET_DELAY_SECONDS,
    ) * 1000;
  }

  advanceLifecycle(
    input: WorldMapLifecycleAdvanceInput,
  ): WorldMapLifecycleAdvanceResponseDto {
    const worldId = normalizeNonEmpty(input.world_id, "world_unknown");
    const observedAt = input.observed_at ?? new Date();

    const persistedState = this.lifecycleRepository.readLifecycleRuntimeState({
      world_id: worldId,
    });
    if (persistedState === null) {
      throw new WorldMapLifecycleNotFoundError(
        `World '${worldId}' is not registered in lifecycle runtime state.`,
      );
    }

    let runtimeState = normalizeLifecycleRuntimeState(persistedState);
    let latestArchive: WorldMapSeasonArchiveSummary | undefined;
    const events: WorldMapLifecycleEvent[] = [];
    const observedAtMs = observedAt.getTime();
    let advanceCount = 0;

    while (advanceCount < MAX_SEASON_ADVANCES_PER_CALL) {
      const schedule = resolveLifecycleSchedule({
        state: runtimeState,
        lock_to_archive_delay_ms: this.lockToArchiveDelayMs,
        archive_to_reset_delay_ms: this.archiveToResetDelayMs,
      });

      if (observedAtMs < schedule.season_lock_at.getTime()) {
        break;
      }

      if (runtimeState.lifecycle_state === "world_lifecycle_open") {
        runtimeState = this.lifecycleRepository.saveLifecycleRuntimeState({
          ...runtimeState,
          lifecycle_state: "world_lifecycle_locked",
          world_revision: runtimeState.world_revision + 1,
          state_changed_at: schedule.season_lock_at,
        });
        runtimeState = normalizeLifecycleRuntimeState(runtimeState);
        events.push(
          createLifecycleEvent({
            world_id: runtimeState.world_id,
            season_number: runtimeState.season_number,
            content_key: "event.world.lifecycle_locked",
            occurred_at: schedule.season_lock_at,
          }),
        );
      }

      if (observedAtMs < schedule.season_archive_at.getTime()) {
        break;
      }

      if (runtimeState.lifecycle_state === "world_lifecycle_locked") {
        latestArchive = this.lifecycleRepository.appendSeasonArchiveSummary(
          createArchiveSummary({
            state: runtimeState,
            schedule,
          }),
        );
        runtimeState = this.lifecycleRepository.saveLifecycleRuntimeState({
          ...runtimeState,
          lifecycle_state: "world_lifecycle_archived",
          world_revision: runtimeState.world_revision + 1,
          state_changed_at: schedule.season_archive_at,
        });
        runtimeState = normalizeLifecycleRuntimeState(runtimeState);
        events.push(
          createLifecycleEvent({
            world_id: runtimeState.world_id,
            season_number: runtimeState.season_number,
            content_key: "event.world.lifecycle_archived",
            occurred_at: schedule.season_archive_at,
          }),
        );
      }

      if (observedAtMs < schedule.season_reset_at.getTime()) {
        break;
      }

      if (runtimeState.lifecycle_state !== "world_lifecycle_archived") {
        break;
      }

      runtimeState = this.lifecycleRepository.saveLifecycleRuntimeState({
        ...runtimeState,
        lifecycle_state: "world_lifecycle_open",
        world_revision: runtimeState.world_revision + 1,
        season_number: runtimeState.season_number + 1,
        season_started_at: schedule.season_reset_at,
        state_changed_at: schedule.season_reset_at,
        joinable_world_state: createEmptyJoinableWorldState(),
      });
      runtimeState = normalizeLifecycleRuntimeState(runtimeState);
      events.push(
        createLifecycleEvent({
          world_id: runtimeState.world_id,
          season_number: runtimeState.season_number,
          content_key: "event.world.lifecycle_reset",
          occurred_at: schedule.season_reset_at,
        }),
      );
      events.push(
        createLifecycleEvent({
          world_id: runtimeState.world_id,
          season_number: runtimeState.season_number,
          content_key: "event.world.lifecycle_opened",
          occurred_at: schedule.season_reset_at,
        }),
      );
      advanceCount += 1;
    }

    if (advanceCount >= MAX_SEASON_ADVANCES_PER_CALL) {
      throw new Error(
        `Lifecycle advance limit (${MAX_SEASON_ADVANCES_PER_CALL}) reached for world '${worldId}'.`,
      );
    }

    const schedule = resolveLifecycleSchedule({
      state: runtimeState,
      lock_to_archive_delay_ms: this.lockToArchiveDelayMs,
      archive_to_reset_delay_ms: this.archiveToResetDelayMs,
    });

    return {
      flow: WORLD_MAP_LIFECYCLE_FLOW,
      world_id: runtimeState.world_id,
      world_revision: runtimeState.world_revision,
      lifecycle_state: runtimeState.lifecycle_state,
      season_number: runtimeState.season_number,
      observed_at: new Date(observedAt.getTime()),
      schedule,
      events,
      latest_archive: latestArchive,
    };
  }
}

function resolveLifecycleSchedule(input: {
  readonly state: WorldMapLifecycleRuntimeState;
  readonly lock_to_archive_delay_ms: number;
  readonly archive_to_reset_delay_ms: number;
}): WorldMapLifecycleSchedule {
  const seasonLengthDays = normalizeMinimumPositiveInteger(
    input.state.season_length_days,
    1,
  );
  const seasonStartedAtMs = input.state.season_started_at.getTime();
  const seasonLockAtMs = seasonStartedAtMs + seasonLengthDays * MILLISECONDS_PER_DAY;
  const seasonArchiveAtMs = seasonLockAtMs + input.lock_to_archive_delay_ms;
  const seasonResetAtMs = seasonArchiveAtMs + input.archive_to_reset_delay_ms;

  return {
    season_length_days: seasonLengthDays,
    season_started_at: new Date(seasonStartedAtMs),
    season_lock_at: new Date(seasonLockAtMs),
    season_archive_at: new Date(seasonArchiveAtMs),
    season_reset_at: new Date(seasonResetAtMs),
  };
}

function createArchiveSummary(input: {
  readonly state: WorldMapLifecycleRuntimeState;
  readonly schedule: WorldMapLifecycleSchedule;
}): WorldMapSeasonArchiveSummary {
  return {
    archive_id: createArchiveId(input.state.world_id, input.state.season_number),
    world_id: input.state.world_id,
    season_number: input.state.season_number,
    season_length_days: input.schedule.season_length_days,
    season_started_at: input.schedule.season_started_at,
    season_locked_at: input.schedule.season_lock_at,
    archived_at: input.schedule.season_archive_at,
    active_player_count: input.state.joinable_world_state.joinable_player_ids.length,
    active_settlement_count: input.state.joinable_world_state.active_settlement_ids.length,
    active_march_count: input.state.joinable_world_state.active_march_ids.length,
  };
}

function createLifecycleEvent(input: {
  readonly world_id: string;
  readonly season_number: number;
  readonly content_key: WorldMapLifecycleEventContentKey;
  readonly occurred_at: Date;
}): WorldMapLifecycleEvent {
  const occurredAt = new Date(input.occurred_at.getTime());
  return {
    event_id: createLifecycleEventId({
      world_id: input.world_id,
      season_number: input.season_number,
      content_key: input.content_key,
      occurred_at: occurredAt,
    }),
    content_key: input.content_key,
    occurred_at: occurredAt,
    tokens: {
      world_id: input.world_id,
      season_number: String(input.season_number),
    },
  };
}

function createLifecycleEventId(input: {
  readonly world_id: string;
  readonly season_number: number;
  readonly content_key: string;
  readonly occurred_at: Date;
}): string {
  return `${input.world_id}:${input.season_number}:${input.content_key}:${input.occurred_at.getTime()}`;
}

function createArchiveId(worldId: string, seasonNumber: number): string {
  return `${worldId}:season:${seasonNumber}`;
}

function normalizeLifecycleRuntimeState(
  state: WorldMapLifecycleRuntimeState,
): WorldMapLifecycleRuntimeState {
  const seasonStartedAt = normalizeDate(state.season_started_at);
  const stateChangedAt = normalizeDate(state.state_changed_at, seasonStartedAt);

  return {
    ...state,
    world_id: normalizeNonEmpty(state.world_id, "world_unknown"),
    world_revision: normalizeNonNegativeInteger(state.world_revision),
    lifecycle_state: normalizeLifecycleState(state.lifecycle_state),
    season_number: Math.max(1, normalizeNonNegativeInteger(state.season_number)),
    season_length_days: normalizeMinimumPositiveInteger(state.season_length_days, 1),
    season_started_at: seasonStartedAt,
    state_changed_at: stateChangedAt,
    joinable_world_state: normalizeJoinableWorldState(state.joinable_world_state),
  };
}

function normalizeLifecycleState(value: WorldMapLifecycleState): WorldMapLifecycleState {
  if (value === "world_lifecycle_locked") {
    return "world_lifecycle_locked";
  }
  if (value === "world_lifecycle_archived") {
    return "world_lifecycle_archived";
  }
  return "world_lifecycle_open";
}

function normalizeJoinableWorldState(input: WorldMapJoinableWorldState): WorldMapJoinableWorldState {
  return {
    joinable_player_ids: normalizeIdList(input.joinable_player_ids),
    active_settlement_ids: normalizeIdList(input.active_settlement_ids),
    active_march_ids: normalizeIdList(input.active_march_ids),
  };
}

function createEmptyJoinableWorldState(): WorldMapJoinableWorldState {
  return {
    joinable_player_ids: [],
    active_settlement_ids: [],
    active_march_ids: [],
  };
}

function normalizeIdList(values: readonly string[]): readonly string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const item = value.trim();
    if (item.length === 0 || seen.has(item)) {
      continue;
    }
    seen.add(item);
    normalized.push(item);
  }
  return normalized;
}

function normalizeNonEmpty(value: string, fallback: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
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

function normalizeDate(value: Date, fallback?: Date): Date {
  const timestamp = value.getTime();
  if (Number.isFinite(timestamp)) {
    return new Date(timestamp);
  }
  if (fallback !== undefined) {
    return new Date(fallback.getTime());
  }
  return new Date(0);
}

