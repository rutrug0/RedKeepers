# Incident Recovery

## Lock Recovery

If the daemon crashes and leaves `coordination/state/daemon.lock`, verify no daemon process is running, then remove the lock file and restart.

## State Files

- `coordination/state/daemon-state.json`: current daemon status
- `coordination/state/progress-summary.json`: compact project progress view
- `coordination/state/agent-stats.json`: per-agent usage and workload metrics
- `coordination/state/run-history.jsonl`: append-only run outcomes

## Common Failures

- Missing policy/state files: run bootstrap script or restore from version control
- Codex CLI not found: set `REDKEEPERS_CODEX_COMMAND` or install Codex CLI
- Validation failure: inspect `run-history.jsonl` and requeue/escalation output
