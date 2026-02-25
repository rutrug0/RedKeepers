from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import orchestrator  # noqa: E402


class FrontendValidationCommandTests(unittest.TestCase):
    def test_frontend_visual_validation_disabled_by_default(self) -> None:
        item = {"owner_role": "frontend", "validation_commands": []}
        with mock.patch.dict("os.environ", {}, clear=False):
            commands = orchestrator.build_validation_commands(item, {"default_validation_commands": []})
        self.assertEqual(commands, [])

    def test_frontend_visual_validation_enabled_via_env(self) -> None:
        item = {"owner_role": "frontend", "validation_commands": ["python tools/orchestrator.py status"]}
        with mock.patch.dict("os.environ", {"REDKEEPERS_ENABLE_FRONTEND_VISUAL_QA": "1"}, clear=False):
            commands = orchestrator.build_validation_commands(item, {"default_validation_commands": []})
        self.assertIn("python tools/orchestrator.py status", commands)
        self.assertTrue(any("frontend_visual_smoke.py" in cmd for cmd in commands))


if __name__ == "__main__":
    unittest.main()
