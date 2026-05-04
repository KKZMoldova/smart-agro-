const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const { role, active } = req.query;
    let q = 'SELECT * FROM staff WHERE 1=1';
    const params = [];
    if (role) { params.push(role); q += ` AND role = $${params.length}`; }
    if (active !== undefined) { params.push(active === 'true'); q += ` AND active = $${params.length}`; }
    q += ' ORDER BY name ASC';
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM staff WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, role, phone, telegram_id, specialty, active } = req.body;
    if (!name || !role) return res.status(400).json({ error: 'name and role required' });
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO staff (id, name, role, phone, telegram_id, specialty, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, name, role, phone||null, telegram_id||null, specialty||null, active !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, role, phone, telegram_id, specialty, active } = req.body;
    const result = await db.query(
      `UPDATE staff SET name=$1, role=$2, phone=$3, telegram_id=$4,
       specialty=$5, active=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [name, role, phone||null, telegram_id||null, specialty||null, active !== false, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('UPDATE staff SET active=false, updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
