import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DeterministicWorldMapHostileAttackService,
} from "../application/world-map-hostile-attack-service.ts";
import {
  DeterministicWorldMapMarchDispatchService,
} from "../application/world-map-march-dispatch-service.ts";
import {
  DeterministicWorldMapMarchSnapshotService,
} from "../application/world-map-march-snapshot-service.ts";
import { InMemoryWorldMapMarchStateRepository } from "../infra/in-memory-world-map-march-state-repository.ts";
import {
  WorldMapSettlementAttackEndpointHandler,
  WorldMapSettlementAttackValidationError,
} from "./world-map-settlement-attack-endpoint.ts";

test("POST /world-map/settlements/{targetSettlementId}/attack returns deterministic resolved attack contract", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const endpoint = new WorldMapSettlementAttackEndpointHandler(
    new DeterministicWorldMapHostileAttackService(
      new DeterministicWorldMapMarchDispatchService(repository),
      new DeterministicWorldMapMarchSnapshotService(repository),
    ),
  );

  const response = endpoint.handlePostSettlementAttackContract({
    path: {
      targetSettlementId: "settlement_hostile",
    },
    body: {
      flow_version: "v1",
      march_id: "march_attack_alpha",
      source_settlement_id: "settlement_alpha",
      source_settlement_name: "Cinderwatch Hold",
      target_settlement_id: "settlement_hostile",
      target_settlement_name: "Ruin Holdfast",
      target_tile_label: "Ruin Holdfast",
      origin: {
        x: 0,
        y: 0,
      },
      target: {
        x: 2,
        y: 1,
      },
      defender_garrison_strength: 40,
      dispatched_units: [
        {
          unit_id: "watch_levy",
          unit_count: 10,
          unit_attack: 5,
        },
      ],
      departed_at: "2026-02-26T19:30:00.000Z",
    },
  });

  assert.equal(response.status, "accepted");
  if (response.status !== "accepted") {
    return;
  }
  assert.equal(response.flow, "world_map.hostile_attack_v1");
  assert.deepStrictEqual(
    Object.keys(response.event_payloads).sort(),
    ["combat_resolved", "dispatch_sent", "march_arrived"].sort(),
  );
  assert.deepStrictEqual(
    response.events.map((event) => event.payload_key),
    ["dispatch_sent", "march_arrived", "combat_resolved"],
  );
});

test("POST /world-map/settlements/{targetSettlementId}/attack rejects target mismatch between path and body", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const endpoint = new WorldMapSettlementAttackEndpointHandler(
    new DeterministicWorldMapHostileAttackService(
      new DeterministicWorldMapMarchDispatchService(repository),
      new DeterministicWorldMapMarchSnapshotService(repository),
    ),
  );

  assert.throws(
    () =>
      endpoint.handlePostSettlementAttack({
        path: {
          targetSettlementId: "settlement_hostile",
        },
        body: {
          flow_version: "v1",
          march_id: "march_attack_alpha",
          source_settlement_id: "settlement_alpha",
          target_settlement_id: "settlement_other",
          origin: { x: 0, y: 0 },
          target: { x: 1, y: 1 },
          defender_garrison_strength: 40,
          dispatched_units: [
            {
              unit_id: "watch_levy",
              unit_count: 10,
              unit_attack: 5,
            },
          ],
        },
      }),
    (error: unknown) =>
      error instanceof WorldMapSettlementAttackValidationError
      && error.code === "target_settlement_id_mismatch",
  );
});

test("POST /world-map/settlements/{targetSettlementId}/attack returns failed contract when target is not foreign", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const endpoint = new WorldMapSettlementAttackEndpointHandler(
    new DeterministicWorldMapHostileAttackService(
      new DeterministicWorldMapMarchDispatchService(repository),
      new DeterministicWorldMapMarchSnapshotService(repository),
    ),
  );

  const response = endpoint.handlePostSettlementAttackContract({
    path: {
      targetSettlementId: "settlement_alpha",
    },
    body: {
      flow_version: "v1",
      march_id: "march_attack_alpha",
      source_settlement_id: "settlement_alpha",
      target_settlement_id: "settlement_alpha",
      origin: { x: 0, y: 0 },
      target: { x: 1, y: 1 },
      defender_garrison_strength: 40,
      dispatched_units: [
        {
          unit_id: "watch_levy",
          unit_count: 10,
          unit_attack: 5,
        },
      ],
    },
  });

  assert.equal(response.status, "failed");
  if (response.status !== "failed") {
    return;
  }
  assert.equal(response.error_code, "source_target_not_foreign");
  assert.equal(response.flow, "world_map.hostile_attack_v1");
});
