param(
  [switch]$SkipPrepare,
  [switch]$CleanWeb
)

$wrapperScript = Join-Path $PSScriptRoot "wrapper_steam_tauri.ps1"
$wrapperParams = @{
  Mode = "dev"
}
if ($SkipPrepare) {
  $wrapperParams["SkipPrepare"] = $true
}
if ($CleanWeb) {
  $wrapperParams["CleanWeb"] = $true
}

& $wrapperScript @wrapperParams
exit $LASTEXITCODE
