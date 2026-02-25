from __future__ import annotations

import codecs
import json
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


class JsonCompatTests(unittest.TestCase):
    def test_load_json_accepts_utf8_bom(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "bom.json"
            path.write_bytes(codecs.BOM_UTF8 + b'{"ok": true}')

            data = load_json(path, {})

        self.assertEqual(data, {"ok": True})

    def test_outbox_parse_error_is_reported_without_crashing(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            outbox_path = root / "agents" / "mara-voss" / "outbox.json"
            outbox_path.parent.mkdir(parents=True, exist_ok=True)
            outbox_path.write_text("{bad json", encoding="utf-8")

            queue = QueueManager(root)
            queue.active = []
            queue.completed = []
            queue.blocked = []

            source_item = {"id": "RK-TEST-0001", "milestone": "M0"}
            routing_rules = {"owner_role_map": {"lead": "mara-voss"}}

            with mock.patch.object(orchestrator, "ROOT", root):
                created, rejected = orchestrator.ingest_agent_follow_up_tasks(
                    queue,
                    agent_id="mara-voss",
                    source_item=source_item,
                    routing_rules=routing_rules,
                )

        self.assertEqual(created, [])
        self.assertEqual(len(rejected), 1)
        self.assertIn("failed reading outbox.json", rejected[0]["errors"][0])


if __name__ == "__main__":
    unittest.main()
