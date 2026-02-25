import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  createBuildingActivationThresholdEvaluatorFromStarterData,
  DeterministicBuildingActivationThresholdEvaluator,
} from "./building-activation-threshold-evaluator";

test("evaluate applies AND semantics for rows in the same building_id + threshold_phase", () => {
  const evaluator = new DeterministicBuildingActivationThresholdEvaluator({
    thresholds: [
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

  const unmet = evaluator.evaluate({
    resource_stock_by_id: {
      food: 900,
    },
    resource_storage_cap_by_id: {
      food: 1000,
    },
    building_level_by_id: {
      grain_plot: 3,
    },
  });

  assert.equal(unmet.phase_evaluations.length, 1);
  assert.deepStrictEqual(unmet.phase_evaluations[0], {
    building_id: "granary",
    threshold_phase: "unlock",
    is_met: false,
    required_rule_ids: [
      "act_granary_unlock_food_90",
      "act_granary_unlock_grain_plot_l4",
    ],
    failed_rule_ids: ["act_granary_unlock_grain_plot_l4"],
  });

  const met = evaluator.evaluate({
    resource_stock_by_id: {
      food: 900,
    },
    resource_storage_cap_by_id: {
      food: 1000,
    },
    building_level_by_id: {
      grain_plot: 4,
    },
  });

  assert.equal(met.phase_evaluations.length, 1);
  assert.equal(met.phase_evaluations[0].is_met, true);
  assert.deepStrictEqual(met.phase_evaluations[0].failed_rule_ids, []);
});

test("evaluate supports resource_stock_ratio_any against default nonfood_core resource group", () => {
  const evaluator = new DeterministicBuildingActivationThresholdEvaluator({
    thresholds: [
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
    ],
  });

  const result = evaluator.evaluate({
    resource_stock_by_id: {
      wood: 100,
      stone: 760,
      iron: 10,
    },
    resource_storage_cap_by_id: {
      wood: 1000,
      stone: 1000,
      iron: 1000,
    },
  });

  assert.equal(result.phase_evaluations.length, 1);
  assert.equal(result.phase_evaluations[0].building_id, "warehouse");
  assert.equal(result.phase_evaluations[0].threshold_phase, "reveal");
  assert.equal(result.phase_evaluations[0].is_met, true);
  assert.deepStrictEqual(result.phase_evaluations[0].failed_rule_ids, []);
});

test("createBuildingActivationThresholdEvaluatorFromStarterData keeps empty rows as no-op", () => {
  const evaluator = createBuildingActivationThresholdEvaluatorFromStarterData({
    rows: [],
  });

  const result = evaluator.evaluate({
    resource_stock_by_id: {
      food: 1000,
    },
    resource_storage_cap_by_id: {
      food: 1000,
    },
    building_level_by_id: {
      grain_plot: 10,
    },
  });

  assert.deepStrictEqual(result.phase_evaluations, []);
});
