from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


WORK_ITEM_REQUIRED_FIELDS = {
    "id",
    "title",
    "description",
    "milestone",
    "type",
    "priority",
    "owner_role",
    "dependencies",
    "inputs",
    "acceptance_criteria",
    "validation_commands",
    "status",
    "retry_count",
    "created_at",
    "updated_at",
    "estimated_effort",
    "token_budget",
    "escalation_target",
}

WORK_ITEM_STATUSES = {
    "queued",
    "assigned",
    "running",
    "validating",
    "completed",
    "blocked",
    "failed_escalated",
    "canceled",
}

WORK_ITEM_PRIORITIES = {"critical", "high", "normal", "low"}
PLACEHOLDER_TOKEN_PATTERN = re.compile(r"<[^>\r\n]+>")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    # Use utf-8-sig so files saved with a UTF-8 BOM (common on Windows tooling)
    # are still accepted by json.load.
    with path.open("r", encoding="utf-8-sig") as fh:
        return json.load(fh)


def save_json_atomic(path: Path, data: Any) -> None:
    ensure_parent(path)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8", newline="\n") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=True)
        fh.write("\n")
    os.replace(tmp, path)


def append_jsonl(path: Path, record: dict[str, Any]) -> None:
    ensure_parent(path)
    with path.open("a", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(record, ensure_ascii=True))
        fh.write("\n")


def load_yaml_like(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    text = path.read_text(encoding="utf-8-sig")
    try:
        import yaml  # type: ignore

        return yaml.safe_load(text)
    except Exception:
        # Policies are stored as JSON-compatible YAML to avoid mandatory deps.
        return json.loads(text)


def validate_work_item(item: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    missing = sorted(field for field in WORK_ITEM_REQUIRED_FIELDS if field not in item)
    if missing:
        errors.append(f"missing fields: {', '.join(missing)}")
        return errors

    if item.get("status") not in WORK_ITEM_STATUSES:
        errors.append(f"invalid status: {item.get('status')}")
    if item.get("priority") not in WORK_ITEM_PRIORITIES:
        errors.append(f"invalid priority: {item.get('priority')}")
    if not isinstance(item.get("dependencies"), list):
        errors.append("dependencies must be a list")
    if not isinstance(item.get("inputs"), list):
        errors.append("inputs must be a list")
    if not isinstance(item.get("acceptance_criteria"), list):
        errors.append("acceptance_criteria must be a list")
    validation_commands = item.get("validation_commands")
    if not isinstance(validation_commands, list):
        errors.append("validation_commands must be a list")
    else:
        for idx, command in enumerate(validation_commands):
            if not isinstance(command, str):
                errors.append(f"validation_commands[{idx}] must be a string")
                continue
            if PLACEHOLDER_TOKEN_PATTERN.search(command):
                errors.append(
                    f"validation_commands[{idx}] contains unresolved placeholder token"
                )
    if not isinstance(item.get("retry_count"), int):
        errors.append("retry_count must be an int")
    if not isinstance(item.get("token_budget"), int):
        errors.append("token_budget must be an int")
    return errors


def validate_work_items(items: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    for idx, item in enumerate(items):
        item_errors = validate_work_item(item)
        if item_errors:
            errors.extend(f"item[{idx}] {err}" for err in item_errors)
        item_id = item.get("id")
        if isinstance(item_id, str):
            if item_id in seen_ids:
                errors.append(f"duplicate id: {item_id}")
            seen_ids.add(item_id)
    return errors


def default_agent_stats(agents: dict[str, dict[str, Any]]) -> dict[str, Any]:
    generated_at = utc_now_iso()
    stats_agents: dict[str, Any] = {}
    for agent_id, cfg in agents.items():
        stats_agents[agent_id] = {
            "display_name": cfg["display_name"],
            "role": cfg["role"],
            "total_runs": 0,
            "completed_items": 0,
            "blocked_items": 0,
            "failed_runs": 0,
            "total_runtime_seconds": 0.0,
            "avg_runtime_seconds": 0.0,
            "estimated_tokens_in": 0,
            "estimated_tokens_out": 0,
            "last_active_at": None,
            "current_load_score": 0.0,
        }
    return {
        "generated_at": generated_at,
        "agents": stats_agents,
        "totals": {
            "completed_items": 0,
            "queued_items": 0,
            "blocked_items": 0,
            "runtime_seconds": 0.0,
            "estimated_tokens_total": 0,
        },
    }
