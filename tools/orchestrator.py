from __future__ import annotations

import argparse
import os
import sys
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
STATE_DIR = ROOT / "coordination" / "state"
DAEMON_STATE_PATH = STATE_DIR / "daemon-state.json"
LOCK_META_PATH = STATE_DIR / "locks.json"
LOCK_FILE = STATE_DIR / "daemon.lock"


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
        STATE_DIR.mkdir(parents=True, exist_ok=True)
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


def process_one(
    *,
    dry_run: bool,
    verbose: bool,
) -> int:
    errors = validate_environment(ROOT)
    if errors:
        set_daemon_state(state="error", last_error="; ".join(errors[:5]), lock_held=False)
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

    if dry_run:
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
    worker = run_agent(
        project_root=ROOT,
        agent_id=agent_id,
        prompt=prompt,
        timeout_seconds=int(policies.get("retry", {}).get("worker_timeout_seconds", 900)),
        dry_run=False,
    )

    if verbose and worker.stdout:
        print(worker.stdout[-2000:])
    if verbose and worker.stderr:
        print(worker.stderr[-2000:], file=sys.stderr)

    if worker.status == "blocked":
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
            ROOT / "coordination" / "state" / "run-history.jsonl",
            {
                "ts": utc_now_iso(),
                "item_id": item["id"],
                "agent_id": agent_id,
                "result": "blocked",
                "summary": worker.summary,
            },
        )
    elif worker.status == "completed":
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
            queue.mark_completed(item["id"], worker.summary, commit_sha=commit_sha)
            queue.save()
            stats_tracker.record_result(stats, agent_id=agent_id, outcome="completed", tokens_in=worker.tokens_in_est, tokens_out=worker.tokens_out_est)
            set_daemon_state(
                state="idle",
                active_item=None,
                last_run_summary=f"{item['id']} completed by {agent_id}",
                lock_held=True,
            )
            append_jsonl(
                ROOT / "coordination" / "state" / "run-history.jsonl",
                {
                    "ts": utc_now_iso(),
                    "item_id": item["id"],
                    "agent_id": agent_id,
                    "result": "completed",
                    "summary": worker.summary,
                    "commit_sha": commit_sha,
                    "validation_results": validation_results,
                },
            )
        else:
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
                ROOT / "coordination" / "state" / "run-history.jsonl",
                {
                    "ts": utc_now_iso(),
                    "item_id": item["id"],
                    "agent_id": agent_id,
                    "result": "failed_validation",
                    "summary": worker.summary,
                    "validation_results": validation_results,
                },
            )
    else:
        max_retries = int(policies.get("retry", {}).get("max_retries_per_item_per_agent", 2))
        retry_count = queue.increment_retry(item["id"], worker.summary)
        if retry_count > max_retries:
            source_item = queue.get_active_item(item["id"])
            if source_item:
                queue.create_escalation_item(
                    source_item,
                    lead_agent_name=agents.get("mara-voss", {}).get("display_name", "Mara Voss"),
                    reason=worker.summary,
                )
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
            ROOT / "coordination" / "state" / "run-history.jsonl",
            {
                "ts": utc_now_iso(),
                "item_id": item["id"],
                "agent_id": agent_id,
                "result": "failed",
                "summary": worker.summary,
                "exit_code": worker.exit_code,
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
    return 0


def cmd_status() -> int:
    agents = load_agent_catalog(ROOT)
    queue = QueueManager(ROOT)
    queue.load()
    stats = StatsTracker(ROOT, agents).load()
    daemon_state = load_json(DAEMON_STATE_PATH, default_daemon_state())
    print(render_status(build_status_payload(daemon_state=daemon_state, queue=queue, stats=stats)))
    return 0


def cmd_run(*, once: bool, sleep_seconds: int, dry_run: bool, verbose: bool) -> int:
    lock = DaemonLock(os.getpid())
    try:
        lock.acquire()
    except RuntimeError as exc:
        set_daemon_state(state="error", last_error=str(exc), lock_held=False)
        print(str(exc), file=sys.stderr)
        return 1

    set_daemon_state(lock_held=True, state="idle", last_error=None)
    try:
        if once:
            return process_one(dry_run=dry_run, verbose=verbose)
        while True:
            rc = process_one(dry_run=dry_run, verbose=verbose)
            if rc != 0 or dry_run:
                return rc
            queue = QueueManager(ROOT)
            queue.load()
            if not any(item.get("status") == "queued" for item in queue.active):
                return 0
            time.sleep(sleep_seconds)
    finally:
        set_daemon_state(lock_held=False, active_item=None, state="idle")
        lock.release()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="RedKeepers head daemon orchestrator")
    sub = parser.add_subparsers(dest="command", required=True)

    run_p = sub.add_parser("run", help="Run the daemon loop until queue is idle")
    run_p.add_argument("--sleep-seconds", type=int, default=5)
    run_p.add_argument("--dry-run", action="store_true")
    run_p.add_argument("--verbose", action="store_true")

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
        return cmd_run(once=True, sleep_seconds=0, dry_run=args.dry_run, verbose=args.verbose)
    if args.command == "run":
        return cmd_run(once=False, sleep_seconds=args.sleep_seconds, dry_run=args.dry_run, verbose=args.verbose)
    parser.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

