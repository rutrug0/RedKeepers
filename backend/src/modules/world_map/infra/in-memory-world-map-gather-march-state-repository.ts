import type {
  WorldMapGatherMarchRuntimeState,
  WorldMapGatherMarchStateRepository,
} from "../ports";

export class InMemoryWorldMapGatherMarchStateRepository
  implements WorldMapGatherMarchStateRepository
{
  private readonly statesById = new Map<string, WorldMapGatherMarchRuntimeState>();

  constructor(initialStates?: readonly WorldMapGatherMarchRuntimeState[]) {
    for (const state of initialStates ?? []) {
      this.saveGatherMarchRuntimeState(state);
    }
  }

  readGatherMarchRuntimeState(input: {
    readonly march_id: string;
  }): WorldMapGatherMarchRuntimeState | null {
    const state = this.statesById.get(input.march_id);
    if (state === undefined) {
      return null;
    }
    return cloneGatherMarchRuntimeState(state);
  }

  saveGatherMarchRuntimeState(
    state: WorldMapGatherMarchRuntimeState,
  ): WorldMapGatherMarchRuntimeState {
    const normalized = normalizeGatherMarchRuntimeState(state);
    this.statesById.set(normalized.march_id, normalized);
    return cloneGatherMarchRuntimeState(normalized);
  }
}

function normalizeGatherMarchRuntimeState(
  state: WorldMapGatherMarchRuntimeState,
): WorldMapGatherMarchRuntimeState {
  return {
    ...state,
    world_id: state.world_id.trim(),
    deterministic_seed: state.deterministic_seed.trim(),
    march_id: state.march_id.trim(),
    settlement_id: state.settlement_id.trim(),
    army_name: state.army_name.trim(),
    node_id: state.node_id.trim(),
    started_at: new Date(state.started_at.getTime()),
    completes_at: new Date(state.completes_at.getTime()),
    resolved_at: state.resolved_at === undefined ? undefined : new Date(state.resolved_at.getTime()),
    gathered_yield: state.gathered_yield.map((yieldOutput) => ({ ...yieldOutput })),
  };
}

function cloneGatherMarchRuntimeState(
  state: WorldMapGatherMarchRuntimeState,
): WorldMapGatherMarchRuntimeState {
  return {
    ...state,
    started_at: new Date(state.started_at.getTime()),
    completes_at: new Date(state.completes_at.getTime()),
    resolved_at: state.resolved_at === undefined ? undefined : new Date(state.resolved_at.getTime()),
    gathered_yield: state.gathered_yield.map((yieldOutput) => ({ ...yieldOutput })),
  };
}
