from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PLAYABLE_MANIFEST_PATH = (
    ROOT / "backend" / "src" / "app" / "config" / "seeds" / "v1" / "first-slice-playable-manifest.json"
)
CONTENT_KEY_MANIFEST_PATH = (
    ROOT
    / "backend"
    / "src"
    / "app"
    / "config"
    / "seeds"
    / "v1"
    / "narrative"
    / "first-slice-content-key-manifest.json"
)
NARRATIVE_TEMPLATE_SNAPSHOT_LOCK_PATH = (
    ROOT
    / "backend"
    / "src"
    / "app"
    / "config"
    / "seeds"
    / "v1"
    / "narrative"
    / "first-slice-narrative-template-snapshot.lock.json"
)
HOSTILE_RUNTIME_TOKEN_CONTRACT_PATH = (
    ROOT
    / "backend"
    / "src"
    / "app"
    / "config"
    / "seeds"
    / "v1"
    / "narrative"
    / "first-slice-hostile-runtime-token-contract.json"
)
DEFAULT_OUTPUT_PATH = ROOT / "client-web" / "first-slice-manifest-snapshot.js"
SNAPSHOT_GLOBAL_NAME = "__RK_FIRST_SLICE_MANIFEST_SNAPSHOT_V1__"
OBJECTIVE_STEP_ORDER: tuple[str, ...] = (
    "tick",
    "build",
    "train",
    "scout",
    "attack",
    "resolve",
)
OBJECTIVE_STEP_ORDER_INDEX: dict[str, int] = {
    step: idx for idx, step in enumerate(OBJECTIVE_STEP_ORDER)
}
ALIAS_LOOKUP_RESOLUTION_ORDER = ["canonical_key", "legacy_keys_in_declared_order"]


def _resolve_repo_relative_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return ROOT / path


def _read_json_file(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ValueError(f"Manifest file not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Manifest root must be a JSON object: {path}")
    return data


def _read_required_object(payload: dict[str, Any], key: str, *, label: str) -> dict[str, Any]:
    value = payload.get(key)
    if not isinstance(value, dict):
        raise ValueError(f"Missing object '{key}' in {label}.")
    return value


def _read_required_array(payload: dict[str, Any], key: str, *, label: str) -> list[Any]:
    value = payload.get(key)
    if not isinstance(value, list):
        raise ValueError(f"Missing array '{key}' in {label}.")
    return value


def _read_required_string(payload: dict[str, Any], key: str, *, label: str) -> str:
    value = str(payload.get(key, "")).strip()
    if len(value) < 1:
        raise ValueError(f"Missing non-empty string '{key}' in {label}.")
    return value


def _to_string_list(values: list[Any], *, label: str) -> list[str]:
    normalized: list[str] = []
    for idx, value in enumerate(values):
        text = str(value).strip()
        if len(text) < 1:
            raise ValueError(f"{label}[{idx}] must be a non-empty string.")
        normalized.append(text)
    return normalized


def _to_legacy_alias_mapping_rows(values: list[Any], *, label: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for idx, raw_row in enumerate(values):
        if not isinstance(raw_row, dict):
            raise ValueError(f"{label}[{idx}] must be an object.")
        canonical_key = _read_required_string(raw_row, "canonical_key", label=f"{label}[{idx}]")
        legacy_keys = _to_string_list(
            _read_required_array(raw_row, "legacy_keys", label=f"{label}[{idx}]"),
            label=f"{label}[{idx}].legacy_keys",
        )
        rows.append(
            {
                "canonical_key": canonical_key,
                "legacy_keys": legacy_keys,
            }
        )
    return rows


def _to_lookup_resolution_rows(values: list[Any], *, label: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for idx, raw_row in enumerate(values):
        if not isinstance(raw_row, dict):
            raise ValueError(f"{label}[{idx}] must be an object.")
        canonical_key = _read_required_string(raw_row, "canonical_key", label=f"{label}[{idx}]")
        resolution_order = _to_string_list(
            _read_required_array(raw_row, "resolution_order", label=f"{label}[{idx}]"),
            label=f"{label}[{idx}].resolution_order",
        )
        if resolution_order[0] != canonical_key:
            raise ValueError(
                f"{label}[{idx}] resolution_order must start with canonical_key '{canonical_key}'."
            )
        rows.append(
            {
                "canonical_key": canonical_key,
                "resolution_order": resolution_order,
            }
        )
    return rows


def _to_objective_step_outcome_contract_rows(
    values: list[Any], *, label: str
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen_objective_ids: set[str] = set()
    seen_loop_steps: set[str] = set()
    previous_step_index = -1

    for idx, raw_row in enumerate(values):
        if not isinstance(raw_row, dict):
            raise ValueError(f"{label}[{idx}] must be an object.")

        canonical_objective_key = _read_required_string(
            raw_row,
            "canonical_objective_key",
            label=f"{label}[{idx}]",
        )
        if canonical_objective_key in seen_objective_ids:
            raise ValueError(
                f"{label}[{idx}] canonical_objective_key '{canonical_objective_key}' is duplicated."
            )
        seen_objective_ids.add(canonical_objective_key)

        loop_step = _read_required_string(
            raw_row,
            "loop_step",
            label=f"{label}[{idx}]",
        )
        step_index = OBJECTIVE_STEP_ORDER_INDEX.get(loop_step)
        if step_index is None:
            raise ValueError(
                f"{label}[{idx}] loop_step '{loop_step}' is invalid. "
                f"Expected one of: {', '.join(OBJECTIVE_STEP_ORDER)}."
            )
        if loop_step in seen_loop_steps:
            raise ValueError(f"{label}[{idx}] loop_step '{loop_step}' is duplicated.")
        if step_index < previous_step_index:
            previous_step = OBJECTIVE_STEP_ORDER[previous_step_index]
            raise ValueError(
                f"{label}[{idx}] loop_step '{loop_step}' is out of order. "
                f"Expected order: {list(OBJECTIVE_STEP_ORDER)} and a step at or after '{previous_step}'."
            )

        seen_loop_steps.add(loop_step)
        previous_step_index = step_index

        required_all_canonical_keys = _to_string_list(
            _read_required_array(raw_row, "required_all_canonical_keys", label=f"{label}[{idx}]"),
            label=f"{label}[{idx}].required_all_canonical_keys",
        )
        if len(required_all_canonical_keys) < 1:
            raise ValueError(
                f"{label}[{idx}] required_all_canonical_keys must include at least one canonical key."
            )

        required_any_raw = raw_row.get("required_any_canonical_keys", [])
        if not isinstance(required_any_raw, list):
            raise ValueError(
                f"{label}[{idx}] required_any_canonical_keys must be an array when provided."
            )
        required_any_canonical_keys = _to_string_list(
            required_any_raw,
            label=f"{label}[{idx}].required_any_canonical_keys",
        )
        include_required_any = "required_any_canonical_keys" in raw_row

        all_canonical_keys = [
            *required_all_canonical_keys,
            *required_any_canonical_keys,
        ]
        seen_keys: set[str] = set()
        duplicated_keys: list[str] = []
        for key in all_canonical_keys:
            if key in seen_keys and key not in duplicated_keys:
                duplicated_keys.append(key)
            seen_keys.add(key)
        if len(duplicated_keys) > 0:
            raise ValueError(
                f"{label}[{idx}] required_all_canonical_keys/required_any_canonical_keys "
                f"contains duplicate canonical key(s): {duplicated_keys}."
            )

        alias_lookup_keys = _read_required_object(
            raw_row,
            "compatibility_alias_lookup_keys",
            label=f"{label}[{idx}]",
        )
        normalized_alias_lookup_keys: dict[str, list[str]] = {}
        for raw_key, raw_aliases in alias_lookup_keys.items():
            canonical_key = str(raw_key).strip()
            if len(canonical_key) < 1:
                raise ValueError(
                    f"{label}[{idx}].compatibility_alias_lookup_keys contains an empty canonical key entry."
                )
            if not isinstance(raw_aliases, list):
                raise ValueError(
                    f"{label}[{idx}].compatibility_alias_lookup_keys['{canonical_key}'] must be an array."
                )
            normalized_alias_lookup_keys[canonical_key] = _to_string_list(
                raw_aliases,
                label=(
                    f"{label}[{idx}].compatibility_alias_lookup_keys"
                    f"['{canonical_key}']"
                ),
            )

        drift_keys = sorted(
            set(normalized_alias_lookup_keys.keys()).symmetric_difference(
                set(all_canonical_keys)
            )
        )
        if len(drift_keys) > 0:
            raise ValueError(
                f"{label}[{idx}] compatibility_alias_lookup_keys keys must exactly match "
                f"required_all/required_any canonical keys; drift={drift_keys}."
            )

        row_payload: dict[str, Any] = {
            "canonical_objective_key": canonical_objective_key,
            "loop_step": loop_step,
            "required_all_canonical_keys": required_all_canonical_keys,
            "compatibility_alias_lookup_keys": {
                key: normalized_alias_lookup_keys[key] for key in all_canonical_keys
            },
        }
        if include_required_any:
            row_payload["required_any_canonical_keys"] = required_any_canonical_keys
        rows.append(row_payload)

    return rows


def _to_templates_by_key(values: dict[str, Any], *, label: str) -> dict[str, dict[str, Any]]:
    templates: dict[str, dict[str, Any]] = {}
    for key, raw_row in values.items():
        normalized_key = str(key).strip()
        if len(normalized_key) < 1:
            raise ValueError(f"{label} contains an empty key entry.")
        if not isinstance(raw_row, dict):
            raise ValueError(f"{label}.{normalized_key} must be an object.")
        template = _read_required_string(raw_row, "template", label=f"{label}.{normalized_key}")
        tokens = _to_string_list(
            _read_required_array(raw_row, "tokens", label=f"{label}.{normalized_key}"),
            label=f"{label}.{normalized_key}.tokens",
        )
        templates[normalized_key] = {
            "template": template,
            "tokens": tokens,
        }
    return templates


def _read_required_bool(payload: dict[str, Any], key: str, *, label: str) -> bool:
    value = payload.get(key)
    if not isinstance(value, bool):
        raise ValueError(f"Missing boolean '{key}' in {label}.")
    return value


def _to_hostile_runtime_required_key_rows(
    values: list[Any], *, label: str
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen_canonical_keys: set[str] = set()
    for idx, raw_row in enumerate(values):
        if not isinstance(raw_row, dict):
            raise ValueError(f"{label}[{idx}] must be an object.")
        canonical_key = _read_required_string(
            raw_row, "canonical_key", label=f"{label}[{idx}]"
        )
        if canonical_key in seen_canonical_keys:
            raise ValueError(
                f"{label}[{idx}] canonical_key '{canonical_key}' is duplicated."
            )
        seen_canonical_keys.add(canonical_key)
        rows.append(
            {
                "phase": _read_required_string(raw_row, "phase", label=f"{label}[{idx}]"),
                "canonical_key": canonical_key,
                "required_tokens": _to_string_list(
                    _read_required_array(
                        raw_row, "required_tokens", label=f"{label}[{idx}]"
                    ),
                    label=f"{label}[{idx}].required_tokens",
                ),
                "compatibility_alias_keys": _to_string_list(
                    _read_required_array(
                        raw_row, "compatibility_alias_keys", label=f"{label}[{idx}]"
                    ),
                    label=f"{label}[{idx}].compatibility_alias_keys",
                ),
            }
        )
    return rows


def _to_alias_lookup_contract_row(value: dict[str, Any], *, label: str) -> dict[str, Any]:
    deterministic_resolution_order = _to_string_list(
        _read_required_array(value, "deterministic_resolution_order", label=label),
        label=f"{label}.deterministic_resolution_order",
    )
    if deterministic_resolution_order != ALIAS_LOOKUP_RESOLUTION_ORDER:
        raise ValueError(
            f"{label}.deterministic_resolution_order must equal {ALIAS_LOOKUP_RESOLUTION_ORDER}; "
            f"received {deterministic_resolution_order}."
        )

    excludes_alias_only_keys = _read_required_bool(
        value,
        "direct_default_selection_excludes_legacy_alias_only_keys",
        label=label,
    )
    if not excludes_alias_only_keys:
        raise ValueError(
            f"{label}.direct_default_selection_excludes_legacy_alias_only_keys must be true."
        )

    return {
        "deterministic_resolution_order": deterministic_resolution_order,
        "direct_default_selection_excludes_legacy_alias_only_keys": excludes_alias_only_keys,
    }


def _validate_objective_contract_alias_and_default_selection_policy(
    objective_contract_rows: list[dict[str, Any]],
    *,
    include_only_content_key_set: set[str],
    compatibility_alias_only_key_set: set[str],
    legacy_alias_mapping_rows: list[dict[str, Any]],
) -> None:
    legacy_alias_keys_by_canonical_key: dict[str, list[str]] = {}
    for row in legacy_alias_mapping_rows:
        canonical_key = str(row["canonical_key"])
        alias_rows = row["legacy_keys"]
        if canonical_key not in legacy_alias_keys_by_canonical_key:
            legacy_alias_keys_by_canonical_key[canonical_key] = []
        for alias_key in alias_rows:
            if alias_key not in legacy_alias_keys_by_canonical_key[canonical_key]:
                legacy_alias_keys_by_canonical_key[canonical_key].append(alias_key)

    for idx, objective_row in enumerate(objective_contract_rows):
        canonical_objective_key = str(objective_row["canonical_objective_key"])
        required_all_canonical_keys = objective_row["required_all_canonical_keys"]
        required_any_canonical_keys = objective_row.get("required_any_canonical_keys", [])
        all_canonical_keys = [
            *required_all_canonical_keys,
            *required_any_canonical_keys,
        ]
        alias_lookup_keys = objective_row["compatibility_alias_lookup_keys"]

        for canonical_key in all_canonical_keys:
            if canonical_key in compatibility_alias_only_key_set:
                raise ValueError(
                    "objective_step_outcome_contract "
                    f"objective '{canonical_objective_key}' canonical key '{canonical_key}' is "
                    "compatibility-only and cannot be selected as canonical default key."
                )
            if canonical_key not in include_only_content_key_set:
                raise ValueError(
                    "objective_step_outcome_contract "
                    f"objective '{canonical_objective_key}' canonical key '{canonical_key}' "
                    "must be included in default_first_slice_seed_usage.include_only_content_keys."
                )

            declared_legacy_aliases = legacy_alias_keys_by_canonical_key.get(canonical_key, [])
            compatibility_aliases_for_key = alias_lookup_keys.get(canonical_key, [])
            if compatibility_aliases_for_key != declared_legacy_aliases:
                raise ValueError(
                    "objective_step_outcome_contract "
                    f"objective '{canonical_objective_key}' canonical key '{canonical_key}' "
                    "alias lookup policy drift; expected aliases "
                    f"{declared_legacy_aliases}, received {compatibility_aliases_for_key}."
                )

            for alias_key in compatibility_aliases_for_key:
                if alias_key not in compatibility_alias_only_key_set:
                    raise ValueError(
                        "objective_step_outcome_contract "
                        f"objective '{canonical_objective_key}' canonical key '{canonical_key}' alias "
                        f"'{alias_key}' must be declared in compatibility_alias_only_keys."
                    )
                if alias_key in include_only_content_key_set:
                    raise ValueError(
                        "objective_step_outcome_contract "
                        f"objective '{canonical_objective_key}' canonical key '{canonical_key}' alias "
                        f"'{alias_key}' must remain lookup-only and excluded from default canonical selection."
                    )


def _build_snapshot_payload(
    playable_manifest: dict[str, Any],
    content_key_manifest: dict[str, Any],
    narrative_template_snapshot: dict[str, Any],
    hostile_runtime_token_contract: dict[str, Any],
) -> dict[str, Any]:
    playable_manifest_id = _read_required_string(
        playable_manifest,
        "manifest_id",
        label="first-slice-playable-manifest.json",
    )
    content_key_manifest_id = _read_required_string(
        content_key_manifest,
        "manifest_id",
        label="first-slice-content-key-manifest.json",
    )
    narrative_snapshot_id = _read_required_string(
        narrative_template_snapshot,
        "snapshot_id",
        label="first-slice-narrative-template-snapshot.lock.json",
    )
    narrative_snapshot_manifest_id = _read_required_string(
        narrative_template_snapshot,
        "manifest_id",
        label="first-slice-narrative-template-snapshot.lock.json",
    )
    if narrative_snapshot_manifest_id != content_key_manifest_id:
        raise ValueError(
            "Narrative template snapshot manifest_id does not match first-slice-content-key-manifest.json manifest_id."
        )
    narrative_default_first_session = _read_required_object(
        narrative_template_snapshot,
        "default_first_session",
        label="first-slice-narrative-template-snapshot.lock.json",
    )
    narrative_lookup_rows = _to_lookup_resolution_rows(
        _read_required_array(
            narrative_default_first_session,
            "lookup_resolution_order_by_canonical_key",
            label="first-slice-narrative-template-snapshot.lock.json.default_first_session",
        ),
        label="lookup_resolution_order_by_canonical_key",
    )
    narrative_templates_by_key = _to_templates_by_key(
        _read_required_object(
            narrative_default_first_session,
            "templates_by_key",
            label="first-slice-narrative-template-snapshot.lock.json.default_first_session",
        ),
        label="templates_by_key",
    )

    canonical_playable_now = _read_required_object(
        playable_manifest,
        "canonical_playable_now",
        label="first-slice-playable-manifest.json",
    )
    primary_settlement = _read_required_object(
        canonical_playable_now,
        "primary_settlement",
        label="canonical_playable_now",
    )
    foreign_hostile_profile = _read_required_object(
        canonical_playable_now,
        "foreign_hostile_profile",
        label="canonical_playable_now",
    )
    map_coordinate = _read_required_object(
        foreign_hostile_profile,
        "map_coordinate",
        label="canonical_playable_now.foreign_hostile_profile",
    )
    map_fixture_ids = _read_required_object(
        canonical_playable_now,
        "map_fixture_ids",
        label="canonical_playable_now",
    )
    playable_frontend_contract = _read_required_object(
        _read_required_object(
            playable_manifest,
            "default_consumption_contract",
            label="first-slice-playable-manifest.json",
        ),
        "frontend",
        label="first-slice-playable-manifest.json.default_consumption_contract",
    )

    content_defaults = _read_required_object(
        content_key_manifest,
        "default_first_slice_seed_usage",
        label="first-slice-content-key-manifest.json",
    )
    include_only_content_keys = _to_string_list(
        _read_required_array(
            content_defaults,
            "include_only_content_keys",
            label="first-slice-content-key-manifest.json.default_first_slice_seed_usage",
        ),
        label="include_only_content_keys",
    )
    legacy_alias_mapping = _to_legacy_alias_mapping_rows(
        _read_required_array(
            content_key_manifest,
            "legacy_alias_mapping",
            label="first-slice-content-key-manifest.json",
        ),
        label="legacy_alias_mapping",
    )
    objective_step_outcome_contract = _to_objective_step_outcome_contract_rows(
        _read_required_array(
            content_key_manifest,
            "objective_step_outcome_contract",
            label="first-slice-content-key-manifest.json",
        ),
        label="objective_step_outcome_contract",
    )
    if len(objective_step_outcome_contract) < 1:
        raise ValueError(
            "first-slice-content-key-manifest.json.objective_step_outcome_contract must contain at least one row."
        )
    alias_lookup_contract = _to_alias_lookup_contract_row(
        _read_required_object(
            content_key_manifest,
            "alias_lookup_contract",
            label="first-slice-content-key-manifest.json",
        ),
        label="first-slice-content-key-manifest.json.alias_lookup_contract",
    )
    hostile_required_runtime_keys = _to_hostile_runtime_required_key_rows(
        _read_required_array(
            hostile_runtime_token_contract,
            "required_runtime_keys",
            label="first-slice-hostile-runtime-token-contract.json",
        ),
        label="required_runtime_keys",
    )
    if len(hostile_required_runtime_keys) < 1:
        raise ValueError(
            "first-slice-hostile-runtime-token-contract.json.required_runtime_keys must contain at least one row."
        )
    hostile_contract_id = _read_required_string(
        hostile_runtime_token_contract,
        "contract_id",
        label="first-slice-hostile-runtime-token-contract.json",
    )
    hostile_compatibility_alias_only_keys = _to_string_list(
        _read_required_array(
            hostile_runtime_token_contract,
            "compatibility_alias_only_keys",
            label="first-slice-hostile-runtime-token-contract.json",
        ),
        label="compatibility_alias_only_keys",
    )
    hostile_scope_contract = _read_required_object(
        hostile_runtime_token_contract,
        "scope_contract",
        label="first-slice-hostile-runtime-token-contract.json",
    )
    hostile_default_selection_policy = _read_required_object(
        hostile_scope_contract,
        "default_selection_policy",
        label="first-slice-hostile-runtime-token-contract.json.scope_contract",
    )
    hostile_alias_lookup_contract = _read_required_object(
        hostile_scope_contract,
        "alias_lookup_contract",
        label="first-slice-hostile-runtime-token-contract.json.scope_contract",
    )
    hostile_deterministic_resolution_order = _to_string_list(
        _read_required_array(
            hostile_alias_lookup_contract,
            "deterministic_resolution_order",
            label="first-slice-hostile-runtime-token-contract.json.scope_contract.alias_lookup_contract",
        ),
        label="scope_contract.alias_lookup_contract.deterministic_resolution_order",
    )

    include_only_content_key_set = set(include_only_content_keys)
    compatibility_alias_only_keys = _to_string_list(
        _read_required_array(
            content_key_manifest,
            "compatibility_alias_only_keys",
            label="first-slice-content-key-manifest.json",
        ),
        label="compatibility_alias_only_keys",
    )
    compatibility_alias_only_key_set = set(compatibility_alias_only_keys)
    _validate_objective_contract_alias_and_default_selection_policy(
        objective_step_outcome_contract,
        include_only_content_key_set=include_only_content_key_set,
        compatibility_alias_only_key_set=compatibility_alias_only_key_set,
        legacy_alias_mapping_rows=legacy_alias_mapping,
    )

    declared_hostile_aliases = {
        alias
        for row in hostile_required_runtime_keys
        for alias in row["compatibility_alias_keys"]
    }
    for row in hostile_required_runtime_keys:
        canonical_key = row["canonical_key"]
        if canonical_key not in include_only_content_key_set:
            raise ValueError(
                f"hostile runtime canonical key '{canonical_key}' must be included in default_first_slice_seed_usage.include_only_content_keys."
            )
    for alias_key in hostile_compatibility_alias_only_keys:
        if alias_key not in declared_hostile_aliases:
            raise ValueError(
                f"hostile compatibility alias key '{alias_key}' is not referenced by any required_runtime_keys row."
            )
    for alias_key in declared_hostile_aliases:
        if alias_key not in hostile_compatibility_alias_only_keys:
            raise ValueError(
                f"hostile required_runtime_keys alias '{alias_key}' must be listed in compatibility_alias_only_keys."
            )

    return {
        "schema_version": "rk-v1-first-slice-manifest-snapshot",
        "source_manifests": {
            "playable": {
                "path": "backend/src/app/config/seeds/v1/first-slice-playable-manifest.json",
                "manifest_id": playable_manifest_id,
            },
            "content_keys": {
                "path": "backend/src/app/config/seeds/v1/narrative/first-slice-content-key-manifest.json",
                "manifest_id": content_key_manifest_id,
            },
            "narrative_templates": {
                "path": "backend/src/app/config/seeds/v1/narrative/first-slice-narrative-template-snapshot.lock.json",
                "manifest_id": narrative_snapshot_manifest_id,
                "snapshot_id": narrative_snapshot_id,
            },
            "hostile_runtime_tokens": {
                "path": "backend/src/app/config/seeds/v1/narrative/first-slice-hostile-runtime-token-contract.json",
                "contract_id": hostile_contract_id,
            },
        },
        "playable": {
            "manifest_id": playable_manifest_id,
            "canonical_playable_now": {
                "civilization_profile_id": _read_required_string(
                    canonical_playable_now, "civilization_profile_id", label="canonical_playable_now"
                ),
                "primary_settlement": {
                    "settlement_id": _read_required_string(
                        primary_settlement, "settlement_id", label="canonical_playable_now.primary_settlement"
                    ),
                    "settlement_name": _read_required_string(
                        primary_settlement, "settlement_name", label="canonical_playable_now.primary_settlement"
                    ),
                },
                "foreign_hostile_profile": {
                    "profile_id": _read_required_string(
                        foreign_hostile_profile,
                        "profile_id",
                        label="canonical_playable_now.foreign_hostile_profile",
                    ),
                    "settlement_id": _read_required_string(
                        foreign_hostile_profile,
                        "settlement_id",
                        label="canonical_playable_now.foreign_hostile_profile",
                    ),
                    "settlement_name": _read_required_string(
                        foreign_hostile_profile,
                        "settlement_name",
                        label="canonical_playable_now.foreign_hostile_profile",
                    ),
                    "target_tile_label": _read_required_string(
                        foreign_hostile_profile,
                        "target_tile_label",
                        label="canonical_playable_now.foreign_hostile_profile",
                    ),
                    "map_coordinate": {
                        "x": int(map_coordinate.get("x", 0)),
                        "y": int(map_coordinate.get("y", 0)),
                    },
                    "defender_garrison_strength": int(
                        foreign_hostile_profile.get("defender_garrison_strength", 0)
                    ),
                },
                "resources": _to_string_list(
                    _read_required_array(canonical_playable_now, "resources", label="canonical_playable_now"),
                    label="canonical_playable_now.resources",
                ),
                "buildings": _to_string_list(
                    _read_required_array(canonical_playable_now, "buildings", label="canonical_playable_now"),
                    label="canonical_playable_now.buildings",
                ),
                "units": _to_string_list(
                    _read_required_array(canonical_playable_now, "units", label="canonical_playable_now"),
                    label="canonical_playable_now.units",
                ),
                "map_fixture_ids": {
                    "world_id": _read_required_string(
                        map_fixture_ids, "world_id", label="canonical_playable_now.map_fixture_ids"
                    ),
                    "world_seed": _read_required_string(
                        map_fixture_ids, "world_seed", label="canonical_playable_now.map_fixture_ids"
                    ),
                    "hostile_target_settlement_id": _read_required_string(
                        map_fixture_ids,
                        "hostile_target_settlement_id",
                        label="canonical_playable_now.map_fixture_ids",
                    ),
                    "scout_tile_ids": _to_string_list(
                        _read_required_array(
                            map_fixture_ids,
                            "scout_tile_ids",
                            label="canonical_playable_now.map_fixture_ids",
                        ),
                        label="canonical_playable_now.map_fixture_ids.scout_tile_ids",
                    ),
                    "deterministic_attack_fixture_ids": _to_string_list(
                        _read_required_array(
                            map_fixture_ids,
                            "deterministic_attack_fixture_ids",
                            label="canonical_playable_now.map_fixture_ids",
                        ),
                        label="canonical_playable_now.map_fixture_ids.deterministic_attack_fixture_ids",
                    ),
                },
            },
            "default_consumption_contract": {
                "frontend": {
                    "default_session_entry_settlement_id": _read_required_string(
                        playable_frontend_contract,
                        "default_session_entry_settlement_id",
                        label="first-slice-playable-manifest.default_consumption_contract.frontend",
                    ),
                    "default_hostile_target_settlement_id": _read_required_string(
                        playable_frontend_contract,
                        "default_hostile_target_settlement_id",
                        label="first-slice-playable-manifest.default_consumption_contract.frontend",
                    ),
                }
            },
        },
        "content_keys": {
            "manifest_id": content_key_manifest_id,
            "default_first_slice_seed_usage": {
                "include_only_content_keys": include_only_content_keys,
            },
            "legacy_alias_mapping": legacy_alias_mapping,
            "first_session_objective_contract": {
                "rows": objective_step_outcome_contract,
                "alias_lookup_contract": alias_lookup_contract,
            },
            "hostile_runtime_token_contract": {
                "contract_id": hostile_contract_id,
                "scope_contract": {
                    "default_selection_policy": {
                        "canonical_keys_only": _read_required_bool(
                            hostile_default_selection_policy,
                            "canonical_keys_only",
                            label="first-slice-hostile-runtime-token-contract.json.scope_contract.default_selection_policy",
                        ),
                        "direct_default_selection_excludes_alias_only_keys": _read_required_bool(
                            hostile_default_selection_policy,
                            "direct_default_selection_excludes_alias_only_keys",
                            label="first-slice-hostile-runtime-token-contract.json.scope_contract.default_selection_policy",
                        ),
                    },
                    "alias_lookup_contract": {
                        "deterministic_resolution_order": hostile_deterministic_resolution_order,
                        "alias_keys_are_lookup_only": _read_required_bool(
                            hostile_alias_lookup_contract,
                            "alias_keys_are_lookup_only",
                            label="first-slice-hostile-runtime-token-contract.json.scope_contract.alias_lookup_contract",
                        ),
                    },
                },
                "required_runtime_keys": hostile_required_runtime_keys,
                "compatibility_alias_only_keys": hostile_compatibility_alias_only_keys,
            },
            "default_first_session_narrative_templates": {
                "snapshot_id": narrative_snapshot_id,
                "manifest_id": narrative_snapshot_manifest_id,
                "lookup_resolution_order_by_canonical_key": narrative_lookup_rows,
                "templates_by_key": narrative_templates_by_key,
            },
        },
    }


def _write_snapshot_js(payload: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        f"window.{SNAPSHOT_GLOBAL_NAME} = Object.freeze("
        + json.dumps(payload, ensure_ascii=True, indent=2)
        + ");\n",
        encoding="utf-8",
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate client-web first-slice manifest snapshot from backend playable and content-key manifests."
        )
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_PATH),
        help="Output JS path for the generated frontend manifest snapshot.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    try:
        output_path = _resolve_repo_relative_path(args.output)
        playable_manifest = _read_json_file(PLAYABLE_MANIFEST_PATH)
        content_key_manifest = _read_json_file(CONTENT_KEY_MANIFEST_PATH)
        narrative_template_snapshot = _read_json_file(NARRATIVE_TEMPLATE_SNAPSHOT_LOCK_PATH)
        hostile_runtime_token_contract = _read_json_file(HOSTILE_RUNTIME_TOKEN_CONTRACT_PATH)
        payload = _build_snapshot_payload(
            playable_manifest,
            content_key_manifest,
            narrative_template_snapshot,
            hostile_runtime_token_contract,
        )
        _write_snapshot_js(payload, output_path)
    except (ValueError, json.JSONDecodeError, OSError) as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    print(
        "STATUS: COMPLETED\n"
        f"Generated first-slice frontend manifest snapshot: {output_path}\n"
        f"playable manifest: {PLAYABLE_MANIFEST_PATH}\n"
        f"content-key manifest: {CONTENT_KEY_MANIFEST_PATH}\n"
        f"narrative template snapshot: {NARRATIVE_TEMPLATE_SNAPSHOT_LOCK_PATH}\n"
        f"hostile runtime token contract: {HOSTILE_RUNTIME_TOKEN_CONTRACT_PATH}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
