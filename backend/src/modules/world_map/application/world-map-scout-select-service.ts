import {
  WORLD_MAP_SCOUT_SELECT_FLOW,
  type WorldMapScoutEvent,
  type WorldMapScoutSelectResponseDto,
  type WorldMapTileState,
} from "../domain";
import type {
  WorldMapTileSnapshot,
  WorldMapTileStateRepository,
} from "../ports";

type WorldMapKnownTileState = Exclude<WorldMapTileState, "tile_state_unknown">;

export interface WorldMapScoutSelectInput {
  readonly settlement_id: string;
  readonly settlement_name?: string;
  readonly tile_id: string;
}

export interface WorldMapScoutSelectService {
  handleScoutSelect(input: WorldMapScoutSelectInput): WorldMapScoutSelectResponseDto;
}

type UnknownTileStateResolver = (input: {
  readonly settlement_id: string;
  readonly tile_id: string;
}) => WorldMapKnownTileState;

export class DeterministicWorldMapScoutSelectService
  implements WorldMapScoutSelectService
{
  private readonly defaultSettlementName: string;
  private readonly defaultHostileForceEstimate: string;
  private readonly resolveUnknownTileState: UnknownTileStateResolver;

  constructor(
    private readonly tileStateRepository: WorldMapTileStateRepository,
    options?: {
      readonly default_settlement_name?: string;
      readonly default_hostile_force_estimate?: string;
      readonly resolve_unknown_tile_state?: UnknownTileStateResolver;
    },
  ) {
    this.defaultSettlementName = normalizeNonEmpty(
      options?.default_settlement_name,
      "Starter Settlement",
    );
    this.defaultHostileForceEstimate = normalizeNonEmpty(
      options?.default_hostile_force_estimate,
      "unknown movement",
    );
    this.resolveUnknownTileState =
      options?.resolve_unknown_tile_state ?? resolveUnknownTileStateFromTileId;
  }

  handleScoutSelect(input: WorldMapScoutSelectInput): WorldMapScoutSelectResponseDto {
    const settlementId = normalizeNonEmpty(input.settlement_id, "settlement_unknown");
    const tileId = normalizeNonEmpty(input.tile_id, "tile_unknown");
    const settlementName = normalizeNonEmpty(
      input.settlement_name,
      this.defaultSettlementName,
    );

    const storedSnapshot =
      this.tileStateRepository.readTileSnapshot({
        settlement_id: settlementId,
        tile_id: tileId,
      }) ?? createDefaultTileSnapshot(settlementId, tileId);

    const currentState = normalizeTileState(storedSnapshot.tile_state);
    const targetTileLabel = normalizeNonEmpty(
      storedSnapshot.target_tile_label,
      `Frontier Tile ${tileId}`,
    );
    const hostileForceEstimate = normalizeNonEmpty(
      storedSnapshot.hostile_force_estimate,
      this.defaultHostileForceEstimate,
    );

    const interactionResolution = this.resolveInteraction({
      settlement_id: settlementId,
      settlement_name: settlementName,
      tile_id: tileId,
      current_tile_state: currentState,
      target_tile_label: targetTileLabel,
      hostile_force_estimate: hostileForceEstimate,
    });

    const persistedSnapshot = this.tileStateRepository.saveTileSnapshot({
      ...storedSnapshot,
      settlement_id: settlementId,
      tile_id: tileId,
      tile_state: interactionResolution.tile_state,
      tile_revision: normalizeTileRevision(storedSnapshot.tile_revision) + 1,
      target_tile_label: targetTileLabel,
      hostile_force_estimate: hostileForceEstimate,
    });

    return {
      flow: WORLD_MAP_SCOUT_SELECT_FLOW,
      tile_id: tileId,
      tile_state: normalizeTileState(persistedSnapshot.tile_state),
      interaction_outcome: interactionResolution.interaction_outcome,
      event: interactionResolution.event,
      tile_revision: normalizeTileRevision(persistedSnapshot.tile_revision),
    };
  }

  private resolveInteraction(input: {
    readonly settlement_id: string;
    readonly settlement_name: string;
    readonly tile_id: string;
    readonly current_tile_state: WorldMapTileState;
    readonly target_tile_label: string;
    readonly hostile_force_estimate: string;
  }): {
    readonly tile_state: WorldMapKnownTileState;
    readonly interaction_outcome: WorldMapScoutSelectResponseDto["interaction_outcome"];
    readonly event: WorldMapScoutEvent;
  } {
    if (input.current_tile_state === "tile_state_unknown") {
      const nextState = normalizeKnownTileState(
        this.resolveUnknownTileState({
          settlement_id: input.settlement_id,
          tile_id: input.tile_id,
        }),
      );

      return {
        tile_state: nextState,
        interaction_outcome: "outcome_scout_dispatched",
        event: {
          content_key: "event.world.scout_dispatched",
          tokens: {
            settlement_name: input.settlement_name,
            target_tile_label: input.target_tile_label,
          },
        },
      };
    }

    if (input.current_tile_state === "tile_state_hostile_hint") {
      return {
        tile_state: "tile_state_hostile_hint",
        interaction_outcome: "outcome_scout_report_hostile",
        event: {
          content_key: "event.world.scout_report_hostile",
          tokens: {
            target_tile_label: input.target_tile_label,
            hostile_force_estimate: input.hostile_force_estimate,
          },
        },
      };
    }

    return {
      tile_state: "tile_state_quiet",
      interaction_outcome: "outcome_scout_report_empty",
      event: {
        content_key: "event.world.scout_report_empty",
        tokens: {
          target_tile_label: input.target_tile_label,
        },
      },
    };
  }
}

function createDefaultTileSnapshot(
  settlementId: string,
  tileId: string,
): WorldMapTileSnapshot {
  return {
    settlement_id: settlementId,
    tile_id: tileId,
    tile_state: "tile_state_unknown",
    tile_revision: 0,
  };
}

function normalizeTileState(value: string): WorldMapTileState {
  if (value === "tile_state_quiet") {
    return "tile_state_quiet";
  }
  if (value === "tile_state_hostile_hint") {
    return "tile_state_hostile_hint";
  }
  return "tile_state_unknown";
}

function normalizeKnownTileState(value: string): WorldMapKnownTileState {
  if (value === "tile_state_hostile_hint") {
    return "tile_state_hostile_hint";
  }
  return "tile_state_quiet";
}

function normalizeTileRevision(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function normalizeNonEmpty(value: string | undefined, fallback: string): string {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function resolveUnknownTileStateFromTileId(input: {
  readonly tile_id: string;
}): WorldMapKnownTileState {
  const normalizedTileId = normalizeNonEmpty(input.tile_id, "tile_unknown");
  let hash = 7;

  for (const char of normalizedTileId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash % 2 === 0 ? "tile_state_quiet" : "tile_state_hostile_hint";
}
