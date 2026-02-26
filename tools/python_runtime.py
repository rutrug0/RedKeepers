from __future__ import annotations

import os
import shlex
import shutil
import sys
from pathlib import Path

from schemas import load_yaml_like


ROOT = Path(__file__).resolve().parents[1]
RUNTIME_POLICY_PATH = ROOT / "coordination" / "policies" / "runtime-policy.yaml"


def _quote_if_needed(raw: str) -> str:
    text = raw.strip()
    if not text:
        return text
    if text.startswith('"') and text.endswith('"'):
        return text
    if " " in text:
        return f'"{text}"'
    return text


def _runtime_policy_python_command(*, root: Path = ROOT) -> str | None:
    runtime_policy_path = root / "coordination" / "policies" / "runtime-policy.yaml"
    policy = load_yaml_like(runtime_policy_path, {})
    if not isinstance(policy, dict):
        return None
    command = str(policy.get("python_command", "")).strip()
    return command or None


def preferred_python_command(*, root: Path = ROOT) -> str:
    env_override = os.environ.get("REDKEEPERS_PYTHON_CMD", "").strip()
    if env_override:
        return env_override

    policy_command = _runtime_policy_python_command(root=root)
    if policy_command:
        return policy_command

    executable = (sys.executable or "").strip()
    if executable:
        return _quote_if_needed(executable)
    return "python"


def _parse_command(command: str) -> list[str]:
    try:
        return shlex.split(command, posix=(os.name != "nt"))
    except ValueError:
        return []


def resolve_python_executable(command: str) -> str | None:
    parts = _parse_command(command)
    if not parts:
        return None

    raw_executable = parts[0].strip().strip('"')
    if not raw_executable:
        return None

    as_path = Path(raw_executable)
    if as_path.exists():
        return str(as_path.resolve())

    resolved = shutil.which(raw_executable)
    if resolved:
        return resolved

    if os.name == "nt" and "." not in as_path.name:
        for suffix in (".exe", ".cmd", ".bat"):
            resolved = shutil.which(raw_executable + suffix)
            if resolved:
                return resolved
    return None


def _same_path(left: str, right: str) -> bool:
    norm_left = os.path.normcase(os.path.normpath(left))
    norm_right = os.path.normcase(os.path.normpath(right))
    return norm_left == norm_right


def enforce_python_environment(
    *,
    env: dict[str, str] | None = None,
    root: Path = ROOT,
) -> tuple[dict[str, str], str, str | None]:
    merged = dict(os.environ if env is None else env)
    command = preferred_python_command(root=root)
    merged["REDKEEPERS_PYTHON_CMD"] = command

    executable = resolve_python_executable(command)
    if not executable:
        return merged, command, None

    python_dir = str(Path(executable).parent)
    path_key = "Path" if "Path" in merged and "PATH" not in merged else "PATH"
    existing_path = merged.get(path_key, "")
    segments = [segment for segment in existing_path.split(os.pathsep) if segment]
    if not any(_same_path(segment, python_dir) for segment in segments):
        segments.insert(0, python_dir)
        normalized = os.pathsep.join(segments)
        merged["PATH"] = normalized
        if "Path" in merged:
            merged["Path"] = normalized

    return merged, command, executable
