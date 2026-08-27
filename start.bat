@echo off
setlocal
cd /d "%~dp0"

title ZonScale Workbench

echo ========================================================
echo   ZonScale Desensitization Workbench
echo   by zonlic
echo   URL: http://127.0.0.1:8765
echo ========================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found. Install Python 3.11 and add to PATH.
  pause
  exit /b 1
)

echo [*] Starting server...
python "%~dp0launch_app.py"
if errorlevel 1 (
  echo.
  echo [ERROR] Failed to start. See messages above.
)

echo.
pause
endlocal
