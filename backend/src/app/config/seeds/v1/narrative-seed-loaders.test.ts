import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import {
  NarrativeSeedValidationError,
  loadNarrativeSeedBundleV1,
  parseCivilizationIntrosSeedV1,
  parseEventFeedMessagesSeedV1,
  parseStarterSettlementNamePoolSeedV1,
  NARRATIVE_SEED_SCHEMA_VERSION_V1,
} from "./narrative-seed-loaders.ts";

interface FirstSliceContentKeyManifest {
  readonly default_first_slice_seed_usage: {
    readonly include_only_content_keys: readonly string[];
  };
  readonly legacy_alias_mapping: readonly {
    readonly canonical_key: string;
    readonly legacy_keys: readonly string[];
  }[];
  readonly deferred_post_slice_keys: readonly {
    readonly key: string;
    readonly present_in_event_feed_seed: boolean;
  }[];
}

interface EventFeedMessagesSeedRaw {
  readonly rows: readonly {
    readonly key: string;
  }[];
}

const loadFirstSliceContentKeyManifest = async (): Promise<FirstSliceContentKeyManifest> => {
  const manifestPath = join(
    process.cwd(),
    "backend/src/app/config/seeds/v1/narrative/first-slice-content-key-manifest.json",
  );
  const raw = await readFile(manifestPath, "utf8");
  return JSON.parse(raw) as FirstSliceContentKeyManifest;
};

const loadEventFeedMessageKeySet = async (): Promise<Set<string>> => {
  const seedPath = join(
    process.cwd(),
    "backend/src/app/config/seeds/v1/narrative/event-feed-messages.json",
  );
  const raw = await readFile(seedPath, "utf8");
  const parsed = JSON.parse(raw) as EventFeedMessagesSeedRaw;
  return new Set(parsed.rows.map((row) => row.key));
};

const toUniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));

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

test("first-slice content key manifest canonical keys exist in narrative event feed seed", async () => {
  const manifest = await loadFirstSliceContentKeyManifest();
  const eventFeedKeySet = await loadEventFeedMessageKeySet();

  const missingCanonicalKeys = manifest.default_first_slice_seed_usage.include_only_content_keys.filter(
    (key) => !eventFeedKeySet.has(key),
  );

  assert.deepEqual(
    toUniqueSorted(missingCanonicalKeys),
    [],
    `Missing canonical keys in narrative event feed seed: ${toUniqueSorted(missingCanonicalKeys).join(", ")}`,
  );
});

test("first-slice content key manifest legacy alias keys exist in narrative event feed seed", async () => {
  const manifest = await loadFirstSliceContentKeyManifest();
  const eventFeedKeySet = await loadEventFeedMessageKeySet();

  const legacyAliasKeys = manifest.legacy_alias_mapping.flatMap((entry) => entry.legacy_keys);
  const missingLegacyAliasKeys = legacyAliasKeys.filter((key) => !eventFeedKeySet.has(key));

  assert.deepEqual(
    toUniqueSorted(missingLegacyAliasKeys),
    [],
    `Missing legacy alias keys in narrative event feed seed: ${toUniqueSorted(missingLegacyAliasKeys).join(", ")}`,
  );
});

test("first-slice content key manifest deferred seeded keys are excluded from default first-slice key selection", async () => {
  const manifest = await loadFirstSliceContentKeyManifest();
  const eventFeedKeySet = await loadEventFeedMessageKeySet();
  const defaultFirstSliceKeySet = new Set(
    manifest.default_first_slice_seed_usage.include_only_content_keys,
  );

  const deferredSeededKeys = manifest.deferred_post_slice_keys
    .filter((entry) => entry.present_in_event_feed_seed)
    .map((entry) => entry.key);

  const missingDeferredSeededKeys = deferredSeededKeys.filter((key) => !eventFeedKeySet.has(key));
  assert.deepEqual(
    toUniqueSorted(missingDeferredSeededKeys),
    [],
    `Manifest deferred seeded keys marked present_in_event_feed_seed=true are missing from narrative event feed seed: ${toUniqueSorted(missingDeferredSeededKeys).join(", ")}`,
  );

  const deferredKeysLeakingIntoDefaultSelection = deferredSeededKeys.filter((key) =>
    defaultFirstSliceKeySet.has(key)
  );
  assert.deepEqual(
    toUniqueSorted(deferredKeysLeakingIntoDefaultSelection),
    [],
    `Deferred seeded keys must not appear in default first-slice selection: ${toUniqueSorted(deferredKeysLeakingIntoDefaultSelection).join(", ")}`,
  );
});
