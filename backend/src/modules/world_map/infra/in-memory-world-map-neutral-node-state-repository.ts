import type {
  WorldMapNeutralNodeRuntimeState,
  WorldMapNeutralNodeStateRepository,
} from "../ports";

export class InMemoryWorldMapNeutralNodeStateRepository
  implements WorldMapNeutralNodeStateRepository
{
  private readonly statesByKey = new Map<string, WorldMapNeutralNodeRuntimeState>();

  constructor(initialStates?: readonly WorldMapNeutralNodeRuntimeState[]) {
    for (const state of initialStates ?? []) {
      this.saveNeutralNodeRuntimeState(state);
    }
  }

  readNeutralNodeRuntimeState(input: {
    readonly world_id: string;
    readonly node_id: string;
  }): WorldMapNeutralNodeRuntimeState | null {
    const state = this.statesByKey.get(toKey(input.world_id, input.node_id));
    if (state === undefined) {
      return null;
    }
    return cloneNeutralNodeRuntimeState(state);
  }

  saveNeutralNodeRuntimeState(
    state: WorldMapNeutralNodeRuntimeState,
  ): WorldMapNeutralNodeRuntimeState {
    const normalized = normalizeNeutralNodeRuntimeState(state);
    this.statesByKey.set(toKey(normalized.world_id, normalized.node_id), normalized);
    return cloneNeutralNodeRuntimeState(normalized);
  }

  listNeutralNodeRuntimeStates(input: {
    readonly world_id: string;
  }): readonly WorldMapNeutralNodeRuntimeState[] {
    const worldId = input.world_id.trim();
    const states: WorldMapNeutralNodeRuntimeState[] = [];
    for (const state of this.statesByKey.values()) {
      if (state.world_id === worldId) {
        states.push(cloneNeutralNodeRuntimeState(state));
      }
    }
    states.sort((left, right) => left.node_id.localeCompare(right.node_id));
    return states;
  }
}

function normalizeNeutralNodeRuntimeState(
  state: WorldMapNeutralNodeRuntimeState,
): WorldMapNeutralNodeRuntimeState {
  return {
    ...state,
    world_id: state.world_id.trim(),
    node_id: state.node_id.trim(),
    node_type: state.node_type.trim(),
    node_label: state.node_label.trim(),
    coordinate: {
      x: state.coordinate.x,
      y: state.coordinate.y,
    },
    yield_ranges: state.yield_ranges.map((yieldRange) => ({ ...yieldRange })),
  };
}

function cloneNeutralNodeRuntimeState(
  state: WorldMapNeutralNodeRuntimeState,
): WorldMapNeutralNodeRuntimeState {
  return {
    ...state,
    coordinate: { ...state.coordinate },
    yield_ranges: state.yield_ranges.map((yieldRange) => ({ ...yieldRange })),
  };
}

function toKey(worldId: string, nodeId: string): string {
  return `${worldId.trim()}::${nodeId.trim()}`;
}
