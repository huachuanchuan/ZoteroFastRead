#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_PY="$ROOT_DIR/server.py"
BIN_DIR="$ROOT_DIR/bin"
DIST_DIR="$ROOT_DIR/dist"
BUILD_DIR="$ROOT_DIR/build"
SPEC_FILE="$ROOT_DIR/fastread-server.spec"

if [[ ! -f "$SERVER_PY" ]]; then
  echo "[ERROR] Missing $SERVER_PY"
  exit 1
fi

PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_CMD="python"
else
  echo "[ERROR] Python is not available in PATH."
  exit 1
fi

echo "[1/5] Installing/upgrading packaging dependencies..."
"$PYTHON_CMD" -m pip install --upgrade pip >/dev/null
"$PYTHON_CMD" -m pip install --upgrade pyinstaller fastapi uvicorn pydantic python-multipart requests pypdf reportlab >/dev/null

echo "[2/5] Cleaning previous build artifacts..."
mkdir -p "$BIN_DIR"
rm -rf "$DIST_DIR" "$BUILD_DIR" "$SPEC_FILE" "$BIN_DIR/fastread-server-macos"

echo "[3/5] Running PyInstaller..."
"$PYTHON_CMD" -m PyInstaller \
  --noconfirm \
  --clean \
  --onefile \
  --name fastread-server \
  --distpath "$DIST_DIR" \
  --workpath "$BUILD_DIR" \
  "$SERVER_PY"

if [[ ! -f "$DIST_DIR/fastread-server" ]]; then
  echo "[ERROR] Build output not found: $DIST_DIR/fastread-server"
  exit 1
fi

echo "[4/5] Copying executable to plugin bin directory..."
cp "$DIST_DIR/fastread-server" "$BIN_DIR/fastread-server-macos"
chmod +x "$BIN_DIR/fastread-server-macos"

echo "[5/5] Smoke test backend executable..."
"$BIN_DIR/fastread-server-macos" >/dev/null 2>&1 &
SERVER_PID=$!
HEALTH_BASE=""

cleanup() {
  if [[ -n "$HEALTH_BASE" ]]; then
    curl -sS -X POST "$HEALTH_BASE/shutdown" >/dev/null 2>&1 || true
  fi
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

for _attempt in $(seq 1 25); do
  for port in 8000 18000 28000 38000; do
    if curl -sS "http://127.0.0.1:$port/health" >/dev/null 2>&1; then
      HEALTH_BASE="http://127.0.0.1:$port"
      break
    fi
  done
  if [[ -n "$HEALTH_BASE" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$HEALTH_BASE" ]]; then
  echo "[ERROR] Smoke test failed: /health endpoint did not become ready."
  exit 1
fi

echo "Built: $BIN_DIR/fastread-server-macos"
