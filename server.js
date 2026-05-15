const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');
const fs      = require('fs');
const db      = require('./db');

// Telegram
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8694496744:AAEIfRwHFrau8tgZyQcMRt2k1tUiHYjgCHs';
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID || '-1003971153442';

async function sendTelegram(chatId, message) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch(e) { console.error('[Telegram] Send error:', e.message); }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Auto-migrate tables
async function migrate() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await db.query(sql);

    // Создать таблицу для PDF анализов если не существует
    await db.query(`
      CREATE TABLE IF NOT EXISTS analysis_files (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_id TEXT NOT NULL,
        filename    TEXT NOT NULL,
        mimetype    TEXT NOT NULL DEFAULT 'application/pdf',
        size        INTEGER NOT NULL,
        data        BYTEA NOT NULL,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_analysis_files_analysis_id ON analysis_files(analysis_id);
    `);

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
// ═══ CLAUDE AI PROXY (обходит CORS) ══════════════════════════════════════
app.post('/api/claude-proxy', express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY не настроен на сервере' });
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
// ═══ PDF ENDPOINTS ════════════════════════════════════════════════════════

// GET /api/analyses/:id/pdfs — список PDF файлов для анализа
app.get('/api/analyses/:id/pdfs', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT id, filename, mimetype, size, uploaded_at
       FROM analysis_files
       WHERE analysis_id = $1
       ORDER BY uploaded_at DESC`,
      [req.params.id]
    );
    res.json({ ok: true, files: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/analyses/:id/pdfs — загрузить PDF (multipart без multer)
app.post('/api/analyses/:id/pdfs', express.raw({ type: 'application/pdf', limit: '5mb' }), async (req, res) => {
  try {
    const filename = decodeURIComponent(req.headers['x-filename'] || 'document.pdf');
    const data = req.body;
    if (!data || !data.length) return res.status(400).json({ error: 'PDF данные не получены' });
    const r = await db.query(
      `INSERT INTO analysis_files (analysis_id, filename, mimetype, size, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, filename, size, uploaded_at`,
      [req.params.id, filename, 'application/pdf', data.length, data]
    );
    res.json({ ok: true, file: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analyses/:id/pdfs/:fileId/download — скачать PDF
app.get('/api/analyses/:id/pdfs/:fileId/download', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT filename, mimetype, data FROM analysis_files
       WHERE id = $1 AND analysis_id = $2`,
      [req.params.fileId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Файл не найден' });
    const file = r.rows[0];
    res.set({
      'Content-Type': file.mimetype,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
    });
    res.send(file.data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analyses/:id/pdfs/:fileId/base64 — получить PDF как base64 для Claude API
app.get('/api/analyses/:id/pdfs/:fileId/base64', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT filename, mimetype, data FROM analysis_files
       WHERE id = $1 AND analysis_id = $2`,
      [req.params.fileId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Файл не найден' });
    const file = r.rows[0];
    const base64 = Buffer.from(file.data).toString('base64');
    res.json({ ok: true, base64, filename: file.filename });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/analyses/:id/pdfs/:fileId — удалить PDF
app.delete('/api/analyses/:id/pdfs/:fileId', async (req, res) => {
  try {
    await db.query(
      `DELETE FROM analysis_files WHERE id = $1 AND analysis_id = $2`,
      [req.params.fileId, req.params.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ CLAUDE AI PROXY (обходит CORS) ══════════════════════════════════════
app.post('/api/claude-proxy', express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY не настроен на сервере' });
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═════════════════════════════════════════════════════════════════════════

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

// Save field polygons
app.post('/api/fields/polygon', async (req, res) => {
  try {
    const { field_id, polygon } = req.body;
    if (!field_id || !polygon) return res.status(400).json({ error: 'field_id and polygon required' });
    await db.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [`field_polygon_${field_id}`, JSON.stringify(polygon)]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Get all field polygons
app.get('/api/fields/polygons', async (req, res) => {
  try {
    const r = await db.query(`SELECT key, value FROM settings WHERE key LIKE 'field_polygon_%'`);
    const polygons = {};
    r.rows.forEach(row => {
      const fieldId = row.key.replace('field_polygon_', '');
      polygons[fieldId] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    });
    res.json({ ok: true, data: polygons });
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

// Full state POST for Vegetable
app.post('/api/state/vegetable', async (req, res) => {
  try {
    const { fields, equipment, parcels, treatments, catalog, warehouse, settings,
            sowingRecords, varieties } = req.body;
    const r = await db.query(`SELECT value FROM settings WHERE key='vegetable_full_state'`);
    let state = {};
    if (r.rows.length) {
      state = typeof r.rows[0].value === 'string' ? JSON.parse(r.rows[0].value) : r.rows[0].value;
    }
    if (fields !== undefined)       state.fields       = fields;
    if (equipment !== undefined)    state.equipment    = equipment;
    if (parcels !== undefined)      state.parcels      = parcels;
    if (treatments !== undefined)   state.treatments   = treatments;
    if (catalog !== undefined)      state.catalog      = catalog;
    if (warehouse !== undefined)    state.warehouse    = warehouse;
    if (settings !== undefined)     state.settings     = settings;
    if (sowingRecords !== undefined) state.sowingRecords = sowingRecords;
    if (varieties !== undefined)    state.varieties    = varieties;
    await db.query(
      `INSERT INTO settings (key,value) VALUES ('vegetable_full_state',$1)
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [JSON.stringify(state)]
    );
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Full state GET for Orchard
app.get('/api/state/orchard', async (req, res) => {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='orchard_full_state'`);
    if (!r.rows.length) return res.json({ ok: false });
    res.json({ ok: true, data: r.rows[0].value });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Test Telegram
app.get('/api/test-telegram', async (req, res) => {
  try {
    await sendTelegram(TELEGRAM_GROUP_ID,
      '🌿 <b>Smart Agro</b> — тест уведомлений ✅\nСистема работает!');
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/map', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'map.html')));

app.get('/analyses', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'analyses.html')));

// Pages
app.get('/vegetable', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'smart-vegetable.html')));
app.get('/orchard', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'cherry-orchard-passport.html')));
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Cron: FieldClimate sync
const fc = require('./cron/fieldclimate');
const syncFieldClimate = fc.syncFieldClimate || fc;
cron.schedule('5 1 * * *', async () => {
  try { await syncFieldClimate(); console.log('[CRON] Weather sync OK'); }
  catch(err) { console.error('[CRON] Weather sync FAILED:', err.message); }
});

// Утренняя рассылка алертов в 7:00
cron.schedule('0 7 * * *', async () => {
  try {
    const stateRes = await db.query(`SELECT value FROM settings WHERE key='vegetable_full_state'`);
    if (!stateRes.rows.length) return;
    const state = typeof stateRes.rows[0].value === 'string'
      ? JSON.parse(stateRes.rows[0].value)
      : stateRes.rows[0].value;
    const weatherRes = await db.query(`SELECT * FROM weather ORDER BY date DESC LIMIT 3`);
    const weather = weatherRes.rows;
    if (!weather.length) return;

    const latest = weather[0];
    const tmax = parseFloat(latest.tmax) || 20;
    const tmin = parseFloat(latest.tmin) || 10;
    const hum = parseFloat(latest.humidity) || 50;
    const lw = parseFloat(latest.leaf_wet) || 0;
    const date = latest.date?.toString().slice(0,10);

    const smithActive = weather.length >= 2 &&
      weather.slice(0,2).every(w => parseFloat(w.tmax) >= 10 && parseFloat(w.humidity) >= 80);

    const parcels = state.parcels || [];
    let alerts = [];

    if (smithActive) {
      alerts.push('🟤 <b>SMITH PERIOD АКТИВЕН</b> — немедленная обработка томата и картофеля от фитофторы!');
    }

    const tavg = (tmax + tmin) / 2;
    if (tavg >= 5 && tavg <= 20 && lw >= 4) {
      const peaParcels = parcels.filter(p => p.cropId === 'pea').map(p => p.name).join(', ');
      if (peaParcels) {
        alerts.push(`💜 <b>Пероноспороз гороха — КРИТИЧНО</b>\nT°ср ${tavg.toFixed(1)}°C + лист мокрый ${lw}ч\nУчастки: ${peaParcels}\nОбработка: Ридомил Голд или Акробат ДО дождя`);
      }
    }

    if (hum > 75 && lw >= 3 && tavg >= 12) {
      const peaParcels = parcels.filter(p => p.cropId === 'pea').map(p => p.name).join(', ');
      if (peaParcels) {
        alerts.push(`🟤 <b>Аскохитоз гороха</b>\nRH ${hum}% + лист ${lw}ч\nУчастки: ${peaParcels}\nОбработка: Хорус или Свитч`);
      }
    }

    if (tmin <= 2) {
      alerts.push(`❄️ <b>ЗАМОРОЗОК</b> — T°мин ${tmin}°C\nПроверить все участки! Укрытие агроволокном.`);
    }

    if (tmax >= 26) {
      const peaParcels = parcels.filter(p => p.cropId === 'pea').map(p => p.name).join(', ');
      if (peaParcels) {
        alerts.push(`🌡️ <b>Тепловой стресс гороха</b> — T°макс ${tmax}°C\nГорошек перестаёт завязывать бобы!\nУчастки: ${peaParcels}\nСрочный полив!`);
      }
    }

    if (alerts.length === 0) {
      await sendTelegram(TELEGRAM_GROUP_ID,
        `✅ <b>Smart Agro · ${date}</b>\n\nДоброе утро! Критических алертов нет.\nT°мин ${tmin}°C / T°макс ${tmax}°C · RH ${hum}%`
      );
    } else {
      const msg = `🌿 <b>Smart Agro · Утренний отчёт · ${date}</b>\n\n` +
        `🌡 T°мин ${tmin}°C / T°макс ${tmax}°C · RH ${hum}% · Лист ${lw}ч\n\n` +
        `⚠️ <b>АЛЕРТЫ (${alerts.length}):</b>\n\n` +
        alerts.join('\n\n');
      await sendTelegram(TELEGRAM_GROUP_ID, msg);
    }
    console.log('[CRON] Morning alerts sent:', alerts.length);
  } catch(e) { console.error('[CRON] Morning alerts error:', e.message); }
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
