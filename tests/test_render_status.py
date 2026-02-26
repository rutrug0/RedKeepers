from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import render_status  # noqa: E402


class RenderStatusTests(unittest.TestCase):
    def test_includes_agent_workload_buckets(self) -> None:
        payload = {
            "daemon": {
                "state": "idle",
                "lock_held": False,
                "updated_at": "2026-02-26T09:20:00+00:00",
                "active_item": None,
            },
            "queue": {
                "queued": 3,
                "dependency_ready": 1,
                "running": 1,
                "blocked": 2,
                "completed": 9,
            },
            "agent_stats": {
                "agents": {
                    "tomas-grell": {
                        "role": "qa",
                        "total_runs": 5,
                        "completed_items": 3,
                        "failed_runs": 2,
                        "total_runtime_seconds": 1256.5,
                        "current_load_score": 6.09,
                    }
                }
            },
            "agent_workload": {
                "agents": {
                    "tomas-grell": {
                        "ready": 1,
                        "waiting": 2,
                        "running": 1,
                        "open": 4,
                        "blocked": 2,
                        "completed": 9,
                    }
                }
            },
        }

        with mock.patch.dict(os.environ, {"NO_COLOR": "1"}, clear=False):
            # Re-import is not needed; _style checks global COLOR_ENABLED, so patch directly.
            with mock.patch.object(render_status, "COLOR_ENABLED", False):
                text = render_status.render_status(payload)

        self.assertIn("Agent Utilization:", text)
        self.assertIn("open: ready=1 waiting=2 running=1 total=4", text)
        self.assertIn("backlog: blocked=2 completed=9", text)
        self.assertIn("Workload Buckets: ready=dependency-ready queued, waiting=queued with unmet dependencies.", text)

    def test_sorts_agents_by_ready_descending(self) -> None:
        payload = {
            "daemon": {
                "state": "idle",
                "lock_held": False,
                "updated_at": "2026-02-26T09:20:00+00:00",
                "active_item": None,
            },
            "queue": {
                "queued": 4,
                "dependency_ready": 3,
                "running": 0,
                "blocked": 0,
                "completed": 0,
            },
            "agent_stats": {
                "agents": {
                    "ilya-fen": {"role": "backend"},
                    "tomas-grell": {"role": "qa"},
                }
            },
            "agent_workload": {
                "agents": {
                    "ilya-fen": {"ready": 1, "waiting": 0, "running": 0, "open": 1, "blocked": 0, "completed": 0},
                    "tomas-grell": {"ready": 2, "waiting": 1, "running": 0, "open": 3, "blocked": 0, "completed": 0},
                }
            },
        }

        with mock.patch.dict(os.environ, {"NO_COLOR": "1"}, clear=False):
            with mock.patch.object(render_status, "COLOR_ENABLED", False):
                text = render_status.render_status(payload)

        lines = text.splitlines()
        ilya_idx = next(i for i, line in enumerate(lines) if line.startswith("  - ilya-fen"))
        tomas_idx = next(i for i, line in enumerate(lines) if line.startswith("  - tomas-grell"))
        self.assertLess(tomas_idx, ilya_idx)


if __name__ == "__main__":
    unittest.main()
