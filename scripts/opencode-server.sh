#!/bin/sh
BIN=$(ls -d "$HOME"/.local/lib/chiliz/*/node_modules/opencode-darwin-arm64/bin/opencode 2>/dev/null | tail -1)
if [ -z "$BIN" ]; then
  echo "opencode binary not found under ~/.local/lib/chiliz"
  exit 1
fi
exec "$BIN" serve --port "${1:-4097}"
