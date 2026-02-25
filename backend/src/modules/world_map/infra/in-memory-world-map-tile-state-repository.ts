import type {
  WorldMapTileSnapshot,
  WorldMapTileStateRepository,
} from "../ports";

export class InMemoryWorldMapTileStateRepository
  implements WorldMapTileStateRepository
{
  private readonly snapshotsById = new Map<string, WorldMapTileSnapshot>();

  constructor(initialSnapshots?: readonly WorldMapTileSnapshot[]) {
    for (const snapshot of initialSnapshots ?? []) {
      this.saveTileSnapshot(snapshot);
    }
  }

  readTileSnapshot(input: {
    readonly settlement_id: string;
    readonly tile_id: string;
  }): WorldMapTileSnapshot | null {
    const key = toTileKey(input.settlement_id, input.tile_id);
    const snapshot = this.snapshotsById.get(key);
    if (snapshot === undefined) {
      return null;
    }

    return cloneSnapshot(snapshot);
  }

  saveTileSnapshot(snapshot: WorldMapTileSnapshot): WorldMapTileSnapshot {
    const normalized: WorldMapTileSnapshot = {
      ...snapshot,
      settlement_id: snapshot.settlement_id.trim(),
      tile_id: snapshot.tile_id.trim(),
    };
    this.snapshotsById.set(
      toTileKey(normalized.settlement_id, normalized.tile_id),
      normalized,
    );
    return cloneSnapshot(normalized);
  }
}

function toTileKey(settlementId: string, tileId: string): string {
  return `${settlementId}::${tileId}`;
}

function cloneSnapshot(snapshot: WorldMapTileSnapshot): WorldMapTileSnapshot {
  return { ...snapshot };
}
