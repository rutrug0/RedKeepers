import type {
  WorldMapTerrainPassabilityFixtureRow,
  WorldMapTerrainPassabilityQuery,
  WorldMapTerrainPassabilityResolver,
  WorldMapTerrainPassabilitySeedTableV1,
} from "../domain";

const DEFAULT_IMPASSABLE_TILE_HASH_MODULUS = 11;
const DEFAULT_WORLD_SEED = "world_seed_unknown";

export interface DeterministicWorldMapTerrainPassabilityResolverOptions {
  readonly fixture_seed_table?: Pick<WorldMapTerrainPassabilitySeedTableV1, "rows">;
  readonly fixture_rows?: readonly WorldMapTerrainPassabilityFixtureRow[];
  readonly impassable_tile_hash_modulus?: number;
}

export class DeterministicWorldMapTerrainPassabilityResolver
  implements WorldMapTerrainPassabilityResolver
{
  private readonly impassableTileHashModulus: number;
  private readonly fixtureByCoordinateKey: ReadonlyMap<string, boolean>;

  constructor(options?: DeterministicWorldMapTerrainPassabilityResolverOptions) {
    this.impassableTileHashModulus = normalizeMinimumPositiveInteger(
      options?.impassable_tile_hash_modulus,
      DEFAULT_IMPASSABLE_TILE_HASH_MODULUS,
    );
    this.fixtureByCoordinateKey = createFixtureLookup({
      fixture_seed_table: options?.fixture_seed_table,
      fixture_rows: options?.fixture_rows,
    });
  }

  resolveTilePassable(input: WorldMapTerrainPassabilityQuery): boolean {
    const normalized = normalizePassabilityQuery(input);
    if (
      !isCoordinateWithinMapBounds({
        coordinate: normalized.coordinate,
        map_size: normalized.map_size,
      })
    ) {
      return false;
    }

    const fixtureKey = createWorldMapTerrainPassabilityCoordinateKey(normalized);
    const fixtureValue = this.fixtureByCoordinateKey.get(fixtureKey);
    if (fixtureValue !== undefined) {
      return fixtureValue;
    }

    const hash = hashDeterministicSeed(
      `${normalized.world_seed}:${normalized.coordinate.x}:${normalized.coordinate.y}`,
    );
    return hash % this.impassableTileHashModulus !== 0;
  }
}

export function createWorldMapTerrainPassabilityCoordinateKey(
  input: Pick<WorldMapTerrainPassabilityQuery, "world_seed" | "map_size" | "coordinate">,
): string {
  const normalized = normalizePassabilityQuery(input);
  return `${normalized.world_seed}:${normalized.map_size}:${normalized.coordinate.x}:${normalized.coordinate.y}`;
}

function createFixtureLookup(input: {
  readonly fixture_seed_table?: Pick<WorldMapTerrainPassabilitySeedTableV1, "rows">;
  readonly fixture_rows?: readonly WorldMapTerrainPassabilityFixtureRow[];
}): ReadonlyMap<string, boolean> {
  const fixtureByKey = new Map<string, boolean>();
  const rows: readonly WorldMapTerrainPassabilityFixtureRow[] = [
    ...(input.fixture_seed_table?.rows ?? []),
    ...(input.fixture_rows ?? []),
  ];

  for (const row of rows) {
    const normalized = normalizeFixtureRow(row);
    fixtureByKey.set(createWorldMapTerrainPassabilityCoordinateKey(normalized), normalized.passable);
  }

  return fixtureByKey;
}

function normalizeFixtureRow(
  input: WorldMapTerrainPassabilityFixtureRow,
): WorldMapTerrainPassabilityFixtureRow {
  const normalizedQuery = normalizePassabilityQuery(input);
  return {
    ...normalizedQuery,
    passable: Boolean(input.passable),
  };
}

function normalizePassabilityQuery(
  input: Pick<WorldMapTerrainPassabilityQuery, "world_seed" | "map_size" | "coordinate">,
): WorldMapTerrainPassabilityQuery {
  return {
    world_seed: normalizeFallbackText(input.world_seed, DEFAULT_WORLD_SEED),
    map_size: normalizeMinimumPositiveInteger(input.map_size, 1),
    coordinate: {
      x: normalizeFiniteGridCoordinate(input.coordinate.x),
      y: normalizeFiniteGridCoordinate(input.coordinate.y),
    },
  };
}

function isCoordinateWithinMapBounds(input: {
  readonly coordinate: {
    readonly x: number;
    readonly y: number;
  };
  readonly map_size: number;
}): boolean {
  return input.coordinate.x >= 0
    && input.coordinate.y >= 0
    && input.coordinate.x < input.map_size
    && input.coordinate.y < input.map_size;
}

function hashDeterministicSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeFallbackText(value: string, fallback: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeMinimumPositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.trunc(value));
}

function normalizeFiniteGridCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value);
}
