# Frontend Visual QA Automation

This project can run browser-based frontend visual smoke checks using Playwright.

## What It Covers

- Multi-device emulation (`desktop-1440`, `tablet-1024`, `mobile-390`, `mobile-360`)
- Screenshot capture per device
- Baseline diffing per device
- Layout guard (`horizontal overflow`)
- Basic panel-presence checks (`settlement`, `worldmap`, `event-feed`)

## Script

- `python tools/frontend_visual_smoke.py`

Outputs:

- Current screenshots: `coordination/runtime/frontend-visual/current/*.png`
- Baselines: `coordination/runtime/frontend-visual/baseline/*.png`
- Report: `coordination/runtime/frontend-visual/report.json`

## Setup (One-Time)

Install dependencies in your Python environment:

```powershell
python -m pip install playwright pillow
python -m playwright install chromium
```

## Baseline Workflow

1. Create/update baselines:

```powershell
python tools/frontend_visual_smoke.py --update-baseline --strict
```

2. Run validation against baseline:

```powershell
python tools/frontend_visual_smoke.py --strict --max-overflow-px 0 --max-diff-percent 0.5
```

## Daemon Integration (Optional Gate)

Daemon validation now auto-runs visual smoke checks for frontend-owned work items via `coordination/policies/commit-guard-rules.yaml` (`frontend_visual_qa.enabled=true`).

You can still override at runtime:

```powershell
$env:REDKEEPERS_ENABLE_FRONTEND_VISUAL_QA='1'   # force on
# or
$env:REDKEEPERS_ENABLE_FRONTEND_VISUAL_QA='0'   # force off
python tools/orchestrator.py run
```

The daemon will append:

- `python tools/frontend_visual_smoke.py --strict --max-overflow-px 0 --max-diff-percent 0.5`

to frontend validation commands.

## Python Launcher Note (`py` vs `python`)

Validation commands normalize `python`/`py` launchers to the active interpreter automatically.
If you want to force launcher style, set:

```powershell
$env:REDKEEPERS_PYTHON_CMD='py'
```
