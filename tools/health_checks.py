from __future__ import annotations

from pathlib import Path
from typing import Any

from codex_worker import codex_command_preflight_error
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


def validate_environment(root: Path) -> list[str]:
    errors: list[str] = []

    required_paths = [
        root / "coordination" / "backlog" / "work-items.json",
        root / "coordination" / "backlog" / "completed-items.json",
        root / "coordination" / "backlog" / "blocked-items.json",
        root / "coordination" / "state" / "daemon-state.json",
        root / "coordination" / "state" / "agents.json",
        root / "coordination" / "policies" / "routing-rules.yaml",
        root / "coordination" / "policies" / "retry-policy.yaml",
        root / "coordination" / "policies" / "model-policy.yaml",
        root / "coordination" / "policies" / "commit-guard-rules.yaml",
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

    for state_name in ["agent-stats.json", "progress-summary.json", "locks.json"]:
        _validate_json_object(
            errors=errors,
            path=root / "coordination" / "state" / state_name,
            label=state_name,
        )

    for policy_name in [
        "routing-rules.yaml",
        "retry-policy.yaml",
        "model-policy.yaml",
        "commit-guard-rules.yaml",
    ]:
        policy_path = root / "coordination" / "policies" / policy_name
        if policy_path.exists():
            try:
                data: Any = load_yaml_like(policy_path, {})
                if not isinstance(data, dict):
                    errors.append(f"{policy_name} must parse to an object")
            except Exception as exc:
                errors.append(f"failed parsing {policy_name}: {exc}")

    codex_error = codex_command_preflight_error()
    if codex_error:
        errors.append(codex_error)

    return errors
