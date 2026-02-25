# Daemon Usage

## Commands

- `python tools/orchestrator.py status` : show high-level daemon and queue status
- `python tools/orchestrator.py once --dry-run` : select next item without running an agent
- `python tools/orchestrator.py once` : process one item
- `python tools/orchestrator.py run` : persistent daemon mode (keeps polling for new/unblocked work)
- `python tools/orchestrator.py run --until-idle` : exit when queue becomes idle or stalled (one-shot queue drain mode)
- `python tools/smoke_daemon_env.py` : read-only smoke validation for queue/policy/state files
- `python tools/render_stats_html.py` : generate runtime dashboard HTML (global + per-session agent/model stats + backlog section)
- `python tools/frontend_visual_smoke.py` : run multi-device frontend screenshot smoke checks (see `docs/operations/frontend-visual-qa.md`)

## Environment Variables

- `REDKEEPERS_CODEX_COMMAND` : command used to invoke Codex CLI (default `codex exec`)
- `REDKEEPERS_WORKER_MODE=mock` : simulate successful agent runs for testing the daemon flow
- `REDKEEPERS_ENABLE_FRONTEND_VISUAL_QA=1|0` : runtime override for frontend visual QA validation gate (policy default is enabled)
- `REDKEEPERS_PYTHON_CMD` : force validation command launcher (example: `py`)
- `REDKEEPERS_USE_DEFAULT_MODEL=1` : do not pin `--model` in worker calls; use the Codex account default model (recommended when account/model entitlement differs from policy)
- `REDKEEPERS_AGENT_HEARTBEAT_SECONDS` : override heartbeat interval (default `60`, minimum `5`)
- `REDKEEPERS_COLOR_LOGS=auto|1|0` : colorize daemon event output (`auto` uses TTY detection; `NO_COLOR` disables colors)

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

## Blocked Work Revisit

The daemon can automatically re-queue recoverable blocked items using `coordination/policies/retry-policy.yaml` `blocked_revisit` settings (cooldown, per-cycle cap, reason include/exclude patterns). This is intended for transient blockers like model-access/config incidents while keeping audit-only blocked artifacts untouched.

When the `platform` agent exists but no platform/release items exist in active/completed/blocked backlog, daemon also seeds a one-time `platform_bootstrap` queued item so cross-platform delivery work is represented in the lane.

## Scheduling Priority Notes

Routing supports dependency-unlock prioritization via `coordination/policies/routing-rules.yaml` `dependency_unlock_priority`:
- boosts queued tasks that unlock downstream queued work,
- prefers immediate unlocks by default,
- keeps `critical` priority protected from being overtaken.

## Human Inbox Workflow

Use `Human/` as a direct operator inbox:
- Drop an instruction file (for example `Human/2026-02-25-request.md`).
- Daemon inspects `Human/` first and creates a critical `lead` triage work item per new file.
- Lead decomposes the instruction into concrete backlog tasks for team lanes.
- After successful completion of that triage item, daemon deletes the processed file.

## Monitoring Progress (PowerShell)

Live high-level event stream (daemon start/agent start/validation/completion/failure):

`Get-Content coordination\\runtime\\daemon-events.jsonl -Wait`

Current status snapshot on demand:

`python tools/orchestrator.py status`

Recent completed/failed runs:

`Get-Content coordination\\runtime\\run-history.jsonl | Select-Object -Last 20`

Queue and progress state:

- `coordination\\backlog\\work-items.json`
- `coordination\\backlog\\completed-items.json`
- `coordination\\backlog\\blocked-items.json`
- `coordination\\runtime\\progress-summary.json`
- `coordination\\runtime\\agent-stats.json`
- `coordination\\runtime\\model-stats.json`

Generate dashboard:

`python tools/render_stats_html.py --output coordination\\runtime\\stats-dashboard.html`

Optional explicit backlog inputs:

`python tools/render_stats_html.py --work-items coordination\\backlog\\work-items.json --completed-items coordination\\backlog\\completed-items.json --blocked-items coordination\\backlog\\blocked-items.json --output coordination\\runtime\\stats-dashboard.html`
