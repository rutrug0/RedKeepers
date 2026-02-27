import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import {
  createDefaultFirstSliceNarrativeTemplateSnapshotFilePathsV1,
  createFirstSliceNarrativeTemplateSnapshotV1,
  FirstSliceNarrativeTemplateSnapshotValidationError,
  loadAndValidateFirstSliceNarrativeTemplateSnapshotLockV1,
  loadFirstSliceContentKeyManifestV1,
  loadFirstSliceNarrativeTemplateSnapshotLockV1,
  validateFirstSliceNarrativeTemplateSnapshotLockV1,
} from "./first-slice-narrative-template-snapshot.ts";
import { loadNarrativeSeedBundleV1 } from "./narrative-seed-loaders.ts";

const defaultPaths = createDefaultFirstSliceNarrativeTemplateSnapshotFilePathsV1();
const firstSliceHostileRuntimeTokenContractPath = join(
  process.cwd(),
  "backend/src/app/config/seeds/v1/narrative/first-slice-hostile-runtime-token-contract.json",
);

interface FirstSliceHostileRuntimeKeyContractRowV1 {
  readonly canonical_key: string;
  readonly required_tokens: readonly string[];
  readonly compatibility_alias_keys: readonly string[];
}

interface FirstSliceHostileRuntimeTokenContractV1 {
  readonly required_runtime_keys: readonly FirstSliceHostileRuntimeKeyContractRowV1[];
  readonly compatibility_alias_only_keys: readonly string[];
  readonly deferred_post_slice_keys_excluded_from_contract: readonly {
    readonly key: string;
  }[];
}

type FirstSliceSettlementLoopKeyV1 = "tick" | "build" | "train" | "scout";
type FirstSliceObjectiveLoopStepKeyV1 = FirstSliceSettlementLoopKeyV1 | "attack" | "resolve";
type FirstSliceNegativeStateFamilyV1 =
  | "insufficient_resources"
  | "cooldown"
  | "invalid_target"
  | "combat_loss";

interface FirstSliceSettlementLoopKeyContractRowV1 {
  readonly loop_key: FirstSliceSettlementLoopKeyV1;
  readonly canonical_key: string;
  readonly required_tokens: readonly string[];
  readonly compatibility_alias_keys: readonly string[];
}

interface FirstSliceObjectiveStepOutcomeContractRowV1 {
  readonly objective_id: string;
  readonly loop_step: FirstSliceObjectiveLoopStepKeyV1;
  readonly success_canonical_keys: readonly string[];
  readonly negative_canonical_keys: readonly string[];
  readonly required_negative_state_families: readonly FirstSliceNegativeStateFamilyV1[];
}

const firstSliceSettlementLoopRuntimeTokenMatrixContractV1: readonly FirstSliceSettlementLoopKeyContractRowV1[] = [
  {
    loop_key: "tick",
    canonical_key: "event.tick.passive_income",
    required_tokens: ["settlement_name", "food_gain", "wood_gain", "stone_gain", "iron_gain"],
    compatibility_alias_keys: ["event.economy.tick_passive_income"],
  },
  {
    loop_key: "tick",
    canonical_key: "event.tick.storage_near_cap",
    required_tokens: ["settlement_name", "resource_label"],
    compatibility_alias_keys: ["event.economy.storage_near_cap"],
  },
  {
    loop_key: "tick",
    canonical_key: "event.tick.producer_unlocked_hint",
    required_tokens: ["building_label", "resource_label", "settlement_name"],
    compatibility_alias_keys: ["event.economy.producer_unlocked_hint"],
  },
  {
    loop_key: "tick",
    canonical_key: "event.tick.passive_gain_success",
    required_tokens: ["settlement_name", "duration_ms"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "tick",
    canonical_key: "event.tick.passive_gain_reasoned",
    required_tokens: ["settlement_name", "reason_codes", "duration_ms"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "tick",
    canonical_key: "event.tick.passive_gain_stalled",
    required_tokens: ["settlement_name", "duration_ms"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "tick",
    canonical_key: "event.tick.passive_gain_capped",
    required_tokens: ["settlement_name"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "build",
    canonical_key: "event.build.upgrade_started",
    required_tokens: ["settlement_name", "building_label", "from_level", "to_level"],
    compatibility_alias_keys: ["event.buildings.upgrade_started"],
  },
  {
    loop_key: "build",
    canonical_key: "event.build.upgrade_completed",
    required_tokens: ["settlement_name", "building_label", "new_level"],
    compatibility_alias_keys: ["event.buildings.upgrade_completed"],
  },
  {
    loop_key: "build",
    canonical_key: "event.build.queue_blocked_resources",
    required_tokens: ["settlement_name", "building_label"],
    compatibility_alias_keys: ["event.buildings.queue_blocked_resources"],
  },
  {
    loop_key: "build",
    canonical_key: "event.build.success",
    required_tokens: ["settlement_name", "building_label", "from_level", "to_level"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "build",
    canonical_key: "event.build.failure_insufficient_resources",
    required_tokens: ["building_id", "missing_resources_by_id", "required_cost_by_id", "available_stock_by_id"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "build",
    canonical_key: "event.build.failure_cooldown",
    required_tokens: ["building_id", "cooldown_ends_at"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "build",
    canonical_key: "event.build.failure_invalid_state",
    required_tokens: ["building_id", "invalid_reason"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "train",
    canonical_key: "event.train.started",
    required_tokens: ["settlement_name", "quantity", "unit_label"],
    compatibility_alias_keys: ["event.units.training_started"],
  },
  {
    loop_key: "train",
    canonical_key: "event.train.completed",
    required_tokens: ["settlement_name", "quantity", "unit_label"],
    compatibility_alias_keys: ["event.units.training_completed"],
  },
  {
    loop_key: "train",
    canonical_key: "event.train.queue_full",
    required_tokens: ["settlement_name"],
    compatibility_alias_keys: ["event.units.training_queue_full"],
  },
  {
    loop_key: "train",
    canonical_key: "event.train.success",
    required_tokens: ["settlement_name", "quantity", "unit_label"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "train",
    canonical_key: "event.train.failure_insufficient_resources",
    required_tokens: ["unit_id", "missing_resources_by_id", "required_cost_by_id"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "train",
    canonical_key: "event.train.failure_cooldown",
    required_tokens: ["unit_id", "queue_available_at", "cooldown_remaining_ms"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "train",
    canonical_key: "event.train.failure_invalid_state",
    required_tokens: ["unit_id", "invalid_reason"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "scout",
    canonical_key: "event.scout.dispatched",
    required_tokens: ["settlement_name", "target_tile_label"],
    compatibility_alias_keys: ["event.world.scout_dispatched"],
  },
  {
    loop_key: "scout",
    canonical_key: "event.scout.report_empty",
    required_tokens: ["target_tile_label"],
    compatibility_alias_keys: ["event.world.scout_report_empty"],
  },
  {
    loop_key: "scout",
    canonical_key: "event.scout.report_hostile",
    required_tokens: ["target_tile_label", "hostile_force_estimate"],
    compatibility_alias_keys: ["event.world.scout_report_hostile"],
  },
  {
    loop_key: "scout",
    canonical_key: "event.scout.dispatched_success",
    required_tokens: ["settlement_name", "target_tile_label"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "scout",
    canonical_key: "event.scout.return_empty",
    required_tokens: ["target_tile_label"],
    compatibility_alias_keys: [],
  },
  {
    loop_key: "scout",
    canonical_key: "event.scout.return_hostile",
    required_tokens: ["target_tile_label", "hostile_force_estimate"],
    compatibility_alias_keys: [],
  },
];

const firstSliceObjectiveStepOutcomeContractV1: readonly FirstSliceObjectiveStepOutcomeContractRowV1[] = [
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

const loadFirstSliceHostileRuntimeTokenContractV1 = async (): Promise<FirstSliceHostileRuntimeTokenContractV1> =>
  JSON.parse(await readFile(firstSliceHostileRuntimeTokenContractPath, "utf8")) as FirstSliceHostileRuntimeTokenContractV1;

test("loadAndValidateFirstSliceNarrativeTemplateSnapshotLockV1 passes for committed narrative lock", async () => {
  const result = await loadAndValidateFirstSliceNarrativeTemplateSnapshotLockV1();

  assert.equal(
    result.snapshot.default_first_session.canonical_keys.length > 0,
    true,
  );
  assert.equal(
    result.snapshot.default_first_session.supported_legacy_alias_keys.length > 0,
    true,
  );
});

test("createFirstSliceNarrativeTemplateSnapshotV1 includes canonical and legacy alias template coverage", async () => {
  const narrativeSeedBundle = await loadNarrativeSeedBundleV1(
    defaultPaths.narrative_seed_paths,
  );
  const manifest = await loadFirstSliceContentKeyManifestV1(
    defaultPaths.first_slice_content_key_manifest_path!,
  );

  const snapshot = createFirstSliceNarrativeTemplateSnapshotV1({
    narrative_seed_bundle: narrativeSeedBundle,
    first_slice_content_key_manifest: manifest,
  });

  assert.deepEqual(
    snapshot.default_first_session.canonical_keys,
    manifest.default_first_slice_seed_usage.include_only_content_keys,
  );
  assert.deepEqual(
    snapshot.default_first_session.supported_legacy_alias_keys,
    manifest.compatibility_alias_only_keys,
  );
});

test("hostile canonical narrative seed keys and tokens align with locked runtime token contract", async () => {
  const narrativeSeedBundle = await loadNarrativeSeedBundleV1(
    defaultPaths.narrative_seed_paths,
  );
  const manifest = await loadFirstSliceContentKeyManifestV1(
    defaultPaths.first_slice_content_key_manifest_path!,
  );
  const hostileTokenContract = await loadFirstSliceHostileRuntimeTokenContractV1();

  const rowsByKey = new Map(
    narrativeSeedBundle.event_feed_messages.rows.map((row) => [row.key, row] as const),
  );
  const canonicalSelectionSet = new Set(
    manifest.default_first_slice_seed_usage.include_only_content_keys,
  );
  const hostileLoopCanonicalSet = new Set(
    manifest.loop_required_keys.hostile_dispatch_and_resolve,
  );
  const hostileContractCanonicalKeys = hostileTokenContract.required_runtime_keys.map(
    (row) => row.canonical_key,
  );

  assert.deepEqual(
    [...new Set(hostileContractCanonicalKeys)].sort((left, right) => left.localeCompare(right)),
    [...hostileLoopCanonicalSet].sort((left, right) => left.localeCompare(right)),
  );

  for (const contractRow of hostileTokenContract.required_runtime_keys) {
    const narrativeRow = rowsByKey.get(contractRow.canonical_key);
    assert.notEqual(
      narrativeRow,
      undefined,
      `Missing hostile canonical key '${contractRow.canonical_key}' in narrative seeds.`,
    );
    assert.deepEqual(
      narrativeRow!.tokens,
      contractRow.required_tokens,
      `Hostile token drift for canonical key '${contractRow.canonical_key}'.`,
    );
    assert.equal(
      canonicalSelectionSet.has(contractRow.canonical_key),
      true,
      `Hostile canonical key '${contractRow.canonical_key}' must stay in default canonical selection.`,
    );

    for (const aliasKey of contractRow.compatibility_alias_keys) {
      assert.equal(
        rowsByKey.has(aliasKey),
        true,
        `Missing hostile alias key '${aliasKey}' in narrative seeds.`,
      );
      assert.equal(
        manifest.compatibility_alias_only_keys.includes(aliasKey),
        true,
        `Hostile alias key '${aliasKey}' must be declared in compatibility_alias_only_keys.`,
      );
      assert.equal(
        canonicalSelectionSet.has(aliasKey),
        false,
        `Hostile alias key '${aliasKey}' must not leak into default canonical selection.`,
      );
      assert.equal(
        hostileLoopCanonicalSet.has(aliasKey),
        false,
        `Hostile alias key '${aliasKey}' must not appear as hostile loop canonical content key.`,
      );
    }
  }

  for (const aliasKey of hostileTokenContract.compatibility_alias_only_keys) {
    assert.equal(
      rowsByKey.has(aliasKey),
      true,
      `Missing hostile compatibility alias key '${aliasKey}' in narrative seeds.`,
    );
    assert.equal(
      manifest.compatibility_alias_only_keys.includes(aliasKey),
      true,
      `Hostile compatibility alias key '${aliasKey}' must be listed in content-key manifest alias coverage.`,
    );
    assert.equal(
      canonicalSelectionSet.has(aliasKey),
      false,
      `Hostile compatibility alias key '${aliasKey}' must not be selected as canonical default content.`,
    );
  }

  for (const deferredRow of hostileTokenContract.deferred_post_slice_keys_excluded_from_contract) {
    assert.equal(
      canonicalSelectionSet.has(deferredRow.key),
      false,
      `Deferred post-slice key '${deferredRow.key}' must remain excluded from default canonical selection.`,
    );
  }
});

test("tick/build/train/scout canonical narrative seed keys and tokens align with first-slice matrix contract", async () => {
  const narrativeSeedBundle = await loadNarrativeSeedBundleV1(
    defaultPaths.narrative_seed_paths,
  );
  const manifest = await loadFirstSliceContentKeyManifestV1(
    defaultPaths.first_slice_content_key_manifest_path!,
  );

  const rowsByKey = new Map(
    narrativeSeedBundle.event_feed_messages.rows.map((row) => [row.key, row] as const),
  );
  const canonicalSelectionSet = new Set(
    manifest.default_first_slice_seed_usage.include_only_content_keys,
  );
  const loopKeys = ["tick", "build", "train", "scout"] as const;
  const legacyAliasKeysByCanonicalKey = new Map(
    manifest.legacy_alias_mapping.map((row) => [row.canonical_key, row.legacy_keys] as const),
  );

  for (const loopKey of loopKeys) {
    const loopCanonicalSet = new Set(manifest.loop_required_keys[loopKey]);
    const contractRows = firstSliceSettlementLoopRuntimeTokenMatrixContractV1.filter(
      (row) => row.loop_key === loopKey,
    );
    const contractCanonicalKeys = contractRows.map((row) => row.canonical_key);

    assert.deepEqual(
      [...new Set(contractCanonicalKeys)].sort((left, right) => left.localeCompare(right)),
      [...loopCanonicalSet].sort((left, right) => left.localeCompare(right)),
      `${loopKey} canonical key matrix contract drift for first-slice loop coverage.`,
    );

    for (const contractRow of contractRows) {
      const narrativeRow = rowsByKey.get(contractRow.canonical_key);
      assert.notEqual(
        narrativeRow,
        undefined,
        `Missing ${loopKey} canonical key '${contractRow.canonical_key}' in narrative seeds.`,
      );
      assert.deepEqual(
        narrativeRow!.tokens,
        contractRow.required_tokens,
        `${loopKey} token drift for canonical key '${contractRow.canonical_key}'.`,
      );
      assert.equal(
        canonicalSelectionSet.has(contractRow.canonical_key),
        true,
        `${loopKey} canonical key '${contractRow.canonical_key}' must stay in default canonical selection.`,
      );

      const manifestAliasKeysForCanonical = legacyAliasKeysByCanonicalKey.get(contractRow.canonical_key) ?? [];
      assert.deepEqual(
        manifestAliasKeysForCanonical,
        contractRow.compatibility_alias_keys,
        `${loopKey} alias mapping drift for canonical key '${contractRow.canonical_key}'.`,
      );

      for (const aliasKey of contractRow.compatibility_alias_keys) {
        assert.equal(
          rowsByKey.has(aliasKey),
          true,
          `Missing ${loopKey} alias key '${aliasKey}' in narrative seeds.`,
        );
        assert.equal(
          manifest.compatibility_alias_only_keys.includes(aliasKey),
          true,
          `${loopKey} alias key '${aliasKey}' must be declared in compatibility_alias_only_keys.`,
        );
        assert.equal(
          canonicalSelectionSet.has(aliasKey),
          false,
          `${loopKey} alias key '${aliasKey}' must not leak into default canonical selection.`,
        );
        assert.equal(
          loopCanonicalSet.has(aliasKey),
          false,
          `${loopKey} alias key '${aliasKey}' must not appear as ${loopKey} loop canonical content key.`,
        );
      }
    }
  }
});

test("first-session objective steps include canonical success/failure placeholder coverage with matrix-aligned tokens", async () => {
  const narrativeSeedBundle = await loadNarrativeSeedBundleV1(
    defaultPaths.narrative_seed_paths,
  );
  const manifest = await loadFirstSliceContentKeyManifestV1(
    defaultPaths.first_slice_content_key_manifest_path!,
  );
  const hostileTokenContract = await loadFirstSliceHostileRuntimeTokenContractV1();

  const rowsByKey = new Map(
    narrativeSeedBundle.event_feed_messages.rows.map((row) => [row.key, row] as const),
  );
  const canonicalSelectionSet = new Set(
    manifest.default_first_slice_seed_usage.include_only_content_keys,
  );
  const requiredTokenMapByCanonicalKey = new Map<string, readonly string[]>();
  for (const row of firstSliceSettlementLoopRuntimeTokenMatrixContractV1) {
    requiredTokenMapByCanonicalKey.set(row.canonical_key, row.required_tokens);
  }
  for (const row of hostileTokenContract.required_runtime_keys) {
    requiredTokenMapByCanonicalKey.set(row.canonical_key, row.required_tokens);
  }

  const requiredNegativeStateFamilies = new Set<FirstSliceNegativeStateFamilyV1>([
    "insufficient_resources",
    "cooldown",
    "invalid_target",
    "combat_loss",
  ]);
  const coveredNegativeStateFamilies = new Set<FirstSliceNegativeStateFamilyV1>();

  for (const objectiveRow of firstSliceObjectiveStepOutcomeContractV1) {
    assert.equal(
      objectiveRow.success_canonical_keys.length > 0,
      true,
      `Objective '${objectiveRow.objective_id}' must declare at least one canonical success key.`,
    );
    assert.equal(
      objectiveRow.negative_canonical_keys.length > 0,
      true,
      `Objective '${objectiveRow.objective_id}' must declare at least one canonical negative key.`,
    );

    const allObjectiveKeys = [
      ...objectiveRow.success_canonical_keys,
      ...objectiveRow.negative_canonical_keys,
    ];

    for (const canonicalKey of allObjectiveKeys) {
      const narrativeRow = rowsByKey.get(canonicalKey);
      assert.notEqual(
        narrativeRow,
        undefined,
        `Objective '${objectiveRow.objective_id}' is missing canonical key '${canonicalKey}' in narrative seeds.`,
      );
      assert.equal(
        canonicalSelectionSet.has(canonicalKey),
        true,
        `Objective '${objectiveRow.objective_id}' canonical key '${canonicalKey}' must stay in default first-session canonical selection.`,
      );

      const expectedTokens = requiredTokenMapByCanonicalKey.get(canonicalKey);
      assert.notEqual(
        expectedTokens,
        undefined,
        `Objective '${objectiveRow.objective_id}' canonical key '${canonicalKey}' is not present in the canonical token contract map.`,
      );
      assert.deepEqual(
        narrativeRow!.tokens,
        expectedTokens!,
        `Objective '${objectiveRow.objective_id}' token drift for canonical key '${canonicalKey}'.`,
      );
    }

    for (const family of objectiveRow.required_negative_state_families) {
      coveredNegativeStateFamilies.add(family);
    }
  }

  for (const requiredFamily of requiredNegativeStateFamilies) {
    assert.equal(
      coveredNegativeStateFamilies.has(requiredFamily),
      true,
      `Missing required negative-state family coverage '${requiredFamily}' in first-session objective contract rows.`,
    );
  }
});

test("createFirstSliceNarrativeTemplateSnapshotV1 fails on missing canonical key coverage", async () => {
  const narrativeSeedBundle = await loadNarrativeSeedBundleV1(
    defaultPaths.narrative_seed_paths,
  );
  const manifest = await loadFirstSliceContentKeyManifestV1(
    defaultPaths.first_slice_content_key_manifest_path!,
  );
  const canonicalToDrop = manifest.default_first_slice_seed_usage.include_only_content_keys[0];
  const driftedBundle = {
    ...narrativeSeedBundle,
    event_feed_messages: {
      ...narrativeSeedBundle.event_feed_messages,
      rows: narrativeSeedBundle.event_feed_messages.rows.filter((row) => row.key !== canonicalToDrop),
    },
  };
  const driftedManifest = {
    ...manifest,
    loop_required_keys: {
      tick: manifest.loop_required_keys.tick.filter((key) => key !== canonicalToDrop),
      build: manifest.loop_required_keys.build.filter((key) => key !== canonicalToDrop),
      train: manifest.loop_required_keys.train.filter((key) => key !== canonicalToDrop),
      scout: manifest.loop_required_keys.scout.filter((key) => key !== canonicalToDrop),
      hostile_dispatch_and_resolve: manifest.loop_required_keys.hostile_dispatch_and_resolve
        .filter((key) => key !== canonicalToDrop),
    },
  };

  assert.throws(
    () => {
      createFirstSliceNarrativeTemplateSnapshotV1({
        narrative_seed_bundle: driftedBundle,
        first_slice_content_key_manifest: driftedManifest,
      });
    },
    (error) =>
      error instanceof FirstSliceNarrativeTemplateSnapshotValidationError
      && error.message.includes(`Missing canonical key '${canonicalToDrop}'`),
  );
});

test("createFirstSliceNarrativeTemplateSnapshotV1 fails when loop_required_keys canonical keys are missing from narrative rows", async () => {
  const narrativeSeedBundle = await loadNarrativeSeedBundleV1(
    defaultPaths.narrative_seed_paths,
  );
  const manifest = await loadFirstSliceContentKeyManifestV1(
    defaultPaths.first_slice_content_key_manifest_path!,
  );
  const missingLoopRequiredKey = "event.tick.synthetic_missing_contract_key";
  const driftedManifest = {
    ...manifest,
    loop_required_keys: {
      ...manifest.loop_required_keys,
      tick: [...manifest.loop_required_keys.tick, missingLoopRequiredKey],
    },
  };

  assert.throws(
    () => {
      createFirstSliceNarrativeTemplateSnapshotV1({
        narrative_seed_bundle: narrativeSeedBundle,
        first_slice_content_key_manifest: driftedManifest,
      });
    },
    (error) =>
      error instanceof FirstSliceNarrativeTemplateSnapshotValidationError
      && error.message.includes("loop_required_keys")
      && error.message.includes(missingLoopRequiredKey),
  );
});

test("createFirstSliceNarrativeTemplateSnapshotV1 fails when mapped legacy alias keys leak into default canonical selection", async () => {
  const narrativeSeedBundle = await loadNarrativeSeedBundleV1(
    defaultPaths.narrative_seed_paths,
  );
  const manifest = await loadFirstSliceContentKeyManifestV1(
    defaultPaths.first_slice_content_key_manifest_path!,
  );
  const legacyAliasKey = manifest.legacy_alias_mapping[0]?.legacy_keys[0];
  if (legacyAliasKey === undefined) {
    throw new Error("Expected legacy alias mapping fixture rows.");
  }
  const driftedManifest = {
    ...manifest,
    default_first_slice_seed_usage: {
      ...manifest.default_first_slice_seed_usage,
      include_only_content_keys: [
        ...manifest.default_first_slice_seed_usage.include_only_content_keys,
        legacyAliasKey,
      ],
    },
  };

  assert.throws(
    () => {
      createFirstSliceNarrativeTemplateSnapshotV1({
        narrative_seed_bundle: narrativeSeedBundle,
        first_slice_content_key_manifest: driftedManifest,
      });
    },
    (error) =>
      error instanceof FirstSliceNarrativeTemplateSnapshotValidationError
      && error.message.includes("legacy_alias_mapping")
      && error.message.includes(legacyAliasKey),
  );
});

test("validateFirstSliceNarrativeTemplateSnapshotLockV1 fails on token mismatch drift", async () => {
  const narrativeSeedBundle = await loadNarrativeSeedBundleV1(
    defaultPaths.narrative_seed_paths,
  );
  const manifest = await loadFirstSliceContentKeyManifestV1(
    defaultPaths.first_slice_content_key_manifest_path!,
  );
  const lockedSnapshot = await loadFirstSliceNarrativeTemplateSnapshotLockV1(
    defaultPaths.first_slice_narrative_template_snapshot_lock_path!,
  );
  const driftedSnapshot = {
    ...lockedSnapshot,
    default_first_session: {
      ...lockedSnapshot.default_first_session,
      templates_by_key: {
        ...lockedSnapshot.default_first_session.templates_by_key,
        "event.tick.passive_income": {
          ...lockedSnapshot.default_first_session.templates_by_key["event.tick.passive_income"],
          tokens: ["settlement_name", "food_gain", "wood_gain"],
        },
      },
    },
  };

  assert.throws(
    () => {
      validateFirstSliceNarrativeTemplateSnapshotLockV1({
        narrative_seed_bundle: narrativeSeedBundle,
        first_slice_content_key_manifest: manifest,
        locked_snapshot: driftedSnapshot,
      });
    },
    (error) =>
      error instanceof FirstSliceNarrativeTemplateSnapshotValidationError
      && error.message.includes("Token mismatch drift")
      && error.message.includes("event.tick.passive_income"),
  );
});

test("createFirstSliceNarrativeTemplateSnapshotV1 fails when deferred post-slice keys leak into default first-session coverage", async () => {
  const narrativeSeedBundle = await loadNarrativeSeedBundleV1(
    defaultPaths.narrative_seed_paths,
  );
  const manifest = await loadFirstSliceContentKeyManifestV1(
    defaultPaths.first_slice_content_key_manifest_path!,
  );
  const deferredKey = manifest.deferred_post_slice_keys[0]?.key;
  if (deferredKey === undefined) {
    throw new Error("Expected deferred_post_slice_keys fixture rows.");
  }
  const driftedManifest = {
    ...manifest,
    default_first_slice_seed_usage: {
      ...manifest.default_first_slice_seed_usage,
      include_only_content_keys: [
        ...manifest.default_first_slice_seed_usage.include_only_content_keys,
        deferredKey,
      ],
    },
  };

  assert.throws(
    () => {
      createFirstSliceNarrativeTemplateSnapshotV1({
        narrative_seed_bundle: narrativeSeedBundle,
        first_slice_content_key_manifest: driftedManifest,
      });
    },
    (error) =>
      error instanceof FirstSliceNarrativeTemplateSnapshotValidationError
      && error.message.includes("deferred_post_slice_keys")
      && error.message.includes(deferredKey),
  );
});
