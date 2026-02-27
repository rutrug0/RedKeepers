import type {
  WorldMapMarchStateRepository,
  WorldMapMarchHeroAttachmentRuntimeState,
  WorldMapMarchRuntimeState,
} from "../ports/world-map-march-state-repository.ts";

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

  listActiveMarchRuntimeStates(input: {
    readonly settlement_id: string;
  }): readonly WorldMapMarchRuntimeState[] {
    const settlementId = input.settlement_id.trim();
    const activeStates: WorldMapMarchRuntimeState[] = [];
    for (const state of this.statesById.values()) {
      if (
        state.settlement_id === settlementId
        && state.march_state !== "march_state_resolved"
      ) {
        activeStates.push(cloneMarchRuntimeState(state));
      }
    }
    return activeStates;
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
    hero_attachment: cloneHeroAttachment(snapshot.hero_attachment),
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
    hero_attachment: cloneHeroAttachment(state.hero_attachment),
  };
}

function cloneHeroAttachment(
  attachment: WorldMapMarchHeroAttachmentRuntimeState | undefined,
): WorldMapMarchHeroAttachmentRuntimeState | undefined {
  if (attachment === undefined) {
    return undefined;
  }
  return {
    ...attachment,
    attached_at: new Date(attachment.attached_at.getTime()),
    detached_at: attachment.detached_at === undefined
      ? undefined
      : new Date(attachment.detached_at.getTime()),
  };
}
