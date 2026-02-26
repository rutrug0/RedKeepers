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


class NonActionableBlockerGuardTests(unittest.TestCase):
    def test_find_non_actionable_blocked_items_flags_none_reason(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.active = [{"id": "RK-CHILD", "status": "queued", "dependencies": ["RK-BLOCKED"]}]
            queue.completed = []
            queue.blocked = [{"id": "RK-BLOCKED", "status": "blocked", "dependencies": [], "blocker_reason": "- None."}]

            rows = orchestrator.find_non_actionable_blocked_items(queue)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["item_id"], "RK-BLOCKED")
        self.assertTrue(rows[0]["dependencies_ready"])
        self.assertEqual(rows[0]["blocking_dependents"], 1)
        self.assertEqual(rows[0]["dependent_items"], ["RK-CHILD"])

    def test_guard_auto_requeues_dependency_ready_non_actionable_item(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            backlog = root / "coordination" / "backlog"
            backlog.mkdir(parents=True, exist_ok=True)
            (backlog / "work-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "completed-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "blocked-items.json").write_text("[]\n", encoding="utf-8")

            queue = QueueManager(root)
            queue.active = []
            queue.completed = [{"id": "DEP-1"}]
            queue.blocked = [
                {
                    "id": "RK-BLOCKED",
                    "status": "blocked",
                    "dependencies": ["DEP-1"],
                    "blocker_reason": "- None.",
                    "created_at": "2026-02-26T00:00:00+00:00",
                    "updated_at": "2026-02-26T00:00:00+00:00",
                }
            ]

            result = orchestrator.guard_non_actionable_blocked_items(
                queue,
                {
                    "non_actionable_blocker_guard": {
                        "enabled": True,
                        "auto_requeue_dependency_ready": True,
                        "max_auto_requeue_per_cycle": 2,
                        "route_lead_triage": True,
                    }
                },
                dry_run=False,
            )

        self.assertEqual(result["auto_requeued"], ["RK-BLOCKED"])
        self.assertIsNone(result["triage_item_id"])
        self.assertEqual(len(queue.blocked), 0)
        self.assertEqual(len(queue.active), 1)
        self.assertEqual(queue.active[0]["id"], "RK-BLOCKED")
        self.assertEqual(queue.active[0]["status"], "queued")

    def test_guard_creates_lead_triage_item_for_blocking_dependents(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            backlog = root / "coordination" / "backlog"
            backlog.mkdir(parents=True, exist_ok=True)
            (backlog / "work-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "completed-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "blocked-items.json").write_text("[]\n", encoding="utf-8")

            queue = QueueManager(root)
            queue.active = [{"id": "RK-CHILD", "status": "queued", "dependencies": ["RK-BLOCKED"]}]
            queue.completed = []
            queue.blocked = [
                {
                    "id": "RK-BLOCKED",
                    "status": "blocked",
                    "dependencies": ["DEP-MISSING"],
                    "blocker_reason": "None",
                    "created_at": "2026-02-26T00:00:00+00:00",
                    "updated_at": "2026-02-26T00:00:00+00:00",
                }
            ]

            result = orchestrator.guard_non_actionable_blocked_items(
                queue,
                {
                    "non_actionable_blocker_guard": {
                        "enabled": True,
                        "auto_requeue_dependency_ready": True,
                        "route_lead_triage": True,
                        "triage_only_when_blocking_dependents": True,
                    }
                },
                dry_run=False,
            )

        self.assertEqual(result["auto_requeued"], [])
        self.assertIsNotNone(result["triage_item_id"])
        triage_items = [item for item in queue.active if item.get("auto_generated") == "non_actionable_blocker_triage"]
        self.assertEqual(len(triage_items), 1)
        snapshot = triage_items[0].get("non_actionable_blocked_snapshot", [])
        self.assertEqual(snapshot[0]["item_id"], "RK-BLOCKED")
        self.assertEqual(snapshot[0]["blocking_dependents"], 1)

    def test_cmd_status_reports_non_actionable_blocked_warning(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            backlog = root / "coordination" / "backlog"
            runtime = root / "coordination" / "runtime"
            state = root / "coordination" / "state"
            backlog.mkdir(parents=True, exist_ok=True)
            runtime.mkdir(parents=True, exist_ok=True)
            state.mkdir(parents=True, exist_ok=True)

            (backlog / "work-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "completed-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "blocked-items.json").write_text(
                json.dumps(
                    [
                        {
                            "id": "RK-BLOCKED",
                            "status": "blocked",
                            "dependencies": [],
                            "blocker_reason": "- None.",
                            "owner_role": "qa",
                        }
                    ]
                ),
                encoding="utf-8",
            )
            (backlog / "blocked-archived-items.json").write_text("[]\n", encoding="utf-8")
            (runtime / "daemon-state.json").write_text("{}\n", encoding="utf-8")
            (state / "agents.json").write_text(
                json.dumps(
                    {
                        "tomas-grell": {
                            "display_name": "Tomas Grell",
                            "role": "qa",
                        }
                    }
                ),
                encoding="utf-8",
            )

            out = io.StringIO()
            with (
                mock.patch.object(orchestrator, "ROOT", root),
                mock.patch.object(orchestrator, "RUNTIME_DIR", runtime),
                mock.patch.object(orchestrator, "STATIC_STATE_DIR", state),
                mock.patch.object(orchestrator, "DAEMON_STATE_PATH", runtime / "daemon-state.json"),
                mock.patch.object(orchestrator, "BLOCKED_ARCHIVED_PATH", backlog / "blocked-archived-items.json"),
                mock.patch.object(orchestrator, "validate_environment", return_value=[]),
                redirect_stdout(out),
            ):
                rc = orchestrator.cmd_status()

        self.assertEqual(rc, 0)
        text = out.getvalue()
        self.assertIn("Backlog health warnings:", text)
        self.assertIn("RK-BLOCKED", text)


if __name__ == "__main__":
    unittest.main()
