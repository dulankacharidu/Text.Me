@echo off
setlocal

cd /d "%~dp0"

echo [Text.Me] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Install Node.js from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

echo [Text.Me] Installing dependencies if needed...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo [Text.Me] Starting server at http://localhost:3000
call npm start

endlocal
