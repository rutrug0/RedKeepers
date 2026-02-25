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


class PlatformBootstrapTests(unittest.TestCase):
    def test_creates_platform_bootstrap_item_when_lane_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.active = []
            queue.completed = []
            queue.blocked = []
            agents = {"juno-cairn": {"display_name": "Juno Cairn", "role": "platform"}}

            item = orchestrator.ensure_platform_bootstrap_item(queue, agents)

        self.assertIsNotNone(item)
        assert item is not None
        self.assertEqual(item["owner_role"], "platform")
        self.assertEqual(item["preferred_agent"], "juno-cairn")
        self.assertEqual(item["status"], "queued")
        self.assertEqual(item["auto_generated"], "platform_bootstrap")

    def test_skips_when_platform_history_exists(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.active = []
            queue.completed = [{"id": "RK-OLD-PLATFORM", "owner_role": "platform"}]
            queue.blocked = []
            agents = {"juno-cairn": {"display_name": "Juno Cairn", "role": "platform"}}

            item = orchestrator.ensure_platform_bootstrap_item(queue, agents)

        self.assertIsNone(item)
        self.assertEqual(len(queue.active), 0)


if __name__ == "__main__":
    unittest.main()
