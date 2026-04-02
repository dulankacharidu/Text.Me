@echo off
setlocal EnableExtensions

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$hosts = Join-Path $env:WINDIR 'System32\drivers\etc\hosts'; $command = '$path = """' + $hosts + '"""; $lines = Get-Content -Path $path -ErrorAction SilentlyContinue; if ($null -eq $lines) { exit 0 }; $filtered = $lines | Where-Object { $_ -notmatch ""(^|\s)text\.me(\s|$)"" }; Set-Content -Path $path -Value $filtered'; Start-Process PowerShell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command', $command"

if errorlevel 1 (
  echo Failed to remove text.me from the hosts file, or the admin prompt was cancelled.
  pause
  exit /b 1
)

echo text.me was removed from the Windows hosts file.
pause
exit /b 0
