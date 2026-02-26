import type {
  WorldMapLifecycleState,
  WorldMapSeasonArchiveSummary,
} from "../domain";

export interface WorldMapJoinableWorldState {
  readonly joinable_player_ids: readonly string[];
  readonly active_settlement_ids: readonly string[];
  readonly active_march_ids: readonly string[];
}

export interface WorldMapLifecycleRuntimeState {
  readonly world_id: string;
  readonly world_revision: number;
  readonly lifecycle_state: WorldMapLifecycleState;
  readonly season_number: number;
  readonly season_length_days: number;
  readonly season_started_at: Date;
  readonly state_changed_at: Date;
  readonly joinable_world_state: WorldMapJoinableWorldState;
}

export interface WorldMapLifecycleStateRepository {
  readLifecycleRuntimeState(input: {
    readonly world_id: string;
  }): WorldMapLifecycleRuntimeState | null;
  saveLifecycleRuntimeState(
    snapshot: WorldMapLifecycleRuntimeState,
  ): WorldMapLifecycleRuntimeState;
  appendSeasonArchiveSummary(
    summary: WorldMapSeasonArchiveSummary,
  ): WorldMapSeasonArchiveSummary;
  listSeasonArchiveSummaries(input: {
    readonly world_id: string;
  }): readonly WorldMapSeasonArchiveSummary[];
}

