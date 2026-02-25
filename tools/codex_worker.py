from __future__ import annotations

import os
import shlex
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DEFAULT_CODEX_COMMAND = "codex exec"


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


def _codex_override_hint() -> str:
    if os.name == "nt":
        return "Set REDKEEPERS_CODEX_COMMAND (Windows npm shim example: 'codex.cmd exec')."
    return "Set REDKEEPERS_CODEX_COMMAND to a valid Codex CLI command."


def _resolve_executable(command: list[str]) -> list[str]:
    if not command:
        return command
    resolved = list(command)
    exe = resolved[0]
    found = shutil.which(exe)
    if found:
        resolved[0] = found
        return resolved

    # On Windows, Python subprocess may not resolve npm .cmd shims when the
    # command is provided without an extension (e.g. "codex").
    if os.name == "nt" and "." not in Path(exe).name:
        for suffix in (".cmd", ".exe", ".bat"):
            found = shutil.which(exe + suffix)
            if found:
                resolved[0] = found
                return resolved
    return resolved


def _parse_and_resolve_codex_command(raw_command: str) -> tuple[list[str], str | None]:
    try:
        parsed = shlex.split(raw_command)
    except ValueError as exc:
        return [], f"invalid REDKEEPERS_CODEX_COMMAND={raw_command!r}: {exc}"
    if not parsed:
        return [], f"invalid REDKEEPERS_CODEX_COMMAND={raw_command!r}: empty command"
    return _resolve_executable(parsed), None


def codex_command_preflight_error() -> str | None:
    mode = os.environ.get("REDKEEPERS_WORKER_MODE", "").strip().lower()
    if mode == "mock":
        return None

    raw_command = os.environ.get("REDKEEPERS_CODEX_COMMAND", DEFAULT_CODEX_COMMAND)
    command, command_error = _parse_and_resolve_codex_command(raw_command)
    if command_error:
        return f"Codex command preflight failed: {command_error}. {_codex_override_hint()}"

    executable = command[0]
    if shutil.which(executable) or Path(executable).exists():
        return None

    return (
        "Codex command preflight failed: "
        f"could not resolve executable {executable!r} from REDKEEPERS_CODEX_COMMAND={raw_command!r}. "
        f"{_codex_override_hint()}"
    )


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

    raw_command = os.environ.get("REDKEEPERS_CODEX_COMMAND", DEFAULT_CODEX_COMMAND)
    command, command_error = _parse_and_resolve_codex_command(raw_command)
    if command_error:
        return WorkerResult(
            status="failed",
            summary="Invalid Codex CLI command configuration (check REDKEEPERS_CODEX_COMMAND)",
            stdout="",
            stderr=command_error,
            exit_code=127,
            tokens_in_est=_estimate_tokens(prompt),
            blocker_reason=f"{command_error}. {_codex_override_hint()}",
        )
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
            summary=f"Codex CLI command not found: {command[0]} (check REDKEEPERS_CODEX_COMMAND)",
            stdout="",
            stderr=str(exc),
            exit_code=127,
            tokens_in_est=_estimate_tokens(prompt),
            blocker_reason=f"Codex CLI not installed or REDKEEPERS_CODEX_COMMAND is invalid. {_codex_override_hint()}",
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
