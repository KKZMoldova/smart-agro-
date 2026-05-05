-- Smart-Agro Database Schema
-- Run this in Railway PostgreSQL console

-- ── Weather ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weather (
  id         SERIAL PRIMARY KEY,
  station_id VARCHAR(20) NOT NULL DEFAULT '00002158',
  date       DATE        NOT NULL,
  hour       SMALLINT    NOT NULL DEFAULT 0,
  tmax       NUMERIC(5,2),
  tmin       NUMERIC(5,2),
  tavg       NUMERIC(5,2),
  humidity   NUMERIC(5,2),
  precip     NUMERIC(6,2) DEFAULT 0,
  solar_rad  NUMERIC(8,2),
  leaf_wet   NUMERIC(6,2),
  et0        NUMERIC(6,3),
  wind_speed NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(station_id, date, hour)
);

-- ── Users / Roles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  role       VARCHAR(20) NOT NULL UNIQUE,
  pin_hash   VARCHAR(64) NOT NULL,
  label      VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default PINs (hashed with SHA-256)


-- Default PINs (hashed with SHA-256)
-- 1111=owner, 2222=agronomist, 3333=factory, 4444=operator
INSERT INTO users (role, pin_hash, label) VALUES
  ('owner',      '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', 'Владелец'),
  ('agronomist', '49a541910c2c8abe9dc98a8f98d2e6706413bb77e747e3d3c1c90dd779b0e0c6', 'Агроном'),
  ('factory',    'e8a31ec76cb25bf5e3a60917b940d1f0ff1b5a58ac8c0c2c3ac82a42be3b63f', 'Директор завода'),
  ('operator',   '1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014', 'Оператор')
ON CONFLICT (role) DO NOTHING;

-- ── Parcels ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcels (
  id           VARCHAR(36) PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  ha           NUMERIC(8,2),
  crop_id      VARCHAR(50),
  variety      VARCHAR(100),
  sowing_date  DATE,
  density      VARCHAR(50),
  soil         VARCHAR(50),
  harvest_gdd  NUMERIC(7,1),
  tdu_window   INTEGER,
  note         TEXT,
  calibration  JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Treatments ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS treatments (
  id            VARCHAR(36) PRIMARY KEY,
  date          DATE        NOT NULL,
  parcel_id     VARCHAR(36) REFERENCES parcels(id) ON DELETE SET NULL,
  parcel_name   VARCHAR(100),
  crop_id       VARCHAR(50),
  crop_name     VARCHAR(100),
  variety       VARCHAR(100),
  phase_name    VARCHAR(100),
  gdd           NUMERIC(7,1),
  products      JSONB       NOT NULL DEFAULT '[]',
  method        VARCHAR(30),
  volume        INTEGER,
  max_whi       INTEGER,
  whi_date      DATE,
  note          TEXT,
  created_by    VARCHAR(20),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Irrigations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS irrigations (
  id          VARCHAR(36) PRIMARY KEY,
  date        DATE        NOT NULL,
  parcel_id   VARCHAR(36) REFERENCES parcels(id) ON DELETE SET NULL,
  parcel_name VARCHAR(100),
  method      VARCHAR(30),
  duration_h  NUMERIC(5,2),
  volume_m3   NUMERIC(8,2),
  etc_mm      NUMERIC(6,2),
  note        TEXT,
  created_by  VARCHAR(20),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Analyses ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyses (
  id          VARCHAR(36) PRIMARY KEY,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('leaf','soil','water')),
  date        DATE        NOT NULL,
  parcel_id   VARCHAR(36) REFERENCES parcels(id) ON DELETE SET NULL,
  parcel_name VARCHAR(100),
  lab         VARCHAR(100),
  values      JSONB       NOT NULL DEFAULT '{}',
  note        TEXT,
  created_by  VARCHAR(20),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Catalog (products) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog (
  id                VARCHAR(36) PRIMARY KEY,
  name              VARCHAR(200) NOT NULL,
  type              VARCHAR(30),
  active_substance  TEXT,
  dose              VARCHAR(50),
  whi               INTEGER,
  frac              VARCHAR(20),
  irac              VARCHAR(20),
  note              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Settings (GDD calibration, etc.) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      JSONB        NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_weather_date       ON weather(date DESC);
CREATE INDEX IF NOT EXISTS idx_weather_station    ON weather(station_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_treatments_date    ON treatments(date DESC);
CREATE INDEX IF NOT EXISTS idx_treatments_parcel  ON treatments(parcel_id);
CREATE INDEX IF NOT EXISTS idx_irrigations_date   ON irrigations(date DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_type_date ON analyses(type, date DESC);
