from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WRAPPER_SCRIPTS = (
    ("steam-tauri", ROOT / "scripts" / "wrapper_steam_tauri.ps1"),
    ("android-capacitor", ROOT / "scripts" / "wrapper_android_capacitor.ps1"),
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


def main() -> int:
    powershell_executable = _find_powershell()
    if not powershell_executable:
        print("STATUS: BLOCKED\nPowerShell executable not found on PATH.")
        return 1

    for lane_name, script_path in WRAPPER_SCRIPTS:
        if not script_path.is_file():
            print(f"STATUS: BLOCKED\nMissing wrapper script for {lane_name}: {script_path}")
            return 1

        result = _run_prepare(powershell_executable, script_path)
        if result.returncode != 0:
            stdout_tail = _tail(result.stdout)
            stderr_tail = _tail(result.stderr)
            detail = (
                f"Wrapper prepare smoke failed for {lane_name} (exit={result.returncode}).\n"
                f"script={script_path}\n"
                f"stdout_tail={stdout_tail or '<empty>'}\n"
                f"stderr_tail={stderr_tail or '<empty>'}"
            )
            print(f"STATUS: BLOCKED\n{detail}")
            return int(result.returncode) if result.returncode > 0 else 1

    print(
        "STATUS: COMPLETED\n"
        "Wrapper prepare smoke passed for Steam Tauri and Android Capacitor entry scripts."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
