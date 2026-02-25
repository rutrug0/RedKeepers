from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import orchestrator  # noqa: E402
from queue_manager import QueueManager  # noqa: E402


class QueueIntegrityTests(unittest.TestCase):
    def test_mark_completed_replaces_existing_archive_item(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            queue = QueueManager(root)
            queue.active = [
                {
                    "id": "RK-1",
                    "status": "running",
                    "updated_at": "2026-02-25T10:00:00+00:00",
                }
            ]
            queue.completed = [
                {
                    "id": "RK-1",
                    "status": "completed",
                    "updated_at": "2026-02-24T10:00:00+00:00",
                    "commit_sha": "oldsha",
                    "result_summary": "old",
                }
            ]
            queue.blocked = []

            queue.mark_completed("RK-1", "new summary", commit_sha="newsha")

        self.assertEqual(len(queue.completed), 1)
        self.assertEqual(queue.completed[0]["id"], "RK-1")
        self.assertEqual(queue.completed[0]["commit_sha"], "newsha")
        self.assertEqual(queue.completed[0]["result_summary"], "new summary")

    def test_archive_duplicate_repair_keeps_latest_entry(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            backlog = root / "coordination" / "backlog"
            backlog.mkdir(parents=True, exist_ok=True)
            (backlog / "work-items.json").write_text("[]\n", encoding="utf-8")

            completed = [
                {
                    "id": "RK-X",
                    "status": "completed",
                    "updated_at": "2026-02-25T10:00:00+00:00",
                    "commit_sha": "oldsha",
                },
                {
                    "id": "RK-X",
                    "status": "completed",
                    "updated_at": "2026-02-25T11:00:00+00:00",
                    "commit_sha": "newsha",
                },
            ]
            (backlog / "completed-items.json").write_text(json.dumps(completed), encoding="utf-8")
            (backlog / "blocked-items.json").write_text("[]\n", encoding="utf-8")

            repaired = orchestrator.repair_backlog_archive_duplicates(root)
            deduped = json.loads((backlog / "completed-items.json").read_text(encoding="utf-8"))

        self.assertEqual(repaired["completed_removed"], 1)
        self.assertEqual(repaired["completed_duplicate_ids"], ["RK-X"])
        self.assertEqual(len(deduped), 1)
        self.assertEqual(deduped[0]["commit_sha"], "newsha")


if __name__ == "__main__":
    unittest.main()
