import { strict as assert } from "node:assert";
import { test } from "node:test";

import { DeterministicWorldMapScoutSelectService } from "../application";
import {
  WORLD_MAP_SCOUT_INTERACTION_OUTCOMES,
  WORLD_MAP_TILE_STATES,
} from "../domain";
import { InMemoryWorldMapTileStateRepository } from "../infra";
import {
  WorldMapTileInteractEndpointHandler,
  WorldMapTileInteractValidationError,
} from "./world-map-tile-interact-endpoint";

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
