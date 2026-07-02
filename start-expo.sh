#!/bin/zsh

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_NODE_DIR="$PROJECT_DIR/../node-v24.16.0-darwin-arm64"

if [ ! -x "$LOCAL_NODE_DIR/bin/npm" ]; then
  NPM_BIN="npm"
else
  NPM_BIN="$LOCAL_NODE_DIR/bin/npm"
fi

cd "$PROJECT_DIR" || exit 1
"$NPM_BIN" start -- "$@"
