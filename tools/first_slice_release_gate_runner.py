from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = Path("coordination/runtime/first-slice-release-gate")


@dataclass(frozen=True)
class GateSpec:
    gate_id: str
    command_args: tuple[str, ...]
    log_filename: str


GATE_SPECS: tuple[GateSpec, ...] = (
    GateSpec(
        gate_id="playable",
        command_args=("tools/rk_m0_0011_first_slice_loop_smoke.py",),
        log_filename="playable-gate.log",
    ),
    GateSpec(
        gate_id="quality",
        command_args=("tools/orchestrator.py", "status"),
        log_filename="quality-gate.log",
    ),
    GateSpec(
        gate_id="platform",
        command_args=("tools/platform_wrapper_prepare_smoke.py",),
        log_filename="platform-gate.log",
    ),
)


def _timestamp_utc() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _format_command(command: list[str]) -> str:
    return subprocess.list2cmdline(command)


def _last_non_empty_line(text: str) -> str:
    for line in reversed((text or "").splitlines()):
        cleaned = line.strip()
        if cleaned:
            return cleaned
    return ""


def _derive_summary(process: subprocess.CompletedProcess[str]) -> str:
    summary = _last_non_empty_line(process.stdout)
    if summary:
        return summary
    summary = _last_non_empty_line(process.stderr)
    if summary:
        return summary
    return f"Command completed with exit code {process.returncode}"


def _to_relative_path(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def _write_gate_log(
    *,
    log_path: Path,
    command_str: str,
    process: subprocess.CompletedProcess[str],
) -> None:
    lines = [
        f"command: {command_str}",
        f"exit_code: {process.returncode}",
        "",
        "stdout:",
        process.stdout.rstrip(),
        "",
        "stderr:",
        process.stderr.rstrip(),
        "",
    ]
    log_path.write_text("\n".join(lines), encoding="utf-8")


def run_release_gate(
    *,
    root: Path,
    output_dir: Path,
) -> tuple[int, dict[str, object], Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp_utc = _timestamp_utc()
    gate_results: list[dict[str, object]] = []
    executed_commands: list[dict[str, object]] = []

    for order, gate in enumerate(GATE_SPECS, start=1):
        command = [sys.executable, *gate.command_args]
        process = subprocess.run(
            command,
            cwd=root,
            text=True,
            capture_output=True,
            check=False,
        )
        command_str = _format_command(command)
        log_path = output_dir / gate.log_filename
        _write_gate_log(log_path=log_path, command_str=command_str, process=process)

        status = "PASS" if process.returncode == 0 else "FAIL"
        summary = _derive_summary(process)

        gate_results.append(
            {
                "gate_id": gate.gate_id,
                "status": status,
                "exit_code": process.returncode,
                "command": command_str,
                "summary": summary,
                "artifact_log": _to_relative_path(log_path, root),
            }
        )
        executed_commands.append(
            {
                "order": order,
                "gate_id": gate.gate_id,
                "command": command_str,
            }
        )

    overall_status = "PASS" if all(gate["status"] == "PASS" for gate in gate_results) else "FAIL"
    exit_code = 0 if overall_status == "PASS" else 1

    evidence_json_path = output_dir / "release-gate-evidence.json"
    evidence_md_path = output_dir / "release-gate-evidence.md"
    evidence_payload: dict[str, object] = {
        "timestamp_utc": timestamp_utc,
        "overall_status": overall_status,
        "executed_commands": executed_commands,
        "gates": gate_results,
    }
    evidence_json_path.write_text(
        json.dumps(evidence_payload, indent=2) + "\n",
        encoding="utf-8",
    )

    markdown_lines = [
        "# First-Slice Release Gate Evidence",
        "",
        f"Timestamp (UTC): {timestamp_utc}",
        f"Overall Status: {overall_status}",
        "",
        "## Executed Commands",
    ]
    for command in executed_commands:
        markdown_lines.append(
            f"- [{command['order']}] `{command['gate_id']}`: `{command['command']}`"
        )

    markdown_lines.extend(["", "## Gate Results"])
    for gate in gate_results:
        markdown_lines.append(
            f"- `{gate['gate_id']}`: {gate['status']} (exit={gate['exit_code']})"
        )
        markdown_lines.append(f"  - summary: `{gate['summary']}`")
        markdown_lines.append(f"  - artifact_log: `{gate['artifact_log']}`")

    evidence_md_path.write_text("\n".join(markdown_lines) + "\n", encoding="utf-8")
    return exit_code, evidence_payload, evidence_json_path, evidence_md_path


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Run deterministic first-slice release gates and emit compact PASS/FAIL evidence artifacts."
        )
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Output directory for gate logs and evidence artifacts.",
    )
    args = parser.parse_args()
    output_dir = args.output_dir if args.output_dir.is_absolute() else ROOT / args.output_dir

    exit_code, evidence_payload, evidence_json_path, evidence_md_path = run_release_gate(
        root=ROOT,
        output_dir=output_dir,
    )

    for gate in evidence_payload["gates"]:
        print(
            "FIRST_SLICE_RELEASE_GATE "
            f"gate={gate['gate_id']} status={gate['status']} exit_code={gate['exit_code']} summary={gate['summary']}"
        )

    print(
        "FIRST_SLICE_RELEASE_GATE "
        f"summary status={evidence_payload['overall_status']} "
        f"evidence_json={_to_relative_path(evidence_json_path, ROOT)} "
        f"evidence_md={_to_relative_path(evidence_md_path, ROOT)}"
    )
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
