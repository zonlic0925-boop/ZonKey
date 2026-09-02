@echo off
setlocal
cd /d "%~dp0"

title ZonKey LAN Mode

echo ========================================================
echo   ZonKey - LAN mode (phone browser on same WiFi)
echo   Local:  http://127.0.0.1:8765
echo   Phone:  see LAN URL printed after server starts
echo ========================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found.
  pause
  exit /b 1
)

python "%~dp0launch_app.py" --lan
pause
endlocal
