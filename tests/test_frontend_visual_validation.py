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

    def test_frontend_visual_validation_enabled_via_commit_policy(self) -> None:
        item = {"owner_role": "frontend", "validation_commands": []}
        rules = {
            "default_validation_commands": [],
            "frontend_visual_qa": {
                "enabled": True,
                "strict": True,
                "max_overflow_px": 0,
                "max_diff_percent": 0.5,
            },
        }
        commands = orchestrator.build_validation_commands(item, rules)
        self.assertTrue(any("frontend_visual_smoke.py" in cmd for cmd in commands))


class PlatformValidationCommandTests(unittest.TestCase):
    def test_platform_web_packaging_validation_enabled_for_matching_item(self) -> None:
        item = {
            "owner_role": "platform",
            "validation_commands": ["python tools/orchestrator.py status"],
            "inputs": ["tools/web_vertical_slice_packaging.py"],
        }
        rules = {
            "default_validation_commands": [],
            "platform_web_packaging_validation": {
                "enabled": True,
                "owner_roles": ["platform"],
                "match_inputs_any": ["tools/web_vertical_slice_packaging.py"],
                "commands": [
                    "python tools/web_vertical_slice_packaging.py package --clean",
                    "python tools/web_vertical_slice_packaging.py smoke",
                ],
            },
        }

        commands = orchestrator.build_validation_commands(item, rules)

        self.assertIn("python tools/orchestrator.py status", commands)
        self.assertIn("python tools/web_vertical_slice_packaging.py package --clean", commands)
        self.assertIn("python tools/web_vertical_slice_packaging.py smoke", commands)

    def test_platform_web_packaging_validation_skips_non_matching_item(self) -> None:
        item = {
            "owner_role": "platform",
            "validation_commands": [],
            "inputs": ["tools/steam_tauri_wrapper.py"],
        }
        rules = {
            "default_validation_commands": [],
            "platform_web_packaging_validation": {
                "enabled": True,
                "owner_roles": ["platform"],
                "match_inputs_any": ["tools/web_vertical_slice_packaging.py"],
                "commands": [
                    "python tools/web_vertical_slice_packaging.py package --clean",
                    "python tools/web_vertical_slice_packaging.py smoke",
                ],
            },
        }

        commands = orchestrator.build_validation_commands(item, rules)
        self.assertEqual(commands, [])


if __name__ == "__main__":
    unittest.main()
