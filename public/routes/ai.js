const router = require('express').Router();

const ANTHROPIC_HEADERS = (key) => ({
  'Content-Type': 'application/json',
  'x-api-key': key,
  'anthropic-version': '2023-06-01',
});

// PDF парсинг анализов
router.post('/parse-pdf', async (req, res) => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY не настроен' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: ANTHROPIC_HEADERS(KEY),
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// AI Агроном-советник (Smart Orchard)
router.post('/advisor', async (req, res) => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY не настроен' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: ANTHROPIC_HEADERS(KEY),
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
