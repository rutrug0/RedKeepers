from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from queue_manager import QueueManager  # noqa: E402


def _base_stats() -> dict:
    return {
        "agents": {
            "mara-voss": {"current_load_score": 0.0, "total_runs": 0},
            "rowan-hale": {"current_load_score": 0.0, "total_runs": 0},
        }
    }


class QueueSchedulerPriorityTests(unittest.TestCase):
    def test_unlocker_gets_boost_over_higher_priority_non_unlocker(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.completed = []
            queue.blocked = []
            queue.active = [
                {
                    "id": "HIGH-1",
                    "owner_role": "lead",
                    "priority": "high",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:01+00:00",
                },
                {
                    "id": "NORMAL-UNLOCK",
                    "owner_role": "design",
                    "priority": "normal",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:02+00:00",
                },
                {
                    "id": "DOWNSTREAM-1",
                    "owner_role": "design",
                    "priority": "high",
                    "status": "queued",
                    "dependencies": ["NORMAL-UNLOCK"],
                    "created_at": "2026-02-25T00:00:03+00:00",
                },
            ]
            routing = {
                "owner_role_map": {"lead": "mara-voss", "design": "rowan-hale"},
                "dependency_unlock_priority": {
                    "enabled": True,
                    "critical_priority_protected": True,
                    "priority_boost_levels": 1,
                    "prefer_immediate_unblocks": True,
                },
            }

            selected = queue.select_next(routing, _base_stats())

        assert selected is not None
        self.assertEqual(selected["id"], "NORMAL-UNLOCK")

    def test_critical_priority_stays_protected(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.completed = []
            queue.blocked = []
            queue.active = [
                {
                    "id": "CRIT-1",
                    "owner_role": "lead",
                    "priority": "critical",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:01+00:00",
                },
                {
                    "id": "HIGH-UNLOCK",
                    "owner_role": "design",
                    "priority": "high",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:02+00:00",
                },
                {
                    "id": "DOWNSTREAM-2",
                    "owner_role": "design",
                    "priority": "high",
                    "status": "queued",
                    "dependencies": ["HIGH-UNLOCK"],
                    "created_at": "2026-02-25T00:00:03+00:00",
                },
            ]
            routing = {
                "owner_role_map": {"lead": "mara-voss", "design": "rowan-hale"},
                "dependency_unlock_priority": {
                    "enabled": True,
                    "critical_priority_protected": True,
                    "priority_boost_levels": 1,
                    "prefer_immediate_unblocks": True,
                },
            }

            selected = queue.select_next(routing, _base_stats())

        assert selected is not None
        self.assertEqual(selected["id"], "CRIT-1")

    def test_baseline_order_without_unlock_priority(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.completed = []
            queue.blocked = []
            queue.active = [
                {
                    "id": "HIGH-1",
                    "owner_role": "lead",
                    "priority": "high",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:01+00:00",
                },
                {
                    "id": "NORMAL-UNLOCK",
                    "owner_role": "design",
                    "priority": "normal",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:02+00:00",
                },
                {
                    "id": "DOWNSTREAM-3",
                    "owner_role": "design",
                    "priority": "high",
                    "status": "queued",
                    "dependencies": ["NORMAL-UNLOCK"],
                    "created_at": "2026-02-25T00:00:03+00:00",
                },
            ]
            routing = {
                "owner_role_map": {"lead": "mara-voss", "design": "rowan-hale"},
                "dependency_unlock_priority": {"enabled": False},
            }

            selected = queue.select_next(routing, _base_stats())

        assert selected is not None
        self.assertEqual(selected["id"], "HIGH-1")


if __name__ == "__main__":
    unittest.main()
