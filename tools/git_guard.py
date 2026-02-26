from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Any

from python_runtime import preferred_python_command

def _run(command: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        text=True,
        capture_output=True,
        shell=True,
        check=False,
    )


def _preferred_python_command() -> str:
    return preferred_python_command(root=Path(__file__).resolve().parents[1])


def _normalize_validation_command(command: str) -> str:
    # Normalize leading python launcher so validation commands work whether
    # operators use `python`, `py`, or a specific interpreter path.
    pattern = re.compile(r"^\s*(python(?:\.exe)?|py(?:\.exe)?)\b", re.IGNORECASE)
    normalized = command
    if pattern.search(normalized):
        normalized = pattern.sub(lambda _match: _preferred_python_command(), normalized, count=1)

    # Agents sometimes emit dotted unittest module targets with a trailing `.py`,
    # e.g. `python -m unittest tests.some_test.py`, which unittest interprets as
    # module `tests.some_test` attribute `py` and fails. Normalize to module form.
    if re.search(r"(?:^|\s)-m\s+unittest(?:\s|$)", normalized, re.IGNORECASE):
        normalized = re.sub(
            r"\b((?:[A-Za-z_]\w*\.)+[A-Za-z_]\w*)\.py\b",
            r"\1",
            normalized,
        )
    return normalized


def is_git_repo(root: Path) -> bool:
    proc = _run("git rev-parse --is-inside-work-tree", root)
    return proc.returncode == 0 and proc.stdout.strip() == "true"


def current_branch(root: Path) -> str | None:
    proc = _run("git rev-parse --abbrev-ref HEAD", root)
    if proc.returncode != 0:
        return None
    return proc.stdout.strip()


def changed_files(root: Path) -> list[str]:
    proc = _run("git status --porcelain", root)
    if proc.returncode != 0:
        return []
    files: list[str] = []
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        files.append(line[3:].strip())
    return files


def run_validation_commands(root: Path, commands: list[str]) -> tuple[bool, list[dict[str, Any]]]:
    results: list[dict[str, Any]] = []
    for command in commands:
        effective_command = _normalize_validation_command(command)
        proc = _run(effective_command, root)
        results.append(
            {
                "command": command,
                "effective_command": effective_command,
                "exit_code": proc.returncode,
                "stdout_tail": (proc.stdout or "")[-1000:],
                "stderr_tail": (proc.stderr or "")[-1000:],
            }
        )
        if proc.returncode != 0:
            return False, results
    return True, results


def commit_changes(root: Path, message: str) -> tuple[bool, str]:
    add_proc = _run("git add -A", root)
    if add_proc.returncode != 0:
        return False, (add_proc.stderr or add_proc.stdout or "git add failed").strip()

    diff_proc = _run("git diff --cached --name-only", root)
    if diff_proc.returncode != 0:
        return False, (diff_proc.stderr or diff_proc.stdout or "git diff failed").strip()
    if not diff_proc.stdout.strip():
        return True, "NO_CHANGES"

    commit_proc = _run(f'git commit -m "{message.replace(chr(34), chr(39))}"', root)
    if commit_proc.returncode != 0:
        return False, (commit_proc.stderr or commit_proc.stdout or "git commit failed").strip()

    sha_proc = _run("git rev-parse HEAD", root)
    if sha_proc.returncode != 0:
        return True, "UNKNOWN_SHA"
    return True, sha_proc.stdout.strip()
