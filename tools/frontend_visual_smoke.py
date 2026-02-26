from __future__ import annotations

import argparse
import json
import os
import shutil
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SERVE_ROOT = ROOT / "client-web"
DEFAULT_OUTPUT_DIR = ROOT / "coordination" / "runtime" / "frontend-visual" / "current"
DEFAULT_BASELINE_DIR = ROOT / "coordination" / "runtime" / "frontend-visual" / "baseline"
DEFAULT_REPORT_PATH = ROOT / "coordination" / "runtime" / "frontend-visual" / "report.json"


DEVICE_PROFILES: dict[str, dict[str, Any]] = {
    "desktop-1440": {
        "viewport": {"width": 1440, "height": 900},
        "device_scale_factor": 1,
        "is_mobile": False,
    },
    "tablet-1024": {
        "viewport": {"width": 1024, "height": 1366},
        "device_scale_factor": 2,
        "is_mobile": False,
    },
    "mobile-390": {
        "viewport": {"width": 390, "height": 844},
        "device_scale_factor": 3,
        "is_mobile": True,
        "has_touch": True,
    },
    "mobile-360": {
        "viewport": {"width": 360, "height": 780},
        "device_scale_factor": 3,
        "is_mobile": True,
        "has_touch": True,
    },
}

FIRST_SLICE_ACTION_FEEDBACK_PATHS: tuple[dict[str, str], ...] = (
    {
        "path_id": "build_success_feedback",
        "pre_click_selector": '[data-settlement-outcome-mode="success"]',
        "trigger_selector": '[data-settlement-adapter-action="build"]',
        "expected_content_key": "event.build.success",
    },
    {
        "path_id": "build_failure_feedback",
        "pre_click_selector": '[data-settlement-outcome-mode="failure"]',
        "trigger_selector": '[data-settlement-adapter-action="build"]',
        "expected_content_key": "event.build.failure_insufficient_resources",
    },
    {
        "path_id": "train_success_feedback",
        "pre_click_selector": '[data-settlement-outcome-mode="success"]',
        "trigger_selector": '[data-settlement-adapter-action="train"]',
        "expected_content_key": "event.train.success",
    },
    {
        "path_id": "train_failure_feedback",
        "pre_click_selector": '[data-settlement-outcome-mode="failure"]',
        "trigger_selector": '[data-settlement-adapter-action="train"]',
        "expected_content_key": "event.train.failure_cooldown",
    },
    {
        "path_id": "scout_success_feedback",
        "trigger_selector": '[data-worldmap-adapter-action="scout"]',
        "expected_content_key": "event.scout.dispatched_success",
    },
    {
        "path_id": "scout_failure_feedback",
        "trigger_selector": '[data-worldmap-adapter-action="scout"]',
        "expected_content_key": "event.scout.unavailable_tile",
    },
    {
        "path_id": "hostile_attack_completion_feedback",
        "pre_click_selector": '[data-worldmap-marker-id="marker_hostile_ruin_holdfast"]',
        "trigger_selector": '[data-worldmap-adapter-action="attack"]',
        "expected_content_key": "event.combat.placeholder_skirmish_win",
    },
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bool_env(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _required_action_feedback_paths(surface_id: str) -> list[dict[str, str]]:
    if surface_id != "first-slice-shell":
        return []
    return [dict(path) for path in FIRST_SLICE_ACTION_FEEDBACK_PATHS]


def _compare_png_images_percent(left: Path, right: Path) -> float:
    try:
        from PIL import Image, ImageChops  # type: ignore
    except Exception:
        return 0.0 if left.read_bytes() == right.read_bytes() else 100.0

    with Image.open(left) as lhs, Image.open(right) as rhs:
        lhs_rgba = lhs.convert("RGBA")
        rhs_rgba = rhs.convert("RGBA")
        if lhs_rgba.size != rhs_rgba.size:
            return 100.0
        diff = ImageChops.difference(lhs_rgba, rhs_rgba)
        histogram = diff.histogram()
        if not histogram:
            return 0.0
        total_channels = 4
        pixel_count = lhs_rgba.size[0] * lhs_rgba.size[1] * total_channels
        diff_sum = 0
        for i, value in enumerate(histogram):
            diff_sum += value * (i % 256)
        percent = (diff_sum / (255.0 * pixel_count)) * 100.0
        return max(0.0, min(percent, 100.0))


class _StaticServer:
    def __init__(self, *, host: str, port: int, directory: Path):
        self.host = host
        self.port = port
        self.directory = directory
        self._httpd: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    def __enter__(self) -> "_StaticServer":
        handler = lambda *args, **kwargs: SimpleHTTPRequestHandler(*args, directory=str(self.directory), **kwargs)
        self._httpd = ThreadingHTTPServer((self.host, self.port), handler)
        self._thread = threading.Thread(target=self._httpd.serve_forever, name="frontend-visual-httpd", daemon=True)
        self._thread.start()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._httpd is not None:
            self._httpd.shutdown()
            self._httpd.server_close()
        if self._thread is not None:
            self._thread.join(timeout=2)


def _normalized_url_path(url: str) -> str:
    parsed = urlparse(url)
    path = (parsed.path or "").strip()
    if not path:
        return "/"
    if not path.startswith("/"):
        path = f"/{path}"
    return path.lower()


def _surface_id_from_url(url: str) -> str:
    path = _normalized_url_path(url)
    if path in {"/", "/index.html"}:
        return "first-slice-shell"
    if path.endswith("/hero-wireframes.html"):
        return "hero-wireframes"
    return "generic-page"


def _surface_required_selectors(surface_id: str) -> list[str]:
    if surface_id == "first-slice-shell":
        return ["#settlement-panel", "#worldmap-panel", "#event-feed-panel"]
    if surface_id == "hero-wireframes":
        return [".wireframe-main", ".hero-card-grid", ".modal-wireframe", ".feedback-layout"]
    return []


def _surface_container_selector(surface_id: str) -> str | None:
    if surface_id == "first-slice-shell":
        return ".shell"
    return None


def _surface_baseline_prefix(url: str) -> str:
    surface_id = _surface_id_from_url(url)
    if surface_id == "first-slice-shell":
        return ""
    path = _normalized_url_path(url)
    name = PurePosixPath(path).name or "index.html"
    stem = PurePosixPath(name).stem or "surface"
    safe = "".join(ch if (ch.isalnum() or ch in {"-", "_"}) else "-" for ch in stem.lower())
    safe = safe.strip("-_")
    return safe or "surface"


def _screenshot_path_for_device(output_dir: Path, url: str, device_name: str) -> Path:
    prefix = _surface_baseline_prefix(url)
    if prefix:
        return output_dir / f"{prefix}--{device_name}.png"
    return output_dir / f"{device_name}.png"


def _baseline_path_for_device(baseline_dir: Path, url: str, device_name: str) -> Path:
    prefix = _surface_baseline_prefix(url)
    if prefix:
        return baseline_dir / f"{prefix}--{device_name}.png"
    return baseline_dir / f"{device_name}.png"


def _selector_presence_issues(page: Any, selectors: list[str]) -> list[str]:
    if not selectors:
        return []
    missing: list[str] = []
    for selector in selectors:
        count = page.locator(selector).count()
        if count == 0:
            missing.append(f"missing selector {selector}")
    return missing


def _overflow_value(page: Any) -> int:
    return int(
        page.evaluate(
            "() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)"
        )
    )


def _container_overflow_value(page: Any, selector: str) -> int | None:
    value = page.evaluate(
        """(targetSelector) => {
            const target = document.querySelector(targetSelector);
            if (!target) {
                return null;
            }
            return Math.max(0, target.scrollWidth - target.clientWidth);
        }""",
        selector,
    )
    if value is None:
        return None
    return int(value)


def _parse_px(value: Any) -> float:
    text = str(value or "").strip().lower()
    if text.endswith("px"):
        text = text[:-2]
    try:
        return float(text)
    except Exception:
        return 0.0


def _focus_indicator_visible(style: Any) -> bool:
    if not isinstance(style, dict):
        return False
    outline_style = str(style.get("outlineStyle", "")).strip().lower()
    outline_width = _parse_px(style.get("outlineWidth"))
    outline_visible = outline_style not in {"", "none"} and outline_width > 0.0
    box_shadow = str(style.get("boxShadow", "")).strip().lower()
    box_shadow_visible = bool(box_shadow and box_shadow != "none")
    return outline_visible or box_shadow_visible


def _active_focus_style(page: Any) -> dict[str, Any] | None:
    value = page.evaluate(
        """() => {
            const el = document.activeElement;
            if (!el) {
                return null;
            }
            const style = window.getComputedStyle(el);
            return {
                tagName: el.tagName.toLowerCase(),
                id: el.id || "",
                className: typeof el.className === "string" ? el.className : "",
                outlineStyle: style.outlineStyle,
                outlineWidth: style.outlineWidth,
                boxShadow: style.boxShadow,
            };
        }"""
    )
    if isinstance(value, dict):
        return value
    return None


def _active_matches_selector(page: Any, selector: str) -> bool:
    return bool(
        page.evaluate(
            """(targetSelector) => {
                const el = document.activeElement;
                return Boolean(el && el.matches(targetSelector));
            }""",
            selector,
        )
    )


def _tab_until_focus(page: Any, selector: str, *, max_steps: int = 50) -> bool:
    if _active_matches_selector(page, selector):
        return True
    for _ in range(max_steps):
        page.keyboard.press("Tab")
        if _active_matches_selector(page, selector):
            return True
    return False


def _install_scroll_capture(page: Any) -> None:
    page.evaluate(
        """() => {
            window.__rkScrollCalls = [];
            if (window.__rkScrollCaptureInstalled) {
                return;
            }

            window.__rkScrollCaptureInstalled = true;
            const original = Element.prototype.scrollIntoView;
            Element.prototype.scrollIntoView = function patchedScrollIntoView(options) {
                let behavior = null;
                if (typeof options === "object" && options !== null && "behavior" in options) {
                    behavior = String(options.behavior);
                }

                window.__rkScrollCalls.push({
                    targetId: this.id || "",
                    targetClass: typeof this.className === "string" ? this.className : "",
                    behavior,
                });
                return original.call(this, options);
            };
        }"""
    )


def _collect_accessibility_issues(page: Any) -> list[str]:
    issues: list[str] = []
    region_tab_selector = ".region-tab"
    representative_control_selector = ".ghost-btn, .mock-state-btn"

    if page.locator(region_tab_selector).count() == 0:
        return ["keyboard navigation check failed: no .region-tab controls found"]

    _install_scroll_capture(page)
    prefers_reduce = bool(page.evaluate("() => window.matchMedia('(prefers-reduced-motion: reduce)').matches"))
    if not prefers_reduce:
        issues.append("reduced-motion check failed: prefers-reduced-motion is not active in browser context")

    if not _tab_until_focus(page, region_tab_selector):
        issues.append("keyboard navigation check failed: tab sequence did not reach .region-tab")
        return issues

    tab_focus_style = _active_focus_style(page)
    if not _focus_indicator_visible(tab_focus_style):
        issues.append("focus-visible check failed: .region-tab did not expose a visible focus indicator")

    page.keyboard.press("ArrowRight")
    page.keyboard.press("Enter")

    worldmap_selected = bool(
        page.evaluate(
            """() => {
                const tab = document.querySelector('.region-tab[data-target="worldmap-panel"]');
                return Boolean(tab && tab.getAttribute("aria-selected") === "true");
            }"""
        )
    )
    if not worldmap_selected:
        issues.append("keyboard navigation check failed: ArrowRight+Enter did not activate world map region tab")

    scroll_calls = page.evaluate("() => window.__rkScrollCalls || []")
    if not isinstance(scroll_calls, list):
        scroll_calls = []

    worldmap_calls = [
        call
        for call in scroll_calls
        if isinstance(call, dict) and str(call.get("targetId", "")) == "worldmap-panel"
    ]
    if not worldmap_calls:
        issues.append("reduced-motion check failed: worldmap-panel activation did not invoke scrollIntoView")
    elif any(str(call.get("behavior", "")).lower() == "smooth" for call in worldmap_calls):
        issues.append("reduced-motion check failed: worldmap-panel activation requested smooth scrolling")

    if not _tab_until_focus(page, representative_control_selector):
        issues.append(
            "keyboard navigation check failed: tab sequence did not reach representative panel controls "
            "(.ghost-btn/.mock-state-btn)"
        )
        return issues

    control_focus_style = _active_focus_style(page)
    if not _focus_indicator_visible(control_focus_style):
        issues.append(
            "focus-visible check failed: representative panel control did not expose a visible focus indicator"
        )

    return issues


def _collect_basic_accessibility_issues(page: Any) -> list[str]:
    issues: list[str] = []
    interactive_selector = "a[href], button, select, textarea, input:not([type='hidden'])"
    if page.locator(interactive_selector).count() == 0:
        return ["keyboard navigation check failed: no interactive controls found"]

    if not _tab_until_focus(page, interactive_selector):
        issues.append("keyboard navigation check failed: tab sequence did not reach an interactive control")
        return issues

    focus_style = _active_focus_style(page)
    if not _focus_indicator_visible(focus_style):
        issues.append("focus-visible check failed: interactive control did not expose a visible focus indicator")
    return issues


def _set_mock_panel_mode(page: Any, panel_key: str, mode: str) -> str | None:
    selector = f'[data-mock-panel="{panel_key}"][data-mock-mode="{mode}"]'
    control = page.locator(selector)
    if control.count() == 0:
        return f"missing mock panel mode control {selector}"
    try:
        control.first.click()
    except Exception as exc:
        return f"failed to activate mock panel mode {selector}: {exc}"
    return None


def _click_selector(page: Any, selector: str) -> str | None:
    target = page.locator(selector)
    if target.count() == 0:
        return f"missing action selector {selector}"
    button = target.first
    if not button.is_enabled():
        return f"action selector disabled {selector}"
    try:
        button.click()
    except Exception as exc:
        return f"click failed for selector {selector}: {exc}"
    return None


def _install_first_slice_transport_bridge(page: Any) -> None:
    page.evaluate(
        """() => {
            const resourceIds = ["food", "wood", "stone", "iron"];
            const cloneResources = (values) => {
                const out = {};
                for (const resourceId of resourceIds) {
                    out[resourceId] = Number(values && values[resourceId]) || 0;
                }
                return out;
            };
            const hasResources = (stock, required) => {
                return resourceIds.every((resourceId) => {
                    const available = Number(stock[resourceId]) || 0;
                    const needed = Number(required[resourceId]) || 0;
                    return available >= needed;
                });
            };
            const spendResources = (stock, required) => {
                const after = cloneResources(stock);
                for (const resourceId of resourceIds) {
                    const needed = Number(required[resourceId]) || 0;
                    after[resourceId] = Math.max(0, (Number(after[resourceId]) || 0) - needed);
                }
                return after;
            };
            const formatMissingResources = (required, stock) => {
                const rows = [];
                for (const resourceId of resourceIds) {
                    const needed = Number(required[resourceId]) || 0;
                    if (needed <= 0) {
                        continue;
                    }
                    const available = Number(stock[resourceId]) || 0;
                    if (available >= needed) {
                        continue;
                    }
                    rows.push(`${resourceId}: ${needed - available}`);
                }
                return rows.join(", ");
            };
            const nowIso = () => new Date().toISOString();

            const bridgeState = {
                build_cost_by_id: { food: 0, wood: 120, stone: 80, iron: 20 },
                train_cost_by_id: { food: 90, wood: 30, stone: 15, iron: 0 },
                scout_calls: 0,
                hostile_dispatch_calls: 0,
                canonical_stock_by_id: { food: 1860, wood: 1240, stone: 980, iron: 715 },
            };

            window.__RK_FIRST_SLICE_SETTLEMENT_LOOP_TRANSPORT__ = {
                invoke: async (routeTemplate, request) => {
                    const path = String(routeTemplate || "");
                    const body = request && typeof request === "object" ? request.body || {} : {};

                    if (path === "/settlements/{settlementId}/tick") {
                        const base = cloneResources(body.resource_stock_by_id || bridgeState.canonical_stock_by_id);
                        const gainById = { food: 6, wood: 4, stone: 3, iron: 2 };
                        const next = cloneResources(base);
                        for (const resourceId of resourceIds) {
                            next[resourceId] = (Number(next[resourceId]) || 0) + (Number(gainById[resourceId]) || 0);
                        }
                        return {
                            status_code: 200,
                            body: {
                                status: "accepted",
                                settlement_name: body.settlement_name || "Cinderwatch Hold",
                                duration_ms: 60000,
                                resource_stock_by_id: next,
                                placeholder_events: [
                                    {
                                        payload: {
                                            event_key: "event.tick.passive_gain_success",
                                            settlement_name: body.settlement_name || "Cinderwatch Hold",
                                            duration_ms: 60000,
                                        },
                                    },
                                ],
                            },
                        };
                    }

                    if (path === "/settlements/{settlementId}/buildings/{buildingId}/upgrade") {
                        const stock = cloneResources(body.resource_stock_by_id || bridgeState.canonical_stock_by_id);
                        const cost = cloneResources(bridgeState.build_cost_by_id);
                        if (!hasResources(stock, cost)) {
                            return {
                                status_code: 200,
                                body: {
                                    status: "failed",
                                    error_code: "insufficient_resources",
                                    settlement_name: body.settlement_name || "Cinderwatch Hold",
                                    building_id: body.building_id || "grain_plot",
                                    required_cost_by_id: cost,
                                    available_stock_by_id: cloneResources(bridgeState.canonical_stock_by_id),
                                    missing_resources_by_id: formatMissingResources(cost, stock),
                                },
                            };
                        }

                        const fromLevel = Math.max(0, Number(body.current_level) || 0);
                        const toLevel = fromLevel + 1;
                        const after = spendResources(stock, cost);
                        bridgeState.canonical_stock_by_id = cloneResources(after);
                        return {
                            status_code: 200,
                            body: {
                                status: "accepted",
                                settlement_name: body.settlement_name || "Cinderwatch Hold",
                                building_id: body.building_id || "grain_plot",
                                building_label: "Grain Plot",
                                from_level: fromLevel,
                                to_level: toLevel,
                                upgrade_duration_s: 300,
                                resource_cost_by_id: cost,
                                resource_stock_after_by_id: after,
                                placeholder_events: [
                                    {
                                        payload: {
                                            event_key: "event.build.success",
                                            settlement_name: body.settlement_name || "Cinderwatch Hold",
                                            building_label: "Grain Plot",
                                            from_level: fromLevel,
                                            to_level: toLevel,
                                        },
                                    },
                                ],
                            },
                        };
                    }

                    if (path === "/settlements/{settlementId}/units/{unitId}/train") {
                        const stock = cloneResources(body.resource_stock_by_id || bridgeState.canonical_stock_by_id);
                        const cost = cloneResources(bridgeState.train_cost_by_id);
                        if (typeof body.queue_available_at === "string" && body.queue_available_at.trim().length > 0) {
                            return {
                                status_code: 200,
                                body: {
                                    status: "failed",
                                    error_code: "cooldown",
                                    settlement_name: body.settlement_name || "Cinderwatch Hold",
                                    unit_id: body.unit_id || "watch_levy",
                                    queue_available_at: body.queue_available_at,
                                    cooldown_remaining_ms: 90000,
                                },
                            };
                        }
                        if (!hasResources(stock, cost)) {
                            return {
                                status_code: 200,
                                body: {
                                    status: "failed",
                                    error_code: "insufficient_resources",
                                    settlement_name: body.settlement_name || "Cinderwatch Hold",
                                    unit_id: body.unit_id || "watch_levy",
                                    required_cost_by_id: cost,
                                    available_stock_by_id: cloneResources(bridgeState.canonical_stock_by_id),
                                    missing_resources_by_id: formatMissingResources(cost, stock),
                                },
                            };
                        }
                        const after = spendResources(stock, cost);
                        bridgeState.canonical_stock_by_id = cloneResources(after);
                        return {
                            status_code: 200,
                            body: {
                                status: "accepted",
                                settlement_name: body.settlement_name || "Cinderwatch Hold",
                                unit_id: body.unit_id || "watch_levy",
                                unit_label: "Watch Levy",
                                quantity: Math.max(1, Number(body.quantity) || 1),
                                resource_cost_by_id: cost,
                                resource_stock_after_by_id: after,
                                placeholder_events: [
                                    {
                                        payload: {
                                            event_key: "event.train.success",
                                            settlement_name: body.settlement_name || "Cinderwatch Hold",
                                            quantity: Math.max(1, Number(body.quantity) || 1),
                                            unit_label: "Watch Levy",
                                        },
                                    },
                                ],
                            },
                        };
                    }

                    if (path === "/world-map/tiles/{tileId}/interact") {
                        const tileId = typeof body.tile_id === "string" && body.tile_id.trim().length > 0
                            ? body.tile_id.trim()
                            : "tile_0412_0198";
                        const tileLabel = tileId === "tile_0412_0198" ? "Black Reed March" : tileId;
                        bridgeState.scout_calls += 1;
                        if (bridgeState.scout_calls === 1) {
                            return {
                                status_code: 200,
                                body: {
                                    status: "accepted",
                                    tile_id: tileId,
                                    event: {
                                        content_key: "event.scout.dispatched_success",
                                        tokens: {
                                            settlement_name: body.settlement_name || "Cinderwatch Hold",
                                            target_tile_label: tileLabel,
                                        },
                                    },
                                },
                            };
                        }
                        return {
                            status_code: 200,
                            body: {
                                status: "failed",
                                error_code: "unavailable_tile",
                                tile_id: tileId,
                                event: {
                                    content_key: "event.scout.unavailable_tile",
                                    tokens: {
                                        settlement_name: body.settlement_name || "Cinderwatch Hold",
                                        target_tile_label: tileLabel,
                                    },
                                },
                                queue_available_at: nowIso(),
                            },
                        };
                    }

                    if (path === "/world-map/settlements/{targetSettlementId}/attack") {
                        bridgeState.hostile_dispatch_calls += 1;
                        const eventOccurredAt = nowIso();
                        const targetTileLabel = typeof body.target_tile_label === "string" && body.target_tile_label.trim().length > 0
                            ? body.target_tile_label.trim()
                            : "Ruin Holdfast";
                        const sourceSettlementName = typeof body.source_settlement_name === "string" && body.source_settlement_name.trim().length > 0
                            ? body.source_settlement_name.trim()
                            : "Cinderwatch Hold";
                        const armyName = typeof body.army_name === "string" && body.army_name.trim().length > 0
                            ? body.army_name.trim()
                            : "Cinderwatch Vanguard";
                        const marchId = typeof body.march_id === "string" && body.march_id.trim().length > 0
                            ? body.march_id.trim()
                            : `march_attack_${String(bridgeState.hostile_dispatch_calls).padStart(4, "0")}`;
                        return {
                            status_code: 200,
                            body: {
                                status: "accepted",
                                flow: "world_map.hostile_attack_v1",
                                march_id: marchId,
                                combat_outcome: "attacker_win",
                                attacker_strength: 50,
                                defender_strength: 40,
                                losses: {
                                    attacker_units_lost: 2,
                                    defender_garrison_lost: 11,
                                },
                                event_payloads: {
                                    dispatch_sent: {
                                        payload_key: "dispatch_sent",
                                        content_key: "event.world.hostile_dispatch_accepted",
                                        tokens: {
                                            army_name: armyName,
                                            origin_settlement_name: sourceSettlementName,
                                            target_tile_label: targetTileLabel,
                                        },
                                        occurred_at: eventOccurredAt,
                                    },
                                    march_arrived: {
                                        payload_key: "march_arrived",
                                        content_key: "event.world.hostile_post_battle_returned",
                                        tokens: {
                                            army_name: armyName,
                                            settlement_name: sourceSettlementName,
                                            haul_summary: "captured provisions and iron",
                                        },
                                        occurred_at: eventOccurredAt,
                                    },
                                    combat_resolved: {
                                        payload_key: "combat_resolved",
                                        content_key: "event.combat.placeholder_skirmish_attacker_win",
                                        tokens: {
                                            army_name: armyName,
                                            target_tile_label: targetTileLabel,
                                            settlement_name: sourceSettlementName,
                                        },
                                        occurred_at: eventOccurredAt,
                                    },
                                },
                            },
                        };
                    }

                    if (path === "/world-map/marches/{marchId}/snapshot") {
                        const marchId = typeof body.march_id === "string" && body.march_id.trim().length > 0
                            ? body.march_id.trim()
                            : "march_attack_0000";
                        return {
                            status_code: 200,
                            body: {
                                status: "ok",
                                march_id: marchId,
                                phase: "returned",
                                eta_seconds: 0,
                                distance_tiles: 0,
                                observed_at: typeof body.observed_at === "string" && body.observed_at.trim().length > 0
                                    ? body.observed_at.trim()
                                    : nowIso(),
                            },
                        };
                    }

                    return {
                        status_code: 500,
                        body: {
                            code: "transport_handler_error",
                            message: `Unhandled route template '${path}'.`,
                        },
                    };
                },
            };
        }"""
    )


def _run_action_feedback_path(
    page: Any,
    *,
    path_id: str,
    trigger_selector: str,
    expected_content_key: str,
    timeout_ms: int = 7000,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "path_id": path_id,
        "trigger_selector": trigger_selector,
        "expected_content_key": expected_content_key,
        "status": "ok",
        "before_count": None,
        "after_count": None,
        "issue": None,
    }

    trigger = page.locator(trigger_selector)
    if trigger.count() == 0:
        result["status"] = "failed"
        result["issue"] = f"missing action selector {trigger_selector}"
        return result

    button = trigger.first
    if not button.is_enabled():
        result["status"] = "failed"
        result["issue"] = f"action selector disabled {trigger_selector}"
        return result

    event_selector = f'.event-item[data-content-key="{expected_content_key}"]'
    before_count = page.locator(event_selector).count()
    result["before_count"] = before_count

    try:
        button.click()
        page.wait_for_function(
            """([contentKey, baselineCount]) => {
                const selector = `.event-item[data-content-key="${contentKey}"]`;
                return document.querySelectorAll(selector).length > baselineCount;
            }""",
            [expected_content_key, before_count],
            timeout=timeout_ms,
        )
    except Exception as exc:
        result["status"] = "failed"
        result["issue"] = f"no new feedback entry for {expected_content_key}: {exc}"
    result["after_count"] = page.locator(event_selector).count()
    return result


def _collect_first_slice_action_feedback_issues(page: Any) -> tuple[list[str], list[dict[str, Any]]]:
    paths = _required_action_feedback_paths("first-slice-shell")
    if not paths:
        return [], []

    issues: list[str] = []
    setup_issues = [
        issue
        for issue in [
            _set_mock_panel_mode(page, "settlement", "populated"),
            _set_mock_panel_mode(page, "worldMap", "populated"),
            _set_mock_panel_mode(page, "eventFeed", "populated"),
        ]
        if issue
    ]
    if setup_issues:
        failed_checks = [
            {
                "path_id": path["path_id"],
                "trigger_selector": path["trigger_selector"],
                "expected_content_key": path["expected_content_key"],
                "status": "failed",
                "before_count": None,
                "after_count": None,
                "issue": setup_issues[0],
            }
            for path in paths
        ]
        return setup_issues, failed_checks

    _install_first_slice_transport_bridge(page)
    checks: list[dict[str, Any]] = []

    for path in paths:
        pre_click_selector = path.get("pre_click_selector")
        if pre_click_selector:
            pre_click_issue = _click_selector(page, pre_click_selector)
            if pre_click_issue:
                check = {
                    "path_id": path["path_id"],
                    "trigger_selector": path["trigger_selector"],
                    "expected_content_key": path["expected_content_key"],
                    "status": "failed",
                    "before_count": None,
                    "after_count": None,
                    "issue": pre_click_issue,
                }
                checks.append(check)
                issues.append(f"action feedback path `{path['path_id']}` failed: {pre_click_issue}")
                continue

        result = _run_action_feedback_path(
            page,
            path_id=path["path_id"],
            trigger_selector=path["trigger_selector"],
            expected_content_key=path["expected_content_key"],
        )
        checks.append(result)
        if result.get("status") != "ok":
            issues.append(
                f"action feedback path `{path['path_id']}` failed: {result.get('issue') or 'unknown error'}"
            )

    return issues, checks


def run_visual_smoke(args: argparse.Namespace) -> tuple[int, dict[str, Any]]:
    requested_devices = [name.strip() for name in args.devices.split(",") if name.strip()]
    unknown = [name for name in requested_devices if name not in DEVICE_PROFILES]
    if unknown:
        return 2, {"status": "error", "error": f"unknown device profiles: {unknown}"}

    url = args.url
    parsed = urlparse(url)
    if not parsed.scheme:
        return 2, {"status": "error", "error": f"invalid --url: {url!r}"}

    try:
        from playwright.sync_api import sync_playwright  # type: ignore
    except Exception as exc:
        reason = f"playwright import failed: {exc}"
        return (1 if args.strict else 0), {"status": "blocked", "error": reason}

    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.baseline_dir.mkdir(parents=True, exist_ok=True)
    surface_id = _surface_id_from_url(args.url)
    required_selectors = _surface_required_selectors(surface_id)
    container_selector = _surface_container_selector(surface_id)
    run_ts = utc_now_iso()
    report: dict[str, Any] = {
        "generated_at": run_ts,
        "url": args.url,
        "surface": surface_id,
        "strict": bool(args.strict),
        "max_diff_percent": float(args.max_diff_percent),
        "devices": [],
        "summary": {
            "devices_total": len(requested_devices),
            "devices_ok": 0,
            "devices_failed": 0,
            "devices_diff_exceeded": 0,
            "max_diff_seen": 0.0,
            "action_feedback_paths_total": 0,
            "action_feedback_paths_ok": 0,
            "action_feedback_paths_failed": 0,
        },
    }

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            for device_name in requested_devices:
                profile = DEVICE_PROFILES[device_name]
                device_result: dict[str, Any] = {
                    "device": device_name,
                    "viewport": profile.get("viewport"),
                    "status": "ok",
                    "issues": [],
                    "screenshot_path": None,
                    "baseline_path": None,
                    "diff_percent": None,
                    "document_overflow_px": None,
                    "shell_overflow_px": None,
                    "action_feedback_checks": [],
                    "action_feedback_paths_total": 0,
                    "action_feedback_paths_ok": 0,
                    "action_feedback_paths_failed": 0,
                }
                context = browser.new_context(
                    viewport=profile.get("viewport"),
                    device_scale_factor=profile.get("device_scale_factor", 1),
                    is_mobile=profile.get("is_mobile", False),
                    has_touch=profile.get("has_touch", False),
                    reduced_motion="reduce",
                    color_scheme="dark",
                )
                page = context.new_page()
                try:
                    page.goto(args.url, wait_until="networkidle", timeout=30000)
                    missing = _selector_presence_issues(page, required_selectors)
                    overflow = _overflow_value(page)
                    shell_overflow = _container_overflow_value(page, container_selector) if container_selector else None
                    device_result["document_overflow_px"] = overflow
                    device_result["shell_overflow_px"] = shell_overflow
                    if missing:
                        device_result["issues"].extend(missing)
                    if overflow > args.max_overflow_px:
                        device_result["issues"].append(f"horizontal overflow {overflow}px > {args.max_overflow_px}px")
                    if container_selector and shell_overflow is None:
                        device_result["issues"].append(f"missing container {container_selector}")
                    elif container_selector and shell_overflow > args.max_overflow_px:
                        device_result["issues"].append(
                            f"shell overflow {shell_overflow}px > {args.max_overflow_px}px"
                        )

                    shot_path = _screenshot_path_for_device(args.output_dir, args.url, device_name)
                    page.screenshot(path=str(shot_path), full_page=True)
                    device_result["screenshot_path"] = str(shot_path)

                    baseline_path = _baseline_path_for_device(args.baseline_dir, args.url, device_name)
                    device_result["baseline_path"] = str(baseline_path)
                    if args.update_baseline:
                        shutil.copyfile(shot_path, baseline_path)
                    elif baseline_path.exists():
                        diff_percent = _compare_png_images_percent(baseline_path, shot_path)
                        device_result["diff_percent"] = round(diff_percent, 4)
                        report["summary"]["max_diff_seen"] = max(float(report["summary"]["max_diff_seen"]), diff_percent)
                        if diff_percent > float(args.max_diff_percent):
                            device_result["issues"].append(
                                f"visual diff {diff_percent:.3f}% > threshold {float(args.max_diff_percent):.3f}%"
                            )
                            report["summary"]["devices_diff_exceeded"] = int(
                                report["summary"]["devices_diff_exceeded"]
                            ) + 1
                    else:
                        device_result["issues"].append("baseline screenshot missing")

                    if surface_id == "first-slice-shell":
                        device_result["issues"].extend(_collect_accessibility_issues(page))
                        action_paths = _required_action_feedback_paths(surface_id)
                        action_issues, action_checks = _collect_first_slice_action_feedback_issues(page)
                        action_ok = sum(1 for check in action_checks if check.get("status") == "ok")
                        action_failed = len(action_checks) - action_ok
                        device_result["action_feedback_checks"] = action_checks
                        device_result["action_feedback_paths_total"] = len(action_paths)
                        device_result["action_feedback_paths_ok"] = action_ok
                        device_result["action_feedback_paths_failed"] = action_failed
                        report["summary"]["action_feedback_paths_total"] = int(
                            report["summary"]["action_feedback_paths_total"]
                        ) + len(action_paths)
                        report["summary"]["action_feedback_paths_ok"] = int(
                            report["summary"]["action_feedback_paths_ok"]
                        ) + action_ok
                        report["summary"]["action_feedback_paths_failed"] = int(
                            report["summary"]["action_feedback_paths_failed"]
                        ) + action_failed
                        device_result["issues"].extend(action_issues)
                    else:
                        device_result["issues"].extend(_collect_basic_accessibility_issues(page))
                finally:
                    context.close()

                if device_result["issues"]:
                    device_result["status"] = "failed"
                    report["summary"]["devices_failed"] = int(report["summary"]["devices_failed"]) + 1
                else:
                    report["summary"]["devices_ok"] = int(report["summary"]["devices_ok"]) + 1
                report["devices"].append(device_result)
            browser.close()
    except Exception as exc:
        return (1 if args.strict else 0), {"status": "blocked", "error": f"browser launch/run failed: {exc}"}

    has_failures = int(report["summary"]["devices_failed"]) > 0
    rc = 1 if (args.strict and has_failures) else 0
    report["status"] = "failed" if has_failures else "ok"
    return rc, report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Frontend visual smoke checks with multi-device screenshots.")
    parser.add_argument("--url", default="http://127.0.0.1:4173/index.html")
    parser.add_argument("--serve-root", type=Path, default=DEFAULT_SERVE_ROOT)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    parser.add_argument("--no-serve", action="store_true", help="Do not start local static HTTP server.")
    parser.add_argument("--devices", default="desktop-1440,tablet-1024,mobile-390,mobile-360")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--baseline-dir", type=Path, default=DEFAULT_BASELINE_DIR)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT_PATH)
    parser.add_argument("--update-baseline", action="store_true", help="Update baseline images from current run.")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero on failures/missing baseline/dependency.")
    parser.add_argument("--max-overflow-px", type=int, default=0)
    parser.add_argument("--max-diff-percent", type=float, default=0.5)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if _bool_env("REDKEEPERS_FRONTEND_VISUAL_QA_STRICT"):
        args.strict = True

    server_ctx = None
    if not args.no_serve:
        if not args.serve_root.exists():
            print(f"STATUS: BLOCKED\nMissing serve root: {args.serve_root}")
            return 1 if args.strict else 0
        server_ctx = _StaticServer(host=args.host, port=args.port, directory=args.serve_root)

    if server_ctx is None:
        rc, report = run_visual_smoke(args)
    else:
        with server_ctx:
            rc, report = run_visual_smoke(args)

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    status = report.get("status", "unknown")
    if status == "ok":
        summary = report.get("summary", {})
        print(
            "STATUS: COMPLETED\n"
            f"Frontend visual smoke passed: ok={summary.get('devices_ok', 0)}/{summary.get('devices_total', 0)} "
            f"max_diff={summary.get('max_diff_seen', 0)}% "
            f"action_paths={summary.get('action_feedback_paths_ok', 0)}/"
            f"{summary.get('action_feedback_paths_total', 0)} report={args.report}"
        )
    else:
        print(f"STATUS: BLOCKED\n{report.get('error', 'Frontend visual smoke encountered issues')} report={args.report}")
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
