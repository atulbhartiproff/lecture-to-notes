FROM python:3.11-slim

# Prevents pyc generation & output buffering
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install ffmpeg for media processing
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy main service file
COPY main.py ./

# Bind to all interfaces (so backend inside same ECS task can reach it)
ENV PORT=8000
EXPOSE 8000

# --- Fast startup + stability ---
# Workers=1 since ECS already isolates tasks, threads keep memory low
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
