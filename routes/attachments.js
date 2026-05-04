const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM attachments ORDER BY name ASC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, compatible, note } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO attachments (id, name, type, compatible, note)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, name, type||'other', compatible||[], note||null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, type, compatible, note } = req.body;
    const result = await db.query(
      `UPDATE attachments SET name=$1, type=$2, compatible=$3, note=$4
       WHERE id=$5 RETURNING *`,
      [name, type||'other', compatible||[], note||null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM attachments WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
