@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "PORT=80"
if exist data\runtime-config.cmd call data\runtime-config.cmd

powershell -NoProfile -ExecutionPolicy Bypass -Command "$hosts = Join-Path $env:WINDIR 'System32\drivers\etc\hosts'; $entry = '127.0.0.1 text.me'; $exists = Select-String -Path $hosts -Pattern '(^|\s)text\.me(\s|$)' -Quiet -ErrorAction SilentlyContinue; if ($exists) { exit 0 }; $command = 'Add-Content -Path """' + $hosts + '""" -Value ""`n' + $entry + '""'; Start-Process PowerShell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command', $command"

if errorlevel 1 (
  echo Failed to add text.me to the hosts file, or the admin prompt was cancelled.
  pause
  exit /b 1
)

echo text.me was added to the Windows hosts file.
if "%PORT%"=="80" (
  echo Open: http://text.me
) else (
  echo Open: http://text.me:%PORT%
)
pause
exit /b 0
