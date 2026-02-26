import type {
  WorldMapMarchCombatOutcome,
  WorldMapMarchMapCoordinate,
  WorldMapMarchState,
} from "../domain";

export interface WorldMapMarchRuntimeState {
  readonly march_id: string;
  readonly settlement_id: string;
  readonly march_revision: number;
  readonly march_state: WorldMapMarchState;
  readonly origin: WorldMapMarchMapCoordinate;
  readonly target: WorldMapMarchMapCoordinate;
  readonly departed_at: Date;
  readonly seconds_per_tile?: number;
  readonly attacker_strength: number;
  readonly defender_strength: number;
  readonly resolved_at?: Date;
  readonly resolution_outcome?: WorldMapMarchCombatOutcome;
}

export interface WorldMapMarchStateRepository {
  readMarchRuntimeState(input: {
    readonly march_id: string;
  }): WorldMapMarchRuntimeState | null;
  saveMarchRuntimeState(snapshot: WorldMapMarchRuntimeState): WorldMapMarchRuntimeState;
}
