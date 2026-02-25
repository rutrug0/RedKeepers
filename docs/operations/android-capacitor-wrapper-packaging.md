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

Prepare wrapper web assets from deterministic web package:

```powershell
python tools/android_capacitor_wrapper.py prepare --clean-web
```

Equivalent wrapper:

```powershell
scripts/prepare_android_capacitor_wrapper.ps1 -CleanWeb
```

Sync prepared assets into Capacitor Android project:

```powershell
python tools/android_capacitor_wrapper.py sync
```

Equivalent wrapper:

```powershell
scripts/sync_android_capacitor_wrapper.ps1
```

Open Android project in configured IDE:

```powershell
python tools/android_capacitor_wrapper.py dev
```

Equivalent wrapper:

```powershell
scripts/run_android_capacitor_wrapper_dev.ps1
```

Build Android debug package:

```powershell
python tools/android_capacitor_wrapper.py build-debug
```

Build Android release package:

```powershell
python tools/android_capacitor_wrapper.py build-release
```

Equivalent wrapper for either variant:

```powershell
scripts/package_android_capacitor_wrapper.ps1 -Variant debug
scripts/package_android_capacitor_wrapper.ps1 -Variant release
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

- Metadata file: `client-android-capacitor/store-placeholders/android-store-metadata.placeholder.json`
- Placeholder assets: `client-android-capacitor/store-placeholders/*.txt`
- `art_status` must remain `placeholder-only` for first-slice packaging.
