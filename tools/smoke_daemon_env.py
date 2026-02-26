from __future__ import annotations

from pathlib import Path
from typing import Any

from health_checks import validate_environment
from schemas import load_json, load_yaml_like, validate_work_items


ROOT = Path(__file__).resolve().parents[1]


def _load_json_list(path: Path, label: str, *, validate_items: bool = False) -> tuple[list[str], list[Any]]:
    errors: list[str] = []
    try:
        data = load_json(path, [])
    except Exception as exc:
        return [f"failed parsing {label}: {exc}"], []
    if not isinstance(data, list):
        return [f"{label} must contain a list"], []
    if validate_items:
        errors.extend(f"{label} {err}" for err in validate_work_items(data))
    return errors, data


def _load_json_object(path: Path, label: str) -> tuple[list[str], dict[str, Any]]:
    try:
        data = load_json(path, {})
    except Exception as exc:
        return [f"failed parsing {label}: {exc}"], {}
    if not isinstance(data, dict):
        return [f"{label} must contain an object"], {}
    return [], data


def _load_yaml_object(path: Path, label: str) -> tuple[list[str], dict[str, Any]]:
    try:
        data = load_yaml_like(path, {})
    except Exception as exc:
        return [f"failed parsing {label}: {exc}"], {}
    if not isinstance(data, dict):
        return [f"{label} must parse to an object"], {}
    return [], data


def main() -> int:
    errors = validate_environment(ROOT)

    queue_dir = ROOT / "coordination" / "backlog"
    state_dir = ROOT / "coordination" / "state"
    policy_dir = ROOT / "coordination" / "policies"

    active_errs, active = _load_json_list(queue_dir / "work-items.json", "work-items.json", validate_items=True)
    completed_errs, completed = _load_json_list(queue_dir / "completed-items.json", "completed-items.json", validate_items=True)
    blocked_errs, blocked = _load_json_list(queue_dir / "blocked-items.json", "blocked-items.json", validate_items=True)
    errors.extend(active_errs + completed_errs + blocked_errs)

    state_files = [
        "daemon-state.json",
        "agents.json",
        "agent-stats.json",
        "progress-summary.json",
        "locks.json",
    ]
    parsed_state = 0
    for name in state_files:
        path = state_dir / name
        if not path.exists():
            errors.append(f"missing state file for smoke validation: {path}")
            continue
        file_errors, _ = _load_json_object(path, name)
        errors.extend(file_errors)
        if not file_errors:
            parsed_state += 1

    policy_files = [
        "routing-rules.yaml",
        "retry-policy.yaml",
        "model-policy.yaml",
        "commit-guard-rules.yaml",
        "runtime-policy.yaml",
    ]
    parsed_policies = 0
    for name in policy_files:
        path = policy_dir / name
        if not path.exists():
            errors.append(f"missing policy file for smoke validation: {path}")
            continue
        file_errors, _ = _load_yaml_object(path, name)
        errors.extend(file_errors)
        if not file_errors:
            parsed_policies += 1

    if errors:
        print("Smoke validation failed:")
        for err in errors:
            print(f"- {err}")
        return 1

    print("Smoke validation passed.")
    print(f"queue: active={len(active)} completed={len(completed)} blocked={len(blocked)}")
    print(f"policies: parsed={parsed_policies}")
    print(f"state: parsed={parsed_state}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
