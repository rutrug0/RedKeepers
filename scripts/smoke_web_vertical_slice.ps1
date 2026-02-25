param(
  [string]$BindHost = "127.0.0.1",
  [int]$Port = 0
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
  python tools/web_vertical_slice_packaging.py smoke --host $BindHost --port $Port
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
