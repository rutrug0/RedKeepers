param(
  [switch]$SkipPrepare,
  [switch]$CleanWeb
)

$wrapperScript = Join-Path $PSScriptRoot "wrapper_android_capacitor.ps1"
$wrapperParams = @{
  Mode = "sync"
}
if ($SkipPrepare) {
  $wrapperParams["SkipPrepare"] = $true
}
if ($CleanWeb) {
  $wrapperParams["CleanWeb"] = $true
}

& $wrapperScript @wrapperParams
exit $LASTEXITCODE
