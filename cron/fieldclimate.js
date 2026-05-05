const crypto = require('crypto');
const https  = require('https');
const db     = require('../db');

const STATIONS = [
  {
    id:         process.env.FIELDCLIMATE_STATION_ORCHARD || '00002158',
    publicKey:  process.env.FIELDCLIMATE_PUBLIC_KEY_ORCHARD,
    privateKey: process.env.FIELDCLIMATE_PRIVATE_KEY_ORCHARD,
    label:      'Orchard',
  },
  {
    id:         process.env.FIELDCLIMATE_STATION_VEG || '0020BCDC',
    publicKey:  process.env.FIELDCLIMATE_PUBLIC_KEY_VEG,
    privateKey: process.env.FIELDCLIMATE_PRIVATE_KEY_VEG,
    label:      'Vegetable',
  },
];

function buildHmacHeaders(method, route, publicKey, privateKey) {
  if (!publicKey || !privateKey) throw new Error('Missing FieldClimate API keys');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const msg       = method + route + timestamp + publicKey;
  const signature = crypto.createHmac('sha256', privateKey).update(msg).digest('hex');
  return {
    'Accept':        'application/json',
    'Authorization': `hmac ${publicKey}:${signature}`,
    'Date':          timestamp,
  };
}

function fetchFromFieldClimate(station, hours = 3) {
  return new Promise((resolve, reject) => {
    const route   = `/v2/data/${station.id}/last/${hours}/hour`;
    const headers = buildHmacHeaders('GET', route, station.publicKey, station.privateKey);
    const options = { hostname: 'api.fieldclimate.com', path: route, method: 'GET', headers };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function parseResponse(json, stationId) {
  const dates   = json.dates   || [];
  const sensors = json.sensors || [];

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
    const dt   = new Date(rawDate);
    const date = dt.toISOString().slice(0, 10);
    const hour = dt.getUTCHours();

    const val = (idx) => {
      if (idx < 0) return null;
      const v = sensors[idx]?.values?.[i];
      if (v === null || v === undefined || v === '') return null;
      return parseFloat(v);
    };

    let et0 = val(idxEt0);
    if (et0 === null) {
      const solar = val(idxSolar);
      const tavg  = val(idxTavg) ?? ((val(idxTmax) ?? 0) + (val(idxTmin) ?? 0)) / 2;
      if (solar !== null) {
        const Rs = solar * 0.0864;
        et0 = Math.max(0, 0.0135 * Rs * (tavg + 5) / 25);
      }
    }

    rows.push({
      date, hour,
      tmax: val(idxTmax), tmin: val(idxTmin), tavg: val(idxTavg),
      humidity: val(idxHum), precip: val(idxRain),
      solar_rad: val(idxSolar), leaf_wet: val(idxLeaf), et0,
    });
  }
  return rows;
}

async function saveWeatherRows(rows, stationId) {
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
    `, [stationId, r.date, r.hour, r.tmax, r.tmin, r.tavg,
        r.humidity, r.precip, r.solar_rad, r.leaf_wet, r.et0]);
    inserted += rowCount;
  }
  return inserted;
}

async function syncStation(station) {
  try {
    const json = await fetchFromFieldClimate(station);
    const rows = parseResponse(json, station.id);
    if (!rows.length) {
      console.log(`[FieldClimate][${station.label}] No rows parsed`);
      return 0;
    }
    const saved = await saveWeatherRows(rows, station.id);
    console.log(`[FieldClimate][${station.label}] Saved ${saved}/${rows.length} rows`);
    return saved;
  } catch (e) {
    console.error(`[FieldClimate][${station.label}] Error:`, e.message);
    return 0;
  }
}

async function syncFieldClimate() {
  let total = 0;
  for (const station of STATIONS) {
    total += await syncStation(station);
  }
  return total;
}

module.exports = { syncFieldClimate };
