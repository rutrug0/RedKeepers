from __future__ import annotations

import os
import sys
from typing import Any


ANSI_RESET = "\x1b[0m"
ROLE_STYLE = {
    "lead": "1;35",
    "backend": "1;34",
    "frontend": "1;36",
    "design": "1;33",
    "content": "1;32",
    "qa": "1;31",
    "platform": "1;37",
}
COUNT_STYLE = {
    "ready": "1;32",
    "waiting": "1;33",
    "running": "1;36",
    "blocked": "1;31",
    "completed": "1;32",
    "open": "1",
    "done": "1;32",
    "fail": "1;31",
}


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


def _style(text: str, ansi_code: str | None) -> str:
    if not COLOR_ENABLED or not ansi_code:
        return text
    return f"\x1b[{ansi_code}m{text}{ANSI_RESET}"


def _safe_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _safe_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _color_count(name: str, value: int) -> str:
    return _style(str(value), COUNT_STYLE.get(name))


def render_status(data: dict[str, Any]) -> str:
    lines: list[str] = []
    daemon = data.get("daemon", {})
    queue = data.get("queue", {})
    active_item = daemon.get("active_item")
    agent_stats = data.get("agent_stats", {}).get("agents", {})
    workload_agents = data.get("agent_workload", {}).get("agents", {})

    lines.append("RedKeepers Daemon Status")
    lines.append(f"State: {daemon.get('state', 'unknown')}")
    lines.append(f"Lock held: {daemon.get('lock_held', False)}")
    lines.append(f"Last updated (UTC): {daemon.get('updated_at', 'n/a')}")
    if daemon.get("last_error"):
        lines.append(f"Last error: {daemon.get('last_error')}")

    if active_item:
        active_role = active_item.get("assigned_role")
        role_text = str(active_role or "").strip().lower()
        role_suffix = f" ({_style(role_text, ROLE_STYLE.get(role_text))})" if role_text else ""
        lines.append(
            "Active: "
            f"{active_item.get('id')} | {active_item.get('title')} | "
            f"{active_item.get('assigned_agent', 'unassigned')}{role_suffix}"
        )
    else:
        lines.append("Active: none")

    lines.append(
        "Queue: "
        f"queued={queue.get('queued', 0)} "
        f"dependency_ready={queue.get('dependency_ready', 0)} "
        f"running={queue.get('running', 0)} "
        f"blocked={queue.get('blocked', 0)} "
        f"completed={queue.get('completed', 0)}"
    )

    lines.append("Agent Utilization:")
    all_agent_ids = set(agent_stats.keys()) | set(workload_agents.keys())
    if workload_agents:
        agent_ids = sorted(
            all_agent_ids,
            key=lambda agent_id: (
                -_safe_int(workload_agents.get(agent_id, {}).get("ready")),
                -_safe_int(workload_agents.get(agent_id, {}).get("running")),
                agent_id,
            ),
        )
    else:
        agent_ids = sorted(all_agent_ids)
    for agent_id in agent_ids:
        stats = agent_stats.get(agent_id, {})
        workload = workload_agents.get(agent_id, {})
        role_text = str(stats.get("role") or "").strip().lower()
        role_suffix = f" ({_style(role_text, ROLE_STYLE.get(role_text))})" if role_text else ""

        runs = _safe_int(stats.get("total_runs"))
        done = _safe_int(stats.get("completed_items"))
        fail = _safe_int(stats.get("failed_runs"))
        total_runtime = round(_safe_float(stats.get("total_runtime_seconds")), 1)
        load = round(_safe_float(stats.get("current_load_score")), 2)

        line = (
            f"  - {agent_id}{role_suffix}: runs={runs} "
            f"done={_color_count('done', done)} "
            f"fail={_color_count('fail', fail)} "
            f"time={total_runtime}s load={load}"
        )

        if workload_agents:
            ready = _safe_int(workload.get("ready"))
            waiting = _safe_int(workload.get("waiting"))
            running = _safe_int(workload.get("running"))
            blocked = _safe_int(workload.get("blocked"))
            completed = _safe_int(workload.get("completed"))
            open_count = _safe_int(workload.get("open"))
            line += (
                " | open:"
                f" ready={_color_count('ready', ready)}"
                f" waiting={_color_count('waiting', waiting)}"
                f" running={_color_count('running', running)}"
                f" total={_color_count('open', open_count)}"
                " | backlog:"
                f" blocked={_color_count('blocked', blocked)}"
                f" completed={_color_count('completed', completed)}"
            )

        lines.append(line)

    if workload_agents:
        lines.append("Workload Buckets: ready=dependency-ready queued, waiting=queued with unmet dependencies.")

    return "\n".join(lines)
