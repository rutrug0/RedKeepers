from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
WEB_PACKAGE_TOOL = ROOT / "tools" / "web_vertical_slice_packaging.py"
WEB_ARTIFACT_PATH = ROOT / "coordination" / "runtime" / "web-vertical-slice" / "artifacts" / "redkeepers-web-vertical-slice.zip"
WRAPPER_ROOT = ROOT / "client-steam-tauri"
WRAPPER_RUNTIME_ROOT = ROOT / "coordination" / "runtime" / "steam-tauri-wrapper"
WRAPPER_WEB_DIST_ROOT = WRAPPER_RUNTIME_ROOT / "web-dist"
WRAPPER_INPUT_MANIFEST_PATH = WRAPPER_RUNTIME_ROOT / "wrapper-input-manifest.json"
STORE_METADATA_REL_PATH = Path("store-placeholders") / "steam-store-metadata.placeholder.json"
REQUIRED_WEB_DIST_FILES = (
    Path("index.html"),
    Path("styles.css"),
    Path("app.js"),
    Path("release-metadata.placeholder.json"),
    Path("artifact-manifest.json"),
)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _run_checked(command: list[str], cwd: Path) -> None:
    result = subprocess.run(command, cwd=cwd, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(command)}")


def _load_store_metadata() -> dict[str, Any]:
    metadata_path = WRAPPER_ROOT / STORE_METADATA_REL_PATH
    if not metadata_path.is_file():
        raise ValueError(f"missing Steam placeholder metadata: {metadata_path}")

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if metadata.get("art_status") != "placeholder-only":
        raise ValueError("Steam placeholder metadata must set art_status to 'placeholder-only'")

    placeholder_assets = metadata.get("placeholder_assets")
    if not isinstance(placeholder_assets, list) or not placeholder_assets:
        raise ValueError("Steam placeholder metadata must include non-empty placeholder_assets")

    for asset in placeholder_assets:
        asset_path = WRAPPER_ROOT / Path(str(asset.get("path", "")))
        if not asset_path.is_file():
            raise ValueError(f"missing Steam placeholder asset reference: {asset_path}")

    return metadata


def _prepare_web_dist(clean_web: bool) -> tuple[str, int]:
    package_command = [sys.executable, str(WEB_PACKAGE_TOOL), "package"]
    if clean_web:
        package_command.append("--clean")
    _run_checked(package_command, ROOT)

    if not WEB_ARTIFACT_PATH.is_file():
        raise ValueError(f"web vertical-slice artifact missing after packaging: {WEB_ARTIFACT_PATH}")

    if WRAPPER_WEB_DIST_ROOT.exists():
        shutil.rmtree(WRAPPER_WEB_DIST_ROOT)
    WRAPPER_WEB_DIST_ROOT.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(WEB_ARTIFACT_PATH, "r") as archive:
        archive.extractall(WRAPPER_WEB_DIST_ROOT)

    for required_file in REQUIRED_WEB_DIST_FILES:
        if not (WRAPPER_WEB_DIST_ROOT / required_file).is_file():
            raise ValueError(f"prepared wrapper web-dist missing required file: {required_file.as_posix()}")

    extracted_file_count = len([path for path in WRAPPER_WEB_DIST_ROOT.rglob("*") if path.is_file()])
    artifact_sha256 = _sha256_file(WEB_ARTIFACT_PATH)
    manifest = {
        "schema_version": 1,
        "artifact_id": "redkeepers-steam-tauri-wrapper-input",
        "source_web_artifact": {
            "path": str(WEB_ARTIFACT_PATH.relative_to(ROOT).as_posix()),
            "sha256": artifact_sha256,
        },
        "prepared_web_dist_path": str(WRAPPER_WEB_DIST_ROOT.relative_to(ROOT).as_posix()),
        "prepared_file_count": extracted_file_count,
    }
    WRAPPER_RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
    WRAPPER_INPUT_MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    return artifact_sha256, extracted_file_count


def _ensure_npm_available() -> None:
    npm_candidates = ["npm.cmd", "npm.exe", "npm"] if sys.platform.startswith("win") else ["npm"]
    if not any(shutil.which(candidate) for candidate in npm_candidates):
        raise ValueError(
            "npm is not available on PATH; install Node.js to run Tauri dev/build commands."
        )


def _run_tauri(subcommand: str) -> int:
    _ensure_npm_available()
    npm_executable = None
    npm_candidates = ["npm.cmd", "npm.exe", "npm"] if sys.platform.startswith("win") else ["npm"]
    for candidate in npm_candidates:
        npm_executable = shutil.which(candidate)
        if npm_executable:
            break
    if not npm_executable:
        raise ValueError("npm executable was not found on PATH.")

    command = [npm_executable, "exec", "tauri", subcommand, "--", "--config", "src-tauri/tauri.conf.json"]
    try:
        result = subprocess.run(command, cwd=WRAPPER_ROOT, check=False)
    except OSError as exc:
        raise RuntimeError(f"failed to launch Tauri command: {exc}") from exc
    return int(result.returncode)


def _prepare(args: argparse.Namespace) -> int:
    try:
        _load_store_metadata()
        artifact_sha256, extracted_file_count = _prepare_web_dist(clean_web=bool(args.clean_web))
    except (ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    print(
        "STATUS: COMPLETED\n"
        f"Prepared Steam Tauri wrapper web-dist: {WRAPPER_WEB_DIST_ROOT}\n"
        f"Source web artifact: {WEB_ARTIFACT_PATH}\n"
        f"Source artifact SHA256: {artifact_sha256}\n"
        f"Prepared files: {extracted_file_count}"
    )
    return 0


def _dev(args: argparse.Namespace) -> int:
    try:
        if not args.skip_prepare:
            _load_store_metadata()
            _prepare_web_dist(clean_web=bool(args.clean_web))
        returncode = _run_tauri("dev")
    except (ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    if returncode != 0:
        print("STATUS: BLOCKED\nTauri dev command exited non-zero.")
        return returncode

    print("STATUS: COMPLETED\nTauri dev session exited successfully.")
    return 0


def _build(args: argparse.Namespace) -> int:
    try:
        if not args.skip_prepare:
            _load_store_metadata()
            _prepare_web_dist(clean_web=bool(args.clean_web))
        returncode = _run_tauri("build")
    except (ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    if returncode != 0:
        print("STATUS: BLOCKED\nTauri build command exited non-zero.")
        return returncode

    print("STATUS: COMPLETED\nTauri build completed.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare and run the RedKeepers Steam-targeted Tauri wrapper scaffold."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare_parser = subparsers.add_parser("prepare", help="Prepare wrapper web-dist from packaged web artifact.")
    prepare_parser.add_argument(
        "--clean-web",
        action="store_true",
        help="Run web packaging with --clean before extracting for wrapper use.",
    )

    dev_parser = subparsers.add_parser("dev", help="Run local Tauri wrapper session for Steam scaffold.")
    dev_parser.add_argument("--skip-prepare", action="store_true", help="Skip wrapper web-dist preparation step.")
    dev_parser.add_argument(
        "--clean-web",
        action="store_true",
        help="When preparing, run web packaging with --clean first.",
    )

    build_parser = subparsers.add_parser("build", help="Build Windows package via Tauri wrapper scaffold.")
    build_parser.add_argument("--skip-prepare", action="store_true", help="Skip wrapper web-dist preparation step.")
    build_parser.add_argument(
        "--clean-web",
        action="store_true",
        help="When preparing, run web packaging with --clean first.",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.command == "prepare":
        return _prepare(args)
    if args.command == "dev":
        return _dev(args)
    if args.command == "build":
        return _build(args)
    raise ValueError(f"unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
