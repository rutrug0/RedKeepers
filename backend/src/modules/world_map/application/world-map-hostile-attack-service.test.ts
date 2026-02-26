import { strict as assert } from "node:assert";
import { test } from "node:test";

import { InMemoryWorldMapMarchStateRepository } from "../infra/in-memory-world-map-march-state-repository.ts";
import {
  DeterministicWorldMapMarchDispatchService,
} from "./world-map-march-dispatch-service.ts";
import {
  DeterministicWorldMapHostileAttackService,
  WorldMapHostileAttackOperationError,
} from "./world-map-hostile-attack-service.ts";
import {
  DeterministicWorldMapMarchSnapshotService,
} from "./world-map-march-snapshot-service.ts";

test("hostile attack service resolves deterministic attacker-win losses and persists resolved march state", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const service = new DeterministicWorldMapHostileAttackService(
    new DeterministicWorldMapMarchDispatchService(repository),
    new DeterministicWorldMapMarchSnapshotService(repository),
  );

  const response = service.resolveHostileAttack({
    march_id: "march_attack_alpha",
    source_settlement_id: "settlement_alpha",
    source_settlement_name: "Cinderwatch Hold",
    target_settlement_id: "settlement_hostile",
    target_settlement_name: "Ruin Holdfast",
    target_tile_label: "Ruin Holdfast",
    origin: { x: 0, y: 0 },
    target: { x: 2, y: 1 },
    defender_garrison_strength: 40,
    dispatched_units: [
      {
        unit_id: "watch_levy",
        unit_count: 10,
        unit_attack: 5,
      },
    ],
    departed_at: new Date("2026-02-26T19:30:00.000Z"),
  });

  assert.equal(response.flow, "world_map.hostile_attack_v1");
  assert.equal(response.march_state, "march_state_resolved");
  assert.equal(response.arrives_at.toISOString(), "2026-02-26T19:31:30.000Z");
  assert.equal(response.resolved_at.toISOString(), "2026-02-26T19:31:30.000Z");
  assert.equal(response.combat_outcome, "attacker_win");
  assert.equal(response.attacker_strength, 50);
  assert.equal(response.defender_strength, 40);
  assert.equal(response.losses.attacker_loss_ratio, 0.25);
  assert.equal(response.losses.defender_loss_ratio, 1);
  assert.equal(response.losses.attacker_units_dispatched, 10);
  assert.equal(response.losses.attacker_units_lost, 2);
  assert.equal(response.losses.attacker_units_remaining, 8);
  assert.equal(response.losses.defender_garrison_lost, 40);
  assert.equal(response.losses.defender_garrison_remaining, 0);
  assert.deepStrictEqual(response.losses.attacker_unit_losses_by_id, {
    watch_levy: 2,
  });
  assert.deepStrictEqual(
    response.events.map((event) => event.payload_key),
    ["dispatch_sent", "march_arrived", "combat_resolved"],
  );
  assert.equal(
    response.event_payloads.dispatch_sent.content_key,
    "event.world.march_started",
  );
  assert.equal(
    response.event_payloads.march_arrived.content_key,
    "event.world.march_returned",
  );
  assert.equal(
    response.event_payloads.combat_resolved.content_key,
    "event.combat.placeholder_skirmish_win",
  );

  const persisted = repository.readMarchRuntimeState({
    march_id: "march_attack_alpha",
  });
  assert.notEqual(persisted, null);
  assert.equal(persisted?.march_state, "march_state_resolved");
  assert.equal(persisted?.march_revision, 2);
  assert.equal(persisted?.resolution_outcome, "attacker_win");
});

test("hostile attack service resolves deterministic defender-win losses on tie", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const service = new DeterministicWorldMapHostileAttackService(
    new DeterministicWorldMapMarchDispatchService(repository),
    new DeterministicWorldMapMarchSnapshotService(repository),
  );

  const response = service.resolveHostileAttack({
    march_id: "march_attack_beta",
    source_settlement_id: "settlement_alpha",
    target_settlement_id: "settlement_hostile",
    origin: { x: 0, y: 0 },
    target: { x: 0, y: 1 },
    defender_garrison_strength: 50,
    dispatched_units: [
      {
        unit_id: "watch_levy",
        unit_count: 10,
        unit_attack: 5,
      },
    ],
    departed_at: new Date("2026-02-26T19:30:00.000Z"),
  });

  assert.equal(response.combat_outcome, "defender_win");
  assert.equal(response.losses.attacker_loss_ratio, 1);
  assert.equal(response.losses.defender_loss_ratio, 0.2);
  assert.equal(response.losses.attacker_units_lost, 10);
  assert.equal(response.losses.attacker_units_remaining, 0);
  assert.equal(response.losses.defender_garrison_lost, 10);
  assert.equal(response.losses.defender_garrison_remaining, 40);
  assert.equal(
    response.event_payloads.combat_resolved.content_key,
    "event.combat.placeholder_skirmish_loss",
  );
});

test("hostile attack service rejects dispatch when active march cap is reached", () => {
  const repository = new InMemoryWorldMapMarchStateRepository([
    {
      march_id: "march_existing_1",
      settlement_id: "settlement_alpha",
      march_revision: 1,
      march_state: "march_state_in_transit",
      origin: { x: 0, y: 0 },
      target: { x: 1, y: 0 },
      departed_at: new Date("2026-02-26T19:00:00.000Z"),
      seconds_per_tile: 30,
      attacker_strength: 10,
      defender_strength: 5,
    },
    {
      march_id: "march_existing_2",
      settlement_id: "settlement_alpha",
      march_revision: 1,
      march_state: "march_state_in_transit",
      origin: { x: 0, y: 0 },
      target: { x: 2, y: 0 },
      departed_at: new Date("2026-02-26T19:00:00.000Z"),
      seconds_per_tile: 30,
      attacker_strength: 10,
      defender_strength: 5,
    },
  ]);
  const service = new DeterministicWorldMapHostileAttackService(
    new DeterministicWorldMapMarchDispatchService(repository),
    new DeterministicWorldMapMarchSnapshotService(repository),
    {
      march_state_repository: repository,
      max_active_marches: 2,
    },
  );

  assert.throws(
    () =>
      service.resolveHostileAttack({
        march_id: "march_attack_cap_fail",
        source_settlement_id: "settlement_alpha",
        target_settlement_id: "settlement_hostile",
        origin: { x: 0, y: 0 },
        target: { x: 2, y: 1 },
        defender_garrison_strength: 50,
        dispatched_units: [
          {
            unit_id: "watch_levy",
            unit_count: 10,
            unit_attack: 5,
          },
        ],
      }),
    (error: unknown) =>
      error instanceof WorldMapHostileAttackOperationError
      && error.code === "max_active_marches_reached",
  );
});

test("hostile attack service rejects dispatch when deterministic path crosses impassable tile", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const service = new DeterministicWorldMapHostileAttackService(
    new DeterministicWorldMapMarchDispatchService(repository),
    new DeterministicWorldMapMarchSnapshotService(repository),
    {
      march_state_repository: repository,
      world_seed: "seed_world_alpha",
      map_size: 16,
    },
  );

  assert.throws(
    () =>
      service.resolveHostileAttack({
        march_id: "march_attack_blocked",
        source_settlement_id: "settlement_alpha",
        target_settlement_id: "settlement_hostile",
        origin: { x: 0, y: 2 },
        target: { x: 4, y: 2 },
        defender_garrison_strength: 30,
        dispatched_units: [
          {
            unit_id: "watch_levy",
            unit_count: 8,
            unit_attack: 4,
          },
        ],
      }),
    (error: unknown) =>
      error instanceof WorldMapHostileAttackOperationError
      && error.code === "path_blocked_impassable",
  );
});
