param(
  [switch]$Once,
  [switch]$DryRun,
  [switch]$Verbose
)

$cmd = @('python', 'tools/orchestrator.py')
if ($Once) {
  $cmd += 'once'
} else {
  $cmd += 'run'
}
if ($DryRun) { $cmd += '--dry-run' }
if ($Verbose) { $cmd += '--verbose' }

Write-Host ("Running: " + ($cmd -join ' '))
& $cmd[0] $cmd[1..($cmd.Length-1)]
exit $LASTEXITCODE
