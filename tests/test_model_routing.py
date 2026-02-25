from __future__ import annotations

import sys
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import orchestrator  # noqa: E402


class ExecutionProfileTests(unittest.TestCase):
    def test_policy_model_overrides_agent_catalog_model(self) -> None:
        profile = orchestrator.resolve_execution_profile(
            agent_id="rowan-hale",
            agent_cfg={"model": "gpt-5-mini", "reasoning": "low"},
            model_policy={
                "agent_models": {
                    "rowan-hale": {
                        "model": "GPT-5.3-Codex-Spark",
                        "reasoning": "medium",
                        "fallback_model": "gpt-5-mini",
                    }
                }
            },
        )
        self.assertEqual(profile["model"], "GPT-5.3-Codex-Spark")
        self.assertEqual(profile["reasoning"], "medium")
        self.assertEqual(profile["fallback_model"], "gpt-5-mini")

    def test_agent_catalog_model_used_when_policy_missing(self) -> None:
        profile = orchestrator.resolve_execution_profile(
            agent_id="nika-thorn",
            agent_cfg={"model": "gpt-5-mini", "reasoning": "low"},
            model_policy={"agent_models": {}},
        )
        self.assertEqual(profile["model"], "gpt-5-mini")
        self.assertEqual(profile["reasoning"], "low")
        self.assertIsNone(profile["fallback_model"])


if __name__ == "__main__":
    unittest.main()
