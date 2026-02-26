param(
  [switch]$CleanWeb
)

$wrapperScript = Join-Path $PSScriptRoot "wrapper_steam_tauri.ps1"
$wrapperParams = @{
  Mode = "prepare"
}
if ($CleanWeb) {
  $wrapperParams["CleanWeb"] = $true
}

& $wrapperScript @wrapperParams
exit $LASTEXITCODE
