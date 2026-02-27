import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  createFirstSlicePlayableRuntimeBootstrapV1,
} from "./first-slice-playable-manifest-loaders.ts";
import {
  loadStarterSeedBundleV1,
} from "./starter-seed-loaders.ts";
import {
  loadWorldMapSeedBundleV1,
} from "./world-map-seed-loaders.ts";
import {
  FirstSliceRuntimeManifestLockValidationError,
  loadAndValidateFirstSliceRuntimeManifestLockV1,
  validateFirstSliceRuntimeManifestLockV1,
} from "./first-slice-runtime-manifest-lock-validator.ts";

test("loadAndValidateFirstSliceRuntimeManifestLockV1 passes for committed first-slice seed lock", async () => {
  const result = await loadAndValidateFirstSliceRuntimeManifestLockV1();

  assert.equal(
    result.runtime_bootstrap.primary_settlement.settlement_id,
    result.starter_seed_bundle.first_slice_playable_manifest
      .canonical_playable_now.primary_settlement.settlement_id,
  );
  assert.equal(
    result.runtime_bootstrap.foreign_hostile_profile.profile_id,
    result.starter_seed_bundle.first_slice_playable_manifest
      .canonical_playable_now.foreign_hostile_profile.profile_id,
  );
});

test("validateFirstSliceRuntimeManifestLockV1 reports exact missing unit ids from active first-slice seeds", async () => {
  const starterSeedBundle = await loadStarterSeedBundleV1();
  const worldMapSeedBundle = await loadWorldMapSeedBundleV1();
  const { watch_levy: removedWatchLevy, ...unitEntriesById } =
    starterSeedBundle.seeds.units.unit_lines.entries_by_id;
  void removedWatchLevy;
  const driftedStarterSeedBundle = {
    ...starterSeedBundle,
    seeds: {
      ...starterSeedBundle.seeds,
      units: {
        ...starterSeedBundle.seeds.units,
        unit_lines: {
          ...starterSeedBundle.seeds.units.unit_lines,
          entries_by_id: unitEntriesById,
        },
      },
    },
  };

  await assert.rejects(
    async () => {
      validateFirstSliceRuntimeManifestLockV1({
        starter_seed_bundle: driftedStarterSeedBundle,
        world_map_seed_bundle: worldMapSeedBundle,
      });
    },
    (error) =>
      error instanceof FirstSliceRuntimeManifestLockValidationError
      && error.message.includes("units.unit_lines")
      && error.message.includes("missing [watch_levy]")
      && error.message.includes("extra []"),
  );
});

test("validateFirstSliceRuntimeManifestLockV1 reports exact primary settlement fixture id drift", async () => {
  const starterSeedBundle = await loadStarterSeedBundleV1();
  const worldMapSeedBundle = await loadWorldMapSeedBundleV1();
  const driftedWorldMapSeedBundle = {
    ...worldMapSeedBundle,
    world_map_tiles: {
      ...worldMapSeedBundle.world_map_tiles,
      rows: worldMapSeedBundle.world_map_tiles.rows.map((row, index) =>
        index === 0
          ? {
            ...row,
            settlement_id: "settlement_beta",
          }
          : row),
    },
  };

  await assert.rejects(
    async () => {
      validateFirstSliceRuntimeManifestLockV1({
        starter_seed_bundle: starterSeedBundle,
        world_map_seed_bundle: driftedWorldMapSeedBundle,
      });
    },
    (error) =>
      error instanceof FirstSliceRuntimeManifestLockValidationError
      && error.message.includes("default_transport_fixture_primary_settlement_ids")
      && error.message.includes("missing []")
      && error.message.includes("extra [settlement_beta]"),
  );
});

test("validateFirstSliceRuntimeManifestLockV1 reports exact hostile fixture id drift for transport defaults", async () => {
  const starterSeedBundle = await loadStarterSeedBundleV1();
  const worldMapSeedBundle = await loadWorldMapSeedBundleV1();
  const runtimeBootstrap = createFirstSlicePlayableRuntimeBootstrapV1(
    starterSeedBundle.first_slice_playable_manifest,
  );
  const driftedRuntimeBootstrap = {
    ...runtimeBootstrap,
    deterministic_attack_fixture_ids: [
      "attack_fixture_attacker_loss_30v40",
      "attack_fixture_attacker_win_50v40",
      "attack_fixture_unmapped_99v99",
    ],
  };

  assert.throws(
    () => {
      validateFirstSliceRuntimeManifestLockV1({
        starter_seed_bundle: starterSeedBundle,
        world_map_seed_bundle: worldMapSeedBundle,
        runtime_bootstrap: driftedRuntimeBootstrap,
      });
    },
    (error) =>
      error instanceof FirstSliceRuntimeManifestLockValidationError
      && error.message.includes("default_transport_fixture_hostile_attack_ids")
      && error.message.includes("missing [attack_fixture_tie_40v40]")
      && error.message.includes("extra [attack_fixture_unmapped_99v99]"),
  );
});
