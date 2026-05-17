// routes/auth.js — авторизация с JWT и bcrypt
const express  = require('express');
const router   = express.Router();
const db       = require('../db');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-agro-secret-2026-change-in-production';
const JWT_EXPIRES = '30d';

// ── Middleware: проверка JWT токена ─────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '') ||
                req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Нет токена авторизации' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, tenantId, role, login }
    next();
  } catch(e) {
    return res.status(401).json({ error: 'Токен недействителен или истёк' });
  }
}

// ── POST /api/auth/login ────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { login, password, tenantId } = req.body;
  if (!login || !password) return res.status(400).json({ error: 'Введите логин и пароль' });

  try {
    let user, tenant;

    // Суперадмин (для управления тенантами)
    if (login === 'superadmin') {
      const r = await db.query('SELECT * FROM super_admins WHERE login=$1', [login]);
      if (!r.rows.length) return res.status(401).json({ error: 'Неверный логин или пароль' });
      const sa = r.rows[0];
      const ok = await bcrypt.compare(password, sa.password_hash);
      if (!ok) return res.status(401).json({ error: 'Неверный пароль' });
      const token = jwt.sign(
        { userId: 'super', tenantId: '*', role: 'superadmin', login },
        JWT_SECRET, { expiresIn: JWT_EXPIRES }
      );
      return res.json({ ok: true, token, role: 'superadmin', tenantId: '*', name: 'Super Admin' });
    }

    // Обычный пользователь
    const query = tenantId
      ? 'SELECT u.*, t.name as tenant_name, t.fc_station_orchard, t.fc_station_veg, t.lat, t.lon FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.login=$1 AND u.tenant_id=$2 AND u.active=TRUE'
      : 'SELECT u.*, t.name as tenant_name, t.fc_station_orchard, t.fc_station_veg, t.lat, t.lon FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.login=$1 AND u.active=TRUE';
    const params = tenantId ? [login, tenantId] : [login];
    const r = await db.query(query, params);

    if (!r.rows.length) return res.status(401).json({ error: 'Пользователь не найден' });
    user = r.rows[0];

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверный пароль' });

    // Обновляем last_login
    await db.query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role, login: user.login },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );

    res.json({
      ok: true,
      token,
      role:        user.role,
      tenantId:    user.tenant_id,
      tenantName:  user.tenant_name,
      name:        user.name || user.login,
      fcOrchard:   user.fc_station_orchard,
      fcVeg:       user.fc_station_veg,
      lat:         user.lat,
      lon:         user.lon,
    });
  } catch(e) {
    console.error('[Auth] Login error:', e.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT u.*, t.name as tenant_name, t.fc_station_orchard, t.fc_station_veg, t.lat, t.lon FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.id=$1',
      [req.user.userId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    const u = r.rows[0];
    res.json({ ok: true, role: u.role, tenantId: u.tenant_id, tenantName: u.tenant_name, name: u.name || u.login });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth/change-password ─────────────────────────────────────
router.post('/change-password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  try {
    const r = await db.query('SELECT * FROM users WHERE id=$1', [req.user.userId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    const ok = await bcrypt.compare(oldPassword, r.rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверный текущий пароль' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.userId]);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══ ADMIN роуты (только owner или superadmin) ══════════════════════════

function adminOnly(req, res, next) {
  if (req.user.role !== 'owner' && req.user.role !== 'superadmin')
    return res.status(403).json({ error: 'Только для администратора' });
  next();
}

// ── GET /api/auth/users — список пользователей тенанта ─────────────────
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const tid = req.user.role === 'superadmin' ? req.query.tenantId : req.user.tenantId;
    const r = await db.query(
      'SELECT id, login, name, role, active, last_login, created_at FROM users WHERE tenant_id=$1 ORDER BY created_at',
      [tid]
    );
    res.json({ ok: true, users: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/users — создать пользователя ─────────────────────────
router.post('/users', authMiddleware, adminOnly, async (req, res) => {
  const { login, password, role, name } = req.body;
  if (!login || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  const tenantId = req.user.role === 'superadmin' ? (req.body.tenantId || req.user.tenantId) : req.user.tenantId;
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await db.query(
      'INSERT INTO users (tenant_id, login, password_hash, role, name) VALUES ($1,$2,$3,$4,$5) RETURNING id, login, role, name',
      [tenantId, login, hash, role || 'agronomist', name || login]
    );
    res.json({ ok: true, user: r.rows[0] });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/auth/users/:id — обновить пользователя ─────────────────────
router.put('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, role, active, password } = req.body;
  try {
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
      const hash = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET password_hash=$1 WHERE id=$2 AND tenant_id=$3', [hash, req.params.id, req.user.tenantId]);
    }
    await db.query(
      'UPDATE users SET name=$1, role=$2, active=$3 WHERE id=$4 AND tenant_id=$5',
      [name, role, active, req.params.id, req.user.tenantId]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/auth/users/:id ─────────────────────────────────────────
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await db.query('UPDATE users SET active=FALSE WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenantId]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ SUPERADMIN: управление тенантами ══════════════════════════════════

// ── GET /api/auth/tenants ────────────────────────────────────────────────
router.get('/tenants', authMiddleware, async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Только superadmin' });
  try {
    const r = await db.query('SELECT id, name, plan, fc_station_orchard, fc_station_veg, lat, lon, active, created_at FROM tenants ORDER BY created_at');
    res.json({ ok: true, tenants: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/tenants — создать нового партнёра ───────────────────
router.post('/tenants', authMiddleware, async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Только superadmin' });
  const { id, name, plan, fc_station_orchard, fc_station_veg, lat, lon, ownerLogin, ownerPassword } = req.body;
  if (!id || !name || !ownerLogin || !ownerPassword) return res.status(400).json({ error: 'id, name, ownerLogin, ownerPassword обязательны' });
  try {
    // Создаём тенант
    await db.query(
      'INSERT INTO tenants (id, name, plan, fc_station_orchard, fc_station_veg, lat, lon) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, name, plan || 'basic', fc_station_orchard || '', fc_station_veg || '', lat || 47.0, lon || 28.0]
    );
    // Создаём owner для тенанта
    const hash = await bcrypt.hash(ownerPassword, 10);
    await db.query(
      'INSERT INTO users (tenant_id, login, password_hash, role, name) VALUES ($1,$2,$3,\'owner\',$4)',
      [id, ownerLogin, hash, name + ' Admin']
    );
    // Создаём дефолтный state для orchard и vegetable
    await db.query(
      `INSERT INTO settings (key, value, tenant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [`orchard_full_state`, JSON.stringify({}), id]
    );
    await db.query(
      `INSERT INTO settings (key, value, tenant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [`vegetable_full_state`, JSON.stringify({}), id]
    );
    res.json({ ok: true, tenantId: id });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Тенант с таким ID уже существует' });
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/auth/tenants/:id — обновить настройки тенанта ─────────────
router.put('/tenants/:id', authMiddleware, async (req, res) => {
  const isSuperAdmin = req.user.role === 'superadmin';
  const isOwner = req.user.role === 'owner' && req.user.tenantId === req.params.id;
  if (!isSuperAdmin && !isOwner) return res.status(403).json({ error: 'Нет прав' });
  const { name, fc_station_orchard, fc_station_veg, fc_public_key, fc_private_key, lat, lon, plan } = req.body;
  try {
    const fields = [];
    const vals = [];
    let i = 1;
    if (name !== undefined)              { fields.push(`name=$${i++}`);               vals.push(name); }
    if (fc_station_orchard !== undefined){ fields.push(`fc_station_orchard=$${i++}`); vals.push(fc_station_orchard); }
    if (fc_station_veg !== undefined)    { fields.push(`fc_station_veg=$${i++}`);     vals.push(fc_station_veg); }
    if (fc_public_key !== undefined)     { fields.push(`fc_public_key=$${i++}`);      vals.push(fc_public_key); }
    if (fc_private_key !== undefined)    { fields.push(`fc_private_key=$${i++}`);     vals.push(fc_private_key); }
    if (lat !== undefined)               { fields.push(`lat=$${i++}`);                vals.push(lat); }
    if (lon !== undefined)               { fields.push(`lon=$${i++}`);                vals.push(lon); }
    if (plan !== undefined && isSuperAdmin){ fields.push(`plan=$${i++}`);             vals.push(plan); }
    if (!fields.length) return res.status(400).json({ error: 'Нет данных для обновления' });
    vals.push(req.params.id);
    await db.query(`UPDATE tenants SET ${fields.join(',')} WHERE id=$${i}`, vals);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.adminOnly = adminOnly;
