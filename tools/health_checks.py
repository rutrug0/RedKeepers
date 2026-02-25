from __future__ import annotations

from pathlib import Path
from typing import Any

from codex_worker import (
    codex_command_preflight_error,
    codex_model_access_preflight_error,
)
from schemas import load_json, load_yaml_like, validate_work_items


def _validate_json_list(
    *,
    errors: list[str],
    path: Path,
    label: str,
    validate_items: bool = False,
) -> None:
    if not path.exists():
        return
    try:
        data = load_json(path, [])
    except Exception as exc:
        errors.append(f"failed parsing {label}: {exc}")
        return
    if not isinstance(data, list):
        errors.append(f"{label} must contain a list")
        return
    if validate_items:
        errors.extend(f"{label} {err}" for err in validate_work_items(data))


def _validate_json_object(*, errors: list[str], path: Path, label: str) -> None:
    if not path.exists():
        return
    try:
        data = load_json(path, {})
    except Exception as exc:
        errors.append(f"failed parsing {label}: {exc}")
        return
    if not isinstance(data, dict):
        errors.append(f"{label} must contain an object")


def _is_definitive_model_access_error(text: str | None) -> bool:
    if not text:
        return False
    lowered = text.lower()
    markers = (
        "not supported",
        "unsupported",
        "unsupported model",
        "does not have access",
        "not authorized",
        "not enabled",
        "permission denied",
        "invalid model",
        "unknown model",
    )
    return any(marker in lowered for marker in markers)


def _validate_model_profile_access(*, errors: list[str], model_policy: Any) -> None:
    if not isinstance(model_policy, dict):
        return
    agent_models = model_policy.get("agent_models", {})
    if not isinstance(agent_models, dict):
        return

    escalation_upgrade = model_policy.get("escalation_upgrade", {}) or {}
    critical_cfg = escalation_upgrade.get("critical_or_repeated_failure") or {}

    checks: list[tuple[str, str | None]] = []

    for cfg in agent_models.values():
        if not isinstance(cfg, dict):
            continue
        model = cfg.get("model")
        fallback = cfg.get("fallback_model")
        if isinstance(model, str) and model.strip():
            checks.append((model.strip(), fallback.strip() if isinstance(fallback, str) and fallback.strip() else None))

    if isinstance(critical_cfg, dict):
        crit_model = critical_cfg.get("model")
        crit_fallback = critical_cfg.get("fallback_model")
        if isinstance(crit_model, str) and crit_model.strip():
            checks.append((crit_model.strip(), crit_fallback.strip() if isinstance(crit_fallback, str) and crit_fallback.strip() else None))

    seen: set[tuple[str, str | None]] = set()
    for requested_model, fallback_model in checks:
        key = (requested_model.lower(), fallback_model.lower() if fallback_model else None)
        if key in seen:
            continue
        seen.add(key)

        requested_error = codex_model_access_preflight_error(requested_model)
        if not requested_error:
            continue
        if not _is_definitive_model_access_error(requested_error):
            # Timeouts/transient transport failures should not hard-fail daemon startup.
            continue

        if fallback_model:
            fallback_error = codex_model_access_preflight_error(fallback_model)
            if not fallback_error:
                continue
            if not _is_definitive_model_access_error(fallback_error):
                continue
            errors.append(
                (
                    f"model '{requested_model}' is not accessible: {requested_error} "
                    f"and fallback model '{fallback_model}' is also not accessible: {fallback_error}. "
                    "Remediation: update model-policy.yaml to an accessible model, "
                    "or configure an accessible fallback_model for this agent/escalation path."
                )
            )
            continue

        errors.append(
            (
                f"model '{requested_model}' is not accessible: {requested_error}. "
                "Remediation: update model-policy.yaml to an accessible model, "
                "or configure an accessible fallback_model for this agent/escalation path."
            )
        )


def validate_environment(root: Path) -> list[str]:
    errors: list[str] = []
    runtime_dir = root / "coordination" / "runtime"

    required_paths = [
        root / "coordination" / "backlog" / "work-items.json",
        root / "coordination" / "backlog" / "completed-items.json",
        root / "coordination" / "backlog" / "blocked-items.json",
        root / "coordination" / "state" / "agents.json",
        root / "coordination" / "policies" / "routing-rules.yaml",
        root / "coordination" / "policies" / "retry-policy.yaml",
        root / "coordination" / "policies" / "model-policy.yaml",
        root / "coordination" / "policies" / "commit-guard-rules.yaml",
    ]
    for path in required_paths:
        if not path.exists():
            errors.append(f"missing required file: {path}")

    _validate_json_list(
        errors=errors,
        path=root / "coordination" / "backlog" / "work-items.json",
        label="work-items.json",
        validate_items=True,
    )
    _validate_json_list(
        errors=errors,
        path=root / "coordination" / "backlog" / "completed-items.json",
        label="completed-items.json",
        validate_items=True,
    )
    _validate_json_list(
        errors=errors,
        path=root / "coordination" / "backlog" / "blocked-items.json",
        label="blocked-items.json",
        validate_items=True,
    )
    _validate_json_list(
        errors=errors,
        path=root / "coordination" / "backlog" / "blocked-archived-items.json",
        label="blocked-archived-items.json",
        validate_items=True,
    )
    _validate_json_object(
        errors=errors,
        path=root / "coordination" / "state" / "daemon-state.json",
        label="daemon-state.json",
    )
    _validate_json_object(
        errors=errors,
        path=root / "coordination" / "state" / "agents.json",
        label="agents.json",
    )
    _validate_model_profile_access(
        errors=errors,
        model_policy=load_yaml_like(root / "coordination" / "policies" / "model-policy.yaml", {}),
    )

    # Runtime files are generated on demand; validate them only if they already exist.
    for state_name in ["daemon-state.json", "agent-stats.json", "model-stats.json", "progress-summary.json", "locks.json"]:
        _validate_json_object(
            errors=errors,
            path=runtime_dir / state_name,
            label=state_name,
        )
    for policy_name in [
        "routing-rules.yaml",
        "retry-policy.yaml",
        "model-policy.yaml",
        "commit-guard-rules.yaml",
    ]:
        policy_path = root / "coordination" / "policies" / policy_name
        if policy_path.exists():
            try:
                data: Any = load_yaml_like(policy_path, {})
                if not isinstance(data, dict):
                    errors.append(f"{policy_name} must parse to an object")
            except Exception as exc:
                errors.append(f"failed parsing {policy_name}: {exc}")

    codex_error = codex_command_preflight_error()
    if codex_error:
        errors.append(codex_error)

    return errors
