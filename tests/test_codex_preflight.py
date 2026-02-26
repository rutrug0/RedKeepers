from __future__ import annotations

import json
import subprocess
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

    def test_with_model_arg_appends_model_when_missing(self) -> None:
        command = codex_worker._with_model_arg(["codex", "exec"], "GPT-5.3-Codex-Spark")
        self.assertEqual(command, ["codex", "exec", "--model", "GPT-5.3-Codex-Spark"])

    def test_with_model_arg_respects_existing_model_flag(self) -> None:
        command = codex_worker._with_model_arg(["codex", "exec", "--model", "gpt-5-mini"], "codex-5.3")
        self.assertEqual(command, ["codex", "exec", "--model", "gpt-5-mini"])

    def test_model_access_error_detection_handles_chatgpt_account_unsupported_message(self) -> None:
        stderr = "ERROR: {\"detail\":\"The 'codex-5.3' model is not supported when using Codex with a ChatGPT account.\"}"
        self.assertTrue(codex_worker._looks_like_model_access_error("", stderr))

    def test_without_model_arg_strips_model_flags(self) -> None:
        command = codex_worker._without_model_arg(["codex", "exec", "--model", "gpt-5-mini", "--json"])
        self.assertEqual(command, ["codex", "exec", "--json"])

    def test_normalize_model_name_lowercases_display_style(self) -> None:
        self.assertEqual(codex_worker._normalize_model_name("GPT-5.3-Codex-Spark"), "gpt-5.3-codex-spark")
        self.assertEqual(codex_worker._normalize_model_name("gpt-5-mini"), "gpt-5-mini")
        self.assertIsNone(codex_worker._normalize_model_name("auto"))
        self.assertIsNone(codex_worker._normalize_model_name("default"))


class HealthCheckPreflightIntegrationTests(unittest.TestCase):
    def test_validate_environment_flags_unsupported_model_requested_before_execution(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_required_files(root)
            (root / "coordination" / "policies" / "model-policy.yaml").write_text(
                json.dumps(
                    {
                        "agent_models": {
                            "nika-thorn": {
                                "model": "gpt-unsupported",
                                "reasoning": "low",
                            }
                        }
                    }
                ),
                encoding="utf-8",
            )

            def fake_model_preflight(model: str) -> str | None:
                if model == "gpt-unsupported":
                    return "model is unsupported for this account"
                return None

            with (
                mock.patch.object(
                    health_checks,
                    "codex_model_access_preflight_error",
                    side_effect=fake_model_preflight,
                ),
                mock.patch.object(
                    health_checks,
                    "codex_command_preflight_error",
                    return_value=None,
                ),
            ):
                errors = health_checks.validate_environment(root)

        self.assertEqual(
            errors,
            [
                "model 'gpt-unsupported' is not accessible: model is unsupported for this account. Remediation: "
                "update model-policy.yaml to an accessible model.",
            ]
        )

    def test_validate_environment_flags_unsupported_escalation_model(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_required_files(root)
            (root / "coordination" / "policies" / "model-policy.yaml").write_text(
                json.dumps(
                    {
                        "agent_models": {
                            "nika-thorn": {
                                "model": "gpt-5.3-codex-spark",
                                "reasoning": "low",
                            }
                        },
                        "escalation_upgrade": {
                            "critical_or_repeated_failure": {
                                "model": "gpt-unsupported-escalation",
                                "reasoning": "high",
                            }
                        },
                    }
                ),
                encoding="utf-8",
            )

            def fake_model_preflight(model: str) -> str | None:
                if model == "gpt-unsupported-escalation":
                    return "escalation model is unsupported for this account"
                return None

            with (
                mock.patch.object(
                    health_checks,
                    "codex_model_access_preflight_error",
                    side_effect=fake_model_preflight,
                ),
                mock.patch.object(
                    health_checks,
                    "codex_command_preflight_error",
                    return_value=None,
                ),
            ):
                errors = health_checks.validate_environment(root)

        self.assertEqual(
            errors,
            [
                "model 'gpt-unsupported-escalation' is not accessible: escalation model is unsupported for this account. "
                "Remediation: update model-policy.yaml to an accessible model.",
            ]
        )

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

    def test_validate_environment_reports_invalid_runtime_python_command(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_required_files(root)
            (root / "coordination" / "policies" / "runtime-policy.yaml").write_text(
                json.dumps({"python_command": "__missing_python_for_test__"}) + "\n",
                encoding="utf-8",
            )

            with mock.patch.object(
                health_checks,
                "codex_command_preflight_error",
                return_value=None,
            ):
                errors = health_checks.validate_environment(root)

        self.assertTrue(any("runtime-policy.yaml python_command is configured but not resolvable" in err for err in errors))

    def test_validate_environment_ignores_non_definitive_model_precheck_timeouts(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_required_files(root)
            model_policy_path = root / "coordination" / "policies" / "model-policy.yaml"
            model_policy_path.write_text(
                json.dumps(
                    {
                        "agent_models": {
                            "mara-voss": {"model": "gpt-5.3-codex-spark"}
                        }
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            with (
                mock.patch.object(health_checks, "codex_command_preflight_error", return_value=None),
                mock.patch.object(health_checks, "codex_model_access_preflight_error", return_value="Worker timed out after 20s"),
            ):
                errors = health_checks.validate_environment(root)

        self.assertFalse(any("model 'gpt-5.3-codex-spark' is not accessible" in err for err in errors))

    def test_validate_environment_reports_playwright_missing_when_frontend_visual_qa_enabled(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_required_files(root)
            (root / "coordination" / "policies" / "commit-guard-rules.yaml").write_text(
                json.dumps({"frontend_visual_qa": {"enabled": True}}) + "\n",
                encoding="utf-8",
            )

            with (
                mock.patch.object(health_checks, "_playwright_import_error", return_value="No module named 'playwright'"),
                mock.patch.object(health_checks, "codex_command_preflight_error", return_value=None),
            ):
                errors = health_checks.validate_environment(root)

        joined = "\n".join(errors)
        self.assertIn("frontend visual QA is enabled but Playwright is not importable", joined)
        self.assertIn("-m pip install playwright pillow", joined)
        self.assertIn("-m playwright install chromium", joined)

    def test_playwright_preflight_probe_uses_validation_python_launcher_override(self) -> None:
        with (
            mock.patch.dict(health_checks.os.environ, {"REDKEEPERS_PYTHON_CMD": "py -3.11"}, clear=False),
            mock.patch.object(
                health_checks.subprocess,
                "run",
                return_value=subprocess.CompletedProcess(
                    args="",
                    returncode=1,
                    stdout="",
                    stderr="ModuleNotFoundError: No module named 'playwright'\n",
                ),
            ) as run_mock,
        ):
            error = health_checks._playwright_import_error()

        self.assertIsNotNone(error)
        assert error is not None
        self.assertIn("No module named 'playwright'", error)
        self.assertTrue(run_mock.call_args.args[0].startswith("py -3.11 -c "))
        self.assertTrue(run_mock.call_args.kwargs["shell"])

    def test_validate_environment_playwright_remediation_uses_python_cmd_override(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_required_files(root)
            (root / "coordination" / "policies" / "commit-guard-rules.yaml").write_text(
                json.dumps({"frontend_visual_qa": {"enabled": True}}) + "\n",
                encoding="utf-8",
            )

            with (
                mock.patch.dict(health_checks.os.environ, {"REDKEEPERS_PYTHON_CMD": "py -3.11"}, clear=False),
                mock.patch.object(health_checks, "_playwright_import_error", return_value="No module named 'playwright'"),
                mock.patch.object(health_checks, "codex_command_preflight_error", return_value=None),
            ):
                errors = health_checks.validate_environment(root)

        joined = "\n".join(errors)
        self.assertIn(
            "active Python interpreter used by orchestrator validation commands (py -3.11)",
            joined,
        )
        self.assertIn("py -3.11 -m pip install playwright pillow", joined)
        self.assertIn("py -3.11 -m playwright install chromium", joined)

    def test_validate_environment_skips_playwright_error_when_frontend_visual_qa_disabled_by_env(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_required_files(root)
            (root / "coordination" / "policies" / "commit-guard-rules.yaml").write_text(
                json.dumps({"frontend_visual_qa": {"enabled": True}}) + "\n",
                encoding="utf-8",
            )

            with (
                mock.patch.dict(health_checks.os.environ, {"REDKEEPERS_ENABLE_FRONTEND_VISUAL_QA": "0"}, clear=False),
                mock.patch.object(health_checks, "_playwright_import_error", return_value="No module named 'playwright'"),
                mock.patch.object(health_checks, "codex_command_preflight_error", return_value=None),
            ):
                errors = health_checks.validate_environment(root)

        self.assertFalse(any("Playwright is not importable" in err for err in errors))

    def test_validate_environment_has_no_frontend_visual_error_when_playwright_is_importable(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_required_files(root)
            (root / "coordination" / "policies" / "commit-guard-rules.yaml").write_text(
                json.dumps({"frontend_visual_qa": {"enabled": True}}) + "\n",
                encoding="utf-8",
            )

            with (
                mock.patch.object(health_checks, "_playwright_import_error", return_value=None),
                mock.patch.object(health_checks, "codex_command_preflight_error", return_value=None),
            ):
                errors = health_checks.validate_environment(root)

        self.assertFalse(any("Playwright is not importable" in err for err in errors))

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
            root / "coordination" / "policies" / "runtime-policy.yaml",
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
