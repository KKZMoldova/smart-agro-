const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');
const fs      = require('fs');
const db      = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function migrate() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await db.query(sql);
    console.log('[DB] Tables ready');
  } catch(e) {
    console.error('[DB] Migration error:', e.message);
  }
}
migrate();

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/weather',     require('./routes/weather'));
app.use('/api/parcels',     require('./routes/parcels'));
app.use('/api/treatments',  require('./routes/treatments'));
app.use('/api/irrigations', require('./routes/irrigations'));
app.use('/api/analyses',    require('./routes/analyses'));
app.use('/api/catalog',     require('./routes/catalog'));
app.use('/api/settings',    require('./routes/settings'));

app.get('/vegetable', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'smart-vegetable.html')));
app.get('/orchard', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'cherry-orchard-passport.html')));
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

const { syncFieldClimate } = require('./cron/fieldclimate');
cron.schedule('0 * * * *', async () => {
  try { await syncFieldClimate(); console.log('[CRON] Weather sync OK'); }
  catch(err) { console.error('[CRON] Weather sync FAILED:', err.message); }
});
setTimeout(() => {
  if (!process.env.FIELDCLIMATE_PUBLIC_KEY) {
    console.log('[CRON] FieldClimate keys not set — skipping');
    return;
  }
  syncFieldClimate().catch(e => console.error('[CRON] Failed:', e.message));
}, 5000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Smart-Agro server running on port ${PORT}`));