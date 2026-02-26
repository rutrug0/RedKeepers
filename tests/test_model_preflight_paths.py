from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import health_checks  # noqa: E402
import orchestrator  # noqa: E402
from codex_worker import WorkerResult  # noqa: E402


class ModelPreflightValidationTests(unittest.TestCase):
    def test_validate_environment_fails_fast_with_exact_unsupported_model_reason(self) -> None:
        requested_model = "gpt-unsupported-primary"
        fallback_model = "gpt-unsupported-fallback"
        requested_error = "model is unsupported for this account"
        fallback_error = "fallback model is unsupported for this account"

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_required_files(root)
            (root / "coordination" / "policies" / "model-policy.yaml").write_text(
                json.dumps(
                    {
                        "agent_models": {
                            "tomas-grell": {
                                "model": requested_model,
                                "fallback_model": fallback_model,
                                "reasoning": "medium",
                            }
                        }
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            def _fake_preflight(model: str) -> str | None:
                if model == requested_model:
                    return requested_error
                if model == fallback_model:
                    return fallback_error
                return None

            with (
                mock.patch.object(
                    health_checks,
                    "codex_model_access_preflight_error",
                    side_effect=_fake_preflight,
                ) as preflight_mock,
                mock.patch.object(
                    health_checks,
                    "codex_command_preflight_error",
                    return_value=None,
                ),
            ):
                errors = health_checks.validate_environment(root)

        expected = (
            f"model '{requested_model}' is not accessible: {requested_error}. "
            "Remediation: update model-policy.yaml to an accessible model."
        )
        self.assertEqual(errors, [expected])
        self.assertEqual(preflight_mock.call_count, 2)
        self.assertEqual(preflight_mock.call_args_list[0].args[0], requested_model)
        self.assertEqual(preflight_mock.call_args_list[1].args[0], fallback_model)

    def test_validate_environment_skips_error_when_fallback_is_accessible(self) -> None:
        requested_model = "gpt-unsupported-primary"
        fallback_model = "gpt-5.3-codex-spark"

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_required_files(root)
            (root / "coordination" / "policies" / "model-policy.yaml").write_text(
                json.dumps(
                    {
                        "agent_models": {
                            "tomas-grell": {
                                "model": requested_model,
                                "fallback_model": fallback_model,
                                "reasoning": "medium",
                            }
                        }
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            def _fake_preflight(model: str) -> str | None:
                if model == requested_model:
                    return "model is unsupported for this account"
                if model == fallback_model:
                    return None
                return None

            with (
                mock.patch.object(
                    health_checks,
                    "codex_model_access_preflight_error",
                    side_effect=_fake_preflight,
                ) as preflight_mock,
                mock.patch.object(
                    health_checks,
                    "codex_command_preflight_error",
                    return_value=None,
                ),
            ):
                errors = health_checks.validate_environment(root)

        self.assertEqual(errors, [])
        self.assertEqual(preflight_mock.call_count, 2)
        self.assertEqual(preflight_mock.call_args_list[0].args[0], requested_model)
        self.assertEqual(preflight_mock.call_args_list[1].args[0], fallback_model)

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
            path.write_text("{}\n", encoding="utf-8")


class ModelPreflightExecutionTests(unittest.TestCase):
    def test_process_one_blocks_when_model_preflight_fails(self) -> None:
        requested_model = "gpt-primary-bad"
        fallback_model = "gpt-fallback-bad"

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            item = self._base_item(item_id="RK-PREF-BLOCK", retry_count=0)
            self._write_queue_files(root, [item], [], [])

            run_history: list[dict[str, object]] = []
            daemon_state_path = root / "coordination" / "runtime" / "daemon-state.json"
            daemon_state_path.parent.mkdir(parents=True, exist_ok=True)
            daemon_state_path.write_text("{}\n", encoding="utf-8")
            policies = self._base_policies(requested_model=requested_model, fallback_model=fallback_model)
            agents = {
                "tomas-grell": {
                    "display_name": "Tomas Grell",
                    "role": "qa",
                    "model": "gpt-5.3-codex-spark",
                    "reasoning": "medium",
                }
            }
            model_stats = {}
            model_stats_tracker = mock.Mock()
            run_agent_mock = mock.Mock()
            preflight_calls: list[str] = []

            def _fake_preflight(model: str) -> str | None:
                preflight_calls.append(model)
                if model == requested_model:
                    return "Model is unsupported for this policy path"
                if model == fallback_model:
                    return "Fallback model is unsupported for this policy path"
                return None

            with (
                mock.patch.object(orchestrator, "ROOT", root),
                mock.patch.object(orchestrator, "DAEMON_STATE_PATH", daemon_state_path),
                mock.patch.object(orchestrator, "validate_environment", return_value=[]),
                mock.patch.object(
                    orchestrator,
                    "repair_backlog_archive_duplicates",
                    return_value={
                        "completed_removed": 0,
                        "blocked_removed": 0,
                        "completed_duplicate_ids": [],
                        "blocked_duplicate_ids": [],
                    },
                ),
                mock.patch.object(orchestrator, "emit_event", return_value=None),
                mock.patch.object(
                    orchestrator,
                    "set_daemon_state",
                    side_effect=lambda **patch: patch,
                ),
                mock.patch.object(
                    orchestrator,
                    "append_jsonl",
                    side_effect=lambda _path, record: run_history.append(record),
                ),
                mock.patch.object(
                    orchestrator,
                    "revisit_recoverable_blocked_items",
                    return_value=[],
                ),
                mock.patch.object(
                    orchestrator,
                    "ensure_backlog_refill_item",
                    return_value=None,
                ),
                mock.patch.object(
                    orchestrator,
                    "run_queued_model_policy_drift_audit",
                    return_value={"flagged": [], "remediated_ids": [], "changed": False, "policy_fingerprint": "fp"},
                ),
                mock.patch.object(orchestrator, "load_agent_catalog", return_value=agents),
                mock.patch.object(orchestrator, "load_policies", return_value=policies),
                mock.patch.object(
                    orchestrator,
                    "codex_model_access_preflight_error",
                    side_effect=_fake_preflight,
                ),
                mock.patch.object(orchestrator, "run_agent", run_agent_mock),
            ):
                rc = orchestrator.process_one(
                    dry_run=False,
                    verbose=False,
                    model_stats_tracker=model_stats_tracker,
                    model_stats=model_stats,
                )

        self.assertEqual(rc, 0)
        self.assertEqual(run_history[-1]["result"], "blocked")
        self.assertEqual(run_history[-1]["model_requested"], requested_model)
        self.assertEqual(run_history[-1]["model_used"], requested_model)
        self.assertFalse(run_history[-1]["fallback_used"])
        self.assertIn("Model is unsupported for this policy path", str(run_history[-1]["summary"]))
        run_agent_mock.assert_not_called()
        self.assertEqual(preflight_calls, [requested_model, fallback_model])

        model_stats_tracker.record_run.assert_called_once()
        call_kwargs = model_stats_tracker.record_run.call_args.kwargs
        self.assertEqual(call_kwargs["outcome"], "blocked")
        self.assertEqual(call_kwargs["requested_model"], requested_model)
        self.assertEqual(call_kwargs["used_model"], requested_model)
        self.assertFalse(call_kwargs["fallback_used"])

    def test_process_one_uses_fallback_model_when_primary_preflight_fails(self) -> None:
        requested_model = "gpt-primary-bad"
        fallback_model = "gpt-5.3-codex-spark"

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            item = self._base_item(item_id="RK-PREF-FALLBACK", retry_count=0)
            self._write_queue_files(root, [item], [], [])

            run_history: list[dict[str, object]] = []
            daemon_state_path = root / "coordination" / "runtime" / "daemon-state.json"
            daemon_state_path.parent.mkdir(parents=True, exist_ok=True)
            daemon_state_path.write_text("{}\n", encoding="utf-8")
            run_agent_result = WorkerResult(
                status="completed",
                summary="agent completed on fallback",
                stdout="ok",
                stderr="",
                exit_code=0,
                requested_model=fallback_model,
                used_model=fallback_model,
                tokens_in_est=140,
                tokens_out_est=55,
            )
            policies = self._base_policies(requested_model=requested_model, fallback_model=fallback_model)
            agents = {
                "tomas-grell": {
                    "display_name": "Tomas Grell",
                    "role": "qa",
                    "model": "gpt-5.3-codex-spark",
                    "reasoning": "medium",
                }
            }
            model_stats = {}
            model_stats_tracker = mock.Mock()
            preflight_calls: list[str] = []

            def _fake_preflight(model: str) -> str | None:
                preflight_calls.append(model)
                if model == requested_model:
                    return "Model is unsupported for this policy path"
                if model == fallback_model:
                    return None
                return None

            with (
                mock.patch.object(orchestrator, "ROOT", root),
                mock.patch.object(orchestrator, "DAEMON_STATE_PATH", daemon_state_path),
                mock.patch.object(orchestrator, "validate_environment", return_value=[]),
                mock.patch.object(
                    orchestrator,
                    "repair_backlog_archive_duplicates",
                    return_value={
                        "completed_removed": 0,
                        "blocked_removed": 0,
                        "completed_duplicate_ids": [],
                        "blocked_duplicate_ids": [],
                    },
                ),
                mock.patch.object(orchestrator, "emit_event", return_value=None),
                mock.patch.object(
                    orchestrator,
                    "set_daemon_state",
                    side_effect=lambda **patch: patch,
                ),
                mock.patch.object(
                    orchestrator,
                    "append_jsonl",
                    side_effect=lambda _path, record: run_history.append(record),
                ),
                mock.patch.object(
                    orchestrator,
                    "revisit_recoverable_blocked_items",
                    return_value=[],
                ),
                mock.patch.object(
                    orchestrator,
                    "ensure_backlog_refill_item",
                    return_value=None,
                ),
                mock.patch.object(
                    orchestrator,
                    "run_queued_model_policy_drift_audit",
                    return_value={"flagged": [], "remediated_ids": [], "changed": False, "policy_fingerprint": "fp"},
                ),
                mock.patch.object(orchestrator, "load_agent_catalog", return_value=agents),
                mock.patch.object(orchestrator, "load_policies", return_value=policies),
                mock.patch.object(
                    orchestrator,
                    "codex_model_access_preflight_error",
                    side_effect=_fake_preflight,
                ),
                mock.patch.object(orchestrator, "build_prompt", return_value="prompt"),
                mock.patch.object(
                    orchestrator,
                    "run_agent",
                    return_value=run_agent_result,
                ) as run_agent_mock,
                mock.patch.object(
                    orchestrator,
                    "run_validation_for_item",
                    return_value=(True, []),
                ),
            ):
                rc = orchestrator.process_one(
                    dry_run=False,
                    verbose=False,
                    model_stats_tracker=model_stats_tracker,
                    model_stats=model_stats,
                )

        self.assertEqual(rc, 0)
        self.assertEqual(preflight_calls, [requested_model, fallback_model])
        self.assertEqual(run_agent_mock.call_args.kwargs["model"], fallback_model)
        self.assertEqual(run_history[-1]["result"], "completed")
        self.assertEqual(run_history[-1]["model_requested"], requested_model)
        self.assertEqual(run_history[-1]["model_used"], fallback_model)
        self.assertTrue(run_history[-1]["fallback_used"])

        model_stats_tracker.record_run.assert_called_once()
        call_kwargs = model_stats_tracker.record_run.call_args.kwargs
        self.assertEqual(call_kwargs["outcome"], "completed")
        self.assertEqual(call_kwargs["requested_model"], requested_model)
        self.assertEqual(call_kwargs["used_model"], fallback_model)
        self.assertTrue(call_kwargs["fallback_used"])

    def test_process_one_runs_requested_model_when_preflight_passes(self) -> None:
        requested_model = "default"

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            item = self._base_item(item_id="RK-PREF-RUN", retry_count=0)
            self._write_queue_files(root, [item], [], [])

            run_history: list[dict[str, object]] = []
            daemon_state_path = root / "coordination" / "runtime" / "daemon-state.json"
            daemon_state_path.parent.mkdir(parents=True, exist_ok=True)
            daemon_state_path.write_text("{}\n", encoding="utf-8")
            run_agent_result = WorkerResult(
                status="completed",
                summary="agent completed",
                stdout="",
                stderr="",
                exit_code=0,
                requested_model=requested_model,
                used_model=requested_model,
                tokens_in_est=120,
                tokens_out_est=45,
            )
            policies = self._base_policies(requested_model=requested_model)
            agents = {
                "tomas-grell": {
                    "display_name": "Tomas Grell",
                    "role": "qa",
                    "model": "default",
                    "reasoning": "medium",
                }
            }

            with (
                mock.patch.object(orchestrator, "ROOT", root),
                mock.patch.object(orchestrator, "DAEMON_STATE_PATH", daemon_state_path),
                mock.patch.object(orchestrator, "validate_environment", return_value=[]),
                mock.patch.object(
                    orchestrator,
                    "repair_backlog_archive_duplicates",
                    return_value={
                        "completed_removed": 0,
                        "blocked_removed": 0,
                        "completed_duplicate_ids": [],
                        "blocked_duplicate_ids": [],
                    },
                ),
                mock.patch.object(orchestrator, "emit_event", return_value=None),
                mock.patch.object(
                    orchestrator,
                    "set_daemon_state",
                    side_effect=lambda **patch: patch,
                ),
                mock.patch.object(
                    orchestrator,
                    "append_jsonl",
                    side_effect=lambda _path, record: run_history.append(record),
                ),
                mock.patch.object(
                    orchestrator,
                    "revisit_recoverable_blocked_items",
                    return_value=[],
                ),
                mock.patch.object(
                    orchestrator,
                    "ensure_backlog_refill_item",
                    return_value=None,
                ),
                mock.patch.object(
                    orchestrator,
                    "run_queued_model_policy_drift_audit",
                    return_value={"flagged": [], "remediated_ids": [], "changed": False, "policy_fingerprint": "fp"},
                ),
                mock.patch.object(orchestrator, "load_agent_catalog", return_value=agents),
                mock.patch.object(orchestrator, "load_policies", return_value=policies),
                mock.patch.object(orchestrator, "codex_model_access_preflight_error", return_value=None),
                mock.patch.object(orchestrator, "build_prompt", return_value="prompt"),
                mock.patch.object(
                    orchestrator,
                    "run_agent",
                    return_value=run_agent_result,
                ) as run_agent_mock,
                mock.patch.object(
                    orchestrator,
                    "run_validation_for_item",
                    return_value=(True, []),
                ),
            ):
                rc = orchestrator.process_one(dry_run=False, verbose=False)

        self.assertEqual(rc, 0)
        self.assertEqual(run_history[-1]["result"], "completed")
        self.assertEqual(run_history[-1]["model_requested"], requested_model)
        self.assertEqual(run_history[-1]["model_used"], requested_model)
        self.assertFalse(run_history[-1]["fallback_used"])
        self.assertEqual(run_agent_mock.call_args.kwargs["model"], requested_model)
        self.assertNotIn("fallback_model", run_agent_mock.call_args.kwargs)
        self.assertEqual(run_agent_mock.call_count, 1)

    @staticmethod
    def _base_policies(*, requested_model: str, fallback_model: str | None = None) -> dict[str, object]:
        agent_model_entry: dict[str, object] = {
            "model": requested_model,
            "reasoning": "medium",
        }
        if fallback_model:
            agent_model_entry["fallback_model"] = fallback_model
        model_policy: dict[str, object] = {
            "agent_models": {
                "tomas-grell": agent_model_entry
            }
        }
        return {
            "routing": {
                "owner_role_map": {"qa": "tomas-grell"},
                "fallback_agent": "mara-voss",
            },
            "retry": {
                "max_retries_per_item_per_agent": 2,
                "worker_timeout_seconds": 5,
            },
            "model": model_policy,
            "commit": {
                "default_validation_commands": [],
                "commit_enabled": False,
            },
        }

    @staticmethod
    def _base_item(*, item_id: str, retry_count: int) -> dict[str, object]:
        ts = "2026-02-25T19:00:00+00:00"
        return {
            "id": item_id,
            "title": "Codex model-policy preflight regression item",
            "description": "Test model preflight selection behavior.",
            "milestone": "M1",
            "type": "feature",
            "priority": "normal",
            "owner_role": "qa",
            "preferred_agent": None,
            "dependencies": [],
            "inputs": [],
            "acceptance_criteria": ["model policy preflight validation"],
            "validation_commands": [],
            "status": "queued",
            "retry_count": retry_count,
            "created_at": ts,
            "updated_at": ts,
            "estimated_effort": "S",
            "token_budget": 1000,
            "result_summary": None,
            "blocker_reason": None,
            "escalation_target": None,
        }

    @staticmethod
    def _write_queue_files(
        root: Path,
        active: list[dict[str, object]],
        completed: list[dict[str, object]],
        blocked: list[dict[str, object]],
    ) -> None:
        backlog = root / "coordination" / "backlog"
        backlog.mkdir(parents=True, exist_ok=True)
        (backlog / "work-items.json").write_text(json.dumps(active) + "\n", encoding="utf-8")
        (backlog / "completed-items.json").write_text(json.dumps(completed) + "\n", encoding="utf-8")
        (backlog / "blocked-items.json").write_text(json.dumps(blocked) + "\n", encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
