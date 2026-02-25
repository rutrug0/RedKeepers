# Steam Tauri Wrapper Packaging (M0)

This runbook defines the Steam-targeted Tauri wrapper scaffold around the packaged web vertical slice.

## Scope Guard

- Wrapper input remains the packaged web artifact (`client-web` is source of truth)
- Windows-first packaging lane only in this phase
- No Steamworks integration (achievements/cloud/overlay) in M0 scaffold
- Store/build assets remain placeholder-only (final art is not a blocker)

## Prerequisites

- Python 3.11+
- Node.js with `npm`
- Rust toolchain for Tauri builds (`rustup`, `cargo`)

## Commands

Prepare wrapper web assets from deterministic web package:

```powershell
python tools/steam_tauri_wrapper.py prepare --clean-web
```

Equivalent wrapper:

```powershell
scripts/prepare_steam_tauri_wrapper.ps1 -CleanWeb
```

Run local Tauri wrapper session:

```powershell
python tools/steam_tauri_wrapper.py dev
```

Equivalent wrapper:

```powershell
scripts/run_steam_tauri_wrapper_dev.ps1
```

Build Windows package (NSIS target via Tauri defaults):

```powershell
python tools/steam_tauri_wrapper.py build
```

Equivalent wrapper:

```powershell
scripts/package_steam_tauri_wrapper.ps1
```

## Outputs

- Prepared wrapper web root: `coordination/runtime/steam-tauri-wrapper/web-dist/`
- Wrapper input manifest: `coordination/runtime/steam-tauri-wrapper/wrapper-input-manifest.json`
- Tauri project scaffold: `client-steam-tauri/src-tauri/`
- Build outputs (when build succeeds): `client-steam-tauri/src-tauri/target/`

## Placeholder Store/Build Metadata

- Metadata file: `client-steam-tauri/store-placeholders/steam-store-metadata.placeholder.json`
- Placeholder assets: `client-steam-tauri/store-placeholders/*.txt`
- `art_status` must remain `placeholder-only` for first-slice packaging.
