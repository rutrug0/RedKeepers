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
DEFAULT_OUTPUT_PATH = ROOT / "client-web" / "first-slice-manifest-snapshot.js"
SNAPSHOT_GLOBAL_NAME = "__RK_FIRST_SLICE_MANIFEST_SNAPSHOT_V1__"


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


def _build_snapshot_payload(
    playable_manifest: dict[str, Any],
    content_key_manifest: dict[str, Any],
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
        payload = _build_snapshot_payload(playable_manifest, content_key_manifest)
        _write_snapshot_js(payload, output_path)
    except (ValueError, json.JSONDecodeError, OSError) as exc:
        print(f"STATUS: BLOCKED\n{exc}")
        return 1

    print(
        "STATUS: COMPLETED\n"
        f"Generated first-slice frontend manifest snapshot: {output_path}\n"
        f"playable manifest: {PLAYABLE_MANIFEST_PATH}\n"
        f"content-key manifest: {CONTENT_KEY_MANIFEST_PATH}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
