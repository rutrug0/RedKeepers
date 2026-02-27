from __future__ import annotations

import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import rk_m0_0011_first_slice_loop_smoke as smoke  # noqa: E402


def _write_fixture(root: Path) -> None:
    fixture_files = {
        "backend/src/modules/economy/api/settlement-tick-endpoint.ts": (
            'export const POST_SETTLEMENT_TICK_ROUTE = "/settlements/{settlementId}/tick" as const;\n'
        ),
        "backend/src/modules/buildings/api/settlement-building-upgrade-endpoint.ts": (
            "export const POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE =\n"
            '  "/settlements/{settlementId}/buildings/{buildingId}/upgrade" as const;\n'
        ),
        "backend/src/modules/units/api/settlement-unit-train-endpoint.ts": (
            "export const POST_SETTLEMENT_UNIT_TRAIN_ROUTE =\n"
            '  "/settlements/{settlementId}/units/{unitId}/train" as const;\n'
        ),
        "backend/src/modules/world_map/api/world-map-tile-interact-endpoint.ts": (
            "export const POST_WORLD_MAP_TILE_INTERACT_ROUTE =\n"
            '  "/world-map/tiles/{tileId}/interact" as const;\n'
        ),
        "backend/src/modules/world_map/api/world-map-settlement-attack-endpoint.ts": (
            "export const POST_WORLD_MAP_SETTLEMENT_ATTACK_ROUTE =\n"
            '  "/world-map/settlements/{targetSettlementId}/attack" as const;\n'
        ),
        "backend/src/app/transport/local-first-slice-settlement-loop-transport.test.ts": (
            'assert.equal(response.body.error_code, "insufficient_resources");\n'
            'assert.equal(response.body.error_code, "unavailable_tile");\n'
            'test("local first-slice transport serves deterministic hostile settlement attack contracts", () => {\n'
            '  assert.equal(response.body.flow, "world_map.hostile_attack_v1");\n'
            "  assert.deepStrictEqual(\n"
            "    response.body.events.map((event) => event.payload_key),\n"
            '    ["dispatch_sent", "march_arrived", "combat_resolved"],\n'
            "  );\n"
            "  assert.equal(\n"
            "    response.body.event_payloads.combat_resolved.content_key,\n"
            '    "event.combat.hostile_resolve_attacker_win",\n'
            "  );\n"
            "  assert.equal(response.body.losses.attacker_units_lost, 2);\n"
            "  assert.equal(response.body.losses.defender_garrison_lost, 40);\n"
            "});\n"
        ),
        "client-web/index.html": (
            '<section id="settlement-panel"></section>\n'
            '<section id="worldmap-panel"></section>\n'
            '<section id="event-feed-panel"></section>\n'
            '<div id="event-feed-panel-content"></div>\n'
        ),
        "client-web/app.js": (
            "const firstSliceTransportRoutes = Object.freeze({\n"
            '  settlement_tick: "/settlements/{settlementId}/tick",\n'
            '  building_upgrade: "/settlements/{settlementId}/buildings/{buildingId}/upgrade",\n'
            '  unit_train: "/settlements/{settlementId}/units/{unitId}/train",\n'
            '  world_map_tile_interact: "/world-map/tiles/{tileId}/interact",\n'
            '  world_map_settlement_attack: "/world-map/settlements/{targetSettlementId}/attack",\n'
            "});\n"
            'data-settlement-adapter-action="tick"\n'
            'data-settlement-adapter-action="build"\n'
            'data-settlement-adapter-action="train"\n'
            'data-worldmap-adapter-action="scout"\n'
            'data-worldmap-adapter-action="attack"\n'
            "tickSettlementCommand: async\n"
            "buildUpgradeCommand: async\n"
            "trainUnitCommand: async\n"
            "scoutTileInteractCommand: async\n"
            "dispatchHostileSettlementAttackCommand: async\n"
            'if (actionType === "tick" || actionType === "build" || actionType === "train")\n'
            'if (actionType === "scout")\n'
            'if ((actionType !== "scout" && actionType !== "attack") || worldMapActionRuntime.pending_action !== null)\n'
            'insufficient_resources: "event.build.failure_insufficient_resources"\n'
            'insufficient_resources: "event.train.failure_insufficient_resources"\n'
            '"event.build.failure_insufficient_resources":\n'
            "event.world.scout_unavailable_tile\n"
            "event.scout.unavailable_tile\n"
            "const appendHostileDispatchLifecycleEvents = (response) => {\n"
            "  const contentKey = mapBackendEventKeyToClientKey(event.content_key);\n"
            "}\n"
            "appendHostileDispatchLifecycleEvents(response);\n"
            'priority: event.payload_key === "combat_resolved" ? "high" : "normal",\n'
            "applyHostileDispatchActionResult(response);\n"
            'flow_version: "v1"\n'
            'flow_version: "v1"\n'
            'flow_version: "v1"\n'
            'flow_version: "v1"\n'
            'flow_version: "v1"\n'
            'flow_version: "v1"\n'
        ),
        "backend/src/app/config/seeds/v1/first-slice-playable-manifest.json": (
            "{\n"
            '  "manifest_id": "first_slice_playable_manifest_lock_v1",\n'
            '  "default_consumption_contract": {\n'
            '    "frontend": {\n'
            '      "default_session_entry_settlement_id": "settlement_alpha",\n'
            '      "default_hostile_target_settlement_id": "settlement_hostile"\n'
            "    }\n"
            "  }\n"
            "}\n"
        ),
        "backend/src/app/config/seeds/v1/narrative/first-slice-content-key-manifest.json": (
            "{\n"
            '  "manifest_id": "first_slice_content_key_manifest_v1",\n'
            '  "default_first_slice_seed_usage": {\n'
            '    "include_only_content_keys": [\n'
            '      "event.tick.passive_income",\n'
            '      "event.build.success",\n'
            '      "event.world.hostile_dispatch_en_route",\n'
            '      "event.world.hostile_post_battle_returned",\n'
            '      "event.combat.hostile_resolve_attacker_win",\n'
            '      "event.combat.hostile_resolve_defender_win",\n'
            '      "event.combat.hostile_resolve_tie_defender_holds"\n'
            "    ]\n"
            "  }\n"
            "}\n"
        ),
        "client-web/first-slice-manifest-snapshot.js": (
            "window.__RK_FIRST_SLICE_MANIFEST_SNAPSHOT_V1__ = Object.freeze({\n"
            '  "source_manifests": {\n'
            '    "playable": {\n'
            '      "manifest_id": "first_slice_playable_manifest_lock_v1"\n'
            "    },\n"
            '    "content_keys": {\n'
            '      "manifest_id": "first_slice_content_key_manifest_v1"\n'
            "    }\n"
            "  },\n"
            '  "playable": {\n'
            '    "canonical_playable_now": {\n'
            '      "primary_settlement": {\n'
            '        "settlement_id": "settlement_alpha"\n'
            "      },\n"
            '      "foreign_hostile_profile": {\n'
            '        "profile_id": "foreign_settlement_profile_v1_ruin_holdfast",\n'
            '        "settlement_id": "settlement_hostile",\n'
            '        "target_tile_label": "Ruin Holdfast",\n'
            '        "map_coordinate": {\n'
            '          "x": 2,\n'
            '          "y": 1\n'
            "        }\n"
            "      }\n"
            "    },\n"
            '    "default_consumption_contract": {\n'
            '      "frontend": {\n'
            '        "default_session_entry_settlement_id": "settlement_alpha",\n'
            '        "default_hostile_target_settlement_id": "settlement_hostile"\n'
            "      }\n"
            "    }\n"
            "  },\n"
            '  "content_keys": {\n'
            '    "default_first_slice_seed_usage": {\n'
            '      "include_only_content_keys": [\n'
            '        "event.tick.passive_income",\n'
            '        "event.build.success",\n'
            '        "event.world.hostile_dispatch_en_route",\n'
            '        "event.world.hostile_post_battle_returned",\n'
            '        "event.combat.hostile_resolve_attacker_win",\n'
            '        "event.combat.hostile_resolve_defender_win",\n'
            '        "event.combat.hostile_resolve_tie_defender_holds"\n'
            "      ]\n"
            "    }\n"
            "  }\n"
            "});\n"
        ),
    }

    for rel_path, content in fixture_files.items():
        path = root / rel_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


class RKM00011FirstSliceLoopSmokeTests(unittest.TestCase):
    def test_main_prints_deterministic_pass_summary_for_valid_fixture(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _write_fixture(root)
            out = io.StringIO()
            with mock.patch.object(smoke, "ROOT", root), redirect_stdout(out):
                rc = smoke.main()

        self.assertEqual(rc, 0)
        text = out.getvalue()
        self.assertIn("RK-M0-0011_SMOKE check=tick_touchpoint status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=upgrade_touchpoint status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=train_touchpoint status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=scout_touchpoint status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=attack_touchpoint status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=hostile_dispatch_deterministic_contract status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=hostile_dispatch_event_feed_binding status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=foreign_hostile_profile_present status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=stage_hostile_dispatch status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=stage_deterministic_combat_resolve status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=stage_event_feed_output status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=negative_insufficient_resources status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=negative_unavailable_state status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=frontend_manifest_snapshot_manifest_ids status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=frontend_manifest_snapshot_settlement_defaults status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=frontend_manifest_snapshot_content_allowlist status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE summary status=PASS pass=23 fail=0", text)

    def test_main_fails_when_unavailable_tile_assertion_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _write_fixture(root)
            transport_test_path = (
                root / "backend" / "src" / "app" / "transport" / "local-first-slice-settlement-loop-transport.test.ts"
            )
            transport_test_path.write_text(
                transport_test_path.read_text(encoding="utf-8").replace(
                    'assert.equal(response.body.error_code, "unavailable_tile");\n',
                    "",
                ),
                encoding="utf-8",
            )
            out = io.StringIO()
            with mock.patch.object(smoke, "ROOT", root), redirect_stdout(out):
                rc = smoke.main()

        self.assertEqual(rc, 1)
        text = out.getvalue()
        self.assertIn("RK-M0-0011_SMOKE check=negative_unavailable_state status=FAIL", text)
        self.assertIn("RK-M0-0011_SMOKE summary status=FAIL pass=22 fail=1", text)

    def test_main_fails_when_frontend_snapshot_manifest_id_drifts(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _write_fixture(root)
            snapshot_path = root / "client-web" / "first-slice-manifest-snapshot.js"
            snapshot_path.write_text(
                snapshot_path.read_text(encoding="utf-8").replace(
                    "first_slice_content_key_manifest_v1",
                    "first_slice_content_key_manifest_v1_drift",
                ),
                encoding="utf-8",
            )
            out = io.StringIO()
            with mock.patch.object(smoke, "ROOT", root), redirect_stdout(out):
                rc = smoke.main()

        self.assertEqual(rc, 1)
        text = out.getvalue()
        self.assertIn("RK-M0-0011_SMOKE check=frontend_manifest_snapshot_manifest_ids status=FAIL", text)
        self.assertIn("RK-M0-0011_SMOKE summary status=FAIL pass=22 fail=1", text)


if __name__ == "__main__":
    unittest.main()
