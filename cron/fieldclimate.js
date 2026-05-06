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
          console.log('[FC][' + station.label + '] dates: ' + (parsed.dates || []).length);
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

function findSensor(data, keys, nameFragments, valueKey) {
  for (var fi = 0; fi < nameFragments.length; fi++) {
    var frag = nameFragments[fi].toLowerCase();
    for (var ki = 0; ki < keys.length; ki++) {
      var s = data[keys[ki]];
      if (!s) continue;
      var name = (s.name || '').toLowerCase();
      if (name.indexOf(frag) >= 0) {
        if (s.values && Array.isArray(s.values[valueKey]) && s.values[valueKey].length > 0) {
          return s.values[valueKey];
        }
      }
    }
  }
  return null;
}

function parseResponse(json, label) {
  var dates = json.dates || [];
  var data  = json.data  || {};
  var keys  = Object.keys(data);

  keys.forEach(function(k) {
    var s = data[k];
    var vkeys = s && s.values ? Object.keys(s.values).join(',') : 'no values';
    console.log('[FC] sensor ' + k + ': ' + (s && s.name || '?') + ' | values keys: ' + vkeys);
  });

  var vTmax  = findSensor(data, keys, ['HC Air temperature', 'air temp', 'temperatura aerului'], 'max');
  var vTmin  = findSensor(data, keys, ['HC Air temperature', 'air temp', 'temperatura aerului'], 'min');
  var vTavg  = findSensor(data, keys, ['HC Air temperature', 'air temp', 'temperatura aerului'], 'avg');
  var vHum   = findSensor(data, keys, ['HC Relative humidity', 'relative hum', 'humidity'], 'avg');
  var vRain  = findSensor(data, keys, ['Precipitatii', 'Precipitation', 'rain', 'осадки'], 'sum');
  var vSolar = findSensor(data, keys, ['Solar radiation', 'solar rad', 'global rad'], 'avg');
  var vLeaf  = findSensor(data, keys, ['Leaf Wetness', 'leaf wet', 'Влажность листьев'], 'time');
  var vEt0   = findSensor(data, keys, ['ET0', 'et0', 'ETO'], 'result');
console.log('[FC][' + (label||'?') + '] tmax found: ' + (vTmax ? 'YES len='+vTmax.length : 'NO'));
  console.log('[FC][' + (label||'?') + '] hum found: ' + (vHum ? 'YES' : 'NO'));
  console.log('[FC][' + (label||'?') + '] rain found: ' + (vRain ? 'YES' : 'NO'));
  console.log('[FC][' + (label||'?') + '] first date raw: ' + dates[0]);
  var rows = [];
  for (var i = 0; i < dates.length; i++) {
    if (!dates[i]) continue;
    var dt   = new Date(dates[i].toString().replace(' ', 'T') + 'Z');
    var date = dt.toISOString().slice(0, 10);
    var hour = dt.getUTCHours();

    function val(arr) {
      if (!arr) return null;
      var v = arr[i];
      if (v === null || v === undefined || v === '') return null;
      return parseFloat(v);
    }

    var tmax  = val(vTmax);
    var tmin  = val(vTmin);
    var tavg  = val(vTavg);
    var hum   = val(vHum);
    var rain  = val(vRain);
    var solar = val(vSolar);
    var leaf  = val(vLeaf);
    var et0   = val(vEt0);

    if (et0 === null && solar !== null) {
      var t = tavg || ((tmax||0)+(tmin||0))/2;
      et0 = Math.max(0, 0.0135 * solar * 0.0864 * (t + 5) / 25);
    }

    rows.push({
      date: date, hour: hour,
      tmax: tmax, tmin: tmin, tavg: tavg,
      humidity: hum, precip: rain,
      solar_rad: solar, leaf_wet: leaf, et0: et0,
    });
  }
  return rows;
}

async function saveWeatherRows(rows, stationId) {
  var inserted = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var res = await db.query(
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

var isFirstRun = true;

async function syncStation(station, period) {
  try {
    var json = await fetchFromFieldClimate(station, period);
    var rows = parseResponse(json, station.label);
    if (!rows.length) {
      console.log('[FieldClimate][' + station.label + '] No rows parsed');
      return 0;
    }
    var saved = await saveWeatherRows(rows, station.id);
    console.log('[FieldClimate][' + station.label + '] Saved ' + saved + '/' + rows.length + ' rows');
    return saved;
  } catch(e) {
    console.error('[FieldClimate][' + station.label + '] Error:', e.message);
    return 0;
  }
}

async function syncFieldClimate() {
  var period = isFirstRun ? '7d' : '3h';
  console.log('[FieldClimate] Period: ' + period);
  var total = 0;
  for (var i = 0; i < STATIONS.length; i++) {
    total += await syncStation(STATIONS[i], period);
  }
  isFirstRun = false;
  return total;
}

module.exports = { syncFieldClimate };
