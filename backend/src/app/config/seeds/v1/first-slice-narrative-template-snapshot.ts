import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createDefaultNarrativeSeedFilePathsV1,
  loadNarrativeSeedBundleV1,
  type EventFeedMessagesSeedV1,
  type LoadNarrativeSeedBundleV1,
  type NarrativeSeedFilePathsV1,
  type NarrativeSliceStatusScope,
} from "./narrative-seed-loaders.ts";

export const FIRST_SLICE_CONTENT_KEY_MANIFEST_SCHEMA_VERSION_V1 =
  "rk-v1-first-slice-content-key-manifest" as const;
export const FIRST_SLICE_NARRATIVE_TEMPLATE_SNAPSHOT_SCHEMA_VERSION_V1 =
  "rk-v1-first-slice-narrative-template-snapshot" as const;
export const FIRST_SLICE_NARRATIVE_TEMPLATE_SNAPSHOT_ID_V1 =
  "first_slice_narrative_template_snapshot_v1" as const;

type JsonFileReader = (filePath: string) => Promise<unknown>;

type FirstSliceDefaultResolutionToken =
  | "canonical_key"
  | "legacy_keys_in_declared_order";

interface FirstSliceDefaultSeedUsageV1 {
  readonly include_slice_status_scopes: readonly NarrativeSliceStatusScope[];
  readonly exclude_slice_status_scopes: readonly NarrativeSliceStatusScope[];
  readonly include_only_content_keys: readonly string[];
}

interface FirstSliceLoopRequiredKeysV1 {
  readonly tick: readonly string[];
  readonly build: readonly string[];
  readonly train: readonly string[];
  readonly scout: readonly string[];
  readonly hostile_dispatch_and_resolve: readonly string[];
}

interface FirstSliceLegacyAliasMappingRowV1 {
  readonly canonical_key: string;
  readonly legacy_keys: readonly string[];
}

interface FirstSliceDeferredPostSliceKeyRowV1 {
  readonly key: string;
  readonly source_slice_status: NarrativeSliceStatusScope;
  readonly present_in_event_feed_seed: boolean;
  readonly excluded_from_default_first_slice_seed_usage: boolean;
  readonly reason: string;
}

interface FirstSliceAliasLookupContractV1 {
  readonly deterministic_resolution_order: readonly FirstSliceDefaultResolutionToken[];
  readonly direct_default_selection_excludes_legacy_alias_only_keys: boolean;
}

type FirstSliceObjectiveLoopStepKeyV1 =
  | "tick"
  | "build"
  | "train"
  | "scout"
  | "attack"
  | "resolve";

type FirstSliceNegativeStateFamilyV1 =
  | "insufficient_resources"
  | "cooldown"
  | "invalid_target"
  | "combat_loss";

interface FirstSliceObjectiveStepOutcomeContractRowV1 {
  readonly objective_id: string;
  readonly loop_step: FirstSliceObjectiveLoopStepKeyV1;
  readonly success_canonical_keys: readonly string[];
  readonly negative_canonical_keys: readonly string[];
  readonly required_negative_state_families: readonly FirstSliceNegativeStateFamilyV1[];
}

interface FirstSliceObjectiveCanonicalTokenContractRowV1 {
  readonly canonical_key: string;
  readonly required_tokens: readonly string[];
}

export interface FirstSliceContentKeyManifestV1 {
  readonly schema_version: typeof FIRST_SLICE_CONTENT_KEY_MANIFEST_SCHEMA_VERSION_V1;
  readonly manifest_id: string;
  readonly slice_id: string;
  readonly source_docs: readonly string[];
  readonly default_first_slice_seed_usage: FirstSliceDefaultSeedUsageV1;
  readonly loop_required_keys: FirstSliceLoopRequiredKeysV1;
  readonly compatibility_alias_only_keys: readonly string[];
  readonly legacy_alias_mapping: readonly FirstSliceLegacyAliasMappingRowV1[];
  readonly alias_lookup_contract: FirstSliceAliasLookupContractV1;
  readonly deferred_post_slice_keys: readonly FirstSliceDeferredPostSliceKeyRowV1[];
}

const FIRST_SLICE_OBJECTIVE_STEP_OUTCOME_CONTRACT_V1: readonly FirstSliceObjectiveStepOutcomeContractRowV1[] = [
  {
    objective_id: "first_session.tick.observe_income.v1",
    loop_step: "tick",
    success_canonical_keys: [
      "event.tick.passive_income",
      "event.tick.passive_gain_success",
    ],
    negative_canonical_keys: [
      "event.tick.passive_gain_stalled",
    ],
    required_negative_state_families: [],
  },
  {
    objective_id: "first_session.build.complete_first_upgrade.v1",
    loop_step: "build",
    success_canonical_keys: [
      "event.build.upgrade_started",
      "event.build.upgrade_completed",
    ],
    negative_canonical_keys: [
      "event.build.failure_insufficient_resources",
    ],
    required_negative_state_families: ["insufficient_resources"],
  },
  {
    objective_id: "first_session.train.complete_first_batch.v1",
    loop_step: "train",
    success_canonical_keys: [
      "event.train.started",
      "event.train.completed",
    ],
    negative_canonical_keys: [
      "event.train.failure_cooldown",
    ],
    required_negative_state_families: ["cooldown"],
  },
  {
    objective_id: "first_session.scout.confirm_hostile_target.v1",
    loop_step: "scout",
    success_canonical_keys: [
      "event.scout.dispatched_success",
      "event.scout.return_hostile",
    ],
    negative_canonical_keys: [
      "event.scout.return_empty",
    ],
    required_negative_state_families: [],
  },
  {
    objective_id: "first_session.attack.dispatch_hostile_march.v1",
    loop_step: "attack",
    success_canonical_keys: [
      "event.world.hostile_dispatch_accepted",
      "event.world.hostile_dispatch_en_route",
      "event.world.hostile_march_arrived_outer_works",
    ],
    negative_canonical_keys: [
      "event.world.hostile_dispatch_target_required",
      "event.world.hostile_dispatch_failed_source_target_not_foreign",
    ],
    required_negative_state_families: ["invalid_target"],
  },
  {
    objective_id: "first_session.resolve_hostile_outcome.v1",
    loop_step: "resolve",
    success_canonical_keys: [
      "event.combat.hostile_resolve_attacker_win",
    ],
    negative_canonical_keys: [
      "event.combat.hostile_resolve_defender_win",
      "event.combat.hostile_loss_report",
    ],
    required_negative_state_families: ["combat_loss"],
  },
];

const FIRST_SLICE_OBJECTIVE_CANONICAL_TOKEN_CONTRACT_V1: readonly FirstSliceObjectiveCanonicalTokenContractRowV1[] = [
  {
    canonical_key: "event.tick.passive_income",
    required_tokens: ["settlement_name", "food_gain", "wood_gain", "stone_gain", "iron_gain"],
  },
  {
    canonical_key: "event.tick.passive_gain_success",
    required_tokens: ["settlement_name", "duration_ms"],
  },
  {
    canonical_key: "event.tick.passive_gain_stalled",
    required_tokens: ["settlement_name", "duration_ms"],
  },
  {
    canonical_key: "event.build.upgrade_started",
    required_tokens: ["settlement_name", "building_label", "from_level", "to_level"],
  },
  {
    canonical_key: "event.build.upgrade_completed",
    required_tokens: ["settlement_name", "building_label", "new_level"],
  },
  {
    canonical_key: "event.build.failure_insufficient_resources",
    required_tokens: [
      "building_id",
      "missing_resources_by_id",
      "required_cost_by_id",
      "available_stock_by_id",
    ],
  },
  {
    canonical_key: "event.train.started",
    required_tokens: ["settlement_name", "quantity", "unit_label"],
  },
  {
    canonical_key: "event.train.completed",
    required_tokens: ["settlement_name", "quantity", "unit_label"],
  },
  {
    canonical_key: "event.train.failure_cooldown",
    required_tokens: ["unit_id", "queue_available_at", "cooldown_remaining_ms"],
  },
  {
    canonical_key: "event.scout.dispatched_success",
    required_tokens: ["settlement_name", "target_tile_label"],
  },
  {
    canonical_key: "event.scout.return_hostile",
    required_tokens: ["target_tile_label", "hostile_force_estimate"],
  },
  {
    canonical_key: "event.scout.return_empty",
    required_tokens: ["target_tile_label"],
  },
  {
    canonical_key: "event.world.hostile_dispatch_accepted",
    required_tokens: ["army_name", "origin_settlement_name", "target_tile_label"],
  },
  {
    canonical_key: "event.world.hostile_dispatch_en_route",
    required_tokens: ["army_name", "target_tile_label", "eta_seconds"],
  },
  {
    canonical_key: "event.world.hostile_march_arrived_outer_works",
    required_tokens: ["army_name", "target_tile_label"],
  },
  {
    canonical_key: "event.world.hostile_dispatch_target_required",
    required_tokens: [],
  },
  {
    canonical_key: "event.world.hostile_dispatch_failed_source_target_not_foreign",
    required_tokens: ["source_settlement_name"],
  },
  {
    canonical_key: "event.combat.hostile_resolve_attacker_win",
    required_tokens: ["army_name", "target_tile_label"],
  },
  {
    canonical_key: "event.combat.hostile_resolve_defender_win",
    required_tokens: ["army_name", "target_tile_label"],
  },
  {
    canonical_key: "event.combat.hostile_loss_report",
    required_tokens: [
      "attacker_units_lost",
      "attacker_units_dispatched",
      "defender_garrison_lost",
      "defender_strength",
    ],
  },
];

export interface FirstSliceNarrativeTemplateSnapshotEntryV1 {
  readonly key: string;
  readonly template: string;
  readonly tokens: readonly string[];
}

export interface FirstSliceNarrativeTemplateLookupOrderByCanonicalRowV1 {
  readonly canonical_key: string;
  readonly resolution_order: readonly string[];
}

export interface FirstSliceNarrativeTemplateSnapshotV1 {
  readonly schema_version: typeof FIRST_SLICE_NARRATIVE_TEMPLATE_SNAPSHOT_SCHEMA_VERSION_V1;
  readonly snapshot_id: typeof FIRST_SLICE_NARRATIVE_TEMPLATE_SNAPSHOT_ID_V1;
  readonly manifest_id: string;
  readonly slice_id: string;
  readonly source_docs: readonly string[];
  readonly default_first_session: {
    readonly canonical_keys: readonly string[];
    readonly supported_legacy_alias_keys: readonly string[];
    readonly lookup_resolution_order_by_canonical_key: readonly FirstSliceNarrativeTemplateLookupOrderByCanonicalRowV1[];
    readonly templates_by_key: Readonly<Record<string, FirstSliceNarrativeTemplateSnapshotEntryV1>>;
  };
  readonly excluded_deferred_post_slice_keys: readonly string[];
}

export interface FirstSliceNarrativeTemplateSnapshotFilePathsV1 {
  readonly narrative_seed_paths?: NarrativeSeedFilePathsV1;
  readonly first_slice_content_key_manifest_path?: string;
  readonly first_slice_narrative_template_snapshot_lock_path?: string;
}

export interface ValidateFirstSliceNarrativeTemplateSnapshotLockV1Input {
  readonly narrative_seed_bundle: LoadNarrativeSeedBundleV1;
  readonly first_slice_content_key_manifest: FirstSliceContentKeyManifestV1;
  readonly locked_snapshot?: FirstSliceNarrativeTemplateSnapshotV1;
}

export interface FirstSliceNarrativeTemplateSnapshotLockValidationResultV1 {
  readonly narrative_seed_bundle: LoadNarrativeSeedBundleV1;
  readonly first_slice_content_key_manifest: FirstSliceContentKeyManifestV1;
  readonly snapshot: FirstSliceNarrativeTemplateSnapshotV1;
}

export class FirstSliceNarrativeTemplateSnapshotValidationError extends Error {
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
    this.name = "FirstSliceNarrativeTemplateSnapshotValidationError";
    this.filePath = options?.filePath;
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

const SLICE_STATUSES: readonly NarrativeSliceStatusScope[] = [
  "playable_now",
  "balance_stub",
  "data_stub_post_slice",
];
const STABLE_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const CONTENT_KEY_PATTERN = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/;
const TOKEN_PATTERN = /^[a-z][a-z0-9_]*$/;

const defaultJsonFileReader: JsonFileReader = async (filePath) => {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `Failed to load JSON file '${filePath}'.`,
      {
        filePath,
        cause,
      },
    );
  }
};

export const createDefaultFirstSliceNarrativeTemplateSnapshotFilePathsV1 = (
  repositoryRoot = process.cwd(),
): FirstSliceNarrativeTemplateSnapshotFilePathsV1 => ({
  narrative_seed_paths: createDefaultNarrativeSeedFilePathsV1(repositoryRoot),
  first_slice_content_key_manifest_path: join(
    repositoryRoot,
    "backend/src/app/config/seeds/v1/narrative/first-slice-content-key-manifest.json",
  ),
  first_slice_narrative_template_snapshot_lock_path: join(
    repositoryRoot,
    "backend/src/app/config/seeds/v1/narrative/first-slice-narrative-template-snapshot.lock.json",
  ),
});

export const loadFirstSliceContentKeyManifestV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<FirstSliceContentKeyManifestV1> =>
  parseFirstSliceContentKeyManifestV1(await readJson(filePath), filePath);

export const loadFirstSliceNarrativeTemplateSnapshotLockV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<FirstSliceNarrativeTemplateSnapshotV1> =>
  parseFirstSliceNarrativeTemplateSnapshotLockV1(await readJson(filePath), filePath);

export const loadAndValidateFirstSliceNarrativeTemplateSnapshotLockV1 = async (
  paths: FirstSliceNarrativeTemplateSnapshotFilePathsV1 = createDefaultFirstSliceNarrativeTemplateSnapshotFilePathsV1(),
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<FirstSliceNarrativeTemplateSnapshotLockValidationResultV1> => {
  const defaults = createDefaultFirstSliceNarrativeTemplateSnapshotFilePathsV1();
  const narrativeSeedBundle = await loadNarrativeSeedBundleV1(
    paths.narrative_seed_paths ?? defaults.narrative_seed_paths ?? createDefaultNarrativeSeedFilePathsV1(),
    readJson,
  );
  const contentKeyManifest = await loadFirstSliceContentKeyManifestV1(
    paths.first_slice_content_key_manifest_path
      ?? defaults.first_slice_content_key_manifest_path!,
    readJson,
  );
  const lockedSnapshot = await loadFirstSliceNarrativeTemplateSnapshotLockV1(
    paths.first_slice_narrative_template_snapshot_lock_path
      ?? defaults.first_slice_narrative_template_snapshot_lock_path!,
    readJson,
  );

  const snapshot = validateFirstSliceNarrativeTemplateSnapshotLockV1({
    narrative_seed_bundle: narrativeSeedBundle,
    first_slice_content_key_manifest: contentKeyManifest,
    locked_snapshot: lockedSnapshot,
  });

  return {
    narrative_seed_bundle: narrativeSeedBundle,
    first_slice_content_key_manifest: contentKeyManifest,
    snapshot,
  };
};

export const validateFirstSliceNarrativeTemplateSnapshotLockV1 = (
  input: ValidateFirstSliceNarrativeTemplateSnapshotLockV1Input,
): FirstSliceNarrativeTemplateSnapshotV1 => {
  const expectedSnapshot = createFirstSliceNarrativeTemplateSnapshotV1({
    narrative_seed_bundle: input.narrative_seed_bundle,
    first_slice_content_key_manifest: input.first_slice_content_key_manifest,
  });

  if (input.locked_snapshot === undefined) {
    return expectedSnapshot;
  }

  assertExactValueMatch(
    "snapshot_id",
    input.locked_snapshot.snapshot_id,
    expectedSnapshot.snapshot_id,
  );
  assertExactValueMatch(
    "manifest_id",
    input.locked_snapshot.manifest_id,
    expectedSnapshot.manifest_id,
  );
  assertExactValueMatch(
    "slice_id",
    input.locked_snapshot.slice_id,
    expectedSnapshot.slice_id,
  );
  assertExactArrayMatch(
    "default_first_session.canonical_keys",
    input.locked_snapshot.default_first_session.canonical_keys,
    expectedSnapshot.default_first_session.canonical_keys,
  );
  assertExactSetMatch(
    "default_first_session.supported_legacy_alias_keys",
    input.locked_snapshot.default_first_session.supported_legacy_alias_keys,
    expectedSnapshot.default_first_session.supported_legacy_alias_keys,
  );
  assertExactSetMatch(
    "excluded_deferred_post_slice_keys",
    input.locked_snapshot.excluded_deferred_post_slice_keys,
    expectedSnapshot.excluded_deferred_post_slice_keys,
  );

  const lockedLookupByCanonical = new Map(
    input.locked_snapshot.default_first_session.lookup_resolution_order_by_canonical_key.map(
      (row) => [row.canonical_key, row.resolution_order] as const,
    ),
  );
  for (const expectedRow of expectedSnapshot.default_first_session.lookup_resolution_order_by_canonical_key) {
    const lockedResolutionOrder = lockedLookupByCanonical.get(expectedRow.canonical_key);
    if (lockedResolutionOrder === undefined) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Snapshot lock drift: missing lookup row for canonical key '${expectedRow.canonical_key}'.`,
      );
    }
    assertExactArrayMatch(
      `lookup_resolution_order.${expectedRow.canonical_key}`,
      lockedResolutionOrder,
      expectedRow.resolution_order,
    );
  }

  const expectedTemplateKeys = Object.keys(expectedSnapshot.default_first_session.templates_by_key);
  const lockedTemplateKeys = Object.keys(input.locked_snapshot.default_first_session.templates_by_key);
  assertExactSetMatch("default_first_session.templates_by_key", lockedTemplateKeys, expectedTemplateKeys);

  for (const key of expectedTemplateKeys) {
    const expectedTemplateRow = expectedSnapshot.default_first_session.templates_by_key[key];
    const lockedTemplateRow = input.locked_snapshot.default_first_session.templates_by_key[key];
    if (lockedTemplateRow === undefined) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Snapshot lock drift: missing template row '${key}'.`,
      );
    }
    assertExactValueMatch(`templates_by_key.${key}.template`, lockedTemplateRow.template, expectedTemplateRow.template);
    assertExactArrayMatch(`templates_by_key.${key}.tokens`, lockedTemplateRow.tokens, expectedTemplateRow.tokens);
  }

  return expectedSnapshot;
};

export const createFirstSliceNarrativeTemplateSnapshotV1 = (input: {
  readonly narrative_seed_bundle: LoadNarrativeSeedBundleV1;
  readonly first_slice_content_key_manifest: FirstSliceContentKeyManifestV1;
  readonly objective_step_outcome_contract?: readonly FirstSliceObjectiveStepOutcomeContractRowV1[];
  readonly objective_canonical_token_contract?: readonly FirstSliceObjectiveCanonicalTokenContractRowV1[];
}): FirstSliceNarrativeTemplateSnapshotV1 => {
  const manifest = input.first_slice_content_key_manifest;
  const eventFeed = input.narrative_seed_bundle.event_feed_messages;
  const rowsByKey = createNarrativeRowsByKeyMap(eventFeed);
  const objectiveStepOutcomeContract = input.objective_step_outcome_contract
    ?? FIRST_SLICE_OBJECTIVE_STEP_OUTCOME_CONTRACT_V1;
  const objectiveCanonicalTokenContract = input.objective_canonical_token_contract
    ?? FIRST_SLICE_OBJECTIVE_CANONICAL_TOKEN_CONTRACT_V1;

  const includeScopes = new Set(manifest.default_first_slice_seed_usage.include_slice_status_scopes);
  const excludeScopes = new Set(manifest.default_first_slice_seed_usage.exclude_slice_status_scopes);
  const canonicalKeys = [...manifest.default_first_slice_seed_usage.include_only_content_keys];
  const canonicalKeySet = new Set(canonicalKeys);
  const compatibilityAliasOnlyKeySet = new Set(manifest.compatibility_alias_only_keys);

  validateFirstSliceObjectiveContractParityV1({
    manifestCanonicalKeySet: canonicalKeySet,
    compatibilityAliasOnlyKeySet,
    rowsByKey,
    objectiveStepOutcomeContract,
    objectiveCanonicalTokenContract,
  });

  const loopRequiredKeys = collectLoopRequiredKeys(manifest.loop_required_keys);
  const missingLoopRequiredRows = toUniqueSorted(
    loopRequiredKeys.filter((key) => !rowsByKey.has(key)),
  );
  if (missingLoopRequiredRows.length > 0) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `loop_required_keys canonical keys missing from narrative event feed seed rows: [${missingLoopRequiredRows.join(", ")}].`,
    );
  }

  const aliasCoverageSet = new Set(manifest.compatibility_alias_only_keys);
  const mappedLegacyAliasSet = new Set(
    manifest.legacy_alias_mapping.flatMap((entry) => entry.legacy_keys),
  );
  const mappedLegacyAliasKeysSelectedAsCanonical = toUniqueSorted(
    [...mappedLegacyAliasSet].filter((legacyAliasKey) => canonicalKeySet.has(legacyAliasKey)),
  );
  if (mappedLegacyAliasKeysSelectedAsCanonical.length > 0) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `legacy_alias_mapping keys must not appear in default_first_slice_seed_usage.include_only_content_keys: [${mappedLegacyAliasKeysSelectedAsCanonical.join(", ")}].`,
    );
  }
  const deferredKeysSelectedAsCanonical = toUniqueSorted(
    manifest.deferred_post_slice_keys
      .map((row) => row.key)
      .filter((key) => canonicalKeySet.has(key)),
  );
  if (deferredKeysSelectedAsCanonical.length > 0) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `deferred_post_slice_keys must not appear in default_first_slice_seed_usage.include_only_content_keys: [${deferredKeysSelectedAsCanonical.join(", ")}].`,
    );
  }

  for (const canonicalKey of canonicalKeys) {
    const row = rowsByKey.get(canonicalKey);
    if (row === undefined) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Missing canonical key '${canonicalKey}' in narrative event feed seed rows.`,
      );
    }
    if (!includeScopes.has(row.slice_status_scope)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Canonical key '${canonicalKey}' has out-of-scope slice_status_scope '${row.slice_status_scope}'.`,
      );
    }
    if (excludeScopes.has(row.slice_status_scope)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Canonical key '${canonicalKey}' is explicitly excluded by default_first_slice_seed_usage.exclude_slice_status_scopes.`,
      );
    }
  }

  for (const deferred of manifest.deferred_post_slice_keys) {
    if (deferred.present_in_event_feed_seed && !rowsByKey.has(deferred.key)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Deferred key '${deferred.key}' is marked present_in_event_feed_seed=true but is missing in narrative event feed seed rows.`,
      );
    }
  }

  for (const legacyAliasKey of manifest.compatibility_alias_only_keys) {
    if (canonicalKeySet.has(legacyAliasKey)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Legacy alias key '${legacyAliasKey}' must not appear in default canonical key selection.`,
      );
    }
    if (!rowsByKey.has(legacyAliasKey)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Missing compatibility alias key '${legacyAliasKey}' in narrative event feed seed rows.`,
      );
    }
    if (!mappedLegacyAliasSet.has(legacyAliasKey)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Legacy alias key '${legacyAliasKey}' is not declared in legacy_alias_mapping.`,
      );
    }
  }

  for (const mappedLegacyAliasKey of mappedLegacyAliasSet) {
    if (!aliasCoverageSet.has(mappedLegacyAliasKey)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `legacy_alias_mapping key '${mappedLegacyAliasKey}' is missing from compatibility_alias_only_keys.`,
      );
    }
  }

  const legacyAliasesByCanonical = new Map<string, readonly string[]>();
  for (const mapping of manifest.legacy_alias_mapping) {
    if (!canonicalKeySet.has(mapping.canonical_key)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `legacy_alias_mapping canonical key '${mapping.canonical_key}' is not included in default_first_slice_seed_usage.include_only_content_keys.`,
      );
    }
    if (!rowsByKey.has(mapping.canonical_key)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `legacy_alias_mapping canonical key '${mapping.canonical_key}' is missing from narrative event feed seed rows.`,
      );
    }
    for (const legacyKey of mapping.legacy_keys) {
      if (!rowsByKey.has(legacyKey)) {
        throw new FirstSliceNarrativeTemplateSnapshotValidationError(
          `legacy_alias_mapping key '${legacyKey}' is missing from narrative event feed seed rows.`,
        );
      }
      if (canonicalKeySet.has(legacyKey)) {
        throw new FirstSliceNarrativeTemplateSnapshotValidationError(
          `legacy_alias_mapping key '${legacyKey}' must not appear in default canonical key selection.`,
        );
      }
    }
    legacyAliasesByCanonical.set(mapping.canonical_key, mapping.legacy_keys);
  }

  const combinedTemplateKeysSorted = [...new Set([...canonicalKeys, ...manifest.compatibility_alias_only_keys])]
    .sort((left, right) => left.localeCompare(right));

  const templatesByKey: Record<string, FirstSliceNarrativeTemplateSnapshotEntryV1> = {};
  for (const key of combinedTemplateKeysSorted) {
    const row = rowsByKey.get(key);
    if (row === undefined) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Snapshot generation failed because key '${key}' is missing in narrative event feed seed rows.`,
      );
    }
    templatesByKey[key] = {
      key: row.key,
      template: row.template,
      tokens: [...row.tokens],
    };
  }

  const lookupRows: FirstSliceNarrativeTemplateLookupOrderByCanonicalRowV1[] = canonicalKeys.map(
    (canonicalKey) => ({
      canonical_key: canonicalKey,
      resolution_order: [canonicalKey, ...(legacyAliasesByCanonical.get(canonicalKey) ?? [])],
    }),
  );

  return {
    schema_version: FIRST_SLICE_NARRATIVE_TEMPLATE_SNAPSHOT_SCHEMA_VERSION_V1,
    snapshot_id: FIRST_SLICE_NARRATIVE_TEMPLATE_SNAPSHOT_ID_V1,
    manifest_id: manifest.manifest_id,
    slice_id: manifest.slice_id,
    source_docs: [...manifest.source_docs],
    default_first_session: {
      canonical_keys: canonicalKeys,
      supported_legacy_alias_keys: [...manifest.compatibility_alias_only_keys],
      lookup_resolution_order_by_canonical_key: lookupRows,
      templates_by_key: templatesByKey,
    },
    excluded_deferred_post_slice_keys: manifest.deferred_post_slice_keys
      .filter((row) => row.excluded_from_default_first_slice_seed_usage)
      .map((row) => row.key)
      .sort((left, right) => left.localeCompare(right)),
  };
};

export const serializeFirstSliceNarrativeTemplateSnapshotV1 = (
  snapshot: FirstSliceNarrativeTemplateSnapshotV1,
): string => `${JSON.stringify(snapshot, null, 2)}\n`;

export const parseFirstSliceContentKeyManifestV1 = (
  raw: unknown,
  filePath?: string,
): FirstSliceContentKeyManifestV1 => {
  const root = asRecord(raw, "$");
  readLiteralString(
    root,
    "schema_version",
    FIRST_SLICE_CONTENT_KEY_MANIFEST_SCHEMA_VERSION_V1,
    "$",
  );

  const defaultUsage = asRecord(
    readUnknown(root, "default_first_slice_seed_usage", "$"),
    "$.default_first_slice_seed_usage",
  );
  const aliasLookup = asRecord(
    readUnknown(root, "alias_lookup_contract", "$"),
    "$.alias_lookup_contract",
  );

  const includeScopes = readEnumArray(
    defaultUsage,
    "include_slice_status_scopes",
    "$.default_first_slice_seed_usage",
    SLICE_STATUSES,
  );
  const excludeScopes = readEnumArray(
    defaultUsage,
    "exclude_slice_status_scopes",
    "$.default_first_slice_seed_usage",
    SLICE_STATUSES,
  );
  const includeOnlyContentKeys = readContentKeyArray(
    defaultUsage,
    "include_only_content_keys",
    "$.default_first_slice_seed_usage",
  );
  const loopRequiredKeys = parseLoopRequiredKeys(
    readUnknown(root, "loop_required_keys", "$"),
    "$.loop_required_keys",
  );
  const compatibilityAliasOnlyKeys = readContentKeyArray(
    root,
    "compatibility_alias_only_keys",
    "$",
  );
  const legacyAliasMapping = parseLegacyAliasMappingRows(
    readUnknown(root, "legacy_alias_mapping", "$"),
    "$.legacy_alias_mapping",
  );
  const deferredPostSliceKeys = parseDeferredPostSliceRows(
    readUnknown(root, "deferred_post_slice_keys", "$"),
    "$.deferred_post_slice_keys",
  );
  const deterministicResolutionOrder = readEnumArray(
    aliasLookup,
    "deterministic_resolution_order",
    "$.alias_lookup_contract",
    ["canonical_key", "legacy_keys_in_declared_order"] as const,
  );
  const directDefaultSelectionExcludesLegacyAliasOnlyKeys = readBoolean(
    aliasLookup,
    "direct_default_selection_excludes_legacy_alias_only_keys",
    "$.alias_lookup_contract",
  );

  if (
    deterministicResolutionOrder.length !== 2
    || deterministicResolutionOrder[0] !== "canonical_key"
    || deterministicResolutionOrder[1] !== "legacy_keys_in_declared_order"
  ) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      "alias_lookup_contract.deterministic_resolution_order must equal ['canonical_key', 'legacy_keys_in_declared_order'].",
      { filePath },
    );
  }
  if (!directDefaultSelectionExcludesLegacyAliasOnlyKeys) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      "alias_lookup_contract.direct_default_selection_excludes_legacy_alias_only_keys must be true.",
      { filePath },
    );
  }

  return {
    schema_version: FIRST_SLICE_CONTENT_KEY_MANIFEST_SCHEMA_VERSION_V1,
    manifest_id: readStableId(root, "manifest_id", "$"),
    slice_id: readStableId(root, "slice_id", "$"),
    source_docs: readStringArray(root, "source_docs", "$"),
    default_first_slice_seed_usage: {
      include_slice_status_scopes: includeScopes,
      exclude_slice_status_scopes: excludeScopes,
      include_only_content_keys: includeOnlyContentKeys,
    },
    loop_required_keys: loopRequiredKeys,
    compatibility_alias_only_keys: compatibilityAliasOnlyKeys,
    legacy_alias_mapping: legacyAliasMapping,
    alias_lookup_contract: {
      deterministic_resolution_order: deterministicResolutionOrder,
      direct_default_selection_excludes_legacy_alias_only_keys:
        directDefaultSelectionExcludesLegacyAliasOnlyKeys,
    },
    deferred_post_slice_keys: deferredPostSliceKeys,
  };
};

export const parseFirstSliceNarrativeTemplateSnapshotLockV1 = (
  raw: unknown,
  filePath?: string,
): FirstSliceNarrativeTemplateSnapshotV1 => {
  const root = asRecord(raw, "$");
  readLiteralString(
    root,
    "schema_version",
    FIRST_SLICE_NARRATIVE_TEMPLATE_SNAPSHOT_SCHEMA_VERSION_V1,
    "$",
  );
  readLiteralString(
    root,
    "snapshot_id",
    FIRST_SLICE_NARRATIVE_TEMPLATE_SNAPSHOT_ID_V1,
    "$",
  );

  const defaultFirstSession = asRecord(
    readUnknown(root, "default_first_session", "$"),
    "$.default_first_session",
  );
  const lookupRowsRaw = asArray(
    readUnknown(defaultFirstSession, "lookup_resolution_order_by_canonical_key", "$.default_first_session"),
    "$.default_first_session.lookup_resolution_order_by_canonical_key",
  );
  const lookupRows: FirstSliceNarrativeTemplateLookupOrderByCanonicalRowV1[] = [];
  for (let i = 0; i < lookupRowsRaw.length; i += 1) {
    const path = `$.default_first_session.lookup_resolution_order_by_canonical_key[${i}]`;
    const row = asRecord(lookupRowsRaw[i], path);
    const canonicalKey = readContentKey(row, "canonical_key", path);
    const resolutionOrder = readContentKeyArray(row, "resolution_order", path);
    if (resolutionOrder.length < 1 || resolutionOrder[0] !== canonicalKey) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Snapshot lookup row '${path}' must include canonical key '${canonicalKey}' as the first resolution_order entry.`,
        { filePath },
      );
    }
    lookupRows.push({
      canonical_key: canonicalKey,
      resolution_order: resolutionOrder,
    });
  }

  const templatesByKeyRaw = asRecord(
    readUnknown(defaultFirstSession, "templates_by_key", "$.default_first_session"),
    "$.default_first_session.templates_by_key",
  );
  const templatesByKey: Record<string, FirstSliceNarrativeTemplateSnapshotEntryV1> = {};
  for (const [key, rowRaw] of Object.entries(templatesByKeyRaw)) {
    assertPattern(
      key,
      CONTENT_KEY_PATTERN,
      "$.default_first_session.templates_by_key",
      filePath,
    );
    const path = `$.default_first_session.templates_by_key.${key}`;
    const row = asRecord(rowRaw, path);
    const declaredKey = readContentKey(row, "key", path);
    if (declaredKey !== key) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Snapshot template row key mismatch at '${path}': object key '${key}' != declared key '${declaredKey}'.`,
        { filePath },
      );
    }
    templatesByKey[key] = {
      key: declaredKey,
      template: readString(row, "template", path),
      tokens: readTokenArray(row, "tokens", path),
    };
  }

  return {
    schema_version: FIRST_SLICE_NARRATIVE_TEMPLATE_SNAPSHOT_SCHEMA_VERSION_V1,
    snapshot_id: FIRST_SLICE_NARRATIVE_TEMPLATE_SNAPSHOT_ID_V1,
    manifest_id: readStableId(root, "manifest_id", "$"),
    slice_id: readStableId(root, "slice_id", "$"),
    source_docs: readStringArray(root, "source_docs", "$"),
    default_first_session: {
      canonical_keys: readContentKeyArray(defaultFirstSession, "canonical_keys", "$.default_first_session"),
      supported_legacy_alias_keys: readContentKeyArray(
        defaultFirstSession,
        "supported_legacy_alias_keys",
        "$.default_first_session",
      ),
      lookup_resolution_order_by_canonical_key: lookupRows,
      templates_by_key: templatesByKey,
    },
    excluded_deferred_post_slice_keys: readContentKeyArray(
      root,
      "excluded_deferred_post_slice_keys",
      "$",
    ),
  };
};

function parseLoopRequiredKeys(
  raw: unknown,
  path: string,
): FirstSliceLoopRequiredKeysV1 {
  const root = asRecord(raw, path);
  return {
    tick: readContentKeyArray(root, "tick", path),
    build: readContentKeyArray(root, "build", path),
    train: readContentKeyArray(root, "train", path),
    scout: readContentKeyArray(root, "scout", path),
    hostile_dispatch_and_resolve: readContentKeyArray(
      root,
      "hostile_dispatch_and_resolve",
      path,
    ),
  };
}

function parseLegacyAliasMappingRows(
  raw: unknown,
  path: string,
): readonly FirstSliceLegacyAliasMappingRowV1[] {
  const rowsRaw = asArray(raw, path);
  const rows: FirstSliceLegacyAliasMappingRowV1[] = [];
  const seenCanonicalKeys = new Set<string>();
  for (let i = 0; i < rowsRaw.length; i += 1) {
    const rowPath = `${path}[${i}]`;
    const row = asRecord(rowsRaw[i], rowPath);
    const canonicalKey = readContentKey(row, "canonical_key", rowPath);
    if (seenCanonicalKeys.has(canonicalKey)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Duplicate legacy_alias_mapping canonical key '${canonicalKey}'.`,
      );
    }
    seenCanonicalKeys.add(canonicalKey);
    rows.push({
      canonical_key: canonicalKey,
      legacy_keys: readContentKeyArray(row, "legacy_keys", rowPath),
    });
  }
  return rows;
}

function parseDeferredPostSliceRows(
  raw: unknown,
  path: string,
): readonly FirstSliceDeferredPostSliceKeyRowV1[] {
  const rowsRaw = asArray(raw, path);
  const rows: FirstSliceDeferredPostSliceKeyRowV1[] = [];
  const seenKeys = new Set<string>();
  for (let i = 0; i < rowsRaw.length; i += 1) {
    const rowPath = `${path}[${i}]`;
    const row = asRecord(rowsRaw[i], rowPath);
    const key = readContentKey(row, "key", rowPath);
    if (seenKeys.has(key)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Duplicate deferred_post_slice_keys key '${key}'.`,
      );
    }
    seenKeys.add(key);
    rows.push({
      key,
      source_slice_status: readEnum(row, "source_slice_status", rowPath, SLICE_STATUSES),
      present_in_event_feed_seed: readBoolean(row, "present_in_event_feed_seed", rowPath),
      excluded_from_default_first_slice_seed_usage: readBoolean(
        row,
        "excluded_from_default_first_slice_seed_usage",
        rowPath,
      ),
      reason: readString(row, "reason", rowPath),
    });
  }
  return rows;
}

function createNarrativeRowsByKeyMap(eventFeed: EventFeedMessagesSeedV1): Map<string, EventFeedMessagesSeedV1["rows"][number]> {
  const rowsByKey = new Map<string, EventFeedMessagesSeedV1["rows"][number]>();
  for (const row of eventFeed.rows) {
    rowsByKey.set(row.key, row);
  }
  return rowsByKey;
}

function collectLoopRequiredKeys(loopRequired: FirstSliceLoopRequiredKeysV1): string[] {
  return [
    ...loopRequired.tick,
    ...loopRequired.build,
    ...loopRequired.train,
    ...loopRequired.scout,
    ...loopRequired.hostile_dispatch_and_resolve,
  ];
}

function validateFirstSliceObjectiveContractParityV1(input: {
  readonly manifestCanonicalKeySet: ReadonlySet<string>;
  readonly compatibilityAliasOnlyKeySet: ReadonlySet<string>;
  readonly rowsByKey: ReadonlyMap<string, EventFeedMessagesSeedV1["rows"][number]>;
  readonly objectiveStepOutcomeContract: readonly FirstSliceObjectiveStepOutcomeContractRowV1[];
  readonly objectiveCanonicalTokenContract: readonly FirstSliceObjectiveCanonicalTokenContractRowV1[];
}): void {
  const requiredTokensByCanonicalKey = new Map<string, readonly string[]>();
  for (const row of input.objectiveCanonicalTokenContract) {
    if (requiredTokensByCanonicalKey.has(row.canonical_key)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Objective token contract drift: duplicate canonical key '${row.canonical_key}'.`,
      );
    }
    requiredTokensByCanonicalKey.set(row.canonical_key, row.required_tokens);
  }

  for (const objectiveRow of input.objectiveStepOutcomeContract) {
    if (objectiveRow.success_canonical_keys.length < 1) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Objective contract parity failure for objective '${objectiveRow.objective_id}' key '<none>': success_canonical_keys must include at least one key.`,
      );
    }
    if (objectiveRow.negative_canonical_keys.length < 1) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Objective contract parity failure for objective '${objectiveRow.objective_id}' key '<none>': negative_canonical_keys must include at least one key.`,
      );
    }

    const allObjectiveKeys = [
      ...objectiveRow.success_canonical_keys,
      ...objectiveRow.negative_canonical_keys,
    ];

    const seenKeys = new Set<string>();
    for (const key of allObjectiveKeys) {
      if (seenKeys.has(key)) {
        throw new FirstSliceNarrativeTemplateSnapshotValidationError(
          `Objective contract parity failure for objective '${objectiveRow.objective_id}' key '${key}': duplicate key reference in success/negative canonical key lists.`,
        );
      }
      seenKeys.add(key);
    }

    for (const canonicalKey of allObjectiveKeys) {
      if (input.compatibilityAliasOnlyKeySet.has(canonicalKey)) {
        throw new FirstSliceNarrativeTemplateSnapshotValidationError(
          `Objective contract parity failure for objective '${objectiveRow.objective_id}' key '${canonicalKey}': compatibility-only alias keys are lookup-only and cannot be objective canonical defaults.`,
          {
            details: {
              objective_id: objectiveRow.objective_id,
              key: canonicalKey,
            },
          },
        );
      }

      if (!input.manifestCanonicalKeySet.has(canonicalKey)) {
        throw new FirstSliceNarrativeTemplateSnapshotValidationError(
          `Objective contract parity failure for objective '${objectiveRow.objective_id}' key '${canonicalKey}': missing from default_first_slice_seed_usage.include_only_content_keys.`,
          {
            details: {
              objective_id: objectiveRow.objective_id,
              key: canonicalKey,
            },
          },
        );
      }

      const narrativeRow = input.rowsByKey.get(canonicalKey);
      if (narrativeRow === undefined) {
        throw new FirstSliceNarrativeTemplateSnapshotValidationError(
          `Objective contract parity failure for objective '${objectiveRow.objective_id}' key '${canonicalKey}': missing from narrative event feed seed rows.`,
          {
            details: {
              objective_id: objectiveRow.objective_id,
              key: canonicalKey,
            },
          },
        );
      }

      const expectedTokens = requiredTokensByCanonicalKey.get(canonicalKey);
      if (expectedTokens === undefined) {
        throw new FirstSliceNarrativeTemplateSnapshotValidationError(
          `Objective contract parity failure for objective '${objectiveRow.objective_id}' key '${canonicalKey}': missing required token contract row.`,
          {
            details: {
              objective_id: objectiveRow.objective_id,
              key: canonicalKey,
            },
          },
        );
      }

      const actualTokens = [...narrativeRow.tokens];
      const actualTokenSet = new Set(actualTokens);
      const expectedTokenSet = new Set(expectedTokens);
      const missingTokens = toUniqueSorted(
        expectedTokens.filter((token) => !actualTokenSet.has(token)),
      );
      const unexpectedTokens = toUniqueSorted(
        actualTokens.filter((token) => !expectedTokenSet.has(token)),
      );
      const maxComparableLength = Math.min(expectedTokens.length, actualTokens.length);
      let orderDriftIndex = -1;
      for (let i = 0; i < maxComparableLength; i += 1) {
        if (expectedTokens[i] !== actualTokens[i]) {
          orderDriftIndex = i;
          break;
        }
      }
      const hasOrderDrift = orderDriftIndex >= 0;
      if (missingTokens.length > 0 || unexpectedTokens.length > 0 || hasOrderDrift) {
        const orderDriftSummary = hasOrderDrift
          ? `, first_order_drift_index=${orderDriftIndex}`
          : "";
        throw new FirstSliceNarrativeTemplateSnapshotValidationError(
          `Objective contract parity failure for objective '${objectiveRow.objective_id}' key '${canonicalKey}': token requirements mismatch; missing_tokens=[${missingTokens.join(", ")}], unexpected_tokens=[${unexpectedTokens.join(", ")}], expected_tokens=[${expectedTokens.join(", ")}], actual_tokens=[${actualTokens.join(", ")}]${orderDriftSummary}.`,
          {
            details: {
              objective_id: objectiveRow.objective_id,
              key: canonicalKey,
              missing_tokens: missingTokens,
              unexpected_tokens: unexpectedTokens,
              expected_tokens: expectedTokens,
              actual_tokens: actualTokens,
              first_order_drift_index: hasOrderDrift ? orderDriftIndex : undefined,
            },
          },
        );
      }
    }
  }
}

function toUniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function readUnknown(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): unknown {
  if (!Object.prototype.hasOwnProperty.call(obj, field)) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `Missing required field '${path}.${field}'.`,
    );
  }
  return obj[field];
}

function readString(obj: Record<string, unknown>, field: string, path: string): string {
  const value = readUnknown(obj, field, path);
  if (typeof value !== "string") {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `Field '${path}.${field}' must be a string (received ${describeType(value)}).`,
    );
  }
  if (value.trim().length === 0) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
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
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `Field '${path}.${field}' must equal '${expected}' (received '${value}').`,
    );
  }
  return expected;
}

function readStableId(obj: Record<string, unknown>, field: string, path: string): string {
  const value = readString(obj, field, path);
  assertPattern(value, STABLE_ID_PATTERN, `${path}.${field}`);
  return value;
}

function readContentKey(obj: Record<string, unknown>, field: string, path: string): string {
  const value = readString(obj, field, path);
  assertPattern(value, CONTENT_KEY_PATTERN, `${path}.${field}`);
  return value;
}

function readStringArray(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): readonly string[] {
  const raw = asArray(readUnknown(obj, field, path), `${path}.${field}`);
  if (raw.length < 1) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `Field '${path}.${field}' must contain at least one value.`,
    );
  }
  const out: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const value = raw[i];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Field '${path}.${field}[${i}]' must be a non-empty string (received ${describeType(value)}).`,
      );
    }
    out.push(value);
  }
  ensureNoDuplicates(out, `${path}.${field}`);
  return out;
}

function readContentKeyArray(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): readonly string[] {
  const values = readStringArray(obj, field, path);
  for (let i = 0; i < values.length; i += 1) {
    assertPattern(values[i], CONTENT_KEY_PATTERN, `${path}.${field}[${i}]`);
  }
  return values;
}

function readTokenArray(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): readonly string[] {
  const raw = asArray(readUnknown(obj, field, path), `${path}.${field}`);
  const values: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const value = raw[i];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Field '${path}.${field}[${i}]' must be a non-empty string (received ${describeType(value)}).`,
      );
    }
    assertPattern(value, TOKEN_PATTERN, `${path}.${field}[${i}]`);
    values.push(value);
  }
  ensureNoDuplicates(values, `${path}.${field}`);
  return values;
}

function readBoolean(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): boolean {
  const value = readUnknown(obj, field, path);
  if (typeof value !== "boolean") {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `Field '${path}.${field}' must be a boolean (received ${describeType(value)}).`,
    );
  }
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
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
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
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Field '${path}.${field}[${i}]' must be one of [${allowed.join(", ")}] (received '${String(value)}').`,
      );
    }
    out.push(value as TValue);
  }
  ensureNoDuplicates(out, `${path}.${field}`);
  return out;
}

function assertPattern(
  value: string,
  pattern: RegExp,
  path: string,
  filePath?: string,
): void {
  if (!pattern.test(value)) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `Field '${path}' does not match pattern '${pattern}'.`,
      { filePath },
    );
  }
}

function ensureNoDuplicates(values: readonly string[], path: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Duplicate value '${value}' in '${path}'.`,
      );
    }
    seen.add(value);
  }
}

function assertExactValueMatch(
  label: string,
  actual: string,
  expected: string,
): void {
  if (actual !== expected) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `Snapshot lock drift in '${label}': expected '${expected}', received '${actual}'.`,
      {
        details: {
          label,
          expected,
          actual,
        },
      },
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
  const missing = [...expectedSet].filter((value) => !actualSet.has(value)).sort();
  const extra = [...actualSet].filter((value) => !expectedSet.has(value)).sort();
  if (missing.length > 0 || extra.length > 0) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `Snapshot lock drift in '${label}': missing [${missing.join(", ")}], extra [${extra.join(", ")}].`,
      {
        details: {
          label,
          missing,
          extra,
        },
      },
    );
  }
}

function assertExactArrayMatch(
  label: string,
  actual: readonly string[],
  expected: readonly string[],
): void {
  if (actual.length !== expected.length) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `Token mismatch drift in '${label}': expected ${expected.length} entries, received ${actual.length}.`,
    );
  }
  for (let i = 0; i < expected.length; i += 1) {
    if (actual[i] !== expected[i]) {
      throw new FirstSliceNarrativeTemplateSnapshotValidationError(
        `Token mismatch drift in '${label}' at index ${i}: expected '${expected[i]}', received '${actual[i]}'.`,
        {
          details: {
            label,
            index: i,
            expected,
            actual,
          },
        },
      );
    }
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
      `Expected object at '${path}' (received ${describeType(value)}).`,
    );
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new FirstSliceNarrativeTemplateSnapshotValidationError(
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
