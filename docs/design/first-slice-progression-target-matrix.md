# RK-M0-0014 First-Slice Progression Target Matrix (15m / 30m / 60m)

## Scope lock

- In-scope caps for M0 first slice:
  - 1 settlement
  - 3-4 core resources (`food`, `wood`, `stone`, `iron`)
  - 4-6 buildings in the active playable set
  - 3-5 units in the active playable set
- Enforced mechanism rule:
  - Civilization variation is stat/timing-based only (no new core mechanics)
  - Hero units remain out of scope
- Deferred from this slice:
  - Additional settlement ownership/expansion loops
  - Post-slice building families (`granary`, `warehouse`, `palisade`, `watchtower`, `guardhouse`) and extra world-map systems
  - Full PvP combat and raids
  - Advanced scout workflows beyond `world_map.scout_select_v1`

## 15m / 30m / 60m progression windows

All windows are measured from settlement creation (`t=0`) with a single settlement and single queues.

| Window | Resource stabilization target | First building upgrade target | First unit training target | Scout interaction target | Pass / fail bounds |
| --- | --- | --- | --- | --- | --- |
| 15m | All four core resources remain `>= 0` and `<= base_storage_cap` at all sampled points. No more than one resource can be below `10` at any sample. | First upgrade to level 2 completes by `<= 15m` and is a playable family (`economy`/`military`/`logistics`). | None required yet; zero units is acceptable. | 1 successful call to `world_map.scout_select_v1` returns an allowed `interaction_outcome` (`outcome_scout_dispatched`, `outcome_scout_report_empty`, `outcome_scout_report_hostile`) and includes `event.content_key`. | PASS only if all 5 conditions hold. `FAIL` if any resource drops below 0 or first L2 upgrade is `> 15m`. |
| 30m | All four core resources remain `>= 10` and `<= base_storage_cap`. At least two resources should have non-negative 5m rolling delta (`delta_5m >= 0`) to show no full resource dead-zone. | By 30m, at least two core economy buildings should be level 2 or one economy L2 + one logistics/military L1. | Still acceptable to be pre-training; barracks can be in construction. | Continue to support at least one repeat scout check on a second tile (or same tile state transition path) with a valid allowed outcome and event key. | PASS only if all resource checks hold and the upgrade state matches the stated count. `FAIL` if no scout interaction by 30m or if `>= 3` resources are below `10`. |
| 60m | All resources remain within `[0, base_storage_cap]`, with at least 2 resources above `20` at snapshot time. No hard-cap saturation (`>= base_storage_cap`) should block normal flow. | Barracks is completed (`barracks.level >= 1`) or in the final production stage by 60m. | First playable-unit completion must happen by `<= 60m` (`watch_levy`, `bow_crew`, `trail_scout`, or `light_raider`). | At least one persisted scout event must be present in event feed with one of the three contract content keys. | PASS only if `first_unit_complete_time <= 60m`, scout event exists, and no resource check fails. `FAIL` if first unit completes after 60m or any resource is `< 0`/`>= base_storage_cap`. |

## QA assertion recipe

- Use one deterministic 15m/30m/60m progression snapshot profile.
- Assert each row in order against:
  - `economy` resource stocks and storage caps
  - building queue states + levels (`grain_plot`, `timber_camp`, `stone_quarry`, `iron_pit`, `barracks`, `rally_post`)
  - unit queue state + completed unit list
  - scout interaction response shape from `map-scout-interaction-contract.md`
- Any violation within the matrix is a release-blocking mismatch for M0 smoke checks.
