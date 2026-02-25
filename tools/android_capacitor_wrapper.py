from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
WEB_PACKAGE_TOOL = ROOT / "tools" / "web_vertical_slice_packaging.py"
WEB_ARTIFACT_PATH = ROOT / "coordination" / "runtime" / "web-vertical-slice" / "artifacts" / "redkeepers-web-vertical-slice.zip"
WRAPPER_ROOT = ROOT / "client-android-capacitor"
WRAPPER_RUNTIME_ROOT = ROOT / "coordination" / "runtime" / "android-capacitor-wrapper"
WRAPPER_WEB_DIST_ROOT = WRAPPER_RUNTIME_ROOT / "web-dist"
WRAPPER_WEB_WWW_ROOT = WRAPPER_ROOT / "www"
WRAPPER_INPUT_MANIFEST_PATH = WRAPPER_RUNTIME_ROOT / "wrapper-input-manifest.json"
STORE_METADATA_REL_PATH = Path("store-placeholders") / "android-store-metadata.placeholder.json"
OVERRIDES_ROOT = WRAPPER_ROOT / "wrapper-overrides"
SAFE_AREA_OVERRIDE_FILE = OVERRIDES_ROOT / "safe-area-baseline.css"
BACK_BUTTON_OVERRIDE_FILE = OVERRIDES_ROOT / "back-button-baseline.js"
ANDROID_PROJECT_ROOT = WRAPPER_ROOT / "android"
ANDROID_MANIFEST_PATH = ANDROID_PROJECT_ROOT / "app" / "src" / "main" / "AndroidManifest.xml"
REQUIRED_WEB_DIST_FILES = (
    Path("index.html"),
    Path("styles.css"),
    Path("app.js"),
    Path("release-metadata.placeholder.json"),
    Path("artifact-manifest.json"),
)

SAFE_AREA_LINK_TAG = (
    '<link rel="stylesheet" href="./wrapper-baseline/safe-area-baseline.css" '
    'data-wrapper="android-capacitor-baseline">'
)
BACK_BUTTON_SCRIPT_TAG = (
    '<script src="./wrapper-baseline/back-button-baseline.js" '
    'data-wrapper="android-capacitor-baseline" defer></script>'
)

BRIDGE_ACTIVITY_PATTERN = re.compile(
    r'(<activity\b[^>]*android:name="com.getcapacitor.BridgeActivity"[^>]*)(>)',
    flags=re.MULTILINE,
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


def _run(command: list[str], cwd: Path) -> int:
    try:
        result = subprocess.run(command, cwd=cwd, check=False)
    except OSError as exc:
        raise RuntimeError(f"failed to launch command: {exc}") from exc
    return int(result.returncode)


def _load_store_metadata() -> dict[str, Any]:
    metadata_path = WRAPPER_ROOT / STORE_METADATA_REL_PATH
    if not metadata_path.is_file():
        raise ValueError(f"missing Android placeholder metadata: {metadata_path}")

    metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig"))
    if metadata.get("art_status") != "placeholder-only":
        raise ValueError("Android placeholder metadata must set art_status to 'placeholder-only'")

    placeholder_assets = metadata.get("placeholder_assets")
    if not isinstance(placeholder_assets, list) or not placeholder_assets:
        raise ValueError("Android placeholder metadata must include non-empty placeholder_assets")

    for asset in placeholder_assets:
        asset_path = WRAPPER_ROOT / Path(str(asset.get("path", "")))
        if not asset_path.is_file():
            raise ValueError(f"missing Android placeholder asset reference: {asset_path}")

    return metadata


def _inject_wrapper_baselines(index_path: Path) -> None:
    html = index_path.read_text(encoding="utf-8")
    updated = html

    if SAFE_AREA_LINK_TAG not in updated:
        if "</head>" not in updated:
            raise ValueError("prepared web index is missing </head> for safe-area baseline injection")
        updated = updated.replace("</head>", f"  {SAFE_AREA_LINK_TAG}\n</head>", 1)

    if BACK_BUTTON_SCRIPT_TAG not in updated:
        if "</body>" not in updated:
            raise ValueError("prepared web index is missing </body> for back-button baseline injection")
        updated = updated.replace("</body>", f"  {BACK_BUTTON_SCRIPT_TAG}\n</body>", 1)

    if updated != html:
        index_path.write_text(updated, encoding="utf-8")


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

    baseline_root = WRAPPER_WEB_DIST_ROOT / "wrapper-baseline"
    baseline_root.mkdir(parents=True, exist_ok=True)
    if not SAFE_AREA_OVERRIDE_FILE.is_file():
        raise ValueError(f"missing safe-area baseline override file: {SAFE_AREA_OVERRIDE_FILE}")
    if not BACK_BUTTON_OVERRIDE_FILE.is_file():
        raise ValueError(f"missing back-button baseline override file: {BACK_BUTTON_OVERRIDE_FILE}")

    shutil.copyfile(SAFE_AREA_OVERRIDE_FILE, baseline_root / SAFE_AREA_OVERRIDE_FILE.name)
    shutil.copyfile(BACK_BUTTON_OVERRIDE_FILE, baseline_root / BACK_BUTTON_OVERRIDE_FILE.name)

    _inject_wrapper_baselines(WRAPPER_WEB_DIST_ROOT / "index.html")

    if WRAPPER_WEB_WWW_ROOT.exists():
        shutil.rmtree(WRAPPER_WEB_WWW_ROOT)
    shutil.copytree(WRAPPER_WEB_DIST_ROOT, WRAPPER_WEB_WWW_ROOT)

    prepared_file_count = len([path for path in WRAPPER_WEB_DIST_ROOT.rglob("*") if path.is_file()])
    artifact_sha256 = _sha256_file(WEB_ARTIFACT_PATH)
    manifest = {
        "schema_version": 1,
        "artifact_id": "redkeepers-android-capacitor-wrapper-input",
        "source_web_artifact": {
            "path": str(WEB_ARTIFACT_PATH.relative_to(ROOT).as_posix()),
            "sha256": artifact_sha256,
        },
        "prepared_web_dist_path": str(WRAPPER_WEB_DIST_ROOT.relative_to(ROOT).as_posix()),
        "wrapper_web_dir_path": str(WRAPPER_WEB_WWW_ROOT.relative_to(ROOT).as_posix()),
        "prepared_file_count": prepared_file_count,
        "baseline_overrides": [
            "wrapper-baseline/safe-area-baseline.css",
            "wrapper-baseline/back-button-baseline.js",
        ],
    }
    WRAPPER_RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
    WRAPPER_INPUT_MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    return artifact_sha256, prepared_file_count


def _find_capacitor_cli() -> str:
    candidates = (
        [
            WRAPPER_ROOT / "node_modules" / ".bin" / "cap.cmd",
            WRAPPER_ROOT / "node_modules" / ".bin" / "cap.exe",
            WRAPPER_ROOT / "node_modules" / ".bin" / "cap",
        ]
        if sys.platform.startswith("win")
        else [WRAPPER_ROOT / "node_modules" / ".bin" / "cap"]
    )
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    raise ValueError(
        "Capacitor CLI is not installed for wrapper project; run `npm install` in client-android-capacitor."
    )


def _run_capacitor(subcommand: str, *extra_args: str) -> int:
    capacitor_cli = _find_capacitor_cli()
    command = [capacitor_cli, subcommand, *extra_args]
    return _run(command, WRAPPER_ROOT)


def _ensure_android_project_exists() -> None:
    gradlew_name = "gradlew.bat" if sys.platform.startswith("win") else "gradlew"
    if ANDROID_MANIFEST_PATH.is_file() and (ANDROID_PROJECT_ROOT / gradlew_name).is_file():
        return

    returncode = _run_capacitor("add", "android")
    if returncode != 0 and not (
        ANDROID_MANIFEST_PATH.is_file() and (ANDROID_PROJECT_ROOT / gradlew_name).is_file()
    ):
        raise RuntimeError(
            "failed to scaffold Capacitor Android project with `cap add android`; "
            "run `npm install` in client-android-capacitor and retry"
        )
    if not (ANDROID_MANIFEST_PATH.is_file() and (ANDROID_PROJECT_ROOT / gradlew_name).is_file()):
        raise RuntimeError("Capacitor reported success but Android project directory is missing.")


def _ensure_android_manifest_baseline() -> None:
    if not ANDROID_MANIFEST_PATH.is_file():
        raise ValueError(f"missing Android manifest: {ANDROID_MANIFEST_PATH}")

    manifest_text = ANDROID_MANIFEST_PATH.read_text(encoding="utf-8")
    match = BRIDGE_ACTIVITY_PATTERN.search(manifest_text)
    if not match:
        raise ValueError("Android manifest does not contain Capacitor BridgeActivity entry.")

    activity_open_tag = match.group(1)
    updated_open_tag = activity_open_tag

    if 'android:screenOrientation=' not in updated_open_tag:
        updated_open_tag += ' android:screenOrientation="portrait"'

    if 'android:configChanges=' not in updated_open_tag:
        updated_open_tag += (
            ' android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|'
            'smallestScreenSize|screenLayout|uiMode"'
        )

    if updated_open_tag != activity_open_tag:
        manifest_text = manifest_text.replace(activity_open_tag, updated_open_tag, 1)
        ANDROID_MANIFEST_PATH.write_text(manifest_text, encoding="utf-8")


def _run_gradle(task: str) -> int:
    gradlew_name = "gradlew.bat" if sys.platform.startswith("win") else "gradlew"
    gradlew_path = ANDROID_PROJECT_ROOT / gradlew_name
    if not gradlew_path.is_file():
        raise ValueError(f"missing Android Gradle wrapper script: {gradlew_path}")
    return _run([str(gradlew_path), task], ANDROID_PROJECT_ROOT)


def _prepare(args: argparse.Namespace) -> int:
    try:
        _load_store_metadata()
        artifact_sha256, prepared_file_count = _prepare_web_dist(clean_web=bool(args.clean_web))
    except (ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    print(
        "STATUS: COMPLETED\n"
        f"Prepared Android Capacitor wrapper web-dist: {WRAPPER_WEB_DIST_ROOT}\n"
        f"Synced wrapper web dir: {WRAPPER_WEB_WWW_ROOT}\n"
        f"Source web artifact: {WEB_ARTIFACT_PATH}\n"
        f"Source artifact SHA256: {artifact_sha256}\n"
        f"Prepared files: {prepared_file_count}"
    )
    return 0


def _sync(args: argparse.Namespace) -> int:
    try:
        _load_store_metadata()
        if not args.skip_prepare:
            _prepare_web_dist(clean_web=bool(args.clean_web))
        _ensure_android_project_exists()
        returncode = _run_capacitor("sync", "android")
        if returncode != 0:
            print("STATUS: BLOCKED\nCapacitor sync command exited non-zero.")
            return returncode
        _ensure_android_manifest_baseline()
    except (ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    print(
        "STATUS: COMPLETED\n"
        "Capacitor Android sync completed with baseline wrapper config applied."
    )
    return 0


def _dev(args: argparse.Namespace) -> int:
    try:
        _load_store_metadata()
        if not args.skip_sync:
            if not args.skip_prepare:
                _prepare_web_dist(clean_web=bool(args.clean_web))
            _ensure_android_project_exists()
            sync_returncode = _run_capacitor("sync", "android")
            if sync_returncode != 0:
                print("STATUS: BLOCKED\nCapacitor sync command exited non-zero.")
                return sync_returncode
            _ensure_android_manifest_baseline()
        returncode = _run_capacitor("open", "android")
    except (ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    if returncode != 0:
        print("STATUS: BLOCKED\nCapacitor open android command exited non-zero.")
        return returncode

    print("STATUS: COMPLETED\nOpened Android project in configured IDE.")
    return 0


def _build(args: argparse.Namespace, *, release: bool) -> int:
    gradle_task = "assembleRelease" if release else "assembleDebug"
    try:
        _load_store_metadata()
        if not args.skip_sync:
            if not args.skip_prepare:
                _prepare_web_dist(clean_web=bool(args.clean_web))
            _ensure_android_project_exists()
            sync_returncode = _run_capacitor("sync", "android")
            if sync_returncode != 0:
                print("STATUS: BLOCKED\nCapacitor sync command exited non-zero.")
                return sync_returncode
            _ensure_android_manifest_baseline()

        build_returncode = _run_gradle(gradle_task)
    except (ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    if build_returncode != 0:
        print(f"STATUS: BLOCKED\nAndroid Gradle task `{gradle_task}` exited non-zero.")
        return build_returncode

    print(f"STATUS: COMPLETED\nAndroid Gradle task `{gradle_task}` completed.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare and run the RedKeepers Android Capacitor wrapper scaffold."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare_parser = subparsers.add_parser("prepare", help="Prepare wrapper web assets from packaged web artifact.")
    prepare_parser.add_argument(
        "--clean-web",
        action="store_true",
        help="Run web packaging with --clean before preparing wrapper web assets.",
    )

    sync_parser = subparsers.add_parser("sync", help="Sync prepared wrapper web assets into Capacitor Android project.")
    sync_parser.add_argument("--skip-prepare", action="store_true", help="Skip wrapper web-dist preparation step.")
    sync_parser.add_argument(
        "--clean-web",
        action="store_true",
        help="When preparing, run web packaging with --clean first.",
    )

    dev_parser = subparsers.add_parser("dev", help="Sync Android project and open it in configured IDE.")
    dev_parser.add_argument("--skip-sync", action="store_true", help="Skip `cap sync android` before opening IDE.")
    dev_parser.add_argument(
        "--skip-prepare",
        action="store_true",
        help="When syncing, skip wrapper web-dist preparation step.",
    )
    dev_parser.add_argument(
        "--clean-web",
        action="store_true",
        help="When preparing, run web packaging with --clean first.",
    )

    debug_parser = subparsers.add_parser("build-debug", help="Build Android debug APK via Gradle wrapper.")
    debug_parser.add_argument("--skip-sync", action="store_true", help="Skip `cap sync android` before Gradle build.")
    debug_parser.add_argument(
        "--skip-prepare",
        action="store_true",
        help="When syncing, skip wrapper web-dist preparation step.",
    )
    debug_parser.add_argument(
        "--clean-web",
        action="store_true",
        help="When preparing, run web packaging with --clean first.",
    )

    release_parser = subparsers.add_parser("build-release", help="Build Android release APK via Gradle wrapper.")
    release_parser.add_argument("--skip-sync", action="store_true", help="Skip `cap sync android` before Gradle build.")
    release_parser.add_argument(
        "--skip-prepare",
        action="store_true",
        help="When syncing, skip wrapper web-dist preparation step.",
    )
    release_parser.add_argument(
        "--clean-web",
        action="store_true",
        help="When preparing, run web packaging with --clean first.",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.command == "prepare":
        return _prepare(args)
    if args.command == "sync":
        return _sync(args)
    if args.command == "dev":
        return _dev(args)
    if args.command == "build-debug":
        return _build(args, release=False)
    if args.command == "build-release":
        return _build(args, release=True)
    raise ValueError(f"unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
