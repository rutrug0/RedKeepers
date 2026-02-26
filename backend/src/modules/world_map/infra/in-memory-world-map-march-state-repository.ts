import type {
  WorldMapMarchStateRepository,
  WorldMapMarchRuntimeState,
} from "../ports";

export class InMemoryWorldMapMarchStateRepository
  implements WorldMapMarchStateRepository
{
  private readonly statesById = new Map<string, WorldMapMarchRuntimeState>();

  constructor(initialStates?: readonly WorldMapMarchRuntimeState[]) {
    for (const state of initialStates ?? []) {
      this.saveMarchRuntimeState(state);
    }
  }

  readMarchRuntimeState(input: {
    readonly march_id: string;
  }): WorldMapMarchRuntimeState | null {
    const state = this.statesById.get(input.march_id);
    if (state === undefined) {
      return null;
    }
    return cloneMarchRuntimeState(state);
  }

  saveMarchRuntimeState(snapshot: WorldMapMarchRuntimeState): WorldMapMarchRuntimeState {
    const normalized = normalizeRuntimeState(snapshot);
    this.statesById.set(normalized.march_id, normalized);
    return cloneMarchRuntimeState(normalized);
  }
}

function normalizeRuntimeState(
  snapshot: WorldMapMarchRuntimeState,
): WorldMapMarchRuntimeState {
  return {
    ...snapshot,
    march_id: snapshot.march_id.trim(),
    settlement_id: snapshot.settlement_id.trim(),
    origin: {
      ...snapshot.origin,
    },
    target: {
      ...snapshot.target,
    },
    departed_at: new Date(snapshot.departed_at.getTime()),
    resolved_at: snapshot.resolved_at === undefined
      ? undefined
      : new Date(snapshot.resolved_at.getTime()),
  };
}

function cloneMarchRuntimeState(
  state: WorldMapMarchRuntimeState,
): WorldMapMarchRuntimeState {
  return {
    ...state,
    origin: { ...state.origin },
    target: { ...state.target },
    departed_at: new Date(state.departed_at.getTime()),
    resolved_at: state.resolved_at === undefined ? undefined : new Date(state.resolved_at.getTime()),
  };
}
