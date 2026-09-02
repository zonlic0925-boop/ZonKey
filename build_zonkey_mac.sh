#!/usr/bin/env bash
# 一键构建 macOS 版 ZonKey.app（从项目根目录调用）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${ROOT}/packaging/macos/scripts/build_app.sh"
