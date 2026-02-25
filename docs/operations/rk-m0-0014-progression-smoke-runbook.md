# RK-M0-0014 Progression Smoke Snapshot Runbook

## Purpose

This runbook defines how RK-M0-0014 smoke checks consume progression snapshot data and how to refresh that input when seed values change.

## Snapshot artifact contract

Smoke tests resolve profile input in this order:

1. `RK_M0_0014_PROGRESSION_PROFILE` if set.
2. `coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json` when present.
3. `tests/fixtures/rk-m0-0014-progression-profile.json` only as fallback.

Expected generated artifact path (CI/default progression run output):

- `coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json`

The artifact must be JSON with the shape expected by:

- `tests/fixtures/rk-m0-0014-progression-profile.json`
- `tests/test_m0_0014_progression_smoke.py`

Required top-level keys:

- `settlement_snapshots`
- `event_scout_snapshots`
- optional: `building_upgrades`, `buildings`, `unit_completions`

## CI smoke command

Set the profile artifact path via environment variable:

```powershell
$env:RK_M0_0014_PROGRESSION_PROFILE = 'coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json'
python -m unittest tests.test_m0_0014_progression_smoke
```

```bash
RK_M0_0014_PROGRESSION_PROFILE=coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json python -m unittest tests.test_m0_0014_progression_smoke
```

```cmd
set "RK_M0_0014_PROGRESSION_PROFILE=coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json" && python -m unittest tests.test_m0_0014_progression_smoke
```

This keeps the fixture source separated from generated CI input and ensures smoke gates validate the same artifact used by progression run automation.

## Regenerating snapshot inputs

When simulation seeds change:

1. Re-run the deterministic first-slice progression snapshot pipeline used by your automation lane so it emits a fresh `rk-m0-0014-progression-profile.json`.
2. Place the emitted artifact at:
   - `coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json`
3. Re-run smoke against that artifact:
   - `set "RK_M0_0014_PROGRESSION_PROFILE=coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json" && python -m unittest tests.test_m0_0014_progression_smoke`
4. Refresh `tests/fixtures/rk-m0-0014-progression-profile.json` only when intentional fallback parity is required for local/offline execution.
5. If pipeline output location changes, update `PIPELINE_PROFILE_PATH` in `tests/test_m0_0014_progression_smoke.py` and this runbook in the same change.
