@echo off
setlocal EnableExtensions

cd /d "%~dp0.."

if not exist data mkdir data
if exist data\.windows-setup-complete del /f /q data\.windows-setup-complete >nul 2>nul

call windows\start-textme.bat
