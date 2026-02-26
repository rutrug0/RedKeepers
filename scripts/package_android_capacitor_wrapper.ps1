param(
  [ValidateSet("debug", "release")]
  [string]$Variant = "debug",
  [switch]$SkipSync,
  [switch]$SkipPrepare,
  [switch]$CleanWeb
)

$wrapperScript = Join-Path $PSScriptRoot "wrapper_android_capacitor.ps1"
$mode = if ($Variant -eq "release") { "build-release" } else { "build-debug" }
$wrapperParams = @{
  Mode = $mode
}
if ($SkipSync) {
  $wrapperParams["SkipSync"] = $true
}
if ($SkipPrepare) {
  $wrapperParams["SkipPrepare"] = $true
}
if ($CleanWeb) {
  $wrapperParams["CleanWeb"] = $true
}

& $wrapperScript @wrapperParams
exit $LASTEXITCODE
