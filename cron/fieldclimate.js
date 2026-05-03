const crypto = require('crypto');
const https  = require('https');
const db     = require('../db');

const STATION_ID  = process.env.FIELDCLIMATE_STATION || '00002158';
const PUBLIC_KEY  = process.env.FIELDCLIMATE_PUBLIC_KEY;
const PRIVATE_KEY = process.env.FIELDCLIMATE_PRIVATE_KEY;

// ── HMAC authentication ───────────────────────────────────────────────────
function buildHmacHeaders(method, route) {
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    throw new Error('FIELDCLIMATE_PUBLIC_KEY and FIELDCLIMATE_PRIVATE_KEY env vars required');
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const msg       = method + route + timestamp + PUBLIC_KEY;
  const signature = crypto
    .createHmac('sha256', PRIVATE_KEY)
    .update(msg)
    .digest('hex');
  return {
    'Accept':        'application/json',
    'Authorization': `hmac ${PUBLIC_KEY}:${signature}`,
    'Date':          timestamp,
  };
}

// ── Fetch last N hours from FieldClimate ──────────────────────────────────
function fetchFromFieldClimate(hours = 3) {
  return new Promise((resolve, reject) => {
    const route   = `/v2/data/${STATION_ID}/last/${hours}/hour`;
    const headers = buildHmacHeaders('GET', route);

    const options = {
      hostname: 'api.fieldclimate.com',
      path:     route,
      method:   'GET',
      headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON from FieldClimate: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('FieldClimate request timeout')); });
    req.end();
  });
}

// ── Parse FieldClimate JSON response ─────────────────────────────────────
// Column mapping for station 00002158 (Kaменка / Sesame)
// Verified from actual XLS exports
function parseResponse(json) {
  const dates   = json.dates   || [];
  const sensors = json.sensors || [];

  // Find sensor indices by name/code
  const getIdx = (names) => {
    for (const name of names) {
      const idx = sensors.findIndex(s =>
        s.name?.toLowerCase().includes(name.toLowerCase()) ||
        s.code?.toLowerCase().includes(name.toLowerCase())
      );
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const idxTmax  = getIdx(['temp max', 'tmax', 'air temp max']);
  const idxTmin  = getIdx(['temp min', 'tmin', 'air temp min']);
  const idxTavg  = getIdx(['temp avg', 'tavg', 'air temp', 'temperature']);
  const idxHum   = getIdx(['humidity', 'rh', 'relative hum']);
  const idxRain  = getIdx(['rain', 'precip', 'precipitation']);
  const idxSolar = getIdx(['solar', 'radiation', 'global rad']);
  const idxLeaf  = getIdx(['leaf wet', 'leaf']);
  const idxEt0   = getIdx(['eto', 'et0', 'evapotrans']);

  const rows = [];

  for (let i = 0; i < dates.length; i++) {
    const rawDate = dates[i];
    if (!rawDate) continue;

    const dt    = new Date(rawDate);
    const date  = dt.toISOString().slice(0, 10);
    const hour  = dt.getUTCHours();

    const val = (idx) => {
      if (idx < 0) return null;
      const v = sensors[idx]?.values?.[i];
      if (v === null || v === undefined || v === '') return null;
      return parseFloat(v);
    };

    // Calculate ET₀ from solar radiation if not provided directly
    // Makkink formula calibrated for Moldova 47°N
    let et0 = val(idxEt0);
    if (et0 === null) {
      const solar = val(idxSolar);
      const tavg  = val(idxTavg) ?? ((val(idxTmax) ?? 0) + (val(idxTmin) ?? 0)) / 2;
      if (solar !== null) {
        const Rs = solar * 0.0864; // W/m² → MJ/m²/day
        et0 = Math.max(0, 0.0135 * Rs * (tavg + 5) / 25);
      }
    }

    rows.push({ date, hour, tmax: val(idxTmax), tmin: val(idxTmin),
      tavg: val(idxTavg), humidity: val(idxHum), precip: val(idxRain),
      solar_rad: val(idxSolar), leaf_wet: val(idxLeaf), et0,
    });
  }

  return rows;
}

// ── Save rows to PostgreSQL ───────────────────────────────────────────────
async function saveWeatherRows(rows) {
  let inserted = 0;
  for (const r of rows) {
    const { rowCount } = await db.query(`
      INSERT INTO weather
        (station_id, date, hour, tmax, tmin, tavg, humidity, precip, solar_rad, leaf_wet, et0)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (station_id, date, hour) DO UPDATE SET
        tmax=EXCLUDED.tmax, tmin=EXCLUDED.tmin, tavg=EXCLUDED.tavg,
        humidity=EXCLUDED.humidity, precip=EXCLUDED.precip,
        solar_rad=EXCLUDED.solar_rad, leaf_wet=EXCLUDED.leaf_wet,
        et0=EXCLUDED.et0
    `, [STATION_ID, r.date, r.hour, r.tmax, r.tmin, r.tavg,
        r.humidity, r.precip, r.solar_rad, r.leaf_wet, r.et0]);
    inserted += rowCount;
  }
  return inserted;
}

// ── Main sync function ────────────────────────────────────────────────────
async function syncFieldClimate() {
  const json = await fetchFromFieldClimate(3);
  const rows = parseResponse(json);
  if (!rows.length) {
    console.log('[FieldClimate] No rows parsed');
    return 0;
  }
  const saved = await saveWeatherRows(rows);
  console.log(`[FieldClimate] Saved ${saved}/${rows.length} rows`);
  return saved;
}

module.exports = { syncFieldClimate };
