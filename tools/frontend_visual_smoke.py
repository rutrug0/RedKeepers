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
                    if missing:
                        device_result["issues"].extend(missing)
                    if overflow > args.max_overflow_px:
                        device_result["issues"].append(f"horizontal overflow {overflow}px > {args.max_overflow_px}px")

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
