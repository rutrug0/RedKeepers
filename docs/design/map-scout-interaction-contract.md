# M0 Map Scout-Select Interaction Contract

## Scope

This contract covers a single first-slice map interaction: **select a tile -> run scout outcome handling**.

- No new map mechanics are introduced in this slice.
- Tile labels, action labels, and event prose are placeholders and may be replaced later.
- The contract is intentionally small and table-driven for backend/frontend stability.

## Flow: `world_map.scout_select_v1`

1. Player selects a map tile in `worldMap` view.
2. Client sends `POST /world-map/tiles/{tileId}/interact` with:
   - `settlement_id`
   - `tile_id`
   - `interaction_type: "scout"`
   - `flow_version: "v1"`
3. Backend resolves tile outcome to **one** `outcome_code`.
4. Backend emits one placeholder event-feed key for the client to render.
5. Tile state is updated only within these three values for slice stability.

## Stable Tile State Contract (3 states)

| tile_state | Meaning | Client behavior |
| --- | --- | --- |
| `tile_state_unknown` | Tile has never completed a scout check | Show as unrevealed/blocked style tile until interaction returns a mapped outcome |
| `tile_state_quiet` | Tile cleared by a placeholder scout check | Show as neutral/quiet tile and allow repeat inspect/select |
| `tile_state_hostile_hint` | Tile carries a hostile movement signal | Show as threat tile and allow repeat inspect/select |

## Stable Interaction Outcome Contract (3 outcomes)

| interaction_outcome | Meaning | Event/feed key to publish | Required tokens |
| --- | --- | --- | --- |
| `outcome_scout_dispatched` | The flow has started and produced an immediate scout action result for an unknown tile | `event.world.scout_dispatched` | `settlement_name`, `target_tile_label` |
| `outcome_scout_report_empty` | Placeholder scout report: no active host | `event.world.scout_report_empty` | `target_tile_label` |
| `outcome_scout_report_hostile` | Placeholder scout report: hostile movement/signature seen | `event.world.scout_report_hostile` | `target_tile_label`, `hostile_force_estimate` |

## State-to-Outcome Mapping

For `world_map.scout_select_v1`, backend returns exactly one outcome from the table above:

- `tile_state_unknown` -> `outcome_scout_dispatched` (with subsequent contract-consistent state update to either `tile_state_quiet` or `tile_state_hostile_hint` if needed by slice implementation)
- `tile_state_quiet` -> `outcome_scout_report_empty`
- `tile_state_hostile_hint` -> `outcome_scout_report_hostile`

## Response Shape (M0-safe)

```json
{
  "flow": "world_map.scout_select_v1",
  "tile_id": "string",
  "tile_state": "tile_state_unknown | tile_state_quiet | tile_state_hostile_hint",
  "interaction_outcome": "outcome_scout_dispatched | outcome_scout_report_empty | outcome_scout_report_hostile",
  "event": {
    "content_key": "event.world.scout_dispatched | event.world.scout_report_empty | event.world.scout_report_hostile",
    "tokens": {
      "settlement_name": "string",
      "target_tile_label": "string",
      "hostile_force_estimate": "string"
    }
  },
  "tile_revision": 0
}
```

Notes:
- `event` is always present and may carry placeholder-only values.
- `hostile_force_estimate` is required only for `outcome_scout_report_hostile`.
- Any additional fields must remain additive and not rename existing keys.

