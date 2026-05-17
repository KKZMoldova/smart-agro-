// setup-superadmin.js
// Запустить ОДИН РАЗ: node setup-superadmin.js
// Создаёт superadmin и первый тенант ККЗ с owner

const db     = require('./db');
const bcrypt = require('bcryptjs');

const SUPERADMIN_LOGIN    = process.env.SA_LOGIN    || 'superadmin';
const SUPERADMIN_PASSWORD = process.env.SA_PASSWORD || 'SmartAgro2026!';

const KKZ_OWNER_LOGIN    = process.env.KKZ_LOGIN    || 'kkz_owner';
const KKZ_OWNER_PASSWORD = process.env.KKZ_PASSWORD || 'kkz2026!';
const KKZ_AGRO_LOGIN     = 'agronomist';
const KKZ_AGRO_PASSWORD  = 'agro2026!';

async function setup() {
  console.log('=== Smart Agro — первоначальная настройка ===\n');

  // 1. Миграция таблиц
  console.log('[1/4] Применяю миграции...');
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        plan TEXT DEFAULT 'basic',
        fc_station_orchard TEXT DEFAULT '',
        fc_station_veg TEXT DEFAULT '',
        fc_public_key TEXT DEFAULT '',
        fc_private_key TEXT DEFAULT '',
        lat FLOAT DEFAULT 48.0167,
        lon FLOAT DEFAULT 28.7,
        timezone TEXT DEFAULT 'Europe/Chisinau',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id TEXT NOT NULL REFERENCES tenants(id),
        login TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'agronomist',
        name TEXT,
        active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, login)
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS super_admins (
        login TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL
      );
    `);
    // Добавляем tenant_id в settings если нет
    await db.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz'`).catch(()=>{});
    await db.query(`CREATE INDEX IF NOT EXISTS idx_settings_tenant ON settings(tenant_id)`).catch(()=>{});
    await db.query(`ALTER TABLE weather ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz'`).catch(()=>{});
    await db.query(`CREATE INDEX IF NOT EXISTS idx_weather_tenant ON weather(tenant_id)`).catch(()=>{});
    console.log('  ✓ Таблицы созданы');
  } catch(e) { console.error('  ✗ Ошибка миграции:', e.message); process.exit(1); }

  // 2. Superadmin
  console.log('[2/4] Создаю superadmin...');
  try {
    const hash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
    await db.query(
      'INSERT INTO super_admins (login, password_hash) VALUES ($1,$2) ON CONFLICT (login) DO UPDATE SET password_hash=$2',
      [SUPERADMIN_LOGIN, hash]
    );
    console.log(`  ✓ superadmin: ${SUPERADMIN_LOGIN} / ${SUPERADMIN_PASSWORD}`);
  } catch(e) { console.error('  ✗ Ошибка:', e.message); }

  // 3. Тенант ККЗ
  console.log('[3/4] Создаю тенант ККЗ...');
  try {
    await db.query(`
      INSERT INTO tenants (id, name, plan, fc_station_orchard, fc_station_veg, lat, lon)
      VALUES ('kkz', 'ККЗ Молдова (Каменка)', 'pro', '00002158', '0020BCDC', 48.0167, 28.7)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('  ✓ Тенант kkz создан');
  } catch(e) { console.error('  ✗ Ошибка:', e.message); }

  // 4. Пользователи ККЗ
  console.log('[4/4] Создаю пользователей ККЗ...');
  const users = [
    { login: KKZ_OWNER_LOGIN,    password: KKZ_OWNER_PASSWORD, role: 'owner',      name: 'Владелец ККЗ' },
    { login: KKZ_AGRO_LOGIN,     password: KKZ_AGRO_PASSWORD,  role: 'agronomist', name: 'Агроном' },
    { login: 'director',          password: 'dir2026!',          role: 'director',   name: 'Директор завода' },
    { login: 'operator',          password: 'op2026!',           role: 'operator',   name: 'Оператор' },
  ];
  for (const u of users) {
    try {
      const hash = await bcrypt.hash(u.password, 10);
      await db.query(
        'INSERT INTO users (tenant_id, login, password_hash, role, name) VALUES (\'kkz\',$1,$2,$3,$4) ON CONFLICT (tenant_id, login) DO NOTHING',
        [u.login, hash, u.role, u.name]
      );
      console.log(`  ✓ ${u.role}: ${u.login} / ${u.password}`);
    } catch(e) { console.error(`  ✗ ${u.login}:`, e.message); }
  }

  console.log('\n=== Готово! ===');
  console.log('Открой https://smart-agro-production.up.railway.app/login');
  console.log('Войди как: agronomist / agro2026!');
  process.exit(0);
}

setup().catch(e => { console.error(e); process.exit(1); });
