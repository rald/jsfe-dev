#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
echo "Virtual environment ready. Start WebOS with: source .venv/bin/activate && python backend/server.py"
