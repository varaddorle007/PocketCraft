@echo off
setlocal
cd /d "%~dp0"
echo ================================================================
echo   ⛏️ PocketCraft - Windows Setup (Windows 7 / 8 / 10 / 11)
echo ================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-windows.ps1"
if %errorlevel% neq 0 (
    echo [ERROR] Setup encountered an issue.
)
echo.
echo Press any key to exit setup...
pause >nul

