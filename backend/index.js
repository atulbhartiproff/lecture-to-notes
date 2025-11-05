import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

dotenv.config();

const app = express();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: [FRONTEND_ORIGIN, 'http://localhost:5173'], credentials: true }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10);
const ALLOWED_EXT = (process.env.ALLOWED_EXT || 'mp3,mp4,m4a,wav,mov,webm')
  .split(',')
  .map((s) => s.trim().toLowerCase());

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').replace('.', '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return cb(new Error(`Invalid file type: .${ext}`));
    }
    cb(null, true);
  },
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'backend', timestamp: new Date().toISOString() });
});

app.get('/api/test', async (req, res) => {
  try {
    const r = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
    res.json({ ok: true, ai_service: r.data });
  } catch (e) {
    res.status(502).json({ ok: false, error: e?.response?.data || e.message });
  }
});

async function forwardToAiService(filepath, originalname) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filepath), originalname);
  const response = await axios.post(`${AI_SERVICE_URL}/process`, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 1000 * 60 * 30,
  });
  return response.data;
}

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const filepath = req.file.path;
  try {
    const data = await forwardToAiService(filepath, req.file.originalname)
    res.json(data);
  } catch (err) {
    console.error('AI service error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Processing failed', details: err?.response?.data || err.message });
  } finally {
    try { fs.unlinkSync(filepath); } catch {}
  }
});

// Alias per requirements: frontend calls /api/process
app.post('/api/process', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const filepath = req.file.path;
  try {
    const data = await forwardToAiService(filepath, req.file.originalname)
    res.json(data);
  } catch (err) {
    console.error('AI service error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Processing failed', details: err?.response?.data || err.message });
  } finally {
    try { fs.unlinkSync(filepath); } catch {}
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log(`AI Service URL: ${AI_SERVICE_URL}`);
  console.log(`CORS allowed origin: ${FRONTEND_ORIGIN}`)
});
