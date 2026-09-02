#!/usr/bin/env bash
# 开发模式：启动 ZonKey 后端 + 浏览器（macOS 双击可运行）
cd "$(dirname "$0")"
exec python3 launch_app.py
