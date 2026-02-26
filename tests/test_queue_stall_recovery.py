from __future__ import annotations

import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import orchestrator  # noqa: E402
from queue_manager import QueueManager  # noqa: E402


def _prepare_queue(root: Path) -> QueueManager:
    backlog = root / "coordination" / "backlog"
    backlog.mkdir(parents=True, exist_ok=True)
    (backlog / "work-items.json").write_text("[]\n", encoding="utf-8")
    (backlog / "completed-items.json").write_text("[]\n", encoding="utf-8")
    (backlog / "blocked-items.json").write_text("[]\n", encoding="utf-8")
    queue = QueueManager(root)
    queue.active = []
    queue.completed = []
    queue.blocked = []
    return queue


class QueueStallRecoveryTests(unittest.TestCase):
    def test_skips_when_identical_snapshot_recently_handled(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = _prepare_queue(Path(tmpdir))
            now = datetime.now(timezone.utc).isoformat()
            queue.active = [
                {
                    "id": "RK-CHILD-1",
                    "status": "queued",
                    "dependencies": ["RK-BLOCKED-1"],
                }
            ]
            queue.blocked = [{"id": "RK-BLOCKED-1", "status": "blocked", "dependencies": []}]
            queue.completed = [
                {
                    "id": "RK-AUTO-STALL-0001",
                    "status": "completed",
                    "auto_generated": "queue_stall_recovery",
                    "stall_snapshot": [{"item_id": "RK-CHILD-1", "blocked_dependencies": ["RK-BLOCKED-1"]}],
                    "created_at": now,
                    "updated_at": now,
                }
            ]

            with mock.patch.object(orchestrator, "STALL_RECOVERY_COOLDOWN_SECONDS", 900):
                created = orchestrator.ensure_queue_stall_recovery_item(queue)

        self.assertIsNone(created)
        self.assertFalse(any(item.get("auto_generated") == "queue_stall_recovery" for item in queue.active))

    def test_creates_when_identical_snapshot_is_past_cooldown(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = _prepare_queue(Path(tmpdir))
            old = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            queue.active = [
                {
                    "id": "RK-CHILD-1",
                    "status": "queued",
                    "dependencies": ["RK-BLOCKED-1"],
                }
            ]
            queue.blocked = [{"id": "RK-BLOCKED-1", "status": "blocked", "dependencies": []}]
            queue.completed = [
                {
                    "id": "RK-AUTO-STALL-0001",
                    "status": "completed",
                    "auto_generated": "queue_stall_recovery",
                    "stall_snapshot": [{"item_id": "RK-CHILD-1", "blocked_dependencies": ["RK-BLOCKED-1"]}],
                    "created_at": old,
                    "updated_at": old,
                }
            ]

            with mock.patch.object(orchestrator, "STALL_RECOVERY_COOLDOWN_SECONDS", 900):
                created = orchestrator.ensure_queue_stall_recovery_item(queue)

        self.assertIsNotNone(created)
        assert created is not None
        self.assertEqual(created["auto_generated"], "queue_stall_recovery")

    def test_creates_when_stall_snapshot_changes_inside_cooldown(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = _prepare_queue(Path(tmpdir))
            now = datetime.now(timezone.utc).isoformat()
            queue.active = [
                {
                    "id": "RK-CHILD-NEW",
                    "status": "queued",
                    "dependencies": ["RK-BLOCKED-2"],
                }
            ]
            queue.blocked = [{"id": "RK-BLOCKED-2", "status": "blocked", "dependencies": []}]
            queue.completed = [
                {
                    "id": "RK-AUTO-STALL-0001",
                    "status": "completed",
                    "auto_generated": "queue_stall_recovery",
                    "stall_snapshot": [{"item_id": "RK-CHILD-OLD", "blocked_dependencies": ["RK-BLOCKED-1"]}],
                    "created_at": now,
                    "updated_at": now,
                }
            ]

            with mock.patch.object(orchestrator, "STALL_RECOVERY_COOLDOWN_SECONDS", 900):
                created = orchestrator.ensure_queue_stall_recovery_item(queue)

        self.assertIsNotNone(created)
        assert created is not None
        self.assertEqual(created["stall_snapshot"][0]["item_id"], "RK-CHILD-NEW")

    def test_skips_when_stall_item_is_already_inflight(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = _prepare_queue(Path(tmpdir))
            queue.active = [
                {
                    "id": "RK-CHILD-1",
                    "status": "queued",
                    "dependencies": ["RK-BLOCKED-1"],
                },
                {
                    "id": "RK-AUTO-STALL-0099",
                    "status": "running",
                    "auto_generated": "queue_stall_recovery",
                    "stall_snapshot": [{"item_id": "RK-CHILD-1", "blocked_dependencies": ["RK-BLOCKED-1"]}],
                },
            ]
            queue.blocked = [{"id": "RK-BLOCKED-1", "status": "blocked", "dependencies": []}]

            created = orchestrator.ensure_queue_stall_recovery_item(queue)

        self.assertIsNone(created)

    def test_creates_for_unmet_nonblocked_dependency_stall(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = _prepare_queue(Path(tmpdir))
            queue.active = [
                {
                    "id": "RK-A",
                    "status": "queued",
                    "dependencies": ["RK-B"],
                },
                {
                    "id": "RK-B",
                    "status": "queued",
                    "dependencies": ["RK-A"],
                },
            ]
            queue.blocked = []
            queue.completed = []

            with mock.patch.object(orchestrator, "STALL_RECOVERY_COOLDOWN_SECONDS", 0):
                created = orchestrator.ensure_queue_stall_recovery_item(queue)

        self.assertIsNotNone(created)
        assert created is not None
        rows = created.get("stall_snapshot", [])
        self.assertEqual(len(rows), 2)
        self.assertTrue(all("unmet_dependencies" in row for row in rows))


if __name__ == "__main__":
    unittest.main()
