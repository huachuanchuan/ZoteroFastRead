@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
pushd "%ROOT_DIR%" >nul

echo [1/2] Building fastRead-Python.xpi...
node build-python.js
if errorlevel 1 (
  echo [ERROR] Build failed. Zotero will not start.
  popd >nul
  exit /b 1
)

set "ZOTERO_EXE="
if exist "C:\Program Files\Zotero\zotero.exe" set "ZOTERO_EXE=C:\Program Files\Zotero\zotero.exe"
if "%ZOTERO_EXE%"=="" if exist "%LOCALAPPDATA%\Programs\Zotero\zotero.exe" set "ZOTERO_EXE=%LOCALAPPDATA%\Programs\Zotero\zotero.exe"
if "%ZOTERO_EXE%"=="" if exist "%LOCALAPPDATA%\Zotero\zotero.exe" set "ZOTERO_EXE=%LOCALAPPDATA%\Zotero\zotero.exe"

if "%ZOTERO_EXE%"=="" (
  echo [ERROR] Zotero executable not found.
  echo Checked:
  echo   C:\Program Files\Zotero\zotero.exe
  echo   %%LOCALAPPDATA%%\Programs\Zotero\zotero.exe
  echo   %%LOCALAPPDATA%%\Zotero\zotero.exe
  popd >nul
  exit /b 1
)

echo [2/2] Launching Zotero...
start "" "%ZOTERO_EXE%"

popd >nul
exit /b 0
