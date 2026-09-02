@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%..\..\.."
cd /d "%PROJECT_DIR%"
if errorlevel 1 goto :fail_cd

set "SPEC_FILE=%SCRIPT_DIR%..\config\ZonKey.spec"
set "PYINSTALLER_CONFIG_DIR=%PROJECT_DIR%\build\.pyinstaller-cache"

echo ========================================================
echo   ZonKey EXE Build
echo ========================================================

where python >nul 2>&1
if errorlevel 1 goto :fail_python

if not exist "dist_web\index.html" goto :fail_distweb

python -m pip install -q pyinstaller pywebview
if errorlevel 1 goto :fail_pip

if not exist "%PYINSTALLER_CONFIG_DIR%" mkdir "%PYINSTALLER_CONFIG_DIR%"
set "PYINSTALLER_CONFIG_DIR=%PYINSTALLER_CONFIG_DIR%"

python -m PyInstaller --noconfirm "%SPEC_FILE%"
if errorlevel 1 goto :fail_pyinstaller

echo.
echo DONE: %PROJECT_DIR%\dist\ZonKey\ZonKey.exe
pause
endlocal
exit /b 0

:fail_cd
echo ERROR: cannot cd to project root
pause
exit /b 1

:fail_python
echo ERROR: Python not found
pause
exit /b 1

:fail_distweb
echo ERROR: dist_web not built. Run: cd frontend ^&^& npm run build
pause
exit /b 1

:fail_pip
echo ERROR: pip install failed
pause
exit /b 1

:fail_pyinstaller
echo ERROR: PyInstaller failed
pause
exit /b 1
