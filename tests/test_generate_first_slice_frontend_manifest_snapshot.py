from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import generate_first_slice_frontend_manifest_snapshot as snapshot_generator  # noqa: E402


def _load_generator_inputs() -> tuple[dict[str, object], dict[str, object], dict[str, object], dict[str, object]]:
    playable_manifest = snapshot_generator._read_json_file(  # type: ignore[attr-defined]
        snapshot_generator.PLAYABLE_MANIFEST_PATH
    )
    content_key_manifest = snapshot_generator._read_json_file(  # type: ignore[attr-defined]
        snapshot_generator.CONTENT_KEY_MANIFEST_PATH
    )
    narrative_template_snapshot = snapshot_generator._read_json_file(  # type: ignore[attr-defined]
        snapshot_generator.NARRATIVE_TEMPLATE_SNAPSHOT_LOCK_PATH
    )
    hostile_runtime_token_contract = snapshot_generator._read_json_file(  # type: ignore[attr-defined]
        snapshot_generator.HOSTILE_RUNTIME_TOKEN_CONTRACT_PATH
    )
    return (
        playable_manifest,
        content_key_manifest,
        narrative_template_snapshot,
        hostile_runtime_token_contract,
    )


class FirstSliceFrontendManifestObjectiveContractSnapshotTests(unittest.TestCase):
    def test_build_snapshot_payload_emits_objective_contract_rows_from_manifest_data(self) -> None:
        playable_manifest, content_key_manifest, narrative_template_snapshot, hostile_runtime_token_contract = (
            _load_generator_inputs()
        )
        drifted_manifest = copy.deepcopy(content_key_manifest)
        drifted_manifest["objective_step_outcome_contract"][0]["canonical_objective_key"] = (  # type: ignore[index]
            "first_session.tick.observe_income.synthetic.v1"
        )

        payload = snapshot_generator._build_snapshot_payload(  # type: ignore[attr-defined]
            playable_manifest,
            drifted_manifest,
            narrative_template_snapshot,
            hostile_runtime_token_contract,
        )

        objective_contract = payload["content_keys"]["first_session_objective_contract"]
        self.assertEqual(
            objective_contract["rows"],
            drifted_manifest["objective_step_outcome_contract"],  # type: ignore[index]
        )
        self.assertEqual(
            objective_contract["alias_lookup_contract"],
            drifted_manifest["alias_lookup_contract"],  # type: ignore[index]
        )

    def test_build_snapshot_payload_fails_on_duplicate_objective_ids(self) -> None:
        playable_manifest, content_key_manifest, narrative_template_snapshot, hostile_runtime_token_contract = (
            _load_generator_inputs()
        )
        drifted_manifest = copy.deepcopy(content_key_manifest)
        duplicate_key = drifted_manifest["objective_step_outcome_contract"][0]["canonical_objective_key"]  # type: ignore[index]
        drifted_manifest["objective_step_outcome_contract"][1]["canonical_objective_key"] = duplicate_key  # type: ignore[index]

        with self.assertRaisesRegex(ValueError, "canonical_objective_key '.*' is duplicated"):
            snapshot_generator._build_snapshot_payload(  # type: ignore[attr-defined]
                playable_manifest,
                drifted_manifest,
                narrative_template_snapshot,
                hostile_runtime_token_contract,
            )

    def test_build_snapshot_payload_fails_on_invalid_objective_step_order(self) -> None:
        playable_manifest, content_key_manifest, narrative_template_snapshot, hostile_runtime_token_contract = (
            _load_generator_inputs()
        )
        drifted_manifest = copy.deepcopy(content_key_manifest)
        objective_rows = list(drifted_manifest["objective_step_outcome_contract"])  # type: ignore[index]
        objective_rows[0], objective_rows[1] = objective_rows[1], objective_rows[0]
        drifted_manifest["objective_step_outcome_contract"] = objective_rows

        with self.assertRaisesRegex(ValueError, "loop_step 'tick' is out of order"):
            snapshot_generator._build_snapshot_payload(  # type: ignore[attr-defined]
                playable_manifest,
                drifted_manifest,
                narrative_template_snapshot,
                hostile_runtime_token_contract,
            )

    def test_build_snapshot_payload_fails_on_compatibility_only_canonical_default_selection(self) -> None:
        playable_manifest, content_key_manifest, narrative_template_snapshot, hostile_runtime_token_contract = (
            _load_generator_inputs()
        )
        drifted_manifest = copy.deepcopy(content_key_manifest)
        objective_rows = list(drifted_manifest["objective_step_outcome_contract"])  # type: ignore[index]
        target_row = copy.deepcopy(objective_rows[0])
        compatibility_alias_key = "event.economy.tick_passive_income"
        second_canonical_key = target_row["required_all_canonical_keys"][1]
        target_row["required_all_canonical_keys"] = [
            compatibility_alias_key,
            second_canonical_key,
        ]
        target_row["compatibility_alias_lookup_keys"] = {
            compatibility_alias_key: [],
            second_canonical_key: target_row["compatibility_alias_lookup_keys"][second_canonical_key],
        }
        objective_rows[0] = target_row
        drifted_manifest["objective_step_outcome_contract"] = objective_rows

        with self.assertRaisesRegex(ValueError, "compatibility-only and cannot be selected as canonical default key"):
            snapshot_generator._build_snapshot_payload(  # type: ignore[attr-defined]
                playable_manifest,
                drifted_manifest,
                narrative_template_snapshot,
                hostile_runtime_token_contract,
            )

    def test_build_snapshot_payload_fails_on_objective_alias_lookup_policy_drift(self) -> None:
        playable_manifest, content_key_manifest, narrative_template_snapshot, hostile_runtime_token_contract = (
            _load_generator_inputs()
        )
        drifted_manifest = copy.deepcopy(content_key_manifest)
        objective_rows = list(drifted_manifest["objective_step_outcome_contract"])  # type: ignore[index]
        target_row = copy.deepcopy(objective_rows[0])
        target_row["compatibility_alias_lookup_keys"] = {
            "event.tick.passive_income": [],
            "event.tick.passive_gain_success": [],
        }
        objective_rows[0] = target_row
        drifted_manifest["objective_step_outcome_contract"] = objective_rows

        with self.assertRaisesRegex(ValueError, "alias lookup policy drift"):
            snapshot_generator._build_snapshot_payload(  # type: ignore[attr-defined]
                playable_manifest,
                drifted_manifest,
                narrative_template_snapshot,
                hostile_runtime_token_contract,
            )


if __name__ == "__main__":
    unittest.main()
