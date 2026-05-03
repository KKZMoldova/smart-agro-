const router = require('express').Router();
const db     = require('../db');

router.get('/', async (req, res) => {
  try {
    const { parcel, type } = req.query;
    let q = 'SELECT * FROM analyses WHERE 1=1';
    const p = [];
    if (parcel) { p.push(parcel); q += ` AND parcel_id=$${p.length}`; }
    if (type)   { p.push(type);   q += ` AND type=$${p.length}`; }
    q += ' ORDER BY date DESC LIMIT 200';
    const r = await db.query(q, p);
    res.json({ ok:true, data: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const v = req.body;
    await db.query(`
      INSERT INTO analyses (id,type,date,parcel_id,parcel_name,lab,values,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        type=$2,date=$3,parcel_id=$4,parcel_name=$5,lab=$6,values=$7,note=$8,updated_at=NOW()
    `, [v.id,v.type,v.date,v.parcelId,v.parcelName,v.lab,
        JSON.stringify(v.values||{}),v.note]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM analyses WHERE id=$1', [req.params.id]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
