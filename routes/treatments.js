const router = require('express').Router();
const db     = require('../db');

router.get('/', async (req, res) => {
  try {
    const { parcel, days } = req.query;
    let q = 'SELECT * FROM treatments WHERE 1=1';
    const params = [];
    if (parcel) { params.push(parcel); q += ` AND parcel_id=$${params.length}`; }
    if (days)   { params.push(parseInt(days)); q += ` AND date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'`; }
    q += ' ORDER BY date DESC';
    const r = await db.query(q, params);
    res.json({ ok:true, data: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const t = req.body;
    await db.query(`
      INSERT INTO treatments
        (id,date,parcel_id,parcel_name,crop_id,crop_name,variety,phase_name,gdd,products,method,volume,max_whi,whi_date,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (id) DO UPDATE SET
        date=$2,parcel_id=$3,parcel_name=$4,crop_id=$5,crop_name=$6,variety=$7,
        phase_name=$8,gdd=$9,products=$10,method=$11,volume=$12,
        max_whi=$13,whi_date=$14,note=$15,updated_at=NOW()
    `, [t.id,t.date,t.parcelId,t.parcelName,t.cropId,t.cropName,
        t.variety,t.phaseName,t.gdd,JSON.stringify(t.products||[]),
        t.method,t.volume,t.maxWhi,t.whiDate||null,t.note]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM treatments WHERE id=$1', [req.params.id]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
