@echo off
setlocal EnableExtensions

set "PORT=80"
if exist data\runtime-config.cmd call data\runtime-config.cmd

for /f %%P in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)"') do set "PID=%%P"

if not defined PID (
  echo Text.Me LAN is not running on port %PORT%.
  exit /b 0
)

taskkill /PID %PID% /F >nul 2>nul
if errorlevel 1 (
  echo Could not stop Text.Me LAN.
  exit /b 1
)

echo Text.Me LAN stopped.
exit /b 0
