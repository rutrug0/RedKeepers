# Frontend Visual QA Automation

This project can run browser-based frontend visual smoke checks using Playwright.

## What It Covers

- Multi-device emulation (`desktop-1440`, `tablet-1024`, `mobile-390`, `mobile-360`)
- Screenshot capture per device
- Baseline diffing per device
- Layout guard (`horizontal overflow` on `document` and `.shell` container)
- Basic panel-presence checks (`settlement`, `worldmap`, `event-feed`)
- Keyboard smoke checks for region navigation activation (`ArrowRight` + `Enter`)
- Focus-visible assertions on representative controls (`.region-tab`, `.ghost-btn`/`.mock-state-btn`)
- Reduced-motion assertion that region navigation does not request `smooth` scrolling
- First-slice action feedback checks with deterministic transport stubs:
  - `build` success + failure (`event.build.success`, `event.build.failure_insufficient_resources`)
  - `train` success + failure (`event.train.success`, `event.train.failure_cooldown`)
  - `scout` success + failure (`event.scout.dispatched_success`, `event.scout.unavailable_tile`)

## Script

- `python tools/frontend_visual_smoke.py`

Outputs:

- Current screenshots: `coordination/runtime/frontend-visual/current/*.png`
- Baselines: `coordination/runtime/frontend-visual/baseline/*.png`
  - Shell (`/index.html`) keeps legacy names: `<device>.png`
  - Non-shell pages use page-scoped names: `<page-stem>--<device>.png`
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

Hero wireframe page validation example:

```powershell
python tools/frontend_visual_smoke.py --url http://127.0.0.1:4173/hero-wireframes.html --strict --max-overflow-px 0 --max-diff-percent 0.5
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

For stable daemon/agent behavior on Windows, prefer launching via `run-daemon.bat` and keep
`coordination/policies/runtime-policy.yaml` `python_command` aligned with the interpreter where
Playwright is installed.
