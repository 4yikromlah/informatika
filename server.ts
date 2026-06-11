import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Inisialisasi Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

app.use(express.json({ limit: '10mb' }));

// --- AI Service (Gemini) ---
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY tidak ditemukan');
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// --- API Endpoints ---

// 1. Generate Soal via Gemini
app.post('/api/gemini/generate-questions', async (req, res) => {
  try {
    const { topic, subject, difficulty, count = 5 } = req.body;
    const ai = getGenAI();

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `Buat ${count} soal ${subject} materi ${topic} tingkat ${difficulty}...`,
      // ... (konfigurasi schema response Anda)
    });

    res.json({ success: true, questions: JSON.parse(response.text || '[]') });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. FITUR BARU: Hapus Massal Siswa
app.delete('/api/students/bulk', async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'ID tidak valid.' });
  }

  try {
    const { error } = await supabase
      .from('students')
      .delete()
      .in('id', ids);

    if (error) throw error;
    res.json({ success: true, message: `Berhasil menghapus ${ids.length} siswa.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Vite Middleware untuk Production/Development ---
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
});
