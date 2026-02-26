import { strict as assert } from "node:assert";
import { test } from "node:test";

import { InMemoryHeroRuntimePersistenceRepository } from "../../heroes/infra";
import { InMemoryWorldMapMarchStateRepository } from "../infra";
import { DeterministicWorldMapMarchSnapshotService } from "./world-map-march-snapshot-service";

test("march snapshot service emits stable near-realtime snapshot ids within one interval bucket", () => {
  const repository = new InMemoryWorldMapMarchStateRepository([
    {
      march_id: "march_alpha",
      settlement_id: "settlement_alpha",
      march_revision: 2,
      march_state: "march_state_in_transit",
      origin: { x: 0, y: 0 },
      target: { x: 4, y: 0 },
      departed_at: new Date("2026-02-26T15:00:00.000Z"),
      seconds_per_tile: 30,
      attacker_strength: 90,
      defender_strength: 120,
    },
  ]);
  const service = new DeterministicWorldMapMarchSnapshotService(repository, {
    snapshot_interval_ms: 1000,
  });

  const first = service.emitMarchSnapshot({
    march_id: "march_alpha",
    observed_at: new Date("2026-02-26T15:00:10.120Z"),
  });
  const second = service.emitMarchSnapshot({
    march_id: "march_alpha",
    observed_at: new Date("2026-02-26T15:00:10.980Z"),
  });

  assert.equal(first.snapshot_id, second.snapshot_id);
  assert.equal(
    first.snapshot_emitted_at.toISOString(),
    "2026-02-26T15:00:10.000Z",
  );
  assert.equal(
    second.snapshot_emitted_at.toISOString(),
    "2026-02-26T15:00:10.000Z",
  );
  assert.equal(first.march_state, "march_state_in_transit");
  assert.equal(first.interpolation_window !== undefined, true);
  if (first.interpolation_window === undefined) {
    return;
  }
  assert.equal(
    first.interpolation_window.segment_started_at.toISOString(),
    "2026-02-26T15:00:10.000Z",
  );
  assert.equal(
    first.interpolation_window.segment_ends_at.toISOString(),
    "2026-02-26T15:00:11.000Z",
  );
  assert.equal(first.next_authoritative_snapshot_at?.toISOString(), "2026-02-26T15:00:11.000Z");
  assert.equal(first.authoritative_position.progress_ratio > 0, true);
  assert.equal(first.authoritative_position.progress_ratio < 1, true);
});

test("march snapshot service resolves arrival deterministically and keeps resolved snapshot stable", () => {
  const repository = new InMemoryWorldMapMarchStateRepository([
    {
      march_id: "march_beta",
      settlement_id: "settlement_alpha",
      march_revision: 4,
      march_state: "march_state_in_transit",
      origin: { x: 2, y: 2 },
      target: { x: 3, y: 2 },
      departed_at: new Date("2026-02-26T16:00:00.000Z"),
      seconds_per_tile: 30,
      attacker_strength: 150,
      defender_strength: 150,
    },
  ]);
  const service = new DeterministicWorldMapMarchSnapshotService(repository, {
    snapshot_interval_ms: 1000,
  });

  const firstResolved = service.emitMarchSnapshot({
    march_id: "march_beta",
    observed_at: new Date("2026-02-26T16:00:35.000Z"),
  });
  const secondResolved = service.emitMarchSnapshot({
    march_id: "march_beta",
    observed_at: new Date("2026-02-26T16:00:59.999Z"),
  });

  assert.equal(firstResolved.march_state, "march_state_resolved");
  assert.equal(firstResolved.interpolation_window, undefined);
  assert.equal(firstResolved.next_authoritative_snapshot_at, undefined);
  assert.equal(firstResolved.resolution?.combat_outcome, "defender_win");
  assert.equal(
    firstResolved.resolution?.resolved_at.toISOString(),
    "2026-02-26T16:00:30.000Z",
  );
  assert.equal(firstResolved.march_revision, 5);
  assert.equal(secondResolved.snapshot_id, firstResolved.snapshot_id);
  assert.equal(
    secondResolved.snapshot_emitted_at.toISOString(),
    "2026-02-26T16:00:30.000Z",
  );
  assert.equal(secondResolved.resolution?.combat_outcome, "defender_win");

  const persisted = repository.readMarchRuntimeState({
    march_id: "march_beta",
  });
  assert.notEqual(persisted, null);
  if (persisted === null) {
    return;
  }
  assert.equal(persisted.march_state, "march_state_resolved");
  assert.equal(persisted.resolution_outcome, "defender_win");
});

test("march snapshot interpolation window is clamped to authoritative arrival timestamp", () => {
  const repository = new InMemoryWorldMapMarchStateRepository([
    {
      march_id: "march_gamma",
      settlement_id: "settlement_alpha",
      march_revision: 1,
      march_state: "march_state_in_transit",
      origin: { x: 0, y: 0 },
      target: { x: 1, y: 1 },
      departed_at: new Date("2026-02-26T17:00:00.000Z"),
      seconds_per_tile: 30,
      attacker_strength: 200,
      defender_strength: 80,
    },
  ]);
  const service = new DeterministicWorldMapMarchSnapshotService(repository, {
    snapshot_interval_ms: 1000,
  });

  const snapshot = service.emitMarchSnapshot({
    march_id: "march_gamma",
    observed_at: new Date("2026-02-26T17:00:59.600Z"),
  });

  assert.equal(snapshot.march_state, "march_state_in_transit");
  assert.equal(snapshot.interpolation_window !== undefined, true);
  if (snapshot.interpolation_window === undefined) {
    return;
  }
  assert.equal(
    snapshot.interpolation_window.segment_started_at.toISOString(),
    "2026-02-26T17:00:59.000Z",
  );
  assert.equal(
    snapshot.interpolation_window.segment_ends_at.toISOString(),
    "2026-02-26T17:01:00.000Z",
  );
  assert.equal(
    snapshot.next_authoritative_snapshot_at?.toISOString(),
    "2026-02-26T17:01:00.000Z",
  );
});

test("march resolution detaches attached hero assignment deterministically on return completion", () => {
  const heroRuntimeRepository = new InMemoryHeroRuntimePersistenceRepository({
    initial_snapshot: {
      runtime_states: [
        {
          hero_runtime_id: "player_world::hero_march",
          player_id: "player_world",
          hero_id: "hero_march",
          active_ability_id: "ability_march",
          unlock_state: "unlocked",
          readiness_state: "ready",
          assignment_context_type: "army",
          assignment_context_id: "march_hero_alpha",
          revision: 3,
          updated_at: new Date("2026-02-26T18:00:00.000Z"),
        },
      ],
      assignment_bindings: [
        {
          assignment_id: "assign:player_world:hero_march:army:march_hero_alpha",
          player_id: "player_world",
          hero_id: "hero_march",
          assignment_context_type: "army",
          assignment_context_id: "march_hero_alpha",
          is_active: true,
          assigned_at: new Date("2026-02-26T17:59:00.000Z"),
        },
      ],
      modifier_instances: [],
    },
  });
  const marchRepository = new InMemoryWorldMapMarchStateRepository([
    {
      march_id: "march_hero_alpha",
      settlement_id: "settlement_alpha",
      march_revision: 6,
      march_state: "march_state_in_transit",
      origin: { x: 0, y: 0 },
      target: { x: 1, y: 0 },
      departed_at: new Date("2026-02-26T18:10:00.000Z"),
      seconds_per_tile: 30,
      attacker_strength: 120,
      defender_strength: 80,
      hero_attachment: {
        player_id: "player_world",
        hero_id: "hero_march",
        assignment_id: "assign:player_world:hero_march:army:march_hero_alpha",
        assignment_context_type: "army",
        assignment_context_id: "march_hero_alpha",
        attached_at: new Date("2026-02-26T18:10:00.000Z"),
      },
    },
  ]);
  const service = new DeterministicWorldMapMarchSnapshotService(marchRepository, {
    hero_runtime_persistence_repository: heroRuntimeRepository,
  });

  const snapshot = service.emitMarchSnapshot({
    march_id: "march_hero_alpha",
    observed_at: new Date("2026-02-26T18:10:45.000Z"),
  });

  assert.equal(snapshot.march_state, "march_state_resolved");

  const persistedMarch = marchRepository.readMarchRuntimeState({
    march_id: "march_hero_alpha",
  });
  assert.notEqual(persistedMarch, null);
  assert.equal(
    persistedMarch?.hero_attachment?.detached_at?.toISOString(),
    "2026-02-26T18:10:30.000Z",
  );

  const heroRuntime = heroRuntimeRepository.readRuntimeState({
    player_id: "player_world",
    hero_id: "hero_march",
  });
  assert.notEqual(heroRuntime, null);
  assert.equal(heroRuntime?.assignment_context_type, "none");
  assert.equal(heroRuntime?.assignment_context_id, undefined);
  assert.equal(
    heroRuntimeRepository.readActiveAssignmentBinding({
      player_id: "player_world",
      hero_id: "hero_march",
    }),
    null,
  );
});
