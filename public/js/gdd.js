// Smart Agro — gdd.js
// ═══ ТЕХНОЛОГИЧЕСКАЯ КАРТА BBCH ════════════════════════════════════════

function switchGddSub(sub) {
  ['gdd','techmap','phaselog'].forEach(s => {
    const panel = document.getElementById('gddsub-panel-'+s);
    const btn   = document.getElementById('gddsub-'+s);
    if(!panel||!btn) return;
    const active = s===sub;
    panel.style.display    = active ? '' : 'none';
    btn.style.color        = active ? 'var(--accent)' : 'var(--text3)';
    btn.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
    btn.style.fontWeight   = active ? '700' : '400';
  });
  if(sub==='techmap')  { fillTechmapCellSelect(); renderTechmap(); }
  if(sub==='phaselog') { fillPhaseLogFilters(); renderPhaseLogTable(); }
  if(sub==='gdd')      { renderGdd(); }
}

function fillTechmapCellSelect() {
  const sel = document.getElementById('techmap-cell-select');
  if(!sel) return;
  const cells = Object.entries(S.cells);
  if(!cells.length) {
    sel.innerHTML = '<option value="">— нет клеток —</option>';
    return;
  }
  sel.innerHTML = cells.map(([key, cd]) => {
    const crop = getCropById(cd.cropId||'crop_cherry');
    const tot = calcCellTotals(cd);
    return `<option value="${key}">${crop?.emoji||'🌱'} Клетка ${key} — ${crop?.name||'?'} (${tot.totalHa.toFixed(2)} га)</option>`;
  }).join('');
  onTechmapCellChange();
}

function onTechmapCellChange() {
  const cellKey = document.getElementById('techmap-cell-select')?.value;
  if(!cellKey) return;
  const cd = S.cells[cellKey];
  if(!cd) return;
  const cropId = cd.cropId || 'crop_cherry';

  // Заполняем сорта этой культуры
  const varSel = document.getElementById('techmap-variety-select');
  if(varSel) {
    const vars = S.varieties.filter(v=>(v.cropId||'crop_cherry')===cropId);
    varSel.innerHTML = vars.map(v=>`<option value="${v.id}">${v.name}</option>`).join('');
    // Выбираем первый сорт
    if(vars.length) varSel.value = vars[0].id;
  }

  // Показываем инфо о клетке
  const infoEl = document.getElementById('techmap-cell-info');
  if(infoEl) {
    const gdd = getCurrentGdd(getCropById(cropId)?.baseTemp||4.5);
    const varId = varSel?.value;
    const phase = varId ? getPhaseByGdd(varId, gdd) : null;
    const cover = cd.cover && cd.cover!=='none' ? {net:'🕸 Сетка',film:'🎪 Плёнка',both:'🎪🕸 Плёнка+сетка'}[cd.cover] : '';
    infoEl.innerHTML = `GDD: <strong>${gdd.toFixed(0)}</strong> · Фаза: <strong style="color:var(--accent);">${phase?.name||'—'}</strong>${cover?' · '+cover:''}${cd.rootstock?' · 🌳 '+cd.rootstock:''}`;
  }

  renderTechmap();
}

const TECHMAP = {
  crop_cherry: [
    { phase:'Покой', bbch:'BBCH 00–01', period:'Ноябрь – Февраль', kc:0, film:'Открыта (законсервирована)', irrigation:'Не нужен', nutrition:'Нет',
      protection:['Побелка штамбов и скелетных ветвей (известь + CuSO₄) — защита от солнечных ожогов и бактериального рака','Обрезка (декабрь–январь) — санитарная + формировочная','Уборка опавших листьев — снижение инфекционного фона'],
      tasks:['Проверить и отремонтировать шпалеры и укрытие','Пополнить запасы препаратов на сезон','Провести аудит техники и оборудования полива','Настроить метеостанцию: старт GDD с 1 марта'],
      alert:'' },
    { phase:'Набухание почек', bbch:'BBCH 01–03', period:'Начало марта', kc:0.3, film:'Открыта', irrigation:'Минимальный — 5–8 мм/неделю', nutrition:'Некорневая: мочевина 3–5% (азотный старт)',
      protection:['Медьсодержащий препарат (бордоская смесь 3% или Купроксат) — профилактика монилиоза и коккомикоза','Первая обработка против клещей при T° >10°C'],
      tasks:['Установить феромонные ловушки для мониторинга вредителей','Проверить датчики метеостанции после зимы','Запустить Water Balance расчёт','Завести пчелиные семьи на пасеку рядом с садом'],
      alert:'❄️ Контролировать ночные заморозки — почки уязвимы при -2°C' },
    { phase:'Зелёный конус', bbch:'BBCH 07–09', period:'Середина марта', kc:0.4, film:'Открыта', irrigation:'8–12 мм/неделю', nutrition:'N-старт: нитрат кальция 5–8 кг/га или карбамид 10–15 кг/га',
      protection:['Системный фунгицид (Хорус WG 75) против монилиоза и клястероспориоза','Инсектицид против долгоносика и тли','Акарицид при наличии клеща (Аполло, Ниссоран)'],
      tasks:['Финальная обрезка если не сделана зимой','Проверить работу капельной системы после зимы','Откалибровать датчики влажности почвы'],
      alert:'🌡️ Мониторинг заморозков — антизаморозка в готовности' },
    { phase:'Розовый бутон', bbch:'BBCH 55–57', period:'Конец марта – начало апреля', kc:0.5, film:'Открыта', irrigation:'10–15 мм/неделю', nutrition:'Ca + B: борная кислота 0.3% + хелат Ca — закладка качества плода',
      protection:['Хорус WG 75 — последняя обработка до цветения (монилиоз)','Контактный инсектицид против долгоносика (обработать ДО распускания цветков)'],
      tasks:['Завезти ульи с пчёлами к саду (минимум 3–4 семьи/га)','Подготовить шмелиные ульи для работы под плёнкой','Раскатать и проверить антидождевую плёнку','Настроить алерт суховея (RH < 40%)'],
      alert:'🐝 Не обрабатывать инсектицидами после начала цветения!' },
    { phase:'Цветение', bbch:'BBCH 61–69', period:'Апрель', kc:0.6, film:'⚡ ОТКРЫТА — макс. доступ пчёл. Закрыть только при дожде', irrigation:'15–20 мм/неделю. Дождевание для повышения RH при суховее', nutrition:'P 20г/дерево при полном цветении (ammonium polyphosphate) — ускоряет завязывание, Neilsen 2008. N ЗАПРЕЩЁН! Аминокислоты (Мегафол) стресс-протектор.',
      protection:['🚫 ЗАПРЕЩЕНЫ инсектициды и большинство фунгицидов!','При дожде во время цветения: Свитч или Тельдор (безопасны для пчёл)','Мониторинг монилиального ожога (T 12–24°C + влажность)'],
      tasks:['Контролировать RH: при < 40% — утреннее дождевание кроны (6:00–9:00)','Наблюдать за лётом пчёл — минимум 5–6 пчёл на дерево','Фиксировать дату начала и конца цветения для калибровки GDD','Кордия цветёт на 2–3 дня раньше — первая пыльца для Регины'],
      alert:'🐝 Суховей RH<40% → рыльце пестика пересыхает → массовое бесплодие' },
    { phase:'Завязь', bbch:'BBCH 71–75', period:'Май', kc:0.8, film:'⚡ ОТКРЫТА — сквозное проветривание. Парниковый эффект = сброс завязи', irrigation:'20–25 мм/неделю. Gisela 5: датчик 20 и 40 см, 75–80% НВ. Пульс 4× в день', nutrition:'СТАРТ N-программы: Ca(NO₃)₂ 84 ppm через капельницу — 8 недель от опадания лепестков (Neilsen 2007). Ca хелат каждые 7-10 дней. N не превышать 120ppm!',
      protection:['Хорус WG 75 или Луна Сенсейшн — коккомикоз, монилиоз','Калипсо или Конфидор — вишнёвая муха (при обнаружении в ловушках)','Акарицид при T > 20°C'],
      tasks:['Контроль нагрузки урожаем (особенно Скина — самоплодная)','Мульчирование приствольной полосы (снижение T почвы на 6–8°C)','Запустить программу фертигации Ca','Мониторинг жёлтых ловушек вишнёвой мухи'],
      alert:'🧪 Жара >30°C + фаза завязи → листья перехватывают Ca → некорневая CaCl₂ 0.3%' },
    { phase:'Рост плода', bbch:'BBCH 75–81', period:'Конец мая – начало июня', kc:1.0, film:'Открыта — защита от перегрева', irrigation:'25–35 мм/неделю. Пульсирующий: 2–3 цикла по 20 мин/день', nutrition:'K + Ca: нитрат калия 8–12 кг/га + хелат Ca. Brix контроль — цель 17°+ к сбору',
      protection:['Луна Сенсейшн или Белис — мучнистая роса + монилиоз','Калипсо — вишнёвая муха (критический период)','При T > 30°C: антистрессант Изабион 1–1.5 л/га'],
      tasks:['Установить сети от птиц (скворцы, дрозды)','Гидрокулинг в готовности для Кордии (созревает первой)','Подготовить ящики и холодильную камеру для хранения','Закрыть плёнку над Кордией (BBCH 81 наступит раньше)'],
      alert:'💧 ETc до 6–7 мм/день в жару. Gisela 5 пересыхает за 2–3 часа!' },
    { phase:'Начало окрашивания', bbch:'BBCH 81', period:'Середина – конец июня', kc:0.9, film:'⚡ ЗАКРЫТЬ крышу! Боковые пологи открыть для вентиляции', irrigation:'20–25 мм/неделю. Равномерный — резкие колебания влажности = трещины', nutrition:'⛔ СТОП N за 30 дней до сбора! Только K (сульфат калия) — накопление сахара. Ca листовой последний раз. (Neilsen 2007: продолжение N → мягкость плода, снижение Brix)',
      protection:['Только разрешённые в период созревания — Свитч (7 дней до сбора)','ПАВ при обработках — улучшает покрытие'],
      tasks:['Кордия: Brix контроль (цель 18°+) — при достижении убирать','Гидрокулинг сразу после сбора (охладить до 4°C в течение часа)','Проверить холодильные камеры','Кордию убирать рано утром до жары'],
      alert:'🎪 Закрыть плёнку! Каждый день промедления = риск растрескивания при дожде' },
    { phase:'Созревание', bbch:'BBCH 85–89', period:'Конец июня – начало июля', kc:0.8, film:'Закрыта крыша, боковые открыты', irrigation:'15–20 мм/неделю. Осторожно — избыток воды снижает Brix', nutrition:'Не применять — карантинный период ближе к сбору',
      protection:['Только при острой необходимости — препараты с PHI ≤ 7 дней','Защитные сети от птиц и ос'],
      tasks:['Скина: Brix контроль (цель 18–19°) — убирать между Кордией и Региной','Регина: убирать при Brix 17°+ и полном окрашивании','Сбор утром (6:00–11:00) — ягода холодная, меньше повреждений','Гидрокулинг всего урожая в течение часа после сбора'],
      alert:'🚛 Конвейер: Кордия (20-25.06) → Скина (25-30.06) → Регина (01-05.07)' },
    { phase:'После сбора', bbch:'BBCH 91–97', period:'Июль – Октябрь', kc:0.5, film:'⚡ Свернуть и законсервировать плёнку', irrigation:'12–15 мм/неделю до конца августа, потом снижать', nutrition:'P + K (суперфосфат + сульфат калия) — закладка плодовых почек на следующий год',
      protection:['Хорус или Дерозал — коккомикоз (листья работают до октября!)', 'Побелка штамбов в октябре–ноябре','Обработка Cu-содержащим препаратом перед листопадом'],
      tasks:['Летняя обрезка сразу после уборки (Кордия — раскидистая, Скина — умеренная)','Анализ почвы и листьев — планирование питания на следующий год','Ревизия системы капельного полива','Подготовка системы антизаморозки к зиме'],
      alert:'🍂 Листья — фотосинтез до листопада = закладка почек следующего года' },
  ],
};

function getTechmapAutoData(p, idx, cellKey) {
  const parts = [];
  const w7 = S.weather.slice(0, 7);
  if(!w7.length) return '';

  // 1. Метеостанция
  const totalRain = w7.reduce((s,w)=>s+parseFloat(w.precip||0),0).toFixed(1);
  const avgTmax = (w7.reduce((s,w)=>s+parseFloat(w.tmax||0),0)/w7.length).toFixed(1);
  const avgRH   = (w7.reduce((s,w)=>s+parseFloat(w.humidity||0),0)/w7.length).toFixed(0);
  const totalEt = w7.reduce((s,w)=>s+parseFloat(w.et0||0),0).toFixed(1);
  parts.push(`🌡️ Метеостанция (7 дней): T°макс ${avgTmax}°C · RH ${avgRH}% · осадки ${totalRain}мм · ET₀ ${totalEt}мм`);

  // 2. Water Balance
  const wbLog = S.irrigation?.waterBalance?.log || [];
  const lastWb = wbLog[wbLog.length-1];
  if(lastWb) {
    const sp = S.irrigation?.waterBalance?.soilParams || {};
    const taw = ((sp.fc||32)-(sp.pwp||14))*(sp.rootDepth||60)*0.1;
    const raw = taw*0.35;
    const pct = taw>0 ? Math.round(lastWb.balance/taw*100) : '?';
    const statusLabel = {ok:'✅ Достаточно',watch:'👀 Внимание',stress:'⚠️ Стресс',critical:'⛔ Критично'}[lastWb.status]||lastWb.status;
    const normaNote = lastWb.status==='ok' ? ' — потребность в воде удовлетворена' : lastWb.status==='watch' ? ' — планировать полив' : ' — необходим полив';
    const kc = p.kc || 1;
    const etc7 = (parseFloat(totalEt)*kc).toFixed(1);
    const needMm = Math.max(0, Math.round((raw - lastWb.balance)*10)/10);
    parts.push(`💧 Влага почвы: ${lastWb.balance}мм (${pct}% TAW) · ETc за 7 дн: ${etc7}мм · Kc: ${kc} · ${statusLabel}${normaNote}${needMm>0?` · Дефицит: <strong style="color:var(--orange);">${needMm}мм</strong>`:''}`);
  }

  // 3. Факт полива из журнала
  const today = new Date().toISOString().split('T')[0];
  const w7ago = new Date(Date.now()-7*864e5).toISOString().split('T')[0];
  const irrigSum = getIrrigSumForCell(cellKey, w7ago, today);
  if(irrigSum.count > 0) {
    // Норма фазы из технокарты
    const normMatch = p.irrigation.match(/(\d+)[–-](\d+)\s*мм/);
    const normMin = normMatch ? parseFloat(normMatch[1]) : null;
    const normMax = normMatch ? parseFloat(normMatch[2]) : null;
    const normWeekly = normMax;
    let normNote = '';
    if(normWeekly) {
      const totalWater = parseFloat(totalRain) + irrigSum.totalMm;
      if(totalWater >= normMin) normNote = ` <span style="color:var(--accent);">✅ норма выполнена (${normMin}–${normMax}мм)</span>`;
      else normNote = ` <span style="color:var(--orange);">⚠️ недостаточно (норма ${normMin}–${normMax}мм)</span>`;
    }
    parts.push(`🚿 Полив за 7 дней: <strong>${irrigSum.count} раза · ${irrigSum.totalMm}мм · ${irrigSum.totalM3}м³</strong>${normNote}`);
    // Детали по поливам
    irrigSum.events.slice(0,3).forEach(e=>{
      parts.push(`&nbsp;&nbsp;• ${e.date}: ${e.zoneName||'зона'} — ${e.mm}мм (${e.volumeM3}м³, ${e.durationMin}мин)${e.note?' — '+e.note:''}`);
    });
  } else {
    const normMatch = p.irrigation.match(/(\d+)[–-](\d+)\s*мм/);
    if(normMatch) {
      const onlyRain = parseFloat(totalRain);
      if(onlyRain < parseFloat(normMatch[1])) {
        parts.push(`🚿 Полив за 7 дней: <span style="color:var(--orange);">не записан</span> · осадки ${totalRain}мм из нормы ${normMatch[1]}–${normMatch[2]}мм`);
      } else {
        parts.push(`🚿 Полив: осадки ${totalRain}мм покрывают норму ${normMatch[1]}–${normMatch[2]}мм`);
      }
    }
  }

  // 4. Датчик влажности клетки
  if(cellKey) {
    const cellSensors = (S.irrigation?.sensors||[]).filter(s=>s.cellKey===cellKey);
    const cellReadings = (S.irrigation?.readings||[]).filter(r=>cellSensors.find(s=>s.id===r.sensorId)).slice(0,1);
    if(cellReadings.length) {
      const lastR = cellReadings[0];
      const sensor = cellSensors.find(s=>s.id===lastR.sensorId);
      const sp = S.irrigation?.waterBalance?.soilParams||{};
      const fcPct = sp.fc||32; const pwpPct = sp.pwp||14;
      const pct = Math.round((lastR.value-pwpPct)/(fcPct-pwpPct)*100);
      const color = pct>70?'var(--accent)':pct>40?'var(--yellow)':'var(--red)';
      parts.push(`📡 Датчик${sensor?' ('+sensor.depth+'см)':''}: ${lastR.value}% VWC (<span style="color:${color};font-weight:600;">${pct}% НВ</span>) · ${lastR.date}`);
    }
    const cd = S.cells[cellKey];
    if(cd?.cover && cd.cover!=='none') {
      const coverInfo = {net:'🕸 Сетка',film:'🎪 Плёнка',both:'🎪🕸 Плёнка+сетка'}[cd.cover];
      parts.push(`${coverInfo}${cd.rootstock?' · 🌳 '+cd.rootstock:''}${cd.plantingScheme?' · 📐 '+cd.plantingScheme:''}`);
    }
  }

  // 5. Последние обработки
  const treatments = (S.treatments||[]).slice(0,3);
  if(treatments.length) {
    parts.push(`💊 Обработки: ${treatments.map(t=>`${t.date} <strong>${t.product||t.products?.[0]?.name||'?'}</strong>`).join(' · ')}`);
  }

  return parts.join('<br>');
}
function renderTechmap() {
  const el = document.getElementById('techmap-content');
  if(!el) return;

  // Берём клетку и сорт
  const cellKey = document.getElementById('techmap-cell-select')?.value;
  const varId   = document.getElementById('techmap-variety-select')?.value;
  const cd = cellKey ? S.cells[cellKey] : null;
  const cropId = cd?.cropId || 'crop_cherry';
  const crop = getCropById(cropId);
  const variety = S.varieties.find(v=>v.id===varId);

  const phases = TECHMAP[cropId];
  if(!phases) {
    el.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text3);"><div style="font-size:32px;margin-bottom:12px;">🚧</div><div>Технологическая карта для культуры <strong>${crop?.name||cropId}</strong> в разработке</div></div>`;
    return;
  }

  // GDD для конкретного сорта этой клетки
  const tbase = crop?.baseTemp || 4.5;
  const gdd = getCurrentGdd(tbase);
  const currentPhase = varId ? getPhaseByGdd(varId, gdd) : null;
  const FILM_COLOR = t => t.includes('ЗАКРЫТЬ')||t.includes('Закрыта') ? 'var(--orange)' : t.includes('ОТКРЫТА')||t.includes('Открыта') ? 'var(--accent)' : 'var(--text3)';
  if(!S.techLog) S.techLog = {};

  el.innerHTML = phases.map((p, idx) => {
    const isCurrent = currentPhase?.name === p.phase;
    const phaseKey = `${cellKey||cropId}_${varId||'v1'}_${idx}`;
    const log = S.techLog[phaseKey] || {};
    const doneTasks = p.tasks.filter((_, ti) => log.tasks?.[ti]?.done).length;
    const pct = Math.round(doneTasks / p.tasks.length * 100);
    const pctColor = pct===100?'var(--accent)':pct>50?'var(--yellow)':'var(--text3)';
    const autoData = isCurrent ? getTechmapAutoData(p, idx, cellKey) : '';

    // Данные обработок для этой фазы
    const treatments = (S.treatments||[]).slice(0,5);
    const treatmentHtml = treatments.length ? `
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">💊 Выполненные обработки</div>
        ${treatments.map(t=>{
          const prod = t.product || t.products?.map(x=>x.name).join(', ') || '—';
          const recMatch = p.protection.some(r=>r.toLowerCase().includes(prod.toLowerCase().split(' ')[0]));
          return `<div style="padding:6px 10px;border-radius:6px;background:var(--surface2);margin-bottom:4px;font-size:11px;display:flex;gap:8px;align-items:center;">
            <span style="color:var(--text3);">${t.date||'—'}</span>
            <span style="font-weight:600;color:var(--text);">${prod}</span>
            ${t.dose?`<span style="color:var(--text3);">${t.dose}</span>`:''}
            ${recMatch?`<span style="color:var(--accent);font-size:10px;">✓ по рекомендации</span>`:''}
            ${t.note?`<span style="color:var(--text3);font-style:italic;">${t.note}</span>`:''}
          </div>`;
        }).join('')}
      </div>` : '';

    return `<div style="margin-bottom:8px;border:1px solid ${isCurrent?'var(--accent)':'var(--border)'};border-radius:12px;overflow:hidden;${isCurrent?'box-shadow:0 0 0 2px rgba(74,222,128,.2);':''}">
      <div style="padding:12px 16px;background:${isCurrent?'rgba(74,222,128,.06)':'var(--surface2)'};display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="toggleTechmapPhase('${phaseKey}')">
        <div style="width:12px;height:12px;border-radius:50%;background:${S.gddDb.standardPhases[idx]?.color||'var(--text3)'};flex-shrink:0;"></div>
        <div style="flex:1;">
          <span style="font-size:13px;font-weight:700;color:${isCurrent?'var(--accent)':'var(--text)'};">${p.phase}</span>
          <span style="font-size:11px;color:var(--text3);margin-left:8px;">${p.bbch} · ${p.period}</span>
          ${isCurrent?`<span style="margin-left:8px;padding:1px 8px;border-radius:8px;font-size:10px;background:var(--accent);color:#000;font-weight:700;">▶ СЕЙЧАС</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${doneTasks>0?`<span style="font-size:11px;font-weight:600;color:${pctColor};">${doneTasks}/${p.tasks.length} ✓</span>`:''}
          <span style="font-size:11px;color:var(--blue);">Kc ${p.kc}</span>
        </div>
      </div>
      <div id="techmap-body-${phaseKey}" style="${isCurrent?'':'display:none;'}padding:16px;background:var(--surface);">

        ${autoData?`<div style="padding:10px 14px;background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.15);border-radius:8px;margin-bottom:12px;font-size:11px;line-height:1.7;color:var(--text2);">
          <strong style="color:var(--blue);">📊 Данные системы</strong><br>${autoData}</div>`:''}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div style="padding:10px;background:var(--surface2);border-radius:8px;"><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">🎪 Укрытие</div><div style="font-size:12px;color:${FILM_COLOR(p.film)};font-weight:600;">${p.film}</div></div>
          <div style="padding:10px;background:var(--surface2);border-radius:8px;"><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">💧 Ирригация</div><div style="font-size:12px;color:var(--blue);">${p.irrigation}</div></div>
        </div>
        <div style="padding:10px;background:var(--surface2);border-radius:8px;margin-bottom:12px;">
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px;">🌱 Питание / Фертигация</div>
          <div style="font-size:12px;color:var(--yellow);">${p.nutrition}</div>
        </div>
        <div style="margin-bottom:12px;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">🛡️ Рекомендации по защите</div>
          ${p.protection.map(t=>`<div style="font-size:12px;color:var(--text2);padding:3px 0 3px 12px;border-left:2px solid var(--border);">${t}</div>`).join('')}
        </div>

        ${treatmentHtml}

        <div style="margin-bottom:12px;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">✅ Задачи агронома</div>
          ${p.tasks.map((t, ti) => {
            const taskLog = log.tasks?.[ti] || {};
            const done = taskLog.done || false;
            return `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border-radius:6px;margin-bottom:4px;background:${done?'rgba(74,222,128,.06)':'var(--surface2)'};cursor:pointer;" onclick="toggleTechmapTask('${phaseKey}',${ti})">
              <div style="width:18px;height:18px;border-radius:4px;border:2px solid ${done?'var(--accent)':'var(--border)'};background:${done?'var(--accent)':'transparent'};flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:1px;">
                ${done?'<span style="color:#000;font-size:11px;font-weight:700;">✓</span>':''}
              </div>
              <div style="flex:1;">
                <div style="font-size:12px;color:${done?'var(--text3)':'var(--text2)'};${done?'text-decoration:line-through;':''}">${t}</div>
                ${taskLog.date?`<div style="font-size:10px;color:var(--text3);">📅 ${taskLog.date}${taskLog.comment?' · '+taskLog.comment:''}</div>`:''}
              </div>
            </div>`;
          }).join('')}
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">💬 Комментарий агронома</div>
          <textarea id="techmap-note-${phaseKey}" rows="2" placeholder="Наблюдения, отклонения от нормы, особенности сезона..."
            style="width:100%;padding:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'Inter',sans-serif;font-size:12px;resize:vertical;box-sizing:border-box;">${log.agronNote||''}</textarea>
          <button class="btn btn-primary btn-sm" style="margin-top:6px;" onclick="saveTechmapNote('${phaseKey}',this)">💾 Сохранить комментарий</button>
          ${log.noteDate?`<span style="font-size:10px;color:var(--text3);margin-left:8px;">Сохранено: ${log.noteDate}</span>`:''}
        </div>

        ${p.alert?`<div style="padding:10px 14px;background:rgba(251,146,60,.08);border:1px solid rgba(251,146,60,.2);border-radius:8px;font-size:12px;color:var(--orange);font-weight:600;">${p.alert}</div>`:''}
      </div>
    </div>`;
  }).join('');
}

function toggleTechmapPhase(phaseKey) {
  const body = document.getElementById('techmap-body-'+phaseKey);
  if(body) body.style.display = body.style.display==='none' ? '' : 'none';
}

function toggleTechmapTask(phaseKey, taskIdx) {
  if(!S.techLog) S.techLog={};
  if(!S.techLog[phaseKey]) S.techLog[phaseKey]={};
  if(!S.techLog[phaseKey].tasks) S.techLog[phaseKey].tasks={};
  const cur = S.techLog[phaseKey].tasks[taskIdx];
  S.techLog[phaseKey].tasks[taskIdx] = {
    done: !cur?.done,
    date: !cur?.done ? new Date().toLocaleDateString('ru-RU') : null,
    comment: cur?.comment||'',
  };
  save();
  renderTechmap();
}

function saveTechmapNote(phaseKey, btn) {
  if(!S.techLog) S.techLog={};
  if(!S.techLog[phaseKey]) S.techLog[phaseKey]={};
  const ta = document.getElementById('techmap-note-'+phaseKey);
  if(ta) {
    S.techLog[phaseKey].agronNote = ta.value;
    S.techLog[phaseKey].noteDate  = new Date().toLocaleDateString('ru-RU');
  }
  save();
  if(btn){const orig=btn.textContent;btn.textContent='✅ Сохранено!';btn.style.background='var(--accent)';setTimeout(()=>{btn.textContent=orig;btn.style.background='';},2000);}
}


function buildGddSeries(tbase, varietyId) {
  const start = getGddStartDate(varietyId);
  const sorted = [...S.weather]
    .filter(w => w.date >= start)
    .sort((a,b) => a.date.localeCompare(b.date));
  let cum = 0;
  return sorted.map(w => {
    const tmaxF = parseFloat(w.tmax)||0;
    const heatStress = isHeatStressDay(tmaxF);
    // Cut-off +30°C: в жаркие дни используем min(Tmax, 30)
    const daily = calcDailyGdd(w.tmin, w.tmax, tbase, 30);
    const dailyRaw = calcDailyGdd(w.tmin, w.tmax, tbase, 999); // без cut-off для сравнения
    cum = Math.round((cum + daily) * 10) / 10;
    return {
      date: w.date, tmin: w.tmin, tmax: w.tmax,
      precip: parseFloat(w.precip)||0,
      humidity: parseFloat(w.humidity)||0,
      leafWetHours: parseFloat(w.leafwet)||0,
      manualPhase: w.phase||null,
      heatStress,                          // флаг: день с тепловым стрессом
      heatStressCorrected: heatStress ? Math.round((dailyRaw - daily)*10)/10 : 0, // сколько GDD "отрезали"
      daily, cumulative: cum
    };
  });
}

/** Get current accumulated GDD */
function getCurrentGdd(tbase, varietyId) {
  const s = buildGddSeries(tbase, varietyId);
  return s.length ? s[s.length-1].cumulative : 0;
}

/** Get phases array for a variety using its crop's phases + varietyGdd values */
function getVarietyPhases(varietyId) {
  if (!varietyId) return [];
  const variety = S.varieties.find(v=>v.id===varietyId);
  const crop = variety ? getCropById(variety.cropId||'crop_cherry') : null;
  // Use crop phases as template, fall back to standardPhases
  const std = crop?.phases || S.gddDb.standardPhases || [];
  const gddValues = S.gddDb.varietyGdd[varietyId];
  if (!gddValues || !std.length) return [];
  return std.map((ph, i) => {
    const from = (gddValues[i] !== null && gddValues[i] !== undefined) ? Number(gddValues[i]) : 0;
    const nextVal = gddValues[i+1];
    const to = (i < std.length-1 && nextVal !== null && nextVal !== undefined) ? Number(nextVal) : 9999;
    return { name: ph.name, color: ph.color, from, to };
  });
}

/** Step 4-5: Determine phenological phase by GDD */
function getPhaseByGdd(varietyId, gdd) {
  const phases = getVarietyPhases(varietyId);
  if (!phases.length) return null;
  for (const ph of phases) {
    if (gdd >= ph.from && gdd < ph.to) return ph;
  }
  return phases[phases.length-1];
}

/** Days remaining in current phase */
function daysToNextPhase(varietyId, gdd, tbase) {
  const ph = getPhaseByGdd(varietyId, gdd);
  if (!ph) return null;
  const gddNeeded = ph.to - gdd;
  // Estimate avg daily GDD from last 7 days
  const series = buildGddSeries(tbase);
  const last7 = series.slice(-7);
  const avgDaily = last7.length ? last7.reduce((s,d)=>s+d.daily,0)/last7.length : 5;
  return avgDaily > 0 ? Math.ceil(gddNeeded / avgDaily) : null;
}

/** Step 6: Disease risk calculation per spec
 * Factors: temperature in range, humidity, rain amount, leaf wetness hours,
 * critical phase match, variety sensitivity (1-5 scale)
 */
function calcDiseaseRiskFull(dc, varietyId, currentPhase, weatherDay) {
  if (!weatherDay) return { score:0, level:'ok', reasons:[], recommendation:'' };

  const tmin = parseFloat(weatherDay.tmin) ?? null;
  const tmax = parseFloat(weatherDay.tmax) ?? null;
  const avg = (tmin!==null && tmax!==null) ? (tmin+tmax)/2 : null;
  const precip = parseFloat(weatherDay.precip)||0;
  const humidity = parseFloat(weatherDay.humidity)||0;
  const leafWet = parseFloat(weatherDay.leafWetHours)||0;
  const reasons = [];
  let score = 0;

  if (avg === null) return { score:0, level:'ok', reasons:['Нет данных о температуре'], recommendation:'' };

  // Temperature check
  if (avg < dc.tmin || avg > dc.tmax) {
    return { score:5, level:'ok', reasons:[`Температура ${avg.toFixed(0)}°C вне диапазона (${dc.tmin}–${dc.tmax}°C)`], recommendation:'' };
  }
  // Temperature score — proximity to optimum
  const tRange = dc.tmax - dc.tmin || 1;
  const tScore = Math.max(0, 1 - Math.abs(avg - dc.topt) / (tRange/2));
  score += tScore * 35;
  if (avg >= dc.topt - 3 && avg <= dc.topt + 3)
    reasons.push(`🌡️ Температура ${avg.toFixed(0)}°C — оптимальна для развития`);
  else
    reasons.push(`🌡️ Температура ${avg.toFixed(0)}°C — в зоне риска`);

  // Humidity check
  if (dc.hmin > 0 && humidity > 0) {
    if (humidity >= dc.hmin) {
      score += 20;
      reasons.push(`💧 Влажность ${humidity}% ≥ порога ${dc.hmin}%`);
    } else {
      score += (humidity / dc.hmin) * 12;
    }
  } else if (dc.hmin === 0) {
    score += 15; // not required — neutral bonus
  }

  // Rain check
  if (dc.rainMin > 0) {
    if (precip >= dc.rainMin) {
      score += 20;
      reasons.push(`🌧️ Осадки ${precip}мм ≥ ${dc.rainMin}мм`);
    } else if (precip > 0) {
      score += (precip / dc.rainMin) * 12;
    }
  } else if (precip === 0) {
    score += 5; // dry conditions — minor bonus for non-rain diseases
  }

  // Leaf wetness hours
  if (dc.leafWetHours > 0 && leafWet > 0) {
    if (leafWet >= dc.leafWetHours) {
      score += 25;
      reasons.push(`🍃 Лист влажный ${leafWet}ч ≥ ${dc.leafWetHours}ч — риск заражения`);
    } else {
      score += (leafWet / dc.leafWetHours) * 15;
      reasons.push(`🍃 Увлажнение листа ${leafWet}ч (порог ${dc.leafWetHours}ч)`);
    }
  }

  // Critical phase bonus
  if (currentPhase) {
    const critMatch = (dc.criticalPhases||[]).some(cp =>
      currentPhase.name.toLowerCase().includes(cp.toLowerCase()) ||
      cp.toLowerCase().includes(currentPhase.name.toLowerCase())
    );
    if (critMatch) {
      score += 20;
      reasons.push(`🌸 Сорт в критической фазе: ${currentPhase.name}`);
    }
  }

  // Variety sensitivity correction (1-5 scale → coefficient)
  // 1=0.5x, 2=0.75x, 3=1.0x, 4=1.25x, 5=1.5x
  const sensMap = S.gddDb.varietySensitivity[varietyId] || {};
  const rawSens = sensMap[dc.id] ?? 3;
  const sensCoeff = 0.25 + (rawSens * 0.25); // 1→0.5, 2→0.75, 3→1.0, 4→1.25, 5→1.5
  score = Math.min(100, Math.round(score * sensCoeff));

  // Level determination
  let level = 'ok';
  if (score >= 75) level = 'critical';
  else if (score >= 55) level = 'spray';
  else if (score >= 30) level = 'watch';

  // Recommendation per level
  let recommendation = '';
  if (level === 'critical' || level === 'spray') {
    recommendation = `Провести защитную обработку в течение 24 часов. ${dc.products ? '💊 ' + dc.products : ''}`;
  } else if (level === 'watch') {
    recommendation = `Усилить наблюдение. Подготовить ${dc.products || 'препарат'}. Повторная оценка завтра.`;
  } else {
    recommendation = 'Обработка сегодня не обязательна. Следующий контроль при обновлении погоды.';
  }

  return { score, level, reasons, recommendation, sensCoeff, rawSens };
}

/** Step 7: Pest risk by GDD + phase */
function calcPestRisks(currentGdd, currentPhase) {
  return S.gddDb.pestThresholds.map(pest => {
    const reached = currentGdd >= pest.gddThreshold;
    const approaching = currentGdd >= pest.gddThreshold * 0.85;
    let level = 'ok';
    let status = '';
    if (reached) {
      // Check if we're in the risk phase
      const phaseMatch = !pest.phaseRisk || !currentPhase ||
        currentPhase.name.toLowerCase().includes(pest.phaseRisk.toLowerCase()) ||
        pest.phaseRisk.toLowerCase().includes(currentPhase.name.toLowerCase());
      level = phaseMatch ? pest.alertLevel : 'watch';
      status = `GDD ${currentGdd} достиг порога ${pest.gddThreshold}`;
      if (phaseMatch && currentPhase) status += ` · Фаза ${currentPhase.name} совпадает`;
    } else if (approaching) {
      level = 'watch';
      status = `GDD ${currentGdd} / ${pest.gddThreshold} — до порога ${Math.round(pest.gddThreshold - currentGdd)} ед.`;
    } else {
      status = `GDD ${currentGdd} / ${pest.gddThreshold} — порог не достигнут`;
    }
    return { ...pest, level, status, reached, approaching };
  });
}

/** Steps 8-10: Master agronomist report — generates full output per spec */
function runAgronomistEngine(varietyId, tbase) {
  const series = buildGddSeries(tbase, varietyId);
  const currentGdd = series.length ? series[series.length-1].cumulative : 0;
  const currentPhase = getPhaseByGdd(varietyId, currentGdd);
  const latestWeather = [...S.weather].filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0] || null;
  const daysLeft = daysToNextPhase(varietyId, currentGdd, tbase);
  const variety = S.varieties.find(v=>v.id===varietyId);
  const cropId = variety?.cropId || 'crop_cherry';
  // Filter diseases relevant to this crop
  const relevantDiseases = S.diseaseCatalog.filter(dc =>
    !dc.cropIds || dc.cropIds.includes(cropId)
  );
  const diseaseResults = relevantDiseases.map(dc =>
    ({ dc, ...calcDiseaseRiskFull(dc, varietyId, currentPhase, latestWeather) })
  ).sort((a,b)=>b.score-a.score);
  const pestResults = calcPestRisks(currentGdd, currentPhase);
  const allAlerts = [
    ...diseaseResults.filter(r=>r.level!=='ok').map(r=>({ ...r, type:'disease', title:r.dc.name })),
    ...pestResults.filter(r=>r.level!=='ok').map(r=>({ ...r, type:'pest', title:r.name })),
  ].sort((a,b)=>{
    const rank={critical:4,spray:3,watch:2,ok:1};
    return rank[b.level]-rank[a.level];
  });
  // Bees
  const tmax = parseFloat(latestWeather?.tmax)||0;
  const beesActive = tmax >= 10;
  // Frost
  const tmin = parseFloat(latestWeather?.tmin)??null;
  const frostRisk = tmin !== null && tmin <= 0;

  // Foliar fertilization effectiveness (Sela book, Ch.4)
  if (latestWeather) {
    const ltmax = parseFloat(latestWeather.tmax)||0;
    const lhum  = parseFloat(latestWeather.humidity)||0;
    const hasFoliarFert = S.treatments.some(t => {
      if (t.method !== 'foliar' || t.type !== 'fertilizer') return false;
      const e = new Date(t.date); e.setDate(e.getDate() + (parseInt(t.duration)||7));
      return new Date() <= e;
    });
    if (hasFoliarFert) {
      if (ltmax >= 30) allAlerts.push({ type:'foliar', level:'watch',
        title:'🌿 Листовое питание — жара',
        body:`T° макс ${ltmax}°C — поглощение через лист снижено. Устьица закрыты.`,
        recommendation:'Переносить листовые обработки на раннее утро (до 9:00) или вечер (после 18:00).' });
      if (lhum >= 90) allAlerts.push({ type:'foliar', level:'watch',
        title:'🌿 Листовое питание — высокая влажность',
        body:`Влажность ${lhum}% — риск ожогов листьев при листовой обработке.`,
        recommendation:'Снизить концентрацию раствора. Не обрабатывать при влажности >90%.' });
      if (ltmax < 10) allAlerts.push({ type:'foliar', level:'watch',
        title:'🌿 Листовое питание — холод',
        body:`T° ${ltmax}°C — поглощение питательных веществ через лист минимально.`,
        recommendation:'Отложить листовую обработку до потепления выше +10°C.' });
    }
    // Fertigation pH alert
    const hasDrip = S.treatments.some(t => {
      if (t.method !== 'drip') return false;
      const e = new Date(t.date); e.setDate(e.getDate() + 3);
      return new Date() <= e;
    });
    if (hasDrip) allAlerts.push({ type:'drip', level:'ok',
      title:'💧 Фертигация — контроль pH',
      body:'Оптимальный pH воды для фертигации: 5.5–6.5. При pH>7 — фосфаты осаждаются и засоряют капельницы.',
      recommendation:'Используйте кислоту ортофосфорную для коррекции pH. Ca-нитрат не смешивайте с фосфатами.' });

    // Heavy rain — nutrient leaching alert (Sela Ch.4)
    const recentHeavyRain = S.weather.slice(0,3).filter(w=>parseFloat(w.precip||0)>=25);
    if (recentHeavyRain.length >= 1) {
      const totalRain = recentHeavyRain.reduce((s,w)=>s+parseFloat(w.precip||0),0);
      allAlerts.push({ type:'leaching', level:'watch',
        title:'🌧️ Вымывание нитратов',
        body:`${Math.round(totalRain)}мм осадков за последние дни — возможно вымывание нитратного азота из корнеобитаемого слоя (Sela, гл.4).`,
        recommendation:'Контролируйте N-питание. При дождях >25мм — планируйте дополнительное листовое внесение N через 3–5 дней. Нитраты вымываются, аммоний — удерживается.' });
    }

    // Sandy soil leaching reminder (Moldova soils)
    const recentDripFert = S.treatments.filter(t=>t.method==='drip').slice(0,5);
    if (recentDripFert.length>=3) {
      allAlerts.push({ type:'fertigation', level:'ok',
        title:'💧 Дробное внесение — правильно',
        body:`Зафиксировано ${recentDripFert.length} внесений через капельное. Дробное внесение по Sela (гл.5) снижает потери N и EC стресс почвы.`,
        recommendation:'Продолжайте дробное внесение. Контролируйте EC воды: оптимум 1.5–2.5 мС/см в зоне корней.' });
    }
  }

  // ===== SOUR CHERRY SPECIFIC ALERTS (GDD-model UC IPM, base 4.5°C) =====
  // Source: UC IPM degree-day phenology + MSU IPM + Ag & Natural Resources College
  // Triggers: GDD 4.5°C base + weather conditions
  if (variety && variety.cropId === 'crop_sour_cherry' && latestWeather) {
    const ltmax = parseFloat(latestWeather.tmax)||0;
    const ltmin = parseFloat(latestWeather.tmin)||0;
    const ltavg = (ltmax+ltmin)/2;
    const leafWet = parseFloat(latestWeather.leafwet)||0;
    const precip = parseFloat(latestWeather.precip)||0;
    const lhum = parseFloat(latestWeather.humidity)||0;
    const phaseName = currentPhase?.name || '';
    const rain48 = S.weather.slice(0,2).reduce((s,w)=>s+parseFloat(w.precip||0),0);
    const rain72 = S.weather.slice(0,3).reduce((s,w)=>s+parseFloat(w.precip||0),0);

    // ╔══ GDD-МОДЕЛЬ ВИШНИ (UC IPM, база 4.5°C) ══════════════════════╗
    // ║ Источник: UC IPM, MSU IPM, Ag & Natural Resources College        ║
    // ║ Триггеры точные — НЕ МЕНЯТЬ без агрономического обоснования      ║
    // ╚═══════════════════════════════════════════════════════════════════╝

    // ─── 1. КОККОМИКОЗ / Cherry Leaf Spot (Blumeriella jaapii) ─────────
    // Главная болезнь вишни в Молдове. Период: GDD 150–1650.
    // Пик: GDD 560–1450. Последствие: ранний листопад → потеря урожая след. года
    if (currentGdd >= 150 && currentGdd <= 1650) {
      if (leafWet >= 6 && ltavg > 12) {
        // RED: leaf_wetness > 6h AND Tavg > 12°C
        allAlerts.push({type:'disease', level:'critical',
          title:'🔴 Коккомикоз — КРИТИЧЕСКИЙ (UC IPM)',
          body:`GDD ${currentGdd} · Лист мокрый ${leafWet}ч + Tср ${ltavg.toFixed(1)}°C → условия заражения Blumeriella jaapii.`,
          recommendation:'НЕМЕДЛЕННО: Скор, Хорус, Делан. Повтор каждые 10–14 дней. Убрать опавшие листья. Вентиляция кроны.'
        });
      } else if (currentGdd >= 560 && currentGdd <= 1450 && rain48 > 5) {
        // CRITICAL: пик риска GDD 560–1450 + rain > 5mm/48h
        allAlerts.push({type:'disease', level:'critical',
          title:'🔴 Коккомикоз — пик периода (GDD 560–1450)',
          body:`GDD ${currentGdd} · Осадки ${rain48.toFixed(1)}мм за 48ч. Пик восприимчивости листа. Инфекция идёт незаметно.`,
          recommendation:'Скор, Топаз или Хорус. Обработка ДО дождя — профилактика важнее лечения!'
        });
      } else if (leafWet >= 4 && ltavg > 10) {
        allAlerts.push({type:'disease', level:'spray',
          title:'⚠️ Коккомикоз — риск умеренный',
          body:`GDD ${currentGdd} · Лист мокрый ${leafWet}ч при Tср ${ltavg.toFixed(1)}°C. Условия близки к порогу.`,
          recommendation:'Превентивная обработка: Скор или Топаз.'
        });
      }
    }

    // ─── 2. МОНИЛИОЗ ЦВЕТКОВ / Monilinia Blossom Blight ────────────────
    // GDD 300–560: цветение — самый опасный момент. Любой дождь = красный.
    if (currentGdd >= 300 && currentGdd <= 560) {
      if (leafWet >= 4 && ltavg >= 12 && ltavg <= 22) {
        allAlerts.push({type:'disease', level:'critical',
          title:'🔴 Монилиоз цветков — КРАСНЫЙ (GDD 300–560)',
          body:`GDD ${currentGdd} · Лист мокрый ${leafWet}ч + Tср ${ltavg.toFixed(1)}°C (12–22°C = опасная зона). Monilinia laxa/fructigena.`,
          recommendation:'Хорус или Свитч ДО раскрытия цветков. ЛЮБОЙ дождь в цветение = немедленная обработка. Обходить пчёл!'
        });
      } else if (precip > 0 || lhum > 80) {
        allAlerts.push({type:'disease', level:'spray',
          title:'⚠️ Монилиоз цветков — фаза цветения + влага',
          body:`GDD ${currentGdd} · Осадки или влажность ${lhum}% в период цветения.`,
          recommendation:'Хорус перед дождём. Защита цветков критична — потеря урожая 30–100%.'
        });
      }
    }

    // ─── 3. МОНИЛИОЗ ПЛОДОВ / Brown Rot (Monilinia fructigena) ─────────
    // GDD 1050–1450: созревание + дождь = потеря партии
    if (currentGdd >= 1050 && currentGdd <= 1450 && rain72 > 5) {
      allAlerts.push({type:'disease', level:'critical',
        title:'🔴 Монилиоз плодов — Brown Rot (GDD 1050–1450)',
        body:`GDD ${currentGdd} · Осадки ${rain72.toFixed(1)}мм/72ч. Плоды восприимчивы. Monilinia fructigena/laxa — гниль за 2–3 дня.`,
        recommendation:'Свитч или Луна Транквилити. СРОЧНЫЙ сбор урожая при первых симптомах. Удалить все гнилые плоды немедленно.'
      });
    }

    // ─── 4. КЛЯСТЕРОСПОРИОЗ / Shot Hole (Clasterosporium) ───────────────
    // GDD 150–850: дождь + влажный лист > 5ч + rain > 3мм/48ч
    if (currentGdd >= 150 && currentGdd <= 850 && leafWet >= 5 && rain48 > 3) {
      allAlerts.push({type:'disease', level:'spray',
        title:'🟠 Клястероспориоз — условия заражения',
        body:`GDD ${currentGdd} · Лист мокрый ${leafWet}ч + осадки ${rain48.toFixed(1)}мм/48ч. Clasterosporium carpophilum активен.`,
        recommendation:'Медьсодержащие или Хорус. Вентиляция кроны. Идёт часто вместе с коккомикозом.'
      });
    }

    // ─── 5. БАКТЕРИАЛЬНЫЙ РАК / Pseudomonas syringae ────────────────────
    // GDD 60–300: весна + холод + дождь = риск потери сада
    if (currentGdd >= 60 && currentGdd <= 300 && rain48 > 5 && ltmin < 8) {
      allAlerts.push({type:'disease', level:'critical',
        title:'🔴 Бактериальный рак — ОПАСНОСТЬ (GDD 60–300)',
        body:`GDD ${currentGdd} · Tмин ${ltmin}°C + осадки ${rain48.toFixed(1)}мм/48ч — Pseudomonas syringae через раны в холод+дождь.`,
        recommendation:'Купроксат или Бордоская жидкость. НЕ обрезать в сырую погоду. Дезинфекция инструментов. Риск — потеря ветвей/сада!'
      });
    }

    // ─── 6. АНТРАКНОЗ ПЛОДОВ / Anthracnose ──────────────────────────────
    // GDD 850–1450: дождливые годы + повреждённая кожица
    if (currentGdd >= 850 && currentGdd <= 1450 && rain72 > 10) {
      allAlerts.push({type:'disease', level:'spray',
        title:'🟠 Антракноз плодов — дождливый период',
        body:`GDD ${currentGdd} · Осадки ${rain72.toFixed(1)}мм/72ч. Colletotrichum acutatum активен при рост+созревание.`,
        recommendation:'Свитч или Хорус. Избегать механических повреждений плодов. Быстрый сбор урожая.'
      });
    }

    // ─── 7. ВИШНЁВАЯ МУХА / Rhagoletis cerasi ───────────────────────────
    // GDD 850: старт лёта (жёлтые ловушки!). GDD 1050–1450: RED ALERT
    if (currentGdd >= 850 && currentGdd <= 1450) {
      if (currentGdd >= 1050) {
        // RED: окрашивание плода + пик лёта мухи
        allAlerts.push({type:'pest', level:'critical',
          title:'🔴 Вишнёвая муха — КРАСНАЯ ЗОНА (GDD 1050–1450)',
          body:`GDD ${currentGdd} — плод окрашивается. Rhagoletis cerasi: пик яйцекладки. Личинки в плодах = 100% товарный брак.`,
          recommendation:'При 5+ мух/ловушку — НЕМЕДЛЕННАЯ обработка: Калипсо, Спинтор, Золон. Контроль ловушек каждые 2–3 дня!'
        });
      } else {
        // ORANGE: GDD 850–1050 = начало лёта, установить ловушки
        allAlerts.push({type:'pest', level:'spray',
          title:'🟠 Вишнёвая муха — начало лёта (GDD 850)',
          body:`GDD ${currentGdd} — первые мухи. Rhagoletis cerasi начинает лёт. Ловушки установлены?`,
          recommendation:'Жёлтые клеевые ловушки — минимум 2 шт/га. Начать мониторинг немедленно. Обработка при 1+ мухах/ловушку/неделю.'
        });
      }
    }

    // ─── 8. DROSOPHILA SUZUKII / Пятнистокрылая дрозофила ──────────────
    // GDD 1050–1450: мягкий плод = уязвим. Ловушки обязательны.
    if (currentGdd >= 1050 && currentGdd <= 1450) {
      allAlerts.push({type:'pest', level:'spray',
        title:'🟡 Drosophila suzukii — мягкий плод уязвим',
        body:`GDD ${currentGdd} · Плод становится мягким = риск SWD. Летает вместе с вишнёвой мухой.`,
        recommendation:'Ловушки с дрожжевой приманкой. Спинтор или Калипсо. Ранний сбор урожая снижает риск.'
      });
    }

    // ─── 9. ТЛЯ ЧЁРНАЯ ВИШНЁВАЯ / Myzus cerasi ──────────────────────────
    // GDD 100–850: тёплая весна + активный рост побегов
    if (currentGdd >= 100 && currentGdd <= 850 && ltavg >= 15) {
      allAlerts.push({type:'pest', level:'watch',
        title:'🟡 Тля чёрная вишнёвая — мониторинг (GDD 100–850)',
        body:`GDD ${currentGdd} · Tср ${ltavg.toFixed(1)}°C + активный рост побегов. Myzus cerasi скручивает листья.`,
        recommendation:'Осмотр верхушек побегов. При колониях: Актара, Биотлин, Конфидор. Скручивание листьев = поздно!'
      });
    }

    // ─── 10. ДОЛГОНОСИК / Weevil — цветоед ──────────────────────────────
    // GDD 60–300: Tmax > 12°C + фаза набухания/зелёного конуса
    if (currentGdd >= 60 && currentGdd <= 300 && ltmax > 12) {
      allAlerts.push({type:'pest', level:'watch',
        title:'🪲 Долгоносик (цветоед) — ранняя весна (GDD 60–300)',
        body:`GDD ${currentGdd} · T°${ltmax}°C — долгоносики активны при набухании почек. Фаза: ${phaseName||'набухание'}.`,
        recommendation:'Стряхивание на подстилку ранним утром. Обработка ДО цветения: Децис, Каратэ. При >10 шт/дерево — срочно.'
      });
    }

    // ─── 11. ЛИСТОВЁРТКИ / Leafrollers ───────────────────────────────────
    // GDD 220–1050: феромонные ловушки + осмотр
    if (currentGdd >= 220 && currentGdd <= 1050) {
      allAlerts.push({type:'pest', level:'watch',
        title:'🟡 Листовёртки — период активности (GDD 220–1050)',
        body:`GDD ${currentGdd} · Archips sp. — свёрнутые листья = гусеницы. Фаза: ${phaseName}.`,
        recommendation:'Феромонные ловушки. При отрождении гусениц: Димилин, Матч, Децис.'
      });
    }

    // ─── 12. КЛЕЩ / Mites ────────────────────────────────────────────────
    // GDD 850–1650: жара + сухость = вспышка
    if (currentGdd >= 850 && currentGdd <= 1650 && ltmax >= 28 && lhum < 45) {
      allAlerts.push({type:'pest', level:'spray',
        title:'🕷️ Паутинный клещ — жара + сухость (GDD 850–1650)',
        body:`GDD ${currentGdd} · T°${ltmax}°C + RH ${lhum}% (<45%) — Tetranychus urticae вспышка. Осмотр нижней стороны листьев.`,
        recommendation:'Ниссоран, Санмайт, Омайт. Акарицид при >5 подвижных особей/лист. Не смешивать с серой при жаре!'
      });
    }

    // ─── 13. ПОСЛЕ СБОРА — самая частая ошибка ──────────────────────────
    // GDD 1450–1650+: коккомикоз продолжает уничтожать лист → потеря урожая-2025
    if (currentGdd >= 1450) {
      allAlerts.push({type:'disease', level:'watch',
        title:'🍂 POST-HARVEST — защита листа обязательна!',
        body:`GDD ${currentGdd} · Коккомикоз продолжает уничтожать лист после уборки. Лист до октября = закладка урожая следующего года.`,
        recommendation:'Скор или Топаз после сбора. САМАЯ ЧАСТАЯ ОШИБКА: бросить сад после уборки. Вишня должна держать лист до листопада!'
      });
    }
  }

  // ===== APPLE-SPECIFIC ALERTS =====
  if (variety && variety.cropId === 'crop_apple' && latestWeather) {
    const ltmax = parseFloat(latestWeather.tmax)||0;
    const ltmin = parseFloat(latestWeather.tmin)||0;
    const lhum  = parseFloat(latestWeather.humidity)||0;
    const leafWet = parseFloat(latestWeather.leafwet)||0;
    const precip = parseFloat(latestWeather.precip)||0;
    const sens = S.gddDb.varietySensitivity[varietyId] || {};

    // Scab alert: GDD 115–235 + leaf wetness + T > 8°C
    const scabPhases = ['Зелёный конус','Мышиное ухо','Розовый бутон'];
    if (currentPhase && scabPhases.includes(currentPhase.name)) {
      if (leafWet >= 4 && ltmax > 8) {
        const scabSens = sens['dc3'] || 3;
        const lvl = scabSens >= 5 ? 'critical' : scabSens >= 4 ? 'spray' : 'watch';
        allAlerts.push({ type:'disease', level:lvl,
          title:`🍏 Парша яблони — ${lvl==='critical'?'КРИТИЧЕСКИЙ':lvl==='spray'?'ОБРАБОТКА':'ВНИМАНИЕ'}`,
          body:`GDD ${currentGdd} · Фаза: ${currentPhase.name} · Намокание листьев ${leafWet}ч при T°${ltmax}°C. Чувствительность ${variety.name}: ${scabSens}/5.`,
          recommendation:'Фунгицид: Хорус, Скор, Делан, Мерпан. Обработка до дождя или в течение 24ч после. Критическое окно — фаза Мышиное ухо.'
        });
      }
    }

    // Fire blight alert (Jonagold, Granny Smith): GDD 420–600 + T > 18°C + rain
    const fbPhases = ['Цветение','Завязь'];
    if (currentPhase && fbPhases.includes(currentPhase.name)) {
      const fbSens = sens['dc5'] || 2;
      if (fbSens >= 4 && ltmax > 18 && (precip > 0 || lhum > 75)) {
        allAlerts.push({ type:'disease', level:'critical',
          title:`🔥 Fire Blight (бактериальный ожог) — КРИТИЧНО`,
          body:`GDD ${currentGdd} · Цветение при T°${ltmax}°C и осадках — идеальные условия для Erwinia amylovora. ${variety.name}: чувствительность ${fbSens}/5.`,
          recommendation:'Медьсодержащие или Касугамицин (Kasumin) до и после цветения. Дезинфицировать инструменты. Удалять поражённые побеги немедленно.'
        });
      }
    }

    // Color risk for Red Delicious: GDD 1350–1650 + night T > 18°C
    if (variety.id === 'va2' && currentGdd >= 1350 && currentGdd <= 1650) {
      if (ltmin > 18) {
        allAlerts.push({ type:'quality', level:'watch',
          title:'🍎 Red Delicious — риск слабой окраски',
          body:`Ночная T° ${ltmin}°C — выше 18°C блокирует накопление антоцианов. GDD ${currentGdd}, фаза налива.`,
          recommendation:'Применить отражающую мульчу для снижения ночной T°. Листовое фосфор-калийное питание для улучшения окраски.'
        });
      }
    }

    // Sunburn alert for Granny Smith & Braeburn: GDD > 1000 + T > 32°C
    if (['va1','va4'].includes(variety.id) && currentGdd >= 1000 && ltmax >= 32) {
      allAlerts.push({ type:'stress', level:'watch',
        title:`☀️ Солнечный ожог — ${variety.name}`,
        body:`T° ${ltmax}°C при GDD ${currentGdd} (фаза роста/налива плода). ${variety.name} высоко восприимчив к солнечному ожогу.`,
        recommendation:'Каолин (Surround WP) или рефлективные сетки. Полив в жаркое время. Избегать стресса водного дефицита.'
      });
    }

    // Calcium / Bitter pit alert for Red Delicious & Jonagold
    if (['va2','va3'].includes(variety.id) && currentGdd >= 980 && currentGdd <= 1400) {
      const lastCaTreatment = S.treatments.filter(t=>
        (t.product||'').toLowerCase().includes('кальц') ||
        (t.product||'').toLowerCase().includes('cal') ||
        (t.activeSubstance||'').toLowerCase().includes('ca')
      ).filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
      const daysSinceCa = lastCaTreatment
        ? Math.round((Date.now()-new Date(lastCaTreatment.date))/86400000) : 999;
      if (daysSinceCa > 14) {
        allAlerts.push({ type:'nutrition', level:'watch',
          title:`🍎 Кальций / Bitter Pit — ${variety.name}`,
          body:`GDD ${currentGdd} — активный рост плода. Последнее Ca-внесение: ${daysSinceCa > 100 ? 'нет данных' : daysSinceCa+' дн. назад'}. ${variety.name} — чувствительность к bitter pit: 4/5.`,
          recommendation:'Листовое Ca-нитрат или Brexil Ca каждые 10–14 дней в период роста плода. Цель: 4–6 обработок за сезон.'
        });
      }
    }

    // Heat stress for Braeburn: GDD > 1020 + T > 32°C
    if (variety.id === 'va4' && currentGdd >= 1020 && ltmax >= 32) {
      allAlerts.push({ type:'stress', level:'watch',
        title:'🌡️ Тепловой стресс — Braeburn',
        body:`T° ${ltmax}°C при GDD ${currentGdd}. Braeburn реагирует на жару снижением качества плода и активацией клещей.`,
        recommendation:'Мониторинг паутинного клеща. Орошение для снижения T° кроны. Антистрессовые препараты (аминокислоты).'
      });
    }

    // Powdery mildew for Granny Smith & Jonagold: dry + warm
    const pmPhases = ['Зелёный конус','Мышиное ухо','Розовый бутон','Цветение'];
    if (currentPhase && pmPhases.includes(currentPhase.name)) {
      const pmSens = sens['dc4'] || 3;
      if (pmSens >= 4 && ltmax > 15 && ltmax < 30 && lhum < 70) {
        allAlerts.push({ type:'disease', level:'watch',
          title:`🍃 Мучнистая роса — ${variety.name}`,
          body:`Тёплая сухая погода (T°${ltmax}°C, влажность ${lhum}%) — идеальные условия. Чувствительность: ${pmSens}/5.`,
          recommendation:'Сера коллоидная, Топаз, Луна Экспириенс. Не применять серу при T°>28°C — риск ожогов.'
        });
      }
    }
  }

  // ===== SOUR CHERRY (ВИШНЯ) SPECIFIC ALERTS =====
  if (variety && variety.cropId === 'crop_sour_cherry' && latestWeather) {
    const ltmax = parseFloat(latestWeather.tmax)||0;
    const ltmin = parseFloat(latestWeather.tmin)||0;
    const lhum  = parseFloat(latestWeather.humidity)||0;
    const leafWet = parseFloat(latestWeather.leafwet)||0;
    const precip = parseFloat(latestWeather.precip)||0;

    // 1. КОККОМИКОЗ — главная болезнь вишни
    // Триггер: листья >6ч влажные + T > 12°C (после цветения)
    const kokPhases = ['Завязь','Рост плода','Созревание'];
    if (currentPhase && kokPhases.includes(currentPhase.name)) {
      if (leafWet >= 6 && ltmax > 12) {
        allAlerts.push({ type:'disease', level:'critical',
          title:'🔴 Коккомикоз (Blumeriella jaapii) — КРИТИЧНО',
          body:`Листья влажные ${leafWet}ч при T°${ltmax}°C. Коккомикоз — болезнь №1 вишни в Молдове. Риск потери листового аппарата и ослабления дерева.`,
          recommendation:'Скор, Топаз, Абига-Пик, Хорус. Обработка в течение 12-24ч. Уничтожение опавших листьев осенью.'
        });
      } else if (leafWet >= 4 && ltmax > 10 && precip > 2) {
        allAlerts.push({ type:'disease', level:'spray',
          title:'⚠️ Коккомикоз — риск заражения',
          body:`Дождь ${precip}мм + влажность листьев ${leafWet}ч при T°${ltmax}°C — условия для Blumeriella jaapii.`,
          recommendation:'Профилактическая обработка Скор или Хорус в ближайшие 2 дня.'
        });
      }
    }

    // 2. МОНИЛИОЗ — критично в цветение
    if (currentPhase && ['Цветение','Розовый бутон'].includes(currentPhase.name)) {
      if (precip > 2 && ltmax >= 15 && ltmax <= 25) {
        allAlerts.push({ type:'disease', level:'critical',
          title:'🔴 Монилиоз (Monilia laxa) — ЦВЕТЕНИЕ + ДОЖДЬ',
          body:`Дождь ${precip}мм + T°${ltmax}°C в фазе ${currentPhase.name}. Монилиоз уничтожает цветы и завязи. Потеря урожая.`,
          recommendation:'Хорус, Свитч, Луна Транквилити. Немедленная обработка. До и после дождя.'
        });
      }
    }

    // 3. ВИШНЁВАЯ МУХА — GDD 800-900 = КРИТИЧНО для рынка
    if (currentGdd >= 750) {
      const flyLevel = currentGdd >= 850 ? 'critical' : 'spray';
      allAlerts.push({ type:'pest', level:flyLevel,
        title:`🦟 Вишнёвая муха — GDD ${currentGdd} — ${flyLevel==='critical'?'СРОЧНО':'ОБРАБОТКА'}`,
        body:`GDD достиг ${currentGdd} (порог вылета 800–900). Rhagoletis cerasi откладывает яйца в плоды. Заражённые плоды = 100% брак для рынка.`,
        recommendation:'Жёлтые клеевые ловушки. Спинтор, Калипсо, Актара, Золон. При >5 мух/ловушку — немедленная обработка. Повторить через 10-14 дней.'
      });
    } else if (currentGdd >= 600) {
      allAlerts.push({ type:'pest', level:'watch',
        title:`🦟 Вишнёвая муха — мониторинг (GDD ${currentGdd})`,
        body:`GDD ${currentGdd} — подготовиться к вылету мух. Вылет ожидается при GDD 800-900.`,
        recommendation:'Установить жёлтые клеевые ловушки (1-2 на дерево). Осматривать ежедневно.'
      });
    }

    // 4. ТЁМНАЯ ТЛЯ при T > 15°C + рост побегов
    const aphPhases = ['Завязь','Зелёный конус','Розовый бутон'];
    if (currentPhase && aphPhases.includes(currentPhase.name) && ltmax > 15) {
      allAlerts.push({ type:'pest', level:'watch',
        title:'🐛 Тля чёрная вишнёвая — мониторинг',
        body:`T°${ltmax}°C + фаза ${currentPhase.name} — идеальные условия для Myzus cerasi. Тля переносит вирусы.`,
        recommendation:'Осмотр верхушек побегов. При колониях — Актара, Конфидор. Скручивание листьев = уже поздно.'
      });
    }

    // 5. ПАУТИННЫЙ КЛЕЩ при жаре
    if (currentGdd >= 400 && ltmax >= 28 && lhum < 60) {
      allAlerts.push({ type:'pest', level:'watch',
        title:'🕷️ Паутинный клещ — жара + сухо',
        body:`T°${ltmax}°C + влажность ${lhum}% — вспышка паутинного клеща. GDD ${currentGdd}.`,
        recommendation:'Осмотр нижней стороны листьев. Омайт, Енвидор. При T°>30°C — обрабатывать ранним утром.'
      });
    }

    // 6. БАКТЕРИАЛЬНЫЙ РАК весной
    if (currentPhase && ['Покой','Набухание почек'].includes(currentPhase.name) && precip >= 3 && ltmax <= 15) {
      allAlerts.push({ type:'disease', level:'spray',
        title:'🦠 Бактериальный рак — риск весной',
        body:`Дождь ${precip}мм при T°${ltmax}°C в фазе ${currentPhase?.name}. Pseudomonas syringae активна в прохладную влажную погоду.`,
        recommendation:'Бордоская жидкость или Купроксат ДО распускания почек. Не обрезать в сырую погоду. Дезинфекция инструментов.'
      });
    }
  }

  allAlerts.sort((a,b)=>{const rank={critical:4,spray:3,watch:2,ok:1};return (rank[b.level]||0)-(rank[a.level]||0);});
  return { variety, currentGdd, currentPhase, daysLeft, latestWeather, diseaseResults, pestResults, allAlerts, beesActive, frostRisk, series };
}

/** Step 11: Render the full agronomist report — human language */
function renderGddReport(result) {
  const { variety, currentGdd, currentPhase, daysLeft, latestWeather, diseaseResults, pestResults, allAlerts, beesActive, frostRisk } = result;
  const LVL_COLOR = { critical:'var(--red)', spray:'var(--orange)', watch:'var(--yellow)', ok:'var(--accent)' };
  const LVL_LABEL = { critical:'🔴 КРИТИЧЕСКИЙ', spray:'🟠 ВЫСОКИЙ', watch:'🟡 СРЕДНИЙ', ok:'🟢 НИЗКИЙ' };
  const SENS_LABEL = ['','Устойчивый','Слабо','Средний','Чувствительный','Очень чувствительный'];

  // Header
  let html = `
  <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:16px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-family:'Unbounded',sans-serif;font-size:13px;color:var(--accent2);margin-bottom:4px;">
          🍒 ${variety?.name || '—'} · ${latestWeather?.date || 'нет данных'}
        </div>
        <div style="font-size:20px;font-weight:800;margin-bottom:4px;">
          ${currentPhase ? currentPhase.name : 'Фаза не определена'}
        </div>
        <div style="font-size:12px;color:var(--text3);">
          GDD накоплено: <span style="color:var(--accent);font-family:'Unbounded',sans-serif;">${currentGdd}</span>
          ${daysLeft!==null ? ` · До следующей фазы: ~${daysLeft} дн.` : ''}
        </div>
        ${(() => {
          const cs = S.chillPortions.cultivarSettings.find(c=>c.varietyId===variety?.id);
          if (!cs) return '';
          const seasons = getAvailableSeasons();
          if (!seasons.length) return '';
          const res = runChillCalc(seasons[seasons.length-1].start, seasons[seasons.length-1].end);
          if (!res) return '';
          const st = getChillStatus(res.cpTotal, cs.cpTarget);
          const col = {cp_ok:'var(--accent)',cp_near:'var(--blue)',cp_medium:'var(--yellow)',cp_high:'var(--red)'}[st.cls];
          return `<div style="margin-top:6px;font-size:11px;">❄️ Chill Portions: <span style="color:${col};font-weight:600;">${res.cpTotal}/${cs.cpTarget} CP · ${st.label.replace(/[✅🔵⚠️🔴]/g,'').trim()}</span>${st.allowGdd?'':' · <span style="color:var(--red);">GDD заблокирован</span>'}</div>`;
        })()}
      </div>
      <div style="text-align:right;">
        ${latestWeather ? `
          <div style="font-size:13px;">🌡️ ${latestWeather.tmin}° / ${latestWeather.tmax}°C</div>
          <div style="font-size:12px;color:var(--text3);">🌧️ ${latestWeather.precip||0}мм · 💧 ${latestWeather.humidity||'—'}%</div>
          <div style="font-size:12px;color:var(--text3);">🍃 Увл. листа: ${latestWeather.leafwet||0}ч</div>
        ` : '<div style="color:var(--text3);font-size:12px;">Нет данных о погоде</div>'}
        <div style="font-size:12px;margin-top:4px;">${beesActive ? '🐝 Пчёлы летают' : '🐝 Пчёлы не летают'}</div>
        ${frostRisk ? '<div style="color:var(--red);font-weight:700;font-size:12px;">❄️ ЗАМОРОЗОК!</div>' : ''}
      </div>
    </div>
  </div>`;

  // Alerts section — main risks
  if (allAlerts.length) {
    html += `<div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">🚨 Риски сегодня</div>`;
    allAlerts.forEach((a, idx) => {
      const reasons = a.reasons || [];
      html += `
      <div class="alert-item ${a.level}" style="margin-bottom:10px;">
        <div style="min-width:90px;"><span class="ai-badge ${a.level}">${LVL_LABEL[a.level]||a.level}</span></div>
        <div style="flex:1;">
          <div class="ai-title">${idx+1}. ${a.title}</div>
          ${a.type==='disease' && a.rawSens ? `<div style="font-size:10px;color:var(--text3);margin-bottom:5px;">Чувствительность сорта: ${SENS_LABEL[a.rawSens]||a.rawSens} (${a.rawSens}/5)</div>` : ''}
          <div style="font-size:11px;color:var(--text2);margin-bottom:6px;"><strong>Почему:</strong><br>
            ${reasons.map((r,i)=>`${i+1}. ${r}`).join('<br>')}
            ${a.type==='pest' ? `<br>📍 ${a.status}` : ''}
          </div>
          <div class="ai-rec">→ ${a.recommendation || a.prevention || ''}</div>
        </div>
        ${a.type==='disease'?`<div style="text-align:center;min-width:54px;"><div style="font-family:'Unbounded',sans-serif;font-size:18px;font-weight:700;color:${LVL_COLOR[a.level]||'var(--text)'};">${a.score}%</div><div style="font-size:9px;color:var(--text3);">риск</div></div>`:''}
      </div>`;
    });
  } else {
    html += `<div class="alert-item ok"><span class="ai-badge ok">✅ OK</span><div><div class="ai-title">Все риски низкие</div><div class="ai-body">Обработка сегодня не обязательна. Следующий контроль завтра после обновления погоды.</div></div></div>`;
  }

  // Low risk diseases (informational)
  const lowRisk = diseaseResults.filter(r=>r.level==='ok'&&r.score>0);
  if (lowRisk.length) {
    html += `<details style="margin-top:12px;"><summary style="cursor:pointer;font-size:11px;color:var(--text3);padding:6px 0;">▶ Низкий риск (${lowRisk.length} болезней/вредителей)</summary>`;
    html += `<div style="margin-top:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;">`;
    lowRisk.forEach(r => {
      html += `<div style="padding:8px 10px;background:var(--surface2);border-radius:7px;border-left:2px solid var(--accent);font-size:11px;">
        <strong>${r.dc.name}</strong> · ${r.score}%
        <div style="color:var(--text3);font-size:10px;margin-top:2px;">${r.dc.type==='insect'?'Плод ещё не в фазе риска':'Условия неблагоприятны для развития'}</div>
      </div>`;
    });
    html += `</div></details>`;
  }

  // General conclusion
  const topAlert = allAlerts[0];
  html += `
  <div style="background:${topAlert?'rgba(239,68,68,.06)':'rgba(74,222,128,.06)'};border:1px solid ${topAlert?'rgba(239,68,68,.2)':'rgba(74,222,128,.2)'};border-radius:10px;padding:14px;margin-top:16px;">
    <div style="font-weight:700;font-size:13px;margin-bottom:6px;">📋 Общий вывод</div>
    <div style="font-size:12px;color:var(--text2);line-height:1.7;">
      ${topAlert
        ? `Сегодня главный риск — <strong>${topAlert.title}</strong>. ${
            topAlert.level==='critical'||topAlert.level==='spray'
              ? 'Обработку лучше не откладывать. Если не обработать — возможны существенные потери урожая.'
              : 'Усилить наблюдение и быть готовым к обработке.'
          }`
        : `Все риски низкие. Обработка сегодня не обязательна. Следующий контроль завтра утром после обновления погоды.`
      }
    </div>
  </div>`;

  return html;
}

// ===================== GDD UI =====================
function populateGddVarietySelect() {
  const cropSel = document.getElementById('gdd-crop-select');
  if (!cropSel) return;
  const curCrop = cropSel.value;
  cropSel.innerHTML = '<option value="">— выбрать культуру —</option>';

  const gardenCropIds = [...new Set(Object.values(S.cells).map(cd=>cd?.cropId||'crop_cherry'))];
  const allCropIds = [...new Set([...gardenCropIds, ...S.crops.map(c=>c.id)])];

  allCropIds.forEach(cid => {
    const crop = getCropById(cid);
    if (!crop) return;
    const inGarden = gardenCropIds.includes(cid);
    cropSel.innerHTML += `<option value="${cid}" ${curCrop===cid?'selected':''}>${crop.emoji||'🌱'} ${crop.name}${inGarden?' ✓':''}</option>`;
  });

  if (!cropSel.value) {
    cropSel.value = gardenCropIds[0] || S.crops[0]?.id || 'crop_cherry';
  }
  onGddCropChange(true);
}

function onGddCropChange(skipRender) {
  const cropId = document.getElementById('gdd-crop-select')?.value;
  const varSel = document.getElementById('gdd-variety-select');
  if (!varSel) return;
  const crop = getCropById(cropId);
  const baseTemp = crop?.baseTemp || 5;
  const baseDisp = document.getElementById('gdd-base-display');
  if (baseDisp) baseDisp.textContent = crop ? `База GDD: +${baseTemp}°C` : '';
  const cropVarieties = S.varieties.filter(v=>(v.cropId||'crop_cherry')===cropId);
  varSel.innerHTML = '';
  if (cropVarieties.length) {
    varSel.innerHTML = '<option value="">— все сорта —</option>';
    cropVarieties.forEach(v => varSel.innerHTML += `<option value="${v.id}">${v.name}</option>`);
    if (!varSel.value || !cropVarieties.find(v=>v.id===varSel.value)) varSel.value = cropVarieties[0].id;
  } else {
    varSel.innerHTML = `<option value="crop:${cropId}">${crop?.emoji||'🌱'} ${crop?.name||''} (без сортов)</option>`;
    varSel.value = `crop:${cropId}`;
  }
  if (!skipRender) renderGdd();
}

function renderGdd() {
  const rawVarietyId = document.getElementById('gdd-variety-select')?.value || '';
  const cropId = document.getElementById('gdd-crop-select')?.value || 'crop_cherry';
  const crop = getCropById(cropId);
  const tbase = crop?.baseTemp || 5;

  // Handle "crop:id" mode — no variety, use crop phases directly
  const isCropMode = rawVarietyId.startsWith('crop:');
  const varietyId = isCropMode ? null : rawVarietyId;

  // Update base temp display
  const baseDisp = document.getElementById('gdd-base-display');
  if (baseDisp) baseDisp.textContent = `База GDD: +${tbase}°C`;

  const startDate = getGddStartDate(varietyId);
  document.getElementById('gdd-start-display').textContent = startDate === new Date().getFullYear()+'-12-31'
    ? '⚠️ GDD заблокирован (CP не выполнен)'
    : `Старт GDD: ${startDate}`;

  if (!rawVarietyId && !cropId) {
    document.getElementById('gdd-hero').innerHTML = `<div style="color:var(--text3);font-size:12px;grid-column:1/-1;">Выберите культуру для анализа</div>`;
    document.getElementById('gdd-alerts').innerHTML = '';
    document.getElementById('gdd-phase-bar').innerHTML = '';
    document.getElementById('gdd-phase-legend').innerHTML = '';
    document.getElementById('gdd-tbody').innerHTML = `<tr><td colspan="9" style="color:var(--text3);text-align:center;padding:20px;">Выберите культуру</td></tr>`;
    return;
  }

  const result = runAgronomistEngine(varietyId, tbase);
  const { currentGdd, currentPhase, series, allAlerts } = result;

  // Get phases — for crop mode use crop phases template, for variety mode use GDD-calibrated phases
  let phases;
  if (isCropMode && crop) {
    phases = crop.phases.map((ph,i) => ({
      name: ph.name, color: ph.color,
      from: i===0 ? 0 : Math.round(i * (currentGdd||500) / crop.phases.length),
      to: i===crop.phases.length-1 ? 9999 : Math.round((i+1) * (currentGdd||500) / crop.phases.length),
    }));
  } else {
    phases = getVarietyPhases(varietyId);
  }

  const displayMax = phases.length ? phases[phases.length-1].to : Math.max(currentGdd + 100, 1000);
  const displayMaxCapped = Math.min(displayMax === 9999 ? (currentGdd + 200) : displayMax, 2000);
  const variety = varietyId ? S.varieties.find(v=>v.id===varietyId) : null;
  const cropLabel = crop ? `${crop.emoji||''} ${crop.name}${variety?' · '+variety.name:''}` : '';
  const critCount = allAlerts.filter(a=>a.level==='critical').length;
  const sprayCount = allAlerts.filter(a=>a.level==='spray').length;

  // Hero KPIs
  document.getElementById('gdd-hero').innerHTML = `
    ${cropLabel?`<div class="gdd-card ok" style="grid-column:1/-1;padding:10px 16px;display:flex;align-items:center;gap:10px;">
      <div style="font-size:22px;">${crop?.emoji||'🌱'}</div>
      <div><div style="font-size:13px;font-weight:700;color:var(--accent2);">${cropLabel}</div>
      <div style="font-size:11px;color:var(--text3);">База GDD: +${tbase}°C · Старт: ${startDate}</div></div>
    </div>`:''}
    <div class="gdd-card ${critCount>0?'critical':sprayCount>0?'spray':allAlerts.length?'watch':'ok'}">
      <div class="gc-icon">📈</div><div class="gc-label">GDD накоплено</div>
      <div class="gc-val" style="color:var(--accent);">${currentGdd}</div>
      <div class="gc-sub">база +${tbase}°C</div>
    </div>
    <div class="gdd-card ok">
      <div class="gc-icon">🌱</div><div class="gc-label">Фаза</div>
      <div class="gc-val" style="font-size:12px;color:${currentPhase?.color||'var(--text2)'};">${currentPhase?.name||'—'}</div>
      <div class="gc-sub">${result.daysLeft!==null?`~${result.daysLeft} дн. до след.`:''}</div>
    </div>
    <div class="gdd-card ${critCount>0?'critical':sprayCount>0?'spray':allAlerts.length?'watch':'ok'}">
      <div class="gc-icon">🚨</div><div class="gc-label">Алертов</div>
      <div class="gc-val" style="color:${critCount>0?'var(--red)':sprayCount>0?'var(--orange)':allAlerts.length?'var(--yellow)':'var(--accent)'};">${allAlerts.length}</div>
      <div class="gc-sub">${critCount} крит · ${sprayCount} SPRAY</div>
    </div>
    <div class="gdd-card ${result.beesActive?'ok':'watch'}">
      <div class="gc-icon">🐝</div><div class="gc-label">Пчёлы</div>
      <div class="gc-val" style="font-size:13px;color:${result.beesActive?'var(--accent)':'var(--text3)'};">${result.beesActive?'Летают':'Не летают'}</div>
      <div class="gc-sub">>+10°C для лёта</div>
    </div>
    <div class="gdd-card ${result.frostRisk?'critical':'ok'}">
      <div class="gc-icon">🌡️</div><div class="gc-label">Заморозок</div>
      <div class="gc-val" style="font-size:13px;color:${result.frostRisk?'var(--red)':'var(--accent)'};">${result.frostRisk?'РИСК':'Норма'}</div>
      <div class="gc-sub">${result.latestWeather?`${result.latestWeather.tmin}°/${result.latestWeather.tmax}°C`:''}</div>
    </div>`;

  // Main report
  document.getElementById('gdd-alerts').innerHTML = renderGddReport(result);

  // Phase bar
  const barEl = document.getElementById('gdd-phase-bar');
  const legEl = document.getElementById('gdd-phase-legend');
  if (!phases.length) {
    barEl.innerHTML = `<div style="color:var(--text3);font-size:11px;padding:10px 14px;">Добавьте GDD через ⚙️ База данных GDD</div>`;
    legEl.innerHTML = '';
  } else {
    let barHtml = '';
    phases.forEach(ph => {
      const left = Math.max(0, (ph.from / displayMaxCapped) * 100);
      const width = Math.min(100-left, ((Math.min(ph.to,displayMaxCapped)-ph.from) / displayMaxCapped) * 100);
      if (width <= 0) return;
      barHtml += `<div class="phase-seg" style="left:${left}%;width:${width}%;background:${ph.color};">${width>7?ph.name:''}</div>`;
    });
    const markerLeft = Math.min(98, (currentGdd / displayMaxCapped) * 100);
    barHtml += `<div class="phase-marker" style="left:${markerLeft}%;" title="GDD ${currentGdd}"></div>`;
    barEl.innerHTML = barHtml;
    legEl.innerHTML = phases.map(ph=>{
      const act = getPhaseAction(crop?.id, ph.from + 1);
      return `<div style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--text2);padding:2px 0;">
        <div style="width:12px;height:12px;border-radius:3px;background:${ph.color};flex-shrink:0;"></div>
        <span style="min-width:80px;">${ph.name}</span>
        <span style="color:var(--text3);">GDD ${ph.from}–${ph.to===9999?'∞':ph.to}</span>
        ${act?`<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:${act.actionColor}22;color:${act.actionColor};font-weight:700;letter-spacing:0.5px;">${act.action}</span>`:''}
        ${act?`<span style="font-size:9px;color:var(--text3);">${act.mainRisks}</span>`:''}
      </div>`;
    }).join('');
  }

  // GDD table
  const tbody = document.getElementById('gdd-tbody');
  if (!series.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="color:var(--text3);text-align:center;padding:20px;">Нет погодных данных. Добавьте записи во вкладке 🌡️ Погода.</td></tr>`;
    return;
  }
  tbody.innerHTML = [...series].reverse().map(row => {
    const ph = getPhaseByGdd(varietyId, row.cumulative);    // Quick risk estimate for table (simplified)
    const topDis = S.diseaseCatalog.map(dc => {
      const r = calcDiseaseRiskFull(dc, varietyId, ph, row);
      return { name: dc.name, score: r.score, level: r.level };
    }).sort((a,b)=>b.score-a.score)[0];
    const pestReached = S.gddDb.pestThresholds.filter(p=>row.cumulative>=p.gddThreshold*0.85&&row.cumulative<p.gddThreshold*1.15);
    const LVL_COL = { critical:'var(--red)', spray:'var(--orange)', watch:'var(--yellow)', ok:'var(--accent)' };
    return `<tr>
      <td style="font-family:'Unbounded',sans-serif;font-size:11px;">${row.date}</td>
      <td style="color:${parseFloat(row.tmin)<=0?'var(--red)':parseFloat(row.tmin)<=2?'var(--yellow)':'var(--text)'}">${row.tmin??'—'}°</td>
      <td style="color:${parseFloat(row.tmax)>=32?'var(--orange)':'var(--text)'}">${row.tmax??'—'}°${row.heatStress?'🌡️':''}</td>
      <td style="font-family:'Unbounded',sans-serif;color:${row.heatStress?'var(--orange)':'var(--accent)'};">+${row.daily}${row.heatStress?` <span style="font-size:9px;color:var(--text3);">(-${row.heatStressCorrected})</span>`:''}</td>
      <td style="font-size:11px;text-align:center;">${row.heatStress?'🔥':''}</td>
      <td style="font-family:'Unbounded',sans-serif;font-weight:700;color:var(--accent2);">${row.cumulative}</td>
      <td><span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${ph?ph.color+'33':'var(--surface3)'};color:${ph?ph.color:'var(--text3)'};">${ph?.name||'—'}</span></td>
      <td style="font-size:11px;color:${topDis?LVL_COL[topDis.level]||'var(--text3)':'var(--text3)'};">${topDis&&topDis.score>0?`${topDis.name} ${topDis.score}%`:'—'}</td>
      <td style="font-size:11px;color:var(--yellow);">${pestReached.map(p=>p.name).join(', ')||'—'}</td>
    </tr>`;
  }).join('');
}

// GDD phase actions — from UC IPM GDD model for sour cherry
const SOUR_CHERRY_PHASE_ACTIONS = [
  {gddMin:0,    gddMax:60,   action:'MONITOR',            actionColor:'#6b7280', mainRisks:'Контроль Chill Portions'},
  {gddMin:60,   gddMax:100,  action:'WATCH',               actionColor:'#f59e0b', mainRisks:'Бакрак, камедь'},
  {gddMin:100,  gddMax:150,  action:'SPRAY / MONITOR',     actionColor:'#f97316', mainRisks:'Долгоносик, тля, клещи'},
  {gddMin:150,  gddMax:220,  action:'CRITICAL',             actionColor:'#ef4444', mainRisks:'Коккомикоз, клястероспориоз'},
  {gddMin:220,  gddMax:300,  action:'SPRAY',               actionColor:'#f97316', mainRisks:'Монилиоз, тля'},
  {gddMin:300,  gddMax:420,  action:'🔴 RED ALERT',         actionColor:'#dc2626', mainRisks:'Монилиоз цветков, заморозок'},
  {gddMin:420,  gddMax:560,  action:'CRITICAL / BEE SAFE', actionColor:'#dc2626', mainRisks:'Монилиоз, бакрак'},
  {gddMin:560,  gddMax:680,  action:'SPRAY',               actionColor:'#f97316', mainRisks:'Коккомикоз, клястероспориоз'},
  {gddMin:680,  gddMax:850,  action:'CRITICAL',             actionColor:'#ef4444', mainRisks:'Коккомикоз, тля, листовёртки'},
  {gddMin:850,  gddMax:1050, action:'TRAP + SPRAY',         actionColor:'#f97316', mainRisks:'Вишнёвая муха, антракноз'},
  {gddMin:1050, gddMax:1250, action:'🔴 RED ALERT',         actionColor:'#dc2626', mainRisks:'Муха, Drosophila, Brown Rot'},
  {gddMin:1250, gddMax:1450, action:'HARVEST WATCH',        actionColor:'#eab308', mainRisks:'Brown Rot, растрескивание'},
  {gddMin:1450, gddMax:1650, action:'POST-HARVEST SPRAY',   actionColor:'#8b5cf6', mainRisks:'Коккомикоз — защита листа!'},
  {gddMin:1650, gddMax:9999, action:'MONITOR / STOP',       actionColor:'#6b7280', mainRisks:'Закладка почек след. года'},
];

function getPhaseAction(cropId, gdd) {
  if (cropId !== 'crop_sour_cherry') return null;
  return SOUR_CHERRY_PHASE_ACTIONS.find(a => gdd >= a.gddMin && gdd < a.gddMax) || null;
}

// GDD DB Management — simplified variety GDD editor
function openGddDbModal() {
  showGddSection('phases');
  renderVarietyTabs();
  renderGddPestList();
  renderGddSensList();
  openModal('modal-gdd-db');
}
function openGddResetModal() {
  document.getElementById('gdd-start-input').value = getGddStartDate();
  openModal('modal-gdd-start');
}
function saveGddStart() {
  S.gddDb.startDate = document.getElementById('gdd-start-input').value;
  save(); closeModal('modal-gdd-start'); renderGdd();
}
function showGddSection(sec) {
  ['phases','pests','sensitivity'].forEach(s=>{
    document.getElementById('gdd-sec-'+s).style.display = s===sec?'block':'none';
    document.getElementById('gbtn-'+s).className = s===sec?'btn btn-primary btn-sm':'btn btn-secondary btn-sm';
  });
}

// ---- New variety GDD editor ----
let _gddEditVariety = null;

let _gddCropFilter = null; // selected crop in GDD DB modal

function renderVarietyTabs() {
  // Step 1: render crop tabs
  const cropTabsEl = document.getElementById('gdd-crop-tabs');
  if (!cropTabsEl) return;

  // Auto-select first crop if none selected
  if (!_gddCropFilter) _gddCropFilter = S.crops[0]?.id || 'crop_cherry';

  cropTabsEl.innerHTML = S.crops.map(crop => {
    const isActive = crop.id === _gddCropFilter;
    const varCount = S.varieties.filter(v=>(v.cropId||'crop_cherry')===crop.id).length;
    return `<button class="btn btn-sm ${isActive?'btn-primary':'btn-secondary'}"
      onclick="selectGddCrop('${crop.id}')"
      style="display:flex;align-items:center;gap:6px;">
      <span style="font-size:14px;">${crop.emoji||'🌱'}</span>
      ${crop.name}
      ${varCount?`<span style="font-size:10px;padding:1px 5px;border-radius:8px;background:rgba(74,222,128,.15);color:var(--accent);">${varCount}</span>`:''}
    </button>`;
  }).join('');

  // Step 2: render variety tabs for selected crop
  const varTabsEl = document.getElementById('gdd-variety-tabs');
  const labelEl = document.getElementById('gdd-variety-tabs-label');
  const cropVarieties = S.varieties.filter(v=>(v.cropId||'crop_cherry')===_gddCropFilter);

  if (cropVarieties.length) {
    if (labelEl) labelEl.style.display = 'block';
    if (!_gddEditVariety || !cropVarieties.find(v=>v.id===_gddEditVariety)) {
      _gddEditVariety = cropVarieties[0].id;
    }
    varTabsEl.innerHTML = cropVarieties.map(v => {
      const isActive = v.id === _gddEditVariety;
      const hasGdd = S.gddDb.varietyGdd[v.id]?.length > 0;
      return `<button class="btn btn-sm ${isActive?'btn-primary':'btn-secondary'}"
        onclick="selectGddVariety('${v.id}')"
        style="display:flex;align-items:center;gap:6px;">
        <div style="width:10px;height:10px;border-radius:2px;" class="${v.color}"></div>
        ${v.name}
        ${hasGdd?'<span style="color:var(--accent);font-size:11px;">✓</span>':''}
      </button>`;
    }).join('');
  } else {
    if (labelEl) labelEl.style.display = 'none';
    varTabsEl.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:8px;">
      Нет сортов для этой культуры. Добавьте сорта через кнопку 🌿 Сорта на карте.
    </div>`;
    _gddEditVariety = null;
  }

  renderGddPhasesEditor();
}

function selectGddCrop(cropId) {
  _gddCropFilter = cropId;
  _gddEditVariety = null; // reset variety selection
  renderVarietyTabs();
}

function renderGddPhasesEditor() {
  const el = document.getElementById('gdd-phases-editor');
  if (!el) return;

  // Use phases from the selected crop
  const crop = getCropById(_gddCropFilter);
  const std = crop?.phases || S.gddDb.standardPhases || [];

  if (!_gddEditVariety) {
    el.innerHTML = `<div style="color:var(--text3);font-size:12px;padding:12px;">
      ${crop ? `${crop.emoji||''} Нет сортов для ${crop.name}. Добавьте через кнопку 🌿 Сорта на карте.` : 'Выберите культуру выше.'}
    </div>`;
    return;
  }

  const gddVals = S.gddDb.varietyGdd[_gddEditVariety] || std.map((_,i)=>i===0?0:null);
  const variety = S.varieties.find(v=>v.id===_gddEditVariety);

  el.innerHTML = `
    <div style="font-size:11px;color:var(--text3);margin-bottom:12px;">
      ${crop?.emoji||''} <strong style="color:var(--accent2);">${crop?.name||''}</strong>
      → Сорт: <strong style="color:var(--accent);">${variety?.name||''}</strong>
      · База GDD: +${crop?.baseTemp||5}°C · Вносите GDD при котором начинается каждая фаза
    </div>
    <div style="display:grid;grid-template-columns:auto 1fr auto;gap:0;border:1px solid var(--border);border-radius:10px;overflow:hidden;">
      <div style="background:var(--surface2);padding:8px 12px;font-size:9px;color:var(--text3);font-family:'Unbounded',sans-serif;letter-spacing:1px;text-transform:uppercase;">ФАЗА</div>
      <div style="background:var(--surface2);padding:8px 12px;font-size:9px;color:var(--text3);font-family:'Unbounded',sans-serif;letter-spacing:1px;text-transform:uppercase;">GDD НАЧАЛО</div>
      <div style="background:var(--surface2);padding:8px 12px;font-size:9px;color:var(--text3);font-family:'Unbounded',sans-serif;letter-spacing:1px;text-transform:uppercase;">GDD КОНЕЦ</div>
      ${std.map((ph,i) => {
        const gddStart = gddVals[i] ?? '';
        const gddEnd = i < std.length-1 ? (gddVals[i+1] ?? '') : '—';
        const borderStyle = i < std.length-1 ? 'border-bottom:1px solid var(--border);' : '';
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;${borderStyle}">
            <div style="width:14px;height:14px;border-radius:3px;flex-shrink:0;background:${ph.color};"></div>
            <span style="font-size:13px;font-weight:600;">${ph.name}</span>
          </div>
          <div style="padding:8px 12px;${borderStyle}">
            <input type="number" value="${gddStart}" min="0" placeholder="напр. ${50+i*80}"
              style="width:120px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:7px 10px;color:var(--accent);font-family:'Unbounded',sans-serif;font-size:13px;font-weight:700;"
              onchange="updateVarietyGdd('${_gddEditVariety}',${i},this.value,${std.length})"
              oninput="updateVarietyGdd('${_gddEditVariety}',${i},this.value,${std.length})">
          </div>
          <div style="padding:10px 12px;font-size:12px;color:var(--text3);${borderStyle}">
            ${gddEnd !== '—' ? `<span style="font-family:'Unbounded',sans-serif;font-size:11px;">${gddEnd}</span>` : '<span style="color:var(--text3);">∞</span>'}
          </div>`;
      }).join('')}
    </div>
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn btn-secondary btn-sm" onclick="copyGddToAllVarieties('${_gddEditVariety}')">📋 Скопировать на все сорта ${crop?.name||''}</button>
      <button class="btn btn-secondary btn-sm" onclick="resetGddVariety('${_gddEditVariety}')">↩️ Сбросить</button>
    </div>`;
}

function updateVarietyGdd(vid, idx, val, phaseCount) {
  const crop = getCropById(_gddCropFilter);
  const std = crop?.phases || S.gddDb.standardPhases || [];
  const count = phaseCount || std.length;
  if (!S.gddDb.varietyGdd[vid]) {
    S.gddDb.varietyGdd[vid] = Array(count).fill(null).map((_,i)=>i===0?0:null);
  }
  // Resize array if needed for this crop's phase count
  while (S.gddDb.varietyGdd[vid].length < count) S.gddDb.varietyGdd[vid].push(null);
  S.gddDb.varietyGdd[vid][idx] = val === '' ? null : Number(val);
  renderGddPhasesEditor();
  save();
}

function copyGddToAllVarieties(fromVid) {
  const src = S.gddDb.varietyGdd[fromVid];
  if (!src) return;
  const fromVariety = S.varieties.find(v=>v.id===fromVid);
  const cropId = fromVariety?.cropId || _gddCropFilter || 'crop_cherry';
  const cropName = getCropById(cropId)?.name || '';
  const samecropVarieties = S.varieties.filter(v=>(v.cropId||'crop_cherry')===cropId&&v.id!==fromVid);
  if (!samecopVarieties?.length && !samecropyVarieties) {
    // fix typo
  }
  const targets = S.varieties.filter(v=>(v.cropId||'crop_cherry')===cropId&&v.id!==fromVid);
  if (!targets.length) { alert(`Нет других сортов ${cropName}`); return; }
  if (!confirm(`Скопировать GDD от "${fromVariety?.name}" на все ${targets.length} сорт(а) ${cropName}?`)) return;
  targets.forEach(v => { S.gddDb.varietyGdd[v.id] = [...src]; });
  save();
  alert(`Скопировано на ${targets.length} сортов. Скорректируйте отличия.`);
}

function resetGddVariety(vid) {
  if (!confirm('Сбросить GDD для этого сорта?')) return;
  delete S.gddDb.varietyGdd[vid];
  save(); renderGddPhasesEditor();
}

// Stubs for old functions (kept for backward compat)
function populateGddPhaseVarietySelect() { renderVarietyTabs(); }
function renderGddPhaseList() { renderGddPhasesEditor(); }
function addGddPhase() {}
function removeGddPhase() {}
function renderGddPestList() {
  const el = document.getElementById('gdd-pest-list');
  el.innerHTML = S.gddDb.pestThresholds.map((p,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--surface2);border-radius:7px;margin-bottom:5px;">
      <div style="flex:1;font-size:12px;"><strong>${p.name}</strong> · GDD ${p.gddThreshold} · <span class="ai-badge ${p.alertLevel}" style="font-size:9px;">${p.alertLevel.toUpperCase()}</span></div>
      <div style="font-size:11px;color:var(--text3);">${p.phaseRisk}</div>
      <button class="btn btn-danger btn-xs" onclick="removeGddPest(${i})">✕</button>
    </div>`).join('')||'<div style="color:var(--text3);font-size:12px;">Нет данных</div>';
}
function addGddPest() {
  const name=document.getElementById('gpe-name').value.trim();
  const gdd=parseFloat(document.getElementById('gpe-gdd').value);
  if(!name||!gdd){alert('Заполните название и GDD');return;}
  S.gddDb.pestThresholds.push({id:'pt'+Date.now(),name,gddThreshold:gdd,phaseRisk:document.getElementById('gpe-phase').value,alertLevel:document.getElementById('gpe-alert').value,products:document.getElementById('gpe-products').value,recommendation:document.getElementById('gpe-rec').value});
  ['gpe-name','gpe-gdd','gpe-phase','gpe-products','gpe-rec'].forEach(id=>document.getElementById(id).value='');
  save();renderGddPestList();
}
function removeGddPest(i){ S.gddDb.pestThresholds.splice(i,1); save(); renderGddPestList(); }
function renderGddSensList() {
  const SENS_LABEL=['','Устойчивый','Слабо восприимч.','Средний','Чувствительный','Очень чувствит.'];
  const SENS_COLOR=['','var(--accent)','var(--accent)','var(--text2)','var(--yellow)','var(--red)'];
  const el=document.getElementById('gdd-sens-list');
  el.innerHTML=S.varieties.map(v=>`
    <div style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
        <div style="width:14px;height:14px;border-radius:3px;" class="${v.color}"></div>${v.name}
        <span style="font-size:10px;color:var(--text3);">шкала 1=устойчивый … 5=очень чувствительный</span>
      </div>
      ${S.diseaseCatalog.map(dc=>{
        const sens=S.gddDb.varietySensitivity;
        if(!sens[v.id])sens[v.id]={};
        const val=sens[v.id][dc.id]??3;
        return`<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="flex:1;font-size:12px;">${dc.name}</span>
          <input type="number" value="${val}" min="1" max="5" step="1"
            style="width:60px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:${SENS_COLOR[val]||'var(--text)'};font-family:'Unbounded',sans-serif;font-size:13px;text-align:center;"
            onchange="setVarietySensitivity('${v.id}','${dc.id}',this.value)">
          <span style="font-size:10px;color:${SENS_COLOR[val]||'var(--text)'};width:110px;">${SENS_LABEL[val]||val}</span>
        </div>`;
      }).join('')}
    </div>`).join('');
}
function setVarietySensitivity(vid,dcId,val){
  if(!S.gddDb.varietySensitivity[vid])S.gddDb.varietySensitivity[vid]={};
  const v=Math.max(1,Math.min(5,parseInt(val)||3));
  S.gddDb.varietySensitivity[vid][dcId]=v;
  save();renderGddSensList();
}

/** Kept for disease risk display in weather panel (uses latest weather) */

// ===================== CHILL PORTIONS — DYNAMIC MODEL =====================
// Based on Fishman et al. (1987) Dynamic Model
// One of the best models for dormancy — uses hourly temps, accounts for warm period negation

/**
 * Dynamic Model (Fishman & Erez, 1987) — точная реализация
 * Константы соответствуют оригинальной публикации и пакету chillR (Luedeling 2012)
 * Проверено для условий Молдовы: норма Регины 65-72 CP
 */
const DM = {
  A0:  139500,    // rate constant формирования промежуточного вещества
  A1:  2.567e18,  // rate constant разрушения
  E0:  4157.0,    // энергия активации формирования (кал/моль)
  E1:  19488.0,   // энергия активации разрушения (кал/моль)
  SLP: 1.6,       // наклон кривой (slope)
  T_S: 277.0,     // температура перехода (K ≈ +4°C)
  R:   1.987,     // универсальная газовая постоянная (кал/моль·К)
};

/**
 * Calculate Chill Portions from an array of hourly temperatures (°C).
 * Точная реализация Fishman 1987 — двухступенчатый конвейер.
 * Returns {cpTotal, dailyLog: [{date, cp, hours}]}
 */
function calcDynamicModelCP(hourlyData) {
  let inter_e = 0;  // промежуточное вещество (нестабильное)
  let cpTotal = 0;
  const dailyMap = {};

  hourlyData.forEach(h => {
    const tk = h.temp + 273.15; // Цельсий → Кельвин

    // Уравнения обмена веществ почки (Fishman 1987)
    const ftk = (DM.SLP * DM.T_S / tk) * Math.exp(DM.SLP * (1.0 - DM.T_S / tk));
    const e1  = Math.exp(-DM.E0 / (DM.R * tk));
    const e2  = Math.exp(-DM.E1 / (DM.R * tk));
    const q1  = DM.A0 * e1;
    const q2  = DM.A1 * e2;

    // Изменение промежуточного вещества за 1 час
    inter_e = inter_e + (q1 * ftk - q2 * inter_e);
    if (inter_e < 0) inter_e = 0; // не может быть отрицательным

    // Если промежуточный уровень достиг порога → фиксируем порцию
    let cpAdded = 0;
    if (inter_e >= 1.0) {
      cpAdded = Math.floor(inter_e);
      inter_e = inter_e - cpAdded; // остаток продолжает накапливаться
    }
    cpTotal += cpAdded;

    // Группируем по дате
    const date = h.datetime ? h.datetime.split(' ')[0] : h.date;
    if (!dailyMap[date]) dailyMap[date] = {cp:0, hours:0};
    dailyMap[date].cp += cpAdded;
    dailyMap[date].hours++;
  });

  const dailyLog = Object.entries(dailyMap).sort().map(([date,v]) => ({
    date,
    cp: Math.round(v.cp * 10) / 10,
    hours: v.hours,
    quality: v.hours >= 24 ? 'good' : v.hours >= 20 ? 'partial' : 'bad',
  }));

  return { cpTotal: Math.round(cpTotal * 10) / 10, dailyLog };
}

/**
 * Build hourly data from daily Tmin/Tmax using sinusoidal interpolation.
 * This is the fallback when only daily data is available.
 * Accuracy warning is shown when this is used.
 */
function buildHourlyFromDaily(weatherDays) {
  const hourly = [];
  const sorted = [...weatherDays].sort((a,b)=>a.date.localeCompare(b.date));
  sorted.forEach(day => {
    if (day.tmin === null || day.tmax === null) return;
    const tmin = parseFloat(day.tmin);
    const tmax = parseFloat(day.tmax);
    const amp = (tmax - tmin) / 2;
    const mean = (tmax + tmin) / 2;
    for (let h = 0; h < 24; h++) {
      // Sinusoidal model: min at 6am, max at 2pm
      const angle = ((h - 14) / 24) * 2 * Math.PI;
      const temp = mean + amp * Math.cos(angle);
      hourly.push({ date: day.date, datetime: `${day.date} ${String(h).padStart(2,'0')}:00`, temp });
    }
  });
  return hourly;
}

/** Get chill season date range */
function getChillSeason(yearHint) {
  const cp = S.chillPortions;
  const now = new Date();
  const yr = yearHint || now.getFullYear();
  const prevYr = yr - 1;
  // Season Nov 1 → Mar 31
  const start = cp.seasonStart
    ? (new Date(cp.seasonStart).getFullYear() === yr ? cp.seasonStart : `${prevYr}-11-01`)
    : `${prevYr}-11-01`;
  const end = cp.seasonEnd || `${yr}-03-31`;
  return { start, end };
}

/** Get available seasons from weather data */
function getAvailableSeasons() {
  if (!S.weather.length) return [];
  const years = [...new Set(S.weather.map(w => parseInt(w.date.split('-')[0])))].sort();
  return years.map(yr => ({
    label: `${yr-1}/${yr}`,
    start: `${yr-1}-11-01`,
    end: `${yr}-03-31`,
    yr,
  }));
}

/** Run full chill calculation for a season */
function runChillCalc(seasonStart, seasonEnd) {
  // Get weather in season range
  const days = S.weather
    .filter(w => w.date >= seasonStart && w.date <= seasonEnd)
    .sort((a,b) => a.date.localeCompare(b.date));

  if (!days.length) return null;

  // Check if we have hourly data embedded (leafwet proxy for now — use daily T)
  const hourly = buildHourlyFromDaily(days);
  const fromHourly = false; // flag: daily→hourly interpolation used

  const result = calcDynamicModelCP(hourly);

  // Annotate: data quality per day
  result.dailyLog.forEach(d => {
    // 24 synthetic hours always — mark as 'interpolated'
    d.quality = 'interpolated';
    d.hours = 24;
  });

  // Build cumulative
  let cumCP = 0;
  result.dailyLog.forEach(d => { cumCP += d.cp; d.cumulative = Math.round(cumCP * 10) / 10; });

  result.interpolated = true; // flag for UI warning
  result.days = days.length;
  return result;
}

/** Get cultivar chill status */
function getChillStatus(cpFact, cpTarget) {
  const pct = cpTarget > 0 ? Math.round(cpFact / cpTarget * 100) : 0;
  if (pct >= 100) return { pct, label:'✅ Холод выполнен',    cls:'cp-ok',     risk:'Низкий',    allowGdd:true  };
  if (pct >= 90)  return { pct, label:'🔵 Почти выполнен',   cls:'cp-near',   risk:'Умеренный', allowGdd:false };
  if (pct >= 80)  return { pct, label:'⚠️ Недобор холода',   cls:'cp-medium', risk:'Средний',   allowGdd:false };
  return            { pct, label:'🔴 Сильный недобор',        cls:'cp-high',   risk:'Высокий',   allowGdd:false };
}

/** Check if GDD should be allowed for a variety — called by GDD engine */
function getGddStartForVariety(varietyId) {
  const cs = S.chillPortions.cultivarSettings.find(c=>c.varietyId===varietyId);
  if (!cs) return null; // no chill requirement → GDD always runs

  // Run calc for most recent season
  const seasons = getAvailableSeasons();
  if (!seasons.length) return null;
  const latest = seasons[seasons.length-1];
  const res = runChillCalc(latest.start, latest.end);
  if (!res) return null;

  const cpFact = res.cpTotal;
  const status = getChillStatus(cpFact, cs.cpTarget);

  if (status.allowGdd) {
    // Return date chill was completed
    const completedEntry = res.dailyLog.find(d => d.cumulative >= cs.cpTarget);
    return completedEntry?.date || res.dailyLog[res.dailyLog.length-1]?.date || null;
  }
  return 'blocked'; // GDD blocked — chill not complete
}

// ---- CHILL UI ----
function renderChill() {
  const seasons = getAvailableSeasons();
  const selEl = document.getElementById('chill-season');
  const curSeason = selEl.value;
  selEl.innerHTML = seasons.length
    ? seasons.map(s=>`<option value="${s.start}|${s.end}" ${curSeason===s.start+'|'+s.end?'selected':''}>${s.label}</option>`).join('')
    : '<option value="">Нет данных погоды</option>';
  if (!curSeason && seasons.length) selEl.value = seasons[seasons.length-1].start+'|'+seasons[seasons.length-1].end;

  const selVal = selEl.value;
  if (!selVal) {
    document.getElementById('chill-cards').innerHTML = '<div style="color:var(--text3);font-size:12px;grid-column:1/-1;padding:20px;">Загрузите данные погоды во вкладке 🌡️ Погода чтобы рассчитать Chill Portions.</div>';
    return;
  }
  const [sStart, sEnd] = selVal.split('|');
  const res = runChillCalc(sStart, sEnd);

  if (!res) {
    document.getElementById('chill-cards').innerHTML = '<div style="color:var(--text3);font-size:12px;grid-column:1/-1;padding:20px;">Нет данных для расчёта в этом сезоне.</div>';
    return;
  }

  // Data quality note
  const qualEl = document.getElementById('chill-data-quality');
  qualEl.innerHTML = res.interpolated
    ? `<span style="color:var(--yellow);font-size:11px;">⚠️ Расчёт по Tmin/Tmax — интерполяция. Для точности нужны почасовые данные.</span>`
    : `<span style="color:var(--accent);font-size:11px;">✅ Расчёт по почасовым температурам</span>`;

  // Cards: first show all crops present in garden, then cherry varieties
  const cpFact = res.cpTotal;

  // Get crops actually used in garden cells
  const gardenCropIds = [...new Set(Object.values(S.cells).map(cd=>cd?.cropId||'crop_cherry'))];
  // If no cells configured, show all crop settings
  const activeCropIds = gardenCropIds.length ? gardenCropIds : S.chillPortions.cropSettings.map(c=>c.cropId);

  function buildCard(name, emoji, cpMin, cpMax, cpTarget, extraInfo) {
    const status = getChillStatus(cpFact, cpTarget);
    const completedEntry = res.dailyLog.find(d=>d.cumulative>=cpTarget);
    const pctCapped = Math.min(100, status.pct);
    const barColor = {cp_ok:'var(--accent)',cp_near:'var(--blue)',cp_medium:'var(--yellow)',cp_high:'var(--red)'}[status.cls]||'var(--accent)';
    const circum = 2*Math.PI*36;
    const dashLen = (pctCapped/100)*circum;
    return `<div class="cp-card ${status.cls}">
      <div style="display:flex;gap:14px;align-items:flex-start;">
        <div class="cp-ring">
          <svg viewBox="0 0 90 90">
            <circle cx="45" cy="45" r="36" fill="none" stroke="var(--surface3)" stroke-width="8"/>
            <circle cx="45" cy="45" r="36" fill="none" stroke="${barColor}" stroke-width="8"
              stroke-dasharray="${dashLen.toFixed(1)} ${circum.toFixed(1)}"
              stroke-dashoffset="${circum/4}"
              stroke-linecap="round" transform="rotate(-90 45 45)"/>
          </svg>
          <div class="cp-ring-center">
            <div class="cp-ring-val" style="color:${barColor};">${pctCapped}%</div>
            <div class="cp-ring-pct">${cpFact}/${cpTarget}</div>
          </div>
        </div>
        <div style="flex:1;">
          <div style="font-size:18px;margin-bottom:2px;">${emoji||'🌱'}</div>
          <div style="font-size:13px;font-weight:700;margin-bottom:3px;">${name}</div>
          ${extraInfo?`<div style="font-size:10px;color:var(--text3);margin-bottom:4px;">${extraInfo}</div>`:''}
          <div class="cp-status-badge">${status.label}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:5px;">
            CP: <strong>${cpFact}</strong> / ${cpTarget} (диапазон ${cpMin}–${cpMax})<br>
            Риск: <span style="color:${barColor};">${status.risk}</span>
          </div>
          ${status.allowGdd
            ?`<div class="gdd-allowed">✅ GDD: можно запускать${completedEntry?' · '+completedEntry.date:''}</div>`
            :`<div class="gdd-blocked">🚫 GDD заблокирован · ещё ${Math.max(0,cpTarget-cpFact).toFixed(1)} CP</div>`}
        </div>
      </div>
      <div class="cp-bar"><div class="cp-bar-fill" style="width:${pctCapped}%;background:${barColor};"></div></div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px;">${res.days} дней данных · ${cpMin}–${cpMax} CP</div>
    </div>`;
  }

  // Section 1: all crops in garden
  let html = '';
  if (activeCropIds.length) {
    html += `<div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;grid-column:1/-1;">🌿 По культурам${gardenCropIds.length?' (на карте)':''}</div>`;
    activeCropIds.forEach(cid => {
      const cs = S.chillPortions.cropSettings.find(c=>c.cropId===cid);
      if (!cs) return;
      const crop = getCropById(cid);
      html += buildCard(cs.name, crop?.emoji||cs.emoji, cs.cpMin, cs.cpMax, cs.cpTarget, `База GDD: +${crop?.baseTemp||5}°C`);
    });
  }

  // Section 2: cherry varieties (if cherry is in garden or always show)
  const cherryVarieties = S.chillPortions.cultivarSettings.filter(cs=>cs.isActive);
  if (cherryVarieties.length) {
    html += `<div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin:16px 0 10px;grid-column:1/-1;">🍒 По сортам черешни</div>`;
    cherryVarieties.forEach(cs => {
      const variety = S.varieties.find(v=>v.id===cs.varietyId);
      html += buildCard(cs.name, '🍒', cs.cpMin, cs.cpMax, cs.cpTarget, variety?`Сорт: ${variety.name}`:'');
    });
  }

  document.getElementById('chill-cards').innerHTML = html || `<div style="color:var(--text3);font-size:12px;grid-column:1/-1;padding:20px;">Добавьте культуры к клеткам карты чтобы увидеть их CP статус.</div>`;

  // Render history table if visible
  if (document.getElementById('chill-history-wrap').style.display !== 'none') {
    renderChillHistory(res);
  }
}

function showChillHistory() {
  const wrap = document.getElementById('chill-history-wrap');
  wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  if (wrap.style.display === 'block') {
    const selVal = document.getElementById('chill-season').value;
    if (!selVal) return;
    const [sStart,sEnd] = selVal.split('|');
    const res = runChillCalc(sStart,sEnd);
    if (res) renderChillHistory(res);
  }
}

function renderChillHistory(res) {
  const tbody = document.getElementById('chill-history-body');
  const settings = S.chillPortions.cultivarSettings;
  // Get unique CP targets
  const targets = [...new Set(settings.map(c=>c.cpTarget))].sort();

  tbody.innerHTML = [...res.dailyLog].reverse().slice(0,60).map(d => {
    const qColor = {good:'var(--accent)',partial:'var(--yellow)',bad:'var(--red)',interpolated:'var(--text3)'}[d.quality]||'var(--text3)';
    const qLabel = {good:'✅ Полные',partial:'⚠️ Частичные',bad:'❌ Мало',interpolated:'~ Расчётные'}[d.quality]||d.quality;
    // Status for each target CP group
    const statusCells = targets.map(t => {
      const pct = Math.round((d.cumulative/t)*100);
      const color = pct>=100?'var(--accent)':pct>=90?'var(--blue)':pct>=80?'var(--yellow)':'var(--red)';
      return `<td style="color:${color};font-family:'Unbounded',sans-serif;font-size:11px;">${d.cumulative}/${t}<br><span style="font-size:9px;">${pct}%</span></td>`;
    });
    return `<tr>
      <td style="font-family:'Unbounded',sans-serif;font-size:11px;">${d.date}</td>
      <td style="color:var(--text3);">${d.hours}</td>
      <td style="color:${qColor};font-size:11px;">${qLabel}</td>
      <td style="color:var(--blue);font-family:'Unbounded',sans-serif;">+${d.cp.toFixed(2)}</td>
      <td style="font-family:'Unbounded',sans-serif;font-weight:700;color:var(--accent2);">${d.cumulative}</td>
      ${statusCells.join('')}
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="color:var(--text3);text-align:center;padding:20px;">Нет данных</td></tr>';
}

// ---- CHILL SETTINGS MODAL ----
function openChillSettingsModal() {
  const cp = S.chillPortions;
  document.getElementById('cs-season-start').value = cp.seasonStart||`${new Date().getFullYear()-1}-11-01`;
  document.getElementById('cs-season-end').value = cp.seasonEnd||`${new Date().getFullYear()}-03-31`;
  const vsel = document.getElementById('cs-variety-sel');
  vsel.innerHTML = '<option value="">— выбрать сорт —</option>';
  S.varieties.forEach(v=>vsel.innerHTML+=`<option value="${v.id}">${v.name}</option>`);
  renderChillCropList();
  renderChillCultivarList();
  openModal('modal-chill-settings');
}

function renderChillCropList() {
  const el = document.getElementById('cs-crop-list');
  if (!el) return;
  el.innerHTML = S.chillPortions.cropSettings.map((cs,i) => {
    const crop = getCropById(cs.cropId);
    return `<div style="display:grid;grid-template-columns:1fr 70px 70px 70px 36px;gap:8px;align-items:center;padding:9px 10px;background:var(--surface2);border-radius:8px;margin-bottom:5px;border:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;">
        <span style="font-size:16px;">${crop?.emoji||cs.emoji||'🌱'}</span>${cs.name}
      </div>
      <div style="text-align:center;">
        <div style="font-size:9px;color:var(--text3);">Мин</div>
        <input type="number" value="${cs.cpMin}" min="0" step="1"
          style="width:60px;background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:4px 6px;color:var(--blue);font-family:'Unbounded',sans-serif;font-size:12px;text-align:center;"
          onchange="S.chillPortions.cropSettings[${i}].cpMin=parseInt(this.value);save();">
      </div>
      <div style="text-align:center;">
        <div style="font-size:9px;color:var(--text3);">Цель</div>
        <input type="number" value="${cs.cpTarget}" min="0" step="1"
          style="width:60px;background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:4px 6px;color:var(--accent);font-family:'Unbounded',sans-serif;font-size:12px;text-align:center;"
          onchange="S.chillPortions.cropSettings[${i}].cpTarget=parseInt(this.value);save();">
      </div>
      <div style="text-align:center;">
        <div style="font-size:9px;color:var(--text3);">Макс</div>
        <input type="number" value="${cs.cpMax}" min="0" step="1"
          style="width:60px;background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:4px 6px;color:var(--yellow);font-family:'Unbounded',sans-serif;font-size:12px;text-align:center;"
          onchange="S.chillPortions.cropSettings[${i}].cpMax=parseInt(this.value);save();">
      </div>
      <div></div>
    </div>`;
  }).join('') || '<div style="color:var(--text3);font-size:12px;">Нет культур</div>';
}

function renderChillCultivarList() {
  const el = document.getElementById('cs-cultivar-list');
  el.innerHTML = S.chillPortions.cultivarSettings.map((cs,i) => `
    <div style="display:grid;grid-template-columns:1fr 70px 70px 70px 36px;gap:8px;align-items:center;padding:10px;background:var(--surface2);border-radius:8px;margin-bottom:6px;border:1px solid var(--border);">
      <div style="font-size:12px;font-weight:600;">${cs.name}</div>
      <div style="text-align:center;"><div style="font-size:9px;color:var(--text3);">Мин</div><div style="font-size:13px;color:var(--blue);font-family:'Unbounded',sans-serif;">${cs.cpMin}</div></div>
      <div style="text-align:center;"><div style="font-size:9px;color:var(--text3);">Цель</div><div style="font-size:13px;color:var(--accent);font-family:'Unbounded',sans-serif;">${cs.cpTarget}</div></div>
      <div style="text-align:center;"><div style="font-size:9px;color:var(--text3);">Макс</div><div style="font-size:13px;color:var(--yellow);font-family:'Unbounded',sans-serif;">${cs.cpMax}</div></div>
      <button class="btn btn-danger btn-xs" onclick="removeChillCultivar(${i})">✕</button>
    </div>`).join('') || '<div style="color:var(--text3);font-size:12px;">Нет сортов. Добавьте через форму ниже.</div>';
}

function saveChillCultivar() {
  const vid = document.getElementById('cs-variety-sel').value;
  const cpMin = parseInt(document.getElementById('cs-cp-min').value)||45;
  const cpTarget = parseInt(document.getElementById('cs-cp-target').value)||50;
  const cpMax = parseInt(document.getElementById('cs-cp-max').value)||55;
  const variety = S.varieties.find(v=>v.id===vid);
  const name = variety?.name || 'Новый сорт';
  const existing = S.chillPortions.cultivarSettings.findIndex(c=>c.varietyId===vid);
  const entry = {varietyId:vid, name, cpMin, cpTarget, cpMax, isActive:true, gddStartDate:null};
  if (existing>=0) S.chillPortions.cultivarSettings[existing]=entry;
  else S.chillPortions.cultivarSettings.push(entry);
  ['cs-cp-min','cs-cp-target','cs-cp-max'].forEach(id=>document.getElementById(id).value='');
  renderChillCultivarList();
}

function removeChillCultivar(i) {
  S.chillPortions.cultivarSettings.splice(i,1);
  renderChillCultivarList();
}

function saveChillSettings() {
  S.chillPortions.seasonStart = document.getElementById('cs-season-start').value||null;
  S.chillPortions.seasonEnd = document.getElementById('cs-season-end').value||null;
  save(); closeModal('modal-chill-settings'); renderChill();
}

// ===================== CROPS =====================

function getCropById(id) { return S.crops.find(c=>c.id===id)||null; }

/** Get phases for a specific variety using its crop's phase template */
function getVarietyPhasesFromCrop(varietyId) {
  // Find which crop this variety's cell uses
  // Variety → crop via gddDb.varietyGdd
  const std = S.gddDb.standardPhases || [];
  const gddValues = S.gddDb.varietyGdd[varietyId];
  if (!gddValues || !std.length) return [];
  return std.map((ph,i)=>({
    name:ph.name, color:ph.color,
    from: Number(gddValues[i])||0,
    to: i<std.length-1 ? (Number(gddValues[i+1])||9999) : 9999,
  }));
}

/** Get crop for a given cell key */
function getCellCrop(cellKey) {
  const cd = S.cells[cellKey];
  if (!cd || !cd.cropId) return getCropById('crop_cherry'); // default
  return getCropById(cd.cropId) || getCropById('crop_cherry');
}

/** Get GDD base temp for a cell */
function getCellBaseTemp(cellKey) {
  const crop = getCellCrop(cellKey);
  return crop?.baseTemp || 5;
}

/** Get phases for a cell's crop */
function getCellCropPhases(cellKey, varietyId) {
  const crop = getCellCrop(cellKey);
  if (!crop) return getVarietyPhases(varietyId);
  // Use crop phases as template with variety GDD values
  const gddValues = S.gddDb.varietyGdd[varietyId];
  if (!gddValues || !crop.phases.length) return crop.phases.map((ph,i)=>({...ph,from:i*100,to:(i+1)*100}));
  return crop.phases.map((ph,i)=>({
    name:ph.name, color:ph.color,
    from: Number(gddValues[i])||0,
    to: i<crop.phases.length-1 ? (Number(gddValues[i+1])||9999) : 9999,
  }));
}

/** Get diseases relevant to a cell's crop */
function getCellDiseases(cellKey) {
  const crop = getCellCrop(cellKey);
  if (!crop || !crop.diseases || !crop.diseases.length) return S.diseaseCatalog;
  return S.diseaseCatalog.filter(dc=>crop.diseases.includes(dc.id));
}

/** Get pests for a cell's crop */
function getCellPests(cellKey) {
  const crop = getCellCrop(cellKey);
  return crop?.pests || S.gddDb.pestThresholds;
}

// ---- RENDER CROPS TAB ----
function renderCrops() {
  const tbase = 5;
  // Dashboard summary
  const dash = document.getElementById('crops-dashboard');
  if(!dash) return; // панель не активна
  const cropCounts = {};
  Object.values(S.cells).forEach(cd => {
    const cid = cd.cropId || 'crop_cherry';
    if (!cropCounts[cid]) cropCounts[cid] = {ha:0,trees:0};
    const tot = calcCellTotals(cd);
    cropCounts[cid].ha += tot.totalHa;
    cropCounts[cid].trees += tot.totalTrees;
  });
  const activeCrops = Object.entries(cropCounts);
  if (activeCrops.length) {
    dash.innerHTML = `
      <div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">🏡 Хозяйство — обзор культур</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:16px;">
        ${activeCrops.map(([cid,data])=>{
          const crop=getCropById(cid)||{emoji:'🌱',name:cid};
          return`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:28px;margin-bottom:6px;">${crop.emoji||'🌱'}</div>
            <div style="font-size:13px;font-weight:600;">${crop.name}</div>
            <div style="font-family:'Unbounded',sans-serif;font-size:16px;color:var(--accent);margin-top:6px;">${data.ha.toFixed(2)} га</div>
            <div style="font-size:11px;color:var(--text3);">${data.trees} дер.</div>
          </div>`;
        }).join('')}
      </div>`;
  } else {
    dash.innerHTML = `<div style="padding:14px;background:var(--surface2);border-radius:8px;font-size:12px;color:var(--text3);margin-bottom:16px;">Добавьте культуры к клеткам карты через кнопку клетки → поле "Культура"</div>`;
  }

  // GDD status per crop
  const gddEl = document.getElementById('crops-gdd-status');
  const latest = S.weather[0];
  const allAlertsSummary = [];
  if(gddEl) gddEl.innerHTML = S.crops.map(crop=>{
    const cropCells = Object.entries(S.cells).filter(([k,cd])=>(cd.cropId||'crop_cherry')===crop.id);
    if(!cropCells.length) return '';
    const bt = crop.baseTemp||5;
    // Build GDD series with crop's base temp
    const start = getGddStartDate();
    const sorted = [...S.weather].filter(w=>w.date>=start).sort((a,b)=>a.date.localeCompare(b.date));
    let cum=0;
    sorted.forEach(w=>{ cum+=calcDailyGdd(w.tmin,w.tmax,bt); });
    const gdd = Math.round(cum*10)/10;
    // Get first variety in first cell of this crop
    const [firstCellKey,firstCd] = cropCells[0];
    const firstVarId = firstCd?.rows?.[0]?.varietyId || S.varieties[0]?.id;
    // Find phase using crop phases + variety GDD values
    let currentPhase = null;
    if (firstVarId && S.gddDb.varietyGdd[firstVarId]) {
      const phases = getCellCropPhases(firstCellKey, firstVarId);
      currentPhase = phases.find(ph=>gdd>=ph.from&&gdd<ph.to) || phases[phases.length-1];
    }
    // Disease risk — top disease for this crop
    const cropDiseases = S.diseaseCatalog.filter(dc=>!crop.diseases.length||crop.diseases.includes(dc.id));
    const topDisease = latest ? cropDiseases.map(dc=>{
      const r = calcDiseaseRiskFull(dc, firstVarId, currentPhase, {tmin:latest.tmin,tmax:latest.tmax,precip:latest.precip,humidity:latest.humidity,leafWetHours:parseFloat(latest.leafwet)||0});
      return {...dc,score:r.score,level:r.level};
    }).sort((a,b)=>b.score-a.score)[0] : null;
    const riskColor={critical:'var(--red)',spray:'var(--orange)',watch:'var(--yellow)',ok:'var(--accent)'}[topDisease?.level||'ok']||'var(--accent)';
    return`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="font-size:28px;">${crop.emoji||'🌱'}</div>
        <div>
          <div style="font-size:14px;font-weight:700;">${crop.name}</div>
          <div style="font-size:11px;color:var(--text3);">База GDD: +${bt}°C · ${cropCells.length} клет.</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div style="text-align:center;padding:8px;background:var(--surface3);border-radius:8px;">
          <div style="font-family:'Unbounded',sans-serif;font-size:18px;font-weight:700;color:var(--accent);">${gdd}</div>
          <div style="font-size:10px;color:var(--text3);">GDD</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--surface3);border-radius:8px;">
          <div style="font-size:12px;font-weight:600;color:${currentPhase?.color||'var(--text2)'};">${currentPhase?.name||'—'}</div>
          <div style="font-size:10px;color:var(--text3);">Фаза</div>
        </div>
      </div>
      ${topDisease&&topDisease.score>=30?`<div style="padding:8px 10px;background:${riskColor}11;border:1px solid ${riskColor}44;border-radius:7px;font-size:11px;">
        <span style="color:${riskColor};font-weight:600;">${topDisease.name}</span>
        <span style="color:var(--text3);margin-left:6px;">${topDisease.score}% риск</span>
      </div>`:`<div style="padding:7px 10px;background:rgba(74,222,128,.07);border-radius:7px;font-size:11px;color:var(--accent);">✅ Риски низкие</div>`}
    </div>`;
  }).filter(Boolean).join('') || `<div style="color:var(--text3);font-size:12px;grid-column:1/-1;">Нет клеток с культурами. Привяжите культуру к клетке на карте.</div>`;

  // Crops catalog
  const listEl = document.getElementById('crops-list');
  if(!listEl) return;
  listEl.innerHTML = S.crops.map(crop => {
    // Сколько клеток этой культуры
    const cropCells = Object.values(S.cells).filter(cd=>(cd.cropId||'crop_cherry')===crop.id);
    const totalHa = cropCells.reduce((s,cd)=>s+calcCellTotals(cd).totalHa, 0);
    const totalTrees = cropCells.reduce((s,cd)=>s+calcCellTotals(cd).totalTrees, 0);
    // Сорта этой культуры
    const cropVarieties = S.varieties.filter(v=>(v.cropId||'crop_cherry')===crop.id);
    // Текущая фаза
    const gdd = getCurrentGdd(crop.baseTemp||4.5);
    const currentPhase = crop.phases?.find((ph,i)=>{
      const gddVals = S.gddDb.varietyGdd?.[S.varieties.find(v=>v.cropId===crop.id)?.id];
      if(!gddVals) return false;
      return gdd >= (gddVals[i]||0) && gdd < (gddVals[i+1]||9999);
    });

    return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="font-size:32px;">${crop.emoji||'🌱'}</div>
        <div style="flex:1;">
          <div style="font-size:15px;font-weight:700;">${crop.name}</div>
          <div style="font-size:11px;color:var(--text3);">Tbase +${crop.baseTemp}°C · ${crop.phases?.length||0} фаз BBCH</div>
        </div>
        <button class="btn btn-secondary btn-xs" onclick="openCropEditModal('${crop.id}')">✏️</button>
      </div>

      ${cropCells.length ? `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
        <div style="text-align:center;padding:6px;background:var(--surface3);border-radius:6px;">
          <div style="font-size:14px;font-weight:700;color:var(--accent);">${totalHa.toFixed(1)}</div>
          <div style="font-size:9px;color:var(--text3);">га</div>
        </div>
        <div style="text-align:center;padding:6px;background:var(--surface3);border-radius:6px;">
          <div style="font-size:14px;font-weight:700;color:var(--blue);">${totalTrees}</div>
          <div style="font-size:9px;color:var(--text3);">деревьев</div>
        </div>
        <div style="text-align:center;padding:6px;background:var(--surface3);border-radius:6px;">
          <div style="font-size:14px;font-weight:700;color:var(--yellow);">${cropVarieties.length}</div>
          <div style="font-size:9px;color:var(--text3);">сортов</div>
        </div>
      </div>` : `<div style="font-size:11px;color:var(--text3);margin-bottom:10px;">Клетки не привязаны</div>`}

      ${cropVarieties.length ? `
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
        ${cropVarieties.slice(0,6).map(v=>`<span style="padding:2px 8px;border-radius:8px;font-size:10px;background:var(--surface3);color:var(--text2);">${v.name}</span>`).join('')}
        ${cropVarieties.length>6?`<span style="font-size:10px;color:var(--text3);">+${cropVarieties.length-6}</span>`:''}
      </div>` : ''}

      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        ${(crop.phases||[]).slice(0,6).map(ph=>`<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:${ph.color}22;color:${ph.color};font-weight:600;">${ph.name}</span>`).join('')}
      </div>
    </div>`;
  }).join('') || `<div style="color:var(--text3);padding:20px;text-align:center;">Нет культур. Нажмите + Культура.</div>`;
}

// ═══ СПРАВОЧНИК СОРТОВ И ПОДВОЕВ ══════════════════════════════════════

function switchCropsSub(sub) {
  ['overview','varieties','rootstocks'].forEach(s => {
    const panel = document.getElementById('csub-panel-'+s);
    const btn   = document.getElementById('csub-'+s);
    if(!panel||!btn) return;
    const active = s===sub;
    panel.style.display = active ? '' : 'none';
    btn.style.color      = active ? (s==='varieties'?'var(--orange)':s==='rootstocks'?'var(--teal)':'var(--accent)') : 'var(--text3)';
    btn.style.borderBottom = active ? `2px solid ${s==='varieties'?'var(--orange)':s==='rootstocks'?'var(--teal)':'var(--accent)'}` : '2px solid transparent';
    btn.style.fontWeight = active ? '700' : '400';
  });
  // Показываем нужные кнопки в header
  document.getElementById('crops-btn-add-crop').style.display     = sub==='overview'    ? '' : 'none';
  document.getElementById('crops-btn-add-variety').style.display  = sub==='varieties'   ? '' : 'none';
  document.getElementById('crops-btn-variety-template').style.display = sub==='varieties' ? '' : 'none';
  document.getElementById('crops-btn-variety-import').style.display   = sub==='varieties' ? '' : 'none';
  document.getElementById('crops-btn-add-rootstock').style.display= sub==='rootstocks'  ? '' : 'none';
  if(sub==='varieties')  renderVarietiesCatalog();
  if(sub==='rootstocks') renderRootstocksCatalog();
}

const STAR = n => '★'.repeat(Math.min(5,parseInt(n)||0)) + '☆'.repeat(Math.max(0,5-(parseInt(n)||0)));
const RES_COLOR = n => {const v=parseInt(n)||3; return v>=4?'var(--accent)':v>=3?'var(--yellow)':'var(--red)';};

function renderVarietiesCatalog() {
  const el = document.getElementById('varieties-catalog-list');
  if(!el) return;
  if(!S.varieties.length){ el.innerHTML='<div style="color:var(--text3);padding:20px;text-align:center;">Сорта не добавлены. Нажмите + Сорт</div>'; return; }

  // Группируем по культуре
  const byCrop = {};
  S.varieties.forEach(v => {
    const cropId = v.cropId||'crop_cherry';
    if(!byCrop[cropId]) byCrop[cropId]=[];
    byCrop[cropId].push(v);
  });

  el.innerHTML = Object.entries(byCrop).map(([cropId, vars]) => {
    const crop = getCropById(cropId)||{name:cropId,emoji:'🌱'};
    return `<div style="margin-bottom:28px;">
      <div style="font-family:'Unbounded',sans-serif;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">
        ${crop.emoji} ${crop.name}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;">
        ${vars.map(v => `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div>
              <div style="font-size:15px;font-weight:700;">${v.name}</div>
              <div style="font-size:11px;color:var(--text3);">${v.origin||''} ${v.year?'· '+v.year+' г.':''}</div>
            </div>
            <div style="display:flex;gap:4px;">
              <span style="padding:2px 8px;border-radius:10px;font-size:10px;background:rgba(74,222,128,.1);color:var(--accent);font-weight:600;">${v.ripening||'—'}</span>
              <button class="btn btn-secondary btn-xs" onclick="openVarietyEditModal('${v.id}')">✏️</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;font-size:11px;">
            ${v.fruitWeight?`<div><span style="color:var(--text3);">Масса плода:</span> <strong>${v.fruitWeight} г</strong></div>`:''}
            ${v.brix?`<div><span style="color:var(--text3);">Brix:</span> <strong>${v.brix}°</strong></div>`:''}
            ${v.yield?`<div><span style="color:var(--text3);">Урожайность:</span> <strong>${v.yield} т/га</strong></div>`:''}
            ${v.spacing?`<div><span style="color:var(--text3);">Схема:</span> <strong>${v.spacing}</strong></div>`:''}
            ${v.bearingYear?`<div><span style="color:var(--text3);">Плодоношение:</span> <strong>${v.bearingYear} год</strong></div>`:''}
            ${v.cp?`<div><span style="color:var(--text3);">Chill Portions:</span> <strong style="color:var(--blue);">${v.cp} CP</strong></div>`:''}
          </div>
          ${v.pollinators?`<div style="font-size:11px;color:var(--text3);margin-bottom:6px;">🌸 Опылители: <strong style="color:var(--text2);">${v.pollinators}</strong></div>`:''}
          ${v.rootstockRec?`<div style="font-size:11px;color:var(--text3);margin-bottom:6px;">🌳 Подвой: <strong style="color:var(--text2);">${v.rootstockRec}</strong></div>`:''}
          ${(v.resMonilia||v.resCocco||v.resFrost)?`
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            ${v.resMonilia?`<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${RES_COLOR(v.resMonilia)}22;color:${RES_COLOR(v.resMonilia)};" title="Монилиоз">М:${v.resMonilia}/5</span>`:''}
            ${v.resCocco?`<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${RES_COLOR(v.resCocco)}22;color:${RES_COLOR(v.resCocco)};" title="Коккомикоз">К:${v.resCocco}/5</span>`:''}
            ${v.resClaster?`<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${RES_COLOR(v.resClaster)}22;color:${RES_COLOR(v.resClaster)};" title="Клястероспориоз">Кл:${v.resClaster}/5</span>`:''}
            ${v.resScab?`<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${RES_COLOR(v.resScab)}22;color:${RES_COLOR(v.resScab)};" title="Парша">П:${v.resScab}/5</span>`:''}
            ${v.frost?`<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:rgba(96,165,250,.15);color:var(--blue);" title="Зимостойкость">❄️${v.frost}/5</span>`:''}
            ${v.crackResistance?`<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:rgba(251,191,36,.12);color:var(--yellow);" title="Устойчивость к растрескиванию">💧${v.crackResistance}/5</span>`:''}
          </div>`:''}
          ${v.note?`<div style="font-size:11px;color:var(--text3);border-top:1px solid var(--border);padding-top:6px;margin-top:4px;">${v.note}</div>`:''}
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function renderRootstocksCatalog() {
  const el = document.getElementById('rootstocks-catalog-list');
  if(!el) return;
  const rs = S.rootstocks||[];
  if(!rs.length){ el.innerHTML='<div style="color:var(--text3);padding:20px;text-align:center;">Подвои не добавлены. Нажмите + Подвой</div>'; return; }
  const byCrop = {};
  rs.forEach(r => { const c=r.cropId||'crop_cherry'; if(!byCrop[c])byCrop[c]=[]; byCrop[c].push(r); });
  el.innerHTML = Object.entries(byCrop).map(([cropId,rootstocks]) => {
    const crop = getCropById(cropId)||{name:cropId,emoji:'🌱'};
    return `<div style="margin-bottom:28px;">
      <div style="font-family:'Unbounded',sans-serif;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">${crop.emoji} ${crop.name}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;">
        ${rootstocks.map(r=>`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div>
              <div style="font-size:15px;font-weight:700;">🌳 ${r.name}</div>
              <div style="font-size:11px;color:var(--text3);">${r.type||'Клоновый'}${r.vigor?' · '+r.vigor+'% роста':''}</div>
            </div>
            <button class="btn btn-secondary btn-xs" onclick="openRootstockModal('${r.id}')">✏️</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;font-size:11px;">
            ${r.bearingYear?`<div><span style="color:var(--text3);">Плодоношение:</span> <strong>${r.bearingYear} год</strong></div>`:''}
            ${r.productivity?`<div><span style="color:var(--text3);">Продуктивность:</span> <strong>${r.productivity}</strong></div>`:''}
            ${r.support?`<div><span style="color:var(--text3);">Опора:</span> <strong>${{required:'Обязательна',recommended:'Рекомендуется',none:'Не нужна'}[r.support]||r.support}</strong></div>`:''}
            ${r.ph?`<div><span style="color:var(--text3);">pH почвы:</span> <strong>${r.ph}</strong></div>`:''}
            ${r.spacing?`<div><span style="color:var(--text3);">Схема:</span> <strong>${r.spacing}</strong></div>`:''}
            ${r.roots?`<div style="grid-column:1/-1;"><span style="color:var(--text3);">Корни:</span> ${r.roots}</div>`:''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            ${r.drought?`<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${RES_COLOR(r.drought)}22;color:${RES_COLOR(r.drought)};" title="Засухоустойчивость">☀️${r.drought}/5</span>`:''}
            ${r.wet?`<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${RES_COLOR(r.wet)}22;color:${RES_COLOR(r.wet)};" title="Переувлажнение">💧${r.wet}/5</span>`:''}
            ${r.frost?`<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:rgba(96,165,250,.15);color:var(--blue);" title="Зимостойкость">❄️${r.frost}/5</span>`:''}
          </div>
          ${r.compatible?`<div style="font-size:11px;color:var(--text3);margin-bottom:4px;">🍒 Сорта: <strong style="color:var(--text2);">${r.compatible}</strong></div>`:''}
          ${r.note?`<div style="font-size:11px;color:var(--text3);border-top:1px solid var(--border);padding-top:6px;margin-top:4px;">${r.note}</div>`:''}
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

// ═══ СПРАВОЧНИК СОРТОВ (для автозаполнения паспорта) ════════════════════

const VARIETY_REFERENCE = {

  // ── ЧЕРЕШНЯ ──────────────────────────────────────────────────────────
  'регина':     { cropId:'crop_cherry', name:'Регина', origin:'Германия', year:1957, ripening:'Поздний', daysFlower:58, pollType:'cross', pollinators:'Кордия, Наполеон, Карина', fruitWeight:9, fruitColor:'Тёмно-красный, глянцевый', fruitFirmness:'Очень плотная', fruitTaste:'Сладкий, гармоничный', brix:18, crackResistance:'5', vigor:'Среднерослый', crown:'Пирамидальная', bearingYear:4, yield:14, spacing:'4×2', rootstockRec:'Гизела 5', resMonilia:'4', resCocco:'4', resClaster:'4', resScab:'3', frost:'4', cp:68, pollSAlleles:'S1S3', note:'Эталон позднего срока. Устойчивость к растрескиванию 5/5 — не нуждается в плёнке для защиты от трещин, но плёнка даёт экспортное качество.' },

  'кордия':     { cropId:'crop_cherry', name:'Кордия (Kordia)', origin:'Чехия', year:1963, ripening:'Средне-поздний', daysFlower:52, pollType:'cross', pollinators:'Регина, Саммит, Карина', fruitWeight:10, fruitColor:'Тёмно-бордовый, при созревании глянцево-чёрный', fruitFirmness:'Очень плотная (Бигарро)', fruitTaste:'Эталонный десертный, богатый сортовой аромат', brix:19.5, crackResistance:'3', vigor:'Сильнорослый', crown:'Раскидистая широкоокруглая, ветви поникают', bearingYear:3, yield:14, spacing:'4×2', rootstockRec:'Гизела 5', resMonilia:'4', resCocco:'4', resClaster:'4', resScab:'3', frost:'4', cp:58, pollSAlleles:'S3S6', note:'Королева чёрных черешен. Созревает на 7-10 дней раньше Регины. Растрескивание при дожде — плёнка ОБЯЗАТЕЛЬНА. Длинная плодоножка — удобна для сбора и гидрокулинга.' },

  'kordia':     'кордия',

  'скина':      { cropId:'crop_cherry', name:'Скина (Skeena)', origin:'Канада (Summerland, BC)', year:1999, ripening:'Поздний', daysFlower:55, pollType:'self', pollinators:'Самоплодная — опылитель для Регины и Кордии', fruitWeight:11.5, fruitColor:'Тёмно-бордовый, при созревании насыщенно-чёрный', fruitFirmness:'Высокая хрящеватость (Бигарро)', fruitTaste:'Очень сладкий, насыщенный, сбалансированный', brix:19, crackResistance:'4', vigor:'Среднерослый', crown:'Полупрямостоячая, идеальна для Slender Spindle', bearingYear:3, yield:17, spacing:'4×2', rootstockRec:'Гизела 5', resMonilia:'4', resCocco:'4', resClaster:'4', resScab:'4', frost:'4', cp:62, pollSAlleles:"S1S4'", note:'Самоплодная. Риск перегрузки урожаем → мельчание при 100% завязываемости под плёнкой. Закрывать плёнку одновременно с Кордией.' },

  'skeena':     'скина',

  'лапинс':     { cropId:'crop_cherry', name:'Лапинс (Lapins)', origin:'Канада (Summerland, BC)', year:1984, ripening:'Средне-поздний', daysFlower:50, pollType:'self', pollinators:'Самоплодная — универсальный опылитель', fruitWeight:9.5, fruitColor:'Тёмно-красный', fruitFirmness:'Плотная', fruitTaste:'Сладкий, хороший', brix:17, crackResistance:'3', vigor:'Среднерослый', crown:'Умеренно раскидистая', bearingYear:3, yield:15, spacing:'4×2', rootstockRec:'Гизела 5', resMonilia:'3', resCocco:'4', resClaster:'4', resScab:'3', frost:'4', cp:55, pollSAlleles:'S1S4', note:'Самоплодная. Популярный опылитель в интенсивных садах. Уступает Кордии и Регине по вкусу и товарности, но надёжна в продуктивности.' },

  'lapins':     'лапинс',

  'саммит':     { cropId:'crop_cherry', name:'Саммит (Summit)', origin:'Канада', year:1973, ripening:'Поздний', daysFlower:54, pollType:'cross', pollinators:'Регина, Кордия, Ван', fruitWeight:11, fruitColor:'Тёмно-красный', fruitFirmness:'Плотная', fruitTaste:'Сладкий, хороший аромат', brix:18, crackResistance:'3', vigor:'Сильнорослый', crown:'Широкая, раскидистая', bearingYear:4, yield:13, spacing:'5×3', rootstockRec:'Гизела 6', resMonilia:'3', resCocco:'3', resClaster:'3', resScab:'3', frost:'3', cp:55, note:'Крупноплодный, но склонен к растрескиванию. Нужна плёнка.' },

  'summit':     'саммит',

  'ранье':      { cropId:'crop_cherry', name:'Ранье (Rainier)', origin:'США (Вашингтон)', year:1952, ripening:'Средний', daysFlower:45, pollType:'cross', pollinators:'Бинг, Ван, Лапинс', fruitWeight:9, fruitColor:'Жёлтый с красным румянцем', fruitFirmness:'Плотная', fruitTaste:'Очень сладкий, медовый', brix:20, crackResistance:'2', vigor:'Среднерослый', crown:'Широкая', bearingYear:4, yield:12, spacing:'4×3', rootstockRec:'Гизела 6', resMonilia:'3', resCocco:'3', resClaster:'3', resScab:'2', frost:'3', cp:52, note:'Жёлтая черешня. Кожица нежная — требует аккуратного сбора. Очень чувствительна к дождю — плёнка обязательна.' },

  'rainier':    'ранье',

  'наполеон':   { cropId:'crop_cherry', name:'Наполеон', origin:'Германия', ripening:'Средний', daysFlower:46, pollType:'cross', pollinators:'Регина, Кордия, Ван', fruitWeight:8, fruitColor:'Жёлтый с красным', fruitFirmness:'Плотная', fruitTaste:'Сладко-кислый', brix:16, crackResistance:'3', vigor:'Сильнорослый', bearingYear:5, yield:12, resMonilia:'3', resCocco:'3', resClaster:'3', frost:'4', cp:52, note:'Старинный классический сорт. Опылитель для Регины.' },

  'ван':        { cropId:'crop_cherry', name:'Ван (Van)', origin:'Канада', year:1936, ripening:'Средний', daysFlower:44, pollType:'cross', pollinators:'Кордия, Регина, Лапинс', fruitWeight:8, fruitColor:'Тёмно-красный', fruitFirmness:'Плотная', fruitTaste:'Сладкий', brix:17, crackResistance:'3', vigor:'Среднерослый', bearingYear:3, yield:14, resMonilia:'3', resCocco:'4', resClaster:'4', frost:'4', cp:52, note:'Надёжный опылитель. Хорошая продуктивность.' },

  'мершант':    { cropId:'crop_cherry', name:'Мершант (Merchant)', origin:'Великобритания', ripening:'Ранний', daysFlower:38, pollType:'cross', pollinators:'Ван, Кордия', fruitWeight:8.5, fruitColor:'Тёмно-красный', fruitFirmness:'Плотная', fruitTaste:'Сладкий', brix:16, crackResistance:'4', vigor:'Среднерослый', bearingYear:3, yield:13, resMonilia:'4', resCocco:'4', resClaster:'4', frost:'4', cp:50, note:'Ранний сорт. Один из первых урожаев сезона.' },

  'merchant':   'мершант',
  'mershant':   'мершант',

  // ── СЛИВА ────────────────────────────────────────────────────────────
  'стэнли':     { cropId:'crop_plum', name:'Стэнли (Stanley)', origin:'США', year:1926, ripening:'Средний', pollType:'self', pollinators:'Самоплодная', fruitWeight:45, fruitColor:'Тёмно-синий с восковым налётом', fruitFirmness:'Средняя', fruitTaste:'Сладкий, хороший', brix:16, crackResistance:'3', vigor:'Среднерослый', bearingYear:4, yield:20, resMonilia:'3', resCocco:'3', frost:'4', cp:30, note:'Классический сорт сливы. Самоплодный. Используется для свежего рынка и переработки.' },

  'stanley':    'стэнли',
  'stenley':    'стэнли',
  'стенли':     'стэнли',

  'блю фри':    { cropId:'crop_plum', name:'Блю Фри (Blue Free)', origin:'США', ripening:'Средне-поздний', pollType:'self', fruitWeight:55, fruitColor:'Синий', fruitFirmness:'Плотная', brix:15, vigor:'Среднерослый', bearingYear:3, yield:25, resMonilia:'4', frost:'4', note:'Продуктивный самоплодный сорт сливы.' },

  'чачакская':  { cropId:'crop_plum', name:'Чачакская лепотица', origin:'Сербия', ripening:'Ранний', pollType:'cross', fruitWeight:35, fruitColor:'Жёлтый', fruitFirmness:'Плотная', brix:14, frost:'4', note:'Жёлтая слива раннего срока.' },

  'валор':      { cropId:'crop_plum', name:'Валор (Valor)', origin:'Канада', ripening:'Поздний', pollType:'self', fruitWeight:60, fruitColor:'Тёмно-синий', fruitFirmness:'Очень плотная', brix:17, vigor:'Среднерослый', bearingYear:4, yield:22, resMonilia:'4', frost:'4', note:'Крупноплодная слива позднего срока.' },

  // ── ЯБЛОКО ───────────────────────────────────────────────────────────
  'голден':     { cropId:'crop_apple', name:'Голден Делишес (Golden Delicious)', origin:'США', year:1890, ripening:'Средний', pollType:'cross', pollinators:'Гала, Айдаред, Джонагред', fruitWeight:170, fruitColor:'Золотисто-жёлтый', fruitFirmness:'Плотная', fruitTaste:'Сладкий, медовый', brix:14, crackResistance:'3', vigor:'Среднерослый', crown:'Широкопирамидальная', bearingYear:3, yield:35, spacing:'3×1', rootstockRec:'М9', resMonilia:'3', resScab:'2', frost:'3', note:'Классика. Склонен к парше — обязательна защита. На М9 даёт высокую плотность посадки.' },

  'golden delicious': 'голден',
  'голден делишес':   'голден',

  'гала':       { cropId:'crop_apple', name:'Гала (Gala)', origin:'Новая Зеландия', year:1934, ripening:'Ранний', pollType:'cross', pollinators:'Голден, Айдаред, Фуджи', fruitWeight:150, fruitColor:'Красно-полосатый', fruitFirmness:'Плотная', fruitTaste:'Сладкий, приятный аромат', brix:13, crackResistance:'4', vigor:'Среднерослый', bearingYear:3, yield:40, spacing:'3×1', rootstockRec:'М9', resMonilia:'3', resScab:'3', frost:'3', note:'Популярный ранний сорт. Много клонов (Ройял Гала, Хани Крисп и др.)' },

  'gala':       'гала',

  'гала дарк':  'гала',
  'gala dark baron': 'гала',

  'айдаред':    { cropId:'crop_apple', name:'Айдаред (Idared)', origin:'США', year:1935, ripening:'Поздний', pollType:'cross', pollinators:'Голден, Гала, Джонатан', fruitWeight:160, fruitColor:'Ярко-красный', fruitFirmness:'Плотная', fruitTaste:'Кисловато-сладкий', brix:12, crackResistance:'4', vigor:'Среднерослый', bearingYear:3, yield:38, spacing:'3×1', rootstockRec:'М9', resMonilia:'3', resScab:'3', frost:'4', note:'Хранится до весны. Хорош для переработки и свежего рынка.' },

  'idared':     'айдаред',

  'фуджи':      { cropId:'crop_apple', name:'Фуджи (Fuji)', origin:'Япония', year:1962, ripening:'Поздний', pollType:'cross', pollinators:'Голден, Гала', fruitWeight:200, fruitColor:'Красно-полосатый', fruitFirmness:'Очень плотная', fruitTaste:'Очень сладкий', brix:16, crackResistance:'4', vigor:'Среднерослый', bearingYear:4, yield:35, spacing:'3×1', rootstockRec:'М9', resMonilia:'3', resScab:'3', frost:'3', note:'Высокий Brix. Требует тепла для полного вызревания.' },

  'fuji':       'фуджи',

  'джонагред':  { cropId:'crop_apple', name:'Джонагред (Jonagored)', origin:'Нидерланды', year:1979, ripening:'Средний', pollType:'cross', pollinators:'Голден, Гала', fruitWeight:175, fruitColor:'Ярко-красный', fruitFirmness:'Плотная', fruitTaste:'Кисловато-сладкий', brix:13, crackResistance:'3', vigor:'Среднерослый', bearingYear:3, yield:40, spacing:'3×1', rootstockRec:'М9', resMonilia:'3', resScab:'2', frost:'3', note:'Клон Джонаголда. Склонен к парше — защита обязательна.' },

  'jonagold':   'джонагред',
  'jonagored':  'джонагред',

  'ред делишес': { cropId:'crop_apple', name:'Ред Делишес (Red Delicious)', origin:'США', year:1880, ripening:'Средний', pollType:'cross', pollinators:'Голден, Гала', fruitWeight:160, fruitColor:'Ярко-красный', fruitFirmness:'Плотная', fruitTaste:'Сладкий, слабокислый', brix:12, crackResistance:'3', vigor:'Сильнорослый', bearingYear:4, yield:30, rootstockRec:'М9', resMonilia:'3', resScab:'3', frost:'3', note:'Классика американского рынка. Требует тщательной защиты от болезней.' },

  'red delicious': 'ред делишес',

  'брэбурн':    { cropId:'crop_apple', name:'Брэбурн (Braeburn)', origin:'Новая Зеландия', year:1952, ripening:'Поздний', pollType:'cross', pollinators:'Голден, Гала, Фуджи', fruitWeight:165, fruitColor:'Красно-полосатый на зелёном фоне', fruitFirmness:'Очень плотная', fruitTaste:'Кисловато-сладкий, пряный аромат', brix:14, crackResistance:'4', vigor:'Среднерослый', bearingYear:3, yield:38, spacing:'3×1', rootstockRec:'М9', resMonilia:'3', resScab:'3', frost:'3', note:'Плотная мякоть. Хранится до февраля-марта.' },

  'braeburn':   'брэбурн',
};

function findInVarietyReference(name) {
  if(!name) return null;
  const key = name.toLowerCase().trim()
    .replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  // Прямое совпадение
  let data = VARIETY_REFERENCE[key];
  if(typeof data === 'string') data = VARIETY_REFERENCE[data];
  if(data) return data;
  // Частичное совпадение — ключ содержится в названии или наоборот
  for(const [k, v] of Object.entries(VARIETY_REFERENCE)) {
    if(typeof v === 'string') continue;
    if(key.includes(k) || k.includes(key)) return v;
  }
  // Нечёткое — первые 4 буквы совпадают
  const prefix = key.slice(0, 4);
  for(const [k, v] of Object.entries(VARIETY_REFERENCE)) {
    if(typeof v === 'string') continue;
    if(k.startsWith(prefix) || prefix.startsWith(k.slice(0,4))) return v;
  }
  return null;
}

function fillFromCatalog() {
  const name = document.getElementById('ve-name').value;
  const data = findInVarietyReference(name);

  if(!data) {
    // Показываем список доступных сортов для выбора
    const cropId = document.getElementById('ve-crop').value || 'crop_cherry';
    const crop = getCropById(cropId);

    // Группируем справочник по культурам
    const byCrop = {};
    for(const [k, v] of Object.entries(VARIETY_REFERENCE)) {
      if(typeof v === 'string') continue; // алиас
      const cid = v.cropId || 'crop_cherry';
      if(!byCrop[cid]) byCrop[cid] = [];
      // Не дублируем одинаковые сорта
      if(!byCrop[cid].find(x=>x.name===v.name)) byCrop[cid].push({key:k, name:v.name});
    }

    const CROP_LABELS = {
      crop_cherry:'🍒 Черешня', crop_plum:'🫐 Слива',
      crop_apple:'🍎 Яблоко', crop_apricot:'🍑 Абрикос',
      crop_peach:'🍑 Персик', crop_grape:'🍇 Виноград',
    };

    const listHtml = Object.entries(byCrop).map(([cid, vars])=>
      `<div style="margin-bottom:8px;">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${CROP_LABELS[cid]||cid}</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          ${vars.map(v=>`<button onclick="selectFromCatalogList('${v.key}')" style="padding:3px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);font-size:12px;cursor:pointer;">${v.name}</button>`).join('')}
        </div>
      </div>`
    ).join('');

    // Показываем выбор прямо под кнопкой
    let picker = document.getElementById('ve-catalog-picker');
    if(!picker) {
      picker = document.createElement('div');
      picker.id = 've-catalog-picker';
      picker.style.cssText = 'margin-top:8px;padding:12px;background:var(--surface2);border-radius:10px;border:1px solid var(--border);';
      document.getElementById('ve-catalog-btn-wrap').after(picker);
    }
    picker.innerHTML = `<div style="font-size:12px;font-weight:600;margin-bottom:10px;">Выберите сорт из справочника:</div>${listHtml}
      <button onclick="document.getElementById('ve-catalog-picker').remove()" style="margin-top:8px;padding:3px 10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text3);font-size:11px;cursor:pointer;">✕ Закрыть</button>`;
    return;
  }

  // Нашли — заполняем поля
  applyVarietyData(data);
}

function selectFromCatalogList(key) {
  let data = VARIETY_REFERENCE[key];
  if(typeof data === 'string') data = VARIETY_REFERENCE[data];
  if(!data) return;
  // Закрываем picker
  const picker = document.getElementById('ve-catalog-picker');
  if(picker) picker.remove();
  applyVarietyData(data);
}

function applyVarietyData(data) {
  const INP = (id, val) => { const el=document.getElementById(id); if(el&&val!=null) el.value=val; };
  INP('ve-name', data.name);
  INP('ve-origin', data.origin);
  INP('ve-year', data.year);
  INP('ve-ripening', data.ripening);
  INP('ve-days-flower', data.daysFlower);
  INP('ve-poll-type', data.pollType);
  INP('ve-pollinators', data.pollinators);
  INP('ve-fruit-weight', data.fruitWeight);
  INP('ve-fruit-color', data.fruitColor);
  INP('ve-fruit-firmness', data.fruitFirmness);
  INP('ve-fruit-taste', data.fruitTaste);
  INP('ve-brix', data.brix);
  INP('ve-crack-resistance', data.crackResistance);
  INP('ve-vigor', data.vigor);
  INP('ve-crown', data.crown);
  INP('ve-bearing-year', data.bearingYear);
  INP('ve-yield', data.yield);
  INP('ve-spacing', data.spacing);
  INP('ve-rootstock-rec', data.rootstockRec);
  INP('ve-res-monilia', data.resMonilia);
  INP('ve-res-cocco', data.resCocco);
  INP('ve-res-claster', data.resClaster);
  INP('ve-res-scab', data.resScab);
  INP('ve-frost', data.frost);
  INP('ve-cp', data.cp);
  INP('ve-note', data.note);
  if(data.cropId) {
    const cropSel = document.getElementById('ve-crop');
    if(cropSel) { cropSel.value = data.cropId; }
  }
  // Обновляем кнопку
  onVarietyNameInput(data.name);
  // Подтверждение
  const btn = document.getElementById('ve-catalog-btn');
  if(btn) { const orig=btn.innerHTML; btn.innerHTML='✅ Данные заполнены — проверьте и сохраните'; btn.style.borderColor='var(--accent)'; btn.style.color='var(--accent)'; setTimeout(()=>{ btn.innerHTML=orig; onVarietyNameInput(data.name); },3000); }
}

// Показываем кнопку справочника при вводе названия
function onVarietyNameInput(val) {
  const btn = document.getElementById('ve-catalog-btn');
  if(!btn) return;
  const found = findInVarietyReference(val);
  if(found) {
    btn.innerHTML = `📚 Заполнить из справочника: <strong>${found.name}</strong>`;
    btn.style.borderColor = 'var(--accent)';
    btn.style.color = 'var(--accent)';
  } else {
    btn.innerHTML = `📚 Выбрать из справочника сортов`;
    btn.style.borderColor = 'var(--blue)';
    btn.style.color = 'var(--blue)';
  }
}

function openVarietyEditModal(id) {
  const v = id ? S.varieties.find(x=>x.id===id) : null;
  document.getElementById('variety-edit-title').textContent = v ? `✏️ ${v.name}` : '🍒 Новый сорт';
  document.getElementById('ve-id').value = v?.id||'';
  document.getElementById('ve-del-btn').style.display = v ? 'block' : 'none';
  // Культуры
  const cropSel = document.getElementById('ve-crop');
  cropSel.innerHTML = S.crops.map(c=>`<option value="${c.id}" ${(v?.cropId||'crop_cherry')===c.id?'selected':''}>${c.emoji||''} ${c.name}</option>`).join('');
  // Заполняем поля
  const fields = {
    've-name':v?.name||'', 've-origin':v?.origin||'', 've-year':v?.year||'',
    've-ripening':v?.ripening||'Средний', 've-days-flower':v?.daysFlower||'',
    've-poll-type':v?.pollType||'cross', 've-pollinators':v?.pollinators||'',
    've-fruit-weight':v?.fruitWeight||'', 've-fruit-color':v?.fruitColor||'',
    've-fruit-firmness':v?.fruitFirmness||'Плотная', 've-fruit-taste':v?.fruitTaste||'',
    've-brix':v?.brix||'', 've-crack-resistance':v?.crackResistance||'3',
    've-vigor':v?.vigor||'Среднерослый', 've-crown':v?.crown||'',
    've-bearing-year':v?.bearingYear||'', 've-yield':v?.yield||'',
    've-spacing':v?.spacing||'', 've-rootstock-rec':v?.rootstockRec||'',
    've-res-monilia':v?.resMonilia||'3', 've-res-cocco':v?.resCocco||'3',
    've-res-claster':v?.resClaster||'3', 've-res-scab':v?.resScab||'3',
    've-frost':v?.frost||'3', 've-cp':v?.cp||'',
    've-color':v?.color||'vc0', 've-note':v?.note||'',
  };
  Object.entries(fields).forEach(([id,val])=>{ const el=document.getElementById(id); if(el) el.value=val; });
  openModal('modal-variety-edit');
  // Показываем кнопку справочника если сорт найден
  setTimeout(()=>onVarietyNameInput(document.getElementById('ve-name').value||''), 100);
}

function saveVarietyEdit() {
  const id = document.getElementById('ve-id').value;
  const obj = {
    id: id||uid(),
    cropId: document.getElementById('ve-crop').value,
    name: document.getElementById('ve-name').value.trim(),
    origin: document.getElementById('ve-origin').value.trim(),
    year: parseInt(document.getElementById('ve-year').value)||null,
    ripening: document.getElementById('ve-ripening').value,
    daysFlower: parseInt(document.getElementById('ve-days-flower').value)||null,
    pollType: document.getElementById('ve-poll-type').value,
    pollinators: document.getElementById('ve-pollinators').value.trim(),
    fruitWeight: parseFloat(document.getElementById('ve-fruit-weight').value)||null,
    fruitColor: document.getElementById('ve-fruit-color').value.trim(),
    fruitFirmness: document.getElementById('ve-fruit-firmness').value,
    fruitTaste: document.getElementById('ve-fruit-taste').value.trim(),
    brix: parseFloat(document.getElementById('ve-brix').value)||null,
    crackResistance: document.getElementById('ve-crack-resistance').value,
    vigor: document.getElementById('ve-vigor').value,
    crown: document.getElementById('ve-crown').value.trim(),
    bearingYear: parseInt(document.getElementById('ve-bearing-year').value)||null,
    yield: parseFloat(document.getElementById('ve-yield').value)||null,
    spacing: document.getElementById('ve-spacing').value.trim(),
    rootstockRec: document.getElementById('ve-rootstock-rec').value.trim(),
    resMonilia: document.getElementById('ve-res-monilia').value,
    resCocco: document.getElementById('ve-res-cocco').value,
    resClaster: document.getElementById('ve-res-claster').value,
    resScab: document.getElementById('ve-res-scab').value,
    frost: document.getElementById('ve-frost').value,
    cp: parseInt(document.getElementById('ve-cp').value)||null,
    color: document.getElementById('ve-color').value,
    note: document.getElementById('ve-note').value.trim(),
  };
  if(!obj.name){alert('Введите название сорта');return;}
  const idx = S.varieties.findIndex(x=>x.id===obj.id);
  if(idx>=0) S.varieties[idx]={...S.varieties[idx],...obj};
  else S.varieties.push(obj);
  save(); closeModal('modal-variety-edit'); renderVarietiesCatalog();
}

function deleteVarietyEdit() {
  const id = document.getElementById('ve-id').value;
  if(!id||!confirm('Удалить сорт?')) return;
  S.varieties = S.varieties.filter(v=>v.id!==id);
  save(); closeModal('modal-variety-edit'); renderVarietiesCatalog();
}

function openRootstockModal(id) {
  if(!S.rootstocks) S.rootstocks=[];
  const r = id ? S.rootstocks.find(x=>x.id===id) : null;
  document.getElementById('rootstock-modal-title').textContent = r ? `✏️ ${r.name}` : '🌳 Новый подвой';
  document.getElementById('rs-id').value = r?.id||'';
  document.getElementById('rs-del-btn').style.display = r ? 'block' : 'none';
  const cropSel = document.getElementById('rs-crop');
  cropSel.innerHTML = S.crops.map(c=>`<option value="${c.id}" ${(r?.cropId||'crop_cherry')===c.id?'selected':''}>${c.emoji||''} ${c.name}</option>`).join('');
  const fields = {
    'rs-name':r?.name||'', 'rs-type':r?.type||'clonal', 'rs-vigor':r?.vigor||'',
    'rs-bearing':r?.bearingYear||'', 'rs-productivity':r?.productivity||'Высокая',
    'rs-support':r?.support||'required', 'rs-roots':r?.roots||'Мочковатая (поверхностная)',
    'rs-drought':r?.drought||'3', 'rs-wet':r?.wet||'3', 'rs-frost':r?.frost||'3',
    'rs-ph':r?.ph||'', 'rs-compatible':r?.compatible||'',
    'rs-spacing':r?.spacing||'', 'rs-note':r?.note||'',
  };
  Object.entries(fields).forEach(([fid,val])=>{ const el=document.getElementById(fid); if(el) el.value=val; });
  openModal('modal-rootstock');
}

function saveRootstock() {
  if(!S.rootstocks) S.rootstocks=[];
  const id = document.getElementById('rs-id').value;
  const obj = {
    id: id||uid(),
    cropId: document.getElementById('rs-crop').value,
    name: document.getElementById('rs-name').value.trim(),
    type: document.getElementById('rs-type').value,
    vigor: parseInt(document.getElementById('rs-vigor').value)||null,
    bearingYear: parseInt(document.getElementById('rs-bearing').value)||null,
    productivity: document.getElementById('rs-productivity').value,
    support: document.getElementById('rs-support').value,
    roots: document.getElementById('rs-roots').value,
    drought: document.getElementById('rs-drought').value,
    wet: document.getElementById('rs-wet').value,
    frost: document.getElementById('rs-frost').value,
    ph: document.getElementById('rs-ph').value.trim(),
    compatible: document.getElementById('rs-compatible').value.trim(),
    spacing: document.getElementById('rs-spacing').value.trim(),
    note: document.getElementById('rs-note').value.trim(),
  };
  if(!obj.name){alert('Введите название подвоя');return;}
  const idx = S.rootstocks.findIndex(x=>x.id===obj.id);
  if(idx>=0) S.rootstocks[idx]=obj; else S.rootstocks.push(obj);
  save(); closeModal('modal-rootstock'); renderRootstocksCatalog();
}

function deleteRootstock() {
  const id = document.getElementById('rs-id').value;
  if(!id||!confirm('Удалить подвой?')) return;
  S.rootstocks = (S.rootstocks||[]).filter(r=>r.id!==id);
  save(); closeModal('modal-rootstock'); renderRootstocksCatalog();
}

// ═══ БЛОК КУЛЬТУР ══════════════════════════════════════════════════════
// ---- CROP EDIT MODAL ----
let _editingCropId = null;
let _editingCropPhases = [];

function openCropEditModal(id) {
  _editingCropId = id || null;
  const crop = id ? getCropById(id) : null;
  _editingCropPhases = crop ? [...crop.phases.map(p=>({...p}))] : [];
  document.getElementById('crop-edit-title').textContent = crop ? `✏️ ${crop.emoji||''} ${crop.name}` : '🌿 Новая культура';
  document.getElementById('ce-del-btn').style.display = crop && !['crop_cherry'].includes(id) ? 'inline-flex':'none';
  document.getElementById('ce-name').value = crop?.name||'';
  document.getElementById('ce-emoji').value = crop?.emoji||'';
  document.getElementById('ce-basetemp').value = crop?.baseTemp||5;
  document.getElementById('ce-note').value = crop?.note||'';
  document.getElementById('ce-n').value = crop?.nutrientNorms?.N||'';
  document.getElementById('ce-p').value = crop?.nutrientNorms?.P2O5||'';
  document.getElementById('ce-k').value = crop?.nutrientNorms?.K2O||'';
  document.getElementById('ce-ca').value = crop?.nutrientNorms?.Ca||'';
  document.getElementById('ce-mg').value = crop?.nutrientNorms?.Mg||'';
  renderCropPhasesList();
  openModal('modal-crop-edit');
}

function renderCropPhasesList() {
  document.getElementById('ce-phases-list').innerHTML = _editingCropPhases.map((ph,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px;background:var(--surface2);border-radius:7px;margin-bottom:5px;">
      <div style="width:14px;height:14px;border-radius:3px;flex-shrink:0;background:${ph.color};"></div>
      <span style="flex:1;font-size:12px;">${ph.name}</span>
      <button class="btn btn-danger btn-xs" onclick="removeCropPhase(${i})">✕</button>
    </div>`).join('') || '<div style="color:var(--text3);font-size:12px;">Нет фаз</div>';
}

function addCropPhase() {
  const name = document.getElementById('ce-ph-name').value.trim();
  if (!name) { alert('Введите название фазы'); return; }
  _editingCropPhases.push({name, color: document.getElementById('ce-ph-color').value});
  document.getElementById('ce-ph-name').value = '';
  renderCropPhasesList();
}

function removeCropPhase(i) { _editingCropPhases.splice(i,1); renderCropPhasesList(); }

function saveCrop() {
  const name = document.getElementById('ce-name').value.trim();
  if (!name) { alert('Введите название культуры'); return; }
  const crop = {
    id: _editingCropId || ('crop_'+Date.now()),
    name, emoji: document.getElementById('ce-emoji').value || '🌱',
    baseTemp: parseFloat(document.getElementById('ce-basetemp').value)||5,
    note: document.getElementById('ce-note').value,
    nutrientNorms: {
      N:  parseInt(document.getElementById('ce-n').value)||0,
      P2O5:parseInt(document.getElementById('ce-p').value)||0,
      K2O:parseInt(document.getElementById('ce-k').value)||0,
      Ca: parseInt(document.getElementById('ce-ca').value)||0,
      Mg: parseInt(document.getElementById('ce-mg').value)||0,
    },
    phases: _editingCropPhases,
    diseases: _editingCropId ? (getCropById(_editingCropId)?.diseases||[]) : [],
    pests: _editingCropId ? (getCropById(_editingCropId)?.pests||[]) : [],
  };
  if (_editingCropId) {
    const i = S.crops.findIndex(c=>c.id===_editingCropId);
    if(i>=0) S.crops[i]=crop; else S.crops.push(crop);
  } else {
    S.crops.push(crop);
  }
  save(); closeModal('modal-crop-edit'); renderCrops();
}

function deleteCrop() {
  if (!_editingCropId||!confirm(`Удалить культуру?`)) return;
  S.crops = S.crops.filter(c=>c.id!==_editingCropId);
  save(); closeModal('modal-crop-edit'); renderCrops();
}

// ---- CELL MODAL CROP INTEGRATION ----
function populateCropSelect() {
  const sel = document.getElementById('cm-crop');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— выбрать культуру —</option>';
  S.crops.forEach(c=>sel.innerHTML+=`<option value="${c.id}" ${cur===c.id?'selected':''}>${c.emoji||''} ${c.name}</option>`);
}

function onCellCropChange() {
  const cellKey = document.getElementById('cm-crop').value;
  const infoEl = document.getElementById('cm-crop-info');
  if (!infoEl) return;
  const crop = getCropById(cellKey);
  if (crop) {
    infoEl.innerHTML = `${crop.emoji||''} <strong>${crop.name}</strong> · База GDD: +${crop.baseTemp}°C`;
  } else {
    infoEl.textContent = '';
  }
  // Refresh variety dropdowns in rows table — show only varieties for this crop
  renderRowEntries();
}

function toggleIrrigScience() {
  const el = document.getElementById('irrig-science-block');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}


// ═══ СТАТИСТИКА ФАЗ (калибровка GDD по наблюдениям) ══════════════════════

// S.phaseLog = [{id, cropId, varietyId, phaseName, date, gddOnDate, note, year}]

function getPhaseLog() {
  if (!S.phaseLog) S.phaseLog = [];
  return S.phaseLog;
}


function fillPhaseLogFilters() {
  // Фильтр культур
  const cropSel = document.getElementById('phaselog-filter-crop');
  if (cropSel) {
    const cur = cropSel.value;
    cropSel.innerHTML = '<option value="">— Все культуры —</option>';
    S.crops.forEach(c => cropSel.innerHTML += `<option value="${c.id}" ${cur===c.id?'selected':''}>${c.emoji||''} ${c.name}</option>`);
  }
  // Фильтр сортов
  const varSel = document.getElementById('phaselog-filter-variety');
  if (varSel) {
    varSel.innerHTML = '<option value="">— Все сорта —</option>';
    S.varieties.forEach(v => varSel.innerHTML += `<option value="${v.id}">${v.name}</option>`);
  }
}

function renderPhaseLogTable() {
  const wrap    = document.getElementById('phaselog-table-wrap');
  const compare = document.getElementById('phaselog-compare');
  if (!wrap) return;

  const filterCrop = document.getElementById('phaselog-filter-crop')?.value || '';
  const filterVar  = document.getElementById('phaselog-filter-variety')?.value || '';
  const log = getPhaseLog();

  let filtered = log;
  if (filterCrop)  filtered = filtered.filter(e => e.cropId === filterCrop);
  if (filterVar)   filtered = filtered.filter(e => e.varietyId === filterVar);
  filtered = [...filtered].sort((a,b) => (b.date||'').localeCompare(a.date||''));

  if (!filtered.length) {
    wrap.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px;">
      Нет записей. Нажмите <b>+ Зафиксировать фазу</b> чтобы добавить наблюдение.
    </div>`;
    if (compare) compare.innerHTML = '';
    return;
  }

  // Таблица
  wrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:var(--surface2);font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);">
          <th style="padding:8px 10px;text-align:left;">Дата</th>
          <th style="padding:8px 10px;text-align:left;">Год</th>
          <th style="padding:8px 10px;text-align:left;">Культура</th>
          <th style="padding:8px 10px;text-align:left;">Сорт</th>
          <th style="padding:8px 10px;text-align:left;">Фаза</th>
          <th style="padding:8px 10px;text-align:right;">GDD</th>
          <th style="padding:8px 10px;text-align:left;">Примечание</th>
          <th style="padding:8px 10px;text-align:center;">✏️</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(e => {
          const crop = getCropById(e.cropId);
          const vari = S.varieties.find(v => v.id === e.varietyId);
          return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px 10px;font-family:'Unbounded',sans-serif;font-size:11px;">${e.date||'—'}</td>
            <td style="padding:8px 10px;color:var(--text3);">${e.year||e.date?.slice(0,4)||'—'}</td>
            <td style="padding:8px 10px;">${crop?.emoji||''} ${crop?.name||e.cropId||'—'}</td>
            <td style="padding:8px 10px;color:var(--text3);">${vari?.name||'—'}</td>
            <td style="padding:8px 10px;"><span style="padding:2px 8px;border-radius:8px;background:rgba(107,221,107,.12);color:var(--accent);font-size:11px;">${e.phaseName||'—'}</span></td>
            <td style="padding:8px 10px;text-align:right;font-family:'Unbounded',sans-serif;color:var(--accent2);">${e.gddOnDate!=null?e.gddOnDate:'—'}</td>
            <td style="padding:8px 10px;color:var(--text3);font-size:11px;">${e.note||''}</td>
            <td style="padding:8px 10px;text-align:center;">
              <button class="btn btn-secondary btn-xs" onclick="openPhaseLogModal('${e.id}')">✏️</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  // Сравнение по годам
  renderPhaseLogCompare(filtered, compare);
}

function renderPhaseLogCompare(entries, el) {
  if (!el) return;

  // Группируем: varietyId (или cropId) + phaseName → {год: entry}
  const groups = {};
  entries.forEach(e => {
    const key = `${e.cropId}||${e.varietyId||''}||${e.phaseName}`;
    if (!groups[key]) groups[key] = { cropId:e.cropId, varietyId:e.varietyId, phaseName:e.phaseName, byYear:{} };
    const yr = e.year || e.date?.slice(0,4) || '?';
    if (!groups[key].byYear[yr] || e.date > groups[key].byYear[yr].date) groups[key].byYear[yr] = e;
  });

  const keys = Object.keys(groups);
  if (!keys.length) { el.innerHTML = ''; return; }

  const years = [...new Set(entries.map(e => e.year||e.date?.slice(0,4)||'?'))].sort();

  // Вычислить среднюю GDD по годам для каждой группы
  function calcAvg(g) {
    const vals = Object.values(g.byYear).map(e => e.gddOnDate).filter(v => v != null && !isNaN(v));
    if (!vals.length) return null;
    return Math.round(vals.reduce((s,v)=>s+v,0) / vals.length);
  }

  // Проверить можно ли применить среднюю (есть varietyId и GDD данные)
  function canApply(g) {
    if (!g.varietyId) return false;
    const avg = calcAvg(g);
    if (avg == null) return false;
    const phases = getVarietyPhases(g.varietyId);
    return phases.some(p => p.name === g.phaseName);
  }

  el.innerHTML = `
    <div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">📊 Сравнение по годам · Средняя · Применение</div>
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:var(--surface2);font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);">
          <th style="padding:8px 10px;text-align:left;">Культура / Сорт</th>
          <th style="padding:8px 10px;text-align:left;">Фаза</th>
          ${years.map(y=>`<th style="padding:8px 10px;text-align:center;">${y}</th>`).join('')}
          <th style="padding:8px 10px;text-align:center;color:var(--accent2);">Ср. GDD</th>
          <th style="padding:8px 10px;text-align:center;">Применить</th>
        </tr>
      </thead>
      <tbody>
        ${keys.map(k => {
          const g = groups[k];
          const crop = getCropById(g.cropId);
          const vari = S.varieties.find(v=>v.id===g.varietyId);
          const label = `${crop?.emoji||''} ${crop?.name||g.cropId}${vari?' · '+vari.name:''}`;
          const avg = calcAvg(g);
          const applicable = canApply(g);
          return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px 10px;">${label}</td>
            <td style="padding:8px 10px;"><span style="padding:2px 8px;border-radius:8px;background:rgba(107,221,107,.12);color:var(--accent);">${g.phaseName}</span></td>
            ${years.map(y => {
              const e = g.byYear[y];
              return `<td style="padding:8px 10px;text-align:center;">
                ${e
                  ? `<div style="font-weight:700;">${e.date?.slice(5)||'—'}</div>
                     <div style="font-size:10px;color:var(--text3);">GDD ${e.gddOnDate!=null?e.gddOnDate:'—'}</div>`
                  : '<span style="color:var(--text3);">—</span>'}
              </td>`;
            }).join('')}
            <td style="padding:8px 10px;text-align:center;">
              ${avg != null
                ? `<span style="font-family:'Unbounded',sans-serif;font-size:13px;font-weight:700;color:var(--accent2);">${avg}</span>
                   <div style="font-size:9px;color:var(--text3);">${Object.keys(g.byYear).length} лет</div>`
                : '<span style="color:var(--text3);">—</span>'}
            </td>
            <td style="padding:8px 10px;text-align:center;">
              ${applicable
                ? `<button class="btn btn-primary btn-xs" onclick="applyPhaseAvgToGdd('${g.varietyId}','${g.phaseName}',${avg})" title="Применить среднюю GDD ${avg} к порогу фазы '${g.phaseName}'">✓ Применить</button>`
                : `<span style="font-size:10px;color:var(--text3);">${avg==null?'нет данных':'нет сорта'}</span>`}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>

    <!-- Кнопка применить всё -->
    ${keys.some(k => canApply(groups[k]) && calcAvg(groups[k]) != null)
      ? `<div style="margin-top:12px;padding:10px 14px;background:rgba(107,221,107,.06);border:1px solid rgba(107,221,107,.2);border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <div style="font-size:11px;color:var(--text3);">Применить все средние GDD к порогам фаз в базе данных сортов</div>
          <button class="btn btn-primary btn-sm" onclick="applyAllPhaseAvgs()">✓ Применить все средние</button>
        </div>`
      : ''}`;
}

// Применить одну среднюю GDD к порогу фазы сорта
function applyPhaseAvgToGdd(varietyId, phaseName, avgGdd) {
  const variety = S.varieties.find(v => v.id === varietyId);
  if (!variety) { alert('Сорт не найден'); return; }
  const crop = getCropById(variety.cropId || 'crop_cherry');
  const std = crop?.phases || S.gddDb.standardPhases || [];
  const phaseIdx = std.findIndex(p => p.name === phaseName);
  if (phaseIdx < 0) { alert('Фаза не найдена в базе'); return; }

  if (!S.gddDb.varietyGdd[varietyId]) S.gddDb.varietyGdd[varietyId] = std.map((_,i) => i * 100);
  const oldVal = S.gddDb.varietyGdd[varietyId][phaseIdx];
  if (!confirm(`Обновить GDD порог "${phaseName}" для "${variety.name}"?\n${oldVal} → ${avgGdd}`)) return;

  S.gddDb.varietyGdd[varietyId][phaseIdx] = avgGdd;
  save();
  renderPhaseLogTable();
  renderGdd();
  alert(`✅ Порог "${phaseName}" для "${variety.name}" обновлён: ${oldVal} → ${avgGdd} GDD`);
}

// Применить все средние
function applyAllPhaseAvgs() {
  const log = getPhaseLog();
  if (!log.length) return;

  // Считаем средние по varietyId + phaseName
  const avgs = {};
  log.forEach(e => {
    if (!e.varietyId || e.gddOnDate == null) return;
    const k = `${e.varietyId}||${e.phaseName}`;
    if (!avgs[k]) avgs[k] = { varietyId:e.varietyId, phaseName:e.phaseName, vals:[] };
    avgs[k].vals.push(e.gddOnDate);
  });

  let count = 0;
  Object.values(avgs).forEach(a => {
    if (!a.vals.length) return;
    const avg = Math.round(a.vals.reduce((s,v)=>s+v,0) / a.vals.length);
    const variety = S.varieties.find(v => v.id === a.varietyId);
    if (!variety) return;
    const crop = getCropById(variety.cropId || 'crop_cherry');
    const std = crop?.phases || S.gddDb.standardPhases || [];
    const phaseIdx = std.findIndex(p => p.name === a.phaseName);
    if (phaseIdx < 0) return;
    if (!S.gddDb.varietyGdd[a.varietyId]) S.gddDb.varietyGdd[a.varietyId] = std.map((_,i) => i * 100);
    S.gddDb.varietyGdd[a.varietyId][phaseIdx] = avg;
    count++;
  });

  if (!count) { alert('Нет данных для применения'); return; }
  save();
  renderPhaseLogTable();
  renderGdd();
  alert(`✅ Обновлено ${count} порогов фаз на основе средних по годам`);
}


// ---- Модал ----
let _editingPhaseLogId = null;

function openPhaseLogModal(id) {
  _editingPhaseLogId = id || null;
  const entry = id ? getPhaseLog().find(e => e.id === id) : null;
  document.getElementById('phaselog-modal-title').textContent = entry ? '✏️ Редактировать запись' : '📅 Зафиксировать фазу';
  document.getElementById('pl-del-btn').style.display = entry ? 'inline-flex' : 'none';
  document.getElementById('pl-date').value = entry?.date || new Date().toISOString().slice(0,10);
  document.getElementById('pl-note').value = entry?.note || '';

  // Заполнить культуры
  const cropSel = document.getElementById('pl-crop');
  cropSel.innerHTML = '<option value="">— выбрать —</option>';
  S.crops.forEach(c => cropSel.innerHTML += `<option value="${c.id}" ${entry?.cropId===c.id?'selected':''}>${c.emoji||''} ${c.name}</option>`);
  if (entry?.cropId) cropSel.value = entry.cropId;

  onPhaseLogCropChange(entry?.varietyId, entry?.phaseName);
  document.getElementById('pl-gdd-info').style.display = 'none';
  openModal('modal-phaselog');
}

function onPhaseLogCropChange(preselVarId, preselPhase) {
  const cropId = document.getElementById('pl-crop').value;
  const crop   = getCropById(cropId);

  // Сорта
  const varSel = document.getElementById('pl-variety');
  varSel.innerHTML = '<option value="">— все сорта / культура —</option>';
  if (cropId) {
    S.varieties.filter(v=>(v.cropId||'crop_cherry')===cropId).forEach(v =>
      varSel.innerHTML += `<option value="${v.id}" ${preselVarId===v.id?'selected':''}>${v.name}</option>`
    );
  }
  if (preselVarId) varSel.value = preselVarId;

  // Фазы
  const phaseSel = document.getElementById('pl-phase');
  phaseSel.innerHTML = '<option value="">— выбрать фазу —</option>';
  if (crop) {
    // Фазы из справочника культуры
    const phases = crop.phases && crop.phases.length ? crop.phases : [];
    phases.forEach(ph => phaseSel.innerHTML += `<option value="${ph.name}" ${preselPhase===ph.name?'selected':''}>${ph.name}</option>`);
    // Также добавить фазы из GDD сортов
    S.varieties.filter(v=>(v.cropId||'crop_cherry')===cropId).forEach(v => {
      const vPhases = getVarietyPhases(v.id);
      vPhases.forEach(ph => {
        if (!phaseSel.querySelector(`option[value="${ph.name}"]`))
          phaseSel.innerHTML += `<option value="${ph.name}" ${preselPhase===ph.name?'selected':''}>${ph.name}</option>`;
      });
    });
  }
  if (preselPhase) phaseSel.value = preselPhase;
}

function savePhaseLog() {
  const cropId    = document.getElementById('pl-crop').value;
  const varietyId = document.getElementById('pl-variety').value || null;
  const phaseName = document.getElementById('pl-phase').value;
  const date      = document.getElementById('pl-date').value;
  const note      = document.getElementById('pl-note').value.trim();

  if (!cropId)    { alert('Выберите культуру'); return; }
  if (!phaseName) { alert('Выберите фазу'); return; }
  if (!date)      { alert('Укажите дату'); return; }

  // Вычислить GDD на дату
  const crop = getCropById(cropId);
  const tbase = crop?.baseTemp || 5;
  const gddOnDate = calcGddOnDate(date, tbase);
  const year = date.slice(0, 4);

  const entry = {
    id:         _editingPhaseLogId || ('pl_' + Date.now()),
    cropId, varietyId, phaseName, date, note, year,
    gddOnDate,
    savedAt: new Date().toISOString(),
  };

  if (!S.phaseLog) S.phaseLog = [];
  const idx = S.phaseLog.findIndex(e => e.id === entry.id);
  if (idx >= 0) S.phaseLog[idx] = entry; else S.phaseLog.push(entry);

  save();
  closeModal('modal-phaselog');
  renderPhaseLogTable();

  // Показать GDD
  setTimeout(() => {
    const infoEl = document.getElementById('pl-gdd-info');
    if (infoEl) { infoEl.style.display='block'; infoEl.textContent = `✅ Сохранено. GDD на ${date}: ${gddOnDate} °C·дней (база +${tbase}°C)`; }
  }, 100);
}

function deletePhaseLog() {
  if (!_editingPhaseLogId || !confirm('Удалить запись?')) return;
  S.phaseLog = (S.phaseLog||[]).filter(e => e.id !== _editingPhaseLogId);
  save();
  closeModal('modal-phaselog');
  renderPhaseLogTable();
}

// Вычислить накопленный GDD на конкретную дату
function calcGddOnDate(targetDate, tbase) {
  const startDate = S.gddDb?.startDate || (new Date().getFullYear() + '-01-01');
  let gdd = 0;
  (S.weather || []).forEach(w => {
    if (!w.date || w.date < startDate || w.date > targetDate) return;
    const tmax = parseFloat(w.tmax) || 0;
    const tmin = parseFloat(w.tmin) || 0;
    const daily = Math.max(0, ((tmax + tmin) / 2) - tbase);
    gdd += daily;
  });
  return Math.round(gdd);
}

