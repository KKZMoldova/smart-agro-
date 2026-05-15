
const router = require('express').Router();
const db     = require('../db');

// ── Названия параметров ───────────────────────────────────────
const PARAM_NAMES = {
  pH:    'Кислотность (pH)',
  humus: 'Гумус',
  N:     'Азот (N)',
  P2O5:  'Фосфор (P₂O₅)',
  K2O:   'Калий (K₂O)',
  EC:    'Электропроводность (EC)',
  P:     'Фосфор (P)',
  K:     'Калий (K)',
  Ca:    'Кальций (Ca)',
  Mg:    'Магний (Mg)',
  Fe:    'Железо (Fe)',
  Zn:    'Цинк (Zn)',
  B:     'Бор (B)',
  HCO3:  'Карбонаты (HCO₃)',
  Cl:    'Хлориды (Cl)',
  Na:    'Натрий/SAR',
};

// ── Приоритет отклонения ──────────────────────────────────────
function calcPriority(pct) {
  if (pct >= 50) return 'critical';
  if (pct >= 20) return 'high';
  return 'medium';
}

// ── Движок рекомендаций FAO ───────────────────────────────────
function generateRecommendations(results, norms) {
  const recs = [];
  for (const norm of norms) {
    const raw = results[norm.parameter];
    if (raw === undefined || raw === null || raw === '') continue;
    const val = parseFloat(raw);
    if (isNaN(val)) continue;

    let status = 'ok';
    let rec    = null;
    let devPct = 0;

    if (norm.min_val !== null && val < parseFloat(norm.min_val)) {
      status = 'low';
      devPct = Math.round(((parseFloat(norm.min_val) - val) / parseFloat(norm.min_val)) * 100);
      rec    = norm.rec_low;
    } else if (norm.max_val !== null && val > parseFloat(norm.max_val)) {
      status = 'high';
      devPct = Math.round(((val - parseFloat(norm.max_val)) / parseFloat(norm.max_val)) * 100);
      rec    = norm.rec_high;
    }

    recs.push({
      parameter:      norm.parameter,
      name:           PARAM_NAMES[norm.parameter] || norm.parameter,
      value:          val,
      unit:           norm.unit,
      min:            norm.min_val,
      max:            norm.max_val,
      status,
      deviation_pct:  devPct,
      recommendation: rec,
      priority:       status !== 'ok' ? calcPriority(devPct) : null,
      source:         norm.source || 'FAO'
    });
  }
  const ORDER = { critical: 0, high: 1, medium: 2, null: 3 };
  recs.sort((a, b) => (ORDER[a.priority] ?? 3) - (ORDER[b.priority] ?? 3));
  return recs;
}

// ── GET /api/analyses ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { parcel, parcel_name, type, culture, limit = 200, offset = 0 } = req.query;
    let q = 'SELECT * FROM public.analyses WHERE 1=1';
    const p = [];

    if (parcel)      { p.push(parcel);            q += ` AND parcel_id=$${p.length}`; }
    if (parcel_name) { p.push(`%${parcel_name}%`); q += ` AND parcel_name ILIKE $${p.length}`; }
    if (type)        { p.push(type);              q += ` AND type=$${p.length}`; }
    if (culture)     { p.push(culture);           q += ` AND culture=$${p.length}`; }

    q += ` ORDER BY analysis_date DESC, created_at DESC LIMIT $${p.length+1} OFFSET $${p.length+2}`;
    p.push(parseInt(limit), parseInt(offset));

    const r = await db.query(q, p);
    res.json({ ok: true, data: r.rows });
  } catch (e) {
    console.error('[analyses GET /]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── GET /api/analyses/cultures ────────────────────────────────
router.get('/cultures', (req, res) => {
  res.json({
    ok: true,
    data: {
      tomato:   'Томат',
      pepper:   'Перец',
      cucumber: 'Огурец',
      pea:      'Горох',
      cherry:   'Вишня',
      apple:    'Яблоня'
    }
  });
});

// ── GET /api/analyses/norms/:type/:culture ────────────────────
router.get('/norms/:type/:culture', async (req, res) => {
  try {
    const { type, culture } = req.params;
    const cult = type === 'water' ? 'all' : culture;
    const r = await db.query(
      `SELECT * FROM public.fao_norms
       WHERE analysis_type = $1 AND culture = $2
       ORDER BY parameter`,
      [type, cult]
    );
    res.json({ ok: true, data: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── GET /api/analyses/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM public.analyses WHERE id = $1',
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, data: r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /api/analyses ────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const v = req.body;

    // Совместимость: старый формат использовал v.values и v.date
    const results = v.results || v.values || {};
    const type    = v.type;
    const date    = v.analysis_date || v.date;
    const culture = v.culture || null;

    if (!type || !date)
      return res.status(400).json({ ok: false, error: 'type и date обязательны' });

    // Генерируем рекомендации FAO
    const cult = type === 'water' ? 'all' : (culture || 'tomato');
    const normsRes = await db.query(
      `SELECT * FROM public.fao_norms WHERE analysis_type = $1 AND culture = $2`,
      [type, cult]
    );
    const recs = generateRecommendations(results, normsRes.rows);

    // id: используем переданный или генерируем новый
    const id = v.id || `AN-${Date.now()}`;

    await db.query(`
      INSERT INTO public.analyses
        (id, type, analysis_date, parcel_id, parcel_name, lab_name,
         culture, growth_phase, water_source,
         results, pdf_url, recommendations, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        type            = $2,
        analysis_date   = $3,
        parcel_id       = $4,
        parcel_name     = $5,
        lab_name        = $6,
        culture         = $7,
        growth_phase    = $8,
        water_source    = $9,
        results         = $10,
        pdf_url         = $11,
        recommendations = $12,
        notes           = $13,
        updated_at      = NOW()
    `, [
      id,
      type,
      date,
      v.parcelId    || v.parcel_id    || null,
      v.parcelName  || v.parcel_name  || null,
      v.lab         || v.lab_name     || null,
      culture,
      v.growth_phase || null,
      v.water_source || null,
      JSON.stringify(results),
      v.pdf_url      || null,
      JSON.stringify(recs),
      v.note || v.notes || null
    ]);

    res.json({ ok: true, id, recommendations: recs });
  } catch (e) {
    console.error('[analyses POST /]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── PUT /api/analyses/:id ─────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const v       = req.body;
    const results = v.results || v.values || null;
    const type    = v.type    || null;
    const culture = v.culture || null;

    let recsJson = null;
    if (results && type) {
      const cult = type === 'water' ? 'all' : (culture || 'tomato');
      const normsRes = await db.query(
        `SELECT * FROM public.fao_norms WHERE analysis_type = $1 AND culture = $2`,
        [type, cult]
      );
      recsJson = JSON.stringify(generateRecommendations(results, normsRes.rows));
    }

    const upd = await db.query(
      `UPDATE public.analyses SET
         parcel_id       = COALESCE($1,  parcel_id),
         parcel_name     = COALESCE($2,  parcel_name),
         lab_name        = COALESCE($3,  lab_name),
         culture         = COALESCE($4,  culture),
         growth_phase    = COALESCE($5,  growth_phase),
         water_source    = COALESCE($6,  water_source),
         analysis_date   = COALESCE($7,  analysis_date),
         results         = COALESCE($8,  results),
         pdf_url         = COALESCE($9,  pdf_url),
         recommendations = COALESCE($10, recommendations),
         notes           = COALESCE($11, notes),
         updated_at      = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        v.parcelId    || v.parcel_id    || null,
        v.parcelName  || v.parcel_name  || null,
        v.lab         || v.lab_name     || null,
        culture,
        v.growth_phase || null,
        v.water_source || null,
        v.analysis_date || v.date || null,
        results ? JSON.stringify(results) : null,
        v.pdf_url || null,
        recsJson,
        v.note || v.notes || null,
        req.params.id
      ]
    );

    if (!upd.rows.length) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, data: upd.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── DELETE /api/analyses/:id ──────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM public.analyses WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /api/analyses/:id/recalculate ────────────────────────
// Пересчитать рекомендации без изменения данных
router.post('/:id/recalculate', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM public.analyses WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Not found' });
    const a = r.rows[0];

    const cult = a.type === 'water' ? 'all' : (a.culture || 'tomato');
    const normsRes = await db.query(
      `SELECT * FROM public.fao_norms WHERE analysis_type = $1 AND culture = $2`,
      [a.type, cult]
    );
    const results = typeof a.results === 'string' ? JSON.parse(a.results) : (a.results || {});
    const recs = generateRecommendations(results, normsRes.rows);

    await db.query(
      `UPDATE public.analyses SET recommendations = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(recs), a.id]
    );

    res.json({ ok: true, recommendations: recs });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
