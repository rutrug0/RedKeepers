import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const STARTER_SEED_SCHEMA_VERSION_V1 = "rk-v1-starter-seed" as const;

export type SliceStatus =
  | "playable_now"
  | "balance_stub"
  | "data_stub_post_slice";

export type UnitRole =
  | "infantry"
  | "ranged"
  | "scout"
  | "cavalry"
  | "siege";

export type ModifierOperation = "mult" | "add";

export interface SeedTableMeta {
  readonly schema_version: typeof STARTER_SEED_SCHEMA_VERSION_V1;
  readonly source_doc: string;
  readonly source_section: string;
  readonly table_id: string;
}

export interface KeyedSeedTable<TEntry> extends SeedTableMeta {
  readonly key_field: string;
  readonly entries_by_id: Readonly<Record<string, TEntry>>;
}

export interface RowsSeedTable<TRow> extends SeedTableMeta {
  readonly rows: readonly TRow[];
}

export interface ResourceDefinitionSeedV1 {
  readonly resource_id: string;
  readonly display_name: string;
  readonly short_label: string;
  readonly icon_key: string;
  readonly starting_stock: number;
  readonly base_storage_cap: number;
  readonly base_passive_prod_per_h: number;
  readonly producer_building_id: string;
  readonly slice_status: SliceStatus;
}

export interface BuildingFamilySeedV1 {
  readonly family_id: string;
  readonly display_name: string;
  readonly purpose_summary: string;
  readonly primary_backend_owner: string;
  readonly frontend_tab: string;
  readonly slice_status: SliceStatus;
}

export interface BuildingLineSeedV1 {
  readonly building_id: string;
  readonly display_name: string;
  readonly family_id: string;
  readonly max_level_v1: number;
  readonly build_time_l1_s: number;
  readonly build_time_mult_per_level: number;
  readonly cost_food_l1: number;
  readonly cost_wood_l1: number;
  readonly cost_stone_l1: number;
  readonly cost_iron_l1: number;
  readonly cost_mult_per_level: number;
  readonly slice_status: SliceStatus;
}

export type BuildingEffectScalingMode =
  | "mult_per_level"
  | "add_per_level"
  | "step_levels";

export type BuildingEffectDisplayFormat =
  | "per_hour"
  | "multiplier"
  | "integer"
  | "seconds";

export interface BuildingEffectSeedV1 {
  readonly building_id: string;
  readonly stat_key: string;
  readonly value_l1: number;
  readonly scaling_mode: BuildingEffectScalingMode;
  readonly scaling_value: number | string;
  readonly display_format: BuildingEffectDisplayFormat;
  readonly notes: string;
}

export interface UnitLineSeedV1 {
  readonly unit_id: string;
  readonly display_name: string;
  readonly role: UnitRole;
  readonly train_building_id: string;
  readonly train_time_s: number;
  readonly cost_food: number;
  readonly cost_wood: number;
  readonly cost_stone: number;
  readonly cost_iron: number;
  readonly upkeep_food_per_h: number;
  readonly hp: number;
  readonly attack: number;
  readonly def_vs_infantry: number;
  readonly def_vs_ranged: number;
  readonly def_vs_cavalry: number;
  readonly speed_tiles_per_h: number;
  readonly carry: number;
  readonly vision_tiles: number;
  readonly structure_damage: number;
  readonly slice_status: SliceStatus;
}

export interface UnitVariantSeedV1 {
  readonly civ_id: string;
  readonly variant_unit_id: string;
  readonly display_name: string;
  readonly base_unit_id: string;
  readonly role: UnitRole;
  readonly slice_status: SliceStatus;
}

export interface UnitVariantModifierSeedV1 {
  readonly variant_unit_id: string;
  readonly modifier_key: string;
  readonly operation: ModifierOperation;
  readonly value: number;
  readonly condition: string;
}

export interface CivilizationActivationSeedV1 {
  readonly civ_id: string;
  readonly display_name: string;
  readonly first_slice_availability: SliceStatus;
  readonly notes: string;
}

export type CivilizationModuleOwner = "economy" | "buildings" | "units";

export interface CivilizationGlobalModifierSeedV1 {
  readonly civ_id: string;
  readonly module_owner: CivilizationModuleOwner;
  readonly modifier_key: string;
  readonly scope: string;
  readonly operation: ModifierOperation;
  readonly value: number;
  readonly condition: string;
  readonly slice_status: SliceStatus;
}

export type ResourceDefinitionsSeedTableV1 = KeyedSeedTable<ResourceDefinitionSeedV1>;
export type BuildingFamiliesSeedTableV1 = KeyedSeedTable<BuildingFamilySeedV1>;
export type BuildingLinesSeedTableV1 = KeyedSeedTable<BuildingLineSeedV1>;
export type BuildingEffectsSeedTableV1 = RowsSeedTable<BuildingEffectSeedV1>;
export type UnitLinesSeedTableV1 = KeyedSeedTable<UnitLineSeedV1>;
export type UnitVariantsSeedTableV1 = KeyedSeedTable<UnitVariantSeedV1>;
export type UnitVariantModifiersSeedTableV1 = RowsSeedTable<UnitVariantModifierSeedV1>;
export type CivilizationsActivationSeedTableV1 =
  KeyedSeedTable<CivilizationActivationSeedV1>;
export type CivilizationsGlobalModifiersSeedTableV1 =
  RowsSeedTable<CivilizationGlobalModifierSeedV1>;

export interface FirstSliceEnablementConfigV1 {
  readonly schema_version: typeof STARTER_SEED_SCHEMA_VERSION_V1;
  readonly source_doc: string;
  readonly config_id: string;
  readonly slice_id: string;
  readonly enabled_civilization_ids: readonly string[];
  readonly default_visibility: {
    readonly hide_slice_statuses: readonly SliceStatus[];
    readonly show_slice_statuses: readonly SliceStatus[];
  };
  readonly module_filters: {
    readonly economy?: {
      readonly resource_definitions?: {
        readonly allowed_slice_statuses?: readonly SliceStatus[];
      };
    };
    readonly buildings?: {
      readonly building_families?: {
        readonly allowed_slice_statuses?: readonly SliceStatus[];
      };
      readonly building_lines?: {
        readonly allowed_slice_statuses?: readonly SliceStatus[];
      };
      readonly building_effects?: {
        readonly include_only_enabled_buildings?: boolean;
      };
    };
    readonly units?: {
      readonly unit_lines?: {
        readonly allowed_slice_statuses?: readonly SliceStatus[];
      };
      readonly unit_variants?: {
        readonly enabled_civilization_ids?: readonly string[];
        readonly allowed_slice_statuses?: readonly SliceStatus[];
      };
      readonly unit_variant_modifiers?: {
        readonly enabled_civilization_ids?: readonly string[];
        readonly include_only_enabled_variants?: boolean;
      };
    };
    readonly civilizations?: {
      readonly activation?: {
        readonly enabled_civilization_ids?: readonly string[];
        readonly allowed_first_slice_availability?: readonly SliceStatus[];
      };
      readonly global_modifiers?: {
        readonly enabled_civilization_ids?: readonly string[];
        readonly allowed_slice_statuses?: readonly SliceStatus[];
      };
    };
  };
}

export interface StarterSeedBundleV1 {
  readonly economy: {
    readonly resource_definitions: ResourceDefinitionsSeedTableV1;
  };
  readonly buildings: {
    readonly building_families: BuildingFamiliesSeedTableV1;
    readonly building_lines: BuildingLinesSeedTableV1;
    readonly building_effects: BuildingEffectsSeedTableV1;
  };
  readonly units: {
    readonly unit_lines: UnitLinesSeedTableV1;
    readonly unit_variants: UnitVariantsSeedTableV1;
    readonly unit_variant_modifiers: UnitVariantModifiersSeedTableV1;
  };
  readonly civilizations: {
    readonly activation: CivilizationsActivationSeedTableV1;
    readonly global_modifiers: CivilizationsGlobalModifiersSeedTableV1;
  };
}

export interface StarterSeedFilePathsV1 {
  readonly economyResourceDefinitions: string;
  readonly buildingsFamilies: string;
  readonly buildingsLines: string;
  readonly buildingsEffects: string;
  readonly unitsLines: string;
  readonly unitsVariants: string;
  readonly unitsVariantModifiers: string;
  readonly civilizationsActivation: string;
  readonly civilizationsGlobalModifiers: string;
  readonly firstSliceEnablement: string;
}

export interface LoadStarterSeedsResultV1 {
  readonly seeds: StarterSeedBundleV1;
  readonly first_slice_enablement: FirstSliceEnablementConfigV1;
}

export class SeedValidationError extends Error {
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
    this.name = "SeedValidationError";
    this.filePath = options?.filePath;
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

type JsonFileReader = (filePath: string) => Promise<unknown>;

const SLICE_STATUSES: readonly SliceStatus[] = [
  "playable_now",
  "balance_stub",
  "data_stub_post_slice",
];
const UNIT_ROLES: readonly UnitRole[] = [
  "infantry",
  "ranged",
  "scout",
  "cavalry",
  "siege",
];
const MODIFIER_OPERATIONS: readonly ModifierOperation[] = ["mult", "add"];
const BUILDING_EFFECT_SCALING_MODES: readonly BuildingEffectScalingMode[] = [
  "mult_per_level",
  "add_per_level",
  "step_levels",
];
const BUILDING_EFFECT_DISPLAY_FORMATS: readonly BuildingEffectDisplayFormat[] = [
  "per_hour",
  "multiplier",
  "integer",
  "seconds",
];
const CIVILIZATION_MODULE_OWNERS: readonly CivilizationModuleOwner[] = [
  "economy",
  "buildings",
  "units",
];
const STABLE_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

const defaultJsonFileReader: JsonFileReader = async (filePath) => {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new SeedValidationError(`Failed to load JSON file '${filePath}'.`, {
      filePath,
      cause,
    });
  }
};

export const createDefaultStarterSeedFilePathsV1 = (
  repositoryRoot = process.cwd(),
): StarterSeedFilePathsV1 => ({
  economyResourceDefinitions: join(
    repositoryRoot,
    "backend/src/modules/economy/infra/seeds/v1/resource-definitions.json",
  ),
  buildingsFamilies: join(
    repositoryRoot,
    "backend/src/modules/buildings/infra/seeds/v1/building-families.json",
  ),
  buildingsLines: join(
    repositoryRoot,
    "backend/src/modules/buildings/infra/seeds/v1/building-lines.json",
  ),
  buildingsEffects: join(
    repositoryRoot,
    "backend/src/modules/buildings/infra/seeds/v1/building-effects.json",
  ),
  unitsLines: join(
    repositoryRoot,
    "backend/src/modules/units/infra/seeds/v1/unit-lines.json",
  ),
  unitsVariants: join(
    repositoryRoot,
    "backend/src/modules/units/infra/seeds/v1/unit-variants.json",
  ),
  unitsVariantModifiers: join(
    repositoryRoot,
    "backend/src/modules/units/infra/seeds/v1/unit-variant-modifiers.json",
  ),
  civilizationsActivation: join(
    repositoryRoot,
    "backend/src/app/config/seeds/v1/civilizations/activation.json",
  ),
  civilizationsGlobalModifiers: join(
    repositoryRoot,
    "backend/src/app/config/seeds/v1/civilizations/global-modifiers.json",
  ),
  firstSliceEnablement: join(
    repositoryRoot,
    "backend/src/app/config/seeds/v1/first-slice-enablement.json",
  ),
});

export const loadResourceDefinitionsSeedV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<ResourceDefinitionsSeedTableV1> =>
  parseResourceDefinitionsSeedV1(await readJson(filePath));

export const loadBuildingFamiliesSeedV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<BuildingFamiliesSeedTableV1> =>
  parseBuildingFamiliesSeedV1(await readJson(filePath));

export const loadBuildingLinesSeedV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<BuildingLinesSeedTableV1> =>
  parseBuildingLinesSeedV1(await readJson(filePath));

export const loadBuildingEffectsSeedV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<BuildingEffectsSeedTableV1> =>
  parseBuildingEffectsSeedV1(await readJson(filePath));

export const loadUnitLinesSeedV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<UnitLinesSeedTableV1> =>
  parseUnitLinesSeedV1(await readJson(filePath));

export const loadUnitVariantsSeedV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<UnitVariantsSeedTableV1> =>
  parseUnitVariantsSeedV1(await readJson(filePath));

export const loadUnitVariantModifiersSeedV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<UnitVariantModifiersSeedTableV1> =>
  parseUnitVariantModifiersSeedV1(await readJson(filePath));

export const loadCivilizationsActivationSeedV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<CivilizationsActivationSeedTableV1> =>
  parseCivilizationsActivationSeedV1(await readJson(filePath));

export const loadCivilizationsGlobalModifiersSeedV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<CivilizationsGlobalModifiersSeedTableV1> =>
  parseCivilizationsGlobalModifiersSeedV1(await readJson(filePath));

export const loadFirstSliceEnablementConfigV1 = async (
  filePath: string,
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<FirstSliceEnablementConfigV1> =>
  parseFirstSliceEnablementConfigV1(await readJson(filePath));

export const loadStarterSeedBundleV1 = async (
  paths: StarterSeedFilePathsV1 = createDefaultStarterSeedFilePathsV1(),
  readJson: JsonFileReader = defaultJsonFileReader,
): Promise<LoadStarterSeedsResultV1> => {
  const seeds: StarterSeedBundleV1 = {
    economy: {
      resource_definitions: await loadResourceDefinitionsSeedV1(
        paths.economyResourceDefinitions,
        readJson,
      ),
    },
    buildings: {
      building_families: await loadBuildingFamiliesSeedV1(paths.buildingsFamilies, readJson),
      building_lines: await loadBuildingLinesSeedV1(paths.buildingsLines, readJson),
      building_effects: await loadBuildingEffectsSeedV1(paths.buildingsEffects, readJson),
    },
    units: {
      unit_lines: await loadUnitLinesSeedV1(paths.unitsLines, readJson),
      unit_variants: await loadUnitVariantsSeedV1(paths.unitsVariants, readJson),
      unit_variant_modifiers: await loadUnitVariantModifiersSeedV1(
        paths.unitsVariantModifiers,
        readJson,
      ),
    },
    civilizations: {
      activation: await loadCivilizationsActivationSeedV1(
        paths.civilizationsActivation,
        readJson,
      ),
      global_modifiers: await loadCivilizationsGlobalModifiersSeedV1(
        paths.civilizationsGlobalModifiers,
        readJson,
      ),
    },
  };

  validateStarterSeedCrossReferencesV1(seeds);

  return {
    seeds,
    first_slice_enablement: await loadFirstSliceEnablementConfigV1(
      paths.firstSliceEnablement,
      readJson,
    ),
  };
};

export const parseResourceDefinitionsSeedV1 = (
  raw: unknown,
): ResourceDefinitionsSeedTableV1 =>
  parseKeyedSeedTable(
    raw,
    "economy.resource_definitions",
    "resource_id",
    parseResourceDefinitionSeedV1,
    (row) => row.resource_id,
  );

export const parseBuildingFamiliesSeedV1 = (
  raw: unknown,
): BuildingFamiliesSeedTableV1 =>
  parseKeyedSeedTable(
    raw,
    "buildings.building_families",
    "family_id",
    parseBuildingFamilySeedV1,
    (row) => row.family_id,
  );

export const parseBuildingLinesSeedV1 = (raw: unknown): BuildingLinesSeedTableV1 =>
  parseKeyedSeedTable(
    raw,
    "buildings.building_lines",
    "building_id",
    parseBuildingLineSeedV1,
    (row) => row.building_id,
  );

export const parseBuildingEffectsSeedV1 = (
  raw: unknown,
): BuildingEffectsSeedTableV1 =>
  parseRowsSeedTable(
    raw,
    "buildings.building_effects",
    parseBuildingEffectSeedV1,
    (row) => `${row.building_id}::${row.stat_key}`,
  );

export const parseUnitLinesSeedV1 = (raw: unknown): UnitLinesSeedTableV1 =>
  parseKeyedSeedTable(raw, "units.unit_lines", "unit_id", parseUnitLineSeedV1, (row) => row.unit_id);

export const parseUnitVariantsSeedV1 = (raw: unknown): UnitVariantsSeedTableV1 =>
  parseKeyedSeedTable(
    raw,
    "units.unit_variants",
    "variant_unit_id",
    parseUnitVariantSeedV1,
    (row) => row.variant_unit_id,
  );

export const parseUnitVariantModifiersSeedV1 = (
  raw: unknown,
): UnitVariantModifiersSeedTableV1 =>
  parseRowsSeedTable(
    raw,
    "units.unit_variant_modifiers",
    parseUnitVariantModifierSeedV1,
    (row) => `${row.variant_unit_id}::${row.modifier_key}::${row.condition}`,
  );

export const parseCivilizationsActivationSeedV1 = (
  raw: unknown,
): CivilizationsActivationSeedTableV1 =>
  parseKeyedSeedTable(
    raw,
    "civilizations.activation",
    "civ_id",
    parseCivilizationActivationSeedV1,
    (row) => row.civ_id,
  );

export const parseCivilizationsGlobalModifiersSeedV1 = (
  raw: unknown,
): CivilizationsGlobalModifiersSeedTableV1 =>
  parseRowsSeedTable(
    raw,
    "civilizations.global_modifiers",
    parseCivilizationGlobalModifierSeedV1,
    (row) =>
      `${row.civ_id}::${row.module_owner}::${row.modifier_key}::${row.scope}::${row.condition}`,
  );

export const parseFirstSliceEnablementConfigV1 = (
  raw: unknown,
): FirstSliceEnablementConfigV1 => {
  const root = asRecord(raw, "$");
  readLiteralString(root, "schema_version", STARTER_SEED_SCHEMA_VERSION_V1, "$");

  const defaultVisibility = asRecord(
    readUnknown(root, "default_visibility", "$"),
    "$.default_visibility",
  );
  const moduleFilters = asRecord(readUnknown(root, "module_filters", "$"), "$.module_filters");

  return {
    schema_version: STARTER_SEED_SCHEMA_VERSION_V1,
    source_doc: readString(root, "source_doc", "$"),
    config_id: readString(root, "config_id", "$"),
    slice_id: readString(root, "slice_id", "$"),
    enabled_civilization_ids: readStringArray(root, "enabled_civilization_ids", "$"),
    default_visibility: {
      hide_slice_statuses: readEnumArray(
        defaultVisibility,
        "hide_slice_statuses",
        "$.default_visibility",
        SLICE_STATUSES,
      ),
      show_slice_statuses: readEnumArray(
        defaultVisibility,
        "show_slice_statuses",
        "$.default_visibility",
        SLICE_STATUSES,
      ),
    },
    module_filters: {
      economy: parseOptionalObject(moduleFilters, "economy", "$.module_filters", (economy) => ({
        resource_definitions: parseOptionalObject(
          economy,
          "resource_definitions",
          "$.module_filters.economy",
          (row) => ({
            allowed_slice_statuses: readOptionalEnumArray(
              row,
              "allowed_slice_statuses",
              "$.module_filters.economy.resource_definitions",
              SLICE_STATUSES,
            ),
          }),
        ),
      })),
      buildings: parseOptionalObject(moduleFilters, "buildings", "$.module_filters", (buildings) => ({
        building_families: parseOptionalObject(
          buildings,
          "building_families",
          "$.module_filters.buildings",
          (row) => ({
            allowed_slice_statuses: readOptionalEnumArray(
              row,
              "allowed_slice_statuses",
              "$.module_filters.buildings.building_families",
              SLICE_STATUSES,
            ),
          }),
        ),
        building_lines: parseOptionalObject(
          buildings,
          "building_lines",
          "$.module_filters.buildings",
          (row) => ({
            allowed_slice_statuses: readOptionalEnumArray(
              row,
              "allowed_slice_statuses",
              "$.module_filters.buildings.building_lines",
              SLICE_STATUSES,
            ),
          }),
        ),
        building_effects: parseOptionalObject(
          buildings,
          "building_effects",
          "$.module_filters.buildings",
          (row) => ({
            include_only_enabled_buildings: readOptionalBoolean(
              row,
              "include_only_enabled_buildings",
              "$.module_filters.buildings.building_effects",
            ),
          }),
        ),
      })),
      units: parseOptionalObject(moduleFilters, "units", "$.module_filters", (units) => ({
        unit_lines: parseOptionalObject(units, "unit_lines", "$.module_filters.units", (row) => ({
          allowed_slice_statuses: readOptionalEnumArray(
            row,
            "allowed_slice_statuses",
            "$.module_filters.units.unit_lines",
            SLICE_STATUSES,
          ),
        })),
        unit_variants: parseOptionalObject(
          units,
          "unit_variants",
          "$.module_filters.units",
          (row) => ({
            enabled_civilization_ids: readOptionalStringArray(
              row,
              "enabled_civilization_ids",
              "$.module_filters.units.unit_variants",
            ),
            allowed_slice_statuses: readOptionalEnumArray(
              row,
              "allowed_slice_statuses",
              "$.module_filters.units.unit_variants",
              SLICE_STATUSES,
            ),
          }),
        ),
        unit_variant_modifiers: parseOptionalObject(
          units,
          "unit_variant_modifiers",
          "$.module_filters.units",
          (row) => ({
            enabled_civilization_ids: readOptionalStringArray(
              row,
              "enabled_civilization_ids",
              "$.module_filters.units.unit_variant_modifiers",
            ),
            include_only_enabled_variants: readOptionalBoolean(
              row,
              "include_only_enabled_variants",
              "$.module_filters.units.unit_variant_modifiers",
            ),
          }),
        ),
      })),
      civilizations: parseOptionalObject(
        moduleFilters,
        "civilizations",
        "$.module_filters",
        (civilizations) => ({
          activation: parseOptionalObject(
            civilizations,
            "activation",
            "$.module_filters.civilizations",
            (row) => ({
              enabled_civilization_ids: readOptionalStringArray(
                row,
                "enabled_civilization_ids",
                "$.module_filters.civilizations.activation",
              ),
              allowed_first_slice_availability: readOptionalEnumArray(
                row,
                "allowed_first_slice_availability",
                "$.module_filters.civilizations.activation",
                SLICE_STATUSES,
              ),
            }),
          ),
          global_modifiers: parseOptionalObject(
            civilizations,
            "global_modifiers",
            "$.module_filters.civilizations",
            (row) => ({
              enabled_civilization_ids: readOptionalStringArray(
                row,
                "enabled_civilization_ids",
                "$.module_filters.civilizations.global_modifiers",
              ),
              allowed_slice_statuses: readOptionalEnumArray(
                row,
                "allowed_slice_statuses",
                "$.module_filters.civilizations.global_modifiers",
                SLICE_STATUSES,
              ),
            }),
          ),
        }),
      ),
    },
  };
};

export const validateStarterSeedCrossReferencesV1 = (bundle: StarterSeedBundleV1): void => {
  const buildingIds = new Set(Object.keys(bundle.buildings.building_lines.entries_by_id));
  const familyIds = new Set(Object.keys(bundle.buildings.building_families.entries_by_id));
  const unitIds = new Set(Object.keys(bundle.units.unit_lines.entries_by_id));
  const variantIds = new Set(Object.keys(bundle.units.unit_variants.entries_by_id));
  const civIds = new Set(Object.keys(bundle.civilizations.activation.entries_by_id));

  for (const row of Object.values(bundle.economy.resource_definitions.entries_by_id)) {
    assertRef(buildingIds, row.producer_building_id, "economy.resource_definitions", {
      resource_id: row.resource_id,
      field: "producer_building_id",
    });
  }

  for (const row of Object.values(bundle.buildings.building_lines.entries_by_id)) {
    assertRef(familyIds, row.family_id, "buildings.building_lines", {
      building_id: row.building_id,
      field: "family_id",
    });
  }

  for (const row of bundle.buildings.building_effects.rows) {
    assertRef(buildingIds, row.building_id, "buildings.building_effects", {
      stat_key: row.stat_key,
      field: "building_id",
    });
  }

  for (const row of Object.values(bundle.units.unit_lines.entries_by_id)) {
    assertRef(buildingIds, row.train_building_id, "units.unit_lines", {
      unit_id: row.unit_id,
      field: "train_building_id",
    });
  }

  for (const row of Object.values(bundle.units.unit_variants.entries_by_id)) {
    assertRef(civIds, row.civ_id, "units.unit_variants", {
      variant_unit_id: row.variant_unit_id,
      field: "civ_id",
    });
    assertRef(unitIds, row.base_unit_id, "units.unit_variants", {
      variant_unit_id: row.variant_unit_id,
      field: "base_unit_id",
    });

    const base = bundle.units.unit_lines.entries_by_id[row.base_unit_id];
    if (base.role !== row.role) {
      throw new SeedValidationError(
        `Role mismatch in 'units.unit_variants' for '${row.variant_unit_id}': base unit '${row.base_unit_id}' role '${base.role}' != '${row.role}'.`,
      );
    }
  }

  for (const row of bundle.units.unit_variant_modifiers.rows) {
    assertRef(variantIds, row.variant_unit_id, "units.unit_variant_modifiers", {
      modifier_key: row.modifier_key,
      field: "variant_unit_id",
    });
  }

  for (const row of bundle.civilizations.global_modifiers.rows) {
    assertRef(civIds, row.civ_id, "civilizations.global_modifiers", {
      modifier_key: row.modifier_key,
      field: "civ_id",
    });
  }
};

export const applyFirstSliceFilteringV1 = (
  bundle: StarterSeedBundleV1,
  enablement: FirstSliceEnablementConfigV1,
): StarterSeedBundleV1 => {
  const visibleByDefault = createDefaultSliceVisibilityPredicate(enablement);

  const buildingFamilies = filterKeyedTable(bundle.buildings.building_families, (row) =>
    allowSliceStatus(
      row.slice_status,
      enablement.module_filters.buildings?.building_families?.allowed_slice_statuses,
      visibleByDefault,
    ),
  );

  const buildingLines = filterKeyedTable(bundle.buildings.building_lines, (row) =>
    allowSliceStatus(
      row.slice_status,
      enablement.module_filters.buildings?.building_lines?.allowed_slice_statuses,
      visibleByDefault,
    ),
  );

  const enabledBuildingIds = new Set(Object.keys(buildingLines.entries_by_id));

  const filteredUnitVariants = filterKeyedTable(bundle.units.unit_variants, (row) => {
    const enabledCivs =
      enablement.module_filters.units?.unit_variants?.enabled_civilization_ids ??
      enablement.enabled_civilization_ids;
    if (enabledCivs.length > 0 && !enabledCivs.includes(row.civ_id)) {
      return false;
    }
    return allowSliceStatus(
      row.slice_status,
      enablement.module_filters.units?.unit_variants?.allowed_slice_statuses,
      visibleByDefault,
    );
  });

  const enabledVariantIds = new Set(Object.keys(filteredUnitVariants.entries_by_id));
  const enabledModifierCivs =
    enablement.module_filters.units?.unit_variant_modifiers?.enabled_civilization_ids ??
    enablement.enabled_civilization_ids;

  const filteredUnitVariantModifiers = filterRowsTable(
    bundle.units.unit_variant_modifiers,
    (row) => {
      const variant = bundle.units.unit_variants.entries_by_id[row.variant_unit_id];
      if (variant === undefined) {
        return false;
      }
      if (!enabledVariantIds.has(row.variant_unit_id)) {
        return false;
      }
      if (enabledModifierCivs.length > 0 && !enabledModifierCivs.includes(variant.civ_id)) {
        return false;
      }
      if (
        enablement.module_filters.units?.unit_variant_modifiers
          ?.include_only_enabled_variants &&
        !enabledVariantIds.has(row.variant_unit_id)
      ) {
        return false;
      }
      return true;
    },
  );

  const filtered: StarterSeedBundleV1 = {
    economy: {
      resource_definitions: filterKeyedTable(bundle.economy.resource_definitions, (row) =>
        allowSliceStatus(
          row.slice_status,
          enablement.module_filters.economy?.resource_definitions?.allowed_slice_statuses,
          visibleByDefault,
        ),
      ),
    },
    buildings: {
      building_families: buildingFamilies,
      building_lines: buildingLines,
      building_effects: filterRowsTable(bundle.buildings.building_effects, (row) => {
        if (
          enablement.module_filters.buildings?.building_effects
            ?.include_only_enabled_buildings
        ) {
          return enabledBuildingIds.has(row.building_id);
        }
        return true;
      }),
    },
    units: {
      unit_lines: filterKeyedTable(bundle.units.unit_lines, (row) =>
        allowSliceStatus(
          row.slice_status,
          enablement.module_filters.units?.unit_lines?.allowed_slice_statuses,
          visibleByDefault,
        ),
      ),
      unit_variants: filteredUnitVariants,
      unit_variant_modifiers: filteredUnitVariantModifiers,
    },
    civilizations: {
      activation: filterKeyedTable(bundle.civilizations.activation, (row) => {
        const enabledCivs =
          enablement.module_filters.civilizations?.activation?.enabled_civilization_ids ??
          enablement.enabled_civilization_ids;
        if (enabledCivs.length > 0 && !enabledCivs.includes(row.civ_id)) {
          return false;
        }
        const allowedAvailability =
          enablement.module_filters.civilizations?.activation
            ?.allowed_first_slice_availability;
        if (allowedAvailability && allowedAvailability.length > 0) {
          return allowedAvailability.includes(row.first_slice_availability);
        }
        return visibleByDefault(row.first_slice_availability);
      }),
      global_modifiers: filterRowsTable(bundle.civilizations.global_modifiers, (row) => {
        const enabledCivs =
          enablement.module_filters.civilizations?.global_modifiers
            ?.enabled_civilization_ids ?? enablement.enabled_civilization_ids;
        if (enabledCivs.length > 0 && !enabledCivs.includes(row.civ_id)) {
          return false;
        }
        return allowSliceStatus(
          row.slice_status,
          enablement.module_filters.civilizations?.global_modifiers?.allowed_slice_statuses,
          visibleByDefault,
        );
      }),
    },
  };

  validateStarterSeedCrossReferencesV1(filtered);
  return filtered;
};

function parseKeyedSeedTable<TEntry>(
  raw: unknown,
  expectedTableId: string,
  expectedKeyField: string,
  parseEntry: (rawEntry: unknown, path: string) => TEntry,
  getEntryId: (entry: TEntry) => string,
): KeyedSeedTable<TEntry> {
  const root = parseSeedTableMeta(raw, expectedTableId);
  readLiteralString(root, "key_field", expectedKeyField, "$");
  const entries = asRecord(readUnknown(root, "entries_by_id", "$"), "$.entries_by_id");

  const parsed: Record<string, TEntry> = {};
  const seen = new Set<string>();

  for (const [key, value] of Object.entries(entries)) {
    assertStableId(key, `$.entries_by_id.${key}`);
    const entry = parseEntry(value, `$.entries_by_id.${key}`);
    const entryId = getEntryId(entry);

    if (entryId !== key) {
      throw new SeedValidationError(
        `Stable ID mismatch in '${expectedTableId}': object key '${key}' != '${expectedKeyField}' value '${entryId}'.`,
      );
    }

    if (seen.has(entryId)) {
      throw new SeedValidationError(`Duplicate ID '${entryId}' in '${expectedTableId}'.`);
    }

    seen.add(entryId);
    parsed[key] = entry;
  }

  return {
    schema_version: STARTER_SEED_SCHEMA_VERSION_V1,
    source_doc: readString(root, "source_doc", "$"),
    source_section: readString(root, "source_section", "$"),
    table_id: expectedTableId,
    key_field: expectedKeyField,
    entries_by_id: parsed,
  };
}

function parseRowsSeedTable<TRow>(
  raw: unknown,
  expectedTableId: string,
  parseRow: (rawRow: unknown, path: string) => TRow,
  getIdentity?: (row: TRow) => string,
): RowsSeedTable<TRow> {
  const root = parseSeedTableMeta(raw, expectedTableId);
  const rowsRaw = asArray(readUnknown(root, "rows", "$"), "$.rows");
  const rows: TRow[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rowsRaw.length; i += 1) {
    const row = parseRow(rowsRaw[i], `$.rows[${i}]`);
    if (getIdentity) {
      const identity = getIdentity(row);
      if (seen.has(identity)) {
        throw new SeedValidationError(
          `Duplicate row identity '${identity}' in '${expectedTableId}'.`,
        );
      }
      seen.add(identity);
    }
    rows.push(row);
  }

  return {
    schema_version: STARTER_SEED_SCHEMA_VERSION_V1,
    source_doc: readString(root, "source_doc", "$"),
    source_section: readString(root, "source_section", "$"),
    table_id: expectedTableId,
    rows,
  };
}

function parseSeedTableMeta(
  raw: unknown,
  expectedTableId: string,
): Record<string, unknown> {
  const root = asRecord(raw, "$");
  readLiteralString(root, "schema_version", STARTER_SEED_SCHEMA_VERSION_V1, "$");
  readLiteralString(root, "table_id", expectedTableId, "$");
  readString(root, "source_doc", "$");
  readString(root, "source_section", "$");
  return root;
}

function parseResourceDefinitionSeedV1(
  raw: unknown,
  path: string,
): ResourceDefinitionSeedV1 {
  const row = asRecord(raw, path);
  return {
    resource_id: readStableId(row, "resource_id", path),
    display_name: readString(row, "display_name", path),
    short_label: readString(row, "short_label", path),
    icon_key: readString(row, "icon_key", path),
    starting_stock: readFiniteNumber(row, "starting_stock", path),
    base_storage_cap: readFiniteNumber(row, "base_storage_cap", path),
    base_passive_prod_per_h: readFiniteNumber(row, "base_passive_prod_per_h", path),
    producer_building_id: readStableId(row, "producer_building_id", path),
    slice_status: readEnum(row, "slice_status", path, SLICE_STATUSES),
  };
}

function parseBuildingFamilySeedV1(raw: unknown, path: string): BuildingFamilySeedV1 {
  const row = asRecord(raw, path);
  return {
    family_id: readStableId(row, "family_id", path),
    display_name: readString(row, "display_name", path),
    purpose_summary: readString(row, "purpose_summary", path),
    primary_backend_owner: readString(row, "primary_backend_owner", path),
    frontend_tab: readString(row, "frontend_tab", path),
    slice_status: readEnum(row, "slice_status", path, SLICE_STATUSES),
  };
}

function parseBuildingLineSeedV1(raw: unknown, path: string): BuildingLineSeedV1 {
  const row = asRecord(raw, path);
  return {
    building_id: readStableId(row, "building_id", path),
    display_name: readString(row, "display_name", path),
    family_id: readStableId(row, "family_id", path),
    max_level_v1: readFiniteNumber(row, "max_level_v1", path),
    build_time_l1_s: readFiniteNumber(row, "build_time_l1_s", path),
    build_time_mult_per_level: readFiniteNumber(row, "build_time_mult_per_level", path),
    cost_food_l1: readFiniteNumber(row, "cost_food_l1", path),
    cost_wood_l1: readFiniteNumber(row, "cost_wood_l1", path),
    cost_stone_l1: readFiniteNumber(row, "cost_stone_l1", path),
    cost_iron_l1: readFiniteNumber(row, "cost_iron_l1", path),
    cost_mult_per_level: readFiniteNumber(row, "cost_mult_per_level", path),
    slice_status: readEnum(row, "slice_status", path, SLICE_STATUSES),
  };
}

function parseBuildingEffectSeedV1(raw: unknown, path: string): BuildingEffectSeedV1 {
  const row = asRecord(raw, path);
  return {
    building_id: readStableId(row, "building_id", path),
    stat_key: readString(row, "stat_key", path),
    value_l1: readFiniteNumber(row, "value_l1", path),
    scaling_mode: readEnum(row, "scaling_mode", path, BUILDING_EFFECT_SCALING_MODES),
    scaling_value: readNumberOrString(row, "scaling_value", path),
    display_format: readEnum(
      row,
      "display_format",
      path,
      BUILDING_EFFECT_DISPLAY_FORMATS,
    ),
    notes: readString(row, "notes", path),
  };
}

function parseUnitLineSeedV1(raw: unknown, path: string): UnitLineSeedV1 {
  const row = asRecord(raw, path);
  return {
    unit_id: readStableId(row, "unit_id", path),
    display_name: readString(row, "display_name", path),
    role: readEnum(row, "role", path, UNIT_ROLES),
    train_building_id: readStableId(row, "train_building_id", path),
    train_time_s: readFiniteNumber(row, "train_time_s", path),
    cost_food: readFiniteNumber(row, "cost_food", path),
    cost_wood: readFiniteNumber(row, "cost_wood", path),
    cost_stone: readFiniteNumber(row, "cost_stone", path),
    cost_iron: readFiniteNumber(row, "cost_iron", path),
    upkeep_food_per_h: readFiniteNumber(row, "upkeep_food_per_h", path),
    hp: readFiniteNumber(row, "hp", path),
    attack: readFiniteNumber(row, "attack", path),
    def_vs_infantry: readFiniteNumber(row, "def_vs_infantry", path),
    def_vs_ranged: readFiniteNumber(row, "def_vs_ranged", path),
    def_vs_cavalry: readFiniteNumber(row, "def_vs_cavalry", path),
    speed_tiles_per_h: readFiniteNumber(row, "speed_tiles_per_h", path),
    carry: readFiniteNumber(row, "carry", path),
    vision_tiles: readFiniteNumber(row, "vision_tiles", path),
    structure_damage: readFiniteNumber(row, "structure_damage", path),
    slice_status: readEnum(row, "slice_status", path, SLICE_STATUSES),
  };
}

function parseUnitVariantSeedV1(raw: unknown, path: string): UnitVariantSeedV1 {
  const row = asRecord(raw, path);
  return {
    civ_id: readStableId(row, "civ_id", path),
    variant_unit_id: readStableId(row, "variant_unit_id", path),
    display_name: readString(row, "display_name", path),
    base_unit_id: readStableId(row, "base_unit_id", path),
    role: readEnum(row, "role", path, UNIT_ROLES),
    slice_status: readEnum(row, "slice_status", path, SLICE_STATUSES),
  };
}

function parseUnitVariantModifierSeedV1(
  raw: unknown,
  path: string,
): UnitVariantModifierSeedV1 {
  const row = asRecord(raw, path);
  return {
    variant_unit_id: readStableId(row, "variant_unit_id", path),
    modifier_key: readString(row, "modifier_key", path),
    operation: readEnum(row, "operation", path, MODIFIER_OPERATIONS),
    value: readFiniteNumber(row, "value", path),
    condition: readString(row, "condition", path),
  };
}

function parseCivilizationActivationSeedV1(
  raw: unknown,
  path: string,
): CivilizationActivationSeedV1 {
  const row = asRecord(raw, path);
  return {
    civ_id: readStableId(row, "civ_id", path),
    display_name: readString(row, "display_name", path),
    first_slice_availability: readEnum(
      row,
      "first_slice_availability",
      path,
      SLICE_STATUSES,
    ),
    notes: readString(row, "notes", path),
  };
}

function parseCivilizationGlobalModifierSeedV1(
  raw: unknown,
  path: string,
): CivilizationGlobalModifierSeedV1 {
  const row = asRecord(raw, path);
  return {
    civ_id: readStableId(row, "civ_id", path),
    module_owner: readEnum(row, "module_owner", path, CIVILIZATION_MODULE_OWNERS),
    modifier_key: readString(row, "modifier_key", path),
    scope: readString(row, "scope", path),
    operation: readEnum(row, "operation", path, MODIFIER_OPERATIONS),
    value: readFiniteNumber(row, "value", path),
    condition: readString(row, "condition", path),
    slice_status: readEnum(row, "slice_status", path, SLICE_STATUSES),
  };
}

function parseOptionalObject<T>(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  parse: (value: Record<string, unknown>) => T,
): T | undefined {
  if (!hasOwn(obj, field)) {
    return undefined;
  }
  return parse(asRecord(obj[field], `${path}.${field}`));
}

function filterKeyedTable<TEntry>(
  table: KeyedSeedTable<TEntry>,
  predicate: (entry: TEntry) => boolean,
): KeyedSeedTable<TEntry> {
  const filtered: Record<string, TEntry> = {};
  for (const [id, entry] of Object.entries(table.entries_by_id)) {
    if (predicate(entry)) {
      filtered[id] = entry;
    }
  }
  return { ...table, entries_by_id: filtered };
}

function filterRowsTable<TRow>(
  table: RowsSeedTable<TRow>,
  predicate: (row: TRow) => boolean,
): RowsSeedTable<TRow> {
  return { ...table, rows: table.rows.filter(predicate) };
}

function createDefaultSliceVisibilityPredicate(
  enablement: FirstSliceEnablementConfigV1,
): (status: SliceStatus) => boolean {
  const hidden = new Set(enablement.default_visibility.hide_slice_statuses);
  const shown = new Set(enablement.default_visibility.show_slice_statuses);

  return (status) => {
    if (hidden.has(status)) {
      return false;
    }
    if (shown.has(status)) {
      return true;
    }
    return true;
  };
}

function allowSliceStatus(
  status: SliceStatus,
  allowed: readonly SliceStatus[] | undefined,
  visibleByDefault: (status: SliceStatus) => boolean,
): boolean {
  if (allowed && allowed.length > 0) {
    return allowed.includes(status);
  }
  return visibleByDefault(status);
}

function assertRef(
  ids: Set<string>,
  refId: string,
  tableId: string,
  details: Record<string, unknown>,
): void {
  if (!ids.has(refId)) {
    throw new SeedValidationError(
      `Missing cross-reference '${refId}' in '${tableId}'.`,
      { details: { ...details, missing_id: refId, table_id: tableId } },
    );
  }
}

function readUnknown(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): unknown {
  if (!hasOwn(obj, field)) {
    throw new SeedValidationError(`Missing required field '${path}.${field}'.`);
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
    throw new SeedValidationError(
      `Field '${path}.${field}' must be a string (received ${describeType(value)}).`,
    );
  }
  if (value.trim().length === 0) {
    throw new SeedValidationError(`Field '${path}.${field}' must not be empty.`);
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
    throw new SeedValidationError(
      `Field '${path}.${field}' must equal '${expected}' (received '${value}').`,
    );
  }
  return expected;
}

function readStableId(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): string {
  const value = readString(obj, field, path);
  assertStableId(value, `${path}.${field}`);
  return value;
}

function assertStableId(value: string, path: string): void {
  if (!STABLE_ID_PATTERN.test(value)) {
    throw new SeedValidationError(
      `Field '${path}' must be a stable snake_case identifier (received '${value}').`,
    );
  }
}

function readFiniteNumber(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): number {
  const value = readUnknown(obj, field, path);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SeedValidationError(
      `Field '${path}.${field}' must be a finite number (received ${describeType(value)}).`,
    );
  }
  return value;
}

function readNumberOrString(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): number | string {
  const value = readUnknown(obj, field, path);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new SeedValidationError(
    `Field '${path}.${field}' must be a finite number or non-empty string (received ${describeType(value)}).`,
  );
}

function readEnum<TValue extends string>(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  allowed: readonly TValue[],
): TValue {
  const value = readString(obj, field, path);
  if (!allowed.includes(value as TValue)) {
    throw new SeedValidationError(
      `Field '${path}.${field}' must be one of [${allowed.join(", ")}] (received '${value}').`,
    );
  }
  return value as TValue;
}

function readStringArray(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): readonly string[] {
  const raw = asArray(readUnknown(obj, field, path), `${path}.${field}`);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const value = raw[i];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new SeedValidationError(
        `Field '${path}.${field}[${i}]' must be a non-empty string (received ${describeType(value)}).`,
      );
    }
    out.push(value);
  }
  ensureNoDuplicateStrings(out, `${path}.${field}`);
  return out;
}

function readOptionalStringArray(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): readonly string[] | undefined {
  if (!hasOwn(obj, field)) {
    return undefined;
  }
  return readStringArray(obj, field, path);
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
    if (typeof value !== "string") {
      throw new SeedValidationError(
        `Field '${path}.${field}[${i}]' must be a string enum value (received ${describeType(value)}).`,
      );
    }
    if (!allowed.includes(value as TValue)) {
      throw new SeedValidationError(
        `Field '${path}.${field}[${i}]' must be one of [${allowed.join(", ")}] (received '${value}').`,
      );
    }
    out.push(value as TValue);
  }
  ensureNoDuplicateStrings(out, `${path}.${field}`);
  return out;
}

function readOptionalEnumArray<TValue extends string>(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  allowed: readonly TValue[],
): readonly TValue[] | undefined {
  if (!hasOwn(obj, field)) {
    return undefined;
  }
  return readEnumArray(obj, field, path, allowed);
}

function readOptionalBoolean(
  obj: Record<string, unknown>,
  field: string,
  path: string,
): boolean | undefined {
  if (!hasOwn(obj, field)) {
    return undefined;
  }
  const value = obj[field];
  if (typeof value !== "boolean") {
    throw new SeedValidationError(
      `Field '${path}.${field}' must be a boolean (received ${describeType(value)}).`,
    );
  }
  return value;
}

function ensureNoDuplicateStrings(values: readonly string[], path: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new SeedValidationError(`Duplicate value '${value}' in '${path}'.`);
    }
    seen.add(value);
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SeedValidationError(
      `Expected object at '${path}' (received ${describeType(value)}).`,
    );
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new SeedValidationError(
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
