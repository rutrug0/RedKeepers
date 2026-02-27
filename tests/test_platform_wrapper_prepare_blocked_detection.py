from __future__ import annotations

import sys
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import orchestrator  # noqa: E402


class PlatformWrapperPrepareBlockedDetectionTests(unittest.TestCase):
    def test_wrapper_prepare_status_blocked_is_environment_blocker(self) -> None:
        validation_results = [
            {
                "command": "python tools/platform_wrapper_prepare_smoke.py",
                "effective_command": "\"C:\\Python\\python.exe\" tools/platform_wrapper_prepare_smoke.py",
                "exit_code": 1,
                "stdout_tail": "STATUS: BLOCKED\nPowerShell executable not found on PATH.",
                "stderr_tail": "",
            }
        ]

        reason = orchestrator.platform_wrapper_prepare_environment_blocker_reason(validation_results)
        self.assertIsNotNone(reason)
        self.assertIn("Platform wrapper prepare validation blocked by environment", reason)
        self.assertIn("PowerShell executable not found", reason)

    def test_wrapper_prepare_detection_normalizes_windows_path(self) -> None:
        validation_results = [
            {
                "command": "python tools\\platform_wrapper_prepare_smoke.py",
                "effective_command": "\"C:\\Python\\python.exe\" tools\\platform_wrapper_prepare_smoke.py",
                "exit_code": 1,
                "stdout_tail": "STATUS: BLOCKED\nWrapper prepare smoke failed for steam-tauri (exit=1).",
                "stderr_tail": "",
            }
        ]

        reason = orchestrator.platform_wrapper_prepare_environment_blocker_reason(validation_results)
        self.assertIsNotNone(reason)
        self.assertIn("Platform wrapper prepare validation blocked by environment", reason)
        self.assertIn("Wrapper prepare smoke failed for steam-tauri", reason)


if __name__ == "__main__":
    unittest.main()
