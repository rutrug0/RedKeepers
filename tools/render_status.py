from __future__ import annotations

from typing import Any


def render_status(data: dict[str, Any]) -> str:
    lines: list[str] = []
    daemon = data.get("daemon", {})
    queue = data.get("queue", {})
    active_item = daemon.get("active_item")
    agent_stats = data.get("agent_stats", {}).get("agents", {})

    lines.append("RedKeepers Daemon Status")
    lines.append(f"State: {daemon.get('state', 'unknown')}")
    lines.append(f"Lock held: {daemon.get('lock_held', False)}")
    lines.append(f"Last updated (UTC): {daemon.get('updated_at', 'n/a')}")
    if daemon.get("last_error"):
        lines.append(f"Last error: {daemon.get('last_error')}")

    if active_item:
        active_role = active_item.get("assigned_role")
        role_suffix = f" ({active_role})" if active_role else ""
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
        f"running={queue.get('running', 0)} "
        f"blocked={queue.get('blocked', 0)} "
        f"completed={queue.get('completed', 0)}"
    )

    lines.append("Agent Utilization:")
    for agent_id, stats in sorted(agent_stats.items()):
        role = stats.get("role")
        role_suffix = f" ({role})" if role else ""
        lines.append(
            f"  - {agent_id}{role_suffix}: runs={stats.get('total_runs', 0)} "
            f"done={stats.get('completed_items', 0)} "
            f"fail={stats.get('failed_runs', 0)} "
            f"time={round(float(stats.get('total_runtime_seconds', 0.0)), 1)}s "
            f"load={round(float(stats.get('current_load_score', 0.0)), 2)}"
        )

    return "\n".join(lines)
