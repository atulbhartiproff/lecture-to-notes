# Multi-Container AI Study Notes (Frontend + Backend + FastAPI + Ollama)

Production-ready setup to upload audio/video, transcribe with Whisper, and generate study materials via Ollama.

## Services
- `frontend/` — Vite + React + Tailwind (Bun) — port 5173
- `backend/` — Node.js (Express, ES Modules) — port 5000
- `ai_service/` — Python FastAPI (Whisper + Ollama) — port 8000
- `processor/` — Python FastAPI (Whisper + Ollama) — port 8001
- `ollama` — Official Ollama container — port 11434

## Quick Start (Local)
Prerequisites: Docker + Docker Compose

```bash
docker compose down
docker compose up --build
```

Open:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000/health
- AI service: http://localhost:8000/health
- Processor: http://localhost:8001/health
- Ollama: http://localhost:11434

Test:
- Backend → AI service: http://localhost:5000/api/test
- Process (backend): `curl -X POST -F "file=@sample.mp3" http://localhost:5000/api/process`

## How It Works
- Frontend uploads file to backend (`/api/process`).
- Backend forwards to FastAPI (`/process`).
- FastAPI transcribes with Whisper, builds prompt, calls Ollama (`/api/chat`).
- Returns JSON: `{ transcript, summary, notes, studyPlan }`.

## docker-compose
- Adds `frontend` service with `VITE_API_URL=http://backend:5000` and port `5173:5173`.
- `backend` exposes 5000 and uses `AI_SERVICE_URL=http://ai_service:8000`.
- `ai_service` exposes 8000 and uses `OLLAMA_HOST=http://ollama:11434`.
- `processor` exposes 8001 and uses `OLLAMA_HOST=http://ollama:11434`.
- `ollama` exposes 11434 and persists models in `ollama_data` volume.
- Optional `ollama-init` one-shot pulls `${OLLAMA_MODEL:-llama3.1}`.

## Environment Variables
- Frontend: `VITE_API_URL` (compose sets to backend's service URL)
- Backend: `PORT=5000`, `AI_SERVICE_URL=http://ai_service:8000`, `FRONTEND_ORIGIN=http://localhost:5173`
- AI Service: `PORT=8000`, `WHISPER_MODEL=base`, `OLLAMA_HOST=http://ollama:11434`, `OLLAMA_MODEL=llama3.1`
- Processor: `PORT=8000` (internal), `WHISPER_MODEL=base`, `OLLAMA_HOST=http://ollama:11434`, `OLLAMA_MODEL=llama3.1`

## AWS Notes
- Works on EC2 with the same compose file; open 5173/5000/8000/8001 or put behind a reverse proxy/ALB. Keep 11434 internal if possible.
- For ECS, build/push images for `frontend`, `backend`, `ai_service`, and `processor`. Use `ollama/ollama` for LLM. Keep service names and envs the same for internal networking.
