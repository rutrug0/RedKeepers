from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import health_checks  # noqa: E402
import smoke_daemon_env  # noqa: E402


def _write_smoke_fixture(root: Path, *, omit_state: str | None = None) -> None:
    queue_dir = root / "coordination" / "backlog"
    state_dir = root / "coordination" / "state"
    policy_dir = root / "coordination" / "policies"

    queue_files = ["work-items.json", "completed-items.json", "blocked-items.json"]
    state_files = [
        "daemon-state.json",
        "agents.json",
        "agent-stats.json",
        "progress-summary.json",
        "locks.json",
    ]
    policy_files = [
        "routing-rules.yaml",
        "retry-policy.yaml",
        "model-policy.yaml",
        "commit-guard-rules.yaml",
    ]

    for name in queue_files:
        path = queue_dir / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("[]\n", encoding="utf-8")

    for name in state_files:
        if name == omit_state:
            continue
        path = state_dir / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("{}\n", encoding="utf-8")

    for name in policy_files:
        path = policy_dir / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({}) + "\n", encoding="utf-8")


class HealthCheckRequiredFilesTests(unittest.TestCase):
    def test_validate_environment_reports_missing_required_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            with mock.patch.object(health_checks, "codex_command_preflight_error", return_value=None):
                errors = health_checks.validate_environment(root)

        self.assertTrue(any("missing required file:" in err for err in errors))
        self.assertTrue(any("work-items.json" in err for err in errors))
        self.assertTrue(any("daemon-state.json" in err for err in errors))
        self.assertTrue(any("routing-rules.yaml" in err for err in errors))


class SmokeDaemonEnvTests(unittest.TestCase):
    def test_smoke_main_passes_for_valid_queue_policy_state_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _write_smoke_fixture(root)
            out = io.StringIO()
            with (
                mock.patch.object(smoke_daemon_env, "ROOT", root),
                mock.patch.object(smoke_daemon_env, "validate_environment", return_value=[]),
                redirect_stdout(out),
            ):
                rc = smoke_daemon_env.main()

        self.assertEqual(rc, 0)
        text = out.getvalue()
        self.assertIn("Smoke validation passed.", text)
        self.assertIn("queue: active=0 completed=0 blocked=0", text)
        self.assertIn("policies: parsed=4", text)
        self.assertIn("state: parsed=5", text)

    def test_smoke_main_fails_when_required_state_file_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _write_smoke_fixture(root, omit_state="locks.json")
            out = io.StringIO()
            with (
                mock.patch.object(smoke_daemon_env, "ROOT", root),
                mock.patch.object(smoke_daemon_env, "validate_environment", return_value=[]),
                redirect_stdout(out),
            ):
                rc = smoke_daemon_env.main()

        self.assertEqual(rc, 1)
        text = out.getvalue()
        self.assertIn("Smoke validation failed:", text)
        self.assertIn("missing state file for smoke validation:", text)
        self.assertIn("locks.json", text)


if __name__ == "__main__":
    unittest.main()
