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
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ ok: false, error: 'Invalid token' });
  req.user = payload;
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
  const sig  = crypto.createHmac('sha256', FC_PRIVATE)
    .update(method.toUpperCase() + path + date + FC_PUBLIC).digest('hex');
  return { 'Accept':'application/json', 'Authorization':`${FC_PUBLIC}:${sig}`, 'Date':date };
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
    const fcPath = `/data/normal/station/${station}/data/last/7/hourly`;
    const fc = await fetch('https://api.fieldclimate.com/v2' + fcPath, { headers: fcHeaders('GET', fcPath) });
    if (!fc.ok) throw new Error('FC: ' + fc.status);
    const fcData = await fc.json();
    const byDate = {};
    (fcData.data || []).forEach(h => {
      const d = h.date?.slice(0,10); if (!d) return;
      if (!byDate[d]) byDate[d] = { date:d, station, tmax:-999, tmin:999, temps:[], precip:0, rh:[], wind:[] };
      const t=parseFloat(h.temp??h.airTemp??NaN), p=parseFloat(h.rain??h.precip??0),
            r=parseFloat(h.rhum??h.rh??NaN), w=parseFloat(h.wind??h.windSpeed??NaN);
      if (!isNaN(t)) { byDate[d].temps.push(t); byDate[d].tmax=Math.max(byDate[d].tmax,t); byDate[d].tmin=Math.min(byDate[d].tmin,t); }
      if (!isNaN(p)) byDate[d].precip += p;
      if (!isNaN(r)) byDate[d].rh.push(r);
      if (!isNaN(w)) byDate[d].wind.push(w);
    });
    const rows = Object.values(byDate).map(d => ({
      date:d.date, station:d.station,
      tmax: d.tmax===-999?null:Math.round(d.tmax*10)/10,
      tmin: d.tmin===999?null:Math.round(d.tmin*10)/10,
      tavg: d.temps.length?Math.round(d.temps.reduce((s,v)=>s+v,0)/d.temps.length*10)/10:null,
      humidity: d.rh.length?Math.round(d.rh.reduce((s,v)=>s+v,0)/d.rh.length):null,
      precip: Math.round(d.precip*10)/10,
      wind: d.wind.length?Math.round(d.wind.reduce((s,v)=>s+v,0)/d.wind.length*10)/10:null,
      et0: null,
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
  const a=req.body;
  try {
    await db.query(`
      INSERT INTO public.analyses (id,type,date,parcel_id,lab,values,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET type=$2,date=$3,parcel_id=$4,lab=$5,values=$6,note=$7
    `, [String(a.id),a.type||'leaf',a.date,a.parcel_id||null,a.lab||'',JSON.stringify(a.values||{}),a.note||'']);
    res.json({ok:true});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
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
function crudRoutes(route, table) {
  app.get(route, auth, async (req,res) => {
    try { const r=await db.query(`SELECT * FROM public.${table} ORDER BY created_at`); res.json({ok:true,data:r.rows}); }
    catch(e) { res.status(500).json({ok:false,error:e.message}); }
  });
  app.post(route, auth, async (req,res) => {
    const b=req.body; const id=b.id||String(Date.now());
    try {
      await db.query(`INSERT INTO public.${table} (id,name,type,data) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name=$2,type=$3,data=$4`,
        [String(id),b.name||'',b.type||'',JSON.stringify(b)]);
      res.json({ok:true,id});
    } catch(e) { res.status(500).json({ok:false,error:e.message}); }
  });
  app.delete(`${route}/:id`, auth, async (req,res) => {
    try { await db.query(`DELETE FROM public.${table} WHERE id=$1`,[req.params.id]); res.json({ok:true}); }
    catch(e) { res.status(500).json({ok:false,error:e.message}); }
  });
}
crudRoutes('/api/equipment',   'equipment');
crudRoutes('/api/attachments', 'attachments');
crudRoutes('/api/staff',       'staff');

// ── TASKS ─────────────────────────────────────────────────────
app.get('/api/tasks', auth, async (req,res) => {
  try { const r=await db.query('SELECT * FROM public.tasks ORDER BY created_at DESC'); res.json({ok:true,data:r.rows}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/tasks', auth, async (req,res) => {
  const b=req.body; const id=b.id||String(Date.now());
  try {
    await db.query(`INSERT INTO public.tasks (id,status,data) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET status=$2,data=$3,updated_at=NOW()`,
      [String(id),b.status||'new',JSON.stringify(b)]);
    res.json({ok:true,id});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.put('/api/tasks/:id/status', auth, async (req,res) => {
  try { await db.query('UPDATE public.tasks SET status=$2,updated_at=NOW() WHERE id=$1',[req.params.id,req.body.status]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.delete('/api/tasks/:id', auth, async (req,res) => {
  try { await db.query('DELETE FROM public.tasks WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── MISC ──────────────────────────────────────────────────────
app.get('/api/work-types', auth, (req,res) => res.json({ok:true,data:[
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
