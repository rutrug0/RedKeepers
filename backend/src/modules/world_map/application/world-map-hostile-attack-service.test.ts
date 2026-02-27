import { strict as assert } from "node:assert";
import { test } from "node:test";

import type {
  HeroAssignmentContextOwnershipReadRepositories,
} from "../../heroes/ports/hero-runtime-persistence-repository.ts";
import { InMemoryHeroRuntimePersistenceRepository } from "../../heroes/infra/in-memory-hero-runtime-persistence-repository.ts";
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
  assert.equal(response.hero_attachment, null);
  assert.deepStrictEqual(response.hero_runtime_payloads, []);
  assert.deepStrictEqual(
    response.events.map((event) => event.payload_key),
    ["dispatch_sent", "march_arrived", "combat_resolved"],
  );
  assert.equal(
    response.event_payloads.dispatch_sent.content_key,
    "event.world.hostile_dispatch_en_route",
  );
  assert.deepStrictEqual(
    response.event_payloads.dispatch_sent.content_key_aliases,
    ["event.world.march_started"],
  );
  assert.deepStrictEqual(
    response.event_payloads.dispatch_sent.tokens,
    {
      army_name: "Raid Column",
      target_tile_label: "Ruin Holdfast",
      eta_seconds: "90",
    },
  );
  assert.equal(
    response.event_payloads.march_arrived.content_key,
    "event.world.hostile_post_battle_returned",
  );
  assert.deepStrictEqual(
    response.event_payloads.march_arrived.content_key_aliases,
    ["event.world.march_returned"],
  );
  assert.equal(
    response.event_payloads.combat_resolved.content_key,
    "event.combat.hostile_resolve_attacker_win",
  );
  assert.deepStrictEqual(
    response.event_payloads.combat_resolved.content_key_aliases,
    ["event.combat.placeholder_skirmish_win"],
  );

  const persisted = repository.readMarchRuntimeState({
    march_id: "march_attack_alpha",
  });
  assert.notEqual(persisted, null);
  assert.equal(persisted?.march_state, "march_state_resolved");
  assert.equal(persisted?.march_revision, 2);
  assert.equal(persisted?.resolution_outcome, "attacker_win");
});

test("hostile attack service returns deterministic hero attachment metadata and runtime payload row", () => {
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
  const service = new DeterministicWorldMapHostileAttackService(
    new DeterministicWorldMapMarchDispatchService(repository, {
      hero_attachment_enabled: true,
      hero_runtime_persistence_repository: heroRuntimeRepository,
    }),
    new DeterministicWorldMapMarchSnapshotService(repository, {
      hero_runtime_persistence_repository: heroRuntimeRepository,
    }),
  );

  const response = service.resolveHostileAttack({
    march_id: "march_attack_hero",
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
    player_id: "player_world",
    hero_id: "hero_frontline",
    hero_target_scope: "army",
    hero_assignment_context_id: "march_attack_hero",
  });

  assert.notEqual(response.hero_attachment, null);
  assert.equal(response.hero_attachment?.player_id, "player_world");
  assert.equal(response.hero_attachment?.hero_id, "hero_frontline");
  assert.equal(response.hero_attachment?.assignment_context_type, "army");
  assert.equal(response.hero_attachment?.assignment_context_id, "march_attack_hero");
  assert.deepStrictEqual(
    response.hero_runtime_payloads.map((payload) => payload.payload_key),
    ["hero_attached"],
  );
  assert.equal(response.hero_runtime_payloads[0]?.content_key, "event.hero.assigned");
  assert.equal(response.hero_runtime_payloads[0]?.tokens.hero_id, "hero_frontline");
  assert.deepStrictEqual(
    response.events.map((event) => event.payload_key),
    ["dispatch_sent", "march_arrived", "combat_resolved"],
  );
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
    "event.combat.hostile_resolve_tie_defender_holds",
  );
  assert.deepStrictEqual(
    response.event_payloads.combat_resolved.content_key_aliases,
    ["event.combat.placeholder_skirmish_loss"],
  );
  assert.equal(
    response.event_payloads.march_arrived.content_key,
    "event.world.hostile_defeat_force_shattered",
  );
  assert.deepStrictEqual(
    response.event_payloads.march_arrived.content_key_aliases,
    ["event.world.march_returned"],
  );
});

test("hostile attack service emits defender-win hostile combat narrative key for non-tie outcomes", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const service = new DeterministicWorldMapHostileAttackService(
    new DeterministicWorldMapMarchDispatchService(repository),
    new DeterministicWorldMapMarchSnapshotService(repository),
  );

  const response = service.resolveHostileAttack({
    march_id: "march_attack_defender_strong",
    source_settlement_id: "settlement_alpha",
    source_settlement_name: "Cinderwatch Hold",
    target_settlement_id: "settlement_hostile",
    target_settlement_name: "Ruin Holdfast",
    target_tile_label: "Ruin Holdfast",
    origin: { x: 0, y: 0 },
    target: { x: 1, y: 0 },
    defender_garrison_strength: 40,
    dispatched_units: [
      {
        unit_id: "watch_levy",
        unit_count: 6,
        unit_attack: 5,
      },
    ],
    departed_at: new Date("2026-02-26T19:30:00.000Z"),
  });

  assert.equal(response.combat_outcome, "defender_win");
  assert.equal(
    response.event_payloads.combat_resolved.content_key,
    "event.combat.hostile_resolve_defender_win",
  );
  assert.deepStrictEqual(
    response.event_payloads.combat_resolved.content_key_aliases,
    ["event.combat.placeholder_skirmish_loss"],
  );
  assert.equal(
    response.event_payloads.march_arrived.content_key,
    "event.world.hostile_defeat_force_shattered",
  );
  assert.deepStrictEqual(
    response.event_payloads.march_arrived.content_key_aliases,
    ["event.world.march_returned"],
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

test("hostile attack service maps feature_not_in_slice dispatch failures", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const heroRuntimeRepository = new InMemoryHeroRuntimePersistenceRepository();
  heroRuntimeRepository.ensureRuntimeState({
    hero_runtime_id: "player_world::hero_frontline",
    player_id: "player_world",
    hero_id: "hero_frontline",
    active_ability_id: "ability_banner_wall",
    unlock_state: "unlocked",
    readiness_state: "ready",
    updated_at: new Date("2026-02-26T19:25:00.000Z"),
  });
  const service = new DeterministicWorldMapHostileAttackService(
    new DeterministicWorldMapMarchDispatchService(repository, {
      hero_attachment_enabled: false,
      hero_runtime_persistence_repository: heroRuntimeRepository,
    }),
    new DeterministicWorldMapMarchSnapshotService(repository),
  );

  assert.throws(
    () =>
      service.resolveHostileAttack({
        march_id: "march_attack_hero_gate",
        source_settlement_id: "settlement_alpha",
        target_settlement_id: "settlement_hostile",
        origin: { x: 0, y: 0 },
        target: { x: 1, y: 0 },
        defender_garrison_strength: 20,
        dispatched_units: [{ unit_id: "watch_levy", unit_count: 4, unit_attack: 4 }],
        player_id: "player_world",
        hero_id: "hero_frontline",
      }),
    (error: unknown) =>
      error instanceof WorldMapHostileAttackOperationError
      && error.code === "feature_not_in_slice",
  );
});

test("hostile attack service maps hero-unavailable/scope/assignment dispatch failures", () => {
  const unavailableRepository = new InMemoryWorldMapMarchStateRepository();
  const unavailableHeroRepository = new InMemoryHeroRuntimePersistenceRepository({
    assignment_context_ownership_read_repositories: createOwnershipReadRepositories({
      owned_armies: ["player_b::march_attack_unavailable"],
    }),
  });
  unavailableHeroRepository.ensureRuntimeState({
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
  const unavailableService = new DeterministicWorldMapHostileAttackService(
    new DeterministicWorldMapMarchDispatchService(unavailableRepository, {
      hero_attachment_enabled: true,
      hero_runtime_persistence_repository: unavailableHeroRepository,
    }),
    new DeterministicWorldMapMarchSnapshotService(unavailableRepository),
  );
  assert.throws(
    () =>
      unavailableService.resolveHostileAttack({
        march_id: "march_attack_unavailable",
        source_settlement_id: "settlement_beta",
        target_settlement_id: "settlement_hostile",
        origin: { x: 0, y: 0 },
        target: { x: 1, y: 1 },
        defender_garrison_strength: 20,
        dispatched_units: [{ unit_id: "watch_levy", unit_count: 4, unit_attack: 4 }],
        player_id: "player_b",
        hero_id: "hero_rime",
      }),
    (error: unknown) =>
      error instanceof WorldMapHostileAttackOperationError
      && error.code === "hero_unavailable",
  );

  const scopeRepository = new InMemoryWorldMapMarchStateRepository();
  const scopeHeroRepository = new InMemoryHeroRuntimePersistenceRepository({
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
  const scopeService = new DeterministicWorldMapHostileAttackService(
    new DeterministicWorldMapMarchDispatchService(scopeRepository, {
      hero_attachment_enabled: true,
      hero_runtime_persistence_repository: scopeHeroRepository,
    }),
    new DeterministicWorldMapMarchSnapshotService(scopeRepository),
  );
  assert.throws(
    () =>
      scopeService.resolveHostileAttack({
        march_id: "march_attack_scope",
        source_settlement_id: "settlement_gamma",
        target_settlement_id: "settlement_hostile",
        origin: { x: 0, y: 0 },
        target: { x: 1, y: 1 },
        defender_garrison_strength: 20,
        dispatched_units: [{ unit_id: "watch_levy", unit_count: 4, unit_attack: 4 }],
        player_id: "player_c",
        hero_id: "hero_scout",
      }),
    (error: unknown) =>
      error instanceof WorldMapHostileAttackOperationError
      && error.code === "hero_target_scope_mismatch",
  );

  const assignedRepository = new InMemoryWorldMapMarchStateRepository();
  const assignedHeroRepository = new InMemoryHeroRuntimePersistenceRepository({
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
  const assignedService = new DeterministicWorldMapHostileAttackService(
    new DeterministicWorldMapMarchDispatchService(assignedRepository, {
      hero_attachment_enabled: true,
      hero_runtime_persistence_repository: assignedHeroRepository,
    }),
    new DeterministicWorldMapMarchSnapshotService(assignedRepository),
  );
  assert.throws(
    () =>
      assignedService.resolveHostileAttack({
        march_id: "march_attack_assigned",
        source_settlement_id: "settlement_delta",
        target_settlement_id: "settlement_hostile",
        origin: { x: 0, y: 0 },
        target: { x: 1, y: 1 },
        defender_garrison_strength: 20,
        dispatched_units: [{ unit_id: "watch_levy", unit_count: 4, unit_attack: 4 }],
        player_id: "player_d",
        hero_id: "hero_guard",
      }),
    (error: unknown) =>
      error instanceof WorldMapHostileAttackOperationError
      && error.code === "hero_already_assigned",
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
