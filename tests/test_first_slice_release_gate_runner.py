from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import first_slice_release_gate_runner as gate_runner  # noqa: E402


class FirstSliceReleaseGateRunnerTests(unittest.TestCase):
    def test_run_release_gate_writes_compact_pass_evidence_in_fixed_order(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            output_dir = root / "coordination" / "runtime" / "first-slice-release-gate"
            calls: list[list[str]] = []

            def fake_run(
                command: list[str],
                *,
                cwd: Path,
                text: bool,
                capture_output: bool,
                check: bool,
            ) -> subprocess.CompletedProcess[str]:
                self.assertEqual(cwd, root)
                self.assertTrue(text)
                self.assertTrue(capture_output)
                self.assertFalse(check)
                calls.append(command)
                script_name = Path(command[1]).name
                if script_name == "rk_m0_0011_first_slice_loop_smoke.py":
                    return subprocess.CompletedProcess(
                        command,
                        0,
                        stdout="RK-M0-0011_SMOKE summary status=PASS pass=23 fail=0\n",
                        stderr="",
                    )
                if script_name == "orchestrator.py":
                    self.assertEqual(command[2], "status")
                    return subprocess.CompletedProcess(
                        command,
                        0,
                        stdout="Daemon status: healthy\n",
                        stderr="",
                    )
                if script_name == "platform_wrapper_prepare_smoke.py":
                    return subprocess.CompletedProcess(
                        command,
                        0,
                        stdout="STATUS: COMPLETED\nWrapper prepare smoke passed.\n",
                        stderr="",
                    )
                self.fail(f"Unexpected command: {command}")

            with mock.patch.object(gate_runner.subprocess, "run", side_effect=fake_run):
                exit_code, _payload, evidence_json_path, evidence_md_path = gate_runner.run_release_gate(
                    root=root,
                    output_dir=output_dir,
                )

            self.assertEqual(exit_code, 0)
            self.assertEqual(
                [Path(command[1]).name for command in calls],
                [
                    "rk_m0_0011_first_slice_loop_smoke.py",
                    "orchestrator.py",
                    "platform_wrapper_prepare_smoke.py",
                ],
            )

            json_payload = json.loads(evidence_json_path.read_text(encoding="utf-8"))
            self.assertEqual(json_payload["overall_status"], "PASS")
            self.assertEqual(
                [gate["gate_id"] for gate in json_payload["gates"]],
                ["playable", "quality", "platform"],
            )
            self.assertEqual(
                [gate["status"] for gate in json_payload["gates"]],
                ["PASS", "PASS", "PASS"],
            )
            self.assertEqual(
                [entry["gate_id"] for entry in json_payload["executed_commands"]],
                ["playable", "quality", "platform"],
            )

            self.assertTrue((output_dir / "playable-gate.log").is_file())
            self.assertTrue((output_dir / "quality-gate.log").is_file())
            self.assertTrue((output_dir / "platform-gate.log").is_file())
            self.assertTrue(evidence_md_path.is_file())

    def test_run_release_gate_exits_non_zero_when_any_gate_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            output_dir = root / "coordination" / "runtime" / "first-slice-release-gate"
            calls: list[list[str]] = []

            def fake_run(
                command: list[str],
                *,
                cwd: Path,
                text: bool,
                capture_output: bool,
                check: bool,
            ) -> subprocess.CompletedProcess[str]:
                self.assertEqual(cwd, root)
                calls.append(command)
                script_name = Path(command[1]).name
                if script_name == "orchestrator.py":
                    return subprocess.CompletedProcess(command, 1, stdout="", stderr="status failed\n")
                return subprocess.CompletedProcess(command, 0, stdout="ok\n", stderr="")

            with mock.patch.object(gate_runner.subprocess, "run", side_effect=fake_run):
                exit_code, _payload, evidence_json_path, _evidence_md_path = gate_runner.run_release_gate(
                    root=root,
                    output_dir=output_dir,
                )

            self.assertEqual(exit_code, 1)
            self.assertEqual(
                [Path(command[1]).name for command in calls],
                [
                    "rk_m0_0011_first_slice_loop_smoke.py",
                    "orchestrator.py",
                    "platform_wrapper_prepare_smoke.py",
                ],
            )

            json_payload = json.loads(evidence_json_path.read_text(encoding="utf-8"))
            self.assertEqual(json_payload["overall_status"], "FAIL")
            gate_status_by_id = {gate["gate_id"]: gate["status"] for gate in json_payload["gates"]}
            self.assertEqual(gate_status_by_id["playable"], "PASS")
            self.assertEqual(gate_status_by_id["quality"], "FAIL")
            self.assertEqual(gate_status_by_id["platform"], "PASS")


if __name__ == "__main__":
    unittest.main()
