from __future__ import annotations

import argparse
import os
import sys
import threading
import time
from pathlib import Path
from typing import Any

from codex_worker import run_agent
from git_guard import changed_files, commit_changes, current_branch, is_git_repo, run_validation_commands
from health_checks import validate_environment
from prompt_builder import build_prompt
from queue_manager import QueueManager
from schemas import append_jsonl, load_json, load_yaml_like, save_json_atomic, utc_now_iso
from stats_tracker import StatsTracker
from render_status import render_status


ROOT = Path(__file__).resolve().parents[1]
STATIC_STATE_DIR = ROOT / "coordination" / "state"
RUNTIME_DIR = ROOT / "coordination" / "runtime"
DAEMON_STATE_PATH = RUNTIME_DIR / "daemon-state.json"
LOCK_META_PATH = RUNTIME_DIR / "locks.json"
LOCK_FILE = RUNTIME_DIR / "daemon.lock"
EVENTS_LOG_PATH = RUNTIME_DIR / "daemon-events.jsonl"
RUN_HISTORY_PATH = RUNTIME_DIR / "run-history.jsonl"
AGENT_HEARTBEAT_SECONDS = 15
LOW_QUEUE_WATERMARK = 2


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
    line = f"[{ts}][{kind}] {message}"
    if fields:
        ordered = " ".join(f"{key}={fields[key]!r}" for key in sorted(fields))
        line = f"{line} | {ordered}"
    print(line, flush=True)
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
    return {
        "queued": queued,
        "running": running,
        "blocked": len(queue.blocked),
        "completed": len(queue.completed),
    }


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


def _next_auto_stall_item_id(queue: QueueManager) -> str:
    existing_ids = {item["id"] for item in queue.active} | {item["id"] for item in queue.completed} | {item["id"] for item in queue.blocked}
    i = 1
    while True:
        candidate = f"RK-AUTO-STALL-{i:04d}"
        if candidate not in existing_ids:
            return candidate
        i += 1


def _next_auto_refill_item_id(queue: QueueManager) -> str:
    existing_ids = {item["id"] for item in queue.active} | {item["id"] for item in queue.completed} | {item["id"] for item in queue.blocked}
    i = 1
    while True:
        candidate = f"RK-AUTO-BACKLOG-{i:04d}"
        if candidate not in existing_ids:
            return candidate
        i += 1


def ensure_queue_stall_recovery_item(queue: QueueManager) -> dict[str, Any] | None:
    stalled = _queued_items_with_unmet_dependencies(queue)
    if not stalled:
        return None

    # Avoid generating duplicates if one is already open.
    for item in queue.active:
        if item.get("status") == "queued" and item.get("auto_generated") == "queue_stall_recovery":
            return None

    blocked_dep_map = {row["item_id"]: row["blocked_dependencies"] for row in stalled if row["blocked_dependencies"]}
    if not blocked_dep_map:
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
        "stall_snapshot": stalled,
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
            "tasks across backend, frontend, design, content, and QA with dependencies and acceptance criteria. "
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
    data = load_json(outbox_path, [])
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


def recover_stale_in_progress_items(queue: QueueManager) -> list[str]:
    recovered: list[str] = []
    for item in queue.active:
        if item.get("status") in {"assigned", "running", "validating"}:
            item["status"] = "queued"
            item["updated_at"] = utc_now_iso()
            item["recovered_from_stale_in_progress"] = True
            recovered.append(item["id"])
    if recovered:
        queue.save()
    return recovered


def build_status_payload(
    *,
    daemon_state: dict[str, Any],
    queue: QueueManager,
    stats: dict[str, Any],
) -> dict[str, Any]:
    return {"daemon": daemon_state, "queue": queue_counts(queue), "agent_stats": stats}


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
    fallback_model = _clean(policy_cfg.get("fallback_model")) or _clean(model_policy.get("default_fallback_model"))
    if fallback_model == model:
        fallback_model = None

    return {
        "model": model,
        "reasoning": reasoning,
        "fallback_model": fallback_model,
    }


def commit_message(agent_name: str, item_id: str, title: str) -> str:
    short = title.strip().replace('"', "'")
    return f"[Agent:{agent_name}][Item:{item_id}] {short}"


def run_validation_for_item(root: Path, item: dict[str, Any], commit_rules: dict[str, Any]) -> tuple[bool, list[dict[str, Any]]]:
    commands = []
    defaults = commit_rules.get("default_validation_commands", [])
    if isinstance(defaults, list):
        commands.extend([str(cmd) for cmd in defaults if str(cmd).strip()])
    item_cmds = item.get("validation_commands", [])
    if isinstance(item_cmds, list):
        commands.extend([str(cmd) for cmd in item_cmds if str(cmd).strip()])
    if not commands:
        return True, []
    return run_validation_commands(root, commands)


def is_systemic_worker_bootstrap_error(worker_summary: str, exit_code: int) -> bool:
    text = (worker_summary or "").lower()
    return exit_code == 127 or "command not found" in text or "codex cli command not found" in text


def process_one(
    *,
    dry_run: bool,
    verbose: bool,
) -> int:
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
    stats_tracker = StatsTracker(ROOT, agents)
    stats = stats_tracker.load()
    stats_tracker.refresh_queue_totals(
        stats,
        queued_count=sum(1 for item in queue.active if item.get("status") == "queued"),
        blocked_count=len(queue.blocked),
        completed_count=len(queue.completed),
    )
    stats_tracker.save(stats)

    item = queue.select_next(policies["routing"], stats)
    if item is None:
        emit_event("idle", "No dependency-ready queued work item available")
        daemon_state = set_daemon_state(state="idle", active_item=None, last_run_summary="No queued dependency-ready work item", lock_held=True)
        stats_tracker.write_progress_summary(
            daemon_state="idle",
            active_item=None,
            queue_counts=queue_counts(queue),
            milestone_progress=milestone_progress(queue),
        )
        print(render_status(build_status_payload(daemon_state=daemon_state, queue=queue, stats=stats)))
        return 0

    agent_id, agent_cfg = select_agent_for_item(item, agents, policies["routing"])
    execution_profile = resolve_execution_profile(
        agent_id=agent_id,
        agent_cfg=agent_cfg,
        model_policy=policies.get("model", {}),
    )
    emit_event(
        "select",
        "Selected work item",
        item_id=item["id"],
        title=item["title"],
        agent_id=agent_id,
        priority=item.get("priority"),
        milestone=item.get("milestone"),
        model=execution_profile.get("model"),
        reasoning=execution_profile.get("reasoning"),
        fallback_model=execution_profile.get("fallback_model"),
    )

    if dry_run:
        emit_event("dry_run", "Dry-run selected item without execution", item_id=item["id"], agent_id=agent_id)
        daemon_state = set_daemon_state(
            state="dry_run",
            active_item={**item, "assigned_agent": agent_id},
            last_run_summary=f"Dry run selected {item['id']} for {agent_id}",
            lock_held=True,
        )
        print(render_status(build_status_payload(daemon_state=daemon_state, queue=queue, stats=stats)))
        return 0

    queue.mark_assigned(item["id"], agent_id)
    queue.mark_running(item["id"])
    queue.save()
    daemon_state = set_daemon_state(state="running", active_item={**item, "assigned_agent": agent_id}, lock_held=True)
    stats_tracker.begin_run()

    prompt = build_prompt(ROOT, agent_id=agent_id, agent_cfg=agent_cfg, work_item=item)
    emit_event(
        "agent_start",
        "Agent execution started",
        item_id=item["id"],
        agent_id=agent_id,
        role=agent_cfg.get("role"),
        model=execution_profile.get("model"),
        reasoning=execution_profile.get("reasoning"),
        fallback_model=execution_profile.get("fallback_model"),
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
                model=execution_profile.get("model"),
                fallback_model=execution_profile.get("fallback_model"),
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
    emit_event(
        "agent_end",
        "Agent execution finished",
        item_id=item["id"],
        agent_id=agent_id,
        result=worker.status,
        exit_code=worker.exit_code,
        elapsed_seconds=round(time.monotonic() - worker_started, 2),
        model_requested=worker.requested_model,
        model_used=worker.used_model,
        fallback_used=worker.fallback_used,
    )

    if verbose and worker.stdout:
        print(worker.stdout[-2000:])
    if verbose and worker.stderr:
        print(worker.stderr[-2000:], file=sys.stderr)

    if worker.status == "blocked":
        emit_event("blocked", "Work item blocked by agent", item_id=item["id"], agent_id=agent_id, reason=worker.summary)
        queue.mark_blocked(item["id"], worker.blocker_reason or worker.summary)
        queue.save()
        stats_tracker.record_result(stats, agent_id=agent_id, outcome="blocked", tokens_in=worker.tokens_in_est, tokens_out=worker.tokens_out_est)
        set_daemon_state(
            state="blocked",
            active_item=None,
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
                "model_requested": worker.requested_model,
                "model_used": worker.used_model,
                "fallback_used": worker.fallback_used,
            },
        )
    elif worker.status == "completed":
        emit_event("validating", "Starting validation for completed work item", item_id=item["id"], agent_id=agent_id)
        queue.mark_validating(item["id"])
        queue.save()
        set_daemon_state(state="validating", active_item={**item, "assigned_agent": agent_id}, lock_held=True)

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

        if validations_ok:
            emit_event("completed", "Work item completed", item_id=item["id"], agent_id=agent_id, commit_sha=commit_sha)
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
            stats_tracker.record_result(stats, agent_id=agent_id, outcome="completed", tokens_in=worker.tokens_in_est, tokens_out=worker.tokens_out_est)
            set_daemon_state(
                state="idle",
                active_item=None,
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
                    "model_requested": worker.requested_model,
                    "model_used": worker.used_model,
                    "fallback_used": worker.fallback_used,
                },
            )
        else:
            emit_event("validation_failed", "Validation or commit failed", item_id=item["id"], agent_id=agent_id)
            max_retries = int(policies.get("retry", {}).get("max_retries_per_item_per_agent", 2))
            retry_count = queue.increment_retry(item["id"], "validation failed or commit failed")
            if retry_count > max_retries:
                source_item = queue.get_active_item(item["id"])
                if source_item:
                    queue.create_escalation_item(
                        source_item,
                        lead_agent_name=agents.get("mara-voss", {}).get("display_name", "Mara Voss"),
                        reason="retry threshold exceeded",
                    )
                    queue.mark_blocked(item["id"], "retry threshold exceeded; escalated")
            queue.save()
            stats_tracker.record_result(stats, agent_id=agent_id, outcome="failed", tokens_in=worker.tokens_in_est, tokens_out=worker.tokens_out_est)
            set_daemon_state(
                state="error",
                active_item=None,
                last_error=f"Validation/commit failed for {item['id']}",
                last_run_summary=f"{item['id']} failed validation and was requeued",
                lock_held=True,
            )
            append_jsonl(
                RUN_HISTORY_PATH,
                {
                    "ts": utc_now_iso(),
                    "item_id": item["id"],
                    "agent_id": agent_id,
                    "result": "failed_validation",
                    "summary": worker.summary,
                    "validation_results": validation_results,
                    "model_requested": worker.requested_model,
                    "model_used": worker.used_model,
                    "fallback_used": worker.fallback_used,
                },
            )
    else:
        if is_systemic_worker_bootstrap_error(worker.summary, worker.exit_code):
            emit_event("infrastructure_error", "Worker bootstrap error; stopping daemon loop", item_id=item["id"], agent_id=agent_id, error=worker.summary)
            # Infrastructure misconfiguration (e.g. missing Codex CLI) should not burn retries
            # or spawn escalation chains. Leave the item queued and stop the daemon loop.
            queue.update_item_status(item["id"], "queued", last_failure_reason=worker.summary)
            queue.save()
            stats_tracker.record_result(stats, agent_id=agent_id, outcome="failed", tokens_in=worker.tokens_in_est, tokens_out=worker.tokens_out_est)
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
                    "model_requested": worker.requested_model,
                    "model_used": worker.used_model,
                    "fallback_used": worker.fallback_used,
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
            daemon_state = load_json(DAEMON_STATE_PATH, default_daemon_state())
            stats_tracker.write_progress_summary(
                daemon_state=daemon_state.get("state", "unknown"),
                active_item=daemon_state.get("active_item"),
                queue_counts=queue_counts(queue),
                milestone_progress=milestone_progress(queue),
            )
            print(render_status(build_status_payload(daemon_state=daemon_state, queue=queue, stats=stats)))
            return 3

        emit_event("failed", "Agent run failed; item will be retried or escalated", item_id=item["id"], agent_id=agent_id, reason=worker.summary)
        max_retries = int(policies.get("retry", {}).get("max_retries_per_item_per_agent", 2))
        retry_count = queue.increment_retry(item["id"], worker.summary)
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
        queue.save()
        stats_tracker.record_result(stats, agent_id=agent_id, outcome="failed", tokens_in=worker.tokens_in_est, tokens_out=worker.tokens_out_est)
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
                "model_requested": worker.requested_model,
                "model_used": worker.used_model,
                "fallback_used": worker.fallback_used,
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
    daemon_state = load_json(DAEMON_STATE_PATH, default_daemon_state())
    stats_tracker.write_progress_summary(
        daemon_state=daemon_state.get("state", "unknown"),
        active_item=daemon_state.get("active_item"),
        queue_counts=queue_counts(queue),
        milestone_progress=milestone_progress(queue),
    )
    print(render_status(build_status_payload(daemon_state=daemon_state, queue=queue, stats=stats)))
    return 0


def cmd_status() -> int:
    migrate_legacy_runtime_files()
    errors = validate_environment(ROOT)
    if errors:
        print("Environment validation failed:")
        for err in errors:
            print(f"- {err}")
        return 2

    agents = load_agent_catalog(ROOT)
    queue = QueueManager(ROOT)
    queue.load()
    stats = StatsTracker(ROOT, agents).load()
    daemon_state = load_json(DAEMON_STATE_PATH, default_daemon_state())
    print(render_status(build_status_payload(daemon_state=daemon_state, queue=queue, stats=stats)))
    return 0


def cmd_run(*, once: bool, sleep_seconds: int, dry_run: bool, verbose: bool, keep_alive: bool) -> int:
    migrate_legacy_runtime_files()
    lock = DaemonLock(os.getpid())
    try:
        lock.acquire()
    except RuntimeError as exc:
        set_daemon_state(state="error", last_error=str(exc), lock_held=False)
        print(str(exc), file=sys.stderr)
        return 1

    emit_event(
        "daemon_start",
        "Daemon started and lock acquired",
        pid=os.getpid(),
        mode="once" if once else "run",
        dry_run=dry_run,
        keep_alive=keep_alive,
    )
    set_daemon_state(lock_held=True, state="idle", last_error=None)
    try:
        # If a previous daemon run crashed or was interrupted, items may be left in
        # assigned/running/validating. With the lock acquired, no other daemon is active,
        # so these can be safely requeued.
        recovery_queue = QueueManager(ROOT)
        recovery_queue.load()
        recovered_items = recover_stale_in_progress_items(recovery_queue)
        if recovered_items:
            emit_event(
                "recovery",
                "Recovered stale in-progress items to queued state",
                count=len(recovered_items),
                item_ids=recovered_items,
            )

        if once:
            return process_one(dry_run=dry_run, verbose=verbose)
        while True:
            rc = process_one(dry_run=dry_run, verbose=verbose)
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
        set_daemon_state(lock_held=False, active_item=None, state="idle")
        lock.release()
        emit_event("daemon_stop", "Daemon stopped and lock released", pid=os.getpid())


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
