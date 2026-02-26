from __future__ import annotations

import io
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import orchestrator  # noqa: E402


class EventFormatTests(unittest.TestCase):
    def test_select_event_is_human_readable_with_description_line(self) -> None:
        out = io.StringIO()
        with (
            mock.patch.object(orchestrator, "utc_now_iso", return_value="2026-02-26T08:28:43.239364+00:00"),
            mock.patch.object(orchestrator, "append_jsonl"),
            mock.patch.object(orchestrator, "COLOR_ENABLED", False),
            redirect_stdout(out),
        ):
            orchestrator.emit_event(
                "select",
                "Selected work item",
                agent_id="mara-voss",
                role="lead",
                title="Resolve queue dependency stall",
                description=(
                    "Resolve stalled dependencies so queued work becomes runnable. "
                    "Unblock delivery and reduce idle cycles. "
                    "Coordinate blocked item triage with Mara. "
                    "This fourth sentence should be omitted."
                ),
            )

        lines = out.getvalue().strip().splitlines()
        self.assertEqual(
            lines[0],
            "[2026-02-26T08:28:43] [select] LEAD, mara-voss: Resolve queue dependency stall.",
        )
        self.assertEqual(
            lines[1],
            (
                "Resolve stalled dependencies so queued work becomes runnable. "
                "Unblock delivery and reduce idle cycles. "
                "Coordinate blocked item triage with Mara."
            ),
        )

    def test_heartbeat_event_uses_simplified_line(self) -> None:
        out = io.StringIO()
        with (
            mock.patch.object(orchestrator, "utc_now_iso", return_value="2026-02-26T08:34:10.000000+00:00"),
            mock.patch.object(orchestrator, "append_jsonl"),
            mock.patch.object(orchestrator, "COLOR_ENABLED", False),
            redirect_stdout(out),
        ):
            orchestrator.emit_event(
                "agent_heartbeat",
                "Agent still running",
                agent_id="tomas-grell",
                elapsed_seconds=60.3,
                timeout_seconds=900,
            )

        self.assertEqual(
            out.getvalue().strip(),
            "[2026-02-26T08:34:10] [agent_heartbeat] Agent tomas-grell still running, elapsed seconds: 60.3.",
        )


if __name__ == "__main__":
    unittest.main()
