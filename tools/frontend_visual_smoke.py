from __future__ import annotations

import argparse
import json
import os
import shutil
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
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


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bool_env(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


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


def _panel_checks(page: Any) -> list[str]:
    missing: list[str] = []
    for selector in ["#settlement-panel", "#worldmap-panel", "#event-feed-panel"]:
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


def _shell_overflow_value(page: Any) -> int | None:
    value = page.evaluate(
        """() => {
            const shell = document.querySelector(".shell");
            if (!shell) {
                return null;
            }
            return Math.max(0, shell.scrollWidth - shell.clientWidth);
        }"""
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
    run_ts = utc_now_iso()
    report: dict[str, Any] = {
        "generated_at": run_ts,
        "url": args.url,
        "strict": bool(args.strict),
        "max_diff_percent": float(args.max_diff_percent),
        "devices": [],
        "summary": {
            "devices_total": len(requested_devices),
            "devices_ok": 0,
            "devices_failed": 0,
            "devices_diff_exceeded": 0,
            "max_diff_seen": 0.0,
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
                    missing = _panel_checks(page)
                    overflow = _overflow_value(page)
                    shell_overflow = _shell_overflow_value(page)
                    device_result["document_overflow_px"] = overflow
                    device_result["shell_overflow_px"] = shell_overflow
                    if missing:
                        device_result["issues"].extend(missing)
                    if overflow > args.max_overflow_px:
                        device_result["issues"].append(f"horizontal overflow {overflow}px > {args.max_overflow_px}px")
                    if shell_overflow is None:
                        device_result["issues"].append("missing shell container .shell")
                    elif shell_overflow > args.max_overflow_px:
                        device_result["issues"].append(
                            f"shell overflow {shell_overflow}px > {args.max_overflow_px}px"
                        )

                    shot_path = args.output_dir / f"{device_name}.png"
                    page.screenshot(path=str(shot_path), full_page=True)
                    device_result["screenshot_path"] = str(shot_path)

                    baseline_path = args.baseline_dir / f"{device_name}.png"
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

                    device_result["issues"].extend(_collect_accessibility_issues(page))
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
            f"max_diff={summary.get('max_diff_seen', 0)}% report={args.report}"
        )
    else:
        print(f"STATUS: BLOCKED\n{report.get('error', 'Frontend visual smoke encountered issues')} report={args.report}")
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
