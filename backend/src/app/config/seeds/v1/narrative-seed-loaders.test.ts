import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  NarrativeSeedValidationError,
  loadNarrativeSeedBundleV1,
  parseCivilizationIntrosSeedV1,
  parseEventFeedMessagesSeedV1,
  parseStarterSettlementNamePoolSeedV1,
  NARRATIVE_SEED_SCHEMA_VERSION_V1,
} from "./narrative-seed-loaders";

const assertNarrativeSeedValidationError = (
  operation: () => unknown,
  expectedMessage: string,
): void => {
  assert.throws(
    () => {
      operation();
    },
    (error) =>
      error instanceof NarrativeSeedValidationError &&
      error.message.includes(expectedMessage),
    `Expected NarrativeSeedValidationError containing '${expectedMessage}'.`,
  );
};

test("loadNarrativeSeedBundleV1 parses current narrative seed files", async () => {
  const bundle = await loadNarrativeSeedBundleV1();

  assert.equal(bundle.civilization_intros.schema_version, NARRATIVE_SEED_SCHEMA_VERSION_V1);
  assert.equal(bundle.civilization_intros.table_id, "narrative.civilization_intros");
  assert.ok(bundle.civilization_intros.rows.length > 0);

  assert.equal(
    bundle.starter_settlement_name_pool.table_id,
    "narrative.starter_settlement_name_pool",
  );
  assert.equal(bundle.event_feed_messages.table_id, "narrative.event_feed_messages");
});

test("parseStarterSettlementNamePoolSeedV1 rejects duplicate row keys", () => {
  const duplicateKeyRows = {
    schema_version: NARRATIVE_SEED_SCHEMA_VERSION_V1,
    source_doc: "tests/fixtures/narrative.fixture.json",
    source_section: "duplicate row keys",
    table_id: "narrative.starter_settlement_name_pool",
    rows: [
      {
        key: "starter_settlement_name.dup_01",
        slice_status_scope: "playable_now",
        categories: ["starter_settlement_name_pool", "settlement_name"],
        related_ids: ["civ_id:cinder_throne_legates"],
        civ_id: "cinder_throne_legates",
        template: "Ashgate",
        tokens: [],
      },
      {
        key: "starter_settlement_name.dup_01",
        slice_status_scope: "playable_now",
        categories: ["starter_settlement_name_pool", "settlement_name"],
        related_ids: ["civ_id:cinder_throne_legates"],
        civ_id: "cinder_throne_legates",
        template: "Brandwatch",
        tokens: [],
      },
    ],
  };

  assertNarrativeSeedValidationError(
    () => {
      parseStarterSettlementNamePoolSeedV1(duplicateKeyRows);
    },
    "Duplicate row key 'starter_settlement_name.dup_01' in 'narrative.starter_settlement_name_pool'.",
  );
});

test("parseEventFeedMessagesSeedV1 rejects malformed template token ordering", () => {
  const mismatchedTokens = {
    schema_version: NARRATIVE_SEED_SCHEMA_VERSION_V1,
    source_doc: "tests/fixtures/narrative.fixture.json",
    source_section: "template token ordering fixture",
    table_id: "narrative.event_feed_messages",
    rows: [
      {
        key: "event.fixture.order_mismatch",
        slice_status_scope: "playable_now",
        categories: ["event_feed_message", "test"],
        related_ids: ["civ_id:{civ_id}"],
        template: "{settlement_name} receives {quantity} grain.",
        tokens: ["quantity", "settlement_name"],
      },
    ],
  };

  assertNarrativeSeedValidationError(
    () => {
      parseEventFeedMessagesSeedV1(mismatchedTokens);
    },
    "Template token mismatch for row 'event.fixture.order_mismatch' in 'narrative.event_feed_messages'.",
  );
});

test("parseCivilizationIntrosSeedV1 rejects missing required field", () => {
  const missingTokens = {
    schema_version: NARRATIVE_SEED_SCHEMA_VERSION_V1,
    source_doc: "tests/fixtures/narrative.fixture.json",
    source_section: "missing tokens fixture",
    table_id: "narrative.civilization_intros",
    rows: [
      {
        key: "civ_intro.fixture",
        slice_status_scope: "playable_now",
        categories: ["civilization_intro"],
        related_ids: ["civ_id:cinder_throne_legates"],
        civ_id: "cinder_throne_legates",
        template: "Welcome to the new age.",
      },
    ],
  };

  assertNarrativeSeedValidationError(
    () => {
      parseCivilizationIntrosSeedV1(missingTokens);
    },
    "Missing required field '$.rows[0].tokens'.",
  );
});
