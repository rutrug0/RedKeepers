from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

from schemas import load_json, save_json_atomic, utc_now_iso, validate_work_items


PRIORITY_RANK = {"critical": 0, "high": 1, "normal": 2, "low": 3}


class QueueManager:
    def __init__(self, root: Path):
        self.root = root
        self.backlog_dir = root / "coordination" / "backlog"
        self.active_path = self.backlog_dir / "work-items.json"
        self.completed_path = self.backlog_dir / "completed-items.json"
        self.blocked_path = self.backlog_dir / "blocked-items.json"
        self.active: list[dict[str, Any]] = []
        self.completed: list[dict[str, Any]] = []
        self.blocked: list[dict[str, Any]] = []

    def load(self) -> None:
        self.active = load_json(self.active_path, [])
        self.completed = load_json(self.completed_path, [])
        self.blocked = load_json(self.blocked_path, [])
        errors = validate_work_items(self.active)
        if errors:
            joined = "; ".join(errors[:10])
            raise ValueError(f"work queue validation failed: {joined}")

    def save(self) -> None:
        save_json_atomic(self.active_path, self.active)
        save_json_atomic(self.completed_path, self.completed)
        save_json_atomic(self.blocked_path, self.blocked)

    def completed_ids(self) -> set[str]:
        return {item["id"] for item in self.completed}

    def _dependencies_ready(self, item: dict[str, Any], completed_ids: set[str]) -> bool:
        return all(dep_id in completed_ids for dep_id in item.get("dependencies", []))

    def _agent_score(self, item: dict[str, Any], routing_rules: dict[str, Any], stats: dict[str, Any]) -> tuple[float, int]:
        preferred_agent = item.get("preferred_agent")
        agent_id = preferred_agent or routing_rules["owner_role_map"].get(item["owner_role"])
        if not agent_id:
            return (999999.0, 999999)
        agent_stats = stats.get("agents", {}).get(agent_id, {})
        load = float(agent_stats.get("current_load_score", 0.0))
        total_runs = int(agent_stats.get("total_runs", 0))
        return (load, total_runs)

    def select_next(self, routing_rules: dict[str, Any], stats: dict[str, Any]) -> dict[str, Any] | None:
        completed_ids = self.completed_ids()
        candidates = [
            item
            for item in self.active
            if item.get("status") == "queued" and self._dependencies_ready(item, completed_ids)
        ]
        if not candidates:
            return None

        def sort_key(item: dict[str, Any]) -> tuple[Any, ...]:
            load, total_runs = self._agent_score(item, routing_rules, stats)
            return (
                PRIORITY_RANK.get(item["priority"], 99),
                item.get("created_at", ""),
                load,
                total_runs,
                item["id"],
            )

        return deepcopy(sorted(candidates, key=sort_key)[0])

    def get_active_item(self, item_id: str) -> dict[str, Any] | None:
        for item in self.active:
            if item["id"] == item_id:
                return item
        return None

    def update_item_status(self, item_id: str, status: str, **extra: Any) -> None:
        item = self.get_active_item(item_id)
        if item is None:
            raise KeyError(f"unknown item id: {item_id}")
        item["status"] = status
        item["updated_at"] = utc_now_iso()
        for key, value in extra.items():
            item[key] = value

    def mark_assigned(self, item_id: str, agent_id: str) -> None:
        self.update_item_status(item_id, "assigned", assigned_agent=agent_id)

    def mark_running(self, item_id: str) -> None:
        self.update_item_status(item_id, "running")

    def mark_validating(self, item_id: str) -> None:
        self.update_item_status(item_id, "validating")

    def mark_completed(self, item_id: str, result_summary: str, commit_sha: str | None = None) -> None:
        item = self.get_active_item(item_id)
        if item is None:
            raise KeyError(f"unknown item id: {item_id}")
        item["status"] = "completed"
        item["updated_at"] = utc_now_iso()
        item["result_summary"] = result_summary
        if commit_sha:
            item["commit_sha"] = commit_sha
        self.completed.append(item)
        self.active = [candidate for candidate in self.active if candidate["id"] != item_id]

    def mark_blocked(self, item_id: str, blocker_reason: str) -> None:
        item = self.get_active_item(item_id)
        if item is None:
            raise KeyError(f"unknown item id: {item_id}")
        item["status"] = "blocked"
        item["updated_at"] = utc_now_iso()
        item["blocker_reason"] = blocker_reason
        self.blocked.append(item)
        self.active = [candidate for candidate in self.active if candidate["id"] != item_id]

    def increment_retry(self, item_id: str, reason: str) -> int:
        item = self.get_active_item(item_id)
        if item is None:
            raise KeyError(f"unknown item id: {item_id}")
        item["retry_count"] = int(item.get("retry_count", 0)) + 1
        item["status"] = "queued"
        item["updated_at"] = utc_now_iso()
        item["last_failure_reason"] = reason
        return item["retry_count"]

    def append_item(self, item: dict[str, Any]) -> None:
        self.active.append(item)

    def create_escalation_item(
        self,
        failed_item: dict[str, Any],
        lead_agent_name: str,
        reason: str,
        owner_role: str = "lead",
    ) -> dict[str, Any]:
        new_item = {
            "id": f"{failed_item['id']}-ESC",
            "title": f"Escalation: {failed_item['title']}",
            "description": (
                "Investigate repeated failure for item "
                f"{failed_item['id']}. Reason: {reason}"
            ),
            "milestone": failed_item["milestone"],
            "type": "qa",
            "priority": "high",
            "owner_role": owner_role,
            "preferred_agent": None,
            "dependencies": [],
            "inputs": [f"coordination/state/run-history.jsonl", f"coordination/backlog/work-items.json"],
            "acceptance_criteria": [
                "Root cause identified",
                "Follow-up work items created or item unblocked",
            ],
            "validation_commands": [],
            "status": "queued",
            "retry_count": 0,
            "created_at": utc_now_iso(),
            "updated_at": utc_now_iso(),
            "estimated_effort": "S",
            "token_budget": 6000,
            "result_summary": None,
            "blocker_reason": None,
            "escalation_target": lead_agent_name,
            "source_item_id": failed_item["id"],
        }
        self.active.append(new_item)
        return new_item

