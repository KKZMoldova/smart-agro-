const router = require('express').Router();
const crypto = require('crypto');
const db     = require('../db');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// POST /api/auth/login  { pin: "1111" }
router.post('/login', async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN required' });

    const hash   = sha256(String(pin));
    const result = await db.query(
      'SELECT role, label FROM users WHERE pin_hash = $1', [hash]
    );

    if (!result.rows.length)
      return res.status(401).json({ error: 'Invalid PIN' });

    const { role, label } = result.rows[0];

    // Simple session token (role + timestamp signed with app secret)
    const secret    = process.env.APP_SECRET || 'smart-agro-secret-2024';
    const timestamp = Date.now();
    const token     = `${role}.${timestamp}.` +
      crypto.createHmac('sha256', secret).update(`${role}${timestamp}`).digest('hex').slice(0, 16);

    res.json({ ok: true, role, label, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify  { token }
router.post('/verify', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: 'No token' });

  const [role, timestamp, sig] = token.split('.');
  if (!role || !timestamp || !sig)
    return res.status(401).json({ error: 'Invalid token format' });

  const secret   = process.env.APP_SECRET || 'smart-agro-secret-2024';
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${role}${timestamp}`)
    .digest('hex')
    .slice(0, 16);

  if (sig !== expected)
    return res.status(401).json({ error: 'Invalid token' });

  // Token valid for 7 days
  if (Date.now() - parseInt(timestamp) > 7 * 86400 * 1000)
    return res.status(401).json({ error: 'Token expired' });

  res.json({ ok: true, role });
});

module.exports = router;
