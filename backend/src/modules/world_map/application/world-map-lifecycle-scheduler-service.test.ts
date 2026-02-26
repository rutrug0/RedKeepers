import { strict as assert } from "node:assert";
import { test } from "node:test";

import { InMemoryWorldMapLifecycleStateRepository } from "../infra";
import { DeterministicWorldMapLifecycleSchedulerService } from "./world-map-lifecycle-scheduler-service";

test("lifecycle scheduler keeps world open before deterministic lock timestamp", () => {
  const repository = new InMemoryWorldMapLifecycleStateRepository([
    {
      world_id: "world_alpha",
      world_revision: 7,
      lifecycle_state: "world_lifecycle_open",
      season_number: 3,
      season_length_days: 30,
      season_started_at: new Date("2026-01-01T00:00:00.000Z"),
      state_changed_at: new Date("2026-01-01T00:00:00.000Z"),
      joinable_world_state: {
        joinable_player_ids: ["player_a", "player_b"],
        active_settlement_ids: ["settlement_a"],
        active_march_ids: ["march_a"],
      },
    },
  ]);
  const service = new DeterministicWorldMapLifecycleSchedulerService(repository);

  const response = service.advanceLifecycle({
    world_id: "world_alpha",
    observed_at: new Date("2026-01-30T23:59:59.000Z"),
  });

  assert.equal(response.lifecycle_state, "world_lifecycle_open");
  assert.equal(response.season_number, 3);
  assert.deepEqual(response.events, []);
  assert.equal(
    response.schedule.season_lock_at.toISOString(),
    "2026-01-31T00:00:00.000Z",
  );
  assert.equal(
    response.schedule.season_archive_at.toISOString(),
    "2026-01-31T00:05:00.000Z",
  );
  assert.equal(
    response.schedule.season_reset_at.toISOString(),
    "2026-01-31T00:06:00.000Z",
  );
});

test("lifecycle scheduler archives and resets joinable world state at deterministic rollover timestamps", () => {
  const repository = new InMemoryWorldMapLifecycleStateRepository([
    {
      world_id: "world_beta",
      world_revision: 2,
      lifecycle_state: "world_lifecycle_open",
      season_number: 1,
      season_length_days: 30,
      season_started_at: new Date("2026-01-01T00:00:00.000Z"),
      state_changed_at: new Date("2026-01-01T00:00:00.000Z"),
      joinable_world_state: {
        joinable_player_ids: ["player_1", "player_2"],
        active_settlement_ids: ["settlement_1", "settlement_2"],
        active_march_ids: ["march_1"],
      },
    },
  ]);
  const service = new DeterministicWorldMapLifecycleSchedulerService(repository);

  const response = service.advanceLifecycle({
    world_id: "world_beta",
    observed_at: new Date("2026-01-31T00:06:30.000Z"),
  });

  assert.equal(response.lifecycle_state, "world_lifecycle_open");
  assert.equal(response.season_number, 2);
  assert.equal(response.world_revision, 5);
  assert.deepEqual(
    response.events.map((event) => event.content_key),
    [
      "event.world.lifecycle_locked",
      "event.world.lifecycle_archived",
      "event.world.lifecycle_reset",
      "event.world.lifecycle_opened",
    ],
  );
  assert.deepEqual(
    response.events.map((event) => event.occurred_at.toISOString()),
    [
      "2026-01-31T00:00:00.000Z",
      "2026-01-31T00:05:00.000Z",
      "2026-01-31T00:06:00.000Z",
      "2026-01-31T00:06:00.000Z",
    ],
  );
  assert.notEqual(response.latest_archive, undefined);
  if (response.latest_archive === undefined) {
    return;
  }
  assert.equal(response.latest_archive.archive_id, "world_beta:season:1");
  assert.equal(response.latest_archive.season_number, 1);
  assert.equal(response.latest_archive.active_player_count, 2);
  assert.equal(response.latest_archive.active_settlement_count, 2);
  assert.equal(response.latest_archive.active_march_count, 1);

  const persisted = repository.readLifecycleRuntimeState({ world_id: "world_beta" });
  assert.notEqual(persisted, null);
  if (persisted === null) {
    return;
  }
  assert.equal(persisted.lifecycle_state, "world_lifecycle_open");
  assert.equal(persisted.season_number, 2);
  assert.deepEqual(persisted.joinable_world_state.joinable_player_ids, []);
  assert.deepEqual(persisted.joinable_world_state.active_settlement_ids, []);
  assert.deepEqual(persisted.joinable_world_state.active_march_ids, []);
});

test("lifecycle scheduler stays archived between archive and reset cutoffs", () => {
  const repository = new InMemoryWorldMapLifecycleStateRepository([
    {
      world_id: "world_gamma",
      world_revision: 11,
      lifecycle_state: "world_lifecycle_open",
      season_number: 4,
      season_length_days: 7,
      season_started_at: new Date("2026-01-01T00:00:00.000Z"),
      state_changed_at: new Date("2026-01-01T00:00:00.000Z"),
      joinable_world_state: {
        joinable_player_ids: ["player_gamma"],
        active_settlement_ids: ["settlement_gamma"],
        active_march_ids: [],
      },
    },
  ]);
  const service = new DeterministicWorldMapLifecycleSchedulerService(repository, {
    lock_to_archive_delay_seconds: 300,
    archive_to_reset_delay_seconds: 600,
  });

  const response = service.advanceLifecycle({
    world_id: "world_gamma",
    observed_at: new Date("2026-01-08T00:06:00.000Z"),
  });

  assert.equal(response.lifecycle_state, "world_lifecycle_archived");
  assert.equal(response.season_number, 4);
  assert.deepEqual(
    response.events.map((event) => event.content_key),
    [
      "event.world.lifecycle_locked",
      "event.world.lifecycle_archived",
    ],
  );
  assert.equal(
    response.schedule.season_reset_at.toISOString(),
    "2026-01-08T00:15:00.000Z",
  );
});

