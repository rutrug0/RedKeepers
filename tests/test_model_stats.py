from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import model_stats  # noqa: E402


class ModelStatsTrackerTests(unittest.TestCase):
    def test_records_lifetime_and_session_model_usage(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            tracker = model_stats.ModelStatsTracker(root)
            data = tracker.load()

            tracker.start_session(
                data,
                session_id="session-a",
                started_at="2026-01-01T00:00:00+00:00",
                pid=123,
                mode="run",
            )
            tracker.record_run(
                data,
                session_id="session-a",
                agent_id="rowan-hale",
                role="design",
                outcome="completed",
                requested_model="GPT-5.3-Codex-Spark",
                used_model="GPT-5.3-Codex-Spark",
                fallback_used=False,
                tokens_in=100,
                tokens_out=50,
                runtime_seconds=30.0,
            )
            tracker.record_run(
                data,
                session_id="session-a",
                agent_id="rowan-hale",
                role="design",
                outcome="failed",
                requested_model="GPT-5.3-Codex-Spark",
                used_model="gpt-5-mini",
                fallback_used=True,
                tokens_in=80,
                tokens_out=20,
                runtime_seconds=20.0,
            )
            tracker.end_session(data, session_id="session-a", ended_at="2026-01-01T00:02:00+00:00")
            tracker.save(data)

            saved = tracker.load()

        lifetime = saved["lifetime"]["totals"]
        self.assertEqual(lifetime["runs"], 2)
        self.assertEqual(lifetime["completed"], 1)
        self.assertEqual(lifetime["failed"], 1)
        self.assertEqual(lifetime["fallback_runs"], 1)
        self.assertEqual(lifetime["tokens_in"], 180)
        self.assertEqual(lifetime["tokens_out"], 70)
        self.assertAlmostEqual(float(lifetime["runtime_seconds"]), 50.0, places=2)

        self.assertIn("GPT-5.3-Codex-Spark", saved["lifetime"]["by_model"])
        self.assertIn("gpt-5-mini", saved["lifetime"]["by_model"])
        spark_bucket = saved["lifetime"]["by_model"]["GPT-5.3-Codex-Spark"]
        mini_bucket = saved["lifetime"]["by_model"]["gpt-5-mini"]
        self.assertEqual(spark_bucket["runs"], 1)
        self.assertEqual(mini_bucket["runs"], 1)

        session = saved["sessions"]["session-a"]
        self.assertEqual(session["totals"]["runs"], 2)
        self.assertEqual(session["ended_at"], "2026-01-01T00:02:00+00:00")
        self.assertIn("session-a", saved["session_order"])


if __name__ == "__main__":
    unittest.main()
