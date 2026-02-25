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


class HumanInboxTests(unittest.TestCase):
    def test_ensure_human_instruction_items_creates_and_dedupes(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            human = root / "Human"
            human.mkdir(parents=True, exist_ok=True)
            (human / "request-1.md").write_text("Please prioritize scouting flow.", encoding="utf-8")
            (human / "README.md").write_text("ignore me", encoding="utf-8")

            queue = QueueManager(root)
            queue.active = []
            queue.completed = []
            queue.blocked = []
            agents = {"mara-voss": {"display_name": "Mara Voss", "role": "lead"}}

            with mock.patch.object(orchestrator, "ROOT", root), mock.patch.object(orchestrator, "HUMAN_DIR", human):
                created_first = orchestrator.ensure_human_instruction_items(queue, agents)
                created_second = orchestrator.ensure_human_instruction_items(queue, agents)

        self.assertEqual(len(created_first), 1)
        self.assertEqual(created_first[0]["file"], "Human/request-1.md")
        self.assertEqual(created_second, [])
        self.assertEqual(len(queue.active), 1)
        self.assertEqual(queue.active[0]["owner_role"], "lead")
        self.assertEqual(queue.active[0]["priority"], "critical")
        self.assertEqual(queue.active[0]["human_instruction_file"], "Human/request-1.md")

    def test_consume_human_instruction_file_deletes_target_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            human = root / "Human"
            human.mkdir(parents=True, exist_ok=True)
            file_path = human / "request-2.txt"
            file_path.write_text("Do X then Y", encoding="utf-8")

            with mock.patch.object(orchestrator, "ROOT", root), mock.patch.object(orchestrator, "HUMAN_DIR", human):
                deleted, reason = orchestrator.consume_human_instruction_file(
                    {"human_instruction_file": "Human/request-2.txt"}
                )

        self.assertTrue(deleted)
        self.assertEqual(reason, "deleted")
        self.assertFalse(file_path.exists())

    def test_consume_human_instruction_file_rejects_path_escape(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            human = root / "Human"
            human.mkdir(parents=True, exist_ok=True)
            outside = root / "outside.txt"
            outside.write_text("secret", encoding="utf-8")

            with mock.patch.object(orchestrator, "ROOT", root), mock.patch.object(orchestrator, "HUMAN_DIR", human):
                deleted, reason = orchestrator.consume_human_instruction_file(
                    {"human_instruction_file": "Human/../outside.txt"}
                )

            self.assertFalse(deleted)
            self.assertEqual(reason, "missing_or_invalid_human_instruction_file")
            self.assertTrue(outside.exists())


if __name__ == "__main__":
    unittest.main()
