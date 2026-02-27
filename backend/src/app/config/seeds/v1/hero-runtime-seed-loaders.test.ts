import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  createDefaultHeroRuntimeSeedFilePathsV1,
  HERO_RUNTIME_EVENT_TOKENS_TABLE_ID,
  HERO_RUNTIME_SEED_SCHEMA_VERSION_V1,
  HeroRuntimeSeedValidationError,
  loadHeroRuntimeEventTokenSeedTableV1,
  parseHeroRuntimeEventTokenSeedTableV1,
} from "./hero-runtime-seed-loaders.ts";

const assertHeroRuntimeSeedValidationError = (
  operation: () => unknown,
  expectedMessage: string,
): void => {
  assert.throws(
    () => {
      operation();
    },
    (error) =>
      error instanceof HeroRuntimeSeedValidationError &&
      error.message.includes(expectedMessage),
    `Expected HeroRuntimeSeedValidationError containing '${expectedMessage}'.`,
  );
};

test("loadHeroRuntimeEventTokenSeedTableV1 parses current hero runtime fixture", async () => {
  const paths = createDefaultHeroRuntimeSeedFilePathsV1();
  const table = await loadHeroRuntimeEventTokenSeedTableV1(paths.heroRuntimeEventTokens);

  assert.equal(table.schema_version, HERO_RUNTIME_SEED_SCHEMA_VERSION_V1);
  assert.equal(table.table_id, HERO_RUNTIME_EVENT_TOKENS_TABLE_ID);
  assert.equal(table.rows.length, 3);
});

test("parseHeroRuntimeEventTokenSeedTableV1 rejects mismatched event token mapping", () => {
  const mismatchedFixture = {
    schema_version: HERO_RUNTIME_SEED_SCHEMA_VERSION_V1,
    source_doc: "tests/fixtures/hero-runtime.fixture.json",
    source_section: "mismatched token fixture",
    table_id: HERO_RUNTIME_EVENT_TOKENS_TABLE_ID,
    rows: [
      {
        event_key: "event.hero.assigned",
        required_tokens: [
          "hero_id",
          "ability_id",
        ],
      },
      {
        event_key: "event.hero.ability_activated",
        required_tokens: [
          "hero_id",
          "ability_id",
          "assignment_context_type",
          "assignment_context_id",
          "cooldown_ends_at",
        ],
      },
      {
        event_key: "event.hero.cooldown_complete",
        required_tokens: [
          "hero_id",
          "ability_id",
        ],
      },
    ],
  };

  assertHeroRuntimeSeedValidationError(
    () => {
      parseHeroRuntimeEventTokenSeedTableV1(mismatchedFixture);
    },
    "Unexpected required_tokens for event_key 'event.hero.assigned'",
  );
});

test("parseHeroRuntimeEventTokenSeedTableV1 rejects duplicate event key identities", () => {
  const duplicateKeyFixture = {
    schema_version: HERO_RUNTIME_SEED_SCHEMA_VERSION_V1,
    source_doc: "tests/fixtures/hero-runtime.fixture.json",
    source_section: "duplicate row fixture",
    table_id: HERO_RUNTIME_EVENT_TOKENS_TABLE_ID,
    rows: [
      {
        event_key: "event.hero.assigned",
        required_tokens: [
          "hero_id",
          "assignment_context_type",
          "assignment_context_id",
        ],
      },
      {
        event_key: "event.hero.assigned",
        required_tokens: [
          "hero_id",
          "assignment_context_type",
          "assignment_context_id",
        ],
      },
      {
        event_key: "event.hero.cooldown_complete",
        required_tokens: [
          "hero_id",
          "ability_id",
        ],
      },
    ],
  };

  assertHeroRuntimeSeedValidationError(
    () => {
      parseHeroRuntimeEventTokenSeedTableV1(duplicateKeyFixture);
    },
    "Duplicate seed row identity 'event.hero.assigned' in 'heroes.hero_runtime_event_tokens'.",
  );
});
