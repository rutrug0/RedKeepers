from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import git_guard  # noqa: E402


class GitGuardValidationCommandTests(unittest.TestCase):
    def test_normalizes_python_prefix_to_sys_executable(self) -> None:
        cmd = git_guard._normalize_validation_command("python tools/orchestrator.py status")
        self.assertIn("tools/orchestrator.py status", cmd)
        self.assertNotEqual(cmd, "python tools/orchestrator.py status")

    def test_respects_explicit_python_cmd_override(self) -> None:
        with mock.patch.dict("os.environ", {"REDKEEPERS_PYTHON_CMD": "py"}, clear=False):
            cmd = git_guard._normalize_validation_command("python -m unittest")
        self.assertTrue(cmd.startswith("py "))

    def test_leaves_non_python_command_unchanged(self) -> None:
        original = "git status --short"
        self.assertEqual(git_guard._normalize_validation_command(original), original)


if __name__ == "__main__":
    unittest.main()
