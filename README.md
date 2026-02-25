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

- Prepare wrapper web assets from packaged web artifact:
  - `python tools/steam_tauri_wrapper.py prepare --clean-web`
- Run local wrapper session:
  - `python tools/steam_tauri_wrapper.py dev`
- Build Windows wrapper package:
  - `python tools/steam_tauri_wrapper.py build`
- Runbook:
  - `docs/operations/steam-tauri-wrapper-packaging.md`

## Android Capacitor Wrapper Packaging (M0)

- Prepare wrapper web assets from packaged web artifact:
  - `python tools/android_capacitor_wrapper.py prepare --clean-web`
- Sync wrapper assets into Android project:
  - `python tools/android_capacitor_wrapper.py sync`
- Open Android project in configured IDE:
  - `python tools/android_capacitor_wrapper.py dev`
- Build Android debug wrapper package:
  - `python tools/android_capacitor_wrapper.py build-debug`
- Build Android release wrapper package:
  - `python tools/android_capacitor_wrapper.py build-release`
- Runbook:
  - `docs/operations/android-capacitor-wrapper-packaging.md`
