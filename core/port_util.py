"""跨平台释放本地 HTTP 端口（桌面入口启动前）。"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from typing import Callable


def free_port(port: int, log: Callable[[str], None] | None = None) -> None:
    """若端口被其他进程占用，尝试结束占用者（不含当前进程）。"""
    emit = log or (lambda _msg: None)
    my_pid = str(os.getpid())

    if sys.platform == "win32":
        _free_port_windows(port, my_pid, emit)
    elif sys.platform == "darwin":
        _free_port_unix(port, my_pid, emit, use_lsof=True)
    else:
        _free_port_unix(port, my_pid, emit, use_lsof=False)


def _free_port_windows(port: int, my_pid: str, emit: Callable[[str], None]) -> None:
    try:
        out = subprocess.check_output(
            f'netstat -ano | findstr ":{port}"',
            shell=True,
            text=True,
            errors="ignore",
        )
    except subprocess.CalledProcessError:
        return

    for line in out.splitlines():
        if "LISTENING" not in line.upper():
            continue
        parts = line.split()
        if not parts:
            continue
        pid = parts[-1]
        if pid.isdigit() and pid != my_pid:
            emit(f"[*] 端口 {port} 被 PID {pid} 占用，正在释放...")
            subprocess.run(
                ["taskkill", "/F", "/PID", pid],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            time.sleep(0.5)


def _free_port_unix(
    port: int,
    my_pid: str,
    emit: Callable[[str], None],
    *,
    use_lsof: bool,
) -> None:
    pids: set[str] = set()
    if use_lsof:
        try:
            out = subprocess.check_output(
                ["lsof", "-ti", f"TCP:{port}", "-sTCP:LISTEN"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
            pids.update(pid for pid in out.split() if pid.isdigit())
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
    else:
        try:
            out = subprocess.check_output(
                ["fuser", f"{port}/tcp"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
            pids.update(pid for pid in out.split() if pid.isdigit())
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass

    for pid in pids:
        if pid == my_pid:
            continue
        emit(f"[*] 端口 {port} 被 PID {pid} 占用，正在释放...")
        subprocess.run(["kill", "-9", pid], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(0.5)
