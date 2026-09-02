@echo off
setlocal
cd /d "%~dp0"
title ZonKey Public Web Mode

echo ========================================================
echo   ZonKey - Public Web Mode (Cloudflare Tunnel)
echo   Phone / computer on ANY network can access all features.
echo   Processing still happens on THIS machine (offline engine).
echo ========================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found.
  pause
  exit /b 1
)

where cloudflared >nul 2>&1
if errorlevel 1 (
  echo [ERROR] cloudflared not found in PATH. Install from:
  echo         https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  pause
  exit /b 1
)

if not exist "dist_web\index.html" (
  echo [ERROR] dist_web missing. Run: cd frontend ^&^& npm run build
  pause
  exit /b 1
)

rem Free port 8765 (kill stale server instance)
python -c "from core.port_util import free_port; free_port(8765, log=lambda m: None)" >nul 2>&1

echo [*] Starting local server (minimized window)...
start "ZonKey Server" /min cmd /c "python -m uvicorn server_bridge:app --host 127.0.0.1 --port 8765 --log-level warning"

timeout /t 4 /nobreak >nul

echo [*] Opening Cloudflare Tunnel...
echo.
echo ========================================================
echo   Public URL is the https://....trycloudflare.com line
echo   printed below. Open it on your phone.
echo   The URL is also saved to 手机端访问地址.txt
echo   (always check that file for the latest address).
echo   NOTE: URL changes each time you restart this script.
echo   Keep this window OPEN - closing it takes the site down.
echo ========================================================
echo.
python "%~dp0scripts\public_tunnel.py"

pause
endlocal
