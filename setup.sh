#!/bin/bash
set -euo pipefail

echo "Executing Remote Setup Initialization..."
# 1. Install prerequisites for Rootless Docker
sudo apt-get update || true
sudo apt-get install -y uidmap dbus-user-session docker-ce-rootless-extras

# 2. Install Rootless Docker
dockerd-rootless-setuptool.sh install || true
grep -q "DOCKER_HOST" ~/.bashrc || echo "export DOCKER_HOST=unix://\$XDG_RUNTIME_DIR/docker.sock" >> ~/.bashrc

echo "Enforcing strict internal directory protections..."
BASE_DIR="$HOME/Kynto"
mkdir -p "$BASE_DIR/gateway_service" "$BASE_DIR/gemini_core" "$BASE_DIR/execution_sandbox/active_workspace" "$BASE_DIR/logs"

chmod 700 "$BASE_DIR" 
chmod 700 "$BASE_DIR/logs"
chmod 755 "$BASE_DIR/execution_sandbox"

touch "$BASE_DIR/logs/audit_trail.log"
chmod 600 "$BASE_DIR/logs/audit_trail.log"

echo "Setup Complete."
