# M0 Hostile Settlement Combat Fixture Constants (First Slice)

This document defines the deterministic combat fixture contract for the first-slice hostile settlement attack loop.

Scope:
- in-slice: one-pass deterministic outcome + deterministic losses
- in-slice: one foreign settlement fixture profile
- deferred: rich combat systems (terrain, morale, abilities, crits, formations, randomness)

## Deterministic Outcome Rule

Attacker-side score:
- `attacker_strength = sum(unit_count * unit_attack)` across dispatched units

Defender-side score:
- `defender_strength = foreign_settlement_profile.defender_garrison_strength`

Comparison result (attacker perspective):
- `win` when `attacker_strength > defender_strength`
- `loss` when `attacker_strength < defender_strength`
- `tie` when `attacker_strength == defender_strength`

API outcome mapping for first-slice compatibility:
- `win -> combat_outcome=attacker_win`
- `loss -> combat_outcome=defender_win`
- `tie -> combat_outcome=defender_win` (defender-holds rule in v1)

## Loss Ratio Fixture Table (No Random Variance)

| Comparison result | attacker_loss_ratio | defender_loss_ratio | Notes |
| --- | --- | --- | --- |
| `win` | `0.25` | `1.00` | Attacker wins with partial losses; defender garrison wiped |
| `loss` | `1.00` | `0.20` | Attacker force wiped; defender takes chip damage |
| `tie` | `1.00` | `0.20` | Tie uses same deterministic ratios as `loss` in v1 |

Deterministic rounding and clamps:
- `attacker_unit_losses_by_id[unit_id] = min(unit_count, floor(unit_count * attacker_loss_ratio))`
- `defender_garrison_lost = min(defender_strength, floor(defender_strength * defender_loss_ratio))`
- remaining values clamp to `>= 0`

## Deterministic Fixture Scenarios (Contract Tests)

| fixture_id | attacker_strength | defender_strength | comparison_result | api_combat_outcome | attacker_loss_ratio | defender_loss_ratio |
| --- | --- | --- | --- | --- | --- | --- |
| `attack_fixture_attacker_win_50v40` | `50` | `40` | `win` | `attacker_win` | `0.25` | `1.00` |
| `attack_fixture_attacker_loss_30v40` | `30` | `40` | `loss` | `defender_win` | `1.00` | `0.20` |
| `attack_fixture_tie_40v40` | `40` | `40` | `tie` | `defender_win` | `1.00` | `0.20` |

## Foreign Settlement Fixture Profile (Required M0 Profile)

Profile ID: `foreign_settlement_profile_v1_ruin_holdfast`

| Field | Value |
| --- | --- |
| `settlement_id` | `settlement_hostile` |
| `settlement_name` | `Ruin Holdfast` |
| `target_tile_label` | `Ruin Holdfast` |
| `owner_type` | `foreign_placeholder` |
| `owner_faction_id` | `cinder_breaker_raiders` |
| `map_x` | `2` |
| `map_y` | `1` |
| `defender_garrison_strength` | `40` |
| `slice_status` | `playable_now` |

Notes:
- `map_x/map_y` pair supports deterministic movement ETA and path checks.
- `defender_garrison_strength` is the single authoritative defender score input for first-slice combat resolution.

## Retention Rationale (First-Slice Combat Loop)

- Next 1-5 minute player goal: send one attack and immediately understand whether the force was strong enough.
- Session-level goal: learn reliable strength thresholds for one hostile target and adjust unit counts for the next march.
- Return hook: come back after training completes to retry with improved odds and see a better outcome.

Satisfaction and churn-risk checks:
- Action -> feedback -> progress delta remains legible (`dispatch -> outcome event -> survivors/losses`).
- Deterministic tie-to-defender rule avoids opaque outcomes and reduces confusion.
- Main churn risk is perceived unfairness on near-even fights; mitigation is explicit tie handling + stable loss ratios visible in combat reports.

## Explicit Post-Slice Deferrals

Deferred until after first-slice gate PASS:
- terrain/biome combat modifiers
- unit class counters and formation rows
- hero modifiers and abilities
- morale/fatigue systems
- random variance/crit rolls
- multi-leg or reinforcement combat
