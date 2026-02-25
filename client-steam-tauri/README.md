# Steam Tauri Wrapper Scaffold (M0)

This directory hosts the temporary Steam-targeted Tauri wrapper scaffold for the first vertical slice.

## Scope

- Wrap packaged web artifact from `client-web/`
- Windows-first desktop packaging lane
- Steamworks integration deferred
- Placeholder-only store/build assets (final art is not required in this phase)

## Primary Commands

- Prepare wrapper web assets:
  - `python tools/steam_tauri_wrapper.py prepare --clean-web`
- Run local wrapper session:
  - `python tools/steam_tauri_wrapper.py dev`
- Build Windows package:
  - `python tools/steam_tauri_wrapper.py build`

PowerShell wrappers for the same commands are available under `scripts/`.
