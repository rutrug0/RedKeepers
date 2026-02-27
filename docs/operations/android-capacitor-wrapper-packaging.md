# Android Capacitor Wrapper Packaging (M0)

This runbook defines the Android-targeted Capacitor wrapper scaffold around the packaged web vertical slice.

## Scope Guard

- Wrapper input remains the packaged web artifact (`client-web` is source of truth)
- Android packaging lane only in this phase (debug/release package outputs)
- No native gameplay features; wrapper only applies platform baseline behavior
- Store/build assets remain placeholder-only (final art is not a blocker)

## Prerequisites

- Python 3.11+
- Node.js with `npm`
- Android SDK + command line build tools
- JDK 17+ (for Gradle-based Android builds)

Install wrapper dependencies before sync/build commands:

```powershell
cd client-android-capacitor
npm install
cd ..
```

## Commands

Canonical deterministic wrapper command lanes:

| Lane | Script command | Python command | Prerequisites | Primary outputs |
| --- | --- | --- | --- | --- |
| prepare | `scripts/wrapper_android_capacitor.ps1 -Mode prepare -CleanWeb` | `python tools/android_capacitor_wrapper.py prepare --clean-web` | Python 3.11+ | `coordination/runtime/android-capacitor-wrapper/web-dist/`, `client-android-capacitor/www/`, `coordination/runtime/android-capacitor-wrapper/wrapper-input-manifest.json` |
| dev | `scripts/wrapper_android_capacitor.ps1 -Mode dev -CleanWeb` | `python tools/android_capacitor_wrapper.py dev --clean-web` | Python 3.11+, Node.js/npm, Capacitor deps (`npm install`) | Android project opened in IDE after sync, refreshed wrapper runtime manifest |
| package | `scripts/wrapper_android_capacitor.ps1 -Mode package -CleanWeb` | `python tools/android_capacitor_wrapper.py build-debug --clean-web` | Python 3.11+, Node.js/npm, Capacitor deps, Android SDK, JDK 17+ | Debug APK at `client-android-capacitor/android/app/build/outputs/apk/debug/`, refreshed wrapper runtime manifest |
| package-release | `scripts/wrapper_android_capacitor.ps1 -Mode package-release -CleanWeb` | `python tools/android_capacitor_wrapper.py build-release --clean-web` | Python 3.11+, Node.js/npm, Capacitor deps, Android SDK, JDK 17+ | Release APK at `client-android-capacitor/android/app/build/outputs/apk/release/`, refreshed wrapper runtime manifest |

Canonical reproducible script entry point (web artifact -> Android prepare):

```powershell
scripts/wrapper_android_capacitor.ps1 -Mode prepare -CleanWeb
```

Canonical reproducible script entry point (web artifact -> Android debug package):

```powershell
scripts/wrapper_android_capacitor.ps1 -Mode package -CleanWeb
```

Canonical reproducible script entry point (web artifact -> Android release package):

```powershell
scripts/wrapper_android_capacitor.ps1 -Mode package-release -CleanWeb
```

Canonical reproducible script entry point (web artifact -> Android dev run):

```powershell
scripts/wrapper_android_capacitor.ps1 -Mode dev -CleanWeb
```

Underlying Python commands (same behavior):

```powershell
python tools/android_capacitor_wrapper.py prepare --clean-web
python tools/android_capacitor_wrapper.py build-debug --clean-web
python tools/android_capacitor_wrapper.py build-release --clean-web
python tools/android_capacitor_wrapper.py dev --clean-web
```

Compatibility aliases:

```powershell
scripts/wrapper_android_capacitor.ps1 -Mode package-debug -CleanWeb
scripts/wrapper_android_capacitor.ps1 -Mode build-debug -CleanWeb
scripts/wrapper_android_capacitor.ps1 -Mode build-release -CleanWeb
```

Prepare-mode automation smoke:

```powershell
python tools/platform_wrapper_prepare_smoke.py
```

Legacy script aliases (still supported):

```powershell
scripts/prepare_android_capacitor_wrapper.ps1 -CleanWeb
scripts/sync_android_capacitor_wrapper.ps1 -CleanWeb
scripts/run_android_capacitor_wrapper_dev.ps1 -CleanWeb
scripts/package_android_capacitor_wrapper.ps1 -Variant debug -CleanWeb
scripts/package_android_capacitor_wrapper.ps1 -Variant release -CleanWeb
```

## Outputs

- Prepared wrapper web root: `coordination/runtime/android-capacitor-wrapper/web-dist/`
- Wrapper input manifest: `coordination/runtime/android-capacitor-wrapper/wrapper-input-manifest.json`
- Synced Capacitor web dir: `client-android-capacitor/www/`
- Android project scaffold (generated on first sync): `client-android-capacitor/android/`
- Build outputs (when build succeeds):
  - Debug APK: `client-android-capacitor/android/app/build/outputs/apk/debug/`
  - Release APK: `client-android-capacitor/android/app/build/outputs/apk/release/`

## Baseline Wrapper Configuration

- Safe-area baseline: `client-android-capacitor/wrapper-overrides/safe-area-baseline.css`
- Back-button baseline: `client-android-capacitor/wrapper-overrides/back-button-baseline.js`
- Orientation baseline: enforced as portrait on `BridgeActivity` in generated Android manifest during sync.

## Placeholder Store/Build Metadata

- Metadata/assets manifest file: `client-android-capacitor/store-placeholders/android-store-metadata.placeholder.json`
- Placeholder assets: `client-android-capacitor/store-placeholders/*.txt`
- `art_status` must remain `placeholder-only` for first-slice packaging.
- `replaceable` must be `true` at metadata level and for each `placeholder_assets[]` entry.
- The prepare lane writes this manifest reference into `coordination/runtime/android-capacitor-wrapper/wrapper-input-manifest.json`.
