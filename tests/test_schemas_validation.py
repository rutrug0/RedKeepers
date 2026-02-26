from __future__ import annotations

import sys
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from schemas import validate_work_item  # noqa: E402


def _base_item() -> dict[str, object]:
    return {
        "id": "RK-TEST-0001",
        "title": "Test work item",
        "description": "Validation test fixture",
        "milestone": "M0",
        "type": "feature",
        "priority": "normal",
        "owner_role": "backend",
        "dependencies": [],
        "inputs": [],
        "acceptance_criteria": ["criterion"],
        "validation_commands": ["python tools/orchestrator.py status"],
        "status": "queued",
        "retry_count": 0,
        "created_at": "2026-02-25T00:00:00+00:00",
        "updated_at": "2026-02-25T00:00:00+00:00",
        "estimated_effort": "S",
        "token_budget": 8000,
        "escalation_target": "Mara Voss",
    }


class SchemaValidationTests(unittest.TestCase):
    def test_rejects_placeholder_validation_command(self) -> None:
        item = _base_item()
        item["validation_commands"] = [
            "python tools/rk_m0_0014_progression_profile.py --seed-profile <backend_replay_path>"
        ]

        errors = validate_work_item(item)

        self.assertTrue(any("unresolved placeholder token" in err for err in errors))

    def test_accepts_resolved_validation_command(self) -> None:
        item = _base_item()
        item["validation_commands"] = ["python tools/rk_m0_0014_progression_profile.py"]

        errors = validate_work_item(item)

        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
