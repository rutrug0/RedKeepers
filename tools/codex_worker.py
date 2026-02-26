from __future__ import annotations

import os
import re
import shlex
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from python_runtime import enforce_python_environment

DEFAULT_CODEX_COMMAND = "codex exec"
_MODEL_ACCESS_PRECHECK_TIMEOUT_SECONDS = 20
_MODEL_ACCESS_PRECHECK_CACHE: dict[str, str | None] = {}


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
    for idx, part in enumerate(command):
        if part in {"-m", "--model"}:
            return True
        if part.startswith("--model="):
            return True
        if part.startswith("-m") and idx > 0 and len(part) > 2:
            # Handles compact form like `-mgpt-5-mini`.
            return True
    return False


def _with_model_arg(command: list[str], model: str | None) -> list[str]:
    resolved = list(command)
    if not model or _command_has_model_flag(resolved):
        return resolved
    return [*resolved, "--model", model]


def _without_model_arg(command: list[str]) -> list[str]:
    out: list[str] = []
    skip_next = False
    for part in command:
        if skip_next:
            skip_next = False
            continue
        if part in {"-m", "--model"}:
            skip_next = True
            continue
        if part.startswith("--model="):
            continue
        if part.startswith("-m") and len(part) > 2:
            continue
        out.append(part)
    return out


def _normalize_model_name(model: str | None) -> str | None:
    if not model:
        return None
    text = model.strip()
    if not text:
        return None
    if text.lower() in {"auto", "default", "none", "null"}:
        return None
    # Codex/API model IDs are typically lowercase. Normalize display-style names
    # (e.g. "GPT-5.3-Codex-Spark") to improve compatibility.
    if " " not in text:
        return text.lower()
    return text


def _extract_model_access_error(stdout: str, stderr: str) -> str | None:
    text = f"{stdout}\n{stderr}".strip()
    if not text:
        return None

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines:
        if _looks_like_model_access_error(line, ""):
            return line

    lowered = text.lower()
    signals = (
        "not supported",
        "does not have access",
        "not authorized",
        "not enabled",
        "permission denied",
        "model is unavailable",
        "unsupported model",
    )
    for line in lines:
        candidate = line.lower()
        if "model" in candidate and any(signal in candidate for signal in signals):
            return line

    if "model" in lowered:
        return lines[0]
    return None


def codex_model_access_preflight_error(model: str) -> str | None:
    normalized_model = _normalize_model_name(model)
    if not normalized_model:
        return None
    if normalized_model in _MODEL_ACCESS_PRECHECK_CACHE:
        return _MODEL_ACCESS_PRECHECK_CACHE[normalized_model]

    mode = os.environ.get("REDKEEPERS_WORKER_MODE", "").strip().lower()
    if mode == "mock":
        _MODEL_ACCESS_PRECHECK_CACHE[normalized_model] = None
        return None

    raw_command = os.environ.get("REDKEEPERS_CODEX_COMMAND", DEFAULT_CODEX_COMMAND)
    command, command_error = _parse_and_resolve_codex_command(raw_command)
    if command_error:
        _MODEL_ACCESS_PRECHECK_CACHE[normalized_model] = command_error
        return command_error

    env_for_worker, _python_command, _python_executable = enforce_python_environment(
        root=Path(__file__).resolve().parents[1]
    )
    probe_command = _with_model_arg(_without_model_arg(command), normalized_model)
    proc, immediate_error = _execute_codex(
        command=probe_command,
        prompt="Health check: report ok.",
        project_root=Path(__file__).resolve().parents[1],
        timeout_seconds=_MODEL_ACCESS_PRECHECK_TIMEOUT_SECONDS,
        tokens_in_est=_estimate_tokens("Health check"),
        env=env_for_worker,
    )
    if immediate_error is not None:
        immediate_error.requested_model = model
        immediate_error.used_model = normalized_model
        _MODEL_ACCESS_PRECHECK_CACHE[normalized_model] = immediate_error.summary
        return immediate_error.summary

    assert proc is not None
    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()
    if proc.returncode != 0 and _looks_like_model_access_error(stdout, stderr):
        reason = _extract_model_access_error(stdout, stderr)
        if reason is None:
            reason = f"Model '{normalized_model}' is not accessible with the current Codex account."
        _MODEL_ACCESS_PRECHECK_CACHE[normalized_model] = reason
        return reason

    _MODEL_ACCESS_PRECHECK_CACHE[normalized_model] = None
    return None


def _looks_like_model_access_error(stdout: str, stderr: str) -> bool:
    text = f"{stdout}\n{stderr}".lower()
    if "model" not in text:
        return False

    strong_signals = (
        "unknown model",
        "invalid model",
        "unsupported model",
        "not supported when using codex with a chatgpt account",
        "model is not supported",
        "not supported with a chatgpt account",
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
    env: dict[str, str] | None = None,
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
            env=env,
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
    timeout_seconds: int = 900,
    dry_run: bool = False,
) -> WorkerResult:
    requested_model = (model or "").strip() or None
    selected_model = _normalize_model_name(requested_model)
    force_default_model = os.environ.get("REDKEEPERS_USE_DEFAULT_MODEL", "").strip().lower() in {"1", "true", "yes", "on"}

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
            used_model=selected_model,
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
            used_model=selected_model,
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
            used_model=selected_model,
        )

    if force_default_model:
        selected_model = None

    tokens_in_est = _estimate_tokens(prompt)
    used_model = selected_model
    env_for_worker, _python_command, _python_executable = enforce_python_environment(root=project_root)

    effective_command = _with_model_arg(command, selected_model)
    proc, immediate_error = _execute_codex(
        command=effective_command,
        prompt=prompt,
        project_root=project_root,
        timeout_seconds=timeout_seconds,
        tokens_in_est=tokens_in_est,
        env=env_for_worker,
    )
    if immediate_error is not None:
        immediate_error.requested_model = requested_model
        immediate_error.used_model = used_model
        return immediate_error

    assert proc is not None
    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()

    summary = stdout.splitlines()[-1] if stdout else (stderr.splitlines()[-1] if stderr else "No output")
    if force_default_model:
        summary = f"{summary} (default model forced by REDKEEPERS_USE_DEFAULT_MODEL)"
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
        fallback_used=False,
    )
