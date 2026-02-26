from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import orchestrator  # noqa: E402


class CompletionMetricsTests(unittest.TestCase):
    def test_build_snapshot_uses_completed_and_run_history_runtime(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            backlog = root / "coordination" / "backlog"
            runtime = root / "coordination" / "runtime"
            backlog.mkdir(parents=True, exist_ok=True)
            runtime.mkdir(parents=True, exist_ok=True)

            completed = [
                {
                    "id": "RK-1",
                    "title": "Task one",
                    "status": "completed",
                    "resolved_by_agent": "mara-voss",
                    "runtime_seconds": 11.5,
                    "updated_at": "2026-02-26T10:00:00+00:00",
                },
                {
                    "id": "RK-2",
                    "title": "Task two",
                    "status": "completed",
                    "assigned_agent": "tomas-grell",
                    "updated_at": "2026-02-26T11:00:00+00:00",
                },
            ]
            (backlog / "completed-items.json").write_text(json.dumps(completed) + "\n", encoding="utf-8")
            (runtime / "run-history.jsonl").write_text(
                "\n".join(
                    [
                        json.dumps(
                            {
                                "ts": "2026-02-26T11:00:00+00:00",
                                "result": "completed",
                                "item_id": "RK-2",
                                "agent_id": "tomas-grell",
                                "runtime_seconds": 7.25,
                            }
                        ),
                        json.dumps(
                            {
                                "ts": "2026-02-26T11:01:00+00:00",
                                "result": "failed_validation",
                                "item_id": "RK-9",
                                "agent_id": "tomas-grell",
                            }
                        ),
                    ]
                )
                + "\n",
                encoding="utf-8",
            )

            snapshot = orchestrator.build_completion_metrics_snapshot(root)

        self.assertEqual(snapshot["completed_items"], 2)
        self.assertEqual(snapshot["with_resolver"], 2)
        self.assertEqual(snapshot["with_runtime"], 2)
        by_agent = {row["agent_id"]: row for row in snapshot["agent_rows"]}
        self.assertEqual(by_agent["mara-voss"]["completed_items"], 1)
        self.assertEqual(by_agent["mara-voss"]["runtime_total_seconds"], 11.5)
        self.assertEqual(by_agent["tomas-grell"]["completed_items"], 1)
        self.assertEqual(by_agent["tomas-grell"]["runtime_total_seconds"], 7.25)


if __name__ == "__main__":
    unittest.main()
