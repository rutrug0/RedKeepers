@echo off
setlocal

set "ROOT=%~dp0"
set "RK_PYTHON=C:\Users\Patrik\AppData\Local\Programs\Python\Python310\python.exe"

if not exist "%RK_PYTHON%" (
  echo [run-daemon] Configured interpreter not found: "%RK_PYTHON%"
  echo [run-daemon] Update run-daemon.bat and coordination\policies\runtime-policy.yaml.
  exit /b 1
)

set "REDKEEPERS_PYTHON_CMD=%RK_PYTHON%"
for %%I in ("%RK_PYTHON%") do set "RK_PYTHON_DIR=%%~dpI"
set "PATH=%RK_PYTHON_DIR%;%PATH%"

if "%~1"=="" (
  "%RK_PYTHON%" "%ROOT%tools\orchestrator.py" run
  exit /b %ERRORLEVEL%
)

"%RK_PYTHON%" "%ROOT%tools\orchestrator.py" %*
exit /b %ERRORLEVEL%
