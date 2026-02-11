@echo off
setlocal

cd /d "%~dp0"

echo ==============================================
echo   Text.Me LAN - Windows Launcher
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo Starting Text.Me LAN on http://localhost:3000
call npm start

endlocal
