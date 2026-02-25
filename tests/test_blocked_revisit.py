from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import orchestrator  # noqa: E402
from queue_manager import QueueManager  # noqa: E402


class BlockedRevisitTests(unittest.TestCase):
    def test_requeues_matching_blocked_item(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.active = []
            queue.completed = [{"id": "DEP-1"}]
            queue.blocked = [
                {
                    "id": "RK-1",
                    "status": "blocked",
                    "dependencies": ["DEP-1"],
                    "blocker_reason": "Repeated failure: model is not supported when using Codex with a ChatGPT account",
                    "created_at": "2026-02-01T00:00:00+00:00",
                    "updated_at": "2026-02-01T00:00:00+00:00",
                }
            ]

            reopened = orchestrator.revisit_recoverable_blocked_items(
                queue,
                {
                    "blocked_revisit": {
                        "enabled": True,
                        "max_items_per_cycle": 2,
                        "max_attempts_per_item": 2,
                        "cooldown_seconds": 0,
                        "include_reason_patterns": ["not supported"],
                        "exclude_reason_patterns": ["retained for audit only"],
                    }
                },
            )

        self.assertEqual(reopened, ["RK-1"])
        self.assertEqual(len(queue.blocked), 0)
        self.assertEqual(len(queue.active), 1)
        self.assertEqual(queue.active[0]["status"], "queued")
        self.assertEqual(queue.active[0]["blocked_revisit_count"], 1)

    def test_does_not_requeue_excluded_audit_block(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.active = []
            queue.completed = []
            queue.blocked = [
                {
                    "id": "RK-AUDIT",
                    "status": "blocked",
                    "dependencies": [],
                    "blocker_reason": "Superseded escalation-chain artifact from incident; retained for audit only.",
                    "created_at": "2026-02-01T00:00:00+00:00",
                    "updated_at": "2026-02-01T00:00:00+00:00",
                }
            ]

            reopened = orchestrator.revisit_recoverable_blocked_items(
                queue,
                {
                    "blocked_revisit": {
                        "enabled": True,
                        "cooldown_seconds": 0,
                        "include_reason_patterns": ["artifact", "audit"],
                        "exclude_reason_patterns": ["retained for audit only"],
                    }
                },
            )

        self.assertEqual(reopened, [])
        self.assertEqual(len(queue.blocked), 1)
        self.assertEqual(len(queue.active), 0)

    def test_respects_cooldown_and_dependency_readiness(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.active = []
            queue.completed = []
            queue.blocked = [
                {
                    "id": "RK-NEW",
                    "status": "blocked",
                    "dependencies": [],
                    "blocker_reason": "model preflight blocked execution",
                    "created_at": "2026-02-25T18:00:00+00:00",
                    "updated_at": "2099-01-01T00:00:00+00:00",
                },
                {
                    "id": "RK-WAIT-DEP",
                    "status": "blocked",
                    "dependencies": ["DEP-X"],
                    "blocker_reason": "model preflight blocked execution",
                    "created_at": "2026-02-01T00:00:00+00:00",
                    "updated_at": "2026-02-01T00:00:00+00:00",
                },
            ]

            reopened = orchestrator.revisit_recoverable_blocked_items(
                queue,
                {
                    "blocked_revisit": {
                        "enabled": True,
                        "cooldown_seconds": 3600,
                        "include_reason_patterns": ["model preflight"],
                    }
                },
            )

        self.assertEqual(reopened, [])
        self.assertEqual(len(queue.blocked), 2)
        self.assertEqual(len(queue.active), 0)


if __name__ == "__main__":
    unittest.main()
