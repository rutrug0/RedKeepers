from __future__ import annotations

import subprocess
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_SNAPSHOT_TOOL = ROOT / "tools" / "generate_first_slice_frontend_manifest_snapshot.py"
WRAPPER_SCRIPTS = (
    ("steam_tauri_prepare", "steam-tauri", ROOT / "scripts" / "wrapper_steam_tauri.ps1"),
    ("android_capacitor_prepare", "android-capacitor", ROOT / "scripts" / "wrapper_android_capacitor.ps1"),
)


def _find_powershell() -> str | None:
    candidates = (
        ["powershell.exe", "powershell", "pwsh.exe", "pwsh"]
        if str(ROOT).lower().startswith(("c:\\", "d:\\", "e:\\"))
        else ["pwsh", "pwsh.exe"]
    )
    for candidate in candidates:
        executable = shutil.which(candidate)
        if executable:
            return executable
    return None


def _tail(text: str, limit: int = 400) -> str:
    cleaned = (text or "").strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[-limit:]


def _run_manifest_refresh() -> subprocess.CompletedProcess[str]:
    command = [sys.executable, str(MANIFEST_SNAPSHOT_TOOL)]
    return subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def _run_prepare(powershell_executable: str, script_path: Path) -> subprocess.CompletedProcess[str]:
    command = [
        powershell_executable,
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(script_path),
        "-Mode",
        "prepare",
        "-CleanWeb",
    ]
    with tempfile.TemporaryDirectory(prefix="rk-wrapper-smoke-") as temp_dir:
        return subprocess.run(
            command,
            cwd=temp_dir,
            text=True,
            capture_output=True,
            check=False,
        )


@dataclass(frozen=True)
class StageResult:
    stage_id: str
    status: str
    exit_code: int | None


def _print_stage_result(stage_result: StageResult) -> None:
    exit_code = "n/a" if stage_result.exit_code is None else str(stage_result.exit_code)
    print(
        "PLATFORM_WRAPPER_PREP "
        f"stage={stage_result.stage_id} status={stage_result.status} exit_code={exit_code}"
    )


def main() -> int:
    stage_results: list[StageResult] = []
    failure_exit_code = 1
    failure_detail = ""

    if not MANIFEST_SNAPSHOT_TOOL.is_file():
        stage_results.append(
            StageResult(stage_id="frontend_manifest_snapshot", status="FAIL", exit_code=1)
        )
        failure_detail = f"First-slice manifest snapshot tool not found: {MANIFEST_SNAPSHOT_TOOL}"
    else:
        manifest_result = _run_manifest_refresh()
        if manifest_result.returncode == 0:
            stage_results.append(
                StageResult(stage_id="frontend_manifest_snapshot", status="PASS", exit_code=0)
            )
        else:
            failure_exit_code = (
                int(manifest_result.returncode) if manifest_result.returncode > 0 else 1
            )
            stdout_tail = _tail(manifest_result.stdout)
            stderr_tail = _tail(manifest_result.stderr)
            stage_results.append(
                StageResult(
                    stage_id="frontend_manifest_snapshot",
                    status="FAIL",
                    exit_code=manifest_result.returncode,
                )
            )
            failure_detail = (
                f"Manifest snapshot refresh failed (exit={manifest_result.returncode}).\n"
                f"command={subprocess.list2cmdline([sys.executable, str(MANIFEST_SNAPSHOT_TOOL)])}\n"
                f"stdout_tail={stdout_tail or '<empty>'}\n"
                f"stderr_tail={stderr_tail or '<empty>'}"
            )

    powershell_executable = _find_powershell()
    if not powershell_executable and not failure_detail:
        failure_detail = "PowerShell executable not found on PATH."

    for stage_id, lane_name, script_path in WRAPPER_SCRIPTS:
        if failure_detail:
            stage_results.append(StageResult(stage_id=stage_id, status="SKIP", exit_code=None))
            continue

        if not script_path.is_file():
            stage_results.append(StageResult(stage_id=stage_id, status="FAIL", exit_code=1))
            failure_detail = f"Missing wrapper script for {lane_name}: {script_path}"
            failure_exit_code = 1
            continue

        if not powershell_executable:
            stage_results.append(StageResult(stage_id=stage_id, status="FAIL", exit_code=1))
            failure_detail = "PowerShell executable not found on PATH."
            failure_exit_code = 1
            continue

        result = _run_prepare(powershell_executable, script_path)
        if result.returncode == 0:
            stage_results.append(StageResult(stage_id=stage_id, status="PASS", exit_code=0))
            continue

        stdout_tail = _tail(result.stdout)
        stderr_tail = _tail(result.stderr)
        stage_results.append(
            StageResult(stage_id=stage_id, status="FAIL", exit_code=result.returncode)
        )
        failure_detail = (
            f"Wrapper prepare smoke failed for {lane_name} (exit={result.returncode}).\n"
            f"script={script_path}\n"
            f"stdout_tail={stdout_tail or '<empty>'}\n"
            f"stderr_tail={stderr_tail or '<empty>'}"
        )
        failure_exit_code = int(result.returncode) if result.returncode > 0 else 1

    for stage_result in stage_results:
        _print_stage_result(stage_result)

    if failure_detail:
        print(f"STATUS: BLOCKED\n{failure_detail}")
        return failure_exit_code

    print(
        "STATUS: COMPLETED\n"
        "Wrapper prepare smoke passed for first-slice manifest snapshot + Steam Tauri + Android Capacitor prepare lanes."
    )
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
