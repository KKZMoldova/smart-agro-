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
// Railway требует SSL, локальный postgres его обычно не поднимает —
// поэтому решаем по хосту, а не по самому факту наличия DATABASE_URL.
const DB_IS_LOCAL = /@(localhost|127\.0\.0\.1)[:\/]/.test(process.env.DATABASE_URL || '');
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !DB_IS_LOCAL ? { rejectUnauthorized: false } : false,
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

// ── Пароли компаний (scrypt, без доп. зависимостей) ────────────
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}
function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    const [salt, hash] = String(stored||'').split(':');
    if (!salt || !hash) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err || derivedKey.length !== Buffer.from(hash,'hex').length) return resolve(false);
      resolve(crypto.timingSafeEqual(Buffer.from(hash,'hex'), derivedKey));
    });
  });
}

// ── Доступ компании к культуре ──────────────────────────────────
async function hasCropAccess(companyId, cropId) {
  if (!companyId) return true; // легаси/дев-режим без компании — не ограничиваем
  try {
    const r = await db.query(
      `SELECT status, trial_expires_at FROM public.agro_crop_access WHERE company_id=$1 AND crop_id=$2`,
      [companyId, cropId]
    );
    const row = r.rows[0];
    if (!row) return false;
    if (row.status === 'paid') return true;
    if (row.status === 'trial') {
      return !!row.trial_expires_at && new Date(row.trial_expires_at) >= new Date(new Date().toDateString());
    }
    return false;
  } catch { return false; }
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
    CREATE TABLE IF NOT EXISTS public.parcels (
      id TEXT PRIMARY KEY, name TEXT, ha NUMERIC, crop_id TEXT, variety TEXT,
      sowing_date DATE, density TEXT, soil TEXT, harvest_gdd NUMERIC, tdu_window INTEGER,
      yield_plan NUMERIC, yield_fact NUMERIC, field_id TEXT, note TEXT, calibration JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.agro_companies (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      fc_public_key TEXT, fc_private_key TEXT, fc_station_id TEXT,
      wialon_token TEXT, wialon_host TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.agro_users (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES public.agro_companies(id),
      username TEXT UNIQUE NOT NULL,
      phone TEXT,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      active BOOLEAN DEFAULT true,
      must_change_password BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.agro_crop_access (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES public.agro_companies(id),
      crop_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'trial',
      trial_started_at DATE,
      trial_expires_at DATE,
      paid_confirmed_by INTEGER REFERENCES public.agro_users(id),
      paid_confirmed_at TIMESTAMPTZ,
      enabled_by INTEGER REFERENCES public.agro_users(id),
      enabled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(company_id, crop_id)
    );
    CREATE TABLE IF NOT EXISTS public.agro_migrations (
      name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('[DB] Tables ready');
  await migrateMultiTenant();
}

// ── Мультитенантность: колонка company_id на существующих таблицах,
//    KKZ становится компанией №1 с полным доступом ко всем культурам.
//    Каждый шаг независим и безопасен для повторного запуска.
async function migrateMultiTenant() {
  const TENANT_TABLES = ['state','treatments','analyses','catalog','equipment','attachments','staff','tasks','weather','parcels'];
  for (const t of TENANT_TABLES) {
    await db.query(`ALTER TABLE public.${t} ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES public.agro_companies(id)`).catch(()=>{});
  }
  // parcels: колонки, которых нет в старой версии таблицы (создана прежним кодом).
  await db.query(`ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS yield_plan NUMERIC`).catch(()=>{});
  await db.query(`ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS yield_fact NUMERIC`).catch(()=>{});
  await db.query(`ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS field_id TEXT`).catch(()=>{});
  await db.query(`ALTER TABLE public.agro_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false`).catch(()=>{});
  await db.query(`ALTER TABLE public.agro_users ADD COLUMN IF NOT EXISTS phone TEXT`).catch(()=>{});
  await db.query(`ALTER TABLE public.agro_users ADD COLUMN IF NOT EXISTS email TEXT`).catch(()=>{});
  await db.query(`ALTER TABLE public.agro_companies ADD COLUMN IF NOT EXISTS fc_public_key TEXT`).catch(()=>{});
  await db.query(`ALTER TABLE public.agro_companies ADD COLUMN IF NOT EXISTS fc_private_key TEXT`).catch(()=>{});
  await db.query(`ALTER TABLE public.agro_companies ADD COLUMN IF NOT EXISTS fc_station_id TEXT`).catch(()=>{});
  await db.query(`ALTER TABLE public.agro_companies ADD COLUMN IF NOT EXISTS wialon_token TEXT`).catch(()=>{});
  await db.query(`ALTER TABLE public.agro_companies ADD COLUMN IF NOT EXISTS wialon_host TEXT`).catch(()=>{});
  await db.query(`INSERT INTO public.agro_companies (id, name) VALUES (1, 'KKZ (основная ферма)') ON CONFLICT (id) DO NOTHING`).catch(()=>{});
  await db.query(`SELECT setval('public.agro_companies_id_seq', GREATEST((SELECT COALESCE(MAX(id),1) FROM public.agro_companies), 1))`).catch(()=>{});
  // Стартовый логин владельца KKZ — без него после введения реального логина
  // зайти в уже работающий сайт будет некому. Пароль берётся из ENV, либо
  // генерируется случайно при первом запуске и печатается только в лог —
  // в коде никакого реального пароля не хранится.
  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const hasAdmin = await db.query('SELECT id FROM public.agro_users WHERE company_id=1 LIMIT 1');
    if (!hasAdmin.rows.length) {
      const generated = crypto.randomBytes(9).toString('base64url');
      const adminPassword = process.env.ADMIN_PASSWORD || generated;
      const hash = await hashPassword(adminPassword);
      await db.query(
        `INSERT INTO public.agro_users (company_id, username, password_hash, role, must_change_password) VALUES (1,$1,$2,'owner',true) ON CONFLICT (username) DO NOTHING`,
        [adminUsername, hash]
      );
      console.log(`[DB] Bootstrap admin created — login: ${adminUsername}${process.env.ADMIN_PASSWORD ? ' / пароль из ADMIN_PASSWORD' : ` / пароль: ${adminPassword} (сохраните и смените после входа!)`}`);
    }
  } catch(e) { console.warn('[DB] Bootstrap admin:', e.message); }
  // Одноразово: колонка must_change_password появилась позже, чем мог быть
  // создан первый admin-пользователь — у него по умолчанию встало false.
  // Помечаем через agro_migrations, чтобы выполнить эту правку ровно один раз.
  try {
    const marker = 'force_first_admin_password_change';
    const done = await db.query('SELECT 1 FROM public.agro_migrations WHERE name=$1', [marker]);
    if (!done.rows.length) {
      await db.query('UPDATE public.agro_users SET must_change_password=true WHERE company_id=1');
      await db.query('INSERT INTO public.agro_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [marker]);
      console.log('[DB] Форсирована смена пароля для существующего admin-аккаунта KKZ');
    }
  } catch(e) { console.warn('[DB] force_first_admin_password_change:', e.message); }
  for (const t of TENANT_TABLES) {
    await db.query(`UPDATE public.${t} SET company_id = 1 WHERE company_id IS NULL`).catch(()=>{});
  }
  // state: раньше PRIMARY KEY был просто key — теперь разные компании могут иметь
  // свою строку с тем же key ('orchard'/'vegetable'), поэтому ключ должен быть составным.
  await db.query(`ALTER TABLE public.state DROP CONSTRAINT IF EXISTS state_pkey`).catch(()=>{});
  await db.query(`ALTER TABLE public.state ADD PRIMARY KEY (company_id, key)`).catch(()=>{});
  // weather: (date, station) может совпасть у двух компаний с одинаковым station.
  await db.query(`ALTER TABLE public.weather DROP CONSTRAINT IF EXISTS weather_pkey`).catch(()=>{});
  await db.query(`ALTER TABLE public.weather ADD PRIMARY KEY (company_id, date, station)`).catch(()=>{});
  // catalog: встроенные препараты по умолчанию (p1..p4) сохраняются с одним и
  // тем же id у КАЖДОЙ компании — без company_id в ключе они бы затирали друг друга.
  await db.query(`ALTER TABLE public.catalog DROP CONSTRAINT IF EXISTS catalog_pkey`).catch(()=>{});
  await db.query(`ALTER TABLE public.catalog ADD PRIMARY KEY (company_id, id)`).catch(()=>{});
  // settings и analysis_pdfs изначально не были в списке — добавляем отдельно.
  await db.query(`ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES public.agro_companies(id)`).catch(()=>{});
  await db.query(`UPDATE public.settings SET company_id=1 WHERE company_id IS NULL`).catch(()=>{});
  await db.query(`ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_pkey`).catch(()=>{});
  await db.query(`ALTER TABLE public.settings ADD PRIMARY KEY (company_id, key)`).catch(()=>{});
  await db.query(`ALTER TABLE public.analysis_pdfs ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES public.agro_companies(id)`).catch(()=>{});
  await db.query(`UPDATE public.analysis_pdfs SET company_id=1 WHERE company_id IS NULL`).catch(()=>{});
  const crops = ['crop_cherry','crop_sour_cherry','crop_apricot','crop_apple','crop_peach','crop_plum','crop_grape','crop_walnut'];
  for (const cropId of crops) {
    await db.query(
      `INSERT INTO public.agro_crop_access (company_id, crop_id, status) VALUES (1, $1, 'paid') ON CONFLICT (company_id, crop_id) DO NOTHING`,
      [cropId]
    ).catch(()=>{});
  }
  console.log('[DB] Multi-tenant migration checked');
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

// ── Логин компании (логин/пароль, привязан к company_id) ───────
app.post('/api/auth/login-company', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ ok:false, error:'Введите логин и пароль' });
  try {
    const login = String(username).trim();
    const r = await db.query('SELECT * FROM public.agro_users WHERE (username=$1 OR phone=$1 OR email=$1) AND active=true', [login]);
    const user = r.rows[0];
    if (!user) return res.status(401).json({ ok:false, error:'Неверный логин или пароль' });
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ ok:false, error:'Неверный логин или пароль' });
    const companyR = await db.query('SELECT * FROM public.agro_companies WHERE id=$1', [user.company_id]);
    const company = companyR.rows[0];
    if (company && company.status !== 'active') return res.status(403).json({ ok:false, error:'Доступ компании приостановлен' });
    const token = signToken({ userId: user.id, companyId: user.company_id, role: user.role });
    res.json({
      ok:true, token, role: user.role, companyId: user.company_id, companyName: company?.name || '',
      mustChangePassword: !!user.must_change_password,
    });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// ── Смена пароля (требуется, если must_change_password=true) ────
app.post('/api/auth/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!req.user?.userId) return res.status(401).json({ ok:false, error:'Не авторизован' });
  if (!currentPassword || !newPassword) return res.status(400).json({ ok:false, error:'Заполните текущий и новый пароль' });
  if (newPassword.length < 6) return res.status(400).json({ ok:false, error:'Пароль должен быть не короче 6 символов' });
  try {
    const r = await db.query('SELECT * FROM public.agro_users WHERE id=$1', [req.user.userId]);
    const user = r.rows[0];
    if (!user) return res.status(404).json({ ok:false, error:'Пользователь не найден' });
    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ ok:false, error:'Текущий пароль неверен' });
    const hash = await hashPassword(newPassword);
    await db.query('UPDATE public.agro_users SET password_hash=$2, must_change_password=false WHERE id=$1', [user.id, hash]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
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

// ── ADMIN: компании, пользователи, доступ по культурам ─────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ ok:false, error:'Нет доступа' });
    next();
  };
}

app.get('/api/admin/companies', auth, requireRole('owner'), async (req, res) => {
  try {
    const r = await db.query(`
      SELECT id, name, status, created_at,
        (fc_public_key IS NOT NULL AND fc_private_key IS NOT NULL) AS "hasWeatherStation",
        (wialon_token IS NOT NULL) AS "hasGps"
      FROM public.agro_companies ORDER BY created_at
    `);
    res.json({ ok:true, data: r.rows });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// Учётные данные интеграций (FieldClimate/Wialon) — сырые ключи никогда не
// возвращаются обратно клиенту, только сохраняются. Пустое поле в запросе
// не трогает уже сохранённое значение (COALESCE на NULLIF пустой строки).
app.put('/api/admin/companies/:id/integrations', auth, requireRole('owner'), async (req, res) => {
  const { fcPublicKey, fcPrivateKey, fcStationId, wialonToken, wialonHost } = req.body;
  try {
    await db.query(`
      UPDATE public.agro_companies SET
        fc_public_key  = COALESCE(NULLIF($2,''), fc_public_key),
        fc_private_key = COALESCE(NULLIF($3,''), fc_private_key),
        fc_station_id  = COALESCE(NULLIF($4,''), fc_station_id),
        wialon_token   = COALESCE(NULLIF($5,''), wialon_token),
        wialon_host    = COALESCE(NULLIF($6,''), wialon_host)
      WHERE id=$1
    `, [req.params.id, fcPublicKey||'', fcPrivateKey||'', fcStationId||'', wialonToken||'', wialonHost||'']);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// Логин сотрудника — телефон или email (что заполнено); email в приоритете, если заданы оба.
function deriveLogin(phone, email) {
  return (email && email.trim()) || (phone && phone.trim()) || '';
}

app.post('/api/admin/companies', auth, requireRole('owner'), async (req, res) => {
  const { name, phone, email, password, role } = req.body;
  if (!name) return res.status(400).json({ ok:false, error:'Введите название компании' });
  try {
    const c = await db.query('INSERT INTO public.agro_companies (name) VALUES ($1) RETURNING id, name, status, created_at', [name]);
    const company = c.rows[0];
    let user = null;
    const login = deriveLogin(phone, email);
    if (login && password) {
      const hash = await hashPassword(password);
      const u = await db.query(
        'INSERT INTO public.agro_users (company_id, username, phone, email, password_hash, role, must_change_password) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id, username, phone, email, role, active',
        [company.id, login, phone||null, email||null, hash, role || 'owner']
      );
      user = u.rows[0];
    }
    res.json({ ok:true, company, user });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

app.get('/api/admin/users', auth, requireRole('owner'), async (req, res) => {
  const companyId = req.query.companyId ? parseInt(req.query.companyId) : null;
  try {
    const r = companyId
      ? await db.query('SELECT id, company_id, username, phone, email, role, active, created_at FROM public.agro_users WHERE company_id=$1 ORDER BY created_at', [companyId])
      : await db.query('SELECT id, company_id, username, phone, email, role, active, created_at FROM public.agro_users ORDER BY created_at');
    res.json({ ok:true, data: r.rows });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

app.post('/api/admin/users', auth, requireRole('owner'), async (req, res) => {
  const { companyId, phone, email, password, role } = req.body;
  const login = deriveLogin(phone, email);
  if (!companyId || !login || !password || !role) return res.status(400).json({ ok:false, error:'Заполните компанию, телефон или email, пароль и роль' });
  try {
    const hash = await hashPassword(password);
    const u = await db.query(
      'INSERT INTO public.agro_users (company_id, username, phone, email, password_hash, role, must_change_password) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id, company_id, username, phone, email, role, active',
      [companyId, login, phone||null, email||null, hash, role]
    );
    res.json({ ok:true, user: u.rows[0] });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

app.put('/api/admin/users/:id', auth, requireRole('owner'), async (req, res) => {
  const { active, role } = req.body;
  try {
    await db.query('UPDATE public.agro_users SET active=COALESCE($2,active), role=COALESCE($3,role) WHERE id=$1', [req.params.id, active, role]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

const ALL_CROP_IDS = ['crop_cherry','crop_sour_cherry','crop_apricot','crop_apple','crop_peach','crop_plum','crop_grape','crop_walnut'];

app.get('/api/admin/crop-access', auth, requireRole('owner','accountant'), async (req, res) => {
  const companyId = parseInt(req.query.companyId);
  if (!companyId) return res.status(400).json({ ok:false, error:'Укажите companyId' });
  try {
    const r = await db.query('SELECT * FROM public.agro_crop_access WHERE company_id=$1', [companyId]);
    const byCrop = Object.fromEntries(r.rows.map(row => [row.crop_id, row]));
    const data = ALL_CROP_IDS.map(cropId => byCrop[cropId] || { company_id: companyId, crop_id: cropId, status: 'none' });
    res.json({ ok:true, data });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// Выдать пробный доступ — не больше 365 дней от даты начала
app.post('/api/admin/crop-access/trial', auth, requireRole('owner'), async (req, res) => {
  const { companyId, cropId, trialStartedAt, trialExpiresAt } = req.body;
  if (!companyId || !cropId || !trialStartedAt || !trialExpiresAt) return res.status(400).json({ ok:false, error:'Заполните все поля' });
  const days = (new Date(trialExpiresAt) - new Date(trialStartedAt)) / 86400000;
  if (!(days > 0) || days > 365) return res.status(400).json({ ok:false, error:'Пробный период не может быть больше 365 дней' });
  try {
    await db.query(`
      INSERT INTO public.agro_crop_access (company_id, crop_id, status, trial_started_at, trial_expires_at)
      VALUES ($1,$2,'trial',$3,$4)
      ON CONFLICT (company_id, crop_id) DO UPDATE SET status='trial', trial_started_at=$3, trial_expires_at=$4
    `, [companyId, cropId, trialStartedAt, trialExpiresAt]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// Бухгалтер подтверждает получение оплаты (ещё не включает доступ)
app.post('/api/admin/crop-access/confirm-payment', auth, requireRole('owner','accountant'), async (req, res) => {
  const { companyId, cropId } = req.body;
  if (!companyId || !cropId) return res.status(400).json({ ok:false, error:'Укажите компанию и культуру' });
  try {
    await db.query(`
      INSERT INTO public.agro_crop_access (company_id, crop_id, status, paid_confirmed_by, paid_confirmed_at)
      VALUES ($1,$2,'trial',$3,NOW())
      ON CONFLICT (company_id, crop_id) DO UPDATE SET paid_confirmed_by=$3, paid_confirmed_at=NOW()
    `, [companyId, cropId, req.user.userId || null]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// Админ включает платный доступ — только после подтверждения бухгалтером
app.post('/api/admin/crop-access/enable', auth, requireRole('owner'), async (req, res) => {
  const { companyId, cropId } = req.body;
  if (!companyId || !cropId) return res.status(400).json({ ok:false, error:'Укажите компанию и культуру' });
  try {
    const r = await db.query('SELECT paid_confirmed_at FROM public.agro_crop_access WHERE company_id=$1 AND crop_id=$2', [companyId, cropId]);
    if (!r.rows[0]?.paid_confirmed_at) return res.status(400).json({ ok:false, error:'Сначала бухгалтер должен подтвердить оплату' });
    await db.query(`
      UPDATE public.agro_crop_access SET status='paid', enabled_by=$3, enabled_at=NOW()
      WHERE company_id=$1 AND crop_id=$2
    `, [companyId, cropId, req.user.userId || null]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

app.post('/api/admin/crop-access/disable', auth, requireRole('owner'), async (req, res) => {
  const { companyId, cropId } = req.body;
  if (!companyId || !cropId) return res.status(400).json({ ok:false, error:'Укажите компанию и культуру' });
  try {
    await db.query(`
      INSERT INTO public.agro_crop_access (company_id, crop_id, status) VALUES ($1,$2,'disabled')
      ON CONFLICT (company_id, crop_id) DO UPDATE SET status='disabled'
    `, [companyId, cropId]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// ── STATE (главный механизм синхронизации) ────────────────────
['orchard', 'vegetable'].forEach(key => {
  app.get(`/api/state/${key}`, auth, async (req, res) => {
    const companyId = req.user.companyId || 1; // легаси/дев-режим — данные KKZ
    try {
      const r = await db.query('SELECT data FROM public.state WHERE company_id=$1 AND key=$2', [companyId, key]);
      res.json({ ok: true, data: r.rows[0]?.data ?? null });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post(`/api/state/${key}`, auth, async (req, res) => {
    const companyId = req.user.companyId || 1;
    // Доступ по культурам: не даём сохранить клетку карты с культурой, на которую нет прав
    if (key === 'orchard' && req.body?.cells && req.user.companyId) {
      const cropIds = [...new Set(Object.values(req.body.cells).map(c => c?.cropId || 'crop_cherry'))];
      for (const cropId of cropIds) {
        if (!(await hasCropAccess(companyId, cropId))) {
          return res.status(403).json({ ok:false, error:`Нет доступа к культуре "${cropId}" — обратитесь к администратору` });
        }
      }
    }
    try {
      await db.query(`
        INSERT INTO public.state (company_id, key, data, updated_at) VALUES ($1,$2,$3,NOW())
        ON CONFLICT (company_id, key) DO UPDATE SET data=$3, updated_at=NOW()
      `, [companyId, key, req.body]);
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });
});

// ── WEATHER ───────────────────────────────────────────────────
function fcHeaders(method, path, pub, priv) {
  pub  = pub  || FC_PUBLIC;
  priv = priv || FC_PRIVATE;
  const date = new Date().toUTCString();
  // FieldClimate HMAC: method + route + date + public_key
  const sig  = crypto.createHmac('sha256', priv)
    .update(method.toUpperCase() + path + date + pub).digest('hex');
  return { 'Accept':'application/json', 'Authorization':`hmac ${pub}:${sig}`, 'Request-Date':date };
}

// Свои ключи FieldClimate у компании, иначе (только для company_id=1) — общие ENV.
async function getFcCredentials(companyId, queryStation) {
  if (companyId === 1) return { pub: FC_PUBLIC, priv: FC_PRIVATE, station: queryStation || '00002158' };
  try {
    const r = await db.query('SELECT fc_public_key, fc_private_key, fc_station_id FROM public.agro_companies WHERE id=$1', [companyId]);
    const c = r.rows[0];
    if (!c?.fc_public_key || !c?.fc_private_key) return null;
    return { pub: c.fc_public_key, priv: c.fc_private_key, station: queryStation || c.fc_station_id || '00002158' };
  } catch { return null; }
}

app.get('/api/weather', auth, async (req, res) => {
  const days      = Math.min(parseInt(req.query.days) || 7, 400);
  const companyId = req.user.companyId || 1;
  const creds     = await getFcCredentials(companyId, req.query.station);
  const station   = creds?.station || req.query.station || '00002158';
  try {
    const from = new Date();
    from.setDate(from.getDate() - days);
    const r = await db.query(
      'SELECT * FROM public.weather WHERE company_id=$1 AND station=$2 AND date>=$3 ORDER BY date DESC',
      [companyId, station, from.toISOString().split('T')[0]]
    );
    if (r.rows.length > 0) return res.json({ ok: true, data: r.rows.map(row => ({
      ...row,
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).split('T')[0]
    })) });
  } catch(e) { console.warn('[weather] DB read:', e.message); }

  // Живой запрос к FieldClimate — своими ключами компании, если настроены,
  // иначе (только для основной фермы, id=1) через общие ENV.
  if (!creds) return res.json({ ok: true, data: [] });

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
      fc = await fetch('https://api.fieldclimate.com/v2' + fcPath, { headers: fcHeaders('GET', fcPath, creds.pub, creds.priv), signal: fcController.signal });
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
        INSERT INTO public.weather (company_id,date,station,tmax,tmin,tavg,humidity,precip,wind,et0,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
        ON CONFLICT (company_id,date,station) DO UPDATE SET
          tmax=EXCLUDED.tmax,tmin=EXCLUDED.tmin,tavg=EXCLUDED.tavg,
          humidity=EXCLUDED.humidity,precip=EXCLUDED.precip,wind=EXCLUDED.wind,updated_at=NOW()
      `, [companyId,r.date,r.station,r.tmax,r.tmin,r.tavg,r.humidity,r.precip,r.wind,r.et0]);
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
  const companyId = req.user.companyId || 1;
  try {
    for (const w of rows) {
      if (!w.date) continue;
      const station = w.station || '00002158';
      await db.query(`
        INSERT INTO public.weather (company_id,date,station,tmax,tmin,tavg,humidity,precip,wind,et0,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
        ON CONFLICT (company_id,date,station) DO UPDATE SET
          tmax=EXCLUDED.tmax,tmin=EXCLUDED.tmin,tavg=EXCLUDED.tavg,
          humidity=EXCLUDED.humidity,precip=EXCLUDED.precip,updated_at=NOW()
      `, [companyId, w.date, station, w.tmax||null, w.tmin||null, w.tavg||null,
          w.humidity||null, w.precip||0, w.wind||null, w.et0||null]);
    }
    res.json({ok:true, saved: rows.length});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});


// ── ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ ПОГОДЫ ──────────────────────────────────
// Использует общий FieldClimate-аккаунт (ENV) — пока это только для основной
// фермы (company_id=1); у остальных компаний своих метеостанций пока нет.
app.post('/api/sync-weather', auth, async (req, res) => {
  const companyId = req.user.companyId || 1;
  const creds = await getFcCredentials(companyId, req.query.station || (companyId === 1 ? FC_STATION : null));
  if (!creds) return res.status(403).json({ ok:false, error:'Метеостанция не настроена для этой компании' });
  const station = creds.station;
  try {
    // Try daily first, then hourly for recent days
    const fcPath = `/ag-grid/${station}/daily/last/7`;
    const fc = await fetch('https://api.fieldclimate.com/v2' + fcPath, {
      method: 'POST',
      headers: { ...fcHeaders('POST', fcPath, creds.pub, creds.priv), 'Content-Type': 'application/json' },
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
        INSERT INTO public.weather (company_id,date,station,tmax,tmin,tavg,humidity,precip,wind,et0,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
        ON CONFLICT (company_id,date,station) DO UPDATE SET
          tmax=EXCLUDED.tmax, tmin=EXCLUDED.tmin, tavg=EXCLUDED.tavg,
          humidity=EXCLUDED.humidity, precip=EXCLUDED.precip,
          wind=EXCLUDED.wind,
          et0=COALESCE(EXCLUDED.et0, public.weather.et0),
          updated_at=NOW()
      `, [companyId, r.date, r.station, r.tmax, r.tmin, r.tavg, r.humidity, r.precip, r.wind, r.et0]);
      updated++;
    }

    console.log(`[sync-weather] Updated ${updated} FC days for station ${station}`);

    // Fallback: fill missing recent days with Open-Meteo data.
    // FARM_LAT/LON — координаты KKZ (глобальный ENV), поэтому это только для company_id=1;
    // для остальных компаний координаты пока не настраиваются, лучше пропустить, чем взять чужие.
    if (companyId === 1) try {
    const lat = process.env.FARM_LAT || '47.98';
    const lon = process.env.FARM_LON || '28.72';
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
          INSERT INTO public.weather (company_id,date,station,tmax,tmin,tavg,humidity,precip,wind,et0,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
          ON CONFLICT (company_id,date,station) DO UPDATE SET
            tmax=CASE WHEN public.weather.tmax IS NULL THEN EXCLUDED.tmax ELSE public.weather.tmax END,
            tmin=CASE WHEN public.weather.tmin IS NULL THEN EXCLUDED.tmin ELSE public.weather.tmin END,
            tavg=CASE WHEN public.weather.tavg IS NULL THEN EXCLUDED.tavg ELSE public.weather.tavg END,
            humidity=CASE WHEN public.weather.humidity IS NULL THEN EXCLUDED.humidity ELSE public.weather.humidity END,
            precip=CASE WHEN public.weather.precip IS NULL OR public.weather.precip=0 THEN EXCLUDED.precip ELSE public.weather.precip END,
            et0=CASE WHEN public.weather.et0 IS NULL THEN EXCLUDED.et0 ELSE public.weather.et0 END,
            updated_at=NOW()
        `, [companyId, date, station,
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
  try { const r=await db.query('SELECT * FROM public.treatments WHERE company_id=$1 ORDER BY date DESC', [req.user.companyId||1]); res.json({ok:true,data:r.rows}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/treatments', auth, async (req, res) => {
  const t=req.body;
  const companyId = req.user.companyId || 1;
  try {
    await db.query(`
      INSERT INTO public.treatments (id,company_id,date,product,products,type,method,volume,max_whi,whi_date,parcel_name,crop_id,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET date=$3,product=$4,products=$5,type=$6,method=$7,volume=$8,max_whi=$9,whi_date=$10,parcel_name=$11,crop_id=$12,note=$13
    `, [String(t.id),companyId,t.date,t.product,JSON.stringify(t.products||[]),t.type,t.method,
        t.water||400,t.duration||14,t.endDate||null,t.cellTarget||'all',t.cropId||null,t.note||'']);
    res.json({ok:true});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.delete('/api/treatments/:id', auth, async (req,res) => {
  try { await db.query('DELETE FROM public.treatments WHERE id=$1 AND company_id=$2',[req.params.id, req.user.companyId||1]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── PARCELS (участки полевых/овощных культур) ──────────────────
app.get('/api/parcels', auth, async (req, res) => {
  try { const r=await db.query('SELECT * FROM public.parcels WHERE company_id=$1 ORDER BY created_at', [req.user.companyId||1]); res.json({ok:true,data:r.rows}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/parcels', auth, async (req, res) => {
  const p=req.body;
  const companyId = req.user.companyId || 1;
  try {
    await db.query(`
      INSERT INTO public.parcels (id,company_id,name,ha,crop_id,variety,sowing_date,density,soil,harvest_gdd,tdu_window,yield_plan,yield_fact,field_id,note,calibration,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
      ON CONFLICT (id) DO UPDATE SET name=$3,ha=$4,crop_id=$5,variety=$6,sowing_date=$7,density=$8,soil=$9,
        harvest_gdd=$10,tdu_window=$11,yield_plan=$12,yield_fact=$13,field_id=$14,note=$15,calibration=$16,updated_at=NOW()
    `, [String(p.id),companyId,p.name||'',p.ha||null,p.cropId||null,p.variety||'',p.sowingDate||null,
        p.density||'',p.soil||'',p.harvestGdd||null,p.tduWindow||null,p.yieldPlan||null,p.yieldFact||null,
        p.fieldId||null,p.note||'',JSON.stringify(p.calibration||{})]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.delete('/api/parcels/:id', auth, async (req,res) => {
  try { await db.query('DELETE FROM public.parcels WHERE id=$1 AND company_id=$2',[req.params.id, req.user.companyId||1]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── ANALYSES ──────────────────────────────────────────────────
app.get('/api/analyses', auth, async (req,res) => {
  try { const r=await db.query('SELECT * FROM public.analyses WHERE company_id=$1 ORDER BY date DESC', [req.user.companyId||1]); res.json({ok:true,data:r.rows}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/analyses', auth, async (req,res) => {
  const a = req.body;
  const id = String(a.id || Date.now());
  const companyId = req.user.companyId || 1;
  // Сохраняем весь объект в data, отдельные поля для индексации
  try {
    await db.query(`
      INSERT INTO public.analyses (id, company_id, type, date, parcel_id, lab, values, note, data)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET type=$3, date=$4, parcel_id=$5, lab=$6, values=$7, note=$8, data=$9
    `, [
      id,
      companyId,
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
          INSERT INTO public.analyses (id, company_id, type, date, parcel_id, lab, values, note, data)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (id) DO UPDATE SET type=$3, date=$4, parcel_id=$5, lab=$6, values=$7, note=$8, data=$9
        `, [id, companyId, a.type||'leaf', a.date||null, a.cellKey||a.parcel_id||null, a.lab||'', JSON.stringify(a.values||{}), a.note||'', JSON.stringify(a)]);
        return res.json({ ok: true, id });
      } catch(e2) { return res.status(500).json({ ok:false, error: e2.message }); }
    }
    console.error('[analyses POST]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.delete('/api/analyses/:id', auth, async (req,res) => {
  try { await db.query('DELETE FROM public.analyses WHERE id=$1 AND company_id=$2',[req.params.id, req.user.companyId||1]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// PDF к анализам
app.get('/api/analyses/:id/pdfs', auth, async (req,res) => {
  try {
    const r=await db.query('SELECT id,filename,mime_type,created_at FROM public.analysis_pdfs WHERE analysis_id=$1 AND company_id=$2 ORDER BY created_at',[req.params.id, req.user.companyId||1]);
    res.json({ok:true,data:r.rows});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/analyses/:id/pdfs', auth, upload.single('file'), async (req,res) => {
  try {
    if (!req.file) return res.status(400).json({ok:false,error:'No file'});
    await db.query('INSERT INTO public.analysis_pdfs (analysis_id,company_id,filename,mime_type,data) VALUES ($1,$2,$3,$4,$5)',
      [req.params.id,req.user.companyId||1,req.file.originalname,req.file.mimetype,req.file.buffer]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.get('/api/analyses/:id/pdfs/:fileId/download', auth, async (req,res) => {
  try {
    const r=await db.query('SELECT filename,mime_type,data FROM public.analysis_pdfs WHERE id=$1 AND analysis_id=$2 AND company_id=$3',[req.params.fileId,req.params.id,req.user.companyId||1]);
    if (!r.rows.length) return res.status(404).json({ok:false});
    res.setHeader('Content-Type',r.rows[0].mime_type);
    res.setHeader('Content-Disposition',`attachment; filename="${r.rows[0].filename}"`);
    res.send(r.rows[0].data);
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.delete('/api/analyses/:id/pdfs/:fileId', auth, async (req,res) => {
  try { await db.query('DELETE FROM public.analysis_pdfs WHERE id=$1 AND company_id=$2',[req.params.fileId, req.user.companyId||1]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── CATALOG ───────────────────────────────────────────────────
app.get('/api/catalog', auth, async (req,res) => {
  try { const r=await db.query('SELECT * FROM public.catalog WHERE company_id=$1 ORDER BY name', [req.user.companyId||1]); res.json({ok:true,data:r.rows}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/catalog', auth, async (req,res) => {
  const c=req.body;
  const companyId = req.user.companyId || 1;
  try {
    await db.query(`
      INSERT INTO public.catalog (id,company_id,name,type,active_substance,dose,whi,frac,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (company_id,id) DO UPDATE SET name=$3,type=$4,active_substance=$5,dose=$6,whi=$7,frac=$8,note=$9
    `, [String(c.id),companyId,c.name,c.type||'fungicide',c.activeSubstance||'',String(c.dose||'0'),parseInt(c.whi)||0,c.fracCode||'',c.note||'']);
    res.json({ok:true});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.delete('/api/catalog/:id', auth, async (req,res) => {
  try { await db.query('DELETE FROM public.catalog WHERE id=$1 AND company_id=$2',[req.params.id, req.user.companyId||1]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── SETTINGS ──────────────────────────────────────────────────
app.get('/api/settings/:key', auth, async (req,res) => {
  try {
    const r=await db.query('SELECT value FROM public.settings WHERE key=$1 AND company_id=$2',[req.params.key, req.user.companyId||1]);
    res.json({ok:true,value:r.rows[0]?.value??null});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/settings/:key', auth, async (req,res) => {
  try {
    await db.query(`
      INSERT INTO public.settings (key,company_id,value,updated_at) VALUES ($1,$2,$3,NOW())
      ON CONFLICT (company_id,key) DO UPDATE SET value=$3,updated_at=NOW()
    `, [req.params.key, req.user.companyId||1, req.body.value??req.body]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── CRUD helper ───────────────────────────────────────────────
function crudRoutes(route, table, middleware) {
  const mw = middleware || auth;
  app.get(route, mw, async (req,res) => {
    try { const r=await db.query(`SELECT * FROM public.${table} WHERE company_id=$1 ORDER BY created_at`, [req.user.companyId||1]); res.json({ok:true,data:r.rows}); }
    catch(e) { res.status(500).json({ok:false,error:e.message}); }
  });
  app.post(route, mw, async (req,res) => {
    const b=req.body; const id=b.id||String(Date.now());
    const companyId = req.user.companyId || 1;
    try {
      await db.query(`INSERT INTO public.${table} (id,company_id,name,type,data) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET name=$3,type=$4,data=$5`,
        [String(id),companyId,b.name||'',b.type||'',JSON.stringify(b)]);
      res.json({ok:true,id});
    } catch(e) { res.status(500).json({ok:false,error:e.message}); }
  });
  app.put(`${route}/:id`, mw, async (req,res) => {
    const b=req.body; const id=req.params.id;
    try {
      await db.query(`UPDATE public.${table} SET name=$2,type=$3,data=$4 WHERE id=$1 AND company_id=$5`,
        [String(id), b.name||'', b.type||'', JSON.stringify(b), req.user.companyId||1]);
      res.json({ok:true,id});
    } catch(e) { res.status(500).json({ok:false,error:e.message}); }
  });
  app.delete(`${route}/:id`, mw, async (req,res) => {
    try { await db.query(`DELETE FROM public.${table} WHERE id=$1 AND company_id=$2`,[req.params.id, req.user.companyId||1]); res.json({ok:true}); }
    catch(e) { res.status(500).json({ok:false,error:e.message}); }
  });
}
crudRoutes('/api/equipment',   'equipment', authOpt);
crudRoutes('/api/attachments', 'attachments', authOpt);
// Staff имеет role вместо type — отдельный роут
app.get('/api/staff', authOpt, async (req,res) => {
  try { const r=await db.query('SELECT * FROM public.staff WHERE company_id=$1 ORDER BY created_at', [req.user.companyId||1]); res.json({ok:true,data:r.rows}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/staff', authOpt, async (req,res) => {
  const b=req.body; const id=b.id||String(Date.now());
  const companyId = req.user.companyId || 1;
  try {
    // Добавляем колонку data если нет
    await db.query('ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS data JSONB').catch(()=>{});
    await db.query('ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS phone TEXT').catch(()=>{});
    await db.query(`INSERT INTO public.staff (id,company_id,name,role,phone,data) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=$3,role=$4,phone=$5,data=$6`,
      [String(id), companyId, b.name||'', b.role||b.type||'operator', b.phone||null, JSON.stringify(b)]);
    res.json({ok:true,id});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.delete('/api/staff/:id', authOpt, async (req,res) => {
  try { await db.query('DELETE FROM public.staff WHERE id=$1 AND company_id=$2',[req.params.id, req.user.companyId||1]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

// ── TASKS ─────────────────────────────────────────────────────
app.get('/api/tasks', authOpt, async (req,res) => {
  try { const r=await db.query('SELECT * FROM public.tasks WHERE company_id=$1 ORDER BY created_at DESC', [req.user.companyId||1]); res.json({ok:true,data:r.rows}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.post('/api/tasks', authOpt, async (req,res) => {
  const b=req.body; const id=b.id||String(Date.now());
  const companyId = req.user.companyId || 1;
  try {
    await db.query(`INSERT INTO public.tasks (id,company_id,status,data) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET status=$3,data=$4,updated_at=NOW()`,
      [String(id),companyId,b.status||'new',JSON.stringify(b)]);
    res.json({ok:true,id});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.put('/api/tasks/:id/status', authOpt, async (req,res) => {
  try { await db.query('UPDATE public.tasks SET status=$2,updated_at=NOW() WHERE id=$1 AND company_id=$3',[req.params.id,req.body.status,req.user.companyId||1]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.delete('/api/tasks/:id', authOpt, async (req,res) => {
  try { await db.query('DELETE FROM public.tasks WHERE id=$1 AND company_id=$2',[req.params.id, req.user.companyId||1]); res.json({ok:true}); }
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
app.get('/map', (req,res) => res.sendFile(path.join(__dirname,'public','map.html')));
app.get('/login', (req,res) => res.sendFile(path.join(__dirname,'public','login.html')));


// ── Wialon Proxy (избегаем CORS в браузере) ───────────────────────────────
// Сессии — отдельно на каждую компанию, чтобы одна не сбрасывала/не путала
// сессию другой (раньше был один общий sid на весь процесс).
const _wialonSessions = new Map(); // companyId -> {sid, expiry}

// Свои Wialon-данные у компании, иначе (только company_id=1) — общий ENV.
async function getWialonCredentials(companyId) {
  if (companyId === 1) {
    const token = process.env.WIALON_TOKEN || '';
    if (!token) return null;
    return { token, host: process.env.WIALON_HOST || 'https://hst-api.wialon.com' };
  }
  try {
    const r = await db.query('SELECT wialon_token, wialon_host FROM public.agro_companies WHERE id=$1', [companyId]);
    const c = r.rows[0];
    if (!c?.wialon_token) return null;
    return { token: c.wialon_token, host: c.wialon_host || 'https://hst-api.wialon.com' };
  } catch { return null; }
}

async function wialonCall(companyId, host, svc, params) {
  const body = new URLSearchParams();
  body.append('svc', svc);
  body.append('params', JSON.stringify(params));
  const sess = _wialonSessions.get(companyId);
  if (sess?.sid) body.append('sid', sess.sid);
  const r = await fetch(host + '/wialon/ajax.html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return await r.json();
}

async function wialonLogin(companyId) {
  const creds = await getWialonCredentials(companyId);
  if (!creds) return false;
  const d = await wialonCall(companyId, creds.host, 'token/login', { token: creds.token, fl: 3 });
  if (d.error) { console.error('[Wialon] Login error:', d.error); return false; }
  _wialonSessions.set(companyId, { sid: d.eid, expiry: Date.now() + 4 * 60 * 1000, host: creds.host }); // 4 min
  console.log(`[Wialon] Logged in (company ${companyId})`);
  return true;
}

async function wialonEnsureSession(companyId) {
  const sess = _wialonSessions.get(companyId);
  if (!sess || Date.now() > sess.expiry) {
    return await wialonLogin(companyId);
  }
  return true;
}

// GET /api/wialon/live — позиции всех единиц
app.get('/api/wialon/live', auth, async (req, res) => {
  const companyId = req.user.companyId || 1;
  try {
    const ok = await wialonEnsureSession(companyId);
    if (!ok) return res.json({ ok: false, devices: [], error: 'Wialon not configured' });
    const sess = _wialonSessions.get(companyId);

    // Получить список единиц с последними позициями
    const d = await wialonCall(companyId, sess.host, 'core/search_items', {
      spec: { itemsType:'avl_unit', propName:'sys_name', propValueMask:'*', sortType:'sys_name' },
      force: 1, flags: 1025, from: 0, to: 0,
      sid: sess.sid,
    });

    const items = d.items || [];
    const devices = items.map(u => {
      const pos = u.pos;
      return pos ? {
        device_id: String(u.id),
        name: u.nm,
        lat: pos.y,
        lon: pos.x,
        speed: pos.s || 0,
        status: (pos.s || 0) > 1 ? 'working' : 'stopped',
        timestamp: new Date(pos.t * 1000).toISOString(),
      } : null;
    }).filter(Boolean);

    res.json({ ok: true, devices });
  } catch(e) {
    console.error('[Wialon] live error:', e.message);
    _wialonSessions.delete(companyId); // Try re-login next time
    res.json({ ok: false, devices: [], error: e.message });
  }
});

// ── Wialon API токен ──────────────────────────────────────────────────────
app.get('/api/wialon/token', auth, async (req, res) => {
  const creds = await getWialonCredentials(req.user.companyId || 1);
  if (!creds) return res.json({ ok: false, token: null });
  res.json({ ok: true, token: creds.token, host: creds.host });
});


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



// GET /api/wialon/track/:unit_id — трек единицы за сегодня
app.get('/api/wialon/track/:unit_id', auth, async (req, res) => {
  const companyId = req.user.companyId || 1;
  try {
    const ok = await wialonEnsureSession(companyId);
    if (!ok) return res.json({ ok: false, points: [] });
    const sess = _wialonSessions.get(companyId);

    const unitId = parseInt(req.params.unit_id);
    const hoursBack = parseInt(req.query.hours) || 12;
    const timeTo   = Math.floor(Date.now() / 1000);
    const timeFrom = timeTo - hoursBack * 3600;

    const body = new URLSearchParams();
    body.append('svc', 'messages/load_interval');
    body.append('params', JSON.stringify({
      itemId: unitId, timeFrom, timeTo,
      flags: 1, flagsMask: 1, loadCount: 10000
    }));
    body.append('sid', sess.sid);

    const r = await fetch(sess.host + '/wialon/ajax.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const d = await r.json();
    if (d.error) { _wialonSessions.delete(companyId); return res.json({ ok: false, points: [], error: d.error }); }

    const msgs = d.messages || [];
    const points = msgs
      .filter(m => m.pos)
      .map(m => ({
        lat: m.pos.y, lon: m.pos.x,
        speed: m.pos.s || 0,
        timestamp: new Date(m.t * 1000).toISOString(),
      }));

    res.json({ ok: true, points, unit_id: unitId });
  } catch(e) {
    console.error('[Wialon track]', e.message);
    res.json({ ok: false, points: [], error: e.message });
  }
});


// DEBUG: Wialon raw messages - try multiple methods
app.get('/api/wialon/debug/:unit_id', auth, async (req, res) => {
  const companyId = req.user.companyId || 1;
  try {
    const ok = await wialonEnsureSession(companyId);
    if (!ok) return res.json({ ok: false, error: 'No session' });
    const sess = _wialonSessions.get(companyId);
    const unitId = parseInt(req.params.unit_id);
    const results = {};

    // Method 1: load_last 10 messages
    const b1 = new URLSearchParams();
    b1.append('svc', 'messages/load_last');
    b1.append('params', JSON.stringify({ itemId: unitId, lastTime: 0, lastCount: 10, flags: 1, flagsMask: 255 }));
    b1.append('sid', sess.sid);
    const r1 = await fetch(sess.host + '/wialon/ajax.html', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: b1.toString() });
    results.load_last = await r1.json();

    // Method 2: load_interval with different flags
    const timeTo = Math.floor(Date.now() / 1000);
    const timeFrom = timeTo - 24 * 3600;
    const b2 = new URLSearchParams();
    b2.append('svc', 'messages/load_interval');
    b2.append('params', JSON.stringify({ itemId: unitId, timeFrom, timeTo, flags: 0x0001, flagsMask: 0x0001, loadCount: 50 }));
    b2.append('sid', sess.sid);
    const r2 = await fetch(sess.host + '/wialon/ajax.html', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: b2.toString() });
    results.load_interval = await r2.json();

    res.json({ results, sid: sess.sid, unitId, timeFrom, timeTo });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

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
  console.log('[cron] Starting weather sync...');
  const stations = [];
  if (FC_PUBLIC && FC_PRIVATE) {
    stations.push({ id: FC_STATION || '00002158', pub: FC_PUBLIC, priv: FC_PRIVATE, companyId: 1 });
    const vegPub  = process.env.FIELDCLIMATE_PUBLIC_KEY_VEG  || '';
    const vegPriv = process.env.FIELDCLIMATE_PRIVATE_KEY_VEG || '';
    if (vegPub && vegPriv) {
      stations.push({ id: process.env.FIELDCLIMATE_STATION_VEG || '0020BCDC', pub: vegPub, priv: vegPriv, companyId: 1 });
    }
  }
  // Компании со своими ключами FieldClimate (не KKZ)
  try {
    const r = await db.query(`
      SELECT id, fc_public_key, fc_private_key, fc_station_id FROM public.agro_companies
      WHERE id <> 1 AND fc_public_key IS NOT NULL AND fc_private_key IS NOT NULL AND fc_station_id IS NOT NULL
    `);
    for (const c of r.rows) {
      stations.push({ id: c.fc_station_id, pub: c.fc_public_key, priv: c.fc_private_key, companyId: c.id });
    }
  } catch(e) { console.warn('[cron] company stations lookup:', e.message); }

  for (const st of stations) {
    try {
      const path = `/ag-grid/${st.id}/daily/last/7`;
      const date = new Date().toUTCString();
      const sig  = crypto.createHmac('sha256', st.priv).update('POST' + path + date + st.pub).digest('hex');
      const headers = { 'Accept':'application/json', 'Authorization':`hmac ${st.pub}:${sig}`, 'Request-Date':date, 'Content-Type':'application/json' };
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
          INSERT INTO public.weather (company_id,date,station,tmax,tmin,tavg,humidity,precip,wind,et0,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
          ON CONFLICT (company_id,date,station) DO UPDATE SET
            tmax=EXCLUDED.tmax, tmin=EXCLUDED.tmin, tavg=EXCLUDED.tavg,
            humidity=EXCLUDED.humidity, precip=EXCLUDED.precip,
            wind=EXCLUDED.wind, et0=COALESCE(EXCLUDED.et0, public.weather.et0), updated_at=NOW()
        `, [st.companyId, row.date, st.id,
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

