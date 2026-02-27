from __future__ import annotations

import io
import subprocess
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import platform_wrapper_prepare_smoke as prep_smoke  # noqa: E402


class PlatformWrapperPrepareSmokeTests(unittest.TestCase):
    def test_main_runs_manifest_then_wrappers_in_deterministic_order(self) -> None:
        command_stage_names: list[str] = []

        def fake_run(
            command: list[str],
            *,
            cwd: Path | str,
            text: bool,
            capture_output: bool,
            check: bool,
        ) -> subprocess.CompletedProcess[str]:
            self.assertTrue(text)
            self.assertTrue(capture_output)
            self.assertFalse(check)
            if Path(command[0]).name.lower().startswith("python"):
                stage_name = Path(command[1]).name
            else:
                stage_name = Path(command[5]).name
            command_stage_names.append(stage_name)

            if stage_name == "generate_first_slice_frontend_manifest_snapshot.py":
                self.assertEqual(Path(cwd), prep_smoke.ROOT)
                return subprocess.CompletedProcess(command, 0, stdout="STATUS: COMPLETED\n", stderr="")
            if stage_name == "wrapper_steam_tauri.ps1":
                return subprocess.CompletedProcess(command, 0, stdout="steam ok\n", stderr="")
            if stage_name == "wrapper_android_capacitor.ps1":
                return subprocess.CompletedProcess(command, 0, stdout="android ok\n", stderr="")
            self.fail(f"Unexpected command: {command}")

        buffer = io.StringIO()
        with (
            mock.patch.object(prep_smoke, "_find_powershell", return_value="powershell.exe"),
            mock.patch.object(prep_smoke.subprocess, "run", side_effect=fake_run),
            redirect_stdout(buffer),
        ):
            exit_code = prep_smoke.main()

        self.assertEqual(exit_code, 0)
        self.assertEqual(
            command_stage_names,
            [
                "generate_first_slice_frontend_manifest_snapshot.py",
                "wrapper_steam_tauri.ps1",
                "wrapper_android_capacitor.ps1",
            ],
        )

        output_lines = [line.strip() for line in buffer.getvalue().splitlines() if line.strip()]
        stage_lines = [line for line in output_lines if line.startswith("PLATFORM_WRAPPER_PREP")]
        self.assertEqual(
            stage_lines,
            [
                "PLATFORM_WRAPPER_PREP stage=frontend_manifest_snapshot status=PASS exit_code=0",
                "PLATFORM_WRAPPER_PREP stage=steam_tauri_prepare status=PASS exit_code=0",
                "PLATFORM_WRAPPER_PREP stage=android_capacitor_prepare status=PASS exit_code=0",
            ],
        )
        self.assertIn("STATUS: COMPLETED", buffer.getvalue())

    def test_main_fails_fast_and_marks_remaining_stage_skip(self) -> None:
        command_stage_names: list[str] = []

        def fake_run(
            command: list[str],
            *,
            cwd: Path | str,
            text: bool,
            capture_output: bool,
            check: bool,
        ) -> subprocess.CompletedProcess[str]:
            self.assertTrue(text)
            self.assertTrue(capture_output)
            self.assertFalse(check)
            if Path(command[0]).name.lower().startswith("python"):
                stage_name = Path(command[1]).name
            else:
                stage_name = Path(command[5]).name
            command_stage_names.append(stage_name)

            if stage_name == "generate_first_slice_frontend_manifest_snapshot.py":
                return subprocess.CompletedProcess(command, 0, stdout="STATUS: COMPLETED\n", stderr="")
            if stage_name == "wrapper_steam_tauri.ps1":
                return subprocess.CompletedProcess(
                    command,
                    7,
                    stdout="STATUS: BLOCKED\nsteam preflight failed\n",
                    stderr="",
                )
            self.fail(f"Unexpected command: {command}")

        buffer = io.StringIO()
        with (
            mock.patch.object(prep_smoke, "_find_powershell", return_value="powershell.exe"),
            mock.patch.object(prep_smoke.subprocess, "run", side_effect=fake_run),
            redirect_stdout(buffer),
        ):
            exit_code = prep_smoke.main()

        self.assertEqual(exit_code, 7)
        self.assertEqual(
            command_stage_names,
            [
                "generate_first_slice_frontend_manifest_snapshot.py",
                "wrapper_steam_tauri.ps1",
            ],
        )

        output_lines = [line.strip() for line in buffer.getvalue().splitlines() if line.strip()]
        stage_lines = [line for line in output_lines if line.startswith("PLATFORM_WRAPPER_PREP")]
        self.assertEqual(
            stage_lines,
            [
                "PLATFORM_WRAPPER_PREP stage=frontend_manifest_snapshot status=PASS exit_code=0",
                "PLATFORM_WRAPPER_PREP stage=steam_tauri_prepare status=FAIL exit_code=7",
                "PLATFORM_WRAPPER_PREP stage=android_capacitor_prepare status=SKIP exit_code=n/a",
            ],
        )
        self.assertIn("STATUS: BLOCKED", buffer.getvalue())
        self.assertIn("Wrapper prepare smoke failed for steam-tauri", buffer.getvalue())


if __name__ == "__main__":
    unittest.main()
