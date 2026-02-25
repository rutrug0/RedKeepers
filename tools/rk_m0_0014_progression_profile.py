from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Optional


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SEED_PROFILE_PATH = (
    ROOT
    / "tests"
    / "fixtures"
    / "rk-m0-0014-progression-profile.json"
)
DEFAULT_REPLAY_PROFILE_PATH = (
    ROOT
    / "coordination"
    / "runtime"
    / "first-slice-progression"
    / "rk-m0-0014-progression-profile.replay.json"
)
DEFAULT_SOURCE_PROFILE_PATHS = (
    DEFAULT_REPLAY_PROFILE_PATH,
    DEFAULT_SEED_PROFILE_PATH,
)
DEFAULT_OUTPUT_PROFILE_PATH = (
    ROOT
    / "coordination"
    / "runtime"
    / "first-slice-progression"
    / "rk-m0-0014-progression-profile.json"
)
REQUIRED_TOP_LEVEL_KEYS = (
    "settlement_snapshots",
    "event_scout_snapshots",
)


def _resolve_repo_relative_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return ROOT / path


def _is_profile_payload(data: dict[str, Any]) -> bool:
    for key in REQUIRED_TOP_LEVEL_KEYS:
        if key not in data:
            return False
        if not isinstance(data[key], list):
            return False
    return True


def _extract_profile_payload(data: Any, source_path: Path) -> dict[str, Any]:
    if isinstance(data, dict) and _is_profile_payload(data):
        return data

    if not isinstance(data, dict):
        raise ValueError(f"seed source must be a JSON object: {source_path}")

    for key in ("profile", "payload", "seed_profile", "replay", "replay_payload", "result", "data"):
        nested = data.get(key)
        if isinstance(nested, dict) and _is_profile_payload(nested):
            return nested

    raise ValueError(f"seed source is not a progression profile payload: {source_path}")


def _resolve_seed_profile_path(raw_path: Optional[str]) -> Path:
    if raw_path is not None:
        path = raw_path.strip()
        if path:
            resolved = _resolve_repo_relative_path(path)
            if not resolved.is_file():
                raise ValueError(f"seed profile not found: {resolved}")
            return resolved

    for candidate in DEFAULT_SOURCE_PROFILE_PATHS:
        if candidate.is_file():
            return candidate

    raise ValueError(
        "No progression profile source found. Checked:\n"
        f"- {DEFAULT_REPLAY_PROFILE_PATH} (replay output)\n"
        f"- {DEFAULT_SEED_PROFILE_PATH} (legacy fixture)"
    )


def _load_profile(source_path: Path) -> dict[str, Any]:
    if not source_path.is_file():
        raise ValueError(f"seed profile not found: {source_path}")

    data = json.loads(source_path.read_text(encoding="utf-8"))
    profile = _extract_profile_payload(data, source_path)
    if not _is_profile_payload(profile):
        raise ValueError(f"seed profile missing required key(s) {REQUIRED_TOP_LEVEL_KEYS}: {source_path}")

    return profile


def _write_profile(profile: dict[str, Any], output_path: Path, *, indent: int) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(profile, ensure_ascii=True, indent=indent) + "\n",
        encoding="utf-8",
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate the RK-M0-0014 progression profile artifact used by the smoke runbook."
        )
    )
    parser.add_argument(
        "--seed-profile",
        default=None,
        help=(
            "Optional path to source progression profile seed/replay output."
            " If omitted, the command prefers replay output then falls back to fixture seed."
        ),
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_PROFILE_PATH),
        help="Output path for generated RK-M0-0014 profile JSON.",
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="JSON indent level for generated profile file.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    try:
        seed_profile_path = _resolve_seed_profile_path(args.seed_profile)
        output_profile_path = _resolve_repo_relative_path(args.output)
        profile = _load_profile(seed_profile_path)
        _write_profile(profile, output_profile_path, indent=max(int(args.indent), 0))
    except (ValueError, json.JSONDecodeError, OSError) as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    print(
        "STATUS: COMPLETED\n"
        f"Generated RK-M0-0014 profile: {output_profile_path}\n"
        f"source: {seed_profile_path}\n"
        f"settlement snapshots: {len(profile['settlement_snapshots'])}\n"
        f"scout snapshots: {len(profile['event_scout_snapshots'])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
