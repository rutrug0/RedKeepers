# First-Slice Release Gate Runner (M0)

This runbook defines the single-command local release-candidate gate pass for the first vertical slice.

## Scope Guard

- Runs only first-slice critical gates already in scope (`playable`, `quality`, `platform`).
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

The runner always executes in this order and exits non-zero if any gate is `FAIL`.

## Evidence Artifacts

- Gate evidence JSON: `coordination/runtime/first-slice-release-gate/release-gate-evidence.json`
- Gate evidence Markdown: `coordination/runtime/first-slice-release-gate/release-gate-evidence.md`
- Per-gate logs:
  - `coordination/runtime/first-slice-release-gate/playable-gate.log`
  - `coordination/runtime/first-slice-release-gate/quality-gate.log`
  - `coordination/runtime/first-slice-release-gate/platform-gate.log`

The JSON artifact includes:
- gate-level `PASS`/`FAIL` status
- deterministic executed command list
- per-gate command, exit code, summary, and log path
