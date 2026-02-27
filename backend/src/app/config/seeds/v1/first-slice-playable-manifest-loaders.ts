import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const FIRST_SLICE_PLAYABLE_MANIFEST_SCHEMA_VERSION_V1 =
  "rk-v1-first-slice-playable-manifest" as const;

export type FirstSliceSeedSliceStatus =
  | "playable_now"
  | "balance_stub"
  | "data_stub_post_slice";

type ManifestStubDomain =
  | "civilizations"
  | "buildings"
  | "units"
  | "unit_variants"
  | "heroes";

export interface FirstSlicePlayableManifestFilePathsV1 {
  readonly firstSlicePlayableManifest: string;
}

export interface FirstSlicePlayableManifestV1 {
  readonly schema_version: typeof FIRST_SLICE_PLAYABLE_MANIFEST_SCHEMA_VERSION_V1;
  readonly manifest_id: string;
  readonly slice_id: string;
  readonly source_docs: readonly string[];
  readonly complexity_caps_locked: {
    readonly playable_civilization_profiles: number;
    readonly primary_settlements: number;
    readonly foreign_hostile_profiles: number;
    readonly core_resources: number;
    readonly playable_buildings: number;
    readonly playable_units: number;
    readonly map_interaction_flows: number;
  };
  readonly canonical_playable_now: {
    readonly civilization_profile_id: string;
    readonly primary_settlement: {
      readonly settlement_id: string;
      readonly settlement_name: string;
      readonly role: "player_primary";
    };
    readonly foreign_hostile_profile: {
      readonly profile_id: string;
      readonly settlement_id: string;
      readonly settlement_name: string;
      readonly owner_faction_id: string;
      readonly target_tile_label: string;
      readonly map_coordinate: {
        readonly x: number;
        readonly y: number;
      };
      readonly defender_garrison_strength: number;
    };
    readonly resources: readonly string[];
    readonly buildings: readonly string[];
    readonly units: readonly string[];
    readonly map_fixture_ids: {
      readonly world_id: string;
      readonly world_seed: string;
      readonly hostile_target_settlement_id: string;
      readonly scout_tile_ids: readonly string[];
      readonly deterministic_attack_fixture_ids: readonly string[];
    };
  };
  readonly stub_post_slice: readonly {
    readonly domain: ManifestStubDomain;
    readonly id: string;
    readonly source_slice_status: FirstSliceSeedSliceStatus;
    readonly stub_post_slice: true;
    readonly excluded_from_default_first_session_flow_reason: string;
  }[];
  readonly default_consumption_contract: {
    readonly backend: {
      readonly enable_only_civilization_ids: readonly string[];
      readonly enable_only_primary_settlement_ids: readonly string[];
      readonly enable_only_foreign_hostile_profile_ids: readonly string[];
      readonly hide_by_source_slice_status: readonly FirstSliceSeedSliceStatus[];
    };
    readonly frontend: {
      readonly default_session_entry_settlement_id: string;
      readonly default_hostile_target_settlement_id: string;
      readonly show_only_playable_resource_building_unit_sets: boolean;
      readonly hide_stub_post_slice_in_default_player_ui: boolean;
    };
    readonly content: {
      readonly scope_tag_for_default_first_session_flow: FirstSliceSeedSliceStatus;
      readonly suppress_stub_post_slice_in_starter_pools: boolean;
    };
  };
}

export class FirstSlicePlayableManifestValidationError extends Error {
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
    this.name = "FirstSlicePlayableManifestValidationError";
    this.filePath = options?.filePath;
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

type JsonFileReader = (filePath: string) => Promise<unknown>;
type JsonFileReaderSync = (filePath: string) => unknown;

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

const SLICE_STATUSES: readonly FirstSliceSeedSliceStatus[] = [
  "playable_now",
  "balance_stub",
  "data_stub_post_slice",
];

const STUB_DOMAINS: readonly ManifestStubDomain[] = [
  "civilizations",
  "buildings",
  "units",
  "unit_variants",
  "heroes",
];

const defaultJsonFileReader: JsonFileReader = async (filePath) => {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new FirstSlicePlayableManifestValidationError(
      `Failed to load JSON file '${filePath}'.`,
      {
        filePath,
        cause,
      },
    );
  }
};

const defaultJsonFileReaderSync: JsonFileReaderSync = (filePath) => {
  try {
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new FirstSlicePlayableManifestValidationError(
      `Failed to load JSON file '${filePath}'.`,
      {
        filePath,
        cause,
      },
    );
  }
};

export const createDefaultFirstSlicePlayableManifestFilePathsV1 = (
  repositoryRoot = process.cwd(),
): FirstSlicePlayableManifestFilePathsV1 => ({
  firstSlicePlayableManifest: join(
    repositoryRoot,
    "backend/src/app/config/seeds/v1/first-slice-playable-manifest.json",
  ),
});

export const loadFirstSlicePlayableManifestV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<FirstSlicePlayableManifestV1> =>
  parseFirstSlicePlayableManifestV1(await readJson(filePath), filePath);

export const loadFirstSlicePlayableManifestV1Sync = (
  filePath: string,
  readJson: JsonFileReaderSync = defaultJsonFileReaderSync,
): FirstSlicePlayableManifestV1 =>
  parseFirstSlicePlayableManifestV1(readJson(filePath), filePath);

export interface FirstSlicePlayableRuntimeBootstrapV1 {
  readonly civilization_profile_id: string;
  readonly primary_settlement: {
    readonly settlement_id: string;
    readonly settlement_name: string;
  };
  readonly foreign_hostile_profile: {
    readonly profile_id: string;
    readonly settlement_id: string;
    readonly settlement_name: string;
    readonly owner_faction_id: string;
    readonly target_tile_label: string;
    readonly map_coordinate: {
      readonly x: number;
      readonly y: number;
    };
    readonly defender_garrison_strength: number;
  };
  readonly world: {
    readonly world_id: string;
    readonly world_seed: string;
  };
  readonly scout_tile_ids: readonly string[];
  readonly deterministic_attack_fixture_ids: readonly string[];
}

export const createFirstSlicePlayableRuntimeBootstrapV1 = (
  manifest: FirstSlicePlayableManifestV1,
): FirstSlicePlayableRuntimeBootstrapV1 => {
  assertFirstSlicePlayableManifestSupportsDeterministicHostileFixtureV1(manifest);

  const canonical = manifest.canonical_playable_now;
  const backendContract = manifest.default_consumption_contract.backend;
  if (
    canonical.primary_settlement.settlement_id
      === canonical.foreign_hostile_profile.settlement_id
  ) {
    throw new FirstSlicePlayableManifestValidationError(
      "Manifest scope drift: canonical primary and foreign hostile settlements must be distinct.",
    );
  }

  if (
    backendContract.enable_only_primary_settlement_ids.length !== 1
    || backendContract.enable_only_primary_settlement_ids[0]
      !== canonical.primary_settlement.settlement_id
  ) {
    throw new FirstSlicePlayableManifestValidationError(
      "Manifest scope drift: bootstrap default settlement must be exactly one canonical primary settlement.",
    );
  }

  if (
    backendContract.enable_only_foreign_hostile_profile_ids.length !== 1
    || backendContract.enable_only_foreign_hostile_profile_ids[0]
      !== canonical.foreign_hostile_profile.profile_id
  ) {
    throw new FirstSlicePlayableManifestValidationError(
      "Manifest scope drift: bootstrap default hostile profile must be exactly one canonical foreign hostile profile.",
    );
  }

  const hiddenStatuses = new Set(backendContract.hide_by_source_slice_status);
  if (
    !hiddenStatuses.has("balance_stub")
    || !hiddenStatuses.has("data_stub_post_slice")
  ) {
    throw new FirstSlicePlayableManifestValidationError(
      "Manifest scope drift: backend default visibility must hide balance_stub and data_stub_post_slice statuses.",
    );
  }

  return {
    civilization_profile_id: canonical.civilization_profile_id,
    primary_settlement: {
      settlement_id: canonical.primary_settlement.settlement_id,
      settlement_name: canonical.primary_settlement.settlement_name,
    },
    foreign_hostile_profile: {
      profile_id: canonical.foreign_hostile_profile.profile_id,
      settlement_id: canonical.foreign_hostile_profile.settlement_id,
      settlement_name: canonical.foreign_hostile_profile.settlement_name,
      owner_faction_id: canonical.foreign_hostile_profile.owner_faction_id,
      target_tile_label: canonical.foreign_hostile_profile.target_tile_label,
      map_coordinate: {
        x: canonical.foreign_hostile_profile.map_coordinate.x,
        y: canonical.foreign_hostile_profile.map_coordinate.y,
      },
      defender_garrison_strength: canonical.foreign_hostile_profile.defender_garrison_strength,
    },
    world: {
      world_id: canonical.map_fixture_ids.world_id,
      world_seed: canonical.map_fixture_ids.world_seed,
    },
    scout_tile_ids: [...canonical.map_fixture_ids.scout_tile_ids],
    deterministic_attack_fixture_ids: [
      ...canonical.map_fixture_ids.deterministic_attack_fixture_ids,
    ],
  };
};

export const parseFirstSlicePlayableManifestV1 = (
  raw: unknown,
  filePath?: string,
): FirstSlicePlayableManifestV1 => {
  const root = asRecord(raw, "$");

  readLiteralString(
    root,
    "schema_version",
    FIRST_SLICE_PLAYABLE_MANIFEST_SCHEMA_VERSION_V1,
    "$",
  );
  const complexityCaps = parseComplexityCaps(readUnknown(root, "complexity_caps_locked", "$"));
  const canonical = parseCanonicalPlayableNow(readUnknown(root, "canonical_playable_now", "$"));
  const contract = parseDefaultConsumptionContract(
    readUnknown(root, "default_consumption_contract", "$"),
  );
  const stubPostSlice = parseStubPostSlice(readUnknown(root, "stub_post_slice", "$"));

  assertManifestConsistency({
    canonical,
    complexity_caps: complexityCaps,
    contract,
    filePath,
  });

  return {
    schema_version: FIRST_SLICE_PLAYABLE_MANIFEST_SCHEMA_VERSION_V1,
    manifest_id: readStableId(root, "manifest_id", "$"),
    slice_id: readStableId(root, "slice_id", "$"),
    source_docs: readStringArray(root, "source_docs", "$"),
    complexity_caps_locked: complexityCaps,
    canonical_playable_now: canonical,
    stub_post_slice: stubPostSlice,
    default_consumption_contract: contract,
  };
};

export const assertFirstSlicePlayableManifestSupportsDeterministicHostileFixtureV1 = (
  manifest: FirstSlicePlayableManifestV1,
): void => {
  const fixtureIds = manifest.canonical_playable_now.map_fixture_ids.deterministic_attack_fixture_ids;
  if (fixtureIds.length < 1) {
    throw new FirstSlicePlayableManifestValidationError(
      "Manifest must declare deterministic_attack_fixture_ids for first-slice hostile attack resolution.",
    );
  }

  const hostile = manifest.canonical_playable_now.foreign_hostile_profile;
  if (hostile.defender_garrison_strength < 1) {
    throw new FirstSlicePlayableManifestValidationError(
      "Manifest foreign hostile profile must define defender_garrison_strength >= 1.",
    );
  }
};

function parseComplexityCaps(raw: unknown): FirstSlicePlayableManifestV1["complexity_caps_locked"] {
  const caps = asRecord(raw, "$.complexity_caps_locked");
  return {
    playable_civilization_profiles: readInteger(caps, "playable_civilization_profiles", "$.complexity_caps_locked"),
    primary_settlements: readInteger(caps, "primary_settlements", "$.complexity_caps_locked"),
    foreign_hostile_profiles: readInteger(caps, "foreign_hostile_profiles", "$.complexity_caps_locked"),
    core_resources: readInteger(caps, "core_resources", "$.complexity_caps_locked"),
    playable_buildings: readInteger(caps, "playable_buildings", "$.complexity_caps_locked"),
    playable_units: readInteger(caps, "playable_units", "$.complexity_caps_locked"),
    map_interaction_flows: readInteger(caps, "map_interaction_flows", "$.complexity_caps_locked"),
  };
}

function parseCanonicalPlayableNow(raw: unknown): FirstSlicePlayableManifestV1["canonical_playable_now"] {
  const canonical = asRecord(raw, "$.canonical_playable_now");
  const primarySettlement = asRecord(
    readUnknown(canonical, "primary_settlement", "$.canonical_playable_now"),
    "$.canonical_playable_now.primary_settlement",
  );
  const foreignHostileProfile = asRecord(
    readUnknown(canonical, "foreign_hostile_profile", "$.canonical_playable_now"),
    "$.canonical_playable_now.foreign_hostile_profile",
  );
  const mapCoordinate = asRecord(
    readUnknown(foreignHostileProfile, "map_coordinate", "$.canonical_playable_now.foreign_hostile_profile"),
    "$.canonical_playable_now.foreign_hostile_profile.map_coordinate",
  );
  const mapFixtureIds = asRecord(
    readUnknown(canonical, "map_fixture_ids", "$.canonical_playable_now"),
    "$.canonical_playable_now.map_fixture_ids",
  );

  return {
    civilization_profile_id: readStableId(canonical, "civilization_profile_id", "$.canonical_playable_now"),
    primary_settlement: {
      settlement_id: readStableId(primarySettlement, "settlement_id", "$.canonical_playable_now.primary_settlement"),
      settlement_name: readString(primarySettlement, "settlement_name", "$.canonical_playable_now.primary_settlement"),
      role: readLiteralString(
        primarySettlement,
        "role",
        "player_primary",
        "$.canonical_playable_now.primary_settlement",
      ),
    },
    foreign_hostile_profile: {
      profile_id: readStableId(
        foreignHostileProfile,
        "profile_id",
        "$.canonical_playable_now.foreign_hostile_profile",
      ),
      settlement_id: readStableId(
        foreignHostileProfile,
        "settlement_id",
        "$.canonical_playable_now.foreign_hostile_profile",
      ),
      settlement_name: readString(
        foreignHostileProfile,
        "settlement_name",
        "$.canonical_playable_now.foreign_hostile_profile",
      ),
      owner_faction_id: readStableId(
        foreignHostileProfile,
        "owner_faction_id",
        "$.canonical_playable_now.foreign_hostile_profile",
      ),
      target_tile_label: readString(
        foreignHostileProfile,
        "target_tile_label",
        "$.canonical_playable_now.foreign_hostile_profile",
      ),
      map_coordinate: {
        x: readInteger(mapCoordinate, "x", "$.canonical_playable_now.foreign_hostile_profile.map_coordinate"),
        y: readInteger(mapCoordinate, "y", "$.canonical_playable_now.foreign_hostile_profile.map_coordinate"),
      },
      defender_garrison_strength: readInteger(
        foreignHostileProfile,
        "defender_garrison_strength",
        "$.canonical_playable_now.foreign_hostile_profile",
      ),
    },
    resources: readStableIdArray(canonical, "resources", "$.canonical_playable_now"),
    buildings: readStableIdArray(canonical, "buildings", "$.canonical_playable_now"),
    units: readStableIdArray(canonical, "units", "$.canonical_playable_now"),
    map_fixture_ids: {
      world_id: readStableId(mapFixtureIds, "world_id", "$.canonical_playable_now.map_fixture_ids"),
      world_seed: readStableId(mapFixtureIds, "world_seed", "$.canonical_playable_now.map_fixture_ids"),
      hostile_target_settlement_id: readStableId(
        mapFixtureIds,
        "hostile_target_settlement_id",
        "$.canonical_playable_now.map_fixture_ids",
      ),
      scout_tile_ids: readStableIdArray(mapFixtureIds, "scout_tile_ids", "$.canonical_playable_now.map_fixture_ids"),
      deterministic_attack_fixture_ids: readStableIdArray(
        mapFixtureIds,
        "deterministic_attack_fixture_ids",
        "$.canonical_playable_now.map_fixture_ids",
      ),
    },
  };
}

function parseDefaultConsumptionContract(
  raw: unknown,
): FirstSlicePlayableManifestV1["default_consumption_contract"] {
  const root = asRecord(raw, "$.default_consumption_contract");
  const backend = asRecord(readUnknown(root, "backend", "$.default_consumption_contract"), "$.default_consumption_contract.backend");
  const frontend = asRecord(readUnknown(root, "frontend", "$.default_consumption_contract"), "$.default_consumption_contract.frontend");
  const content = asRecord(readUnknown(root, "content", "$.default_consumption_contract"), "$.default_consumption_contract.content");

  return {
    backend: {
      enable_only_civilization_ids: readStableIdArray(
        backend,
        "enable_only_civilization_ids",
        "$.default_consumption_contract.backend",
      ),
      enable_only_primary_settlement_ids: readStableIdArray(
        backend,
        "enable_only_primary_settlement_ids",
        "$.default_consumption_contract.backend",
      ),
      enable_only_foreign_hostile_profile_ids: readStableIdArray(
        backend,
        "enable_only_foreign_hostile_profile_ids",
        "$.default_consumption_contract.backend",
      ),
      hide_by_source_slice_status: readEnumArray(
        backend,
        "hide_by_source_slice_status",
        "$.default_consumption_contract.backend",
        SLICE_STATUSES,
      ),
    },
    frontend: {
      default_session_entry_settlement_id: readStableId(
        frontend,
        "default_session_entry_settlement_id",
        "$.default_consumption_contract.frontend",
      ),
      default_hostile_target_settlement_id: readStableId(
        frontend,
        "default_hostile_target_settlement_id",
        "$.default_consumption_contract.frontend",
      ),
      show_only_playable_resource_building_unit_sets: readBoolean(
        frontend,
        "show_only_playable_resource_building_unit_sets",
        "$.default_consumption_contract.frontend",
      ),
      hide_stub_post_slice_in_default_player_ui: readBoolean(
        frontend,
        "hide_stub_post_slice_in_default_player_ui",
        "$.default_consumption_contract.frontend",
      ),
    },
    content: {
      scope_tag_for_default_first_session_flow: readEnum(
        content,
        "scope_tag_for_default_first_session_flow",
        "$.default_consumption_contract.content",
        ["playable_now"],
      ),
      suppress_stub_post_slice_in_starter_pools: readBoolean(
        content,
        "suppress_stub_post_slice_in_starter_pools",
        "$.default_consumption_contract.content",
      ),
    },
  };
}

function parseStubPostSlice(
  raw: unknown,
): FirstSlicePlayableManifestV1["stub_post_slice"] {
  const rows = asArray(raw, "$.stub_post_slice");
  const parsed: FirstSlicePlayableManifestV1["stub_post_slice"] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i += 1) {
    const path = `$.stub_post_slice[${i}]`;
    const row = asRecord(rows[i], path);
    const domain = readEnum(row, "domain", path, STUB_DOMAINS);
    const id = readStableId(row, "id", path);
    const key = `${domain}::${id}`;
    if (seen.has(key)) {
      throw new FirstSlicePlayableManifestValidationError(
        `Duplicate stub_post_slice identity '${key}'.`,
      );
    }
    seen.add(key);
    parsed.push({
      domain,
      id,
      source_slice_status: readEnum(row, "source_slice_status", path, SLICE_STATUSES),
      stub_post_slice: readLiteralBoolean(row, "stub_post_slice", true, path),
      excluded_from_default_first_session_flow_reason: readString(
        row,
        "excluded_from_default_first_session_flow_reason",
        path,
      ),
    });
  }
  return parsed;
}

function assertManifestConsistency(input: {
  readonly canonical: FirstSlicePlayableManifestV1["canonical_playable_now"];
  readonly complexity_caps: FirstSlicePlayableManifestV1["complexity_caps_locked"];
  readonly contract: FirstSlicePlayableManifestV1["default_consumption_contract"];
  readonly filePath?: string;
}): void {
  const canonical = input.canonical;
  const caps = input.complexity_caps;
  const contract = input.contract;

  if (caps.playable_civilization_profiles !== 1) {
    throw new FirstSlicePlayableManifestValidationError(
      `complexity_caps_locked.playable_civilization_profiles must equal 1 (received ${caps.playable_civilization_profiles}).`,
      { filePath: input.filePath },
    );
  }
  if (caps.primary_settlements !== 1) {
    throw new FirstSlicePlayableManifestValidationError(
      `complexity_caps_locked.primary_settlements must equal 1 (received ${caps.primary_settlements}).`,
      { filePath: input.filePath },
    );
  }
  if (caps.foreign_hostile_profiles !== 1) {
    throw new FirstSlicePlayableManifestValidationError(
      `complexity_caps_locked.foreign_hostile_profiles must equal 1 (received ${caps.foreign_hostile_profiles}).`,
      { filePath: input.filePath },
    );
  }

  assertExactCount("resources", canonical.resources, caps.core_resources);
  assertExactCount("buildings", canonical.buildings, caps.playable_buildings);
  assertExactCount("units", canonical.units, caps.playable_units);

  if (contract.backend.enable_only_civilization_ids.length !== 1) {
    throw new FirstSlicePlayableManifestValidationError(
      "default_consumption_contract.backend.enable_only_civilization_ids must contain exactly one civilization id.",
    );
  }
  if (contract.backend.enable_only_primary_settlement_ids.length !== 1) {
    throw new FirstSlicePlayableManifestValidationError(
      "default_consumption_contract.backend.enable_only_primary_settlement_ids must contain exactly one settlement id.",
    );
  }
  if (contract.backend.enable_only_foreign_hostile_profile_ids.length !== 1) {
    throw new FirstSlicePlayableManifestValidationError(
      "default_consumption_contract.backend.enable_only_foreign_hostile_profile_ids must contain exactly one hostile profile id.",
    );
  }

  if (
    contract.backend.enable_only_civilization_ids[0]
      !== canonical.civilization_profile_id
  ) {
    throw new FirstSlicePlayableManifestValidationError(
      "Manifest backend civilization contract diverges from canonical_playable_now.civilization_profile_id.",
    );
  }
  if (
    contract.backend.enable_only_primary_settlement_ids[0]
      !== canonical.primary_settlement.settlement_id
  ) {
    throw new FirstSlicePlayableManifestValidationError(
      "Manifest backend primary settlement contract diverges from canonical_playable_now.primary_settlement.settlement_id.",
    );
  }
  if (
    contract.backend.enable_only_foreign_hostile_profile_ids[0]
      !== canonical.foreign_hostile_profile.profile_id
  ) {
    throw new FirstSlicePlayableManifestValidationError(
      "Manifest backend hostile profile contract diverges from canonical_playable_now.foreign_hostile_profile.profile_id.",
    );
  }

  if (
    contract.frontend.default_session_entry_settlement_id
      !== canonical.primary_settlement.settlement_id
  ) {
    throw new FirstSlicePlayableManifestValidationError(
      "Manifest frontend default session settlement diverges from canonical primary settlement.",
    );
  }
  if (
    contract.frontend.default_hostile_target_settlement_id
      !== canonical.foreign_hostile_profile.settlement_id
  ) {
    throw new FirstSlicePlayableManifestValidationError(
      "Manifest frontend default hostile target diverges from canonical foreign hostile settlement id.",
    );
  }
  if (
    canonical.map_fixture_ids.hostile_target_settlement_id
      !== canonical.foreign_hostile_profile.settlement_id
  ) {
    throw new FirstSlicePlayableManifestValidationError(
      "Manifest map fixture hostile target settlement id diverges from canonical foreign hostile settlement id.",
    );
  }
}

function assertExactCount(
  label: string,
  values: readonly string[],
  expectedCount: number,
): void {
  if (values.length !== expectedCount) {
    throw new FirstSlicePlayableManifestValidationError(
      `canonical_playable_now.${label} count ${values.length} does not match complexity cap ${expectedCount}.`,
    );
  }
}

function readUnknown(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): unknown {
  if (!Object.prototype.hasOwnProperty.call(obj, field)) {
    throw new FirstSlicePlayableManifestValidationError(`Missing required field '${path}.${field}'.`);
  }
  return obj[field];
}

function readString(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): string {
  const value = readUnknown(obj, field, path);
  if (typeof value !== "string") {
    throw new FirstSlicePlayableManifestValidationError(
      `Field '${path}.${field}' must be a string (received ${describeType(value)}).`,
    );
  }
  if (value.trim().length === 0) {
    throw new FirstSlicePlayableManifestValidationError(
      `Field '${path}.${field}' must not be empty.`,
    );
  }
  return value;
}

function readStableId(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): string {
  const value = readString(obj, field, path);
  if (!STABLE_ID_PATTERN.test(value)) {
    throw new FirstSlicePlayableManifestValidationError(
      `Field '${path}.${field}' must be a stable snake_case identifier (received '${value}').`,
    );
  }
  return value;
}

function readStringArray(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): readonly string[] {
  const raw = asArray(readUnknown(obj, field, path), `${path}.${field}`);
  if (raw.length < 1) {
    throw new FirstSlicePlayableManifestValidationError(
      `Field '${path}.${field}' must contain at least one value.`,
    );
  }
  const out: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const value = raw[i];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new FirstSlicePlayableManifestValidationError(
        `Field '${path}.${field}[${i}]' must be a non-empty string (received ${describeType(value)}).`,
      );
    }
    out.push(value);
  }
  ensureNoDuplicates(out, `${path}.${field}`);
  return out;
}

function readStableIdArray(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): readonly string[] {
  const values = readStringArray(obj, field, path);
  for (let i = 0; i < values.length; i += 1) {
    if (!STABLE_ID_PATTERN.test(values[i])) {
      throw new FirstSlicePlayableManifestValidationError(
        `Field '${path}.${field}[${i}]' must be a stable snake_case identifier (received '${values[i]}').`,
      );
    }
  }
  return values;
}

function readInteger(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): number {
  const value = readUnknown(obj, field, path);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new FirstSlicePlayableManifestValidationError(
      `Field '${path}.${field}' must be a finite number (received ${describeType(value)}).`,
    );
  }
  const normalized = Math.trunc(value);
  if (normalized < 0) {
    throw new FirstSlicePlayableManifestValidationError(
      `Field '${path}.${field}' must be a non-negative integer.`,
    );
  }
  return normalized;
}

function readBoolean(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): boolean {
  const value = readUnknown(obj, field, path);
  if (typeof value !== "boolean") {
    throw new FirstSlicePlayableManifestValidationError(
      `Field '${path}.${field}' must be a boolean (received ${describeType(value)}).`,
    );
  }
  return value;
}

function readLiteralBoolean<TExpected extends boolean>(
  obj: Record<string, unknown>,
  field: string,
  expected: TExpected,
  path: string,
): TExpected {
  const value = readBoolean(obj, field, path);
  if (value !== expected) {
    throw new FirstSlicePlayableManifestValidationError(
      `Field '${path}.${field}' must equal '${String(expected)}' (received '${String(value)}').`,
    );
  }
  return expected;
}

function readLiteralString<TExpected extends string>(
  obj: Record<string, unknown>,
  field: string,
  expected: TExpected,
  path: string,
): TExpected {
  const value = readString(obj, field, path);
  if (value !== expected) {
    throw new FirstSlicePlayableManifestValidationError(
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
  const value = readString(obj, field, path);
  if (!allowed.includes(value as TValue)) {
    throw new FirstSlicePlayableManifestValidationError(
      `Field '${path}.${field}' must be one of [${allowed.join(", ")}] (received '${value}').`,
    );
  }
  return value as TValue;
}

function readEnumArray<TValue extends string>(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  allowed: readonly TValue[],
): readonly TValue[] {
  const raw = asArray(readUnknown(obj, field, path), `${path}.${field}`);
  const out: TValue[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const value = raw[i];
    if (typeof value !== "string" || !allowed.includes(value as TValue)) {
      throw new FirstSlicePlayableManifestValidationError(
        `Field '${path}.${field}[${i}]' must be one of [${allowed.join(", ")}] (received '${String(value)}').`,
      );
    }
    out.push(value as TValue);
  }
  ensureNoDuplicates(out, `${path}.${field}`);
  return out;
}

function ensureNoDuplicates(values: readonly string[], path: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new FirstSlicePlayableManifestValidationError(
        `Duplicate value '${value}' in '${path}'.`,
      );
    }
    seen.add(value);
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new FirstSlicePlayableManifestValidationError(
      `Expected object at '${path}' (received ${describeType(value)}).`,
    );
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new FirstSlicePlayableManifestValidationError(
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
