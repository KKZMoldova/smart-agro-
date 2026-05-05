const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');
const fs      = require('fs');
const db      = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Auto-migrate tables
async function migrate() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await db.query(sql);
    console.log('[DB] Tables ready');
  } catch(e) { console.error('[DB] Migration error:', e.message); }
}
migrate();

// Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/weather',     require('./routes/weather'));
app.use('/api/parcels',     require('./routes/parcels'));
app.use('/api/treatments',  require('./routes/treatments'));
app.use('/api/irrigations', require('./routes/irrigations'));
app.use('/api/analyses',    require('./routes/analyses'));
app.use('/api/catalog',     require('./routes/catalog'));
app.use('/api/settings',    require('./routes/settings'));
app.use('/api/staff',       require('./routes/staff'));
app.use('/api/equipment',   require('./routes/equipment'));
app.use('/api/attachments', require('./routes/attachments'));
app.get('/api/work-types',  async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM work_types ORDER BY name ASC');
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.use('/api/tasks',       require('./routes/tasks'));

// Full state import for Orchard
app.post('/api/import/orchard', async (req, res) => {
  try {
    const d = req.body;
    await db.query(
      `INSERT INTO settings (key,value) VALUES ('orchard_full_state',$1)
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [JSON.stringify(d)]
    );
    if (d.treatments?.length) {
      for (const t of d.treatments) {
        await db.query(
          `INSERT INTO treatments (id,date,parcel_name,products,method,volume,max_whi,whi_date,note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET
           date=$2,parcel_name=$3,products=$4,method=$5,
           volume=$6,max_whi=$7,whi_date=$8,note=$9`,
          [String(t.id), t.date, t.cellTarget||'all',
           JSON.stringify(t.products||[{name:t.product,type:t.type,dose:t.dose}]),
           t.method||'foliar', t.water||400, t.duration||14,
           t.endDate||null, t.note||'']
        );
      }
    }
    res.json({ ok: true, treatments: d.treatments?.length||0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Full state import for Vegetable
app.post('/api/import/vegetable', async (req, res) => {
  try {
    const d = req.body;
    await db.query(
      `INSERT INTO settings (key,value) VALUES ('vegetable_full_state',$1)
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [JSON.stringify(d)]
    );
    if (d.treatments?.length) {
      for (const t of d.treatments) {
        await db.query(
          `INSERT INTO treatments (id,date,parcel_id,parcel_name,crop_id,crop_name,
           variety,phase_name,gdd,products,method,volume,max_whi,whi_date,note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (id) DO UPDATE SET
           date=$2,parcel_id=$3,parcel_name=$4,products=$10,
           method=$11,volume=$12,max_whi=$13,whi_date=$14,note=$15`,
          [String(t.id), t.date, t.parcelId||null, t.parcelName||'',
           t.cropId||null, t.cropName||'', t.variety||'',
           t.phaseName||'', t.gdd||0,
           JSON.stringify(t.products||[]),
           t.method||'foliar', t.volume||300,
           t.maxWhi||0, t.whiDate||null, t.note||'']
        );
      }
    }
    res.json({ ok: true, treatments: d.treatments?.length||0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Full state GET for Orchard
app.get('/api/state/orchard', async (req, res) => {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='orchard_full_state'`);
    if (!r.rows.length) return res.json({ ok: false });
    res.json({ ok: true, data: r.rows[0].value });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Full state GET for Vegetable
app.get('/api/state/vegetable', async (req, res) => {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='vegetable_full_state'`);
    if (!r.rows.length) return res.json({ ok: false });
    res.json({ ok: true, data: r.rows[0].value });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Pages
app.get('/vegetable', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'smart-vegetable.html')));
app.get('/orchard', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'cherry-orchard-passport.html')));
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Cron: FieldClimate sync every hour
const fc = require('./cron/fieldclimate');
const syncFieldClimate = fc.syncFieldClimate || fc;
cron.schedule('0 * * * *', async () => {
  try { await syncFieldClimate(); console.log('[CRON] Weather sync OK'); }
  catch(err) { console.error('[CRON] Weather sync FAILED:', err.message); }
});
setTimeout(() => {
  if (!process.env.FIELDCLIMATE_PUBLIC_KEY_ORCHARD && !process.env.FIELDCLIMATE_PUBLIC_KEY_VEG) {
    console.log('[CRON] FieldClimate keys not set — skipping');
    return;
  }
  syncFieldClimate().catch(e => console.error('[CRON] Failed:', e.message));
}, 5000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Smart-Agro server running on port ${PORT}`));
