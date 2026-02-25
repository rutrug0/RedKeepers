# Android Capacitor Wrapper Scaffold (M0)

This directory hosts the temporary Android-targeted Capacitor wrapper scaffold for the first vertical slice.

## Scope

- Wrap packaged web artifact from `client-web/`
- Android WebView packaging lane for debug/release artifacts
- Baseline wrapper config for safe-area, portrait orientation, and back-button handling
- Placeholder-only store/build assets (final art is not required in this phase)

## Primary Commands

- Install wrapper dependencies first:
  - `cd client-android-capacitor`
  - `npm install`
  - `cd ..`
- Prepare wrapper web assets:
  - `python tools/android_capacitor_wrapper.py prepare --clean-web`
- Sync prepared web assets into Android wrapper project:
  - `python tools/android_capacitor_wrapper.py sync`
- Open Android project in IDE:
  - `python tools/android_capacitor_wrapper.py dev`
- Build Android debug package:
  - `python tools/android_capacitor_wrapper.py build-debug`
- Build Android release package:
  - `python tools/android_capacitor_wrapper.py build-release`

PowerShell wrappers for the same commands are available under `scripts/`.
