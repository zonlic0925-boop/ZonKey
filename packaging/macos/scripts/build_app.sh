#!/usr/bin/env bash
# ZonScale macOS .app 构建脚本（须在 macOS 上运行）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
SPEC_FILE="${SCRIPT_DIR}/../config/ZonScale.spec"
export PYINSTALLER_CONFIG_DIR="${PROJECT_DIR}/build/.pyinstaller-cache"

cd "${PROJECT_DIR}"

echo "========================================================"
echo "  ZonScale macOS .app Build"
echo "  by zonlic"
echo "========================================================"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: macOS build must run on Darwin (Mac)."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found. Install Python 3.11+ (python.org or Homebrew)."
  exit 1
fi

if [[ ! -f "dist_web/index.html" ]]; then
  echo "dist_web missing. Building frontend..."
  (cd frontend && npm run build)
fi

if [[ ! -f "${SPEC_FILE}" ]]; then
  echo "ERROR: Spec not found: ${SPEC_FILE}"
  exit 1
fi

echo "Checking clean release rules..."
python3 - <<'PY'
from pathlib import Path
from core.detector.rule_engine import load_terms

root = Path(".").resolve()
logos = []
for ext in ("*.png", "*.jpg", "*.jpeg", "*.bmp"):
    logos.extend((root / "rules" / "logos").glob(ext))
assert not logos, logos
banned = {"FISHER", "EMERSON", "TOPWORX", "MKS", "MARSHALLTOWN"}
terms = [t.upper() for t in load_terms(root / "rules" / "sensitive_terms.txt")]
bad = [t for t in terms if any(b in t for b in banned)]
assert not bad, bad
print("clean rules OK")
PY

echo "Installing build deps..."
python3 -m pip install -q pyinstaller pywebview pyobjc-core pyobjc-framework-Cocoa pyobjc-framework-WebKit

mkdir -p "${PYINSTALLER_CONFIG_DIR}"

echo "Cleaning previous dist/ZonScale.app ..."
rm -rf dist/ZonScale dist/ZonScale.app

echo "Building .app (about 5-15 minutes)..."
python3 -m PyInstaller --noconfirm "${SPEC_FILE}"

APP_PATH="dist/ZonScale.app"
MAC_BIN="${APP_PATH}/Contents/MacOS/ZonScale"
if [[ ! -d "${APP_PATH}" ]] || [[ ! -x "${MAC_BIN}" ]]; then
  echo "ERROR: Build output missing: ${APP_PATH}"
  exit 1
fi

echo "Running release acceptance..."
python3 scripts/release_acceptance.py --app-dir "${APP_PATH}"

echo "Packaging ZIP..."
python3 scripts/package_mac_app.py

if command -v hdiutil >/dev/null 2>&1; then
  DMG_PATH="dist_release/ZonScale_macOS_$(uname -m)_$(date +%Y%m%d).dmg"
  echo "Creating DMG (optional): ${DMG_PATH}"
  DMG_STAGE="${PROJECT_DIR}/build/dmg_stage"
  rm -rf "${DMG_STAGE}"
  mkdir -p "${DMG_STAGE}"
  cp -R "${APP_PATH}" "${DMG_STAGE}/"
  cp "${PROJECT_DIR}/scripts/package_mac_app.py" "${DMG_STAGE}/" 2>/dev/null || true
  hdiutil create -volname "ZonScale" -srcfolder "${DMG_STAGE}" -ov -format UDZO "${DMG_PATH}" 2>/dev/null || \
    echo "WARN: hdiutil DMG creation skipped (ZIP still available)"
  rm -rf "${DMG_STAGE}"
fi

echo
echo "DONE."
echo "  App:  ${PROJECT_DIR}/${APP_PATH}"
echo "  Open: open dist/ZonScale.app"
echo "  ZIP:  dist_release/ZonScale_macOS_*.zip"
echo "  Data: ~/Library/Application Support/ZonScale/"
echo "  Guide: packaging/macos/README.md"
