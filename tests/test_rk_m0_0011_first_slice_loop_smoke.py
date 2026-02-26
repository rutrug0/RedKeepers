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
        "backend/src/app/transport/local-first-slice-settlement-loop-transport.test.ts": (
            'assert.equal(response.body.error_code, "insufficient_resources");\n'
            'assert.equal(response.body.error_code, "unavailable_tile");\n'
        ),
        "client-web/app.js": (
            "const firstSliceTransportRoutes = Object.freeze({\n"
            '  settlement_tick: "/settlements/{settlementId}/tick",\n'
            '  building_upgrade: "/settlements/{settlementId}/buildings/{buildingId}/upgrade",\n'
            '  unit_train: "/settlements/{settlementId}/units/{unitId}/train",\n'
            '  world_map_tile_interact: "/world-map/tiles/{tileId}/interact",\n'
            "});\n"
            'data-settlement-adapter-action="tick"\n'
            'data-settlement-adapter-action="build"\n'
            'data-settlement-adapter-action="train"\n'
            'data-worldmap-adapter-action="scout"\n'
            "tickSettlementCommand: async\n"
            "buildUpgradeCommand: async\n"
            "trainUnitCommand: async\n"
            "scoutTileInteractCommand: async\n"
            'if (actionType === "tick" || actionType === "build" || actionType === "train")\n'
            'if (actionType === "scout")\n'
            'insufficient_resources: "event.build.failure_insufficient_resources"\n'
            'insufficient_resources: "event.train.failure_insufficient_resources"\n'
            '"event.build.failure_insufficient_resources":\n'
            "event.world.scout_unavailable_tile\n"
            "event.scout.unavailable_tile\n"
            'flow_version: "v1"\n'
            'flow_version: "v1"\n'
            'flow_version: "v1"\n'
            'flow_version: "v1"\n'
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
        self.assertIn("RK-M0-0011_SMOKE check=negative_insufficient_resources status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE check=negative_unavailable_state status=PASS", text)
        self.assertIn("RK-M0-0011_SMOKE summary status=PASS pass=7 fail=0", text)

    def test_main_fails_when_unavailable_tile_assertion_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _write_fixture(root)
            transport_test_path = (
                root / "backend" / "src" / "app" / "transport" / "local-first-slice-settlement-loop-transport.test.ts"
            )
            transport_test_path.write_text(
                'assert.equal(response.body.error_code, "insufficient_resources");\n',
                encoding="utf-8",
            )
            out = io.StringIO()
            with mock.patch.object(smoke, "ROOT", root), redirect_stdout(out):
                rc = smoke.main()

        self.assertEqual(rc, 1)
        text = out.getvalue()
        self.assertIn("RK-M0-0011_SMOKE check=negative_unavailable_state status=FAIL", text)
        self.assertIn("RK-M0-0011_SMOKE summary status=FAIL pass=6 fail=1", text)


if __name__ == "__main__":
    unittest.main()
