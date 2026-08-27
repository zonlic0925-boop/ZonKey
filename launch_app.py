"""ZonScale launcher: free port 8765 if occupied, then start uvicorn + open browser."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
import webbrowser
import threading
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
PORT = 8765
HOST = "127.0.0.1"
URL = f"http://127.0.0.1:{PORT}"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def log(msg: str) -> None:
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", errors="replace").decode("ascii"))


def free_port(port: int) -> None:
    """Kill process listening on port (Windows / macOS / Linux)."""
    from core.port_util import free_port as _free_port

    _free_port(port, log=log)


def main() -> None:
    global HOST

    parser = argparse.ArgumentParser(description="ZonScale launcher")
    parser.add_argument(
        "--lan",
        action="store_true",
        help="bind 0.0.0.0 for phone browser on same WiFi",
    )
    args = parser.parse_args()

    from core.brand import APP_NAME, APP_TAGLINE
    from core.network import get_lan_ip, resolve_bind_host

    if args.lan:
        HOST = resolve_bind_host(True)

    log("=" * 60)
    log(f"[{APP_NAME}] {APP_TAGLINE}")
    log(f"[{APP_NAME}] Drawing / PDF / Word / Rules / Audit")
    log("=" * 60)

    dist_dir = PROJECT_ROOT / "dist_web"
    if not dist_dir.exists():
        log("[!] dist_web not found. Run: cd frontend && npm run build")

    free_port(PORT)

    log(f"[*] Local URL: http://127.0.0.1:{PORT}")
    if args.lan:
        lan_ip = get_lan_ip()
        if lan_ip:
            log(f"[*] Phone URL: http://{lan_ip}:{PORT}  (same WiFi required)")
        else:
            log("[!] LAN IP not detected; check ipconfig for IPv4")
    else:
        log(f"[*] Starting backend on {URL}")

    def open_browser():
        time.sleep(1.2)
        try:
            webbrowser.open(URL)
            log(f"[OK] Open browser: {URL}")
        except Exception as exc:
            log(f"[!] Open browser failed, visit manually: {URL} ({exc})")

    threading.Thread(target=open_browser, daemon=True).start()

    from server_bridge import app
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()
