from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import threading
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
CLIENT_WEB_ROOT = ROOT / "client-web"
RUNTIME_ROOT = ROOT / "coordination" / "runtime" / "web-vertical-slice"
STAGING_ROOT = RUNTIME_ROOT / "staging"
ARTIFACTS_ROOT = RUNTIME_ROOT / "artifacts"
SMOKE_ROOT = RUNTIME_ROOT / "smoke-run"
ARTIFACT_NAME = "redkeepers-web-vertical-slice.zip"
ARTIFACT_PATH = ARTIFACTS_ROOT / ARTIFACT_NAME
ARTIFACT_SHA_PATH = ARTIFACTS_ROOT / f"{ARTIFACT_NAME}.sha256"
METADATA_REL_PATH = Path("release-metadata.placeholder.json")
MANIFEST_REL_PATH = Path("artifact-manifest.json")
ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
REQUIRED_SMOKE_MARKERS = (
    "RedKeepers Client Shell Wireframe",
    "Placeholder Client Shell",
    'id="settlement-panel"',
    'id="worldmap-panel"',
    'id="event-feed-panel"',
)
REQUIRED_ARTIFACT_FILES = (
    Path("index.html"),
    Path("styles.css"),
    Path("app.js"),
    METADATA_REL_PATH,
    MANIFEST_REL_PATH,
)


class _StaticServer:
    def __init__(self, *, host: str, port: int, directory: Path):
        self.host = host
        self.port = port
        self.directory = directory
        self.server_port: int | None = None
        self._httpd: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    def __enter__(self) -> "_StaticServer":
        handler = lambda *args, **kwargs: SimpleHTTPRequestHandler(*args, directory=str(self.directory), **kwargs)
        self._httpd = ThreadingHTTPServer((self.host, self.port), handler)
        self.server_port = int(self._httpd.server_port)
        self._thread = threading.Thread(target=self._httpd.serve_forever, name="web-slice-smoke-httpd", daemon=True)
        self._thread.start()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._httpd is not None:
            self._httpd.shutdown()
            self._httpd.server_close()
        if self._thread is not None:
            self._thread.join(timeout=2)


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    return _sha256_bytes(path.read_bytes())


def _sorted_relative_files(root: Path) -> list[Path]:
    return sorted(
        [path.relative_to(root) for path in root.rglob("*") if path.is_file()],
        key=lambda rel: rel.as_posix(),
    )


def _load_release_metadata(source_root: Path) -> dict[str, Any]:
    metadata_path = source_root / METADATA_REL_PATH
    if not metadata_path.is_file():
        raise ValueError(f"missing placeholder release metadata file: {metadata_path}")

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if metadata.get("art_status") != "placeholder-only":
        raise ValueError("release metadata must set art_status to 'placeholder-only'")

    placeholder_assets = metadata.get("placeholder_assets")
    if not isinstance(placeholder_assets, list) or not placeholder_assets:
        raise ValueError("release metadata must include non-empty placeholder_assets")

    for asset in placeholder_assets:
        asset_path = source_root / Path(str(asset.get("path", "")))
        if not asset_path.is_file():
            raise ValueError(f"placeholder asset reference is missing: {asset_path}")

    return metadata


def _stage_client_web(*, clean: bool) -> tuple[Path, dict[str, Any], list[dict[str, Any]]]:
    if clean and RUNTIME_ROOT.exists():
        shutil.rmtree(RUNTIME_ROOT)

    if not CLIENT_WEB_ROOT.is_dir():
        raise ValueError(f"missing client-web root: {CLIENT_WEB_ROOT}")

    STAGING_ROOT.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_ROOT.mkdir(parents=True, exist_ok=True)

    release_metadata = _load_release_metadata(CLIENT_WEB_ROOT)
    staged_files: list[dict[str, Any]] = []

    for relative_path in _sorted_relative_files(CLIENT_WEB_ROOT):
        source_path = CLIENT_WEB_ROOT / relative_path
        destination_path = STAGING_ROOT / relative_path
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_path, destination_path)
        file_bytes = source_path.read_bytes()
        staged_files.append(
            {
                "path": relative_path.as_posix(),
                "bytes": len(file_bytes),
                "sha256": _sha256_bytes(file_bytes),
            }
        )

    manifest = {
        "schema_version": 1,
        "artifact_id": "redkeepers-web-vertical-slice",
        "source_root": "client-web",
        "deterministic_packaging": {
            "file_order": "lexicographic by relative path",
            "zip_entry_timestamp_utc": "1980-01-01T00:00:00Z",
            "hash_algorithm": "sha256",
        },
        "release_metadata_path": METADATA_REL_PATH.as_posix(),
        "release_metadata": {
            "release_channel": release_metadata.get("release_channel"),
            "title": release_metadata.get("title"),
            "art_status": release_metadata.get("art_status"),
            "placeholder_assets": release_metadata.get("placeholder_assets"),
        },
        "files": staged_files,
    }

    (STAGING_ROOT / MANIFEST_REL_PATH).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )

    return STAGING_ROOT, manifest, staged_files


def _build_deterministic_zip(staging_root: Path, artifact_path: Path) -> None:
    files = _sorted_relative_files(staging_root)

    with zipfile.ZipFile(artifact_path, "w") as archive:
        for relative_path in files:
            source_path = staging_root / relative_path
            zip_info = zipfile.ZipInfo(filename=relative_path.as_posix(), date_time=ZIP_TIMESTAMP)
            zip_info.compress_type = zipfile.ZIP_DEFLATED
            zip_info.external_attr = 0o100644 << 16
            archive.writestr(zip_info, source_path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def _package(args: argparse.Namespace) -> int:
    try:
        staging_root, _manifest, staged_files = _stage_client_web(clean=bool(args.clean))
        _build_deterministic_zip(staging_root, ARTIFACT_PATH)
        artifact_sha = _sha256_file(ARTIFACT_PATH)
        ARTIFACT_SHA_PATH.write_text(f"{artifact_sha}  {ARTIFACT_NAME}\n", encoding="utf-8")
    except ValueError as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    print(
        "STATUS: COMPLETED\n"
        f"Packaged web vertical slice artifact: {ARTIFACT_PATH}\n"
        f"Artifact SHA256: {artifact_sha}\n"
        f"Source files staged: {len(staged_files)}"
    )
    return 0


def _http_get_text(url: str) -> str:
    try:
        with urlopen(url, timeout=5) as response:
            return response.read().decode("utf-8")
    except URLError as exc:
        raise RuntimeError(f"failed HTTP request: {url} ({exc})") from exc


def _smoke(args: argparse.Namespace) -> int:
    if not ARTIFACT_PATH.is_file():
        print(
            "STATUS: BLOCKED\n"
            f"Missing packaged artifact: {ARTIFACT_PATH}\n"
            "Run packaging first: python tools/web_vertical_slice_packaging.py package"
        )
        return 1

    if SMOKE_ROOT.exists():
        shutil.rmtree(SMOKE_ROOT)
    SMOKE_ROOT.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(ARTIFACT_PATH, "r") as archive:
        archive.extractall(SMOKE_ROOT)

    for required_path in REQUIRED_ARTIFACT_FILES:
        if not (SMOKE_ROOT / required_path).is_file():
            print(f"STATUS: BLOCKED\nPackaged artifact missing required file: {required_path.as_posix()}")
            return 1

    metadata = _load_release_metadata(SMOKE_ROOT)
    if metadata.get("art_status") != "placeholder-only":
        print("STATUS: BLOCKED\nPackaged release metadata is not placeholder-only.")
        return 1

    with _StaticServer(host=str(args.host), port=int(args.port), directory=SMOKE_ROOT) as server:
        if server.server_port is None:
            print("STATUS: BLOCKED\nFailed to bind local smoke HTTP server.")
            return 1

        base_url = f"http://{args.host}:{server.server_port}"
        index_html = _http_get_text(f"{base_url}/index.html")
        app_js = _http_get_text(f"{base_url}/app.js")
        metadata_text = _http_get_text(f"{base_url}/{METADATA_REL_PATH.as_posix()}")

        missing_markers = [marker for marker in REQUIRED_SMOKE_MARKERS if marker not in index_html]
        if missing_markers:
            print(
                "STATUS: BLOCKED\n"
                "Smoke marker check failed for packaged index.html:\n"
                + "\n".join([f"- missing marker: {marker}" for marker in missing_markers])
            )
            return 1

        if "document.querySelectorAll(\".region-tab\")" not in app_js:
            print("STATUS: BLOCKED\nSmoke marker check failed for packaged app.js.")
            return 1

        if '"art_status": "placeholder-only"' not in metadata_text:
            print("STATUS: BLOCKED\nSmoke marker check failed for packaged release metadata.")
            return 1

    print(
        "STATUS: COMPLETED\n"
        f"Packaged web artifact smoke passed via local server.\n"
        f"Artifact: {ARTIFACT_PATH}\n"
        f"Smoke root: {SMOKE_ROOT}"
    )
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Deterministic web vertical-slice package builder and local smoke runner."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    package_parser = subparsers.add_parser("package", help="Build deterministic web vertical-slice package artifact.")
    package_parser.add_argument("--clean", action="store_true", help="Delete previous packaging runtime outputs first.")

    smoke_parser = subparsers.add_parser("smoke", help="Run local smoke checks against packaged web artifact.")
    smoke_parser.add_argument("--host", default="127.0.0.1")
    smoke_parser.add_argument(
        "--port",
        type=int,
        default=0,
        help="HTTP server port for smoke run (0 picks an ephemeral free port).",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.command == "package":
        return _package(args)
    if args.command == "smoke":
        return _smoke(args)
    raise ValueError(f"unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
