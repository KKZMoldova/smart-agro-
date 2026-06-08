// Smart Agro — fuel.js (v2: нормы топлива по видам работ для каждого трактора)
// ═══════════════════════════════════════════════════════════════
//  ⛽ ГСМ МОДУЛЬ
// ═══════════════════════════════════════════════════════════════

const FUEL_TYPES = { diesel:'⛽ Дизель', petrol:'🔴 Бензин', adblue:'💙 AdBlue', oil_engine:'🟤 Масло мотор.', oil_hydraulic:'🟡 Масло гидр.' };
const OP_TYPES   = { spray:'🌿 Опрыскивание', plow:'🔵 Пахота', cultivate:'🟡 Культивация', transport:'🚛 Транспорт', other:'⚙️ Прочее' };
const ROAD_COEFF = { asphalt:1.0, mixed:1.15, dirt:1.3 };

let _fuelSubTab = 'tanks';
let _foSelectedCells = new Set(); // выбранные клетки в модале операции
let _editVehicleId = null;
let _editImplementId = null;

function _initFuel() {
  if(!S.fuel) S.fuel = { tanks:[], receipts:[], refuels:[], operations:[], alerts:[] };
  if(!S.vehicles) S.vehicles = [];
  if(!S.implements) S.implements = [];
  // Справочник видов работ (редактируемый). code — для совместимости со старыми типами операций.
  if(!S.workTypes || !S.workTypes.length) {
    S.workTypes = [
      { id:'wt_spray',     name:'Опрыскивание', code:'spray',     emoji:'🌿', deltaPercent:10 },
      { id:'wt_plow',      name:'Пахота',       code:'plow',      emoji:'🔵', deltaPercent:8  },
      { id:'wt_cultivate', name:'Культивация',  code:'cultivate', emoji:'🟡', deltaPercent:12 },
      { id:'wt_transport', name:'Транспорт',    code:'transport', emoji:'🚛', deltaPercent:15 },
      { id:'wt_other',     name:'Прочее',       code:'other',     emoji:'⚙️', deltaPercent:20 },
    ];
  }
}

// Найти вид работ по id ИЛИ по старому code (миграция операций без workTypeId)
function _findWorkType(idOrCode) {
  const list = S.workTypes||[];
  return list.find(w=>w.id===idOrCode) || list.find(w=>w.code===idOrCode) || null;
}
function _workTypeLabel(idOrCode) {
  const w = _findWorkType(idOrCode);
  if(w) return (w.emoji?w.emoji+' ':'')+w.name;
  return OP_TYPES[idOrCode] || idOrCode || '—';
}

// ── Переключение подвкладок ГСМ ──────────────────────────────────────────
function switchFuelTab(tab) {
  _fuelSubTab = tab;
  ['tanks','vehicles','refuels','ops','analytics'].forEach(t => {
    const el  = document.getElementById('fuel-panel-'+t);
    const btn = document.getElementById('fuel-tab-'+t);
    if(el)  el.style.display  = t===tab ? '' : 'none';
    if(btn) btn.classList.toggle('active', t===tab);
  });
  renderFuelTab();
}

function renderFuelTab() {
  _initFuel();
  renderFuelTanks();
  renderFuelVehicles();
  renderFuelRefuels();
  renderFuelOps();
  renderFuelAnalytics();
}

// ── РЕЗЕРВУАРЫ ────────────────────────────────────────────────────────────
function renderFuelTanks() {
  const grid = document.getElementById('fuel-tanks-grid');
  if(!grid) return;
  const tanks = S.fuel.tanks;
  if(!tanks.length) {
    grid.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px;">Резервуары не добавлены. Нажмите «+ Резервуар».</div>';
  } else {
    grid.innerHTML = tanks.map(t => {
      const pct = t.capacityL ? Math.round(t.currentL/t.capacityL*100) : 0;
      const color = pct<20?'var(--red)':pct<40?'var(--orange)':'var(--accent)';
      // Последняя цена из приходов
      const lastReceipt = [...(S.fuel.receipts||[])].filter(r=>r.tankId===t.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
      return `<div class="card" style="border-left:3px solid ${color};cursor:pointer;" onclick="openFuelTankModal('${t.id}')">
        <div style="font-size:13px;font-weight:700;">${t.name}</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:8px;">${FUEL_TYPES[t.fuelType]||t.fuelType} · ${t.location||''}</div>
        <div style="background:var(--surface2);border-radius:4px;height:8px;margin-bottom:6px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .3s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;">
          <span style="font-weight:700;color:${color};">${(t.currentL||0).toFixed(0)} л</span>
          <span style="color:var(--text3);">${pct}% из ${t.capacityL||0} л</span>
        </div>
        ${lastReceipt?`<div style="font-size:10px;color:var(--text3);margin-top:4px;">Цена: ${lastReceipt.pricePerL} MDL/л · ${lastReceipt.date}</div>`:''}
      </div>`;
    }).join('');
  }
  // Таблица приходов
  const tbl = document.getElementById('fuel-receipts-table');
  if(!tbl) return;
  const receipts = (S.fuel.receipts||[]).slice(0,20);
  if(!receipts.length) { tbl.innerHTML = ''; return; }
  tbl.innerHTML = `<div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin:12px 0 6px;">История приходов топлива</div>
  <table class="data-table"><thead><tr>
    <th>Дата</th><th>Резервуар</th><th>Топливо</th><th>Объём (л)</th>
    <th>Цена без НДС</th><th>НДС%</th><th>Цена с НДС</th><th>Сумма с НДС</th><th>Поставщик</th><th>Накладная</th>
  </tr></thead><tbody>${receipts.map(r=>{
    const tank = S.fuel.tanks.find(t=>t.id===r.tankId);
    return `<tr>
      <td style="font-family:monospace;font-size:11px;">${r.date}</td>
      <td>${tank?.name||'—'}</td>
      <td>${FUEL_TYPES[r.fuelType]||r.fuelType}</td>
      <td style="font-weight:600;">${r.volumeL} л</td>
      <td>${r.pricePerL?.toFixed(2)||'—'} ${r.currency||'MDL'}</td>
      <td style="text-align:center;">${r.vatRate||0}%</td>
      <td>${r.pricePerLWithVat?.toFixed(2)||'—'}</td>
      <td style="font-weight:600;color:var(--accent);">${r.totalWithVat?.toFixed(2)||'—'}</td>
      <td style="font-size:11px;color:var(--text3);">${r.supplier||'—'}</td>
      <td style="font-size:10px;color:var(--text3);">${r.invoiceNo||'—'}</td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

// ── ТЕХНИКА ───────────────────────────────────────────────────────────────
function renderFuelVehicles() {
  const tbl = document.getElementById('fuel-vehicles-table');
  if(!tbl) return;
  const vehicles = S.vehicles||[];
  if(!vehicles.length) {
    tbl.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px;">Техника не добавлена. Нажмите «+ Техника».</div>';
  } else {
    tbl.innerHTML = `<table class="data-table"><thead><tr>
      <th>Название</th><th>Тип</th><th>Номер</th><th>Топливо</th>
      <th>Норма поле (л/га)</th><th>Норма дорога (л/км)</th><th>Бак (л)</th><th>Оператор</th><th></th>
    </tr></thead><tbody>${vehicles.map(v=>`<tr>
      <td style="font-weight:600;">${v.name}</td>
      <td style="font-size:11px;">${{tractor:'🚜 Трактор',sprayer:'💦 Опрыскиватель',truck:'🚛 Грузовик',combine:'🌾 Комбайн',other:'⚙️ Прочее'}[v.type]||v.type}</td>
      <td style="font-size:11px;font-family:monospace;">${v.regNo||'—'}</td>
      <td style="font-size:11px;">${FUEL_TYPES[v.fuelType]||v.fuelType}</td>
      <td style="text-align:center;">${v.fuelNormField||'—'}</td>
      <td style="text-align:center;">${v.fuelNormRoad||'—'}</td>
      <td style="text-align:center;">${v.tankCapacityL||'—'}</td>
      <td style="font-size:11px;color:var(--text3);">${v.operator||'—'}</td>
      <td><button class="btn btn-secondary btn-xs" onclick="openVehicleModal('${v.id}')">✏️</button></td>
    </tr>`).join('')}</tbody></table>`;
  }
  // Навесное
  const itbl = document.getElementById('fuel-implements-table');
  if(!itbl) return;
  const imps = S.implements||[];
  if(!imps.length) { itbl.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px;">Навесное не добавлено.</div>'; return; }
  itbl.innerHTML = `<table class="data-table"><thead><tr>
    <th>Название</th><th>Тип</th><th>Коэф. нагрузки</th><th>Захват (м)</th><th>Бак (л)</th><th></th>
  </tr></thead><tbody>${imps.map(i=>`<tr>
    <td style="font-weight:600;">${i.name}</td>
    <td style="font-size:11px;">${{sprayer:'💦 Опрыскиватель',plow:'🔵 Плуг',cultivator:'🟡 Культиватор',disk:'⚫ Дискатор',seeder:'🌱 Сеялка',other:'⚙️ Другое'}[i.type]||i.type}</td>
    <td style="text-align:center;font-weight:600;color:var(--accent2);">× ${i.fuelCoeff||1.0}</td>
    <td style="text-align:center;">${i.workingWidthM||'—'} м</td>
    <td style="text-align:center;">${i.tankCapacity||'—'}</td>
    <td><button class="btn btn-secondary btn-xs" onclick="openImplementModal('${i.id}')">✏️</button></td>
  </tr>`).join('')}</tbody></table>`;
}

// ── ЗАПРАВКИ ──────────────────────────────────────────────────────────────
function renderFuelRefuels() {
  const tbl = document.getElementById('fuel-refuels-table');
  if(!tbl) return;
  const refuels = (S.fuel.refuels||[]).slice(0,30);
  if(!refuels.length) {
    tbl.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px;">Заправок нет.</div>'; return;
  }
  tbl.innerHTML = `<table class="data-table"><thead><tr>
    <th>Дата / Время</th><th>Техника</th><th>Резервуар</th><th>Объём (л)</th><th>Оператор</th><th>Бак до/после</th><th>Источник</th>
  </tr></thead><tbody>${refuels.map(r=>{
    const v = S.vehicles?.find(x=>x.id===r.vehicleId);
    const t = S.fuel.tanks?.find(x=>x.id===r.tankId);
    return `<tr>
      <td style="font-family:monospace;font-size:11px;">${r.date} ${r.time||''}</td>
      <td style="font-weight:600;">${v?.name||'—'}</td>
      <td style="font-size:11px;">${t?.name||'—'}</td>
      <td style="font-weight:600;color:var(--blue);">${r.volumeL} л</td>
      <td style="font-size:11px;color:var(--text3);">${r.operator||'—'}</td>
      <td style="font-size:11px;">${r.tankLevelBefore!=null?r.tankLevelBefore+'%':'—'} → ${r.tankLevelAfter!=null?r.tankLevelAfter+'%':'—'}</td>
      <td><span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${r.source==='sensor'?'rgba(74,222,128,.1)':'rgba(148,163,184,.1)'};">${r.source==='sensor'?'📡 Датчик':'✍️ Вручную'}</span></td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

// ── ОПЕРАЦИИ ──────────────────────────────────────────────────────────────
function renderFuelOps() {
  const tbl = document.getElementById('fuel-ops-table');
  if(!tbl) return;
  const ops = (S.fuel.operations||[]).slice(0,30);
  if(!ops.length) {
    tbl.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px;">Операций нет. Нажмите «+ Операция».</div>';
  } else {
    tbl.innerHTML = `<table class="data-table"><thead><tr>
      <th>Дата</th><th>Тип</th><th>Техника</th><th>Участки</th><th>га</th>
      <th>Переезд (л)</th><th>Поле (л)</th><th>План (л)</th><th>Факт (л)</th><th>Δ%</th><th>Стоимость</th>
    </tr></thead><tbody>${ops.map(op=>{
      const v = S.vehicles?.find(x=>x.id===op.vehicleId);
      const deltaColor = !op.fuelFactTotal?'var(--text3)':op.deltaPercent>0?'var(--red)':'var(--accent)';
      const limit = _getFuelDeltaLimit(op.vehicleId, op.operationType);
      const overLimit = op.deltaPercent && Math.abs(op.deltaPercent) > limit;
      return `<tr style="${overLimit?'background:rgba(220,38,38,.04);':''}">
        <td style="font-family:monospace;font-size:11px;">${op.date}</td>
        <td style="font-size:11px;">${_workTypeLabel(op.operationType)}</td>
        <td style="font-weight:600;">${v?.name||'—'}</td>
        <td style="font-size:10px;color:var(--text3);">${(op.cellKeys||[]).join(', ')}</td>
        <td style="text-align:center;">${(op.areaHa||0).toFixed(2)}</td>
        <td style="text-align:center;font-size:11px;">${(op.fuelTransit||0).toFixed(1)}</td>
        <td style="text-align:center;font-size:11px;">${(op.fuelField||0).toFixed(1)}</td>
        <td style="font-weight:600;">${(op.fuelPlanTotal||0).toFixed(1)} л</td>
        <td style="font-weight:600;color:var(--blue);">${op.fuelFactTotal?(op.fuelFactTotal.toFixed(1)+' л'):'—'}</td>
        <td style="font-weight:600;color:${deltaColor};">${op.deltaPercent!=null?(op.deltaPercent>0?'+':'')+op.deltaPercent.toFixed(1)+'%':'—'}${overLimit?' ⚠️':''}</td>
        <td style="font-size:11px;color:var(--accent);">${op.costTotal?op.costTotal.toFixed(0)+' MDL':'—'}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
  }
  // Алерты
  const alertsBlock = document.getElementById('fuel-alerts-block');
  if(alertsBlock) {
    const unresolved = (S.fuel.alerts||[]).filter(a=>!a.resolved);
    alertsBlock.innerHTML = unresolved.length ? `
      <div style="font-size:11px;color:var(--red);font-weight:600;margin-bottom:8px;">⚠️ Превышение дельты расхода (${unresolved.length})</div>
      ${unresolved.map(a=>`<div style="padding:10px 12px;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:8px;margin-bottom:6px;font-size:11px;">
        <div style="font-weight:600;">${a.vehicleName} — ${_workTypeLabel(a.operationType)} · ${a.date}</div>
        <div style="color:var(--text3);">Участки: ${(a.cellKeys||[]).join(', ')} · План: ${a.fuelPlan?.toFixed(1)} л · Факт: ${a.fuelFact?.toFixed(1)} л · Δ: +${a.deltaPercent?.toFixed(1)}% (лимит ${a.limit}%)</div>
        <div style="margin-top:6px;display:flex;gap:8px;">
          <button class="btn btn-secondary btn-xs" onclick="resolveFuelAlert('${a.id}')">✅ Принять к сведению</button>
          <button class="btn btn-secondary btn-xs" onclick="explainFuelAlert('${a.id}')">📝 Объяснить</button>
        </div>
      </div>`).join('')}` : '';
  }
}

// ── АНАЛИТИКА ─────────────────────────────────────────────────────────────
function renderFuelAnalytics() {
  const el = document.getElementById('fuel-analytics-content');
  if(!el) return;
  _initFuel();
  // Расход по участкам
  const byCell = {};
  (S.fuel.operations||[]).forEach(op=>{
    (op.distribution||[]).forEach(d=>{
      if(!byCell[d.cellKey]) byCell[d.cellKey] = {transit:0, field:0, cost:0, ha:0, ops:0};
      byCell[d.cellKey].transit += d.fuelTransit||0;
      byCell[d.cellKey].field   += d.fuelField||0;
      byCell[d.cellKey].cost    += d.cost||0;
      byCell[d.cellKey].ha       = d.areaHa||0;
      byCell[d.cellKey].ops++;
    });
  });
  const cellRows = Object.entries(byCell).map(([key,d])=>`<tr>
    <td style="font-weight:600;">${key}</td>
    <td style="text-align:center;">${d.ha.toFixed(2)}</td>
    <td style="text-align:center;">${d.transit.toFixed(1)}</td>
    <td style="text-align:center;">${d.field.toFixed(1)}</td>
    <td style="font-weight:600;text-align:center;">${(d.transit+d.field).toFixed(1)}</td>
    <td style="color:var(--accent);font-weight:600;text-align:center;">${d.cost.toFixed(0)}</td>
    <td style="text-align:center;">${d.ha>0?(d.cost/d.ha).toFixed(0):'—'}</td>
    <td style="text-align:center;color:var(--text3);">${d.ops}</td>
  </tr>`).join('');
  // Баланс резервуара
  const totalIn  = (S.fuel.receipts||[]).reduce((s,r)=>s+(r.volumeL||0),0);
  const totalOut = (S.fuel.refuels||[]).reduce((s,r)=>s+(r.volumeL||0),0);
  const inTanks  = (S.fuel.tanks||[]).reduce((s,t)=>s+(t.currentL||0),0);
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
      <div class="card" style="text-align:center;">
        <div style="font-size:22px;font-weight:700;color:var(--accent);">${totalIn.toFixed(0)} л</div>
        <div style="font-size:11px;color:var(--text3);">Всего получено</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:22px;font-weight:700;color:var(--blue);">${totalOut.toFixed(0)} л</div>
        <div style="font-size:11px;color:var(--text3);">Заправлено техники</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:22px;font-weight:700;color:var(--yellow);">${inTanks.toFixed(0)} л</div>
        <div style="font-size:11px;color:var(--text3);">В резервуарах сейчас</div>
      </div>
    </div>
    ${cellRows?`<div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Расход по участкам</div>
    <table class="data-table"><thead><tr>
      <th>Участок</th><th>га</th><th>Переезд (л)</th><th>Поле (л)</th><th>Итого (л)</th><th>MDL</th><th>MDL/га</th><th>Операций</th>
    </tr></thead><tbody>${cellRows}</tbody></table>`:'<div style="color:var(--text3);font-size:12px;padding:12px;">Добавьте операции для аналитики.</div>'}`;
}

// ── МОДАЛЫ — ОТКРЫТИЕ ─────────────────────────────────────────────────────
function openFuelTankModal(id) {
  _initFuel();
  const tank = id ? S.fuel.tanks.find(t=>t.id===id) : null;
  document.getElementById('fuel-tank-title').textContent = tank ? '✏️ Резервуар' : '🛢 Новый резервуар';
  document.getElementById('ft-name').value = tank?.name||'';
  document.getElementById('ft-fuel-type').value = tank?.fuelType||'diesel';
  document.getElementById('ft-capacity').value = tank?.capacityL||'';
  document.getElementById('ft-current').value = tank?.currentL||'';
  document.getElementById('ft-sensor-id').value = tank?.sensorId||'';
  document.getElementById('ft-location').value = tank?.location||'Тракторная бригада';
  document.getElementById('ft-note').value = tank?.note||'';
  document.getElementById('ft-name').dataset.editId = id||'';
  openModal('modal-fuel-tank');
}

function saveFuelTank() {
  _initFuel();
  const editId = document.getElementById('ft-name').dataset.editId;
  const name = document.getElementById('ft-name').value.trim();
  if(!name){alert('Введите название'); return;}
  const obj = {
    id: editId || uid(),
    name,
    fuelType: document.getElementById('ft-fuel-type').value,
    capacityL: parseFloat(document.getElementById('ft-capacity').value)||0,
    currentL:  parseFloat(document.getElementById('ft-current').value)||0,
    sensorId:  document.getElementById('ft-sensor-id').value.trim(),
    location:  document.getElementById('ft-location').value.trim(),
    note:      document.getElementById('ft-note').value.trim(),
  };
  if(editId) {
    const idx = S.fuel.tanks.findIndex(t=>t.id===editId);
    if(idx>=0) S.fuel.tanks[idx] = obj;
  } else {
    S.fuel.tanks.push(obj);
  }
  save(); closeModal('modal-fuel-tank'); renderFuelTanks();
}

function openFuelReceiptModal() {
  _initFuel();
  document.getElementById('fr-date').value = today();
  document.getElementById('fr-volume').value = '';
  document.getElementById('fr-price').value = '';
  document.getElementById('fr-price-vat').value = '';
  document.getElementById('fr-total-ex').textContent = '—';
  document.getElementById('fr-total-inc').textContent = '—';
  document.getElementById('fr-supplier').value = '';
  document.getElementById('fr-invoice').value = '';
  document.getElementById('fr-note').value = '';
  // Заполняем список резервуаров
  const sel = document.getElementById('fr-tank');
  sel.innerHTML = S.fuel.tanks.map(t=>`<option value="${t.id}">${t.name} — ${FUEL_TYPES[t.fuelType]||t.fuelType}</option>`).join('');
  openModal('modal-fuel-receipt');
}

function frCalcTotals() {
  const vol  = parseFloat(document.getElementById('fr-volume').value)||0;
  const px   = parseFloat(document.getElementById('fr-price').value)||0;
  const vat  = parseFloat(document.getElementById('fr-vat').value)||0;
  const pxV  = Math.round(px*(1+vat/100)*100)/100;
  document.getElementById('fr-price-vat').value = px>0 ? pxV : '';
  document.getElementById('fr-total-ex').textContent  = vol&&px ? (vol*px).toFixed(2)+' MDL' : '—';
  document.getElementById('fr-total-inc').textContent = vol&&px ? (vol*pxV).toFixed(2)+' MDL' : '—';
}
function frCalcTotalsReverse() {
  const vol  = parseFloat(document.getElementById('fr-volume').value)||0;
  const pxV  = parseFloat(document.getElementById('fr-price-vat').value)||0;
  const vat  = parseFloat(document.getElementById('fr-vat').value)||0;
  const px   = Math.round(pxV/(1+vat/100)*100)/100;
  document.getElementById('fr-price').value = pxV>0 ? px : '';
  document.getElementById('fr-total-ex').textContent  = vol&&px ? (vol*px).toFixed(2)+' MDL' : '—';
  document.getElementById('fr-total-inc').textContent = vol&&pxV ? (vol*pxV).toFixed(2)+' MDL' : '—';
}

function saveFuelReceipt() {
  _initFuel();
  const tankId  = document.getElementById('fr-tank').value;
  const volumeL = parseFloat(document.getElementById('fr-volume').value)||0;
  const pricePerL = parseFloat(document.getElementById('fr-price').value)||0;
  const vatRate = parseFloat(document.getElementById('fr-vat').value)||0;
  if(!tankId){alert('Выберите резервуар');return;}
  if(!volumeL){alert('Введите объём');return;}
  const pricePerLWithVat = Math.round(pricePerL*(1+vatRate/100)*100)/100;
  const rec = {
    id: uid(),
    date: document.getElementById('fr-date').value,
    tankId, fuelType: S.fuel.tanks.find(t=>t.id===tankId)?.fuelType||'diesel',
    volumeL, pricePerL, vatRate, pricePerLWithVat,
    totalWithoutVat: Math.round(volumeL*pricePerL*100)/100,
    totalWithVat:    Math.round(volumeL*pricePerLWithVat*100)/100,
    currency: document.getElementById('fr-currency').value,
    supplier: document.getElementById('fr-supplier').value.trim(),
    invoiceNo: document.getElementById('fr-invoice').value.trim(),
    payment: document.getElementById('fr-payment').value,
    note: document.getElementById('fr-note').value.trim(),
  };
  S.fuel.receipts.unshift(rec);
  // Пополняем резервуар
  const tank = S.fuel.tanks.find(t=>t.id===tankId);
  if(tank) tank.currentL = Math.min((tank.currentL||0)+volumeL, tank.capacityL||999999);
  save(); closeModal('modal-fuel-receipt'); renderFuelTanks();
}

function openVehicleModal(id) {
  _editVehicleId = id||null;
  _initFuel();
  const v = id ? S.vehicles.find(x=>x.id===id) : null;
  document.getElementById('fuel-vehicle-title').textContent = v?`✏️ ${v.name}`:'🚜 Новая техника';
  document.getElementById('fv-del-btn').style.display = v?'inline-flex':'none';
  document.getElementById('fv-name').value = v?.name||'';
  document.getElementById('fv-type').value = v?.type||'tractor';
  document.getElementById('fv-reg').value  = v?.regNo||'';
  document.getElementById('fv-year').value = v?.year||'';
  document.getElementById('fv-fuel-type').value = v?.fuelType||'diesel';
  document.getElementById('fv-tank-cap').value   = v?.tankCapacityL||'';
  document.getElementById('fv-norm-field').value = v?.fuelNormField||'';
  document.getElementById('fv-norm-road').value  = v?.fuelNormRoad||'';
  // Динамические нормы по видам работ
  renderVehicleWorkNorms(v);
  document.getElementById('fv-norm-hour').value  = v?.fuelNormHour||'';
  document.getElementById('fv-moto-hours').value = v?.motoHours||'';
  document.getElementById('fv-gps-id').value     = v?.gpsDeviceId||'';
  document.getElementById('fv-sensor-id').value  = v?.fuelSensorId||'';
  document.getElementById('fv-operator').value   = v?.operator||'';
  document.getElementById('fv-note').value       = v?.note||'';
  // Дельты
  const dl = v?.fuelDeltaLimits||[];
  const getD = (t,def) => dl.find(x=>x.operationType===t)?.deltaPercent||def;
  document.getElementById('fv-delta-spray').value     = getD('spray',10);
  document.getElementById('fv-delta-plow').value      = getD('plow',8);
  document.getElementById('fv-delta-cultivate').value = getD('cultivate',12);
  document.getElementById('fv-delta-transport').value = getD('transport',15);
  document.getElementById('fv-delta-other').value     = getD('other',20);
  openModal('modal-fuel-vehicle');
}

function renderVehicleWorkNorms(v) {
  const wrap = document.getElementById('fv-work-norms');
  if(!wrap) return;
  _initFuel();
  const list = S.workTypes||[];
  const norms = (v && v.fuelNormByWork) || {};
  // fallback: старая единая норма поля → подставим в первый вид работ, если новых нет
  const legacy = v?.fuelNormField||0;
  wrap.innerHTML = list.map((w,i)=>{
    let val = norms[w.id];
    if((val===undefined || val===null || val==='') && legacy && i===0 && Object.keys(norms).length===0) val = legacy;
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface2);border-radius:6px;">
      <span style="flex:1;font-size:12px;">${w.emoji?w.emoji+' ':''}${w.name}</span>
      <input type="number" step="0.1" min="0" id="fv-wn-${w.id}" value="${val||''}" placeholder="л/га"
        style="width:90px;padding:5px 8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);text-align:right;">
      <span style="font-size:10px;color:var(--text3);">л/га</span>
    </div>`;
  }).join('') || '<div style="color:var(--text3);font-size:11px;">Сначала добавьте виды работ в справочнике.</div>';
}

function saveFuelVehicle() {
  if(!S.vehicles) S.vehicles=[];
  _initFuel();
  const name = document.getElementById('fv-name').value.trim();
  if(!name){alert('Введите название');return;}
  // Собираем нормы по видам работ из динамических полей
  const fuelNormByWork = {};
  (S.workTypes||[]).forEach(w=>{
    const inp = document.getElementById('fv-wn-'+w.id);
    const val = inp ? parseFloat(inp.value) : NaN;
    if(!isNaN(val) && val>0) fuelNormByWork[w.id] = val;
  });
  const obj = {
    id: _editVehicleId||uid(),
    name,
    type: document.getElementById('fv-type').value,
    regNo: document.getElementById('fv-reg').value.trim(),
    year: parseInt(document.getElementById('fv-year').value)||null,
    fuelType: document.getElementById('fv-fuel-type').value,
    tankCapacityL: parseFloat(document.getElementById('fv-tank-cap').value)||0,
    fuelNormField: parseFloat(document.getElementById('fv-norm-field').value)||0,
    fuelNormByWork,
    fuelNormRoad:  parseFloat(document.getElementById('fv-norm-road').value)||0,
    fuelNormHour:  parseFloat(document.getElementById('fv-norm-hour').value)||0,
    motoHours: parseFloat(document.getElementById('fv-moto-hours').value)||0,
    gpsDeviceId:  document.getElementById('fv-gps-id').value.trim(),
    fuelSensorId: document.getElementById('fv-sensor-id').value.trim(),
    operator: document.getElementById('fv-operator').value.trim(),
    note: document.getElementById('fv-note').value.trim(),
    fuelDeltaLimits: [
      {operationType:'spray',      deltaPercent: parseFloat(document.getElementById('fv-delta-spray').value)||10},
      {operationType:'plow',       deltaPercent: parseFloat(document.getElementById('fv-delta-plow').value)||8},
      {operationType:'cultivate',  deltaPercent: parseFloat(document.getElementById('fv-delta-cultivate').value)||12},
      {operationType:'transport',  deltaPercent: parseFloat(document.getElementById('fv-delta-transport').value)||15},
      {operationType:'other',      deltaPercent: parseFloat(document.getElementById('fv-delta-other').value)||20},
    ],
  };
  if(_editVehicleId) {
    const idx = S.vehicles.findIndex(x=>x.id===_editVehicleId);
    if(idx>=0) S.vehicles[idx]=obj; else S.vehicles.push(obj);
  } else { S.vehicles.push(obj); }
  save(); closeModal('modal-fuel-vehicle'); renderFuelVehicles();
}

function deleteFuelVehicle() {
  if(!_editVehicleId) return;
  if(!confirm('Удалить технику?')) return;
  S.vehicles = (S.vehicles||[]).filter(x=>x.id!==_editVehicleId);
  save(); closeModal('modal-fuel-vehicle'); renderFuelVehicles();
}

function openImplementModal(id) {
  _editImplementId = id||null;
  if(!S.implements) S.implements=[];
  const imp = id ? S.implements.find(x=>x.id===id) : null;
  document.getElementById('implement-title').textContent = imp?`✏️ ${imp.name}`:'⚙️ Навесное оборудование';
  document.getElementById('imp-del-btn').style.display = imp?'inline-flex':'none';
  document.getElementById('imp-name').value  = imp?.name||'';
  document.getElementById('imp-type').value  = imp?.type||'sprayer';
  document.getElementById('imp-coeff').value = imp?.fuelCoeff||1.1;
  document.getElementById('imp-width').value = imp?.workingWidthM||'';
  document.getElementById('imp-tank').value  = imp?.tankCapacity||'';
  document.getElementById('imp-note').value  = imp?.note||'';
  openModal('modal-implement');
}

function saveImplement() {
  if(!S.implements) S.implements=[];
  const name = document.getElementById('imp-name').value.trim();
  if(!name){alert('Введите название');return;}
  const obj = {
    id: _editImplementId||uid(),
    name,
    type: document.getElementById('imp-type').value,
    fuelCoeff: parseFloat(document.getElementById('imp-coeff').value)||1.0,
    workingWidthM: parseFloat(document.getElementById('imp-width').value)||0,
    tankCapacity:  parseFloat(document.getElementById('imp-tank').value)||0,
    note: document.getElementById('imp-note').value.trim(),
  };
  if(_editImplementId) {
    const idx = S.implements.findIndex(x=>x.id===_editImplementId);
    if(idx>=0) S.implements[idx]=obj; else S.implements.push(obj);
  } else { S.implements.push(obj); }
  save(); closeModal('modal-implement'); renderFuelVehicles();
}

function deleteImplement() {
  if(!_editImplementId) return;
  if(!confirm('Удалить навесное?')) return;
  S.implements = (S.implements||[]).filter(x=>x.id!==_editImplementId);
  save(); closeModal('modal-implement'); renderFuelVehicles();
}

// ── СПРАВОЧНИК ВИДОВ РАБОТ ────────────────────────────────────────────────
let _editWorkTypeId = null;

function renderWorkTypes() {
  _initFuel();
  const tbl = document.getElementById('worktypes-table');
  if(!tbl) return;
  const list = S.workTypes||[];
  if(!list.length) {
    tbl.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px;">Виды работ не добавлены.</div>';
    return;
  }
  tbl.innerHTML = `<table class="data-table"><thead><tr>
    <th>Вид работ</th><th>Допуск откл. (%)</th><th></th>
  </tr></thead><tbody>${list.map(w=>`<tr>
    <td style="font-weight:600;">${w.emoji?w.emoji+' ':''}${w.name}</td>
    <td style="text-align:center;">±${w.deltaPercent||15}%</td>
    <td><button class="btn btn-secondary btn-xs" onclick="openWorkTypeModal('${w.id}')">✏️</button></td>
  </tr>`).join('')}</tbody></table>`;
}

function openWorkTypeModal(id) {
  _initFuel();
  _editWorkTypeId = id||null;
  const w = id ? (S.workTypes||[]).find(x=>x.id===id) : null;
  document.getElementById('wt-modal-title').textContent = w?`✏️ ${w.name}`:'🌾 Новый вид работ';
  document.getElementById('wt-name').value  = w?.name||'';
  document.getElementById('wt-emoji').value = w?.emoji||'';
  document.getElementById('wt-delta').value = w?.deltaPercent ?? 15;
  document.getElementById('wt-del-btn').style.display = w?'inline-flex':'none';
  openModal('modal-worktype');
}

function saveWorkType() {
  _initFuel();
  const name = document.getElementById('wt-name').value.trim();
  if(!name){alert('Введите название вида работ');return;}
  const obj = {
    id: _editWorkTypeId || ('wt_'+Date.now()),
    name,
    emoji: document.getElementById('wt-emoji').value.trim(),
    code: _editWorkTypeId ? (_findWorkType(_editWorkTypeId)?.code||'') : '',
    deltaPercent: parseFloat(document.getElementById('wt-delta').value)||15,
  };
  if(_editWorkTypeId) {
    const idx = S.workTypes.findIndex(x=>x.id===_editWorkTypeId);
    if(idx>=0) S.workTypes[idx] = { ...S.workTypes[idx], ...obj };
  } else {
    S.workTypes.push(obj);
  }
  save();
  closeModal('modal-worktype');
  renderWorkTypes();
  renderFuelVehicles();
}

function deleteWorkType() {
  if(!_editWorkTypeId) return;
  if(!confirm('Удалить вид работ? Нормы тракторов по нему сохранятся, но не будут использоваться.')) return;
  S.workTypes = (S.workTypes||[]).filter(x=>x.id!==_editWorkTypeId);
  save();
  closeModal('modal-worktype');
  renderWorkTypes();
  renderFuelVehicles();
}

function openRefuelModal() {
  _initFuel();
  document.getElementById('rf-date').value = today();
  document.getElementById('rf-time').value = '07:00';
  document.getElementById('rf-volume').value = '';
  document.getElementById('rf-operator').value = '';
  document.getElementById('rf-level-before').value = '';
  document.getElementById('rf-level-after-display').textContent = 'авторасчёт';
  document.getElementById('rf-note').value = '';
  const vSel = document.getElementById('rf-vehicle');
  vSel.innerHTML = (S.vehicles||[]).map(v=>`<option value="${v.id}">${v.name}</option>`).join('');
  const tSel = document.getElementById('rf-tank');
  tSel.innerHTML = (S.fuel.tanks||[]).map(t=>`<option value="${t.id}">${t.name} (${(t.currentL||0).toFixed(0)}л)</option>`).join('');
  openModal('modal-refuel');
}

function rfCalcBalance() {
  const vol = parseFloat(document.getElementById('rf-volume').value)||0;
  const before = parseFloat(document.getElementById('rf-level-before').value)||0;
  const vId = document.getElementById('rf-vehicle').value;
  const v = S.vehicles?.find(x=>x.id===vId);
  if(v?.tankCapacityL && vol) {
    const afterL = Math.min((before/100*v.tankCapacityL)+vol, v.tankCapacityL);
    const afterPct = Math.round(afterL/v.tankCapacityL*100);
    document.getElementById('rf-level-after-display').textContent = `${afterPct}% (${afterL.toFixed(0)} л)`;
  }
}

function saveRefuel() {
  _initFuel();
  const vehicleId = document.getElementById('rf-vehicle').value;
  const tankId    = document.getElementById('rf-tank').value;
  const volumeL   = parseFloat(document.getElementById('rf-volume').value)||0;
  if(!vehicleId||!tankId){alert('Выберите технику и резервуар');return;}
  if(!volumeL){alert('Введите объём заправки');return;}
  const tankLevelBefore = parseFloat(document.getElementById('rf-level-before').value)||null;
  const v = S.vehicles?.find(x=>x.id===vehicleId);
  let tankLevelAfter = null;
  if(tankLevelBefore!=null && v?.tankCapacityL) {
    const afterL = Math.min((tankLevelBefore/100*v.tankCapacityL)+volumeL, v.tankCapacityL);
    tankLevelAfter = Math.round(afterL/v.tankCapacityL*100);
  }
  S.fuel.refuels.unshift({
    id:uid(), date:document.getElementById('rf-date').value, time:document.getElementById('rf-time').value,
    tankId, vehicleId, volumeL,
    operator: document.getElementById('rf-operator').value.trim(),
    tankLevelBefore, tankLevelAfter,
    levelBefore: S.fuel.tanks.find(t=>t.id===tankId)?.currentL||null,
    source:'manual', note:document.getElementById('rf-note').value.trim(),
  });
  // Списываем из резервуара
  const tank = S.fuel.tanks.find(t=>t.id===tankId);
  if(tank) tank.currentL = Math.max((tank.currentL||0)-volumeL, 0);
  save(); closeModal('modal-refuel'); renderFuelRefuels(); renderFuelTanks();
}

// ── МОДАЛ ОПЕРАЦИИ ────────────────────────────────────────────────────────
function openFuelOpModal() {
  _initFuel();
  _foSelectedCells = new Set();
  document.getElementById('fo-date').value = today();
  document.getElementById('fo-passes').value = 1;
  document.getElementById('fo-fact').value = '';
  document.getElementById('fo-operator').value = '';
  document.getElementById('fo-inter-km').value = 0;
  document.getElementById('fo-note').value = '';
  document.getElementById('fo-delta-display').textContent = '—';
  document.getElementById('fo-calc-details').innerHTML = 'Выберите технику и участки для расчёта';
  document.getElementById('fo-distribution-block').style.display = 'none';
  // Виды работ из справочника
  const otSel = document.getElementById('fo-op-type');
  if(otSel) otSel.innerHTML = (S.workTypes||[]).map(w=>`<option value="${w.id}">${w.emoji?w.emoji+' ':''}${w.name}</option>`).join('');
  // Техника
  const vSel = document.getElementById('fo-vehicle');
  vSel.innerHTML = '<option value="">— выбрать —</option>'+(S.vehicles||[]).map(v=>`<option value="${v.id}">${v.name}</option>`).join('');
  // Навесное
  const iSel = document.getElementById('fo-implement');
  iSel.innerHTML = '<option value="">— без навесного —</option>'+(S.implements||[]).map(i=>`<option value="${i.id}">${i.name} (×${i.fuelCoeff})</option>`).join('');
  // Участки
  foRenderCells();
  openModal('modal-fuel-op');
}

function foRenderCells() {
  const el = document.getElementById('fo-cells-list');
  if(!el) return;
  const cells = Object.entries(S.cells||{});
  if(!cells.length){el.innerHTML='<div style="color:var(--text3);font-size:11px;">Участки не добавлены на карте</div>';return;}
  el.innerHTML = cells.map(([key,cd])=>{
    const ha = (calcCellTotals(cd).totalHa||0).toFixed(2);
    const cropName = (S.crops||[]).find(c=>c.id===cd.cropId)?.name||cd.cropId||'';
    const sel = _foSelectedCells.has(key);
    return `<button onclick="foToggleCell('${key}')" id="fo-cell-btn-${key}"
      style="padding:6px 10px;border-radius:8px;border:1px solid ${sel?'var(--accent)':'var(--border)'};
      background:${sel?'rgba(74,222,128,.1)':'var(--surface2)'};
      color:${sel?'var(--accent)':'var(--text2)'};cursor:pointer;font-size:11px;text-align:left;">
      <div style="font-weight:600;">${key}</div>
      <div style="font-size:10px;color:var(--text3);">${ha}га · ${cropName}</div>
    </button>`;
  }).join('');
}

function foToggleCell(key) {
  if(_foSelectedCells.has(key)) _foSelectedCells.delete(key); else _foSelectedCells.add(key);
  const btn = document.getElementById(`fo-cell-btn-${key}`);
  if(btn) {
    const sel = _foSelectedCells.has(key);
    btn.style.borderColor = sel?'var(--accent)':'var(--border)';
    btn.style.background  = sel?'rgba(74,222,128,.1)':'var(--surface2)';
    btn.style.color       = sel?'var(--accent)':'var(--text2)';
  }
  // Обновляем маршруты из первого выбранного участка
  foUpdateRoutes();
  foRecalc();
}

function foUpdateRoutes() {
  const sel = document.getElementById('fo-route');
  if(!sel) return;
  const firstKey = [..._foSelectedCells][0];
  const cd = firstKey ? S.cells[firstKey] : null;
  const routes = cd?.routes||[];
  sel.innerHTML = routes.length
    ? routes.map(r=>`<option value="${r.id}">${r.name} — ${r.distanceKm} км (${r.roadType==='asphalt'?'асфальт':r.roadType==='dirt'?'грунт':'смешанная'})</option>`).join('')
    : '<option value="">— маршруты не настроены для участка —</option>';
}

function foOnVehicleSelect() {
  const vId = document.getElementById('fo-vehicle').value;
  const v = S.vehicles?.find(x=>x.id===vId);
  if(v?.operator) document.getElementById('fo-operator').value = v.operator;
  foRecalc();
}

function foRecalc() {
  const vId     = document.getElementById('fo-vehicle').value;
  const impId   = document.getElementById('fo-implement').value;
  const passes  = parseFloat(document.getElementById('fo-passes').value)||1;
  const interKm = parseFloat(document.getElementById('fo-inter-km').value)||0;
  const v   = S.vehicles?.find(x=>x.id===vId);
  const imp = S.implements?.find(x=>x.id===impId);
  const opType = document.getElementById('fo-op-type').value;

  if(!v || !_foSelectedCells.size) {
    document.getElementById('fo-calc-details').innerHTML = 'Выберите технику и участки для расчёта';
    document.getElementById('fo-distribution-block').style.display='none';
    return;
  }

  // Площадь
  let totalHa = 0;
  const cellData = [];
  _foSelectedCells.forEach(key=>{
    const cd = S.cells[key];
    const ha = calcCellTotals(cd||{}).totalHa||0;
    totalHa += ha;
    cellData.push({key, ha, cd});
  });

  // Нормы — по выбранному виду работ у этого трактора
  const wt = _findWorkType(opType);
  const wtId = wt?.id || opType;
  let baseNormField = (v.fuelNormByWork && v.fuelNormByWork[wtId]);
  if(baseNormField===undefined || baseNormField===null || baseNormField==='') baseNormField = v.fuelNormField||0; // fallback
  const normField = (baseNormField||0) * (imp?.fuelCoeff||1.0);
  const normRoad  = v.fuelNormRoad||0;

  // Маршрут
  const firstKey = cellData[0]?.key;
  const firstCd = firstKey ? S.cells[firstKey] : null;
  const routeId = document.getElementById('fo-route').value;
  const route = (firstCd?.routes||[]).find(r=>r.id===routeId) || (firstCd?.routes||[])[0];
  const distKm   = route?.distanceKm||0;
  const roadCoeff = ROAD_COEFF[route?.roadType]||1.0;
  const distTotal = (distKm*2 + interKm) * passes;

  // Расчёт
  const fuelTransit = Math.round(distTotal * roadCoeff * normRoad * 100)/100;
  const fuelField   = Math.round(totalHa * normField * passes * 100)/100;
  const fuelPlan    = Math.round((fuelTransit+fuelField)*100)/100;

  // Цена топлива (последний приход)
  const lastR = [...(S.fuel.receipts||[])].filter(r=>r.fuelType===v.fuelType)
    .sort((a,b)=>b.date.localeCompare(a.date))[0];
  const pricePerL = lastR?.pricePerL||0;
  const costTransit = Math.round(fuelTransit*pricePerL*100)/100;
  const costField   = Math.round(fuelField*pricePerL*100)/100;
  const costTotal   = Math.round(fuelPlan*pricePerL*100)/100;
  const costPerHa   = totalHa>0 ? Math.round(costTotal/totalHa*100)/100 : 0;

  // Отображение расчёта
  document.getElementById('fo-calc-details').innerHTML = `
    <div>📐 Техника: <b>${v.name}</b>${imp?` + ${imp.name} (×${imp.fuelCoeff})`:''}
      · Норма поле: <b>${normField.toFixed(2)} л/га</b>
      · Норма дорога: <b>${normRoad} л/км</b>
    </div>
    <div>🗺️ Маршрут: <b>${route?.name||'не выбран'}</b>
      ${distKm>0?`— ${distKm} км × 2 = ${(distKm*2).toFixed(1)} км`:''}
      ${interKm>0?` + ${interKm} км межучастковые`:''}
      ${distTotal>0?` = <b>${distTotal.toFixed(1)} км итого</b>`:''}
      · коэф. дороги: ×${roadCoeff}
    </div>
    <div>🚗 Переезд: <b>${fuelTransit.toFixed(2)} л</b>
      ${pricePerL?` (${costTransit.toFixed(0)} MDL)`:''}
    </div>
    <div>🌾 Работа в поле: <b>${totalHa.toFixed(2)} га</b> × ${normField.toFixed(2)} л/га × ${passes} проходов = <b>${fuelField.toFixed(2)} л</b>
      ${pricePerL?` (${costField.toFixed(0)} MDL)`:''}
      ${baseNormField>0?'':'<span style="color:var(--yellow);font-size:10px;"> ⚠️ норма «'+(wt?.name||opType)+'» не задана для «'+v.name+'» — задайте в карточке техники</span>'}
    </div>
    <div style="margin-top:6px;padding:8px;background:rgba(74,222,128,.1);border-radius:6px;">
      <b>⛽ ИТОГО ПЛАН: ${fuelPlan.toFixed(2)} л</b>
      ${pricePerL?` · <b>${costTotal.toFixed(0)} MDL</b> · ${costPerHa.toFixed(0)} MDL/га`:''}
      ${!pricePerL?'<span style="color:var(--text3);font-size:10px;"> (цена не задана — добавьте приход топлива)</span>':''}
    </div>`;

  // Распределение
  if(cellData.length>1 && totalHa>0) {
    document.getElementById('fo-distribution-block').style.display='';
    document.getElementById('fo-distribution-table').innerHTML = `
      <table class="data-table"><thead><tr>
        <th>Участок</th><th>га</th><th>Доля</th><th>Переезд (л)</th><th>Поле (л)</th><th>Итого (л)</th><th>MDL</th><th>MDL/га</th>
      </tr></thead><tbody>${cellData.map(({key,ha})=>{
        const share = ha/totalHa;
        const transit = Math.round(fuelTransit*share*100)/100;
        const field   = Math.round(fuelField*share*100)/100;
        const total   = Math.round((transit+field)*100)/100;
        const cost    = Math.round(total*pricePerL*100)/100;
        const cpha    = ha>0?Math.round(cost/ha*100)/100:0;
        return `<tr>
          <td style="font-weight:600;">${key}</td>
          <td style="text-align:center;">${ha.toFixed(2)}</td>
          <td style="text-align:center;">${(share*100).toFixed(1)}%</td>
          <td style="text-align:center;">${transit.toFixed(2)}</td>
          <td style="text-align:center;">${field.toFixed(2)}</td>
          <td style="font-weight:600;text-align:center;">${total.toFixed(2)}</td>
          <td style="color:var(--accent);text-align:center;">${cost.toFixed(0)}</td>
          <td style="text-align:center;">${cpha.toFixed(0)}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  } else {
    document.getElementById('fo-distribution-block').style.display='none';
  }

  // Сохраняем в dataset для использования при save
  document.getElementById('fo-calc-details').dataset.plan    = fuelPlan;
  document.getElementById('fo-calc-details').dataset.transit = fuelTransit;
  document.getElementById('fo-calc-details').dataset.field   = fuelField;
  document.getElementById('fo-calc-details').dataset.area    = totalHa;
  document.getElementById('fo-calc-details').dataset.price   = pricePerL;
  document.getElementById('fo-calc-details').dataset.cost    = costTotal;
  document.getElementById('fo-calc-details').dataset.cpha    = costPerHa;
  document.getElementById('fo-calc-details').dataset.dist    = distTotal;
  document.getElementById('fo-calc-details').dataset.route   = routeId||'';
  document.getElementById('fo-calc-details').dataset.cells   = JSON.stringify(cellData.map(c=>({key:c.key,ha:c.ha})));
}

function foRecalcFact() {
  const plan = parseFloat(document.getElementById('fo-calc-details').dataset.plan)||0;
  const fact = parseFloat(document.getElementById('fo-fact').value)||0;
  if(!plan||!fact){document.getElementById('fo-delta-display').textContent='—';return;}
  const delta = fact-plan;
  const pct   = Math.round(delta/plan*1000)/10;
  const color = pct>0?'var(--red)':pct<0?'var(--accent)':'var(--text2)';
  document.getElementById('fo-delta-display').innerHTML =
    `<span style="color:${color};font-weight:600;">${pct>0?'+':''}${pct}% (${delta>0?'+':''}${delta.toFixed(1)} л)</span>`;
}

function saveFuelOp() {
  _initFuel();
  const vId = document.getElementById('fo-vehicle').value;
  if(!vId){alert('Выберите технику');return;}
  if(!_foSelectedCells.size){alert('Выберите хотя бы один участок');return;}
  const ds = document.getElementById('fo-calc-details').dataset;
  const plan   = parseFloat(ds.plan)||0;
  const fact   = parseFloat(document.getElementById('fo-fact').value)||0;
  const delta  = fact>0 ? fact-plan : 0;
  const deltaPct = plan>0&&fact>0 ? Math.round(delta/plan*1000)/10 : null;
  const cells  = JSON.parse(ds.cells||'[]');
  const pricePerL = parseFloat(ds.price)||0;
  const opType = document.getElementById('fo-op-type').value;
  const v = S.vehicles.find(x=>x.id===vId);

  // Распределение по участкам
  const totalHa = parseFloat(ds.area)||1;
  const distribution = cells.map(({key,ha})=>{
    const share = ha/totalHa;
    const ft = Math.round(parseFloat(ds.transit)*share*100)/100;
    const ff = Math.round(parseFloat(ds.field)*share*100)/100;
    const tot= Math.round((ft+ff)*100)/100;
    return { cellKey:key, areaHa:ha, share:Math.round(share*1000)/10,
      fuelTransit:ft, fuelField:ff, fuelTotal:tot,
      cost:Math.round(tot*pricePerL*100)/100 };
  });

  const op = {
    id:uid(),
    date: document.getElementById('fo-date').value,
    vehicleId: vId,
    implementId: document.getElementById('fo-implement').value||null,
    operationType: opType,
    operator: document.getElementById('fo-operator').value.trim(),
    cellKeys: [..._foSelectedCells],
    routeId: ds.route||null,
    passes: parseFloat(document.getElementById('fo-passes').value)||1,
    areaHa: parseFloat(ds.area)||0,
    distanceTotal: parseFloat(ds.dist)||0,
    fuelTransit: parseFloat(ds.transit)||0,
    fuelField:   parseFloat(ds.field)||0,
    fuelPlanTotal: plan,
    fuelFactTotal: fact||null,
    fuelDelta: fact>0?delta:null,
    deltaPercent: deltaPct,
    pricePerL,
    costTotal: parseFloat(ds.cost)||0,
    costPerHa: parseFloat(ds.cpha)||0,
    distribution,
    source:'manual',
    note: document.getElementById('fo-note').value.trim(),
  };
  S.fuel.operations.unshift(op);

  // Проверяем дельту
  if(deltaPct!=null) {
    const limit = _getFuelDeltaLimit(vId, opType);
    if(Math.abs(deltaPct) > limit) {
      S.fuel.alerts.push({
        id:uid(), date:op.date, vehicleId:vId, vehicleName:v?.name||'',
        operationType:opType, cellKeys:[..._foSelectedCells],
        fuelPlan:plan, fuelFact:fact, delta, deltaPercent:deltaPct,
        limit, excess:Math.round((Math.abs(deltaPct)-limit)*10)/10,
        taskId:null, resolved:false, resolvedNote:null,
      });
    }
  }

  save(); closeModal('modal-fuel-op'); renderFuelOps(); renderFuelAnalytics();
}

function _getFuelDeltaLimit(vehicleId, opType) {
  // 1) допуск из справочника видов работ (новый источник)
  const wt = _findWorkType(opType);
  if(wt && wt.deltaPercent!=null) return wt.deltaPercent;
  // 2) fallback: старые лимиты на тракторе по code
  const v = S.vehicles?.find(x=>x.id===vehicleId);
  const code = wt?.code || opType;
  return v?.fuelDeltaLimits?.find(d=>d.operationType===code)?.deltaPercent ?? 15;
}

function resolveFuelAlert(id) {
  _initFuel();
  const a = S.fuel.alerts.find(x=>x.id===id);
  if(a) { a.resolved=true; a.resolvedNote='Принято к сведению'; }
  save(); renderFuelOps();
}

function explainFuelAlert(id) {
  const reason = prompt('Укажите причину отклонения:');
  if(!reason) return;
  _initFuel();
  const a = S.fuel.alerts.find(x=>x.id===id);
  if(a) { a.resolved=true; a.resolvedNote=reason; }
  save(); renderFuelOps();
}

// ── Маршруты в карточке участка ──────────────────────────────────────────
// Вызывается из openCellModal / saveCellModal — интеграция описана ниже

// ══════════════════════════════════════════════════════════════════════════

function downloadVarietiesTemplate() {
  const headers = [
    'Культура (ID)', 'Название сорта', 'Происхождение (страна)',
    'Год выведения', 'Срок созревания', 'Опыление (self/cross)',
    'Опылители', 'Вес плода (г)', 'Цвет плода', 'Плотность плода',
    'Сахар Brix (%)', 'Устойчивость к растрескиванию (1-5)',
    'Сила роста', 'Год плодоношения', 'Урожай (т/га)',
    'Схема посадки', 'Рекомендуемый подвой',
    'Монилиоз (1-5)', 'Коккомикоз (1-5)', 'Клястероспориоз (1-5)',
    'Морозостойкость (1-5)', 'Chill hours (CP)', 'Примечание'
  ];
  const cropIds = (S.crops||[]).map(c=>`${c.id}=${c.name}`).join(' | ');
  const examples = [
    ['crop_cherry','Регина','Германия',1981,'Поздний','cross','Кордия, Наполеон',8,'Тёмно-красный','Очень плотная',18,4,'Среднерослый',4,14,'4×2','Гизела 5',3,4,3,4,1200,''],
    ['crop_cherry','Кордия (Kordia)','Чехия',1963,'Средне-поздний','cross','Регина, Скина',10,'Тёмно-бордовый','Очень плотная',19.5,3,'Сильнорослый',3,14,'4×2','Гизела 5',3,3,3,4,1100,''],
    ['crop_cherry','Скина (Skeena)','Канада',1997,'Средний','self','',10,'Тёмно-красный','Плотная',17,4,'Среднерослый',3,12,'4×2','Гизела 5',3,4,3,4,1050,'Самоопыляемый'],
    ['crop_cherry','Наполеон','Франция',1800,'Средний','cross','Коралл, Регина',8,'Жёлто-красный','Плотная',17,3,'Сильнорослый',4,12,'5×3','Гизела 5',3,3,3,3,1200,''],
    ['crop_apple','Голден Делишес','США',1890,'Средне-поздний','cross','Ред Делишес, Джонаголд',180,'Жёлто-зелёный','Плотная',14,4,'Среднерослый',3,40,'3×1','М9',4,3,3,3,1200,''],
  ];
  const infoRows = [
    [],
    ['Культуры (cropId):'], [cropIds],
    [],
    ['Срок созревания: Ранний | Средне-ранний | Средний | Средне-поздний | Поздний'],
    ['Опыление: self = самоопыляемый, cross = перекрёстное'],
    ['Устойчивость 1=очень чувствительный, 5=очень устойчивый'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples, ...infoRows]);
  ws['!cols'] = [16,22,16,10,16,14,25,10,18,16,10,16,14,12,10,12,16,12,12,16,14,10,20].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws, 'Сорта');
  XLSX.writeFile(wb, 'шаблон_сорта.xlsx');
}

function importVarietiesFromExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const RIPENING_MAP = {
    'ранний':'Ранний','early':'Ранний','timpuriu':'Ранний',
    'средне-ранний':'Средне-ранний','medio-timpuriu':'Средне-ранний',
    'средний':'Средний','mediu':'Средний','mid':'Средний','medium':'Средний',
    'средне-поздний':'Средне-поздний','medio-târziu':'Средне-поздний',
    'поздний':'Поздний','târziu':'Поздний','late':'Поздний',
  };
  const COLORS = ['vc0','vc1','vc2','vc3','vc4','vc5','vc6','vc7'];

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});

      // Найти строку заголовков
      let hi = 0;
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const r = rows[i].map(c => String(c).toLowerCase());
        if (r.some(c => c.includes('назван') || c.includes('сорт') || c.includes('name') || c.includes('soi'))) { hi = i; break; }
      }
      const H = rows[hi].map(c => String(c).toLowerCase().trim());
      const col = (...kws) => { for (const kw of kws) { const i = H.findIndex(h=>h.includes(kw)); if(i>=0) return i; } return -1; };

      const iCrop    = col('культур','crop','cultură');
      const iName    = col('назван','name','soi','сорт');
      const iOrigin  = col('происх','origin','ţară','tara','country');
      const iYear    = col('год выв','year','an');
      const iRipen   = col('срок','ripening','coacere','maturar');
      const iPoll    = col('опылен','poll','poleniz');
      const iPollin  = col('опылит','pollinator','poleniz cu');
      const iWeight  = col('вес плода','fruit weight','masa');
      const iColor   = col('цвет плода','fruit color','culoare');
      const iFirm    = col('плотн','firmness','consistenţ');
      const iBrix    = col('brix','сахар','zahar');
      const iCrack   = col('растрескив','crack','crăpare');
      const iVigor   = col('сила роста','vigor','vigoare');
      const iBear    = col('год плодон','bearing','rodire');
      const iYield   = col('урожай','yield','producţ');
      const iSpacing = col('схема','spacing','schemă');
      const iRootRec = col('подвой','rootstock','portaltoi');
      const iMon     = col('монилиоз','monilia','мон');
      const iCoc     = col('коккомик','cocco','кок');
      const iClas    = col('клястер','claster','кляс');
      const iFrost   = col('морозост','frost','ger');
      const iCp      = col('chill','cp','холод');
      const iNote    = col('примеч','note','observ');

      if (iName < 0) {
        alert('Не найдена колонка «Название сорта». Используйте шаблон.');
        return;
      }

      const builtinIds = new Set(S.varieties.map(v=>v.id));
      let added = 0, skipped = 0;
      let colorIdx = S.varieties.filter(v=>v.cropId==='crop_cherry').length % COLORS.length;

      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i];
        const name = String(r[iName]||'').trim();
        if (!name) continue;

        if (S.varieties.some(v=>v.name.toLowerCase()===name.toLowerCase())) { skipped++; continue; }

        const cropId = iCrop >= 0 ? String(r[iCrop]||'crop_cherry').trim() : 'crop_cherry';
        const rawRip = String(r[iRipen]||'').toLowerCase().trim();
        let ripening = 'Средний';
        for (const [k,v] of Object.entries(RIPENING_MAP)) { if (rawRip.includes(k)) { ripening=v; break; } }

        const rawPoll = String(r[iPoll]||'').toLowerCase();
        const pollType = rawPoll.includes('self')||rawPoll.includes('само') ? 'self' : 'cross';

        const obj = {
          id: 'v_imp_' + Date.now() + '_' + i,
          cropId,
          name,
          origin:       iOrigin  >= 0 ? String(r[iOrigin]||'').trim()  : '',
          year:         iYear    >= 0 ? parseInt(r[iYear])  || null     : null,
          ripening,
          pollType,
          pollinators:  iPollin  >= 0 ? String(r[iPollin]||'').trim()  : '',
          fruitWeight:  iWeight  >= 0 ? parseFloat(String(r[iWeight]).replace(',','.')) || null : null,
          fruitColor:   iColor   >= 0 ? String(r[iColor]||'').trim()   : '',
          fruitFirmness:iFirm    >= 0 ? String(r[iFirm]||'Плотная').trim() : 'Плотная',
          brix:         iBrix    >= 0 ? parseFloat(String(r[iBrix]).replace(',','.'))   || null : null,
          crackResistance: iCrack >= 0 ? String(parseInt(r[iCrack])||'3') : '3',
          vigor:        iVigor   >= 0 ? String(r[iVigor]||'Среднерослый').trim() : 'Среднерослый',
          bearingYear:  iBear    >= 0 ? parseInt(r[iBear])  || null     : null,
          yield:        iYield   >= 0 ? parseFloat(String(r[iYield]).replace(',','.'))  || null : null,
          spacing:      iSpacing >= 0 ? String(r[iSpacing]||'').trim()  : '',
          rootstockRec: iRootRec >= 0 ? String(r[iRootRec]||'').trim()  : '',
          resMonilia:   iMon     >= 0 ? String(parseInt(r[iMon])||'3')  : '3',
          resCocco:     iCoc     >= 0 ? String(parseInt(r[iCoc])||'3')  : '3',
          resClaster:   iClas    >= 0 ? String(parseInt(r[iClas])||'3') : '3',
          resScab: '3',
          frost:        iFrost   >= 0 ? String(parseInt(r[iFrost])||'3'): '3',
          cp:           iCp      >= 0 ? parseInt(r[iCp])    || null     : null,
          color: COLORS[colorIdx % COLORS.length],
          note:         iNote    >= 0 ? String(r[iNote]||'').trim()     : '',
        };
        S.varieties.push(obj);
        colorIdx++;
        added++;
      }

      save();
      if (typeof renderVarietiesCatalog === 'function') renderVarietiesCatalog();

      // Статус под заголовком панели
      let statusEl = document.getElementById('varieties-import-status');
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'varieties-import-status';
        statusEl.style.cssText = 'margin-bottom:14px;';
        const panel = document.getElementById('csub-panel-varieties');
        if (panel) panel.insertAdjacentElement('afterbegin', statusEl);
      }
      statusEl.innerHTML = `<div style="padding:12px 16px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.3);border-radius:8px;font-size:12px;">
        ✅ <strong>Импорт сортов завершён</strong><br>
        • Добавлено: <strong style="color:var(--accent)">${added}</strong> сортов<br>
        ${skipped ? `• Пропущено (дубликаты): ${skipped}` : ''}
        <div style="margin-top:6px;color:var(--text3);">Откройте каждый сорт (✏️) для уточнения деталей.</div>
      </div>`;
      statusEl.style.display = 'block';
      setTimeout(() => statusEl.style.display = 'none', 10000);

    } catch(err) {
      alert('Ошибка чтения файла: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}


// ── Авто-рендер справочника видов работ при открытии Настроек ─────────────
(function hookWorkTypesRender(){
  function tryHook(){
    if(typeof window.switchTab !== 'function'){ setTimeout(tryHook, 100); return; }
    const _orig = window.switchTab;
    window.switchTab = function(tab, el){
      _orig(tab, el);
      if(tab === 'settings'){
        setTimeout(()=>{ if(typeof renderWorkTypes==='function') renderWorkTypes(); }, 30);
      }
    };
  }
  tryHook();
})();
