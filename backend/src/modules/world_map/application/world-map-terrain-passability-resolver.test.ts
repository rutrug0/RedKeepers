import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DeterministicWorldMapTerrainPassabilityResolver,
  createWorldMapTerrainPassabilityCoordinateKey,
} from "./world-map-terrain-passability-resolver.ts";

test("terrain passability resolver returns deterministic values for the same world seed and tile query", () => {
  const resolver = new DeterministicWorldMapTerrainPassabilityResolver();
  const query = {
    world_seed: "seed_world_alpha",
    map_size: 16,
    coordinate: { x: 2, y: 9 },
  } as const;

  const first = resolver.resolveTilePassable(query);
  const second = resolver.resolveTilePassable(query);

  assert.equal(second, first);
});

test("terrain passability resolver returns false for out-of-bounds coordinates", () => {
  const resolver = new DeterministicWorldMapTerrainPassabilityResolver();
  const passable = resolver.resolveTilePassable({
    world_seed: "seed_world_alpha",
    map_size: 16,
    coordinate: { x: -1, y: 2 },
  });

  assert.equal(passable, false);
});

test("terrain passability resolver honors deterministic fixture seed rows over hash fallback", () => {
  const resolver = new DeterministicWorldMapTerrainPassabilityResolver({
    fixture_seed_table: {
      rows: [
        {
          world_seed: "seed_world_alpha",
          map_size: 16,
          coordinate: { x: 4, y: 2 },
          passable: true,
        },
      ],
    },
  });

  const fixtureQuery = {
    world_seed: "seed_world_alpha",
    map_size: 16,
    coordinate: { x: 4, y: 2 },
  } as const;

  assert.equal(
    resolver.resolveTilePassable(fixtureQuery),
    true,
  );
  assert.equal(
    createWorldMapTerrainPassabilityCoordinateKey(fixtureQuery),
    "seed_world_alpha:16:4:2",
  );
});
