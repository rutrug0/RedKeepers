import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { HeroAssignmentContextOwnershipReadRepositories } from "../../heroes/ports/hero-runtime-persistence-repository.ts";
import { InMemoryHeroRuntimePersistenceRepository } from "../../heroes/infra/in-memory-hero-runtime-persistence-repository.ts";
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
  assert.deepStrictEqual(
    response.event_payloads.dispatch_sent.tokens,
    {
      army_name: "Raid Column",
      target_tile_label: "Ruin Holdfast",
      eta_seconds: "90",
    },
  );
  assert.equal(response.hero_attachment, null);
  assert.deepStrictEqual(response.hero_runtime_payloads, []);
});

test("POST /world-map/settlements/{targetSettlementId}/attack accepts optional hero fields and returns deterministic hero runtime rows", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const heroRuntimeRepository = new InMemoryHeroRuntimePersistenceRepository({
    assignment_context_ownership_read_repositories: createOwnershipReadRepositories({
      owned_armies: ["player_world::march_attack_hero"],
    }),
  });
  heroRuntimeRepository.ensureRuntimeState({
    hero_runtime_id: "player_world::hero_frontline",
    player_id: "player_world",
    hero_id: "hero_frontline",
    active_ability_id: "ability_banner_wall",
    unlock_state: "unlocked",
    readiness_state: "ready",
    updated_at: new Date("2026-02-26T19:29:00.000Z"),
  });
  const endpoint = new WorldMapSettlementAttackEndpointHandler(
    new DeterministicWorldMapHostileAttackService(
      new DeterministicWorldMapMarchDispatchService(repository, {
        hero_attachment_enabled: true,
        hero_runtime_persistence_repository: heroRuntimeRepository,
      }),
      new DeterministicWorldMapMarchSnapshotService(repository, {
        hero_runtime_persistence_repository: heroRuntimeRepository,
      }),
    ),
  );

  const response = endpoint.handlePostSettlementAttackContract({
    path: {
      targetSettlementId: "settlement_hostile",
    },
    body: {
      flow_version: "v1",
      march_id: "march_attack_hero",
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
      player_id: "player_world",
      hero_id: "hero_frontline",
      hero_target_scope: "army",
      hero_assignment_context_id: "march_attack_hero",
    },
  });

  assert.equal(response.status, "accepted");
  if (response.status !== "accepted") {
    return;
  }
  assert.equal(response.hero_attachment?.hero_id, "hero_frontline");
  assert.equal(response.hero_attachment?.assignment_context_id, "march_attack_hero");
  assert.deepStrictEqual(
    response.hero_runtime_payloads.map((payload) => payload.payload_key),
    ["hero_attached"],
  );
  assert.equal(response.hero_runtime_payloads[0]?.content_key, "event.hero.assigned");
  assert.deepStrictEqual(
    response.events.map((event) => event.payload_key),
    ["dispatch_sent", "march_arrived", "combat_resolved"],
  );
});

test("POST /world-map/settlements/{targetSettlementId}/attack surfaces feature_not_in_slice hero failure code", () => {
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
      march_id: "march_attack_hero_feature_gate",
      source_settlement_id: "settlement_alpha",
      target_settlement_id: "settlement_hostile",
      origin: { x: 0, y: 0 },
      target: { x: 1, y: 0 },
      defender_garrison_strength: 20,
      dispatched_units: [
        {
          unit_id: "watch_levy",
          unit_count: 4,
          unit_attack: 4,
        },
      ],
      player_id: "player_world",
      hero_id: "hero_frontline",
      hero_target_scope: "army",
    },
  });

  assert.equal(response.status, "failed");
  if (response.status !== "failed") {
    return;
  }
  assert.equal(response.error_code, "feature_not_in_slice");
});

test("POST /world-map/settlements/{targetSettlementId}/attack surfaces hero_unavailable failure code", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const heroRuntimeRepository = new InMemoryHeroRuntimePersistenceRepository({
    assignment_context_ownership_read_repositories: createOwnershipReadRepositories({
      owned_armies: ["player_b::march_attack_unavailable"],
    }),
  });
  heroRuntimeRepository.ensureRuntimeState({
    hero_runtime_id: "player_b::hero_rime",
    player_id: "player_b",
    hero_id: "hero_rime",
    active_ability_id: "ability_frost_watch",
    unlock_state: "unlocked",
    readiness_state: "on_cooldown",
    cooldown_started_at: new Date("2026-02-26T18:00:00.000Z"),
    cooldown_ends_at: new Date("2026-02-26T18:05:00.000Z"),
    updated_at: new Date("2026-02-26T18:00:00.000Z"),
  });
  const endpoint = new WorldMapSettlementAttackEndpointHandler(
    new DeterministicWorldMapHostileAttackService(
      new DeterministicWorldMapMarchDispatchService(repository, {
        hero_attachment_enabled: true,
        hero_runtime_persistence_repository: heroRuntimeRepository,
      }),
      new DeterministicWorldMapMarchSnapshotService(repository),
    ),
  );

  const response = endpoint.handlePostSettlementAttackContract({
    path: {
      targetSettlementId: "settlement_hostile",
    },
    body: {
      flow_version: "v1",
      march_id: "march_attack_unavailable",
      source_settlement_id: "settlement_beta",
      target_settlement_id: "settlement_hostile",
      origin: { x: 0, y: 0 },
      target: { x: 1, y: 1 },
      defender_garrison_strength: 20,
      dispatched_units: [
        {
          unit_id: "watch_levy",
          unit_count: 4,
          unit_attack: 4,
        },
      ],
      player_id: "player_b",
      hero_id: "hero_rime",
      hero_target_scope: "army",
    },
  });

  assert.equal(response.status, "failed");
  if (response.status !== "failed") {
    return;
  }
  assert.equal(response.error_code, "hero_unavailable");
});

test("POST /world-map/settlements/{targetSettlementId}/attack surfaces hero_target_scope_mismatch failure code", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const heroRuntimeRepository = new InMemoryHeroRuntimePersistenceRepository({
    initial_snapshot: {
      runtime_states: [
        {
          hero_runtime_id: "player_c::hero_scout",
          player_id: "player_c",
          hero_id: "hero_scout",
          active_ability_id: "ability_scout",
          unlock_state: "unlocked",
          readiness_state: "ready",
          assignment_context_type: "scout_detachment",
          assignment_context_id: "scout_1",
          revision: 2,
          updated_at: new Date("2026-02-26T18:00:00.000Z"),
        },
      ],
      assignment_bindings: [
        {
          assignment_id: "bind_scout_1",
          player_id: "player_c",
          hero_id: "hero_scout",
          assignment_context_type: "scout_detachment",
          assignment_context_id: "scout_1",
          is_active: true,
          assigned_at: new Date("2026-02-26T17:59:00.000Z"),
        },
      ],
      modifier_instances: [],
    },
  });
  const endpoint = new WorldMapSettlementAttackEndpointHandler(
    new DeterministicWorldMapHostileAttackService(
      new DeterministicWorldMapMarchDispatchService(repository, {
        hero_attachment_enabled: true,
        hero_runtime_persistence_repository: heroRuntimeRepository,
      }),
      new DeterministicWorldMapMarchSnapshotService(repository),
    ),
  );

  const response = endpoint.handlePostSettlementAttackContract({
    path: {
      targetSettlementId: "settlement_hostile",
    },
    body: {
      flow_version: "v1",
      march_id: "march_attack_scope",
      source_settlement_id: "settlement_gamma",
      target_settlement_id: "settlement_hostile",
      origin: { x: 0, y: 0 },
      target: { x: 1, y: 1 },
      defender_garrison_strength: 20,
      dispatched_units: [
        {
          unit_id: "watch_levy",
          unit_count: 4,
          unit_attack: 4,
        },
      ],
      player_id: "player_c",
      hero_id: "hero_scout",
      hero_target_scope: "army",
    },
  });

  assert.equal(response.status, "failed");
  if (response.status !== "failed") {
    return;
  }
  assert.equal(response.error_code, "hero_target_scope_mismatch");
});

test("POST /world-map/settlements/{targetSettlementId}/attack surfaces hero_already_assigned failure code", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const heroRuntimeRepository = new InMemoryHeroRuntimePersistenceRepository({
    initial_snapshot: {
      runtime_states: [
        {
          hero_runtime_id: "player_d::hero_guard",
          player_id: "player_d",
          hero_id: "hero_guard",
          active_ability_id: "ability_guard",
          unlock_state: "unlocked",
          readiness_state: "ready",
          assignment_context_type: "army",
          assignment_context_id: "army_existing",
          revision: 3,
          updated_at: new Date("2026-02-26T18:00:00.000Z"),
        },
      ],
      assignment_bindings: [
        {
          assignment_id: "bind_army_existing",
          player_id: "player_d",
          hero_id: "hero_guard",
          assignment_context_type: "army",
          assignment_context_id: "army_existing",
          is_active: true,
          assigned_at: new Date("2026-02-26T17:58:00.000Z"),
        },
      ],
      modifier_instances: [],
    },
  });
  const endpoint = new WorldMapSettlementAttackEndpointHandler(
    new DeterministicWorldMapHostileAttackService(
      new DeterministicWorldMapMarchDispatchService(repository, {
        hero_attachment_enabled: true,
        hero_runtime_persistence_repository: heroRuntimeRepository,
      }),
      new DeterministicWorldMapMarchSnapshotService(repository),
    ),
  );

  const response = endpoint.handlePostSettlementAttackContract({
    path: {
      targetSettlementId: "settlement_hostile",
    },
    body: {
      flow_version: "v1",
      march_id: "march_attack_assigned",
      source_settlement_id: "settlement_delta",
      target_settlement_id: "settlement_hostile",
      origin: { x: 0, y: 0 },
      target: { x: 1, y: 1 },
      defender_garrison_strength: 20,
      dispatched_units: [
        {
          unit_id: "watch_levy",
          unit_count: 4,
          unit_attack: 4,
        },
      ],
      player_id: "player_d",
      hero_id: "hero_guard",
      hero_target_scope: "army",
    },
  });

  assert.equal(response.status, "failed");
  if (response.status !== "failed") {
    return;
  }
  assert.equal(response.error_code, "hero_already_assigned");
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

test("POST /world-map/settlements/{targetSettlementId}/attack returns failed contract when active march cap is reached", () => {
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
  const endpoint = new WorldMapSettlementAttackEndpointHandler(
    new DeterministicWorldMapHostileAttackService(
      new DeterministicWorldMapMarchDispatchService(repository),
      new DeterministicWorldMapMarchSnapshotService(repository),
      {
        march_state_repository: repository,
        max_active_marches: 2,
      },
    ),
  );

  const response = endpoint.handlePostSettlementAttackContract({
    path: {
      targetSettlementId: "settlement_hostile",
    },
    body: {
      flow_version: "v1",
      march_id: "march_attack_cap_fail",
      source_settlement_id: "settlement_alpha",
      target_settlement_id: "settlement_hostile",
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
  assert.equal(response.error_code, "max_active_marches_reached");
});

test("POST /world-map/settlements/{targetSettlementId}/attack returns failed contract when deterministic route is blocked", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const endpoint = new WorldMapSettlementAttackEndpointHandler(
    new DeterministicWorldMapHostileAttackService(
      new DeterministicWorldMapMarchDispatchService(repository),
      new DeterministicWorldMapMarchSnapshotService(repository),
      {
        march_state_repository: repository,
        world_seed: "seed_world_alpha",
        map_size: 16,
      },
    ),
  );

  const response = endpoint.handlePostSettlementAttackContract({
    path: {
      targetSettlementId: "settlement_hostile",
    },
    body: {
      flow_version: "v1",
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
    },
  });

  assert.equal(response.status, "failed");
  if (response.status !== "failed") {
    return;
  }
  assert.equal(response.error_code, "path_blocked_impassable");
});

function createOwnershipReadRepositories(input?: {
  readonly owned_armies?: readonly string[];
  readonly owned_scout_detachments?: readonly string[];
  readonly owned_siege_columns?: readonly string[];
}): HeroAssignmentContextOwnershipReadRepositories {
  const ownedArmies = new Set(input?.owned_armies ?? []);
  const ownedScoutDetachments = new Set(input?.owned_scout_detachments ?? []);
  const ownedSiegeColumns = new Set(input?.owned_siege_columns ?? []);

  return {
    army: {
      isArmyOwnedByPlayer: (ownership) =>
        ownedArmies.has(`${ownership.player_id}::${ownership.army_id}`),
    },
    scout_detachment: {
      isScoutDetachmentOwnedByPlayer: (ownership) =>
        ownedScoutDetachments.has(
          `${ownership.player_id}::${ownership.scout_detachment_id}`,
        ),
    },
    siege_column: {
      isSiegeColumnOwnedByPlayer: (ownership) =>
        ownedSiegeColumns.has(
          `${ownership.player_id}::${ownership.siege_column_id}`,
        ),
    },
  };
}
