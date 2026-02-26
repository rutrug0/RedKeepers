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
from queue_manager import QueueManager  # noqa: E402


class ModelPolicyDriftAuditTests(unittest.TestCase):
    def test_process_one_blocks_stale_queued_item_when_policy_changes_and_models_are_inaccessible(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            backlog = root / "coordination" / "backlog"
            runtime = root / "coordination" / "runtime"
            backlog.mkdir(parents=True, exist_ok=True)
            runtime.mkdir(parents=True, exist_ok=True)

            stale_item = self._base_item(
                item_id="RK-STALE-QUEUE-1",
                created_at="2026-01-10T00:00:00+00:00",
                updated_at="2026-01-10T00:00:00+00:00",
            )
            (backlog / "work-items.json").write_text(json.dumps([stale_item]) + "\n", encoding="utf-8")
            (backlog / "completed-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "blocked-items.json").write_text("[]\n", encoding="utf-8")
            (backlog / "blocked-archived-items.json").write_text("[]\n", encoding="utf-8")
            daemon_state_path = runtime / "daemon-state.json"
            daemon_state_path.write_text(json.dumps({"model_policy_fingerprint": "old-policy-fingerprint"}) + "\n", encoding="utf-8")

            agents = {
                "tomas-grell": {
                    "display_name": "Tomas Grell",
                    "role": "qa",
                    "model": "default",
                    "reasoning": "medium",
                }
            }
            policies = {
                "routing": {"owner_role_map": {"qa": "tomas-grell"}, "fallback_agent": "mara-voss"},
                "retry": {"max_retries_per_item_per_agent": 2, "worker_timeout_seconds": 5},
                "model": {
                    "agent_models": {
                        "tomas-grell": {
                            "model": "gpt-unsupported-primary",
                            "fallback_model": "gpt-unsupported-fallback",
                            "reasoning": "medium",
                        }
                    }
                },
                "commit": {"default_validation_commands": [], "commit_enabled": False},
            }

            emitted: list[tuple[str, str, dict[str, object]]] = []
            run_agent_mock = mock.Mock()

            def _fake_preflight(model: str) -> str | None:
                if model == "gpt-unsupported-primary":
                    return "primary model is unsupported for this account"
                if model == "gpt-unsupported-fallback":
                    return "fallback model is unsupported for this account"
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
                mock.patch.object(
                    orchestrator,
                    "emit_event",
                    side_effect=lambda kind, message, **fields: emitted.append((kind, message, fields)),
                ),
                mock.patch.object(orchestrator, "load_agent_catalog", return_value=agents),
                mock.patch.object(orchestrator, "load_policies", return_value=policies),
                mock.patch.object(orchestrator, "codex_model_access_preflight_error", side_effect=_fake_preflight),
                mock.patch.object(orchestrator, "run_agent", run_agent_mock),
                mock.patch.object(orchestrator, "ensure_backlog_refill_item", return_value=None),
            ):
                rc = orchestrator.process_one(dry_run=False, verbose=False)

            self.assertEqual(rc, 0)
            run_agent_mock.assert_not_called()

            queue = QueueManager(root)
            queue.load()
            self.assertEqual(len(queue.active), 0)
            self.assertEqual(len(queue.blocked), 1)
            blocked = queue.blocked[0]
            self.assertEqual(blocked["id"], "RK-STALE-QUEUE-1")
            self.assertEqual(blocked["blocker_category"], orchestrator.MODEL_POLICY_DRIFT_BLOCKER_CATEGORY)
            self.assertIn("Remediation: update coordination/policies/model-policy.yaml", str(blocked.get("blocker_reason", "")))
            self.assertEqual(blocked.get("model_policy_drift", {}).get("model"), "gpt-unsupported-primary")
            self.assertEqual(blocked.get("model_policy_drift", {}).get("fallback_model"), "gpt-unsupported-fallback")

            drift_events = [event for event in emitted if event[0] == "queue_health"]
            self.assertTrue(drift_events)
            self.assertIn("model-policy drift", drift_events[-1][1].lower())

    @staticmethod
    def _base_item(*, item_id: str, created_at: str, updated_at: str) -> dict[str, object]:
        return {
            "id": item_id,
            "title": "Stale queued item for model-policy drift audit",
            "description": "Created before policy change and now points to unsupported model combo.",
            "milestone": "M1",
            "type": "feature",
            "priority": "high",
            "owner_role": "qa",
            "preferred_agent": None,
            "dependencies": [],
            "inputs": [],
            "acceptance_criteria": ["drift audit blocks stale queued unsupported model combo"],
            "validation_commands": [],
            "status": "queued",
            "retry_count": 0,
            "created_at": created_at,
            "updated_at": updated_at,
            "estimated_effort": "S",
            "token_budget": 1000,
            "result_summary": None,
            "blocker_reason": None,
            "escalation_target": "Mara Voss",
        }


class ModelPolicyDriftRevisitTests(unittest.TestCase):
    def test_revisit_skips_model_policy_drift_blocker_until_policy_fingerprint_changes(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            queue = QueueManager(Path(tmpdir))
            queue.active = []
            queue.completed = []
            queue.blocked = [
                {
                    "id": "RK-DRIFT-BLOCKED",
                    "status": "blocked",
                    "dependencies": [],
                    "blocker_reason": "unsupported model for account",
                    "blocker_category": orchestrator.MODEL_POLICY_DRIFT_BLOCKER_CATEGORY,
                    "model_policy_fingerprint": "fp-a",
                    "created_at": "2026-02-01T00:00:00+00:00",
                    "updated_at": "2026-02-01T00:00:00+00:00",
                }
            ]

            retry_policy = {
                "blocked_revisit": {
                    "enabled": True,
                    "max_items_per_cycle": 2,
                    "max_attempts_per_item": 2,
                    "cooldown_seconds": 0,
                    "include_reason_patterns": ["unsupported model"],
                }
            }

            same_policy = orchestrator.revisit_recoverable_blocked_items(
                queue,
                retry_policy,
                model_policy_fingerprint="fp-a",
            )
            changed_policy = orchestrator.revisit_recoverable_blocked_items(
                queue,
                retry_policy,
                model_policy_fingerprint="fp-b",
            )

        self.assertEqual(same_policy, [])
        self.assertEqual(changed_policy, ["RK-DRIFT-BLOCKED"])
        self.assertEqual(len(queue.blocked), 0)
        self.assertEqual(len(queue.active), 1)
        self.assertEqual(queue.active[0]["status"], "queued")
        self.assertEqual(queue.active[0]["blocked_revisit_count"], 1)


if __name__ == "__main__":
    unittest.main()
