from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import orchestrator  # noqa: E402


class ValidationScopeGuardTests(unittest.TestCase):
    def test_filters_unittest_discover_by_default(self) -> None:
        item = {
            "owner_role": "qa",
            "validation_commands": [
                "python -m unittest discover -s tests",
                "python tools/orchestrator.py status",
            ],
        }
        commands = orchestrator.build_validation_commands(item, {"default_validation_commands": []})
        self.assertNotIn("python -m unittest discover -s tests", commands)
        self.assertIn("python tools/orchestrator.py status", commands)

    def test_allows_full_suite_when_env_override_enabled(self) -> None:
        item = {
            "owner_role": "qa",
            "validation_commands": [
                "python -m unittest discover -s tests",
                "python tools/orchestrator.py status",
            ],
        }
        with mock.patch.dict("os.environ", {"REDKEEPERS_ALLOW_FULL_SUITE_VALIDATION": "1"}, clear=False):
            commands = orchestrator.build_validation_commands(item, {"default_validation_commands": []})
        self.assertIn("python -m unittest discover -s tests", commands)
        self.assertIn("python tools/orchestrator.py status", commands)

    def test_policy_can_disable_scope_guard(self) -> None:
        item = {
            "owner_role": "qa",
            "validation_commands": [
                "python -m unittest discover -s tests",
            ],
        }
        rules = {
            "default_validation_commands": [],
            "validation_scope_guard": {"enabled": False},
        }
        commands = orchestrator.build_validation_commands(item, rules)
        self.assertIn("python -m unittest discover -s tests", commands)


if __name__ == "__main__":
    unittest.main()
