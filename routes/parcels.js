// routes/parcels.js
const router = require('express').Router();
const db     = require('../db');

router.get('/', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM parcels ORDER BY sowing_date ASC NULLS LAST');
    res.json({ ok:true, data: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const p = req.body;
    await db.query(`
      INSERT INTO parcels (id,name,ha,crop_id,variety,sowing_date,density,soil,harvest_gdd,tdu_window,note,calibration)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO UPDATE SET
        name=$2,ha=$3,crop_id=$4,variety=$5,sowing_date=$6,density=$7,soil=$8,
        harvest_gdd=$9,tdu_window=$10,note=$11,calibration=$12,updated_at=NOW()
    `, [p.id,p.name,p.ha,p.cropId,p.variety,p.sowingDate||null,
        p.density,p.soil,p.harvestGdd,p.tduWindow,p.note,
        JSON.stringify(p.calibration||{})]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM parcels WHERE id=$1', [req.params.id]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
