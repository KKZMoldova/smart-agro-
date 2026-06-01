// Smart Agro — dashboard.js
// ═══ УТРЕННИЙ ДАШБОРД АГРОНОМА ═══════════════════════════════════════════

function renderDashboard() {
  const el = document.getElementById('dashboard-content');
  const dateEl = document.getElementById('dash-date');
  if(!el) return;
  try {

  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  if(dateEl) dateEl.textContent = dateStr;

  const sections = [];

  // ── 1. ПОГОДА И СТРЕСС-АЛЕРТЫ ─────────────────────────────────────────
  const w7 = (S.weather||[]).slice(0,7);
  const yesterday = (S.weather||[])[0];
  if(yesterday) {
    const tmax = parseFloat(yesterday.tmax)||0;
    const tmin = parseFloat(yesterday.tmin)||0;
    const precip = parseFloat(yesterday.precip)||0;
    const rh = parseFloat(yesterday.humidity)||0;
    const et0 = parseFloat(yesterday.et0)||0;

    sections.push({
      title: '🌡️ Погода вчера', color: 'var(--blue)',
      content: `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;">
        ${[
          ['T°мин', `${tmin}°C`, tmin<=0?'var(--red)':'var(--text)'],
          ['T°макс', `${tmax}°C`, tmax>=35?'var(--orange)':'var(--text)'],
          ['Осадки', `${precip}мм`, precip>5?'var(--blue)':'var(--text)'],
          ['RH', `${rh}%`, rh>90?'var(--yellow)':'var(--text)'],
          ['ET₀', `${et0}мм`, ''],
        ].map(([l,v,c])=>`<div style="text-align:center;padding:8px;background:var(--surface2);border-radius:8px;">
          <div style="font-size:15px;font-weight:700;color:${c||'var(--text)'};">${v}</div>
          <div style="font-size:9px;color:var(--text3);">${l}</div>
        </div>`).join('')}
      </div>`
    });
  }

  // ── 2. СТРЕСС-АЛЕРТЫ ──────────────────────────────────────────────────
  const stressAlerts = detectStress(S.weather, _forecast);
  const criticalAlerts = stressAlerts.filter(a=>['critical','danger'].includes(a.level));
  const warnAlerts = stressAlerts.filter(a=>['warning','warn'].includes(a.level));

  if(criticalAlerts.length || warnAlerts.length) {
    const alertsHtml = [...criticalAlerts, ...warnAlerts].slice(0,6).map(a=>`
      <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 12px;border-radius:8px;margin-bottom:5px;
        background:${['critical','danger'].includes(a.level)?'rgba(220,38,38,.08)':'rgba(245,158,11,.08)'};
        border-left:3px solid ${['critical','danger'].includes(a.level)?'#dc2626':'#f59e0b'};">
        <span style="font-size:16px;">${a.icon||'⚠️'}</span>
        <div>
          <div style="font-size:12px;font-weight:700;">${a.title}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">${a.body||''}</div>
        </div>
      </div>`).join('');

    sections.push({
      title: `⚠️ Алерты (${criticalAlerts.length} критич. · ${warnAlerts.length} внимание)`,
      color: criticalAlerts.length ? '#dc2626' : '#f59e0b',
      content: alertsHtml
    });
  } else {
    sections.push({
      title: '✅ Стресс-алерты', color: 'var(--accent)',
      content: '<div style="font-size:12px;color:var(--accent);padding:8px;">✅ Критических алертов нет — день начинается хорошо!</div>'
    });
  }

  // ── 3. ПОЛИВ — статус зон ─────────────────────────────────────────────
  const zones = S.irrigation?.zones||[];
  if(zones.length) {
    const zoneRows = zones.map(z=>{
      const r = calcZoneIrrigRecommendation(z);
      const lastIrrig = (S.irrigation.events||[]).filter(e=>e.zoneId===z.id)
        .sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
      const daysSince = lastIrrig ? Math.floor((Date.now()-new Date(lastIrrig.date))/(864e5)) : '—';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface2);border-radius:8px;margin-bottom:4px;border-left:3px solid ${r.statusColor};">
        <span style="font-size:16px;">${r.statusIcon}</span>
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:600;">${z.name}</div>
          <div style="font-size:11px;color:var(--text3);">${r.status} · Дефицит: ${r.deficit.toFixed(1)}мм · ETc 7дн: ${r.etc_7.toFixed(1)}мм</div>
        </div>
        <div style="text-align:right;font-size:11px;color:var(--text3);">
          ${r.targetMm>0.5?`<div style="color:var(--blue);font-weight:600;">💧 ${r.targetMm.toFixed(1)}мм · ${r.durationMin}мин</div>`:''}
          <div>Последний: ${daysSince==='—'?'нет данных':daysSince+' дн. назад'}</div>
        </div>
        ${r.targetMm>0.5?`<button class="btn btn-primary btn-xs" onclick="switchTab('irrigation',document.querySelector('.tab[onclick*=irrigation]'));setTimeout(()=>openIrrigEventModalForZone('${z.id}',${r.targetMm.toFixed(1)},${r.durationMin}),400);">Полить</button>`:''}
      </div>`;
    }).join('');

    const needIrrig = zones.filter(z=>calcZoneIrrigRecommendation(z).targetMm>0.5).length;
    sections.push({
      title: `💧 Полив зон (${needIrrig} требуют полива)`,
      color: needIrrig ? 'var(--blue)' : 'var(--accent)',
      content: zoneRows
    });
  }

  // ── 4. СКЛАД — низкие остатки ─────────────────────────────────────────
  const chemicals = S.warehouse?.chemicals||[];
  const lowStock = chemicals.filter(c=>{
    const qty = parseFloat(c.qty)||0;
    const minQty = parseFloat(c.minQty)||0;
    return minQty>0 ? qty<=minQty : qty<=0;
  });
  const outOfStock = chemicals.filter(c=>(parseFloat(c.qty)||0)<=0);

  if(lowStock.length || outOfStock.length) {
    sections.push({
      title: `🏪 Склад (${outOfStock.length} нет · ${lowStock.length} мало)`,
      color: outOfStock.length ? '#dc2626' : '#f59e0b',
      content: `<div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${[...outOfStock.map(c=>`<div style="padding:5px 10px;border-radius:8px;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.2);font-size:11px;">
          ❌ <strong>${c.name}</strong> — 0 ${c.unit||''}
        </div>`),
        ...lowStock.filter(c=>(parseFloat(c.qty)||0)>0).map(c=>`<div style="padding:5px 10px;border-radius:8px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);font-size:11px;">
          ⚠️ <strong>${c.name}</strong> — ${c.qty} ${c.unit||''}
        </div>`)].join('')}
      </div>`
    });
  }

  // ── 5. АКТИВНЫЕ ОБРАБОТКИ — что сейчас в защите ──────────────────────
  const todayD = new Date(); todayD.setHours(0,0,0,0);
  const todayStr = today();
  const precip0 = parseFloat((S.weather||[])[0]?.precip) || 0;

  const activeTreatments = (S.treatments||[]).filter(t => {
    if (!t.endDate) return false;
    return new Date(t.endDate) >= todayD;
  }).sort((a,b) => (a.endDate||'').localeCompare(b.endDate||''));

  const washedTreatments = (S.treatments||[]).filter(t => {
    if (!t.date) return false;
    const daysSince = Math.floor((todayD - new Date(t.date)) / 864e5);
    if (daysSince > 21) return false;
    const washMm = parseFloat(t.washMm || (t.products?.[0]?.washMm) || 15);
    return precip0 >= washMm;
  });

  if (activeTreatments.length || washedTreatments.length) {
    const activeHtml = activeTreatments.slice(0, 6).map(t => {
      const daysLeft = Math.ceil((new Date(t.endDate) - todayD) / 864e5);
      const prod = t.products?.map(p => p.name).join(' + ') || t.product || '—';
      const cell = t.cellTarget && t.cellTarget !== 'all'
        ? t.cellTarget
        : (t.cellsTarget?.length ? t.cellsTarget.join(', ') : 'Весь сад');
      const color = daysLeft <= 2 ? '#dc2626' : daysLeft <= 5 ? '#f59e0b' : 'var(--accent)';
      const washMm = parseFloat(t.washMm || t.products?.[0]?.washMm || 15);
      const washStatus = precip0 >= washMm * 2
        ? `<span style="color:#dc2626;font-size:10px;">⛔ Смыт (${precip0}мм)</span>`
        : precip0 >= washMm
          ? `<span style="color:#f59e0b;font-size:10px;">⚠️ Частично смыт</span>`
          : '';
      return `<div style="display:flex;justify-content:space-between;align-items:center;
        padding:7px 12px;background:var(--surface2);border-radius:8px;margin-bottom:4px;
        border-left:3px solid ${color};">
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${prod}</div>
          <div style="font-size:10px;color:var(--text3);">${t.date} · ${cell} ${washStatus}</div>
        </div>
        <div style="text-align:right;font-size:12px;font-weight:700;color:${color};margin-left:8px;white-space:nowrap;">
          ${daysLeft <= 0 ? 'Истёк' : daysLeft === 1 ? 'Завтра' : daysLeft + ' дн.'}
        </div>
      </div>`;
    }).join('');

    const washedHtml = washedTreatments.length && precip0 > 0
      ? `<div style="margin-top:6px;padding:8px 12px;background:rgba(220,38,38,.06);
          border-radius:8px;border-left:3px solid #dc2626;font-size:11px;color:var(--red);">
          ⛔ Осадки ${precip0}мм — ${washedTreatments.length} обработок могут быть смыты
        </div>` : '';

    sections.push({
      title: `💊 Активные обработки (${activeTreatments.length} в защите)`,
      color: activeTreatments.some(t => Math.ceil((new Date(t.endDate)-todayD)/864e5) <= 2)
        ? '#dc2626' : 'var(--accent)',
      content: activeHtml + washedHtml ||
        '<div style="font-size:12px;color:var(--text3);padding:8px;">Нет активных обработок</div>'
    });
  }

  // ── 5б. PHI — препараты на выходе ─────────────────────────────────────
  const expiring = (S.treatments||[]).filter(t=>{
    if(!t.whiDate&&!t.endDate) return false;
    const whi = t.whiDate||t.endDate;
    const daysLeft = Math.ceil((new Date(whi)-new Date(todayStr))/(864e5));
    return daysLeft>=0 && daysLeft<=7;
  }).sort((a,b)=>(a.whiDate||a.endDate||'').localeCompare(b.whiDate||b.endDate||''));

  if(expiring.length) {
    sections.push({
      title: `⏰ PHI — срок ожидания (${expiring.length} заканчивается)`,
      color: '#f59e0b',
      content: expiring.slice(0,5).map(t=>{
        const whi = t.whiDate||t.endDate;
        const daysLeft = Math.ceil((new Date(whi)-new Date(todayStr))/(864e5));
        const prod = t.products?.map(p=>p.name).join(', ')||t.product||'—';
        return `<div style="display:flex;justify-content:space-between;padding:7px 12px;background:var(--surface2);border-radius:8px;margin-bottom:4px;border-left:3px solid ${daysLeft<=2?'#dc2626':'#f59e0b'};">
          <div>
            <div style="font-size:12px;font-weight:600;">${prod}</div>
            <div style="font-size:11px;color:var(--text3);">${t.date} · ${t.cellTarget||'все клетки'}</div>
          </div>
          <div style="text-align:right;font-size:12px;font-weight:700;color:${daysLeft<=2?'#dc2626':'#f59e0b'};">
            ${daysLeft===0?'Сегодня!':daysLeft===1?'Завтра!':daysLeft+' дн.'}
          </div>
        </div>`;
      }).join('')
    });
  }

  // ── 6. ЗАДАНИЯ на сегодня ─────────────────────────────────────────────
  const todayTasks = (S.tasks||[]).filter(t=>t.due_date?.slice(0,10)===todayStr && t.status!=='done');
  if(todayTasks.length) {
    sections.push({
      title: `📋 Задания на сегодня (${todayTasks.length})`,
      color: 'var(--purple)',
      content: todayTasks.slice(0,5).map(t=>`
        <div style="display:flex;align-items:center;gap:10px;padding:7px 12px;background:var(--surface2);border-radius:8px;margin-bottom:4px;">
          <span style="font-size:14px;">${t.status==='assigned'?'👤':t.status==='in_progress'?'🔄':'📋'}</span>
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:600;">${t.work_type_name||'Задание'}</div>
            <div style="font-size:11px;color:var(--text3);">${t.parcel_name||'—'} · ${t.assigned_to_name||'не назначено'}</div>
          </div>
        </div>`).join('')
    });
  }

  // ── 7. АНАЛИЗЫ — дефициты по листу ───────────────────────────────────
  const lastLeaf = [...(S.analyses||[])].filter(a=>a.type==='leaf'&&a.date)
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
  if(lastLeaf) {
    const norms = LEAF_NORMS_CHERRY;
    const deficits = Object.entries(norms).filter(([el,n])=>{
      const val = parseFloat(lastLeaf[el]||lastLeaf[el.toLowerCase()]);
      return !isNaN(val) && val > 0 && val < n.min;
    });
    if(deficits.length) {
      sections.push({
        title: `🍃 Анализ листа (${lastLeaf.date}) — дефициты`,
        color: '#f59e0b',
        content: deficits.map(([el,n])=>{
          const val = parseFloat(lastLeaf[el]||lastLeaf[el.toLowerCase()]);
          return `<div style="display:flex;justify-content:space-between;padding:6px 12px;background:rgba(245,158,11,.06);border-radius:8px;margin-bottom:3px;border-left:2px solid #f59e0b;">
            <div>
              <span style="font-size:12px;font-weight:600;">${el}</span>
              <span style="font-size:11px;color:var(--text3);margin-left:8px;">${val}${n.unit} (норма ${n.min}–${n.max})</span>
            </div>
            <div style="font-size:11px;color:var(--text3);">${n.action}</div>
          </div>`;
        }).join('')
      });
    }
  }

  // ── 8. МОА-ротация — предупреждения ───────────────────────────────────
  const cutoff90 = new Date(Date.now()-90*864e5).toISOString().split('T')[0];
  const moaUsage = {};
  (S.treatments||[]).filter(t=>t.date>=cutoff90).forEach(t=>{
    (t.products||[]).forEach(p=>{
      const moa = getMoaForProduct(S.catalog.find(c=>c.name===p.name)||{name:p.name});
      const code = moa?.frac||moa?.fracGroup||moa?.irac||'?';
      if(code==='?'||code==='M'||code==='33') return;
      if(!moaUsage[code]) moaUsage[code]=0;
      moaUsage[code]++;
    });
  });
  const moaWarnings = Object.entries(moaUsage).filter(([code,cnt])=>{
    const info = MOA_DB.frac[code]||MOA_DB.irac[code]||{};
    return (info.risk==='ВЫСОКИЙ' && cnt>=2) || (info.risk==='СРЕДНИЙ' && cnt>=3);
  });
  if(moaWarnings.length) {
    sections.push({
      title: `🔄 МОА-ротация — риск резистентности`,
      color: '#dc2626',
      content: moaWarnings.map(([code,cnt])=>{
        const info = MOA_DB.frac[code]||MOA_DB.irac[code]||{};
        return `<div style="padding:6px 12px;background:rgba(220,38,38,.06);border-radius:8px;margin-bottom:3px;border-left:2px solid #dc2626;font-size:11px;">
          ⚠️ FRAC ${code} (${info.name||code}) — применено ${cnt} раз · ${info.risk} риск
        </div>`;
      }).join('')
    });
  }

  // ── РЕНДЕР ВСЕХ СЕКЦИЙ ────────────────────────────────────────────────
  if(!sections.length) {
    el.innerHTML = '<div style="padding:20px;color:var(--text3);font-size:13px;">⏳ Нет данных для отображения. Убедитесь что данные погоды и зоны полива загружены.</div>';
    return;
  }

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      ${sections.map(s=>`
        <div class="card" style="border-left:3px solid ${s.color};">
          <div style="font-size:12px;font-weight:700;color:${s.color};margin-bottom:10px;">${s.title}</div>
          ${s.content}
        </div>`).join('')}
    </div>
    <div style="margin-top:12px;font-size:11px;color:var(--text3);text-align:center;">
      Последнее обновление: ${now.toLocaleTimeString('ru-RU')} · 
      <a href="#" onclick="switchTab('ailog',document.querySelector('.tab[onclick*=\'ailog\']'));return false;" style="color:var(--blue);">Открыть журнал AI →</a>
    </div>`;
  } catch(e) {
    console.error('[Dashboard] Error:', e);
    el.innerHTML = `<div style="padding:20px;background:rgba(220,38,38,.08);border-radius:10px;color:var(--red);font-size:12px;">
      ⚠️ Ошибка загрузки дашборда: ${e.message}<br>
      <span style="font-size:11px;color:var(--text3);">Попробуйте обновить страницу (Ctrl+Shift+R)</span>
    </div>`;
  }
}

// ═══ ТЕХНИКА / НАВЕСНОЕ / ПЕРСОНАЛ ══════════════════════════════════════

async function loadEquipLists() {
  // Техника
  let equip = [], attach = [], staff = [];
  try { const eq = await fetch('/api/equipment', {headers:getAuthHeaders()}).then(r=>r.json()); equip = Array.isArray(eq)?eq:(eq.data||[]); } catch(e) {}
  try { const at = await fetch('/api/attachments', {headers:getAuthHeaders()}).then(r=>r.json()); attach = Array.isArray(at)?at:(at.data||[]); } catch(e) {}
  try { const st = await fetch('/api/staff', {headers:getAuthHeaders()}).then(r=>r.json()); staff = Array.isArray(st)?st:(st.data||[]); } catch(e) {}

  const STATUS = {free:'✅ Свободна', busy:'🔄 Занята', repair:'🔧 В ремонте'};
  const ETYPE = {tractor:'🚜',sprayer:'💧',harvester:'🌾',truck:'🚛',other:'🔧'};
  const ATYPE = {sprayer:'💊',mower:'✂️',spreader:'🌱',plow:'🌾',other:'🔧'};
  const SROLE = {mechanic:'🚜 Механизатор',agronomist:'🌿 Агроном',worker:'👷 Рабочий',manager:'📋 Бригадир/Менеджер',accountant:'📊 Бухгалтер',admin:'🖥️ Администратор',operator:'⚙️ Оператор',other:'👤 Другое'};

  const equipEl = document.getElementById('equip-list');
  if(equipEl) {
    if(!equip.length) {
      equipEl.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px;">Техника не добавлена</div>';
    } else {
      equipEl.innerHTML = `<table class="data-table"><thead><tr>
        <th>Техника</th><th>Тип</th><th>Год</th><th>Статус</th><th>Примечание</th><th></th>
      </tr></thead><tbody>${equip.map(e=>`<tr>
        <td><strong>${e.name}</strong></td>
        <td>${ETYPE[e.type]||'🔧'} ${e.type||'—'}</td>
        <td style="color:var(--text3);">${e.year||'—'}</td>
        <td><span style="padding:2px 8px;border-radius:10px;font-size:11px;background:${e.status==='free'?'rgba(74,222,128,.15)':e.status==='repair'?'rgba(239,68,68,.15)':'rgba(251,191,36,.15)'};color:${e.status==='free'?'var(--accent)':e.status==='repair'?'var(--red)':'var(--yellow)'};">${STATUS[e.status]||e.status||'—'}</span></td>
        <td style="color:var(--text3);font-size:11px;">${e.note||'—'}</td>
        <td><button class="btn btn-secondary btn-xs" onclick="openEquipModal(${JSON.stringify(e).replace(/"/g,'&quot;')})">✏️</button></td>
      </tr>`).join('')}</tbody></table>`;
    }
  }

  const attachEl = document.getElementById('attach-list');
  if(attachEl) {
    if(!attach.length) {
      attachEl.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px;">Навесное не добавлено</div>';
    } else {
      attachEl.innerHTML = `<table class="data-table"><thead><tr>
        <th>Навесное</th><th>Тип</th><th>Объём/ширина</th><th>Примечание</th><th></th>
      </tr></thead><tbody>${attach.map(a=>`<tr>
        <td><strong>${a.name}</strong></td>
        <td>${ATYPE[a.type]||'🔧'} ${a.type||'—'}</td>
        <td style="color:var(--text3);">${a.capacity||'—'}</td>
        <td style="color:var(--text3);font-size:11px;">${a.note||'—'}</td>
        <td><button class="btn btn-secondary btn-xs" onclick="openAttachModal(${JSON.stringify(a).replace(/"/g,'&quot;')})">✏️</button></td>
      </tr>`).join('')}</tbody></table>`;
    }
  }

  const staffEl = document.getElementById('staff-list');
  if(staffEl) {
    if(!staff.length) {
      staffEl.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px;">Персонал не добавлен</div>';
    } else {
      staffEl.innerHTML = `<table class="data-table"><thead><tr>
        <th>Имя</th><th>Должность</th><th>Телефон</th><th></th>
      </tr></thead><tbody>${staff.map(s=>`<tr>
        <td><strong>${s.name}</strong></td>
        <td>${SROLE[s.role]||s.role||'—'}</td>
        <td style="color:var(--text3);">${s.phone||'—'}</td>
        <td><button class="btn btn-secondary btn-xs" onclick="openStaffModal(${JSON.stringify(s).replace(/"/g,'&quot;')})">✏️</button></td>
      </tr>`).join('')}</tbody></table>`;
    }
  }

  // Обновляем _taskStaff кэш
  if(staff.length) _taskStaff = staff;
}

function openEquipModal(e) {
  document.getElementById('equip-edit-id').value = e?.id||'';
  document.getElementById('equip-name').value = e?.name||'';
  document.getElementById('equip-type').value = e?.type||'tractor';
  document.getElementById('equip-status').value = e?.status||'free';
  document.getElementById('equip-year').value = e?.year||'';
  document.getElementById('equip-note').value = e?.note||'';
  document.getElementById('equip-modal-title').textContent = e ? '✏️ Редактировать технику' : '🚜 Новая техника';
  document.getElementById('equip-del-btn').style.display = e ? 'block' : 'none';
  openModal('modal-equip');
}

async function saveEquip() {
  const id = document.getElementById('equip-edit-id').value;
  const body = {
    name: document.getElementById('equip-name').value.trim(),
    type: document.getElementById('equip-type').value,
    status: document.getElementById('equip-status').value,
    year: document.getElementById('equip-year').value||null,
    note: document.getElementById('equip-note').value.trim(),
  };
  if(!body.name){alert('Введите название');return;}
  try {
    if(id) {
      await fetch(`/api/equipment/${id}`, {method:'PUT', headers: getAuthHeaders(), body:JSON.stringify(body)});
    } else {
      await fetch('/api/equipment', {method:'POST', headers: getAuthHeaders(), body:JSON.stringify(body)});
    }
  } catch(e) { alert('Ошибка сохранения: '+e.message); return; }
  closeModal('modal-equip');
  loadEquipLists();
}

async function deleteEquip() {
  const id = document.getElementById('equip-edit-id').value;
  if(!id||!confirm('Удалить технику?')) return;
  try { await fetch(`/api/equipment/${id}`, {method:'DELETE'}); } catch(e) {}
  closeModal('modal-equip');
  loadEquipLists();
}

function openAttachModal(a) {
  document.getElementById('attach-edit-id').value = a?.id||'';
  document.getElementById('attach-name').value = a?.name||'';
  document.getElementById('attach-type').value = a?.type||'sprayer';
  document.getElementById('attach-capacity').value = a?.capacity||'';
  document.getElementById('attach-note').value = a?.note||'';
  document.getElementById('attach-modal-title').textContent = a ? '✏️ Редактировать навесное' : '🔩 Новое навесное';
  document.getElementById('attach-del-btn').style.display = a ? 'block' : 'none';
  openModal('modal-attach');
}

async function saveAttach() {
  const id = document.getElementById('attach-edit-id').value;
  const body = {
    name: document.getElementById('attach-name').value.trim(),
    type: document.getElementById('attach-type').value,
    capacity: document.getElementById('attach-capacity').value.trim(),
    note: document.getElementById('attach-note').value.trim(),
  };
  if(!body.name){alert('Введите название');return;}
  try {
    if(id) {
      await fetch(`/api/attachments/${id}`, {method:'PUT', headers: getAuthHeaders(), body:JSON.stringify(body)});
    } else {
      await fetch('/api/attachments', {method:'POST', headers: getAuthHeaders(), body:JSON.stringify(body)});
    }
  } catch(e) { alert('Ошибка сохранения: '+e.message); return; }
  closeModal('modal-attach');
  loadEquipLists();
}

async function deleteAttach() {
  const id = document.getElementById('attach-edit-id').value;
  if(!id||!confirm('Удалить навесное?')) return;
  try { await fetch(`/api/attachments/${id}`, {method:'DELETE'}); } catch(e) {}
  closeModal('modal-attach');
  loadEquipLists();
}


// ═══════════════════════════════════════════════════════════════════════════
// 📥 ИМПОРТ / ШАБЛОН ПЕРСОНАЛА
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// 📥 ИМПОРТ / ШАБЛОН ТЕХНИКИ И НАВЕСНОГО
// ═══════════════════════════════════════════════════════════════════════════

function downloadEquipTemplate() {
  if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }
  const wb = XLSX.utils.book_new();

  // Лист 1: Техника
  const equipHeaders = ['Название*', 'Тип (tractor/sprayer/harvester/truck/other)', 'Год выпуска', 'Статус (free/busy/repair)', 'Гос. номер', 'Примечание'];
  const equipExamples = [
    ['МТЗ-82', 'tractor', 2018, 'free', 'MD-123-AB', ''],
    ['Matrot', 'sprayer', 2020, 'free', 'MD-456-CD', 'Прицепной опрыскиватель'],
    ['ГАЗ-3307', 'truck', 2015, 'free', 'MD-789-EF', ''],
  ];
  const equipInfo = [
    [], ['Типы техники:'],
    ['tractor = 🚜 Трактор'], ['sprayer = 💧 Опрыскиватель'],
    ['harvester = 🌾 Комбайн'], ['truck = 🚛 Грузовик'], ['other = 🔧 Другое'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet([equipHeaders, ...equipExamples, ...equipInfo]);
  ws1['!cols'] = [20, 30, 12, 16, 14, 25].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws1, 'Техника');

  // Лист 2: Навесное
  const attachHeaders = ['Название*', 'Тип (sprayer/mower/spreader/plow/cultivator/other)', 'Объём/ширина', 'Примечание'];
  const attachExamples = [
    ['Туман-2', 'sprayer', '2000л', ''],
    ['ОПШ-15', 'sprayer', '1500л', ''],
    ['Культиватор КРН', 'cultivator', '6м', ''],
    ['Борона БДП-3', 'plow', '3м', ''],
  ];
  const attachInfo = [
    [], ['Типы навесного:'],
    ['sprayer = 💊 Опрыскиватель'], ['mower = ✂️ Косилка'],
    ['spreader = 🌱 Разбрасыватель'], ['plow = 🌾 Плуг/Борона'],
    ['cultivator = 🔧 Культиватор'], ['other = 🔧 Другое'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet([attachHeaders, ...attachExamples, ...attachInfo]);
  ws2['!cols'] = [20, 35, 14, 25].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws2, 'Навесное');

  XLSX.writeFile(wb, 'шаблон_техника.xlsx');
}

async function importEquipFromExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }

  const TYPE_MAP = {
    'tractor':'tractor','трактор':'tractor','мтз':'tractor',
    'sprayer':'sprayer','опрыскиватель':'sprayer',
    'harvester':'harvester','комбайн':'harvester',
    'truck':'truck','грузовик':'truck','газ':'truck','камаз':'truck',
  };
  const ATTACH_TYPE_MAP = {
    'sprayer':'sprayer','опрыскиватель':'sprayer','туман':'sprayer',
    'mower':'mower','косилка':'mower',
    'spreader':'spreader','разбрасыватель':'spreader','мву':'spreader',
    'plow':'plow','плуг':'plow','борона':'plow','бдп':'plow',
    'cultivator':'cultivator','культиватор':'cultivator','крн':'cultivator',
    'trailer':'trailer','прицеп':'trailer',
  };

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
      let addedEquip = 0, addedAttach = 0, skipped = 0;

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
        if (rows.length < 2) continue;

        const H = rows[0].map(h=>String(h).toLowerCase().trim());
        const col = (...kws) => { for(const kw of kws){ const i=H.findIndex(h=>h.includes(kw)); if(i>=0) return i; } return -1; };
        const iName = col('назван','name');
        if (iName < 0) continue;

        const isAttach = sheetName.toLowerCase().includes('навес') || sheetName.toLowerCase().includes('attach');

        const iType   = col('тип','type');
        const iYear   = col('год','year');
        const iStatus = col('статус','status');
        const iNote   = col('примеч','note');
        const iReg    = col('номер','reg','гос');
        const iCap    = col('объём','объем','ширина','cap','width');

        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          const name = String(r[iName]||'').trim();
          if (!name || name.startsWith('Типы') || name.startsWith('tractor')) { skipped++; continue; }

          const rawType = String(r[iType]||'').toLowerCase().trim();

          if (isAttach) {
            const type = Object.entries(ATTACH_TYPE_MAP).find(([k])=>rawType.includes(k))?.[1] || rawType || 'other';
            try {
              await fetch('/api/attachments', {
                method:'POST', headers: getAuthHeaders(),
                body: JSON.stringify({ id:uid(), name, type, capacity:String(r[iCap]||'').trim(), note:String(r[iNote]||'').trim() })
              });
              addedAttach++;
            } catch(e) { skipped++; }
          } else {
            const type = Object.entries(TYPE_MAP).find(([k])=>rawType.includes(k) || name.toLowerCase().includes(k))?.[1] || rawType || 'other';
            try {
              await fetch('/api/equipment', {
                method:'POST', headers: getAuthHeaders(),
                body: JSON.stringify({ id:uid(), name, type, year:parseInt(r[iYear])||null, status:String(r[iStatus]||'free').trim(), regNo:String(r[iReg]||'').trim(), note:String(r[iNote]||'').trim() })
              });
              addedEquip++;
            } catch(e) { skipped++; }
          }
        }
      }

      await loadEquipLists();
      alert(`✅ Импорт завершён:\n• Техника: ${addedEquip}\n• Навесное: ${addedAttach}\n• Пропущено: ${skipped}`);
    } catch(err) {
      alert('Ошибка импорта: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function downloadStaffTemplate() {
  if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }
  const wb = XLSX.utils.book_new();
  const headers = ['Имя и фамилия*', 'Должность (mechanic/agronomist/worker/manager/other)', 'Телефон', 'Примечание'];
  const examples = [
    ['Иван Петров', 'mechanic', '+373 69 123 456', 'Тракторист'],
    ['Мария Иванова', 'agronomist', '+373 69 234 567', 'Главный агроном'],
    ['Андрей Сидоров', 'worker', '+373 69 345 678', ''],
    ['Петр Козлов', 'manager', '+373 69 456 789', 'Бригадир'],
  ];
  const info = [
    [],
    ['Допустимые значения должности:'],
    ['mechanic = 🚜 Механизатор'],
    ['agronomist = 🌿 Агроном'],
    ['worker = 👷 Рабочий'],
    ['manager = 📋 Бригадир'],
    ['other = Другое'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples, ...info]);
  ws['!cols'] = [25, 35, 18, 20].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws, 'Персонал');
  XLSX.writeFile(wb, 'шаблон_персонал.xlsx');
}

async function importStaffFromExcel(eventOrEl) {
  const el = eventOrEl?.target || eventOrEl;
  const file = el?.files?.[0];
  if (!file) return;
  el.value = '';
  if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }

  const ROLE_MAP = {
    'mechanic':'mechanic','механизатор':'mechanic','тракторист':'mechanic',
    'agronomist':'agronomist','агроном':'agronomist',
    'worker':'worker','рабочий':'worker',
    'manager':'manager','бригадир':'manager','мастер':'manager','менеджер':'manager',
    'accountant':'accountant','бухгалтер':'accountant',
    'admin':'admin','администратор':'admin',
    'operator':'operator','оператор':'operator',
  };

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      if (rows.length < 2) { alert('Файл пустой'); return; }

      const H = rows[0].map(h=>String(h).toLowerCase().trim());
      const col = (...kws) => { for(const kw of kws){ const i=H.findIndex(h=>h.includes(kw)); if(i>=0) return i; } return -1; };

      const iName  = col('имя','name','фамил');
      const iRole  = col('должн','role','position');
      const iPhone = col('телеф','phone');
      const iNote  = col('примеч','note');

      if (iName < 0) { alert('Не найдена колонка «Имя». Используйте шаблон.'); return; }

      let added = 0, skipped = 0;
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const name = String(r[iName]||'').trim();
        if (!name || name.startsWith('Допустим') || name.startsWith('mechanic')) { skipped++; continue; }

        const rawRole = String(r[iRole]||'').toLowerCase().trim();
        const role = ROLE_MAP[rawRole] || rawRole || 'other';
        const phone = String(r[iPhone]||'').trim();
        const note  = String(r[iNote]||'').trim();

        try {
          await fetch('/api/staff', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ id: uid(), name, role, phone, note })
          });
          added++;
        } catch(e) { skipped++; }
      }

      await loadEquipLists();
      alert(`✅ Импорт завершён:\n• Добавлено: ${added}\n• Пропущено: ${skipped}`);
    } catch(err) {
      alert('Ошибка импорта: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function openStaffModal(s) {
  document.getElementById('staff-edit-id').value = s?.id||'';
  document.getElementById('staff-name').value = s?.name||'';
  document.getElementById('staff-role').value = s?.role||'mechanic';
  document.getElementById('staff-phone').value = s?.phone||'';
  document.getElementById('staff-modal-title').textContent = s ? '✏️ Редактировать сотрудника' : '👷 Новый сотрудник';
  document.getElementById('staff-del-btn').style.display = s ? 'block' : 'none';
  openModal('modal-staff');
}

async function saveStaff() {
  const id = document.getElementById('staff-edit-id').value;
  const body = {
    name: document.getElementById('staff-name').value.trim(),
    role: document.getElementById('staff-role').value,
    phone: document.getElementById('staff-phone').value.trim(),
  };
  if(!body.name){alert('Введите имя');return;}
  try {
    const newId = id || uid();
    await fetch('/api/staff', {
      method:'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({...body, id: newId})
    });
  } catch(e) { alert('Ошибка сохранения: '+e.message); return; }
  closeModal('modal-staff');
  loadEquipLists();
  _taskStaff = []; // сбрасываем кэш
}

async function deleteStaff() {
  const id = document.getElementById('staff-edit-id').value;
  if(!id||!confirm('Удалить сотрудника?')) return;
  try { await fetch(`/api/staff/${id}`, {method:'DELETE', headers: getAuthHeaders()}); } catch(e) {}
  closeModal('modal-staff');
  loadEquipLists();
  _taskStaff = [];
}

function loadSettings(){
  document.getElementById('set-rows').value = S.rows;
  document.getElementById('set-cols').value = S.cols;
  document.getElementById('wash-p').value = S.settings.washPartial||10;
  document.getElementById('wash-f').value = S.settings.washFull||25;
  // Паспорт сада
  if(document.getElementById('set-cover'))       document.getElementById('set-cover').value       = S.settings.orchardCover||'none';
  if(document.getElementById('set-planting'))    document.getElementById('set-planting').value    = S.settings.orchardPlanting||'4x2';
  if(document.getElementById('set-rootstock'))   document.getElementById('set-rootstock').value   = S.settings.orchardRootstock||'gisela5';
  if(document.getElementById('set-sensor-depth'))document.getElementById('set-sensor-depth').value= S.settings.sensorDepth||'20-40';
  if(document.getElementById('set-ca-carbonate'))document.getElementById('set-ca-carbonate').value= S.settings.caCarbonate||'';
}
function saveSettings(){
  S.settings.washPartial   = parseInt(document.getElementById('wash-p').value)||10;
  S.settings.washFull      = parseInt(document.getElementById('wash-f').value)||25;
  // Паспорт сада
  const cover = document.getElementById('set-cover');
  if(cover) S.settings.orchardCover = cover.value;
  const planting = document.getElementById('set-planting');
  if(planting) S.settings.orchardPlanting = planting.value;
  const rootstock = document.getElementById('set-rootstock');
  if(rootstock) S.settings.orchardRootstock = rootstock.value;
  const sensorD = document.getElementById('set-sensor-depth');
  if(sensorD) S.settings.sensorDepth = sensorD.value;
  const caCarb = document.getElementById('set-ca-carbonate');
  if(caCarb) S.settings.caCarbonate = parseFloat(caCarb.value)||null;
  save();
  // Визуальное подтверждение
  const btn = document.querySelector('[onclick="saveSettings()"]');
  if(btn){ const orig=btn.textContent; btn.textContent='✅ Сохранено!'; btn.style.background='var(--accent)'; setTimeout(()=>{btn.textContent=orig;btn.style.background='';},2000); }
}
function exportData(){const b=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='passport_sad_'+new Date().toISOString().split('T')[0]+'.json';a.click();}
function importData(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{Object.assign(S,JSON.parse(ev.target.result));save();init();alert('Импортировано!');}catch{alert('Ошибка файла');}};r.readAsText(f);}
function resetData(){localStorage.removeItem('cherry_v5');sessionStorage.clear();location.reload();}

// ===================== MODALS =====================
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.addEventListener('click',e=>{
  if(e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
  // Закрываем dropdown препаратов если клик вне его
  if(!e.target.closest('#nt-chem-search') && !e.target.closest('#nt-chem-dropdown')) {
    const dd = document.getElementById('nt-chem-dropdown');
    if(dd) dd.style.display='none';
  }
});

// ============================================================
// GDD ENGINE v2 — spec-compliant per "Цифровой агроном сада"
// Pure functions. All parameters from S.gddDb — not hardcoded.
// ============================================================

/** Step 1-2: GDD for one day. Formula: ((Tmax+Tmin)/2) - base */
function calcDailyGdd(tmin, tmax, tbase, cutoff) {
  // Молдова/южные регионы: cut-off +30°C
  // При Tmax > 30°C дерево в стрессе — используем 30 вместо реального Tmax
  // Источник: модифицированная формула GDD для южных регионов (Молдова, Херцеговина)
  if (tmin === null || tmin === undefined || tmax === null || tmax === undefined) return 0;
  const tminF = parseFloat(tmin);
  const tmaxF = parseFloat(tmax);
  const heatCutoff = cutoff || 30; // верхний порог биологической активности
  const tmaxCapped = Math.min(tmaxF, heatCutoff); // срез жары
  const avg = (tmaxCapped + tminF) / 2;
  return Math.max(0, Math.round((avg - tbase) * 10) / 10);
}

// Проверка дня на тепловой стресс (Tmax > 30°C)
function isHeatStressDay(tmax) {
  return parseFloat(tmax) > 30;
}

/** GDD start date: uses chill portions result if available, else from DB or March 1 */
function getGddStartDate(varietyId) {
  // If chill portions are configured for this variety — use chill completion date
  if (varietyId && S.chillPortions.cultivarSettings.length) {
    const cs = S.chillPortions.cultivarSettings.find(c=>c.varietyId===varietyId);
    if (cs) {
      const chillStart = getGddStartForVariety(varietyId);
      if (chillStart === 'blocked') {
        return new Date().getFullYear()+'-12-31';
      }
      if (chillStart) return chillStart;
    }
  }
  // Молдова / Восточная Европа: официальный старт с 1 марта
  // "Февральские окна" игнорируются — Регина не просыпается от короткого февральского тепла
  if (S.gddDb.startDate) return S.gddDb.startDate;
  return `${new Date().getFullYear()}-03-01`;
}

/** Step 3: Build cumulative GDD series from weather log */
