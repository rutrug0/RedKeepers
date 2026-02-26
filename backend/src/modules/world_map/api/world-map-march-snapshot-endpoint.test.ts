import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DeterministicWorldMapMarchSnapshotService,
  WorldMapMarchNotFoundError,
} from "../application";
import { InMemoryWorldMapMarchStateRepository } from "../infra";
import {
  WorldMapMarchSnapshotEndpointHandler,
  WorldMapMarchSnapshotValidationError,
} from "./world-map-march-snapshot-endpoint";

test("POST /world-map/marches/{marchId}/snapshot returns interpolation-ready authoritative snapshot payload", () => {
  const repository = new InMemoryWorldMapMarchStateRepository([
    {
      march_id: "march_alpha",
      settlement_id: "settlement_alpha",
      march_revision: 1,
      march_state: "march_state_in_transit",
      origin: { x: 0, y: 0 },
      target: { x: 3, y: 0 },
      departed_at: new Date("2026-02-26T18:00:00.000Z"),
      seconds_per_tile: 30,
      attacker_strength: 120,
      defender_strength: 90,
    },
  ]);
  const service = new DeterministicWorldMapMarchSnapshotService(repository, {
    snapshot_interval_ms: 1000,
  });
  const endpoint = new WorldMapMarchSnapshotEndpointHandler(service);

  const response = endpoint.handlePostSnapshot({
    path: { marchId: "march_alpha" },
    body: {
      march_id: "march_alpha",
      flow_version: "v1",
      observed_at: "2026-02-26T18:00:20.530Z",
    },
  });

  assert.equal(response.flow, "world_map.march_snapshot_v1");
  assert.equal(response.march_id, "march_alpha");
  assert.equal(response.march_state, "march_state_in_transit");
  assert.equal(response.snapshot_emitted_at.toISOString(), "2026-02-26T18:00:20.000Z");
  assert.equal(response.interpolation_window !== undefined, true);
  assert.equal(response.next_authoritative_snapshot_at?.toISOString(), "2026-02-26T18:00:21.000Z");
  assert.equal(response.resolution, undefined);
});

test("POST /world-map/marches/{marchId}/snapshot rejects path/body march mismatch", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const service = new DeterministicWorldMapMarchSnapshotService(repository);
  const endpoint = new WorldMapMarchSnapshotEndpointHandler(service);

  assert.throws(
    () =>
      endpoint.handlePostSnapshot({
        path: { marchId: "march_alpha" },
        body: {
          march_id: "march_beta",
          flow_version: "v1",
        },
      }),
    (error: unknown) =>
      error instanceof WorldMapMarchSnapshotValidationError &&
      error.code === "march_id_mismatch",
  );
});

test("POST /world-map/marches/{marchId}/snapshot raises march_not_found for unknown march ids", () => {
  const repository = new InMemoryWorldMapMarchStateRepository();
  const service = new DeterministicWorldMapMarchSnapshotService(repository);
  const endpoint = new WorldMapMarchSnapshotEndpointHandler(service);

  assert.throws(
    () =>
      endpoint.handlePostSnapshot({
        path: { marchId: "march_missing" },
        body: {
          march_id: "march_missing",
          flow_version: "v1",
        },
      }),
    (error: unknown) =>
      error instanceof WorldMapMarchNotFoundError &&
      error.code === "march_not_found",
  );
});
