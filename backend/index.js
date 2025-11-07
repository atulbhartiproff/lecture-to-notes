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
// Allow multiple origins for flexibility in deployment
const allowedOrigins = FRONTEND_ORIGIN.includes(',') 
  ? FRONTEND_ORIGIN.split(',').map(o => o.trim())
  : [FRONTEND_ORIGIN, 'http://localhost:5173']
app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true)
    } else {
      callback(null, true) // Allow all origins for now, can be restricted later
    }
  },
  credentials: true 
}));
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
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/process`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 1000 * 60 * 30,
    });
    return response.data;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw new Error(`Cannot connect to AI service at ${AI_SERVICE_URL}. Please ensure the AI service is running.`);
    }
    if (err.code === 'ETIMEDOUT') {
      throw new Error('Request to AI service timed out. The file may be too large or the service is overloaded.');
    }
    throw err;
  }
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
    console.error('AI service error:', {
      message: err.message,
      code: err.code,
      response: err?.response?.data,
      status: err?.response?.status,
      url: AI_SERVICE_URL
    });
    const errorMessage = err.message || 'Processing failed';
    const errorDetails = err?.response?.data || (err.code ? `Network error: ${err.code}` : undefined);
    res.status(err?.response?.status || 500).json({ 
      error: errorMessage, 
      details: errorDetails 
    });
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
    console.error('AI service error:', {
      message: err.message,
      code: err.code,
      response: err?.response?.data,
      status: err?.response?.status,
      url: AI_SERVICE_URL
    });
    const errorMessage = err.message || 'Processing failed';
    const errorDetails = err?.response?.data || (err.code ? `Network error: ${err.code}` : undefined);
    res.status(err?.response?.status || 500).json({ 
      error: errorMessage, 
      details: errorDetails 
    });
  } finally {
    try { fs.unlinkSync(filepath); } catch {}
  }
});

// Error handling middleware for multer and other errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`,
        details: err.message 
      });
    }
    return res.status(400).json({ 
      error: 'File upload error', 
      details: err.message 
    });
  }
  if (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ 
      error: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log(`AI Service URL: ${AI_SERVICE_URL}`);
  console.log(`CORS allowed origin: ${FRONTEND_ORIGIN}`)
});
