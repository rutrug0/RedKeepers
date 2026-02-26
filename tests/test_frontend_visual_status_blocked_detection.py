from __future__ import annotations

import sys
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import orchestrator  # noqa: E402


class FrontendVisualStatusBlockedDetectionTests(unittest.TestCase):
    def test_status_preflight_playwright_error_is_environment_blocker(self) -> None:
        validation_results = [
            {
                "command": "python tools/orchestrator.py status",
                "effective_command": "\"C:\\Python\\python.exe\" tools/orchestrator.py status",
                "exit_code": 2,
                "stdout_tail": (
                    "Environment validation failed:\n"
                    "- frontend visual QA is enabled but Playwright is not importable in the active Python "
                    "interpreter (C:\\Python\\python.exe): No module named 'playwright'.\n"
                ),
                "stderr_tail": "",
            }
        ]

        reason = orchestrator.frontend_visual_environment_blocker_reason(validation_results, root=Path("."))
        self.assertIsNotNone(reason)
        self.assertIn("Frontend visual smoke blocked by environment", reason)
        self.assertIn("Playwright is not importable", reason)

    def test_status_preflight_playwright_error_is_detected_for_windows_path(self) -> None:
        validation_results = [
            {
                "command": "python tools\\orchestrator.py status",
                "effective_command": "\"C:\\Python\\python.exe\" tools\\orchestrator.py status",
                "exit_code": 2,
                "stdout_tail": (
                    "Environment validation failed:\n"
                    "- frontend visual QA is enabled but Playwright is not importable in the active Python "
                    "interpreter (C:\\Python\\python.exe): No module named 'playwright'.\n"
                ),
                "stderr_tail": "",
            }
        ]

        reason = orchestrator.frontend_visual_environment_blocker_reason(validation_results, root=Path("."))
        self.assertIsNotNone(reason)
        self.assertIn("Frontend visual smoke blocked by environment", reason)
        self.assertIn("Playwright is not importable", reason)


if __name__ == "__main__":
    unittest.main()
