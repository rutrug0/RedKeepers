import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const NARRATIVE_SEED_SCHEMA_VERSION_V1 = "rk-v1-narrative-seed" as const;

export type NarrativeSliceStatusScope =
  | "playable_now"
  | "balance_stub"
  | "data_stub_post_slice";

export type NarrativeTableId =
  | "narrative.civilization_intros"
  | "narrative.starter_settlement_name_pool"
  | "narrative.event_feed_messages";

export interface NarrativeTemplateSeedTableMeta {
  readonly schema_version: typeof NARRATIVE_SEED_SCHEMA_VERSION_V1;
  readonly source_doc: string;
  readonly source_section: string;
  readonly table_id: NarrativeTableId;
}

export interface NarrativeTemplateSeedRow {
  readonly key: string;
  readonly slice_status_scope: NarrativeSliceStatusScope;
  readonly categories: readonly string[];
  readonly related_ids: readonly string[];
  readonly template: string;
  readonly tokens: readonly string[];
  readonly civ_id?: string;
  readonly name_category?: string;
  readonly event_category?: string;
  readonly notes?: string;
}

export interface NarrativeTemplateSeedTableV1<TRow extends NarrativeTemplateSeedRow>
  extends NarrativeTemplateSeedTableMeta {
  readonly rows: readonly TRow[];
}

export type CivilizationIntrosSeedV1 = NarrativeTemplateSeedTableV1<NarrativeTemplateSeedRow>;
export type StarterSettlementNamePoolSeedV1 =
  NarrativeTemplateSeedTableV1<NarrativeTemplateSeedRow>;
export type EventFeedMessagesSeedV1 = NarrativeTemplateSeedTableV1<NarrativeTemplateSeedRow>;

export interface NarrativeSeedFilePathsV1 {
  readonly civilizationIntros: string;
  readonly starterSettlementNamePool: string;
  readonly eventFeedMessages: string;
}

export interface LoadNarrativeSeedBundleV1 {
  readonly civilization_intros: CivilizationIntrosSeedV1;
  readonly starter_settlement_name_pool: StarterSettlementNamePoolSeedV1;
  readonly event_feed_messages: EventFeedMessagesSeedV1;
}

export class NarrativeSeedValidationError extends Error {
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
    this.name = "NarrativeSeedValidationError";
    this.filePath = options?.filePath;
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

type JsonFileReader = (filePath: string) => Promise<unknown>;

const SLICE_STATUSES: readonly NarrativeSliceStatusScope[] = [
  "playable_now",
  "balance_stub",
  "data_stub_post_slice",
];

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const NARRATIVE_KEY_PATTERN = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/;
const CATEGORY_PATTERN = /^[a-z0-9_]+$/;
const RELATED_ID_PATTERN = /^[a-z_]+:.+$/;
const STABLE_TOKEN_PATTERN = /^[a-z][a-z0-9_]*$/;

const defaultJsonFileReader: JsonFileReader = async (filePath) => {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new NarrativeSeedValidationError(`Failed to load JSON file '${filePath}'.`, {
      filePath,
      cause,
    });
  }
};

export const createDefaultNarrativeSeedFilePathsV1 = (
  repositoryRoot = process.cwd(),
): NarrativeSeedFilePathsV1 => ({
  civilizationIntros: join(
    repositoryRoot,
    "backend/src/app/config/seeds/v1/narrative/civilization-intros.json",
  ),
  starterSettlementNamePool: join(
    repositoryRoot,
    "backend/src/app/config/seeds/v1/narrative/starter-settlement-name-pool.json",
  ),
  eventFeedMessages: join(
    repositoryRoot,
    "backend/src/app/config/seeds/v1/narrative/event-feed-messages.json",
  ),
});

export const loadCivilizationIntrosSeedV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<CivilizationIntrosSeedV1> =>
  parseCivilizationIntrosSeedV1(await readJson(filePath));

export const loadStarterSettlementNamePoolSeedV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<StarterSettlementNamePoolSeedV1> =>
  parseStarterSettlementNamePoolSeedV1(await readJson(filePath));

export const loadEventFeedMessagesSeedV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<EventFeedMessagesSeedV1> =>
  parseEventFeedMessagesSeedV1(await readJson(filePath));

export const loadNarrativeSeedBundleV1 = async (
  paths: NarrativeSeedFilePathsV1 = createDefaultNarrativeSeedFilePathsV1(),
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<LoadNarrativeSeedBundleV1> => ({
  civilization_intros: await loadCivilizationIntrosSeedV1(paths.civilizationIntros, readJson),
  starter_settlement_name_pool: await loadStarterSettlementNamePoolSeedV1(
    paths.starterSettlementNamePool,
    readJson,
  ),
  event_feed_messages: await loadEventFeedMessagesSeedV1(paths.eventFeedMessages, readJson),
});

export const parseCivilizationIntrosSeedV1 = (
  raw: unknown,
): CivilizationIntrosSeedV1 =>
  parseNarrativeTemplateSeedTable(
    raw,
    "narrative.civilization_intros",
    parseNarrativeTemplateSeedRow,
  );

export const parseStarterSettlementNamePoolSeedV1 = (
  raw: unknown,
): StarterSettlementNamePoolSeedV1 =>
  parseNarrativeTemplateSeedTable(
    raw,
    "narrative.starter_settlement_name_pool",
    parseNarrativeTemplateSeedRow,
  );

export const parseEventFeedMessagesSeedV1 = (raw: unknown): EventFeedMessagesSeedV1 =>
  parseNarrativeTemplateSeedTable(
    raw,
    "narrative.event_feed_messages",
    parseNarrativeTemplateSeedRow,
  );

function parseNarrativeTemplateSeedTable<TRow extends NarrativeTemplateSeedRow>(
  raw: unknown,
  expectedTableId: NarrativeTableId,
  parseRow: (rawRow: unknown, path: string, tableId: NarrativeTableId) => TRow,
): NarrativeTemplateSeedTableV1<TRow> {
  const root = parseNarrativeSeedTableMeta(raw, expectedTableId);
  const rowsRaw = asArray(readUnknown(root, "rows", "$"), "$.rows");
  if (rowsRaw.length === 0) {
    throw new NarrativeSeedValidationError(
      `Field '$.rows' must contain at least one row in '${expectedTableId}'.`,
    );
  }
  const rows: TRow[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < rowsRaw.length; i += 1) {
    const row = parseRow(rowsRaw[i], `$.rows[${i}]`, expectedTableId);
    if (seenKeys.has(row.key)) {
      throw new NarrativeSeedValidationError(
        `Duplicate row key '${row.key}' in '${expectedTableId}'.`,
      );
    }
    seenKeys.add(row.key);
    rows.push(row);
  }

  return {
    schema_version: NARRATIVE_SEED_SCHEMA_VERSION_V1,
    source_doc: readString(root, "source_doc", "$"),
    source_section: readString(root, "source_section", "$"),
    table_id: expectedTableId,
    rows,
  };
};

function parseNarrativeTemplateSeedRow(
  raw: unknown,
  path: string,
  tableId: NarrativeTableId,
): NarrativeTemplateSeedRow {
  const row = asRecord(raw, path);
  const key = readNarrativeKey(row, "key", path);
  const slice_status_scope = readEnum(
    row,
    "slice_status_scope",
    path,
    SLICE_STATUSES,
  );
  const categories = readCategoryArray(row, "categories", path);
  const related_ids = readRelatedIdsArray(row, "related_ids", path);
  const template = readString(row, "template", path);
  const tokens = readTokenArray(row, "tokens", `${path}`);
  validateTemplateTokenConsistency(template, tokens, key, tableId);

  let civ_id: string | undefined;
  let name_category: string | undefined;
  let event_category: string | undefined;
  let notes: string | undefined;

  if (hasOwn(row, "civ_id")) {
    civ_id = readStableId(row, "civ_id", path, STABLE_ID_PATTERN);
  }
  if (hasOwn(row, "name_category")) {
    name_category = readString(row, "name_category", `${path}`);
    assertPattern(name_category, STABLE_ID_PATTERN, "name_category", `${path}.name_category`);
  }
  if (hasOwn(row, "event_category")) {
    event_category = readString(row, "event_category", `${path}`);
    assertPattern(
      event_category,
      STABLE_ID_PATTERN,
      "event_category",
      `${path}.event_category`,
    );
  }
  if (hasOwn(row, "notes")) {
    notes = readString(row, "notes", `${path}`);
  }

  return {
    key,
    slice_status_scope,
    categories,
    related_ids,
    template,
    tokens,
    ...(civ_id === undefined ? {} : { civ_id }),
    ...(name_category === undefined ? {} : { name_category }),
    ...(event_category === undefined ? {} : { event_category }),
    ...(notes === undefined ? {} : { notes }),
  };
}

function parseNarrativeSeedTableMeta(
  raw: unknown,
  expectedTableId: NarrativeTableId,
): Record<string, unknown> {
  const root = asRecord(raw, "$");
  readLiteralString(
    root,
    "schema_version",
    NARRATIVE_SEED_SCHEMA_VERSION_V1,
    "$",
  );
  readLiteralString(root, "table_id", expectedTableId, "$");
  readString(root, "source_doc", "$");
  readString(root, "source_section", "$");
  return root;
}

function validateTemplateTokenConsistency(
  template: string,
  tokens: readonly string[],
  rowKey: string,
  tableId: string,
): void {
  const templateTokens = extractTemplateTokens(template);
  if (
    templateTokens.length !== tokens.length ||
    templateTokens.some((token, index) => token !== tokens[index])
  ) {
    throw new NarrativeSeedValidationError(
      `Template token mismatch for row '${rowKey}' in '${tableId}'. Expected token order ${JSON.stringify(
        templateTokens,
      )} but got ${JSON.stringify(tokens)}.`,
    );
  }
}

function extractTemplateTokens(template: string): string[] {
  const templateTokenPattern = /\{([a-z][a-z0-9_]*)\}/g;
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const match of template.matchAll(templateTokenPattern)) {
    const token = match[1];
    if (!seen.has(token)) {
      tokens.push(token);
      seen.add(token);
    }
  }
  return tokens;
}

function readUnknown(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): unknown {
  if (!hasOwn(obj, field)) {
    throw new NarrativeSeedValidationError(`Missing required field '${path}.${field}'.`);
  }
  return obj[field];
}

function readString(obj: Record<string, unknown>, field: string, path: string): string {
  const value = readUnknown(obj, field, path);
  if (typeof value !== "string") {
    throw new NarrativeSeedValidationError(
      `Field '${path}.${field}' must be a string (received ${describeType(value)}).`,
    );
  }
  if (value.trim().length === 0) {
    throw new NarrativeSeedValidationError(`Field '${path}.${field}' must not be empty.`);
  }
  return value;
}

function readLiteralString(
  obj: Record<string, unknown>,
  field: string,
  expected: string,
  path: string,
): void {
  const value = readString(obj, field, path);
  if (value !== expected) {
    throw new NarrativeSeedValidationError(
      `Field '${path}.${field}' must equal '${expected}' (received '${value}').`,
    );
  }
}

function readNarrativeKey(obj: Record<string, unknown>, field: string, path: string): string {
  const value = readString(obj, field, path);
  assertPattern(value, NARRATIVE_KEY_PATTERN, field, `${path}.${field}`);
  return value;
}

function readStableId(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  pattern: RegExp,
): string {
  const value = readString(obj, field, path);
  assertPattern(value, pattern, field, `${path}.${field}`);
  return value;
}

function readEnum<TValue extends string>(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  allowed: readonly TValue[],
): TValue {
  const value = readString(obj, field, path);
  if (!allowed.includes(value as TValue)) {
    throw new NarrativeSeedValidationError(
      `Field '${path}.${field}' must be one of [${allowed.join(", ")}] (received '${value}').`,
    );
  }
  return value as TValue;
}

function readCategoryArray(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): readonly string[] {
  const raw = asArray(readUnknown(obj, field, path), `${path}.${field}`);
  if (raw.length === 0) {
    throw new NarrativeSeedValidationError(
      `Field '${path}.${field}' must contain at least one value.`,
    );
  }
  const out: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const value = raw[i];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new NarrativeSeedValidationError(
        `Field '${path}.${field}[${i}]' must be a non-empty string (received ${describeType(value)}).`,
      );
    }
    assertPattern(value, CATEGORY_PATTERN, `${field}[${i}]`, `${path}.${field}[${i}]`);
    out.push(value);
  }
  ensureNoDuplicateStrings(out, `${path}.${field}`);
  return out;
}

function readRelatedIdsArray(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): readonly string[] {
  const raw = asArray(readUnknown(obj, field, path), `${path}.${field}`);
  if (raw.length === 0) {
    throw new NarrativeSeedValidationError(
      `Field '${path}.${field}' must contain at least one value.`,
    );
  }
  const out: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const value = raw[i];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new NarrativeSeedValidationError(
        `Field '${path}.${field}[${i}]' must be a non-empty string (received ${describeType(value)}).`,
      );
    }
    assertPattern(value, RELATED_ID_PATTERN, `${field}[${i}]`, `${path}.${field}[${i}]`);
    out.push(value);
  }
  ensureNoDuplicateStrings(out, `${path}.${field}`);
  return out;
}

function readTokenArray(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): readonly string[] {
  const raw = asArray(readUnknown(obj, field, path), `${path}.${field}`);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const value = raw[i];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new NarrativeSeedValidationError(
        `Field '${path}.${field}[${i}]' must be a non-empty string (received ${describeType(value)}).`,
      );
    }
    assertPattern(value, STABLE_TOKEN_PATTERN, `${field}[${i}]`, `${path}.${field}[${i}]`);
    out.push(value);
  }
  ensureNoDuplicateStrings(out, `${path}.${field}`);
  return out;
}

function assertPattern(value: string, pattern: RegExp, field: string, path: string): void {
  if (!pattern.test(value)) {
    throw new NarrativeSeedValidationError(
      `Field '${path}' must match '${field}' pattern '${pattern}'.`,
    );
  }
}

function ensureNoDuplicateStrings(values: readonly string[], path: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new NarrativeSeedValidationError(`Duplicate value '${value}' in '${path}'.`);
    }
    seen.add(value);
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new NarrativeSeedValidationError(
      `Expected object at '${path}' (received ${describeType(value)}).`,
    );
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new NarrativeSeedValidationError(
      `Expected array at '${path}' (received ${describeType(value)}).`,
    );
  }
  return value;
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
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
