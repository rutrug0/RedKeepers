# RK-M0-0014 Progression Smoke Snapshot Runbook

## Purpose

This runbook defines how RK-M0-0014 smoke checks consume progression snapshot data and how to refresh that input when seed values change.

## Snapshot artifact contract

Smoke tests resolve profile input in this order:

1. `RK_M0_0014_PROGRESSION_PROFILE` if set.
2. `coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json` when present.

Expected generated artifact path (CI/default progression run output):

- `coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json`

The artifact must be JSON with the shape expected by:

- `tests/fixtures/rk-m0-0014-progression-profile.json`
- `tests/test_m0_0014_progression_smoke.py`

Required top-level keys:

- `settlement_snapshots`
- `event_scout_snapshots`
- optional: `building_upgrades`, `buildings`, `unit_completions`

## Generator entry point

Use this deterministic generator to refresh the artifact after seed updates:

```powershell
python tools/rk_m0_0014_progression_profile.py
```

Equivalent wrapper:

```powershell
scripts/generate_rk_m0_0014_progression_profile.ps1
```

Default source for generation is the pipeline output:

- `coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.replay.json`

The generator does not accept a user-specified source path; it always reads this backend replay artifact.

Output is written deterministically to:

- `coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json`

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

1. Re-run the deterministic generator:
   `python tools/rk_m0_0014_progression_profile.py`
2. Place the emitted artifact at:
   - `coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json`
3. Re-run smoke against that artifact:
   - `set "RK_M0_0014_PROGRESSION_PROFILE=coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json" && python -m unittest tests.test_m0_0014_progression_smoke`
4. Refresh `tests/fixtures/rk-m0-0014-progression-profile.json` only when intentional fallback parity is required for local/offline execution.
5. If pipeline output location changes, update `DEFAULT_REPLAY_PROFILE_PATH` in `tools/rk_m0_0014_progression_profile.py`, `PIPELINE_PROFILE_PATH` in `tests/test_m0_0014_progression_smoke.py`, and this runbook in the same change.
