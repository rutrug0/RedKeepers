from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import orchestrator  # noqa: E402
from queue_manager import QueueManager  # noqa: E402
from schemas import load_json  # noqa: E402


class BlockedArchiveTests(unittest.TestCase):
    def test_archives_only_matching_non_actionable_blocked_items(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            backlog_dir = root / "coordination" / "backlog"
            backlog_dir.mkdir(parents=True, exist_ok=True)
            (backlog_dir / "work-items.json").write_text("[]\n", encoding="utf-8")
            (backlog_dir / "completed-items.json").write_text("[]\n", encoding="utf-8")
            (backlog_dir / "blocked-items.json").write_text("[]\n", encoding="utf-8")

            queue = QueueManager(root)
            queue.active = []
            queue.completed = []
            queue.blocked = [
                {
                    "id": "B-ARCHIVE",
                    "status": "blocked",
                    "blocker_reason": "Superseded escalation-chain artifact retained for audit only.",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:00+00:00",
                    "updated_at": "2026-02-25T00:00:00+00:00",
                    "title": "legacy blocked",
                    "description": "legacy",
                    "milestone": "M0",
                    "type": "qa",
                    "priority": "normal",
                    "owner_role": "lead",
                    "inputs": [],
                    "acceptance_criteria": [],
                    "validation_commands": [],
                    "retry_count": 0,
                    "estimated_effort": "S",
                    "token_budget": 1,
                    "escalation_target": "Mara Voss",
                },
                {
                    "id": "B-KEEP",
                    "status": "blocked",
                    "blocker_reason": "Repeated failure: model not supported when using Codex with a ChatGPT account.",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:00+00:00",
                    "updated_at": "2026-02-25T00:00:00+00:00",
                    "title": "actionable blocked",
                    "description": "actionable",
                    "milestone": "M0",
                    "type": "qa",
                    "priority": "high",
                    "owner_role": "lead",
                    "inputs": [],
                    "acceptance_criteria": [],
                    "validation_commands": [],
                    "retry_count": 0,
                    "estimated_effort": "S",
                    "token_budget": 1,
                    "escalation_target": "Mara Voss",
                },
            ]

            with (
                mock.patch.object(orchestrator, "ROOT", root),
                mock.patch.object(orchestrator, "BLOCKED_ARCHIVED_PATH", backlog_dir / "blocked-archived-items.json"),
            ):
                moved = orchestrator.archive_non_actionable_blocked_items(
                    queue,
                    {
                        "blocked_archive": {
                            "enabled": True,
                            "include_reason_patterns": ["retained for audit only", "no changes were made"],
                            "exclude_reason_patterns": ["repeated failure"],
                        }
                    },
                )

                archived_rows = load_json(backlog_dir / "blocked-archived-items.json", [])

        self.assertEqual(moved, ["B-ARCHIVE"])
        self.assertEqual(len(queue.blocked), 1)
        self.assertEqual(queue.blocked[0]["id"], "B-KEEP")
        self.assertEqual(len(archived_rows), 1)
        self.assertEqual(archived_rows[0]["id"], "B-ARCHIVE")
        self.assertEqual(archived_rows[0]["archive_reason"], "non_actionable_blocked")

    def test_disabled_archive_does_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            queue = QueueManager(root)
            queue.active = []
            queue.completed = []
            queue.blocked = [
                {
                    "id": "B-1",
                    "status": "blocked",
                    "blocker_reason": "retained for audit only",
                    "dependencies": [],
                    "created_at": "2026-02-25T00:00:00+00:00",
                    "updated_at": "2026-02-25T00:00:00+00:00",
                    "title": "blocked",
                    "description": "blocked",
                    "milestone": "M0",
                    "type": "qa",
                    "priority": "normal",
                    "owner_role": "lead",
                    "inputs": [],
                    "acceptance_criteria": [],
                    "validation_commands": [],
                    "retry_count": 0,
                    "estimated_effort": "S",
                    "token_budget": 1,
                    "escalation_target": "Mara Voss",
                }
            ]

            moved = orchestrator.archive_non_actionable_blocked_items(
                queue,
                {"blocked_archive": {"enabled": False}},
            )

        self.assertEqual(moved, [])
        self.assertEqual(len(queue.blocked), 1)


if __name__ == "__main__":
    unittest.main()
