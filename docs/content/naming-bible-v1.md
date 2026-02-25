# RedKeepers V1 Naming Bible (Placeholder)

Status: Replaceable placeholder naming guidance for M1. This is not final canon and may be replaced during later narrative/worldbuilding passes.

Sources aligned:
- `docs/design/game-vision.md`
- `docs/design/factions-and-civilizations.md`
- `docs/design/v1-starter-data-tables.md`
- `docs/design/first-vertical-slice.md`

## Purpose (M1 Scope)

Provide consistent placeholder naming rules for:
- civilization-facing flavor copy
- starter settlement names
- unit/building flavor labels
- event feed text tone

This bible supports the first vertical slice only and should avoid introducing new mechanics or lore systems.

## Tone Pillars

- Grim but functional: names should sound worn, disciplined, or harsh, not mythic-epic.
- Material and labor forward: ash, iron, reed, stone, tolls, forges, roads, pits, keeps.
- Political weight over prophecy: magistrates, clans, covenants, levies, wardens, tithe.
- Readable in UI: most labels should be 1-3 words and scan cleanly in tables/tooltips.
- Original setting voice: dark-fantasy atmosphere without direct borrowing from existing IP language.

## Anti-Derivative Guardrails

- Do not reuse or lightly respell names, houses, titles, regions, mottos, or signature phrases from known fantasy franchises.
- Avoid naming patterns that read as direct analogs to a specific work's dynasties, dragons, wall orders, or prophecy systems.
- Prefer concrete social/infrastructure terms over high-fantasy proper nouns (example direction: `Rally Post`, not ornate "ancient relic" naming).
- Keep invented words rare; when used, anchor them with plain nouns (`Mirewake Ford`, not multiple opaque fantasy syllables).
- Do not imply canon-only systems outside slice scope (heroes, divine pantheons, deep magic schools, alliance institutions).

## Naming Structure by Category

### Civilization Names (`civ_id`)

Use institution + domain/material + governing body/collective.

Patterns:
- `[Material/Region] + [Seat/Authority] + [Office/Collective]`
- `[Region] + [Binding/Doctrine] + [Collective]`
- `[Industry/Death/Stone] + [Craft/Forge] + [Kin/Clans]`

V1 anchors (already defined in design docs):
- `cinder_throne_legates`
- `mirebound_covenant`
- `graveforge_clans`

### Settlement Names (starter pool)

Use short, map-readable names that imply labor, roads, forts, crossings, marshworks, or quarries.

Recommended patterns:
- `[Harsh Material/Condition] + [Fortification/Crossing]` (`Ashgate`, `Cinder Ford`)
- `[Labor/Tax/Oath] + [Place Type]` (`Tithe Hollow`, `Levy Watch`)
- `[Wetland Feature] + [Light/Path/Keep]` (`Reedwake`, `Fen Lantern`)
- `[Stone/Forge/Clan] + [Pit/Hold/Cut]` (`Forgecut`, `Stone Tithe`)

Rules:
- Prefer 4-12 letters per token for readability on map labels.
- Allow occasional two-word names; avoid long multi-part constructions in the starter pool.
- Hyphens are optional but should be used sparingly.

### Military Labels (base and variant)

Base unit labels (`unit_id`) should stay functional and role-readable:
- Plain noun phrases (`Watch Levy`, `Trail Scout`)
- No hidden lore terms required to parse the role

Variant labels (`variant_unit_id`) can add faction voice while keeping role legible:
- `[Faction/Institution Descriptor] + [Role Noun]`
- Examples of safe structure: `Tribunal Crossmen`, `Bog Spearmen`, `Pit Guard`

Rules:
- Keep role noun recognizable (`Levies`, `Crossmen`, `Riders`, `Spearmen`, `Hounds`)
- Avoid over-decoration (no long honorific chains in unit labels)
- Maintain consistent pluralization in trainable unit labels

### Building Labels (`building_id`)

Buildings should use direct production/military/logistics language.

Patterns:
- `[Resource/Material] + [Site]` (`Iron Pit`, `Stone Quarry`)
- `[Military/Logistics Function] + [Post/Hall/Yard]` (`Rally Post`, `Barracks`)

Rules:
- Favor clarity over flavor for base `display_name`
- Flavor can appear in tooltips/event text instead of replacing core UI labels

## Faction Lexicon Seeds (Placeholder)

These are tone seeds, not mandatory dictionaries.

### `cinder_throne_legates`

Use:
- ash, cinder, brand, tribunal, levy, ward, road, ration, kiln, garrison, magistrate, toll

Avoid overuse of:
- imperial/empire/caesar-like language (too on-the-nose)

### `mirebound_covenant`

Use:
- mire, fen, reed, rot, drowned, silt, hush, stalk, lantern, bog, sluice, moss

Avoid overuse of:
- overt plague clichés and comedy-gross phrasing

### `graveforge_clans`

Use:
- grave, forge, clan, pit, chain, slag, quarry, anvil, tithe, oath, blackiron, hold

Avoid overuse of:
- dwarf-coded stereotypes or tavern-fantasy slang

## UI/Content Integration Rules (Placeholder Pack)

- Every reusable text entry should include a stable identifier (`civ_id`, `building_id`, `unit_id`, `variant_unit_id`, `resource_id`, or category key) when applicable.
- Event feed strings should be templates with tokens (example: `{settlement_name}`) rather than one-off prose.
- Placeholder text may be replaced later without changing IDs or event keys.
- First-slice implementations should prioritize `cinder_throne_legates` rows and treat other civ content as dormant flavor stubs if the UI is locked.

