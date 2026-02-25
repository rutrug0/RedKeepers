param(
  [switch]$InitGit,
  [switch]$InitialCommit
)

if ($InitGit) {
  if (-not (Test-Path .git)) {
    git init -b main
    Write-Host 'Initialized git repository on main.'
  } else {
    Write-Host 'Git repository already exists.'
  }
}

if ($InitialCommit) {
  if (-not (Test-Path .git)) {
    throw 'Git repository not initialized. Use -InitGit first.'
  }
  git add -A
  git commit -m "Bootstrap RedKeepers orchestrator foundation"
}
