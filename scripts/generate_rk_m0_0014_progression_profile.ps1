param(
  [string]$SeedProfile = "tests/fixtures/rk-m0-0014-progression-profile.json",
  [string]$Output = "coordination/runtime/first-slice-progression/rk-m0-0014-progression-profile.json"
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
  python tools/rk_m0_0014_progression_profile.py --seed-profile $SeedProfile --output $Output
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
