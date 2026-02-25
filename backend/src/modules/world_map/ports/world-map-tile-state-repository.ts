export interface WorldMapTileSnapshot {
  readonly settlement_id: string;
  readonly tile_id: string;
  readonly tile_state: string;
  readonly tile_revision: number;
  readonly target_tile_label?: string;
  readonly hostile_force_estimate?: string;
}

export interface WorldMapTileStateRepository {
  readTileSnapshot(input: {
    readonly settlement_id: string;
    readonly tile_id: string;
  }): WorldMapTileSnapshot | null;
  saveTileSnapshot(snapshot: WorldMapTileSnapshot): WorldMapTileSnapshot;
}
