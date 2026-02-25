import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  applyFirstSliceFilteringV1,
  loadStarterSeedBundleV1,
  parseBuildingActivationThresholdsSeedV1,
  parseResourceDefinitionsSeedV1,
  parseUnitVariantModifiersSeedV1,
  SeedValidationError,
  validateStarterSeedCrossReferencesV1,
} from "./starter-seed-loaders";

const assertSeedValidationError = (
  operation: () => unknown,
  expectedMessage: string,
): void => {
  assert.throws(
    () => {
      operation();
    },
    (error) =>
      error instanceof SeedValidationError &&
      error.message.includes(expectedMessage),
    `Expected SeedValidationError containing '${expectedMessage}'.`,
  );
};

test("parseResourceDefinitionsSeedV1 rejects malformed numeric shape", () => {
  const malformedSeed = {
    schema_version: "rk-v1-starter-seed",
    source_doc: "docs/design/v1-starter-data-tables.md",
    source_section: "Unit test malformed shape fixture",
    table_id: "economy.resource_definitions",
    key_field: "resource_id",
    entries_by_id: {
      food: {
        resource_id: "food",
        display_name: "Food",
        short_label: "FOOD",
        icon_key: "res_food_placeholder",
        starting_stock: "300",
        base_storage_cap: 1000,
        base_passive_prod_per_h: 6,
        producer_building_id: "grain_plot",
        slice_status: "playable_now",
      },
    },
  };

  assertSeedValidationError(
    () => {
      parseResourceDefinitionsSeedV1(malformedSeed);
    },
    "Field '$.entries_by_id.food.starting_stock' must be a finite number",
  );
});

test("parseUnitVariantModifiersSeedV1 rejects duplicate row identity", () => {
  const duplicateRowSeed = {
    schema_version: "rk-v1-starter-seed",
    source_doc: "docs/design/v1-starter-data-tables.md",
    source_section: "Unit test duplicate-row fixture",
    table_id: "units.unit_variant_modifiers",
    rows: [
      {
        variant_unit_id: "brand_levies",
        modifier_key: "cost_total",
        operation: "mult",
        value: 0.9,
        condition: "always",
      },
      {
        variant_unit_id: "brand_levies",
        modifier_key: "cost_total",
        operation: "mult",
        value: 0.85,
        condition: "always",
      },
    ],
  };

  assertSeedValidationError(
    () => {
      parseUnitVariantModifiersSeedV1(duplicateRowSeed);
    },
    "Duplicate row identity 'brand_levies::cost_total::always' in 'units.unit_variant_modifiers'.",
  );
});

test("parseBuildingActivationThresholdsSeedV1 rejects duplicate activation_rule_id", () => {
  const duplicateRowSeed = {
    schema_version: "rk-v1-starter-seed",
    source_doc: "docs/design/v1-starter-data-tables.md",
    source_section: "Unit test duplicate-row fixture",
    table_id: "buildings.building_activation_thresholds",
    rows: [
      {
        activation_rule_id: "act_granary_unlock_food_90",
        activation_package_id: "m2_storage_defense_activation",
        building_id: "granary",
        threshold_phase: "unlock",
        threshold_key: "resource_stock_ratio",
        scope: "resource:food",
        operation: "gte",
        value: 0.9,
        value_display_format: "ratio",
        ui_locked_hint: "hint_granary_unlock_food_cap_pressure",
        slice_status: "data_stub_post_slice",
      },
      {
        activation_rule_id: "act_granary_unlock_food_90",
        activation_package_id: "m2_storage_defense_activation",
        building_id: "granary",
        threshold_phase: "unlock",
        threshold_key: "building_level_min",
        scope: "building:grain_plot",
        operation: "gte",
        value: 4,
        value_display_format: "integer",
        ui_locked_hint: "hint_granary_unlock_grain_plot_l4",
        slice_status: "data_stub_post_slice",
      },
    ],
  };

  assertSeedValidationError(
    () => {
      parseBuildingActivationThresholdsSeedV1(duplicateRowSeed);
    },
    "Duplicate row identity 'act_granary_unlock_food_90' in 'buildings.building_activation_thresholds'.",
  );
});

test("validateStarterSeedCrossReferencesV1 rejects missing unit base reference", async () => {
  const { seeds } = await loadStarterSeedBundleV1();
  const missingUnitReferenceBundle = {
    ...seeds,
    units: {
      ...seeds.units,
      unit_variants: {
        ...seeds.units.unit_variants,
        entries_by_id: {
          ...seeds.units.unit_variants.entries_by_id,
          brand_levies: {
            ...seeds.units.unit_variants.entries_by_id.brand_levies,
            base_unit_id: "missing_base_unit",
          },
        },
      },
    },
  };

  assertSeedValidationError(
    () => {
      validateStarterSeedCrossReferencesV1(missingUnitReferenceBundle);
    },
    "Missing cross-reference 'missing_base_unit' in 'units.unit_variants'.",
  );
});

test("loadStarterSeedBundleV1 preserves post-slice building activation threshold IDs", async () => {
  const { seeds } = await loadStarterSeedBundleV1();
  const ruleIds = seeds.buildings.building_activation_thresholds.rows.map(
    (row) => row.activation_rule_id,
  );

  assert.deepStrictEqual(ruleIds, [
    "act_granary_reveal_food_75",
    "act_granary_unlock_food_90",
    "act_granary_unlock_grain_plot_l4",
    "act_warehouse_reveal_nonfood_75",
    "act_warehouse_unlock_nonfood_90",
    "act_warehouse_unlock_timber_camp_l4",
    "act_warehouse_unlock_stone_quarry_l3",
    "act_palisade_reveal_barracks_l3",
    "act_palisade_unlock_barracks_l4",
    "act_palisade_unlock_rally_post_l2",
    "act_watchtower_reveal_palisade_l2",
    "act_watchtower_unlock_palisade_l4",
    "act_watchtower_unlock_rally_post_l4",
    "act_guardhouse_reveal_palisade_l3",
    "act_guardhouse_unlock_palisade_l5",
    "act_guardhouse_unlock_barracks_l5",
  ]);
});

test("applyFirstSliceFilteringV1 excludes stub entries and keeps cinder_throne_legates starter scope", async () => {
  const { seeds, first_slice_enablement } = await loadStarterSeedBundleV1();
  const filtered = applyFirstSliceFilteringV1(seeds, first_slice_enablement);

  assert.deepStrictEqual(
    Object.keys(filtered.buildings.building_families.entries_by_id).sort(),
    ["economy", "logistics", "military"].sort(),
  );
  assert.deepStrictEqual(
    Object.keys(filtered.buildings.building_lines.entries_by_id).sort(),
    ["barracks", "grain_plot", "iron_pit", "rally_post", "stone_quarry", "timber_camp"].sort(),
  );
  assert.ok(!Object.prototype.hasOwnProperty.call(filtered.buildings.building_lines.entries_by_id, "palisade"));
  for (const buildingLine of Object.values(filtered.buildings.building_lines.entries_by_id)) {
    assert.equal(buildingLine.slice_status, "playable_now");
  }

  assert.deepStrictEqual(
    Object.keys(filtered.units.unit_lines.entries_by_id).sort(),
    ["bow_crew", "light_raider", "trail_scout", "watch_levy"].sort(),
  );
  assert.ok(!Object.prototype.hasOwnProperty.call(filtered.units.unit_lines.entries_by_id, "ram_team"));

  assert.deepStrictEqual(
    Object.keys(filtered.units.unit_variants.entries_by_id).sort(),
    ["ash_riders", "brand_levies", "tribunal_crossmen"].sort(),
  );
  for (const unitVariant of Object.values(filtered.units.unit_variants.entries_by_id)) {
    assert.equal(unitVariant.slice_status, "playable_now");
    assert.equal(unitVariant.civ_id, "cinder_throne_legates");
  }
  assert.ok(!Object.prototype.hasOwnProperty.call(filtered.units.unit_variants.entries_by_id, "ember_rams"));

  const enabledVariantIds = new Set(Object.keys(filtered.units.unit_variants.entries_by_id));
  for (const modifier of filtered.units.unit_variant_modifiers.rows) {
    assert.ok(enabledVariantIds.has(modifier.variant_unit_id));
  }
  assert.ok(!filtered.units.unit_variant_modifiers.rows.some(
    (modifier) => !enabledVariantIds.has(modifier.variant_unit_id),
  ));

  const enabledBuildingIds = new Set(Object.keys(filtered.buildings.building_lines.entries_by_id));
  for (const effect of filtered.buildings.building_effects.rows) {
    assert.ok(enabledBuildingIds.has(effect.building_id));
  }
  assert.ok(!filtered.buildings.building_effects.rows.some((effect) => effect.building_id === "palisade"));
  assert.equal(filtered.buildings.building_activation_thresholds.rows.length, 0);

  const activation = filtered.civilizations.activation.entries_by_id;
  assert.ok(activation.cinder_throne_legates);
  assert.ok(!activation.mirebound_covenant);
  assert.ok(!activation.graveforge_clans);
  for (const civilizationActivation of Object.values(activation)) {
    assert.equal(civilizationActivation.first_slice_availability, "playable_now");
  }

  assert.ok(
    filtered.civilizations.global_modifiers.rows.length > 0 &&
      filtered.civilizations.global_modifiers.rows.every(
        (modifier) =>
          modifier.civ_id === "cinder_throne_legates" &&
          modifier.slice_status === "playable_now",
      ),
  );

  for (const resource of Object.values(filtered.economy.resource_definitions.entries_by_id)) {
    assert.equal(resource.slice_status, "playable_now");
  }

  for (const family of Object.values(filtered.buildings.building_families.entries_by_id)) {
    assert.equal(family.slice_status, "playable_now");
  }
});
