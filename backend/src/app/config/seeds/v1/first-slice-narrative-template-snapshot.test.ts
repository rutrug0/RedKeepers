import { strict as assert } from "node:assert";
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

  assert.throws(
    () => {
      createFirstSliceNarrativeTemplateSnapshotV1({
        narrative_seed_bundle: driftedBundle,
        first_slice_content_key_manifest: manifest,
      });
    },
    (error) =>
      error instanceof FirstSliceNarrativeTemplateSnapshotValidationError
      && error.message.includes(`Missing canonical key '${canonicalToDrop}'`),
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
      && error.message.includes(deferredKey),
  );
});
