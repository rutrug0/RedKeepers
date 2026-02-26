from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

ROUTE_BINDINGS = (
    {
        "check_id": "tick_touchpoint",
        "client_route_key": "settlement_tick",
        "backend_const_name": "POST_SETTLEMENT_TICK_ROUTE",
        "backend_route_file": Path("backend/src/modules/economy/api/settlement-tick-endpoint.ts"),
        "required_client_tokens": (
            'data-settlement-adapter-action="tick"',
            "tickSettlementCommand: async",
            'if (actionType === "tick" || actionType === "build" || actionType === "train")',
        ),
    },
    {
        "check_id": "upgrade_touchpoint",
        "client_route_key": "building_upgrade",
        "backend_const_name": "POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE",
        "backend_route_file": Path("backend/src/modules/buildings/api/settlement-building-upgrade-endpoint.ts"),
        "required_client_tokens": (
            'data-settlement-adapter-action="build"',
            "buildUpgradeCommand: async",
            'if (actionType === "tick" || actionType === "build" || actionType === "train")',
        ),
    },
    {
        "check_id": "train_touchpoint",
        "client_route_key": "unit_train",
        "backend_const_name": "POST_SETTLEMENT_UNIT_TRAIN_ROUTE",
        "backend_route_file": Path("backend/src/modules/units/api/settlement-unit-train-endpoint.ts"),
        "required_client_tokens": (
            'data-settlement-adapter-action="train"',
            "trainUnitCommand: async",
            'if (actionType === "tick" || actionType === "build" || actionType === "train")',
        ),
    },
    {
        "check_id": "scout_touchpoint",
        "client_route_key": "world_map_tile_interact",
        "backend_const_name": "POST_WORLD_MAP_TILE_INTERACT_ROUTE",
        "backend_route_file": Path("backend/src/modules/world_map/api/world-map-tile-interact-endpoint.ts"),
        "required_client_tokens": (
            'data-worldmap-adapter-action="scout"',
            "scoutTileInteractCommand: async",
            'if (actionType === "scout")',
        ),
    },
)


@dataclass(frozen=True)
class SmokeCheckResult:
    check_id: str
    ok: bool
    detail: str


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _extract_backend_route_constant(text: str, const_name: str) -> str:
    pattern = re.compile(
        rf"export const {re.escape(const_name)}\s*=\s*\"([^\"]+)\"",
        flags=re.MULTILINE,
    )
    match = pattern.search(text)
    if not match:
        raise ValueError(f"missing backend route constant `{const_name}`")
    return match.group(1)


def _extract_client_transport_routes(app_text: str) -> dict[str, str]:
    object_match = re.search(
        r"const firstSliceTransportRoutes = Object\.freeze\(\s*\{(?P<body>.*?)\}\s*\);",
        app_text,
        flags=re.DOTALL,
    )
    if not object_match:
        raise ValueError("missing `firstSliceTransportRoutes` definition in client adapter")

    body = object_match.group("body")
    pairs = re.findall(r"([a-z_]+)\s*:\s*\"([^\"]+)\"", body)
    routes = {key: value for key, value in pairs}
    if len(routes) < 4:
        raise ValueError("client transport route map is incomplete")
    return routes


def _missing_tokens(text: str, tokens: tuple[str, ...]) -> list[str]:
    return [token for token in tokens if token not in text]


def run_smoke(root: Path = ROOT) -> list[SmokeCheckResult]:
    app_js_path = root / "client-web" / "app.js"
    transport_test_path = root / "backend" / "src" / "app" / "transport" / "local-first-slice-settlement-loop-transport.test.ts"

    try:
        app_js = _read_text(app_js_path)
        transport_test = _read_text(transport_test_path)
        client_routes = _extract_client_transport_routes(app_js)
    except (OSError, ValueError) as exc:
        return [
            SmokeCheckResult(
                check_id="smoke_fixture",
                ok=False,
                detail=str(exc),
            ),
        ]

    results: list[SmokeCheckResult] = []

    for binding in ROUTE_BINDINGS:
        route_file = root / binding["backend_route_file"]
        try:
            backend_route_text = _read_text(route_file)
            backend_route = _extract_backend_route_constant(
                backend_route_text,
                binding["backend_const_name"],
            )
        except (OSError, ValueError) as exc:
            results.append(
                SmokeCheckResult(
                    check_id=binding["check_id"],
                    ok=False,
                    detail=str(exc),
                ),
            )
            continue

        client_route = client_routes.get(binding["client_route_key"])
        missing_tokens = _missing_tokens(app_js, binding["required_client_tokens"])
        if client_route is None:
            results.append(
                SmokeCheckResult(
                    check_id=binding["check_id"],
                    ok=False,
                    detail=f"missing client route key `{binding['client_route_key']}`",
                ),
            )
            continue

        if backend_route != client_route:
            results.append(
                SmokeCheckResult(
                    check_id=binding["check_id"],
                    ok=False,
                    detail=(
                        f"route mismatch backend='{backend_route}' client='{client_route}'"
                    ),
                ),
            )
            continue

        if missing_tokens:
            results.append(
                SmokeCheckResult(
                    check_id=binding["check_id"],
                    ok=False,
                    detail=f"missing client action token(s): {', '.join(missing_tokens)}",
                ),
            )
            continue

        results.append(
            SmokeCheckResult(
                check_id=binding["check_id"],
                ok=True,
                detail=f"route='{backend_route}'",
            ),
        )

    insufficient_tokens_transport = (
        'assert.equal(response.body.error_code, "insufficient_resources");',
    )
    insufficient_tokens_client = (
        'insufficient_resources: "event.build.failure_insufficient_resources"',
        'insufficient_resources: "event.train.failure_insufficient_resources"',
        '"event.build.failure_insufficient_resources":',
    )
    insufficient_missing = _missing_tokens(
        transport_test,
        insufficient_tokens_transport,
    ) + _missing_tokens(app_js, insufficient_tokens_client)
    results.append(
        SmokeCheckResult(
            check_id="negative_insufficient_resources",
            ok=not insufficient_missing,
            detail=(
                "backend/client insufficient_resources assertions are wired"
                if not insufficient_missing
                else f"missing token(s): {', '.join(insufficient_missing)}"
            ),
        ),
    )

    unavailable_tokens_transport = (
        'assert.equal(response.body.error_code, "unavailable_tile");',
    )
    unavailable_tokens_client = (
        "event.world.scout_unavailable_tile",
        "event.scout.unavailable_tile",
    )
    unavailable_missing = _missing_tokens(
        transport_test,
        unavailable_tokens_transport,
    ) + _missing_tokens(app_js, unavailable_tokens_client)
    results.append(
        SmokeCheckResult(
            check_id="negative_unavailable_state",
            ok=not unavailable_missing,
            detail=(
                "backend/client unavailable_tile assertions are wired"
                if not unavailable_missing
                else f"missing token(s): {', '.join(unavailable_missing)}"
            ),
        ),
    )

    deterministic_ok = app_js.count('flow_version: "v1"') >= 4
    results.append(
        SmokeCheckResult(
            check_id="deterministic_placeholder_contract",
            ok=deterministic_ok,
            detail=(
                "flow_version v1 placeholder contracts are deterministic across tick/build/train/scout"
                if deterministic_ok
                else 'expected at least four `flow_version: "v1"` contract stubs in client adapter'
            ),
        ),
    )

    return results


def main() -> int:
    results = run_smoke(ROOT)
    pass_count = sum(1 for result in results if result.ok)
    fail_count = len(results) - pass_count
    status = "PASS" if fail_count == 0 else "FAIL"

    for result in results:
        check_status = "PASS" if result.ok else "FAIL"
        print(
            f"RK-M0-0011_SMOKE check={result.check_id} status={check_status} detail={result.detail}"
        )

    print(
        f"RK-M0-0011_SMOKE summary status={status} pass={pass_count} fail={fail_count}"
    )
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
