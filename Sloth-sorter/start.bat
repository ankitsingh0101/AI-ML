@echo off
REM Starts the Sloth Sorter API (port 8000) and the UI (port 3000).
REM Run setup once first (see README). Make sure Ollama is running.
start "Sloth API" cmd /k "python -m uvicorn server:app --port 8000"
start "Sloth UI" cmd /k "cd web && npm run dev"
timeout /t 6 >nul
start http://localhost:3000
