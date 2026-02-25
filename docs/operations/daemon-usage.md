# Daemon Usage

## Commands

- `python tools/orchestrator.py status` : show high-level daemon and queue status
- `python tools/orchestrator.py once --dry-run` : select next item without running an agent
- `python tools/orchestrator.py once` : process one item
- `python tools/orchestrator.py run` : run until queue is idle

## Environment Variables

- `REDKEEPERS_CODEX_COMMAND` : command used to invoke Codex CLI (default `codex exec`)
- `REDKEEPERS_WORKER_MODE=mock` : simulate successful agent runs for testing the daemon flow

## Output Philosophy

Default CLI output is intentionally high-level. Detailed subprocess output is only shown with `--verbose`.
