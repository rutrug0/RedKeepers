import type {
  WorldMapLifecycleStateRepository,
  WorldMapLifecycleRuntimeState,
} from "../ports";
import type { WorldMapSeasonArchiveSummary } from "../domain";

export class InMemoryWorldMapLifecycleStateRepository
  implements WorldMapLifecycleStateRepository
{
  private readonly statesByWorldId = new Map<string, WorldMapLifecycleRuntimeState>();
  private readonly archivesByWorldId = new Map<string, WorldMapSeasonArchiveSummary[]>();

  constructor(
    initialStates?: readonly WorldMapLifecycleRuntimeState[],
    initialArchives?: readonly WorldMapSeasonArchiveSummary[],
  ) {
    for (const state of initialStates ?? []) {
      this.saveLifecycleRuntimeState(state);
    }
    for (const archive of initialArchives ?? []) {
      this.appendSeasonArchiveSummary(archive);
    }
  }

  readLifecycleRuntimeState(input: {
    readonly world_id: string;
  }): WorldMapLifecycleRuntimeState | null {
    const state = this.statesByWorldId.get(input.world_id);
    if (state === undefined) {
      return null;
    }
    return cloneLifecycleRuntimeState(state);
  }

  saveLifecycleRuntimeState(
    snapshot: WorldMapLifecycleRuntimeState,
  ): WorldMapLifecycleRuntimeState {
    const normalized = normalizeLifecycleRuntimeState(snapshot);
    this.statesByWorldId.set(normalized.world_id, normalized);
    return cloneLifecycleRuntimeState(normalized);
  }

  appendSeasonArchiveSummary(
    summary: WorldMapSeasonArchiveSummary,
  ): WorldMapSeasonArchiveSummary {
    const normalized = normalizeArchiveSummary(summary);
    const archiveRows = this.archivesByWorldId.get(normalized.world_id) ?? [];
    archiveRows.push(normalized);
    archiveRows.sort((left, right) => left.season_number - right.season_number);
    this.archivesByWorldId.set(normalized.world_id, archiveRows);
    return cloneArchiveSummary(normalized);
  }

  listSeasonArchiveSummaries(input: {
    readonly world_id: string;
  }): readonly WorldMapSeasonArchiveSummary[] {
    const rows = this.archivesByWorldId.get(input.world_id) ?? [];
    return rows.map(cloneArchiveSummary);
  }
}

function normalizeLifecycleRuntimeState(
  snapshot: WorldMapLifecycleRuntimeState,
): WorldMapLifecycleRuntimeState {
  return {
    ...snapshot,
    world_id: snapshot.world_id.trim(),
    season_started_at: new Date(snapshot.season_started_at.getTime()),
    state_changed_at: new Date(snapshot.state_changed_at.getTime()),
    joinable_world_state: {
      joinable_player_ids: [...snapshot.joinable_world_state.joinable_player_ids],
      active_settlement_ids: [...snapshot.joinable_world_state.active_settlement_ids],
      active_march_ids: [...snapshot.joinable_world_state.active_march_ids],
    },
  };
}

function cloneLifecycleRuntimeState(
  snapshot: WorldMapLifecycleRuntimeState,
): WorldMapLifecycleRuntimeState {
  return {
    ...snapshot,
    season_started_at: new Date(snapshot.season_started_at.getTime()),
    state_changed_at: new Date(snapshot.state_changed_at.getTime()),
    joinable_world_state: {
      joinable_player_ids: [...snapshot.joinable_world_state.joinable_player_ids],
      active_settlement_ids: [...snapshot.joinable_world_state.active_settlement_ids],
      active_march_ids: [...snapshot.joinable_world_state.active_march_ids],
    },
  };
}

function normalizeArchiveSummary(
  summary: WorldMapSeasonArchiveSummary,
): WorldMapSeasonArchiveSummary {
  return {
    ...summary,
    archive_id: summary.archive_id.trim(),
    world_id: summary.world_id.trim(),
    season_started_at: new Date(summary.season_started_at.getTime()),
    season_locked_at: new Date(summary.season_locked_at.getTime()),
    archived_at: new Date(summary.archived_at.getTime()),
  };
}

function cloneArchiveSummary(
  summary: WorldMapSeasonArchiveSummary,
): WorldMapSeasonArchiveSummary {
  return {
    ...summary,
    season_started_at: new Date(summary.season_started_at.getTime()),
    season_locked_at: new Date(summary.season_locked_at.getTime()),
    archived_at: new Date(summary.archived_at.getTime()),
  };
}

