#!/bin/zsh

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_NODE_DIR="$PROJECT_DIR/../node-v24.16.0-darwin-arm64"

if [ -x "$LOCAL_NODE_DIR/bin/node" ]; then
  NODE_BIN="$LOCAL_NODE_DIR/bin/node"
else
  NODE_BIN="node"
fi

cd "$PROJECT_DIR" || exit 1
"$NODE_BIN" api3111/server.js
