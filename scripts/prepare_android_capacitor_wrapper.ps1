param(
  [switch]$CleanWeb
)

$wrapperScript = Join-Path $PSScriptRoot "wrapper_android_capacitor.ps1"
$wrapperParams = @{
  Mode = "prepare"
}
if ($CleanWeb) {
  $wrapperParams["CleanWeb"] = $true
}

& $wrapperScript @wrapperParams
exit $LASTEXITCODE
