from __future__ import annotations

from pathlib import Path
from typing import Any

from codex_worker import codex_command_preflight_error
from schemas import load_json, load_yaml_like, validate_work_items


def validate_environment(root: Path) -> list[str]:
    errors: list[str] = []

    required_paths = [
        root / "coordination" / "backlog" / "work-items.json",
        root / "coordination" / "state" / "daemon-state.json",
        root / "coordination" / "policies" / "routing-rules.yaml",
        root / "coordination" / "policies" / "retry-policy.yaml",
        root / "coordination" / "policies" / "model-policy.yaml",
        root / "coordination" / "policies" / "commit-guard-rules.yaml",
    ]
    for path in required_paths:
        if not path.exists():
            errors.append(f"missing required file: {path}")

    work_items = load_json(root / "coordination" / "backlog" / "work-items.json", [])
    if not isinstance(work_items, list):
        errors.append("work-items.json must contain a list")
    else:
        errors.extend(validate_work_items(work_items))

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
