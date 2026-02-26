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

    def test_higher_unblock_value_wins_between_same_priority_candidates(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.completed = []
            queue.blocked = []
            queue.active = [
                {
                    "id": "NORMAL-A",
                    "owner_role": "design",
                    "priority": "normal",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:01+00:00",
                },
                {
                    "id": "NORMAL-B",
                    "owner_role": "design",
                    "priority": "normal",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:02+00:00",
                },
                {
                    "id": "A-DEP-HIGH",
                    "owner_role": "design",
                    "priority": "high",
                    "status": "queued",
                    "dependencies": ["NORMAL-A"],
                    "created_at": "2026-02-25T00:00:03+00:00",
                },
                {
                    "id": "A-DEP-NORMAL",
                    "owner_role": "design",
                    "priority": "normal",
                    "status": "queued",
                    "dependencies": ["NORMAL-A"],
                    "created_at": "2026-02-25T00:00:04+00:00",
                },
                {
                    "id": "B-DEP-LOW",
                    "owner_role": "design",
                    "priority": "low",
                    "status": "queued",
                    "dependencies": ["NORMAL-B"],
                    "created_at": "2026-02-25T00:00:05+00:00",
                },
            ]
            routing = {
                "owner_role_map": {"design": "rowan-hale"},
                "dependency_unlock_priority": {
                    "enabled": True,
                    "critical_priority_protected": True,
                    "priority_boost_levels": 2,
                    "prefer_immediate_unblocks": True,
                },
            }

            selected = queue.select_next(routing, _base_stats())

        assert selected is not None
        self.assertEqual(selected["id"], "NORMAL-A")

    def test_transitive_unlock_value_breaks_tie(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.completed = []
            queue.blocked = []
            queue.active = [
                {
                    "id": "ROOT-A",
                    "owner_role": "design",
                    "priority": "normal",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:01+00:00",
                },
                {
                    "id": "ROOT-B",
                    "owner_role": "design",
                    "priority": "normal",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:02+00:00",
                },
                {
                    "id": "A-STEP-1",
                    "owner_role": "design",
                    "priority": "normal",
                    "status": "queued",
                    "dependencies": ["ROOT-A"],
                    "created_at": "2026-02-25T00:00:03+00:00",
                },
                {
                    "id": "A-STEP-2",
                    "owner_role": "design",
                    "priority": "high",
                    "status": "queued",
                    "dependencies": ["A-STEP-1"],
                    "created_at": "2026-02-25T00:00:04+00:00",
                },
                {
                    "id": "B-STEP-1",
                    "owner_role": "design",
                    "priority": "normal",
                    "status": "queued",
                    "dependencies": ["ROOT-B"],
                    "created_at": "2026-02-25T00:00:05+00:00",
                },
            ]
            routing = {
                "owner_role_map": {"design": "rowan-hale"},
                "dependency_unlock_priority": {
                    "enabled": True,
                    "critical_priority_protected": True,
                    "priority_boost_levels": 1,
                    "prefer_immediate_unblocks": True,
                },
            }

            selected = queue.select_next(routing, _base_stats())

        assert selected is not None
        self.assertEqual(selected["id"], "ROOT-A")

    def test_fast_cycle_role_bias_deprioritizes_noncritical_qa(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.completed = []
            queue.blocked = []
            queue.active = [
                {
                    "id": "QA-NORMAL",
                    "owner_role": "qa",
                    "priority": "normal",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:01+00:00",
                },
                {
                    "id": "BE-NORMAL",
                    "owner_role": "backend",
                    "priority": "normal",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:02+00:00",
                },
            ]
            routing = {
                "owner_role_map": {"qa": "tomas-grell", "backend": "ilya-fen"},
                "fast_cycle_role_priority": {
                    "enabled": True,
                    "deprioritize_roles": ["qa", "lead"],
                    "deprioritize_levels": 1,
                    "except_critical_priority": True,
                },
            }
            stats = {
                "agents": {
                    "tomas-grell": {"current_load_score": 0.0, "total_runs": 0},
                    "ilya-fen": {"current_load_score": 0.0, "total_runs": 0},
                }
            }

            selected = queue.select_next(routing, stats)

        assert selected is not None
        self.assertEqual(selected["id"], "BE-NORMAL")

    def test_fast_cycle_role_bias_does_not_penalize_critical(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.completed = []
            queue.blocked = []
            queue.active = [
                {
                    "id": "QA-CRIT",
                    "owner_role": "qa",
                    "priority": "critical",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:01+00:00",
                },
                {
                    "id": "BE-HIGH",
                    "owner_role": "backend",
                    "priority": "high",
                    "status": "queued",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:02+00:00",
                },
            ]
            routing = {
                "owner_role_map": {"qa": "tomas-grell", "backend": "ilya-fen"},
                "fast_cycle_role_priority": {
                    "enabled": True,
                    "deprioritize_roles": ["qa", "lead"],
                    "deprioritize_levels": 1,
                    "except_critical_priority": True,
                },
            }
            stats = {
                "agents": {
                    "tomas-grell": {"current_load_score": 0.0, "total_runs": 0},
                    "ilya-fen": {"current_load_score": 0.0, "total_runs": 0},
                }
            }

            selected = queue.select_next(routing, stats)

        assert selected is not None
        self.assertEqual(selected["id"], "QA-CRIT")


if __name__ == "__main__":
    unittest.main()
