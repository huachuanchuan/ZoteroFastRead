@echo off
setlocal enabledelayedexpansion

REM Build fastRead backend server executable on Windows host.
REM Run this script in Windows (not WSL): it packages server.py to bin/fastread-server.exe.

set "ROOT_DIR=%~dp0"
set "SERVER_PY=%ROOT_DIR%server.py"
set "BIN_DIR=%ROOT_DIR%bin"
set "DIST_DIR=%ROOT_DIR%dist"
set "BUILD_DIR=%ROOT_DIR%build"
set "SPEC_FILE=%ROOT_DIR%fastread-server.spec"
set "BABELDOC_SRC=%ROOT_DIR%.sisyphus\BabelDOC"
set "PY312_EXE=%USERPROFILE%\AppData\Local\Programs\Python\Python312\python.exe"
set "PYTHON_CMD="
set "PYTHON_ARGS="

if not exist "%SERVER_PY%" (
  echo [ERROR] Missing %SERVER_PY%
  exit /b 1
)

if exist "%PY312_EXE%" (
  set "PYTHON_CMD=%PY312_EXE%"
) else (
  py -3.12 --version >nul 2>&1
  if not errorlevel 1 (
    set "PYTHON_CMD=py"
    set "PYTHON_ARGS=-3.12"
  )
)

if "%PYTHON_CMD%"=="" (
  python --version >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] Python 3.12 was not found and Python is not available in PATH.
    exit /b 1
  )
  set "PYTHON_CMD=python"
)

if not exist "%BABELDOC_SRC%\babeldoc\main.py" (
  echo [ERROR] Missing vendored BabelDOC source: %BABELDOC_SRC%
  exit /b 1
)

echo [INFO] Using Python command: %PYTHON_CMD% %PYTHON_ARGS%

echo [1/5] Installing/upgrading packaging dependencies...
"%PYTHON_CMD%" %PYTHON_ARGS% -m pip install --upgrade pip >nul
if errorlevel 1 (
  echo [ERROR] Failed to upgrade pip.
  exit /b 1
)

"%PYTHON_CMD%" %PYTHON_ARGS% -m pip install --upgrade pyinstaller fastapi uvicorn pydantic python-multipart requests pypdf reportlab >nul
if errorlevel 1 (
  echo [ERROR] Failed to install PyInstaller/FastAPI dependencies.
  exit /b 1
)

"%PYTHON_CMD%" %PYTHON_ARGS% -m pip install --upgrade -e "%BABELDOC_SRC%" >nul
if errorlevel 1 (
  echo [ERROR] Failed to install vendored BabelDOC.
  exit /b 1
)

"%PYTHON_CMD%" %PYTHON_ARGS% -c "import babeldoc.main" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] BabelDOC import check failed in selected Python runtime.
  exit /b 1
)

if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

echo [2/5] Cleaning previous build artifacts...
if exist "%DIST_DIR%" rmdir /s /q "%DIST_DIR%"
if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
if exist "%SPEC_FILE%" del /q "%SPEC_FILE%"
if exist "%BIN_DIR%\fastread-server.exe" del /q "%BIN_DIR%\fastread-server.exe"

echo [3/5] Running PyInstaller...
"%PYTHON_CMD%" %PYTHON_ARGS% -m PyInstaller --noconfirm --clean --onefile --noconsole --exclude-module PyQt6 --exclude-module PySide6 --exclude-module PySide6_Essentials --exclude-module PySide6_Addons --collect-all babeldoc --collect-all tiktoken --collect-all tiktoken_ext --collect-all rich --name fastread-server --distpath "%DIST_DIR%" --workpath "%BUILD_DIR%" "%SERVER_PY%"
if errorlevel 1 (
  echo [ERROR] PyInstaller build failed.
  exit /b 1
)

if not exist "%DIST_DIR%\fastread-server.exe" (
  echo [ERROR] Build output not found: %DIST_DIR%\fastread-server.exe
  exit /b 1
)

echo [4/5] Copying executable to plugin bin directory...
copy /y "%DIST_DIR%\fastread-server.exe" "%BIN_DIR%\fastread-server.exe" >nul
if errorlevel 1 (
  echo [ERROR] Failed to copy executable into bin directory.
  exit /b 1
)

echo [5/5] Smoke test backend executable...
set "HEALTH_URL=http://127.0.0.1:8000/health"
set "PID_FILE=%ROOT_DIR%fastread-server.pid"
set "POWERSHELL_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set "TASKKILL_EXE=%SystemRoot%\System32\taskkill.exe"

if exist "%TASKKILL_EXE%" (
  "%TASKKILL_EXE%" /IM fastread-server.exe /T /F >nul 2>&1
)

if not exist "%POWERSHELL_EXE%" (
  echo [ERROR] PowerShell not found at %POWERSHELL_EXE%
  exit /b 1
)

"%POWERSHELL_EXE%" -NoProfile -ExecutionPolicy Bypass -Command ^
  "$proc = Start-Process -FilePath '%BIN_DIR%\fastread-server.exe' -PassThru -WindowStyle Hidden;" ^
  "$proc.Id | Out-File -FilePath '%PID_FILE%' -Encoding ascii"
if errorlevel 1 (
  echo [ERROR] Failed to start fastread-server.exe for smoke test.
  exit /b 1
)

set "READY=0"
for /l %%i in (1,1,20) do (
  "%POWERSHELL_EXE%" -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { $r = Invoke-WebRequest -Uri '%HEALTH_URL%' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 (
    set "READY=1"
    goto :stop_smoke
  )
  "%POWERSHELL_EXE%" -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 1" >nul
)

:stop_smoke
if exist "%PID_FILE%" (
  set /p SERVER_PID=<"%PID_FILE%"
  if not "%SERVER_PID%"=="" taskkill /PID %SERVER_PID% /T /F >nul 2>&1
  del /q "%PID_FILE%" >nul 2>&1
)

if "%READY%"=="0" (
  echo [ERROR] Smoke test failed: %HEALTH_URL% did not return HTTP 200.
  exit /b 1
)

echo Built: %BIN_DIR%\fastread-server.exe
exit /b 0
