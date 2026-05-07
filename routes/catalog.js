const router = require('express').Router();
const db     = require('../db');

router.get('/', async (req, res) => {
  try {
   const r = await db.query('SELECT * FROM catalog ORDER BY name ASC');
    res.json({ ok:true, data: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const v = req.body;
    await db.query(`
      INSERT INTO catalog (id,name,type,active_substance,dose,whi,frac,irac,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        name=$2,type=$3,active_substance=$4,dose=$5,whi=$6,frac=$7,irac=$8,note=$9
    `, [v.id,v.name,v.type,v.activeSubstance,v.dose,v.whi,v.frac,v.irac,v.note]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM catalog WHERE id=$1', [req.params.id]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
