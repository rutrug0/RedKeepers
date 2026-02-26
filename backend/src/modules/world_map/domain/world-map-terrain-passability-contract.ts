export const WORLD_MAP_TERRAIN_PASSABILITY_SEED_SCHEMA_VERSION_V1 =
  "rk-v1-world-map-terrain-passability-seed" as const;
export const WORLD_MAP_TERRAIN_PASSABILITY_TABLE_ID = "world_map_terrain_passability" as const;

export interface WorldMapTerrainCoordinate {
  readonly x: number;
  readonly y: number;
}

export interface WorldMapTerrainPassabilityQuery {
  readonly world_seed: string;
  readonly map_size: number;
  readonly coordinate: WorldMapTerrainCoordinate;
}

export interface WorldMapTerrainPassabilityFixtureRow
  extends WorldMapTerrainPassabilityQuery
{
  readonly passable: boolean;
}

export interface WorldMapTerrainPassabilitySeedTableV1 {
  readonly schema_version: typeof WORLD_MAP_TERRAIN_PASSABILITY_SEED_SCHEMA_VERSION_V1;
  readonly source_doc: string;
  readonly source_section: string;
  readonly table_id: typeof WORLD_MAP_TERRAIN_PASSABILITY_TABLE_ID;
  readonly rows: readonly WorldMapTerrainPassabilityFixtureRow[];
}

export interface WorldMapTerrainPassabilityResolver {
  resolveTilePassable(input: WorldMapTerrainPassabilityQuery): boolean;
}
