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

import render_stats_html  # noqa: E402


class RenderStatsHtmlTests(unittest.TestCase):
    def test_generates_html_dashboard_from_json_sources(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            agent_stats_path = root / "agent-stats.json"
            model_stats_path = root / "model-stats.json"
            output_path = root / "dashboard.html"

            agent_stats_path.write_text(
                json.dumps(
                    {
                        "generated_at": "2026-02-25T00:00:00+00:00",
                        "agents": {
                            "rowan-hale": {
                                "role": "design",
                                "total_runs": 3,
                                "completed_items": 2,
                                "blocked_items": 0,
                                "failed_runs": 1,
                                "estimated_tokens_in": 300,
                                "estimated_tokens_out": 120,
                                "total_runtime_seconds": 95.0,
                            }
                        },
                        "totals": {"queued_items": 1, "blocked_items": 2, "completed_items": 5},
                    }
                ),
                encoding="utf-8",
            )
            model_stats_path.write_text(
                json.dumps(
                    {
                        "generated_at": "2026-02-25T00:00:00+00:00",
                        "lifetime": {
                            "totals": {
                                "runs": 3,
                                "completed": 2,
                                "blocked": 0,
                                "failed": 1,
                                "fallback_runs": 1,
                                "runtime_seconds": 95.0,
                            },
                            "by_model": {
                                "GPT-5.3-Codex-Spark": {"runs": 2, "completed": 1, "blocked": 0, "failed": 1, "fallback_runs": 1, "tokens_in": 250, "tokens_out": 80, "runtime_seconds": 70.0},
                                "gpt-5-mini": {"runs": 1, "completed": 1, "blocked": 0, "failed": 0, "fallback_runs": 0, "tokens_in": 50, "tokens_out": 20, "runtime_seconds": 25.0},
                            },
                        },
                        "sessions": {
                            "sess-1": {
                                "started_at": "2026-02-25T00:00:00+00:00",
                                "ended_at": "2026-02-25T00:10:00+00:00",
                                "pid": 100,
                                "mode": "run",
                                "totals": {"runs": 3, "completed": 2, "blocked": 0, "failed": 1, "fallback_runs": 1, "runtime_seconds": 95.0},
                                "by_model": {
                                    "GPT-5.3-Codex-Spark": {"runs": 2, "completed": 1, "blocked": 0, "failed": 1, "fallback_runs": 1, "tokens_in": 250, "tokens_out": 80, "runtime_seconds": 70.0},
                                    "gpt-5-mini": {"runs": 1, "completed": 1, "blocked": 0, "failed": 0, "fallback_runs": 0, "tokens_in": 50, "tokens_out": 20, "runtime_seconds": 25.0},
                                },
                            }
                        },
                        "session_order": ["sess-1"],
                    }
                ),
                encoding="utf-8",
            )

            argv = [
                "render_stats_html.py",
                "--agent-stats",
                str(agent_stats_path),
                "--model-stats",
                str(model_stats_path),
                "--output",
                str(output_path),
                "--title",
                "RK Dashboard Test",
            ]
            with mock.patch.object(sys, "argv", argv):
                rc = render_stats_html.main()

            self.assertEqual(rc, 0)
            html_text = output_path.read_text(encoding="utf-8")
            self.assertIn("RK Dashboard Test", html_text)
            self.assertIn("Global Runs by Model", html_text)
            self.assertIn("Per Session Model Usage", html_text)
            self.assertIn("sess-1", html_text)
            self.assertIn("GPT-5.3-Codex-Spark", html_text)


if __name__ == "__main__":
    unittest.main()
