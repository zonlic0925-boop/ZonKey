@echo off
rem 独立驻留 Cloudflare 隧道（脱离 ZCode 会话）；地址写入 手机端访问地址.txt
cd /d "%~dp0.."
title ZonScale Tunnel (detached)
python scripts\public_tunnel.py
pause
