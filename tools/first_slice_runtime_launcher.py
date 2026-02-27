from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from dataclasses import dataclass
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CLIENT_WEB_DIR = ROOT / "client-web"
PLAYABLE_MANIFEST_PATH = ROOT / "backend" / "src" / "app" / "config" / "seeds" / "v1" / "first-slice-playable-manifest.json"
MANIFEST_SNAPSHOT_TOOL = ROOT / "tools" / "generate_first_slice_frontend_manifest_snapshot.py"
BACKEND_HOST_ENTRYPOINT = (
    ROOT / "backend" / "src" / "app" / "transport" / "first-slice-settlement-loop-http-host.ts"
)
PROXY_PATH_PREFIXES = ("/settlements/", "/world-map/")
DEFAULT_BACKEND_HOST = "127.0.0.1"
DEFAULT_BACKEND_PORT = 8787
DEFAULT_WEB_HOST = "127.0.0.1"
DEFAULT_WEB_PORT = 8000
DEFAULT_STARTUP_TIMEOUT_SECONDS = 15


@dataclass(frozen=True)
class RuntimeDefaults:
    session_entry_settlement_id: str
    hostile_target_settlement_id: str
    world_id: str


class _FirstSliceWebShellProxyHandler(SimpleHTTPRequestHandler):
    def __init__(
        self,
        *args: object,
        directory: str,
        backend_base_url: str,
        **kwargs: object,
    ) -> None:
        self._backend_base_url = backend_base_url.rstrip("/")
        super().__init__(*args, directory=directory, **kwargs)

    def do_OPTIONS(self) -> None:
        if not self._should_proxy():
            self.send_error(404, "No proxied route for this path.")
            return
        self.send_response(204)
        self.send_header("cache-control", "no-store")
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-methods", "POST, OPTIONS")
        self.send_header("access-control-allow-headers", "content-type")
        self.end_headers()

    def do_POST(self) -> None:
        if not self._should_proxy():
            self.send_error(404, "No proxied route for this path.")
            return
        self._proxy_post_request()

    def _should_proxy(self) -> bool:
        normalized_path = self.path if isinstance(self.path, str) else ""
        return any(normalized_path.startswith(prefix) for prefix in PROXY_PATH_PREFIXES)

    def _proxy_post_request(self) -> None:
        content_length_raw = self.headers.get("content-length", "0")
        try:
            content_length = max(0, int(content_length_raw))
        except ValueError:
            content_length = 0
        request_body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        target_url = f"{self._backend_base_url}{self.path}"

        headers = {
            "content-type": self.headers.get("content-type", "application/json"),
        }
        proxy_request = Request(target_url, data=request_body, headers=headers, method="POST")

        try:
            with urlopen(proxy_request, timeout=5) as response:
                response_body = response.read()
                self.send_response(response.status)
                self.send_header("content-type", response.headers.get("content-type", "application/json"))
                self.send_header("cache-control", "no-store")
                self.end_headers()
                self.wfile.write(response_body)
                return
        except HTTPError as exc:
            response_body = exc.read()
            self.send_response(exc.code)
            self.send_header("content-type", exc.headers.get("content-type", "application/json"))
            self.send_header("cache-control", "no-store")
            self.end_headers()
            self.wfile.write(response_body)
            return
        except URLError as exc:
            payload = json.dumps(
                {
                    "code": "transport_unreachable",
                    "message": f"Backend transport is unreachable: {exc.reason}",
                }
            ).encode("utf-8")
            self.send_response(503)
            self.send_header("content-type", "application/json; charset=utf-8")
            self.send_header("cache-control", "no-store")
            self.end_headers()
            self.wfile.write(payload)

    def log_message(self, format: str, *args: object) -> None:
        return


class _WebShellProxyServer:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        directory: Path,
        backend_base_url: str,
    ) -> None:
        self.host = host
        self.port = port
        self.directory = directory
        self.backend_base_url = backend_base_url
        self.server_port: int | None = None
        self._httpd: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        handler = lambda *args, **kwargs: _FirstSliceWebShellProxyHandler(
            *args,
            directory=str(self.directory),
            backend_base_url=self.backend_base_url,
            **kwargs,
        )
        self._httpd = ThreadingHTTPServer((self.host, self.port), handler)
        self.server_port = int(self._httpd.server_port)
        self._thread = threading.Thread(
            target=self._httpd.serve_forever,
            name="rk-first-slice-web-shell",
            daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        if self._httpd is not None:
            self._httpd.shutdown()
            self._httpd.server_close()
            self._httpd = None
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None

    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()


def _load_runtime_defaults() -> RuntimeDefaults:
    if not PLAYABLE_MANIFEST_PATH.is_file():
        raise ValueError(f"Missing first-slice playable manifest: {PLAYABLE_MANIFEST_PATH}")

    manifest = json.loads(PLAYABLE_MANIFEST_PATH.read_text(encoding="utf-8"))
    frontend_defaults = manifest.get("default_consumption_contract", {}).get("frontend", {})
    map_fixture_ids = manifest.get("canonical_playable_now", {}).get("map_fixture_ids", {})

    session_entry_settlement_id = str(
        frontend_defaults.get("default_session_entry_settlement_id", "")
    ).strip()
    hostile_target_settlement_id = str(
        frontend_defaults.get("default_hostile_target_settlement_id", "")
    ).strip()
    world_id = str(map_fixture_ids.get("world_id", "")).strip()

    if not session_entry_settlement_id:
        raise ValueError(
            "Missing deterministic default settlement identifier in first-slice playable manifest."
        )
    if not hostile_target_settlement_id:
        raise ValueError(
            "Missing deterministic default hostile target settlement identifier in first-slice playable manifest."
        )
    if not world_id:
        raise ValueError("Missing deterministic default world identifier in first-slice playable manifest.")

    return RuntimeDefaults(
        session_entry_settlement_id=session_entry_settlement_id,
        hostile_target_settlement_id=hostile_target_settlement_id,
        world_id=world_id,
    )


def _run_manifest_snapshot_refresh() -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(MANIFEST_SNAPSHOT_TOOL)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def _probe_backend_transport(*, base_url: str, settlement_id: str) -> bool:
    request_payload = {
        "settlement_id": settlement_id,
        "flow_version": "v1",
        "tick_started_at": "2026-02-27T00:00:00.000Z",
        "tick_ended_at": "2026-02-27T00:01:00.000Z",
        "resource_stock_by_id": {
            "food": 100,
            "wood": 100,
            "stone": 100,
            "iron": 100,
        },
        "passive_prod_per_h_by_id": {
            "food": 60,
            "wood": 60,
            "stone": 60,
            "iron": 60,
        },
        "storage_cap_by_id": {
            "food": 1000,
            "wood": 1000,
            "stone": 1000,
            "iron": 1000,
        },
    }
    payload_bytes = json.dumps(request_payload).encode("utf-8")
    request = Request(
        f"{base_url}/settlements/{settlement_id}/tick",
        data=payload_bytes,
        headers={"content-type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=2) as response:
            return response.status == 200
    except Exception:
        return False


def _probe_web_shell(*, shell_url: str) -> bool:
    try:
        with urlopen(f"{shell_url}/index.html", timeout=2) as response:
            return response.status == 200
    except Exception:
        return False


def _wait_for_backend_startup(
    *,
    process: subprocess.Popen[bytes] | subprocess.Popen[str],
    base_url: str,
    settlement_id: str,
    timeout_seconds: int,
) -> tuple[bool, int]:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        return_code = process.poll()
        if return_code is not None:
            return False, return_code
        if _probe_backend_transport(base_url=base_url, settlement_id=settlement_id):
            return True, 0
        time.sleep(0.25)
    timeout_return_code = process.poll()
    return False, timeout_return_code if timeout_return_code is not None else 1


def _wait_for_web_shell_startup(*, shell_url: str, timeout_seconds: int) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if _probe_web_shell(shell_url=shell_url):
            return True
        time.sleep(0.25)
    return False


def _terminate_backend(process: subprocess.Popen[bytes] | subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def _validate_port(value: int, *, label: str) -> int:
    normalized = int(value)
    if normalized < 0 or normalized > 65535:
        raise ValueError(f"{label} must be between 0 and 65535.")
    return normalized


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Launch deterministic first-slice local runtime lanes: backend transport host + web shell proxy."
        )
    )
    parser.add_argument("--backend-host", default=DEFAULT_BACKEND_HOST)
    parser.add_argument("--backend-port", type=int, default=DEFAULT_BACKEND_PORT)
    parser.add_argument("--web-host", default=DEFAULT_WEB_HOST)
    parser.add_argument("--web-port", type=int, default=DEFAULT_WEB_PORT)
    parser.add_argument(
        "--startup-timeout-seconds",
        type=int,
        default=DEFAULT_STARTUP_TIMEOUT_SECONDS,
        help="Timeout for each lane startup probe.",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open the browser automatically after startup.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not CLIENT_WEB_DIR.is_dir():
        print(f"STATUS: BLOCKED\nMissing client-web directory: {CLIENT_WEB_DIR}")
        return 1
    if not (CLIENT_WEB_DIR / "index.html").is_file():
        print(f"STATUS: BLOCKED\nMissing client shell entrypoint: {CLIENT_WEB_DIR / 'index.html'}")
        return 1
    if not MANIFEST_SNAPSHOT_TOOL.is_file():
        print(f"STATUS: BLOCKED\nMissing manifest snapshot tool: {MANIFEST_SNAPSHOT_TOOL}")
        return 1
    if not BACKEND_HOST_ENTRYPOINT.is_file():
        print(f"STATUS: BLOCKED\nMissing backend host entrypoint: {BACKEND_HOST_ENTRYPOINT}")
        return 1

    node_executable = shutil.which("node")
    if not node_executable:
        print("STATUS: BLOCKED\nNode.js executable `node` was not found on PATH.")
        return 1

    try:
        backend_port = _validate_port(args.backend_port, label="--backend-port")
        web_port = _validate_port(args.web_port, label="--web-port")
    except ValueError as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    if int(args.startup_timeout_seconds) < 1:
        print("STATUS: BLOCKED\n--startup-timeout-seconds must be >= 1.")
        return 1

    try:
        defaults = _load_runtime_defaults()
    except ValueError as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    manifest_refresh = _run_manifest_snapshot_refresh()
    if manifest_refresh.returncode != 0:
        stdout_tail = (manifest_refresh.stdout or "").strip()[-500:]
        stderr_tail = (manifest_refresh.stderr or "").strip()[-500:]
        print(
            "STATUS: BLOCKED\n"
            "Failed to refresh first-slice frontend manifest snapshot before runtime launch.\n"
            f"command={sys.executable} {MANIFEST_SNAPSHOT_TOOL}\n"
            f"stdout_tail={stdout_tail or '<empty>'}\n"
            f"stderr_tail={stderr_tail or '<empty>'}"
        )
        return int(manifest_refresh.returncode) if manifest_refresh.returncode > 0 else 1

    backend_base_url = f"http://{args.backend_host}:{backend_port}"
    backend_command = [
        node_executable,
        str(BACKEND_HOST_ENTRYPOINT),
        "--host",
        str(args.backend_host),
        "--port",
        str(backend_port),
    ]
    try:
        backend_process = subprocess.Popen(
            backend_command,
            cwd=ROOT,
        )
    except OSError as exc:
        print(
            "STATUS: BLOCKED\n"
            "Backend transport host lane failed to launch.\n"
            f"command={subprocess.list2cmdline(backend_command)}\n"
            f"error={exc}"
        )
        return 1

    backend_ready, backend_return_code = _wait_for_backend_startup(
        process=backend_process,
        base_url=backend_base_url,
        settlement_id=defaults.session_entry_settlement_id,
        timeout_seconds=int(args.startup_timeout_seconds),
    )
    if not backend_ready:
        _terminate_backend(backend_process)
        print(
            "STATUS: BLOCKED\n"
            "Backend transport host lane failed to start.\n"
            f"lane=backend base_url={backend_base_url} exit_code={backend_return_code}"
        )
        return backend_return_code if backend_return_code > 0 else 1

    web_shell_server = _WebShellProxyServer(
        host=str(args.web_host),
        port=web_port,
        directory=CLIENT_WEB_DIR,
        backend_base_url=backend_base_url,
    )
    try:
        web_shell_server.start()
    except OSError as exc:
        _terminate_backend(backend_process)
        print(
            "STATUS: BLOCKED\n"
            "Client web shell lane failed to bind.\n"
            f"lane=web_shell host={args.web_host} port={web_port} error={exc}"
        )
        return 1

    shell_port = web_shell_server.server_port
    if shell_port is None:
        web_shell_server.stop()
        _terminate_backend(backend_process)
        print("STATUS: BLOCKED\nClient web shell lane did not expose a bound port.")
        return 1
    shell_url = f"http://{args.web_host}:{shell_port}"

    if not _wait_for_web_shell_startup(
        shell_url=shell_url,
        timeout_seconds=int(args.startup_timeout_seconds),
    ):
        web_shell_server.stop()
        _terminate_backend(backend_process)
        print(
            "STATUS: BLOCKED\n"
            "Client web shell lane failed to start.\n"
            f"lane=web_shell base_url={shell_url}"
        )
        return 1

    print(f"FIRST_SLICE_RUNTIME lane=backend status=PASS base_url={backend_base_url}")
    print(f"FIRST_SLICE_RUNTIME lane=web_shell status=PASS base_url={shell_url}")
    print(
        "FIRST_SLICE_RUNTIME defaults "
        f"session_settlement_id={defaults.session_entry_settlement_id} "
        f"hostile_target_settlement_id={defaults.hostile_target_settlement_id} "
        f"world_id={defaults.world_id}"
    )
    print(f"FIRST_SLICE_RUNTIME url={shell_url}/index.html")
    print("FIRST_SLICE_RUNTIME status=RUNNING stop=Ctrl+C")

    if not args.no_browser:
        webbrowser.open(f"{shell_url}/index.html")

    runtime_exit_code = 0
    try:
        while True:
            backend_return_code = backend_process.poll()
            if backend_return_code is not None:
                print(
                    "STATUS: BLOCKED\n"
                    "Backend transport host lane exited while runtime launcher was active.\n"
                    f"lane=backend exit_code={backend_return_code}"
                )
                runtime_exit_code = backend_return_code if backend_return_code > 0 else 1
                break
            if not web_shell_server.is_running():
                print(
                    "STATUS: BLOCKED\n"
                    "Client web shell lane stopped while runtime launcher was active.\n"
                    "lane=web_shell"
                )
                runtime_exit_code = 1
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        runtime_exit_code = 0
    finally:
        web_shell_server.stop()
        _terminate_backend(backend_process)

    return runtime_exit_code


if __name__ == "__main__":
    raise SystemExit(main())
