@echo off
cd /d "%~dp0"
python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
echo Virtual environment ready. Start WebOS with: .venv\Scripts\activate.bat && python backend\server.py
