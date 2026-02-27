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
