from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import codex_worker  # noqa: E402
import python_runtime  # noqa: E402


class PythonRuntimeTests(unittest.TestCase):
    def test_preferred_python_command_uses_runtime_policy_when_env_unset(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            policy_path = root / "coordination" / "policies" / "runtime-policy.yaml"
            policy_path.parent.mkdir(parents=True, exist_ok=True)
            policy_path.write_text(
                json.dumps({"python_command": r"C:\Python310\python.exe"}) + "\n",
                encoding="utf-8",
            )

            with mock.patch.dict(os.environ, {"REDKEEPERS_PYTHON_CMD": ""}, clear=False):
                command = python_runtime.preferred_python_command(root=root)

        self.assertEqual(command, r"C:\Python310\python.exe")

    def test_run_agent_passes_python_runtime_environment_to_worker_process(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            policy_path = root / "coordination" / "policies" / "runtime-policy.yaml"
            policy_path.parent.mkdir(parents=True, exist_ok=True)
            policy_path.write_text(
                json.dumps({"python_command": sys.executable}) + "\n",
                encoding="utf-8",
            )

            completed = subprocess.CompletedProcess(args=["codex", "exec"], returncode=0, stdout="ok\n", stderr="")
            with (
                mock.patch.object(
                    codex_worker,
                    "_parse_and_resolve_codex_command",
                    return_value=(["codex", "exec"], None),
                ),
                mock.patch.object(
                    codex_worker,
                    "_execute_codex",
                    return_value=(completed, None),
                ) as execute_mock,
            ):
                result = codex_worker.run_agent(
                    project_root=root,
                    agent_id="tomas-grell",
                    prompt="test prompt",
                    model="default",
                )

        self.assertEqual(result.status, "completed")
        worker_env = execute_mock.call_args.kwargs.get("env")
        self.assertIsInstance(worker_env, dict)
        assert isinstance(worker_env, dict)
        self.assertIn("REDKEEPERS_PYTHON_CMD", worker_env)
        self.assertTrue(worker_env["REDKEEPERS_PYTHON_CMD"])


if __name__ == "__main__":
    unittest.main()
