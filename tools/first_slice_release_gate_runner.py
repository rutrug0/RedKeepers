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
CHECKLIST_FILENAME = "release-readiness-checklist.md"
KNOWN_ISSUES_FILENAME = "known-issues.md"
STATUS_PASS = "PASS"
STATUS_FAIL = "FAIL"
STATUS_NA = "N/A"


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
    GateSpec(
        gate_id="hostile_token_contract",
        command_args=(
            "tools/generate_first_slice_frontend_manifest_snapshot.py",
            "--output",
            "coordination/runtime/first-slice-release-gate/hostile-token-contract-snapshot.js",
        ),
        log_filename="hostile-token-contract-gate.log",
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


def _normalize_status(value: object) -> str:
    token = str(value).strip().upper()
    if token in {STATUS_PASS, STATUS_FAIL, STATUS_NA}:
        return token
    return STATUS_FAIL


def _collect_gate_statuses(gate_results: list[dict[str, object]]) -> dict[str, str]:
    status_by_id: dict[str, str] = {}
    for gate in gate_results:
        gate_id = str(gate.get("gate_id", "")).strip()
        if not gate_id:
            continue
        status_by_id[gate_id] = _normalize_status(gate.get("status", STATUS_FAIL))
    return status_by_id


def _collect_gate_artifact_logs(gate_results: list[dict[str, object]]) -> dict[str, str]:
    logs_by_id: dict[str, str] = {}
    for gate in gate_results:
        gate_id = str(gate.get("gate_id", "")).strip()
        artifact_log = str(gate.get("artifact_log", "")).strip()
        if gate_id and artifact_log:
            logs_by_id[gate_id] = artifact_log
    return logs_by_id


def _derive_release_readiness_status(gate_status_by_id: dict[str, str]) -> str:
    required_ids = {"playable", "quality", "platform", "hostile_token_contract"}
    if required_ids.issubset(gate_status_by_id.keys()):
        return STATUS_PASS
    return STATUS_FAIL


def _build_release_readiness_rows(
    *,
    gate_status_by_id: dict[str, str],
    gate_logs_by_id: dict[str, str],
    evidence_json_rel: str,
    evidence_md_rel: str,
    checklist_rel: str,
    known_issues_rel: str,
) -> list[dict[str, object]]:
    release_readiness_status = _derive_release_readiness_status(gate_status_by_id)
    return [
        {
            "gate_id": "playable",
            "title": "Playable Loop Gate",
            "status": gate_status_by_id.get("playable", STATUS_FAIL),
            "artifacts": [
                evidence_json_rel,
                gate_logs_by_id.get("playable", "missing:playable-gate.log"),
            ],
        },
        {
            "gate_id": "scope",
            "title": "Scope Gate",
            "status": gate_status_by_id.get("hostile_token_contract", STATUS_FAIL),
            "artifacts": [
                evidence_json_rel,
                gate_logs_by_id.get("hostile_token_contract", "missing:hostile-token-contract-gate.log"),
            ],
        },
        {
            "gate_id": "quality",
            "title": "Quality Gate",
            "status": gate_status_by_id.get("quality", STATUS_FAIL),
            "artifacts": [
                evidence_json_rel,
                gate_logs_by_id.get("quality", "missing:quality-gate.log"),
            ],
        },
        {
            "gate_id": "platform",
            "title": "Platform Gate",
            "status": gate_status_by_id.get("platform", STATUS_FAIL),
            "artifacts": [
                evidence_json_rel,
                gate_logs_by_id.get("platform", "missing:platform-gate.log"),
            ],
        },
        {
            "gate_id": "release_readiness",
            "title": "Release Readiness Gate",
            "status": release_readiness_status,
            "artifacts": [
                evidence_md_rel,
                checklist_rel,
                known_issues_rel,
            ],
        },
    ]


def _write_release_readiness_checklist(
    *,
    checklist_path: Path,
    timestamp_utc: str,
    overall_status: str,
    canonical_command: str,
    checklist_rows: list[dict[str, object]],
) -> None:
    lines = [
        "# First-Slice Release Readiness Checklist",
        "",
        f"Timestamp (UTC): {timestamp_utc}",
        f"Overall Gate Runner Status: {overall_status}",
        "",
        "Canonical Reproduction Command:",
        f"- `{canonical_command}`",
        "",
        "| Gate | Status | Artifact References |",
        "| --- | --- | --- |",
    ]
    for row in checklist_rows:
        artifacts = ", ".join(f"`{artifact}`" for artifact in row["artifacts"])
        lines.append(f"| {row['title']} | {row['status']} | {artifacts} |")
    checklist_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _write_known_issues(
    *,
    known_issues_path: Path,
    timestamp_utc: str,
    evidence_json_rel: str,
    checklist_rows: list[dict[str, object]],
) -> None:
    failing_rows = [row for row in checklist_rows if row["status"] == STATUS_FAIL]
    lines = [
        "# First-Slice Known Issues",
        "",
        f"Timestamp (UTC): {timestamp_utc}",
        f"Evidence Source: `{evidence_json_rel}`",
        "",
    ]
    if not failing_rows:
        lines.extend(
            [
                "Mandatory Gate Failures:",
                "- `none`",
            ]
        )
    else:
        lines.extend(
            [
                "| Gate | Severity | Owner | Issue | Artifact Reference |",
                "| --- | --- | --- | --- | --- |",
            ]
        )
        for row in failing_rows:
            first_artifact = str(row["artifacts"][0]) if row["artifacts"] else evidence_json_rel
            lines.append(
                f"| {row['title']} | TBD-SEV | TBD-OWNER | Gate status is FAIL. | `{first_artifact}` |"
            )
    known_issues_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


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
    checklist_path = output_dir / CHECKLIST_FILENAME
    known_issues_path = output_dir / KNOWN_ISSUES_FILENAME
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

    evidence_json_rel = _to_relative_path(evidence_json_path, root)
    evidence_md_rel = _to_relative_path(evidence_md_path, root)
    checklist_rel = _to_relative_path(checklist_path, root)
    known_issues_rel = _to_relative_path(known_issues_path, root)

    checklist_rows = _build_release_readiness_rows(
        gate_status_by_id=_collect_gate_statuses(gate_results),
        gate_logs_by_id=_collect_gate_artifact_logs(gate_results),
        evidence_json_rel=evidence_json_rel,
        evidence_md_rel=evidence_md_rel,
        checklist_rel=checklist_rel,
        known_issues_rel=known_issues_rel,
    )
    _write_release_readiness_checklist(
        checklist_path=checklist_path,
        timestamp_utc=timestamp_utc,
        overall_status=overall_status,
        canonical_command="python tools/first_slice_release_gate_runner.py",
        checklist_rows=checklist_rows,
    )
    _write_known_issues(
        known_issues_path=known_issues_path,
        timestamp_utc=timestamp_utc,
        evidence_json_rel=evidence_json_rel,
        checklist_rows=checklist_rows,
    )
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
