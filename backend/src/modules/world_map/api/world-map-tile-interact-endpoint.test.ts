import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  HeroRuntimeActionModifierSource,
  SharedActionModifierAggregationService,
} from "../../heroes/application/shared-action-modifier-aggregation.ts";
import { InMemoryHeroRuntimePersistenceRepository } from "../../heroes/infra/in-memory-hero-runtime-persistence-repository.ts";
import { DeterministicWorldMapScoutSelectService } from "../application/world-map-scout-select-service.ts";
import {
  WORLD_MAP_SCOUT_INTERACTION_OUTCOMES,
  WORLD_MAP_TILE_STATES,
} from "../domain/world-map-scout-contract.ts";
import { InMemoryWorldMapTileStateRepository } from "../infra/in-memory-world-map-tile-state-repository.ts";
import {
  createWorldMapTileSnapshotKey,
  hydrateWorldMapTileStateRepositoryFromSeedRows,
  indexWorldMapTileSnapshotsBySettlementAndTileId,
  loadWorldMapSeedBundleV1,
} from "../../../app/config/seeds/v1/world-map-seed-loaders.ts";
import {
  WorldMapTileInteractEndpointHandler,
  WorldMapTileInteractOperationError,
  WorldMapTileInteractValidationError,
} from "./world-map-tile-interact-endpoint.ts";

test("POST /world-map/tiles/{tileId}/interact returns scout_dispatched response for unknown tiles", () => {
  const repository = new InMemoryWorldMapTileStateRepository();
  const service = new DeterministicWorldMapScoutSelectService(repository, {
    default_settlement_name: "Ashkeep",
    resolve_unknown_tile_state: () => "tile_state_hostile_hint",
  });
  const endpoint = new WorldMapTileInteractEndpointHandler(service);

  const response = endpoint.handlePostTileInteract({
    path: { tileId: "tile_0412_0198" },
    body: {
      settlement_id: "settlement_alpha",
      tile_id: "tile_0412_0198",
      interaction_type: "scout",
      flow_version: "v1",
    },
  });

  assert.equal(response.flow, "world_map.scout_select_v1");
  assert.equal(response.tile_id, "tile_0412_0198");
  assert.equal(response.tile_state, "tile_state_hostile_hint");
  assert.equal(response.interaction_outcome, "outcome_scout_dispatched");
  assert.equal(response.event.content_key, "event.world.scout_dispatched");
  assert.equal(response.tile_revision, 1);

  if (response.interaction_outcome !== "outcome_scout_dispatched") {
    return;
  }
  assert.deepStrictEqual(response.event.tokens, {
    settlement_name: "Ashkeep",
    target_tile_label: "Frontier Tile tile_0412_0198",
  });
});

test("POST /world-map/tiles/{tileId}/interact returns report_empty response for quiet tiles", () => {
  const repository = new InMemoryWorldMapTileStateRepository([
    {
      settlement_id: "settlement_alpha",
      tile_id: "tile_0413_0198",
      tile_state: "tile_state_quiet",
      tile_revision: 3,
      target_tile_label: "Black Reed March",
    },
  ]);
  const service = new DeterministicWorldMapScoutSelectService(repository);
  const endpoint = new WorldMapTileInteractEndpointHandler(service);

  const response = endpoint.handlePostTileInteract({
    path: { tileId: "tile_0413_0198" },
    body: {
      settlement_id: "settlement_alpha",
      tile_id: "tile_0413_0198",
      interaction_type: "scout",
      flow_version: "v1",
    },
  });

  assert.equal(response.tile_state, "tile_state_quiet");
  assert.equal(response.interaction_outcome, "outcome_scout_report_empty");
  assert.equal(response.event.content_key, "event.world.scout_report_empty");
  assert.equal(response.tile_revision, 4);

  if (response.interaction_outcome !== "outcome_scout_report_empty") {
    return;
  }
  assert.deepStrictEqual(response.event.tokens, {
    target_tile_label: "Black Reed March",
  });
});

test("POST /world-map/tiles/{tileId}/interact returns report_hostile response for hostile-hint tiles", () => {
  const repository = new InMemoryWorldMapTileStateRepository([
    {
      settlement_id: "settlement_alpha",
      tile_id: "tile_0414_0198",
      tile_state: "tile_state_hostile_hint",
      tile_revision: 8,
      target_tile_label: "Burnt Causeway",
      hostile_force_estimate: "light raider column",
    },
  ]);
  const service = new DeterministicWorldMapScoutSelectService(repository);
  const endpoint = new WorldMapTileInteractEndpointHandler(service);

  const response = endpoint.handlePostTileInteract({
    path: { tileId: "tile_0414_0198" },
    body: {
      settlement_id: "settlement_alpha",
      tile_id: "tile_0414_0198",
      interaction_type: "scout",
      flow_version: "v1",
    },
  });

  assert.equal(response.tile_state, "tile_state_hostile_hint");
  assert.equal(response.interaction_outcome, "outcome_scout_report_hostile");
  assert.equal(response.event.content_key, "event.world.scout_report_hostile");
  assert.equal(response.tile_revision, 9);

  if (response.interaction_outcome !== "outcome_scout_report_hostile") {
    return;
  }
  assert.deepStrictEqual(response.event.tokens, {
    target_tile_label: "Burnt Causeway",
    hostile_force_estimate: "light raider column",
  });
});

test("POST /world-map/tiles/{tileId}/interact applies next_scout_action modifier when session context is provided", () => {
  const heroRuntimeRepository = new InMemoryHeroRuntimePersistenceRepository({
    initial_snapshot: {
      runtime_states: [],
      assignment_bindings: [],
      modifier_instances: [
        {
          modifier_instance_id: "mod_scout_detail",
          player_id: "player_world",
          hero_id: "hero_scout",
          ability_id: "ability_scout",
          modifier_id: "mod_scout_detail",
          domain: "scout",
          stat_key: "scout_report_detail_mult",
          op: "mul",
          value: "1.2",
          trigger_window: "next_scout_action",
          remaining_charges: 1,
          assignment_context_type: "scout_detachment",
          assignment_context_id: "scout_8",
          activated_at: new Date("2026-02-26T12:00:00.000Z"),
          status: "active",
        },
      ],
    },
  });
  const modifierAggregation = new SharedActionModifierAggregationService([
    new HeroRuntimeActionModifierSource(heroRuntimeRepository),
  ], heroRuntimeRepository);

  const repository = new InMemoryWorldMapTileStateRepository([
    {
      settlement_id: "settlement_alpha",
      tile_id: "tile_0414_0198",
      tile_state: "tile_state_hostile_hint",
      tile_revision: 8,
      target_tile_label: "Burnt Causeway",
      hostile_force_estimate: "light raider column",
    },
  ]);
  const service = new DeterministicWorldMapScoutSelectService(repository, {
    action_modifier_aggregation: modifierAggregation,
  });
  const endpoint = new WorldMapTileInteractEndpointHandler(service);

  const response = endpoint.handlePostTileInteract({
    path: { tileId: "tile_0414_0198" },
    body: {
      settlement_id: "settlement_alpha",
      tile_id: "tile_0414_0198",
      interaction_type: "scout",
      flow_version: "v1",
    },
    session: {
      player_id: "player_world",
      assignment_context_type: "scout_detachment",
      assignment_context_id: "scout_8",
    },
  });

  assert.equal(response.interaction_outcome, "outcome_scout_report_hostile");
  if (response.interaction_outcome !== "outcome_scout_report_hostile") {
    return;
  }
  assert.equal(
    response.event.tokens.hostile_force_estimate,
    "light raider column (verified)",
  );

  const consumedRows = heroRuntimeRepository.listModifierInstances({
    player_id: "player_world",
    status: "consumed",
  });
  assert.equal(consumedRows.length, 1);
  assert.equal(consumedRows[0].modifier_instance_id, "mod_scout_detail");
  assert.equal(consumedRows[0].remaining_charges, 0);
});

test("POST /world-map/tiles/{tileId}/interact emits only M0 outcome codes and tile states", () => {
  const repository = new InMemoryWorldMapTileStateRepository([
    {
      settlement_id: "settlement_alpha",
      tile_id: "tile_quiet",
      tile_state: "tile_state_quiet",
      tile_revision: 0,
    },
    {
      settlement_id: "settlement_alpha",
      tile_id: "tile_hostile",
      tile_state: "tile_state_hostile_hint",
      tile_revision: 0,
    },
  ]);
  const service = new DeterministicWorldMapScoutSelectService(repository, {
    resolve_unknown_tile_state: () => "tile_state_quiet",
  });
  const endpoint = new WorldMapTileInteractEndpointHandler(service);

  const responses = [
    endpoint.handlePostTileInteract({
      path: { tileId: "tile_unknown" },
      body: {
        settlement_id: "settlement_alpha",
        tile_id: "tile_unknown",
        interaction_type: "scout",
        flow_version: "v1",
      },
    }),
    endpoint.handlePostTileInteract({
      path: { tileId: "tile_quiet" },
      body: {
        settlement_id: "settlement_alpha",
        tile_id: "tile_quiet",
        interaction_type: "scout",
        flow_version: "v1",
      },
    }),
    endpoint.handlePostTileInteract({
      path: { tileId: "tile_hostile" },
      body: {
        settlement_id: "settlement_alpha",
        tile_id: "tile_hostile",
        interaction_type: "scout",
        flow_version: "v1",
      },
    }),
  ];

  for (const response of responses) {
    assert.equal(
      WORLD_MAP_SCOUT_INTERACTION_OUTCOMES.includes(response.interaction_outcome),
      true,
    );
    assert.equal(WORLD_MAP_TILE_STATES.includes(response.tile_state), true);
  }
});

test("POST /world-map/tiles/{tileId}/interact rejects invalid route payload mismatch", () => {
  const repository = new InMemoryWorldMapTileStateRepository();
  const service = new DeterministicWorldMapScoutSelectService(repository);
  const endpoint = new WorldMapTileInteractEndpointHandler(service);

  assert.throws(
    () =>
      endpoint.handlePostTileInteract({
        path: { tileId: "tile_0412_0198" },
        body: {
          settlement_id: "settlement_alpha",
          tile_id: "tile_9999_9999",
          interaction_type: "scout",
          flow_version: "v1",
        },
      }),
    (error: unknown) =>
      error instanceof WorldMapTileInteractValidationError &&
      error.code === "tile_id_mismatch",
  );
});

test("POST /world-map/tiles/{tileId}/interact maps unavailable tile to consistent error code", () => {
  const repository = new InMemoryWorldMapTileStateRepository();
  const service = new DeterministicWorldMapScoutSelectService(repository);
  const endpoint = new WorldMapTileInteractEndpointHandler(service, {
    resolve_tile_available: () => false,
  });

  assert.throws(
    () =>
      endpoint.handlePostTileInteract({
        path: { tileId: "tile_0412_0198" },
        body: {
          settlement_id: "settlement_alpha",
          tile_id: "tile_0412_0198",
          interaction_type: "scout",
          flow_version: "v1",
        },
      }),
    (error: unknown) =>
      error instanceof WorldMapTileInteractOperationError &&
      error.code === "unavailable_tile",
  );
});

test("POST /world-map/tiles/{tileId}/interact contract adapter returns unavailable_tile failure response", () => {
  const repository = new InMemoryWorldMapTileStateRepository();
  const service = new DeterministicWorldMapScoutSelectService(repository);
  const endpoint = new WorldMapTileInteractEndpointHandler(service, {
    resolve_tile_available: () => false,
  });

  const response = endpoint.handlePostTileInteractContract({
    path: { tileId: "tile_0412_0198" },
    body: {
      settlement_id: "settlement_alpha",
      tile_id: "tile_0412_0198",
      interaction_type: "scout",
      flow_version: "v1",
    },
  });

  assert.equal(response.status, "failed");
  if (response.status !== "failed") {
    return;
  }
  assert.equal(response.error_code, "unavailable_tile");
  assert.equal(response.flow, "world_map.scout_select_v1");
  assert.equal(response.event.content_key, "event.scout.unavailable_tile");
  assert.deepStrictEqual(response.event.content_key_aliases, [
    "event.world.scout_unavailable_tile",
  ]);
});

test("POST /world-map/tiles/{tileId}/interact contract adapter returns accepted scout response for available tile", () => {
  const repository = new InMemoryWorldMapTileStateRepository();
  const service = new DeterministicWorldMapScoutSelectService(repository, {
    resolve_unknown_tile_state: () => "tile_state_quiet",
  });
  const endpoint = new WorldMapTileInteractEndpointHandler(service);

  const response = endpoint.handlePostTileInteractContract({
    path: { tileId: "tile_0412_0199" },
    body: {
      settlement_id: "settlement_alpha",
      tile_id: "tile_0412_0199",
      interaction_type: "scout",
      flow_version: "v1",
    },
  });

  assert.equal(response.status, "accepted");
  if (response.status !== "accepted") {
    return;
  }
  assert.equal(response.interaction_outcome, "outcome_scout_dispatched");
  assert.equal(response.event.content_key, "event.world.scout_dispatched");
});

test("fixture seed bundle can hydrate world-map repository and execute all three scout outcomes", async () => {
  const fixtureBundle = await loadWorldMapSeedBundleV1();
  const fixtureSnapshotsByTile =
    indexWorldMapTileSnapshotsBySettlementAndTileId(fixtureBundle.world_map_tiles.rows);

  const hostileKey = createWorldMapTileSnapshotKey("settlement_alpha", "tile_hostile_glade");
  const quietKey = createWorldMapTileSnapshotKey("settlement_alpha", "tile_quiet_watch");

  assert.equal(Object.keys(fixtureSnapshotsByTile).length, 3);
  assert.equal(
    fixtureSnapshotsByTile[hostileKey].tile_state,
    "tile_state_hostile_hint",
  );
  assert.equal(
    fixtureSnapshotsByTile[quietKey].target_tile_label,
    "Black Reed March",
  );

  const repository = new InMemoryWorldMapTileStateRepository();
  hydrateWorldMapTileStateRepositoryFromSeedRows(
    repository,
    fixtureBundle.world_map_tiles.rows,
  );
  const service = new DeterministicWorldMapScoutSelectService(repository);
  const endpoint = new WorldMapTileInteractEndpointHandler(service);

  const dispatchedResponse = endpoint.handlePostTileInteract({
    path: { tileId: "tile_unknown_demo" },
    body: {
      settlement_id: "settlement_alpha",
      tile_id: "tile_unknown_demo",
      interaction_type: "scout",
      flow_version: "v1",
    },
  });
  const emptyResponse = endpoint.handlePostTileInteract({
    path: { tileId: "tile_quiet_watch" },
    body: {
      settlement_id: "settlement_alpha",
      tile_id: "tile_quiet_watch",
      interaction_type: "scout",
      flow_version: "v1",
    },
  });
  const hostileResponse = endpoint.handlePostTileInteract({
    path: { tileId: "tile_hostile_glade" },
    body: {
      settlement_id: "settlement_alpha",
      tile_id: "tile_hostile_glade",
      interaction_type: "scout",
      flow_version: "v1",
    },
  });

  assert.equal(dispatchedResponse.interaction_outcome, "outcome_scout_dispatched");
  assert.equal(emptyResponse.interaction_outcome, "outcome_scout_report_empty");
  assert.equal(hostileResponse.interaction_outcome, "outcome_scout_report_hostile");

  assert.deepStrictEqual(emptyResponse.event.tokens, {
    target_tile_label: "Black Reed March",
  });
  assert.deepStrictEqual(hostileResponse.event.tokens, {
    target_tile_label: "Burnt Causeway",
    hostile_force_estimate: "light raider column",
  });
});
