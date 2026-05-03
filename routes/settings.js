const router = require('express').Router();
const db     = require('../db');

router.get('/:key', async (req, res) => {
  try {
    const r = await db.query('SELECT value FROM settings WHERE key=$1', [req.params.key]);
    res.json({ ok:true, value: r.rows[0]?.value || {} });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/:key', async (req, res) => {
  try {
    await db.query(`
      INSERT INTO settings (key,value) VALUES ($1,$2)
      ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()
    `, [req.params.key, JSON.stringify(req.body.value)]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
