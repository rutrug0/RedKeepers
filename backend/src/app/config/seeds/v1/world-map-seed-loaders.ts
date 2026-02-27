import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type FirstSlicePlayableManifestV1,
  assertFirstSlicePlayableManifestSupportsDeterministicHostileFixtureV1,
  loadFirstSlicePlayableManifestV1,
} from "./first-slice-playable-manifest-loaders.ts";
import type {
  WorldMapScoutInteractionOutcome,
  WorldMapScoutEventContentKey,
  WorldMapTileState,
} from "../../../../modules/world_map/domain/index.ts";
import type {
  WorldMapTileSnapshot,
  WorldMapTileStateRepository,
} from "../../../../modules/world_map/ports/index.ts";

export const WORLD_MAP_SEED_SCHEMA_VERSION_V1 = "rk-v1-world-map-seed" as const;

export const WORLD_MAP_TILES_TABLE_ID = "world_map_tiles";
export const WORLD_MAP_SCOUT_EVENT_TOKENS_TABLE_ID = "world_map.scout_event_tokens";

export const WORLD_MAP_TILE_STATES: readonly WorldMapTileState[] = [
  "tile_state_unknown",
  "tile_state_quiet",
  "tile_state_hostile_hint",
] as const;

export type WorldMapScoutEventToken = "settlement_name" | "target_tile_label" | "hostile_force_estimate";

export interface WorldMapTileSeedFilePathsV1 {
  readonly worldMapTiles: string;
  readonly worldMapScoutEventTokens: string;
  readonly firstSlicePlayableManifest: string;
}

export interface WorldMapTileSnapshotSeedRow extends WorldMapTileSnapshot {}

export interface WorldMapTileSeedTableV1 {
  readonly schema_version: typeof WORLD_MAP_SEED_SCHEMA_VERSION_V1;
  readonly source_doc: string;
  readonly source_section: string;
  readonly table_id: typeof WORLD_MAP_TILES_TABLE_ID;
  readonly rows: readonly WorldMapTileSnapshotSeedRow[];
}

export interface WorldMapScoutEventTokenSeedRow {
  readonly outcome_code: WorldMapScoutInteractionOutcome;
  readonly content_key: WorldMapScoutEventContentKey;
  readonly required_tokens: readonly WorldMapScoutEventToken[];
}

export interface WorldMapScoutEventTokenSeedTableV1 {
  readonly schema_version: typeof WORLD_MAP_SEED_SCHEMA_VERSION_V1;
  readonly source_doc: string;
  readonly source_section: string;
  readonly table_id: typeof WORLD_MAP_SCOUT_EVENT_TOKENS_TABLE_ID;
  readonly rows: readonly WorldMapScoutEventTokenSeedRow[];
}

export interface WorldMapSeedBundleV1 {
  readonly world_map_tiles: WorldMapTileSeedTableV1;
  readonly world_map_scout_event_tokens: WorldMapScoutEventTokenSeedTableV1;
  readonly first_slice_playable_manifest: FirstSlicePlayableManifestV1;
}

export class WorldMapSeedValidationError extends Error {
  readonly filePath?: string;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(
    message: string,
    options?: {
      readonly filePath?: string;
      readonly details?: Record<string, unknown>;
      readonly cause?: unknown;
    },
  ) {
    super(message);
    this.name = "WorldMapSeedValidationError";
    this.filePath = options?.filePath;
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

type JsonFileReader = (filePath: string) => Promise<unknown>;

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

const WORLD_MAP_SCOUT_EVENT_TOKEN_BY_OUTCOME: Record<
  WorldMapScoutInteractionOutcome,
  readonly WorldMapScoutEventToken[]
> = {
  outcome_scout_dispatched: ["settlement_name", "target_tile_label"],
  outcome_scout_report_empty: ["target_tile_label"],
  outcome_scout_report_hostile: ["target_tile_label", "hostile_force_estimate"],
};

const WORLD_MAP_SCOUT_EVENT_CONTENT_KEY_BY_OUTCOME: Record<
  WorldMapScoutInteractionOutcome,
  WorldMapScoutEventContentKey
> = {
  outcome_scout_dispatched: "event.world.scout_dispatched",
  outcome_scout_report_empty: "event.world.scout_report_empty",
  outcome_scout_report_hostile: "event.world.scout_report_hostile",
};

const WORLD_MAP_SCOUT_OUTCOME_CODES = [
  "outcome_scout_dispatched",
  "outcome_scout_report_empty",
  "outcome_scout_report_hostile",
] as const;

const WORLD_MAP_SCOUT_EVENT_TOKENS = [
  "settlement_name",
  "target_tile_label",
  "hostile_force_estimate",
] as const;

const WORLD_MAP_SCOUT_EVENT_TOKEN_VALUES = [
  "event.world.scout_dispatched",
  "event.world.scout_report_empty",
  "event.world.scout_report_hostile",
] as const;

const defaultJsonFileReader: JsonFileReader = async (filePath) => {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new WorldMapSeedValidationError(`Failed to load JSON file '${filePath}'.`, {
      filePath,
      cause,
    });
  }
};

export const createDefaultWorldMapSeedFilePathsV1 = (
  repositoryRoot = process.cwd(),
): WorldMapTileSeedFilePathsV1 => ({
  worldMapTiles: join(repositoryRoot, "backend/src/app/config/seeds/v1/world-map-tile-seed-fixtures.json"),
  worldMapScoutEventTokens: join(
    repositoryRoot,
    "backend/src/app/config/seeds/v1/world-map-scout-event-token-fixtures.json",
  ),
  firstSlicePlayableManifest: join(
    repositoryRoot,
    "backend/src/app/config/seeds/v1/first-slice-playable-manifest.json",
  ),
});

export const loadWorldMapTileSeedTableV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<WorldMapTileSeedTableV1> =>
  parseWorldMapTileSeedTableV1(await readJson(filePath), filePath);

export const loadWorldMapScoutEventTokenSeedTableV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<WorldMapScoutEventTokenSeedTableV1> =>
  parseWorldMapScoutEventTokenSeedTableV1(await readJson(filePath), filePath);

export const loadWorldMapSeedBundleV1 = async (
  paths: WorldMapTileSeedFilePathsV1 = createDefaultWorldMapSeedFilePathsV1(),
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<WorldMapSeedBundleV1> => {
  const worldMapTiles = await loadWorldMapTileSeedTableV1(paths.worldMapTiles, readJson);
  const worldMapScoutEventTokens = await loadWorldMapScoutEventTokenSeedTableV1(
    paths.worldMapScoutEventTokens,
    readJson,
  );
  const firstSlicePlayableManifest = await loadFirstSlicePlayableManifestV1(
    paths.firstSlicePlayableManifest,
    readJson,
  );
  assertFirstSlicePlayableManifestSupportsDeterministicHostileFixtureV1(
    firstSlicePlayableManifest,
  );
  assertWorldMapSeedBundleMatchesPlayableManifestV1(
    worldMapTiles,
    firstSlicePlayableManifest,
  );

  return {
    world_map_tiles: worldMapTiles,
    world_map_scout_event_tokens: worldMapScoutEventTokens,
    first_slice_playable_manifest: firstSlicePlayableManifest,
  };
};

export const createWorldMapTileSnapshotKey = (
  settlementId: string,
  tileId: string,
): string => `${settlementId}::${tileId}`;

export const indexWorldMapTileSnapshotsBySettlementAndTileId = (
  rows: readonly WorldMapTileSnapshot[],
): Readonly<Record<string, WorldMapTileSnapshot>> => {
  const indexed: Record<string, WorldMapTileSnapshot> = {};
  for (const row of rows) {
    const key = createWorldMapTileSnapshotKey(row.settlement_id, row.tile_id);
    if (Object.prototype.hasOwnProperty.call(indexed, key)) {
      throw new WorldMapSeedValidationError(`Duplicate snapshot key '${key}'.`);
    }
    indexed[key] = row;
  }
  return indexed;
};

export const hydrateWorldMapTileStateRepositoryFromSeedRows = (
  repository: WorldMapTileStateRepository,
  rows: readonly WorldMapTileSnapshot[],
): void => {
  for (const row of rows) {
    repository.saveTileSnapshot({
      ...row,
      tile_revision: normalizeTileRevision(row.tile_revision),
    });
  }
};

export const parseWorldMapTileSeedTableV1 = (
  raw: unknown,
  filePath?: string,
): WorldMapTileSeedTableV1 =>
  parseSeedTableWithRows(
    raw,
    WORLD_MAP_TILES_TABLE_ID,
    filePath,
    parseWorldMapTileSeedRow,
    (row) => createWorldMapTileSnapshotKey(row.settlement_id, row.tile_id),
  );

export const parseWorldMapScoutEventTokenSeedTableV1 = (
  raw: unknown,
  filePath?: string,
): WorldMapScoutEventTokenSeedTableV1 =>
  parseSeedTableWithRows(
    raw,
    WORLD_MAP_SCOUT_EVENT_TOKENS_TABLE_ID,
    filePath,
    parseWorldMapScoutEventTokenSeedRow,
    (row) => row.outcome_code,
  );

function assertWorldMapSeedBundleMatchesPlayableManifestV1(
  worldMapTiles: WorldMapTileSeedTableV1,
  manifest: FirstSlicePlayableManifestV1,
): void {
  const primarySettlementId = manifest.canonical_playable_now.primary_settlement.settlement_id;
  const expectedTileIds = manifest.canonical_playable_now.map_fixture_ids.scout_tile_ids;
  const rowsForPrimarySettlement = worldMapTiles.rows.filter(
    (row) => row.settlement_id === primarySettlementId,
  );

  const actualTileIds = rowsForPrimarySettlement.map((row) => row.tile_id);
  assertExactSetMatch(
    "world_map_tiles.rows[*].tile_id",
    actualTileIds,
    expectedTileIds,
  );

  for (const row of worldMapTiles.rows) {
    if (row.settlement_id !== primarySettlementId) {
      throw new WorldMapSeedValidationError(
        `Manifest scope drift: world_map_tiles includes out-of-slice settlement_id '${row.settlement_id}'.`,
      );
    }
  }

  const hasHostileHintTile = rowsForPrimarySettlement.some(
    (row) => row.tile_state === "tile_state_hostile_hint",
  );
  if (!hasHostileHintTile) {
    throw new WorldMapSeedValidationError(
      "Manifest scope drift: world_map_tiles must include at least one tile_state_hostile_hint scout tile for first-slice hostile loop.",
    );
  }
}

function assertExactSetMatch(
  label: string,
  actual: readonly string[],
  expected: readonly string[],
): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((id) => !actualSet.has(id));
  const extra = [...actualSet].filter((id) => !expectedSet.has(id));
  if (missing.length > 0 || extra.length > 0) {
    throw new WorldMapSeedValidationError(
      `Manifest scope drift in '${label}': missing [${missing.join(", ")}], extra [${extra.join(", ")}].`,
    );
  }
}

function parseSeedTableWithRows<TRow extends Record<string, unknown>>(
  raw: unknown,
  expectedTableId: string,
  filePath: string | undefined,
  parseRow: (row: unknown, path: string) => TRow,
  getIdentity: (row: TRow) => string,
): {
  schema_version: typeof WORLD_MAP_SEED_SCHEMA_VERSION_V1;
  source_doc: string;
  source_section: string;
  table_id: string;
  rows: readonly TRow[];
} {
  const root = parseSeedTableMeta(raw, expectedTableId);
  const rowsRaw = asArray(readUnknown(root, "rows", "$"), "$.rows");
  if (rowsRaw.length === 0) {
    throw new WorldMapSeedValidationError(
      `Seed table '${expectedTableId}' must contain at least one row.`,
      { filePath },
    );
  }

  const rows: TRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rowsRaw.length; i += 1) {
    const row = parseRow(rowsRaw[i], `$.rows[${i}]`);
    const identity = getIdentity(row);
    if (seen.has(identity)) {
      throw new WorldMapSeedValidationError(
        `Duplicate seed row identity '${identity}' in '${expectedTableId}'.`,
        { filePath },
      );
    }
    seen.add(identity);
    rows.push(row);
  }

  return {
    schema_version: WORLD_MAP_SEED_SCHEMA_VERSION_V1,
    source_doc: readString(root, "source_doc", "$"),
    source_section: readString(root, "source_section", "$"),
    table_id: expectedTableId,
    rows,
  };
}

function parseSeedTableMeta(raw: unknown, expectedTableId: string): Record<string, unknown> {
  const root = asRecord(raw, "$");
  readLiteralString(root, "schema_version", WORLD_MAP_SEED_SCHEMA_VERSION_V1, "$");
  readLiteralString(root, "table_id", expectedTableId, "$");
  return root;
}

function parseWorldMapTileSeedRow(
  raw: unknown,
  path: string,
): WorldMapTileSnapshotSeedRow {
  const row = asRecord(raw, path);
  return {
    settlement_id: readStableId(row, "settlement_id", path),
    tile_id: readStableId(row, "tile_id", path),
    tile_state: readEnum(row, "tile_state", `${path}.tile_state`, WORLD_MAP_TILE_STATES),
    tile_revision: readTileRevision(row, "tile_revision", path),
    target_tile_label: readOptionalString(row, "target_tile_label", path),
    hostile_force_estimate: readOptionalString(row, "hostile_force_estimate", path),
  };
}

function parseWorldMapScoutEventTokenSeedRow(
  raw: unknown,
  path: string,
): WorldMapScoutEventTokenSeedRow {
  const row = asRecord(raw, path);
  const outcomeCode = readEnum(
    row,
    "outcome_code",
    `${path}.outcome_code`,
    WORLD_MAP_SCOUT_OUTCOME_CODES,
  );
  const contentKey = readEnum(
    row,
    "content_key",
    `${path}.content_key`,
    WORLD_MAP_SCOUT_EVENT_TOKEN_VALUES,
  );
  const requiredTokens = readTokenArray(row, "required_tokens", `${path}.required_tokens`);

  const expectedContentKey = WORLD_MAP_SCOUT_EVENT_CONTENT_KEY_BY_OUTCOME[outcomeCode];
  if (contentKey !== expectedContentKey) {
    throw new WorldMapSeedValidationError(
      `Unexpected event token content_key '${contentKey}' for outcome '${outcomeCode}' in '${path}.content_key'.`,
      {
        filePath: undefined,
        details: { outcome_code: outcomeCode, content_key: contentKey },
      },
    );
  }

  const expectedTokens = WORLD_MAP_SCOUT_EVENT_TOKEN_BY_OUTCOME[outcomeCode];
  if (!arraysMatch(expectedTokens, requiredTokens)) {
    throw new WorldMapSeedValidationError(
      `Unexpected required_tokens for outcome '${outcomeCode}' in '${path}.required_tokens'.`,
      {
        filePath: undefined,
        details: { expected_required_tokens: expectedTokens, provided_required_tokens: requiredTokens },
      },
    );
  }

  return {
    outcome_code: outcomeCode,
    content_key: contentKey,
    required_tokens: requiredTokens,
  };
}

function readUnknown(obj: Record<string, unknown>, field: string, path: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(obj, field)) {
    throw new WorldMapSeedValidationError(`Missing required field '${path}.${field}'.`);
  }
  return obj[field];
}

function readString(obj: Record<string, unknown>, field: string, path: string): string {
  const value = readUnknown(obj, field, path);
  if (typeof value !== "string") {
    throw new WorldMapSeedValidationError(
      `Field '${path}.${field}' must be a string (received ${describeType(value)}).`,
    );
  }
  if (value.trim().length === 0) {
    throw new WorldMapSeedValidationError(
      `Field '${path}.${field}' must not be empty.`,
    );
  }
  return value;
}

function readOptionalString(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(obj, field)) {
    return undefined;
  }
  return readString(obj, field, path);
}

function readStableId(obj: Record<string, unknown>, field: string, path: string): string {
  const value = readString(obj, field, path);
  if (!STABLE_ID_PATTERN.test(value)) {
    throw new WorldMapSeedValidationError(
      `Field '${path}.${field}' must be a stable snake_case identifier (received '${value}').`,
    );
  }
  return value;
}

function readTileRevision(obj: Record<string, unknown>, field: string, path: string): number {
  const value = readUnknown(obj, field, path);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new WorldMapSeedValidationError(
      `Field '${path}.${field}' must be a finite number (received ${describeType(value)}).`,
    );
  }
  const normalized = Math.trunc(value);
  if (normalized < 0) {
    throw new WorldMapSeedValidationError(
      `Field '${path}.${field}' must be a non-negative integer (received ${normalized}).`,
    );
  }
  return normalized;
}

function readLiteralString<TExpected extends string>(
  obj: Record<string, unknown>,
  field: string,
  expected: TExpected,
  path: string,
): TExpected {
  const value = readString(obj, field, path);
  if (value !== expected) {
    throw new WorldMapSeedValidationError(
      `Field '${path}.${field}' must equal '${expected}' (received '${value}').`,
    );
  }
  return expected;
}

function readEnum<TValue extends string>(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  allowed: readonly TValue[],
): TValue {
  const value = readString(obj, field, `${path.split(".").slice(0, -1).join(".") || "$"}`);
  if (!allowed.includes(value as TValue)) {
    throw new WorldMapSeedValidationError(
      `Field '${path}' must be one of [${allowed.join(", ")}] (received '${value}').`,
    );
  }
  return value as TValue;
}

function readTokenArray(obj: Record<string, unknown>, field: string, path: string): readonly WorldMapScoutEventToken[] {
  const raw = asArray(readUnknown(obj, field, path), `${path}`);
  if (raw.length === 0) {
    throw new WorldMapSeedValidationError(
      `Field '${path}' must contain at least one token.`,
    );
  }
  const seen = new Set<string>();
  const out: WorldMapScoutEventToken[] = [];

  for (let i = 0; i < raw.length; i += 1) {
    const value = raw[i];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new WorldMapSeedValidationError(
        `Field '${path}[${i}]' must be a non-empty string (received ${describeType(value)}).`,
      );
    }
    if (!WORLD_MAP_SCOUT_EVENT_TOKENS.includes(value as WorldMapScoutEventToken)) {
      throw new WorldMapSeedValidationError(
        `Field '${path}[${i}]' must be one of [${WORLD_MAP_SCOUT_EVENT_TOKENS.join(", ")}] (received '${value}').`,
      );
    }
    if (seen.has(value)) {
      throw new WorldMapSeedValidationError(
        `Field '${path}' contains duplicate token '${value}'.`,
      );
    }
    seen.add(value);
    out.push(value as WorldMapScoutEventToken);
  }
  return out;
}

function arraysMatch(
  left: readonly WorldMapScoutEventToken[],
  right: readonly WorldMapScoutEventToken[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new WorldMapSeedValidationError(
      `Expected object at '${path}' (received ${describeType(value)}).`,
    );
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new WorldMapSeedValidationError(
      `Expected array at '${path}' (received ${describeType(value)}).`,
    );
  }
  return value;
}

function normalizeTileRevision(value: number): number {
  const normalized = Math.trunc(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : 0;
}

function describeType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}
