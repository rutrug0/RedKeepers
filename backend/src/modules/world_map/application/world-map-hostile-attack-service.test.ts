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
import { DeterministicWorldMapTerrainPassabilityResolver } from "./world-map-terrain-passability-resolver.ts";

const HOSTILE_ATTACK_TIE_FIXTURE_40V40 = {
  fixture_id: "attack_fixture_tie_40v40",
  defender_garrison_strength: 40,
  dispatched_units: [
    {
      unit_id: "watch_levy",
      unit_count: 8,
      unit_attack: 5,
    },
  ],
  expected: {
    combat_outcome: "defender_win",
    attacker_strength: 40,
    defender_strength: 40,
    attacker_loss_ratio: 1,
    defender_loss_ratio: 0.2,
    attacker_units_dispatched: 8,
    attacker_units_lost: 8,
    attacker_units_remaining: 0,
    defender_garrison_lost: 8,
    defender_garrison_remaining: 32,
    attacker_unit_losses_by_id: {
      watch_levy: 8,
    },
  },
} as const;

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

test("hostile attack service resolves tie fixture attack_fixture_tie_40v40 as defender-win with documented fixed loss ratios", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const service = new DeterministicWorldMapHostileAttackService(
    new DeterministicWorldMapMarchDispatchService(repository),
    new DeterministicWorldMapMarchSnapshotService(repository),
  );

  const response = service.resolveHostileAttack({
    march_id: "march_attack_tie_fixture",
    source_settlement_id: "settlement_alpha",
    target_settlement_id: "settlement_hostile",
    origin: { x: 0, y: 0 },
    target: { x: 0, y: 1 },
    defender_garrison_strength:
      HOSTILE_ATTACK_TIE_FIXTURE_40V40.defender_garrison_strength,
    dispatched_units: HOSTILE_ATTACK_TIE_FIXTURE_40V40.dispatched_units,
    departed_at: new Date("2026-02-26T19:30:00.000Z"),
  });

  assert.equal(
    response.combat_outcome,
    HOSTILE_ATTACK_TIE_FIXTURE_40V40.expected.combat_outcome,
  );
  assert.equal(
    response.attacker_strength,
    HOSTILE_ATTACK_TIE_FIXTURE_40V40.expected.attacker_strength,
  );
  assert.equal(
    response.defender_strength,
    HOSTILE_ATTACK_TIE_FIXTURE_40V40.expected.defender_strength,
  );
  assert.equal(
    response.losses.attacker_loss_ratio,
    HOSTILE_ATTACK_TIE_FIXTURE_40V40.expected.attacker_loss_ratio,
  );
  assert.equal(
    response.losses.defender_loss_ratio,
    HOSTILE_ATTACK_TIE_FIXTURE_40V40.expected.defender_loss_ratio,
  );
  assert.equal(
    response.losses.attacker_units_dispatched,
    HOSTILE_ATTACK_TIE_FIXTURE_40V40.expected.attacker_units_dispatched,
  );
  assert.equal(
    response.losses.attacker_units_lost,
    HOSTILE_ATTACK_TIE_FIXTURE_40V40.expected.attacker_units_lost,
  );
  assert.equal(
    response.losses.attacker_units_remaining,
    HOSTILE_ATTACK_TIE_FIXTURE_40V40.expected.attacker_units_remaining,
  );
  assert.equal(
    response.losses.defender_garrison_lost,
    HOSTILE_ATTACK_TIE_FIXTURE_40V40.expected.defender_garrison_lost,
  );
  assert.equal(
    response.losses.defender_garrison_remaining,
    HOSTILE_ATTACK_TIE_FIXTURE_40V40.expected.defender_garrison_remaining,
  );
  assert.deepStrictEqual(
    response.losses.attacker_unit_losses_by_id,
    HOSTILE_ATTACK_TIE_FIXTURE_40V40.expected.attacker_unit_losses_by_id,
  );
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

test("hostile attack service uses shared terrain passability resolver fixture rows for deterministic route checks", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const terrainResolver = new DeterministicWorldMapTerrainPassabilityResolver({
    fixture_rows: [
      {
        world_seed: "seed_world_alpha",
        map_size: 16,
        coordinate: { x: 1, y: 2 },
        passable: true,
      },
      {
        world_seed: "seed_world_alpha",
        map_size: 16,
        coordinate: { x: 2, y: 2 },
        passable: true,
      },
      {
        world_seed: "seed_world_alpha",
        map_size: 16,
        coordinate: { x: 3, y: 2 },
        passable: true,
      },
      {
        world_seed: "seed_world_alpha",
        map_size: 16,
        coordinate: { x: 4, y: 2 },
        passable: true,
      },
    ],
  });
  const service = new DeterministicWorldMapHostileAttackService(
    new DeterministicWorldMapMarchDispatchService(repository),
    new DeterministicWorldMapMarchSnapshotService(repository),
    {
      march_state_repository: repository,
      world_seed: "seed_world_alpha",
      map_size: 16,
      terrain_passability_resolver: terrainResolver,
    },
  );

  const response = service.resolveHostileAttack({
    march_id: "march_attack_fixture_passable",
    source_settlement_id: "settlement_alpha",
    target_settlement_id: "settlement_hostile",
    origin: { x: 0, y: 2 },
    target: { x: 4, y: 2 },
    defender_garrison_strength: 20,
    dispatched_units: [
      {
        unit_id: "watch_levy",
        unit_count: 8,
        unit_attack: 4,
      },
    ],
  });

  assert.equal(response.march_id, "march_attack_fixture_passable");
  assert.equal(response.march_state, "march_state_resolved");
});
