import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  createDefaultFirstSlicePlayableManifestFilePathsV1,
  createFirstSlicePlayableRuntimeBootstrapV1,
  FirstSlicePlayableManifestValidationError,
  loadFirstSlicePlayableManifestV1,
} from "./first-slice-playable-manifest-loaders.ts";

test("createFirstSlicePlayableRuntimeBootstrapV1 returns canonical first-slice settlement and hostile fixtures", async () => {
  const manifest = await loadFirstSlicePlayableManifestV1(
    createDefaultFirstSlicePlayableManifestFilePathsV1().firstSlicePlayableManifest,
  );

  const bootstrap = createFirstSlicePlayableRuntimeBootstrapV1(manifest);

  assert.equal(
    bootstrap.primary_settlement.settlement_id,
    manifest.canonical_playable_now.primary_settlement.settlement_id,
  );
  assert.equal(
    bootstrap.foreign_hostile_profile.profile_id,
    manifest.canonical_playable_now.foreign_hostile_profile.profile_id,
  );
  assert.equal(
    bootstrap.foreign_hostile_profile.settlement_id,
    manifest.canonical_playable_now.foreign_hostile_profile.settlement_id,
  );
  assert.equal(
    bootstrap.world.world_id,
    manifest.canonical_playable_now.map_fixture_ids.world_id,
  );
  assert.equal(
    bootstrap.world.world_seed,
    manifest.canonical_playable_now.map_fixture_ids.world_seed,
  );
  assert.equal(
    bootstrap.primary_settlement.settlement_id
      !== bootstrap.foreign_hostile_profile.settlement_id,
    true,
  );
  assert.equal(bootstrap.deterministic_attack_fixture_ids.length >= 1, true);
});

test("createFirstSlicePlayableRuntimeBootstrapV1 rejects drift when canonical hostile settlement is not foreign", async () => {
  const manifest = await loadFirstSlicePlayableManifestV1(
    createDefaultFirstSlicePlayableManifestFilePathsV1().firstSlicePlayableManifest,
  );
  const driftedManifest = {
    ...manifest,
    canonical_playable_now: {
      ...manifest.canonical_playable_now,
      foreign_hostile_profile: {
        ...manifest.canonical_playable_now.foreign_hostile_profile,
        settlement_id: manifest.canonical_playable_now.primary_settlement.settlement_id,
      },
    },
  };

  assert.throws(
    () => {
      createFirstSlicePlayableRuntimeBootstrapV1(driftedManifest);
    },
    (error) =>
      error instanceof FirstSlicePlayableManifestValidationError
      && error.message.includes("must be distinct"),
  );
});

test("createFirstSlicePlayableRuntimeBootstrapV1 rejects drift when backend visibility no longer hides post-slice statuses", async () => {
  const manifest = await loadFirstSlicePlayableManifestV1(
    createDefaultFirstSlicePlayableManifestFilePathsV1().firstSlicePlayableManifest,
  );
  const driftedManifest = {
    ...manifest,
    default_consumption_contract: {
      ...manifest.default_consumption_contract,
      backend: {
        ...manifest.default_consumption_contract.backend,
        hide_by_source_slice_status: ["balance_stub"] as const,
      },
    },
  };

  assert.throws(
    () => {
      createFirstSlicePlayableRuntimeBootstrapV1(driftedManifest);
    },
    (error) =>
      error instanceof FirstSlicePlayableManifestValidationError
      && error.message.includes("must hide balance_stub and data_stub_post_slice"),
  );
});
