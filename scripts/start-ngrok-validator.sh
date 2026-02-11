#!/usr/bin/env bash
# Start ngrok tunnel for mcp-agent-validator
# Requires: ngrok installed and authenticated
# NOTE: nanobot-x402 uses ports 4100/4101 — no conflict
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting ngrok tunnel for mcp-agent-validator..."
echo "  validator:  http://localhost:4000 → ngrok"
echo ""

ngrok start --config "$SCRIPT_DIR/ngrok-validator.yml" --all
