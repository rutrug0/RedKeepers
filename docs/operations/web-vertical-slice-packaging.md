# Web Vertical Slice Packaging (M0)

This runbook defines the reproducible web-first packaging path for the first vertical slice.

## Scope Guard

- Source of truth for packaged client files: `client-web/`
- Placeholder assets only for release/store metadata
- No dependency on final art

## Commands

Build/package artifact (single command):

```powershell
python tools/web_vertical_slice_packaging.py package --clean
```

Equivalent wrapper:

```powershell
scripts/package_web_vertical_slice.ps1 -Clean
```

Run local smoke against packaged artifact:

```powershell
python tools/web_vertical_slice_packaging.py smoke
```

Equivalent wrapper:

```powershell
scripts/smoke_web_vertical_slice.ps1
```

## Outputs

- Artifact zip: `coordination/runtime/web-vertical-slice/artifacts/redkeepers-web-vertical-slice.zip`
- Artifact checksum: `coordination/runtime/web-vertical-slice/artifacts/redkeepers-web-vertical-slice.zip.sha256`
- Expanded package root: `coordination/runtime/web-vertical-slice/staging/`
- Artifact manifest (inside package): `artifact-manifest.json`
- Smoke extraction root: `coordination/runtime/web-vertical-slice/smoke-run/`

## Determinism Notes

- Packaging order is lexicographic by relative path.
- Zip entry timestamps are fixed to `1980-01-01T00:00:00Z`.
- File hashes in `artifact-manifest.json` use SHA256.

## Placeholder Release Metadata

- Metadata file: `client-web/release-metadata.placeholder.json`
- Placeholder asset references: `client-web/release-placeholders/*.txt`
- `art_status` must remain `placeholder-only` during this slice.
