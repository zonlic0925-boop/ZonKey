@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 工程图纸脱敏系统
echo ========================================================
echo   工程图纸脱敏系统 — 本地离线
echo   Fisher · Emerson · TopWorx · MKS
echo ========================================================
echo.
python main_ui.py
if %errorlevel% neq 0 (
    echo.
    echo 启动失败，请检查 Python 环境与依赖：
    echo   pip install -r requirements.txt
    pause
)
