from __future__ import annotations

import sys
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import orchestrator  # noqa: E402


class ValidationCommitFailureSplitTests(unittest.TestCase):
    def test_classifies_validation_failure(self) -> None:
        info = orchestrator._classify_validation_or_commit_failure(
            [
                {
                    "command": "python -m unittest tests.test_example",
                    "exit_code": 1,
                    "stdout_tail": "",
                    "stderr_tail": "AssertionError: expected 1 got 0",
                }
            ]
        )
        self.assertEqual(info["event_kind"], "validation_failed")
        self.assertEqual(info["retry_reason"], "validation failed")
        self.assertEqual(info["run_result"], "failed_validation")

    def test_classifies_commit_failure(self) -> None:
        info = orchestrator._classify_validation_or_commit_failure(
            [
                {
                    "command": "git commit",
                    "exit_code": 1,
                    "stdout_tail": "",
                    "stderr_tail": "nothing to commit, working tree clean",
                }
            ]
        )
        self.assertEqual(info["event_kind"], "commit_failed")
        self.assertEqual(info["retry_reason"], "commit failed")
        self.assertEqual(info["run_result"], "failed_commit")


if __name__ == "__main__":
    unittest.main()
