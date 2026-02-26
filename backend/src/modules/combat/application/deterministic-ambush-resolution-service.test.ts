import { strict as assert } from "node:assert";
import { test } from "node:test";

import { DeterministicAmbushResolutionService } from "./deterministic-ambush-resolution-service";

test("ambush resolution stays deterministic for identical encounter seeds", () => {
  const service = new DeterministicAmbushResolutionService();

  const first = service.resolveAmbush({
    deterministic_seed: "world_alpha_seed",
    encounter_id: "march_alpha:node_lumber_1",
    ambush_risk_pct: 45,
    escort_strength: 60,
    ambush_base_strength: 40,
  });
  const second = service.resolveAmbush({
    deterministic_seed: "world_alpha_seed",
    encounter_id: "march_alpha:node_lumber_1",
    ambush_risk_pct: 45,
    escort_strength: 60,
    ambush_base_strength: 40,
  });

  assert.deepEqual(second, first);
});

test("ambush resolution returns not-triggered when deterministic roll is outside risk window", () => {
  const service = new DeterministicAmbushResolutionService();

  const result = service.resolveAmbush({
    deterministic_seed: "world_beta_seed",
    encounter_id: "march_no_ambush:node_quarry_1",
    ambush_risk_pct: 0,
    escort_strength: 10,
    ambush_base_strength: 50,
  });

  assert.equal(result.ambush_triggered, false);
  assert.equal(result.outcome, "ambush_not_triggered");
});

test("ambush resolution compares escort and ambush strengths with deterministic tie-break", () => {
  const service = new DeterministicAmbushResolutionService();

  const intercepted = service.resolveAmbush({
    deterministic_seed: "world_gamma_seed",
    encounter_id: "march_low_guard:node_iron_1",
    ambush_risk_pct: 100,
    escort_strength: 0,
    ambush_base_strength: 25,
  });
  const repelled = service.resolveAmbush({
    deterministic_seed: "world_gamma_seed",
    encounter_id: "march_high_guard:node_iron_1",
    ambush_risk_pct: 100,
    escort_strength: 500,
    ambush_base_strength: 25,
  });

  assert.equal(intercepted.ambush_triggered, true);
  assert.equal(intercepted.outcome, "ambush_intercepted");
  assert.equal(repelled.ambush_triggered, true);
  assert.equal(repelled.outcome, "ambush_repelled");
});
