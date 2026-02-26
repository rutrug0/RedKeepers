from __future__ import annotations

import argparse
import os
import re
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from codex_worker import codex_model_access_preflight_error, run_agent
from git_guard import changed_files, commit_changes, current_branch, is_git_repo, run_validation_commands
from health_checks import validate_environment
from model_stats import ModelStatsTracker
from python_runtime import enforce_python_environment
from prompt_builder import build_prompt
from queue_manager import QueueManager
from schemas import append_jsonl, load_json, load_yaml_like, save_json_atomic, utc_now_iso
from stats_tracker import StatsTracker
from render_status import render_status


ROOT = Path(__file__).resolve().parents[1]
HUMAN_DIR = ROOT / "Human"
BLOCKED_ARCHIVED_PATH = ROOT / "coordination" / "backlog" / "blocked-archived-items.json"
STATIC_STATE_DIR = ROOT / "coordination" / "state"
RUNTIME_DIR = ROOT / "coordination" / "runtime"
DAEMON_STATE_PATH = RUNTIME_DIR / "daemon-state.json"
LOCK_META_PATH = RUNTIME_DIR / "locks.json"
LOCK_FILE = RUNTIME_DIR / "daemon.lock"
EVENTS_LOG_PATH = RUNTIME_DIR / "daemon-events.jsonl"
RUN_HISTORY_PATH = RUNTIME_DIR / "run-history.jsonl"
LOW_QUEUE_WATERMARK = 2


def ensure_python_runtime_configuration() -> tuple[str, str | None]:
    merged_env, command, executable = enforce_python_environment(root=ROOT)
    os.environ["REDKEEPERS_PYTHON_CMD"] = merged_env.get("REDKEEPERS_PYTHON_CMD", command)
    path_value = merged_env.get("PATH") or merged_env.get("Path")
    if path_value:
        os.environ["PATH"] = path_value
        os.environ["Path"] = path_value
    return command, executable


def _bool_env(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _int_env(name: str, default: int, *, min_value: int = 0) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        parsed = int(raw)
    except ValueError:
        return default
    return max(min_value, parsed)


AGENT_HEARTBEAT_SECONDS = _int_env("REDKEEPERS_AGENT_HEARTBEAT_SECONDS", 60, min_value=5)
STALL_RECOVERY_COOLDOWN_SECONDS = _int_env("REDKEEPERS_STALL_RECOVERY_COOLDOWN_SECONDS", 900, min_value=0)
BACKLOG_ID_PATTERN = re.compile(r"^RK-[A-Z0-9]+(?:-[A-Z0-9]+)*$")
NON_ACTIONABLE_BLOCKER_REASON_PATTERN = re.compile(
    r"^(?:[-*]\s*)?(?:none|n/?a|na|null|nil|unknown|tbd|not provided|not specified|unspecified|no blocker(?: reason)?)(?:[.!])?$",
    re.IGNORECASE,
)


def _supports_color_output() -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    setting = os.environ.get("REDKEEPERS_COLOR_LOGS", "auto").strip().lower()
    if setting in {"0", "false", "off", "no"}:
        return False
    if setting in {"1", "true", "on", "yes", "always"}:
        return True
    isatty = getattr(sys.stdout, "isatty", None)
    return bool(isatty and isatty())


COLOR_ENABLED = _supports_color_output()
ANSI_RESET = "\x1b[0m"
KIND_STYLE = {
    "daemon_start": "1;36",
    "daemon_stop": "1;36",
    "select": "1;34",
    "agent_start": "1;34",
    "agent_end": "1;32",
    "resolution": "1;36",
    "agent_heartbeat": "2;37",
    "completed": "1;32",
    "blocked": "1;33",
    "failed": "1;31",
    "validation_failed": "1;31",
    "commit_failed": "1;31",
    "error": "1;31",
    "commit": "1;32",
    "followups": "1;35",
    "followups_invalid": "1;33",
}
ROLE_STYLE = {
    "lead": "1;35",
    "backend": "1;34",
    "frontend": "1;36",
    "design": "1;33",
    "content": "1;32",
    "qa": "1;31",
    "platform": "1;37",
}
def _style(text: str, ansi_code: str | None) -> str:
    if not COLOR_ENABLED or not ansi_code:
        return text
    return f"\x1b[{ansi_code}m{text}{ANSI_RESET}"


def _display_timestamp(ts: str) -> str:
    try:
        parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        else:
            parsed = parsed.astimezone(timezone.utc)
        return parsed.replace(microsecond=0).isoformat().replace("+00:00", "")
    except ValueError:
        # Best-effort fallback keeps output stable if timestamp parsing changes.
        return ts.split("+", 1)[0].split(".", 1)[0]


def _normalize_log_text(value: Any, *, max_chars: int = 300, max_sentences: int | None = None) -> str:
    text = " ".join(str(value or "").strip().split())
    if not text:
        return ""
    if max_sentences is not None:
        sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]
        text = " ".join(sentences[:max_sentences]) if sentences else text
    if len(text) > max_chars:
        text = text[: max_chars - 3].rstrip() + "..."
    return text


def _with_period(text: str) -> str:
    if not text:
        return ""
    if text.endswith((".", "!", "?")):
        return text
    return f"{text}."


def _format_role(role: Any) -> str:
    role_text = str(role or "").strip().lower()
    if not role_text:
        return "UNASSIGNED"
    return _style(role_text.upper(), ROLE_STYLE.get(role_text))


def _render_event_lines(ts: str, kind: str, message: str, fields: dict[str, Any]) -> list[str]:
    ts_display = _display_timestamp(ts)
    kind_label = _style(kind, KIND_STYLE.get(kind))
    prefix = f"[{ts_display}] [{kind_label}]"
    agent_id = str(fields.get("agent_id") or "").strip()
    role_label = _format_role(fields.get("role"))
    title = _normalize_log_text(fields.get("title"), max_chars=180, max_sentences=1)
    description = _normalize_log_text(fields.get("description"), max_chars=420, max_sentences=3)
    message_text = _normalize_log_text(message, max_chars=220, max_sentences=2) or kind.replace("_", " ")

    if kind == "select":
        return []

    if kind == "agent_start":
        summary = title or fields.get("item_id") or "work item"
        summary_text = _normalize_log_text(summary, max_chars=180, max_sentences=1)
        head = f"{prefix} {role_label}, {agent_id or 'unassigned'}: Starting {_with_period(summary_text)}"
        return [head, description] if description else [head]

    if kind == "agent_heartbeat":
        elapsed = fields.get("elapsed_seconds")
        if isinstance(elapsed, (int, float)):
            elapsed_text = f"{elapsed:.1f}"
        else:
            elapsed_text = _normalize_log_text(elapsed, max_chars=32) or "unknown"
        return [f"{prefix} Agent {agent_id or 'unknown'} still running, elapsed seconds: {elapsed_text}."]

    if kind == "agent_end":
        elapsed = fields.get("elapsed_seconds")
        if isinstance(elapsed, (int, float)):
            elapsed_text = f"{elapsed:.2f}"
        else:
            elapsed_text = _normalize_log_text(elapsed, max_chars=32) or "unknown"
        result = _normalize_log_text(fields.get("result"), max_chars=24) or "unknown"
        return [f"{prefix} Agent {agent_id or 'unknown'} finished ({result}), elapsed seconds: {elapsed_text}."]

    if kind == "resolution":
        summary = title or fields.get("item_id") or "work item"
        summary_text = _normalize_log_text(summary, max_chars=180, max_sentences=1)
        result = _normalize_log_text(fields.get("result"), max_chars=24).upper() or "UNKNOWN"
        detail = _normalize_log_text(fields.get("resolution"), max_chars=420, max_sentences=3)
        head = f"{prefix} {role_label}, {agent_id or 'unassigned'}: {_with_period(summary_text)} ({result})."
        return [head, detail] if detail else [head]

    if kind in {"blocked", "failed", "validation_failed", "commit_failed", "error", "infrastructure_error"}:
        reason = _normalize_log_text(fields.get("reason") or fields.get("error"), max_chars=260, max_sentences=2)
        if agent_id:
            line = f"{prefix} Agent {agent_id}: {_with_period(message_text)}"
        else:
            line = f"{prefix} {_with_period(message_text)}"
        if reason:
            line = f"{line} Reason: {_with_period(reason)}"
        return [line]

    if kind in {"wait", "sleep"} and fields.get("seconds") is not None:
        return [f"{prefix} {_with_period(message_text)} (seconds={fields.get('seconds')})."]

    if kind == "completed":
        if agent_id:
            return [f"{prefix} Agent {agent_id}: {_with_period(message_text)}"]
        return [f"{prefix} {_with_period(message_text)}"]

    if kind == "idle":
        return [f"{prefix} {_with_period(message_text)}"]

    if agent_id:
        return [f"{prefix} Agent {agent_id}: {_with_period(message_text)}"]
    return [f"{prefix} {_with_period(message_text)}"]


def build_session_id(*, pid: int, started_at: str) -> str:
    compact = started_at.replace("-", "").replace(":", "").replace("+", "Z").replace(".", "")
    return f"rk-{compact}-p{pid}"


def load_agent_catalog(root: Path) -> dict[str, dict[str, Any]]:
    agents_path = root / "coordination" / "state" / "agents.json"
    agents = load_json(agents_path, {})
    if not isinstance(agents, dict):
        raise ValueError("coordination/state/agents.json must contain an object")
    return agents


def load_policies(root: Path) -> dict[str, Any]:
    policy_dir = root / "coordination" / "policies"
    routing = load_yaml_like(policy_dir / "routing-rules.yaml", {})
    retry = load_yaml_like(policy_dir / "retry-policy.yaml", {})
    model = load_yaml_like(policy_dir / "model-policy.yaml", {})
    commit_rules = load_yaml_like(policy_dir / "commit-guard-rules.yaml", {})
    return {
        "routing": routing or {},
        "retry": retry or {},
        "model": model or {},
        "commit": commit_rules or {},
    }


class DaemonLock:
    def __init__(self, pid: int):
        self.pid = pid
        self.held = False

    def acquire(self) -> None:
        RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
        fd = None
        try:
            fd = os.open(LOCK_FILE, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(self.pid).encode("ascii"))
            self.held = True
            meta = load_json(LOCK_META_PATH, {})
            meta["daemon"] = {"pid": self.pid, "acquired_at": utc_now_iso()}
            save_json_atomic(LOCK_META_PATH, meta)
        except FileExistsError as exc:
            raise RuntimeError(f"lock already held at {LOCK_FILE}") from exc
        finally:
            if fd is not None:
                os.close(fd)

    def release(self) -> None:
        if LOCK_FILE.exists():
            LOCK_FILE.unlink(missing_ok=True)
        meta = load_json(LOCK_META_PATH, {})
        meta["daemon"] = {"pid": self.pid, "released_at": utc_now_iso(), "held": False}
        save_json_atomic(LOCK_META_PATH, meta)
        self.held = False


def default_daemon_state() -> dict[str, Any]:
    return {
        "state": "idle",
        "updated_at": utc_now_iso(),
        "active_item": None,
        "session_id": None,
        "last_error": None,
        "last_run_summary": None,
        "lock_held": False,
    }


def migrate_legacy_runtime_files() -> None:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    for name in [
        "daemon-state.json",
        "locks.json",
        "agent-stats.json",
        "progress-summary.json",
        "run-history.jsonl",
        "daemon-events.jsonl",
    ]:
        legacy = STATIC_STATE_DIR / name
        target = RUNTIME_DIR / name
        if legacy.exists() and not target.exists():
            target.write_bytes(legacy.read_bytes())


def emit_event(kind: str, message: str, **fields: Any) -> None:
    ts = utc_now_iso()
    lines = _render_event_lines(ts, kind, message, fields)
    if lines:
        print("\n".join(lines), flush=True)
    append_jsonl(
        EVENTS_LOG_PATH,
        {
            "ts": ts,
            "kind": kind,
            "message": message,
            "fields": fields,
        },
    )


def set_daemon_state(**patch: Any) -> dict[str, Any]:
    state = load_json(DAEMON_STATE_PATH, default_daemon_state())
    state.update(patch)
    state["updated_at"] = utc_now_iso()
    save_json_atomic(DAEMON_STATE_PATH, state)
    return state


def milestone_progress(queue: QueueManager) -> dict[str, dict[str, int]]:
    progress: dict[str, dict[str, int]] = {}
    for collection, label in [
        (queue.active, "active"),
        (queue.completed, "completed"),
        (queue.blocked, "blocked"),
    ]:
        for item in collection:
            bucket = progress.setdefault(item.get("milestone", "unknown"), {"active": 0, "completed": 0, "blocked": 0})
            bucket[label] += 1
    return progress


def queue_counts(queue: QueueManager) -> dict[str, int]:
    running = sum(1 for item in queue.active if item.get("status") in {"assigned", "running", "validating"})
    queued = sum(1 for item in queue.active if item.get("status") == "queued")
    completed_ids = {item.get("id") for item in queue.completed}
    dependency_ready = 0
    for item in queue.active:
        if item.get("status") != "queued":
            continue
        deps_raw = item.get("dependencies", [])
        if not isinstance(deps_raw, list):
            continue
        deps = [str(dep) for dep in deps_raw]
        if all(dep in completed_ids for dep in deps):
            dependency_ready += 1
    return {
        "queued": queued,
        "dependency_ready": dependency_ready,
        "running": running,
        "blocked": len(queue.blocked),
        "completed": len(queue.completed),
    }


def load_blocked_archived_ids() -> set[str]:
    rows = load_json(BLOCKED_ARCHIVED_PATH, [])
    if not isinstance(rows, list):
        return set()
    archived_ids: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        item_id = str(row.get("id", "")).strip()
        if item_id:
            archived_ids.add(item_id)
    return archived_ids


def _dependency_warning_message(row: dict[str, str]) -> str:
    item_id = row.get("item_id", "<unknown>")
    dep = row.get("dependency", "<unknown>")
    reason = row.get("reason", "invalid")
    action = row.get("action", "Replace it with a valid backlog work-item id.")
    return f"- {item_id}: removed dependency `{dep}` ({reason}). Action: {action}"


def format_dependency_warning_lines(warnings: list[dict[str, str]], *, max_lines: int = 8) -> list[str]:
    if not warnings:
        return []
    rendered = [_dependency_warning_message(row) for row in warnings[:max_lines]]
    remainder = len(warnings) - len(rendered)
    if remainder > 0:
        rendered.append(f"- ... and {remainder} more dependency normalization warnings.")
    return rendered


def normalize_queued_item_dependencies(
    queue: QueueManager,
    *,
    archived_ids: set[str] | None = None,
) -> list[dict[str, str]]:
    known_ids = {
        str(item.get("id", "")).strip()
        for item in [*queue.active, *queue.completed, *queue.blocked]
        if isinstance(item, dict) and str(item.get("id", "")).strip()
    }
    archived = archived_ids if archived_ids is not None else load_blocked_archived_ids()
    warnings: list[dict[str, str]] = []
    changed = False

    for item in queue.active:
        if item.get("status") != "queued":
            continue
        item_id = str(item.get("id", "")).strip()
        deps_raw = item.get("dependencies", [])
        if not isinstance(deps_raw, list):
            continue

        normalized: list[str] = []
        seen: set[str] = set()
        for dep in deps_raw:
            if not isinstance(dep, str):
                warnings.append(
                    {
                        "item_id": item_id,
                        "dependency": repr(dep),
                        "reason": "non_string_dependency",
                        "action": "Dependencies must be backlog ids like RK-M0-0001.",
                    }
                )
                continue
            dep_id = dep.strip()
            if not dep_id:
                warnings.append(
                    {
                        "item_id": item_id,
                        "dependency": dep,
                        "reason": "empty_dependency",
                        "action": "Remove empty dependencies or replace with a valid backlog id.",
                    }
                )
                continue
            if dep_id in seen:
                continue
            seen.add(dep_id)

            if dep_id in archived:
                warnings.append(
                    {
                        "item_id": item_id,
                        "dependency": dep_id,
                        "reason": "archived_dependency_id",
                        "action": "Use an active prerequisite id. Archived blocked items cannot be reintroduced.",
                    }
                )
                continue
            if dep_id not in known_ids:
                if BACKLOG_ID_PATTERN.match(dep_id):
                    warnings.append(
                        {
                            "item_id": item_id,
                            "dependency": dep_id,
                            "reason": "unknown_dependency_id",
                            "action": "Fix the id typo or create that backlog item before referencing it.",
                        }
                    )
                else:
                    warnings.append(
                        {
                            "item_id": item_id,
                            "dependency": dep_id,
                            "reason": "non_id_dependency_value",
                            "action": "Replace free-form text with a backlog id (for example RK-M0-0001).",
                        }
                    )
                continue
            normalized.append(dep_id)

        if normalized != deps_raw:
            item["dependencies"] = normalized
            item["updated_at"] = utc_now_iso()
            changed = True

    if changed:
        queue.save()
    return warnings


def _queued_items_with_unmet_dependencies(queue: QueueManager) -> list[dict[str, Any]]:
    completed_ids = {item["id"] for item in queue.completed}
    blocked_ids = {item["id"] for item in queue.blocked}
    rows: list[dict[str, Any]] = []
    for item in queue.active:
        if item.get("status") != "queued":
            continue
        deps = list(item.get("dependencies", []))
        unmet = [dep for dep in deps if dep not in completed_ids]
        if unmet:
            rows.append(
                {
                    "item_id": item["id"],
                    "title": item.get("title"),
                    "unmet_dependencies": unmet,
                    "blocked_dependencies": [dep for dep in unmet if dep in blocked_ids],
                }
            )
    return rows


def is_non_actionable_blocker_reason(reason: Any) -> bool:
    text = str(reason or "").strip()
    if not text:
        return True
    compact = re.sub(r"\s+", " ", text)
    return bool(NON_ACTIONABLE_BLOCKER_REASON_PATTERN.match(compact))


def find_non_actionable_blocked_items(queue: QueueManager) -> list[dict[str, Any]]:
    completed_ids = {str(item.get("id", "")).strip() for item in queue.completed}
    blocked_ids = {str(item.get("id", "")).strip() for item in queue.blocked if str(item.get("id", "")).strip()}

    dependents_by_blocked: dict[str, set[str]] = {item_id: set() for item_id in blocked_ids}
    for queued in queue.active:
        if queued.get("status") != "queued":
            continue
        queued_id = str(queued.get("id", "")).strip()
        if not queued_id:
            continue
        deps_raw = queued.get("dependencies", [])
        if not isinstance(deps_raw, list):
            continue
        deps = {str(dep).strip() for dep in deps_raw if str(dep).strip()}
        for dep_id in deps.intersection(blocked_ids):
            dependents_by_blocked.setdefault(dep_id, set()).add(queued_id)

    rows: list[dict[str, Any]] = []
    for blocked in queue.blocked:
        item_id = str(blocked.get("id", "")).strip()
        if not item_id:
            continue
        reason = blocked.get("blocker_reason")
        if not is_non_actionable_blocker_reason(reason):
            continue

        deps_raw = blocked.get("dependencies", [])
        dependencies_ready = False
        if isinstance(deps_raw, list):
            deps = [str(dep).strip() for dep in deps_raw if str(dep).strip()]
            dependencies_ready = all(dep in completed_ids for dep in deps)

        dependents = sorted(dependents_by_blocked.get(item_id, set()))
        rows.append(
            {
                "item_id": item_id,
                "blocker_reason": str(reason or ""),
                "dependencies_ready": dependencies_ready,
                "dependent_items": dependents,
                "blocking_dependents": len(dependents),
            }
        )
    return rows


def format_non_actionable_blocked_warning_lines(rows: list[dict[str, Any]], *, max_lines: int = 8) -> list[str]:
    if not rows:
        return []
    rendered: list[str] = []
    for row in rows[:max_lines]:
        item_id = str(row.get("item_id", "<unknown>"))
        reason = str(row.get("blocker_reason", "")).strip() or "<empty>"
        dependencies_ready = bool(row.get("dependencies_ready"))
        dependents = list(row.get("dependent_items", []))
        blocking_dependents = int(row.get("blocking_dependents", len(dependents)))
        action = "auto-requeue on run" if dependencies_ready else "lead triage required"
        if blocking_dependents > 0:
            action += " before queued dependents remain stalled"
        dependents_preview = ", ".join(dependents[:3])
        if len(dependents) > 3:
            dependents_preview += f", +{len(dependents) - 3} more"
        dependents_suffix = f"; dependents=[{dependents_preview}]" if dependents_preview else ""
        rendered.append(
            f"- {item_id}: non-actionable blocker_reason={reason!r}; dependency_ready={str(dependencies_ready).lower()}; "
            f"blocking_dependents={blocking_dependents}{dependents_suffix}. Action: {action}."
        )
    remainder = len(rows) - len(rendered)
    if remainder > 0:
        rendered.append(f"- ... and {remainder} more non-actionable blocked items.")
    return rendered


def _next_auto_blocker_triage_item_id(queue: QueueManager) -> str:
    existing_ids = {item["id"] for item in queue.active} | {item["id"] for item in queue.completed} | {item["id"] for item in queue.blocked}
    i = 1
    while True:
        candidate = f"RK-AUTO-BLOCKER-{i:04d}"
        if candidate not in existing_ids:
            return candidate
        i += 1


def ensure_non_actionable_blocker_triage_item(queue: QueueManager, rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not rows:
        return None
    for existing in queue.active:
        if existing.get("auto_generated") != "non_actionable_blocker_triage":
            continue
        if existing.get("status") in {"queued", "assigned", "running", "validating"}:
            return None

    item = {
        "id": _next_auto_blocker_triage_item_id(queue),
        "title": "Triage non-actionable blocked reasons",
        "description": (
            "The daemon detected blocked items with placeholder or empty blocker reasons (for example '- None.'). "
            "Triage each item with an actionable remediation or unblock decision before they stall queued dependents."
        ),
        "milestone": "M0",
        "type": "qa",
        "priority": "high",
        "owner_role": "lead",
        "preferred_agent": "mara-voss",
        "dependencies": [],
        "inputs": [
            "coordination/backlog/work-items.json",
            "coordination/backlog/blocked-items.json",
            "coordination/runtime/run-history.jsonl",
        ],
        "acceptance_criteria": [
            "Each flagged blocked item has an actionable blocker_reason or is explicitly requeued/closed",
            "Blocked items with complete dependencies are no longer left blocked due to placeholder blocker reasons",
            "Queued dependents no longer wait on blocked parents with non-actionable blocker reasons",
        ],
        "validation_commands": ["python tools/orchestrator.py status"],
        "status": "queued",
        "retry_count": 0,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "estimated_effort": "S",
        "token_budget": 10000,
        "result_summary": None,
        "blocker_reason": None,
        "escalation_target": "Mara Voss",
        "auto_generated": "non_actionable_blocker_triage",
        "non_actionable_blocked_snapshot": rows,
    }
    queue.append_item(item)
    queue.save()
    return item


def guard_non_actionable_blocked_items(
    queue: QueueManager,
    retry_policy: dict[str, Any],
    *,
    dry_run: bool,
) -> dict[str, Any]:
    cfg = retry_policy.get("non_actionable_blocker_guard", {}) if isinstance(retry_policy, dict) else {}
    if not isinstance(cfg, dict):
        cfg = {}

    enabled_raw = cfg.get("enabled", True)
    enabled = bool(enabled_raw) if isinstance(enabled_raw, bool) else str(enabled_raw).strip().lower() in {"1", "true", "yes", "on"}
    rows = find_non_actionable_blocked_items(queue)
    result: dict[str, Any] = {
        "enabled": enabled,
        "flagged": rows,
        "auto_requeued": [],
        "triage_item_id": None,
        "changed": False,
    }
    if not enabled or not rows:
        return result

    auto_requeue_raw = cfg.get("auto_requeue_dependency_ready", True)
    auto_requeue = bool(auto_requeue_raw) if isinstance(auto_requeue_raw, bool) else str(auto_requeue_raw).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    route_lead_triage_raw = cfg.get("route_lead_triage", True)
    route_lead_triage = (
        bool(route_lead_triage_raw)
        if isinstance(route_lead_triage_raw, bool)
        else str(route_lead_triage_raw).strip().lower() in {"1", "true", "yes", "on"}
    )
    triage_only_when_blocking_raw = cfg.get("triage_only_when_blocking_dependents", True)
    triage_only_when_blocking = (
        bool(triage_only_when_blocking_raw)
        if isinstance(triage_only_when_blocking_raw, bool)
        else str(triage_only_when_blocking_raw).strip().lower() in {"1", "true", "yes", "on"}
    )
    try:
        max_auto_requeue = max(0, int(cfg.get("max_auto_requeue_per_cycle", 5)))
    except (TypeError, ValueError):
        max_auto_requeue = 5

    auto_requeued: list[str] = []
    if auto_requeue and not dry_run and max_auto_requeue > 0:
        for row in rows:
            if len(auto_requeued) >= max_auto_requeue:
                break
            if not bool(row.get("dependencies_ready")):
                continue
            item_id = str(row.get("item_id", "")).strip()
            if not item_id:
                continue
            did_requeue = queue.requeue_blocked(
                item_id,
                reason="automatic non-actionable blocker recovery (dependency-ready)",
            )
            if did_requeue:
                auto_requeued.append(item_id)

    if auto_requeued:
        queue.save()
        result["changed"] = True
    result["auto_requeued"] = auto_requeued

    remaining_rows = [row for row in rows if str(row.get("item_id", "")).strip() not in set(auto_requeued)]
    triage_rows = remaining_rows
    if triage_only_when_blocking:
        triage_rows = [row for row in remaining_rows if int(row.get("blocking_dependents", 0)) > 0]

    if route_lead_triage and triage_rows and not dry_run:
        triage_item = ensure_non_actionable_blocker_triage_item(queue, triage_rows)
        if triage_item is not None:
            result["triage_item_id"] = triage_item.get("id")
            result["changed"] = True

    return result


def _next_auto_stall_item_id(queue: QueueManager) -> str:
    existing_ids = {item["id"] for item in queue.active} | {item["id"] for item in queue.completed} | {item["id"] for item in queue.blocked}
    i = 1
    while True:
        candidate = f"RK-AUTO-STALL-{i:04d}"
        if candidate not in existing_ids:
            return candidate
        i += 1


def _canonical_stall_snapshot(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for row in rows:
        item_id = str(row.get("item_id", "")).strip()
        deps_raw = row.get("blocked_dependencies", [])
        if not item_id or not isinstance(deps_raw, list):
            continue
        deps = sorted({str(dep).strip() for dep in deps_raw if str(dep).strip()})
        if not deps:
            continue
        normalized.append({"item_id": item_id, "blocked_dependencies": deps})
    normalized.sort(key=lambda entry: (entry["item_id"], ",".join(entry["blocked_dependencies"])))
    return normalized


def _stall_snapshot_signature(snapshot: list[dict[str, Any]]) -> tuple[tuple[str, tuple[str, ...]], ...]:
    signature: list[tuple[str, tuple[str, ...]]] = []
    for entry in snapshot:
        item_id = str(entry.get("item_id", "")).strip()
        deps_raw = entry.get("blocked_dependencies", [])
        if not item_id or not isinstance(deps_raw, list):
            continue
        deps = tuple(str(dep).strip() for dep in deps_raw if str(dep).strip())
        if not deps:
            continue
        signature.append((item_id, deps))
    return tuple(signature)


def _stall_item_signature(item: dict[str, Any]) -> tuple[tuple[str, tuple[str, ...]], ...]:
    snapshot_raw = item.get("stall_snapshot", [])
    if not isinstance(snapshot_raw, list):
        return ()
    canonical = _canonical_stall_snapshot(snapshot_raw)
    return _stall_snapshot_signature(canonical)


def _latest_stall_recovery_timestamp(
    queue: QueueManager,
    *,
    signature: tuple[tuple[str, tuple[str, ...]], ...],
) -> datetime | None:
    latest: datetime | None = None
    for existing in [*queue.active, *queue.completed, *queue.blocked]:
        if existing.get("auto_generated") != "queue_stall_recovery":
            continue
        if _stall_item_signature(existing) != signature:
            continue
        ts = _parse_iso_datetime(existing.get("updated_at")) or _parse_iso_datetime(existing.get("created_at"))
        if ts is None:
            continue
        if latest is None or ts > latest:
            latest = ts
    return latest


def _next_auto_refill_item_id(queue: QueueManager) -> str:
    existing_ids = {item["id"] for item in queue.active} | {item["id"] for item in queue.completed} | {item["id"] for item in queue.blocked}
    i = 1
    while True:
        candidate = f"RK-AUTO-BACKLOG-{i:04d}"
        if candidate not in existing_ids:
            return candidate
        i += 1


def _next_auto_platform_item_id(queue: QueueManager) -> str:
    existing_ids = {item["id"] for item in queue.active} | {item["id"] for item in queue.completed} | {item["id"] for item in queue.blocked}
    i = 1
    while True:
        candidate = f"RK-AUTO-PLATFORM-{i:04d}"
        if candidate not in existing_ids:
            return candidate
        i += 1


def _next_human_item_id(queue: QueueManager) -> str:
    existing_ids = {item["id"] for item in queue.active} | {item["id"] for item in queue.completed} | {item["id"] for item in queue.blocked}
    i = 1
    while True:
        candidate = f"RK-HUMAN-{i:04d}"
        if candidate not in existing_ids:
            return candidate
        i += 1


def ensure_queue_stall_recovery_item(queue: QueueManager) -> dict[str, Any] | None:
    stalled = _queued_items_with_unmet_dependencies(queue)
    if not stalled:
        return None

    snapshot = _canonical_stall_snapshot(stalled)
    if not snapshot:
        return None
    signature = _stall_snapshot_signature(snapshot)

    # Avoid generating duplicates while one is already in-flight.
    for item in queue.active:
        if item.get("auto_generated") != "queue_stall_recovery":
            continue
        if item.get("status") in {"queued", "assigned", "running", "validating"}:
            return None

    if STALL_RECOVERY_COOLDOWN_SECONDS > 0:
        latest_ts = _latest_stall_recovery_timestamp(queue, signature=signature)
        if latest_ts is not None:
            age_seconds = (datetime.now(timezone.utc) - latest_ts.astimezone(timezone.utc)).total_seconds()
            if age_seconds < STALL_RECOVERY_COOLDOWN_SECONDS:
                return None

    item = {
        "id": _next_auto_stall_item_id(queue),
        "title": "Resolve queue dependency stall",
        "description": (
            "The daemon detected queued work items that are not dependency-ready because one or more dependencies "
            "are currently blocked. Review blocked items, requeue/close obsolete items, and restore runnable work."
        ),
        "milestone": "M0",
        "type": "qa",
        "priority": "high",
        "owner_role": "lead",
        "preferred_agent": "mara-voss",
        "dependencies": [],
        "inputs": [
            "coordination/backlog/work-items.json",
            "coordination/backlog/blocked-items.json",
            "coordination/runtime/run-history.jsonl",
        ],
        "acceptance_criteria": [
            "At least one dependency-stalled queued item is made runnable or explicitly closed",
            "Blocked/obsolete queue artifacts are documented or consolidated",
            "Backlog no longer stalls immediately on next daemon run",
        ],
        "validation_commands": ["python tools/orchestrator.py status"],
        "status": "queued",
        "retry_count": 0,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "estimated_effort": "S",
        "token_budget": 10000,
        "result_summary": None,
        "blocker_reason": None,
        "escalation_target": "Mara Voss",
        "auto_generated": "queue_stall_recovery",
        "stall_snapshot": snapshot,
        "stall_fingerprint": "|".join(f"{item_id}:{','.join(deps)}" for item_id, deps in signature),
    }
    queue.append_item(item)
    queue.save()
    return item


def ensure_backlog_refill_item(queue: QueueManager) -> dict[str, Any] | None:
    queued_count = sum(1 for item in queue.active if item.get("status") == "queued")
    if queued_count >= LOW_QUEUE_WATERMARK:
        return None

    for item in queue.active:
        if item.get("status") == "queued" and item.get("auto_generated") == "backlog_refill":
            return None

    item = {
        "id": _next_auto_refill_item_id(queue),
        "title": "Generate next backlog tranche",
        "description": (
            "Queue is running low. Review completed/blocked work and generate the next set of concrete implementation "
            "tasks across backend, frontend, design, content, QA, and platform/release with dependencies and acceptance criteria. "
            "Keep the backlog inside the first vertical slice scope and defer out-of-scope ideas."
        ),
        "milestone": "M0",
        "type": "qa",
        "priority": "high",
        "owner_role": "lead",
        "preferred_agent": "mara-voss",
        "dependencies": [],
        "inputs": [
            "coordination/backlog/work-items.json",
            "coordination/backlog/completed-items.json",
            "coordination/backlog/blocked-items.json",
            "docs/design/first-vertical-slice.md",
            "coordination/runtime/run-history.jsonl",
        ],
        "acceptance_criteria": [
            "At least 3 new queued tasks are created or requeued",
            "Each task has owner_role, dependencies, and acceptance criteria",
            "Tasks reflect current project priorities and unblock progress",
            "Tasks stay within first vertical slice scope; out-of-scope ideas are deferred",
        ],
        "validation_commands": ["python tools/orchestrator.py status"],
        "status": "queued",
        "retry_count": 0,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "estimated_effort": "S",
        "token_budget": 12000,
        "result_summary": None,
        "blocker_reason": None,
        "escalation_target": "Mara Voss",
        "auto_generated": "backlog_refill",
    }
    queue.append_item(item)
    queue.save()
    return item


def ensure_platform_bootstrap_item(queue: QueueManager, agents: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    platform_agent_id = "juno-cairn"
    if platform_agent_id not in agents:
        return None

    has_platform_work = any(item.get("owner_role") == "platform" for item in queue.active)
    has_platform_history = any(item.get("owner_role") == "platform" for item in queue.completed) or any(
        item.get("owner_role") == "platform" for item in queue.blocked
    )
    if has_platform_work or has_platform_history:
        return None

    item = {
        "id": _next_auto_platform_item_id(queue),
        "title": "Bootstrap platform release lane for vertical slice",
        "description": (
            "Create the first platform/release execution task for web, Steam wrapper, and Android wrapper pathways "
            "so cross-platform delivery work is represented in the active backlog."
        ),
        "milestone": "M0",
        "type": "infra",
        "priority": "high",
        "owner_role": "platform",
        "preferred_agent": platform_agent_id,
        "dependencies": [],
        "inputs": [
            "docs/architecture/client-cross-platform-strategy.md",
            "docs/design/first-vertical-slice.md",
            "docs/operations/daemon-usage.md",
        ],
        "acceptance_criteria": [
            "Platform lane creates concrete follow-up implementation tasks for web, Steam, and Android packaging readiness",
            "Follow-up tasks stay inside first vertical slice scope",
            "Release flow relies on placeholder assets and does not block on final art",
        ],
        "validation_commands": ["python tools/orchestrator.py status"],
        "status": "queued",
        "retry_count": 0,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "estimated_effort": "S",
        "token_budget": 9000,
        "result_summary": None,
        "blocker_reason": None,
        "escalation_target": "Mara Voss",
        "auto_generated": "platform_bootstrap",
    }
    queue.append_item(item)
    queue.save()
    return item


def _safe_human_instruction_relpath(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    rel = value.strip().replace("\\", "/")
    if not rel:
        return None
    path = Path(rel)
    if path.is_absolute():
        return None
    parts = path.parts
    if not parts or parts[0] != "Human":
        return None
    if any(part in {"..", ""} for part in parts):
        return None
    return Path(*parts).as_posix()


def _resolved_human_instruction_path(rel_path: str) -> Path | None:
    human_root = HUMAN_DIR.resolve()
    candidate = (ROOT / rel_path).resolve()
    if not candidate.is_relative_to(human_root):
        return None
    return candidate


def ensure_human_instruction_items(queue: QueueManager, agents: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    if "mara-voss" not in agents:
        return []

    HUMAN_DIR.mkdir(parents=True, exist_ok=True)
    try:
        files = [path for path in HUMAN_DIR.iterdir() if path.is_file()]
    except Exception:
        return []
    files.sort(key=lambda p: p.name.lower())

    tracked_paths: set[str] = set()
    for item in [*queue.active, *queue.completed, *queue.blocked]:
        tracked = _safe_human_instruction_relpath(item.get("human_instruction_file"))
        if tracked:
            tracked_paths.add(tracked.lower())

    created: list[dict[str, str]] = []
    for file_path in files:
        if file_path.name.startswith(".") or file_path.name.lower().startswith("readme"):
            continue
        rel = file_path.relative_to(ROOT).as_posix()
        if rel.lower() in tracked_paths:
            continue

        item = {
            "id": _next_human_item_id(queue),
            "title": f"Human instruction intake: {file_path.name}",
            "description": (
                "Parse the human instruction file, convert it into concrete backlog tasks with owners/dependencies/"
                "acceptance criteria, and route work across agents while preserving first-slice scope."
            ),
            "milestone": "M0",
            "type": "qa",
            "priority": "critical",
            "owner_role": "lead",
            "preferred_agent": "mara-voss",
            "dependencies": [],
            "inputs": [
                rel,
                "coordination/backlog/work-items.json",
                "coordination/backlog/completed-items.json",
                "coordination/backlog/blocked-items.json",
                "docs/design/first-vertical-slice.md",
            ],
            "acceptance_criteria": [
                "Human instruction is decomposed into concrete implementation tasks with explicit owner_role assignments",
                "New tasks include dependencies, acceptance criteria, and stay within first vertical slice scope",
                "Lead outbox records a concise triage summary and generated follow-up tasks",
            ],
            "validation_commands": ["python tools/orchestrator.py status"],
            "status": "queued",
            "retry_count": 0,
            "created_at": utc_now_iso(),
            "updated_at": utc_now_iso(),
            "estimated_effort": "S",
            "token_budget": 12000,
            "result_summary": None,
            "blocker_reason": None,
            "escalation_target": "Mara Voss",
            "auto_generated": "human_instruction_intake",
            "human_instruction_file": rel,
        }
        queue.append_item(item)
        tracked_paths.add(rel.lower())
        created.append({"item_id": item["id"], "file": rel})

    if created:
        queue.save()
    return created


def consume_human_instruction_file(item: dict[str, Any]) -> tuple[bool, str]:
    rel = _safe_human_instruction_relpath(item.get("human_instruction_file"))
    if not rel:
        return False, "missing_or_invalid_human_instruction_file"
    path = _resolved_human_instruction_path(rel)
    if path is None:
        return False, "path_outside_human_root"
    if not path.exists():
        return False, "already_missing"
    if not path.is_file():
        return False, "not_a_file"
    try:
        path.unlink()
    except OSError as exc:
        return False, f"delete_failed:{exc}"
    return True, "deleted"


def _parse_iso_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _matches_any_pattern(text: str, patterns: list[str]) -> bool:
    lowered = text.lower()
    return any(pattern and pattern in lowered for pattern in patterns)


def revisit_recoverable_blocked_items(queue: QueueManager, retry_policy: dict[str, Any]) -> list[str]:
    cfg = retry_policy.get("blocked_revisit", {}) if isinstance(retry_policy, dict) else {}
    if not isinstance(cfg, dict):
        return []

    enabled_raw = cfg.get("enabled", True)
    enabled = bool(enabled_raw) if isinstance(enabled_raw, bool) else str(enabled_raw).strip().lower() in {"1", "true", "yes", "on"}
    if not enabled:
        return []

    try:
        max_items_per_cycle = max(1, int(cfg.get("max_items_per_cycle", 1)))
    except (TypeError, ValueError):
        max_items_per_cycle = 1
    try:
        max_attempts_per_item = max(1, int(cfg.get("max_attempts_per_item", 2)))
    except (TypeError, ValueError):
        max_attempts_per_item = 2
    try:
        cooldown_seconds = max(0, int(cfg.get("cooldown_seconds", 1800)))
    except (TypeError, ValueError):
        cooldown_seconds = 1800

    include_patterns = [str(p).strip().lower() for p in cfg.get("include_reason_patterns", []) if str(p).strip()]
    exclude_patterns = [str(p).strip().lower() for p in cfg.get("exclude_reason_patterns", []) if str(p).strip()]

    now = datetime.now(timezone.utc)
    completed_ids = queue.completed_ids()
    reopened_ids: list[str] = []

    for item in list(queue.blocked):
        if len(reopened_ids) >= max_items_per_cycle:
            break
        item_id = str(item.get("id", "")).strip()
        if not item_id:
            continue

        attempts = int(item.get("blocked_revisit_count", 0))
        if attempts >= max_attempts_per_item:
            continue

        dependencies = item.get("dependencies", [])
        if isinstance(dependencies, list) and any(str(dep) not in completed_ids for dep in dependencies):
            continue

        reason = str(item.get("blocker_reason", "") or "")
        if include_patterns and not _matches_any_pattern(reason, include_patterns):
            continue
        if exclude_patterns and _matches_any_pattern(reason, exclude_patterns):
            continue

        last_ts = _parse_iso_datetime(item.get("updated_at")) or _parse_iso_datetime(item.get("created_at"))
        if last_ts is not None and cooldown_seconds > 0:
            age_seconds = (now - last_ts).total_seconds()
            if age_seconds < cooldown_seconds:
                continue

        did_requeue = queue.requeue_blocked(
            item_id,
            reason=f"automatic blocked revisit ({attempts + 1}/{max_attempts_per_item})",
        )
        if did_requeue:
            reopened_ids.append(item_id)

    if reopened_ids:
        queue.save()
    return reopened_ids


def archive_non_actionable_blocked_items(queue: QueueManager, retry_policy: dict[str, Any]) -> list[str]:
    cfg = retry_policy.get("blocked_archive", {}) if isinstance(retry_policy, dict) else {}
    if not isinstance(cfg, dict):
        return []

    enabled_raw = cfg.get("enabled", False)
    enabled = bool(enabled_raw) if isinstance(enabled_raw, bool) else str(enabled_raw).strip().lower() in {"1", "true", "yes", "on"}
    if not enabled:
        return []

    try:
        max_items_per_cycle = max(1, int(cfg.get("max_items_per_cycle", 10)))
    except (TypeError, ValueError):
        max_items_per_cycle = 10

    include_patterns = [str(p).strip().lower() for p in cfg.get("include_reason_patterns", []) if str(p).strip()]
    exclude_patterns = [str(p).strip().lower() for p in cfg.get("exclude_reason_patterns", []) if str(p).strip()]
    if not include_patterns:
        return []

    archived_rows = load_json(BLOCKED_ARCHIVED_PATH, [])
    if not isinstance(archived_rows, list):
        archived_rows = []

    archived_items: list[dict[str, Any]] = []
    remaining_blocked: list[dict[str, Any]] = []
    moved_ids: list[str] = []

    for item in queue.blocked:
        if len(moved_ids) >= max_items_per_cycle:
            remaining_blocked.append(item)
            continue
        reason = str(item.get("blocker_reason", "") or "")
        lowered_reason = reason.lower()
        if not _matches_any_pattern(lowered_reason, include_patterns):
            remaining_blocked.append(item)
            continue
        if exclude_patterns and _matches_any_pattern(lowered_reason, exclude_patterns):
            remaining_blocked.append(item)
            continue
        item_id = str(item.get("id", "")).strip()
        if not item_id:
            remaining_blocked.append(item)
            continue

        archived = dict(item)
        archived["archived_at"] = utc_now_iso()
        archived["archive_reason"] = "non_actionable_blocked"
        archived_items.append(archived)
        moved_ids.append(item_id)

    if not moved_ids:
        return []

    moved_set = {item_id for item_id in moved_ids}
    preserved_archived = [row for row in archived_rows if str(row.get("id", "")).strip() not in moved_set]
    preserved_archived.extend(archived_items)
    save_json_atomic(BLOCKED_ARCHIVED_PATH, preserved_archived)

    queue.blocked = remaining_blocked
    queue.save()
    return moved_ids


def _dedupe_by_item_id(items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    selected: dict[str, tuple[datetime, int, dict[str, Any]]] = {}
    invalid_items: list[dict[str, Any]] = []
    duplicate_ids: set[str] = set()

    for idx, item in enumerate(items):
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id.strip():
            invalid_items.append(item)
            continue
        canonical_id = item_id.strip()
        ts = _parse_iso_datetime(item.get("updated_at")) or _parse_iso_datetime(item.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)
        existing = selected.get(canonical_id)
        if existing is None:
            selected[canonical_id] = (ts, idx, item)
            continue
        duplicate_ids.add(canonical_id)
        current_ts, current_idx, _ = existing
        if ts > current_ts or (ts == current_ts and idx > current_idx):
            selected[canonical_id] = (ts, idx, item)

    deduped = [entry[2] for entry in sorted(selected.values(), key=lambda row: row[1])]
    if invalid_items:
        deduped.extend(invalid_items)
    return deduped, sorted(duplicate_ids)


def repair_backlog_archive_duplicates(root: Path) -> dict[str, Any]:
    completed_path = root / "coordination" / "backlog" / "completed-items.json"
    blocked_path = root / "coordination" / "backlog" / "blocked-items.json"
    result = {
        "completed_removed": 0,
        "blocked_removed": 0,
        "completed_duplicate_ids": [],
        "blocked_duplicate_ids": [],
    }

    for path, field_prefix in [(completed_path, "completed"), (blocked_path, "blocked")]:
        data = load_json(path, [])
        if not isinstance(data, list):
            continue
        deduped, duplicate_ids = _dedupe_by_item_id(data)
        removed = len(data) - len(deduped)
        if removed <= 0:
            continue
        save_json_atomic(path, deduped)
        result[f"{field_prefix}_removed"] = removed
        result[f"{field_prefix}_duplicate_ids"] = duplicate_ids
    return result


def _coerce_string_list(value: Any, *, field: str, errors: list[str]) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        errors.append(f"{field} must be a list of strings")
        return []
    out: list[str] = []
    for idx, item in enumerate(value):
        if not isinstance(item, str):
            errors.append(f"{field}[{idx}] must be a string")
            continue
        out.append(item)
    return out


def _validate_and_normalize_generated_task(
    *,
    raw: Any,
    source_item: dict[str, Any],
    agent_id: str,
    queue: QueueManager,
    valid_owner_roles: set[str],
) -> tuple[dict[str, Any] | None, list[str]]:
    if not isinstance(raw, dict):
        return None, ["task entry must be an object"]

    errors: list[str] = []
    title = raw.get("title")
    owner_role = raw.get("owner_role")
    description = raw.get("description")
    acceptance_criteria = raw.get("acceptance_criteria")

    if not isinstance(title, str) or not title.strip():
        errors.append("missing/invalid title")
    if not isinstance(owner_role, str) or not owner_role.strip():
        errors.append("missing/invalid owner_role")
    elif owner_role.strip() not in valid_owner_roles:
        errors.append(f"owner_role must be one of {sorted(valid_owner_roles)}")
    if not isinstance(description, str) or not description.strip():
        errors.append("missing/invalid description")
    if not isinstance(acceptance_criteria, list) or not acceptance_criteria:
        errors.append("missing/invalid acceptance_criteria (non-empty list required)")
    elif not all(isinstance(item, str) and item.strip() for item in acceptance_criteria):
        errors.append("acceptance_criteria entries must be non-empty strings")

    deps = _coerce_string_list(raw.get("dependencies", [source_item["id"]]), field="dependencies", errors=errors)
    inputs = _coerce_string_list(raw.get("inputs", []), field="inputs", errors=errors)
    validations = _coerce_string_list(raw.get("validation_commands", []), field="validation_commands", errors=errors)

    token_budget_raw = raw.get("token_budget", 8000)
    try:
        token_budget = int(token_budget_raw)
    except Exception:
        errors.append("token_budget must be an integer")
        token_budget = 8000
    if token_budget < 1:
        errors.append("token_budget must be >= 1")
        token_budget = 8000

    if errors:
        return None, errors

    sanitized = dict(raw)
    sanitized["title"] = str(title).strip()
    sanitized["owner_role"] = str(owner_role).strip()
    sanitized["description"] = str(description).strip()
    sanitized["acceptance_criteria"] = [str(item).strip() for item in acceptance_criteria]
    sanitized["dependencies"] = deps
    sanitized["inputs"] = inputs
    sanitized["validation_commands"] = validations
    sanitized["token_budget"] = token_budget

    normalized = _normalize_generated_task(source_item, agent_id, sanitized, queue)
    if normalized is None:
        return None, ["normalization failed"]
    return normalized, []


def _normalize_generated_task(source_item: dict[str, Any], agent_id: str, raw: dict[str, Any], queue: QueueManager) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    title = str(raw.get("title", "")).strip()
    owner_role = str(raw.get("owner_role", "")).strip()
    if not title or not owner_role:
        return None

    existing_ids = {item["id"] for item in queue.active} | {item["id"] for item in queue.completed} | {item["id"] for item in queue.blocked}
    explicit_id = str(raw.get("id", "")).strip()
    item_id = explicit_id if explicit_id and explicit_id not in existing_ids else None
    if not item_id:
        base = source_item.get("id", "RK-GEN")
        i = 1
        while True:
            candidate = f"{base}-F{i:02d}"
            if candidate not in existing_ids:
                item_id = candidate
                break
            i += 1

    priority_raw = str(raw.get("priority", "normal")).strip().lower()
    priority_map = {
        "urgent": "critical",
        "critical": "critical",
        "high": "high",
        "medium": "normal",
        "med": "normal",
        "normal": "normal",
        "default": "normal",
        "low": "low",
    }
    priority = priority_map.get(priority_raw, "normal")

    item_type_raw = str(raw.get("type", "feature")).strip().lower()
    type_map = {
        "feature": "feature",
        "bug": "bug",
        "docs": "docs",
        "doc": "docs",
        "infra": "infra",
        "design": "design",
        "qa": "qa",
        "test": "qa",
        "refactor": "refactor",
    }
    item_type = type_map.get(item_type_raw, "feature")

    return {
        "id": item_id,
        "title": title,
        "description": str(raw.get("description", f"Follow-up generated by {agent_id} from {source_item['id']}")).strip(),
        "milestone": str(raw.get("milestone", source_item.get("milestone", "M1"))),
        "type": item_type,
        "priority": priority,
        "owner_role": owner_role,
        "preferred_agent": raw.get("preferred_agent"),
        "dependencies": list(raw.get("dependencies", [source_item["id"]])),
        "inputs": list(raw.get("inputs", [])),
        "acceptance_criteria": list(raw.get("acceptance_criteria", ["Define explicit acceptance criteria"])),
        "validation_commands": list(raw.get("validation_commands", [])),
        "status": "queued",
        "retry_count": 0,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "estimated_effort": str(raw.get("estimated_effort", "S")),
        "token_budget": int(raw.get("token_budget", 8000)),
        "result_summary": None,
        "blocker_reason": None,
        "escalation_target": "Mara Voss",
        "generated_by_agent": agent_id,
        "generated_from_item_id": source_item["id"],
    }


def ingest_agent_follow_up_tasks(
    queue: QueueManager,
    *,
    agent_id: str,
    source_item: dict[str, Any],
    routing_rules: dict[str, Any],
) -> tuple[list[str], list[dict[str, Any]]]:
    outbox_path = ROOT / "agents" / agent_id / "outbox.json"
    try:
        data = load_json(outbox_path, [])
    except Exception as exc:
        return [], [{"entry": source_item["id"], "errors": [f"failed reading outbox.json: {exc}"]}]
    if not isinstance(data, list):
        return [], [{"entry": "outbox_root", "errors": ["outbox.json root must be a list"]}]

    candidates: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    for entry in reversed(data):
        if not isinstance(entry, dict):
            continue
        entry_item_id = entry.get("item_id") or entry.get("work_item_id")
        if entry_item_id != source_item["id"]:
            continue
        proposed = entry.get("proposed_work_items")
        if proposed is None:
            break
        if not isinstance(proposed, list):
            rejected.append({"entry": entry_item_id, "errors": ["proposed_work_items must be a list"]})
            break
        candidates.extend(proposed)
        break

    created_ids: list[str] = []
    valid_owner_roles = set((routing_rules.get("owner_role_map") or {}).keys())
    for raw in candidates:
        normalized, errors = _validate_and_normalize_generated_task(
            raw=raw,
            source_item=source_item,
            agent_id=agent_id,
            queue=queue,
            valid_owner_roles=valid_owner_roles,
        )
        if errors:
            rejected.append({"entry": raw if isinstance(raw, dict) else repr(raw), "errors": errors})
            continue
        if not normalized:
            continue
        queue.append_item(normalized)
        created_ids.append(normalized["id"])

    if created_ids:
        queue.save()
    return created_ids, rejected


def recover_stale_in_progress_items(
    queue: QueueManager,
    *,
    archived_ids: set[str] | None = None,
) -> tuple[list[str], list[dict[str, str]]]:
    recovered: list[str] = []
    archived_dispositions: list[dict[str, str]] = []
    active_after_recovery: list[dict[str, Any]] = []
    changed = False
    archived = archived_ids if archived_ids is not None else load_blocked_archived_ids()
    stale_statuses = {"assigned", "running", "validating"}

    for item in queue.active:
        item_id = str(item.get("id", "")).strip()
        status = str(item.get("status", "")).strip().lower()
        if item_id and item_id in archived:
            disposition = "skip_requeue_archived_stale_item" if status in stale_statuses else "remove_archived_active_item"
            archived_dispositions.append(
                {
                    "item_id": item_id,
                    "prior_status": status or "unknown",
                    "disposition": disposition,
                    "reason": "id_present_in_blocked_archived_backlog",
                }
            )
            changed = True
            continue
        if status in stale_statuses:
            item["status"] = "queued"
            item["updated_at"] = utc_now_iso()
            item["recovered_from_stale_in_progress"] = True
            recovered.append(item_id)
            changed = True
        active_after_recovery.append(item)
    if changed:
        queue.active = active_after_recovery
        queue.save()
    return recovered, archived_dispositions


def build_status_payload(
    *,
    daemon_state: dict[str, Any],
    queue: QueueManager,
    stats: dict[str, Any],
    agents: dict[str, dict[str, Any]] | None = None,
    routing_rules: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"daemon": daemon_state, "queue": queue_counts(queue), "agent_stats": stats}
    if agents is not None and routing_rules is not None:
        payload["agent_workload"] = build_agent_workload_payload(queue=queue, agents=agents, routing_rules=routing_rules)
    return payload


def build_agent_workload_payload(
    *,
    queue: QueueManager,
    agents: dict[str, dict[str, Any]],
    routing_rules: dict[str, Any],
) -> dict[str, Any]:
    completed_ids = {str(item.get("id", "")).strip() for item in queue.completed if isinstance(item, dict)}
    counts: dict[str, dict[str, int]] = {}

    for agent_id in agents:
        counts[agent_id] = {
            "ready": 0,
            "waiting": 0,
            "running": 0,
            "blocked": 0,
            "completed": 0,
            "open": 0,
        }

    def _owner_agent(item: dict[str, Any]) -> str:
        agent_id, _cfg = select_agent_for_item(item, agents, routing_rules)
        if agent_id not in counts:
            counts[agent_id] = {
                "ready": 0,
                "waiting": 0,
                "running": 0,
                "blocked": 0,
                "completed": 0,
                "open": 0,
            }
        return agent_id

    def _is_dependency_ready(item: dict[str, Any]) -> bool:
        deps_raw = item.get("dependencies", [])
        if not isinstance(deps_raw, list):
            return False
        deps = [str(dep).strip() for dep in deps_raw if str(dep).strip()]
        return all(dep in completed_ids for dep in deps)

    for item in queue.active:
        if not isinstance(item, dict):
            continue
        agent_id = _owner_agent(item)
        status = str(item.get("status", "")).strip().lower()
        if status == "queued":
            if _is_dependency_ready(item):
                counts[agent_id]["ready"] += 1
            else:
                counts[agent_id]["waiting"] += 1
            counts[agent_id]["open"] += 1
            continue
        if status in {"assigned", "running", "validating"}:
            counts[agent_id]["running"] += 1
            counts[agent_id]["open"] += 1
            continue

    for item in queue.blocked:
        if not isinstance(item, dict):
            continue
        agent_id = _owner_agent(item)
        counts[agent_id]["blocked"] += 1

    for item in queue.completed:
        if not isinstance(item, dict):
            continue
        agent_id = _owner_agent(item)
        counts[agent_id]["completed"] += 1

    return {"agents": counts}


def select_agent_for_item(item: dict[str, Any], agents: dict[str, dict[str, Any]], routing: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    owner_map = routing.get("owner_role_map", {})
    agent_id = item.get("preferred_agent") or owner_map.get(item["owner_role"])
    if not agent_id or agent_id not in agents:
        fallback = routing.get("fallback_agent", "mara-voss")
        agent_id = fallback if fallback in agents else next(iter(agents))
    return agent_id, agents[agent_id]


def resolve_execution_profile(
    *,
    agent_id: str,
    agent_cfg: dict[str, Any],
    model_policy: dict[str, Any],
    item: dict[str, Any] | None = None,
) -> dict[str, str | None]:
    def _clean(value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    policy_agent_models = model_policy.get("agent_models", {})
    policy_cfg = policy_agent_models.get(agent_id, {}) if isinstance(policy_agent_models, dict) else {}

    model = _clean(policy_cfg.get("model")) or _clean(agent_cfg.get("model"))
    reasoning = _clean(policy_cfg.get("reasoning")) or _clean(agent_cfg.get("reasoning"))
    selection_reason = "agent_policy"

    def _effort_rank(value: Any) -> int | None:
        if value is None:
            return None
        text = str(value).strip().upper()
        if not text:
            return None
        ranks = {"XS": 0, "S": 1, "M": 2, "L": 3, "XL": 4}
        return ranks.get(text)

    def _as_int(value: Any) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    if item is not None:
        retry_count_raw = item.get("retry_count", 0)
        try:
            retry_count = int(retry_count_raw)
        except (TypeError, ValueError):
            retry_count = 0
        priority = str(item.get("priority", "")).strip().lower()
        owner_role = str(item.get("owner_role", "")).strip().lower()

        # Optional policy rule: use a cheaper/faster model only for lightweight tasks.
        # This keeps lead/backend heavy work on stronger defaults while allowing Spark
        # for small maintenance/spec chores.
        light_cfg = model_policy.get("lightweight_task_override", {}) or {}
        if isinstance(light_cfg, dict) and retry_count == 0 and priority != "critical":
            applies_to_roles = light_cfg.get("apply_to_roles")
            role_ok = True
            if isinstance(applies_to_roles, list) and applies_to_roles:
                role_ok = owner_role in {str(role).strip().lower() for role in applies_to_roles}

            allowed_priorities_raw = light_cfg.get("allowed_priorities")
            priority_ok = True
            if isinstance(allowed_priorities_raw, list) and allowed_priorities_raw:
                allowed_priorities = {str(p).strip().lower() for p in allowed_priorities_raw if str(p).strip()}
                priority_ok = priority in allowed_priorities if allowed_priorities else True

            max_effort_rank = _effort_rank(light_cfg.get("max_estimated_effort"))
            item_effort_rank = _effort_rank(item.get("estimated_effort"))
            effort_ok = (
                max_effort_rank is None
                or item_effort_rank is None
                or item_effort_rank <= max_effort_rank
            )

            max_tokens = _as_int(light_cfg.get("max_token_budget"))
            item_tokens = _as_int(item.get("token_budget"))
            token_ok = max_tokens is None or item_tokens is None or item_tokens <= max_tokens

            light_model = _clean(light_cfg.get("model"))
            light_reasoning = _clean(light_cfg.get("reasoning"))
            if role_ok and priority_ok and effort_ok and token_ok and light_model:
                model = light_model
                selection_reason = "lightweight_task_override"
            if role_ok and priority_ok and effort_ok and token_ok and light_reasoning:
                reasoning = light_reasoning

        should_upgrade = priority == "critical" or retry_count > 0
        escalation_cfg = (model_policy.get("escalation_upgrade", {}) or {}).get("critical_or_repeated_failure", {})
        if should_upgrade and isinstance(escalation_cfg, dict):
            upgraded_model = _clean(escalation_cfg.get("model"))
            upgraded_reasoning = _clean(escalation_cfg.get("reasoning"))
            if upgraded_model:
                model = upgraded_model
                selection_reason = "escalation_upgrade"
            if upgraded_reasoning:
                reasoning = upgraded_reasoning

    return {
        "model": model,
        "reasoning": reasoning,
        "selection_reason": selection_reason,
    }


def commit_message(agent_name: str, item_id: str, title: str) -> str:
    short = title.strip().replace('"', "'")
    return f"[Agent:{agent_name}][Item:{item_id}] {short}"


def _extract_status_line(text: str) -> tuple[str, str]:
    lines = [raw_line.strip() for raw_line in text.splitlines() if raw_line.strip()]
    for idx, line in enumerate(lines):
        if not line:
            continue
        upper = line.upper()
        if not upper.startswith("STATUS:"):
            continue
        tail = line[len("STATUS:") :].strip()
        if not tail:
            continue
        parts = tail.split(None, 1)
        status = parts[0].strip().upper()
        detail = parts[1].strip() if len(parts) > 1 else ""
        if not detail and idx + 1 < len(lines):
            next_line = lines[idx + 1]
            if not next_line.upper().startswith("STATUS:"):
                detail = next_line
        return status, detail
    return "", ""


def _summarize_validation_results(validation_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for result in validation_results:
        if not isinstance(result, dict):
            continue
        command = str(result.get("command", "")).strip()
        exit_code_raw = result.get("exit_code", 0)
        try:
            exit_code = int(exit_code_raw)
        except (TypeError, ValueError):
            exit_code = -1
        stdout_tail = str(result.get("stdout_tail", ""))
        stderr_tail = str(result.get("stderr_tail", ""))
        combined_text = f"{stdout_tail}\n{stderr_tail}"
        status, detail = _extract_status_line(combined_text)
        if not status:
            status = "COMPLETED" if exit_code == 0 else "FAILED"
        summary: dict[str, Any] = {
            "command": command,
            "exit_code": exit_code,
            "status": status,
        }
        if detail:
            summary["detail"] = detail
        summaries.append(summary)
    return summaries


def _classify_validation_or_commit_failure(validation_results: list[dict[str, Any]]) -> dict[str, str]:
    commit_failure_commands = {"git commit", "branch check"}
    phase = "validation"
    detail = ""
    for result in validation_results:
        if not isinstance(result, dict):
            continue
        try:
            exit_code = int(result.get("exit_code", 0))
        except (TypeError, ValueError):
            exit_code = -1
        if exit_code == 0:
            continue

        command = str(result.get("command", "")).strip()
        command_key = command.lower()
        stderr_tail = _normalize_log_text(result.get("stderr_tail"), max_chars=180, max_sentences=1)
        stdout_tail = _normalize_log_text(result.get("stdout_tail"), max_chars=180, max_sentences=1)
        command_detail = stderr_tail or stdout_tail
        if command:
            detail = f"{command}: {command_detail}" if command_detail else command
        elif command_detail:
            detail = command_detail

        if command_key in commit_failure_commands:
            phase = "commit"
            break

    if phase == "commit":
        return {
            "event_kind": "commit_failed",
            "event_message": "Commit failed",
            "retry_reason": "commit failed",
            "resolution_retry": "Commit failed; task requeued for retry.",
            "resolution_escalated": "Commit repeatedly failed; task blocked and escalated.",
            "resolution_event_message": "Task failed commit",
            "state_error": "Commit failed",
            "run_result": "failed_commit",
            "reason_detail": detail,
        }
    return {
        "event_kind": "validation_failed",
        "event_message": "Validation failed",
        "retry_reason": "validation failed",
        "resolution_retry": "Validation failed; task requeued for retry.",
        "resolution_escalated": "Validation repeatedly failed; task blocked and escalated.",
        "resolution_event_message": "Task failed validation",
        "state_error": "Validation failed",
        "run_result": "failed_validation",
        "reason_detail": detail,
    }


def build_validation_commands(item: dict[str, Any], commit_rules: dict[str, Any]) -> list[str]:
    commands: list[str] = []
    defaults = commit_rules.get("default_validation_commands", [])
    if isinstance(defaults, list):
        commands.extend([str(cmd) for cmd in defaults if str(cmd).strip()])
    item_cmds = item.get("validation_commands", [])
    if isinstance(item_cmds, list):
        commands.extend([str(cmd) for cmd in item_cmds if str(cmd).strip()])

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

    visual_cfg = commit_rules.get("frontend_visual_qa", {})
    if not isinstance(visual_cfg, dict):
        visual_cfg = {}
    enabled = _boolish(visual_cfg.get("enabled"), False)
    env_visual = os.environ.get("REDKEEPERS_ENABLE_FRONTEND_VISUAL_QA")
    if env_visual is not None:
        enabled = _boolish(env_visual, enabled)

    if item.get("owner_role") == "frontend" and enabled:
        strict = _boolish(visual_cfg.get("strict"), True)
        max_overflow_px = int(visual_cfg.get("max_overflow_px", 0))
        max_diff_percent = float(visual_cfg.get("max_diff_percent", 0.5))
        visual_cmd_parts = [
            "python tools/frontend_visual_smoke.py",
            f"--max-overflow-px {max_overflow_px}",
            f"--max-diff-percent {max_diff_percent}",
        ]
        if strict:
            visual_cmd_parts.append("--strict")
        commands.append(" ".join(visual_cmd_parts))

    platform_web_cfg = commit_rules.get("platform_web_packaging_validation", {})
    if not isinstance(platform_web_cfg, dict):
        platform_web_cfg = {}
    platform_enabled = _boolish(platform_web_cfg.get("enabled"), False)
    env_platform_web = os.environ.get("REDKEEPERS_ENABLE_PLATFORM_WEB_PACKAGING_VALIDATION")
    if env_platform_web is not None:
        platform_enabled = _boolish(env_platform_web, platform_enabled)

    def _string_list(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(entry).strip() for entry in value if str(entry).strip()]

    def _norm_path_text(value: str) -> str:
        return value.strip().replace("\\", "/").lower()

    if platform_enabled:
        owner_roles_raw = _string_list(platform_web_cfg.get("owner_roles"))
        owner_roles = {_norm_path_text(role) for role in (owner_roles_raw or ["platform"])}
        item_owner_role = _norm_path_text(str(item.get("owner_role", "")))
        role_match = item_owner_role in owner_roles

        input_tokens_raw = _string_list(platform_web_cfg.get("match_inputs_any"))
        input_tokens = [_norm_path_text(token) for token in (input_tokens_raw or ["tools/web_vertical_slice_packaging.py"])]
        item_inputs_raw = item.get("inputs", [])
        item_inputs = []
        if isinstance(item_inputs_raw, list):
            item_inputs = [_norm_path_text(str(entry)) for entry in item_inputs_raw if str(entry).strip()]
        input_match = bool(input_tokens) and any(
            token in candidate for token in input_tokens for candidate in item_inputs
        )

        if role_match and input_match:
            platform_commands = _string_list(platform_web_cfg.get("commands"))
            if not platform_commands:
                platform_commands = [
                    "python tools/web_vertical_slice_packaging.py package --clean",
                    "python tools/web_vertical_slice_packaging.py smoke",
                ]
            commands.extend(platform_commands)

    deduped: list[str] = []
    seen: set[str] = set()
    for command in commands:
        normalized = str(command).strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    commands = deduped
    return commands


def run_validation_for_item(root: Path, item: dict[str, Any], commit_rules: dict[str, Any]) -> tuple[bool, list[dict[str, Any]]]:
    commands = build_validation_commands(item, commit_rules)
    if not commands:
        return True, []
    return run_validation_commands(root, commands)


def _extract_frontend_visual_report_path(text: str) -> str | None:
    marker = "report="
    idx = text.rfind(marker)
    if idx < 0:
        return None
    tail = text[idx + len(marker) :].strip()
    if not tail:
        return None
    token_chars: list[str] = []
    for ch in tail:
        if ch in {"\r", "\n", "\t", " "}:
            break
        token_chars.append(ch)
    candidate = "".join(token_chars).strip().strip("'\"")
    return candidate or None


def _strip_frontend_visual_report_token(text: str) -> str:
    cleaned = text.strip()
    if not cleaned:
        return cleaned
    lower = cleaned.lower()
    if lower.startswith("report="):
        return ""
    marker = " report="
    idx = lower.rfind(marker)
    if idx >= 0:
        cleaned = cleaned[:idx].strip(" :;,-")
    return cleaned


def _extract_frontend_visual_blocked_summary(text: str) -> str | None:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for idx, line in enumerate(lines):
        if not line.upper().startswith("STATUS: BLOCKED"):
            continue
        tail = _strip_frontend_visual_report_token(line[len("STATUS: BLOCKED") :].strip(" :-"))
        if tail:
            return tail
        if idx + 1 < len(lines):
            next_line = _strip_frontend_visual_report_token(lines[idx + 1])
            if next_line:
                return next_line
        return "Frontend visual smoke reported STATUS: BLOCKED"
    return None


def frontend_visual_environment_blocker_reason(validation_results: list[dict[str, Any]], *, root: Path) -> str | None:
    for result in validation_results:
        if not isinstance(result, dict):
            continue
        command = str(result.get("command", ""))
        effective_command = str(result.get("effective_command", ""))
        command_text = f"{command}\n{effective_command}".lower()

        stdout_tail = str(result.get("stdout_tail", ""))
        stderr_tail = str(result.get("stderr_tail", ""))
        combined_text = f"{stdout_tail}\n{stderr_tail}"
        combined_lower = combined_text.lower()

        # If status preflight reports missing Playwright for frontend visual QA,
        # treat it as an environment blocker instead of a retryable validation failure.
        if "tools/orchestrator.py status" in command_text:
            if "frontend visual qa is enabled" in combined_lower and "playwright is not importable" in combined_lower:
                for line in combined_text.splitlines():
                    stripped = line.strip().lstrip("- ").strip()
                    lowered = stripped.lower()
                    if "frontend visual qa is enabled" in lowered and "playwright is not importable" in lowered:
                        return f"Frontend visual smoke blocked by environment: {stripped}"
                return "Frontend visual smoke blocked by environment: Playwright is not importable in the active Python interpreter."

        if "frontend_visual_smoke.py" not in command_text:
            continue

        summary = _extract_frontend_visual_blocked_summary(combined_text)
        report_status = ""
        report_error = ""
        report_path_raw = _extract_frontend_visual_report_path(combined_text)
        if report_path_raw:
            report_path = Path(report_path_raw)
            if not report_path.is_absolute():
                report_path = root / report_path
            try:
                report = load_json(report_path, {})
            except Exception:
                report = {}
            if isinstance(report, dict):
                report_status = str(report.get("status", "")).strip().lower()
                if report_status and report_status != "blocked":
                    # Keep existing failure/retry semantics for true visual regressions.
                    continue
                report_error = report.get("error")
                if isinstance(report_error, str):
                    report_error = report_error.strip()
                else:
                    report_error = ""

        if summary is None:
            if report_status != "blocked":
                continue
            summary = report_error or "Frontend visual smoke reported STATUS: BLOCKED"
        elif report_error:
            summary = report_error

        return f"Frontend visual smoke blocked by environment: {summary}"
    return None


def platform_web_packaging_environment_blocker_reason(validation_results: list[dict[str, Any]]) -> str | None:
    for result in validation_results:
        if not isinstance(result, dict):
            continue
        command = str(result.get("command", ""))
        effective_command = str(result.get("effective_command", ""))
        command_text = f"{command}\n{effective_command}".replace("\\", "/").lower()
        if "tools/web_vertical_slice_packaging.py" not in command_text:
            continue
        stdout_tail = str(result.get("stdout_tail", ""))
        stderr_tail = str(result.get("stderr_tail", ""))
        status, detail = _extract_status_line(f"{stdout_tail}\n{stderr_tail}")
        if status != "BLOCKED":
            continue
        if not detail:
            detail = "Web vertical-slice packaging reported STATUS: BLOCKED"
        return f"Platform web packaging blocked by environment: {detail}"
    return None


def is_systemic_worker_bootstrap_error(worker_summary: str, exit_code: int) -> bool:
    text = (worker_summary or "").lower()
    return exit_code == 127 or "command not found" in text or "codex cli command not found" in text


def process_one(
    *,
    dry_run: bool,
    verbose: bool,
    session_id: str | None = None,
    model_stats_tracker: ModelStatsTracker | None = None,
    model_stats: dict[str, Any] | None = None,
) -> int:
    ensure_python_runtime_configuration()
    repaired = repair_backlog_archive_duplicates(ROOT)
    if repaired["completed_removed"] or repaired["blocked_removed"]:
        emit_event(
            "recovery",
            "Repaired duplicate backlog archive ids",
            completed_removed=repaired["completed_removed"],
            blocked_removed=repaired["blocked_removed"],
            completed_duplicate_ids=repaired["completed_duplicate_ids"],
            blocked_duplicate_ids=repaired["blocked_duplicate_ids"],
        )

    errors = validate_environment(ROOT)
    if errors:
        set_daemon_state(state="error", last_error="; ".join(errors[:5]), lock_held=False)
        emit_event("error", "Environment validation failed", error_count=len(errors))
        print("Environment validation failed:")
        for err in errors:
            print(f"- {err}")
        return 2

    agents = load_agent_catalog(ROOT)
    policies = load_policies(ROOT)
    queue = QueueManager(ROOT)
    queue.load()
    if not dry_run:
        archived_blocked_ids = archive_non_actionable_blocked_items(queue, policies.get("retry", {}))
        if archived_blocked_ids:
            emit_event(
                "blocked_archive",
                "Archived non-actionable blocked items",
                count=len(archived_blocked_ids),
                item_ids=archived_blocked_ids,
                archive_path=str(BLOCKED_ARCHIVED_PATH.relative_to(ROOT).as_posix()),
            )
            queue.load()
    human_inbox_created = ensure_human_instruction_items(queue, agents)
    if human_inbox_created:
        emit_event(
            "human_inbox",
            "Ingested human instruction files into lead triage queue",
            count=len(human_inbox_created),
            files=[entry["file"] for entry in human_inbox_created],
            item_ids=[entry["item_id"] for entry in human_inbox_created],
        )
        queue.load()
    platform_bootstrap = ensure_platform_bootstrap_item(queue, agents)
    if platform_bootstrap is not None:
        emit_event(
            "platform_bootstrap",
            "Created automatic platform bootstrap task",
            item_id=platform_bootstrap["id"],
            title=platform_bootstrap["title"],
            preferred_agent=platform_bootstrap.get("preferred_agent"),
        )
        queue.load()
    stats_tracker = StatsTracker(ROOT, agents)
    stats = stats_tracker.load()
    model_stats_data = model_stats
    if model_stats_tracker is not None and model_stats_data is None:
        model_stats_data = model_stats_tracker.load()
    stats_tracker.refresh_queue_totals(
        stats,
        queued_count=sum(1 for item in queue.active if item.get("status") == "queued"),
        blocked_count=len(queue.blocked),
        completed_count=len(queue.completed),
    )
    stats_tracker.save(stats)

    if not dry_run:
        reopened_blocked = revisit_recoverable_blocked_items(queue, policies.get("retry", {}))
        if reopened_blocked:
            emit_event(
                "blocked_revisit",
                "Requeued recoverable blocked work items",
                count=len(reopened_blocked),
                item_ids=reopened_blocked,
            )
            queue.load()
            stats_tracker.refresh_queue_totals(
                stats,
                queued_count=sum(1 for queued_item in queue.active if queued_item.get("status") == "queued"),
                blocked_count=len(queue.blocked),
                completed_count=len(queue.completed),
            )
            stats_tracker.save(stats)

    non_actionable_guard = guard_non_actionable_blocked_items(queue, policies.get("retry", {}), dry_run=dry_run)
    if non_actionable_guard["flagged"]:
        emit_event(
            "queue_health",
            "Detected blocked items with non-actionable blocker reasons",
            count=len(non_actionable_guard["flagged"]),
            item_ids=[str(row.get("item_id", "")) for row in non_actionable_guard["flagged"]],
            warnings=format_non_actionable_blocked_warning_lines(non_actionable_guard["flagged"], max_lines=5),
        )
    if non_actionable_guard["auto_requeued"]:
        emit_event(
            "blocked_requeue_non_actionable",
            "Requeued dependency-ready blocked items with non-actionable blocker reasons",
            count=len(non_actionable_guard["auto_requeued"]),
            item_ids=non_actionable_guard["auto_requeued"],
        )
        queue.load()
        stats_tracker.refresh_queue_totals(
            stats,
            queued_count=sum(1 for queued_item in queue.active if queued_item.get("status") == "queued"),
            blocked_count=len(queue.blocked),
            completed_count=len(queue.completed),
        )
        stats_tracker.save(stats)
    if non_actionable_guard["triage_item_id"]:
        emit_event(
            "blocked_reason_triage",
            "Created lead triage item for non-actionable blocked reasons",
            item_id=non_actionable_guard["triage_item_id"],
        )
        queue.load()

    dependency_warnings = normalize_queued_item_dependencies(queue, archived_ids=load_blocked_archived_ids())
    if dependency_warnings:
        emit_event(
            "recovery",
            "Normalized queued dependencies to known backlog ids",
            warning_count=len(dependency_warnings),
            warnings=format_dependency_warning_lines(dependency_warnings, max_lines=5),
        )

    item = queue.select_next(policies["routing"], stats)
    if item is None:
        emit_event("idle", "No dependency-ready queued work item available")
        daemon_state = set_daemon_state(
            state="idle",
            active_item=None,
            last_error=None,
            last_run_summary="No queued dependency-ready work item",
            lock_held=True,
        )
        stats_tracker.write_progress_summary(
            daemon_state="idle",
            active_item=None,
            queue_counts=queue_counts(queue),
            milestone_progress=milestone_progress(queue),
        )
        print(
            render_status(
                build_status_payload(
                    daemon_state=daemon_state,
                    queue=queue,
                    stats=stats,
                    agents=agents,
                    routing_rules=policies["routing"],
                )
            )
        )
        return 0

    agent_id, agent_cfg = select_agent_for_item(item, agents, policies["routing"])
    execution_profile = resolve_execution_profile(
        agent_id=agent_id,
        agent_cfg=agent_cfg,
        model_policy=policies.get("model", {}),
        item=item,
    )
    requested_model = execution_profile.get("model")
    selected_model = requested_model
    emit_event(
        "select",
        "Selected work item",
        item_id=item["id"],
        title=item["title"],
        description=item.get("description"),
        agent_id=agent_id,
        role=agent_cfg.get("role"),
        priority=item.get("priority"),
        milestone=item.get("milestone"),
        model=requested_model,
        reasoning=execution_profile.get("reasoning"),
        model_selection=execution_profile.get("selection_reason"),
    )

    if dry_run:
        emit_event(
            "dry_run",
            "Dry-run selected item without execution",
            item_id=item["id"],
            agent_id=agent_id,
            role=agent_cfg.get("role"),
            model=requested_model,
            model_selection=execution_profile.get("selection_reason"),
        )
        daemon_state = set_daemon_state(
            state="dry_run",
            active_item={**item, "assigned_agent": agent_id, "assigned_role": agent_cfg.get("role")},
            last_error=None,
            last_run_summary=f"Dry run selected {item['id']} for {agent_id}",
            lock_held=True,
        )
        print(
            render_status(
                build_status_payload(
                    daemon_state=daemon_state,
                    queue=queue,
                    stats=stats,
                    agents=agents,
                    routing_rules=policies["routing"],
                )
            )
        )
        return 0

    preflight_error = codex_model_access_preflight_error(requested_model or "")
    if preflight_error is not None:
        blocker_reason = f"{preflight_error}. Remediation: update model-policy.yaml to an accessible model."
        emit_event("blocked", "Model preflight blocked execution", item_id=item["id"], agent_id=agent_id, reason=blocker_reason)
        emit_event(
            "resolution",
            "Task blocked before execution",
            item_id=item["id"],
            title=item["title"],
            agent_id=agent_id,
            role=agent_cfg.get("role"),
            result="blocked",
            resolution=blocker_reason,
        )
        queue.mark_blocked(item["id"], blocker_reason)
        queue.save()
        if model_stats_tracker is not None and model_stats_data is not None:
            model_stats_tracker.record_run(
                model_stats_data,
                session_id=session_id,
                agent_id=agent_id,
                role=agent_cfg.get("role"),
                outcome="blocked",
                requested_model=requested_model,
                used_model=selected_model,
                fallback_used=False,
                tokens_in=0,
                tokens_out=0,
                runtime_seconds=0.0,
            )
        stats_tracker.record_result(stats, agent_id=agent_id, outcome="blocked", tokens_in=0, tokens_out=0)
        set_daemon_state(
            state="blocked",
            active_item=None,
            last_error=None,
            last_run_summary=f"{item['id']} blocked by {agent_id}: {blocker_reason}",
            lock_held=True,
        )
        append_jsonl(
            RUN_HISTORY_PATH,
            {
                "ts": utc_now_iso(),
                "item_id": item["id"],
                "agent_id": agent_id,
                "result": "blocked",
                "summary": blocker_reason,
                "exit_code": 1,
                "model_requested": requested_model,
                "model_used": selected_model,
                "fallback_used": False,
            },
        )
        return 0

    queue.mark_assigned(item["id"], agent_id)
    queue.mark_running(item["id"])
    queue.save()
    daemon_state = set_daemon_state(
        state="running",
        active_item={**item, "assigned_agent": agent_id, "assigned_role": agent_cfg.get("role"), "requested_model": requested_model},
        last_error=None,
        lock_held=True,
    )
    stats_tracker.begin_run()

    prompt = build_prompt(ROOT, agent_id=agent_id, agent_cfg=agent_cfg, work_item=item)
    emit_event(
        "agent_start",
        "Agent execution started",
        item_id=item["id"],
        title=item["title"],
        description=item.get("description"),
        agent_id=agent_id,
        role=agent_cfg.get("role"),
        model=selected_model,
        requested_model=requested_model,
        reasoning=execution_profile.get("reasoning"),
        model_selection=execution_profile.get("selection_reason"),
    )
    worker_started = time.monotonic()
    worker_timeout = int(policies.get("retry", {}).get("worker_timeout_seconds", 900))
    worker_box: dict[str, Any] = {}

    def _worker_runner() -> None:
        try:
            worker_box["result"] = run_agent(
                project_root=ROOT,
                agent_id=agent_id,
                prompt=prompt,
                model=selected_model,
                timeout_seconds=worker_timeout,
                dry_run=False,
            )
        except Exception as exc:  # Defensive guard around worker wrapper.
            worker_box["exception"] = exc

    worker_thread = threading.Thread(target=_worker_runner, name=f"worker-{agent_id}", daemon=True)
    worker_thread.start()
    last_heartbeat = worker_started
    while worker_thread.is_alive():
        worker_thread.join(timeout=1.0)
        now = time.monotonic()
        if worker_thread.is_alive() and now - last_heartbeat >= AGENT_HEARTBEAT_SECONDS:
            emit_event(
                "agent_heartbeat",
                "Agent still running",
                item_id=item["id"],
                agent_id=agent_id,
                elapsed_seconds=round(now - worker_started, 1),
                timeout_seconds=worker_timeout,
            )
            last_heartbeat = now

    if "exception" in worker_box:
        exc = worker_box["exception"]
        raise RuntimeError(f"Worker wrapper crashed for {agent_id}: {exc}") from exc
    worker = worker_box["result"]
    elapsed_seconds = time.monotonic() - worker_started
    run_requested_model = requested_model
    run_used_model = worker.used_model
    if run_used_model is None:
        run_used_model = worker.requested_model
    run_fallback_used = worker.fallback_used
    emit_event(
        "agent_end",
        "Agent execution finished",
        item_id=item["id"],
        agent_id=agent_id,
        role=agent_cfg.get("role"),
        result=worker.status,
        exit_code=worker.exit_code,
        elapsed_seconds=round(elapsed_seconds, 2),
        model_requested=run_requested_model,
        model_used=run_used_model,
        fallback_used=run_fallback_used,
    )

    if verbose and worker.stdout:
        print(worker.stdout[-2000:])
    if verbose and worker.stderr:
        print(worker.stderr[-2000:], file=sys.stderr)

    def record_run_stats(
        outcome: str,
        *,
        requested_model_override: str | None = None,
        used_model_override: str | None = None,
        fallback_used_override: bool = False,
    ) -> None:
        run_requested = requested_model_override if requested_model_override is not None else run_requested_model
        run_used = used_model_override if used_model_override is not None else run_used_model
        run_fallback = fallback_used_override or run_fallback_used
        stats_tracker.record_result(
            stats,
            agent_id=agent_id,
            outcome=outcome,
            tokens_in=worker.tokens_in_est,
            tokens_out=worker.tokens_out_est,
        )
        if model_stats_tracker is not None and model_stats_data is not None:
            model_stats_tracker.record_run(
                model_stats_data,
                session_id=session_id,
                agent_id=agent_id,
                role=agent_cfg.get("role"),
                outcome=outcome,
                requested_model=run_requested,
                used_model=run_used,
                fallback_used=run_fallback,
                tokens_in=worker.tokens_in_est,
                tokens_out=worker.tokens_out_est,
                runtime_seconds=elapsed_seconds,
            )

    if worker.status == "blocked":
        emit_event("blocked", "Work item blocked by agent", item_id=item["id"], agent_id=agent_id, reason=worker.summary)
        emit_event(
            "resolution",
            "Task blocked",
            item_id=item["id"],
            title=item["title"],
            agent_id=agent_id,
            role=agent_cfg.get("role"),
            result="blocked",
            resolution=worker.summary,
        )
        queue.mark_blocked(item["id"], worker.blocker_reason or worker.summary)
        queue.save()
        record_run_stats(
            "blocked",
            requested_model_override=run_requested_model,
            used_model_override=run_used_model,
            fallback_used_override=run_fallback_used,
        )
        set_daemon_state(
            state="blocked",
            active_item=None,
            last_error=None,
            last_run_summary=f"{item['id']} blocked by {agent_id}: {worker.summary}",
            lock_held=True,
        )
        append_jsonl(
            RUN_HISTORY_PATH,
            {
                "ts": utc_now_iso(),
                "item_id": item["id"],
                "agent_id": agent_id,
                "result": "blocked",
                "summary": worker.summary,
                "model_requested": run_requested_model,
                "model_used": run_used_model,
                "fallback_used": run_fallback_used,
            },
        )
    elif worker.status == "completed":
        emit_event("validating", "Starting validation for completed work item", item_id=item["id"], agent_id=agent_id)
        queue.mark_validating(item["id"])
        queue.save()
        set_daemon_state(
            state="validating",
            active_item={**item, "assigned_agent": agent_id, "assigned_role": agent_cfg.get("role")},
            last_error=None,
            lock_held=True,
        )

        commit_rules = policies["commit"]
        validations_ok, validation_results = run_validation_for_item(ROOT, item, commit_rules)
        commit_sha = None
        if validations_ok:
            if is_git_repo(ROOT) and commit_rules.get("commit_enabled", True):
                branch = current_branch(ROOT)
                if branch != "main":
                    validations_ok = False
                    validation_results.append(
                        {
                            "command": "branch check",
                            "exit_code": 1,
                            "stderr_tail": f"current branch is {branch!r}, expected 'main'",
                            "stdout_tail": "",
                        }
                    )
                else:
                    ok, commit_out = commit_changes(ROOT, commit_message(agent_cfg["display_name"], item["id"], item["title"]))
                    if ok:
                        commit_sha = None if commit_out == "NO_CHANGES" else commit_out
                        emit_event(
                            "commit",
                            "Commit guard passed; changes committed" if commit_sha else "Validation passed; no file changes to commit",
                            item_id=item["id"],
                            agent_id=agent_id,
                            commit_sha=commit_sha,
                        )
                    else:
                        validations_ok = False
                        validation_results.append(
                            {
                                "command": "git commit",
                                "exit_code": 1,
                                "stdout_tail": "",
                                "stderr_tail": commit_out,
                            }
                        )
            elif changed_files(ROOT):
                validation_results.append(
                    {
                        "command": "git repo check",
                        "exit_code": 0,
                        "stdout_tail": "Changes detected but repo is not initialized; skipping commit.",
                        "stderr_tail": "",
                    }
                )

        if validation_results:
            emit_event(
                "validation_summary",
                "Validation command-result summary",
                item_id=item["id"],
                agent_id=agent_id,
                results=_summarize_validation_results(validation_results),
            )

        if validations_ok:
            emit_event("completed", "Work item completed", item_id=item["id"], agent_id=agent_id, commit_sha=commit_sha)
            emit_event(
                "resolution",
                "Task completed",
                item_id=item["id"],
                title=item["title"],
                agent_id=agent_id,
                role=agent_cfg.get("role"),
                result="completed",
                resolution=worker.summary,
            )
            queue.mark_completed(item["id"], worker.summary, commit_sha=commit_sha)
            queue.save()
            generated_ids, rejected_followups = ingest_agent_follow_up_tasks(
                queue,
                agent_id=agent_id,
                source_item=item,
                routing_rules=policies["routing"],
            )
            if generated_ids:
                emit_event(
                    "followups",
                    "Ingested agent-generated follow-up tasks from outbox",
                    agent_id=agent_id,
                    source_item_id=item["id"],
                    created_item_ids=generated_ids,
                )
            if rejected_followups:
                emit_event(
                    "followups_invalid",
                    "Rejected invalid agent-generated follow-up tasks",
                    agent_id=agent_id,
                    source_item_id=item["id"],
                    rejected_count=len(rejected_followups),
                )
            deleted_human_file, delete_reason = consume_human_instruction_file(item)
            if deleted_human_file:
                emit_event(
                    "human_inbox_consumed",
                    "Consumed processed human instruction file",
                    item_id=item["id"],
                    file=item.get("human_instruction_file"),
                )
            elif item.get("human_instruction_file"):
                emit_event(
                    "human_inbox_consumed",
                    "Human instruction file not deleted",
                    item_id=item["id"],
                    file=item.get("human_instruction_file"),
                    reason=delete_reason,
                )
            record_run_stats(
                "completed",
                requested_model_override=run_requested_model,
                used_model_override=run_used_model,
                fallback_used_override=run_fallback_used,
            )
            set_daemon_state(
                state="idle",
                active_item=None,
                last_error=None,
                last_run_summary=f"{item['id']} completed by {agent_id}",
                lock_held=True,
            )
            append_jsonl(
                RUN_HISTORY_PATH,
                {
                    "ts": utc_now_iso(),
                    "item_id": item["id"],
                    "agent_id": agent_id,
                    "result": "completed",
                    "summary": worker.summary,
                    "commit_sha": commit_sha,
                    "validation_results": validation_results,
                    "model_requested": run_requested_model,
                    "model_used": run_used_model,
                    "fallback_used": run_fallback_used,
                },
            )
        else:
            blocker_reason = frontend_visual_environment_blocker_reason(validation_results, root=ROOT)
            if blocker_reason is None:
                blocker_reason = platform_web_packaging_environment_blocker_reason(validation_results)
            if blocker_reason:
                emit_event(
                    "blocked",
                    "Validation blocked by environment",
                    item_id=item["id"],
                    agent_id=agent_id,
                    reason=blocker_reason,
                )
                emit_event(
                    "resolution",
                    "Task blocked during validation",
                    item_id=item["id"],
                    title=item["title"],
                    agent_id=agent_id,
                    role=agent_cfg.get("role"),
                    result="blocked",
                    resolution=blocker_reason,
                )
                queue.mark_blocked(item["id"], blocker_reason)
                queue.save()
                record_run_stats(
                    "blocked",
                    requested_model_override=run_requested_model,
                    used_model_override=run_used_model,
                    fallback_used_override=run_fallback_used,
                )
                set_daemon_state(
                    state="blocked",
                    active_item=None,
                    last_error=None,
                    last_run_summary=f"{item['id']} blocked during validation by {agent_id}: {blocker_reason}",
                    lock_held=True,
                )
                append_jsonl(
                    RUN_HISTORY_PATH,
                    {
                        "ts": utc_now_iso(),
                        "item_id": item["id"],
                        "agent_id": agent_id,
                        "result": "blocked",
                        "summary": blocker_reason,
                        "validation_results": validation_results,
                        "model_requested": run_requested_model,
                        "model_used": run_used_model,
                        "fallback_used": run_fallback_used,
                    },
                )
            else:
                failure_info = _classify_validation_or_commit_failure(validation_results)
                emit_event(
                    failure_info["event_kind"],
                    failure_info["event_message"],
                    item_id=item["id"],
                    agent_id=agent_id,
                    reason=failure_info["reason_detail"] or None,
                )
                max_retries = int(policies.get("retry", {}).get("max_retries_per_item_per_agent", 2))
                retry_count = queue.increment_retry(item["id"], failure_info["retry_reason"])
                validation_resolution = failure_info["resolution_retry"]
                if retry_count > max_retries:
                    source_item = queue.get_active_item(item["id"])
                    if source_item:
                        queue.create_escalation_item(
                            source_item,
                            lead_agent_name=agents.get("mara-voss", {}).get("display_name", "Mara Voss"),
                            reason="retry threshold exceeded",
                        )
                        queue.mark_blocked(item["id"], "retry threshold exceeded; escalated")
                    validation_resolution = failure_info["resolution_escalated"]
                emit_event(
                    "resolution",
                    failure_info["resolution_event_message"],
                    item_id=item["id"],
                    title=item["title"],
                    agent_id=agent_id,
                    role=agent_cfg.get("role"),
                    result="failed",
                    resolution=validation_resolution,
                )
                queue.save()
                record_run_stats(
                    "failed",
                    requested_model_override=run_requested_model,
                    used_model_override=run_used_model,
                    fallback_used_override=run_fallback_used,
                )
                set_daemon_state(
                    state="error",
                    active_item=None,
                    last_error=f"{failure_info['state_error']} for {item['id']}",
                    last_run_summary=f"{item['id']} failed {failure_info['retry_reason']} and was requeued",
                    lock_held=True,
                )
                append_jsonl(
                    RUN_HISTORY_PATH,
                    {
                        "ts": utc_now_iso(),
                        "item_id": item["id"],
                        "agent_id": agent_id,
                        "result": failure_info["run_result"],
                        "summary": worker.summary,
                        "validation_results": validation_results,
                        "model_requested": run_requested_model,
                        "model_used": run_used_model,
                        "fallback_used": run_fallback_used,
                    },
                )
    else:
        if is_systemic_worker_bootstrap_error(worker.summary, worker.exit_code):
            emit_event("infrastructure_error", "Worker bootstrap error; stopping daemon loop", item_id=item["id"], agent_id=agent_id, error=worker.summary)
            emit_event(
                "resolution",
                "Task failed",
                item_id=item["id"],
                title=item["title"],
                agent_id=agent_id,
                role=agent_cfg.get("role"),
                result="failed",
                resolution=worker.summary,
            )
            # Infrastructure misconfiguration (e.g. missing Codex CLI) should not burn retries
            # or spawn escalation chains. Leave the item queued and stop the daemon loop.
            queue.update_item_status(item["id"], "queued", last_failure_reason=worker.summary)
            queue.save()
            record_run_stats(
                "failed",
                requested_model_override=run_requested_model,
                used_model_override=run_used_model,
                fallback_used_override=run_fallback_used,
            )
            set_daemon_state(
                state="error",
                active_item=None,
                last_error=worker.summary,
                last_run_summary=f"Infrastructure error while running {item['id']} for {agent_id}",
                lock_held=True,
            )
            append_jsonl(
                RUN_HISTORY_PATH,
                {
                    "ts": utc_now_iso(),
                    "item_id": item["id"],
                    "agent_id": agent_id,
                    "result": "failed_infrastructure",
                    "summary": worker.summary,
                    "exit_code": worker.exit_code,
                    "model_requested": run_requested_model,
                    "model_used": run_used_model,
                    "fallback_used": run_fallback_used,
                },
            )
            queue.load()
            stats_tracker.refresh_queue_totals(
                stats,
                queued_count=sum(1 for entry in queue.active if entry.get("status") == "queued"),
                blocked_count=len(queue.blocked),
                completed_count=len(queue.completed),
            )
            stats_tracker.save(stats)
            if model_stats_tracker is not None and model_stats_data is not None:
                model_stats_tracker.save(model_stats_data)
            daemon_state = load_json(DAEMON_STATE_PATH, default_daemon_state())
            stats_tracker.write_progress_summary(
                daemon_state=daemon_state.get("state", "unknown"),
                active_item=daemon_state.get("active_item"),
                queue_counts=queue_counts(queue),
                milestone_progress=milestone_progress(queue),
            )
            print(
                render_status(
                    build_status_payload(
                        daemon_state=daemon_state,
                        queue=queue,
                        stats=stats,
                        agents=agents,
                        routing_rules=policies["routing"],
                    )
                )
            )
            return 3

        emit_event("failed", "Agent run failed; item will be retried or escalated", item_id=item["id"], agent_id=agent_id, reason=worker.summary)
        max_retries = int(policies.get("retry", {}).get("max_retries_per_item_per_agent", 2))
        retry_count = queue.increment_retry(item["id"], worker.summary)
        runtime_resolution = "Agent execution failed; task requeued for retry."
        if retry_count > max_retries:
            source_item = queue.get_active_item(item["id"])
            if source_item:
                is_escalation_item = bool(source_item.get("source_item_id")) or str(source_item.get("id", "")).endswith("-ESC")
                if not is_escalation_item:
                    emit_event("escalation", "Creating escalation item for repeated failures", item_id=item["id"], agent_id="mara-voss")
                    queue.create_escalation_item(
                        source_item,
                        lead_agent_name=agents.get("mara-voss", {}).get("display_name", "Mara Voss"),
                        reason=worker.summary,
                    )
                emit_event("blocked", "Item blocked after retry threshold", item_id=item["id"], agent_id=agent_id)
                queue.mark_blocked(item["id"], f"Repeated failure: {worker.summary}")
            runtime_resolution = "Agent execution repeatedly failed; task blocked and escalated."
        emit_event(
            "resolution",
            "Task failed",
            item_id=item["id"],
            title=item["title"],
            agent_id=agent_id,
            role=agent_cfg.get("role"),
            result="failed",
            resolution=runtime_resolution,
        )
        queue.save()
        record_run_stats(
            "failed",
            requested_model_override=run_requested_model,
            used_model_override=run_used_model,
            fallback_used_override=run_fallback_used,
        )
        set_daemon_state(
            state="error",
            active_item=None,
            last_error=worker.summary,
            last_run_summary=f"{item['id']} failed for {agent_id}",
            lock_held=True,
        )
        append_jsonl(
            RUN_HISTORY_PATH,
            {
                "ts": utc_now_iso(),
                "item_id": item["id"],
                "agent_id": agent_id,
                "result": "failed",
                "summary": worker.summary,
                "exit_code": worker.exit_code,
                "model_requested": run_requested_model,
                "model_used": run_used_model,
                "fallback_used": run_fallback_used,
            },
        )

    queue.load()
    refill_item = ensure_backlog_refill_item(queue)
    if refill_item is not None:
        emit_event("backlog_refill", "Created automatic backlog refill task", item_id=refill_item["id"], title=refill_item["title"])
        queue.load()
    stats_tracker.refresh_queue_totals(
        stats,
        queued_count=sum(1 for entry in queue.active if entry.get("status") == "queued"),
        blocked_count=len(queue.blocked),
        completed_count=len(queue.completed),
    )
    stats_tracker.save(stats)
    if model_stats_tracker is not None and model_stats_data is not None:
        model_stats_tracker.save(model_stats_data)
    daemon_state = load_json(DAEMON_STATE_PATH, default_daemon_state())
    stats_tracker.write_progress_summary(
        daemon_state=daemon_state.get("state", "unknown"),
        active_item=daemon_state.get("active_item"),
        queue_counts=queue_counts(queue),
        milestone_progress=milestone_progress(queue),
    )
    print(
        render_status(
            build_status_payload(
                daemon_state=daemon_state,
                queue=queue,
                stats=stats,
                agents=agents,
                routing_rules=policies["routing"],
            )
        )
    )
    return 0


def cmd_status() -> int:
    ensure_python_runtime_configuration()
    migrate_legacy_runtime_files()
    repair_backlog_archive_duplicates(ROOT)
    errors = validate_environment(ROOT)
    if errors:
        print("Environment validation failed:")
        for err in errors:
            print(f"- {err}")
        return 2

    agents = load_agent_catalog(ROOT)
    policies = load_policies(ROOT)
    queue = QueueManager(ROOT)
    queue.load()
    dependency_warnings = normalize_queued_item_dependencies(queue, archived_ids=load_blocked_archived_ids())
    non_actionable_blocked = find_non_actionable_blocked_items(queue)
    stats = StatsTracker(ROOT, agents).load()
    daemon_state = load_json(DAEMON_STATE_PATH, default_daemon_state())
    print(
        render_status(
            build_status_payload(
                daemon_state=daemon_state,
                queue=queue,
                stats=stats,
                agents=agents,
                routing_rules=policies["routing"],
            )
        )
    )
    if dependency_warnings:
        print("Dependency normalization warnings:")
        for line in format_dependency_warning_lines(dependency_warnings):
            print(line)
    if non_actionable_blocked:
        print("Backlog health warnings:")
        for line in format_non_actionable_blocked_warning_lines(non_actionable_blocked):
            print(line)
    return 0


def cmd_run(*, once: bool, sleep_seconds: int, dry_run: bool, verbose: bool, keep_alive: bool) -> int:
    python_command, python_executable = ensure_python_runtime_configuration()
    migrate_legacy_runtime_files()
    lock = DaemonLock(os.getpid())
    model_stats_tracker: ModelStatsTracker | None = None
    model_stats: dict[str, Any] | None = None
    session_id: str | None = None
    session_started_at: str | None = None
    try:
        lock.acquire()
    except RuntimeError as exc:
        set_daemon_state(state="error", last_error=str(exc), lock_held=False)
        print(str(exc), file=sys.stderr)
        return 1

    model_stats_tracker = ModelStatsTracker(ROOT)
    model_stats = model_stats_tracker.load()
    session_started_at = utc_now_iso()
    session_id = build_session_id(pid=os.getpid(), started_at=session_started_at)
    model_stats_tracker.start_session(
        model_stats,
        session_id=session_id,
        started_at=session_started_at,
        pid=os.getpid(),
        mode="once" if once else "run",
    )
    model_stats_tracker.save(model_stats)

    emit_event(
        "daemon_start",
        "Daemon started and lock acquired",
        pid=os.getpid(),
        mode="once" if once else "run",
        dry_run=dry_run,
        keep_alive=keep_alive,
        session_id=session_id,
        python_command=python_command,
        python_executable=python_executable,
    )
    set_daemon_state(lock_held=True, state="idle", last_error=None, session_id=session_id)
    try:
        # If a previous daemon run crashed or was interrupted, items may be left in
        # assigned/running/validating. With the lock acquired, no other daemon is active,
        # so these can be safely recovered, except ids already archived from blocked state.
        recovery_queue = QueueManager(ROOT)
        recovery_queue.load()
        archived_ids = load_blocked_archived_ids()
        recovered_items, archived_dispositions = recover_stale_in_progress_items(recovery_queue, archived_ids=archived_ids)
        recovery_warnings = normalize_queued_item_dependencies(recovery_queue, archived_ids=archived_ids)
        if recovered_items:
            emit_event(
                "recovery",
                "Recovered stale in-progress items to queued state",
                count=len(recovered_items),
                item_ids=recovered_items,
            )
        if archived_dispositions:
            emit_event(
                "recovery",
                "Applied archived-item dispositions during stale recovery",
                count=len(archived_dispositions),
                item_ids=[row["item_id"] for row in archived_dispositions],
                dispositions=archived_dispositions,
                archive_path=str(BLOCKED_ARCHIVED_PATH.relative_to(ROOT).as_posix()),
            )
        if recovery_warnings:
            emit_event(
                "recovery",
                "Normalized queued dependencies to known backlog ids",
                warning_count=len(recovery_warnings),
                warnings=format_dependency_warning_lines(recovery_warnings, max_lines=5),
            )

        if once:
            return process_one(
                dry_run=dry_run,
                verbose=verbose,
                session_id=session_id,
                model_stats_tracker=model_stats_tracker,
                model_stats=model_stats,
            )
        while True:
            rc = process_one(
                dry_run=dry_run,
                verbose=verbose,
                session_id=session_id,
                model_stats_tracker=model_stats_tracker,
                model_stats=model_stats,
            )
            if rc != 0 or dry_run:
                if rc != 0:
                    emit_event("daemon_stop", "Daemon loop exiting with non-zero status", exit_code=rc)
                return rc
            queue = QueueManager(ROOT)
            queue.load()
            refill_item = ensure_backlog_refill_item(queue)
            if refill_item is not None:
                emit_event("backlog_refill", "Created automatic backlog refill task", item_id=refill_item["id"], title=refill_item["title"])
                queue.load()
            if not any(item.get("status") == "queued" for item in queue.active):
                if keep_alive:
                    set_daemon_state(
                        state="idle",
                        active_item=None,
                        last_run_summary="Queue idle: waiting for new work items",
                        lock_held=True,
                    )
                    emit_event("wait", "Queue idle; waiting for new work", seconds=sleep_seconds)
                    time.sleep(sleep_seconds)
                    continue
                emit_event("daemon_stop", "Queue idle; daemon run completed")
                return 0
            agents = load_agent_catalog(ROOT)
            policies = load_policies(ROOT)
            stats = StatsTracker(ROOT, agents).load()
            next_ready = queue.select_next(policies["routing"], stats)
            if next_ready is None:
                auto_recovery = ensure_queue_stall_recovery_item(queue)
                if auto_recovery is not None:
                    emit_event(
                        "stall_recovery",
                        "Created automatic queue stall recovery item",
                        item_id=auto_recovery["id"],
                        title=auto_recovery["title"],
                    )
                    continue
                if keep_alive:
                    set_daemon_state(
                        state="idle",
                        active_item=None,
                        last_run_summary="Queue stalled: waiting for dependencies to unblock",
                        lock_held=True,
                    )
                    emit_event("wait", "Queue stalled; waiting for dependencies to unblock", seconds=sleep_seconds)
                    time.sleep(sleep_seconds)
                    continue
                set_daemon_state(
                    state="idle",
                    active_item=None,
                    last_run_summary="Queue stalled: queued items exist but none are dependency-ready",
                    lock_held=True,
                )
                emit_event("daemon_stop", "Queue stalled; queued items exist but none are dependency-ready")
                return 0
            emit_event("sleep", "Sleeping before next scheduling cycle", seconds=sleep_seconds)
            time.sleep(sleep_seconds)
    except KeyboardInterrupt:
        set_daemon_state(
            state="idle",
            active_item=None,
            last_run_summary="Daemon interrupted by user",
            lock_held=True,
        )
        emit_event("daemon_interrupt", "KeyboardInterrupt received; stopping daemon")
        return 130
    finally:
        if model_stats_tracker is not None and model_stats is not None and session_id is not None:
            model_stats_tracker.end_session(
                model_stats,
                session_id=session_id,
                ended_at=utc_now_iso(),
            )
            model_stats_tracker.save(model_stats)
        set_daemon_state(lock_held=False, active_item=None, state="idle", session_id=None)
        lock.release()
        emit_event("daemon_stop", "Daemon stopped and lock released", pid=os.getpid(), session_id=session_id)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="RedKeepers head daemon orchestrator")
    sub = parser.add_subparsers(dest="command", required=True)

    run_p = sub.add_parser("run", help="Run the daemon loop until queue is idle")
    run_p.add_argument("--sleep-seconds", type=int, default=5)
    run_p.add_argument("--dry-run", action="store_true")
    run_p.add_argument("--verbose", action="store_true")
    run_p.add_argument("--until-idle", action="store_true", help="Exit when queue becomes idle or stalled (legacy behavior)")

    once_p = sub.add_parser("once", help="Process a single work item")
    once_p.add_argument("--dry-run", action="store_true")
    once_p.add_argument("--verbose", action="store_true")

    sub.add_parser("status", help="Show high-level daemon status")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "status":
        return cmd_status()
    if args.command == "once":
        return cmd_run(once=True, sleep_seconds=0, dry_run=args.dry_run, verbose=args.verbose, keep_alive=False)
    if args.command == "run":
        return cmd_run(
            once=False,
            sleep_seconds=args.sleep_seconds,
            dry_run=args.dry_run,
            verbose=args.verbose,
            keep_alive=not args.until_idle,
        )
    parser.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
