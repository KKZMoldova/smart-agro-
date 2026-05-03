const router = require('express').Router();
const db     = require('../db');

// GET /api/weather?days=30&station=00002158
router.get('/', async (req, res) => {
  try {
    const days    = Math.min(parseInt(req.query.days) || 30, 365);
    const station = req.query.station || '00002158';

    const result = await db.query(`
      SELECT date, hour, tmax, tmin, tavg, humidity,
             precip, solar_rad, leaf_wet, et0, wind_speed
      FROM weather
      WHERE station_id = $1
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC, hour DESC
      LIMIT 8760
    `, [station]);

    // Group by date for daily aggregates (for GDD calc)
    const byDate = {};
    for (const row of result.rows) {
      const d = row.date.toISOString().slice(0, 10);
      if (!byDate[d]) byDate[d] = { date: d, hours: [], tmax: null, tmin: null,
        tavg: null, humidity: null, precip: 0, et0: 0, leaf_wet: 0 };

      byDate[d].hours.push(row);
      if (row.tmax !== null && (byDate[d].tmax === null || row.tmax > byDate[d].tmax))
        byDate[d].tmax = parseFloat(row.tmax);
      if (row.tmin !== null && (byDate[d].tmin === null || row.tmin < byDate[d].tmin))
        byDate[d].tmin = parseFloat(row.tmin);
      if (row.precip) byDate[d].precip += parseFloat(row.precip);
      if (row.et0)    byDate[d].et0    += parseFloat(row.et0);
      if (row.leaf_wet) byDate[d].leaf_wet += parseFloat(row.leaf_wet);
      if (row.humidity && byDate[d].humidity === null)
        byDate[d].humidity = parseFloat(row.humidity);
    }

    // Calculate tavg for each day
    const daily = Object.values(byDate).map(d => {
      if (d.tmax !== null && d.tmin !== null)
        d.tavg = Math.round((d.tmax + d.tmin) / 2 * 10) / 10;
      d.precip   = Math.round(d.precip * 10) / 10;
      d.et0      = Math.round(d.et0 * 100) / 100;
      d.leaf_wet = Math.round(d.leaf_wet * 10) / 10;
      delete d.hours;
      return d;
    }).sort((a,b) => b.date.localeCompare(a.date));

    res.json({ ok: true, count: daily.length, data: daily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/weather/latest — last 24h hourly for Smith Period etc.
router.get('/latest', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT date, hour, tmax, tmin, tavg, humidity,
             precip, solar_rad, leaf_wet, et0
      FROM weather
      WHERE station_id = '00002158'
        AND date >= CURRENT_DATE - INTERVAL '3 days'
      ORDER BY date DESC, hour DESC
      LIMIT 72
    `);
    res.json({ ok: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/weather — manual entry (operator)
router.post('/', async (req, res) => {
  try {
    const { date, hour=0, tmax, tmin, humidity, precip, et0 } = req.body;
    if (!date) return res.status(400).json({ error: 'date required' });

    const tavg = (tmax && tmin) ? (parseFloat(tmax)+parseFloat(tmin))/2 : null;
    await db.query(`
      INSERT INTO weather (station_id,date,hour,tmax,tmin,tavg,humidity,precip,et0)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (station_id,date,hour) DO UPDATE SET
        tmax=EXCLUDED.tmax, tmin=EXCLUDED.tmin, tavg=EXCLUDED.tavg,
        humidity=EXCLUDED.humidity, precip=EXCLUDED.precip, et0=EXCLUDED.et0
    `, ['00002158', date, hour, tmax, tmin, tavg, humidity, precip, et0]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
