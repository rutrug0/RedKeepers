from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from codex_worker import (
    codex_command_preflight_error,
    codex_model_access_preflight_error,
)
from git_guard import _normalize_validation_command
from python_runtime import resolve_python_executable
from schemas import load_json, load_yaml_like, validate_work_items


def _validate_json_list(
    *,
    errors: list[str],
    path: Path,
    label: str,
    validate_items: bool = False,
) -> None:
    if not path.exists():
        return
    try:
        data = load_json(path, [])
    except Exception as exc:
        errors.append(f"failed parsing {label}: {exc}")
        return
    if not isinstance(data, list):
        errors.append(f"{label} must contain a list")
        return
    if validate_items:
        errors.extend(f"{label} {err}" for err in validate_work_items(data))


def _validate_json_object(*, errors: list[str], path: Path, label: str) -> None:
    if not path.exists():
        return
    try:
        data = load_json(path, {})
    except Exception as exc:
        errors.append(f"failed parsing {label}: {exc}")
        return
    if not isinstance(data, dict):
        errors.append(f"{label} must contain an object")


def _is_definitive_model_access_error(text: str | None) -> bool:
    if not text:
        return False
    lowered = text.lower()
    markers = (
        "not supported",
        "unsupported",
        "unsupported model",
        "does not have access",
        "not authorized",
        "not enabled",
        "permission denied",
        "invalid model",
        "unknown model",
    )
    return any(marker in lowered for marker in markers)


def _validate_model_profile_access(*, errors: list[str], model_policy: Any) -> None:
    if not isinstance(model_policy, dict):
        return
    agent_models = model_policy.get("agent_models", {})
    if not isinstance(agent_models, dict):
        return

    escalation_upgrade = model_policy.get("escalation_upgrade", {}) or {}
    critical_cfg = escalation_upgrade.get("critical_or_repeated_failure") or {}
    lightweight_cfg = model_policy.get("lightweight_task_override", {}) or {}

    checks: list[str] = []

    for cfg in agent_models.values():
        if not isinstance(cfg, dict):
            continue
        model = cfg.get("model")
        if isinstance(model, str) and model.strip():
            checks.append(model.strip())

    if isinstance(critical_cfg, dict):
        crit_model = critical_cfg.get("model")
        if isinstance(crit_model, str) and crit_model.strip():
            checks.append(crit_model.strip())

    if isinstance(lightweight_cfg, dict):
        light_model = lightweight_cfg.get("model")
        if isinstance(light_model, str) and light_model.strip():
            checks.append(light_model.strip())

    seen: set[str] = set()
    for requested_model in checks:
        key = requested_model.lower()
        if key in seen:
            continue
        seen.add(key)

        requested_error = codex_model_access_preflight_error(requested_model)
        if not requested_error:
            continue
        if not _is_definitive_model_access_error(requested_error):
            # Timeouts/transient transport failures should not hard-fail daemon startup.
            continue

        errors.append(
            (
                f"model '{requested_model}' is not accessible: {requested_error}. "
                "Remediation: update model-policy.yaml to an accessible model."
            )
        )


def _boolish(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return default


def _frontend_visual_qa_enabled(*, commit_rules: Any) -> bool:
    rules = commit_rules if isinstance(commit_rules, dict) else {}
    visual_cfg = rules.get("frontend_visual_qa", {})
    if not isinstance(visual_cfg, dict):
        visual_cfg = {}

    enabled = _boolish(visual_cfg.get("enabled"), False)
    env_visual = os.environ.get("REDKEEPERS_ENABLE_FRONTEND_VISUAL_QA")
    if env_visual is not None:
        enabled = _boolish(env_visual, enabled)
    return enabled


def _playwright_import_error() -> str | None:
    probe_command = _normalize_validation_command(
        'python -c "import sys; print(sys.executable); import playwright.sync_api"'
    )
    proc = subprocess.run(
        probe_command,
        text=True,
        capture_output=True,
        shell=True,
        check=False,
    )
    if proc.returncode == 0:
        return None

    stdout_lines = [line.strip() for line in (proc.stdout or "").splitlines() if line.strip()]
    stderr_lines = [line.strip() for line in (proc.stderr or "").splitlines() if line.strip()]
    detail = stderr_lines[-1] if stderr_lines else (stdout_lines[-1] if stdout_lines else "")
    if not detail:
        detail = f"playwright import probe failed with exit code {proc.returncode}"

    if stdout_lines:
        interpreter = stdout_lines[0]
        return f"{detail} (interpreter: {interpreter})"
    if "not recognized as an internal or external command" in detail.lower():
        return f"{detail} (launcher command: {probe_command})"
    return detail


def _frontend_visual_python_command(command: str) -> str:
    return _normalize_validation_command(command).strip()


def _frontend_visual_remediation_commands() -> tuple[str, str]:
    install_command = _frontend_visual_python_command("python -m pip install playwright pillow")
    chromium_command = _frontend_visual_python_command("python -m playwright install chromium")
    return install_command, chromium_command


def _frontend_visual_python_label() -> str:
    command = _frontend_visual_python_command("python")
    return command or str(Path(sys.executable))


def _frontend_visual_remediation_text() -> str:
    install_command, chromium_command = _frontend_visual_remediation_commands()
    return f"{install_command} and {chromium_command}"


def _validate_frontend_visual_qa_preflight(*, errors: list[str], commit_rules: Any) -> None:
    if not _frontend_visual_qa_enabled(commit_rules=commit_rules):
        return

    import_error = _playwright_import_error()
    if not import_error:
        return

    python_label = _frontend_visual_python_label()
    remediation = _frontend_visual_remediation_text()
    errors.append(
        (
            "frontend visual QA is enabled but Playwright is not importable in the active Python interpreter "
            f"used by orchestrator validation commands ({python_label}): {import_error}. "
            f"Remediation: run {remediation}. "
            "If frontend visual QA should be disabled in this environment, set "
            "REDKEEPERS_ENABLE_FRONTEND_VISUAL_QA=0."
        )
    )


def _validate_runtime_python_policy(*, errors: list[str], runtime_policy: Any) -> None:
    if not isinstance(runtime_policy, dict):
        return
    command = str(runtime_policy.get("python_command", "")).strip()
    if not command:
        return
    executable = resolve_python_executable(command)
    if executable:
        return
    errors.append(
        (
            "runtime-policy.yaml python_command is configured but not resolvable: "
            f"{command!r}. Remediation: set coordination/policies/runtime-policy.yaml "
            "python_command to a valid interpreter path or launcher command."
        )
    )


def validate_environment(root: Path) -> list[str]:
    errors: list[str] = []
    runtime_dir = root / "coordination" / "runtime"
    commit_guard_rules: Any = {}
    runtime_policy_rules: Any = {}

    required_paths = [
        root / "coordination" / "backlog" / "work-items.json",
        root / "coordination" / "backlog" / "completed-items.json",
        root / "coordination" / "backlog" / "blocked-items.json",
        root / "coordination" / "state" / "agents.json",
        root / "coordination" / "policies" / "routing-rules.yaml",
        root / "coordination" / "policies" / "retry-policy.yaml",
        root / "coordination" / "policies" / "model-policy.yaml",
        root / "coordination" / "policies" / "commit-guard-rules.yaml",
        root / "coordination" / "policies" / "runtime-policy.yaml",
    ]
    for path in required_paths:
        if not path.exists():
            errors.append(f"missing required file: {path}")

    _validate_json_list(
        errors=errors,
        path=root / "coordination" / "backlog" / "work-items.json",
        label="work-items.json",
        validate_items=True,
    )
    _validate_json_list(
        errors=errors,
        path=root / "coordination" / "backlog" / "completed-items.json",
        label="completed-items.json",
        validate_items=True,
    )
    _validate_json_list(
        errors=errors,
        path=root / "coordination" / "backlog" / "blocked-items.json",
        label="blocked-items.json",
        validate_items=True,
    )
    _validate_json_list(
        errors=errors,
        path=root / "coordination" / "backlog" / "blocked-archived-items.json",
        label="blocked-archived-items.json",
        validate_items=True,
    )
    _validate_json_object(
        errors=errors,
        path=root / "coordination" / "state" / "daemon-state.json",
        label="daemon-state.json",
    )
    _validate_json_object(
        errors=errors,
        path=root / "coordination" / "state" / "agents.json",
        label="agents.json",
    )
    _validate_model_profile_access(
        errors=errors,
        model_policy=load_yaml_like(root / "coordination" / "policies" / "model-policy.yaml", {}),
    )

    # Runtime files are generated on demand; validate them only if they already exist.
    for state_name in ["daemon-state.json", "agent-stats.json", "model-stats.json", "progress-summary.json", "locks.json"]:
        _validate_json_object(
            errors=errors,
            path=runtime_dir / state_name,
            label=state_name,
        )
    for policy_name in [
        "routing-rules.yaml",
        "retry-policy.yaml",
        "model-policy.yaml",
        "commit-guard-rules.yaml",
        "runtime-policy.yaml",
    ]:
        policy_path = root / "coordination" / "policies" / policy_name
        if policy_path.exists():
            try:
                data: Any = load_yaml_like(policy_path, {})
                if not isinstance(data, dict):
                    errors.append(f"{policy_name} must parse to an object")
                    continue
                if policy_name == "commit-guard-rules.yaml":
                    commit_guard_rules = data
                if policy_name == "runtime-policy.yaml":
                    runtime_policy_rules = data
            except Exception as exc:
                errors.append(f"failed parsing {policy_name}: {exc}")

    _validate_runtime_python_policy(errors=errors, runtime_policy=runtime_policy_rules)
    _validate_frontend_visual_qa_preflight(errors=errors, commit_rules=commit_guard_rules)

    codex_error = codex_command_preflight_error()
    if codex_error:
        errors.append(codex_error)

    return errors
