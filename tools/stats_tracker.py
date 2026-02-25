from __future__ import annotations

from pathlib import Path
from time import monotonic
from typing import Any

from schemas import default_agent_stats, load_json, save_json_atomic, utc_now_iso


class StatsTracker:
    def __init__(self, root: Path, agents: dict[str, dict[str, Any]]):
        self.root = root
        self.agents_cfg = agents
        self.path = root / "coordination" / "state" / "agent-stats.json"
        self.progress_path = root / "coordination" / "state" / "progress-summary.json"
        self._run_started_at: float | None = None

    def load(self) -> dict[str, Any]:
        stats = load_json(self.path, None)
        if not stats:
            stats = default_agent_stats(self.agents_cfg)
            save_json_atomic(self.path, stats)
        # Backfill new agents if policy changes later.
        for agent_id, cfg in self.agents_cfg.items():
            stats.setdefault("agents", {})
            if agent_id not in stats["agents"]:
                stats["agents"][agent_id] = default_agent_stats({agent_id: cfg})["agents"][agent_id]
        stats.setdefault("totals", {})
        return stats

    def save(self, stats: dict[str, Any]) -> None:
        stats["generated_at"] = utc_now_iso()
        save_json_atomic(self.path, stats)

    def begin_run(self) -> None:
        self._run_started_at = monotonic()

    def _elapsed(self) -> float:
        if self._run_started_at is None:
            return 0.0
        return monotonic() - self._run_started_at

    def record_result(
        self,
        stats: dict[str, Any],
        *,
        agent_id: str,
        outcome: str,
        tokens_in: int = 0,
        tokens_out: int = 0,
    ) -> None:
        elapsed = self._elapsed()
        agent = stats["agents"][agent_id]
        agent["total_runs"] = int(agent.get("total_runs", 0)) + 1
        agent["total_runtime_seconds"] = float(agent.get("total_runtime_seconds", 0.0)) + elapsed
        agent["avg_runtime_seconds"] = (
            agent["total_runtime_seconds"] / max(agent["total_runs"], 1)
        )
        agent["estimated_tokens_in"] = int(agent.get("estimated_tokens_in", 0)) + tokens_in
        agent["estimated_tokens_out"] = int(agent.get("estimated_tokens_out", 0)) + tokens_out
        agent["last_active_at"] = utc_now_iso()

        if outcome == "completed":
            agent["completed_items"] = int(agent.get("completed_items", 0)) + 1
        elif outcome == "blocked":
            agent["blocked_items"] = int(agent.get("blocked_items", 0)) + 1
        else:
            agent["failed_runs"] = int(agent.get("failed_runs", 0)) + 1

        # Lower score is preferred by scheduler.
        agent["current_load_score"] = (
            int(agent.get("completed_items", 0))
            + int(agent.get("failed_runs", 0)) * 0.5
            + (float(agent.get("total_runtime_seconds", 0.0)) / 600.0)
        )

        stats["totals"]["runtime_seconds"] = float(stats["totals"].get("runtime_seconds", 0.0)) + elapsed
        stats["totals"]["estimated_tokens_total"] = int(stats["totals"].get("estimated_tokens_total", 0)) + tokens_in + tokens_out

    def refresh_queue_totals(self, stats: dict[str, Any], *, queued_count: int, blocked_count: int, completed_count: int) -> None:
        stats["totals"]["queued_items"] = queued_count
        stats["totals"]["blocked_items"] = blocked_count
        stats["totals"]["completed_items"] = completed_count

    def write_progress_summary(
        self,
        *,
        daemon_state: str,
        active_item: dict[str, Any] | None,
        queue_counts: dict[str, int],
        milestone_progress: dict[str, dict[str, int]],
    ) -> None:
        payload = {
            "generated_at": utc_now_iso(),
            "daemon_state": daemon_state,
            "active_item": active_item,
            "queue_counts": queue_counts,
            "milestone_progress": milestone_progress,
        }
        save_json_atomic(self.progress_path, payload)

