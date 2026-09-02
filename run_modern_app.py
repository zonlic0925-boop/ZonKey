"""ZonKey 脱敏工作台 — 孟菲斯风格统一界面
图纸脱敏 + 公文 PDF + Word + 规则 + 审计
React + Tailwind CSS + FastAPI Native Bridge
"""

import sys
import time
import webbrowser
import threading
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _safe_print(msg: str) -> None:
    """Windows GBK 控制台兼容输出，避免 emoji 导致进程崩溃。"""
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", errors="replace").decode("ascii"))


def main():
    from core.brand import APP_NAME, APP_TAGLINE

    _safe_print("=" * 65)
    _safe_print(f"[{APP_NAME}] {APP_TAGLINE}")
    _safe_print(f"[{APP_NAME}] 图纸脱敏 / 公文 PDF / Word / 规则 / 审计")
    _safe_print("=" * 65)

    server_url = "http://127.0.0.1:8765"
    dist_dir = PROJECT_ROOT / "dist_web"
    if not dist_dir.exists():
        _safe_print("[!] 警告: dist_web 未找到，请先执行: cd frontend && npm run build")

    _safe_print("[*] 正在启动本地脱敏引擎与 Bridge 服务...")
    _safe_print(f"[*] 主控台地址: {server_url}")

    def open_web():
        time.sleep(1.2)
        try:
            webbrowser.open(server_url)
            _safe_print(f"[OK] 已自动打开脱敏工作台: {server_url}")
        except Exception as e:
            _safe_print(f"[!] 打开浏览器失败，请手动访问: {server_url} ({e})")

    threading.Thread(target=open_web, daemon=True).start()

    from server_bridge import app
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")


if __name__ == "__main__":
    main()
