const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;
    let q = `SELECT e.*, s.name as operator_name FROM equipment e
             LEFT JOIN staff s ON s.id = e.default_operator_id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND e.status = $${params.length}`; }
    if (type)   { params.push(type);   q += ` AND e.type = $${params.length}`; }
    q += ' ORDER BY e.name ASC';
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*, s.name as operator_name FROM equipment e
       LEFT JOIN staff s ON s.id = e.default_operator_id WHERE e.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, board_number, license_plate, tank_volume, attachments, status, default_operator_id, note } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type required' });
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO equipment (id, name, type, board_number, license_plate, tank_volume, attachments, status, default_operator_id, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, name, type, board_number||null, license_plate||null, tank_volume||null,
       attachments||[], status||'free', default_operator_id||null, note||null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, type, board_number, license_plate, tank_volume, attachments, status, default_operator_id, note } = req.body;
    const result = await db.query(
      `UPDATE equipment SET name=$1, type=$2, board_number=$3, license_plate=$4,
       tank_volume=$5, attachments=$6, status=$7, default_operator_id=$8, note=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name, type, board_number||null, license_plate||null, tank_volume||null,
       attachments||[], status||'free', default_operator_id||null, note||null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM equipment WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
