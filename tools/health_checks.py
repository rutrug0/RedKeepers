from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from codex_worker import (
    codex_command_preflight_error,
    codex_model_access_preflight_error,
)
from git_guard import _normalize_validation_command
from python_runtime import resolve_python_executable
from schemas import load_json, load_yaml_like, validate_work_items

HOSTILE_RUNTIME_TOKEN_CONTRACT_PATH = Path(
    "backend/src/app/config/seeds/v1/narrative/first-slice-hostile-runtime-token-contract.json"
)
FIRST_SLICE_CONTENT_KEY_MANIFEST_PATH = Path(
    "backend/src/app/config/seeds/v1/narrative/first-slice-content-key-manifest.json"
)
EVENT_FEED_MESSAGES_PATH = Path(
    "backend/src/app/config/seeds/v1/narrative/event-feed-messages.json"
)


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
    lightweight_cfg = model_policy.get("lightweight_task_override", {}) or {}
    global_fallback = model_policy.get("fallback_model")
    if not isinstance(global_fallback, str):
        global_fallback = None

    checks: list[tuple[str, str | None]] = []

    def _clean(value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        text = value.strip()
        return text or None

    for cfg in agent_models.values():
        if not isinstance(cfg, dict):
            continue
        model = _clean(cfg.get("model"))
        if not model:
            continue
        fallback = _clean(cfg.get("fallback_model")) or _clean(global_fallback)
        checks.append((model, fallback))

    if isinstance(critical_cfg, dict):
        crit_model = _clean(critical_cfg.get("model"))
        if crit_model:
            crit_fallback = _clean(critical_cfg.get("fallback_model")) or _clean(global_fallback)
            checks.append((crit_model, crit_fallback))

    if isinstance(lightweight_cfg, dict):
        light_model = _clean(lightweight_cfg.get("model"))
        if light_model:
            light_fallback = _clean(lightweight_cfg.get("fallback_model")) or _clean(global_fallback)
            checks.append((light_model, light_fallback))

    seen: set[tuple[str, str | None]] = set()
    for requested_model, fallback_model in checks:
        key = (
            requested_model.lower(),
            fallback_model.lower() if fallback_model else None,
        )
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
            if not _is_definitive_model_access_error(fallback_error):
                # A usable fallback path exists for this profile.
                continue

        errors.append(
            (
                f"model '{requested_model}' is not accessible: {requested_error}. "
                "Remediation: update model-policy.yaml to an accessible model."
            )
        )


def _boolish(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return default


def _frontend_visual_qa_enabled(*, commit_rules: Any) -> bool:
    rules = commit_rules if isinstance(commit_rules, dict) else {}
    visual_cfg = rules.get("frontend_visual_qa", {})
    if not isinstance(visual_cfg, dict):
        visual_cfg = {}

    enabled = _boolish(visual_cfg.get("enabled"), False)
    env_visual = os.environ.get("REDKEEPERS_ENABLE_FRONTEND_VISUAL_QA")
    if env_visual is not None:
        enabled = _boolish(env_visual, enabled)
    return enabled


def _playwright_import_error() -> str | None:
    probe_command = _normalize_validation_command(
        'python -c "import sys; print(sys.executable); import playwright.sync_api"'
    )
    proc = subprocess.run(
        probe_command,
        text=True,
        capture_output=True,
        shell=True,
        check=False,
    )
    if proc.returncode == 0:
        return None

    stdout_lines = [line.strip() for line in (proc.stdout or "").splitlines() if line.strip()]
    stderr_lines = [line.strip() for line in (proc.stderr or "").splitlines() if line.strip()]
    detail = stderr_lines[-1] if stderr_lines else (stdout_lines[-1] if stdout_lines else "")
    if not detail:
        detail = f"playwright import probe failed with exit code {proc.returncode}"

    if stdout_lines:
        interpreter = stdout_lines[0]
        return f"{detail} (interpreter: {interpreter})"
    if "not recognized as an internal or external command" in detail.lower():
        return f"{detail} (launcher command: {probe_command})"
    return detail


def _frontend_visual_python_command(command: str) -> str:
    return _normalize_validation_command(command).strip()


def _frontend_visual_remediation_commands() -> tuple[str, str]:
    install_command = _frontend_visual_python_command("python -m pip install playwright pillow")
    chromium_command = _frontend_visual_python_command("python -m playwright install chromium")
    return install_command, chromium_command


def _frontend_visual_python_label() -> str:
    command = _frontend_visual_python_command("python")
    return command or str(Path(sys.executable))


def _frontend_visual_remediation_text() -> str:
    install_command, chromium_command = _frontend_visual_remediation_commands()
    return f"{install_command} and {chromium_command}"


def _validate_frontend_visual_qa_preflight(*, errors: list[str], commit_rules: Any) -> None:
    if not _frontend_visual_qa_enabled(commit_rules=commit_rules):
        return

    import_error = _playwright_import_error()
    if not import_error:
        return

    python_label = _frontend_visual_python_label()
    remediation = _frontend_visual_remediation_text()
    errors.append(
        (
            "frontend visual QA is enabled but Playwright is not importable in the active Python interpreter "
            f"used by orchestrator validation commands ({python_label}): {import_error}. "
            f"Remediation: run {remediation}. "
            "If frontend visual QA should be disabled in this environment, set "
            "REDKEEPERS_ENABLE_FRONTEND_VISUAL_QA=0."
        )
    )


def _validate_runtime_python_policy(*, errors: list[str], runtime_policy: Any) -> None:
    if not isinstance(runtime_policy, dict):
        return
    command = str(runtime_policy.get("python_command", "")).strip()
    if not command:
        return
    executable = resolve_python_executable(command)
    if executable:
        return
    errors.append(
        (
            "runtime-policy.yaml python_command is configured but not resolvable: "
            f"{command!r}. Remediation: set coordination/policies/runtime-policy.yaml "
            "python_command to a valid interpreter path or launcher command."
        )
    )


def _as_json_object(value: Any, *, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must contain a JSON object.")
    return value


def _read_string_list(value: Any, *, label: str) -> list[str]:
    if not isinstance(value, list):
        raise ValueError(f"{label} must be a list.")
    normalized: list[str] = []
    for idx, entry in enumerate(value):
        if not isinstance(entry, str) or len(entry.strip()) < 1:
            raise ValueError(f"{label}[{idx}] must be a non-empty string.")
        normalized.append(entry.strip())
    return normalized


FIRST_SLICE_REQUIRED_LOOP_KEYS_BY_NAMESPACE: dict[str, tuple[str, ...]] = {
    "tick": (
        "event.tick.passive_income",
        "event.tick.storage_near_cap",
        "event.tick.producer_unlocked_hint",
        "event.tick.passive_gain_success",
        "event.tick.passive_gain_reasoned",
        "event.tick.passive_gain_stalled",
        "event.tick.passive_gain_capped",
    ),
    "build": (
        "event.build.upgrade_started",
        "event.build.upgrade_completed",
        "event.build.queue_blocked_resources",
        "event.build.success",
        "event.build.failure_insufficient_resources",
        "event.build.failure_cooldown",
        "event.build.failure_invalid_state",
    ),
    "train": (
        "event.train.started",
        "event.train.completed",
        "event.train.queue_full",
        "event.train.success",
        "event.train.failure_insufficient_resources",
        "event.train.failure_cooldown",
        "event.train.failure_invalid_state",
    ),
    "scout": (
        "event.scout.dispatched",
        "event.scout.report_empty",
        "event.scout.report_hostile",
        "event.scout.dispatched_success",
        "event.scout.return_empty",
        "event.scout.return_hostile",
    ),
    "hostile_dispatch_and_resolve": (
        "event.world.hostile_foreign_settlement_spotted",
        "event.world.hostile_dispatch_target_required",
        "event.world.hostile_dispatch_accepted",
        "event.world.hostile_dispatch_en_route",
        "event.world.hostile_dispatch_failed",
        "event.world.hostile_dispatch_failed_source_target_not_foreign",
        "event.world.hostile_dispatch_failed_max_active_marches_reached",
        "event.world.hostile_dispatch_failed_path_blocked_impassable",
        "event.world.hostile_dispatch_failed_march_already_exists",
        "event.world.hostile_march_arrived_outer_works",
        "event.world.hostile_march_arrived_gate_contested",
        "event.combat.hostile_resolve_attacker_win",
        "event.combat.hostile_resolve_defender_win",
        "event.combat.hostile_resolve_tie_defender_holds",
        "event.combat.hostile_loss_report",
        "event.combat.hostile_garrison_broken",
        "event.combat.hostile_counterfire_heavy",
        "event.world.hostile_retreat_ordered",
        "event.world.hostile_retreat_in_motion",
        "event.world.hostile_retreat_completed",
        "event.world.hostile_defeat_force_shattered",
        "event.world.hostile_defeat_command_silent",
        "event.world.hostile_post_battle_return_started",
        "event.world.hostile_post_battle_returned",
    ),
}


def _append_hostile_contract_drift_error(
    errors: list[str],
    message: str,
) -> None:
    errors.append(f"first-slice-hostile-runtime-token-contract drift: {message}")


def _validate_first_slice_hostile_runtime_token_contract_drift(*, errors: list[str], root: Path) -> None:
    contract_path = root / HOSTILE_RUNTIME_TOKEN_CONTRACT_PATH
    manifest_path = root / FIRST_SLICE_CONTENT_KEY_MANIFEST_PATH
    event_feed_path = root / EVENT_FEED_MESSAGES_PATH
    if not (contract_path.exists() and manifest_path.exists() and event_feed_path.exists()):
        return

    try:
        contract = _as_json_object(
            load_json(contract_path, {}),
            label=str(HOSTILE_RUNTIME_TOKEN_CONTRACT_PATH),
        )
        manifest = _as_json_object(
            load_json(manifest_path, {}),
            label=str(FIRST_SLICE_CONTENT_KEY_MANIFEST_PATH),
        )
        event_feed = _as_json_object(
            load_json(event_feed_path, {}),
            label=str(EVENT_FEED_MESSAGES_PATH),
        )
    except Exception as exc:
        _append_hostile_contract_drift_error(errors, f"failed loading validation inputs: {exc}")
        return

    try:
        runtime_rows_raw = contract.get("required_runtime_keys")
        if not isinstance(runtime_rows_raw, list):
            raise ValueError("required_runtime_keys must be a list.")

        runtime_rows: list[dict[str, Any]] = []
        runtime_canonical_keys: list[str] = []
        runtime_alias_keys: list[str] = []
        for idx, raw_row in enumerate(runtime_rows_raw):
            if not isinstance(raw_row, dict):
                raise ValueError(f"required_runtime_keys[{idx}] must be an object.")
            canonical_key = str(raw_row.get("canonical_key", "")).strip()
            if len(canonical_key) < 1:
                raise ValueError(f"required_runtime_keys[{idx}].canonical_key must be a non-empty string.")
            required_tokens = _read_string_list(
                raw_row.get("required_tokens"),
                label=f"required_runtime_keys[{idx}].required_tokens",
            )
            compatibility_alias_keys = _read_string_list(
                raw_row.get("compatibility_alias_keys"),
                label=f"required_runtime_keys[{idx}].compatibility_alias_keys",
            )
            runtime_rows.append(
                {
                    "canonical_key": canonical_key,
                    "required_tokens": required_tokens,
                    "compatibility_alias_keys": compatibility_alias_keys,
                }
            )
            runtime_canonical_keys.append(canonical_key)
            runtime_alias_keys.extend(compatibility_alias_keys)

        contract_alias_only_keys = _read_string_list(
            contract.get("compatibility_alias_only_keys"),
            label="compatibility_alias_only_keys",
        )

        deferred_contract_rows = contract.get("deferred_post_slice_keys_excluded_from_contract")
        if not isinstance(deferred_contract_rows, list):
            raise ValueError("deferred_post_slice_keys_excluded_from_contract must be a list.")
        deferred_contract_keys: list[str] = []
        for idx, row in enumerate(deferred_contract_rows):
            if not isinstance(row, dict):
                raise ValueError(f"deferred_post_slice_keys_excluded_from_contract[{idx}] must be an object.")
            key = str(row.get("key", "")).strip()
            if len(key) < 1:
                raise ValueError(
                    f"deferred_post_slice_keys_excluded_from_contract[{idx}].key must be a non-empty string."
                )
            deferred_contract_keys.append(key)

        default_usage = _as_json_object(
            manifest.get("default_first_slice_seed_usage"),
            label="first-slice-content-key-manifest.default_first_slice_seed_usage",
        )
        manifest_default_canonical_keys = _read_string_list(
            default_usage.get("include_only_content_keys"),
            label="first-slice-content-key-manifest.default_first_slice_seed_usage.include_only_content_keys",
        )

        loop_required = _as_json_object(
            manifest.get("loop_required_keys"),
            label="first-slice-content-key-manifest.loop_required_keys",
        )
        manifest_tick_loop_required_keys = _read_string_list(
            loop_required.get("tick"),
            label="first-slice-content-key-manifest.loop_required_keys.tick",
        )
        manifest_build_loop_required_keys = _read_string_list(
            loop_required.get("build"),
            label="first-slice-content-key-manifest.loop_required_keys.build",
        )
        manifest_train_loop_required_keys = _read_string_list(
            loop_required.get("train"),
            label="first-slice-content-key-manifest.loop_required_keys.train",
        )
        manifest_scout_loop_required_keys = _read_string_list(
            loop_required.get("scout"),
            label="first-slice-content-key-manifest.loop_required_keys.scout",
        )
        manifest_hostile_loop_required_keys = _read_string_list(
            loop_required.get("hostile_dispatch_and_resolve"),
            label="first-slice-content-key-manifest.loop_required_keys.hostile_dispatch_and_resolve",
        )
        manifest_loop_keys_by_namespace: dict[str, list[str]] = {
            "tick": manifest_tick_loop_required_keys,
            "build": manifest_build_loop_required_keys,
            "train": manifest_train_loop_required_keys,
            "scout": manifest_scout_loop_required_keys,
            "hostile_dispatch_and_resolve": manifest_hostile_loop_required_keys,
        }

        manifest_alias_only_keys = _read_string_list(
            manifest.get("compatibility_alias_only_keys"),
            label="first-slice-content-key-manifest.compatibility_alias_only_keys",
        )

        manifest_legacy_alias_mapping_raw = manifest.get("legacy_alias_mapping")
        if not isinstance(manifest_legacy_alias_mapping_raw, list):
            raise ValueError("first-slice-content-key-manifest.legacy_alias_mapping must be a list.")
        manifest_alias_map: dict[str, list[str]] = {}
        for idx, row in enumerate(manifest_legacy_alias_mapping_raw):
            if not isinstance(row, dict):
                raise ValueError(f"first-slice-content-key-manifest.legacy_alias_mapping[{idx}] must be an object.")
            canonical_key = str(row.get("canonical_key", "")).strip()
            if len(canonical_key) < 1:
                raise ValueError(
                    f"first-slice-content-key-manifest.legacy_alias_mapping[{idx}].canonical_key must be a non-empty string."
                )
            legacy_keys = _read_string_list(
                row.get("legacy_keys"),
                label=f"first-slice-content-key-manifest.legacy_alias_mapping[{idx}].legacy_keys",
            )
            manifest_alias_map[canonical_key] = legacy_keys

        manifest_deferred_rows = manifest.get("deferred_post_slice_keys")
        if not isinstance(manifest_deferred_rows, list):
            raise ValueError("first-slice-content-key-manifest.deferred_post_slice_keys must be a list.")
        manifest_deferred_keys: list[str] = []
        for idx, row in enumerate(manifest_deferred_rows):
            if not isinstance(row, dict):
                raise ValueError(f"first-slice-content-key-manifest.deferred_post_slice_keys[{idx}] must be an object.")
            key = str(row.get("key", "")).strip()
            if len(key) < 1:
                raise ValueError(
                    f"first-slice-content-key-manifest.deferred_post_slice_keys[{idx}].key must be a non-empty string."
                )
            manifest_deferred_keys.append(key)

        event_rows = event_feed.get("rows")
        if not isinstance(event_rows, list):
            raise ValueError("event-feed-messages.rows must be a list.")
        event_tokens_by_key: dict[str, list[str]] = {}
        for idx, row in enumerate(event_rows):
            if not isinstance(row, dict):
                raise ValueError(f"event-feed-messages.rows[{idx}] must be an object.")
            key = str(row.get("key", "")).strip()
            if len(key) < 1:
                raise ValueError(f"event-feed-messages.rows[{idx}].key must be a non-empty string.")
            event_tokens_by_key[key] = _read_string_list(
                row.get("tokens"),
                label=f"event-feed-messages.rows[{idx}].tokens",
            )
    except Exception as exc:
        _append_hostile_contract_drift_error(errors, f"invalid contract/seed structure: {exc}")
        return

    manifest_hostile_required_set = set(manifest_hostile_loop_required_keys)
    manifest_default_canonical_set = set(manifest_default_canonical_keys)
    runtime_canonical_set = set(runtime_canonical_keys)
    contract_alias_only_set = set(contract_alias_only_keys)
    manifest_alias_only_set = set(manifest_alias_only_keys)
    deferred_union = set(deferred_contract_keys).union(manifest_deferred_keys)

    for namespace, required_keys in FIRST_SLICE_REQUIRED_LOOP_KEYS_BY_NAMESPACE.items():
        manifest_namespace_keys = manifest_loop_keys_by_namespace.get(namespace, [])
        manifest_namespace_set = set(manifest_namespace_keys)
        missing_from_manifest_loop = sorted(
            key for key in required_keys if key not in manifest_namespace_set
        )
        if missing_from_manifest_loop:
            _append_hostile_contract_drift_error(
                errors,
                (
                    f"missing canonical loop key(s) in first-slice-content-key-manifest.loop_required_keys.{namespace}: "
                    f"{missing_from_manifest_loop}."
                ),
            )

        missing_from_default_selection = sorted(
            key for key in required_keys if key not in manifest_default_canonical_set
        )
        if missing_from_default_selection:
            _append_hostile_contract_drift_error(
                errors,
                (
                    "missing canonical loop key(s) in "
                    "first-slice-content-key-manifest.default_first_slice_seed_usage.include_only_content_keys "
                    f"for namespace '{namespace}': {missing_from_default_selection}."
                ),
            )

        missing_from_event_feed = sorted(
            key for key in required_keys if key not in event_tokens_by_key
        )
        if missing_from_event_feed:
            _append_hostile_contract_drift_error(
                errors,
                (
                    f"missing canonical loop key event rows for namespace '{namespace}' in event-feed-messages: "
                    f"{missing_from_event_feed}."
                ),
            )

        alias_keys_selected_as_loop_canonical = sorted(
            key for key in manifest_namespace_keys if key in manifest_alias_only_set
        )
        if alias_keys_selected_as_loop_canonical:
            _append_hostile_contract_drift_error(
                errors,
                (
                    "compatibility alias key(s) selected as canonical in "
                    f"first-slice-content-key-manifest.loop_required_keys.{namespace}: "
                    f"{alias_keys_selected_as_loop_canonical}."
                ),
            )

    for canonical_key, legacy_alias_keys in manifest_alias_map.items():
        if canonical_key in event_tokens_by_key:
            canonical_tokens = event_tokens_by_key[canonical_key]
            for alias_key in legacy_alias_keys:
                if alias_key not in event_tokens_by_key:
                    continue
                alias_tokens = event_tokens_by_key[alias_key]
                if alias_tokens == canonical_tokens:
                    continue
                missing_alias_tokens = sorted(set(canonical_tokens) - set(alias_tokens))
                extra_alias_tokens = sorted(set(alias_tokens) - set(canonical_tokens))
                _append_hostile_contract_drift_error(
                    errors,
                    (
                        f"alias token mismatch in legacy_alias_mapping for canonical_key '{canonical_key}' "
                        f"via alias '{alias_key}': canonical_tokens={canonical_tokens}, "
                        f"alias_tokens={alias_tokens}, missing_in_alias={missing_alias_tokens}, "
                        f"extra_in_alias={extra_alias_tokens}."
                    ),
                )

    declared_aliases_by_runtime_rows = {alias for alias in runtime_alias_keys}
    for canonical_key in runtime_canonical_keys:
        if canonical_key not in manifest_hostile_required_set:
            _append_hostile_contract_drift_error(
                errors,
                (
                    f"canonical_key '{canonical_key}' is missing from "
                    "first-slice-content-key-manifest.loop_required_keys.hostile_dispatch_and_resolve."
                ),
            )
        if canonical_key not in event_tokens_by_key:
            _append_hostile_contract_drift_error(
                errors,
                f"canonical_key '{canonical_key}' is missing from event-feed-messages rows.",
            )

    for row in runtime_rows:
        canonical_key = row["canonical_key"]
        required_tokens = row["required_tokens"]
        compatibility_alias_keys = row["compatibility_alias_keys"]

        if canonical_key in contract_alias_only_set:
            _append_hostile_contract_drift_error(
                errors,
                (
                    f"canonical_key '{canonical_key}' is declared in compatibility_alias_only_keys and cannot be "
                    "selected as a direct default canonical key."
                ),
            )
        if canonical_key in deferred_union:
            _append_hostile_contract_drift_error(
                errors,
                (
                    f"deferred key '{canonical_key}' appears in required_runtime_keys.canonical_key. "
                    "Deferred hero/gather/ambush keys must remain excluded."
                ),
            )
        if canonical_key in event_tokens_by_key:
            event_tokens = event_tokens_by_key[canonical_key]
            if event_tokens != required_tokens:
                missing_tokens = sorted(set(required_tokens) - set(event_tokens))
                extra_tokens = sorted(set(event_tokens) - set(required_tokens))
                _append_hostile_contract_drift_error(
                    errors,
                    (
                        f"token mismatch for canonical_key '{canonical_key}': "
                        f"contract_tokens={required_tokens}, event_feed_tokens={event_tokens}, "
                        f"missing_in_event_feed={missing_tokens}, extra_in_event_feed={extra_tokens}."
                    ),
                )

        manifest_aliases_for_canonical = set(manifest_alias_map.get(canonical_key, []))
        contract_aliases_for_canonical = set(compatibility_alias_keys)
        missing_in_manifest_alias_mapping = sorted(contract_aliases_for_canonical - manifest_aliases_for_canonical)
        if missing_in_manifest_alias_mapping:
            _append_hostile_contract_drift_error(
                errors,
                (
                    f"canonical_key '{canonical_key}' declares alias(es) not present in "
                    f"first-slice-content-key-manifest.legacy_alias_mapping: {missing_in_manifest_alias_mapping}."
                ),
            )
        missing_in_contract_alias_mapping = sorted(manifest_aliases_for_canonical - contract_aliases_for_canonical)
        if missing_in_contract_alias_mapping:
            _append_hostile_contract_drift_error(
                errors,
                (
                    f"canonical_key '{canonical_key}' is missing alias(es) from hostile contract "
                    f"that exist in first-slice-content-key-manifest.legacy_alias_mapping: {missing_in_contract_alias_mapping}."
                ),
            )

        for alias_key in compatibility_alias_keys:
            if alias_key in manifest_default_canonical_set:
                _append_hostile_contract_drift_error(
                    errors,
                    (
                        f"compatibility alias key '{alias_key}' is selected in "
                        "first-slice-content-key-manifest.default_first_slice_seed_usage.include_only_content_keys."
                    ),
                )
            if alias_key in runtime_canonical_set:
                _append_hostile_contract_drift_error(
                    errors,
                    f"compatibility alias key '{alias_key}' appears as required_runtime_keys.canonical_key.",
                )
            if alias_key in deferred_union:
                _append_hostile_contract_drift_error(
                    errors,
                    (
                        f"deferred key '{alias_key}' appears in required_runtime_keys.compatibility_alias_keys. "
                        "Deferred hero/gather/ambush keys must remain excluded."
                    ),
                )
            if alias_key not in contract_alias_only_set:
                _append_hostile_contract_drift_error(
                    errors,
                    f"compatibility alias key '{alias_key}' is not listed in contract compatibility_alias_only_keys.",
                )
            if alias_key not in manifest_alias_only_set:
                _append_hostile_contract_drift_error(
                    errors,
                    (
                        f"compatibility alias key '{alias_key}' is missing from "
                        "first-slice-content-key-manifest.compatibility_alias_only_keys."
                    ),
                )
            if alias_key not in event_tokens_by_key:
                _append_hostile_contract_drift_error(
                    errors,
                    f"compatibility alias key '{alias_key}' is missing from event-feed-messages rows.",
                )
            else:
                alias_tokens = event_tokens_by_key[alias_key]
                if alias_tokens != required_tokens:
                    missing_alias_tokens = sorted(set(required_tokens) - set(alias_tokens))
                    extra_alias_tokens = sorted(set(alias_tokens) - set(required_tokens))
                    _append_hostile_contract_drift_error(
                        errors,
                        (
                            f"alias token mismatch for canonical_key '{canonical_key}' via alias '{alias_key}': "
                            f"contract_tokens={required_tokens}, event_feed_tokens={alias_tokens}, "
                            f"missing_in_event_feed={missing_alias_tokens}, extra_in_event_feed={extra_alias_tokens}."
                        ),
                    )

    for alias_key in contract_alias_only_keys:
        if alias_key not in declared_aliases_by_runtime_rows:
            _append_hostile_contract_drift_error(
                errors,
                (
                    f"compatibility_alias_only_keys entry '{alias_key}' is not referenced by any "
                    "required_runtime_keys.compatibility_alias_keys row."
                ),
            )
        if alias_key in manifest_default_canonical_set:
            _append_hostile_contract_drift_error(
                errors,
                (
                    f"compatibility alias key '{alias_key}' is selected in "
                    "first-slice-content-key-manifest.default_first_slice_seed_usage.include_only_content_keys."
                ),
            )
        if alias_key in runtime_canonical_set:
            _append_hostile_contract_drift_error(
                errors,
                f"compatibility alias key '{alias_key}' appears as required_runtime_keys.canonical_key.",
            )

    missing_contract_deferred_keys = sorted(set(manifest_deferred_keys) - set(deferred_contract_keys))
    if missing_contract_deferred_keys:
        _append_hostile_contract_drift_error(
            errors,
            (
                "deferred_post_slice_keys_excluded_from_contract is missing keys declared in "
                f"first-slice-content-key-manifest.deferred_post_slice_keys: {missing_contract_deferred_keys}."
            ),
        )

    missing_manifest_deferred_keys = sorted(set(deferred_contract_keys) - set(manifest_deferred_keys))
    if missing_manifest_deferred_keys:
        _append_hostile_contract_drift_error(
            errors,
            (
                "first-slice-content-key-manifest.deferred_post_slice_keys is missing keys declared in "
                f"deferred_post_slice_keys_excluded_from_contract: {missing_manifest_deferred_keys}."
            ),
        )


def validate_environment(root: Path) -> list[str]:
    errors: list[str] = []
    runtime_dir = root / "coordination" / "runtime"
    commit_guard_rules: Any = {}
    runtime_policy_rules: Any = {}

    required_paths = [
        root / "coordination" / "backlog" / "work-items.json",
        root / "coordination" / "backlog" / "completed-items.json",
        root / "coordination" / "backlog" / "blocked-items.json",
        root / "coordination" / "state" / "agents.json",
        root / "coordination" / "policies" / "routing-rules.yaml",
        root / "coordination" / "policies" / "retry-policy.yaml",
        root / "coordination" / "policies" / "model-policy.yaml",
        root / "coordination" / "policies" / "commit-guard-rules.yaml",
        root / "coordination" / "policies" / "runtime-policy.yaml",
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
        "runtime-policy.yaml",
    ]:
        policy_path = root / "coordination" / "policies" / policy_name
        if policy_path.exists():
            try:
                data: Any = load_yaml_like(policy_path, {})
                if not isinstance(data, dict):
                    errors.append(f"{policy_name} must parse to an object")
                    continue
                if policy_name == "commit-guard-rules.yaml":
                    commit_guard_rules = data
                if policy_name == "runtime-policy.yaml":
                    runtime_policy_rules = data
            except Exception as exc:
                errors.append(f"failed parsing {policy_name}: {exc}")

    _validate_runtime_python_policy(errors=errors, runtime_policy=runtime_policy_rules)
    _validate_frontend_visual_qa_preflight(errors=errors, commit_rules=commit_guard_rules)
    _validate_first_slice_hostile_runtime_token_contract_drift(errors=errors, root=root)

    codex_error = codex_command_preflight_error()
    if codex_error:
        errors.append(codex_error)

    return errors
