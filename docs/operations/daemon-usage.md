# Daemon Usage

## Commands

- `python tools/orchestrator.py status` : show high-level daemon and queue status
- `python tools/orchestrator.py once --dry-run` : select next item without running an agent
- `python tools/orchestrator.py once` : process one item
- `python tools/orchestrator.py run` : persistent daemon mode (keeps polling for new/unblocked work)
- `python tools/orchestrator.py run --until-idle` : exit when queue becomes idle or stalled (one-shot queue drain mode)
- `python tools/smoke_daemon_env.py` : read-only smoke validation for queue/policy/state files

## Environment Variables

- `REDKEEPERS_CODEX_COMMAND` : command used to invoke Codex CLI (default `codex exec`)
- `REDKEEPERS_WORKER_MODE=mock` : simulate successful agent runs for testing the daemon flow

## Smoke Validation (PowerShell)

Run the fuller read-only environment smoke checks (queue, policy, and state file parsing/types):

`python tools/smoke_daemon_env.py`

If Codex CLI is not installed yet and you only want repository/state validation, bypass Codex preflight for the smoke run:

`$env:REDKEEPERS_WORKER_MODE='mock'; python tools/smoke_daemon_env.py`

### Codex CLI Preflight (Windows npm shim note)

Daemon preflight validates the configured Codex command before queue work starts. `python tools/orchestrator.py status` also runs the same preflight so bootstrap issues are visible early.

On Windows, npm-installed CLIs are often exposed as `.cmd` shims. PowerShell may resolve `codex`, but Python `subprocess` can fail if the shim extension is omitted in some environments. RedKeepers now attempts Windows-compatible resolution (`.cmd`, `.exe`, `.bat`) during preflight and worker startup.

If preflight reports an unresolvable Codex command, override it explicitly:

`$env:REDKEEPERS_CODEX_COMMAND = 'codex.cmd exec'`

## Output Philosophy

Default CLI output is intentionally high-level. Detailed subprocess output is only shown with `--verbose`.

## Monitoring Progress (PowerShell)

Live high-level event stream (daemon start/agent start/validation/completion/failure):

`Get-Content coordination\\state\\daemon-events.jsonl -Wait`

Current status snapshot on demand:

`python tools/orchestrator.py status`

Recent completed/failed runs:

`Get-Content coordination\\state\\run-history.jsonl | Select-Object -Last 20`

Queue and progress state:

- `coordination\\backlog\\work-items.json`
- `coordination\\backlog\\completed-items.json`
- `coordination\\backlog\\blocked-items.json`
- `coordination\\state\\progress-summary.json`
- `coordination\\state\\agent-stats.json`
