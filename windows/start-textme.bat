@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0.."
cd /d "%ROOT_DIR%"

set "APP_NAME=Text.Me LAN"
set "PORT=80"
set "HOST_ALIAS=text.me"
set "STARTUP_LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Text.Me LAN.lnk"
set "SETUP_MARKER=data\.windows-setup-complete"
set "CONFIG_FILE=data\runtime-config.cmd"

if not exist data mkdir data
if exist "%CONFIG_FILE%" call "%CONFIG_FILE%"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not installed or not on PATH.
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
  call :PromptOptionalSetup
  > "%SETUP_MARKER%" echo configured
)

if exist node_modules if not exist "%SETUP_MARKER%" (
  echo First-time Windows setup options:
  call :PromptOptionalSetup
  > "%SETUP_MARKER%" echo configured
)

call :IsPortListening
if "%LISTENING%"=="1" (
  echo %APP_NAME% is already running.
  call :OpenBrowser
  exit /b 0
)

echo Starting %APP_NAME% in background...
wscript.exe "%~dp0launch-textme-hidden.vbs"
timeout /t 2 /nobreak >nul

call :IsPortListening
if "%LISTENING%"=="1" (
  echo %APP_NAME% is running on:
  call :PrintUrls
  call :OpenBrowser
  exit /b 0
)

echo [ERROR] The server did not start correctly.
echo Check data\server.log for details.
pause
exit /b 1

:PromptOptionalSetup
echo.
call :PromptPortSelection
echo.
choice /c YN /n /m "Add Text.Me LAN to Windows startup? [Y/N]: "
if errorlevel 2 goto skip_startup
call :CreateStartupShortcut
:skip_startup

echo.
if "%PORT%"=="80" (
  echo The hosts entry can create http://%HOST_ALIAS% on this PC.
) else (
  echo The hosts entry can create http://%HOST_ALIAS%:%PORT% on this PC.
  echo It cannot remove the :%PORT% part unless the server runs on port 80.
)
choice /c YN /n /m "Add %HOST_ALIAS% to the Windows hosts file? [Y/N]: "
if errorlevel 2 goto :eof
call :EnsureHostsEntry
goto :eof

:PromptPortSelection
echo Choose the server port:
echo   [1] 80  ^(Default, opens as http://%HOST_ALIAS%^)
echo   [2] 3000
echo   [3] Custom port
choice /c 123 /n /m "Select port [1/2/3]: "
if errorlevel 3 goto custom_port
if errorlevel 2 (
  set "PORT=3000"
  goto save_port
)
set "PORT=80"
goto save_port

:custom_port
set /p "PORT=Enter custom port number: "
if not defined PORT set "PORT=80"

:save_port
for /f "delims=0123456789" %%A in ("%PORT%") do set "PORT="
if not defined PORT set "PORT=80"
if %PORT% LSS 1 set "PORT=80"
if %PORT% GTR 65535 set "PORT=80"
> "%CONFIG_FILE%" echo @echo off
>> "%CONFIG_FILE%" echo set "PORT=%PORT%"
goto :eof

:CreateStartupShortcut
powershell -NoProfile -ExecutionPolicy Bypass -Command "$shortcutPath = [Environment]::ExpandEnvironmentVariables('%STARTUP_LINK%'); $target = 'wscript.exe'; $arguments = '""%~dp0launch-textme-hidden.vbs""'; $workingDir = '%ROOT_DIR%'; $icon = (Get-Command node).Source; $shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut($shortcutPath); $shortcut.TargetPath = $target; $shortcut.Arguments = $arguments; $shortcut.WorkingDirectory = $workingDir; $shortcut.IconLocation = $icon + ',0'; $shortcut.Save()" >nul 2>nul
if errorlevel 1 (
  echo [WARN] Could not create the startup shortcut.
) else (
  echo Startup shortcut created.
)
goto :eof

:EnsureHostsEntry
powershell -NoProfile -ExecutionPolicy Bypass -Command "$hosts = Join-Path $env:WINDIR 'System32\drivers\etc\hosts'; $pattern = '(^|\s)text\.me(\s|$)'; $existing = Select-String -Path $hosts -Pattern $pattern -Quiet -ErrorAction SilentlyContinue; if ($existing) { exit 0 }; $command = 'Add-Content -Path """' + $hosts + '""" -Value ""`n127.0.0.1 text.me""'; Start-Process PowerShell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command', $command" >nul 2>nul
if errorlevel 1 (
  echo [WARN] Hosts file update was cancelled or failed.
) else (
  if "%PORT%"=="80" (
    echo Hosts entry added. You can open http://%HOST_ALIAS% on this PC.
  ) else (
    echo Hosts entry added. You can open http://%HOST_ALIAS%:%PORT% on this PC.
  )
)
goto :eof

:IsPortListening
set "LISTENING="
for /f %%P in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)"') do set "LISTENING=1"
if not defined LISTENING set "LISTENING=0"
goto :eof

:PrintUrls
if "%PORT%"=="80" (
  echo   http://localhost
  echo   http://%HOST_ALIAS%
) else (
  echo   http://localhost:%PORT%
  echo   http://%HOST_ALIAS%:%PORT%
)
goto :eof

:OpenBrowser
if "%PORT%"=="80" (
  start "" "http://localhost"
) else (
  start "" "http://localhost:%PORT%"
)
goto :eof
