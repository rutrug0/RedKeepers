from __future__ import annotations

import os
import shlex
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class WorkerResult:
    status: str
    summary: str
    stdout: str
    stderr: str
    exit_code: int
    tokens_in_est: int = 0
    tokens_out_est: int = 0
    blocker_reason: str | None = None


def _estimate_tokens(text: str) -> int:
    # Cheap heuristic suitable for local stats only.
    return max(1, len(text) // 4)


def run_agent(
    *,
    project_root: Path,
    agent_id: str,
    prompt: str,
    timeout_seconds: int = 900,
    dry_run: bool = False,
) -> WorkerResult:
    if dry_run:
        return WorkerResult(
            status="dry_run",
            summary=f"Dry-run only; would invoke Codex CLI for {agent_id}",
            stdout="",
            stderr="",
            exit_code=0,
            tokens_in_est=_estimate_tokens(prompt),
            tokens_out_est=0,
        )

    mode = os.environ.get("REDKEEPERS_WORKER_MODE", "").strip().lower()
    if mode == "mock":
        return WorkerResult(
            status="completed",
            summary=f"Mock worker completed task for {agent_id}",
            stdout="MOCK: completed",
            stderr="",
            exit_code=0,
            tokens_in_est=_estimate_tokens(prompt),
            tokens_out_est=300,
        )

    raw_command = os.environ.get("REDKEEPERS_CODEX_COMMAND", "codex exec")
    command = shlex.split(raw_command)
    try:
        proc = subprocess.run(
            command,
            input=prompt,
            text=True,
            capture_output=True,
            cwd=project_root,
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError as exc:
        return WorkerResult(
            status="failed",
            summary=f"Codex CLI command not found: {command[0]}",
            stdout="",
            stderr=str(exc),
            exit_code=127,
            tokens_in_est=_estimate_tokens(prompt),
            blocker_reason="Codex CLI not installed or REDKEEPERS_CODEX_COMMAND is invalid",
        )
    except subprocess.TimeoutExpired as exc:
        return WorkerResult(
            status="failed",
            summary=f"Worker timed out after {timeout_seconds}s",
            stdout=exc.stdout or "",
            stderr=exc.stderr or "",
            exit_code=124,
            tokens_in_est=_estimate_tokens(prompt),
            blocker_reason=f"Agent execution timeout ({timeout_seconds}s)",
        )

    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()
    summary = stdout.splitlines()[-1] if stdout else (stderr.splitlines()[-1] if stderr else "No output")
    status = "completed" if proc.returncode == 0 else "failed"
    lower_text = f"{stdout}\n{stderr}".lower()
    if "blocked" in lower_text:
        status = "blocked"
    return WorkerResult(
        status=status,
        summary=summary[:500],
        stdout=stdout,
        stderr=stderr,
        exit_code=proc.returncode,
        tokens_in_est=_estimate_tokens(prompt),
        tokens_out_est=_estimate_tokens(stdout),
        blocker_reason=summary[:500] if status == "blocked" else None,
    )

