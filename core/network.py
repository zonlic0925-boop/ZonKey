"""局域网绑定与手机端访问辅助。"""

from __future__ import annotations

import socket


def get_lan_ip() -> str | None:
    """获取本机局域网 IPv4（用于手机浏览器访问）。"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
    except OSError:
        pass
    try:
        host = socket.gethostname()
        for info in socket.getaddrinfo(host, None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127."):
                return ip
    except OSError:
        pass
    return None


def resolve_bind_host(lan: bool) -> str:
    return "0.0.0.0" if lan else "127.0.0.1"
