@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title ZonScale Build

echo ========================================================
echo   ZonScale EXE Build
echo   by zonlic
echo ========================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.11+ and add to PATH.
    pause
    exit /b 1
)

if not exist "dist_web\index.html" (
    echo dist_web missing. Building frontend...
    if not exist "frontend\package.json" (
        echo ERROR: frontend folder not found.
        pause
        exit /b 1
    )
    pushd frontend
    call npm run build
    if errorlevel 1 (
        echo ERROR: npm run build failed.
        popd
        pause
        exit /b 1
    )
    popd
)

if not exist "packaging\windows\config\ZonScale.spec" (
    echo ERROR: Spec file not found: packaging\windows\config\ZonScale.spec
    pause
    exit /b 1
)

echo Checking clean release rules (no vendor logos / no builtin company terms)...
python -c "from pathlib import Path; from core.detector.rule_engine import load_terms; root=Path('.').resolve(); logos=list((root/'rules'/'logos').glob('*.png'))+list((root/'rules'/'logos').glob('*.jpg'))+list((root/'rules'/'logos').glob('*.jpeg'))+list((root/'rules'/'logos').glob('*.bmp')); assert not logos, logos; banned={'FISHER','EMERSON','TOPWORX','MKS','MARSHALLTOWN'}; terms=[t.upper() for t in load_terms(root/'rules'/'sensitive_terms.txt')]; bad=[t for t in terms if any(b in t for b in banned)]; assert not bad, bad; print('clean rules OK')"
if errorlevel 1 (
    echo ERROR: rules/ is not clean for public release. Remove vendor logos and company terms.
    pause
    exit /b 1
)

echo Installing build deps...
python -m pip install -q pyinstaller pywebview
if errorlevel 1 (
    echo ERROR: pip install failed.
    pause
    exit /b 1
)

if not exist "build\.pyinstaller-cache" mkdir "build\.pyinstaller-cache"
set "PYINSTALLER_CONFIG_DIR=%CD%\build\.pyinstaller-cache"

echo.
echo Cleaning previous dist\ZonScale ...
if exist "dist\ZonScale" rmdir /s /q "dist\ZonScale"

echo.
echo Building EXE (about 3-8 minutes)...
python -m PyInstaller --noconfirm "packaging\windows\config\ZonScale.spec"
if errorlevel 1 (
    echo ERROR: PyInstaller build failed. See log above.
    pause
    exit /b 1
)

echo.
echo Running release acceptance (generic rules, no vendor terms)...
python scripts\release_acceptance.py --exe-dir dist\ZonScale
if errorlevel 1 (
    echo ERROR: release acceptance failed.
    pause
    exit /b 1
)

echo.
echo Packaging ZIP for distribution...
python scripts\package_exe_zip.py
if errorlevel 1 (
    echo ERROR: ZIP packaging failed.
    pause
    exit /b 1
)

echo.
echo DONE.
echo Output folder: %CD%\dist\ZonScale\
echo Run EXE:       dist\ZonScale\ZonScale.exe
echo Release ZIP:   dist_release\ZonScale_Windows_x64_*.zip
echo.
pause
endlocal
