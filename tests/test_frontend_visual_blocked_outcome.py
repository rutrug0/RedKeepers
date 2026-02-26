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

import orchestrator  # noqa: E402
from codex_worker import WorkerResult  # noqa: E402
from queue_manager import QueueManager  # noqa: E402


class FrontendVisualBlockedOutcomeTests(unittest.TestCase):
    def test_frontend_visual_environment_blocker_marks_item_blocked_without_retry(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            item = self._base_item(item_id="RK-TEST-BLOCKED", retry_count=0)
            self._write_queue_files(root, [item], [], [])

            report_path = root / "coordination" / "runtime" / "frontend-visual" / "report.json"
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(
                json.dumps({"status": "blocked", "error": "browser launch/run failed: spawn EPERM"}) + "\n",
                encoding="utf-8",
            )

            validation_results = [
                {
                    "command": "python tools/frontend_visual_smoke.py --strict",
                    "effective_command": "python tools/frontend_visual_smoke.py --strict",
                    "exit_code": 1,
                    "stdout_tail": (
                        "STATUS: BLOCKED\n"
                        f"browser launch/run failed: spawn EPERM report={report_path}"
                    ),
                    "stderr_tail": "",
                }
            ]

            rc, run_history = self._run_process_one(root, validation_results=validation_results)

            self.assertEqual(rc, 0)
            queue = QueueManager(root)
            queue.load()
            self.assertEqual(len(queue.active), 0)
            self.assertEqual(len(queue.blocked), 1)
            self.assertEqual(queue.blocked[0]["id"], "RK-TEST-BLOCKED")
            self.assertEqual(queue.blocked[0]["retry_count"], 0)
            self.assertIn("browser launch/run failed: spawn EPERM", str(queue.blocked[0].get("blocker_reason")))
            self.assertEqual(run_history[-1]["result"], "blocked")
            self.assertIn("browser launch/run failed: spawn EPERM", run_history[-1]["summary"])

    def test_frontend_visual_environment_blocker_without_status_line_still_blocks(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            item = self._base_item(item_id="RK-TEST-BLOCKED-NO-STATUS", retry_count=0)
            self._write_queue_files(root, [item], [], [])

            report_path = root / "coordination" / "runtime" / "frontend-visual" / "report.json"
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(
                json.dumps({"status": "blocked", "error": "browser launch/run failed: no usable sandbox"}) + "\n",
                encoding="utf-8",
            )

            validation_results = [
                {
                    "command": "python tools/frontend_visual_smoke.py --strict",
                    "effective_command": "python tools/frontend_visual_smoke.py --strict",
                    "exit_code": 1,
                    "stdout_tail": f"Frontend visual smoke report={report_path}",
                    "stderr_tail": "",
                }
            ]

            rc, run_history = self._run_process_one(root, validation_results=validation_results)

            self.assertEqual(rc, 0)
            queue = QueueManager(root)
            queue.load()
            self.assertEqual(len(queue.active), 0)
            self.assertEqual(len(queue.blocked), 1)
            self.assertEqual(queue.blocked[0]["id"], "RK-TEST-BLOCKED-NO-STATUS")
            self.assertEqual(queue.blocked[0]["retry_count"], 0)
            self.assertIn("browser launch/run failed: no usable sandbox", str(queue.blocked[0].get("blocker_reason")))
            self.assertEqual(run_history[-1]["result"], "blocked")
            self.assertIn("browser launch/run failed: no usable sandbox", run_history[-1]["summary"])

    def test_frontend_visual_environment_blocker_with_windows_command_path_still_blocks(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            item = self._base_item(item_id="RK-TEST-BLOCKED-WINPATH", retry_count=0)
            self._write_queue_files(root, [item], [], [])

            report_path = root / "coordination" / "runtime" / "frontend-visual" / "report.json"
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(
                json.dumps({"status": "blocked", "error": "browser launch/run failed: sandbox denied"}) + "\n",
                encoding="utf-8",
            )

            validation_results = [
                {
                    "command": "python tools\\frontend_visual_smoke.py --strict",
                    "effective_command": "\"C:\\\\Python\\\\python.exe\" tools\\frontend_visual_smoke.py --strict",
                    "exit_code": 1,
                    "stdout_tail": (
                        "STATUS: BLOCKED\n"
                        f"browser launch/run failed: sandbox denied report={report_path}"
                    ),
                    "stderr_tail": "",
                }
            ]

            rc, run_history = self._run_process_one(root, validation_results=validation_results)

            self.assertEqual(rc, 0)
            queue = QueueManager(root)
            queue.load()
            self.assertEqual(len(queue.active), 0)
            self.assertEqual(len(queue.blocked), 1)
            self.assertEqual(queue.blocked[0]["id"], "RK-TEST-BLOCKED-WINPATH")
            self.assertEqual(queue.blocked[0]["retry_count"], 0)
            self.assertIn("browser launch/run failed: sandbox denied", str(queue.blocked[0].get("blocker_reason")))
            self.assertEqual(run_history[-1]["result"], "blocked")

    def test_frontend_visual_environment_blocker_does_not_create_retry_escalation(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            item = self._base_item(item_id="RK-TEST-BLOCKED-NOESC", retry_count=5)
            self._write_queue_files(root, [item], [], [])

            report_path = root / "coordination" / "runtime" / "frontend-visual" / "report.json"
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(
                json.dumps({"status": "blocked", "error": "playwright import failed: missing dependency"}) + "\n",
                encoding="utf-8",
            )

            validation_results = [
                {
                    "command": "python tools/frontend_visual_smoke.py --strict",
                    "effective_command": "python tools/frontend_visual_smoke.py --strict",
                    "exit_code": 1,
                    "stdout_tail": f"STATUS: BLOCKED\nplaywright import failed: missing dependency report={report_path}",
                    "stderr_tail": "",
                }
            ]

            rc, run_history = self._run_process_one(
                root,
                validation_results=validation_results,
                max_retries_per_item_per_agent=0,
            )

            self.assertEqual(rc, 0)
            queue = QueueManager(root)
            queue.load()
            self.assertEqual(len(queue.active), 0)
            self.assertEqual(len(queue.blocked), 1)
            self.assertEqual(queue.blocked[0]["id"], "RK-TEST-BLOCKED-NOESC")
            expected_escalation_id = "RK-TEST-BLOCKED-NOESC-ESC"
            self.assertFalse(any(str(candidate.get("id", "")) == expected_escalation_id for candidate in queue.active))
            self.assertFalse(any(str(candidate.get("id", "")) == expected_escalation_id for candidate in queue.blocked))
            self.assertFalse(any(str(candidate.get("id", "")) == expected_escalation_id for candidate in queue.completed))
            self.assertEqual(run_history[-1]["result"], "blocked")

    def test_frontend_visual_regression_keeps_failed_validation_retry_semantics(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            item = self._base_item(item_id="RK-TEST-FAILED", retry_count=0)
            self._write_queue_files(root, [item], [], [])

            report_path = root / "coordination" / "runtime" / "frontend-visual" / "report.json"
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(
                json.dumps(
                    {
                        "status": "failed",
                        "summary": {"devices_failed": 1, "devices_total": 4},
                        "error": "visual diff 2.100% > threshold 0.500%",
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            validation_results = [
                {
                    "command": "python tools/frontend_visual_smoke.py --strict",
                    "effective_command": "python tools/frontend_visual_smoke.py --strict",
                    "exit_code": 1,
                    "stdout_tail": (
                        "STATUS: BLOCKED\n"
                        f"Frontend visual smoke encountered issues report={report_path}"
                    ),
                    "stderr_tail": "",
                }
            ]

            rc, run_history = self._run_process_one(root, validation_results=validation_results)

            self.assertEqual(rc, 0)
            queue = QueueManager(root)
            queue.load()
            self.assertEqual(len(queue.blocked), 0)
            self.assertEqual(len(queue.active), 1)
            self.assertEqual(queue.active[0]["id"], "RK-TEST-FAILED")
            self.assertEqual(queue.active[0]["status"], "queued")
            self.assertEqual(queue.active[0]["retry_count"], 1)
            self.assertEqual(queue.active[0]["last_failure_reason"], "validation failed")
            self.assertEqual(run_history[-1]["result"], "failed_validation")

    def test_frontend_visual_regression_with_windows_command_path_keeps_retry_semantics(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            item = self._base_item(item_id="RK-TEST-FAILED-WINPATH", retry_count=0)
            self._write_queue_files(root, [item], [], [])

            report_path = root / "coordination" / "runtime" / "frontend-visual" / "report.json"
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(
                json.dumps(
                    {
                        "status": "failed",
                        "summary": {"devices_failed": 1, "devices_total": 4},
                        "error": "visual diff 1.900% > threshold 0.500%",
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            validation_results = [
                {
                    "command": "python tools\\frontend_visual_smoke.py --strict",
                    "effective_command": "\"C:\\\\Python\\\\python.exe\" tools\\frontend_visual_smoke.py --strict",
                    "exit_code": 1,
                    "stdout_tail": (
                        "STATUS: BLOCKED\n"
                        f"Frontend visual smoke encountered issues report={report_path}"
                    ),
                    "stderr_tail": "",
                }
            ]

            rc, run_history = self._run_process_one(root, validation_results=validation_results)

            self.assertEqual(rc, 0)
            queue = QueueManager(root)
            queue.load()
            self.assertEqual(len(queue.blocked), 0)
            self.assertEqual(len(queue.active), 1)
            self.assertEqual(queue.active[0]["id"], "RK-TEST-FAILED-WINPATH")
            self.assertEqual(queue.active[0]["status"], "queued")
            self.assertEqual(queue.active[0]["retry_count"], 1)
            self.assertEqual(queue.active[0]["last_failure_reason"], "validation failed")
            self.assertEqual(run_history[-1]["result"], "failed_validation")

    @staticmethod
    def _base_item(*, item_id: str, retry_count: int) -> dict[str, object]:
        ts = "2026-02-25T19:00:00+00:00"
        return {
            "id": item_id,
            "title": "Visual validation handling test",
            "description": "Test frontend visual STATUS: BLOCKED outcome handling.",
            "milestone": "M1",
            "type": "feature",
            "priority": "high",
            "owner_role": "frontend",
            "preferred_agent": None,
            "dependencies": [],
            "inputs": ["tools/frontend_visual_smoke.py"],
            "acceptance_criteria": ["validation outcome handled correctly"],
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

    def _run_process_one(
        self,
        root: Path,
        *,
        validation_results: list[dict[str, object]],
        max_retries_per_item_per_agent: int = 2,
    ) -> tuple[int, list[dict[str, object]]]:
        run_history: list[dict[str, object]] = []
        daemon_state_path = root / "coordination" / "runtime" / "daemon-state.json"
        daemon_state_path.parent.mkdir(parents=True, exist_ok=True)
        daemon_state_path.write_text("{}\n", encoding="utf-8")

        agents = {
            "tomas-grell": {
                "display_name": "Tomas Grell",
                "role": "qa",
                "model": "gpt-5.3-codex-spark",
                "reasoning": "medium",
            },
            "mara-voss": {
                "display_name": "Mara Voss",
                "role": "lead",
                "model": "gpt-5.3-codex-spark",
                "reasoning": "high",
            },
        }
        policies = {
            "routing": {
                "owner_role_map": {"frontend": "tomas-grell"},
                "fallback_agent": "mara-voss",
            },
            "retry": {
                "max_retries_per_item_per_agent": max_retries_per_item_per_agent,
                "worker_timeout_seconds": 5,
            },
            "model": {},
            "commit": {
                "default_validation_commands": [],
                "commit_enabled": False,
            },
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
            mock.patch.object(orchestrator, "set_daemon_state", side_effect=lambda **patch: patch),
            mock.patch.object(
                orchestrator,
                "append_jsonl",
                side_effect=lambda _path, record: run_history.append(record),
            ),
            mock.patch.object(orchestrator, "revisit_recoverable_blocked_items", return_value=[]),
            mock.patch.object(orchestrator, "ensure_backlog_refill_item", return_value=None),
            mock.patch.object(orchestrator, "load_agent_catalog", return_value=agents),
            mock.patch.object(orchestrator, "load_policies", return_value=policies),
            mock.patch.object(orchestrator, "codex_model_access_preflight_error", return_value=None),
            mock.patch.object(orchestrator, "build_prompt", return_value="prompt"),
            mock.patch.object(
                orchestrator,
                "run_agent",
                return_value=WorkerResult(
                    status="completed",
                    summary="agent completed work",
                    stdout="",
                    stderr="",
                    exit_code=0,
                ),
            ),
            mock.patch.object(orchestrator, "run_validation_for_item", return_value=(False, validation_results)),
        ):
            rc = orchestrator.process_one(dry_run=False, verbose=False)
        return rc, run_history


if __name__ == "__main__":
    unittest.main()
