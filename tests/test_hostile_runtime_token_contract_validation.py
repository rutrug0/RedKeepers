from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import health_checks  # noqa: E402


def _write_required_daemon_files(root: Path) -> None:
    json_list_paths = [
        root / "coordination" / "backlog" / "work-items.json",
        root / "coordination" / "backlog" / "completed-items.json",
        root / "coordination" / "backlog" / "blocked-items.json",
    ]
    json_object_paths = [
        root / "coordination" / "state" / "daemon-state.json",
        root / "coordination" / "state" / "agents.json",
    ]
    policy_paths = [
        root / "coordination" / "policies" / "routing-rules.yaml",
        root / "coordination" / "policies" / "retry-policy.yaml",
        root / "coordination" / "policies" / "model-policy.yaml",
        root / "coordination" / "policies" / "commit-guard-rules.yaml",
        root / "coordination" / "policies" / "runtime-policy.yaml",
    ]

    for path in json_list_paths:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("[]\n", encoding="utf-8")
    for path in json_object_paths:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("{}\n", encoding="utf-8")
    for path in policy_paths:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("{}\n", encoding="utf-8")


def _base_hostile_contract_fixture() -> dict[str, object]:
    return {
        "required_runtime_keys": [
            {
                "phase": "dispatch",
                "canonical_key": "event.world.hostile_dispatch_en_route",
                "required_tokens": ["army_name", "target_tile_label", "eta_seconds"],
                "compatibility_alias_keys": ["event.world.march_started"],
            },
            {
                "phase": "resolve",
                "canonical_key": "event.combat.hostile_resolve_attacker_win",
                "required_tokens": ["army_name", "target_tile_label"],
                "compatibility_alias_keys": ["event.combat.placeholder_skirmish_win"],
            },
        ],
        "compatibility_alias_only_keys": [
            "event.world.march_started",
            "event.combat.placeholder_skirmish_win",
        ],
        "deferred_post_slice_keys_excluded_from_contract": [
            {"key": "event.world.gather_started"},
            {"key": "event.world.ambush_triggered"},
            {"key": "event.hero.assigned"},
        ],
    }


def _base_manifest_fixture() -> dict[str, object]:
    return {
        "default_first_slice_seed_usage": {
            "include_only_content_keys": [
                "event.world.hostile_dispatch_en_route",
                "event.combat.hostile_resolve_attacker_win",
            ]
        },
        "loop_required_keys": {
            "tick": [],
            "build": [],
            "train": [],
            "scout": [],
            "hostile_dispatch_and_resolve": [
                "event.world.hostile_dispatch_en_route",
                "event.combat.hostile_resolve_attacker_win",
            ],
        },
        "compatibility_alias_only_keys": [
            "event.world.march_started",
            "event.combat.placeholder_skirmish_win",
        ],
        "legacy_alias_mapping": [
            {
                "canonical_key": "event.world.hostile_dispatch_en_route",
                "legacy_keys": ["event.world.march_started"],
            },
            {
                "canonical_key": "event.combat.hostile_resolve_attacker_win",
                "legacy_keys": ["event.combat.placeholder_skirmish_win"],
            },
        ],
        "deferred_post_slice_keys": [
            {"key": "event.world.gather_started"},
            {"key": "event.world.ambush_triggered"},
            {"key": "event.hero.assigned"},
        ],
    }


def _base_event_feed_fixture() -> dict[str, object]:
    return {
        "rows": [
            {
                "key": "event.world.hostile_dispatch_en_route",
                "tokens": ["army_name", "target_tile_label", "eta_seconds"],
            },
            {
                "key": "event.combat.hostile_resolve_attacker_win",
                "tokens": ["army_name", "target_tile_label"],
            },
            {
                "key": "event.world.march_started",
                "tokens": ["army_name", "target_tile_label", "eta_seconds"],
            },
            {
                "key": "event.combat.placeholder_skirmish_win",
                "tokens": ["army_name", "target_tile_label"],
            },
        ]
    }


def _write_hostile_contract_inputs(
    root: Path,
    *,
    contract: dict[str, object],
    manifest: dict[str, object],
    event_feed: dict[str, object],
) -> None:
    contract_path = (
        root
        / "backend"
        / "src"
        / "app"
        / "config"
        / "seeds"
        / "v1"
        / "narrative"
        / "first-slice-hostile-runtime-token-contract.json"
    )
    manifest_path = (
        root
        / "backend"
        / "src"
        / "app"
        / "config"
        / "seeds"
        / "v1"
        / "narrative"
        / "first-slice-content-key-manifest.json"
    )
    event_feed_path = (
        root
        / "backend"
        / "src"
        / "app"
        / "config"
        / "seeds"
        / "v1"
        / "narrative"
        / "event-feed-messages.json"
    )

    for path, payload in (
        (contract_path, contract),
        (manifest_path, manifest),
        (event_feed_path, event_feed),
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload) + "\n", encoding="utf-8")


def _hostile_contract_errors(errors: list[str]) -> list[str]:
    return [error for error in errors if "first-slice-hostile-runtime-token-contract drift:" in error]


class HostileRuntimeTokenContractValidationTests(unittest.TestCase):
    def test_validate_environment_accepts_consistent_hostile_runtime_contract(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _write_required_daemon_files(root)
            _write_hostile_contract_inputs(
                root,
                contract=_base_hostile_contract_fixture(),
                manifest=_base_manifest_fixture(),
                event_feed=_base_event_feed_fixture(),
            )
            with (
                mock.patch.object(health_checks, "codex_command_preflight_error", return_value=None),
                mock.patch.object(health_checks, "codex_model_access_preflight_error", return_value=None),
            ):
                errors = health_checks.validate_environment(root)

        self.assertEqual(_hostile_contract_errors(errors), [])

    def test_validate_environment_reports_missing_canonical_in_manifest_and_event_feed(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _write_required_daemon_files(root)

            contract = copy.deepcopy(_base_hostile_contract_fixture())
            contract["required_runtime_keys"][0]["canonical_key"] = "event.world.hostile_dispatch_missing"  # type: ignore[index]
            manifest = _base_manifest_fixture()
            event_feed = _base_event_feed_fixture()
            _write_hostile_contract_inputs(root, contract=contract, manifest=manifest, event_feed=event_feed)

            with (
                mock.patch.object(health_checks, "codex_command_preflight_error", return_value=None),
                mock.patch.object(health_checks, "codex_model_access_preflight_error", return_value=None),
            ):
                errors = health_checks.validate_environment(root)

        hostile_errors = _hostile_contract_errors(errors)
        self.assertTrue(
            any("event.world.hostile_dispatch_missing" in error and "loop_required_keys.hostile_dispatch_and_resolve" in error for error in hostile_errors)
        )
        self.assertTrue(
            any("event.world.hostile_dispatch_missing" in error and "event-feed-messages rows" in error for error in hostile_errors)
        )

    def test_validate_environment_reports_alias_key_selected_as_default_canonical(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _write_required_daemon_files(root)

            contract = _base_hostile_contract_fixture()
            manifest = _base_manifest_fixture()
            manifest["default_first_slice_seed_usage"]["include_only_content_keys"].append("event.world.march_started")  # type: ignore[index]
            event_feed = _base_event_feed_fixture()
            _write_hostile_contract_inputs(root, contract=contract, manifest=manifest, event_feed=event_feed)

            with (
                mock.patch.object(health_checks, "codex_command_preflight_error", return_value=None),
                mock.patch.object(health_checks, "codex_model_access_preflight_error", return_value=None),
            ):
                errors = health_checks.validate_environment(root)

        hostile_errors = _hostile_contract_errors(errors)
        self.assertTrue(
            any(
                "compatibility alias key 'event.world.march_started'" in error
                and "include_only_content_keys" in error
                for error in hostile_errors
            )
        )

    def test_validate_environment_reports_deferred_key_leak_into_required_runtime_keys(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _write_required_daemon_files(root)

            contract = copy.deepcopy(_base_hostile_contract_fixture())
            contract["required_runtime_keys"][0]["canonical_key"] = "event.world.gather_started"  # type: ignore[index]
            manifest = _base_manifest_fixture()
            event_feed = _base_event_feed_fixture()
            _write_hostile_contract_inputs(root, contract=contract, manifest=manifest, event_feed=event_feed)

            with (
                mock.patch.object(health_checks, "codex_command_preflight_error", return_value=None),
                mock.patch.object(health_checks, "codex_model_access_preflight_error", return_value=None),
            ):
                errors = health_checks.validate_environment(root)

        hostile_errors = _hostile_contract_errors(errors)
        self.assertTrue(
            any(
                "deferred key 'event.world.gather_started' appears in required_runtime_keys.canonical_key" in error
                for error in hostile_errors
            )
        )


if __name__ == "__main__":
    unittest.main()
