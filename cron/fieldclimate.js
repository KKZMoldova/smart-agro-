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
  const dates = json.dates || [];
  const data  = json.data  || {};

  console.log('[FC] data keys: ' + Object.keys(data).join(', '));
  // Логируем первый сенсор для диагностики
const firstKey = Object.keys(data)[0];
if (firstKey) {
  Object.keys(data).forEach(k => {
  console.log('[FC] sensor ' + k + ': ' + data[k].name + ' | values keys: ' + Object.keys(data[k].values || {}).join(','));
});
  console.log('[FC] sensor keys: ' + Object.keys(s).join(', '));
  console.log('[FC] sensor name: ' + s.name);
  console.log('[FC] values sample: ' + JSON.stringify(s.values || s.aggr || s.vals || 'none').slice(0, 200));
}

  function findVals(keywords) {
  for (let dk of Object.keys(data)) {
    const sensor = data[dk];
    const sensorName = ((sensor.name || '') + ' ' + (sensor.name_original || '')).toLowerCase();
    const matches = keywords.some(k => sensorName.includes(k.toLowerCase()));
    if (matches) {
      if (sensor.values && Array.isArray(sensor.values.avg)) return sensor.values.avg;
if (sensor.aggr   && Array.isArray(sensor.aggr.avg))   return sensor.aggr.avg;
if (Array.isArray(sensor.values)) return sensor.values;
if (Array.isArray(sensor.aggr))   return sensor.aggr;
      if (Array.isArray(sensor))        return sensor;
    }
  }
  return null;
}

  const vTmax  = findVals(['max','tmax','maximum']);
const vTmin  = findVals(['min','tmin','minimum']);
const vTavg  = findVals(['temperatura aerului','air temperature','temp']);
const vHum   = findVals(['umiditate','humidity','rh']);
const vRain  = findVals(['precipit','rain','ploaie']);
const vSolar = findVals(['solar','rad']);
const vLeaf  = findVals(['leaf','frunza','foliar']);
const vEt0   = findVals(['et0','eto','evapotrans']);

  const rows = [];
  for (let i = 0; i < dates.length; i++) {
    if (!dates[i]) continue;
    const dt   = new Date(typeof dates[i] === 'number' ? dates[i] * 1000 : dates[i]);
    const date = dt.toISOString().slice(0, 10);
    const hour = dt.getUTCHours();

    function val(arr) {
      if (!arr) return null;
      const v = arr[i];
      if (v === null || v === undefined || v === '') return null;
      return parseFloat(v);
    }

    let et0 = val(vEt0);
    if (et0 === null) {
      const solar = val(vSolar);
      const tavg  = val(vTavg) || ((val(vTmax)||0) + (val(vTmin)||0)) / 2;
      if (solar !== null) {
        et0 = Math.max(0, 0.0135 * solar * 0.0864 * (tavg + 5) / 25);
      }
    }

    rows.push({
      date, hour,
      tmax: val(vTmax), tmin: val(vTmin), tavg: val(vTavg),
      humidity: val(vHum), precip: val(vRain),
      solar_rad: val(vSolar), leaf_wet: val(vLeaf), et0,
    });
  }
  return rows;
}

async function syncFieldClimate() {
  for (const station of STATIONS) {
    try {
      const json = await fetchFromFieldClimate(station, '48h');
      const rows = parseResponse(json);
      for (const row of rows) {
        await db.query(`
          INSERT INTO weather
          (station_id, date, hour, tmax, tmin, tavg, humidity, precip, solar_rad, leaf_wet, et0)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (station_id, date, hour) DO UPDATE SET
            tmax=EXCLUDED.tmax, tmin=EXCLUDED.tmin, tavg=EXCLUDED.tavg,
            humidity=EXCLUDED.humidity, precip=EXCLUDED.precip,
            solar_rad=EXCLUDED.solar_rad, leaf_wet=EXCLUDED.leaf_wet, et0=EXCLUDED.et0
        `, [station.id, row.date, row.hour, row.tmax, row.tmin, row.tavg,
            row.humidity, row.precip, row.solar_rad, row.leaf_wet, row.et0]);
      }
      console.log(`[FC][${station.label}] saved ${rows.length} rows`);
    } catch(e) {
      console.error(`[FC][${station.label}] error:`, e.message);
    }
  }
}

module.exports = { syncFieldClimate };
