import type {
  WorldMapMarchCombatOutcome,
  WorldMapMarchMapCoordinate,
  WorldMapMarchState,
} from "../domain/world-map-march-snapshot-contract.ts";

export interface WorldMapMarchHeroAttachmentRuntimeState {
  readonly player_id: string;
  readonly hero_id: string;
  readonly assignment_id: string;
  readonly assignment_context_type: "army";
  readonly assignment_context_id: string;
  readonly attached_at: Date;
  readonly detached_at?: Date;
}

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
  readonly hero_attachment?: WorldMapMarchHeroAttachmentRuntimeState;
}

export interface WorldMapMarchStateRepository {
  readMarchRuntimeState(input: {
    readonly march_id: string;
  }): WorldMapMarchRuntimeState | null;
  listActiveMarchRuntimeStates(input: {
    readonly settlement_id: string;
  }): readonly WorldMapMarchRuntimeState[];
  saveMarchRuntimeState(snapshot: WorldMapMarchRuntimeState): WorldMapMarchRuntimeState;
}
