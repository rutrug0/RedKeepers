# M2 Hero Units Prototype Concept (Deferred)

Status: Deferred. Not queueable during M0/M1 first-slice delivery.

Related backlog item: `RK-AUTO-BACKLOG-0003-F01`

## Scope Gate (Hard)

- This document is design-only and does not authorize implementation.
- Hero work stays unqueued until first vertical slice sign-off is complete in `docs/design/vertical-slice-done-v1.md`.
- Queue condition for hero prototype work:
  - Playable Loop Gate: PASS
  - Scope Gate: PASS
  - Quality Gate: PASS
  - Platform Gate: PASS
  - Release Readiness Gate: PASS

## Prototype Boundaries (M2)

- Keep heroes inside shared combat/logistics systems (no civilization-exclusive core mechanics).
- One hero profile per civilization for first prototype pass.
- One active ability per hero, expressed with shared numeric modifier templates.
- No hero gear system, no talent tree, no hero-only resource, no bespoke battle mode in prototype pass.
- Unlock heroes only after core settlement loop mastery (post-onboarding progression milestone), not in first-session flow.

## Civilization Hero Ability Draft (Stat-Driven)

| Civilization | Hero ID | Active Ability | Shared Effect Template (Initial) | Cooldown Target |
| --- | --- | --- | --- | --- |
| Cinder Throne Legates | `hero_legion_prefect` | Iron Mandate | Army attack +12% and morale loss reduction +15% for first 90s of battle | 6h |
| Mirebound Covenant | `hero_fen_oracle` | Rotwrit Veil | Scout visibility radius +1 for next scouting action and ambush chance +10% on first contact | 8h |
| Graveforge Clans | `hero_ashen_smith` | Anvil Oath | Siege durability +18% and march speed penalty reduction +8% for next siege march | 8h |

## Minimum Onboarding/Tutorial Impact

- No hero prompts in the first-slice tutorial path.
- At unlock, add only two short guidance steps:
  - Step 1: "Assign hero to army" contextual tooltip in dispatch panel.
  - Step 2: "Use one active ability" contextual tooltip with cooldown explanation.
- Success criteria for minimal impact:
  - New player can ignore heroes and still complete core session goals.
  - Hero tutorial adds <=2 minutes to first hero session.
  - No new mandatory glossary/tutorial branch in M0/M1.

## Required UI Surface Changes (Post-Slice Only)

- Settlement/army UI:
  - Hero roster card (portrait placeholder, civilization badge, readiness/cooldown state).
  - Assign/unassign control in army dispatch modal.
- Dispatch/combat intent UI:
  - Single active ability slot with enabled/disabled states and short effect text.
- Feedback UI:
  - Event feed entries for `hero_assigned`, `hero_ability_activated`, `hero_ability_cooldown_complete`.
  - Combat report row showing hero impact deltas (modifier summary only).

## Retention Check

Motivation:
- Next 1-5 minutes: assign hero and trigger one ability for a visible combat/scout advantage.
- Session goal: plan one stronger action window around cooldown timing.
- Return hook: come back when cooldown completes to execute another high-impact timed action.

Satisfaction:
- Action -> feedback -> progress delta remains legible through immediate event feed/combat report updates.
- Failures should teach timing and target selection, not hidden rules.
- Progress is visible via readiness state, cooldown countdown, and outcome deltas.

Retention risk and mitigation:
- Risk: cooldown-only waiting feels like dead time.
  - Mitigation: set first-use tutorial reward and align cooldowns with existing build/train cadence windows.
- Risk: hero power feels unfair or opaque.
  - Mitigation: keep effects numeric, short, and visible before commit in dispatch UI.
- Risk: onboarding overload.
  - Mitigation: hero unlock after core loop mastery; no early mandatory hero steps.

## Deferred Follow-Up Hooks

- Add hero progression tiers only after prototype clarity and balance validation.
- Add second active ability slot only if first slot shows stable comprehension and retention uplift.
