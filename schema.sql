-- ═══════════════════════════════════════════════════════════════════════
-- Smart Agro — полная схема базы данных
-- Версия: 2.0 (мультитенантность)
-- ═══════════════════════════════════════════════════════════════════════

-- Расширения
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══ МУЛЬТИТЕНАНТНОСТЬ ══════════════════════════════════════════════════

-- Таблица хозяйств (тенантов)
CREATE TABLE IF NOT EXISTS tenants (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  plan                  TEXT DEFAULT 'basic',
  fc_station_orchard    TEXT DEFAULT '',
  fc_station_veg        TEXT DEFAULT '',
  fc_public_key         TEXT DEFAULT '',
  fc_private_key        TEXT DEFAULT '',
  lat                   FLOAT DEFAULT 48.0167,
  lon                   FLOAT DEFAULT 28.7,
  timezone              TEXT DEFAULT 'Europe/Chisinau',
  active                BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица суперадминов
CREATE TABLE IF NOT EXISTS super_admins (
  login                 TEXT PRIMARY KEY,
  password_hash         TEXT NOT NULL
);

-- Таблица пользователей
DO $$ BEGIN
  -- Пересоздаём таблицу users с правильной схемой если нет tenant_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='tenant_id'
  ) THEN
    DROP TABLE IF EXISTS users CASCADE;
    CREATE TABLE users (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id         TEXT NOT NULL REFERENCES tenants(id),
      login             TEXT NOT NULL,
      password_hash     TEXT NOT NULL,
      role              TEXT NOT NULL DEFAULT 'agronomist',
      name              TEXT,
      active            BOOLEAN DEFAULT TRUE,
      last_login        TIMESTAMPTZ,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, login)
    );
  END IF;
END $$;

-- ═══ ОСНОВНЫЕ ТАБЛИЦЫ ═══════════════════════════════════════════════════

-- Настройки и состояния (orchard/vegetable state)
CREATE TABLE IF NOT EXISTS settings (
  key                   TEXT PRIMARY KEY,
  value                 JSONB,
  tenant_id             TEXT DEFAULT 'kkz',
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz';
CREATE INDEX IF NOT EXISTS idx_settings_tenant ON settings(tenant_id);

-- Погода
CREATE TABLE IF NOT EXISTS weather (
  id                    SERIAL PRIMARY KEY,
  date                  DATE NOT NULL,
  station               TEXT DEFAULT 'orchard',
  tmin                  FLOAT,
  tmax                  FLOAT,
  tavg                  FLOAT,
  humidity              FLOAT,
  precip                FLOAT DEFAULT 0,
  wind                  FLOAT DEFAULT 0,
  leaf_wet              FLOAT DEFAULT 0,
  et0                   FLOAT DEFAULT 0,
  solar                 FLOAT DEFAULT 0,
  dewpoint              FLOAT,
  vpd                   FLOAT,
  tenant_id             TEXT DEFAULT 'kkz',
  UNIQUE(date, station, tenant_id)
);
ALTER TABLE weather ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz';
CREATE INDEX IF NOT EXISTS idx_weather_date ON weather(date DESC);
CREATE INDEX IF NOT EXISTS idx_weather_station ON weather(station);
CREATE INDEX IF NOT EXISTS idx_weather_tenant ON weather(tenant_id);

-- Обработки
CREATE TABLE IF NOT EXISTS treatments (
  id                    TEXT PRIMARY KEY,
  date                  DATE,
  parcel_name           TEXT,
  products              JSONB,
  method                TEXT DEFAULT 'foliar',
  volume                FLOAT DEFAULT 400,
  max_whi               INTEGER DEFAULT 14,
  whi_date              DATE,
  note                  TEXT,
  tenant_id             TEXT DEFAULT 'kkz',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz';
CREATE INDEX IF NOT EXISTS idx_treatments_tenant ON treatments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_treatments_date ON treatments(date DESC);

-- Анализы
CREATE TABLE IF NOT EXISTS analyses (
  id                    TEXT PRIMARY KEY,
  type                  TEXT,
  date                  DATE,
  data                  JSONB,
  tenant_id             TEXT DEFAULT 'kkz',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS values JSONB;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS lab TEXT DEFAULT '';
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz';
CREATE INDEX IF NOT EXISTS idx_analyses_tenant ON analyses(tenant_id);

-- PDF файлы к анализам
CREATE TABLE IF NOT EXISTS analysis_files (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id           TEXT NOT NULL,
  filename              TEXT NOT NULL,
  mimetype              TEXT NOT NULL DEFAULT 'application/pdf',
  size                  INTEGER NOT NULL,
  data                  BYTEA NOT NULL,
  tenant_id             TEXT DEFAULT 'kkz',
  uploaded_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE analysis_files ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz';
CREATE INDEX IF NOT EXISTS idx_analysis_files_analysis_id ON analysis_files(analysis_id);

-- Каталог препаратов
CREATE TABLE IF NOT EXISTS public.catalog (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  type                  TEXT,
  active_substance      TEXT,
  frac_code             TEXT,
  moa_group             TEXT,
  data                  JSONB,
  tenant_id             TEXT DEFAULT 'kkz',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.catalog ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz';
ALTER TABLE public.catalog ADD COLUMN IF NOT EXISTS frac_code TEXT;
ALTER TABLE public.catalog ADD COLUMN IF NOT EXISTS moa_group TEXT;
CREATE INDEX IF NOT EXISTS idx_catalog_tenant ON public.catalog(tenant_id);

-- Участки/поля (vegetable)
CREATE TABLE IF NOT EXISTS parcels (
  id                    TEXT PRIMARY KEY,
  name                  TEXT,
  area                  FLOAT,
  crop                  TEXT,
  data                  JSONB,
  tenant_id             TEXT DEFAULT 'kkz',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz';

-- Персонал
CREATE TABLE IF NOT EXISTS staff (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  role                  TEXT,
  phone                 TEXT,
  pin                   TEXT,
  data                  JSONB,
  tenant_id             TEXT DEFAULT 'kkz',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz';

-- Задания
CREATE TABLE IF NOT EXISTS tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  status                TEXT DEFAULT 'pending',
  assigned_to           TEXT,
  due_date              DATE,
  data                  JSONB,
  tenant_id             TEXT DEFAULT 'kkz',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS zones_json JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz';

-- Типы работ
CREATE TABLE IF NOT EXISTS work_types (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  tenant_id             TEXT DEFAULT 'kkz'
);

-- Оборудование
CREATE TABLE IF NOT EXISTS equipment (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  type                  TEXT,
  data                  JSONB,
  tenant_id             TEXT DEFAULT 'kkz',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz';

-- Ирригация
CREATE TABLE IF NOT EXISTS irrigations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                  DATE,
  zone                  TEXT,
  duration_min          INTEGER,
  volume_m3             FLOAT,
  mm                    FLOAT,
  data                  JSONB,
  tenant_id             TEXT DEFAULT 'kkz',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE irrigations ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz';

-- Вложения
CREATE TABLE IF NOT EXISTS attachments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type           TEXT,
  entity_id             TEXT,
  filename              TEXT,
  data                  BYTEA,
  tenant_id             TEXT DEFAULT 'kkz',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'kkz';

-- ═══ ДЕФОЛТНЫЙ ТЕНАНТ ═══════════════════════════════════════════════════
INSERT INTO tenants (id, name, plan, fc_station_orchard, fc_station_veg, lat, lon)
VALUES ('kkz', 'ККЗ Молдова (Каменка)', 'pro', '00002158', '0020BCDC', 48.0167, 28.7)
ON CONFLICT (id) DO NOTHING;
