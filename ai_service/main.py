import os
import io
import json
import tempfile
from typing import Optional, Dict, Any

import requests
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Lazy import whisper on demand to reduce container start memory
_whisper_model = None

def load_whisper_model() -> Any:
	global _whisper_model
	if _whisper_model is None:
		import whisper  # type: ignore
		model_name = os.getenv("WHISPER_MODEL", "base")
		_whisper_model = whisper.load_model(model_name)
	return _whisper_model

app = FastAPI(title="AI Service", version="1.0.0")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


def _transcribe(file_path: str) -> str:
	model = load_whisper_model()
	result = model.transcribe(file_path)
	return result.get("text", "").strip()


def _build_prompt(transcript: str) -> str:
	return (
		"You are an assistant that creates study materials from transcripts.\n"
		"Given the transcript, produce a JSON object with keys: \n"
		"- summary: a comprehensive summary (markdown)\n"
		"- notes: detailed study notes as bullet points (markdown)\n"
		"- studyPlan: a step-by-step plan with numbered steps (markdown)\n\n"
		"Respond with ONLY valid JSON.\n\n"
		"Transcript:\n" + transcript
	)


def _call_ollama(prompt: str, model: Optional[str] = None) -> Dict[str, Any]:
	ollama_host = os.getenv("OLLAMA_HOST", "http://ollama:11434")
	url = f"{ollama_host.rstrip('/')}/api/chat"
	model_name = model or os.getenv("OLLAMA_MODEL", "llama3.1")
	payload = {
		"model": model_name,
		"stream": False,
		"messages": [
			{"role": "system", "content": "Return only valid JSON."},
			{"role": "user", "content": prompt},
		],
	}
	try:
		r = requests.post(url, json=payload, timeout=120)
		r.raise_for_status()
	except requests.HTTPError as http_err:
		status = http_err.response.status_code if http_err.response is not None else 500
		text = http_err.response.text if http_err.response is not None else str(http_err)
		# Provide a clearer message when model is not found or not pulled yet
		if status == 404 or "model" in text.lower() and "not" in text.lower():
			raise HTTPException(status_code=502, detail=f"Ollama model not available. Ensure the model is pulled. Raw: {text}")
		raise HTTPException(status_code=502, detail=f"Ollama error: {text}")

	data = r.json()
	content = data.get("message", {}).get("content", "{}")
	try:
		return json.loads(content)
	except json.JSONDecodeError:
		start = content.find('{')
		end = content.rfind('}')
		if start != -1 and end != -1 and end > start:
			return json.loads(content[start:end+1])
		raise HTTPException(status_code=502, detail="Ollama returned non-JSON content")


@app.get("/")
async def root():
	return {"service": "ai_service", "status": "ok"}


@app.get("/health")
async def health():
	return {"status": "ok"}


@app.post("/process")
async def process(file: UploadFile = File(...)):
	if not file:
		raise HTTPException(status_code=400, detail="File is required")

	try:
		with tempfile.NamedTemporaryFile(delete=False) as tmp:
			contents = await file.read()
			tmp.write(contents)
			tmp_path = tmp.name

		transcript = _transcribe(tmp_path)
		result = _call_ollama(_build_prompt(transcript))
		return JSONResponse({
			"transcript": transcript,
			"summary": result.get("summary", ""),
			"notes": result.get("notes", ""),
			"studyPlan": result.get("studyPlan", ""),
		})
	finally:
		try:
			os.unlink(tmp_path)  # type: ignore
		except Exception:
			pass


if __name__ == "__main__":
	port = int(os.getenv("PORT", "8000"))
	uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
