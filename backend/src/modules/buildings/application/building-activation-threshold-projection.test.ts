import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  applyFirstSliceFilteringV1,
  createDefaultStarterSeedFilePathsV1,
  loadStarterSeedBundleV1,
  type StarterBuildingActivationThresholdsTable,
} from "../../../app/config/seeds/v1";
import { createSettlementBuildingActivationReadModelFromStarterData } from "./building-activation-threshold-projection";

const makePostSliceThresholds = (): StarterBuildingActivationThresholdsTable => ({
  rows: [
    {
      activation_rule_id: "act_granary_reveal_food_75",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "granary",
      threshold_phase: "reveal",
      threshold_key: "resource_stock_ratio",
      scope: "resource:food",
      operation: "gte",
      value: 0.75,
      value_display_format: "ratio",
      ui_locked_hint: "hint_granary_reveal_food_near_cap",
    },
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
    },
    {
      activation_rule_id: "act_granary_unlock_grain_plot_l4",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "granary",
      threshold_phase: "unlock",
      threshold_key: "building_level_min",
      scope: "building:grain_plot",
      operation: "gte",
      value: 4,
      value_display_format: "integer",
      ui_locked_hint: "hint_granary_unlock_grain_plot_l4",
    },
    {
      activation_rule_id: "act_warehouse_reveal_nonfood_75",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "warehouse",
      threshold_phase: "reveal",
      threshold_key: "resource_stock_ratio_any",
      scope: "resource_group:nonfood_core",
      operation: "gte",
      value: 0.75,
      value_display_format: "ratio",
      ui_locked_hint: "hint_warehouse_reveal_nonfood_near_cap",
    },
    {
      activation_rule_id: "act_warehouse_unlock_nonfood_90",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "warehouse",
      threshold_phase: "unlock",
      threshold_key: "resource_stock_ratio_any",
      scope: "resource_group:nonfood_core",
      operation: "gte",
      value: 0.9,
      value_display_format: "ratio",
      ui_locked_hint: "hint_warehouse_unlock_nonfood_cap_pressure",
    },
    {
      activation_rule_id: "act_warehouse_unlock_timber_camp_l4",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "warehouse",
      threshold_phase: "unlock",
      threshold_key: "building_level_min",
      scope: "building:timber_camp",
      operation: "gte",
      value: 4,
      value_display_format: "integer",
      ui_locked_hint: "hint_warehouse_unlock_timber_camp_l4",
    },
    {
      activation_rule_id: "act_warehouse_unlock_stone_quarry_l3",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "warehouse",
      threshold_phase: "unlock",
      threshold_key: "building_level_min",
      scope: "building:stone_quarry",
      operation: "gte",
      value: 3,
      value_display_format: "integer",
      ui_locked_hint: "hint_warehouse_unlock_stone_quarry_l3",
    },
    {
      activation_rule_id: "act_palisade_reveal_barracks_l3",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "palisade",
      threshold_phase: "reveal",
      threshold_key: "building_level_min",
      scope: "building:barracks",
      operation: "gte",
      value: 3,
      value_display_format: "integer",
      ui_locked_hint: "hint_palisade_reveal_barracks_l3",
    },
    {
      activation_rule_id: "act_palisade_unlock_barracks_l4",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "palisade",
      threshold_phase: "unlock",
      threshold_key: "building_level_min",
      scope: "building:barracks",
      operation: "gte",
      value: 4,
      value_display_format: "integer",
      ui_locked_hint: "hint_palisade_unlock_barracks_l4",
    },
    {
      activation_rule_id: "act_palisade_unlock_rally_post_l2",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "palisade",
      threshold_phase: "unlock",
      threshold_key: "building_level_min",
      scope: "building:rally_post",
      operation: "gte",
      value: 2,
      value_display_format: "integer",
      ui_locked_hint: "hint_palisade_unlock_rally_post_l2",
    },
    {
      activation_rule_id: "act_watchtower_reveal_palisade_l2",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "watchtower",
      threshold_phase: "reveal",
      threshold_key: "building_level_min",
      scope: "building:palisade",
      operation: "gte",
      value: 2,
      value_display_format: "integer",
      ui_locked_hint: "hint_watchtower_reveal_palisade_l2",
    },
    {
      activation_rule_id: "act_watchtower_unlock_palisade_l4",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "watchtower",
      threshold_phase: "unlock",
      threshold_key: "building_level_min",
      scope: "building:palisade",
      operation: "gte",
      value: 4,
      value_display_format: "integer",
      ui_locked_hint: "hint_watchtower_unlock_palisade_l4",
    },
    {
      activation_rule_id: "act_watchtower_unlock_rally_post_l4",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "watchtower",
      threshold_phase: "unlock",
      threshold_key: "building_level_min",
      scope: "building:rally_post",
      operation: "gte",
      value: 4,
      value_display_format: "integer",
      ui_locked_hint: "hint_watchtower_unlock_rally_post_l4",
    },
    {
      activation_rule_id: "act_guardhouse_reveal_palisade_l3",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "guardhouse",
      threshold_phase: "reveal",
      threshold_key: "building_level_min",
      scope: "building:palisade",
      operation: "gte",
      value: 3,
      value_display_format: "integer",
      ui_locked_hint: "hint_guardhouse_reveal_palisade_l3",
    },
    {
      activation_rule_id: "act_guardhouse_unlock_palisade_l5",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "guardhouse",
      threshold_phase: "unlock",
      threshold_key: "building_level_min",
      scope: "building:palisade",
      operation: "gte",
      value: 5,
      value_display_format: "integer",
      ui_locked_hint: "hint_guardhouse_unlock_palisade_l5",
    },
    {
      activation_rule_id: "act_guardhouse_unlock_barracks_l5",
      activation_package_id: "m2_storage_defense_activation",
      building_id: "guardhouse",
      threshold_phase: "unlock",
      threshold_key: "building_level_min",
      scope: "building:barracks",
      operation: "gte",
      value: 5,
      value_display_format: "integer",
      ui_locked_hint: "hint_guardhouse_unlock_barracks_l5",
    },
  ],
});

const snapshotInput = {
  resource_stock_by_id: {
    food: 900,
    wood: 1000,
    stone: 1000,
    iron: 1000,
  },
  resource_storage_cap_by_id: {
    food: 1000,
    wood: 1000,
    stone: 1000,
    iron: 1000,
  },
  building_level_by_id: {
    grain_plot: 4,
    timber_camp: 4,
    stone_quarry: 3,
    barracks: 3,
    rally_post: 2,
    palisade: 3,
  },
  resource_groups_by_id: {
    nonfood_core: ["wood", "stone", "iron"],
  },
};

test("building read projection returns reveal/unlock state for post-slice storage and defense buildings", () => {
  const service = createSettlementBuildingActivationReadModelFromStarterData(
    makePostSliceThresholds(),
  );
  const projection = service.project(snapshotInput);

  assert.equal(projection.buildings.length, 5);

  const granary = projection.buildings.find((building) => building.building_id === "granary");
  assert.ok(granary !== undefined);
  assert.equal(granary.reveal?.is_met, true);
  assert.equal(granary.unlock?.is_met, true);

  const warehouse = projection.buildings.find((building) => building.building_id === "warehouse");
  assert.ok(warehouse !== undefined);
  assert.equal(warehouse.reveal?.is_met, true);
  assert.equal(warehouse.unlock?.is_met, true);

  const palisade = projection.buildings.find((building) => building.building_id === "palisade");
  assert.ok(palisade !== undefined);
  assert.equal(palisade.reveal?.is_met, true);
  assert.equal(palisade.unlock?.is_met, false);

  const watchtower = projection.buildings.find((building) => building.building_id === "watchtower");
  assert.ok(watchtower !== undefined);
  assert.equal(watchtower.reveal?.is_met, true);
  assert.equal(watchtower.unlock?.is_met, false);

  const guardhouse = projection.buildings.find((building) => building.building_id === "guardhouse");
  assert.ok(guardhouse !== undefined);
  assert.equal(guardhouse.reveal?.is_met, true);
  assert.equal(guardhouse.unlock?.is_met, false);
});

test("building read projection preserves AND semantics for unlock rows per building_id + threshold_phase", () => {
  const service = createSettlementBuildingActivationReadModelFromStarterData({
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
      },
      {
        activation_rule_id: "act_granary_unlock_grain_plot_l4",
        activation_package_id: "m2_storage_defense_activation",
        building_id: "granary",
        threshold_phase: "unlock",
        threshold_key: "building_level_min",
        scope: "building:grain_plot",
        operation: "gte",
        value: 4,
        value_display_format: "integer",
        ui_locked_hint: "hint_granary_unlock_grain_plot_l4",
      },
    ],
  });

  const unmet = service.project({
    resource_stock_by_id: { food: 900 },
    resource_storage_cap_by_id: { food: 1000 },
    building_level_by_id: { grain_plot: 3 },
  });

  const granary = unmet.buildings.find((building) => building.building_id === "granary");
  assert.ok(granary !== undefined);
  assert.equal(granary.unlock?.is_met, false);
  assert.deepStrictEqual(granary.unlock?.failed_rule_ids, ["act_granary_unlock_grain_plot_l4"]);
});

test("first-slice threshold filtering leaves post-slice activation rows out of read projection output", async () => {
  const fullBundle = await loadStarterSeedBundleV1(createDefaultStarterSeedFilePathsV1());
  const filteredBundle = applyFirstSliceFilteringV1(
    fullBundle.seeds,
    fullBundle.first_slice_enablement,
  );

  const postSliceProjection = createSettlementBuildingActivationReadModelFromStarterData({
    ...fullBundle.seeds.buildings.building_activation_thresholds,
  });
  const firstSliceProjection = createSettlementBuildingActivationReadModelFromStarterData({
    rows: filteredBundle.buildings.building_activation_thresholds.rows,
  });

  const postSliceResult = postSliceProjection.project(snapshotInput);
  const firstSliceResult = firstSliceProjection.project(snapshotInput);

  assert.equal(postSliceResult.buildings.length > 0, true);
  assert.equal(firstSliceResult.buildings.length, 0);
});
