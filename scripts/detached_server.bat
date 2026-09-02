@echo off
rem 独立驻留服务（脱离 ZCode 会话）；与 启动公网手机访问.bat 内的 uvicorn 参数一致，另开放局域网
cd /d "%~dp0.."
title ZonKey Server (detached)
python -m uvicorn server_bridge:app --host 0.0.0.0 --port 8765 --log-level warning
pause
