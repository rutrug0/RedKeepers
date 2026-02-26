export const WORLD_MAP_MARCH_SNAPSHOT_FLOW = "world_map.march_snapshot_v1" as const;

export const WORLD_MAP_MARCH_STATES = [
  "march_state_in_transit",
  "march_state_resolved",
] as const;

export type WorldMapMarchState = (typeof WORLD_MAP_MARCH_STATES)[number];

export const WORLD_MAP_MARCH_COMBAT_OUTCOMES = [
  "attacker_win",
  "defender_win",
] as const;

export type WorldMapMarchCombatOutcome = (typeof WORLD_MAP_MARCH_COMBAT_OUTCOMES)[number];

export interface WorldMapMarchMapCoordinate {
  readonly x: number;
  readonly y: number;
}

export interface WorldMapMarchAuthoritativePosition extends WorldMapMarchMapCoordinate {
  readonly distance_tiles: number;
  readonly traveled_tiles: number;
  readonly remaining_tiles: number;
  readonly progress_ratio: number;
}

export interface WorldMapMarchInterpolationWindow {
  readonly from_position: WorldMapMarchMapCoordinate;
  readonly to_position: WorldMapMarchMapCoordinate;
  readonly segment_started_at: Date;
  readonly segment_ends_at: Date;
}

export interface WorldMapMarchResolutionSummary {
  readonly resolved_at: Date;
  readonly combat_outcome: WorldMapMarchCombatOutcome;
  readonly attacker_strength: number;
  readonly defender_strength: number;
}

export interface WorldMapMarchSnapshotResponseDto {
  readonly flow: typeof WORLD_MAP_MARCH_SNAPSHOT_FLOW;
  readonly snapshot_id: string;
  readonly snapshot_emitted_at: Date;
  readonly march_id: string;
  readonly march_revision: number;
  readonly march_state: WorldMapMarchState;
  readonly origin: WorldMapMarchMapCoordinate;
  readonly target: WorldMapMarchMapCoordinate;
  readonly departed_at: Date;
  readonly arrives_at: Date;
  readonly authoritative_position: WorldMapMarchAuthoritativePosition;
  readonly interpolation_window?: WorldMapMarchInterpolationWindow;
  readonly next_authoritative_snapshot_at?: Date;
  readonly resolution?: WorldMapMarchResolutionSummary;
}
