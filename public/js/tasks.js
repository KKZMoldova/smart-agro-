// Smart Agro — tasks.js
// ═══ ЖУРНАЛ РАБОТ ════════════════════════════════════════════════════

let _tasks = [];
let _taskFilter = 'all';
let _taskStaff = [];
let _taskWorkTypes = [];
let _newTaskParcels = [];
let _newTaskChems = [];
// _allEquip, _allAttach, _ntMachines — declared in machines block below

const TASK_STATUS_LABELS = {new:'Новое',assigned:'Назначено',accepted:'Принято',in_progress:'В работе',done:'Выполнено',closed:'Закрыто',problem:'Проблема'};
const TASK_STATUS_COLORS = {new:'var(--blue)',assigned:'#a855f7',accepted:'var(--orange)',in_progress:'var(--accent)',done:'#2dd4bf',closed:'var(--text3)',problem:'var(--red)'};

async function renderTasks() {
  try {
    const r = await fetch('/api/tasks');
    _tasks = await r.json();
  } catch(e) { _tasks = []; }
  const statuses = ['all','new','assigned','accepted','in_progress','done','problem','closed'];
  statuses.forEach(s => {
    const el = document.getElementById('tc-'+s);
    if(el) el.textContent = s==='all' ? _tasks.length : _tasks.filter(t=>t.status===s).length;
  });
  const filtered = _taskFilter==='all' ? _tasks : _tasks.filter(t=>t.status===_taskFilter);
  const el = document.getElementById('tasks-list');
  if(!el) return;
  if(!filtered.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--text3);padding:40px;">Заданий нет. Нажмите + Новое задание</div>';
    return;
  }
  el.innerHTML = filtered.map(t => {
    const chems = t.chemicals ? (typeof t.chemicals==='string' ? JSON.parse(t.chemicals) : t.chemicals) : [];
    const statusColor = TASK_STATUS_COLORS[t.status] || 'var(--text3)';
    const dueDate = t.due_date ? new Date(t.due_date).toLocaleDateString('ru-RU') : '—';
    return `<div class="task-card s-${t.status}">
      <div class="task-title">${t.work_type_name||'Работа'}</div>
      <div class="task-sub">${t.parcel_name||'—'}${t.description?' · '+t.description.slice(0,60):''}${(() => {
        const zones = t.zones_json ? (typeof t.zones_json==='string'?JSON.parse(t.zones_json):t.zones_json) : [];
        if(!zones.length) return '';
        const zNames = [...new Set(zones.map(z=>z.name))];
        return '<br><span style="font-size:10px;color:var(--blue);">💧 '+zNames.join(', ')+'</span>';
      })()}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
        <span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${statusColor}22;color:${statusColor};">${TASK_STATUS_LABELS[t.status]||t.status}</span>
        ${t.due_date?`<span style="padding:2px 8px;border-radius:10px;font-size:11px;background:rgba(255,216,77,.15);color:var(--yellow);">До ${dueDate}</span>`:''}
        ${t.total_ha?`<span style="padding:2px 8px;border-radius:10px;font-size:11px;background:var(--surface2);color:var(--text3);">📐 ${t.total_ha} га</span>`:''}
        ${t.telegram_sent?`<span style="padding:2px 8px;border-radius:10px;font-size:11px;background:var(--surface2);color:var(--text3);">✈️ Telegram</span>`:''}
      </div>
      <div class="task-grid">
        <div><div class="tl">Агроном</div><div class="tv">${t.created_by_name||'—'}</div></div>
        <div><div class="tl">Исполнитель</div><div class="tv">${t.assigned_to_name||'—'}</div></div>
        <div><div class="tl">Механизатор</div><div class="tv">${t.mechanic_name||'—'}</div></div>
        <div><div class="tl">Техника</div><div class="tv">${t.equipment_name||'—'}</div></div>
        <div><div class="tl">Навесное</div><div class="tv">${t.attachment||'—'}</div></div>
        ${t.closed_by_name?`<div><div class="tl">Закрыл</div><div class="tv">${t.closed_by_name}</div></div>`:''}
      </div>
      ${(() => {
        const machines = t.machines_json ? (typeof t.machines_json==='string'?JSON.parse(t.machines_json):t.machines_json) : [];
        if(!machines.length) return '';
        return `<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px;">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">🚜 АГРЕГАТЫ:</div>
          ${machines.map((m,i)=>`<div style="font-size:11px;padding:4px 8px;background:var(--surface2);border-radius:6px;margin-bottom:3px;">
            <strong>Агрегат ${i+1}:</strong> ${m.equipName||'—'} · ${m.attachName||'—'} · 
            👤 ${m.mechanicName||'—'}
            ${m.parcelIds?.length?` · 🌳 ${m.parcelIds.join(', ')}`:''} 
            ${m.zoneIds?.length?` · 💧 ${m.zoneIds.map(zid=>(S.irrigation?.zones||[]).find(z=>z.id===zid)?.name||zid).join(', ')}`:''} 
          </div>`).join('')}
        </div>`;
      })()}
      </div>
      ${chems.length?`<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">💊 ПРЕПАРАТЫ:</div>
        ${chems.map(c=>`<div class="task-chem">
          <span style="font-weight:500;">${c.name}</span>
          <span style="color:var(--text3);">${c.dose_actual||c.dose_default||''}</span>
        </div>`).join('')}
      </div>`:''}
      ${t.problem_note?`<div style="background:rgba(255,85,85,.08);border:1px solid rgba(255,85,85,.2);border-radius:8px;padding:8px 12px;margin-top:8px;font-size:12px;color:var(--red);">⚠️ ${t.problem_note}</div>`:''}
      <div class="task-actions">${renderTaskActions(t)}</div>
    </div>`;
  }).join('');
}

function filterTasks(f, el) {
  _taskFilter = f;
  document.querySelectorAll('[id^="tf-"]').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderTasks();
}

function renderTaskActions(t) {
  let h = '';
  if(t.status==='new') {
    h+=`<button class="btn btn-secondary btn-sm" onclick="openTaskEng('${t.id}')">🔧 Назначить технику</button>`;
    h+=`<button class="btn btn-secondary btn-sm" style="color:var(--orange);" onclick="openTaskProb('${t.id}')">⚠️ Проблема</button>`;
  }
  if(t.status==='assigned') {
    h+=`<button class="btn btn-secondary btn-sm" onclick="updateTaskStatus('${t.id}','accepted',{})">✓ Принять</button>`;
    h+=`<button class="btn btn-secondary btn-sm" style="color:var(--orange);" onclick="openTaskProb('${t.id}')">⚠️ Проблема</button>`;
  }
  if(t.status==='accepted') {
    h+=`<button class="btn btn-primary btn-sm" onclick="updateTaskStatus('${t.id}','in_progress',{})">▶ Начать работу</button>`;
    h+=`<button class="btn btn-secondary btn-sm" style="color:var(--orange);" onclick="openTaskProb('${t.id}')">⚠️ Проблема</button>`;
  }
  if(t.status==='in_progress') {
    h+=`<button class="btn btn-primary btn-sm" onclick="openTaskDone('${t.id}')">✅ Завершить работу</button>`;
    h+=`<button class="btn btn-secondary btn-sm" style="color:var(--orange);" onclick="openTaskProb('${t.id}')">⚠️ Проблема</button>`;
  }
  if(t.status==='done'||t.status==='problem') {
    h+=`<button class="btn btn-primary btn-sm" onclick="openTaskClose('${t.id}')">✅ Закрыть (агроном)</button>`;
  }
  return h;
}

async function updateTaskStatus(id, status, extra) {
  await fetch(`/api/tasks/${id}/status`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status,...extra})});
  renderTasks();
}

async function openNewTask() {
  if(!_taskStaff.length) {
    try { _taskStaff = await fetch('/api/staff').then(r=>r.json()); } catch(e) { _taskStaff = []; }
  }
  if(!_taskWorkTypes.length) {
    try { _taskWorkTypes = await fetch('/api/work-types').then(r=>r.json()); } catch(e) {
      _taskWorkTypes = [
        {id:'wt1',name:'Обработка (опрыскивание)'},
        {id:'wt2',name:'Ирригация'},
        {id:'wt3',name:'Скашивание травы'},
        {id:'wt4',name:'Обрезка деревьев'},
        {id:'wt5',name:'Подкормка (фертигация)'},
        {id:'wt6',name:'Уборка урожая'},
        {id:'wt7',name:'Посадка'},
        {id:'wt8',name:'Прочие работы'},
      ];
    }
  }

  // Техника и навесное
  // Техника и навесное
  try { _allEquip = await fetch('/api/equipment').then(r=>r.json()); } catch(e) { _allEquip = []; }
  try { const at = await fetch('/api/attachments').then(r=>r.json()); _allAttach = Array.isArray(at)?at:(at.data||[]); } catch(e) { _allAttach = []; }

  _newTaskParcels = [];
  _newTaskChems = [];
  _ntMachines = [];
  renderNtMachines();

  document.getElementById('nt-wt').innerHTML = _taskWorkTypes.map(w=>`<option value="${w.id}" data-name="${w.name}">${w.name}</option>`).join('');

  const staffOpts = _taskStaff.length
    ? _taskStaff.map(s=>`<option value="${s.id}" data-name="${s.name}">${s.name} (${s.role})</option>`).join('')
    : '<option value="agronomist" data-name="Агроном">Агроном</option>';
  document.getElementById('nt-creator').innerHTML = staffOpts;
  document.getElementById('nt-assignee').innerHTML = staffOpts;

  // Клетки сада с зонами полива
  const cells = Object.entries(S.cells||{});
  const zonesAll = S.irrigation?.zones||[];
  document.getElementById('nt-parcel-list').innerHTML = cells.length
    ? cells.map(([key,cd])=>{
        const crop = getCropById(cd.cropId||'crop_cherry');
        const cols = getCellColors(cd);
        const ha = calcCellTotals(cd)?.totalHa||0;
        const cellZones = zonesAll.filter(z=>(z.cellKeys||[]).includes(key));
        const zonesHtml = cellZones.length
          ? `<div style="margin-left:24px;margin-top:3px;display:flex;gap:4px;flex-wrap:wrap;">
              ${cellZones.map(z=>`
                <div onclick="toggleNtZone('${z.id}','${z.name}','${key}',event)" id="ntz-${key}-${z.id}"
                  style="padding:2px 8px;border-radius:6px;border:1px solid var(--border);font-size:10px;cursor:pointer;color:var(--text3);transition:all .15s;">
                  💧 ${z.name}
                </div>`).join('')}
            </div>` : '';
        return `<div style="padding:4px 8px;border-radius:6px;" id="ntp-wrap-${key}">
          <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="toggleNtParcel('${key}','${key}${cols[0]?' – '+cols[0].name:''}',${ha})" id="ntp-${key}">
            <input type="checkbox" id="ntpc-${key}" onclick="event.stopPropagation();toggleNtParcel('${key}','${key}${cols[0]?' – '+cols[0].name:''}',${ha})">
            <span>${crop?.emoji||'🌳'} <strong>${key}</strong>${cols[0]?' — '+cols[0].name:''}</span>
            <span style="margin-left:auto;color:var(--text3);font-size:11px;">${ha.toFixed(3)} га</span>
          </div>
          ${zonesHtml}
        </div>`;
      }).join('')
    : '<div style="color:var(--text3);padding:8px;">Клетки не заданы. Добавьте клетки на Карте.</div>';

  document.getElementById('nt-chem-search').value = '';
  document.getElementById('nt-chem-dropdown').style.display = 'none';
  document.getElementById('nt-added-chems').innerHTML = '';
  document.getElementById('nt-selected-tags').innerHTML = '';
  document.getElementById('nt-area-info').textContent = '';
  document.getElementById('nt-calc-summary').style.display = 'none';
  document.getElementById('nt-water').value = '400';
  document.getElementById('nt-due').value = today();
  document.getElementById('nt-desc').value = '';
  document.getElementById('nt-speed').value = '';
  openModal('modal-new-task');
}

let _newTaskZones = []; // [{id, name, cellKey}]

function toggleNtParcel(id, name, ha) {
  const idx = _newTaskParcels.findIndex(p=>p.id===id);
  if(idx>=0) {
    _newTaskParcels.splice(idx,1);
    // Снимаем выбор зон этой клетки
    _newTaskZones = _newTaskZones.filter(z=>z.cellKey!==id);
  } else {
    _newTaskParcels.push({id, name, ha:parseFloat(ha)||0});
    // Авто-выбираем все зоны клетки
    const cellZones = (S.irrigation?.zones||[]).filter(z=>(z.cellKeys||[]).includes(id));
    cellZones.forEach(z=>{
      if(!_newTaskZones.find(x=>x.id===z.id&&x.cellKey===id))
        _newTaskZones.push({id:z.id, name:z.name, cellKey:id});
    });
  }
  _updateNtParcelUI();
}

function toggleNtZone(zoneId, zoneName, cellKey, event) {
  if(event) event.stopPropagation();
  const idx = _newTaskZones.findIndex(z=>z.id===zoneId&&z.cellKey===cellKey);
  if(idx>=0) _newTaskZones.splice(idx,1);
  else _newTaskZones.push({id:zoneId, name:zoneName, cellKey});
  _updateNtParcelUI();
}

function _updateNtParcelUI() {
  // Обновляем вид клеток
  Object.keys(S.cells||{}).forEach(key => {
    const row = document.getElementById('ntp-'+key);
    const cb = document.getElementById('ntpc-'+key);
    if(!row||!cb) return;
    const sel = _newTaskParcels.find(x=>x.id===key);
    row.style.background = sel ? 'rgba(107,221,107,.1)' : '';
    cb.checked = !!sel;
  });
  // Обновляем вид зон
  (S.irrigation?.zones||[]).forEach(z=>{
    (z.cellKeys||[]).forEach(cellKey=>{
      const el = document.getElementById(`ntz-${cellKey}-${z.id}`);
      if(!el) return;
      const sel = _newTaskZones.find(x=>x.id===z.id&&x.cellKey===cellKey);
      el.style.background = sel ? 'rgba(96,165,250,.15)' : '';
      el.style.color = sel ? 'var(--blue)' : 'var(--text3)';
      el.style.borderColor = sel ? 'var(--blue)' : 'var(--border)';
    });
  });
  // Обновляем теги
  const total = _newTaskParcels.reduce((s,p)=>s+p.ha,0);
  const zoneNames = [...new Set(_newTaskZones.map(z=>z.name))];
  document.getElementById('nt-selected-tags').innerHTML = [
    ..._newTaskParcels.map(p=>`<span style="padding:2px 8px;border-radius:10px;background:rgba(107,221,107,.15);color:var(--accent);font-size:11px;">🌳 ${p.name}</span>`),
    ...zoneNames.map(n=>`<span style="padding:2px 8px;border-radius:10px;background:rgba(96,165,250,.12);color:var(--blue);font-size:11px;">💧 ${n}</span>`)
  ].join('');
  document.getElementById('nt-area-info').textContent = _newTaskParcels.length
    ? `${_newTaskParcels.length} кл.${zoneNames.length?' · '+zoneNames.length+' зон':''} · ${total.toFixed(3)} га` : '';
  ntUpdateCalc();
}

function ntUpdateCalc() {
  const calcEl = document.getElementById('nt-calc-summary');
  if(!calcEl) return;

  const totalHa = _newTaskParcels.reduce((s,p)=>s+p.ha,0);
  const waterPerHa = parseFloat(document.getElementById('nt-water')?.value)||400;
  const tankVol = parseFloat(document.getElementById('nt-tank-vol')?.value)||2000;
  const haPerTankManual = parseFloat(document.getElementById('nt-ha-per-tank')?.value)||0;
  const chems = _newTaskChems.filter(c=>parseFloat(c.dose_actual||c.dose_default)>0);

  if(!chems.length||!totalHa){ calcEl.style.display='none'; return; }

  const totalWaterL = waterPerHa * totalHa;
  const haPerTank = haPerTankManual || (tankVol / waterPerHa);
  const fullTanks = Math.floor(totalHa / haPerTank);
  const remainHa = Math.round((totalHa - fullTanks * haPerTank) * 1000) / 1000;
  const remainWaterL = Math.round(remainHa * waterPerHa);
  const totalTanks = fullTanks + (remainHa > 0.001 ? 1 : 0);

  const ORDER_PRIORITY = {microelement:1,fertilizer:2,fungicide:3,insecticide:4,acaricide:5,herbicide:6,surfactant:7,other:8};
  const chemsOrdered = [...chems].sort((a,b)=>{
    const ca=S.catalog.find(x=>x.id===a.id), cb=S.catalog.find(x=>x.id===b.id);
    return (ORDER_PRIORITY[ca?.type]||9)-(ORDER_PRIORITY[cb?.type]||9);
  });
  const TC={fungicide:'var(--teal)',insecticide:'var(--orange)',herbicide:'var(--yellow)',
    fertilizer:'var(--accent)',acaricide:'#a855f7',microelement:'var(--blue)',surfactant:'#67e8f9',other:'var(--text3)'};
  const TL={fungicide:'Фунгицид',insecticide:'Инсектицид',herbicide:'Гербицид',
    fertilizer:'Удобрение',acaricide:'Акарицид',microelement:'Микроэл.',surfactant:'ПАВ',other:'Прочее'};

  let html = '';

  // Шапка итогов
  html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;">
    <div style="text-align:center;padding:8px;background:var(--surface3);border-radius:8px;">
      <div style="font-size:15px;font-weight:700;color:var(--accent);">${totalHa.toFixed(2)}</div>
      <div style="font-size:9px;color:var(--text3);">га</div></div>
    <div style="text-align:center;padding:8px;background:var(--surface3);border-radius:8px;">
      <div style="font-size:15px;font-weight:700;color:var(--blue);">${Math.round(totalWaterL)}</div>
      <div style="font-size:9px;color:var(--text3);">л воды</div></div>
    <div style="text-align:center;padding:8px;background:var(--surface3);border-radius:8px;">
      <div style="font-size:15px;font-weight:700;color:var(--yellow);">${totalTanks}</div>
      <div style="font-size:9px;color:var(--text3);">баков (${tankVol}л)</div></div>
    <div style="text-align:center;padding:8px;background:var(--surface3);border-radius:8px;">
      <div style="font-size:15px;font-weight:700;color:var(--orange);">${haPerTank.toFixed(2)}</div>
      <div style="font-size:9px;color:var(--text3);">га/бак</div></div>
  </div>`;

  // Порядок заполнения бака
  html += `<div style="margin-bottom:12px;">
    <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">📋 Порядок заполнения бака · 1 бак = ${tankVol}л = ${haPerTank.toFixed(2)}га</div>`;
  chemsOrdered.forEach((c,idx)=>{
    const dose=parseFloat(c.dose_actual||c.dose_default)||0;
    const perTank=Math.round(dose*haPerTank*1000)/1000;
    const totalAll=Math.round(dose*totalHa*1000)/1000;
    const cat=S.catalog.find(x=>x.id===c.id);
    const color=TC[cat?.type||'other']||'var(--text3)';
    const stock=S.warehouse?.chemicals?.find(x=>x.name.toLowerCase()===c.name.toLowerCase());
    const enough=stock?stock.qty>=totalAll:null;
    html+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface3);border-radius:8px;margin-bottom:4px;border-left:3px solid ${color};">
      <div style="width:20px;height:20px;border-radius:50%;background:${color}33;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${color};flex-shrink:0;">${idx+1}</div>
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:600;">${c.name} <span style="font-size:10px;color:${color};">${TL[cat?.type||'other']||''}</span></div>
        <div style="font-size:11px;color:var(--text3);">Доза: ${dose}л/га · На бак: <strong style="color:${color};">${perTank}л/кг</strong> · Всего: <strong>${totalAll}л/кг</strong></div>
      </div>
      ${stock?`<div style="font-size:11px;font-weight:600;color:${enough?'var(--accent)':'var(--red)'};">${enough?'✅':'⚠️'} ${stock.qty}${stock.unit||'л'}</div>`:'<div style="font-size:10px;color:var(--text3);">нет данных</div>'}
    </div>`;
  });
  html += '</div>';

  // Расчёт по участкам
  if(_newTaskParcels.length>1) {
    html += `<div style="margin-bottom:12px;"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">🗺 По участкам</div>`;
    _newTaskParcels.forEach(p=>{
      const pTanks=p.ha/haPerTank, pFull=Math.floor(pTanks), pRem=Math.round((pTanks-pFull)*100)/100;
      html+=`<div style="padding:8px 10px;background:var(--surface3);border-radius:8px;margin-bottom:4px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="font-size:12px;font-weight:600;">🌳 ${p.name}</span>
          <span style="font-size:11px;color:var(--text3);">${p.ha.toFixed(3)}га · ${Math.round(p.ha*waterPerHa)}л</span>
        </div>
        <div style="font-size:11px;color:var(--text3);">
          ${pFull>0?`<span style="color:var(--accent);">${pFull} полн. бак${pFull>1?'а':''}.</span>`:''}
          ${pRem>0.01?`<span style="color:var(--orange);"> + ${(pRem*100).toFixed(0)}% бака (${Math.round(pRem*tankVol)}л)</span>`:''}
        </div>
        ${pRem>0.01?`<div style="margin-top:3px;font-size:10px;color:var(--orange);">💡 Остаток: ${chemsOrdered.map(c=>{const d=parseFloat(c.dose_actual||c.dose_default)||0;return c.name+': '+(Math.round(d*pRem*haPerTank*1000)/1000)+'л/кг';}).join(' · ')}</div>`:''}
      </div>`;
    });
    html += '</div>';
  }

  // Последний неполный бак
  if(remainHa>0.001) {
    html+=`<div style="padding:10px 14px;background:rgba(251,146,60,.08);border:1px solid rgba(251,146,60,.2);border-radius:8px;margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;color:var(--orange);margin-bottom:6px;">⚠️ Последний бак: ${(remainHa/haPerTank*100).toFixed(0)}% — ${remainWaterL}л · ${remainHa.toFixed(3)}га</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${chemsOrdered.map(c=>{
          const dose=parseFloat(c.dose_actual||c.dose_default)||0;
          const cat=S.catalog.find(x=>x.id===c.id);
          const color=TC[cat?.type||'other']||'var(--text3)';
          return `<div style="padding:3px 8px;border-radius:6px;background:${color}15;font-size:11px;font-weight:600;color:${color};">${c.name}: <strong>${Math.round(dose*remainHa*1000)/1000}</strong></div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // Техника
  const eqName = document.getElementById('nt-equip')?.selectedOptions[0]?.dataset.name||'';
  if(eqName) html+=`<div style="font-size:11px;color:var(--text3);padding:6px 10px;background:var(--surface3);border-radius:8px;">🚜 ${eqName} · бак ${tankVol}л · ${haPerTank.toFixed(2)}га/бак</div>`;

  calcEl.innerHTML = html;
  calcEl.style.display = 'block';
}
function searchNtChems(q) {
  const dd = document.getElementById('nt-chem-dropdown');
  const catalog = S.catalog||[];
  const filtered = q
    ? catalog.filter(c =>
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        (c.activeSubstance||'').toLowerCase().includes(q.toLowerCase()) ||
        (c.type||'').toLowerCase().includes(q.toLowerCase())
      )
    : catalog.slice(0, 40);
  if(!filtered.length){ dd.style.display='none'; return; }

  const TYPE_LABELS = {
    fungicide:'🍄 Фунгицид', insecticide:'🐛 Инсектицид', herbicide:'🌿 Гербицид',
    acaricide:'🕷 Акарицид', fertilizer:'🌱 Удобрение', microelement:'⚗️ Микроэл.',
    surfactant:'🧴 ПАВ', other:'🔧 Прочее'
  };
  const TYPE_COLORS = {
    fungicide:'var(--teal)', insecticide:'var(--orange)', herbicide:'var(--yellow)',
    acaricide:'#a855f7', fertilizer:'var(--accent)', microelement:'var(--blue)',
    surfactant:'#67e8f9', other:'var(--text3)'
  };

  dd.innerHTML = filtered.map(c => {
    // Остаток на складе
    const stock = S.warehouse?.chemicals?.find(x=>x.name.toLowerCase()===c.name.toLowerCase());
    const stockInfo = stock
      ? `<span style="font-size:10px;font-weight:600;color:${stock.qty>0?'var(--accent)':'var(--red)'};">${stock.qty} ${stock.unit||'л'}</span>`
      : `<span style="font-size:10px;color:var(--text3);">нет на складе</span>`;
    const typeLabel = TYPE_LABELS[c.type]||c.type||'';
    const typeColor = TYPE_COLORS[c.type]||'var(--text3)';
    const alreadyAdded = !!_newTaskChems.find(x=>x.id===c.id);

    return `<div style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);${alreadyAdded?'opacity:.4;pointer-events:none;':''}"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''"
      onclick="addNtChem('${c.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
        <span style="font-size:13px;font-weight:600;">${c.name}</span>
        <div style="display:flex;gap:6px;align-items:center;">
          ${stockInfo}
          <span style="padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;background:${typeColor}22;color:${typeColor};">${typeLabel}</span>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text3);">
        ${c.activeSubstance?`д.в.: ${c.activeSubstance} · `:''}
        ${c.dose?`реком. доза: ${c.dose} · `:''}
        ${c.duration?`действует ${c.duration} дн.`:''}
      </div>
    </div>`;
  }).join('');
  dd.style.display = 'block';
}

function addNtChem(id) {
  if(_newTaskChems.find(c=>c.id===id)) return;
  const c = S.catalog.find(x=>x.id===id);
  if(!c) return;
  _newTaskChems.push({
    id: c.id, name: c.name, type: c.type,
    dose_default: c.dose||'',
    dose_actual: c.dose||'',
    active: c.activeSubstance||'',
    duration: c.duration||14,
    washMm: c.washMm||15,
    target: ''
  });
  document.getElementById('nt-chem-search').value = '';
  document.getElementById('nt-chem-dropdown').style.display = 'none';
  renderNtChems();
}

function removeNtChem(id) {
  _newTaskChems = _newTaskChems.filter(c=>c.id!==id);
  renderNtChems();
}

function renderNtChems() {
  document.getElementById('nt-added-chems').innerHTML = _newTaskChems.map(c=>`
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-weight:600;">${c.name}</span>
        <button class="btn btn-secondary btn-sm" style="color:var(--red);padding:2px 8px;" onclick="removeNtChem('${c.id}')">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">РЕК. ДОЗА</div>
          <input type="text" value="${c.dose_default||'—'}" readonly style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text3);">
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">ФАКТ. ДОЗА (л/кг на га)</div>
          <input type="text" id="ntd-${c.id}" value="${c.dose_actual}" placeholder="л/га"
            oninput="_newTaskChems.find(x=>x.id==='${c.id}').dose_actual=this.value;ntUpdateCalc()"
            style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text);">
        </div>
      </div>
    </div>`).join('');
  ntUpdateCalc();
}

// ═══ АГРЕГАТЫ (техника + навесное + механизатор) ══════════════════════════

let _allEquip = [];
let _allAttach = [];
let _ntMachines = []; // [{equipId,equipName,attachId,attachName,mechanicId,mechanicName,speed}]

function renderNtMachines() {
  const el = document.getElementById('nt-machines-list');
  if (!el) return;

  if (!_ntMachines.length) {
    el.innerHTML = `<div style="color:var(--text3);font-size:11px;padding:8px 0;">Агрегаты не добавлены — задание будет создано со статусом «Новое»</div>`;
    return;
  }

  const equipOpts = '<option value="">— не выбрана —</option>'
    + _allEquip.map(e => `<option value="${e.id}" data-name="${e.name}">${e.name}${e.status && e.status !== 'free' ? ' ⚠️' : ''}</option>`).join('');
  const attachOpts = '<option value="">— без навесного —</option>'
    + _allAttach.map(a => `<option value="${a.id}" data-name="${a.name}">${a.name}</option>`).join('');
  const mechOpts = '<option value="">— не назначен —</option>'
    + _taskStaff.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join('');

  el.innerHTML = _ntMachines.map((m, i) => `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;" id="ntm-row-${i}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-size:11px;font-weight:600;color:var(--text3);">🚜 Агрегат ${i + 1}</span>
        <button onclick="removeNtMachine(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;padding:0 4px;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Техника</div>
          <select onchange="updateNtMachine(${i},'equipId',this.value,this.selectedOptions[0]?.dataset.name||'')"
            style="width:100%;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:11px;">
            ${equipOpts.replace(`value="${m.equipId}"`, `value="${m.equipId}" selected`)}
          </select>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Навесное</div>
          <select onchange="updateNtMachine(${i},'attachId',this.value,this.selectedOptions[0]?.dataset.name||'')"
            style="width:100%;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:11px;">
            ${attachOpts.replace(`value="${m.attachId}"`, `value="${m.attachId}" selected`)}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 80px;gap:8px;">
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Механизатор</div>
          <select onchange="updateNtMachine(${i},'mechanicId',this.value,this.selectedOptions[0]?.dataset.name||'')"
            style="width:100%;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:11px;">
            ${mechOpts.replace(`value="${m.mechanicId}"`, `value="${m.mechanicId}" selected`)}
          </select>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Скорость (км/ч)</div>
          <input type="number" min="1" max="30" value="${m.speed||''}" placeholder="—"
            onchange="updateNtMachine(${i},'speed',this.value)"
            style="width:100%;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:11px;">
        </div>
      </div>
      ${m.equipId && m.mechanicId ? `<div style="margin-top:8px;padding:5px 10px;background:rgba(74,222,128,.08);border-radius:6px;font-size:10px;color:var(--accent);">✅ ${m.equipName||'Техника'}${m.attachName?' + '+m.attachName:''} · 👤 ${m.mechanicName||'—'}</div>` : ''}
    </div>`).join('');
}

function addNtMachine() {
  _ntMachines.push({ equipId:'', equipName:'', attachId:'', attachName:'', mechanicId:'', mechanicName:'', speed:null });
  renderNtMachines();
}

function removeNtMachine(i) {
  _ntMachines.splice(i, 1);
  renderNtMachines();
}

function updateNtMachine(i, field, value, name) {
  if (!_ntMachines[i]) return;
  _ntMachines[i][field] = value;
  if (field === 'equipId')    _ntMachines[i].equipName    = name || '';
  if (field === 'attachId')   _ntMachines[i].attachName   = name || '';
  if (field === 'mechanicId') _ntMachines[i].mechanicName = name || '';
  if (field === 'speed')      _ntMachines[i].speed        = parseFloat(value) || null;
  renderNtMachines();
  ntUpdateCalc();
}

async function saveNewTask() {
  const wtSel = document.getElementById('nt-wt');
  const wtId = wtSel.value;
  const wtName = wtSel.options[wtSel.selectedIndex]?.textContent || '';
  const crSel = document.getElementById('nt-creator');
  const crId = crSel.value;
  const crName = crSel.options[crSel.selectedIndex]?.dataset?.name || crSel.options[crSel.selectedIndex]?.textContent || '';
  const asSel = document.getElementById('nt-assignee');
  const asId = asSel.value;
  const asName = asSel.options[asSel.selectedIndex]?.dataset?.name || asSel.options[asSel.selectedIndex]?.textContent || '';
  if(!crId||!asId){alert('Выберите агронома и исполнителя');return;}

  // Берём первый агрегат для совместимости
  const firstMachine = _ntMachines[0];
  const eqId = firstMachine?.equipId||'';
  const eqName = firstMachine?.equipName||'';
  const atName = firstMachine?.attachName||'';
  const meId = firstMachine?.mechanicId||'';
  const meName = firstMachine?.mechanicName||'';
  const speed = firstMachine?.speed||null;
  const waterPerHa = parseFloat(document.getElementById('nt-water').value)||400;
  const method = document.getElementById('nt-method').value;

  const parcelName = _newTaskParcels.map(p=>p.name).join(', ') || null;
  const totalHa = _newTaskParcels.reduce((s,p)=>s+p.ha,0);
  const dueDate = document.getElementById('nt-due').value||null;

  // Статус: если назначена техника и механизатор — сразу "assigned"
  const initialStatus = (eqId && meId) ? 'assigned' : 'new';

  const body = {
    work_type_id: wtId, work_type_name: wtName,
    description: document.getElementById('nt-desc').value.trim(),
    parcel_id: _newTaskParcels.length===1 ? _newTaskParcels[0].id : null,
    parcel_name: parcelName,
    parcels_json: _newTaskParcels.length ? _newTaskParcels : null,
    zones_json: _newTaskZones.length ? _newTaskZones : null,
    total_ha: totalHa||null,
    chemicals: _newTaskChems.length ? JSON.stringify(_newTaskChems) : null,
    created_by_id: crId, created_by_name: crName,
    assigned_to_id: asId, assigned_to_name: asName,
    equipment_id: eqId||null, equipment_name: eqName||null,
    attachment: atName||null,
    mechanic_id: meId||null, mechanic_name: meName||null,
    machines_json: _ntMachines.filter(m=>m.equipId||m.mechanicId).length ? _ntMachines.filter(m=>m.equipId||m.mechanicId) : null,
    speed_kmh: speed,
    water_per_ha: waterPerHa,
    method,
    due_date: dueDate,
    status: initialStatus,
  };

  const r = await fetch('/api/tasks', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  if(!r.ok) {
    try { const e = await r.json(); alert('Ошибка: '+e.error); } catch{ alert('Ошибка сохранения'); }
    return;
  }

  // ══ Автосписание со склада при наличии препаратов ══
  if(_newTaskChems.length) {
    try {
      let warehouse;
      try {
        const orchState = await fetch('/api/state/orchard',{headers:getAuthHeaders()}).then(r=>r.json());
        warehouse = orchState.data?.warehouse;
      } catch(e) {}
      if(!warehouse?.chemicals) warehouse = S.warehouse;
      if(!warehouse) warehouse = { chemicals:[], parts:[], seeds:[], history:[] };

      let anySpent = false;
      _newTaskChems.forEach(c => {
        const doseNum = parseFloat(c.dose_actual)||0;
        if(!doseNum) return;
        const ha = totalHa||1;
        const spent = Math.round(doseNum*ha*1000)/1000;
        let stock = warehouse.chemicals?.find(x=>x.name.toLowerCase()===c.name.toLowerCase());
        if(!stock) stock = warehouse.chemicals?.find(x=>x.name.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]));
        if(stock) {
          stock.qty = Math.round(Math.max(0,stock.qty-spent)*1000)/1000;
        }
        if(!warehouse.history) warehouse.history=[];
        warehouse.history.unshift({
          id:uid(), date:dueDate||today(), type:'chemical', name:c.name,
          operation:'out', qty:spent, unit:stock?.unit||'л',
          price:stock?.price||0, total:Math.round(spent*(stock?.price||0)),
          parcelName: parcelName||'Сад',
          note:`${wtName}${eqName?' · '+eqName:''}${meName?' · '+meName:''}`
        });
        anySpent = true;
      });

      if(anySpent) {
        S.warehouse = warehouse;
        save();
        fetch('/api/state/orchard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({warehouse})})
          .catch(e=>console.warn('Warehouse sync failed:', e.message));
      }
    } catch(e) { console.warn('Warehouse deduction failed:', e.message); }

    // ══ Автосоздание записи в Обработках ══
    // (только если вид работы связан с опрыскиванием)
    const wtLower = wtName.toLowerCase();
    if(wtLower.includes('обработка')||wtLower.includes('опрыскив')||wtLower.includes('подкормка')||wtLower.includes('фертиг')) {
      try {
        const products = _newTaskChems.map(c=>({
          catId: c.id, name: c.name,
          type: S.catalog.find(x=>x.id===c.id)?.type||'fungicide',
          dose: c.dose_actual, dur: 14, washMm: 15,
          active: S.catalog.find(x=>x.id===c.id)?.activeSubstance||''
        }));
        const first = products[0];
        const maxDur = 14;
        const endDate = new Date(dueDate||today());
        endDate.setDate(endDate.getDate()+maxDur);
        const cellsTarget = _newTaskParcels.map(p=>p.id);
        const treatment = {
          id: Date.now(),
          date: dueDate||today(),
          product: products.map(p=>p.name).join(' + '),
          products,
          activeSubstance: products.map(p=>p.active).filter(Boolean).join(', '),
          type: first?.type||'fungicide',
          method,
          dose: first?.dose||'',
          water: waterPerHa,
          duration: maxDur, washMm: 15,
          endDate: endDate.toISOString().split('T')[0],
          cellsTarget,
          cellTarget: cellsTarget.length===1?cellsTarget[0]:(cellsTarget.length>1?cellsTarget.join(','):'all'),
          cropId: null,
          varietyTarget: 'all',
          note: `${wtName}${meName?' · '+meName:''}${parcelName?' · '+parcelName:''}`,
          fromTask: true,
        };
        S.treatments.unshift(treatment);
        save();
      } catch(e) { console.warn('Treatment auto-create failed:', e.message); }
    }
  }

  closeModal('modal-new-task');
  renderTasks();
  const whPanel = document.getElementById('panel-warehouse');
  if(whPanel?.classList.contains('active')) renderWarehouse();
}

function openTaskProb(id) {
  document.getElementById('task-prob-id').value = id;
  document.getElementById('task-prob-txt').value = '';
  openModal('modal-task-prob');
}

function openTaskClose(id) {
  document.getElementById('task-close-id').value = id;
  document.getElementById('task-close-name').value = '';
  document.getElementById('task-close-note').value = '';
  openModal('modal-task-close');
}

async function saveTaskClose() {
  const id = document.getElementById('task-close-id').value;
  const name = document.getElementById('task-close-name').value.trim()||'Агроном';
  const note = document.getElementById('task-close-note').value.trim();
  await updateTaskStatus(id,'closed',{closed_by_name:name,problem_note:note||undefined});
  closeModal('modal-task-close');
}

async function saveTaskProb() {
  const id = document.getElementById('task-prob-id').value;
  const note = document.getElementById('task-prob-txt').value.trim();
  if(!note){alert('Опишите проблему');return;}
  await updateTaskStatus(id,'problem',{problem_note:note});
  closeModal('modal-task-prob');
}

async function openTaskEng(id) {
  const t = _tasks.find(x=>x.id===id);
  if(!t) return;
  if(!_taskStaff.length) {
    try { _taskStaff = await fetch('/api/staff').then(r=>r.json()); } catch(e) { _taskStaff = []; }
  }
  let allEquip = [], attachArr = [];
  try { allEquip = await fetch('/api/equipment').then(r=>r.json()); } catch(e) {}
  try { const at = await fetch('/api/attachments').then(r=>r.json()); attachArr = Array.isArray(at)?at:(at.data||[]); } catch(e) {}
  document.getElementById('task-eng-id').value = id;
  const chems = t.chemicals?(typeof t.chemicals==='string'?JSON.parse(t.chemicals):t.chemicals):[];
  document.getElementById('task-eng-info').innerHTML = `
    <div style="font-weight:700;margin-bottom:4px;">${t.work_type_name||'Работа'}</div>
    <div style="font-size:12px;color:var(--text2);">🌳 ${t.parcel_name||'—'}${t.total_ha?' · '+t.total_ha+' га':''}</div>
    <div style="font-size:12px;color:var(--text2);">👤 ${t.created_by_name||'—'} → ${t.assigned_to_name||'—'}</div>
    ${chems.length?`<div style="font-size:11px;color:var(--text3);margin-top:4px;">💊 ${chems.map(c=>c.name+(c.dose_actual?' '+c.dose_actual:'')).join(', ')}</div>`:''}`;
  document.getElementById('task-eng-equip').innerHTML = '<option value="">— не выбрана —</option>'+allEquip.map(e=>`<option value="${e.id}" data-name="${e.name}">${e.name}${e.status!=='free'?' ⚠️':''}</option>`).join('');
  document.getElementById('task-eng-attach').innerHTML = '<option value="">— не выбрано —</option>'+attachArr.map(a=>`<option value="${a.id}" data-name="${a.name}">${a.name}</option>`).join('');
  document.getElementById('task-eng-mechanic').innerHTML = '<option value="">— не назначен —</option>'+_taskStaff.map(s=>`<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join('');
  document.getElementById('task-eng-speed').value = '';
  document.getElementById('task-eng-note').value = '';
  openModal('modal-task-eng');
}

async function saveTaskEng() {
  const id = document.getElementById('task-eng-id').value;
  const meSel = document.getElementById('task-eng-mechanic');
  const meId = meSel.value;
  const meName = meSel.options[meSel.selectedIndex]?.dataset?.name || meSel.options[meSel.selectedIndex]?.textContent || '';
  if(!meId){alert('Выберите механизатора');return;}
  const eqSel = document.getElementById('task-eng-equip');
  const eqId = eqSel.value;
  const eqName = eqSel.options[eqSel.selectedIndex]?.dataset?.name || '';
  const atSel = document.getElementById('task-eng-attach');
  const atName = atSel.options[atSel.selectedIndex]?.dataset?.name || '';
  await updateTaskStatus(id,'assigned',{
    equipment_id:eqId, equipment_name:eqName,
    attachment:atName,
    mechanic_id:meId, mechanic_name:meName,
    speed_kmh:parseFloat(document.getElementById('task-eng-speed').value)||null,
    note:document.getElementById('task-eng-note').value.trim(),
  });
  closeModal('modal-task-eng');
}

// Маппинг названий работ → тип операции для ГСМ дельты
function _workTypeToOpType(workTypeName) {
  const n = (workTypeName||'').toLowerCase();
  if(n.includes('опрыск') || n.includes('обработ')) return 'spray';
  if(n.includes('пахот') || n.includes('вспашк'))  return 'plow';
  if(n.includes('культив') || n.includes('боронов') || n.includes('диск')) return 'cultivate';
  if(n.includes('транспор') || n.includes('перевоз')) return 'transport';
  return 'other';
}

async function openTaskDone(id) {
  document.getElementById('task-done-id').value = id;
  document.getElementById('task-done-note').value = '';
  const fuelEl = document.getElementById('task-done-fuel');
  if(fuelEl) fuelEl.value = '';

  const task = _tasks.find(t => t.id === id);
  const fuelPlanEl = document.getElementById('task-done-fuel-plan');

  // Заполняем резервуары
  const tankSel = document.getElementById('task-done-tank');
  if(tankSel) {
    const tanks = S.fuel?.tanks || [];
    tankSel.innerHTML = '<option value="">— авто —</option>' +
      tanks.map(t => `<option value="${t.id}">${t.name} · ${FUEL_TYPES[t.fuelType]||t.fuelType} · ${(t.currentL||0).toFixed(0)}л</option>`).join('');
  }

  // Плановый расход
  if(fuelPlanEl && task) {
    const machines = task.machines_json
      ? (typeof task.machines_json==='string' ? JSON.parse(task.machines_json) : task.machines_json) : [];
    const vehicleId = task.equipment_id || machines[0]?.equipId;
    const vehicle = (S.vehicles||[]).find(v => v.id === vehicleId);
    const normField = vehicle?.fuelNormField || 0;
    const planL = normField && task.total_ha ? Math.round(normField * task.total_ha * 100) / 100 : 0;
    fuelPlanEl.textContent = planL > 0
      ? `⛽ План: ${planL} л (${normField} л/га × ${task.total_ha} га)`
      : vehicle ? `⛽ Норма: ${normField||'?'} л/га — укажите факт` : '';
    if(fuelEl && planL > 0) fuelEl.placeholder = planL;
  }
  openModal('modal-task-done');
}

async function saveTaskDone() {
  const id       = document.getElementById('task-done-id').value;
  const note     = document.getElementById('task-done-note').value.trim();
  const factFuel = parseFloat(document.getElementById('task-done-fuel')?.value) || 0;
  const tankIdSel= document.getElementById('task-done-tank')?.value || '';

  await updateTaskStatus(id, 'done', { closed_by_name:'Механизатор', problem_note:note||undefined });

  // ══ Автосписание ГСМ ══
  if(factFuel > 0) {
    try {
      if(!S.fuel) S.fuel = { tanks:[], receipts:[], refuels:[], operations:[], alerts:[] };
      const task = _tasks.find(t => t.id === id);
      const machines = task?.machines_json
        ? (typeof task.machines_json==='string' ? JSON.parse(task.machines_json) : task.machines_json) : [];
      const vehicleId = task?.equipment_id || machines[0]?.equipId || null;
      const vehicle = (S.vehicles||[]).find(v => v.id === vehicleId);
      const fuelType = vehicle?.fuelType || 'diesel';

      // Резервуар — выбранный или первый подходящий
      const tank = (tankIdSel && S.fuel.tanks.find(t=>t.id===tankIdSel))
        || S.fuel.tanks.find(t => t.fuelType===fuelType && (t.currentL||0) > 0)
        || S.fuel.tanks[0];

      if(tank) {
        tank.currentL = Math.round(Math.max(0, (tank.currentL||0) - factFuel) * 100) / 100;
      }

      // Плановый расход
      const normField = vehicle?.fuelNormField || 0;
      const planL = normField && task?.total_ha ? Math.round(normField * task.total_ha * 100) / 100 : null;
      const delta = planL && factFuel ? Math.round((factFuel - planL) * 100) / 100 : null;
      const deltaPct = planL && factFuel ? Math.round((factFuel - planL) / planL * 1000) / 10 : null;

      const opType = _workTypeToOpType(task?.work_type_name);

      const op = {
        id: uid(),
        date: today(),
        vehicleId,
        operationType: opType,
        operator: task?.mechanic_name || task?.assigned_to_name || '',
        cellKeys: task?.parcels_json ? task.parcels_json.map(p=>p.id||p.name) : [],
        areaHa: task?.total_ha || 0,
        fuelPlanTotal: planL,
        fuelFactTotal: factFuel,
        fuelDelta: delta,
        deltaPercent: deltaPct,
        pricePerL: 0,
        costTotal: 0,
        distribution: [],
        source: 'task',
        taskId: id,
        note: `Задание: ${task?.work_type_name||''}${task?.parcel_name?' · '+task.parcel_name:''}`,
      };
      S.fuel.operations.unshift(op);

      // Алерт при превышении дельты
      if(deltaPct !== null) {
        const limit = _getFuelDeltaLimit(vehicleId, opType);
        if(Math.abs(deltaPct) > limit) {
          S.fuel.alerts.push({
            id: uid(), date: op.date, vehicleId, vehicleName: vehicle?.name||'',
            operationType: opType, cellKeys: op.cellKeys,
            fuelPlan: planL, fuelFact: factFuel, delta, deltaPercent: deltaPct,
            limit, resolved: false, resolvedNote: null,
          });
        }
      }

      save();
      console.log('[saveTaskDone] ГСМ списано:', factFuel, 'л из', tank?.name, '| план:', planL, 'л | δ:', deltaPct, '%');
    } catch(e) {
      console.warn('[saveTaskDone] Ошибка списания ГСМ:', e.message);
    }
  }

  closeModal('modal-task-done');
}

// ═══ ПОСЕВНАЯ ═══════════════════════════════════════════════════════════
let _sowView = 'parcels';
let _editSowId = null;

function setSowView(v) {
  _sowView = v;
  ['parcels','table'].forEach(x => {
    document.getElementById('sv-'+x)?.classList.toggle('active', x===v);
    const el = document.getElementById('sow-'+x+'-view');
    if(el) el.style.display = x===v ? '' : 'none';
  });
  renderSowing();
}

function renderSowing() {
  if (!S.sowingRecords) S.sowingRecords = [];

  // Populate crop filter
  const cf = document.getElementById('sow-crop-filter');
  const curCf = cf?.value || '';
  if(cf) {
    cf.innerHTML = '<option value="">Все культуры</option>';
    const crops = [...new Set(S.parcels.map(p=>p.cropId).filter(Boolean))];
    crops.forEach(cid => {
      const c = getCropById(cid);
      if(c) cf.innerHTML += `<option value="${cid}" ${curCf===cid?'selected':''}>${c.emoji} ${c.name}</option>`;
    });
  }

  // KPIs
  const totalHa = S.parcels.reduce((s,p) => s + parseFloat(p.ha||0), 0);
  const sownParcels = S.parcels.filter(p => p.sowingDate).length;
  const totalSeeds = S.sowingRecords.reduce((s,r) => s + (r.totalKg||0), 0);
  const totalYieldPlan = S.parcels.reduce((s,p) => s + (p.yieldPlan&&p.ha ? p.yieldPlan*p.ha : 0), 0);
  const totalYieldFact = S.parcels.reduce((s,p) => s + (p.yieldFact&&p.ha ? p.yieldFact*p.ha : 0), 0);
  document.getElementById('sowing-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-val">${S.parcels.length}</div><div class="kpi-lbl">Всего участков</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--accent);">${sownParcels}</div><div class="kpi-lbl">Засеяно</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--text3);">${S.parcels.length-sownParcels}</div><div class="kpi-lbl">Не засеяно</div></div>
    <div class="kpi-card"><div class="kpi-val">${totalHa.toFixed(1)}</div><div class="kpi-lbl">Всего га</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--blue);">${totalSeeds.toFixed(0)}</div><div class="kpi-lbl">Семян списано (кг/п.е.)</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--blue);">${totalYieldPlan.toFixed(1)}</div><div class="kpi-lbl">План урожай (т)</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--accent);">${totalYieldFact>0?totalYieldFact.toFixed(1):'—'}</div><div class="kpi-lbl">Факт урожай (т)</div></div>`;

  const cropFilter = cf?.value || '';
  let parcels = S.parcels.filter(p => !cropFilter || p.cropId === cropFilter);

  if (_sowView === 'parcels') {
    const grid = document.getElementById('sow-parcels-grid');
    if (!parcels.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3);">
        <div style="font-size:32px;margin-bottom:10px;">🌱</div>
        <div>Нет участков. Добавьте участки в разделе 🗺 Участки.</div>
      </div>`;
      return;
    }

    const METH = {seeder:'🚜 Сеялка',manual:'🤲 Вручную',transplant:'🪴 Рассада',broadcast:'🌾 Разброс'};
    const UNIT = {kg:'кг',pe:'п.е.',bag:'мешок',dose:'доза'};

    grid.innerHTML = parcels.map(parcel => {
      const crop = getCropById(parcel.cropId);
      const phase = getParcelPhase(parcel);
      const gdd = Math.round(calcParcelGdd(parcel));
      // Найти запись посева
      const sowRec = S.sowingRecords.find(r=>r.parcelId===parcel.id);
      const _sowD = normalizeDate(sowRec?.date || parcel.sowingDate) || '1900-01-01';
      const daysFromSowing = S.weather.filter(w=>(normalizeDate(w.date)||w.date)>=_sowD).length;
      const avgDailyGdd = daysFromSowing > 0 ? gdd/daysFromSowing : 0;
      const harvestGdd = parcel.harvestGdd || crop?.gddToHarvest || 0;
      const remainGdd = Math.max(0, harvestGdd - gdd);
      const daysToHarvest = avgDailyGdd > 0 ? Math.round(remainGdd/avgDailyGdd) : null;
      const field = (S.fields||[]).find(f=>f.id===parcel.fieldId);

      // Найти семена на складе
      const seed = sowRec ? S.warehouse?.seeds?.find(s=>s.id===sowRec.seedStockId) : null;
      // Проверить остаток семян
      const sowDate = normalizeDate(sowRec?.date || parcel.sowingDate) || '—';

      const statusColor = !(sowRec?.date || parcel.sowingDate) ? 'var(--text3)' : gdd > harvestGdd*0.9 ? 'var(--accent)' : phase ? phase.color : 'var(--text2)';
      const hasSowing = !!(sowRec?.date || parcel.sowingDate);

      return `<div style="background:var(--surface);border:1px solid ${hasSowing?'rgba(107,221,107,.25)':'var(--border)'};border-radius:12px;padding:16px;border-left:4px solid ${statusColor};">
        <!-- Заголовок -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <div>
            <div style="font-size:13px;font-weight:700;">${parcel.name}</div>
            <div style="font-size:10px;color:var(--text3);">${field?'📍 '+field.name:''}</div>
          </div>
          <div style="font-family:'Unbounded',sans-serif;font-size:14px;font-weight:700;color:var(--accent);">${parcel.ha} га</div>
        </div>

        <!-- Культура -->
        ${crop ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:6px 10px;background:var(--surface2);border-radius:8px;">
          <span style="font-size:18px;">${crop.emoji}</span>
          <div>
            <div style="font-size:12px;font-weight:600;">${crop.name}${parcel.variety?' · <span style="color:var(--accent);">'+parcel.variety+'</span>':''}</div>
            ${hasSowing?`<div style="font-size:10px;color:var(--text3);">📅 Посев: ${sowDate}</div>`:'<div style="font-size:10px;color:var(--yellow);">⚠️ Дата посева не указана</div>'}
          </div>
        </div>` : `<div style="padding:8px;background:var(--surface2);border-radius:8px;font-size:11px;color:var(--text3);margin-bottom:8px;">Культура не выбрана</div>`}

        <!-- GDD и фаза -->
        ${hasSowing && crop ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;font-size:11px;">
          <div style="padding:5px 8px;background:var(--surface2);border-radius:6px;">
            <div style="font-size:9px;color:var(--text3);">ФАЗА</div>
            <div style="color:${phase?.color||'var(--text2)'};font-weight:600;">${phase?.name||'—'}</div>
          </div>
          <div style="padding:5px 8px;background:var(--surface2);border-radius:6px;">
            <div style="font-size:9px;color:var(--text3);">GDD</div>
            <div style="font-family:'JetBrains Mono',monospace;color:var(--accent);font-weight:700;">${gdd} / ${harvestGdd}</div>
          </div>
          ${daysToHarvest!==null?`<div style="padding:5px 8px;background:var(--surface2);border-radius:6px;grid-column:1/-1;">
            <div style="font-size:9px;color:var(--text3);">ДО УБОРКИ</div>
            <div style="color:${daysToHarvest<=7?'var(--accent)':daysToHarvest<=14?'var(--yellow)':'var(--text2)'};font-weight:600;">${daysToHarvest<=7?'🌾 ':''} ~${daysToHarvest} дней</div>
          </div>`:''}
        </div>` : ''}

        <!-- Семена -->
        ${sowRec ? `<div style="padding:6px 10px;background:rgba(85,170,255,.08);border:1px solid rgba(85,170,255,.2);border-radius:8px;font-size:11px;margin-bottom:8px;">
          <div style="color:var(--blue);font-weight:600;margin-bottom:2px;">🌱 Семена: ${seed?seed.variety:'—'}</div>
          <div style="color:var(--text2);">Норма: ${sowRec.rate} ${sowRec.rateUnit||'кг/га'} · Итого: <strong>${sowRec.totalKg.toFixed(1)} ${UNIT[seed?.unit]||'кг'}</strong></div>
          ${sowRec.method?`<div style="color:var(--text3);">${METH[sowRec.method]||sowRec.method}</div>`:''}
        </div>` : crop ? `<div style="padding:6px 10px;background:var(--surface2);border-radius:8px;font-size:11px;color:var(--text3);margin-bottom:8px;">
          Посев не записан
        </div>` : ''}

        <!-- Урожайность -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
          <div style="padding:6px 10px;background:var(--surface2);border-radius:8px;">
            <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">📊 План т/га</div>
            <div style="font-size:13px;font-weight:700;color:var(--blue);">${parcel.yieldPlan||'—'}</div>
            ${parcel.yieldPlan&&parcel.ha?`<div style="font-size:10px;color:var(--text3);">= ${(parcel.yieldPlan*parcel.ha).toFixed(1)} т</div>`:''}
          </div>
          <div style="padding:6px 10px;background:var(--surface2);border-radius:8px;">
            <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">✅ Факт т/га</div>
            <div style="font-size:13px;font-weight:700;color:${parcel.yieldFact?'var(--accent)':'var(--text3)'};">${parcel.yieldFact||'—'}</div>
            ${parcel.yieldFact&&parcel.ha?`<div style="font-size:10px;color:var(--text3);">= ${(parcel.yieldFact*parcel.ha).toFixed(1)} т</div>`:''}
          </div>
        </div>

        <!-- Кнопка -->
        <button class="btn btn-secondary btn-sm" style="width:100%;" onclick="openSowingModal('${parcel.id}')">
          ${sowRec ? '✏️ Редактировать посев' : '+ Записать посев'}
        </button>
      </div>`;
    }).join('');

  } else {
    // Table view
    const METH = {seeder:'🚜',manual:'🤲',transplant:'🪴',broadcast:'🌾'};
    const UNIT = {kg:'кг',pe:'п.е.',bag:'мешок',dose:'доза'};
    const tbody = document.getElementById('sow-tbody');
    if (!parcels.length) {
      tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:20px;">Нет участков</td></tr>';
      return;
    }
    tbody.innerHTML = parcels.map(parcel => {
      const crop = getCropById(parcel.cropId);
      const phase = getParcelPhase(parcel);
      const gdd = Math.round(calcParcelGdd(parcel));
      const avgDailyGdd = (() => {
        const _tSowRec = (S.sowingRecords||[]).find(r=>r.parcelId===parcel.id);
        const sow = normalizeDate(_tSowRec?.date || parcel.sowingDate) || '1900-01-01';
        const days = S.weather.filter(w=>(normalizeDate(w.date)||w.date)>=sow).length;
        return days > 0 ? gdd/days : 0;
      })();
      const harvestGdd = parcel.harvestGdd || crop?.gddToHarvest || 0;
      const remainGdd = Math.max(0, harvestGdd - gdd);
      const daysToHarvest = avgDailyGdd > 0 ? Math.round(remainGdd/avgDailyGdd) : '—';
      const field = (S.fields||[]).find(f=>f.id===parcel.fieldId);
      const sowRec = S.sowingRecords.find(r=>r.parcelId===parcel.id);
      const seed = sowRec ? S.warehouse?.seeds?.find(s=>s.id===sowRec.seedStockId) : null;
      const sowDate = normalizeDate(parcel.sowingDate) || '—';

      return `<tr>
        <td style="font-weight:600;">${parcel.name}</td>
        <td style="font-size:11px;color:var(--text3);">${field?.name||'—'}</td>
        <td>${crop?crop.emoji+' '+crop.name:'—'}</td>
        <td style="color:var(--accent);">${parcel.variety||'—'}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;${!parcel.sowingDate?'color:var(--yellow);':''}">
          ${sowDate}
        </td>
        <td style="font-family:'JetBrains Mono',monospace;">${parcel.ha}</td>
        <td style="font-size:11px;color:var(--blue);">${seed?seed.variety:'—'}</td>
        <td style="font-size:11px;">${sowRec?sowRec.rate+' '+(sowRec.rateUnit||'кг/га'):'—'}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--accent);">${sowRec?sowRec.totalKg.toFixed(1)+' '+(UNIT[seed?.unit]||'кг'):'—'}</td>
        <td><span style="font-size:10px;padding:2px 7px;border-radius:8px;background:${phase?phase.color+'22':'var(--surface2)'};color:${phase?.color||'var(--text3)'};">${phase?.name||'—'}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent);">${gdd}</td>
        <td style="font-size:11px;color:${daysToHarvest<=7?'var(--accent)':daysToHarvest<=14?'var(--yellow)':'var(--text3)'};">
          ${daysToHarvest!=='—'?(daysToHarvest<=7?'🌾 ':'')+daysToHarvest+' дн':'—'}
        </td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--blue);font-weight:600;">${parcel.yieldPlan||'—'}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--blue);">${parcel.yieldPlan&&parcel.ha?(parcel.yieldPlan*parcel.ha).toFixed(1)+' т':'—'}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--accent);font-weight:600;">${parcel.yieldFact||'—'}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--accent);">${parcel.yieldFact&&parcel.ha?(parcel.yieldFact*parcel.ha).toFixed(1)+' т':'—'}</td>
        <td><button class="btn btn-secondary btn-xs" onclick="openSowingModal('${parcel.id}')">✏️</button></td>
      </tr>`;
    }).join('');
  }
}

function openSowingModal(parcelId) {
  _editSowId = null;
  if (!S.sowingRecords) S.sowingRecords = [];
  if (!S.warehouse) S.warehouse = {chemicals:[],parts:[],seeds:[],history:[]};
  if (!S.warehouse.seeds) S.warehouse.seeds = [];

  // Populate parcel select
  const psel = document.getElementById('sow-parcel');
  psel.innerHTML = '<option value="">— выбрать —</option>';
  S.parcels.forEach(p => {
    const c = getCropById(p.cropId);
    psel.innerHTML += `<option value="${p.id}" ${parcelId===p.id?'selected':''}>${p.name}${c?' · '+c.emoji:''}</option>`;
  });

  document.getElementById('sow-date').value = today();
  document.getElementById('sow-rate').value = '';
  document.getElementById('sow-depth').value = '';
  document.getElementById('sow-note').value = '';
  document.getElementById('sow-delete-btn').style.display = 'none';
  document.getElementById('sow-stock-warning').style.display = 'none';
  document.getElementById('sow-modal-title').textContent = '🌱 Записать посев';

  if (parcelId) {
    psel.value = parcelId;
    onSowParcelChange();
    // Check if existing record
    const existing = S.sowingRecords.find(r=>r.parcelId===parcelId);
    if (existing) {
      _editSowId = existing.id;
      document.getElementById('sow-modal-title').textContent = '✏️ Редактировать посев';
      document.getElementById('sow-delete-btn').style.display = 'block';
      document.getElementById('sow-date').value = existing.date || today();
      document.getElementById('sow-rate').value = existing.rate || '';
      document.getElementById('sow-depth').value = existing.depth || '';
      document.getElementById('sow-method').value = existing.method || 'seeder';
      document.getElementById('sow-note').value = existing.note || '';
      setTimeout(() => {
        document.getElementById('sow-seed-stock').value = existing.seedStockId || '';
        updateSowTotal();
      }, 100);
    }
  }

  openModal('modal-sowing');
}

function onSowParcelChange() {
  const parcelId = document.getElementById('sow-parcel').value;
  const parcel = S.parcels.find(p=>p.id===parcelId);
  const crop = getCropById(parcel?.cropId);

  document.getElementById('sow-crop-display').textContent = crop ? crop.emoji+' '+crop.name : '—';
  // Show variety from catalog if linked, else from parcel text
  const parcelVariety = (S.varieties||[]).find(v=>v.id===parcel?.varietyId);
  document.getElementById('sow-variety-display').textContent = parcelVariety?.name || parcel?.variety || '—';
  document.getElementById('sow-ha-display').textContent = parcel ? parcel.ha+' га' : '—';

  // Set sowing date from parcel if available
  if (parcel?.sowingDate) {
    document.getElementById('sow-date').value = normalizeDate(parcel.sowingDate) || today();
  }

  // Populate seed stock filtered by crop
  const ssel = document.getElementById('sow-seed-stock');
  ssel.innerHTML = '<option value="">— не списывать —</option>';
  const seeds = (S.warehouse?.seeds || []).filter(s => !crop || s.cropId === parcel?.cropId || s.cropId === 'other');
  seeds.forEach(s => {
    const CROP_NAMES = {pea:'🫛 Горошек',sweet_corn:'🌽 Кукуруза',tomato:'🍅 Томат',cucumber:'🥒 Огурец',pepper:'🫑 Перец',onion:'🧅 Лук',other:'Другое'};
    const UNIT = {kg:'кг',pe:'п.е.',bag:'мешок',dose:'доза'};
    ssel.innerHTML += `<option value="${s.id}">${s.variety} · ${s.qty} ${UNIT[s.unit]||s.unit} · ${CROP_NAMES[s.cropId]||s.cropId}</option>`;
  });

  // Set default rate from seed stock if matches
  if (crop && seeds.length) {
    const matchSeed = seeds.find(s => s.cropId === parcel?.cropId && s.rate);
    if (matchSeed) {
      document.getElementById('sow-rate').value = matchSeed.rate || '';
    }
  }
  updateSowTotal();
}

function updateSowTotal() {
  const parcelId = document.getElementById('sow-parcel').value;
  const parcel = S.parcels.find(p=>p.id===parcelId);
  const ha = parseFloat(parcel?.ha) || 0;
  const rate = parseFloat(document.getElementById('sow-rate').value) || 0;
  const total = ha * rate;
  document.getElementById('sow-total-display').textContent = total > 0 ? total.toFixed(1) : '—';

  // Check stock
  const seedId = document.getElementById('sow-seed-stock').value;
  const warn = document.getElementById('sow-stock-warning');
  if (seedId && total > 0) {
    const seed = S.warehouse?.seeds?.find(s=>s.id===seedId);
    if (seed && seed.qty < total) {
      warn.style.display = 'block';
      warn.textContent = `⚠️ На складе только ${seed.qty} ${seed.unit||'кг'}, нужно ${total.toFixed(1)} — недостаточно!`;
    } else {
      warn.style.display = 'none';
    }
  } else {
    warn.style.display = 'none';
  }
}

function saveSowingRecord() {
  const parcelId = document.getElementById('sow-parcel').value;
  if (!parcelId) { alert('Выберите участок'); return; }
  const date = document.getElementById('sow-date').value;
  if (!date) { alert('Введите дату посева'); return; }
  const rate = parseFloat(document.getElementById('sow-rate').value) || 0;
  const parcel = S.parcels.find(p=>p.id===parcelId);
  const ha = parseFloat(parcel?.ha) || 0;
  const totalKg = Math.round(ha * rate * 100) / 100;
  const seedStockId = document.getElementById('sow-seed-stock').value;
  const method = document.getElementById('sow-method').value;

  if (!S.sowingRecords) S.sowingRecords = [];

  // Если редактируем — сначала вернуть старые семена (если были)
  if (_editSowId) {
    const old = S.sowingRecords.find(r=>r.id===_editSowId);
    if (old?.seedStockId && old.totalKg) {
      const seed = S.warehouse?.seeds?.find(s=>s.id===old.seedStockId);
      if (seed) seed.qty = Math.round((seed.qty + old.totalKg) * 1000) / 1000;
    }
    S.sowingRecords = S.sowingRecords.filter(r=>r.id!==_editSowId);
  }

  // Списать семена
  if (seedStockId && totalKg > 0) {
    const seed = S.warehouse?.seeds?.find(s=>s.id===seedStockId);
    if (seed) {
      seed.qty = Math.round(Math.max(0, seed.qty - totalKg) * 1000) / 1000;
      // Добавить в историю склада
      if (!S.warehouse.history) S.warehouse.history = [];
      S.warehouse.history.unshift({
        id: uid(), date, type: 'seed',
        name: seed.variety + ' · ' + seed.cropId,
        operation: 'out', qty: totalKg, unit: seed.unit || 'кг',
        price: seed.price || 0,
        total: Math.round(totalKg * (seed.price||0) * 10000)/10000,
        parcelName: parcel?.name || '—', note: 'Посев'
      });
    }
  }

  // Получить rateUnit из семян
  const seedStock = S.warehouse?.seeds?.find(s=>s.id===seedStockId);
  const rateUnitMap = {'kg/ha':'кг/га','pe/ha':'п.е./га','bag/ha':'мешок/га'};
  const rateUnit = seedStock?.rateUnit ? (rateUnitMap[seedStock.rateUnit]||seedStock.rateUnit) : 'кг/га';

  const record = {
    id: _editSowId || uid(),
    parcelId, date, rate, totalKg, seedStockId,
    rateUnit,
    method,
    depth: parseFloat(document.getElementById('sow-depth').value)||null,
    note: document.getElementById('sow-note').value.trim(),
  };
  S.sowingRecords.push(record);

  // Обновить дату посева в участке
  parcel.sowingDate = date;

  save();
  if (_vServerAvailable) {
    fetch('/api/state/vegetable', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ sowingRecords: S.sowingRecords, warehouse: S.warehouse, parcels: S.parcels })
    }).catch(e => console.warn('Sowing sync failed:', e));
  }
  closeModal('modal-sowing');
  renderSowing();
  renderParcels();
}

function deleteSowingRecord() {
  if (!_editSowId || !confirm('Удалить запись посева?')) return;
  const old = S.sowingRecords.find(r=>r.id===_editSowId);
  // Вернуть семена
  if (old?.seedStockId && old.totalKg) {
    const seed = S.warehouse?.seeds?.find(s=>s.id===old.seedStockId);
    if (seed) seed.qty = Math.round((seed.qty + old.totalKg) * 1000) / 1000;
  }
  S.sowingRecords = S.sowingRecords.filter(r=>r.id!==_editSowId);
  save();
  closeModal('modal-sowing');
  renderSowing();
}

function exportSowing() {
  const rows = [['Участок','Поле','Культура','Сорт','Дата посева','Площадь га','Семена','Норма','Итого','Метод','Глубина','План т/га','План т','Факт т/га','Факт т','Примечание']];
  S.parcels.forEach(parcel => {
    const crop = getCropById(parcel.cropId);
    const field = (S.fields||[]).find(f=>f.id===parcel.fieldId);
    const sowRec = (S.sowingRecords||[]).find(r=>r.parcelId===parcel.id);
    const seed = sowRec ? S.warehouse?.seeds?.find(s=>s.id===sowRec.seedStockId) : null;
    const METH = {seeder:'Сеялка',manual:'Вручную',transplant:'Рассада',broadcast:'Разброс'};
    rows.push([
      parcel.name, field?.name||'—', crop?crop.name:'—', parcel.variety||'—',
      normalizeDate(parcel.sowingDate)||'—', parcel.ha,
      seed?seed.variety:'—',
      sowRec?sowRec.rate+' '+(sowRec.rateUnit||'кг/га'):'—',
      sowRec?sowRec.totalKg.toFixed(1):'—',
      sowRec?METH[sowRec.method]||sowRec.method:'—',
      sowRec?.depth||'—',
      parcel.yieldPlan||'—',
      parcel.yieldPlan&&parcel.ha?(parcel.yieldPlan*parcel.ha).toFixed(1):'—',
      parcel.yieldFact||'—',
      parcel.yieldFact&&parcel.ha?(parcel.yieldFact*parcel.ha).toFixed(1):'—',
      sowRec?.note||'—'
    ]);
  });
  const csv = rows.map(r=>r.join(';')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = 'posevnaya_'+today()+'.csv';
  a.click();
}

// ═══ СЕБЕСТОИМОСТЬ ОБРАБОТОК ══════════════════════════════════════════════
function showTreatmentCost() {
  const el = document.getElementById('treatment-cost-report');
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }

  if (!S.treatments.length) {
    el.innerHTML = '<div style="padding:12px 16px;background:var(--surface2);border-radius:10px;font-size:12px;color:var(--text3);">Нет обработок для расчёта</div>';
    el.style.display = 'block';
    return;
  }

  // Собрать данные по участкам
  const byParcel = {};
  S.treatments.forEach(t => {
    const pid = t.parcelId || 'unknown';
    if (!byParcel[pid]) byParcel[pid] = {
      parcelName: t.parcelName || '—',
      ha: S.parcels.find(p=>p.id===pid)?.ha || 0,
      cropId: t.cropId,
      treatments: [],
      totalCost: 0,
    };
    // Считать стоимость каждого препарата
    let treatCost = 0;
    const products = (t.products || []).map(p => {
      const catItem = S.catalog.find(c => c.id === p.catId || c.name.toLowerCase() === p.name?.toLowerCase());
      const stockItem = S.warehouse?.chemicals?.find(c => c.catId === catItem?.id || c.name.toLowerCase() === p.name?.toLowerCase());
      const price = stockItem?.price || catItem?.price || 0;
      const doseNum = parseFloat(p.dose) || 0;
      const ha = S.parcels.find(x=>x.id===pid)?.ha || 1;
      const cost = Math.round(price * doseNum * ha * 10000) / 10000;
      treatCost += cost;
      return { name: p.name, dose: p.dose, price, cost, ha };
    });
    byParcel[pid].treatments.push({ ...t, products, treatCost });
    byParcel[pid].totalCost += treatCost;
  });

  // Итого по всем
  const grandTotal = Object.values(byParcel).reduce((s,p) => s + p.totalCost, 0);
  const totalHa = Object.values(byParcel).reduce((s,p) => s + (p.ha||0), 0);

  const TYPE_COLORS = {fungicide:'var(--teal)',insecticide:'var(--orange)',herbicide:'var(--yellow)',fertilizer:'var(--accent)',acaricide:'var(--purple)',other:'var(--text3)'};
  const TYPE_LABELS = {fungicide:'Фунг',insecticide:'Инсект',herbicide:'Герб',fertilizer:'Удобр',acaricide:'Акар',other:'Др'};

  let html = `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
    <div style="padding:12px 16px;background:var(--surface2);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <div style="font-family:'Unbounded',sans-serif;font-size:12px;font-weight:700;color:var(--accent);">💰 Себестоимость обработок</div>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
        <div style="text-align:center;">
          <div style="font-family:'Unbounded',sans-serif;font-size:16px;font-weight:700;color:var(--accent);">${formatPrice(grandTotal)}</div>
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;">Итого все участки</div>
        </div>
        ${totalHa>0?`<div style="text-align:center;">
          <div style="font-family:'Unbounded',sans-serif;font-size:16px;font-weight:700;color:var(--blue);">${formatPrice(grandTotal/totalHa)}</div>
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;">На гектар</div>
        </div>`:''}
        <button class="btn btn-secondary btn-sm" onclick="exportTreatmentCost()">📊 Экспорт</button>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('treatment-cost-report').style.display='none'">✕</button>
      </div>
    </div>

    <!-- Сводная таблица по участкам -->
    <div style="overflow-x:auto;">
    <table class="data-table">
      <thead><tr>
        <th>Участок</th><th>Культура</th><th>Га</th>
        <th>Обработок</th><th>Итого ${getCurrencySymbol()}</th><th>${getCurrencySymbol()}/га</th>
        <th>Фунг</th><th>Инсект</th><th>Удобр</th><th>Прочее</th>
      </tr></thead>
      <tbody>
        ${Object.entries(byParcel).map(([pid, data]) => {
          const crop = getCropById(data.cropId);
          // По типам
          const byType = {};
          data.treatments.forEach(t => {
            (t.products||[]).forEach(p => {
              const cat = S.catalog.find(c=>c.name.toLowerCase()===p.name?.toLowerCase());
              const type = cat?.type || p.type || 'other';
              const cost = p.cost || 0;
              byType[type] = (byType[type]||0) + cost;
            });
          });
          const perHa = data.ha > 0 ? data.totalCost / data.ha : 0;
          return `<tr>
            <td style="font-weight:600;">${data.parcelName}</td>
            <td style="font-size:11px;">${crop?crop.emoji+' '+crop.name:'—'}</td>
            <td style="font-family:'JetBrains Mono',monospace;">${data.ha}</td>
            <td style="font-family:'JetBrains Mono',monospace;">${data.treatments.length}</td>
            <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--accent);">${formatPrice(data.totalCost)}</td>
            <td style="font-family:'JetBrains Mono',monospace;color:var(--blue);">${formatPrice(perHa)}</td>
            <td style="font-size:11px;color:var(--teal);">${byType.fungicide?formatPrice(byType.fungicide):'—'}</td>
            <td style="font-size:11px;color:var(--orange);">${byType.insecticide?formatPrice(byType.insecticide):'—'}</td>
            <td style="font-size:11px;color:var(--accent);">${byType.fertilizer?formatPrice(byType.fertilizer):'—'}</td>
            <td style="font-size:11px;color:var(--text3);">${(byType.herbicide||0)+(byType.acaricide||0)+(byType.other||0)>0?formatPrice((byType.herbicide||0)+(byType.acaricide||0)+(byType.other||0)):'—'}</td>
          </tr>`;
        }).join('')}
        <tr style="background:var(--surface2);font-weight:700;">
          <td colspan="4" style="color:var(--text2);">ИТОГО</td>
          <td style="font-family:'JetBrains Mono',monospace;color:var(--accent);">${formatPrice(grandTotal)}</td>
          <td style="font-family:'JetBrains Mono',monospace;color:var(--blue);">${totalHa>0?formatPrice(grandTotal/totalHa):'—'}</td>
          <td colspan="4"></td>
        </tr>
      </tbody>
    </table>
    </div>

    <!-- Детализация по участкам -->
    <div style="padding:16px;">
      <div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">Детализация по обработкам</div>
      ${Object.entries(byParcel).map(([pid, data]) => `
      <div style="margin-bottom:16px;background:var(--surface2);border-radius:10px;overflow:hidden;">
        <div style="padding:10px 14px;background:var(--surface3);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div style="font-size:13px;font-weight:700;">${data.parcelName} <span style="font-size:10px;color:var(--text3);">${data.ha} га</span></div>
          <div style="font-family:'Unbounded',sans-serif;font-size:14px;font-weight:700;color:var(--accent);">${formatPrice(data.totalCost)}</div>
        </div>
        <table class="data-table" style="font-size:11px;">
          <thead><tr>
            <th>Дата</th><th>Препарат</th><th>Тип</th><th>Доза</th><th>Цена/${getCurrencySymbol()}</th><th>Га</th><th>Сумма</th>
          </tr></thead>
          <tbody>
            ${data.treatments.map(t => t.products.map((p,i) => {
              const cat = S.catalog.find(c=>c.name.toLowerCase()===p.name?.toLowerCase());
              const type = cat?.type || p.type || 'other';
              return `<tr>
                ${i===0?`<td rowspan="${t.products.length}" style="font-family:'JetBrains Mono',monospace;vertical-align:middle;">${t.date}</td>`:''}
                <td style="font-weight:500;">${p.name||'—'}</td>
                <td><span style="font-size:9px;padding:1px 6px;border-radius:8px;background:${TYPE_COLORS[type]||'var(--surface3)'}22;color:${TYPE_COLORS[type]||'var(--text3)'};">${TYPE_LABELS[type]||type}</span></td>
                <td style="color:var(--text2);">${p.dose||'—'}</td>
                <td style="color:var(--text3);">${p.price?formatPrice(p.price)+'/'+((cat?.unit)||'л'):'нет цены'}</td>
                <td style="font-family:'JetBrains Mono',monospace;">${p.ha||data.ha}</td>
                <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${p.cost>0?'var(--accent)':'var(--text3)'};">${p.cost>0?formatPrice(p.cost):'—'}</td>
              </tr>`;
            }).join('')).join('')}
            <tr style="background:var(--surface3);">
              <td colspan="6" style="font-weight:700;color:var(--text2);">Итого ${data.treatments.length} обработок</td>
              <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--accent);">${formatPrice(data.totalCost)}</td>
            </tr>
          </tbody>
        </table>
      </div>`).join('')}
    </div>

    ${grandTotal===0?`<div style="padding:12px 16px;background:rgba(255,216,77,.08);border-top:1px solid var(--border);font-size:11px;color:var(--yellow);">
      ⚠️ Цены не найдены — добавьте цены в 📦 Справочник препаратов или 🏪 Склад
    </div>`:''}
  </div>`;

  el.innerHTML = html;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exportTreatmentCost() {
  const rows = [['Участок','Га','Культура','Дата','Препарат','Тип','Доза','Цена/'+getCurrencySymbol(),'Га','Сумма '+getCurrencySymbol()]];
  S.treatments.forEach(t => {
    const parcel = S.parcels.find(p=>p.id===t.parcelId);
    const crop = getCropById(parcel?.cropId);
    (t.products||[]).forEach(p => {
      const catItem = S.catalog.find(c=>c.name.toLowerCase()===p.name?.toLowerCase());
      const stockItem = S.warehouse?.chemicals?.find(c=>c.name.toLowerCase()===p.name?.toLowerCase());
      const price = stockItem?.price || catItem?.price || 0;
      const doseNum = parseFloat(p.dose) || 0;
      const ha = parcel?.ha || 1;
      const cost = Math.round(price * doseNum * ha * 10000) / 10000;
      rows.push([
        t.parcelName||'—', ha, crop?.name||'—', t.date,
        p.name||'—', catItem?.type||'—', p.dose||'—',
        price||'—', ha, cost||'—'
      ]);
    });
  });
  const csv = rows.map(r=>r.join(';')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = 'sebestoimost_obrabotok_'+today()+'.csv';
  a.click();
}

// ═══ УМНЫЕ РЕКОМЕНДАЦИИ ═══════════════════════════════════════════════════
function renderSmartRecs() {
  const el = document.getElementById('smart-recs');
  if (!el || !S.parcels.length) return;

  const recs = [];
  const forecast = _forecast;
  const today_str = new Date().toISOString().slice(0,10);

  S.parcels.forEach(parcel => {
    const crop = getCropById(parcel.cropId);
    if (!crop) return;
    const phase = getParcelPhase(parcel);
    const gdd = Math.round(calcParcelGdd(parcel));
    const _smRec = (S.sowingRecords||[]).find(r=>r.parcelId===parcel.id);
    const _smSow = normalizeDate(_smRec?.date || parcel.sowingDate) || '1900-01-01';
    const daysFromSowing = S.weather.filter(w=>(normalizeDate(w.date)||w.date)>=_smSow).length;
    const avgDailyGdd = daysFromSowing > 0 ? gdd/daysFromSowing : 1;

    // ── 1. WHI — срок ожидания истекает ──────────────────────────────
    const lastTreatments = S.treatments
      .filter(t => t.parcelId === parcel.id && t.whiDate)
      .sort((a,b) => b.date.localeCompare(a.date));
    const activeWhi = lastTreatments.filter(t => t.whiDate > today_str);
    if (activeWhi.length) {
      const latest = activeWhi[0];
      const daysLeft = Math.ceil((new Date(latest.whiDate) - new Date(today_str)) / 86400000);
      recs.push({
        level: daysLeft <= 3 ? 'critical' : 'watch',
        parcel: parcel.name, crop: crop.emoji,
        icon: '⏳',
        title: `WHI истекает через ${daysLeft} дн — ${latest.whiDate}`,
        body: `Последняя обработка: ${latest.date}. Срок ожидания не истёк — нельзя собирать урожай.`,
        action: daysLeft <= 3 ? 'Убрать урожай только после ' + latest.whiDate : 'Контролировать дату снятия запрета'
      });
    }

    // ── 2. Давно не было обработки ────────────────────────────────────
    const lastTreat = S.treatments.filter(t=>t.parcelId===parcel.id).filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
    if (lastTreat) {
      const daysSince = Math.floor((new Date(today_str) - new Date(lastTreat.date)) / 86400000);
      // Для фунгицидов интервал 10-14 дней критичен
      if (daysSince >= 12 && phase && !['Уборка','Перезревание'].includes(phase.name)) {
        recs.push({
          level: daysSince >= 18 ? 'critical' : 'spray',
          parcel: parcel.name, crop: crop.emoji,
          icon: '💊',
          title: `${daysSince} дней без обработки`,
          body: `Последняя обработка: ${lastTreat.date}. Фаза: ${phase.name}. При длительном перерыве растёт риск болезней.`,
          action: 'Проверить раздел 🦠 Болезни — есть ли активные риски. Рассмотреть профилактическую обработку.'
        });
      }
    }

    // ── 3. Прогноз: оптимальное окно для опрыскивания ────────────────
    if (forecast && lastTreat) {
      const daysSinceTreat = Math.floor((new Date(today_str) - new Date(lastTreat.date)) / 86400000);
      if (daysSinceTreat >= 7) {
        const goodDays = (forecast.time || []).filter((date, i) => {
          const rain = forecast.precipitation_sum[i] || 0;
          const wind = forecast.windspeed_10m_max[i] || 0;
          const tmax = forecast.temperature_2m_max[i] || 0;
          const rainProb = forecast.precipitation_probability_max[i] || 0;
          return rain < 1 && wind < 6 && tmax > 8 && tmax < 30 && rainProb < 30;
        });
        if (goodDays.length > 0 && phase && !['Уборка','Перезревание'].includes(phase.name)) {
          recs.push({
            level: 'watch',
            parcel: parcel.name, crop: crop.emoji,
            icon: '🌤️',
            title: `Окно для опрыскивания: ${goodDays[0].slice(5)}${goodDays[1]?' и '+goodDays[1].slice(5):''}`,
            body: `${daysSinceTreat} дн с последней обработки. Прогноз: ${goodDays.length} дн без дождя и сильного ветра.`,
            action: `Запланировать обработку на ${goodDays[0]}. Проверить наличие препаратов на складе.`
          });
        }
      }
    }

    // ── 4. Прогноз Smith Period ───────────────────────────────────────
    if (forecast && (crop.id === 'tomato' || crop.id === 'potato')) {
      const smithDays = (forecast.time || []).filter((date, i) => {
        const tmin = forecast.temperature_2m_min[i] || 0;
        const hum = forecast.relativehumidity_2m_max[i] || 0;
        return tmin >= 10 && hum >= 80;
      });
      if (smithDays.length >= 2) {
        recs.push({
          level: 'critical',
          parcel: parcel.name, crop: crop.emoji,
          icon: '🟤',
          title: `Smith Period ожидается ${smithDays[0].slice(5)}–${smithDays[smithDays.length-1].slice(5)}`,
          body: `${smithDays.length} дней с T≥10°C и RH≥80% в прогнозе. Условия для Phytophthora infestans.`,
          action: 'Обработать ДО начала Smith Period: Ридомил Голд, Инфинито или Превикур. Профилактика важнее лечения!'
        });
      }
    }

    // ── 5. Прогноз заморозка ─────────────────────────────────────────
    if (forecast) {
      const frostDays = (forecast.time || []).filter((date, i) =>
        (forecast.temperature_2m_min[i] || 0) <= 2
      );
      if (frostDays.length) {
        const tmin = Math.min(...frostDays.map((d,i) => forecast.temperature_2m_min[(forecast.time||[]).indexOf(d)] || 0));
        recs.push({
          level: tmin <= 0 ? 'critical' : 'spray',
          parcel: parcel.name, crop: crop.emoji,
          icon: '❄️',
          title: `Заморозок в прогнозе: ${frostDays[0].slice(5)}, T°мин ${tmin}°C`,
          body: `${crop.name} может пострадать. Фаза: ${phase?.name||'—'}.`,
          action: 'Подготовить укрытие или систему дождевания. Проверить участок утром после заморозка.'
        });
      }
    }

    // ── 6. Приближение уборки ────────────────────────────────────────
    const harvestGdd = parcel.harvestGdd || crop.gddToHarvest || 0;
    const remainGdd = Math.max(0, harvestGdd - gdd);
    const daysToHarvest = avgDailyGdd > 0 ? Math.round(remainGdd / avgDailyGdd) : null;
    if (daysToHarvest !== null && daysToHarvest <= 10 && daysToHarvest > 0) {
      recs.push({
        level: daysToHarvest <= 5 ? 'critical' : 'watch',
        parcel: parcel.name, crop: crop.emoji,
        icon: '🌾',
        title: `До уборки ~${daysToHarvest} дней`,
        body: `GDD накоплено: ${gdd} / ${harvestGdd}. Фаза: ${phase?.name||'—'}.`,
        action: 'Подготовить технику. Проверить WHI всех обработок. Согласовать приёмку с заводом.'
      });
    }

    // ── 7. Нет обработок вообще ──────────────────────────────────────
    if (!lastTreat && gdd > 100 && phase && !['Уборка','Посев','Посадка'].includes(phase.name)) {
      recs.push({
        level: 'watch',
        parcel: parcel.name, crop: crop.emoji,
        icon: '📋',
        title: `Нет записей об обработках`,
        body: `Участок ${parcel.name} — ни одной обработки не записано. Фаза: ${phase.name}, GDD ${gdd}.`,
        action: 'Добавить обработки в раздел 💊 Обработки. Проверить риски болезней.'
      });
    }
  });

  if (!recs.length) {
    el.innerHTML = '';
    return;
  }

  // Сортировка: critical → spray → watch
  const order = {critical:0, spray:1, watch:2};
  recs.sort((a,b) => (order[a.level]||9) - (order[b.level]||9));

  const LEVEL_COLOR = {critical:'var(--red)', spray:'var(--orange)', watch:'var(--yellow)'};
  const LEVEL_BG = {critical:'rgba(255,85,85,.08)', spray:'rgba(255,153,68,.08)', watch:'rgba(255,216,77,.06)'};
  const LEVEL_LABEL = {critical:'❗ Срочно', spray:'⚠️ Важно', watch:'📌 Внимание'};

  el.innerHTML = `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
    <div style="padding:10px 16px;background:var(--surface2);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <div style="font-family:'Unbounded',sans-serif;font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1px;">
        📋 Умные рекомендации · ${recs.length} пунктов
      </div>
      <div style="display:flex;gap:6px;">
        <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(255,85,85,.15);color:var(--red);">${recs.filter(r=>r.level==='critical').length} срочно</span>
        <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(255,153,68,.15);color:var(--orange);">${recs.filter(r=>r.level==='spray').length} важно</span>
      </div>
    </div>
    ${recs.map(r => `
    <div style="padding:12px 16px;border-top:1px solid var(--border);background:${LEVEL_BG[r.level]||''};">
      <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;">
        <span style="font-size:20px;flex-shrink:0;">${r.icon}</span>
        <div style="flex:1;min-width:200px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <span style="font-size:9px;padding:1px 7px;border-radius:8px;background:${LEVEL_COLOR[r.level]}22;color:${LEVEL_COLOR[r.level]};font-weight:700;">${LEVEL_LABEL[r.level]||r.level}</span>
            <span style="font-size:11px;padding:1px 7px;border-radius:8px;background:var(--surface2);color:var(--text2);">${r.crop} ${r.parcel}</span>
          </div>
          <div style="font-size:12px;font-weight:700;color:${LEVEL_COLOR[r.level]};margin-bottom:4px;">${r.title}</div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:6px;">${r.body}</div>
          <div style="padding:6px 10px;background:rgba(136,255,170,.06);border:1px solid rgba(136,255,170,.15);border-radius:6px;font-size:11px;color:var(--accent2);">
            ✅ ${r.action}
          </div>
        </div>
      </div>
    </div>`).join('')}
  </div>`;
}

// ═══ ПЛАН РАБОТ ═══════════════════════════════════════════════════════════
let _wpView = 'week';

function setWpView(v) {
  _wpView = v;
  ['week','season'].forEach(x => {
    document.getElementById('wp-view-'+x)?.classList.toggle('active', x===v);
    const el = document.getElementById('wp-'+x+'-view');
    if (el) el.style.display = x===v ? '' : 'none';
  });
  renderWorkplan();
}

async function loadForecastAndRenderWorkplan() {
  await fetchForecast();
  renderWorkplan();
}

function renderWorkplan() {
  if (_wpView === 'week') renderWpWeek();
  else renderWpSeason();
}

// ── Генерация задач на 7 дней ─────────────────────────────────────────────
function generateWeekTasks() {
  const tasks = [];
  const today_str = new Date().toISOString().slice(0,10);
  const forecast = _forecast;

  // Хорошие дни для опрыскивания из прогноза
  const sprayDays = new Set();
  if (forecast) {
    (forecast.time||[]).forEach((date, i) => {
      const rain = forecast.precipitation_sum[i] || 0;
      const wind = forecast.windspeed_10m_max[i] || 0;
      const tmax = forecast.temperature_2m_max[i] || 0;
      const rainProb = forecast.precipitation_probability_max[i] || 0;
      if (rain < 1 && wind < 6 && tmax > 8 && tmax < 30 && rainProb < 30) sprayDays.add(date);
    });
  }

  S.parcels.forEach(parcel => {
    const crop = getCropById(parcel.cropId);
    if (!crop) return;
    const phase = getParcelPhase(parcel);
    const gdd = Math.round(calcParcelGdd(parcel));
    const _wkSowRec = (S.sowingRecords||[]).find(r=>r.parcelId===parcel.id);
    const _wkSow = normalizeDate(_wkSowRec?.date || parcel.sowingDate) || '1900-01-01';
    const daysFromSowing = S.weather.filter(w=>(normalizeDate(w.date)||w.date)>=_wkSow).length;
    const avgDailyGdd = daysFromSowing > 0 ? gdd/daysFromSowing : 1;
    const harvestGdd = parcel.harvestGdd || crop.gddToHarvest || 0;
    const daysToHarvest = avgDailyGdd > 0 ? Math.round(Math.max(0, harvestGdd - gdd) / avgDailyGdd) : null;

    // Последняя обработка
    const lastTreat = S.treatments.filter(t=>t.parcelId===parcel.id).filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
    const daysSinceTreat = lastTreat ? Math.floor((new Date(today_str) - new Date(lastTreat.date)) / 86400000) : 999;

    // --- WHI истекает в ближайшие 7 дней ---
    S.treatments.filter(t=>t.parcelId===parcel.id && t.whiDate).forEach(t => {
      const d = new Date(t.whiDate);
      const diff = Math.ceil((d - new Date(today_str)) / 86400000);
      if (diff >= 0 && diff <= 7) {
        tasks.push({
          date: t.whiDate,
          priority: diff <= 2 ? 1 : 2,
          type: 'whi',
          icon: '⏳',
          parcel: parcel.name, crop: crop.emoji,
          title: `Снятие WHI — ${parcel.name}`,
          body: `Истекает срок ожидания после ${lastTreat?.products?.map(p=>p.name).join(', ')||'обработки'}. После ${t.whiDate} можно собирать урожай.`,
          color: 'var(--yellow)'
        });
      }
    });

    // --- Нужна обработка (>10 дней) + есть хорошее окно ---
    if (daysSinceTreat >= 10 && phase && !['Уборка','Перезревание'].includes(phase.name)) {
      const nextSprayDay = [...sprayDays].sort()[0];
      if (nextSprayDay) {
        tasks.push({
          date: nextSprayDay,
          priority: daysSinceTreat >= 16 ? 1 : 2,
          type: 'spray',
          icon: '💊',
          parcel: parcel.name, crop: crop.emoji,
          title: `Обработка — ${parcel.name}`,
          body: `${daysSinceTreat} дней без обработки. Фаза: ${phase.name}. Погода: ✅ без дождя, ветер < 6 м/с.`,
          color: 'var(--orange)'
        });
      }
    }

    // --- Приближение уборки ---
    if (daysToHarvest !== null && daysToHarvest <= 7 && daysToHarvest >= 0) {
      // Дата уборки
      const harvestDate = new Date();
      harvestDate.setDate(harvestDate.getDate() + daysToHarvest);
      const harvestStr = harvestDate.toISOString().slice(0,10);
      tasks.push({
        date: harvestStr,
        priority: daysToHarvest <= 3 ? 0 : 1,
        type: 'harvest',
        icon: '🌾',
        parcel: parcel.name, crop: crop.emoji,
        title: `Уборка — ${parcel.name}`,
        body: `~${daysToHarvest} дней до уборки. GDD ${gdd}/${harvestGdd}. Фаза: ${phase?.name||'—'}. Подготовить технику и уведомить завод.`,
        color: 'var(--accent)'
      });
    }

    // --- Полив нужен (ETc > RAW/интервал) ---
    const etc = calcParcelEtc(parcel);
    if (etc && etc.etc > 0) {
      const soil = parcel.soil || 'loam';
      const raw = Math.round((SOIL_FC[soil]-SOIL_WP[soil])*0.35*crop.rootDepth*10);
      const interval = Math.round(raw / etc.etc);
      const lastIrr = S.irrigations.filter(i=>i.parcelId===parcel.id).filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
      const daysSinceIrr = lastIrr ? Math.floor((new Date(today_str) - new Date(lastIrr.date)) / 86400000) : 999;
      if (daysSinceIrr >= interval - 1) {
        tasks.push({
          date: today_str,
          priority: daysSinceIrr >= interval + 2 ? 1 : 2,
          type: 'irrigation',
          icon: '💧',
          parcel: parcel.name, crop: crop.emoji,
          title: `Полив — ${parcel.name}`,
          body: `ETc ${etc.etc} мм/день. Интервал полива ~${interval} дн. Прошло ${daysSinceIrr === 999 ? 'неизвестно' : daysSinceIrr+' дн'} с последнего полива.`,
          color: 'var(--blue)'
        });
      }
    }

    // --- Smith Period прогноз → упредительная обработка ---
    if (forecast && (crop.id==='tomato'||crop.id==='potato')) {
      const smithDays = (forecast.time||[]).filter((date,i) =>
        (forecast.temperature_2m_min[i]||0)>=10 && (forecast.relativehumidity_2m_max[i]||0)>=80
      );
      if (smithDays.length >= 2) {
        const beforeSmith = new Date(smithDays[0]);
        beforeSmith.setDate(beforeSmith.getDate() - 1);
        const beforeStr = beforeSmith.toISOString().slice(0,10);
        tasks.push({
          date: beforeStr >= today_str ? beforeStr : today_str,
          priority: 0,
          type: 'smith',
          icon: '🟤',
          parcel: parcel.name, crop: crop.emoji,
          title: `Фитофтора — обработать ДО ${smithDays[0].slice(5)}`,
          body: `Smith Period ожидается с ${smithDays[0].slice(5)}. Обработать упреждающе: Ридомил Голд, Инфинито или Превикур.`,
          color: 'var(--red)'
        });
      }
    }

    // --- Заморозок в прогнозе ---
    if (forecast) {
      const frostDay = (forecast.time||[]).find((date,i) => (forecast.temperature_2m_min[i]||0) <= 2);
      if (frostDay) {
        const tmin = forecast.temperature_2m_min[(forecast.time||[]).indexOf(frostDay)];
        tasks.push({
          date: frostDay,
          priority: tmin <= 0 ? 0 : 1,
          type: 'frost',
          icon: '❄️',
          parcel: parcel.name, crop: crop.emoji,
          title: `Заморозок ${frostDay.slice(5)} — защитить ${parcel.name}`,
          body: `T°мин ${tmin}°C. Подготовить укрытие или систему дождевания. ${crop.name} уязвим при T<${crop.id==='pea'?'-1':crop.id==='onion'?'-5':'4'}°C.`,
          color: '#60a5fa'
        });
      }
    }
  });

  // Полив для всех участков
  return tasks.sort((a,b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.priority||9) - (b.priority||9);
  });
}

function renderWpWeek() {
  const today_str = new Date().toISOString().slice(0,10);
  const tasks = generateWeekTasks();
  const forecast = _forecast;

  // KPIs
  const urgent = tasks.filter(t=>t.priority===0).length;
  const important = tasks.filter(t=>t.priority===1).length;
  document.getElementById('wp-kpis').innerHTML = `
    <div class="kpi-card" style="${urgent?'background:rgba(255,85,85,.08);border-color:rgba(255,85,85,.3);':''}">
      <div class="kpi-val" style="color:${urgent?'var(--red)':'var(--accent)'};">${urgent}</div>
      <div class="kpi-lbl">Срочно</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color:var(--orange);">${important}</div>
      <div class="kpi-lbl">Важно</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val">${tasks.length}</div>
      <div class="kpi-lbl">Всего задач</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color:var(--blue);">${forecast?'✅':'—'}</div>
      <div class="kpi-lbl">Прогноз погоды</div>
    </div>`;

  if (!tasks.length && !S.parcels.length) {
    document.getElementById('wp-week-view').innerHTML = `<div style="text-align:center;color:var(--text3);padding:40px;">Добавьте участки чтобы видеть план работ</div>`;
    return;
  }

  // Сгруппировать по дням
  const byDay = {};
  // Добавить 7 дней вперёд
  for (let i=0; i<7; i++) {
    const d = new Date(); d.setDate(d.getDate()+i);
    const ds = d.toISOString().slice(0,10);
    if (!byDay[ds]) byDay[ds] = [];
  }
  tasks.forEach(t => { if (!byDay[t.date]) byDay[t.date]=[]; byDay[t.date].push(t); });

  const dayNames = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  const PRIORITY_LABEL = ['❗ Срочно','⚠️ Важно','📌 Запланировано'];

  let html = '';
  Object.keys(byDay).sort().forEach(date => {
    const d = new Date(date);
    const dayName = dayNames[d.getDay()];
    const isToday = date === today_str;
    const isTomorrow = date === new Date(new Date().setDate(new Date().getDate()+1)).toISOString().slice(0,10);
    const dayLabel = isToday ? 'СЕГОДНЯ' : isTomorrow ? 'ЗАВТРА' : dayName;
    const dayTasks = byDay[date];

    // Погода на этот день
    let weatherHtml = '';
    if (forecast) {
      const fi = (forecast.time||[]).indexOf(date);
      if (fi >= 0) {
        const tmax = forecast.temperature_2m_max[fi];
        const tmin = forecast.temperature_2m_min[fi];
        const rain = forecast.precipitation_sum[fi]||0;
        const wind = forecast.windspeed_10m_max[fi]||0;
        const code = forecast.weathercode[fi]||0;
        const w = wmoIcon(code);
        const isSprayGood = rain<1 && wind<6 && tmax>8 && tmax<30;
        weatherHtml = `<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text3);">
          <span>${w.icon}</span>
          <span>${tmax}°/${tmin}°C</span>
          ${rain>0?`<span style="color:var(--blue);">💧${rain.toFixed(1)}мм</span>`:''}
          <span>💨${wind}м/с</span>
          ${isSprayGood?`<span style="color:var(--accent);">✅ опрыскивание</span>`:`<span style="color:var(--text3);">❌ опрыскивание</span>`}
        </div>`;
      }
    }

    html += `<div style="margin-bottom:16px;">
      <!-- День -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;padding:8px 14px;
        background:${isToday?'var(--surface3)':'var(--surface2)'};border-radius:10px;
        border-left:3px solid ${isToday?'var(--accent)':'var(--border)'};">
        <div>
          <div style="font-family:'Unbounded',sans-serif;font-size:11px;font-weight:700;color:${isToday?'var(--accent)':'var(--text2)'};">
            ${dayLabel} · ${date.slice(5).split('-').reverse().join('.')}
          </div>
          ${weatherHtml}
        </div>
        <div style="margin-left:auto;display:flex;gap:4px;">
          ${dayTasks.filter(t=>t.priority===0).length?`<span class="badge badge-red">${dayTasks.filter(t=>t.priority===0).length} срочно</span>`:''}
          ${dayTasks.filter(t=>t.priority===1).length?`<span class="badge badge-orange">${dayTasks.filter(t=>t.priority===1).length} важно</span>`:''}
          ${!dayTasks.length?`<span style="font-size:10px;color:var(--text3);">нет задач</span>`:''}
        </div>
      </div>

      <!-- Задачи дня -->
      ${dayTasks.length ? dayTasks.map(t => `
      <div style="display:flex;gap:12px;padding:10px 14px;background:var(--surface);border:1px solid var(--border);
        border-radius:8px;margin-bottom:6px;border-left:3px solid ${t.color||'var(--border)'};">
        <div style="font-size:20px;flex-shrink:0;">${t.icon}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:700;color:${t.color||'var(--text)'};">${t.title}</span>
            <span style="font-size:10px;padding:1px 7px;border-radius:8px;background:var(--surface2);color:var(--text3);">${t.crop} ${t.parcel}</span>
            <span style="font-size:9px;padding:1px 6px;border-radius:6px;background:${t.color||'var(--surface2)'}22;color:${t.color||'var(--text3)'};">${PRIORITY_LABEL[t.priority]||'📌'}</span>
          </div>
          <div style="font-size:11px;color:var(--text2);">${t.body}</div>
        </div>
      </div>`).join('') : ''}
    </div>`;
  });

  document.getElementById('wp-week-view').innerHTML = html ||
    `<div style="text-align:center;color:var(--accent);padding:30px;">✅ На эту неделю задач нет</div>`;
}

// ── Сезонный план ─────────────────────────────────────────────────────────
function renderWpSeason() {
  if (!S.parcels.length) {
    document.getElementById('wp-season-view').innerHTML = `<div style="text-align:center;color:var(--text3);padding:40px;">Нет участков</div>`;
    return;
  }

  const today_str = new Date().toISOString().slice(0,10);

  let html = `
  <div style="overflow-x:auto;">
  <table class="data-table">
    <thead><tr>
      <th>Участок</th><th>Культура / Сорт</th><th>Посев</th><th>Фаза</th>
      <th>GDD</th><th>До уборки</th><th>Последняя обработка</th><th>WHI до</th>
      <th>Полив</th><th>План т</th><th>Факт т</th><th>Статус</th>
    </tr></thead>
    <tbody>`;

  S.parcels.forEach(parcel => {
    const crop = getCropById(parcel.cropId);
    const phase = getParcelPhase(parcel);
    const gdd = Math.round(calcParcelGdd(parcel));
    const _wpSowRec = (S.sowingRecords||[]).find(r=>r.parcelId===parcel.id);
    const _wpSow = normalizeDate(_wpSowRec?.date || parcel.sowingDate) || '1900-01-01';
    const daysFromSowing = S.weather.filter(w=>(normalizeDate(w.date)||w.date)>=_wpSow).length;
    const avgDailyGdd = daysFromSowing > 0 ? gdd/daysFromSowing : 1;
    const harvestGdd = parcel.harvestGdd || crop?.gddToHarvest || 0;
    const daysToHarvest = avgDailyGdd > 0 && harvestGdd ? Math.round(Math.max(0,harvestGdd-gdd)/avgDailyGdd) : null;

    const lastTreat = S.treatments.filter(t=>t.parcelId===parcel.id).filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
    const activeWhi = S.treatments.filter(t=>t.parcelId===parcel.id&&t.whiDate&&t.whiDate>today_str).sort((a,b)=>b.whiDate.localeCompare(a.whiDate))[0];
    const lastIrr = S.irrigations.filter(i=>i.parcelId===parcel.id).filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
    const daysSinceIrr = lastIrr ? Math.floor((new Date(today_str)-new Date(lastIrr.date))/86400000) : null;

    const etc = calcParcelEtc(parcel);
    const soil = parcel.soil||'loam';
    const irrigInterval = etc && crop ? Math.round(((SOIL_FC[soil]||0.25)-(SOIL_WP[soil]||0.10))*0.35*crop.rootDepth*10/etc.etc) : null;
    const irrigOverdue = irrigInterval && daysSinceIrr !== null && daysSinceIrr >= irrigInterval;

    // Статус
    let status = '✅ Норма';
    let statusColor = 'var(--accent)';
    if (!parcel.sowingDate) { status='⚠️ Не засеян'; statusColor='var(--yellow)'; }
    else if (daysToHarvest !== null && daysToHarvest <= 5) { status='🌾 Уборка!'; statusColor='var(--accent)'; }
    else if (activeWhi) { status='⏳ WHI'; statusColor='var(--yellow)'; }
    else if (irrigOverdue) { status='💧 Полив!'; statusColor='var(--blue)'; }

    html += `<tr>
      <td style="font-weight:600;">${parcel.name}</td>
      <td style="font-size:11px;">${crop?crop.emoji+' '+crop.name+(parcel.variety?' · '+parcel.variety:''):'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;">${normalizeDate(parcel.sowingDate)||'—'}</td>
      <td><span style="font-size:10px;padding:2px 7px;border-radius:8px;background:${phase?phase.color+'22':'var(--surface2)'};color:${phase?.color||'var(--text3)'};">${phase?.name||'—'}</span></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent);">${gdd}${harvestGdd?' / '+harvestGdd:''}</td>
      <td style="font-size:11px;color:${daysToHarvest<=7?'var(--accent)':daysToHarvest<=14?'var(--yellow)':'var(--text3)'};">
        ${daysToHarvest!==null?(daysToHarvest<=7?'🌾 ':'')+daysToHarvest+' дн':'—'}
      </td>
      <td style="font-size:11px;color:var(--text3);">${lastTreat?lastTreat.date:'—'}</td>
      <td style="font-size:11px;color:${activeWhi?'var(--yellow)':'var(--text3)'};">${activeWhi?activeWhi.whiDate:'✅'}</td>
      <td style="font-size:11px;color:${irrigOverdue?'var(--red)':daysSinceIrr!==null?'var(--text2)':'var(--text3)'};">
        ${daysSinceIrr!==null?daysSinceIrr+' дн назад':'—'}${irrigInterval?' / '+irrigInterval+' дн':''}
      </td>
      <td style="font-family:'JetBrains Mono',monospace;color:var(--blue);">${parcel.yieldPlan&&parcel.ha?(parcel.yieldPlan*parcel.ha).toFixed(1)+' т':'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;color:var(--accent);">${parcel.yieldFact&&parcel.ha?(parcel.yieldFact*parcel.ha).toFixed(1)+' т':'—'}</td>
      <td><span style="font-size:10px;padding:2px 8px;border-radius:8px;color:${statusColor};background:${statusColor}22;">${status}</span></td>
    </tr>`;
  });

  html += `</tbody></table></div>`;
  document.getElementById('wp-season-view').innerHTML = html;

  // KPIs для сезона
  const readyHarvest = S.parcels.filter(p => {
    const crop = getCropById(p.cropId);
    const gdd = Math.round(calcParcelGdd(p));
    const harvestGdd = p.harvestGdd || crop?.gddToHarvest || 0;
    const _rpSowRec = (S.sowingRecords||[]).find(r=>r.parcelId===p.id);
    const _rpSow = normalizeDate(_rpSowRec?.date || p.sowingDate) || '1900-01-01';
    const days = S.weather.filter(w=>(normalizeDate(w.date)||w.date)>=_rpSow).length;
    const avg = days > 0 ? gdd/days : 1;
    const dth = avg > 0 && harvestGdd ? Math.round(Math.max(0,harvestGdd-gdd)/avg) : null;
    return dth !== null && dth <= 7;
  }).length;
  const totalPlanT = S.parcels.reduce((s,p)=>s+(p.yieldPlan&&p.ha?p.yieldPlan*p.ha:0),0);
  const totalFactT = S.parcels.reduce((s,p)=>s+(p.yieldFact&&p.ha?p.yieldFact*p.ha:0),0);
  document.getElementById('wp-kpis').innerHTML = `
    <div class="kpi-card" style="${readyHarvest?'background:rgba(107,221,107,.1);border-color:rgba(107,221,107,.4);':''}">
      <div class="kpi-val" style="color:${readyHarvest?'var(--accent)':'var(--text3)'};">${readyHarvest}</div>
      <div class="kpi-lbl">К уборке (7 дн)</div>
    </div>
    <div class="kpi-card"><div class="kpi-val">${S.parcels.filter(p=>p.sowingDate).length}/${S.parcels.length}</div><div class="kpi-lbl">Засеяно</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--blue);">${totalPlanT.toFixed(1)} т</div><div class="kpi-lbl">План урожай</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--accent);">${totalFactT>0?totalFactT.toFixed(1)+' т':'—'}</div><div class="kpi-lbl">Факт урожай</div></div>`;
}

function exportWorkplan() {
  const tasks = generateWeekTasks();
  const rows = [['Дата','Приоритет','Тип','Участок','Культура','Задача','Описание']];
  const PRIO = ['Срочно','Важно','Запланировано'];
  tasks.forEach(t => rows.push([t.date, PRIO[t.priority]||'—', t.type, t.parcel, t.crop, t.title, t.body]));
  const csv = rows.map(r=>r.join(';')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = 'plan_rabot_'+today()+'.csv';
  a.click();
}

// ═══ ОТЧЁТ РАСХОДА ПРЕПАРАТОВ ═════════════════════════════════════════════
function showConsumptionReport() {
  const el = document.getElementById('wh-consumption-report');
  const inv = document.getElementById('wh-inventory');
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }
  inv.style.display = 'none';

  const today_str = new Date().toISOString().slice(0,10);
  const month_ago = new Date(new Date().setDate(new Date().getDate()-30)).toISOString().slice(0,10);

  // Собрать расход из истории склада
  const history = (S.warehouse?.history || []).filter(h => h.operation === 'out' && h.type === 'chemical');

  // Сгруппировать по препарату
  const byName = {};
  history.forEach(h => {
    if (!byName[h.name]) byName[h.name] = { name: h.name, total: 0, cost: 0, entries: [] };
    byName[h.name].total += h.qty || 0;
    byName[h.name].cost += h.total || 0;
    byName[h.name].entries.push(h);
  });

  const items = Object.values(byName).sort((a,b) => b.cost - a.cost);
  const grandTotal = items.reduce((s,i) => s+i.cost, 0);

  // Сгруппировать по участкам
  const byParcel = {};
  history.forEach(h => {
    const key = h.parcelName || '—';
    if (!byParcel[key]) byParcel[key] = { name: key, cost: 0, qty: 0 };
    byParcel[key].cost += h.total || 0;
    byParcel[key].qty += h.qty || 0;
  });

  el.innerHTML = `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
    <div style="padding:12px 16px;background:var(--surface2);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <div style="font-family:'Unbounded',sans-serif;font-size:11px;font-weight:700;">📊 Расход препаратов — весь сезон</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <div style="text-align:center;">
          <div style="font-family:'Unbounded',sans-serif;font-size:15px;font-weight:700;color:var(--accent);">${formatPrice(grandTotal)}</div>
          <div style="font-size:9px;color:var(--text3);">Итого стоимость</div>
        </div>
        <div style="text-align:center;">
          <div style="font-family:'Unbounded',sans-serif;font-size:15px;font-weight:700;color:var(--blue);">${items.length}</div>
          <div style="font-size:9px;color:var(--text3);">Препаратов</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="exportConsumptionCSV()">📤 CSV</button>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('wh-consumption-report').style.display='none'">✕</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border);">
      <!-- По препаратам -->
      <div style="background:var(--surface);padding:12px;">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">По препаратам</div>
        <table class="data-table" style="font-size:11px;">
          <thead><tr><th>Препарат</th><th>Кол-во</th><th>Сумма</th></tr></thead>
          <tbody>
            ${items.map(i => {
              const wh = (S.warehouse?.chemicals||[]).find(w=>w.name.toLowerCase()===i.name.toLowerCase());
              const unit = wh?.unit || 'л';
              return `<tr>
                <td style="font-weight:500;">${i.name}</td>
                <td style="font-family:'JetBrains Mono',monospace;">${i.total.toFixed(2)} ${unit}</td>
                <td style="font-family:'JetBrains Mono',monospace;color:var(--accent);">${formatPrice(i.cost)}</td>
              </tr>`;
            }).join('')}
            <tr style="background:var(--surface2);font-weight:700;">
              <td>ИТОГО</td><td>—</td>
              <td style="font-family:'JetBrains Mono',monospace;color:var(--accent);">${formatPrice(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- По участкам -->
      <div style="background:var(--surface);padding:12px;">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">По участкам</div>
        <table class="data-table" style="font-size:11px;">
          <thead><tr><th>Участок</th><th>Сумма</th></tr></thead>
          <tbody>
            ${Object.values(byParcel).sort((a,b)=>b.cost-a.cost).map(p => `<tr>
              <td>${p.name}</td>
              <td style="font-family:'JetBrains Mono',monospace;color:var(--accent);">${formatPrice(p.cost)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
  el.style.display = 'block';
}

function exportConsumptionCSV() {
  const history = (S.warehouse?.history || []).filter(h => h.operation === 'out' && h.type === 'chemical');
  const rows = [['Дата','Препарат','Кол-во','Ед.','Цена','Сумма','Участок','Примечание']];
  history.forEach(h => rows.push([h.date, h.name, h.qty, h.unit||'л', h.price||0, h.total||0, h.parcelName||'—', h.note||'']));
  const csv = rows.map(r=>r.join(';')).join('\n');
  const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
  a.download = 'rashod_preparatov_'+today()+'.csv'; a.click();
}

// ═══ ИНВЕНТАРИЗАЦИЯ ════════════════════════════════════════════════════════
function showInventory() {
  const el = document.getElementById('wh-inventory');
  const rep = document.getElementById('wh-consumption-report');
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }
  rep.style.display = 'none';

  const chemicals = S.warehouse?.chemicals || [];
  const parts = S.warehouse?.parts || [];
  const seeds = S.warehouse?.seeds || [];

  const totalValue = chemicals.reduce((s,c) => s + (c.qty||0)*(c.price||0), 0)
    + parts.reduce((s,p) => s + (p.qty||0)*(p.price||0), 0)
    + seeds.reduce((s,s2) => s + (s2.qty||0)*(s2.price||0), 0);

  const lowStock = chemicals.filter(c => c.minStock && c.qty <= c.minStock).length;
  const zeroStock = chemicals.filter(c => c.qty <= 0).length;

  el.innerHTML = `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
    <div style="padding:12px 16px;background:var(--surface2);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <div style="font-family:'Unbounded',sans-serif;font-size:11px;font-weight:700;">🗂️ Инвентаризация склада</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <div style="text-align:center;">
          <div style="font-family:'Unbounded',sans-serif;font-size:15px;font-weight:700;color:var(--accent);">${formatPrice(totalValue)}</div>
          <div style="font-size:9px;color:var(--text3);">Стоимость склада</div>
        </div>
        ${lowStock?`<div style="text-align:center;">
          <div style="font-size:15px;font-weight:700;color:var(--yellow);">${lowStock}</div>
          <div style="font-size:9px;color:var(--text3);">Мало на складе</div>
        </div>`:''}
        ${zeroStock?`<div style="text-align:center;">
          <div style="font-size:15px;font-weight:700;color:var(--red);">${zeroStock}</div>
          <div style="font-size:9px;color:var(--text3);">Нулевой остаток</div>
        </div>`:''}
        <button class="btn btn-secondary btn-sm" onclick="exportWarehouseCSV()">📤 CSV</button>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('wh-inventory').style.display='none'">✕</button>
      </div>
    </div>

    <!-- Препараты -->
    <div style="padding:12px 16px;">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">💊 Препараты (${chemicals.length})</div>
      <table class="data-table" style="font-size:11px;margin-bottom:16px;">
        <thead><tr><th>Препарат</th><th>Тип</th><th>Остаток</th><th>Ед.</th><th>Мин.запас</th><th>Цена</th><th>Стоимость</th><th>Статус</th></tr></thead>
        <tbody>
          ${chemicals.map(c => {
            const isLow = c.minStock && c.qty <= c.minStock;
            const isZero = c.qty <= 0;
            const status = isZero ? '🔴 Нет' : isLow ? '🟡 Мало' : '🟢 OK';
            const statusColor = isZero ? 'var(--red)' : isLow ? 'var(--yellow)' : 'var(--accent)';
            const TYPE_LABELS = {fungicide:'Фунг',insecticide:'Инсект',herbicide:'Герб',fertilizer:'Удобр',acaricide:'Акар',surfactant:'ПАВ',other:'Др'};
            return `<tr style="${isZero?'opacity:0.5':''}">
              <td style="font-weight:500;">${c.name}</td>
              <td style="font-size:10px;color:var(--text3);">${TYPE_LABELS[c.type]||c.type||'—'}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${statusColor};">${c.qty}</td>
              <td>${c.unit||'л'}</td>
              <td style="font-family:'JetBrains Mono',monospace;color:var(--text3);">${c.minStock||'—'}</td>
              <td style="font-family:'JetBrains Mono',monospace;">${c.price?formatPrice(c.price):'—'}</td>
              <td style="font-family:'JetBrains Mono',monospace;color:var(--accent);">${c.price?formatPrice(c.qty*c.price):'—'}</td>
              <td style="color:${statusColor};">${status}</td>
            </tr>`;
          }).join('')}
          <tr style="background:var(--surface2);font-weight:700;">
            <td colspan="6">ИТОГО препараты</td>
            <td style="font-family:'JetBrains Mono',monospace;color:var(--accent);">${formatPrice(chemicals.reduce((s,c)=>s+(c.qty||0)*(c.price||0),0))}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <!-- Семена -->
      ${seeds.length ? `
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🌱 Семена (${seeds.length})</div>
      <table class="data-table" style="font-size:11px;margin-bottom:16px;">
        <thead><tr><th>Сорт</th><th>Культура</th><th>Остаток</th><th>Ед.</th><th>Цена</th><th>Стоимость</th></tr></thead>
        <tbody>
          ${seeds.map(s => {
            const crop = getCropById(s.cropId);
            return `<tr>
              <td style="font-weight:500;">${s.variety||'—'}</td>
              <td>${crop?crop.emoji+' '+crop.name:'—'}</td>
              <td style="font-family:'JetBrains Mono',monospace;color:var(--accent);">${s.qty}</td>
              <td>${s.unit||'кг'}</td>
              <td style="font-family:'JetBrains Mono',monospace;">${s.price?formatPrice(s.price):'—'}</td>
              <td style="font-family:'JetBrains Mono',monospace;color:var(--accent);">${s.price?formatPrice(s.qty*s.price):'—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : ''}
    </div>
  </div>`;
  el.style.display = 'block';
}

// ═══ ЭКСПОРТ СКЛАДА CSV ════════════════════════════════════════════════════
function exportWarehouseCSV() {
  const chemicals = S.warehouse?.chemicals || [];
  const parts = S.warehouse?.parts || [];
  const seeds = S.warehouse?.seeds || [];
  const TYPE_LABELS = {fungicide:'Фунгицид',insecticide:'Инсектицид',herbicide:'Гербицид',fertilizer:'Удобрение',acaricide:'Акарицид',surfactant:'ПАВ',other:'Другое'};
  const rows = [['Тип','Название','Категория','Остаток','Ед.','Мин.запас','Цена','Стоимость','Поставщик']];
  chemicals.forEach(c => rows.push(['Препарат', c.name, TYPE_LABELS[c.type]||c.type||'—', c.qty, c.unit||'л', c.minStock||'—', c.price||0, (c.qty||0)*(c.price||0), c.supplier||'—']));
  parts.forEach(p => rows.push(['Запчасть', p.name, p.category||'—', p.qty, p.unit||'шт', p.minStock||'—', p.price||0, (p.qty||0)*(p.price||0), p.supplier||'—']));
  seeds.forEach(s => { const crop=getCropById(s.cropId); rows.push(['Семена', s.variety||'—', crop?.name||'—', s.qty, s.unit||'кг', s.minStock||'—', s.price||0, (s.qty||0)*(s.price||0), s.supplier||'—']); });
  const csv = rows.map(r=>r.join(';')).join('\n');
  const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
  a.download = 'sklad_'+today()+'.csv'; a.click();
}

// ═══ PDF АНАЛИЗЫ ══════════════════════════════════════════════════════════

// Загрузить список PDF для анализа
async function loadAnalysisPdfs(analysisId) {
  const listEl = document.getElementById('van-pdf-list');
  const parseBtn = document.getElementById('van-parse-btn');
  if (!listEl) return;
  try {
    const r = await fetch(`/api/analyses/${analysisId}/pdfs`);
    if (!r.ok) { listEl.innerHTML = '<div style="font-size:11px;color:var(--text3);">Сервер недоступен</div>'; return; }
    const data = await r.json();
    const files = data.files || [];
    if (parseBtn) parseBtn.style.display = files.length ? 'flex' : 'none';
    if (!files.length) {
      listEl.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:8px;">PDF не прикреплены</div>';
      return;
    }
    listEl.innerHTML = files.map(f => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;">
        <span style="font-size:18px;">📄</span>
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:600;">${f.filename}</div>
          <div style="font-size:10px;color:var(--text3);">${(f.size/1024).toFixed(0)} KB · ${f.uploaded_at?.slice(0,10)||''}</div>
        </div>
        <a href="/api/analyses/${analysisId}/pdfs/${f.id}/download" target="_blank"
          style="padding:5px 10px;border-radius:6px;background:rgba(85,170,255,.15);color:var(--blue);font-size:11px;text-decoration:none;white-space:nowrap;">
          📥 Скачать
        </a>
        <button onclick="deleteAnalysisPdf('${analysisId}','${f.id}')"
          style="padding:4px 8px;border:none;border-radius:6px;background:rgba(255,85,85,.15);color:var(--red);font-size:11px;cursor:pointer;">✕</button>
      </div>`).join('');
  } catch(e) {
    listEl.innerHTML = '<div style="font-size:11px;color:var(--text3);">Ошибка загрузки списка</div>';
  }
}

// Загрузить PDF файлы на сервер
async function uploadAnalysisPdfs(event) {
  const files = event.target.files;
  if (!files.length || !_vegAnEditId) return;
  const statusEl = document.getElementById('van-parse-status');
  if (statusEl) statusEl.style.display = 'block';
  // Upload each file
  for (const file of files) {
    const formData = new FormData();
    formData.append('pdf', file);
    try {
      const r = await fetch(`/api/analyses/${_vegAnEditId}/pdfs`, { method: 'POST', body: formData });
      if (!r.ok) throw new Error('HTTP ' + r.status);
    } catch(e) {
      console.warn('PDF upload failed:', e.message);
    }
  }
  loadAnalysisPdfs(_vegAnEditId);
  if (statusEl) statusEl.style.display = 'none';
}


function buildDailyFromMap(dailyMap) {
  return Object.keys(dailyMap).sort().map(day => {
    const d = dailyMap[day];
    return {
      date: day,
      tmax: d.tmaxArr.length ? Math.round(Math.max(...d.tmaxArr)*10)/10 : null,
      tmin: d.tminArr.length ? Math.round(Math.min(...d.tminArr)*10)/10 : null,
      humidity: d.humArr.length ? Math.round(d.humArr.reduce((a,b)=>a+b)/d.humArr.length*10)/10 : null,
      precip: Math.round(d.rain*10)/10,
      leafwet: Math.round(d.leafwetMin/60*10)/10, // minutes → hours
    };
  });
}

function mergeWeatherDays(days, statusEl, soilReadings, sensorMapping) {
  soilReadings = soilReadings || [];
  if (!days || !days.length) {
    statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ Данные не найдены в файле</div>`;
    return;
  }
  let added = 0, updated = 0, skipped = 0;
  days.forEach(day => {
    if (!day.date || day.tmin === null || day.tmax === null) { skipped++; return; }
    const existing = S.weather.findIndex(w => w.date === day.date);
    const entry = {
      id: existing >= 0 ? S.weather[existing].id : ('w'+Date.now()+Math.random()),
      date: day.date, tmin: day.tmin, tmax: day.tmax,
      humidity: day.humidity, precip: day.precip, leafwet: day.leafwet,
      et0: day.et0 || null, wind: day.wind || null,
      phase: null, note: 'Импорт с метеостанции',
    };
    if (existing >= 0) { S.weather[existing] = entry; updated++; }
    else { S.weather.push(entry); added++; }
  });
  S.weather.sort((a,b) => b.date.localeCompare(a.date));

  // Merge soil readings into irrigation.readings
  let soilAdded = 0, soilSkipped = 0;
  const existingKeys = new Set(S.irrigation.readings.map(r=>`${r.date}_${r.sensorId}_${r.time}`));
  soilReadings.forEach(sr => {
    if (!sr.sensorId) return;
    const key = `${sr.date}_${sr.sensorId}_${sr.time}`;
    if (existingKeys.has(key)) { soilSkipped++; return; }
    existingKeys.add(key);
    S.irrigation.readings.push({
      id:'rd_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
      date:sr.date, time:sr.time||'12:00', sensorId:sr.sensorId, value:sr.value,
      soilTemp:null, note:'Авто-импорт из метеостанции',
    });
    soilAdded++;
  });
  if (soilAdded > 0) S.irrigation.readings.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));

  save();
  renderWeather();

  const dateFrom = days[0].date;
  const dateTo   = days[days.length-1].date;
  const sensorSummary = S.irrigation.sensors.length && soilAdded > 0
    ? `<br>📡 Данные датчиков: <strong>${soilAdded}</strong> показаний в разделе Ирригация${soilSkipped?` · ${soilSkipped} дублей`:''}`
    : soilAdded === 0 && soilReadings.length === 0
    ? `<br><span style="color:var(--text3);font-size:11px;">💡 Настройте датчики в разделе Ирригация и повторите импорт — данные почвы появятся автоматически</span>`
    : '';

  statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.3);border-radius:8px;font-size:12px;color:var(--accent);">
    ✅ Погода: <strong>${added}</strong> новых дней, <strong>${updated}</strong> обновлено${skipped?`, ${skipped} пропущено`:''}<br>
    📅 Период: ${dateFrom} — ${dateTo}${sensorSummary}
  </div>`;
}

