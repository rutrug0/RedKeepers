# First-Slice Release Gate Runner (M0)

This runbook defines the single-command local release-candidate gate pass for the first vertical slice.

## Scope Guard

- Runs only first-slice critical gates already in scope (`playable`, `quality`, `platform`, `hostile_token_contract`).
- Uses placeholder-friendly validation paths only.
- Does not introduce post-slice platform or content checks.

## Canonical Command

```powershell
python tools/first_slice_release_gate_runner.py
```

Optional output override:

```powershell
python tools/first_slice_release_gate_runner.py --output-dir coordination/runtime/first-slice-release-gate
```

## Deterministic Gate Order

1. `playable`: `python tools/rk_m0_0011_first_slice_loop_smoke.py`
2. `quality`: `python tools/orchestrator.py status`
3. `platform`: `python tools/platform_wrapper_prepare_smoke.py`
4. `hostile_token_contract`: `python tools/generate_first_slice_frontend_manifest_snapshot.py --output coordination/runtime/first-slice-release-gate/hostile-token-contract-snapshot.js`

The runner always executes in this order and exits non-zero if any gate is `FAIL`.

## Platform Gate Wrapper Commands

The `platform` gate command (`python tools/platform_wrapper_prepare_smoke.py`) is the canonical first-slice release-candidate prep entrypoint for platform lanes.

Deterministic platform stage order inside this command:

1. Refresh first-slice frontend manifest snapshot (`python tools/generate_first_slice_frontend_manifest_snapshot.py`)
2. Run Steam wrapper prepare (`scripts/wrapper_steam_tauri.ps1 -Mode prepare -CleanWeb`)
3. Run Android wrapper prepare (`scripts/wrapper_android_capacitor.ps1 -Mode prepare -CleanWeb`)

The command prints ordered per-stage status lines (`PASS`/`FAIL`/`SKIP`) and exits non-zero on stage failure.
Platform metadata/assets remain placeholder-only and replaceable per wrapper runbooks.

## Evidence Artifacts

- Gate evidence JSON: `coordination/runtime/first-slice-release-gate/release-gate-evidence.json`
- Gate evidence Markdown: `coordination/runtime/first-slice-release-gate/release-gate-evidence.md`
- Release-readiness checklist: `coordination/runtime/first-slice-release-gate/release-readiness-checklist.md`
- Known issues: `coordination/runtime/first-slice-release-gate/known-issues.md`
- Per-gate logs:
  - `coordination/runtime/first-slice-release-gate/playable-gate.log`
  - `coordination/runtime/first-slice-release-gate/quality-gate.log`
  - `coordination/runtime/first-slice-release-gate/platform-gate.log`
  - `coordination/runtime/first-slice-release-gate/hostile-token-contract-gate.log`

The JSON artifact includes:
- gate-level `PASS`/`FAIL` status
- deterministic executed command list
- per-gate command, exit code, summary, and log path

The release-readiness checklist includes:
- explicit `PASS`/`FAIL`/`N/A` status rows for playable, scope, quality, platform, and release-readiness gates
- artifact references for each row back to deterministic gate evidence/log outputs

The known-issues artifact includes:
- one row per failing mandatory gate with `severity`/`owner` placeholders
- explicit `none` marker when all mandatory checklist gates pass
