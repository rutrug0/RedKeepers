from __future__ import annotations

import os
import re
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
    requested_model: str | None = None
    used_model: str | None = None
    fallback_used: bool = False


def _estimate_tokens(text: str) -> int:
    # Cheap heuristic suitable for local stats only.
    return max(1, len(text) // 4)


def _detect_blocked_output(stdout: str, stderr: str) -> bool:
    """Return True only for explicit blocked markers, not incidental words."""
    text = f"{stdout}\n{stderr}"
    lines = [line.strip().lower() for line in text.splitlines() if line.strip()]
    if not lines:
        return False

    explicit_prefixes = (
        "status: blocked",
        "result: blocked",
        "blocked:",
        "blocker:",
        "blockers:",
        "[blocked]",
    )
    return any(any(line.startswith(prefix) for prefix in explicit_prefixes) for line in lines)


def _detect_noop_completion_output(stdout: str, stderr: str) -> bool:
    """Detect successful 'nothing to change' outcomes and treat them as completed."""
    text = f"{stdout}\n{stderr}".lower()
    phrases = (
        "no changes were made",
        "no changes made",
        "no additional changes",
        "no additional edits",
        "required no additional edits",
        "nothing to change",
        "already implemented",
        "already documented",
        "already present",
        "already covered",
        "already satisfies",
        "already satisfied",
        "no code changes were necessary",
        "no file changes were necessary",
    )
    return any(phrase in text for phrase in phrases)


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


def _command_has_model_flag(command: list[str]) -> bool:
    return any(part in {"-m", "--model"} for part in command)


def _with_model_arg(command: list[str], model: str | None) -> list[str]:
    resolved = list(command)
    if not model or _command_has_model_flag(resolved):
        return resolved
    return [*resolved, "--model", model]


def _looks_like_model_access_error(stdout: str, stderr: str) -> bool:
    text = f"{stdout}\n{stderr}".lower()
    if "model" not in text:
        return False

    strong_signals = (
        "unknown model",
        "invalid model",
        "unsupported model",
        "does not have access",
        "not authorized",
        "not enabled",
        "permission denied",
        "unavailable model",
        "model is unavailable",
        "invalid_request_error",
    )
    if any(signal in text for signal in strong_signals):
        return True

    if "model metadata" in text:
        # Metadata warnings can appear independently of authorization/availability.
        return False

    return bool(re.search(r"model[^\n\r]{0,80}not found", text))


def _execute_codex(
    *,
    command: list[str],
    prompt: str,
    project_root: Path,
    timeout_seconds: int,
    tokens_in_est: int,
) -> tuple[subprocess.CompletedProcess[str] | None, WorkerResult | None]:
    try:
        proc = subprocess.run(
            command,
            input=prompt,
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            cwd=project_root,
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError as exc:
        return None, WorkerResult(
            status="failed",
            summary=f"Codex CLI command not found: {command[0]} (check REDKEEPERS_CODEX_COMMAND)",
            stdout="",
            stderr=str(exc),
            exit_code=127,
            tokens_in_est=tokens_in_est,
            blocker_reason=f"Codex CLI not installed or REDKEEPERS_CODEX_COMMAND is invalid. {_codex_override_hint()}",
        )
    except subprocess.TimeoutExpired as exc:
        return None, WorkerResult(
            status="failed",
            summary=f"Worker timed out after {timeout_seconds}s",
            stdout=exc.stdout or "",
            stderr=exc.stderr or "",
            exit_code=124,
            tokens_in_est=tokens_in_est,
            blocker_reason=f"Agent execution timeout ({timeout_seconds}s)",
        )
    return proc, None


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
    model: str | None = None,
    fallback_model: str | None = None,
    timeout_seconds: int = 900,
    dry_run: bool = False,
) -> WorkerResult:
    requested_model = (model or "").strip() or None
    fallback_model_clean = (fallback_model or "").strip() or None

    if dry_run:
        return WorkerResult(
            status="dry_run",
            summary=f"Dry-run only; would invoke Codex CLI for {agent_id}",
            stdout="",
            stderr="",
            exit_code=0,
            tokens_in_est=_estimate_tokens(prompt),
            tokens_out_est=0,
            requested_model=requested_model,
            used_model=requested_model,
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
            requested_model=requested_model,
            used_model=requested_model,
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
            requested_model=requested_model,
            used_model=requested_model,
        )

    tokens_in_est = _estimate_tokens(prompt)
    selected_model = requested_model
    used_model = requested_model
    fallback_used = False

    effective_command = _with_model_arg(command, selected_model)
    proc, immediate_error = _execute_codex(
        command=effective_command,
        prompt=prompt,
        project_root=project_root,
        timeout_seconds=timeout_seconds,
        tokens_in_est=tokens_in_est,
    )
    if immediate_error is not None:
        immediate_error.requested_model = requested_model
        immediate_error.used_model = used_model
        return immediate_error

    assert proc is not None
    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()

    can_retry_with_fallback = (
        proc.returncode != 0
        and selected_model is not None
        and fallback_model_clean is not None
        and fallback_model_clean != selected_model
        and _looks_like_model_access_error(stdout, stderr)
    )
    if can_retry_with_fallback:
        retry_command = _with_model_arg(command, fallback_model_clean)
        retry_proc, retry_error = _execute_codex(
            command=retry_command,
            prompt=prompt,
            project_root=project_root,
            timeout_seconds=timeout_seconds,
            tokens_in_est=tokens_in_est,
        )
        if retry_error is not None:
            retry_error.requested_model = requested_model
            retry_error.used_model = fallback_model_clean
            retry_error.fallback_used = True
            return retry_error
        if retry_proc is not None:
            proc = retry_proc
            stdout = (proc.stdout or "").strip()
            stderr = (proc.stderr or "").strip()
            used_model = fallback_model_clean
            fallback_used = True

    summary = stdout.splitlines()[-1] if stdout else (stderr.splitlines()[-1] if stderr else "No output")
    if fallback_used:
        summary = f"{summary} (fallback model used: {used_model})"
    status = "completed" if proc.returncode == 0 else "failed"
    if _detect_blocked_output(stdout, stderr):
        status = "blocked"
        if proc.returncode == 0 and _detect_noop_completion_output(stdout, stderr):
            status = "completed"
    return WorkerResult(
        status=status,
        summary=summary[:500],
        stdout=stdout,
        stderr=stderr,
        exit_code=proc.returncode,
        tokens_in_est=_estimate_tokens(prompt),
        tokens_out_est=_estimate_tokens(stdout),
        blocker_reason=summary[:500] if status == "blocked" else None,
        requested_model=requested_model,
        used_model=used_model,
        fallback_used=fallback_used,
    )
