import type {
  WorldMapGatherYieldRange,
  WorldMapNeutralNodeState,
} from "../domain";

export interface WorldMapNeutralNodeRuntimeState {
  readonly world_id: string;
  readonly node_id: string;
  readonly node_type: string;
  readonly node_label: string;
  readonly coordinate: {
    readonly x: number;
    readonly y: number;
  };
  readonly node_state: WorldMapNeutralNodeState;
  readonly node_revision: number;
  readonly gather_duration_seconds: number;
  readonly yield_ranges: readonly WorldMapGatherYieldRange[];
  readonly ambush_risk_pct: number;
  readonly ambush_base_strength: number;
  readonly remaining_cycles: number;
}

export interface WorldMapNeutralNodeStateRepository {
  readNeutralNodeRuntimeState(input: {
    readonly world_id: string;
    readonly node_id: string;
  }): WorldMapNeutralNodeRuntimeState | null;
  saveNeutralNodeRuntimeState(
    state: WorldMapNeutralNodeRuntimeState,
  ): WorldMapNeutralNodeRuntimeState;
  listNeutralNodeRuntimeStates(input: {
    readonly world_id: string;
  }): readonly WorldMapNeutralNodeRuntimeState[];
}
