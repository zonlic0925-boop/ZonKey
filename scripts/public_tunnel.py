"""Cloudflare 快速隧道包装（启动公网手机访问.bat 调用）。

启动 cloudflared 并实时透传日志；从输出中解析 trycloudflare 公网地址，
写入项目根目录的「手机端访问地址.txt」，手机端以该文件为准获取最新地址。
快速隧道地址每次重启都会变化，旧地址自动失效，以最新文件内容为准。
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = ROOT / "手机端访问地址.txt"
URL_RE = re.compile(r"https://[a-z0-9][a-z0-9-]*\.trycloudflare\.com", re.IGNORECASE)


def write_address_file(url: str) -> None:
    content = (
        "ZonScale 手机端访问地址（公网）\n"
        f"地址: {url}\n"
        f"更新时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        "\n"
        "使用规则:\n"
        "1. 手机浏览器打开上面的地址即可使用全部功能，处理在本机离线完成。\n"
        "2. 此地址由 启动公网手机访问.bat 生成，每次重启该脚本都会变化，\n"
        "   以本文件的最新内容为准（脚本每次启动自动更新本文件）。\n"
        "3. 关闭 bat 窗口即下线；电脑重启后需重新运行该脚本。\n"
        "4. 局域网内（同一 WiFi）优先用 启动局域网手机访问.bat，速度更快。\n"
    )
    OUT_FILE.write_text(content, encoding="utf-8")
    print(f"\n[OK] 公网地址已写入: {OUT_FILE}")
    print(f"[OK] 手机端请访问: {url}\n")


def main() -> int:
    cmd = ["cloudflared", "tunnel", "--url", "http://127.0.0.1:8765"]
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace",
    )
    captured = False
    assert proc.stdout is not None
    for line in proc.stdout:
        sys.stdout.write(line)
        sys.stdout.flush()
        if not captured:
            match = URL_RE.search(line)
            if match:
                captured = True
                try:
                    write_address_file(match.group(0))
                except OSError as exc:
                    print(f"[WARN] 地址文件写入失败: {exc}")
    return proc.wait()


if __name__ == "__main__":
    if os.name == "nt":
        try:
            sys.stdout.reconfigure(line_buffering=True)
        except Exception:
            pass
    sys.exit(main())
