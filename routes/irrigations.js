const router = require('express').Router();
const db     = require('../db');

router.get('/', async (req, res) => {
  try {
    const { parcel } = req.query;
    let q = 'SELECT * FROM irrigations WHERE 1=1';
    const p = [];
    if (parcel) { p.push(parcel); q += ` AND parcel_id=$${p.length}`; }
    q += ' ORDER BY date DESC LIMIT 500';
    const r = await db.query(q, p);
    res.json({ ok:true, data: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const v = req.body;
    await db.query(`
      INSERT INTO irrigations (id,date,parcel_id,parcel_name,method,duration_h,volume_m3,etc_mm,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        date=$2,parcel_id=$3,parcel_name=$4,method=$5,duration_h=$6,volume_m3=$7,etc_mm=$8,note=$9
    `, [v.id,v.date,v.parcelId,v.parcelName,v.method,v.durationH,v.volumeM3,v.etcMm,v.note]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM irrigations WHERE id=$1', [req.params.id]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
