import {
  createFirstSlicePlayableRuntimeBootstrapV1,
  type FirstSlicePlayableRuntimeBootstrapV1,
} from "./first-slice-playable-manifest-loaders.ts";
import {
  applyFirstSliceFilteringV1,
  createDefaultStarterSeedFilePathsV1,
  loadStarterSeedBundleV1,
  type LoadStarterSeedsResultV1,
  type StarterSeedFilePathsV1,
} from "./starter-seed-loaders.ts";
import {
  createDefaultWorldMapSeedFilePathsV1,
  loadWorldMapSeedBundleV1,
  type WorldMapSeedBundleV1,
  type WorldMapTileSeedFilePathsV1,
} from "./world-map-seed-loaders.ts";

type JsonFileReader = (filePath: string) => Promise<unknown>;

export interface FirstSliceRuntimeManifestLockValidationFilePathsV1 {
  readonly starter_seed_paths?: StarterSeedFilePathsV1;
  readonly world_map_seed_paths?: WorldMapTileSeedFilePathsV1;
}

export interface ValidateFirstSliceRuntimeManifestLockV1Input {
  readonly starter_seed_bundle: LoadStarterSeedsResultV1;
  readonly world_map_seed_bundle: WorldMapSeedBundleV1;
  readonly runtime_bootstrap?: FirstSlicePlayableRuntimeBootstrapV1;
}

export interface FirstSliceRuntimeManifestLockValidationResultV1 {
  readonly starter_seed_bundle: LoadStarterSeedsResultV1;
  readonly world_map_seed_bundle: WorldMapSeedBundleV1;
  readonly runtime_bootstrap: FirstSlicePlayableRuntimeBootstrapV1;
}

export class FirstSliceRuntimeManifestLockValidationError extends Error {
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(
    message: string,
    options?: {
      readonly details?: Record<string, unknown>;
      readonly cause?: unknown;
    },
  ) {
    super(message);
    this.name = "FirstSliceRuntimeManifestLockValidationError";
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

export const loadAndValidateFirstSliceRuntimeManifestLockV1 = async (
  paths?: FirstSliceRuntimeManifestLockValidationFilePathsV1,
  readJson?: JsonFileReader,
): Promise<FirstSliceRuntimeManifestLockValidationResultV1> => {
  const starterSeedPaths = paths?.starter_seed_paths ?? createDefaultStarterSeedFilePathsV1();
  const worldMapSeedPaths = paths?.world_map_seed_paths ?? createDefaultWorldMapSeedFilePathsV1();
  const starterSeedBundle =
    readJson === undefined
      ? await loadStarterSeedBundleV1(starterSeedPaths)
      : await loadStarterSeedBundleV1(starterSeedPaths, readJson);
  const worldMapSeedBundle =
    readJson === undefined
      ? await loadWorldMapSeedBundleV1(worldMapSeedPaths)
      : await loadWorldMapSeedBundleV1(worldMapSeedPaths, readJson);
  const runtimeBootstrap = validateFirstSliceRuntimeManifestLockV1({
    starter_seed_bundle: starterSeedBundle,
    world_map_seed_bundle: worldMapSeedBundle,
  });
  return {
    starter_seed_bundle: starterSeedBundle,
    world_map_seed_bundle: worldMapSeedBundle,
    runtime_bootstrap: runtimeBootstrap,
  };
};

export const validateFirstSliceRuntimeManifestLockV1 = (
  input: ValidateFirstSliceRuntimeManifestLockV1Input,
): FirstSlicePlayableRuntimeBootstrapV1 => {
  const manifest = input.starter_seed_bundle.first_slice_playable_manifest;
  const worldMapManifest = input.world_map_seed_bundle.first_slice_playable_manifest;
  const canonical = manifest.canonical_playable_now;

  try {
    assertExactValueMatch(
      "seed_bundle_manifest_id",
      worldMapManifest.manifest_id,
      manifest.manifest_id,
    );

    const filteredStarterBundle = applyFirstSliceFilteringV1(
      input.starter_seed_bundle.seeds,
      input.starter_seed_bundle.first_slice_enablement,
      manifest,
    );

    assertExactSetMatch(
      "enabled_first_slice_civilization_ids",
      input.starter_seed_bundle.first_slice_enablement.enabled_civilization_ids,
      [canonical.civilization_profile_id],
    );
    assertExactSetMatch(
      "active_first_slice_civilization_ids",
      Object.keys(filteredStarterBundle.civilizations.activation.entries_by_id),
      [canonical.civilization_profile_id],
    );
    assertExactSetMatch(
      "active_first_slice_resource_ids",
      Object.keys(filteredStarterBundle.economy.resource_definitions.entries_by_id),
      canonical.resources,
    );
    assertExactSetMatch(
      "active_first_slice_building_ids",
      Object.keys(filteredStarterBundle.buildings.building_lines.entries_by_id),
      canonical.buildings,
    );
    assertExactSetMatch(
      "active_first_slice_unit_ids",
      Object.keys(filteredStarterBundle.units.unit_lines.entries_by_id),
      canonical.units,
    );

    const worldMapRows = input.world_map_seed_bundle.world_map_tiles.rows;
    assertExactSetMatch(
      "default_transport_fixture_primary_settlement_ids",
      worldMapRows.map((row) => row.settlement_id),
      [canonical.primary_settlement.settlement_id],
    );

    const scoutTileRows = worldMapRows.filter(
      (row) => row.settlement_id === canonical.primary_settlement.settlement_id,
    );
    assertExactSetMatch(
      "default_transport_fixture_scout_tile_ids",
      scoutTileRows.map((row) => row.tile_id),
      canonical.map_fixture_ids.scout_tile_ids,
    );

    const runtimeBootstrap =
      input.runtime_bootstrap ?? createFirstSlicePlayableRuntimeBootstrapV1(manifest);

    assertExactValueMatch(
      "default_transport_primary_settlement_id",
      runtimeBootstrap.primary_settlement.settlement_id,
      canonical.primary_settlement.settlement_id,
    );
    assertExactValueMatch(
      "default_transport_hostile_profile_id",
      runtimeBootstrap.foreign_hostile_profile.profile_id,
      canonical.foreign_hostile_profile.profile_id,
    );
    assertExactValueMatch(
      "default_transport_hostile_settlement_id",
      runtimeBootstrap.foreign_hostile_profile.settlement_id,
      canonical.foreign_hostile_profile.settlement_id,
    );
    assertExactValueMatch(
      "default_transport_world_id",
      runtimeBootstrap.world.world_id,
      canonical.map_fixture_ids.world_id,
    );
    assertExactValueMatch(
      "default_transport_world_seed",
      runtimeBootstrap.world.world_seed,
      canonical.map_fixture_ids.world_seed,
    );
    assertExactSetMatch(
      "default_transport_scout_tile_ids",
      runtimeBootstrap.scout_tile_ids,
      canonical.map_fixture_ids.scout_tile_ids,
    );
    assertExactSetMatch(
      "default_transport_fixture_hostile_attack_ids",
      runtimeBootstrap.deterministic_attack_fixture_ids,
      canonical.map_fixture_ids.deterministic_attack_fixture_ids,
    );
    assertExactValueMatch(
      "default_transport_hostile_target_settlement_id",
      canonical.map_fixture_ids.hostile_target_settlement_id,
      runtimeBootstrap.foreign_hostile_profile.settlement_id,
    );

    return runtimeBootstrap;
  } catch (cause) {
    if (cause instanceof FirstSliceRuntimeManifestLockValidationError) {
      throw cause;
    }
    if (cause instanceof Error) {
      throw new FirstSliceRuntimeManifestLockValidationError(cause.message, {
        cause,
      });
    }
    throw new FirstSliceRuntimeManifestLockValidationError(
      "First-slice runtime manifest lock validation failed with a non-error cause.",
      { cause },
    );
  }
};

function assertExactSetMatch(
  label: string,
  actual: readonly string[],
  expected: readonly string[],
): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((id) => !actualSet.has(id)).sort();
  const extra = [...actualSet].filter((id) => !expectedSet.has(id)).sort();
  if (missing.length > 0 || extra.length > 0) {
    throw new FirstSliceRuntimeManifestLockValidationError(
      `Manifest lock drift in '${label}': missing [${missing.join(", ")}], extra [${extra.join(", ")}].`,
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

function assertExactValueMatch(
  label: string,
  actual: string,
  expected: string,
): void {
  if (actual !== expected) {
    throw new FirstSliceRuntimeManifestLockValidationError(
      `Manifest lock drift in '${label}': expected '${expected}', received '${actual}'.`,
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
