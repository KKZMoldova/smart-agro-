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
  const timestamp = new Date().toUTCString();
  const msg       = method + route + timestamp + publicKey;
  const signature = crypto.createHmac('sha256', privateKey.trim()).update(msg).digest('hex');
  return {
    'Accept':        'application/json',
    'Authorization': 'hmac ' + publicKey.trim() + ':' + signature,
    'Request-Date':  timestamp,
  };
}

function fetchFromFieldClimate(station, period) {
  period = period || '3h';
  return new Promise(function(resolve, reject) {
    const route = '/v2/data/' + station.id + '/raw/last/' + period;
    const headers = buildHmacHeaders('GET', route, station.publicKey, station.privateKey);
    const options = { hostname: 'api.fieldclimate.com', path: route, method: 'GET', headers: headers };
    const req = https.request(options, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          const parsed = JSON.parse(data);
          console.log('[FC][' + station.label + '] keys: ' + Object.keys(parsed).join(','));
          if (parsed.message) console.log('[FC][' + station.label + '] message: ' + parsed.message);
          console.log('[FC][' + station.label + '] dates: ' + (parsed.dates || []).length);
if (parsed.sensors && parsed.sensors.length > 0) {
  console.log('[FC][' + station.label + '] sensors: ' + parsed.sensors.map(s => s.name + '(' + s.code + ')').join(', '));
}
          resolve(parsed);
        } catch(e) {
          console.log('[FC][' + station.label + '] raw: ' + data.slice(0, 300));
          reject(new Error('Invalid JSON'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, function() { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function parseResponse(json) {
  const dates   = json.dates   || [];
  const sensors = json.sensors || [];

  function getIdx(names) {
    for (let n = 0; n < names.length; n++) {
      const idx = sensors.findIndex(function(s) {
        return (s.name || '').toLowerCase().indexOf(names[n].toLowerCase()) >= 0 ||
               (s.code || '').toLowerCase().indexOf(names[n].toLowerCase()) >= 0;
      });
      if (idx >= 0) return idx;
    }
    return -1;
  }

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
    if (!dates[i]) continue;
    const dt   = new Date(dates[i]);
    const date = dt.toISOString().slice(0, 10);
    const hour = dt.getUTCHours();

    function val(idx) {
      if (idx < 0) return null;
      const v = sensors[idx] && sensors[idx].values && sensors[idx].values[i];
      if (v === null || v === undefined || v === '') return null;
      return parseFloat(v);
    }

    let et0 = val(idxEt0);
    if (et0 === null) {
      const solar = val(idxSolar);
      const tavg  = val(idxTavg) || ((val(idxTmax) || 0) + (val(idxTmin) || 0)) / 2;
      if (solar !== null) {
        et0 = Math.max(0, 0.0135 * solar * 0.0864 * (tavg + 5) / 25);
      }
    }

    rows.push({
      date: date, hour: hour,
      tmax: val(idxTmax), tmin: val(idxTmin), tavg: val(idxTavg),
      humidity: val(idxHum), precip: val(idxRain),
      solar_rad: val(idxSolar), leaf_wet: val(idxLeaf), et0: et0,
    });
  }
  return rows;
}

async function saveWeatherRows(rows, stationId) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const res = await db.query(
      'INSERT INTO weather (station_id,date,hour,tmax,tmin,tavg,humidity,precip,solar_rad,leaf_wet,et0) ' +
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ' +
      'ON CONFLICT (station_id,date,hour) DO UPDATE SET ' +
      'tmax=EXCLUDED.tmax,tmin=EXCLUDED.tmin,tavg=EXCLUDED.tavg,' +
      'humidity=EXCLUDED.humidity,precip=EXCLUDED.precip,' +
      'solar_rad=EXCLUDED.solar_rad,leaf_wet=EXCLUDED.leaf_wet,et0=EXCLUDED.et0',
      [stationId, r.date, r.hour, r.tmax, r.tmin, r.tavg,
       r.humidity, r.precip, r.solar_rad, r.leaf_wet, r.et0]
    );
    inserted += res.rowCount;
  }
  return inserted;
}

let isFirstRun = true;

async function syncStation(station, period) {
  try {
    const json = await fetchFromFieldClimate(station, period);
    const rows = parseResponse(json);
    if (!rows.length) {
      console.log('[FieldClimate][' + station.label + '] No rows parsed');
      return 0;
    }
    const saved = await saveWeatherRows(rows, station.id);
    console.log('[FieldClimate][' + station.label + '] Saved ' + saved + '/' + rows.length + ' rows');
    return saved;
  } catch(e) {
    console.error('[FieldClimate][' + station.label + '] Error:', e.message);
    return 0;
  }
}

async function syncFieldClimate() {
  const period = isFirstRun ? '7d' : '3h';
  console.log('[FieldClimate] Period: ' + period);
  let total = 0;
  for (let i = 0; i < STATIONS.length; i++) {
    total += await syncStation(STATIONS[i], period);
  }
  isFirstRun = false;
  return total;
}

module.exports = { syncFieldClimate };
