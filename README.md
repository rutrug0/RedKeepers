# RedKeepers

RedKeepers is a web-first cross-platform MMORTS project (web, Steam, Android) developed by a serially scheduled autonomous AI agent team.

## Current Status

This repository is bootstrapped with the M0 orchestration foundation:
- Single-command Python head daemon (`tools/orchestrator.py`)
- Agent folders and role contracts
- JSON backlog/state/stats files
- Policy-driven routing/model/retry/commit guard configs
- Seed M0 and M1 work items

## Quick Start

1. Ensure Python 3.11+ is installed.
2. (Optional) Install Codex CLI and set `REDKEEPERS_CODEX_COMMAND` if needed.
3. Run `python tools/orchestrator.py status`
4. Run `python tools/orchestrator.py once --dry-run`
5. Run `python tools/orchestrator.py run` (or `scripts/run_daemon.ps1`)

## Notes

- The daemon is intentionally high-level in CLI output.
- Detailed run records are stored under `coordination/state/`.
- Direct commits to `main` are gated by daemon validation rules.

## Web Vertical Slice Packaging (M0)

- Build/package deterministic web artifact:
  - `python tools/web_vertical_slice_packaging.py package --clean`
- Run local smoke against packaged artifact:
  - `python tools/web_vertical_slice_packaging.py smoke`
- Runbook:
  - `docs/operations/web-vertical-slice-packaging.md`

## Steam Tauri Wrapper Packaging (M0)

- Standardized script entry point (recommended):
  - `scripts/wrapper_steam_tauri.ps1 -Mode package -CleanWeb`
- Standardized dev entry point:
  - `scripts/wrapper_steam_tauri.ps1 -Mode dev -CleanWeb`
- Canonical release-candidate prep (refreshes first-slice frontend manifest snapshot, then runs Steam + Android wrapper prepare in deterministic order):
  - `python tools/platform_wrapper_prepare_smoke.py`
- Legacy scripts and direct Python commands remain supported.
- Runbook:
  - `docs/operations/steam-tauri-wrapper-packaging.md`

## Android Capacitor Wrapper Packaging (M0)

- Standardized script entry point (recommended debug package):
  - `scripts/wrapper_android_capacitor.ps1 -Mode package -CleanWeb`
- Standardized script entry point (recommended release package):
  - `scripts/wrapper_android_capacitor.ps1 -Mode package-release -CleanWeb`
- Standardized dev entry point:
  - `scripts/wrapper_android_capacitor.ps1 -Mode dev -CleanWeb`
- Canonical release-candidate prep (refreshes first-slice frontend manifest snapshot, then runs Steam + Android wrapper prepare in deterministic order):
  - `python tools/platform_wrapper_prepare_smoke.py`
- Legacy scripts and direct Python commands remain supported.
- Runbook:
  - `docs/operations/android-capacitor-wrapper-packaging.md`

## First-Slice Release Gate (M0)

- Single-command local release candidate gate pass:
  - `python tools/first_slice_release_gate_runner.py`
- Emits compact gate evidence artifacts under:
  - `coordination/runtime/first-slice-release-gate/`
- Runbook:
  - `docs/operations/first-slice-release-gate.md`

## Local First-Slice Runtime Launcher (M0)

- Single-command backend + web shell runtime launcher:
  - `launch-local-game.bat`
- Optional explicit ports:
  - `launch-local-game.bat 8000 8787`
- Launcher behavior:
  - Refreshes `client-web/first-slice-manifest-snapshot.js` before startup.
  - Starts backend transport host lane plus web-shell lane with same-origin proxying for first-slice transport routes.
  - Prints lane status and deterministic first-session defaults (session settlement, hostile target settlement, world id) sourced from first-slice playable manifests.
