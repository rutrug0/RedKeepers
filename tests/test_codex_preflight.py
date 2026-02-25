from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock
import sys


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import codex_worker  # noqa: E402
import health_checks  # noqa: E402


class CodexPreflightTests(unittest.TestCase):
    def test_windows_resolution_uses_cmd_shim_for_bare_codex(self) -> None:
        calls: list[str] = []

        def fake_which(name: str) -> str | None:
            calls.append(name)
            if name == "codex.cmd":
                return r"C:\npm\codex.cmd"
            return None

        with (
            mock.patch.object(codex_worker.os, "name", "nt"),
            mock.patch.object(codex_worker.shutil, "which", side_effect=fake_which),
        ):
            resolved = codex_worker._resolve_executable(["codex", "exec"])

        self.assertEqual(resolved, [r"C:\npm\codex.cmd", "exec"])
        self.assertEqual(calls, ["codex", "codex.cmd"])

    def test_preflight_error_mentions_override_and_windows_shim(self) -> None:
        missing_command = "__rk_missing_codex_for_test__ exec"
        with (
            mock.patch.object(codex_worker.os, "name", "nt"),
            mock.patch.object(codex_worker.shutil, "which", return_value=None),
            mock.patch.dict(
                codex_worker.os.environ,
                {"REDKEEPERS_CODEX_COMMAND": missing_command},
                clear=False,
            ),
        ):
            error = codex_worker.codex_command_preflight_error()

        self.assertIsNotNone(error)
        assert error is not None
        self.assertIn("REDKEEPERS_CODEX_COMMAND", error)
        self.assertIn("codex.cmd exec", error)
        self.assertIn("could not resolve executable", error)

    def test_mock_worker_mode_skips_codex_preflight(self) -> None:
        with mock.patch.dict(
            codex_worker.os.environ,
            {"REDKEEPERS_WORKER_MODE": "mock"},
            clear=False,
        ):
            self.assertIsNone(codex_worker.codex_command_preflight_error())


class HealthCheckPreflightIntegrationTests(unittest.TestCase):
    def test_validate_environment_includes_codex_preflight_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_required_files(root)

            with mock.patch.object(
                health_checks,
                "codex_command_preflight_error",
                return_value="Codex command preflight failed: test",
            ):
                errors = health_checks.validate_environment(root)

        self.assertIn("Codex command preflight failed: test", errors)

    @staticmethod
    def _write_required_files(root: Path) -> None:
        required_json_lists = [
            root / "coordination" / "backlog" / "work-items.json",
            root / "coordination" / "backlog" / "completed-items.json",
            root / "coordination" / "backlog" / "blocked-items.json",
        ]
        required_json_objects = [
            root / "coordination" / "state" / "daemon-state.json",
            root / "coordination" / "state" / "agents.json",
        ]
        required_policies = [
            root / "coordination" / "policies" / "routing-rules.yaml",
            root / "coordination" / "policies" / "retry-policy.yaml",
            root / "coordination" / "policies" / "model-policy.yaml",
            root / "coordination" / "policies" / "commit-guard-rules.yaml",
        ]

        for path in required_json_lists:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("[]\n", encoding="utf-8")
        for path in required_json_objects:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("{}\n", encoding="utf-8")
        for path in required_policies:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({}) + "\n", encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
