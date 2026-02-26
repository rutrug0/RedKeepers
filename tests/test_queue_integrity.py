from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock


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

    def test_recover_stale_in_progress_skips_archived_ids(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            backlog = root / "coordination" / "backlog"
            backlog.mkdir(parents=True, exist_ok=True)
            (backlog / "work-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "completed-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "blocked-items.json").write_text("[]\n", encoding="utf-8")

            queue = QueueManager(root)
            queue.active = [
                {
                    "id": "RK-M0-ARCHIVED",
                    "status": "running",
                    "dependencies": [],
                    "updated_at": "2026-02-26T08:00:00+00:00",
                },
                {
                    "id": "RK-M0-LIVE",
                    "status": "assigned",
                    "dependencies": [],
                    "updated_at": "2026-02-26T08:00:00+00:00",
                },
            ]
            queue.completed = []
            queue.blocked = []

            recovered, skipped = orchestrator.recover_stale_in_progress_items(
                queue,
                archived_ids={"RK-M0-ARCHIVED"},
            )

        self.assertEqual(recovered, ["RK-M0-LIVE"])
        self.assertEqual(skipped, ["RK-M0-ARCHIVED"])
        self.assertEqual([item["id"] for item in queue.active], ["RK-M0-LIVE"])
        self.assertEqual(queue.active[0]["status"], "queued")

    def test_normalize_queued_dependencies_removes_invalid_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            backlog = root / "coordination" / "backlog"
            backlog.mkdir(parents=True, exist_ok=True)
            (backlog / "work-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "completed-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "blocked-items.json").write_text("[]\n", encoding="utf-8")

            queue = QueueManager(root)
            queue.active = [
                {
                    "id": "RK-M0-TARGET",
                    "status": "queued",
                    "dependencies": ["tests package", "RK-M0-ARCHIVED", "RK-M0-UPSTREAM", "RK-M0-MISSING", 42],
                    "updated_at": "2026-02-26T08:00:00+00:00",
                }
            ]
            queue.completed = [{"id": "RK-M0-UPSTREAM"}]
            queue.blocked = []

            warnings = orchestrator.normalize_queued_item_dependencies(
                queue,
                archived_ids={"RK-M0-ARCHIVED"},
            )

        self.assertEqual(queue.active[0]["dependencies"], ["RK-M0-UPSTREAM"])
        reasons = {row["reason"] for row in warnings}
        self.assertEqual(
            reasons,
            {"non_id_dependency_value", "archived_dependency_id", "unknown_dependency_id", "non_string_dependency"},
        )

    def test_cmd_status_reports_dependency_ready_count_after_normalization(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            backlog = root / "coordination" / "backlog"
            runtime = root / "coordination" / "runtime"
            static_state = root / "coordination" / "state"
            backlog.mkdir(parents=True, exist_ok=True)
            runtime.mkdir(parents=True, exist_ok=True)
            static_state.mkdir(parents=True, exist_ok=True)

            work_items = [
                {
                    "id": "RK-M0-READY",
                    "title": "ready item",
                    "description": "ready after normalization",
                    "milestone": "M0",
                    "type": "feature",
                    "priority": "normal",
                    "owner_role": "qa",
                    "preferred_agent": None,
                    "dependencies": ["tests package"],
                    "inputs": [],
                    "acceptance_criteria": ["x"],
                    "validation_commands": [],
                    "status": "queued",
                    "retry_count": 0,
                    "created_at": "2026-02-26T08:00:00+00:00",
                    "updated_at": "2026-02-26T08:00:00+00:00",
                    "estimated_effort": "S",
                    "token_budget": 1,
                    "result_summary": None,
                    "blocker_reason": None,
                    "escalation_target": "Mara Voss",
                }
            ]
            (backlog / "work-items.json").write_text(json.dumps(work_items), encoding="utf-8")
            (backlog / "completed-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "blocked-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "blocked-archived-items.json").write_text("[]\n", encoding="utf-8")
            (runtime / "daemon-state.json").write_text("{}\n", encoding="utf-8")
            (static_state / "agents.json").write_text("{}\n", encoding="utf-8")

            out = io.StringIO()
            with (
                mock.patch.object(orchestrator, "ROOT", root),
                mock.patch.object(orchestrator, "RUNTIME_DIR", runtime),
                mock.patch.object(orchestrator, "STATIC_STATE_DIR", static_state),
                mock.patch.object(orchestrator, "DAEMON_STATE_PATH", runtime / "daemon-state.json"),
                mock.patch.object(orchestrator, "BLOCKED_ARCHIVED_PATH", backlog / "blocked-archived-items.json"),
                mock.patch.object(orchestrator, "validate_environment", return_value=[]),
                redirect_stdout(out),
            ):
                rc = orchestrator.cmd_status()

        self.assertEqual(rc, 0)
        text = out.getvalue()
        self.assertIn("dependency_ready=1", text)
        self.assertIn("Dependency normalization warnings:", text)


if __name__ == "__main__":
    unittest.main()
