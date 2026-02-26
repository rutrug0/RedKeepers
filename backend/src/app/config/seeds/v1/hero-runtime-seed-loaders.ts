import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  HERO_RUNTIME_EVENT_CONTENT_KEYS,
  HERO_RUNTIME_EVENT_TOKENS,
} from "../../../modules/heroes/domain";
import type {
  HeroRuntimeEventContentKey,
  HeroRuntimeEventToken,
  HeroRuntimeEventTokenizedPayload,
} from "../../../modules/heroes/domain";

export const HERO_RUNTIME_SEED_SCHEMA_VERSION_V1 = "rk-v1-hero-runtime-seed" as const;
export const HERO_RUNTIME_EVENT_TOKENS_TABLE_ID = "heroes.hero_runtime_event_tokens";

export interface HeroRuntimeSeedFilePathsV1 {
  readonly heroRuntimeEventTokens: string;
}

export interface HeroRuntimeEventTokenSeedRow {
  readonly event_key: HeroRuntimeEventContentKey;
  readonly required_tokens: readonly HeroRuntimeEventToken[];
}

export interface HeroRuntimeEventTokenSeedTableV1 {
  readonly schema_version: typeof HERO_RUNTIME_SEED_SCHEMA_VERSION_V1;
  readonly source_doc: string;
  readonly source_section: string;
  readonly table_id: typeof HERO_RUNTIME_EVENT_TOKENS_TABLE_ID;
  readonly rows: readonly HeroRuntimeEventTokenSeedRow[];
}

export class HeroRuntimeSeedValidationError extends Error {
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
    this.name = "HeroRuntimeSeedValidationError";
    this.filePath = options?.filePath;
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

type JsonFileReader = (filePath: string) => Promise<unknown>;

const HERO_RUNTIME_REQUIRED_TOKENS_BY_KEY: Record<
  HeroRuntimeEventContentKey,
  readonly HeroRuntimeEventToken[]
> = {
  "event.hero.assigned": [
    "hero_id",
    "assignment_context_type",
    "assignment_context_id",
  ],
  "event.hero.ability_activated": [
    "hero_id",
    "ability_id",
    "assignment_context_type",
    "assignment_context_id",
    "cooldown_ends_at",
  ],
  "event.hero.cooldown_complete": [
    "hero_id",
    "ability_id",
  ],
};

const defaultJsonFileReader: JsonFileReader = async (filePath) => {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new HeroRuntimeSeedValidationError(
      `Failed to load JSON file '${filePath}'.`,
      {
        filePath,
        cause,
      },
    );
  }
};

export const createDefaultHeroRuntimeSeedFilePathsV1 = (
  repositoryRoot = process.cwd(),
): HeroRuntimeSeedFilePathsV1 => ({
  heroRuntimeEventTokens: join(
    repositoryRoot,
    "backend/src/app/config/seeds/v1/hero-runtime-event-token-fixtures.json",
  ),
});

export const loadHeroRuntimeEventTokenSeedTableV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<HeroRuntimeEventTokenSeedTableV1> =>
  parseHeroRuntimeEventTokenSeedTableV1(await readJson(filePath), filePath);

export const parseHeroRuntimeEventTokenSeedTableV1 = (
  raw: unknown,
  filePath?: string,
): HeroRuntimeEventTokenSeedTableV1 => {
  const root = asRecord(raw, "$");
  readLiteralString(root, "schema_version", HERO_RUNTIME_SEED_SCHEMA_VERSION_V1, "$");
  readLiteralString(root, "table_id", HERO_RUNTIME_EVENT_TOKENS_TABLE_ID, "$");

  const rowsRaw = asArray(readUnknown(root, "rows", "$"), "$.rows");
  if (rowsRaw.length === 0) {
    throw new HeroRuntimeSeedValidationError(
      `Seed table '${HERO_RUNTIME_EVENT_TOKENS_TABLE_ID}' must contain at least one row.`,
      { filePath },
    );
  }

  const rows: HeroRuntimeEventTokenSeedRow[] = [];
  const seenEventKeys = new Set<HeroRuntimeEventContentKey>();
  for (let i = 0; i < rowsRaw.length; i += 1) {
    const path = `$.rows[${i}]`;
    const row = parseHeroRuntimeEventTokenSeedRow(rowsRaw[i], path);

    if (seenEventKeys.has(row.event_key)) {
      throw new HeroRuntimeSeedValidationError(
        `Duplicate seed row identity '${row.event_key}' in '${HERO_RUNTIME_EVENT_TOKENS_TABLE_ID}'.`,
        { filePath },
      );
    }

    seenEventKeys.add(row.event_key);
    rows.push(row);
  }

  for (const expectedEventKey of HERO_RUNTIME_EVENT_CONTENT_KEYS) {
    if (!seenEventKeys.has(expectedEventKey)) {
      throw new HeroRuntimeSeedValidationError(
        `Missing event token row for '${expectedEventKey}' in '${HERO_RUNTIME_EVENT_TOKENS_TABLE_ID}'.`,
        { filePath },
      );
    }
  }

  return {
    schema_version: HERO_RUNTIME_SEED_SCHEMA_VERSION_V1,
    source_doc: readString(root, "source_doc", "$"),
    source_section: readString(root, "source_section", "$"),
    table_id: HERO_RUNTIME_EVENT_TOKENS_TABLE_ID,
    rows,
  };
};

export const assertHeroRuntimeEventConformsToTokenFixture = (
  event: HeroRuntimeEventTokenizedPayload,
  table: HeroRuntimeEventTokenSeedTableV1,
): void => {
  const tableRow = table.rows.find((row) => row.event_key === event.content_key);
  if (tableRow === undefined) {
    throw new HeroRuntimeSeedValidationError(
      `No token fixture declared for event key '${event.content_key}'.`,
    );
  }

  const expectedTokens = [...tableRow.required_tokens];
  const actualTokens = Object.keys(event.tokens);

  for (const tokenName of actualTokens) {
    if (!expectedTokens.includes(tokenName as HeroRuntimeEventToken)) {
      throw new HeroRuntimeSeedValidationError(
        `Unexpected token '${tokenName}' for event key '${event.content_key}'.`,
        {
          details: {
            expected_tokens: expectedTokens,
            provided_tokens: actualTokens,
          },
        },
      );
    }
  }

  for (const tokenName of expectedTokens) {
    if (!Object.prototype.hasOwnProperty.call(event.tokens, tokenName)) {
      throw new HeroRuntimeSeedValidationError(
        `Missing required token '${tokenName}' for event key '${event.content_key}'.`,
        {
          details: {
            expected_tokens: expectedTokens,
            provided_tokens: actualTokens,
          },
        },
      );
    }

    const tokenValue = event.tokens[tokenName];
    if (typeof tokenValue !== "string" || tokenValue.trim().length === 0) {
      throw new HeroRuntimeSeedValidationError(
        `Token '${tokenName}' for event key '${event.content_key}' must be a non-empty string.`,
      );
    }
  }
};

function parseHeroRuntimeEventTokenSeedRow(
  raw: unknown,
  path: string,
): HeroRuntimeEventTokenSeedRow {
  const row = asRecord(raw, path);
  const eventKey = readEnum(
    row,
    "event_key",
    `${path}.event_key`,
    HERO_RUNTIME_EVENT_CONTENT_KEYS,
  );
  const requiredTokens = readTokenArray(
    row,
    "required_tokens",
    `${path}.required_tokens`,
  );
  const expectedTokens = HERO_RUNTIME_REQUIRED_TOKENS_BY_KEY[eventKey];

  if (!arraysMatch(expectedTokens, requiredTokens)) {
    throw new HeroRuntimeSeedValidationError(
      `Unexpected required_tokens for event_key '${eventKey}' in '${path}.required_tokens'.`,
      {
        details: {
          expected_required_tokens: expectedTokens,
          provided_required_tokens: requiredTokens,
        },
      },
    );
  }

  return {
    event_key: eventKey,
    required_tokens: requiredTokens,
  };
}

function readUnknown(obj: Record<string, unknown>, field: string, path: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(obj, field)) {
    throw new HeroRuntimeSeedValidationError(`Missing required field '${path}.${field}'.`);
  }
  return obj[field];
}

function readString(obj: Record<string, unknown>, field: string, path: string): string {
  const value = readUnknown(obj, field, path);
  if (typeof value !== "string") {
    throw new HeroRuntimeSeedValidationError(
      `Field '${path}.${field}' must be a string (received ${describeType(value)}).`,
    );
  }
  if (value.trim().length === 0) {
    throw new HeroRuntimeSeedValidationError(
      `Field '${path}.${field}' must not be empty.`,
    );
  }
  return value;
}

function readLiteralString<TExpected extends string>(
  obj: Record<string, unknown>,
  field: string,
  expected: TExpected,
  path: string,
): TExpected {
  const value = readString(obj, field, path);
  if (value !== expected) {
    throw new HeroRuntimeSeedValidationError(
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
  const parentPath = path.slice(0, Math.max(path.lastIndexOf("."), 0)) || "$";
  const value = readString(obj, field, parentPath);
  if (!allowed.includes(value as TValue)) {
    throw new HeroRuntimeSeedValidationError(
      `Field '${path}' must be one of [${allowed.join(", ")}] (received '${value}').`,
    );
  }
  return value as TValue;
}

function readTokenArray(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): readonly HeroRuntimeEventToken[] {
  const raw = asArray(readUnknown(obj, field, path), path);
  if (raw.length === 0) {
    throw new HeroRuntimeSeedValidationError(
      `Field '${path}' must contain at least one token.`,
    );
  }

  const seen = new Set<string>();
  const out: HeroRuntimeEventToken[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const value = raw[i];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new HeroRuntimeSeedValidationError(
        `Field '${path}[${i}]' must be a non-empty string (received ${describeType(value)}).`,
      );
    }
    if (!HERO_RUNTIME_EVENT_TOKENS.includes(value as HeroRuntimeEventToken)) {
      throw new HeroRuntimeSeedValidationError(
        `Field '${path}[${i}]' must be one of [${HERO_RUNTIME_EVENT_TOKENS.join(", ")}] (received '${value}').`,
      );
    }
    if (seen.has(value)) {
      throw new HeroRuntimeSeedValidationError(
        `Field '${path}' contains duplicate token '${value}'.`,
      );
    }
    seen.add(value);
    out.push(value as HeroRuntimeEventToken);
  }
  return out;
}

function arraysMatch(
  left: readonly HeroRuntimeEventToken[],
  right: readonly HeroRuntimeEventToken[],
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
    throw new HeroRuntimeSeedValidationError(
      `Expected object at '${path}' (received ${describeType(value)}).`,
    );
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new HeroRuntimeSeedValidationError(
      `Expected array at '${path}' (received ${describeType(value)}).`,
    );
  }
  return value;
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
