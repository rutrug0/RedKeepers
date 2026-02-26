import type {
  WorldMapAmbushOutcome,
  WorldMapGatherMarchState,
  WorldMapGatherYieldOutput,
} from "../domain";

export interface WorldMapGatherMarchRuntimeState {
  readonly world_id: string;
  readonly deterministic_seed: string;
  readonly march_id: string;
  readonly settlement_id: string;
  readonly army_name: string;
  readonly node_id: string;
  readonly march_revision: number;
  readonly march_state: WorldMapGatherMarchState;
  readonly started_at: Date;
  readonly completes_at: Date;
  readonly escort_strength: number;
  readonly gathered_yield: readonly WorldMapGatherYieldOutput[];
  readonly ambush_roll: number;
  readonly ambush_triggered: boolean;
  readonly ambush_strength: number;
  readonly ambush_outcome: WorldMapAmbushOutcome;
  readonly resolved_at?: Date;
}

export interface WorldMapGatherMarchStateRepository {
  readGatherMarchRuntimeState(input: {
    readonly march_id: string;
  }): WorldMapGatherMarchRuntimeState | null;
  saveGatherMarchRuntimeState(
    state: WorldMapGatherMarchRuntimeState,
  ): WorldMapGatherMarchRuntimeState;
}
