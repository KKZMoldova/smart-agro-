const router = require('express').Router();

// POST /api/ai/parse-pdf — Claude AI proxy для парсинга PDF анализов
router.post('/parse-pdf', async (req, res) => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY не настроен на сервере' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
