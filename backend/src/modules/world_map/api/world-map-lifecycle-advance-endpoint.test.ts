import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DeterministicWorldMapLifecycleSchedulerService,
  WorldMapLifecycleNotFoundError,
} from "../application/world-map-lifecycle-scheduler-service.ts";
import { InMemoryWorldMapLifecycleStateRepository } from "../infra/in-memory-world-map-lifecycle-state-repository.ts";
import {
  WorldMapLifecycleAdvanceEndpointHandler,
  WorldMapLifecycleAdvanceValidationError,
} from "./world-map-lifecycle-advance-endpoint.ts";

test("POST /world-map/worlds/{worldId}/lifecycle/advance returns deterministic lifecycle transition events and archive summary", () => {
  const repository = new InMemoryWorldMapLifecycleStateRepository([
    {
      world_id: "world_alpha",
      world_revision: 5,
      lifecycle_state: "world_lifecycle_open",
      season_number: 2,
      season_length_days: 1,
      season_started_at: new Date("2026-02-25T00:00:00.000Z"),
      state_changed_at: new Date("2026-02-25T00:00:00.000Z"),
      joinable_world_state: {
        joinable_player_ids: ["player_01", "player_02"],
        active_settlement_ids: ["settlement_01"],
        active_march_ids: ["march_01"],
      },
    },
  ]);
  const service = new DeterministicWorldMapLifecycleSchedulerService(repository, {
    lock_to_archive_delay_seconds: 120,
    archive_to_reset_delay_seconds: 60,
  });
  const endpoint = new WorldMapLifecycleAdvanceEndpointHandler(service);

  const response = endpoint.handlePostLifecycleAdvance({
    path: {
      worldId: "world_alpha",
    },
    body: {
      world_id: "world_alpha",
      flow_version: "v1",
      observed_at: "2026-02-26T00:03:30.000Z",
    },
  });

  assert.equal(response.status, "accepted");
  assert.equal(response.flow, "world_map.lifecycle_v1");
  assert.equal(response.lifecycle_state, "world_lifecycle_open");
  assert.equal(response.season_number, 3);
  assert.deepStrictEqual(
    response.events.map((event) => event.content_key),
    [
      "event.world.lifecycle_locked",
      "event.world.lifecycle_archived",
      "event.world.lifecycle_reset",
      "event.world.lifecycle_opened",
    ],
  );
  assert.equal(response.latest_archive?.archive_id, "world_alpha:season:2");
  assert.equal(response.latest_archive?.active_player_count, 2);
});

test("POST /world-map/worlds/{worldId}/lifecycle/advance rejects missing observed_at timestamp", () => {
  const repository = new InMemoryWorldMapLifecycleStateRepository([
    {
      world_id: "world_alpha",
      world_revision: 0,
      lifecycle_state: "world_lifecycle_open",
      season_number: 1,
      season_length_days: 1,
      season_started_at: new Date("2026-02-26T00:00:00.000Z"),
      state_changed_at: new Date("2026-02-26T00:00:00.000Z"),
      joinable_world_state: {
        joinable_player_ids: [],
        active_settlement_ids: [],
        active_march_ids: [],
      },
    },
  ]);
  const service = new DeterministicWorldMapLifecycleSchedulerService(repository);
  const endpoint = new WorldMapLifecycleAdvanceEndpointHandler(service);

  assert.throws(
    () =>
      endpoint.handlePostLifecycleAdvance({
        path: {
          worldId: "world_alpha",
        },
        body: {
          world_id: "world_alpha",
          flow_version: "v1",
          observed_at: " ",
        },
      }),
    (error: unknown) =>
      error instanceof WorldMapLifecycleAdvanceValidationError
      && error.code === "missing_observed_at",
  );
});

test("POST /world-map/worlds/{worldId}/lifecycle/advance raises world_not_found for unknown worlds", () => {
  const repository = new InMemoryWorldMapLifecycleStateRepository();
  const service = new DeterministicWorldMapLifecycleSchedulerService(repository);
  const endpoint = new WorldMapLifecycleAdvanceEndpointHandler(service);

  assert.throws(
    () =>
      endpoint.handlePostLifecycleAdvance({
        path: {
          worldId: "world_missing",
        },
        body: {
          world_id: "world_missing",
          flow_version: "v1",
          observed_at: "2026-02-26T00:00:00.000Z",
        },
      }),
    (error: unknown) =>
      error instanceof WorldMapLifecycleNotFoundError &&
      error.code === "world_not_found",
  );
});
