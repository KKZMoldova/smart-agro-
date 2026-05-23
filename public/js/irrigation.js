// Smart Agro — irrigation.js
// ═══ ИРРИГАЦИЯ: ЗОНЫ / БАЛАНС / ФЕРТИГАЦИЯ ══════════════════════════════

function switchIrrigSub(sub) {
  const subs = ['sensors','zones','balance','fertigation'];
  const colors = {sensors:'var(--accent)',zones:'var(--blue)',balance:'var(--teal)',fertigation:'var(--orange)'};
  const titles = {sensors:'📡 Датчики влажности',zones:'🗺 Зоны полива',balance:'⚖️ Water Balance',fertigation:'🌱 Фертигация'};
  subs.forEach(s => {
    const panel = document.getElementById('isub-panel-'+s);
    const btn   = document.getElementById('isub-'+s);
    const acts  = document.getElementById('irrig-actions-'+s);
    const active = s===sub;
    if(panel) panel.style.display = active ? '' : 'none';
    if(acts)  acts.style.display  = active ? 'flex' : 'none';
    if(btn) {
      btn.style.color       = active ? colors[s] : 'var(--text3)';
      btn.style.borderBottom= active ? `2px solid ${colors[s]}` : '2px solid transparent';
      btn.style.fontWeight  = active ? '700' : '400';
    }
  });
  const title = document.getElementById('irrig-panel-title');
  if(title) title.textContent = `💧 Ирригация · ${titles[sub]}`;
  if(sub==='zones')    renderIrrigZones();
  if(sub==='balance')  renderWaterBalance();
  if(sub==='fertigation') renderFertigation();
  // Скролл к панели ирригации
  setTimeout(() => {
    const p = document.getElementById('panel-irrigation');
    if(p) document.documentElement.scrollTop = p.offsetTop - 100;
  }, 10);
}

// ──── ЗОНЫ ПОЛИВА ────────────────────────────────────────────────────────

const IRRIG_TYPE_LABELS = {
  drip:'💧 Капельный', double_drip:'💧💧 Двойная капельница',
  microsprinkler:'🌧 Микродождеватель', sprinkler:'🌧 Спринклер', flood:'🌊 Поверхностный'
};

function renderIrrigZones() {
  const el = document.getElementById('irrig-zones-list');
  if(!el) return;
  const zones = S.irrigation.zones||[];
  if(!zones.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);">
      <div style="font-size:40px;margin-bottom:12px;">🗺</div>
      <div style="font-size:13px;margin-bottom:8px;">Зоны полива не настроены</div>
      <div style="font-size:11px;">Нажмите + Зона полива чтобы добавить первую зону</div>
    </div>`;
    return;
  }
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;">` +
    zones.map(z => {
      const totalTrees = (z.cellKeys||[]).reduce((s,k)=>{
        const cd=S.cells[k]; return s+(cd?calcCellTotals(cd).totalTrees:0);
      },0);
      const totalHa = (z.cellKeys||[]).reduce((s,k)=>{
        const cd=S.cells[k]; return s+(cd?calcCellTotals(cd).totalHa:0);
      },0);
      const totalDrippers = totalTrees * (z.drippersPerTree||2);
      const systemFlow = z.flowRate || (totalDrippers * (z.dripperFlow||2) / 1000);
      return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div style="font-size:14px;font-weight:700;">${z.name}</div>
          <div style="font-size:11px;color:var(--text3);">${IRRIG_TYPE_LABELS[z.irrigType]||z.irrigType||'—'}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="checkbox" title="Выбрать для параллельного полива"
            ${_multiIrrigZones.has(z.id)?'checked':''}
            onchange="toggleMultiIrrigZone('${z.id}')"
            style="width:16px;height:16px;cursor:pointer;">
          <button class="btn btn-secondary btn-xs" onclick="openIrrigZoneModal('${z.id}')">✏️</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
        <div style="text-align:center;padding:8px;background:var(--surface3);border-radius:8px;">
          <div style="font-size:13px;font-weight:700;color:var(--blue);">${totalHa.toFixed(2)}</div>
          <div style="font-size:9px;color:var(--text3);">га</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--surface3);border-radius:8px;">
          <div style="font-size:13px;font-weight:700;color:var(--accent);">${systemFlow.toFixed(1)}</div>
          <div style="font-size:9px;color:var(--text3);">м³/ч</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--surface3);border-radius:8px;">
          <div style="font-size:13px;font-weight:700;color:var(--yellow);">${z.pressure||'—'}</div>
          <div style="font-size:9px;color:var(--text3);">бар</div>
        </div>
      </div>
      ${(() => {
        const zoneVarieties = new Map();
        if(z.varietyIds?.length) {
          // Показываем только выбранные вручную сорта
          z.varietyIds.forEach(vid => {
            const v = S.varieties.find(x=>x.id===vid);
            if(v) zoneVarieties.set(v.id, v);
          });
        } else {
          // Автоматически из клеток
          (z.cellKeys||[]).forEach(k=>{
            const cd=S.cells[k]; if(!cd) return;
            const cropId=cd.cropId||'crop_cherry';
            S.varieties.filter(v=>(v.cropId||'crop_cherry')===cropId)
              .forEach(v=>{ if(!zoneVarieties.has(v.id)) zoneVarieties.set(v.id,v); });
          });
        }
        if(!zoneVarieties.size) return '';
        return `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
          ${[...zoneVarieties.values()].map(v=>`<span style="padding:1px 8px;border-radius:8px;font-size:10px;background:rgba(74,222,128,.1);color:var(--accent);">🍒 ${v.name}</span>`).join('')}
        </div>`;
      })()}
      <div style="font-size:11px;color:var(--text3);line-height:1.8;">
        ${z.dripperType?`💧 ${z.dripperType} · ${z.dripperFlow}л/ч · ${z.drippersPerTree}шт/дер`:''}
        ${z.cellKeys?.length?`<br>📍 Клетки: ${z.cellKeys.join(', ')} · ${totalTrees} дер.`:''}
        ${z.valveId?`<br>🔩 Клапан: <strong>${z.valveId}</strong>`:''}
        ${z.pumpId?` · 🔧 Насос: <strong>${z.pumpId}</strong>`:''}
        ${z.soilType?`<br>🌱 ${SOIL_PARAMS[z.soilType]?.name||z.soilType} · Корни ${z.rootDepth||50}см`:''}
        ${z.station?`<br>📡 Станция: ${z.station}`:''}
      </div>
      <!-- Рекомендация полива -->
      ${renderZoneRecommendation(z)}
      </div>`;
    }).join('') + `</div>`;
}

function openIrrigZoneModal(id) {
  const z = id ? (S.irrigation.zones||[]).find(x=>x.id===id) : null;
  document.getElementById('iz-modal-title').textContent = z ? `✏️ ${z.name}` : '🗺 Новая зона полива';
  document.getElementById('iz-id').value = z?.id||'';
  document.getElementById('iz-del-btn').style.display = z ? 'block' : 'none';
  _izCells = z?.cellKeys ? [...z.cellKeys] : [];

  const fields = {
    'iz-name':z?.name||'', 'iz-valve':z?.valveId||'', 'iz-pump':z?.pumpId||'',
    'iz-type':z?.irrigType||'drip', 'iz-flow':z?.flowRate||'',
    'iz-pressure':z?.pressure||'', 'iz-dripper-type':z?.dripperType||'',
    'iz-dripper-flow':z?.dripperFlow||'', 'iz-drippers-per-tree':z?.drippersPerTree||'',
    'iz-emitter-spacing':z?.emitterSpacing||'', 'iz-note':z?.note||'',
    // Новые поля
    'iz-soil-type':z?.soilType||'clay_loam',
    'iz-root-depth':z?.rootDepth||50,
    'iz-wetted-area':z?.wettedArea||35,
    'iz-max-duration':z?.maxDuration||120,
    'iz-min-interval':z?.minInterval||12,
    'iz-start-time':z?.startTime||'06:00',
    'iz-irrig-mode':z?.irrigMode||'deficit',
    'iz-target-moisture':z?.targetMoisture||80,
    'iz-stress-threshold':z?.stressThreshold||50,
    'iz-station':z?.station||'00002158',
    'iz-rows':z?.rows||'',
    'iz-trees-per-row':z?.treesPerRow||'',
    'iz-flowmeter':z?.flowmeter||'',
    'iz-flowmeter-pulse':z?.flowmeterPulse||'',
    'iz-drip-length':z?.dripLength||'',
    'iz-drip-lines':z?.dripLines||'',
    'iz-sensor-leaf':z?.sensorLeaf||'',
  };
  Object.entries(fields).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.value=val;});

  // Заполняем клапаны из справочника оборудования
  const valveSel = document.getElementById('iz-valve-sel');
  if(valveSel) {
    const valves = S.irrigEquip?.valves||[];
    valveSel.innerHTML = '<option value="">— выбрать клапан —</option>' +
      valves.map(v=>`<option value="${v.name}" ${z?.valveId===v.name?'selected':''}>${v.name} · ${v.vtype||''} · ${v.diam||''} · Зона: ${v.zone||'—'}</option>`).join('');
    valveSel.onchange = () => { if(valveSel.value) document.getElementById('iz-valve').value = valveSel.value; };
  }

  // Насосы из справочника
  const pumpSel = document.getElementById('iz-pump-sel');
  if(pumpSel) {
    const pumps = S.irrigEquip?.pumps||[];
    pumpSel.innerHTML = '<option value="">— выбрать насос —</option>' +
      pumps.map(p=>`<option value="${p.name}" ${z?.pumpId===p.name?'selected':''}>${p.name} · ${p.flow||'?'}м³/ч · ${p.pres||'?'}бар</option>`).join('');
    pumpSel.onchange = () => { if(pumpSel.value) document.getElementById('iz-pump').value = pumpSel.value; };
    // Автозаполнение расхода из насоса
    pumpSel.onchange = () => {
      if(!pumpSel.value) return;
      document.getElementById('iz-pump').value = pumpSel.value;
      const pump = pumps.find(p=>p.name===pumpSel.value);
      if(pump?.flow && !document.getElementById('iz-flow').value) {
        document.getElementById('iz-flow').value = pump.flow;
      }
    };
  }

  // Капельницы из справочника
  const dripSel = document.getElementById('iz-dripper-sel');
  if(dripSel) {
    const drips = S.irrigEquip?.drip||[];
    dripSel.innerHTML = '<option value="">— из справочника —</option>' +
      drips.map(d=>`<option value="${d.name}">${d.name} · ${d.flow||'?'}л/ч · шаг ${d.spacing||'?'}см</option>`).join('');
    dripSel.onchange = () => {
      if(!dripSel.value) return;
      const drip = drips.find(d=>d.name===dripSel.value);
      if(drip) {
        document.getElementById('iz-dripper-type').value = drip.name;
        if(drip.flow) document.getElementById('iz-dripper-flow').value = drip.flow;
        if(drip.spacing) document.getElementById('iz-emitter-spacing').value = drip.spacing;
        if(drip.pres_min) document.getElementById('iz-pressure').value = drip.pres_min;
      }
    };
  }

  // Клетки
  const listEl = document.getElementById('iz-cell-list');
  listEl.innerHTML = Object.entries(S.cells).map(([k,cd])=>{
    const crop = getCropById(cd.cropId||'crop_cherry');
    const tot = calcCellTotals(cd);
    const sel = _izCells.includes(k);
    return `<div onclick="toggleIzCell('${k}')" id="izc-${k}" style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;cursor:pointer;${sel?'background:rgba(96,165,250,.15);':''}">
      <input type="checkbox" id="izcc-${k}" ${sel?'checked':''} onclick="event.stopPropagation();toggleIzCell('${k}')">
      <span>${crop?.emoji||'🌱'} <strong>${k}</strong> — ${crop?.name||'?'} · ${tot.totalHa.toFixed(2)}га · ${tot.totalTrees}дер.</span>
    </div>`;
  }).join('');

  // Ручной выбор сортов
  const varietiesManual = document.getElementById('iz-varieties-manual');
  if(varietiesManual) {
    const selectedVarieties = new Set(z?.varietyIds||[]);
    varietiesManual.innerHTML = S.varieties.map(v=>{
      const sel = selectedVarieties.has(v.id);
      return `<span onclick="toggleIzVariety('${v.id}',this)"
        id="izv-${v.id}"
        style="padding:3px 10px;border-radius:8px;font-size:11px;cursor:pointer;
          background:${sel?'rgba(74,222,128,.15)':'var(--surface3)'};
          color:${sel?'var(--accent)':'var(--text3)'};
          border:1px solid ${sel?'rgba(74,222,128,.3)':'var(--border)'};">
        🍒 ${v.name}${v.cp?` · ${v.cp}CP`:''}
      </span>`;
    }).join('') || '<span style="font-size:11px;color:var(--text3);">Добавьте сорта в блоке 🌿 Культуры</span>';
  }

  _izSelectedVarieties = new Set(z?.varietyIds||[]);

  _renderIzTags();
  _updateIzVarieties();
  openModal('modal-irrig-zone');
}

function _updateIzVarieties() {
  const wrap = document.getElementById('iz-varieties-wrap');
  const list = document.getElementById('iz-varieties-list');
  if(!wrap||!list) return;

  // Собираем все сорта из выбранных клеток
  const allVarieties = new Map();
  _izCells.forEach(k => {
    const cd = S.cells[k];
    if(!cd) return;
    const cropId = cd.cropId||'crop_cherry';
    const cropVars = S.varieties.filter(v=>(v.cropId||'crop_cherry')===cropId);
    cropVars.forEach(v => {
      if(!allVarieties.has(v.id)) allVarieties.set(v.id, v);
    });
  });

  if(allVarieties.size === 0) { wrap.style.display='none'; return; }
  wrap.style.display = 'block';
  list.innerHTML = [...allVarieties.values()].map(v=>`
    <span style="padding:3px 10px;border-radius:8px;font-size:11px;background:var(--surface3);color:var(--text2);">
      🍒 ${v.name}${v.cp?` · ${v.cp}CP`:''}${v.brix?` · ${v.brix}°`:''}
    </span>`).join('');
}

// Обновляем сорта при изменении клеток
const _origToggleIzCell = window.toggleIzCell;
window.toggleIzCell = function(k) {
  const idx = _izCells.indexOf(k);
  if(idx>=0) _izCells.splice(idx,1); else _izCells.push(k);
  const row=document.getElementById('izc-'+k);
  const cb=document.getElementById('izcc-'+k);
  if(row) row.style.background=_izCells.includes(k)?'rgba(96,165,250,.15)':'';
  if(cb) cb.checked=_izCells.includes(k);
  _renderIzTags();
  _updateIzVarieties();
};

function toggleIzCell(k) {
  const idx = _izCells.indexOf(k);
  if(idx>=0) _izCells.splice(idx,1); else _izCells.push(k);
  const row=document.getElementById('izc-'+k);
  const cb=document.getElementById('izcc-'+k);
  if(row) row.style.background=_izCells.includes(k)?'rgba(96,165,250,.15)':'';
  if(cb) cb.checked=_izCells.includes(k);
  _renderIzTags();
}

function _renderIzTags() {
  document.getElementById('iz-cell-tags').innerHTML = _izCells.map(k=>
    `<span style="padding:2px 8px;border-radius:10px;background:rgba(96,165,250,.15);color:var(--blue);font-size:11px;">${k}</span>`
  ).join('');
}

function saveIrrigZone() {
  if(!S.irrigation.zones) S.irrigation.zones=[];
  const id = document.getElementById('iz-id').value;
  const obj = {
    id: id||uid(),
    name: document.getElementById('iz-name').value.trim(),
    cellKeys: [..._izCells],
    valveId: document.getElementById('iz-valve').value.trim(),
    pumpId: document.getElementById('iz-pump').value.trim(),
    irrigType: document.getElementById('iz-type').value,
    flowRate: parseFloat(document.getElementById('iz-flow').value)||null,
    pressure: parseFloat(document.getElementById('iz-pressure').value)||null,
    dripperType: document.getElementById('iz-dripper-type').value.trim(),
    dripperFlow: parseFloat(document.getElementById('iz-dripper-flow').value)||null,
    drippersPerTree: parseInt(document.getElementById('iz-drippers-per-tree').value)||null,
    emitterSpacing: parseInt(document.getElementById('iz-emitter-spacing').value)||null,
    note: document.getElementById('iz-note').value.trim(),
    area: _izCells.reduce((s,k)=>{ const cd=S.cells[k]; return s+(cd?calcCellTotals(cd).totalHa:0); },0),
    // Датчики и параметры полива
    station: document.getElementById('iz-station')?.value||'00002158',
    sensor1: document.getElementById('iz-sensor1')?.value||'',
    sensor2: document.getElementById('iz-sensor2')?.value||'',
    sensorLeaf: document.getElementById('iz-sensor-leaf')?.value||'',
    // Конфигурация насаждений
    rows: parseInt(document.getElementById('iz-rows')?.value)||null,
    treesPerRow: parseInt(document.getElementById('iz-trees-per-row')?.value)||null,
    varietyIds: [..._izSelectedVarieties],
    // Расходомер
    flowmeter: document.getElementById('iz-flowmeter')?.value.trim()||'',
    flowmeterPulse: parseInt(document.getElementById('iz-flowmeter-pulse')?.value)||null,
    dripLength: parseInt(document.getElementById('iz-drip-length')?.value)||null,
    dripLines: parseInt(document.getElementById('iz-drip-lines')?.value)||null,
    soilType: document.getElementById('iz-soil-type')?.value||'clay_loam',
    rootDepth: parseInt(document.getElementById('iz-root-depth')?.value)||50,
    wettedArea: parseInt(document.getElementById('iz-wetted-area')?.value)||35,
    maxDuration: parseInt(document.getElementById('iz-max-duration')?.value)||120,
    minInterval: parseInt(document.getElementById('iz-min-interval')?.value)||12,
    startTime: document.getElementById('iz-start-time')?.value||'06:00',
    irrigMode: document.getElementById('iz-irrig-mode')?.value||'deficit',
    targetMoisture: parseInt(document.getElementById('iz-target-moisture')?.value)||80,
    stressThreshold: parseInt(document.getElementById('iz-stress-threshold')?.value)||50,
  };
  if(!obj.name){alert('Введите название зоны');return;}
  const idx = S.irrigation.zones.findIndex(x=>x.id===obj.id);
  if(idx>=0) S.irrigation.zones[idx]=obj; else S.irrigation.zones.push(obj);
  save(); closeModal('modal-irrig-zone'); renderIrrigZones();
}

function deleteIrrigZone() {
  const id = document.getElementById('iz-id').value;
  if(!id||!confirm('Удалить зону?')) return;
  S.irrigation.zones = (S.irrigation.zones||[]).filter(z=>z.id!==id);
  save(); closeModal('modal-irrig-zone'); renderIrrigZones();
}

// ── ДВИЖОК РЕКОМЕНДАЦИЙ ПОЛИВА ───────────────────────────────────────────

// Параметры почв (ПВ, ТВ в % объёмных)
const SOIL_PARAMS = {
  clay_loam:  {fc:36, pwp:20, name:'Глинисто-суглинистая'},
  loam:       {fc:32, pwp:14, name:'Суглинистая'},
  sandy_loam: {fc:24, pwp:10, name:'Супесчаная'},
  clay:       {fc:42, pwp:24, name:'Глинистая'},
  sand:       {fc:18, pwp:6,  name:'Песчаная'},
};

function calcZoneIrrigRecommendation(z) {
  // 1. Параметры почвы
  const soil = SOIL_PARAMS[z.soilType||'loam'] || SOIL_PARAMS.loam;
  const rootDepth = (z.rootDepth||50); // см
  const wettedPct = (z.wettedArea||35) / 100;
  
  // TAW (мм) = (ПВ-ТВ) × глубина корней × 0.1
  const taw = (soil.fc - soil.pwp) * rootDepth * 0.1;
  // RAW (мм) = TAW × коэффициент истощения (0.35 для черешни)
  const raw = taw * 0.35;

  // 2. Дефицит влаги из Water Balance (последние 7 дней)
  const weather7 = (S.weather||[]).slice(0, 7);
  const gdd = getCurrentGdd(4.5);
  const phase = getPhaseByGdd(z.varieties?.[0] || S.varieties?.[0]?.id, gdd);
  const kc = phase?.kc || 1.0;
  
  const et0_7 = weather7.reduce((s,w) => s + (parseFloat(w.et0)||parseFloat(w.et_0)||0), 0);
  const etc_7 = et0_7 * kc;
  const precip_7 = weather7.reduce((s,w) => s + (parseFloat(w.precip)||0), 0);
  
  // Эффективные осадки (60% от осадков при капельном поливе)
  const effPrecip = precip_7 * 0.6 * wettedPct;
  const deficit = Math.max(0, etc_7 - effPrecip);

  // 3. Производительность системы
  const totalTrees = (z.cellKeys||[]).reduce((s,k)=>{
    const cd = S.cells[k];
    return s + (cd ? calcCellTotals(cd).totalTrees : 0);
  }, 0);
  const totalHa = (z.cellKeys||[]).reduce((s,k)=>{
    const cd = S.cells[k];
    return s + (cd ? calcCellTotals(cd).totalHa : 0);
  }, 0);
  
  // Расход системы (м³/ч)
  let systemFlow = z.flowRate || 0;
  if(!systemFlow && z.dripperFlow && z.drippersPerTree && totalTrees) {
    // л/ч → м³/ч
    systemFlow = (z.dripperFlow * z.drippersPerTree * totalTrees) / 1000;
  }
  
  // Интенсивность (мм/ч) = (расход м³/ч × 1000) / (площадь м²)
  const areaM2 = totalHa * 10000 * wettedPct;
  const intensity_mmh = areaM2 > 0 && systemFlow > 0
    ? (systemFlow * 1000) / areaM2
    : 2.0; // дефолт 2 мм/ч

  // 4. Рекомендация
  const maxDuration = z.maxDuration || 120; // мин
  const maxMm = intensity_mmh * (maxDuration / 60);
  
  // Сколько нужно полить
  const targetMm = Math.min(deficit > 0 ? deficit : raw * 0.5, maxMm);
  const durationMin = intensity_mmh > 0 ? Math.round(targetMm / intensity_mmh * 60) : 0;
  const volumeM3 = systemFlow > 0 ? Math.round(systemFlow * (durationMin/60) * 10) / 10 : 0;

  // 5. Статус
  let status, statusColor, statusIcon;
  if(deficit >= raw) {
    status = 'Критично — полив необходим сейчас';
    statusColor = '#dc2626'; statusIcon = '⛔';
  } else if(deficit >= raw * 0.5) {
    status = 'Внимание — полив рекомендован';
    statusColor = '#f59e0b'; statusIcon = '⚠️';
  } else if(deficit > 0) {
    status = 'Норма — дефицит небольшой';
    statusColor = '#16a34a'; statusIcon = '✅';
  } else {
    status = 'Достаточно — полив не нужен';
    statusColor = '#6b7280'; statusIcon = '💤';
  }

  return {
    taw, raw, deficit, etc_7, precip_7, effPrecip,
    kc, et0_7, totalHa, totalTrees, systemFlow,
    intensity_mmh, targetMm, durationMin, volumeM3,
    maxMm, soil, status, statusColor, statusIcon,
    startTime: z.startTime || '06:00',
    irrigMode: z.irrigMode || 'deficit',
  };
}

function renderZoneRecommendation(z) {
  const r = calcZoneIrrigRecommendation(z);
  if(!r) return '';
  
  const progress = Math.min(100, Math.round(r.deficit / r.raw * 100));
  const progressColor = progress > 100 ? '#dc2626' : progress > 50 ? '#f59e0b' : '#16a34a';
  
  return `
    <div style="margin-top:12px;padding:12px;background:var(--surface3);border-radius:10px;border-left:3px solid ${r.statusColor};">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:12px;font-weight:700;">${r.statusIcon} ${r.status}</div>
        <div style="font-size:10px;color:var(--text3);">Kc ${r.kc} · Режим: ${r.irrigMode}</div>
      </div>
      
      <!-- Прогресс дефицита -->
      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-bottom:3px;">
          <span>Дефицит влаги</span>
          <span>${r.deficit.toFixed(1)} мм / RAW ${r.raw.toFixed(1)} мм</span>
        </div>
        <div style="height:6px;background:var(--surface);border-radius:3px;">
          <div style="height:100%;width:${progress}%;background:${progressColor};border-radius:3px;transition:width .3s;"></div>
        </div>
      </div>

      <!-- Рекомендация полива -->
      ${r.targetMm > 0.5 ? `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px;">
        <div style="text-align:center;padding:6px;background:var(--surface2);border-radius:6px;">
          <div style="font-size:16px;font-weight:700;color:var(--blue);">${r.targetMm.toFixed(1)}</div>
          <div style="font-size:9px;color:var(--text3);">мм</div>
        </div>
        <div style="text-align:center;padding:6px;background:var(--surface2);border-radius:6px;">
          <div style="font-size:16px;font-weight:700;color:var(--accent);">${r.durationMin}</div>
          <div style="font-size:9px;color:var(--text3);">мин</div>
        </div>
        <div style="text-align:center;padding:6px;background:var(--surface2);border-radius:6px;">
          <div style="font-size:16px;font-weight:700;color:var(--yellow);">${r.volumeM3}</div>
          <div style="font-size:9px;color:var(--text3);">м³</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:6px;">
        ⏰ Рекомендуемое время старта: <strong>${r.startTime}</strong> · 
        Интенсивность: ${r.intensity_mmh.toFixed(2)} мм/ч · 
        Система: ${r.systemFlow.toFixed(1)} м³/ч
      </div>
      <div style="font-size:10px;color:var(--text3);">
        📊 ETc 7 дн: ${r.etc_7.toFixed(1)}мм · Осадки: ${r.precip_7.toFixed(1)}мм (эфф. ${r.effPrecip.toFixed(1)}мм)
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btn-primary btn-sm" onclick="openIrrigEventModalForZone('${z.id}',${r.targetMm.toFixed(1)},${r.durationMin})">
          💧 Полить ${r.targetMm.toFixed(1)}мм (${r.durationMin} мин)
        </button>
      </div>` : `
      <div style="font-size:11px;color:var(--text3);">
        📊 ETc 7 дн: ${r.etc_7.toFixed(1)}мм · Осадки: ${r.precip_7.toFixed(1)}мм · Дефицит: ${r.deficit.toFixed(1)}мм
      </div>`}
    </div>`;
}

function openIrrigEventModalForZone(zoneId, mm, durationMin) {
  // Открываем модал записи полива с предзаполненными данными
  const zone = (S.irrigation.zones||[]).find(z=>z.id===zoneId);
  if(!zone) return;
  switchIrrigSub('zones');
  setTimeout(() => {
    openIrrigEventModal();
    setTimeout(() => {
      const zSel = document.getElementById('ie-zone');
      if(zSel) zSel.value = zoneId;
      const mmEl = document.getElementById('ie-mm');
      if(mmEl) mmEl.value = mm;
      const durEl = document.getElementById('ie-duration');
      if(durEl) durEl.value = durationMin;
      onIrrigEventZoneChange();
    }, 200);
  }, 100);
}

// ── ПАРАЛЛЕЛЬНЫЙ ПОЛИВ НЕСКОЛЬКИХ ЗОН ────────────────────────────────────

let _multiIrrigZones = new Set(); // выбранные зоны для одновременного полива

function toggleMultiIrrigZone(zoneId) {
  if(_multiIrrigZones.has(zoneId)) _multiIrrigZones.delete(zoneId);
  else _multiIrrigZones.add(zoneId);
  renderIrrigZones();
}

function startMultiIrrig() {
  if(!_multiIrrigZones.size) { alert('Выберите хотя бы одну зону'); return; }
  const zones = (S.irrigation.zones||[]).filter(z=>_multiIrrigZones.has(z.id));
  
  // Рассчитываем общий расход
  const totalFlow = zones.reduce((s,z)=>s+(z.flowRate||0),0);
  const recs = zones.map(z=>({z, r:calcZoneIrrigRecommendation(z)}));
  const maxDuration = Math.max(...recs.map(({r})=>r.durationMin));
  
  // Проверяем давление — если общий расход > производительности насоса
  const pump = (S.irrigEquip?.pumps||[]).find(p => zones.some(z=>z.pumpId===p.name));
  const pumpFlow = parseFloat(pump?.flow)||0;
  const pressureWarn = pumpFlow > 0 && totalFlow > pumpFlow;
  
  const html = `
    <div style="padding:16px;background:var(--surface2);border-radius:12px;margin-bottom:12px;">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px;">💧 Параллельный полив — ${zones.length} зон</div>
      ${pressureWarn ? `<div style="padding:8px 12px;background:rgba(220,38,38,.08);border-radius:8px;font-size:11px;color:#dc2626;margin-bottom:10px;">
        ⚠️ Общий расход ${totalFlow.toFixed(1)} м³/ч превышает мощность насоса ${pumpFlow} м³/ч. Падение давления!
      </div>` : ''}
      ${recs.map(({z,r})=>`
        <div style="padding:8px;background:var(--surface);border-radius:8px;margin-bottom:6px;">
          <div style="font-size:12px;font-weight:600;">${z.name}</div>
          <div style="font-size:11px;color:var(--text3);">
            ${r.targetMm.toFixed(1)}мм · ${r.durationMin}мин · ${r.volumeM3}м³
            ${r.systemFlow>0?` · ${r.systemFlow.toFixed(1)}м³/ч`:''}
          </div>
        </div>`).join('')}
      <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:8px;font-size:12px;">
        <strong>Итого:</strong> ${totalFlow.toFixed(1)} м³/ч · ${maxDuration} мин · 
        ${zones.reduce((s,z,i)=>s+(recs[i].r.volumeM3||0),0).toFixed(1)} м³
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="saveMultiIrrigEvent([${zones.map(z=>`'${z.id}'`).join(',')}],${maxDuration})">
        💾 Записать полив всех зон
      </button>
    </div>`;
  
  const panel = document.getElementById('multi-irrig-panel');
  if(panel) { panel.innerHTML = html; panel.style.display='block'; }
}

async function saveMultiIrrigEvent(zoneIds, durationMin) {
  const date = today();
  for(const zoneId of zoneIds) {
    const zone = (S.irrigation.zones||[]).find(z=>z.id===zoneId);
    if(!zone) continue;
    const r = calcZoneIrrigRecommendation(zone);
    const event = {
      id: uid(), date, zoneId,
      cellKey: zone.cellKeys?.[0]||'',
      mm: r.targetMm, volumeM3: r.volumeM3,
      durationMin, phase: r.kc > 0 ? 'auto' : '',
      note: `Параллельный полив (авто ${date})`
    };
    if(!S.irrigation.events) S.irrigation.events=[];
    S.irrigation.events.unshift(event);
  }
  _multiIrrigZones.clear();
  save();
  renderIrrigZones();
  const panel = document.getElementById('multi-irrig-panel');
  if(panel) panel.style.display='none';
  alert(`✅ Записан полив ${zoneIds.length} зон`);
}

// ═══ WATER BALANCE ENGINE ════════════════════════════════════════════════

function calcWaterBalance() {
  const sp = S.irrigation.waterBalance?.soilParams || {};
  const fc  = sp.fc||32, pwp = sp.pwp||14;
  const rootCm = sp.rootDepth||60;
  const taw = (fc-pwp) * rootCm * 0.1; // mm
  const raw = taw * 0.35;

  // Строим баланс за последние 30 дней из S.weather
  const sorted = [...S.weather].sort((a,b)=>a.date.localeCompare(b.date)).slice(-30);
  if(!sorted.length) return;

  let balance = taw * 0.6; // начальный баланс — 60% TAW
  const log = [];

  sorted.forEach(w => {
    const et0 = parseFloat(w.et0) || ((parseFloat(w.tmax)||25)-(parseFloat(w.tmin)||10))*0.2;
    // Kc из фазы GDD
    const gdd = getCurrentGdd(5);
    const phase = getPhaseByGdd(S.varieties[0]?.id, gdd);
    const kc = phase?.kc || 1.0;
    const etc = Math.round(et0 * kc * 10)/10;
    const rain = parseFloat(w.precip)||0;
    // Полив — ищем в журнале событий за эту дату
    const irrig = (S.irrigation.events||[])
      .filter(e=>e.date===w.date)
      .reduce((s,e)=>s+parseFloat(e.mm||0),0);
    const prev = balance;
    balance = Math.min(taw, Math.max(0, balance + rain + irrig - etc));
    const drainage = Math.max(0, prev + rain + irrig - etc - taw);
    log.push({
      date:w.date, balance:Math.round(balance*10)/10,
      rainfall:rain, irrigation:Math.round(irrig*10)/10,
      etc, drainage:Math.round(drainage*10)/10,
      deficit:Math.round(Math.max(0,raw-balance)*10)/10,
      status: balance<=0?'critical':balance<raw*0.5?'stress':balance<raw?'watch':'ok',
      kc, et0:Math.round(et0*10)/10,
    });
  });

  if(!S.irrigation.waterBalance) S.irrigation.waterBalance={};
  S.irrigation.waterBalance.log = log;
  S.irrigation.waterBalance.lastCalc = today();
  save();
  renderWaterBalance();
  // Обновляем стресс-алерты — водный стресс мог измениться
  if(document.getElementById('stress-alerts-banner')) renderStressAlerts(null);
}

function renderWaterBalance() {
  const sp = S.irrigation.waterBalance?.soilParams || {};
  const fc=sp.fc||32, pwp=sp.pwp||14, rootCm=sp.rootDepth||60;
  const taw = (fc-pwp)*rootCm*0.1;
  const raw = taw*0.35;
  const log = S.irrigation.waterBalance?.log||[];
  const last = log[log.length-1];

  // Параметры почвы
  const spEl = document.getElementById('wb-soil-params');
  if(spEl) spEl.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:4px;">
      <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:15px;font-weight:700;color:var(--blue);">${taw.toFixed(0)} мм</div>
        <div style="font-size:10px;color:var(--text3);">TAW (запас воды)</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:15px;font-weight:700;color:var(--accent);">${raw.toFixed(0)} мм</div>
        <div style="font-size:10px;color:var(--text3);">RAW (легкодоступно)</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:15px;font-weight:700;color:var(--text2);">FC ${fc}% / PWP ${pwp}%</div>
        <div style="font-size:10px;color:var(--text3);">%VWC полевая/завяд.</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:15px;font-weight:700;color:var(--text2);">${rootCm} см</div>
        <div style="font-size:10px;color:var(--text3);">Глубина корней</div>
      </div>
    </div>`;

  // Рекомендация
  const recEl = document.getElementById('wb-recommendation');
  if(recEl && last) {
    const et0 = parseFloat(S.weather[0]?.et0)||2.5;
    const gdd = getCurrentGdd(5);
    const phase = getPhaseByGdd(S.varieties[0]?.id, gdd);
    const kc = phase?.kc||1.0;
    const etc = Math.round(et0*kc*10)/10;
    const daysToStress = last.balance>0 ? Math.floor(last.balance/etc) : 0;
    const irrigNorm = Math.round((raw-last.balance)*1.15*10)/10;
    const STATUS = {critical:{c:'var(--red)',t:'⛔ Критический дефицит — немедленный полив!'},
      stress:{c:'var(--orange)',t:'⚠️ Стресс от засухи — нужен полив сегодня'},
      watch:{c:'var(--yellow)',t:'👀 Начинается дефицит — планируйте полив'},
      ok:{c:'var(--accent)',t:'✅ Влажность в норме'}};
    const s = STATUS[last.status]||STATUS.ok;

    // Рекомендация по зонам
    const zones = S.irrigation.zones||[];
    const zoneRecs = zones.map(z=>{
      const ha = z.area||1;
      const vol = Math.round(irrigNorm*ha*10*10)/10; // мм → м³
      const flow = z.flowRate||3.5;
      const hours = Math.round(vol/flow*10)/10;
      return irrigNorm>0 ? `<div style="font-size:11px;padding:4px 8px;background:var(--surface3);border-radius:6px;">
        <strong>${z.name}:</strong> ${vol} м³ · ${hours}ч @ ${flow}м³/ч
      </div>` : '';
    }).filter(Boolean).join('');

    recEl.innerHTML = `
      <div style="padding:14px 18px;border-radius:12px;border:1px solid ${s.c}44;background:${s.c}0d;margin-bottom:8px;">
        <div style="font-size:14px;font-weight:700;color:${s.c};margin-bottom:6px;">${s.t}</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--text2);">
          <span>💧 Баланс: <strong>${last.balance} мм</strong></span>
          <span>📉 ETc сегодня: <strong>${etc} мм/день</strong></span>
          <span>⏱ До стресса: <strong>${daysToStress} дн.</strong></span>
          ${irrigNorm>0?`<span>🚿 Норма полива: <strong style="color:var(--blue);">${irrigNorm} мм</strong></span>`:''}
        </div>
        ${zoneRecs?`<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">${zoneRecs}</div>`:''}
      </div>`;
  } else if(recEl) {
    recEl.innerHTML = `<div style="padding:12px;background:var(--surface2);border-radius:8px;font-size:12px;color:var(--text3);text-align:center;">
      Нажмите 🔄 Пересчитать чтобы рассчитать water balance из данных метеостанции
    </div>`;
  }

  // Таблица
  const tblEl = document.getElementById('wb-log-table');
  if(!tblEl) return;
  if(!log.length){tblEl.innerHTML='<div style="color:var(--text3);font-size:12px;padding:8px;">Нет данных. Нажмите 🔄 Пересчитать.</div>';return;}
  const STATUS_BADGE = {
    critical:`<span style="padding:2px 7px;border-radius:8px;font-size:10px;background:rgba(239,68,68,.15);color:var(--red);">⛔ Критично</span>`,
    stress:`<span style="padding:2px 7px;border-radius:8px;font-size:10px;background:rgba(251,146,60,.15);color:var(--orange);">⚠️ Стресс</span>`,
    watch:`<span style="padding:2px 7px;border-radius:8px;font-size:10px;background:rgba(251,191,36,.15);color:var(--yellow);">👀 Внимание</span>`,
    ok:`<span style="padding:2px 7px;border-radius:8px;font-size:10px;background:rgba(74,222,128,.12);color:var(--accent);">✅ Норма</span>`,
  };
  tblEl.innerHTML = `<div style="overflow-x:auto;"><table class="data-table"><thead><tr>
    <th>Дата</th><th>ET₀</th><th>Kc</th><th>ETc</th><th>Осадки</th><th>Полив</th><th>Баланс</th><th>Дефицит</th><th>Статус</th>
  </tr></thead><tbody>${[...log].reverse().slice(0,30).map(r=>`<tr>
    <td>${r.date}</td>
    <td style="color:var(--text3);">${r.et0}</td>
    <td style="color:var(--text3);">${r.kc}</td>
    <td style="color:var(--orange);">${r.etc}</td>
    <td style="color:var(--blue);">${r.rainfall}</td>
    <td style="color:var(--teal);">${r.irrigation||0}</td>
    <td style="font-weight:600;color:${r.balance<raw*0.5?'var(--red)':r.balance<raw?'var(--yellow)':'var(--accent)'};">${r.balance}</td>
    <td style="color:${r.deficit>0?'var(--red)':'var(--text3)'};">${r.deficit||0}</td>
    <td>${STATUS_BADGE[r.status]||''}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function openSoilParamsModal() {
  const sp = S.irrigation.waterBalance?.soilParams||{};
  document.getElementById('sp-fc').value    = sp.fc||32;
  document.getElementById('sp-pwp').value   = sp.pwp||14;
  document.getElementById('sp-root').value  = sp.rootDepth||60;
  document.getElementById('sp-bulk').value  = sp.bulkDensity||1.35;
  document.getElementById('sp-infilt').value= sp.infiltrationRate||15;
  document.getElementById('sp-wetarea').value=sp.wetArea||60;
  openModal('modal-soil-params');
}

function saveSoilParams() {
  if(!S.irrigation.waterBalance) S.irrigation.waterBalance={log:[]};
  S.irrigation.waterBalance.soilParams = {
    fc:    parseFloat(document.getElementById('sp-fc').value)||32,
    pwp:   parseFloat(document.getElementById('sp-pwp').value)||14,
    rootDepth: parseInt(document.getElementById('sp-root').value)||60,
    bulkDensity: parseFloat(document.getElementById('sp-bulk').value)||1.35,
    infiltrationRate: parseFloat(document.getElementById('sp-infilt').value)||15,
    wetArea: parseInt(document.getElementById('sp-wetarea').value)||60,
  };
  save(); closeModal('modal-soil-params'); calcWaterBalance();
}

// ──── ФЕРТИГАЦИЯ ──────────────────────────────────────────────────────────

// Справочник удобрений (N-P-K содержание %)
const FERTILIZER_DB = [
  {name:'Карбамид (Мочевина)',  N:46,  P:0,   K:0,   Ca:0,  Mg:0},
  {name:'Кальциевая селитра',   N:15.5,P:0,   K:0,   Ca:26, Mg:0},
  {name:'Нитрат калия',         N:13,  P:0,   K:38,  Ca:0,  Mg:0},
  {name:'Монофосфат калия',     N:0,   P:52,  K:34,  Ca:0,  Mg:0},
  {name:'Сульфат магния',       N:0,   P:0,   K:0,   Ca:0,  Mg:9.6},
  {name:'Сульфат калия',        N:0,   P:0,   K:50,  Ca:0,  Mg:0},
  {name:'Нитрат аммония',       N:34,  P:0,   K:0,   Ca:0,  Mg:0},
  {name:'Суперфосфат',          N:0,   P:20,  K:0,   Ca:18, Mg:0},
  {name:'MAP (Монофосфат аммония)', N:12, P:61,K:0,  Ca:0,  Mg:0},
];

// Несовместимые пары
const FERT_INCOMPAT = [
  ['Кальциевая селитра','Монофосфат калия'],
  ['Кальциевая селитра','Сульфат магния'],
  ['Карбамид','Кальциевая селитра'],
];

function renderFertigation() {
  const el = document.getElementById('fertigation-content');
  if(!el) return;
  const programs = S.irrigation.fertigation?.programs||[];

  // Последний анализ воды из S.analyses (единый источник данных)
  const waterAnalyses = [...(S.analyses||[])].filter(a=>a.type==='water'&&a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const lastWater = waterAnalyses[0]||null;

  // Water Quality summary
  let wqHtml = '';
  if(lastWater) {
    const risks = analyzeWaterQuality(lastWater);
    wqHtml = `<div style="margin-bottom:16px;">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
        💧 Последний анализ воды (${lastWater.date})${lastWater.lab?' — '+lastWater.lab:''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        ${[['pH',lastWater.pH,'6.5–8.0'],['EC',lastWater.EC,'<1.5 mS/cm'],['TDS',lastWater.TDS,'<960 ppm'],
           ['HCO₃',lastWater.HCO3||lastWater.HCO,'<180 ppm'],['Cl',lastWater.Cl,'<70 ppm'],
           ['Na',lastWater.Na,'<50 ppm'],['Fe',lastWater.Fe,'<0.3 ppm'],['Mn',lastWater.Mn,'<0.1 ppm']]
          .filter(([,v])=>v!=null&&v!=='')
          .map(([l,v,n])=>`<div style="padding:6px 12px;background:var(--surface2);border-radius:8px;text-align:center;">
            <div style="font-size:13px;font-weight:700;color:var(--text2);">${v}</div>
            <div style="font-size:9px;color:var(--text3);">${l}</div>
            <div style="font-size:9px;color:var(--text3);">${n}</div>
          </div>`).join('')}
      </div>
      ${risks.length
        ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">${risks.map(r=>`<span style="padding:3px 10px;border-radius:10px;font-size:11px;background:${r.c}22;color:${r.c};">${r.icon} ${r.text}</span>`).join('')}</div>`
        : `<div style="font-size:11px;color:var(--accent);margin-bottom:8px;">✅ Качество воды в норме</div>`}
      ${waterAnalyses.length>1?`<div style="font-size:11px;color:var(--text3);">Всего анализов воды: ${waterAnalyses.length}</div>`:''}
      <button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="switchTab('analysis',document.querySelector('[onclick*=\\\"switchTab(\\\\\\\"analysis\\\\\\\"\\\"]'))">
        🔬 Перейти в Анализы →
      </button>
    </div>`;
  } else {
    wqHtml = `<div style="padding:14px;background:var(--surface2);border-radius:10px;font-size:12px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div>
        <div style="font-weight:600;margin-bottom:4px;">💧 Анализ воды не загружен</div>
        <div style="color:var(--text3);font-size:11px;">Добавьте анализ воды в блоке Анализы → вкладка Вода</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="
        const tab=document.querySelector('[onclick*=\\'switchTab(\\'analysis\\'\\')\\']');
        if(tab){switchTab('analysis',tab);}
        setTimeout(()=>openAnalysisModal('water'),200);
      ">+ Анализ воды</button>
    </div>`;
  }

  // Programs
  let progHtml = '';
  if(!programs.length) {
    progHtml = `<div style="text-align:center;padding:30px;color:var(--text3);font-size:12px;">Программы фертигации не добавлены.<br>Нажмите <strong>+ Программа</strong> выше.</div>`;
  } else {
    progHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;">` +
      programs.map(p=>{
        const zone = (S.irrigation.zones||[]).find(z=>z.id===p.zoneId);
        const elems = ['N','P','K','Ca','Mg','S','Fe','Zn','B','Mn','Cu','Mo']
          .filter(e=>parseFloat(p[e.toLowerCase()])>0)
          .map(e=>`<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:var(--surface3);color:var(--text2);">${e}: ${p[e.toLowerCase()]}</span>`);
        return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
              <div style="font-size:13px;font-weight:700;">${p.name}</div>
              <div style="font-size:11px;color:var(--text3);">${p.phase||''} · ${zone?.name||'все зоны'}</div>
            </div>
            <button class="btn btn-secondary btn-xs" onclick="openFertigationModal('${p.id}')">✏️</button>
          </div>
          ${p.waterVol?`<div style="font-size:11px;color:var(--blue);margin-bottom:6px;">💧 ${p.waterVol} м³/га на цикл</div>`:''}
          <div style="display:flex;gap:4px;flex-wrap:wrap;">${elems.join('')}</div>
          ${p.note?`<div style="font-size:11px;color:var(--text3);margin-top:6px;">${p.note}</div>`:''}
        </div>`;
      }).join('') + `</div>`;
  }

  el.innerHTML = wqHtml +
    `<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🌱 Программы фертигации</div>` +
    progHtml;
}

function analyzeWaterQuality(wq) {
  const risks = [];
  // S.analyses использует заглавные поля (pH, EC, Cl, Na...), поддерживаем оба варианта
  const ec   = parseFloat(wq.EC||wq.ec)||0;
  const ph   = parseFloat(wq.pH||wq.ph)||0;
  const hco3 = parseFloat(wq.HCO3||wq.HCO||wq.hco3)||0;
  const cl   = parseFloat(wq.Cl||wq.cl)||0;
  const na   = parseFloat(wq.Na||wq.na)||0;
  const ca   = parseFloat(wq.Ca||wq.ca)||0;
  const mg   = parseFloat(wq.Mg||wq.mg)||0;
  const fe   = parseFloat(wq.Fe||wq.fe)||0;
  const mn   = parseFloat(wq.Mn||wq.mn)||0;
  const sar  = (ca/40+mg/24.3)>0 ? (na/23)/Math.sqrt((ca/40+mg/24.3)/2) : 0;
  if(ec>1.5)   risks.push({c:'var(--orange)',icon:'⚠️',text:`EC ${ec} mS/cm — риск засоления`});
  if(ec>3.0)   risks.push({c:'var(--red)',   icon:'⛔',text:`EC ${ec} — высокое засоление`});
  if(ph>7.8)   risks.push({c:'var(--yellow)',icon:'⚠️',text:`pH ${ph} — защелачивание, блокировка Fe/Mn`});
  if(ph<6.0)   risks.push({c:'var(--yellow)',icon:'⚠️',text:`pH ${ph} — повышенная кислотность`});
  if(hco3>180) risks.push({c:'var(--orange)',icon:'🧪',text:`HCO₃ ${hco3} ppm — риск засора эмиттеров`});
  if(hco3>300) risks.push({c:'var(--red)',   icon:'⛔',text:`HCO₃ ${hco3} — кислотная обработка обязательна`});
  if(cl>70)    risks.push({c:'var(--red)',   icon:'☠️',text:`Cl ${cl} ppm — токсичность для культур`});
  if(fe>0.3)   risks.push({c:'var(--orange)',icon:'🟤',text:`Fe ${fe} ppm — засор эмиттеров`});
  if(mn>0.1)   risks.push({c:'var(--yellow)',icon:'⚠️',text:`Mn ${mn} ppm — засор эмиттеров`});
  if(sar>10)   risks.push({c:'var(--red)',   icon:'⚠️',text:`SAR ${sar.toFixed(1)} — натриевая опасность`});
  return risks;
}

function openFertigationModal(id) {
  if(!S.irrigation.fertigation) S.irrigation.fertigation={programs:[],waterQuality:[]};
  const p = id ? S.irrigation.fertigation.programs.find(x=>x.id===id) : null;
  document.getElementById('fert-modal-title').textContent = p ? `✏️ ${p.name}` : '🌱 Новая программа';
  document.getElementById('fert-id').value = p?.id||'';
  document.getElementById('fert-del-btn').style.display = p?'block':'none';
  document.getElementById('fert-name').value  = p?.name||'';
  document.getElementById('fert-phase').value = p?.phase||'';
  document.getElementById('fert-water-vol').value = p?.waterVol||'';
  document.getElementById('fert-note').value  = p?.note||'';
  const zoneSel = document.getElementById('fert-zone');
  zoneSel.innerHTML = '<option value="">— все зоны —</option>'+
    (S.irrigation.zones||[]).map(z=>`<option value="${z.id}" ${p?.zoneId===z.id?'selected':''}>${z.name}</option>`).join('');
  if(p?.zoneId) zoneSel.value=p.zoneId;
  ['N','P','K','Ca','Mg','S','Fe','Zn','B','Mn','Cu','Mo'].forEach(e=>{
    const el=document.getElementById('fert-'+e.toLowerCase()); if(el) el.value=p?.[e.toLowerCase()]||'';
  });
  openModal('modal-fertigation');
}

function saveFertProgram() {
  if(!S.irrigation.fertigation) S.irrigation.fertigation={programs:[],waterQuality:[]};
  const id = document.getElementById('fert-id').value;
  const obj = {id:id||uid()};
  obj.name = document.getElementById('fert-name').value.trim();
  obj.phase = document.getElementById('fert-phase').value.trim();
  obj.zoneId = document.getElementById('fert-zone').value||null;
  obj.waterVol = parseFloat(document.getElementById('fert-water-vol').value)||null;
  obj.note = document.getElementById('fert-note').value.trim();
  ['N','P','K','Ca','Mg','S','Fe','Zn','B','Mn','Cu','Mo'].forEach(e=>{
    const el=document.getElementById('fert-'+e.toLowerCase());
    obj[e.toLowerCase()] = el?parseFloat(el.value)||0:0;
  });
  if(!obj.name){alert('Введите название программы');return;}
  const idx = S.irrigation.fertigation.programs.findIndex(x=>x.id===obj.id);
  if(idx>=0) S.irrigation.fertigation.programs[idx]=obj;
  else S.irrigation.fertigation.programs.push(obj);
  save(); closeModal('modal-fertigation'); renderFertigation();
}

function deleteFertProgram() {
  const id=document.getElementById('fert-id').value;
  if(!id||!confirm('Удалить программу?')) return;
  S.irrigation.fertigation.programs = S.irrigation.fertigation.programs.filter(p=>p.id!==id);
  save(); closeModal('modal-fertigation'); renderFertigation();
}

function openWaterQualityModal() {
  if(!S.irrigation.fertigation) S.irrigation.fertigation={programs:[],waterQuality:[]};
  document.getElementById('wq-id').value='';
  document.getElementById('wq-date').value=today();
  ['wq-source','wq-ph','wq-ec','wq-tds','wq-hco3','wq-cl','wq-na','wq-ca','wq-mg','wq-fe','wq-mn']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('wq-risk-analysis').innerHTML='';
  openModal('modal-water-quality');
}

function saveWaterQuality() {
  if(!S.irrigation.fertigation) S.irrigation.fertigation={programs:[],waterQuality:[]};
  const wq = {
    id:uid(), date:document.getElementById('wq-date').value||today(),
    source:document.getElementById('wq-source').value.trim(),
    ph:parseFloat(document.getElementById('wq-ph').value)||null,
    ec:parseFloat(document.getElementById('wq-ec').value)||null,
    tds:parseFloat(document.getElementById('wq-tds').value)||null,
    hco3:parseFloat(document.getElementById('wq-hco3').value)||null,
    cl:parseFloat(document.getElementById('wq-cl').value)||null,
    na:parseFloat(document.getElementById('wq-na').value)||null,
    ca:parseFloat(document.getElementById('wq-ca').value)||null,
    mg:parseFloat(document.getElementById('wq-mg').value)||null,
    fe:parseFloat(document.getElementById('wq-fe').value)||null,
    mn:parseFloat(document.getElementById('wq-mn').value)||null,
  };
  S.irrigation.fertigation.waterQuality.push(wq);
  save(); closeModal('modal-water-quality'); renderFertigation();
}

// ─────────────────────────────────────────────────────────────────────────
// ═══ ЖУРНАЛ ПОЛИВА (факт) ════════════════════════════════════════════════

function openIrrigEventModal(id) {
  if(!S.irrigation.events) S.irrigation.events = [];
  const ev = id ? S.irrigation.events.find(e=>e.id===id) : null;
  document.getElementById('ie-id').value = ev?.id||'';
  document.getElementById('ie-date').value = ev?.date || new Date().toISOString().split('T')[0];
  document.getElementById('ie-duration').value = ev?.durationMin||'';
  document.getElementById('ie-volume').value = ev?.volumeM3||'';
  document.getElementById('ie-mm').value = ev?.mm||'';
  document.getElementById('ie-note').value = ev?.note||'';

  // Заполняем зоны
  const zoneSel = document.getElementById('ie-zone');
  zoneSel.innerHTML = '<option value="">— выбрать зону —</option>' +
    (S.irrigation.zones||[]).map(z=>`<option value="${z.id}" ${ev?.zoneId===z.id?'selected':''}>${z.name} (${z.flowRate||'?'} м³/ч)</option>`).join('');
  if(ev?.zoneId) zoneSel.value = ev.zoneId;

  // Текущая фаза
  const gdd = getCurrentGdd(4.5);
  const phase = getPhaseByGdd(S.varieties[0]?.id, gdd);
  document.getElementById('ie-phase').value = ev?.phase || phase?.name || '';

  // Рекомендация из технокарты
  const rec = document.getElementById('ie-recommendation');
  if(phase) {
    const phaseData = TECHMAP.crop_cherry?.find(p=>p.phase===phase.name);
    if(phaseData) {
      rec.style.display = 'block';
      rec.innerHTML = `<strong>Рекомендация технокарты для фазы "${phase.name}":</strong><br>
        💧 ${phaseData.irrigation}<br>
        Kc: ${phaseData.kc} · ETc: ~${(parseFloat(S.weather[0]?.et0||3)*phaseData.kc).toFixed(1)}мм/день`;
    }
  }

  calcIrrigVolume();
  openModal('modal-irrig-event');
}

function calcIrrigVolume() {
  const zoneId = document.getElementById('ie-zone').value;
  const durationMin = parseFloat(document.getElementById('ie-duration').value)||0;
  const zone = (S.irrigation.zones||[]).find(z=>z.id===zoneId);

  if(zone && durationMin > 0) {
    const flowM3h = zone.flowRate || 0;
    const volumeM3 = Math.round(flowM3h * durationMin / 60 * 10) / 10;
    const areaHa = zone.area || 1;
    const mm = Math.round(volumeM3 / areaHa / 10 * 10) / 10; // м³ → мм (1 мм = 10 м³/га)
    document.getElementById('ie-volume').value = volumeM3;
    document.getElementById('ie-mm').value = mm;
  }
}

function saveIrrigEvent() {
  if(!S.irrigation.events) S.irrigation.events = [];
  const id = document.getElementById('ie-id').value;
  const zoneId = document.getElementById('ie-zone').value;
  const zone = (S.irrigation.zones||[]).find(z=>z.id===zoneId);
  const ev = {
    id: id || uid(),
    date: document.getElementById('ie-date').value,
    zoneId,
    zoneName: zone?.name||'',
    cellKeys: zone?.cellKeys||[],
    durationMin: parseFloat(document.getElementById('ie-duration').value)||0,
    volumeM3: parseFloat(document.getElementById('ie-volume').value)||0,
    mm: parseFloat(document.getElementById('ie-mm').value)||0,
    phase: document.getElementById('ie-phase').value,
    note: document.getElementById('ie-note').value.trim(),
  };
  if(!ev.date){alert('Укажите дату');return;}
  const idx = S.irrigation.events.findIndex(e=>e.id===ev.id);
  if(idx>=0) S.irrigation.events[idx]=ev; else S.irrigation.events.unshift(ev);
  save();
  closeModal('modal-irrig-event');
  // Пересчитываем WB с новыми данными
  calcWaterBalance();
}

// Получить суммарный полив за период для клетки
function getIrrigSumForCell(cellKey, dateFrom, dateTo) {
  if(!S.irrigation.events) return {totalMm:0, totalM3:0, count:0, events:[]};
  const evts = S.irrigation.events.filter(e => {
    if(e.date < dateFrom || e.date > dateTo) return false;
    return !cellKey || (e.cellKeys||[]).includes(cellKey);
  });
  return {
    totalMm: Math.round(evts.reduce((s,e)=>s+e.mm,0)*10)/10,
    totalM3: Math.round(evts.reduce((s,e)=>s+e.volumeM3,0)*10)/10,
    count: evts.length,
    events: evts,
  };
}

// ═══ РАСЧЁТ ДОЗЫ ФЕРТИГАЦИИ ══════════════════════════════════════════════

// Целевые ppm по фазам (рабочий раствор капельного полива)
// Источник: Neilsen G.H., Neilsen D., Forge T. — HortScience 2007-2018
// Черешня на Gisela 5, схема 4×2м, капельный полив
// ВАЖНО: N только 8 недель после цветения (не весь сезон!)
// Стоп фертигации за 30 дней до сбора урожая
const FERT_PHASE_TARGETS = {
  // Вегетация (набухание почек → до цветения)
  // N минимальный — дерево использует запасы из прошлого года
  veg: {
    N:40, P:40, K:80, Ca:80, Mg:20,
    note:'До цветения: минимум N — дерево использует осенние запасы. P при цветении стимулирует закладку плодов (Neilsen 2008).',
    nFertPeriod: 'только при дефиците по анализу листа',
  },
  // Цветение (BBCH 61-69) — ЗАПРЕТ N, только P и Ca
  flower: {
    N:0, P:60, K:60, Ca:100, Mg:20,
    note:'BBCH 61-69: N не вносить! P 20г/дерево при полном цветении (ammonium polyphosphate) — ускоряет завязывание. Ca+B для качества плода.',
    nFertPeriod: 'НЕ ВНОСИТЬ в период цветения',
    pNote: '20г P/дерево при полном цветении — научно подтверждено (Neilsen 2008, 2014)',
  },
  // Завязь (BBCH 71-75) — СТАРТ N-программы (8 нед после цветения)
  fruit_set: {
    N:84, P:25, K:120, Ca:150, Mg:30,
    note:'Старт N-программы: 84 mg/L Ca(NO₃)₂ через капельницу — ОПТИМУМ по Neilsen 2007. Высокий N (>168ppm) = мельчание плода! Ca-программа каждые 7-10 дней.',
    nFertPeriod: '8 недель начиная с опадания лепестков',
    nWarning: 'Никогда не превышать 120 ppm N — снижает Brix и размер плода',
  },
  // Рост плода (BBCH 75-81) — K+Ca приоритет
  fruit_growth: {
    N:84, P:20, K:180, Ca:120, Mg:35,
    note:'N продолжаем 84 ppm (в рамках 8-недельной программы). K усиливаем — критично для налива и Brix. Ca каждые 7-10 дней защищает от растрескивания.',
    nFertPeriod: 'продолжение 8-недельной программы',
  },
  // Созревание (BBCH 81-89) — СТОП N за 30 дней до сбора!
  ripening: {
    N:0, P:0, K:80, Ca:40, Mg:20,
    note:'СТОП ФЕРТИГАЦИИ за 30 дней до сбора! N полностью прекратить — ускоряет созревание и повышает Brix. Только K для накопления сахара. Листовой Ca последний раз.',
    nFertPeriod: 'СТОП — прекратить за 30 дней до уборки',
    stopNote: 'Продолжение N перед сбором: мягкость плода, снижение лёжкости, потеря Brix (Neilsen 2007)',
  },
  // После сбора (BBCH 91-97) — закладка почек
  post_harvest: {
    N:60, P:60, K:120, Ca:40, Mg:40,
    note:'После сбора: P+K+N для закладки плодовых почек на следующий год. Листья должны работать до октября. N умеренный — не стимулировать рост побегов.',
    nFertPeriod: 'после уборки урожая до конца августа',
  },
  // Вручную
  custom: {N:0, P:0, K:0, Ca:0, Mg:0},
};

// Листовые нормы черешни (% сухого вещества, середина лета)
// Источник: Neilsen et al., Cherries CAB 2017, гл. 9
const LEAF_NORMS_CHERRY = {
  N:  {min:2.4, opt:2.7, max:3.0, unit:'%', action:'Ca(NO₃)₂ 84ppm — 8 нед. после цветения'},
  P:  {min:0.14,opt:0.18,max:0.25,unit:'%', action:'MAP 20г/дерево при цветении'},
  K:  {min:1.5, opt:2.0, max:2.5, unit:'%', action:'Нитрат калия в июне'},
  Ca: {min:1.0, opt:1.5, max:2.0, unit:'%', action:'Хелат Ca 3-5 кг/га после цветения'},
  Mg: {min:0.25,opt:0.35,max:0.50,unit:'%', action:'Сульфат магния'},
  Fe: {min:60,  opt:100, max:200, unit:'ppm',action:'Хелат Fe (EDTA)'},
  B:  {min:25,  opt:35,  max:60,  unit:'ppm',action:'Бор 0.3% листовая до цветения'},
};

// Элементы в удобрениях %
const FERT_DB_EXTENDED = [
  {name:'Кальциевая селитра',   N:15.5, P:0,  K:0,  Ca:26,  Mg:0,   S:0,  mol:236, solMax:1200, bak:'A'},
  {name:'Нитрат калия',         N:13,   P:0,  K:38, Ca:0,   Mg:0,   S:0,  mol:101, solMax:316,  bak:'B'},
  {name:'Монофосфат калия',     N:0,    P:52, K:34, Ca:0,   Mg:0,   S:0,  mol:136, solMax:230,  bak:'B'},
  {name:'Сульфат магния',       N:0,    P:0,  K:0,  Ca:0,   Mg:9.6, S:13, mol:120, solMax:710,  bak:'B'},
  {name:'Сульфат калия',        N:0,    P:0,  K:50, Ca:0,   Mg:0,   S:17, mol:174, solMax:120,  bak:'B'},
  {name:'MAP (Монофосфат аммония)', N:12, P:61,K:0, Ca:0,   Mg:0,   S:0,  mol:115, solMax:400,  bak:'B'},
  {name:'Карбамид',             N:46,   P:0,  K:0,  Ca:0,   Mg:0,   S:0,  mol:60,  solMax:1080, bak:'B'},
  {name:'Нитрат аммония',       N:34,   P:0,  K:0,  Ca:0,   Mg:0,   S:0,  mol:80,  solMax:1920, bak:'B'},
  {name:'Хелат Ca (EDTA)',      N:0,    P:0,  K:0,  Ca:10,  Mg:0,   S:0,  mol:0,   solMax:500,  bak:'A'},
  {name:'Хелат Fe (EDTA)',      N:0,    P:0,  K:0,  Ca:0,   Mg:0,   S:0,  mol:0,   solMax:200,  bak:'B'},
];

// Несовместимые пары (по баку)
const FERT_INCOMPAT_PAIRS = [
  ['Кальциевая селитра', 'Монофосфат калия'],
  ['Кальциевая селитра', 'Сульфат магния'],
  ['Кальциевая селитра', 'Сульфат калия'],
  ['Кальциевая селитра', 'MAP (Монофосфат аммония)'],
  ['Карбамид', 'Кальциевая селитра'],
];

// Состояние выбора объекта фертигации
let _fcSelCrop = null;       // 'crop_cherry' etc
let _fcSelParcels = new Set(); // Set of cell keys
let _fcSelVarieties = new Set(); // Set of variety ids, пусто = все сорта участков

function openFertCalcModal() {
  // Сбрасываем выбор
  _fcSelCrop = null;
  _fcSelParcels = new Set();
  _fcSelVarieties = new Set();

  // Заполняем зоны полива
  const zoneSel = document.getElementById('fc-zone');
  if(zoneSel) {
    zoneSel.innerHTML = '<option value="">— весь сад —</option>' +
      (S.irrigation.zones||[]).map(z=>
        `<option value="${z.id}">${z.name} (${z.area?.toFixed(1)||'?'}га)</option>`
      ).join('');
  }

  // Подключаем onchange к select фазы
  const ph = document.getElementById('fc-phase');
  if(ph) ph.onchange = onFertPhaseChange;

  document.getElementById('fc-result').style.display = 'none';
  document.getElementById('fc-phase-note').style.display = 'none';
  document.getElementById('fc-parcels-row').style.display = 'none';
  document.getElementById('fc-varieties-row').style.display = 'none';
  document.getElementById('fc-selection-summary').style.display = 'none';

  // Шаг 1: Кнопки культур — ВСЕ из справочника, с пометкой сколько участков заполнено
  const cropBtns = document.getElementById('fc-crop-btns');
  if(cropBtns) {
    const allCrops = S.crops || [];
    // Считаем участки и га по каждой культуре
    const cropStats = {};
    Object.values(S.cells||{}).forEach(cd => {
      const cid = cd.cropId || 'crop_cherry';
      if(!cropStats[cid]) cropStats[cid] = {count:0, ha:0};
      cropStats[cid].count++;
      cropStats[cid].ha += calcCellTotals(cd).totalHa || 0;
    });
    if(!allCrops.length) {
      cropBtns.innerHTML = '<div style="color:var(--text3);font-size:11px;">Справочник культур пуст.</div>';
    } else {
      cropBtns.innerHTML = allCrops.map(c => {
        const st = cropStats[c.id];
        const sub = st
          ? `<span style="color:var(--text3);font-size:10px;">(${st.count} уч · ${st.ha.toFixed(1)}га)</span>`
          : `<span style="color:var(--text3);font-size:10px;">нет участков</span>`;
        return `<button onclick="fcSelectCrop('${c.id}')" id="fc-crop-btn-${c.id}"
          style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);
          color:var(--text2);cursor:pointer;font-size:12px;transition:all .15s;">
          ${c.emoji||'🌱'} ${c.name} ${sub}
        </button>`;
      }).join('');
    }
  }

  // Загружаем анализы (блок источника данных)
  _fcRenderAnalysisSource();

  // Заполняем ppm-поля по выбранной фазе
  onFertPhaseChange();

  // Открываем модалку
  openModal('modal-fert-calc');
}

function fcSelectCrop(cropId) {
  _fcSelCrop = cropId;
  _fcSelParcels = new Set();
  _fcSelVarieties = new Set();

  // Подсвечиваем кнопку
  document.querySelectorAll('[id^="fc-crop-btn-"]').forEach(b=>{
    b.style.background = 'var(--surface2)';
    b.style.borderColor = 'var(--border)';
    b.style.color = 'var(--text2)';
  });
  const btn = document.getElementById(`fc-crop-btn-${cropId}`);
  if(btn){ btn.style.background='rgba(74,222,128,.12)'; btn.style.borderColor='var(--accent)'; btn.style.color='var(--accent)'; }

  // Заполняем участки этой культуры
  const parcelBtns = document.getElementById('fc-parcel-btns');
  const parcels = Object.entries(S.cells||{}).filter(([,cd])=>(cd.cropId||'crop_cherry')===cropId);
  if(parcelBtns) {
    if(!parcels.length) {
      parcelBtns.innerHTML = `<div style="color:var(--text3);font-size:11px;padding:6px 0;">Участки для этой культуры не добавлены на карте.</div>`;
    } else {
      parcelBtns.innerHTML = parcels.map(([key, cd])=>{
      const ha = calcCellTotals(cd).totalHa || 0;
      const trees = calcCellTotals(cd).totalTrees || 0;
      // Сорта участка
      const varNames = [...new Set((cd.rows||[]).map(r=>r.varietyId).filter(Boolean))]
        .map(vid=>S.varieties.find(v=>v.id===vid)?.name||vid).join(', ');
      return `<button onclick="fcToggleParcel('${key}')" id="fc-parcel-btn-${key}"
        style="padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);
        color:var(--text2);cursor:pointer;font-size:11px;text-align:left;transition:all .15s;max-width:200px;">
        <div style="font-weight:700;color:var(--text);">${key}</div>
        <div style="font-size:10px;color:var(--text3);">${ha.toFixed(2)}га · ${trees} дер.</div>
        ${varNames?`<div style="font-size:10px;color:var(--accent2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${varNames}</div>`:''}
      </button>`;
    }).join('');
    }
  }
  document.getElementById('fc-parcels-row').style.display = 'block';
  document.getElementById('fc-varieties-row').style.display = 'none';
  document.getElementById('fc-selection-summary').style.display = 'none';
  fcUpdateSummary();
}

function fcToggleParcel(key) {
  if(_fcSelParcels.has(key)) _fcSelParcels.delete(key); else _fcSelParcels.add(key);

  // Перекрашиваем кнопку
  const btn = document.getElementById(`fc-parcel-btn-${key}`);
  if(btn) {
    const on = _fcSelParcels.has(key);
    btn.style.background = on ? 'rgba(74,222,128,.12)' : 'var(--surface2)';
    btn.style.borderColor = on ? 'var(--accent)' : 'var(--border)';
    btn.style.color = on ? 'var(--accent)' : 'var(--text2)';
  }

  // Собираем все сорта выбранных участков
  const allVarIds = new Set();
  _fcSelParcels.forEach(k => {
    (S.cells[k]?.rows||[]).forEach(r=>{ if(r.varietyId) allVarIds.add(r.varietyId); });
  });

  // Показываем сорта если выбран хотя бы 1 участок
  const varBtns = document.getElementById('fc-variety-btns');
  if(varBtns && allVarIds.size > 0) {
    _fcSelVarieties = new Set(); // сброс при смене участков
    varBtns.innerHTML = `<button onclick="fcToggleVariety('__all__')" id="fc-var-btn-__all__"
      style="padding:6px 12px;border-radius:8px;border:1px solid var(--accent);background:rgba(74,222,128,.12);
      color:var(--accent);cursor:pointer;font-size:11px;font-weight:700;">✅ Все сорта</button>` +
      [...allVarIds].map(vid=>{
        const v = S.varieties.find(x=>x.id===vid);
        // Считаем га этого сорта в выбранных участках
        let ha = 0;
        _fcSelParcels.forEach(k=>{
          const cd = S.cells[k];
          if(!cd) return;
          const rows = (cd.rows||[]).filter(r=>r.varietyId===vid);
          rows.forEach(r=>{ ha += ((r.rowLength||0)*(cd.rowSpacing||5))/10000; });
        });
        return `<button onclick="fcToggleVariety('${vid}')" id="fc-var-btn-${vid}"
          style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);
          color:var(--text2);cursor:pointer;font-size:11px;transition:all .15s;">
          ${v?.name||vid} <span style="font-size:10px;color:var(--text3);">${ha>0?ha.toFixed(2)+'га':''}</span>
        </button>`;
      }).join('');
    document.getElementById('fc-varieties-row').style.display = 'block';
  } else if(_fcSelParcels.size === 0) {
    document.getElementById('fc-varieties-row').style.display = 'none';
  }

  fcUpdateSummary();
}

function fcToggleVariety(vid) {
  if(vid === '__all__') {
    _fcSelVarieties = new Set();
    // сброс — все активны
    document.querySelectorAll('[id^="fc-var-btn-"]').forEach(b=>{
      b.style.background='var(--surface2)'; b.style.borderColor='var(--border)'; b.style.color='var(--text2)';
    });
    const allBtn = document.getElementById('fc-var-btn-__all__');
    if(allBtn){ allBtn.style.background='rgba(74,222,128,.12)'; allBtn.style.borderColor='var(--accent)'; allBtn.style.color='var(--accent)'; }
  } else {
    if(_fcSelVarieties.has(vid)) _fcSelVarieties.delete(vid); else _fcSelVarieties.add(vid);
    // Снимаем "Все сорта"
    const allBtn = document.getElementById('fc-var-btn-__all__');
    if(allBtn){ allBtn.style.background='var(--surface2)'; allBtn.style.borderColor='var(--border)'; allBtn.style.color='var(--text2)'; }
    const btn = document.getElementById(`fc-var-btn-${vid}`);
    if(btn) {
      const on = _fcSelVarieties.has(vid);
      btn.style.background = on ? 'rgba(96,165,250,.12)' : 'var(--surface2)';
      btn.style.borderColor = on ? 'var(--blue)' : 'var(--border)';
      btn.style.color = on ? 'var(--blue)' : 'var(--text2)';
    }
  }
  fcUpdateSummary();
}

function fcGetSelectionArea() {
  // Возвращает суммарную площадь по текущей выборке (га)
  let ha = 0;
  if(_fcSelParcels.size === 0) {
    // Весь сад
    Object.values(S.cells||{}).forEach(cd => { ha += calcCellTotals(cd).totalHa||0; });
  } else if(_fcSelVarieties.size === 0) {
    // Выбранные участки целиком
    _fcSelParcels.forEach(k => { ha += calcCellTotals(S.cells[k]||{}).totalHa||0; });
  } else {
    // Только выбранные сорта в выбранных участках
    _fcSelParcels.forEach(k=>{
      const cd = S.cells[k]; if(!cd) return;
      (cd.rows||[]).forEach(r=>{
        if(_fcSelVarieties.has(r.varietyId)) {
          ha += ((r.rowLength||0)*(cd.rowSpacing||5))/10000;
        }
      });
    });
  }
  return Math.max(ha, 0.01);
}

function fcUpdateSummary() {
  const el = document.getElementById('fc-selection-summary');
  if(!el) return;
  if(!_fcSelCrop) { el.style.display='none'; return; }

  const crop = (S.crops||[]).find(c=>c.id===_fcSelCrop);
  const cropName = `${crop?.emoji||'🌱'} ${crop?.name||_fcSelCrop}`;

  let desc = '';
  if(_fcSelParcels.size === 0) {
    desc = `${cropName} — весь сад`;
  } else {
    const parcelNames = [..._fcSelParcels].join(', ');
    if(_fcSelVarieties.size === 0) {
      desc = `${cropName} · Участки: ${parcelNames} · все сорта`;
    } else {
      const varNames = [..._fcSelVarieties].map(vid=>S.varieties.find(v=>v.id===vid)?.name||vid).join(', ');
      desc = `${cropName} · Участки: ${parcelNames} · Сорта: ${varNames}`;
    }
  }

  const ha = fcGetSelectionArea();
  el.style.display = 'block';
  el.innerHTML = `📋 <strong>${desc}</strong> · <span style="color:var(--accent);">${ha.toFixed(2)} га</span>`;
}

function _fcRenderAnalysisSource() {
  const srcEl = document.getElementById('fc-analysis-source');
  if(!srcEl) return;
  const waterAn = [...(S.analyses||[])].filter(a=>a.type==='water').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  const leafAn  = [...(S.analyses||[])].filter(a=>a.type==='leaf').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  const soilAn  = [...(S.analyses||[])].filter(a=>a.type==='soil').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  let html = '';
  if(waterAn) {
    html += `<div style="margin-bottom:4px;">💧 <strong>Анализ воды (${waterAn.date}):</strong> EC ${waterAn.EC||waterAn.ec||'—'} mS/cm · pH ${waterAn.pH||waterAn.ph||'—'} · NO₃ ${waterAn.NO3||waterAn.no3||'0'}ppm · Ca ${waterAn.Ca||waterAn.ca||'0'}ppm · Mg ${waterAn.Mg||waterAn.mg||'0'}ppm</div>`;
  } else {
    html += `<div style="color:var(--orange);margin-bottom:6px;">⚠️ Анализ воды не найден — Ca и Mg из воды не вычитаются из расчёта.
      <button class="btn btn-secondary btn-sm" style="margin-left:8px;" onclick="closeModal('modal-fert-calc');switchTab('analysis',document.querySelector('[onclick*=switchTab][onclick*=analysis]'));setTimeout(()=>openAnalysisModal('water'),300);">+ Добавить анализ воды</button>
    </div>`;
  }
  if(leafAn)  html += `<div style="margin-bottom:2px;">🌿 <strong>Анализ листа (${leafAn.date}):</strong> N ${leafAn.N||leafAn.n||'—'}% · P ${leafAn.P||leafAn.p||'—'}% · K ${leafAn.K||leafAn.k||'—'}% · Ca ${leafAn.Ca||leafAn.ca||'—'}% · Mg ${leafAn.Mg||leafAn.mg||'—'}%</div>`;
  if(soilAn)  html += `<div>🌱 <strong>Анализ почвы (${soilAn.date}):</strong> pH ${soilAn.pH||soilAn.ph||'—'} · NO₃ ${soilAn.NO3||soilAn.no3||'—'} · P ${soilAn.P||soilAn.p||'—'} · K ${soilAn.K||soilAn.k||'—'}</div>`;
  if(!waterAn && !leafAn && !soilAn) html += `<div style="color:var(--text3);">Анализы не внесены. Расчёт по целевым нормам фазы.</div>`;
  srcEl.innerHTML = html;
  if(waterAn) {
    const setWater = (id, val) => { const d=document.getElementById(id); if(d) d.textContent=`из воды: ${parseFloat(val||0)}ppm`; };
    setWater('fc-water-ca', waterAn.Ca||waterAn.ca||0);
    setWater('fc-water-mg', waterAn.Mg||waterAn.mg||0);
    setWater('fc-water-n',  waterAn.NO3||waterAn.no3||0);
  }
}

function onFertCalcZoneChange() {
  const zoneId = document.getElementById('fc-zone')?.value;
  const zone = (S.irrigation.zones||[]).find(z=>z.id===zoneId);

  // Объём воды из зоны
  if(zone?.flowRate && zone?.area) {
    // ETc примерно 5 мм/день → 50 м³/га/день
    const vol = Math.round(zone.area * 50 * 10)/10;
    const el = document.getElementById('fc-water-vol');
    if(el && !el.value) el.value = vol;
  }

  // Загружаем последний анализ воды
  const srcEl = document.getElementById('fc-analysis-source');
  // Устанавливаем целевые ppm из фазы
  onFertPhaseChange();
}

function onFertPhaseChange() {
  const phase = document.getElementById('fc-phase')?.value || 'veg';
  const targets = FERT_PHASE_TARGETS[phase] || FERT_PHASE_TARGETS.veg;

  // Вычитаем что даёт вода и учитываем почвенные запасы
  const waterAn = [...(S.analyses||[])].filter(a=>a.type==='water').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  const soilAn  = [...(S.analyses||[])].filter(a=>a.type==='soil').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];

  const waterCa = parseFloat(waterAn?.Ca||waterAn?.ca||0);
  const waterMg = parseFloat(waterAn?.Mg||waterAn?.mg||0);
  const waterN  = parseFloat(waterAn?.NO3||waterAn?.no3||0);

  // Из почвы — если K, P, Ca, Mg в норме — снижаем дозу
  const soilK  = parseFloat(soilAn?.K||soilAn?.k||0);   // мг/кг
  const soilP  = parseFloat(soilAn?.P||soilAn?.p||0);
  const soilCa = parseFloat(soilAn?.Ca||soilAn?.ca||0);
  const soilMg = parseFloat(soilAn?.Mg||soilAn?.mg||0);
  const soilPH = parseFloat(soilAn?.pH||soilAn?.ph||0);
  const soilNO3= parseFloat(soilAn?.NO3||soilAn?.no3||0);

  // Коэффициенты поправки из почвы (эмпирические, Neilsen et al.)
  // K >150 мг/кг → снижаем K на 30%, >200 → 50%
  const kReduction = soilK>200 ? 0.5 : soilK>150 ? 0.7 : 1.0;
  // P >30 мг/кг → снижаем P на 30%
  const pReduction = soilP>30 ? 0.7 : 1.0;
  // Ca из почвы при капельном не доступна напрямую
  // NO3 в почве >15 мг/кг → снижаем N
  const nReduction = soilNO3>15 ? 0.8 : soilNO3>30 ? 0.6 : 1.0;

  ['n','p','k','ca','mg'].forEach(el => {
    const inp = document.getElementById(`fc-ppm-${el}`);
    if(!inp) return;
    const key = el.toUpperCase();
    let target = targets[key] || 0;
    if(el==='ca') target = Math.max(0, target - waterCa);
    if(el==='mg') target = Math.max(0, target - waterMg);
    if(el==='n')  target = Math.max(0, (target - waterN) * nReduction);
    if(el==='k')  target = Math.max(0, target * kReduction);
    if(el==='p')  target = Math.max(0, target * pReduction);
    inp.value = Math.round(target);
    inp.style.color = (el==='n' && target===0) ? 'var(--red)' : 'var(--blue)';
  });

  // Показываем влияние почвы если есть анализ
  const soilNote = document.getElementById('fc-soil-note');
  if(soilNote) {
    if(soilAn) {
      const notes = [];
      if(soilPH > 7.5) notes.push(`pH ${soilPH} — защелачивание, блокировка Fe/Mn/Zn → добавить хелаты`);
      if(soilPH < 5.5) notes.push(`pH ${soilPH} — кислая почва, блокировка P, Ca → известкование`);
      if(soilK > 200)  notes.push(`K ${soilK}мг/кг — высокий запас, доза K снижена на ${Math.round((1-kReduction)*100)}%`);
      if(soilP > 30)   notes.push(`P ${soilP}мг/кг — высокий запас, доза P снижена на ${Math.round((1-pReduction)*100)}%`);
      if(soilNO3 > 15) notes.push(`NO₃ ${soilNO3}мг/кг в почве, доза N снижена на ${Math.round((1-nReduction)*100)}%`);
      soilNote.style.display = notes.length ? 'block' : 'none';
      soilNote.innerHTML = notes.length
        ? `<div style="font-size:11px;color:var(--orange);padding:6px 10px;background:rgba(245,158,11,.06);border-radius:6px;border-left:2px solid var(--orange);">
            🌱 Поправка по анализу почвы (${soilAn.date}):<br>${notes.map(n=>`· ${n}`).join('<br>')}
          </div>` : '';
    } else {
      soilNote.style.display = 'none';
    }
  }

  // Показываем научное примечание фазы
  const noteEl = document.getElementById('fc-phase-note');
  if(noteEl && targets.note) {
    noteEl.style.display = 'block';
    const isStop = targets.nFertPeriod?.includes('СТОП') || targets.nFertPeriod?.includes('НЕ ВНОСИТЬ');
    noteEl.style.background = isStop ? 'rgba(226,75,74,.06)' : 'rgba(96,165,250,.06)';
    noteEl.style.borderColor = isStop ? 'rgba(226,75,74,.2)' : 'rgba(96,165,250,.15)';
    const stopHtml = targets.stopNote ? `<br><span style="color:var(--red);">⛔ ${targets.stopNote}</span>` : '';
    const warnHtml = targets.nWarning ? `<br><span style="color:var(--orange);">⚠️ ${targets.nWarning}</span>` : '';
    const pHtml   = targets.pNote    ? `<br><span style="color:var(--accent);">📋 ${targets.pNote}</span>`   : '';
    noteEl.innerHTML = `<strong>📚 Neilsen et al. (CAB 2017):</strong> ${targets.note}
      ${targets.nFertPeriod?`<br>⏰ N-внесение: <strong>${targets.nFertPeriod}</strong>`:''}
      ${stopHtml}${warnHtml}${pHtml}`;
  }
}

// Подключаем onchange к select фазы
// Обработка запятой в числовых полях анализов
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-analysis')?.addEventListener('input', e => {
    if(e.target.inputMode === 'decimal') {
      const pos = e.target.selectionStart;
      const old = e.target.value;
      const fixed = old.replace(',', '.');
      if(fixed !== old) { e.target.value = fixed; e.target.setSelectionRange(pos, pos); }
    }
  });
  document.getElementById('modal-analysis')?.addEventListener('paste', e => {
    setTimeout(() => {
      document.querySelectorAll('#modal-analysis input[inputmode="decimal"]').forEach(inp => {
        inp.value = inp.value.replace(',', '.');
      });
    }, 10);
  });
});

function calcFertDose() {
  const zoneId   = document.getElementById('fc-zone')?.value;
  const waterVol = parseFloat(document.getElementById('fc-water-vol')?.value)||50;
  const tankL    = parseFloat(document.getElementById('fc-tank')?.value)||200;
  const zone     = (S.irrigation.zones||[]).find(z=>z.id===zoneId);

  // Площадь: из иерархической выборки (культура/участки/сорта) или из зоны полива
  const areaHa = zone?.area || fcGetSelectionArea();

  // Метка объекта для заголовка результата
  let selLabel = zone?.name || 'Весь сад';
  if(!zone) {
    if(_fcSelParcels.size > 0) {
      const parcelNames = [..._fcSelParcels].join(', ');
      if(_fcSelVarieties.size > 0) {
        const varNames = [..._fcSelVarieties].map(vid=>S.varieties.find(v=>v.id===vid)?.name||vid).join(', ');
        selLabel = `Участки ${parcelNames} · ${varNames}`;
      } else {
        selLabel = `Участки ${parcelNames}`;
      }
    }
  }

  // Читаем целевые ppm из полей
  const ppm = {};
  ['n','p','k','ca','mg'].forEach(el => {
    ppm[el.toUpperCase()] = parseFloat(document.getElementById(`fc-ppm-${el}`)?.value)||0;
  });

  // Научные алерты Neilsen et al.
  const sciAlerts = [];
  const ppmN = ppm.N || 0;
  if(ppmN > 120) sciAlerts.push(`⚠️ N ${ppmN}ppm превышает оптимум! Neilsen 2007: N >168ppm → мельчание плода, задержка созревания, снижение Brix. Рекомендуется 84 ppm.`);

  const phase = document.getElementById('fc-phase')?.value;
  const phaseTargets = FERT_PHASE_TARGETS[phase];
  if(phaseTargets?.nFertPeriod?.includes('СТОП')) sciAlerts.push(`⛔ ${phaseTargets.stopNote||'Стоп фертигации за 30 дней до сбора!'}`);
  if(phaseTargets?.nFertPeriod?.includes('НЕ ВНОСИТЬ')) sciAlerts.push(`🚫 В период цветения N НЕ вносить! Только P при цветении (20г/дерево).`);

  // Вода из анализа — поля хранятся с большой буквы (Ca, Mg, NO3, EC)
  const waterAn = [...(S.analyses||[])].filter(a=>a.type==='water').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  const waterCa = parseFloat(waterAn?.Ca||waterAn?.ca||0);
  const waterMg = parseFloat(waterAn?.Mg||waterAn?.mg||0);
  const waterN  = parseFloat(waterAn?.NO3||waterAn?.no3||0);
  const waterEC = parseFloat(waterAn?.EC||waterAn?.ec||0);

  // Потребности в г/м³ (ppm = г/м³)
  const need = {...ppm};

  // Подбираем удобрения жадным алгоритмом
  const selected = [];
  const ELEMS = ['Ca','N','P','K','Mg'];

  // Порядок подбора: сначала Ca (несовместима с другими), потом N, P, K, Mg
  const sorted = [...FERT_DB_EXTENDED].sort((a,b) => {
    const priorityA = a.Ca>0 ? 0 : a.N>0 ? 1 : a.P>0 ? 2 : a.K>0 ? 3 : 4;
    const priorityB = b.Ca>0 ? 0 : b.N>0 ? 1 : b.P>0 ? 2 : b.K>0 ? 3 : 4;
    return priorityA - priorityB;
  });

  const remain = {...need};
  const usedFerts = [];

  for(const fert of sorted) {
    if(Object.values(remain).every(v=>v<=0)) break;

    // Находим главный элемент этого удобрения
    const mainEl = ELEMS.find(e => fert[e]>0 && remain[e]>0);
    if(!mainEl) continue;

    // Сколько нужно г/л в баке чтобы покрыть потребность
    // need г/м³ воды → при объёме waterVol м³ нужно need*waterVol г всего
    // концентрация в баке = need*waterVol/tankL г/л
    const needTotalG = remain[mainEl] * waterVol;
    const contentPct = fert[mainEl] / 100;
    const fertG = needTotalG / contentPct; // г удобрения всего
    const concGL = fertG / tankL; // г/л в баке

    if(concGL < 0.1) continue; // слишком мало — не добавляем

    // Добавляем удобрение
    const fertKg = Math.round(fertG / 1000 * 100) / 100;
    const fertKgHa = Math.round(fertKg / areaHa * 100) / 100;
    usedFerts.push({
      fert, fertG, fertKg, fertKgHa,
      concGL: Math.round(concGL*10)/10,
      bak: fert.bak,
      covers: {},
    });

    // Вычитаем покрытые потребности
    ELEMS.forEach(e => {
      const covered = (fertG * fert[e] / 100) / waterVol; // ppm
      if(fert[e]>0) usedFerts[usedFerts.length-1].covers[e] = Math.round(covered*10)/10;
      remain[e] = Math.max(0, remain[e] - covered);
    });
  }

  // Проверяем несовместимость
  const incompatWarnings = [];
  for(let i=0;i<usedFerts.length;i++) {
    for(let j=i+1;j<usedFerts.length;j++) {
      const a = usedFerts[i].fert.name;
      const b = usedFerts[j].fert.name;
      if(FERT_INCOMPAT_PAIRS.some(p=>(p[0]===a&&p[1]===b)||(p[0]===b&&p[1]===a))) {
        incompatWarnings.push(`❌ ${a} + ${b} — несовместимы! Разные баки.`);
        usedFerts[j].bak = usedFerts[i].bak==='A' ? 'B' : 'A';
      }
    }
  }

  // EC раствора (приблизительно)
  const addedEC = usedFerts.reduce((s,f)=>s+(f.fertG/waterVol/1000*10),0);
  const totalEC = Math.round((waterEC + addedEC)*10)/10;

  // Группируем по бакам
  const bakA = usedFerts.filter(f=>f.bak==='A');
  const bakB = usedFerts.filter(f=>f.bak==='B');

  // Рендерим результат
  const resEl = document.getElementById('fc-result');
  resEl.style.display = 'block';
  resEl.innerHTML = `
    <div style="padding:14px;background:rgba(74,222,128,.06);border:1px solid rgba(74,222,128,.2);border-radius:10px;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:700;color:var(--accent);margin-bottom:10px;">
        📋 Программа фертигации — ${selLabel} · ${areaHa.toFixed(1)}га · ${waterVol}м³ воды
      </div>

      ${sciAlerts.length ? `<div style="margin-bottom:12px;padding:10px 14px;background:rgba(226,75,74,.06);border:1px solid rgba(226,75,74,.2);border-radius:8px;">
        ${sciAlerts.map(a=>`<div style="font-size:11px;color:var(--red);padding:2px 0;">${a}</div>`).join('')}
      </div>` : ''}

      ${incompatWarnings.length ? `<div style="margin-bottom:10px;">${incompatWarnings.map(w=>`<div style="font-size:11px;color:var(--red);padding:3px 0;">${w}</div>`).join('')}</div>` : ''}

      <!-- Баки -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        ${[{label:'Бак A', ferts:bakA, color:'var(--blue)'},{label:'Бак B', ferts:bakB, color:'var(--yellow)'}].map(({label,ferts,color})=>
          ferts.length ? `<div style="padding:10px;background:var(--surface);border-radius:8px;border-left:3px solid ${color};">
            <div style="font-size:11px;font-weight:700;color:${color};margin-bottom:8px;">${label}</div>
            ${ferts.map(f=>`<div style="margin-bottom:6px;">
              <div style="font-size:12px;font-weight:600;">${f.fert.name}</div>
              <div style="font-size:11px;color:var(--text3);">
                ${f.concGL} г/л · ${f.fertKg} кг всего · ${f.fertKgHa} кг/га
              </div>
              <div style="font-size:10px;color:var(--text3);">
                Покрывает: ${Object.entries(f.covers).map(([e,v])=>`${e}: ${v}ppm`).join(' · ')}
              </div>
            </div>`).join('')}
          </div>` : ''
        ).join('')}
      </div>

      <!-- EC и проверки -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="text-align:center;padding:8px;background:var(--surface);border-radius:8px;">
          <div style="font-size:14px;font-weight:700;color:${totalEC<3?'var(--accent)':'var(--red)'};">${totalEC}</div>
          <div style="font-size:9px;color:var(--text3);">EC mS/cm ${totalEC<3?'✅':'⚠️ >3!'}</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--surface);border-radius:8px;">
          <div style="font-size:14px;font-weight:700;color:var(--blue);">${usedFerts.reduce((s,f)=>s+f.fertKg,0).toFixed(1)}</div>
          <div style="font-size:9px;color:var(--text3);">кг всего</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--surface);border-radius:8px;">
          <div style="font-size:14px;font-weight:700;color:var(--yellow);">${tankL}</div>
          <div style="font-size:9px;color:var(--text3);">л бак</div>
        </div>
      </div>

      <!-- Непокрытые потребности -->
      ${Object.entries(remain).some(([,v])=>v>0) ? `
        <div style="padding:8px 12px;background:rgba(251,146,60,.08);border-radius:8px;font-size:11px;color:var(--orange);">
          ⚠️ Не покрыто: ${Object.entries(remain).filter(([,v])=>v>0).map(([e,v])=>`${e}: ${Math.round(v)}ppm`).join(' · ')}
          — добавьте микроэлементы или скорректируйте дозу
        </div>` : `<div style="padding:8px 12px;background:rgba(74,222,128,.06);border-radius:8px;font-size:11px;color:var(--accent);">✅ Все потребности покрыты</div>`}

      <button class="btn btn-primary btn-sm" style="margin-top:12px;width:100%;" onclick="saveFertCalcAsProgram()">💾 Сохранить как программу фертигации</button>
    </div>`;

  // Сохраняем для последующего использования
  window._lastFertCalc = {usedFerts, zone, areaHa, waterVol, tankL, totalEC};
}

function saveFertCalcAsProgram() {
  if(!window._lastFertCalc) return;
  const {usedFerts, zone, areaHa, waterVol} = window._lastFertCalc;
  const phase = document.getElementById('fc-phase')?.value;
  const phaseLabel = document.getElementById('fc-phase')?.selectedOptions[0]?.text || phase;

  if(!S.irrigation.fertigation) S.irrigation.fertigation = {programs:[]};
  if(!S.irrigation.fertigation.programs) S.irrigation.fertigation.programs = [];

  const prog = {
    id: uid(),
    name: `${phaseLabel} — ${selLabel} — ${new Date().toLocaleDateString('ru-RU')}`,
    phase: phaseLabel,
    zone: zone?.name||'',
    areaHa, waterVol,
    fertilizers: usedFerts.map(f=>({
      name: f.fert.name,
      kgTotal: f.fertKg,
      kgHa: f.fertKgHa,
      concGL: f.concGL,
      bak: f.bak,
    })),
    date: new Date().toISOString().split('T')[0],
    note: `Рассчитано автоматически`,
  };

  S.irrigation.fertigation.programs.unshift(prog);
  save();
  closeModal('modal-fert-calc');
  switchIrrigSub('fertigation');
  alert('✅ Программа сохранена в Фертигация');
}

// ═══ ИРРИГАЦИОННОЕ ОБОРУДОВАНИЕ ═════════════════════════════════════════

// Хранится в S.irrigEquip = { pumps:[], valves:[], drip:[], frost:[] }
function _getIrrigStore() {
  if(!S.irrigEquip) S.irrigEquip = {pumps:[], valves:[], drip:[], frost:[]};
  return S.irrigEquip;
}

const IRRIG_FORMS = {
  pump: {
    title: '🔧 Насос',
    listId: 'irrig-pump-list',
    storeKey: 'pumps',
    cols: ['Название/модель','Производит. (м³/ч)','Давление (бар)','Мощность (кВт)','Фазы','Примечание'],
    fields: [
      {id:'irrig-f-name',   label:'Название / модель',         type:'text',   placeholder:'Grundfos CM5-6, Pedrollo F32/200A'},
      {id:'irrig-f-flow',   label:'Производительность (м³/ч)', type:'number', placeholder:'12.5'},
      {id:'irrig-f-pres',   label:'Рабочее давление (бар)',    type:'number', placeholder:'4.5'},
      {id:'irrig-f-power',  label:'Мощность (кВт)',            type:'number', placeholder:'2.2'},
      {id:'irrig-f-phases', label:'Фазы питания',              type:'select', options:['1-фазный 220В','3-фазный 380В','Дизельный']},
      {id:'irrig-f-note',   label:'Примечание',                type:'text',   placeholder:'Серийный номер, расположение...'},
    ],
    row: r => `<td><strong>${r.name}</strong></td><td>${r.flow||'—'}</td><td>${r.pres||'—'}</td><td>${r.power||'—'}</td><td style="color:var(--text3);">${r.phases||'—'}</td><td style="color:var(--text3);font-size:11px;">${r.note||'—'}</td>`,
  },
  valve: {
    title: '🔩 Клапан',
    listId: 'irrig-valve-list',
    storeKey: 'valves',
    cols: ['Модель','Тип','Диаметр','Макс. давление','Зона','Управление','Примечание'],
    fields: [
      {id:'irrig-f-name',  label:'Модель',                   type:'text',   placeholder:'Bermad 400E, Netafim NP-19'},
      {id:'irrig-f-vtype', label:'Тип клапана',              type:'select', options:['Электромагнитный','Гидравлический','Ручной','Обратный']},
      {id:'irrig-f-diam',  label:'Диаметр (дюйм / мм)',      type:'text',   placeholder:'1.5" / 40мм'},
      {id:'irrig-f-pres',  label:'Макс. давление (бар)',     type:'number', placeholder:'10'},
      {id:'irrig-f-zone',  label:'Зона / клетка',            type:'text',   placeholder:'Ряд 1-3, блок А'},
      {id:'irrig-f-volt',  label:'Напряжение управления',    type:'text',   placeholder:'24V AC, 12V DC'},
      {id:'irrig-f-note',  label:'Устройство / особенности', type:'text',   placeholder:'Регулятор давления, фильтр-сетка...'},
    ],
    row: r => `<td><strong>${r.name}</strong></td><td>${r.vtype||'—'}</td><td>${r.diam||'—'}</td><td>${r.pres||'—'} бар</td><td style="color:var(--text3);">${r.zone||'—'}</td><td style="color:var(--text3);">${r.volt||'—'}</td><td style="color:var(--text3);font-size:11px;">${r.note||'—'}</td>`,
  },
  drip: {
    title: '💦 Капельная трубка / эмиттеры',
    listId: 'irrig-drip-list',
    storeKey: 'drip',
    cols: ['Марка трубки','Тип эмиттера','Расст. (см)','Водовылив (л/ч)','Давл. мин/ном (бар)','Диаметр','Зона','Примечание'],
    fields: [
      {id:'irrig-f-name',     label:'Марка / модель трубки',          type:'text',   placeholder:'Netafim Typhoon, Irritec Premium'},
      {id:'irrig-f-emitter',  label:'Тип эмиттера',                   type:'select', options:['Встроенный (inline)','Вставной (online)','Компенсирующий (PCE)','Лабиринтный']},
      {id:'irrig-f-spacing',  label:'Расстояние между эмиттерами (см)', type:'number', placeholder:'50'},
      {id:'irrig-f-flow',     label:'Водовылив одного эмиттера (л/ч)',  type:'number', placeholder:'2.0'},
      {id:'irrig-f-pres_min', label:'Мин. рабочее давление (бар)',      type:'number', placeholder:'0.5'},
      {id:'irrig-f-pres_nom', label:'Номинальное давление (бар)',       type:'number', placeholder:'1.0'},
      {id:'irrig-f-diam',     label:'Диаметр трубки (мм)',             type:'text',   placeholder:'16мм'},
      {id:'irrig-f-zone',     label:'Зона / клетки',                   type:'text',   placeholder:'Черешня 1-1 до 3-6'},
      {id:'irrig-f-note',     label:'Примечание',                      type:'text',   placeholder:'Год монтажа, длина линий...'},
    ],
    row: r => `<td><strong>${r.name}</strong></td><td>${r.emitter||'—'}</td><td>${r.spacing||'—'}</td><td><strong style="color:var(--blue);">${r.flow||'—'} л/ч</strong></td><td>${r.pres_min||'—'} / ${r.pres_nom||'—'}</td><td>${r.diam||'—'}</td><td style="color:var(--text3);">${r.zone||'—'}</td><td style="color:var(--text3);font-size:11px;">${r.note||'—'}</td>`,
  },
  frost: {
    title: '🌡️ Система антизаморозки',
    listId: 'irrig-frost-list',
    storeKey: 'frost',
    cols: ['Зона / название','Тип','Модель спринклера','Расход (м³/ч·га)','Мин. давл. (бар)','Радиус (м)','Расст. (м)','Вкл. при (°C)','Примечание'],
    fields: [
      {id:'irrig-f-name',     label:'Название / зона',                    type:'text',   placeholder:'Антизаморозка блок А'},
      {id:'irrig-f-ftype',    label:'Тип системы',                        type:'select', options:['Водяная (спринклеры)','Воздушная (вентиляторы)','Смешанная','Обогрев почвы']},
      {id:'irrig-f-sprink',   label:'Модель спринклера',                  type:'text',   placeholder:'Nelson R33, Senninger i-Wob'},
      {id:'irrig-f-flow',     label:'Объём потребляемой воды (м³/ч·га)',  type:'number', placeholder:'40'},
      {id:'irrig-f-pres_min', label:'Мин. рабочее давление (бар)',        type:'number', placeholder:'2.5'},
      {id:'irrig-f-radius',   label:'Радиус охвата спринклера (м)',       type:'number', placeholder:'12'},
      {id:'irrig-f-spacing',  label:'Расстояние между спринклерами (м)',  type:'number', placeholder:'18'},
      {id:'irrig-f-temp_on',  label:'Температура включения (°C)',         type:'number', placeholder:'-0.5'},
      {id:'irrig-f-zone',     label:'Зона / клетки',                      type:'text',   placeholder:'Весь сад / Блок 1'},
      {id:'irrig-f-note',     label:'Примечание',                         type:'text',   placeholder:'Источник воды, насос, год монтажа...'},
    ],
    row: r => `<td><strong>${r.name}</strong></td><td style="color:var(--text3);font-size:11px;">${r.ftype||'—'}</td><td>${r.sprink||'—'}</td><td><strong style="color:var(--blue);">${r.flow||'—'}</strong></td><td>${r.pres_min||'—'}</td><td>${r.radius||'—'}</td><td>${r.spacing||'—'}</td><td style="color:${parseFloat(r.temp_on)<0?'var(--blue)':'var(--text2)'};">${r.temp_on!=null?r.temp_on+'°C':'—'}</td><td style="color:var(--text3);font-size:11px;">${r.note||'—'}</td>`,
  },
};

function loadIrrigLists() {
  const store = _getIrrigStore();
  Object.entries(IRRIG_FORMS).forEach(([type, cfg]) => {
    const el = document.getElementById(cfg.listId);
    if(!el) return;
    const items = store[cfg.storeKey]||[];
    if(!items.length) {
      el.innerHTML = `<div style="color:var(--text3);font-size:12px;padding:6px;">Не добавлено</div>`;
      return;
    }
    el.innerHTML = `<div style="overflow-x:auto;"><table class="data-table"><thead><tr>
      ${cfg.cols.map(c=>`<th>${c}</th>`).join('')}<th></th>
    </tr></thead><tbody>${items.map((r,i)=>`<tr>
      ${cfg.row(r)}
      <td><button class="btn btn-secondary btn-xs" onclick="openIrrigModal('${type}',${i})">✏️</button></td>
    </tr>`).join('')}</tbody></table></div>`;
  });
}

function openIrrigModal(type, editIdx) {
  const cfg = IRRIG_FORMS[type];
  if(!cfg) return;
  const store = _getIrrigStore();
  const item = (editIdx!==undefined && editIdx!==null) ? store[cfg.storeKey][editIdx] : null;
  document.getElementById('irrig-modal-title').textContent = item ? `✏️ ${cfg.title}` : `+ ${cfg.title}`;
  document.getElementById('irrig-edit-id').value = (editIdx!==undefined && editIdx!==null) ? editIdx : '';
  document.getElementById('irrig-edit-type').value = type;
  document.getElementById('irrig-del-btn').style.display = item ? 'block' : 'none';
  const INP = `width:100%;padding:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'Inter',sans-serif;`;
  document.getElementById('irrig-form-body').innerHTML = `<div class="form-grid">` +
    cfg.fields.map(f => {
      const key = f.id.replace('irrig-f-','');
      const val = item?.[key] ?? '';
      if(f.type==='select') {
        return `<div class="ff"><label>${f.label}</label>
          <select id="${f.id}" style="${INP}">
            ${f.options.map(o=>`<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('')}
          </select></div>`;
      }
      return `<div class="ff"><label>${f.label}</label>
        <input type="${f.type}" id="${f.id}" value="${val}" placeholder="${f.placeholder||''}" style="${INP}"></div>`;
    }).join('') + `</div>`;
  openModal('modal-irrig');
}

function saveIrrig() {
  const type = document.getElementById('irrig-edit-type').value;
  const editIdx = document.getElementById('irrig-edit-id').value;
  const cfg = IRRIG_FORMS[type];
  if(!cfg) return;
  const obj = {};
  cfg.fields.forEach(f => {
    const key = f.id.replace('irrig-f-','');
    const el = document.getElementById(f.id);
    if(el) obj[key] = f.type==='number' ? (el.value!==''?parseFloat(el.value):null) : (el.value.trim()||null);
  });
  if(!obj.name){alert('Введите название/модель');return;}
  const store = _getIrrigStore();
  if(editIdx!=='') store[cfg.storeKey][parseInt(editIdx)] = obj;
  else store[cfg.storeKey].push(obj);
  S.irrigEquip = store;
  save();
  closeModal('modal-irrig');
  loadIrrigLists();
}

function deleteIrrig() {
  const type = document.getElementById('irrig-edit-type').value;
  const editIdx = parseInt(document.getElementById('irrig-edit-id').value);
  const cfg = IRRIG_FORMS[type];
  if(!cfg||isNaN(editIdx)||!confirm('Удалить?')) return;
  const store = _getIrrigStore();
  store[cfg.storeKey].splice(editIdx,1);
  S.irrigEquip = store;
  save();
  closeModal('modal-irrig');
  loadIrrigLists();
}

// ===================== IRRIGATION =====================

// Default thresholds by method
const IRRIG_DEFAULTS = {
  percent: { dry:15, low:25, ok:45, wet:55,
    hint:'% VWC (объёмная влажность): <15%=Сухо, 15–25%=Полив нужен, 25–45%=Норма, >55%=Избыток',
    unit:'%', label:'Влажность почвы (%)' },
  kpa:     { dry:60, low:40, ok:20, wet:5,
    hint:'кПа (тензиометр, обратная шкала): >60кПа=Сухо, 20–60кПа=Норма, <5кПа=Насыщение',
    unit:'кПа', label:'Водный потенциал (кПа)' },
  cbar:    { dry:60, low:40, ok:20, wet:5,
    hint:'cBar (Watermark): >60cBar=Стресс черешни, 10–40=Норма, <5=Насыщение почвы',
    unit:'cBar', label:'Потенциал почвы (cBar)' },
};

// For kPa/cBar — higher = drier, so status logic is inverted
function getSoilStatus(value, method) {
  const irr = S.irrigation;
  const thr = irr.thresholds;
  const inv = method === 'kpa' || method === 'cbar'; // inverted scale
  if (!inv) {
    if (value < thr.dry) return 'dry';
    if (value < thr.low) return 'low';
    if (value <= thr.ok) return 'ok';
    return 'wet';
  } else {
    if (value > thr.dry) return 'dry';
    if (value > thr.low) return 'low';
    if (value >= thr.ok) return 'ok';
    return 'wet';
  }
}

function getSoilStatusLabel(status, method) {
  const inv = method==='kpa'||method==='cbar';
  const labels = {
    dry: '🔴 Сухо — полив срочно',
    low: '🟡 Полив нужен',
    ok:  '✅ Норма',
    wet: '💧 Избыток влаги',
  };
  return labels[status] || '—';
}

function getIrrigRecommendation(status, phase) {
  const phaseName = phase?.name || '';
  const urgent = ['Цветение','Завязь','Рост плода','Созревание'];
  const isUrgent = urgent.some(p => phaseName.includes(p));
  if (status === 'dry') {
    if (isUrgent) return { level:'critical', text:`⚠️ СРОЧНО — Сухость в фазе ${phaseName}! Дефицит воды в этой фазе снижает урожай и размер плодов. Начать полив немедленно.` };
    return { level:'watch', text:'Почва сухая. Запустить полив в ближайшие 24 часа.' };
  }
  if (status === 'low') return { level:'watch', text:`Влажность ниже нормы. Запланировать полив сегодня–завтра.` };
  if (status === 'wet') return { level:'ok', text:'Переувлажнение. Отложить полив. Проверить дренаж.' };
  return { level:'ok', text:'Влажность в норме. Следующий контроль через 24–48 часов.' };
}

function getLastReading(sensorId) {
  return S.irrigation.readings
    .filter(r => r.sensorId === sensorId)
    .sort((a,b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))[0] || null;
}

// ---- SENSOR SETUP ----
function openSensorSetupModal() {
  const irr = S.irrigation;
  const def = IRRIG_DEFAULTS[irr.method] || IRRIG_DEFAULTS.percent;
  // Set method radio
  document.querySelectorAll('input[name="moisture-method"]').forEach(r => r.checked = r.value === irr.method);
  // Set thresholds
  document.getElementById('thr-dry').value = irr.thresholds.dry;
  document.getElementById('thr-low').value = irr.thresholds.low;
  document.getElementById('thr-ok').value  = irr.thresholds.ok;
  document.getElementById('thr-wet').value = irr.thresholds.wet;
  document.getElementById('threshold-hint').textContent = def.hint;
  // Populate cell select
  const csel = document.getElementById('ns-cell');
  csel.innerHTML = '<option value="">Весь сад</option>';
  Object.keys(S.cells).forEach(k => { const col = getCellColors(S.cells[k]); csel.innerHTML += `<option value="${k}">${k}${col[0]?' — '+col[0].name:''}</option>`; });
  renderSensorList();
  // Live method change
  document.querySelectorAll('input[name="moisture-method"]').forEach(r => {
    r.onchange = () => {
      const d = IRRIG_DEFAULTS[r.value] || IRRIG_DEFAULTS.percent;
      document.getElementById('thr-dry').value = d.dry;
      document.getElementById('thr-low').value = d.low;
      document.getElementById('thr-ok').value  = d.ok;
      document.getElementById('thr-wet').value = d.wet;
      document.getElementById('threshold-hint').textContent = d.hint;
    };
  });
  openModal('modal-sensor-setup');
}

function saveSensorSetup() {
  const method = document.querySelector('input[name="moisture-method"]:checked')?.value || 'percent';
  S.irrigation.method = method;
  S.irrigation.thresholds = {
    dry: parseFloat(document.getElementById('thr-dry').value) || IRRIG_DEFAULTS[method].dry,
    low: parseFloat(document.getElementById('thr-low').value) || IRRIG_DEFAULTS[method].low,
    ok:  parseFloat(document.getElementById('thr-ok').value)  || IRRIG_DEFAULTS[method].ok,
    wet: parseFloat(document.getElementById('thr-wet').value) || IRRIG_DEFAULTS[method].wet,
  };
  save(); closeModal('modal-sensor-setup'); renderIrrigation();
}

function renderSensorList() {
  const el = document.getElementById('sensor-list-setup');
  if (!S.irrigation.sensors.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px;">Нет датчиков — добавьте первый</div>';
    return;
  }
  el.innerHTML = S.irrigation.sensors.map((s,i) => `
    <div class="sensor-setup-row">
      <div style="font-size:12px;"><strong>${s.name}</strong><div style="font-size:10px;color:var(--text3);">${s.brand||'—'}</div></div>
      <div style="font-size:12px;color:var(--accent);">▼ ${s.depth}см</div>
      <div style="font-size:11px;color:var(--text3);">${s.cellKey||'Весь сад'}</div>
      <div style="font-size:11px;color:var(--text3);">${s.note||''}</div>
      <button class="btn btn-danger btn-xs" onclick="removeSensor(${i})">✕</button>
    </div>`).join('');
}

function addSensor() {
  const name = document.getElementById('ns-name').value.trim();
  if (!name) { alert('Введите название датчика'); return; }
  const depth = parseInt(document.getElementById('ns-depth').value) || 30;
  S.irrigation.sensors.push({
    id: 'sensor_' + Date.now(),
    name, brand: document.getElementById('ns-brand').value,
    depth, cellKey: document.getElementById('ns-cell').value,
    note: document.getElementById('ns-note').value,
  });
  ['ns-name','ns-brand','ns-depth','ns-note'].forEach(id => document.getElementById(id).value = '');
  save(); renderSensorList();
}

function removeSensor(idx) {
  if (!confirm(`Удалить датчик "${S.irrigation.sensors[idx].name}"?`)) return;
  S.irrigation.sensors.splice(idx, 1);
  save(); renderSensorList();
}

// ---- READINGS ----
let _editingReadingId = null;

function openSoilReadingModal(id) {
  _editingReadingId = id || null;
  const r = id ? S.irrigation.readings.find(x => x.id === id) : null;
  document.getElementById('soil-reading-title').textContent = r ? '✏️ Редактировать показание' : '💧 Внести показания датчиков';
  document.getElementById('sr-del-btn').style.display = r ? 'inline-flex' : 'none';
  document.getElementById('sr-date').value = r?.date || new Date().toISOString().split('T')[0];
  document.getElementById('sr-time').value = r?.time || '08:00';
  document.getElementById('sr-value').value = r?.value ?? '';
  document.getElementById('sr-soiltemp').value = r?.soilTemp ?? '';
  document.getElementById('sr-note').value = r?.note || '';
  document.getElementById('sr-preview').style.display = 'none';
  // Populate sensor select
  const ssel = document.getElementById('sr-sensor');
  ssel.innerHTML = '<option value="">— выбрать датчик —</option>';
  S.irrigation.sensors.forEach(s => ssel.innerHTML += `<option value="${s.id}" ${r?.sensorId===s.id?'selected':''}>${s.name} (▼${s.depth}см)</option>`);
  // Update label
  const def = IRRIG_DEFAULTS[S.irrigation.method] || IRRIG_DEFAULTS.percent;
  document.getElementById('sr-val-label').textContent = def.label;
  // Live preview
  document.getElementById('sr-value').oninput = previewSoilStatus;
  openModal('modal-soil-reading');
}

function previewSoilStatus() {
  const val = parseFloat(document.getElementById('sr-value').value);
  if (isNaN(val)) { document.getElementById('sr-preview').style.display='none'; return; }
  const method = S.irrigation.method;
  const status = getSoilStatus(val, method);
  const def = IRRIG_DEFAULTS[method] || IRRIG_DEFAULTS.percent;
  const colors = {dry:'var(--red)',low:'var(--yellow)',ok:'var(--accent)',wet:'var(--blue)'};
  const el = document.getElementById('sr-preview');
  el.style.display = 'block';
  el.innerHTML = `<div style="padding:10px 14px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);">
    <span style="font-size:12px;font-weight:600;color:${colors[status]||'var(--text)'};">${getSoilStatusLabel(status,method)}</span>
    <span style="font-size:11px;color:var(--text3);margin-left:10px;">${val} ${def.unit}</span>
  </div>`;
}

function saveSoilReading() {
  const date = document.getElementById('sr-date').value;
  const sensorId = document.getElementById('sr-sensor').value;
  const value = parseFloat(document.getElementById('sr-value').value);
  if (!date || !sensorId || isNaN(value)) { alert('Заполните дату, датчик и показание'); return; }
  const entry = {
    id: _editingReadingId || ('rd_'+Date.now()),
    date, time: document.getElementById('sr-time').value,
    sensorId, value,
    soilTemp: parseFloat(document.getElementById('sr-soiltemp').value) || null,
    note: document.getElementById('sr-note').value,
  };
  if (_editingReadingId) {
    const i = S.irrigation.readings.findIndex(r=>r.id===_editingReadingId);
    if (i>=0) S.irrigation.readings[i]=entry; else S.irrigation.readings.push(entry);
  } else {
    S.irrigation.readings.push(entry);
  }
  S.irrigation.readings.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
  save(); closeModal('modal-soil-reading'); renderIrrigation();
}

function deleteSoilReading() {
  if (!_editingReadingId||!confirm('Удалить показание?')) return;
  S.irrigation.readings = S.irrigation.readings.filter(r=>r.id!==_editingReadingId);
  save(); closeModal('modal-soil-reading'); renderIrrigation();
}

// ---- IMPORT FROM EXCEL (meteo station with soil channels) ----
function importSoilData(event) {
  const file = event.target.files[0]; if (!file) return;
  event.target.value = '';
  const statusEl = document.getElementById('soil-import-status');
  statusEl.style.display='block';
  statusEl.innerHTML='<div style="padding:10px 14px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:8px;font-size:12px;color:var(--yellow);">⏳ Читаю файл...</div>';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      // Show column picker dialog
      showSoilColumnPicker(rows, file.name, statusEl);
    } catch(err) {
      statusEl.innerHTML=`<div style="padding:10px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ ${err.message}</div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

function showSoilColumnPicker(rows, filename, statusEl) {
  if (!rows.length) { statusEl.innerHTML='<div style="color:var(--red);">Файл пустой</div>'; return; }
  const headerRow = rows[0];
  const headers = headerRow.map((h,i) => ({i, label:`${String(h||'кол.'+i).slice(0,30)}`}));

  // Preview first data row
  const firstData = rows[1] || [];
  const previewHtml = headers.slice(0,8).map(h =>
    `<span style="font-size:10px;padding:2px 6px;background:var(--surface3);border-radius:4px;">${h.label}: <strong>${String(firstData[h.i]||'').slice(0,10)}</strong></span>`
  ).join(' ');

  // Sensor options
  const sensorOpts = S.irrigation.sensors.length
    ? S.irrigation.sensors.map(s=>`<option value="${s.id}">${s.name} (▼${s.depth}см · ${s.cellKey||'все'})</option>`).join('')
    : '<option value="">— сначала добавьте датчики в ⚙️ Настройка —</option>';

  // Auto-detect date column (first col containing date-like value)
  let autoDateCol = 0;
  for (let i=0;i<firstData.length;i++) {
    if (String(firstData[i]).match(/\d{4}|\d{2}[./]\d{2}/)) { autoDateCol=i; break; }
  }

  const colOpts = headers.map(h=>`<option value="${h.i}">${h.label}</option>`).join('');

  // Build channel rows — one per sensor
  const channelRows = S.irrigation.sensors.length
    ? S.irrigation.sensors.map((s,si) => `
      <tr style="background:${si%2?'var(--surface2)':'var(--surface)'};">
        <td style="padding:8px 12px;font-weight:600;">
          <div style="font-size:12px;">${s.name}</div>
          <div style="font-size:10px;color:var(--text3);">▼${s.depth}см · ${s.brand||''}${s.cellKey?' · '+s.cellKey:''}</div>
        </td>
        <td style="padding:8px 12px;">
          <select id="sch-col-${s.id}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:6px;color:var(--text);font-size:12px;width:100%;">
            <option value="">— не импортировать —</option>
            ${colOpts}
          </select>
        </td>
        <td style="padding:8px 12px;">
          <select id="sch-type-${s.id}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:6px;color:var(--text);font-size:12px;">
            <option value="value">Влажность / тензиометр</option>
            <option value="temp">Температура почвы</option>
          </select>
        </td>
      </tr>`) .join('')
    : `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--text3);font-size:12px;">
        Нет датчиков. Сначала добавьте датчики через ⚙️ Настройка датчиков, затем импортируйте данные.
      </td></tr>`;

  window._soilImportRows = rows;
  const modalHtml = `
    <div class="modal-overlay open" id="modal-soil-col-picker">
      <div class="modal" style="width:680px;">
        <h2>📊 Импорт данных влажности почвы — ${filename}</h2>
        <div style="font-size:11px;color:var(--text3);background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:14px;line-height:1.7;">
          <strong>Файл:</strong> ${rows.length} строк · <strong>Колонки:</strong> ${headers.length}<br>
          Предпросмотр: ${previewHtml}
        </div>

        <div class="form-grid" style="margin-bottom:14px;">
          <div class="ff"><label>Колонка с датой/временем</label>
            <select id="sc-date" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);width:100%;">
              ${headers.map(h=>`<option value="${h.i}" ${h.i===autoDateCol?'selected':''}>${h.label}</option>`).join('')}
            </select>
          </div>
          <div class="ff"><label>Начало данных (строка)</label>
            <input type="number" id="sc-start-row" value="2" min="1"
              style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);width:100%;">
          </div>
        </div>

        <div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">
          📡 Привязка колонок к датчикам
        </div>

        <div style="background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.15);border-radius:8px;padding:10px;margin-bottom:12px;font-size:11px;color:var(--text2);line-height:1.7;">
          💡 <strong>Как читать данные метеостанции:</strong><br>
          • Датчик на <strong>20 см</strong> (зона корней) → показывает КОГДА поливать (триггер)<br>
          • Датчик на <strong>60–90 см</strong> (под корнями) → показывает СКОЛЬКО полили (контроль вымывания)<br>
          • Когда верхний датчик сухой → начинаем полив<br>
          • Когда нижний датчик намок → прекращаем (вода дошла до нижнего горизонта)<br>
          Источник: Sela, стр.232
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px;">
          <thead><tr style="background:var(--surface2);">
            <th style="padding:8px 12px;text-align:left;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Датчик</th>
            <th style="padding:8px 12px;text-align:left;font-size:9px;color:var(--text3);text-transform:uppercase;">Колонка в файле</th>
            <th style="padding:8px 12px;text-align:left;font-size:9px;color:var(--text3);text-transform:uppercase;">Тип данных</th>
          </tr></thead>
          <tbody>${channelRows}</tbody>
        </table>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('modal-soil-col-picker').remove();window._soilImportRows=null;">Отмена</button>
          <button class="btn btn-primary" onclick="processSoilImport()">📥 Импортировать</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function processSoilImport() {
  const rows = window._soilImportRows;
  if (!rows) return;
  const dateCol = parseInt(document.getElementById('sc-date').value);
  const startRow = parseInt(document.getElementById('sc-start-row').value)||2;
  document.getElementById('modal-soil-col-picker').remove();
  window._soilImportRows = null;

  // Build sensor→column mapping
  const channels = S.irrigation.sensors.map(s => {
    const colEl = document.getElementById(`sch-col-${s.id}`);
    const typeEl = document.getElementById(`sch-type-${s.id}`);
    const col = colEl?.value ? parseInt(colEl.value) : null;
    const type = typeEl?.value || 'value';
    return col !== null && !isNaN(col) ? {sensorId:s.id, col, type} : null;
  }).filter(Boolean);

  if (!channels.length) {
    const statusEl = document.getElementById('soil-import-status');
    statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ Не выбрана ни одна колонка</div>`;
    return;
  }

  let added = 0, skipped = 0;
  const existingKeys = new Set(S.irrigation.readings.map(r=>`${r.date}_${r.sensorId}_${r.time}`));

  for (let i=startRow-1; i<rows.length; i++) {
    const row = rows[i];
    const rawDate = String(row[dateCol]||'').trim();
    if (!rawDate) continue;
    const dateMatch = rawDate.match(/(\d{4}-\d{2}-\d{2})|(\d{2}[./]\d{2}[./]\d{4})/);
    if (!dateMatch) continue;
    let day = dateMatch[0];
    if (day.match(/^\d{2}[./]/)) { const p=day.split(/[./]/); day=`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`; }
    const timeMatch = rawDate.match(/(\d{2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : '12:00';

    channels.forEach(ch => {
      const val = parseFloat(String(row[ch.col]||'').replace(',','.'));
      if (isNaN(val)) return;
      const key = `${day}_${ch.sensorId}_${time}`;
      if (existingKeys.has(key)) { skipped++; return; }
      existingKeys.add(key);
      const entry = {
        id: 'rd_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
        date: day, time, sensorId: ch.sensorId, value: val,
        soilTemp: ch.type==='temp' ? val : null,
        note: 'Импорт метеостанции',
      };
      if (ch.type === 'temp' && entry.soilTemp !== null) {
        // For temp column — find or update existing reading for this sensor+date
        const existing = S.irrigation.readings.find(r=>r.date===day&&r.sensorId===ch.sensorId&&r.time===time);
        if (existing) { existing.soilTemp = val; return; }
      }
      S.irrigation.readings.push(entry);
      added++;
    });
  }

  S.irrigation.readings.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
  save(); renderIrrigation();
  const statusEl = document.getElementById('soil-import-status');
  statusEl.style.display = 'block';
  const byChannel = channels.map(ch => {
    const s = S.irrigation.sensors.find(x=>x.id===ch.sensorId);
    const cnt = S.irrigation.readings.filter(r=>r.sensorId===ch.sensorId).length;
    return `${s?.name||ch.sensorId}: ${cnt} записей`;
  }).join(' · ');
  statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.3);border-radius:8px;font-size:12px;color:var(--accent);">
    ✅ Импортировано <strong>${added}</strong> показаний${skipped?` · ${skipped} дублей пропущено`:''}<br>
    <span style="font-size:11px;color:var(--text3);">${byChannel}</span>
  </div>`;
}

// ---- RENDER ----
function renderIrrigation() {
  const irr = S.irrigation;
  const method = irr.method;
  const def = IRRIG_DEFAULTS[method] || IRRIG_DEFAULTS.percent;
  // Get current GDD phase
  const tbase=5,gdd=getCurrentGdd(tbase);
  const vid=S.varieties[0]?.id;
  const phase=vid?getPhaseByGdd(vid,gdd):null;

  // Populate log filter
  const sf=document.getElementById('soil-sensor-filter');
  const curSF=sf.value;
  sf.innerHTML='<option value="">Все датчики</option>';
  irr.sensors.forEach(s=>sf.innerHTML+=`<option value="${s.id}" ${curSF===s.id?'selected':''}>${s.name}</option>`);

  // Sensor dashboard cards
  const dash=document.getElementById('sensor-dashboard');
  if(!irr.sensors.length){
    dash.innerHTML=`<div style="grid-column:1/-1;color:var(--text3);text-align:center;padding:30px;font-size:12px;">
      <div style="font-size:32px;margin-bottom:10px;">📡</div>
      <div>Нет датчиков. Нажмите ⚙️ Настройка датчиков чтобы добавить.</div>
    </div>`;
  } else {
    const colors={dry:'var(--red)',low:'var(--yellow)',ok:'var(--accent)',wet:'var(--blue)'};
    dash.innerHTML=irr.sensors.map(s=>{
      const last=getLastReading(s.id);
      const status=last?getSoilStatus(last.value,method):'ok';
      const col=colors[status]||'var(--text)';
      const pct=last?(() => {
        if(method==='percent') return Math.min(100,Math.max(0,(last.value/irr.thresholds.wet)*100));
        // inverted for kPa/cBar
        return Math.min(100,Math.max(0,100-(last.value/irr.thresholds.dry)*100));
      })():0;
      return `<div class="sensor-card ${status}" onclick="openSoilReadingModal()">
        <div class="sc-name">${s.name}</div>
        ${last
          ?`<div class="sc-val" style="color:${col};">${last.value}<span class="sc-unit">${def.unit}</span></div>
            <div class="sc-depth">▼ ${s.depth}см · ${last.date} ${last.time}</div>
            <div class="moisture-bar"><div class="moisture-fill" style="width:${pct}%;background:${col};"></div></div>
            <div class="sc-status ${status}">${getSoilStatusLabel(status,method)}</div>`
          :`<div style="color:var(--text3);font-size:12px;margin-top:10px;">Нет данных</div>`
        }
        <div style="font-size:10px;color:var(--text3);margin-top:6px;">${s.brand||''} · ${s.cellKey||'Весь сад'}</div>
      </div>`;
    }).join('');
  }

  // Overall recommendation banner
  const recEl=document.getElementById('irrig-recommendation');
  let recHtml = '';

  // ETc-based recommendation using Kc from crop definition
  const latestW = S.weather[0];
  if (latestW) {
    const gardenCropIds = [...new Set(Object.values(S.cells).map(cd=>cd?.cropId||'crop_cherry'))];
    const et0 = parseFloat(latestW.et0) || ((parseFloat(latestW.tmax)||25) - (parseFloat(latestW.tmin)||10)) * 0.2; // rough ET0 estimate if not available
    const cropEtcRows = gardenCropIds.map(cid => {
      const crop = getCropById(cid);
      if (!crop) return '';
      // Find current Kc based on GDD phase
      const cellKey = Object.keys(S.cells).find(k=>(S.cells[k].cropId||'crop_cherry')===cid);
      const cropVarieties = S.varieties.filter(v=>(v.cropId||'crop_cherry')===cid);
      const firstVarId = S.cells[cellKey]?.rows?.[0]?.varietyId || cropVarieties[0]?.id;
      const gdd = firstVarId ? getCurrentGdd(crop.baseTemp, firstVarId) : 0;
      const phaseName = getPhaseByGdd(firstVarId, gdd)?.name || '';
      const kc = (() => {
        const k = crop.kc || {};
        if (!phaseName) return k.fruitGrowth || 1.0;
        if (phaseName.includes('Покой')) return k.dormant || 0.5;
        if (phaseName.includes('Цветение')) return k.flowering || 0.75;
        if (phaseName.includes('сбора')) return k.postHarvest || 0.65;
        if (phaseName.includes('Созревание') || phaseName.includes('Налив')) return k.ripening || 0.90;
        return k.fruitGrowth || 1.05;
      })();
      const etc = Math.round(kc * et0 * 10) / 10;
      const gcPct = 70; // assume 70% canopy cover for established orchard
      const etca = Math.round(etc * 0.1 * Math.pow(gcPct, 0.5) * 10) / 10; // drip adjustment
      return `<tr>
        <td style="padding:6px 10px;font-weight:600;">${crop.emoji||'🌱'} ${crop.name}</td>
        <td style="padding:6px 10px;text-align:center;font-family:'Unbounded',sans-serif;font-size:11px;color:var(--text3);">${phaseName||'—'}</td>
        <td style="padding:6px 10px;text-align:center;font-family:'Unbounded',sans-serif;font-size:11px;color:var(--blue);">${kc.toFixed(2)}</td>
        <td style="padding:6px 10px;text-align:center;font-family:'Unbounded',sans-serif;font-size:12px;font-weight:700;color:var(--accent);">${etc} мм</td>
        <td style="padding:6px 10px;text-align:center;font-family:'Unbounded',sans-serif;font-size:11px;color:var(--accent2);">${etca} мм</td>
      </tr>`;
    }).filter(Boolean).join('');

    if (cropEtcRows) {
      recHtml += `<div style="background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.15);border-radius:10px;padding:14px;margin-bottom:12px;">
        <div style="font-size:11px;font-weight:700;color:var(--blue);margin-bottom:8px;">💧 ETc — водопотребность культур · ET₀ ≈ ${et0.toFixed(1)} мм/день (${latestW.date})</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:var(--surface2);">
            <th style="padding:5px 10px;text-align:left;font-size:9px;color:var(--text3);text-transform:uppercase;">Культура</th>
            <th style="padding:5px 10px;text-align:center;font-size:9px;color:var(--text3);text-transform:uppercase;">Фаза</th>
            <th style="padding:5px 10px;text-align:center;font-size:9px;color:var(--blue);text-transform:uppercase;">Kc</th>
            <th style="padding:5px 10px;text-align:center;font-size:9px;color:var(--accent);text-transform:uppercase;">ETc мм/день</th>
            <th style="padding:5px 10px;text-align:center;font-size:9px;color:var(--accent2);text-transform:uppercase;">ETCa капельное</th>
          </tr></thead>
          <tbody>${cropEtcRows}</tbody>
        </table>
        <div style="font-size:10px;color:var(--text3);margin-top:8px;">ETCa = ETc × [0.1 × GC⁰·⁵] · GC=70% покрытия. Источник: Sela, стр.245</div>
      </div>`;
    }
  }

  if(irr.sensors.length && irr.readings.length){
    const lastReadings=irr.sensors.map(s=>({s,r:getLastReading(s.id)})).filter(x=>x.r);
    if(lastReadings.length){
      const worst=lastReadings.reduce((w,x)=>{
        const rankMap={dry:3,low:2,ok:1,wet:0};
        const rs=getSoilStatus(x.r.value,method);
        const ws=getSoilStatus(w.r.value,method);
        return (rankMap[rs]||0)>(rankMap[ws]||0)?x:w;
      });
      const status=getSoilStatus(worst.r.value,method);
      const rec=getIrrigRecommendation(status,phase);
      const bg={critical:'rgba(239,68,68,.08)',watch:'rgba(251,191,36,.08)',ok:'rgba(74,222,128,.08)'}[rec.level];
      const bc={critical:'rgba(239,68,68,.3)',watch:'rgba(251,191,36,.3)',ok:'rgba(74,222,128,.2)'}[rec.level];
      const tc={critical:'var(--red)',watch:'var(--yellow)',ok:'var(--accent)'}[rec.level];
      recHtml+=`<div style="padding:12px 16px;background:${bg};border:1px solid ${bc};border-radius:10px;">
        <div style="font-size:11px;font-weight:700;color:${tc};margin-bottom:4px;">💧 РЕКОМЕНДАЦИЯ ПО ПОЛИВУ${phase?` · ${phase.name}`:''}${phase?' · GDD '+gdd:''}</div>
        <div style="font-size:12px;color:var(--text2);">${rec.text}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">Критический датчик: ${worst.s.name} · ${worst.r.value} ${def.unit} · ▼${worst.s.depth}см</div>
      </div>`;
    }
  }
  recEl.innerHTML = recHtml;

  renderSoilLog();
}

function renderSoilLog() {
  const irr=S.irrigation;
  const method=irr.method;
  const def=IRRIG_DEFAULTS[method]||IRRIG_DEFAULTS.percent;
  const sFilter=document.getElementById('soil-sensor-filter').value;
  const pFilter=parseInt(document.getElementById('soil-period-filter').value)||0;
  const cutoff=pFilter?new Date(Date.now()-pFilter*86400000).toISOString().split('T')[0]:'0';
  let readings=[...irr.readings].filter(r=>{
    if(sFilter&&r.sensorId!==sFilter)return false;
    if(pFilter&&r.date<cutoff)return false;
    return true;
  });
  const body=document.getElementById('soil-log-body');
  if(!readings.length){body.innerHTML=`<tr><td colspan="7" style="color:var(--text3);text-align:center;padding:20px;">Нет данных. Добавьте показания датчиков.</td></tr>`;return;}
  const colors={dry:'var(--red)',low:'var(--yellow)',ok:'var(--accent)',wet:'var(--blue)'};
  body.innerHTML=readings.map(r=>{
    const sensor=irr.sensors.find(s=>s.id===r.sensorId);
    const status=getSoilStatus(r.value,method);
    const col=colors[status]||'var(--text)';
    const rec=getIrrigRecommendation(status,null);
    return`<tr>
      <td style="font-family:'Unbounded',sans-serif;font-size:11px;">${r.date}<br><span style="font-size:10px;color:var(--text3);">${r.time||''}</span></td>
      <td><strong>${sensor?.name||r.sensorId}</strong><div style="font-size:10px;color:var(--text3);">${sensor?.brand||''}</div></td>
      <td style="color:var(--accent2);">▼ ${sensor?.depth||'?'}см</td>
      <td style="font-family:'Unbounded',sans-serif;font-weight:700;color:${col};font-size:14px;">${r.value} <span style="font-size:10px;font-weight:400;">${def.unit}</span></td>
      <td><span style="font-size:10px;padding:3px 8px;border-radius:10px;background:${col}22;color:${col};">${getSoilStatusLabel(status,method)}</span></td>
      <td style="font-size:11px;color:var(--text2);">${rec.text.slice(0,60)}${rec.text.length>60?'...':''}</td>
      <td><button class="btn btn-secondary btn-xs" onclick="openSoilReadingModal('${r.id}')">✏️</button></td>
    </tr>`;
  }).join('');
}
