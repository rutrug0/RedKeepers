from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

from schemas import load_json, save_json_atomic, utc_now_iso, validate_work_items


PRIORITY_RANK = {"critical": 0, "high": 1, "normal": 2, "low": 3}
PRIORITY_UNLOCK_WEIGHT = {"critical": 8, "high": 4, "normal": 2, "low": 1}


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

    def _dependency_unlock_metrics(
        self,
        *,
        candidate_ids: set[str],
        completed_ids: set[str],
    ) -> dict[str, dict[str, int]]:
        metrics: dict[str, dict[str, int]] = {
            item_id: {
                "total": 0,
                "immediate": 0,
                "weighted_total": 0,
                "weighted_immediate": 0,
                "transitive_total": 0,
                "weighted_transitive": 0,
            }
            for item_id in candidate_ids
        }
        queued_items = [item for item in self.active if item.get("status") == "queued"]
        by_id: dict[str, dict[str, Any]] = {}
        dependent_index: dict[str, set[str]] = {}
        for item in queued_items:
            item_id = str(item.get("id", ""))
            if not item_id:
                continue
            by_id[item_id] = item
            deps_raw = item.get("dependencies", [])
            if not isinstance(deps_raw, list):
                continue
            for dep in deps_raw:
                dep_id = str(dep)
                if not dep_id:
                    continue
                dependent_index.setdefault(dep_id, set()).add(item_id)

        for target in queued_items:
            target_id = str(target.get("id", ""))
            deps_raw = target.get("dependencies", [])
            if not isinstance(deps_raw, list) or not deps_raw:
                continue
            deps = [str(dep) for dep in deps_raw]
            dep_set = set(deps)
            relevant = dep_set.intersection(candidate_ids)
            if not relevant:
                continue
            for dep in relevant:
                if dep == target_id:
                    continue
                metrics[dep]["total"] += 1
                priority = str(target.get("priority", "normal")).strip().lower()
                weight = PRIORITY_UNLOCK_WEIGHT.get(priority, PRIORITY_UNLOCK_WEIGHT["normal"])
                metrics[dep]["weighted_total"] += weight
                other_deps = [other for other in deps if other != dep]
                if all(other in completed_ids for other in other_deps):
                    metrics[dep]["immediate"] += 1
                    metrics[dep]["weighted_immediate"] += weight

        # Transitive fan-out: how many queued items are in the dependency chain
        # beneath a candidate (direct + indirect descendants).
        for candidate_id in candidate_ids:
            visited: set[str] = set()
            stack = list(dependent_index.get(candidate_id, set()))
            while stack:
                current = stack.pop()
                if current in visited or current == candidate_id:
                    continue
                visited.add(current)
                target = by_id.get(current)
                if target:
                    priority = str(target.get("priority", "normal")).strip().lower()
                    weight = PRIORITY_UNLOCK_WEIGHT.get(priority, PRIORITY_UNLOCK_WEIGHT["normal"])
                else:
                    weight = PRIORITY_UNLOCK_WEIGHT["normal"]
                metrics[candidate_id]["transitive_total"] += 1
                metrics[candidate_id]["weighted_transitive"] += weight
                stack.extend(dep for dep in dependent_index.get(current, set()) if dep not in visited)
        return metrics

    @staticmethod
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

    @staticmethod
    def _intish(value: Any, default: int, min_value: int = 0, max_value: int | None = None) -> int:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            parsed = default
        if parsed < min_value:
            parsed = min_value
        if max_value is not None and parsed > max_value:
            parsed = max_value
        return parsed

    def select_next(self, routing_rules: dict[str, Any], stats: dict[str, Any]) -> dict[str, Any] | None:
        completed_ids = self.completed_ids()
        candidates = [
            item
            for item in self.active
            if item.get("status") == "queued" and self._dependencies_ready(item, completed_ids)
        ]
        if not candidates:
            return None

        unlock_cfg = routing_rules.get("dependency_unlock_priority", {}) if isinstance(routing_rules, dict) else {}
        if not isinstance(unlock_cfg, dict):
            unlock_cfg = {}
        unlock_enabled = self._boolish(unlock_cfg.get("enabled"), False)
        critical_protected = self._boolish(unlock_cfg.get("critical_priority_protected"), True)
        boost_levels = self._intish(unlock_cfg.get("priority_boost_levels", 1), default=1, min_value=0, max_value=3)
        prefer_immediate = self._boolish(unlock_cfg.get("prefer_immediate_unblocks"), True)
        candidate_ids = {str(item.get("id", "")) for item in candidates if str(item.get("id", ""))}
        unlock_metrics = (
            self._dependency_unlock_metrics(candidate_ids=candidate_ids, completed_ids=completed_ids) if unlock_enabled else {}
        )

        def sort_key(item: dict[str, Any]) -> tuple[Any, ...]:
            load, total_runs = self._agent_score(item, routing_rules, stats)
            item_id = str(item.get("id", ""))
            base_rank = PRIORITY_RANK.get(item["priority"], 99)
            unlock_total = int(unlock_metrics.get(item_id, {}).get("total", 0))
            unlock_immediate = int(unlock_metrics.get(item_id, {}).get("immediate", 0))
            unlock_weighted_total = int(unlock_metrics.get(item_id, {}).get("weighted_total", 0))
            unlock_weighted_immediate = int(unlock_metrics.get(item_id, {}).get("weighted_immediate", 0))
            unlock_transitive = int(unlock_metrics.get(item_id, {}).get("transitive_total", 0))
            unlock_weighted_transitive = int(unlock_metrics.get(item_id, {}).get("weighted_transitive", 0))
            unlock_signal = unlock_immediate if prefer_immediate else unlock_total
            unblock_value = (
                unlock_weighted_immediate * 12
                + unlock_immediate * 8
                + unlock_weighted_total * 4
                + unlock_total * 2
                + unlock_weighted_transitive * 2
                + unlock_transitive
            )

            effective_rank = base_rank
            if unlock_enabled and boost_levels > 0 and unlock_signal > 0:
                floor = 1 if critical_protected else 0
                if not (critical_protected and base_rank == 0):
                    effective_rank = max(floor, base_rank - boost_levels)

            return (
                effective_rank,
                -unblock_value,
                -unlock_weighted_immediate,
                -unlock_weighted_total,
                -unlock_immediate,
                -unlock_total,
                base_rank,
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

    def mark_completed(
        self,
        item_id: str,
        result_summary: str,
        commit_sha: str | None = None,
        **extra: Any,
    ) -> None:
        item = self.get_active_item(item_id)
        if item is None:
            raise KeyError(f"unknown item id: {item_id}")
        item["status"] = "completed"
        item["updated_at"] = utc_now_iso()
        item["result_summary"] = result_summary
        if commit_sha:
            item["commit_sha"] = commit_sha
        for key, value in extra.items():
            item[key] = value
        self.completed = [existing for existing in self.completed if existing.get("id") != item_id]
        self.blocked = [existing for existing in self.blocked if existing.get("id") != item_id]
        self.completed.append(item)
        self.active = [candidate for candidate in self.active if candidate["id"] != item_id]

    def mark_blocked(self, item_id: str, blocker_reason: str) -> None:
        item = self.get_active_item(item_id)
        if item is None:
            raise KeyError(f"unknown item id: {item_id}")
        item["status"] = "blocked"
        item["updated_at"] = utc_now_iso()
        item["blocker_reason"] = blocker_reason
        self.blocked = [existing for existing in self.blocked if existing.get("id") != item_id]
        self.completed = [existing for existing in self.completed if existing.get("id") != item_id]
        self.blocked.append(item)
        self.active = [candidate for candidate in self.active if candidate["id"] != item_id]

    def requeue_blocked(self, item_id: str, *, reason: str) -> bool:
        if any(item.get("id") == item_id for item in self.active):
            return False
        if any(item.get("id") == item_id for item in self.completed):
            return False
        idx = next((i for i, item in enumerate(self.blocked) if item.get("id") == item_id), None)
        if idx is None:
            return False
        item = self.blocked.pop(idx)
        item["status"] = "queued"
        item["updated_at"] = utc_now_iso()
        item["last_unblocked_reason"] = reason
        item["last_blocker_reason"] = item.get("blocker_reason")
        item["blocker_reason"] = None
        item["blocked_revisit_count"] = int(item.get("blocked_revisit_count", 0)) + 1
        self.active.append(item)
        return True

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
        item_id = item.get("id")
        if isinstance(item_id, str):
            self.active = [existing for existing in self.active if existing.get("id") != item_id]
            self.blocked = [existing for existing in self.blocked if existing.get("id") != item_id]
            self.completed = [existing for existing in self.completed if existing.get("id") != item_id]
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
