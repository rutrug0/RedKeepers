import { strict as assert } from "node:assert";
import { test } from "node:test";

import type {
  HeroAssignmentContextOwnershipReadRepositories,
} from "../../heroes/ports/hero-runtime-persistence-repository.ts";
import {
  InMemoryHeroRuntimePersistenceRepository,
} from "../../heroes/infra/in-memory-hero-runtime-persistence-repository.ts";
import {
  InMemoryWorldMapMarchStateRepository,
} from "../infra/in-memory-world-map-march-state-repository.ts";
import {
  DeterministicWorldMapMarchDispatchService,
  WorldMapMarchDispatchOperationError,
} from "./world-map-march-dispatch-service.ts";

test("dispatch rejects hero attachment with feature_not_in_slice when hero attachment gate is disabled", () => {
  const marchRepository = new InMemoryWorldMapMarchStateRepository();
  const heroRepository = new InMemoryHeroRuntimePersistenceRepository();
  const service = new DeterministicWorldMapMarchDispatchService(marchRepository, {
    hero_runtime_persistence_repository: heroRepository,
    hero_attachment_enabled: false,
  });

  heroRepository.ensureRuntimeState({
    hero_runtime_id: "player_a::hero_forge",
    player_id: "player_a",
    hero_id: "hero_forge",
    active_ability_id: "ability_iron_banner",
    unlock_state: "unlocked",
    readiness_state: "ready",
    updated_at: new Date("2026-02-26T18:00:00.000Z"),
  });

  assert.throws(
    () =>
      service.dispatchMarch({
        march_id: "march_alpha",
        settlement_id: "settlement_alpha",
        origin: { x: 0, y: 0 },
        target: { x: 2, y: 0 },
        attacker_strength: 100,
        defender_strength: 80,
        player_id: "player_a",
        hero_id: "hero_forge",
      }),
    (error: unknown) =>
      error instanceof WorldMapMarchDispatchOperationError
      && error.code === "feature_not_in_slice",
  );
});

test("dispatch rejects unavailable hero attachment with hero_unavailable", () => {
  const marchRepository = new InMemoryWorldMapMarchStateRepository();
  const heroRepository = new InMemoryHeroRuntimePersistenceRepository({
    assignment_context_ownership_read_repositories: createOwnershipReadRepositories({
      owned_armies: ["player_b::march_beta"],
    }),
  });
  const service = new DeterministicWorldMapMarchDispatchService(marchRepository, {
    hero_runtime_persistence_repository: heroRepository,
    hero_attachment_enabled: true,
  });

  heroRepository.ensureRuntimeState({
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

  assert.throws(
    () =>
      service.dispatchMarch({
        march_id: "march_beta",
        settlement_id: "settlement_beta",
        origin: { x: 1, y: 1 },
        target: { x: 3, y: 1 },
        attacker_strength: 75,
        defender_strength: 60,
        player_id: "player_b",
        hero_id: "hero_rime",
      }),
    (error: unknown) =>
      error instanceof WorldMapMarchDispatchOperationError
      && error.code === "hero_unavailable",
  );
});

test("dispatch rejects non-army hero assignment scope with hero_target_scope_mismatch", () => {
  const heroRepository = new InMemoryHeroRuntimePersistenceRepository({
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
  const service = new DeterministicWorldMapMarchDispatchService(
    new InMemoryWorldMapMarchStateRepository(),
    {
      hero_runtime_persistence_repository: heroRepository,
      hero_attachment_enabled: true,
    },
  );

  assert.throws(
    () =>
      service.dispatchMarch({
        march_id: "march_gamma",
        settlement_id: "settlement_gamma",
        origin: { x: 0, y: 0 },
        target: { x: 0, y: 2 },
        attacker_strength: 45,
        defender_strength: 55,
        player_id: "player_c",
        hero_id: "hero_scout",
      }),
    (error: unknown) =>
      error instanceof WorldMapMarchDispatchOperationError
      && error.code === "hero_target_scope_mismatch",
  );
});

test("dispatch rejects hero already assigned to another army context with hero_already_assigned", () => {
  const heroRepository = new InMemoryHeroRuntimePersistenceRepository({
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
  const service = new DeterministicWorldMapMarchDispatchService(
    new InMemoryWorldMapMarchStateRepository(),
    {
      hero_runtime_persistence_repository: heroRepository,
      hero_attachment_enabled: true,
    },
  );

  assert.throws(
    () =>
      service.dispatchMarch({
        march_id: "march_delta",
        settlement_id: "settlement_delta",
        origin: { x: 1, y: 0 },
        target: { x: 4, y: 0 },
        attacker_strength: 120,
        defender_strength: 80,
        player_id: "player_d",
        hero_id: "hero_guard",
      }),
    (error: unknown) =>
      error instanceof WorldMapMarchDispatchOperationError
      && error.code === "hero_already_assigned",
  );
});

test("dispatch attaches one hero to march and persists deterministic assignment metadata", () => {
  const marchRepository = new InMemoryWorldMapMarchStateRepository();
  const heroRepository = new InMemoryHeroRuntimePersistenceRepository({
    assignment_context_ownership_read_repositories: createOwnershipReadRepositories({
      owned_armies: ["player_e::march_echo"],
    }),
  });
  const service = new DeterministicWorldMapMarchDispatchService(marchRepository, {
    hero_runtime_persistence_repository: heroRepository,
    hero_attachment_enabled: true,
  });

  heroRepository.ensureRuntimeState({
    hero_runtime_id: "player_e::hero_valen",
    player_id: "player_e",
    hero_id: "hero_valen",
    active_ability_id: "ability_battlecry",
    unlock_state: "unlocked",
    readiness_state: "ready",
    updated_at: new Date("2026-02-26T18:00:00.000Z"),
  });

  const response = service.dispatchMarch({
    march_id: "march_echo",
    settlement_id: "settlement_echo",
    origin: { x: 0, y: 0 },
    target: { x: 3, y: 0 },
    departed_at: new Date("2026-02-26T18:10:00.000Z"),
    attacker_strength: 150,
    defender_strength: 90,
    player_id: "player_e",
    hero_id: "hero_valen",
  });

  assert.equal(response.flow, "world_map.march_dispatch_v1");
  assert.equal(response.march_state, "march_state_in_transit");
  assert.equal(response.hero_attachment?.hero_id, "hero_valen");
  assert.equal(response.hero_attachment?.assignment_context_type, "army");
  assert.equal(response.hero_attachment?.assignment_context_id, "march_echo");
  assert.equal(
    response.arrives_at.toISOString(),
    "2026-02-26T18:11:30.000Z",
  );

  const runtime = heroRepository.readRuntimeState({
    player_id: "player_e",
    hero_id: "hero_valen",
  });
  assert.notEqual(runtime, null);
  assert.equal(runtime?.assignment_context_type, "army");
  assert.equal(runtime?.assignment_context_id, "march_echo");

  const activeBinding = heroRepository.readActiveAssignmentBinding({
    player_id: "player_e",
    hero_id: "hero_valen",
  });
  assert.notEqual(activeBinding, null);
  assert.equal(activeBinding?.assignment_context_id, "march_echo");

  const persistedMarch = marchRepository.readMarchRuntimeState({
    march_id: "march_echo",
  });
  assert.notEqual(persistedMarch, null);
  assert.equal(persistedMarch?.hero_attachment?.hero_id, "hero_valen");
  assert.equal(persistedMarch?.hero_attachment?.detached_at, undefined);
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
