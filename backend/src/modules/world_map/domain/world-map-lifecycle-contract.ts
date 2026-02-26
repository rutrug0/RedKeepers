export const WORLD_MAP_LIFECYCLE_FLOW = "world_map.lifecycle_v1" as const;

export const WORLD_MAP_LIFECYCLE_STATES = [
  "world_lifecycle_open",
  "world_lifecycle_locked",
  "world_lifecycle_archived",
] as const;

export type WorldMapLifecycleState = (typeof WORLD_MAP_LIFECYCLE_STATES)[number];

export const WORLD_MAP_LIFECYCLE_EVENT_CONTENT_KEYS = [
  "event.world.lifecycle_opened",
  "event.world.lifecycle_locked",
  "event.world.lifecycle_archived",
  "event.world.lifecycle_reset",
] as const;

export type WorldMapLifecycleEventContentKey =
  (typeof WORLD_MAP_LIFECYCLE_EVENT_CONTENT_KEYS)[number];

export interface WorldMapLifecycleSchedule {
  readonly season_length_days: number;
  readonly season_started_at: Date;
  readonly season_lock_at: Date;
  readonly season_archive_at: Date;
  readonly season_reset_at: Date;
}

export interface WorldMapLifecycleEvent {
  readonly event_id: string;
  readonly content_key: WorldMapLifecycleEventContentKey;
  readonly occurred_at: Date;
  readonly tokens: {
    readonly world_id: string;
    readonly season_number: string;
  };
}

export interface WorldMapSeasonArchiveSummary {
  readonly archive_id: string;
  readonly world_id: string;
  readonly season_number: number;
  readonly season_length_days: number;
  readonly season_started_at: Date;
  readonly season_locked_at: Date;
  readonly archived_at: Date;
  readonly active_player_count: number;
  readonly active_settlement_count: number;
  readonly active_march_count: number;
}

export interface WorldMapLifecycleAdvanceResponseDto {
  readonly flow: typeof WORLD_MAP_LIFECYCLE_FLOW;
  readonly world_id: string;
  readonly world_revision: number;
  readonly lifecycle_state: WorldMapLifecycleState;
  readonly season_number: number;
  readonly observed_at: Date;
  readonly schedule: WorldMapLifecycleSchedule;
  readonly events: readonly WorldMapLifecycleEvent[];
  readonly latest_archive?: WorldMapSeasonArchiveSummary;
}

