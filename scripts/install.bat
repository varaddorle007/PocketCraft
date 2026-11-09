@echo off
setlocal
cd /d "%~dp0\.."
echo Launching PocketCraft Windows Setup...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0\setup-windows.ps1"
if %errorlevel% neq 0 (
    echo [ERROR] Setup encountered an issue.
)
echo.
echo Press any key to exit setup...
pause >nul
