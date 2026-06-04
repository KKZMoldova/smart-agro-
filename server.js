// ============================================================
//  Smart Agro — server.js v2.0
//  Node.js + Express | Railway | PostgreSQL
// ============================================================

const express = require('express');
const { Pool } = require('pg');
const crypto  = require('crypto');
const path    = require('path');
const multer  = require('multer');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── ENV ──────────────────────────────────────────────────────
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY   || '';
const FC_PUBLIC     = process.env.FIELDCLIMATE_PUBLIC_KEY_ORCHARD  || process.env.FIELDCLIMATE_ID     || '';
const FC_PRIVATE    = process.env.FIELDCLIMATE_PRIVATE_KEY_ORCHARD || process.env.FIELDCLIMATE_SECRET || '';
const FC_STATION    = process.env.FIELDCLIMATE_STATION_ORCHARD     || '00002158';
const JWT_SECRET    = process.env.JWT_SECRET          || 'smartagro_secret_2025';

const PINS = {
  [process.env.PIN_OWNER      || '1111']: 'owner',
  [process.env.PIN_AGRONOMIST || '2222']: 'agronomist',
  [process.env.PIN_DIRECTOR   || '3333']: 'director',
  [process.env.PIN_OPERATOR   || '4444']: 'operator',
};

// ── DATABASE ─────────────────────────────────────────────────
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── STATIC FILES ──────────────────────────────────────────────
const fs = require('fs');
// Явная раздача статики через fs.readFile (обходим проблемы express.static)
app.use((req, res, next) => {
  const ext = path.extname(req.path.split('?')[0]);
  if (!ext || req.path.startsWith('/api/')) return next();
  const filePath = path.join(__dirname, 'public', req.path.split('?')[0]);
  if (!fs.existsSync(filePath)) return next();
  const mimeMap = {'.css':'text/css','.js':'application/javascript','.html':'text/html','.png':'image/png','.ico':'image/x-icon','.json':'application/json'};
  res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  fs.createReadStream(filePath).pipe(res);
});

// upload хранилище (PDF анализов)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ── JWT ───────────────────────────────────────────────────────
function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg:'HS256', typ:'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig    = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch { return null; }
}

function auth(req, res, next) {
  // DEV MODE: auth disabled
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = payload;
  }
  if (!req.user) req.user = { role: 'owner', name: 'dev' };
  next();
}

// Auth optional — пропускает без токена (для разработки)
function authOpt(req, res, next) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = payload;
  }
  if (!req.user) req.user = { role: 'agronomist', pin: 'dev' };
  next();
}

// ── DB INIT ───────────────────────────────────────────────────
async function initDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.state (
      key TEXT PRIMARY KEY, data JSONB, updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.weather (
      date DATE NOT NULL, station TEXT NOT NULL DEFAULT '00002158',
      tmax REAL, tmin REAL, tavg REAL, humidity REAL,
      precip REAL, et0 REAL, wind REAL, solar REAL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (date, station)
    );
    CREATE TABLE IF NOT EXISTS public.treatments (
      id TEXT PRIMARY KEY, date DATE, product TEXT, products JSONB,
      type TEXT, method TEXT, volume REAL, max_whi INTEGER, whi_date DATE,
      parcel_name TEXT, crop_id TEXT, note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.analyses (
      id TEXT PRIMARY KEY, type TEXT, date DATE, parcel_id TEXT,
      lab TEXT, values JSONB, note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.analysis_pdfs (
      id SERIAL PRIMARY KEY, analysis_id TEXT REFERENCES public.analyses(id) ON DELETE CASCADE,
      filename TEXT, mime_type TEXT, data BYTEA,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.catalog (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT,
      active_substance TEXT, dose TEXT, whi INTEGER, frac TEXT, note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.settings (
      key TEXT PRIMARY KEY, value JSONB, updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.equipment (
      id TEXT PRIMARY KEY, name TEXT, type TEXT, data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.attachments (
      id TEXT PRIMARY KEY, name TEXT, type TEXT, data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.staff (
      id TEXT PRIMARY KEY, name TEXT, role TEXT, data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.tasks (
      id TEXT PRIMARY KEY, status TEXT DEFAULT 'new', data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('[DB] Tables ready');
}

// ═══════════════════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════════════════

// ── AUTH ──────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { pin } = req.body;
  const role = PINS[String(pin)];
  if (!role) return res.status(401).json({ ok: false, error: 'Неверный PIN' });
  res.json({ ok: true, token: signToken({ pin, role }), role });
});

app.get('/api/auth/users', auth, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ ok: false });
  res.json({ ok: true, data: [
    { id:1, name:'Владелец',        role:'owner',      pin: process.env.PIN_OWNER      || '1111' },
    { id:2, name:'Агроном',         role:'agronomist', pin: process.env.PIN_AGRONOMIST || '2222' },
    { id:3, name:'Директор завода', role:'director',   pin: process.env.PIN_DIRECTOR   || '3333' },
    { id:4, name:'Оператор',        role:'operator',   pin: process.env.PIN_OPERATOR   || '4444' },
  ]});
});

app.delete('/api/auth/users/:id', auth, (req, res) => res.json({ ok: true }));

// ── STATE (главный механизм синхронизации) ────────────────────
['orchard', 'vegetable'].forEach(key => {
  app.get(`/api/state/${key}`, auth, async (req, res) => {
    try {
      const r = await db.query('SELECT data FROM public.state WHERE key=$1', [key]);
      res.json({ ok: true, data: r.rows[0]?.data ?? null });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post(`/api/state/${key}`, auth, async (req, res) => {
    try {
      await db.query(`
        INSERT INTO public.state (key, data, updated_at) VALUES ($1,$2,NOW())
        ON CONFLICT (key) DO UPDATE SET data=$2, updated_at=NOW()
      `, [key, req.body]);
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });
});

// ── WEATHER ───────────────────────────────────────────────────
function fcHeaders(method, path) {
  const date = new Date().toUTCString();
  // FieldClimate HMAC: method + route + date + public_key
  const sig  = crypto.createHmac('sha256', FC_PRIVATE)
    .update(method.toUpperCase() + path + date + FC_PUBLIC).digest('hex');
  return { 'Accept':'application/json', 'Authorization':`hmac ${FC_PUBLIC}:${sig}`, 'Request-Date':date };
}

app.get('/api/weather', auth, async (req, res) => {
  const days    = Math.min(parseInt(req.query.days) || 7, 90);
  const station = req.query.station || '00002158';
  try {
    const from = new Date();
    from.setDate(from.getDate() - days);
    const r = await db.query(
      'SELECT * FROM public.weather WHERE station=$1 AND date>=$2 ORDER BY date DESC',
      [station, from.toISOString().split('T')[0]]
    );
    if (r.rows.length > 0) return res.json({ ok: true, data: r.rows.map(row => ({
      ...row,
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).split('T')[0]
    })) });
  } catch(e) { console.warn('[weather] DB read:', e.message); }

  if (!FC_PUBLIC || !FC_PRIVATE) return res.json({ ok: true, data: [] });

  try {
    const end   = new Date();
    const start = new Date();
    start.setDate(start.getDate() - Math.min(days, 7));
    const fcPath = `/data/${station}/daily/last/7`;
    // Also try alternate
    const fcController = new AbortController();
    const fcTimeout = setTimeout(() => fcController.abort(), 10000);
    let fc;
    try {
      fc = await fetch('https://api.fieldclimate.com/v2' + fcPath, { headers: fcHeaders('GET', fcPath), signal: fcController.signal });
      clearTimeout(fcTimeout);
    } catch(fetchErr) {
      clearTimeout(fcTimeout);
      console.log('[weather] FC fetch error:', fetchErr.message);
      throw fetchErr;
    }
    if (!fc.ok) {
      const errText = await fc.text();
      console.log('[weather] FC error body:', errText.slice(0,200));
      throw new Error('FC: ' + fc.status);
    }
    const fcData = await fc.json();
    // New FieldClimate format: fcData.dates = [...], fcData.data = [{name, values:[...]}, ...]
    const dates = fcData.dates || [];
    const sensors = fcData.data || [];
    const byDate = {};

    // Initialize byDate from dates array
    dates.forEach(dt => {
      const d = dt.slice(0, 10);
      if (!byDate[d]) byDate[d] = { date:d, station, tmax:-999, tmin:999, temps:[], precip:0, rh:[], wind:[] };
    });

    // Parse each sensor's values
    sensors.forEach(sensor => {
      const name = (sensor.name_original || sensor.name || '').toLowerCase();
      let values = sensor.values || sensor.data || [];
        if (!Array.isArray(values)) values = Object.values(values);
      values.forEach((val, i) => {
        const dt = dates[i];
        if (!dt) return;
        const d = dt.slice(0, 10);
        if (!byDate[d]) byDate[d] = { date:d, station, tmax:-999, tmin:999, temps:[], precip:0, rh:[], wind:[] };
        const v = parseFloat(val);
        if (isNaN(v)) return;
        // Apply divider if present
        const divided = sensor.divider ? v / sensor.divider : v;
        if (name.includes('temperature') || name.includes('temp')) {
          byDate[d].temps.push(divided);
          byDate[d].tmax = Math.max(byDate[d].tmax, divided);
          byDate[d].tmin = Math.min(byDate[d].tmin, divided);
        } else if (name.includes('rain') || name.includes('precip')) {
          byDate[d].precip += divided;
        } else if (name.includes('humid') || name.includes('rh')) {
          byDate[d].rh.push(divided);
        } else if (name.includes('wind')) {
          byDate[d].wind.push(divided);
        }
      });
    });
    const rows = Object.values(byDate).map(d => ({
      date:d.date, station:d.station,
      tmax: d.tmax===-999?null:Math.round(d.tmax*10)/10,
      tmin: d.tmin===999?null:Math.round(d.tmin*10)/10,
      tavg: d.temps.length?Math.round(d.temps.reduce((s,v)=>s+v,0)/d.temps.length*10)/10:null,
      humidity: d.rh.length?Math.round(d.rh.reduce((s,v)=>s+v,0)/d.rh.length):null,
      precip: Math.round(d.precip*10)/10,
      wind: d.wind.length?Math.round(d.wind.reduce((s,v)=>s+v,0)/d.wind.length*10)/10:null,
      et0: d.et0?.length ? Math.round(d.et0.reduce((s,v)=>s+v,0)/d.et0.length*10)/10 : null,
    }));
    for (const r of rows) {
      await db.query(`
        INSERT INTO public.weather (date,station,tmax,tmin,tavg,humidity,precip,wind,et0,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        ON CONFLICT (date,station) DO UPDATE SET
          tmax=EXCLUDED.tmax,tmin=EXCLUDED.tmin,tavg=EXCLUDED.tavg,
          humidity=EXCLUDED.humidity,precip=EXCLUDED.precip,wind=EXCLUDED.wind,updated_at=NOW()
      `, [r.date,r.station,r.tmax,r.tmin,r.tavg,r.humidity,r.precip,r.wind,r.et0]);
    }
    res.json({ ok:true, data:rows.sort((a,b)=>b.date.localeCompare(a.date)) });
  } catch(e) {
    console.warn('[weather] FieldClimate:', e.message);
    res.json({ ok:true, data:[] });
  }
});


// ── WEATHER POST (manual import) ──────────────────────────────
app.post('/api/weather', auth, async (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : [req.body];
  try {
    for (const w of rows) {
      if (!w.date) continue;
      const station = w.station || '00002158';
      await db.query(`
        INSERT INTO public.weather (date,station,tmax,tmin,tavg,humidity,precip,wind,et0,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        ON CONFLICT (date,station) DO UPDATE SET
          tmax=EXCLUDED.tmax,tmin=EXCLUDED.tmin,tavg=EXCLUDED.tavg,
          humidity=EXCLUDED.humidity,precip=EXCLUDED.precip,updated_at=NOW()
      `, [w.date, station, w.tmax||null, w.tmin||null, w.tavg||null,
          w.humidity||null, w.precip||0, w.wind||null, w.et0||null]);
    }
    res.json({ok:true, saved: rows.length});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});


// ── ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ ПОГОДЫ ──────────────────────────────────
app.post('/api/sync-weather', auth, async (req, res) => {
  const station = req.query.station || FC_STATION || '00002158';
  if (!FC_PUBLIC || !FC_PRIVATE) return res.status(500).json({ ok:false, error:'FieldClimate keys not configured' });
  try {
    // Try daily first, then hourly for recent days
    const fcPath = `/ag-grid/${station}/daily/last/7`;
    const fc = await fetch('https://api.fieldclimate.com/v2' + fcPath, {
      method: 'POST',
      headers: { ...fcHeaders('POST', fcPath), 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!fc.ok) throw new Error('FC: ' + fc.status + ' ' + await fc.text());
    const fcData = await fc.json();

    // ag-grid format: { headers:[...], data:[{datetime, sensor_x_x_..., ...}] }
    const agRows = fcData.data || [];
    console.log('[sync-weather] ag-grid rows:', agRows.length, agRows[0]?.datetime);

    const rows = agRows.map(row => {
      const date = (row.datetime || '').slice(0,10);
      if (!date) return null;
      // HC Air temperature (Channel 18) — primary air temp sensor
      const tmax = row['sensor_x_x_18_506_mx'] ?? row['sensor_x_x_0_0_mx'] ?? null;
      const tmin = row['sensor_x_x_18_506_mn'] ?? row['sensor_x_x_0_0_mn'] ?? null;
      const tavg = row['sensor_x_x_18_506_a']  ?? row['sensor_x_x_0_0_a']  ?? null;
      const humidity = row['sensor_x_x_19_507_a'] ?? null; // HC Relative humidity
      const precip   = row['sensor_x_x_5_6_s']    ?? 0;   // Precipitation sum
      const wind     = row['sensor_x_x_6_5_a']    ?? null; // Wind speed avg
      const et0      = row['disease_evapotranspiration_ETo'] ?? null;
      return { date, station,
        tmax: tmax !== null ? Math.round(tmax*10)/10 : null,
        tmin: tmin !== null ? Math.round(tmin*10)/10 : null,
        tavg: tavg !== null ? Math.round(tavg*10)/10 : null,
        humidity: humidity !== null ? Math.round(humidity) : null,
        precip: Math.round((precip||0)*10)/10,
        wind: wind !== null ? Math.round(wind*10)/10 : null,
        et0: et0 !== null ? Math.round(et0*10)/10 : null,
      };
    }).filter(Boolean);

    let updated = 0;
    for (const r of rows) {
      await db.query(`
        INSERT INTO public.weather (date,station,tmax,tmin,tavg,humidity,precip,wind,et0,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        ON CONFLICT (date,station) DO UPDATE SET
          tmax=EXCLUDED.tmax, tmin=EXCLUDED.tmin, tavg=EXCLUDED.tavg,
          humidity=EXCLUDED.humidity, precip=EXCLUDED.precip,
          wind=EXCLUDED.wind,
          et0=COALESCE(EXCLUDED.et0, public.weather.et0),
          updated_at=NOW()
      `, [r.date, r.station, r.tmax, r.tmin, r.tavg, r.humidity, r.precip, r.wind, r.et0]);
      updated++;
    }

    console.log(`[sync-weather] Updated ${updated} FC days for station ${station}`);

    // Fallback: fill missing recent days with Open-Meteo data
    const lat = process.env.FARM_LAT || '47.98';
    const lon = process.env.FARM_LON || '28.72';
    try {
      const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,relativehumidity_2m_max,et0_fao_evapotranspiration&timezone=Europe%2FBucharest&past_days=7&forecast_days=1`;
      const https = require('https');
      const omData = await new Promise((resolve, reject) => {
        https.get(omUrl, r => {
          let body = '';
          r.on('data', d => body += d);
          r.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
        }).on('error', reject);
      });
      const omDates = omData.daily?.time || [];
      let omUpdated = 0;
      for (let i = 0; i < omDates.length; i++) {
        const date = omDates[i];
        const tmax = omData.daily.temperature_2m_max?.[i];
        const tmin = omData.daily.temperature_2m_min?.[i];
        if (tmax === null || tmax === undefined) continue;
        // Only fill if FC data is missing
        await db.query(`
          INSERT INTO public.weather (date,station,tmax,tmin,tavg,humidity,precip,wind,et0,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
          ON CONFLICT (date,station) DO UPDATE SET
            tmax=CASE WHEN public.weather.tmax IS NULL THEN EXCLUDED.tmax ELSE public.weather.tmax END,
            tmin=CASE WHEN public.weather.tmin IS NULL THEN EXCLUDED.tmin ELSE public.weather.tmin END,
            tavg=CASE WHEN public.weather.tavg IS NULL THEN EXCLUDED.tavg ELSE public.weather.tavg END,
            humidity=CASE WHEN public.weather.humidity IS NULL THEN EXCLUDED.humidity ELSE public.weather.humidity END,
            precip=CASE WHEN public.weather.precip IS NULL OR public.weather.precip=0 THEN EXCLUDED.precip ELSE public.weather.precip END,
            et0=CASE WHEN public.weather.et0 IS NULL THEN EXCLUDED.et0 ELSE public.weather.et0 END,
            updated_at=NOW()
        `, [date, station,
            tmax, tmin,
            tmax && tmin ? Math.round((tmax+tmin)/2*10)/10 : null,
            omData.daily.relativehumidity_2m_max?.[i] ?? null,
            omData.daily.precipitation_sum?.[i] ?? 0,
            omData.daily.windspeed_10m_max?.[i] ?? null,
            omData.daily.et0_fao_evapotranspiration?.[i] ?? null
        ]);
        omUpdated++;
      }
      console.log(`[sync-weather] Open-Meteo filled ${omUpdated} days as fallback`);
      updated += omUpdated;
    } catch(omErr) {
      console.warn('[sync-weather] Open-Meteo fallback failed:', omErr.message);
    }

    const sensorNames = sensors.map(s => s.name_original || s.name || '?');
    const sample25 = rows.find(r=>r.date>='2026-05-25') || rows[0];
    res.json({ ok:true, updated, dates: rows.map(r=>r.date), raw_dates: dates.length, sensors: sensorNames, sample: sample25 });
  } catch(e) {
    console.error('[sync-weather]', e.message);
    res.status(500).json({ ok:false, error: e.message });
  }
});

// ── TREATMENTS ────────────────────────────────────────────────
app.get('/api/treatments', auth, async (req, res) => {
  try { const r=await db.query('SELECT * FROM public.treatments ORDER BY date DESC'); res.json({ok:true,data:r.rows}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/treatments', auth, async (req, res) => {
  const t=req.body;
  try {
    await db.query(`
      INSERT INTO public.treatments (id,date,product,products,type,method,volume,max_whi,whi_date,parcel_name,crop_id,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO UPDATE SET date=$2,product=$3,products=$4,type=$5,method=$6,volume=$7,max_whi=$8,whi_date=$9,parcel_name=$10,crop_id=$11,note=$12
    `, [String(t.id),t.date,t.product,JSON.stringify(t.products||[]),t.type,t.method,
        t.water||400,t.duration||14,t.endDate||null,t.cellTarget||'all',t.cropId||null,t.note||'']);
    res.json({ok:true});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.delete('/api/treatments/:id', auth, async (req,res) => {
  try { await db.query('DELETE FROM public.treatments WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── ANALYSES ──────────────────────────────────────────────────
app.get('/api/analyses', auth, async (req,res) => {
  try { const r=await db.query('SELECT * FROM public.analyses ORDER BY date DESC'); res.json({ok:true,data:r.rows}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/analyses', auth, async (req,res) => {
  const a = req.body;
  const id = String(a.id || Date.now());
  // Сохраняем весь объект в data, отдельные поля для индексации
  try {
    await db.query(`
      INSERT INTO public.analyses (id, type, date, parcel_id, lab, values, note, data)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET type=$2, date=$3, parcel_id=$4, lab=$5, values=$6, note=$7, data=$8
    `, [
      id,
      a.type || 'leaf',
      a.date || null,
      a.cellKey || a.parcel_id || null,
      a.lab || '',
      JSON.stringify(a.values || {}),
      a.note || '',
      JSON.stringify(a)
    ]);
    res.json({ ok: true, id });
  } catch(e) {
    // Если колонки data нет — добавляем и повторяем
    if (e.message.includes('column "data"')) {
      try {
        await db.query('ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS data JSONB');
        await db.query(`
          INSERT INTO public.analyses (id, type, date, parcel_id, lab, values, note, data)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (id) DO UPDATE SET type=$2, date=$3, parcel_id=$4, lab=$5, values=$6, note=$7, data=$8
        `, [id, a.type||'leaf', a.date||null, a.cellKey||a.parcel_id||null, a.lab||'', JSON.stringify(a.values||{}), a.note||'', JSON.stringify(a)]);
        return res.json({ ok: true, id });
      } catch(e2) { return res.status(500).json({ ok:false, error: e2.message }); }
    }
    console.error('[analyses POST]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.delete('/api/analyses/:id', auth, async (req,res) => {
  try { await db.query('DELETE FROM public.analyses WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// PDF к анализам
app.get('/api/analyses/:id/pdfs', auth, async (req,res) => {
  try {
    const r=await db.query('SELECT id,filename,mime_type,created_at FROM public.analysis_pdfs WHERE analysis_id=$1 ORDER BY created_at',[req.params.id]);
    res.json({ok:true,data:r.rows});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/analyses/:id/pdfs', auth, upload.single('file'), async (req,res) => {
  try {
    if (!req.file) return res.status(400).json({ok:false,error:'No file'});
    await db.query('INSERT INTO public.analysis_pdfs (analysis_id,filename,mime_type,data) VALUES ($1,$2,$3,$4)',
      [req.params.id,req.file.originalname,req.file.mimetype,req.file.buffer]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.get('/api/analyses/:id/pdfs/:fileId/download', auth, async (req,res) => {
  try {
    const r=await db.query('SELECT filename,mime_type,data FROM public.analysis_pdfs WHERE id=$1 AND analysis_id=$2',[req.params.fileId,req.params.id]);
    if (!r.rows.length) return res.status(404).json({ok:false});
    res.setHeader('Content-Type',r.rows[0].mime_type);
    res.setHeader('Content-Disposition',`attachment; filename="${r.rows[0].filename}"`);
    res.send(r.rows[0].data);
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.delete('/api/analyses/:id/pdfs/:fileId', auth, async (req,res) => {
  try { await db.query('DELETE FROM public.analysis_pdfs WHERE id=$1',[req.params.fileId]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── CATALOG ───────────────────────────────────────────────────
app.get('/api/catalog', auth, async (req,res) => {
  try { const r=await db.query('SELECT * FROM public.catalog ORDER BY name'); res.json({ok:true,data:r.rows}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/catalog', auth, async (req,res) => {
  const c=req.body;
  try {
    await db.query(`
      INSERT INTO public.catalog (id,name,type,active_substance,dose,whi,frac,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET name=$2,type=$3,active_substance=$4,dose=$5,whi=$6,frac=$7,note=$8
    `, [String(c.id),c.name,c.type||'fungicide',c.activeSubstance||'',String(c.dose||'0'),parseInt(c.whi)||0,c.fracCode||'',c.note||'']);
    res.json({ok:true});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.delete('/api/catalog/:id', auth, async (req,res) => {
  try { await db.query('DELETE FROM public.catalog WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── SETTINGS ──────────────────────────────────────────────────
app.get('/api/settings/:key', auth, async (req,res) => {
  try {
    const r=await db.query('SELECT value FROM public.settings WHERE key=$1',[req.params.key]);
    res.json({ok:true,value:r.rows[0]?.value??null});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/settings/:key', auth, async (req,res) => {
  try {
    await db.query(`
      INSERT INTO public.settings (key,value,updated_at) VALUES ($1,$2,NOW())
      ON CONFLICT (key) DO UPDATE SET value=$2,updated_at=NOW()
    `, [req.params.key, req.body.value??req.body]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── CRUD helper ───────────────────────────────────────────────
function crudRoutes(route, table, middleware) {
  const mw = middleware || auth;
  app.get(route, mw, async (req,res) => {
    try { const r=await db.query(`SELECT * FROM public.${table} ORDER BY created_at`); res.json({ok:true,data:r.rows}); }
    catch(e) { res.status(500).json({ok:false,error:e.message}); }
  });
  app.post(route, mw, async (req,res) => {
    const b=req.body; const id=b.id||String(Date.now());
    try {
      await db.query(`INSERT INTO public.${table} (id,name,type,data) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name=$2,type=$3,data=$4`,
        [String(id),b.name||'',b.type||'',JSON.stringify(b)]);
      res.json({ok:true,id});
    } catch(e) { res.status(500).json({ok:false,error:e.message}); }
  });
  app.put(`${route}/:id`, mw, async (req,res) => {
    const b=req.body; const id=req.params.id;
    try {
      await db.query(`UPDATE public.${table} SET name=$2,type=$3,data=$4 WHERE id=$1`,
        [String(id), b.name||'', b.type||'', JSON.stringify(b)]);
      res.json({ok:true,id});
    } catch(e) { res.status(500).json({ok:false,error:e.message}); }
  });
  app.delete(`${route}/:id`, mw, async (req,res) => {
    try { await db.query(`DELETE FROM public.${table} WHERE id=$1`,[req.params.id]); res.json({ok:true}); }
    catch(e) { res.status(500).json({ok:false,error:e.message}); }
  });
}
crudRoutes('/api/equipment',   'equipment', authOpt);
crudRoutes('/api/attachments', 'attachments', authOpt);
// Staff имеет role вместо type — отдельный роут
app.get('/api/staff', authOpt, async (req,res) => {
  try { const r=await db.query('SELECT * FROM public.staff ORDER BY created_at'); res.json({ok:true,data:r.rows}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/staff', authOpt, async (req,res) => {
  const b=req.body; const id=b.id||String(Date.now());
  try {
    // Добавляем колонку data если нет
    await db.query('ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS data JSONB').catch(()=>{});
    await db.query('ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS phone TEXT').catch(()=>{});
    await db.query(`INSERT INTO public.staff (id,name,role,phone,data) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET name=$2,role=$3,phone=$4,data=$5`,
      [String(id), b.name||'', b.role||b.type||'operator', b.phone||null, JSON.stringify(b)]);
    res.json({ok:true,id});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.delete('/api/staff/:id', authOpt, async (req,res) => {
  try { await db.query('DELETE FROM public.staff WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── TASKS ─────────────────────────────────────────────────────
app.get('/api/tasks', authOpt, async (req,res) => {
  try { const r=await db.query('SELECT * FROM public.tasks ORDER BY created_at DESC'); res.json({ok:true,data:r.rows}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/tasks', authOpt, async (req,res) => {
  const b=req.body; const id=b.id||String(Date.now());
  try {
    await db.query(`INSERT INTO public.tasks (id,status,data) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET status=$2,data=$3,updated_at=NOW()`,
      [String(id),b.status||'new',JSON.stringify(b)]);
    res.json({ok:true,id});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.put('/api/tasks/:id/status', authOpt, async (req,res) => {
  try { await db.query('UPDATE public.tasks SET status=$2,updated_at=NOW() WHERE id=$1',[req.params.id,req.body.status]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.delete('/api/tasks/:id', authOpt, async (req,res) => {
  try { await db.query('DELETE FROM public.tasks WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── MISC ──────────────────────────────────────────────────────
app.get('/api/work-types', authOpt, (req,res) => res.json({ok:true,data:[
  {id:'spray',name:'Опрыскивание'},{id:'irrigation',name:'Полив'},
  {id:'fertigation',name:'Фертигация'},{id:'pruning',name:'Обрезка'},
  {id:'harvest',name:'Уборка'},{id:'plow',name:'Пахота'},
  {id:'cultivate',name:'Культивация'},{id:'transport',name:'Транспорт'},{id:'other',name:'Прочее'},
]}));

app.post('/api/send-irrigation-task', auth, (req,res) => {
  console.log('[task]', JSON.stringify(req.body).slice(0,200));
  res.json({ok:true});
});

// ── AI PROXY ──────────────────────────────────────────────────
async function callClaude(messages, maxTokens=1500) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY не задан');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-api-key':ANTHROPIC_KEY, 'anthropic-version':'2023-06-01' },
    body: JSON.stringify({ model:'claude-opus-4-5', max_tokens:maxTokens, messages }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0,200)}`);
  return r.json();
}

app.post('/api/ai/parse-pdf', auth, async (req,res) => {
  try { res.json(await callClaude(req.body.messages, req.body.max_tokens||1000)); }
  catch(e) { console.error('[ai/parse-pdf]', e.message); res.status(500).json({ok:false,error:e.message}); }
});

app.post('/api/ai/advisor', auth, async (req,res) => {
  try { res.json(await callClaude(req.body.messages, req.body.max_tokens||2000)); }
  catch(e) { console.error('[ai/advisor]', e.message); res.status(500).json({ok:false,error:e.message}); }
});


// ── ПРОГНОЗ ПОГОДЫ (FieldClimate /forecast/{station}/daily/last/7) ────────
// Структура: { dates:["2026-05-24 00:00:00",...], data:[{name_original, values:{avg,max,min}}, ...] }
app.get('/api/weather/forecast', auth, async (req, res) => {
  const station = req.query.station || FC_STATION || '00002158';
  const days    = parseInt(req.query.days) || 7;

  if (FC_PUBLIC && FC_PRIVATE) {
    try {
      const fcPath = `/forecast/${station}/daily/last/7`;
      const date   = new Date().toUTCString();
      const sig    = crypto.createHmac('sha256', FC_PRIVATE)
        .update('GET' + fcPath + date + FC_PUBLIC).digest('hex');
      const r = await fetch('https://api.fieldclimate.com/v2' + fcPath, {
        headers: { 'Accept':'application/json', 'Authorization':`hmac ${FC_PUBLIC}:${sig}`, 'Request-Date':date }
      });
      if (r.ok) {
        const fcData = await r.json();
        const dates   = fcData.dates  || [];
        const sensors = fcData.data   || [];

        const byDate = {};
        dates.forEach(dt => {
          const d = dt.slice(0, 10);
          byDate[d] = { date:d, tmax:null, tmin:null, tavg:null, precip:0, humidity:null, wind:null, et0:null };
        });

        sensors.forEach(s => {
          const name = (s.name_original || s.name || '').toLowerCase();
          const vals = s.values || {};
          const vAvg = vals.avg || vals.a  || [];
          const vMax = vals.max || vals.mx || [];
          const vMin = vals.min || vals.mn || [];
          const vSum = vals.sum || vals.s  || [];

          dates.forEach((dt, i) => {
            const d = dt.slice(0, 10);
            if (!byDate[d]) return;
            const b = byDate[d];
            if (name.includes('air temperature') || name.includes('temperatura aerului')) {
              if (vMax[i] != null) b.tmax = Math.round(vMax[i] * 10) / 10;
              if (vMin[i] != null) b.tmin = Math.round(vMin[i] * 10) / 10;
              if (vAvg[i] != null) b.tavg = Math.round(vAvg[i] * 10) / 10;
            } else if (name.includes('rain') || name.includes('precipit') || name.includes('ploaie')) {
              const v = vSum[i] ?? vAvg[i];
              if (v != null) b.precip = Math.round(v * 10) / 10;
            } else if (name.includes('humidity') || name.includes('umiditate') || name.includes('relative')) {
              if (vAvg[i] != null) b.humidity = Math.round(vAvg[i]);
            } else if (name.includes('wind') || name.includes('vant') || name.includes('viteza')) {
              if (vAvg[i] != null) b.wind = Math.round(vAvg[i] * 10) / 10;
            } else if (name.includes('evapotranspir') || name.includes('et0') || name.includes('eto')) {
              const v = vSum[i] ?? vAvg[i];
              if (v != null) b.et0 = Math.round(v * 10) / 10;
            }
          });
        });

        const forecast = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
        return res.json({ ok:true, forecast, source:'fieldclimate', station });
      }
    } catch(e) {
      console.warn('[forecast] FC failed:', e.message);
    }
  }

  // Fallback: Open-Meteo
  try {
    const lat = process.env.FARM_LAT || '47.7321801';
    const lon = process.env.FARM_LON || '28.5216181';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,relativehumidity_2m_max,et0_fao_evapotranspiration&timezone=Europe%2FBucharest&forecast_days=${Math.min(days,14)}`;
    const d   = await (await fetch(url)).json();
    const forecast = (d.daily?.time || []).map((date, i) => ({
      date,
      tmax:     d.daily.temperature_2m_max?.[i]         ?? null,
      tmin:     d.daily.temperature_2m_min?.[i]         ?? null,
      precip:   d.daily.precipitation_sum?.[i]          ?? 0,
      wind:     d.daily.windspeed_10m_max?.[i]          ?? null,
      humidity: d.daily.relativehumidity_2m_max?.[i]    ?? null,
      et0:      d.daily.et0_fao_evapotranspiration?.[i] ?? null,
    }));
    res.json({ ok:true, forecast, source:'open-meteo', lat, lon });
  } catch(e2) {
    console.error('[forecast] Both failed:', e2.message);
    res.status(500).json({ ok:false, error: e2.message });
  }
});


// ── СТРАНИЦЫ ──────────────────────────────────────────────────
app.get('/', (req,res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname,'public','cherry-orchard-passport.html'));
});
app.get('/orchard', (req,res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname,'public','cherry-orchard-passport.html'));
});
app.get('/vegetable', (req,res) => res.sendFile(path.join(__dirname,'public','smart-vegetable.html')));
app.get('*', (req,res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ok:false,error:'Not found'});
  const ext = path.extname(req.path);
  if (ext === '.css' || ext === '.js' || ext === '.png' || ext === '.ico') {
    const filePath = path.join(__dirname,'public', req.path);
    const fs = require('fs');
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    return res.status(404).send('Not found');
  }
  if (ext && ext !== '.html') return res.status(404).send('Not found');
  res.sendFile(path.join(__dirname,'public','cherry-orchard-passport.html'));
});

// ── START ─────────────────────────────────────────────────────
async function start() {
  try { await initDB(); } catch(e) { console.warn('[DB] Init warning:', e.message); }
  app.listen(PORT, () => {
    console.log(`✅ Smart Agro v2.0 running on port ${PORT}`);
    console.log(`   Anthropic API: ${ANTHROPIC_KEY ? 'OK ✓' : 'NOT SET ✗'}`);
    console.log(`   FieldClimate:  ${FC_PUBLIC    ? 'OK ✓' : 'NOT SET ✗'}`);
    console.log(`   Database:      ${process.env.DATABASE_URL ? 'OK ✓' : 'local ✗'}`);
  });
}
start();

// ── CRON: Синхронизация погоды каждую ночь в 01:10 ───────────────────────

// Build FieldClimate path with explicit date range
function fcDatePath(station, days) {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const toTs   = Math.floor(to.getTime()/1000);
  const fromTs = Math.floor(from.getTime()/1000);
  return `/data/${station}/daily/${fromTs}/${toTs}`;
}


async function syncWeatherCron() {
  if (!FC_PUBLIC || !FC_PRIVATE) return;
  console.log('[cron] Starting weather sync...');
  const stations = [
    { id: FC_STATION || '00002158', key: 'orchard' },
    { id: process.env.FIELDCLIMATE_STATION_VEG || '0020BCDC', key: 'vegetable' },
  ];
  for (const st of stations) {
    try {
      const fcPub  = st.key === 'orchard' ? FC_PUBLIC  : (process.env.FIELDCLIMATE_PUBLIC_KEY_VEG  || '');
      const fcPriv = st.key === 'orchard' ? FC_PRIVATE : (process.env.FIELDCLIMATE_PRIVATE_KEY_VEG || '');
      if (!fcPub || !fcPriv) continue;
      const path = `/ag-grid/${st.id}/daily/last/7`;
      const date = new Date().toUTCString();
      const sig  = crypto.createHmac('sha256', fcPriv).update('POST' + path + date + fcPub).digest('hex');
      const headers = { 'Accept':'application/json', 'Authorization':`hmac ${fcPub}:${sig}`, 'Request-Date':date, 'Content-Type':'application/json' };
      const r = await fetch('https://api.fieldclimate.com/v2' + path, { method:'POST', headers, body:'{}' });
      if (!r.ok) { console.warn(`[cron] FC ${st.id}: ${r.status}`); continue; }
      const fcData = await r.json();
      // ag-grid format
      const agRows = fcData.data || [];
      const rows = agRows.map(row => {
        const d = (row.datetime||'').slice(0,10); if(!d) return null;
        return {
          date: d, station: st.id,
          tmax: row['sensor_x_x_18_506_mx'] ?? row['sensor_x_x_0_0_mx'] ?? null,
          tmin: row['sensor_x_x_18_506_mn'] ?? row['sensor_x_x_0_0_mn'] ?? null,
          tavg: row['sensor_x_x_18_506_a']  ?? row['sensor_x_x_0_0_a']  ?? null,
          humidity: row['sensor_x_x_19_507_a'] ?? null,
          precip: row['sensor_x_x_5_6_s'] ?? 0,
          wind: row['sensor_x_x_6_5_a'] ?? null,
          et0: row['disease_evapotranspiration_ETo'] ?? null,
        };
      }).filter(Boolean);
      for (const row of rows) {
        await db.query(`
          INSERT INTO public.weather (date,station,tmax,tmin,tavg,humidity,precip,wind,et0,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
          ON CONFLICT (date,station) DO UPDATE SET
            tmax=EXCLUDED.tmax, tmin=EXCLUDED.tmin, tavg=EXCLUDED.tavg,
            humidity=EXCLUDED.humidity, precip=EXCLUDED.precip,
            wind=EXCLUDED.wind, et0=COALESCE(EXCLUDED.et0, public.weather.et0), updated_at=NOW()
        `, [row.date, st.id,
            row.tmax !== null ? Math.round(row.tmax*10)/10 : null,
            row.tmin !== null ? Math.round(row.tmin*10)/10 : null,
            row.tavg !== null ? Math.round(row.tavg*10)/10 : null,
            row.humidity !== null ? Math.round(row.humidity) : null,
            Math.round((row.precip||0)*10)/10,
            row.wind !== null ? Math.round(row.wind*10)/10 : null,
            row.et0 !== null ? Math.round(row.et0*10)/10 : null]);
      }
      console.log(`[cron] ${st.id}: saved ${rows.length} days`);
    } catch(e) { console.warn(`[cron] ${st.id} error:`, e.message); }
  }
}

// Запуск cron в 22:05 UTC = 01:05 по Молдове (UTC+3)
function scheduleCron() {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(22, 5, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next - now;
  console.log(`[cron] Next weather sync in ${Math.round(delay/60000)} minutes`);
  setTimeout(() => {
    syncWeatherCron();
    setInterval(syncWeatherCron, 24 * 60 * 60 * 1000);
  }, delay);
}

scheduleCron();
// Также запустить сразу при старте
syncWeatherCron();


// ═══ GPS ТРЕКИНГ ══════════════════════════════════════════════════════════
db.query(`
  CREATE TABLE IF NOT EXISTS public.gps_tracks (
    id SERIAL PRIMARY KEY,
    device_id TEXT, device_name TEXT,
    lat DOUBLE PRECISION, lon DOUBLE PRECISION,
    speed REAL DEFAULT 0, status TEXT DEFAULT 'working',
    session_id TEXT, type TEXT DEFAULT 'work',
    timestamp TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS gps_tracks_device_idx ON public.gps_tracks(device_id);
  CREATE INDEX IF NOT EXISTS gps_tracks_ts_idx ON public.gps_tracks(timestamp DESC);
`).catch(e => console.warn('[GPS] table:', e.message));

app.post('/api/gps', async (req, res) => {
  try {
    const { device_id, device_name, lat, lon, speed, status, session_id, type } = req.body;
    if (!device_id || !lat || !lon) return res.status(400).json({ ok:false, error:'Missing fields' });
    await db.query(
      'INSERT INTO public.gps_tracks (device_id,device_name,lat,lon,speed,status,session_id,type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [device_id, device_name||device_id, parseFloat(lat), parseFloat(lon), parseFloat(speed)||0, status||'working', session_id||null, type||'work']
    );
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

app.get('/api/gps/live', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT DISTINCT ON (device_id)
        device_id, device_name, lat, lon, speed, status, session_id, type, timestamp
      FROM public.gps_tracks
      WHERE timestamp > NOW() - INTERVAL '2 minutes'
      ORDER BY device_id, timestamp DESC
    `);
    res.json({ ok:true, devices: r.rows });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

app.get('/api/gps/track/:session_id', async (req, res) => {
  try {
    const r = await db.query(
      'SELECT lat,lon,speed,status,type,timestamp FROM public.gps_tracks WHERE session_id=$1 ORDER BY timestamp ASC',
      [req.params.session_id]
    );
    res.json({ ok:true, points: r.rows });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

app.get('/api/gps/stops', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT device_id,device_name,lat,lon,timestamp,session_id
      FROM public.gps_tracks WHERE status='empty_tank'
      ORDER BY timestamp DESC LIMIT 100
    `);
    res.json({ ok:true, stops: r.rows });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

