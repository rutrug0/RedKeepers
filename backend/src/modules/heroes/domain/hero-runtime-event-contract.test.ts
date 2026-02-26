import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  assertHeroRuntimeEventConformsToTokenFixture,
  createDefaultHeroRuntimeSeedFilePathsV1,
  HeroRuntimeSeedValidationError,
  loadHeroRuntimeEventTokenSeedTableV1,
} from "../../../app/config/seeds/v1/hero-runtime-seed-loaders";
import {
  createHeroAbilityActivatedRuntimeEvent,
  createHeroAssignedRuntimeEvent,
  createHeroCooldownCompleteRuntimeEvent,
} from "./hero-runtime-event-contract";

test("hero runtime event contract emits token sets that conform to fixture declarations", async () => {
  const paths = createDefaultHeroRuntimeSeedFilePathsV1();
  const fixtureTable = await loadHeroRuntimeEventTokenSeedTableV1(paths.heroRuntimeEventTokens);

  const emittedEvents = [
    createHeroAssignedRuntimeEvent({
      hero_id: "hero_forge",
      assignment_context_type: "army",
      assignment_context_id: "army_42",
    }),
    createHeroAbilityActivatedRuntimeEvent({
      hero_id: "hero_forge",
      ability_id: "ability_iron_banner",
      assignment_context_type: "army",
      assignment_context_id: "army_42",
      cooldown_ends_at: "2026-02-26T12:14:00.000Z",
    }),
    createHeroCooldownCompleteRuntimeEvent({
      hero_id: "hero_forge",
      ability_id: "ability_iron_banner",
    }),
  ] as const;

  for (const event of emittedEvents) {
    assert.doesNotThrow(() => {
      assertHeroRuntimeEventConformsToTokenFixture(event, fixtureTable);
    });
  }
});

test("hero runtime event contract fixture validation rejects undeclared tokens", async () => {
  const paths = createDefaultHeroRuntimeSeedFilePathsV1();
  const fixtureTable = await loadHeroRuntimeEventTokenSeedTableV1(paths.heroRuntimeEventTokens);

  const invalidCooldownEvent = {
    content_key: "event.hero.cooldown_complete",
    tokens: {
      hero_id: "hero_rime",
      ability_id: "ability_cold_mark",
      cooldown_ends_at: "2026-02-26T13:00:00.000Z",
    },
  } as const;

  assert.throws(
    () => {
      assertHeroRuntimeEventConformsToTokenFixture(invalidCooldownEvent, fixtureTable);
    },
    (error) =>
      error instanceof HeroRuntimeSeedValidationError &&
      error.message.includes("Unexpected token 'cooldown_ends_at'"),
  );
});
