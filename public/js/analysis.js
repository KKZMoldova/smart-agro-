// Smart Agro — analysis.js
// ===================== ANALYSIS =====================
function getNorms(){return{
  N: {min:2.0,max:3.0,unit:'%',name:'Азот',mobile:true,
      deficiency:'Общий хлороз — листья бледно-зелёные или жёлтые, угнетённый рост',
      excess:'Тёмно-зелёные листья, задержка созревания, рыхлые плоды',
      leafPosition:'Старые листья (нижние)',
      source:'Книга Sela, Прил.II: черешня 125 кг/га N при 15 т/га урожая'},
  P: {min:.15,max:.40,unit:'%',name:'Фосфор',mobile:true,
      deficiency:'Тёмно-зелёные листья с фиолетовым оттенком снизу, слабая корневая система',
      excess:'Блокировка Zn, Fe, Cu',
      leafPosition:'Старые листья (нижние)',
      source:'Книга Sela, Прил.II: черешня 55 кг/га P₂O₅'},
  K: {min:1.5,max:2.5,unit:'%',name:'Калий',mobile:true,
      deficiency:'Хлороз и некроз краёв листьев начиная со старых, мелкие листья, растрескивание плодов',
      excess:'Блокировка Ca и Mg',
      leafPosition:'Старые листья (нижние)',
      source:'Книга Sela, Прил.II: черешня 155 кг/га K₂O — повышать в фазе созревания'},
  Ca: {min:1.0,max:2.5,unit:'%',name:'Кальций',mobile:false,
      deficiency:'Некроз молодых листьев и точки роста, растрескивание плодов, мягкость плодов',
      excess:'Блокировка K, Mg, B, Fe',
      leafPosition:'Молодые листья (верхние)',
      source:'Книга Sela гл.1: иммобильный, критичен в фазе завязи и роста плода'},
  Mg: {min:.25,max:.50,unit:'%',name:'Магний',mobile:true,
      deficiency:'Межжилковый хлороз старых листьев — жилки зелёные, ткань жёлтая',
      excess:'Редко, конкурирует с K и Ca',
      leafPosition:'Старые листья (нижние)',
      source:'Книга Sela гл.1: часто дефицит при высоком K или Ca в почве'},
  Fe: {min:50,max:300,unit:'ppm',name:'Железо',mobile:false,
      deficiency:'Межжилковый хлороз молодых листьев при высоком pH почвы (>7.0)',
      excess:'Марганцевое отравление при кислых почвах',
      leafPosition:'Молодые листья (верхние)',
      source:'Книга Sela гл.1: хелаты Fe-EDDHA устойчивы при pH 7-9. Листовая — быстрая коррекция'},
  Mn: {min:30,max:250,unit:'ppm',name:'Марганец',mobile:false,
      deficiency:'Межжилковый хлороз молодых листьев, похож на Fe но менее выражен',
      excess:'Токсичность при pH <5.5',
      leafPosition:'Молодые листья (верхние)',
      source:'Книга Sela гл.1: доступен при pH 5.5–7.0. При pH>7 — блокировка'},
  Zn: {min:15,max:60,unit:'ppm',name:'Цинк',mobile:false,
      deficiency:'Мелкие листья, розеточность побегов, короткие меж­доузлия',
      excess:'Редко',
      leafPosition:'Молодые листья (верхние)',
      source:'Книга Sela гл.1: блокируется при pH>7. Листовая обработка — наиболее эффективна'},
  B: {min:25,max:50,unit:'ppm',name:'Бор',mobile:false,
      deficiency:'Отмирание точки роста, деформация и растрескивание плодов, слабое опыление',
      excess:'Некроз краёв листьев',
      leafPosition:'Молодые листья, плоды, цветки',
      source:'Книга Sela гл.1: критичен в фазе цветения для опыления. Bortrac — правильный выбор'},
  Cu: {min:5,max:20,unit:'ppm',name:'Медь',mobile:false,
      deficiency:'Побурение и отмирание кончиков молодых листьев, деформация побегов',
      excess:'Задержка роста корней',
      leafPosition:'Молодые листья (верхние)',
      source:'Книга Sela гл.1: снижается при pH>7. Медьсодержащие фунгициды одновременно питают'},
};}
// ===================== ANALYSES =====================
let _anTab = 'all';
let _anEditId = null;

function setAnTab(tab) {
  _anTab = tab;
  ['all','leaf','soil','water'].forEach(t => {
    const btn = document.getElementById('antab-'+t);
    if(btn) btn.classList.toggle('active', t===tab);
  });
  renderAnalysis();
}

function switchAnModalTab(tab) {
  document.getElementById('a-type').value = tab;
  ['leaf','soil','water'].forEach(t => {
    document.getElementById('an-fields-'+t).style.display = t===tab ? 'block' : 'none';
    document.getElementById('amodal-'+t).classList.toggle('active', t===tab);
  });
}

let _anSelectedCells = new Set();
let _anSelectedZones = new Set();

function renderAnParcelPicker() {
  const el = document.getElementById('a-parcel-zone-picker');
  if(!el) return;
  const cells = Object.entries(S.cells||{});
  const zones = S.irrigation?.zones||[];

  el.innerHTML = cells.map(([key, cd])=>{
    const col = getCellColors(cd);
    const crop = getCropById(cd.cropId||'crop_cherry');
    const ha = calcCellTotals(cd)?.totalHa||0;
    const selCell = _anSelectedCells.has(key);
    const cellZones = zones.filter(z=>(z.cellKeys||[]).includes(key));

    return `<div style="margin-bottom:4px;">
      <div onclick="toggleAnCell('${key}')" id="an-cell-${key}"
        style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;
          background:${selCell?'rgba(74,222,128,.12)':'transparent'};
          border:1px solid ${selCell?'rgba(74,222,128,.3)':'transparent'};">
        <span style="font-size:14px;">${selCell?'☑':'☐'}</span>
        <span style="font-size:12px;font-weight:600;">${crop?.emoji||'🌳'} ${key}</span>
        <span style="font-size:11px;color:var(--text3);">${col[0]?.name||''} · ${ha.toFixed(2)}га</span>
      </div>
      ${cellZones.length ? `<div style="margin-left:24px;display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">
        ${cellZones.map(z=>{
          const selZ = _anSelectedZones.has(z.id);
          return `<span onclick="toggleAnZone('${z.id}','${key}',event)" id="an-zone-${z.id}"
            style="padding:2px 8px;border-radius:6px;font-size:10px;cursor:pointer;
              background:${selZ?'rgba(96,165,250,.15)':'var(--surface3)'};
              color:${selZ?'var(--blue)':'var(--text3)'};
              border:1px solid ${selZ?'rgba(96,165,250,.3)':'var(--border)'};">
            💧 ${z.name}
          </span>`;
        }).join('')}
      </div>` : ''}
    </div>`;
  }).join('') || '<div style="font-size:11px;color:var(--text3);">Клетки не заданы</div>';

  _updateAnSummary();
}

function toggleAnCell(key) {
  if(_anSelectedCells.has(key)) {
    _anSelectedCells.delete(key);
    // Снимаем зоны этой клетки
    (S.irrigation?.zones||[]).filter(z=>(z.cellKeys||[]).includes(key))
      .forEach(z=>_anSelectedZones.delete(z.id));
  } else {
    _anSelectedCells.add(key);
    // Авто-выбор зон клетки
    (S.irrigation?.zones||[]).filter(z=>(z.cellKeys||[]).includes(key))
      .forEach(z=>_anSelectedZones.add(z.id));
  }
  renderAnParcelPicker();
  _updateAnVarieties();
}

function toggleAnZone(zoneId, cellKey, event) {
  event.stopPropagation();
  if(_anSelectedZones.has(zoneId)) _anSelectedZones.delete(zoneId);
  else _anSelectedZones.add(zoneId);
  renderAnParcelPicker();
}

function _updateAnSummary() {
  const el = document.getElementById('a-selected-summary');
  if(!el) return;
  const cells = [..._anSelectedCells];
  const zoneNames = [..._anSelectedZones]
    .map(zid=>(S.irrigation?.zones||[]).find(z=>z.id===zid)?.name||'')
    .filter(Boolean);

  if(!cells.length) {
    el.innerHTML = '<span style="color:var(--text3);font-size:11px;">Нажмите на участок чтобы выбрать</span>';
  } else {
    el.innerHTML = `<span style="color:var(--accent);">✅ ${cells.join(', ')}</span>${zoneNames.length?` <span style="color:var(--blue);">· 💧 ${zoneNames.join(', ')}</span>`:''}`;
  }

  // Обновляем скрытые поля
  const cellEl = document.getElementById('a-cell');
  const zoneEl = document.getElementById('a-zone');
  if(cellEl) cellEl.value = cells.join(',');
  if(zoneEl) zoneEl.value = [..._anSelectedZones].join(',');
}

function _updateAnVarieties() {
  const varSel = document.getElementById('a-variety');
  if(!varSel) return;
  const cur = varSel.value;
  const selectedCells = [..._anSelectedCells];
  const varieties = selectedCells.length
    ? S.varieties.filter(v => selectedCells.some(k=>{
        const cd = S.cells[k];
        return !cd || (v.cropId||'crop_cherry')===(cd.cropId||'crop_cherry');
      }))
    : S.varieties;
  varSel.innerHTML = '<option value="">— все сорта —</option>' +
    varieties.map(v=>`<option value="${v.id}" ${cur===v.id?'selected':''}>${v.name}</option>`).join('');
}

function openAnalysisModal(type, editId) {
  _anEditId = editId || null;
  type = type || 'leaf';
  const existing = editId ? S.analyses.find(a=>a.id===editId) : null;
  document.getElementById('an-modal-title').textContent =
    existing ? `✏️ Редактировать анализ ${existing.type==='leaf'?'листа':existing.type==='soil'?'почвы':'воды'}`
             : `🔬 Новый анализ ${type==='leaf'?'листа':type==='soil'?'почвы':'воды'}`;
  document.getElementById('an-delete-btn').style.display = existing ? 'block' : 'none';
  document.getElementById('a-date').value = existing?.date || new Date().toISOString().slice(0,10);
  document.getElementById('a-lab').value  = existing?.lab  || '';
  document.getElementById('a-note').value = existing?.note || '';
  document.getElementById('a-depth-cm').value = existing?.depthCm || '';

  // Восстанавливаем выбранные клетки и зоны
  _anSelectedCells = new Set(existing?.cellKey ? existing.cellKey.split(',').filter(Boolean) : []);
  _anSelectedZones = new Set(existing?.zoneId ? existing.zoneId.split(',').filter(Boolean) : []);
  renderAnParcelPicker();

  // Культуры
  const cropSel = document.getElementById('a-crop');
  if(cropSel) {
    cropSel.innerHTML = '<option value="">— все культуры —</option>' +
      S.crops.map(c=>`<option value="${c.id}" ${existing?.cropId===c.id?'selected':''}>${c.emoji||''} ${c.name}</option>`).join('');
  }

  // Сорта
  _updateAnVarieties();
  setTimeout(()=>{
    if(existing?.varietyId) { const v=document.getElementById('a-variety'); if(v) v.value=existing.varietyId; }
  }, 50);

  // Поля элементов
  const leafFields = ['N','P','K','Ca','Mg','S','Fe','Mn','Zn','B','Cu','Mo'];
  const soilFields = ['pH','OM','CEC','BS','depth','NO3','P','K','Ca','Mg','B','Fe','Mn','Zn','Cu'];
  const waterFields= ['pH','EC','TDS','hard','SAR','Cl','NO3','Ca','Mg','Na','B','Fe','Mn','H2S'];
  leafFields.forEach(f => { const el=document.getElementById('a-'+f); if(el) el.value=existing?.type==='leaf'?existing[f]||'':''; });
  soilFields.forEach(f => { const el=document.getElementById('s-'+f); if(el) el.value=existing?.type==='soil'?existing[f]||'':''; });
  waterFields.forEach(f=>{ const el=document.getElementById('w-'+f); if(el) el.value=existing?.type==='water'?existing[f]||'':''; });
  const st = document.getElementById('s-texture');
  if(st) st.value = existing?.type==='soil' ? existing.texture||'' : '';

  switchAnModalTab(existing?.type || type);
  openModal('modal-analysis');
}

function deleteAnalysis() {
  if (!_anEditId || !confirm('Удалить анализ?')) return;
  S.analyses = S.analyses.filter(a=>a.id!==_anEditId);
  save(); closeModal('modal-analysis'); renderAnalysis();
}

function saveAnalysis() {
  const type = document.getElementById('a-type').value || 'leaf';
  const date = document.getElementById('a-date').value;
  if (!date) { alert('Введите дату'); return; }
  const e = {
    id: _anEditId || Date.now(),
    type, date,
    cellKey:   document.getElementById('a-cell').value,
    zoneId:    document.getElementById('a-zone')?.value || '',
    varietyId: document.getElementById('a-variety')?.value || '',
    cropId:    document.getElementById('a-crop')?.value || '',
    depthCm:   document.getElementById('a-depth-cm')?.value || '',
    lab:  document.getElementById('a-lab').value,
    note: document.getElementById('a-note').value,
  };
  if (type === 'leaf') {
    ['N','P','K','Ca','Mg','S','Fe','Mn','Zn','B','Cu','Mo'].forEach(f => {
      const v = document.getElementById('a-'+f)?.value;
      if (v !== '' && v !== null && v !== undefined) e[f] = parseFloat(v);
    });
  } else if (type === 'soil') {
    ['pH','OM','CEC','BS','depth','NO3','P','K','Ca','Mg','B','Fe','Mn','Zn','Cu'].forEach(f => {
      const v = document.getElementById('s-'+f)?.value;
      if (v !== '' && v !== null && v !== undefined) e[f] = parseFloat(v);
    });
    e.texture = document.getElementById('s-texture')?.value || '';
  } else if (type === 'water') {
    ['pH','EC','TDS','hard','SAR','Cl','NO3','Ca','Mg','Na','B','Fe','Mn','H2S'].forEach(f => {
      const v = document.getElementById('w-'+f)?.value;
      if (v !== '' && v !== null && v !== undefined) e[f] = parseFloat(v);
    });
  }

  if (_anEditId) {
    const idx = S.analyses.findIndex(a=>a.id===_anEditId);
    if (idx >= 0) S.analyses[idx] = e; else S.analyses.push(e);
  } else {
    S.analyses.push(e);
  }
  save(); closeModal('modal-analysis'); renderAnalysis();
  setTimeout(loadAllAnalysisPdfs, 400);
}

function popAFilter() {
  const sel = document.getElementById('af-filter');
  const cur = sel?.value || '';
  if(sel) {
    sel.innerHTML = '<option value="">Все клетки</option>';
    Object.keys(S.cells).forEach(k => {
      const colors = getCellColors(S.cells[k]);
      sel.innerHTML += `<option value="${k}" ${cur===k?'selected':''}>${k}${colors[0]?' — '+colors[0].name:''}</option>`;
    });
  }
  // Зоны
  const zoneSel = document.getElementById('af-zone');
  if(zoneSel) {
    const curZ = zoneSel.value;
    zoneSel.innerHTML = '<option value="">Все зоны</option>';
    (S.irrigation?.zones||[]).forEach(z=>{
      zoneSel.innerHTML += `<option value="${z.id}" ${curZ===z.id?'selected':''}>${z.name}</option>`;
    });
  }
  // Сорта
  const varSel = document.getElementById('af-variety');
  if(varSel) {
    const curV = varSel.value;
    varSel.innerHTML = '<option value="">Все сорта</option>';
    S.varieties.forEach(v=>{
      varSel.innerHTML += `<option value="${v.id}" ${curV===v.id?'selected':''}>${v.name}</option>`;
    });
  }
}

// ── Norms databases ────────────────────────────────────────────────────────
const SOIL_NORMS = {
  pH:  {min:6.0,max:7.5,unit:'',    name:'pH почвы',   
    low:'Кислая почва — вносить известь (CaCO₃). Блокирует P, Ca, Mg, Mo.',
    high:'Щелочная — вносить серу или гипс. Блокирует Fe, Mn, Zn, B.',
    fix_low:'Известкование: 2–5 т/га CaCO₃. Через капельное: Ca(NO₃)₂.',
    fix_high:'Сера молотая 200–500 кг/га. Или гипс 1–2 т/га.'},
  OM:  {min:2.0,max:5.0,unit:'%',   name:'Орг. вещество',
    low:'Низкая биологическая активность. Плохая структура.',
    high:'Норма',
    fix_low:'Компост 15–20 т/га. Сидераты. Мульча.'},
  NO3: {min:15, max:50, unit:'мг/кг',name:'N-NO₃',
    low:'Дефицит азота. Пожелтение старых листьев.',
    high:'Избыток — риск загрязнения грунтовых вод.',
    fix_low:'Нитрат аммония 100–150 кг/га. Через капельное: Ca(NO₃)₂ или KNO₃.',
    fix_high:'Снизить дозы N-удобрений. Усилить полив для вымывания.'},
  P:   {min:50, max:200,unit:'мг/кг',name:'P₂O₅',
    low:'Дефицит фосфора. Фиолетовый оттенок листьев.',
    high:'Избыток блокирует Zn и Fe.',
    fix_low:'Суперфосфат 200–400 кг/га. MAP или DAP. В почву осенью.',
    fix_high:'Не вносить P 2–3 сезона. Контроль pH.'},
  K:   {min:100,max:300,unit:'мг/кг',name:'K₂O',
    low:'Дефицит калия. Некроз краёв старых листьев.',
    high:'Избыток блокирует Ca и Mg.',
    fix_low:'Сульфат калия 150–300 кг/га. Через капельное: KNO₃, K₂SO₄.',
    fix_high:'Снизить К-удобрения. Увеличить Ca и Mg.'},
  Ca:  {min:800,max:3000,unit:'мг/кг',name:'Кальций',
    low:'Кислая почва. Плохая структура. Риск растрескивания плодов.',
    high:'Норма',
    fix_low:'Известкование CaCO₃. Гипс CaSO₄. Кальциевая селитра через капельное.'},
  Mg:  {min:80, max:400, unit:'мг/кг',name:'Магний',
    low:'Хлороз между жилками старых листьев.',
    high:'Норма',
    fix_low:'Сульфат магния 50–100 кг/га в почву. Через лист: MgSO₄ 1–2%.'},
};

const WATER_NORMS = {
  pH:  {min:6.5,max:7.5,unit:'',    name:'pH воды',
    low:'Кислая вода. Коррозия труб. Корректировать с Ca(OH)₂.',
    high:'Щелочная. Осадок CaCO₃ в капельницах. Кислотная промывка HNO₃ или H₃PO₄.',
    fix_high:'Кислотование системы: HNO₃ до pH 5.5–6.0. Регулярно 1×/нед.'},
  EC:  {min:0.1,max:1.5,unit:'мСм/см',name:'EC',
    low:'Очень чистая вода — можно добавить больше удобрений.',
    high:'Высокая солёность. Риск осмотического стресса. Промывка почвы.',
    fix_high:'Промывочные поливы 30–40% нормы. Gypsum блок в системе.'},
  TDS: {min:0,  max:1000,unit:'мг/л',name:'Общие соли',
    low:'Норма',
    high:'Высокое засоление. Риск угнетения корней.',
    fix_high:'Смешать с менее солёной водой. Дренажные мероприятия.'},
  Fe:  {min:0,  max:0.3, unit:'мг/л',name:'Железо',
    low:'Норма',
    high:'Засорение капельниц. Бактерии железа. Хлорирование + кислота.',
    fix_high:'Фильтрация. Хлорирование 2–5 ppm. Кислотная промывка.'},
  Mn:  {min:0,  max:0.1, unit:'мг/л',name:'Марганец',
    low:'Норма',
    high:'Засорение систем. Хлорирование.',
    fix_high:'Фильтрация. Хлорирование.'},
  B:   {min:0,  max:0.5, unit:'мг/л',name:'Бор',
    low:'Норма',
    high:'Токсичность бора! Смешать с другой водой.',
    fix_high:'Смешивание с водой без бора. Нет агрохимического исправления.'},
  Cl:  {min:0,  max:150, unit:'мг/л',name:'Хлориды',
    low:'Норма',
    high:'Токсичность хлора для листьев (ожоги краёв).',
    fix_high:'Ограничить листовое орошение. Избегать дождевания.'},
  SAR: {min:0,  max:10,  unit:'',   name:'SAR (натрий)',
    low:'Норма',
    high:'Риск деградации структуры почвы от натрия.',
    fix_high:'Гипс CaSO₄ для вытеснения Na. Глубокое дренирование.'},
};

// ── Recommendations engine ─────────────────────────────────────────────────
function generateRecommendations(analyses) {
  const recs = [];
  const lastLeaf  = [...analyses].filter(a=>a.type==='leaf').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  const lastSoil  = [...analyses].filter(a=>a.type==='soil').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  const lastWater = [...analyses].filter(a=>a.type==='water').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  const norms = getNorms();

  // From leaf analysis
  if (lastLeaf) {
    Object.entries(norms).forEach(([el, n]) => {
      if (lastLeaf[el] === undefined) return;
      const val = lastLeaf[el];
      if (val < n.min) {
        // Generate specific recommendation by method
        const methods = [];
        // Soil application
        if (['N','P','K','Ca','Mg'].includes(el)) methods.push({method:'soil', text: soilFixLeaf(el, val, n)});
        // Foliar application (fast acting)
        if (['N','K','Mg','Fe','Mn','Zn','B','Cu','Mo'].includes(el)) methods.push({method:'foliar', text: foliarFix(el, val, n)});
        // Drip
        if (['N','K','Ca','Mg','Fe','Mn'].includes(el)) methods.push({method:'drip', text: dripFix(el, val, n)});
        recs.push({
          level: val < n.min * 0.7 ? 'critical' : 'warn',
          source: '🍃 Лист',
          element: el, name: n.name,
          found: val, unit: n.unit,
          norm: `${n.min}–${n.max}`,
          symptom: n.deficiency,
          leafPos: n.leafPosition,
          methods,
        });
      } else if (val > n.max) {
        recs.push({
          level: 'excess',
          source: '🍃 Лист',
          element: el, name: n.name,
          found: val, unit: n.unit,
          norm: `${n.min}–${n.max}`,
          symptom: n.excess,
          methods: [{method:'note', text: 'Снизить дозы этого элемента. Проверить pH почвы.'}],
        });
      }
    });
  }

  // From soil analysis
  if (lastSoil) {
    Object.entries(SOIL_NORMS).forEach(([key, n]) => {
      if (lastSoil[key] === undefined) return;
      const val = lastSoil[key];
      if (val < n.min || val > n.max) {
        const isLow = val < n.min;
        recs.push({
          level: isLow ? 'critical' : 'excess',
          source: '🌱 Почва',
          element: key, name: n.name,
          found: val, unit: n.unit,
          norm: `${n.min}–${n.max}`,
          symptom: isLow ? n.low : n.high,
          methods: isLow && n.fix_low
            ? [{method:'soil', text: n.fix_low}]
            : n.fix_high
            ? [{method:'note', text: n.fix_high}]
            : [],
        });
      }
    });
  }

  // From water analysis
  if (lastWater) {
    Object.entries(WATER_NORMS).forEach(([key, n]) => {
      if (lastWater[key] === undefined) return;
      const val = lastWater[key];
      if (val < n.min || val > n.max) {
        const isHigh = val > n.max;
        recs.push({
          level: isHigh ? 'critical' : 'warn',
          source: '💧 Вода',
          element: key, name: n.name,
          found: val, unit: n.unit,
          norm: `${n.min}–${n.max}`,
          symptom: isHigh ? n.high : n.low,
          methods: n.fix_high && isHigh ? [{method:'water', text: n.fix_high}] : [],
        });
      }
    });
  }

  return recs;
}

function soilFixLeaf(el, val, n) {
  const fixes = {
    N: 'Кальциевая селитра 15:0:0+26CaO — 300–500 кг/га. Аммиачная селитра 34%. В почву весной до вегетации.',
    P: 'Суперфосфат 200–400 кг/га. MAP 12:52:0 — 100–200 кг/га. Осенью под вспашку.',
    K: 'Сульфат калия 0:0:50+18S — 200–400 кг/га. В почву весной или летом.',
    Ca:'Гипс CaSO₄ 1–2 т/га. Нитрат кальция Ca(NO₃)₂ через капельное.',
    Mg:'Сульфат магния MgSO₄ 50–100 кг/га. Доломитовая мука при известковании.',
  };
  return fixes[el] || 'Внесение в почву по специфическому удобрению.';
}

function foliarFix(el, val, n) {
  const fixes = {
    N: 'КАС 32% или мочевина 0.5–1% (5–10 л/га). Ранее утро. 2–3 обработки с интервалом 10 дней.',
    K: 'Монокалийфосфат МКФ 0.3–0.5%. Нитрат калия KNO₃ 0.5–1%.',
    Mg:'Сульфат магния MgSO₄ 1–2% (10–20 кг/га). 2–3 обработки.',
    Fe:'Хелат железа Fe-EDTA или Fe-DTPA 0.1–0.2% (pH <6.5: EDTA, pH >6.5: DTPA). 3–5 обработок.',
    Mn:'Хелат марганца 0.1–0.2%. Сульфат марганца 0.3–0.5%. 2–3 обработки.',
    Zn:'Хелат цинка 0.1–0.15%. Сульфат цинка 0.2–0.3%. 2 обработки.',
    B: 'Бор Solubor 0.1–0.15% ДО и ПОСЛЕ цветения (не во время!). Борная кислота 0.15–0.2%.',
    Cu:'Хелат меди 0.05–0.1%. Медный купорос 0.05% (осторожно с дозой).',
    Mo:'Молибдат аммония 0.05–0.1%. Достаточно 1 обработки.',
  };
  return fixes[el] || 'Листовое внесение соответствующего хелата или соли.';
}

function dripFix(el, val, n) {
  const fixes = {
    N: 'Нитрат кальция Ca(NO₃)₂ — 3–5 кг/1000 л. Или КАС через инъектор. ЕС раствора: +0.5–1.0 мСм/см.',
    K: 'Нитрат калия KNO₃ — 2–4 кг/1000 л. Сульфат калия K₂SO₄ для капельного (растворимый).',
    Ca:'Нитрат кальция Ca(NO₃)₂ — 2–4 кг/1000 л. НЕ смешивать с фосфатами и сульфатами!',
    Mg:'Нитрат магния Mg(NO₃)₂ — 2–3 кг/1000 л. Или сульфат магния MgSO₄.',
    Fe:'Хелат железа Fe-DTPA — 0.5–1 кг/1000 л. Вносить отдельно от фосфора.',
    Mn:'Хелат марганца — 0.3–0.5 кг/1000 л. pH раствора должен быть <6.5.',
  };
  return fixes[el] || 'Растворимая форма через инъектор капельной системы.';
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderAnalysis() {
  popAFilter();
  const filter    = document.getElementById('af-filter')?.value || '';
  const zoneFilter = document.getElementById('af-zone')?.value || '';
  const varFilter  = document.getElementById('af-variety')?.value || '';
  const norms   = getNorms();
  let analyses  = [...(S.analyses||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  if (filter)    analyses = analyses.filter(a=>!a.cellKey||a.cellKey===filter);
  if (zoneFilter) analyses = analyses.filter(a=>!a.zoneId||a.zoneId===zoneFilter);
  if (varFilter)  analyses = analyses.filter(a=>!a.varietyId||a.varietyId===varFilter);
  if (_anTab !== 'all') analyses = analyses.filter(a=>a.type===_anTab);

  // Recommendations panel
  const allFiltered = filter ? (S.analyses||[]).filter(a=>!a.cellKey||a.cellKey===filter) : S.analyses||[];
  const recs = generateRecommendations(allFiltered);
  const recEl = document.getElementById('analysis-recommendations');
  if (recs.length && recEl) {
    const critRecs = recs.filter(r=>r.level==='critical');
    const warnRecs = recs.filter(r=>r.level==='warn'||r.level==='excess');
    const METHOD_ICONS = {soil:'🌱 В почву', foliar:'🍃 Листовое', drip:'💧 Капельное', water:'💧 Вода', note:'📝 Примечание'};
    const METHOD_COLORS = {soil:'var(--accent)',foliar:'var(--blue)',drip:'var(--teal)',water:'var(--blue)',note:'var(--text3)'};
    recEl.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <div style="padding:10px 16px;background:var(--surface2);display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="font-family:'Unbounded',sans-serif;font-size:11px;font-weight:700;color:var(--text2);">💊 Рекомендации по результатам анализов</div>
          ${critRecs.length?`<span style="padding:2px 10px;border-radius:10px;background:rgba(255,85,85,.15);color:var(--red);font-size:10px;font-weight:700;">${critRecs.length} дефицитов</span>`:''}
          ${warnRecs.length?`<span style="padding:2px 10px;border-radius:10px;background:rgba(255,216,77,.1);color:var(--yellow);font-size:10px;">${warnRecs.length} отклонений</span>`:''}
        </div>
        ${recs.map(r => {
          const lvlColor = r.level==='critical'?'var(--red)':r.level==='excess'?'var(--yellow)':'var(--orange)';
          const lvlText  = r.level==='critical'?'❌ Дефицит':r.level==='excess'?'⚠️ Избыток':'⚠️ Отклонение';
          return `<div style="padding:12px 16px;border-top:1px solid var(--border);">
            <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
              <span style="font-size:10px;padding:2px 8px;border-radius:8px;background:rgba(96,165,250,.1);color:var(--blue);">${r.source}</span>
              <strong style="font-size:13px;color:${lvlColor};">${r.element} — ${r.name}</strong>
              <span style="font-size:11px;color:var(--text3);">Найдено: <strong style="color:${lvlColor};">${r.found} ${r.unit}</strong> · Норма: ${r.norm} ${r.unit}</span>
              <span style="font-size:10px;padding:2px 8px;border-radius:8px;background:${lvlColor}22;color:${lvlColor};">${lvlText}</span>
            </div>
            ${r.symptom?`<div style="font-size:11px;color:var(--text2);margin-bottom:8px;padding:5px 10px;background:var(--surface2);border-radius:6px;">🔍 ${r.symptom}${r.leafPos?' · <em>'+r.leafPos+'</em>':''}</div>`:''}
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${r.methods.map(m=>`<div style="padding:8px 12px;border-radius:8px;border:1px solid ${METHOD_COLORS[m.method]}44;background:${METHOD_COLORS[m.method]}11;flex:1;min-width:200px;">
                <div style="font-size:10px;font-weight:700;color:${METHOD_COLORS[m.method]};margin-bottom:4px;">${METHOD_ICONS[m.method]||m.method}</div>
                <div style="font-size:11px;color:var(--text2);">${m.text}</div>
              </div>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  } else if(recEl) {
    recEl.innerHTML = analyses.length
      ? `<div style="padding:10px 16px;background:rgba(107,221,107,.06);border:1px solid rgba(107,221,107,.2);border-radius:8px;font-size:12px;color:var(--accent);">✅ Все показатели в норме</div>`
      : '';
  }

  // Analysis cards
  const grid = document.getElementById('analysis-grid');
  if (!analyses.length) {
    grid.innerHTML = `<div style="color:var(--text3);grid-column:1/-1;text-align:center;padding:40px 20px;">
      <div style="font-size:32px;margin-bottom:12px;">🔬</div>
      <div style="font-size:13px;margin-bottom:6px;">Нет данных анализов</div>
      <div style="font-size:11px;">Добавьте анализ листа, почвы или воды</div>
    </div>`;
    return;
  }

  // Group by type, show latest first
  const ICONS = {leaf:'🍃',soil:'🌱',water:'💧'};
  const LABELS = {leaf:'Анализ листа',soil:'Анализ почвы',water:'Анализ воды'};

  grid.innerHTML = analyses.map(an => {
    const icon = ICONS[an.type]||'🔬';
    const label = LABELS[an.type]||'Анализ';
    const cell = an.cellKey ? `${an.cellKey}${getCellColors(S.cells[an.cellKey])[0]?' — '+getCellColors(S.cells[an.cellKey])[0].name:''}` : 'Весь сад';

    // Build element rows based on type
    let elemRows = '';
    if (an.type === 'leaf') {
      const leafNorms = getNorms();
      elemRows = Object.entries(leafNorms).filter(([el])=>an[el]!==undefined).map(([el,n])=>{
        const val=an[el]; const st=val<n.min?'var(--red)':val>n.max?'var(--yellow)':'var(--accent)';
        return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border);">
          <span style="color:var(--text3);">${el} · ${n.name}</span>
          <span style="font-weight:700;color:${st};">${val} ${n.unit}</span>
        </div>`;
      }).join('');
    } else if (an.type === 'soil') {
      const keys = ['pH','OM','NO3','P','K','Ca','Mg'];
      elemRows = keys.filter(k=>an[k]!==undefined).map(k=>{
        const n=SOIL_NORMS[k]; const val=an[k];
        const st=n?(val<n.min?'var(--red)':val>n.max?'var(--yellow)':'var(--accent)'):'var(--text2)';
        return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border);">
          <span style="color:var(--text3);">${k} · ${n?.name||k}</span>
          <span style="font-weight:700;color:${st};">${val} ${n?.unit||''}</span>
        </div>`;
      }).join('');
    } else {
      const keys = ['pH','EC','TDS','Fe','Mn','B','Cl'];
      elemRows = keys.filter(k=>an[k]!==undefined).map(k=>{
        const n=WATER_NORMS[k]; const val=an[k];
        const st=n?(val<n.min?'var(--red)':val>n.max?'var(--yellow)':'var(--accent)'):'var(--text2)';
        return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border);">
          <span style="color:var(--text3);">${k} · ${n?.name||k}</span>
          <span style="font-weight:700;color:${st};">${val} ${n?.unit||''}</span>
        </div>`;
      }).join('');
    }

    return `<div class="an-card" style="cursor:default;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div>
          <div style="font-size:16px;">${icon}</div>
          <div style="font-size:11px;font-weight:700;color:var(--text2);">${label}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;font-family:'Unbounded',sans-serif;color:var(--text2);">${an.date}</div>
          <div style="font-size:10px;color:var(--text3);">${cell}</div>
          ${an.zoneId ? (() => {
            const zoneIds = an.zoneId.split(',').filter(Boolean);
            const zoneNames = zoneIds.map(zid=>(S.irrigation?.zones||[]).find(z=>z.id===zid)?.name||zid).filter(Boolean);
            return zoneNames.length ? `<div style="font-size:10px;color:var(--blue);">💧 ${zoneNames.join(', ')}</div>` : '';
          })() : ''}
          ${an.varietyId ? `<div style="font-size:10px;color:var(--accent);">🍒 ${S.varieties.find(v=>v.id===an.varietyId)?.name||''}</div>` : ''}
          ${an.depthCm ? `<div style="font-size:10px;color:var(--text3);">⬇️ ${an.depthCm}см</div>` : ''}
          ${an.lab?`<div style="font-size:10px;color:var(--text3);">${an.lab}</div>`:''}
          <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;justify-content:flex-end;">
            <button class="btn btn-secondary btn-xs" onclick="openAnalysisModal('${an.type}','${an.id}');event.stopPropagation();">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="deleteAnalysisById('${an.id}');event.stopPropagation();">🗑</button>
            ${an.type==='leaf'||an.type==='water' ? `<button class="btn btn-secondary btn-xs" style="color:var(--teal);" onclick="openFertCalcFromAnalysis('${an.id}');event.stopPropagation();">🌱 Фертигация</button>` : ''}
          </div>
        </div>
      </div>
      ${elemRows}
      ${an.note?`<div style="font-size:10px;color:var(--text3);margin-top:6px;">${an.note}</div>`:''}
      <!-- PDF блок -->
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">
        <div id="pdf-list-${an.id}" style="margin-bottom:6px;font-size:11px;color:var(--text3);">📎 Загрузка PDF...</div>
        <label style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);font-size:11px;cursor:pointer;color:var(--text2);">
          📎 Прикрепить PDF
          <input type="file" accept="application/pdf" style="display:none;" onchange="uploadAnalysisPdf('${an.id}',this)">
        </label>
      </div>
    </div>`;
  }).join('');
}

async function parseAnalysisFileWithAI(input) {
  const file = input.files[0];
  if(!file) return;

  const statusEl = document.getElementById('ai-parse-status');
  statusEl.style.display = 'block';
  statusEl.style.background = 'rgba(96,165,250,.08)';
  statusEl.style.border = '1px solid rgba(96,165,250,.2)';
  statusEl.style.color = 'var(--blue)';
  statusEl.innerHTML = `⏳ Читаю файл <strong>${file.name}</strong>...`;

  try {
    // Читаем файл как base64
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result.split(',')[1]);
      reader.onerror = () => rej(new Error('Ошибка чтения файла'));
      reader.readAsDataURL(file);
    });

    const ext = file.name.split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf';
    const isExcel = ['xls','xlsx','csv'].includes(ext);
    const isWord = ['doc','docx'].includes(ext);

    statusEl.innerHTML = `⏳ Анализирую через AI... Это займёт 10-30 секунд.`;

    // Формируем запрос к Claude
    const prompt = `Извлеки числовые значения из лабораторного протокола анализа и верни ТОЛЬКО валидный JSON без комментариев и markdown.

Формат ответа (только JSON, ничего лишнего):
{"type":"leaf","date":null,"lab":null,"values":{"N":null,"P":null,"K":null,"Ca":null,"Mg":null,"S":null,"Fe":null,"Mn":null,"Zn":null,"B":null,"Cu":null,"Mo":null,"pH":null,"EC":null,"NO3":null,"Na":null,"Cl":null,"OM":null,"CEC":null,"TDS":null,"SAR":null,"hard":null,"H2S":null}}

Правила:
- type: "leaf" если анализ листа, "soil" если почвы, "water" если воды
- date: формат YYYY-MM-DD если найдена дата, иначе null
- lab: название лаборатории если найдено, иначе null  
- values: числа с точкой как разделитель (не запятая), null если не найдено
- Верни ТОЛЬКО JSON без пояснений`;

    const messages = isPdf ? [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: prompt }
      ]
    }] : [{
      role: 'user',
      content: prompt + '\n\nСодержимое файла (base64): ' + base64.slice(0, 2000)
    }];

    // Вызов через сервер (Railway)
    const resp = await fetch('/api/ai/parse-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 1000, messages })
    });

    if (!resp.ok) throw new Error('AI недоступен: ' + resp.status);
    const data = await resp.json();

    if (!data) throw new Error('Нет ответа от AI');
    const text = data.content?.map(c=>c.text||'').join('') || '';

    // Парсим JSON из ответа
    let parsed;
    try {
      // Чистим markdown блоки и лишние символы
      let clean = text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // контрольные символы
        .trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if(!jsonMatch) throw new Error('JSON не найден');
      parsed = JSON.parse(jsonMatch[0]);
    } catch(parseErr) {
      // Пробуем извлечь значения напрямую из текста через regex
      console.warn('[AI Parse] JSON error, trying regex extraction:', parseErr.message);
      parsed = { type: 'leaf', values: {} };
      const pairs = [
        ['N','N'], ['P','P'], ['K','K'], ['Ca','Ca'], ['Mg','Mg'],
        ['Fe','Fe'], ['B','B'], ['pH','pH'], ['EC','EC'], ['NO3','NO3'],
        ['Na','Na'], ['Mn','Mn'], ['Zn','Zn'], ['Cu','Cu'], ['S','S']
      ];
      pairs.forEach(([key]) => {
        const m = text.match(new RegExp(`"${key}"\\s*:\\s*([0-9]+\\.?[0-9]*)`));
        if(m) parsed.values[key] = parseFloat(m[1]);
      });
      // Тип анализа
      if(text.includes('"water"')) parsed.type = 'water';
      else if(text.includes('"soil"')) parsed.type = 'soil';
      // Дата
      const dateM = text.match(/(\d{4}-\d{2}-\d{2})/);
      if(dateM) parsed.date = dateM[1];
    }
    const vals = parsed.values || {};

    // Заполняем поля модала
    let filled = 0;

    // Определяем тип анализа
    if(parsed.type) switchAnModalTab(parsed.type);

    // Дата и лаборатория
    if(parsed.date) document.getElementById('a-date').value = parsed.date;
    if(parsed.lab) document.getElementById('a-lab').value = parsed.lab;

    // Поля листа
    ['N','P','K','Ca','Mg','S','Fe','Mn','Zn','B','Cu','Mo'].forEach(f => {
      const el = document.getElementById('a-'+f);
      if(el && vals[f] != null) { el.value = vals[f]; filled++; }
    });

    // Поля почвы
    ['pH','OM','CEC','NO3','K','Ca','Mg','B','Fe','Mn','Zn','Cu'].forEach(f => {
      const el = document.getElementById('s-'+f);
      if(el && vals[f] != null) { el.value = vals[f]; filled++; }
    });

    // Поля воды
    ['pH','EC','TDS','hard','SAR','Cl','NO3','Ca','Mg','Na','B','Fe','Mn','H2S'].forEach(f => {
      const el = document.getElementById('w-'+f);
      if(el && vals[f] != null) { el.value = vals[f]; filled++; }
    });

    statusEl.style.background = 'rgba(74,222,128,.08)';
    statusEl.style.border = '1px solid rgba(74,222,128,.2)';
    statusEl.style.color = 'var(--accent)';
    statusEl.innerHTML = `✅ AI заполнил <strong>${filled} полей</strong> из файла <strong>${file.name}</strong>. Проверьте и скорректируйте данные.`;

  } catch(e) {
    statusEl.style.background = 'rgba(220,38,38,.08)';
    statusEl.style.border = '1px solid rgba(220,38,38,.2)';
    statusEl.style.color = 'var(--red)';
    statusEl.innerHTML = `❌ Ошибка: ${e.message}. Попробуйте другой файл или заполните вручную.`;
  }

  input.value = '';
}

function deleteAnalysisById(id) {
  if(!confirm('Удалить анализ?')) return;
  S.analyses = S.analyses.filter(a => String(a.id) !== String(id));
  save();
  renderAnalysis();
}

function openFertCalcFromAnalysis(analysisId) {
  const an = S.analyses.find(a=>String(a.id)===String(analysisId));
  if(!an) return;
  // Переключаемся на фертигацию
  const irrigTab = document.querySelector('.tab[onclick*="irrigation"]');
  if(irrigTab) switchTab('irrigation', irrigTab);
  setTimeout(()=>{
    switchIrrigSub('fertigation');
    setTimeout(()=>{
      openFertCalcModal();
      setTimeout(()=>{
        // Устанавливаем зону если есть
        if(an.zoneId) {
          const zSel = document.getElementById('fc-zone');
          if(zSel) zSel.value = an.zoneId;
          onFertCalcZoneChange();
        }
        // Показываем сообщение
        const res = document.getElementById('fc-result');
        if(res) {
          res.style.display = 'block';
          res.innerHTML = `<div style="padding:10px;background:rgba(74,222,128,.06);border-radius:8px;font-size:11px;color:var(--text3);margin-bottom:10px;">
            📊 Загружен анализ ${an.type==='leaf'?'листа':'воды'} от ${an.date}
            ${an.cellKey?` · Клетка: ${an.cellKey}`:''}
            ${an.zoneId?` · Зона: ${(S.irrigation?.zones||[]).find(z=>z.id===an.zoneId)?.name||''}` :''}
            <br>Нажмите "🧮 Рассчитать" чтобы получить программу фертигации с учётом данных анализа.
          </div>`;
        }
      }, 300);
    }, 200);
  }, 300);
}

// ═══ PDF АНАЛИЗОВ ════════════════════════════════════════════════════════

async function loadAnalysisPdfs(analysisId) {
  const el = document.getElementById(`pdf-list-${analysisId}`);
  if(!el) return;
  try {
    const r = await fetch(`/api/analyses/${analysisId}/pdfs`);
    if(!r.ok) { el.innerHTML = ''; return; }
    const data = await r.json();
    const files = data.files || [];
    if(!files.length) {
      el.innerHTML = '<span style="color:var(--text3);font-size:11px;">PDF не прикреплены</span>';
      return;
    }
    el.innerHTML = files.map(f=>`
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
        <a href="/api/analyses/${analysisId}/pdfs/${f.id}/download" target="_blank"
          style="font-size:11px;color:var(--blue);text-decoration:none;">
          📄 ${f.filename}
        </a>
        <span style="font-size:10px;color:var(--text3);">(${(f.size/1024).toFixed(0)} KB · ${f.uploaded_at?.slice(0,10)||''})</span>
        <button onclick="deleteAnalysisPdf('${analysisId}','${f.id}')"
          style="border:none;background:none;color:var(--red);cursor:pointer;font-size:11px;padding:0;">🗑</button>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = '';
  }
}

async function uploadAnalysisPdf(analysisId, input) {
  const file = input.files[0];
  if(!file) return;
  const el = document.getElementById(`pdf-list-${analysisId}`);
  if(el) el.innerHTML = '<span style="color:var(--text3);font-size:11px;">⏳ Загружаю...</span>';
  try {
    const r = await fetch(`/api/analyses/${analysisId}/pdfs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'X-Filename': encodeURIComponent(file.name),
      },
      body: file,
    });
    const data = await r.json();
    if(data.ok) {
      await loadAnalysisPdfs(analysisId);
    } else {
      if(el) el.innerHTML = `<span style="color:var(--red);font-size:11px;">❌ ${data.error||'Ошибка'}</span>`;
    }
  } catch(e) {
    if(el) el.innerHTML = `<span style="color:var(--red);font-size:11px;">❌ ${e.message}</span>`;
  }
  input.value = '';
}

async function deleteAnalysisPdf(analysisId, fileId) {
  if(!confirm('Удалить PDF?')) return;
  try {
    await fetch(`/api/analyses/${analysisId}/pdfs/${fileId}`, {method:'DELETE'});
    await loadAnalysisPdfs(analysisId);
  } catch(e) { console.error(e); }
}

// Загружаем PDF списки после рендера анализов
function loadAllAnalysisPdfs() {
  (S.analyses||[]).forEach(an => loadAnalysisPdfs(an.id));
}

// ===================== DISEASES =====================
const TYPE_DIS={fungal:'🍄 Грибковое',insect:'🪲 Насекомое',bacterial:'🦠 Бактериальное',other:'❓ Другое'};
const PHASE_DIS={all:'Весь сезон',flowering:'Цветение',fruitset:'Завязь',ripening:'Созревание',postharvest:'После сбора'};

// Calculate disease risk score 0-100 based on weather
function calcDiseaseRisk(dc) {
  const latest = S.weather[0];
  if (!latest) return {score:0, reason:'Нет данных о погоде'};
  const tmin = parseFloat(latest.tmin)??null;
  const tmax = parseFloat(latest.tmax)??null;
  const avg = (tmin!==null&&tmax!==null)?(tmin+tmax)/2:(tmin||tmax||null);
  const precip = parseFloat(latest.precip)||0;
  const hum = parseFloat(latest.humidity)||0;
  if (avg===null) return {score:0, reason:'Нет данных о температуре'};

  let score = 0;
  const reasons = [];

  // Temperature factor
  if (avg >= dc.tmin && avg <= dc.tmax) {
    const tRange = dc.tmax - dc.tmin;
    const tScore = tRange > 0 ? (1 - Math.abs(avg - dc.topt) / (tRange/2)) : 1;
    score += Math.max(0, tScore) * 50;
    if (avg >= dc.topt - 5 && avg <= dc.topt + 5) reasons.push(`🌡️ T°${avg.toFixed(0)}°C — оптимум для развития`);
    else reasons.push(`🌡️ T°${avg.toFixed(0)}°C — в зоне риска`);
  } else {
    reasons.push(`🌡️ T°${avg.toFixed(0)}°C — вне зоны риска (${dc.tmin}–${dc.tmax}°C)`);
    return {score:5, reason: reasons.join(' · ')};
  }

  // Humidity factor
  if (hum >= dc.hmin) {
    score += 25;
    reasons.push(`💧 Влажность ${hum}% ≥ ${dc.hmin}%`);
  } else if (dc.hmin > 0 && hum > 0) {
    score += (hum / dc.hmin) * 15;
  }

  // Rain days factor
  if (dc.rainDays > 0) {
    const recentRainDays = S.weather.slice(0,5).filter(w=>parseFloat(w.precip||0)>1).length;
    if (recentRainDays >= dc.rainDays) {
      score += 25;
      reasons.push(`🌧️ ${recentRainDays} дней дождей подряд`);
    } else if (recentRainDays > 0) {
      score += (recentRainDays/dc.rainDays)*15;
    }
  }

  // Precipitation today
  if (precip > 5) { score += 10; reasons.push(`🌧️ Сегодня ${precip}мм`); }

  score = Math.min(100, Math.round(score));
  return {score, reason: reasons.join(' · ') || 'Условия умеренные'};
}

function getRiskLabel(score) {
  if (score >= 80) return {label:'🔴 Критический',cls:'critical',color:'var(--red)'};
  if (score >= 55) return {label:'🟠 Высокий',cls:'high',color:'var(--orange)'};
  if (score >= 30) return {label:'🟡 Средний',cls:'medium',color:'var(--yellow)'};
  return {label:'🟢 Низкий',cls:'low',color:'var(--accent)'};
}

function switchDisTab(tab, el) {
  document.querySelectorAll('.dis-subtab').forEach(t=>{
    t.style.color='var(--text3)'; t.style.borderBottomColor='transparent';
  });
  el.style.color='var(--accent)'; el.style.borderBottomColor='var(--accent)';
  document.getElementById('dis-panel-risk').style.display = tab==='risk'?'block':'none';
  document.getElementById('dis-panel-log').style.display = tab==='log'?'block':'none';
  if(tab==='log'){popDFilter();renderDiseases();}
  if(tab==='risk')renderDiseaseRisks();
}

let _diseaseCropFilter = 'all';

function renderDiseaseCropTabs() {
  const tabsEl = document.getElementById('disease-crop-tabs');
  if (!tabsEl) return;
  const gardenCropIds = [...new Set(Object.values(S.cells).map(cd=>cd?.cropId||'crop_cherry'))];
  const allCropIds = gardenCropIds.length ? gardenCropIds : ['crop_cherry'];
  tabsEl.innerHTML = `
    <button onclick="selectDiseaseCrop('all')" class="btn btn-sm ${_diseaseCropFilter==='all'?'btn-primary':'btn-secondary'}">🌿 Все культуры</button>
    ${allCropIds.map(cid=>{
      const crop=getCropById(cid);if(!crop)return'';
      const count=S.diseaseCatalog.filter(dc=>!dc.cropIds||dc.cropIds.includes(cid)).length;
      const isActive=_diseaseCropFilter===cid;
      return `<button onclick="selectDiseaseCrop('${cid}')" class="btn btn-sm ${isActive?'btn-primary':'btn-secondary'}" style="display:flex;align-items:center;gap:5px;">
        <span style="font-size:14px;">${crop.emoji||'🌱'}</span>${crop.name}
        <span style="font-size:10px;padding:1px 5px;border-radius:8px;background:rgba(74,222,128,.15);color:var(--accent);">${count}</span>
      </button>`;
    }).filter(Boolean).join('')}`;
}

function selectDiseaseCrop(cropId) {
  _diseaseCropFilter=cropId;
  renderDiseaseCropTabs();
  renderDiseaseRisks();
}

function buildDiseaseCard(dc) {
  const r=dc._risk; const rl=getRiskLabel(r.score);
  const cropBadge=dc.cropIds?dc.cropIds.map(cid=>{const c=getCropById(cid);return c?`<span>${c.emoji||''}</span>`:''}).join(''):'';
  return `<div class="dis-card" style="border-left-color:${rl.color};">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
      <div><div style="font-weight:700;font-size:13px;">${dc.name} ${cropBadge}</div>
      <div style="font-size:10px;color:var(--text3);font-style:italic;">${dc.latin||''}</div></div>
      <span class="risk-badge ${rl.cls}">${rl.label}</span>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-bottom:6px;">${TYPE_DIS[dc.type]||dc.type} · ${PHASE_DIS[dc.phase]||'Весь сезон'}</div>
    <div class="risk-meter"><div class="risk-meter-fill" style="width:${r.score}%;background:${rl.color};"></div></div>
    <div style="font-size:10px;color:var(--text2);margin-top:4px;margin-bottom:8px;">${r.reason}</div>
    ${r.score>=30?`<div style="padding:8px 10px;background:rgba(239,68,68,.07);border-radius:6px;border:1px solid rgba(239,68,68,.2);margin-bottom:8px;">
      <div style="font-size:10px;font-weight:700;color:var(--red);margin-bottom:3px;">⚠️ РЕКОМЕНДАЦИЯ</div>
      <div style="font-size:11px;color:var(--text2);">${dc.prevention||'—'}</div>
      ${dc.products?`<div style="font-size:11px;color:var(--accent2);margin-top:4px;">💊 ${dc.products}</div>`:''}
    </div>`:''}
    ${dc.symptoms?`<details style="font-size:11px;color:var(--text3);cursor:pointer;"><summary style="color:var(--text2);margin-bottom:4px;">Симптомы</summary>${dc.symptoms}</details>`:''}
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-secondary btn-xs" onclick="openDiseaseCatEditModal('${dc.id}')">✏️ Пороги</button>
      <button class="btn btn-primary btn-xs" onclick="logDiseaseFromCatalog('${dc.id}')">📋 Зафиксировать</button>
    </div>
  </div>`;
}

function renderDiseaseRisks() {
  renderDiseaseCropTabs();
  const grid = document.getElementById('disease-risk-grid');
  const gardenCropIds = [...new Set(Object.values(S.cells).map(cd=>cd?.cropId||'crop_cherry'))];

  // Filter by selected crop
  let catalog = S.diseaseCatalog;
  if (_diseaseCropFilter && _diseaseCropFilter !== 'all') {
    catalog = catalog.filter(dc => !dc.cropIds || dc.cropIds.includes(_diseaseCropFilter));
  }

  const sorted = catalog.map(dc=>({...dc, _risk:calcDiseaseRisk(dc)}))
    .sort((a,b)=>b._risk.score-a._risk.score);

  let html = '';
  if (_diseaseCropFilter === 'all' && gardenCropIds.length > 1) {
    // Group by crop
    gardenCropIds.forEach(cid => {
      const crop = getCropById(cid);
      const cropDiseases = sorted.filter(dc => !dc.cropIds || dc.cropIds.includes(cid));
      if (!cropDiseases.length) return;
      html += `<div style="grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:10px 0 8px;border-bottom:1px solid var(--border);margin-bottom:6px;">
        <span style="font-size:20px;">${crop?.emoji||'🌱'}</span>
        <span style="font-family:'Unbounded',sans-serif;font-size:11px;color:var(--accent2);text-transform:uppercase;letter-spacing:2px;">${crop?.name||cid}</span>
        <span style="font-size:11px;color:var(--text3);">${cropDiseases.length} болезней</span>
      </div>`;
      html += cropDiseases.map(dc=>buildDiseaseCard(dc)).join('');
    });
  } else {
    html = sorted.map(dc=>buildDiseaseCard(dc)).join('');
  }
  grid.innerHTML = html || `<div style="color:var(--text3);font-size:12px;padding:20px;grid-column:1/-1;">Нет болезней для выбранной культуры.</div>`;

  // Update top dashboard
  const highRisk = sorted.filter(d=>d._risk.score>=55);
  const dash = document.getElementById('disease-risk-dashboard');
  if (!S.weather.length) {
    dash.innerHTML=`<div style="padding:12px 16px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:8px;font-size:12px;color:var(--yellow);">⚠️ Добавьте данные о погоде во вкладке 🌡️ Погода — расчёт рисков будет автоматическим</div>`;
  } else if (highRisk.length) {
    dash.innerHTML=`<div style="padding:12px 16px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;margin-bottom:4px;">
      <div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:6px;">🚨 Высокий риск при текущей погоде (${S.weather[0].date}):</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${highRisk.map(d=>`<span class="risk-badge ${getRiskLabel(d._risk.score).cls}">${d.name} ${d._risk.score}%</span>`).join('')}
      </div>
    </div>`;
  } else {
    dash.innerHTML=`<div style="padding:10px 16px;background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.2);border-radius:8px;font-size:12px;color:var(--accent);">✅ Риски болезней низкие при текущих погодных условиях (${S.weather[0].date})</div>`;
  }
}

// Disease catalog CRUD
let editingDisCatId = null;
function openDiseaseCatEditModal(id) {
  editingDisCatId = id || null;
  const dc = id ? S.diseaseCatalog.find(d=>d.id===id) : null;
  document.getElementById('dcat-edit-title').textContent = dc ? `✏️ ${dc.name}` : '📋 Новая болезнь';
  document.getElementById('dce-del-btn').style.display = dc ? 'inline-flex':'none';
  document.getElementById('dce-name').value = dc?.name||'';
  document.getElementById('dce-latin').value = dc?.latin||'';
  document.getElementById('dce-type').value = dc?.type||'fungal';
  document.getElementById('dce-danger').value = dc?.danger||3;
  document.getElementById('dce-tmin').value = dc?.tmin??'';
  document.getElementById('dce-tmax').value = dc?.tmax??'';
  document.getElementById('dce-topt').value = dc?.topt??'';
  document.getElementById('dce-hmin').value = dc?.hmin??'';
  document.getElementById('dce-raindays').value = dc?.rainDays??'';
  document.getElementById('dce-phase').value = dc?.phase||'all';
  document.getElementById('dce-symptoms').value = dc?.symptoms||'';
  document.getElementById('dce-products').value = dc?.products||'';
  document.getElementById('dce-prevention').value = dc?.prevention||'';
  closeModal('modal-disease-catalog');
  openModal('modal-dcat-edit');
}
function saveDiseaseCat() {
  const name = document.getElementById('dce-name').value.trim();
  if (!name) {alert('Введите название');return;}
  const entry = {
    id: editingDisCatId||('dc'+Date.now()),
    name, latin:document.getElementById('dce-latin').value,
    type:document.getElementById('dce-type').value,
    danger:parseInt(document.getElementById('dce-danger').value)||3,
    tmin:parseFloat(document.getElementById('dce-tmin').value)||0,
    tmax:parseFloat(document.getElementById('dce-tmax').value)||35,
    topt:parseFloat(document.getElementById('dce-topt').value)||20,
    hmin:parseFloat(document.getElementById('dce-hmin').value)||0,
    rainDays:parseInt(document.getElementById('dce-raindays').value)||0,
    phase:document.getElementById('dce-phase').value,
    symptoms:document.getElementById('dce-symptoms').value,
    products:document.getElementById('dce-products').value,
    prevention:document.getElementById('dce-prevention').value,
  };
  if (editingDisCatId) {
    const i = S.diseaseCatalog.findIndex(d=>d.id===editingDisCatId);
    if(i>=0) S.diseaseCatalog[i]=entry; else S.diseaseCatalog.push(entry);
  } else {
    S.diseaseCatalog.push(entry);
  }
  save(); closeModal('modal-dcat-edit');
  openModal('modal-disease-catalog'); renderDiseaseCatalog();
}
function deleteDiseaseCat() {
  if(!editingDisCatId) return;
  if(!confirm('Удалить из справочника?')) return;
  S.diseaseCatalog = S.diseaseCatalog.filter(d=>d.id!==editingDisCatId);
  save(); closeModal('modal-dcat-edit');
  openModal('modal-disease-catalog'); renderDiseaseCatalog();
}
function renderDiseaseCatalog() {
  const search = document.getElementById('dcat-search').value.toLowerCase();
  const type = document.getElementById('dcat-type').value;
  const list = S.diseaseCatalog.filter(dc=>{
    if(type && dc.type!==type) return false;
    if(search && !dc.name.toLowerCase().includes(search) && !(dc.latin||'').toLowerCase().includes(search)) return false;
    return true;
  });
  const grid = document.getElementById('disease-cat-grid');
  grid.innerHTML = list.map(dc=>{
    const r = calcDiseaseRisk(dc);
    const rl = getRiskLabel(r.score);
    return `<div class="disease-cat-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div>
          <div class="dc-name">${dc.name}</div>
          <div class="dc-latin">${dc.latin||''}</div>
        </div>
        <span class="risk-badge ${rl.cls}" style="flex-shrink:0;">${rl.label}</span>
      </div>
      <div class="dc-row"><span class="dc-lbl">Тип</span><span>${TYPE_DIS[dc.type]||dc.type}</span></div>
      <div class="dc-row"><span class="dc-lbl">Т° развития</span><span>${dc.tmin}°…${dc.tmax}°C (опт. ${dc.topt}°C)</span></div>
      <div class="dc-row"><span class="dc-lbl">Влажность</span><span>≥${dc.hmin}%</span></div>
      <div class="dc-row"><span class="dc-lbl">Дней дождей</span><span>≥${dc.rainDays}</span></div>
      <div class="dc-row"><span class="dc-lbl">Фаза риска</span><span>${PHASE_DIS[dc.phase]||'—'}</span></div>
      ${dc.products?`<div class="dc-row"><span class="dc-lbl">Препараты</span><span style="color:var(--accent2);font-size:11px;">${dc.products}</span></div>`:''}
      <div style="margin-top:10px;display:flex;gap:6px;">
        <button class="btn btn-secondary btn-xs" onclick="openDiseaseCatEditModal('${dc.id}')">✏️ Изменить</button>
        <button class="btn btn-primary btn-xs" onclick="logDiseaseFromCatalog('${dc.id}')">📋 Зафиксировать</button>
      </div>
    </div>`;
  }).join('');
}

function logDiseaseFromCatalog(id) {
  const dc = S.diseaseCatalog.find(d=>d.id===id);
  closeModal('modal-disease-catalog');
  openDiseaseModal(dc);
}

function openDiseaseModal(prefill) {
  document.getElementById('d-date').value=new Date().toISOString().split('T')[0];
  const sel=document.getElementById('d-cell');sel.innerHTML='<option value="">Весь сад</option>';
  Object.keys(S.cells).forEach(k=>{const colors=getCellColors(S.cells[k]);sel.innerHTML+=`<option value="${k}">${k}${colors[0]?' — '+colors[0].name:''}</option>`;});
  if(prefill) {
    document.getElementById('d-name').value = prefill.name||'';
    document.getElementById('d-rec').value = prefill.products||'';
    document.getElementById('d-desc').value = prefill.symptoms||'';
    document.getElementById('d-sev').value = '2';
  } else {
    document.getElementById('d-name').value='';
    document.getElementById('d-rec').value='';
    document.getElementById('d-desc').value='';
    document.getElementById('d-sev').value='2';
  }
  openModal('modal-disease');
}
function popDFilter(){
  const sel=document.getElementById('df-filter');const cur=sel.value;sel.innerHTML='<option value="">Все клетки</option>';
  Object.keys(S.cells).forEach(k=>{const colors=getCellColors(S.cells[k]);sel.innerHTML+=`<option value="${k}" ${cur===k?'selected':''}>${k}${colors[0]?' — '+colors[0].name:''}</option>`;});
  renderDiseaseCropTabs();
}
function saveDisease(){
  S.diseases.unshift({id:Date.now(),date:document.getElementById('d-date').value,cellKey:document.getElementById('d-cell').value,name:document.getElementById('d-name').value,severity:parseInt(document.getElementById('d-sev').value),description:document.getElementById('d-desc').value,recommendation:document.getElementById('d-rec').value});
  save();closeModal('modal-disease');renderDiseases();renderMap();
}
function renderDiseases(){
  const grid=document.getElementById('dis-grid');const f=document.getElementById('df-filter').value;
  let dis=S.diseases.filter(d=>!f||d.cellKey===f||d.cellKey==='');
  if(document.getElementById('ds-filter').value==='sev')dis.sort((a,b)=>b.severity-a.severity);
  const sc=['','#4ade80','#4ade80','#fbbf24','#fb923c','#ef4444'];
  grid.innerHTML=dis.map((d,i)=>{const colors=d.cellKey?getCellColors(S.cells[d.cellKey]||{}):[];
    return`<div class="dis-card sev${d.severity}"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div style="font-weight:700;font-size:13px;">${d.name}</div><button class="btn btn-danger btn-xs" onclick="delDis(${i})">✕</button></div><div style="font-size:11px;color:var(--text3);margin-top:3px;">${d.date} · ${d.cellKey||'Весь сад'}${colors[0]?' · '+colors[0].name:''}</div><div style="display:flex;gap:3px;margin-top:8px;">${[1,2,3,4,5].map(n=>`<div style="width:20px;height:7px;border-radius:2px;background:${n<=d.severity?sc[d.severity]:'var(--surface3)'};"></div>`).join('')}<span style="font-size:10px;color:var(--text3);margin-left:4px;">Степень ${d.severity}/5</span></div>${d.description?`<div style="font-size:11px;color:var(--text2);margin-top:6px;">${d.description}</div>`:''}${d.recommendation?`<div style="font-size:11px;color:var(--accent2);margin-top:4px;">💊 ${d.recommendation}</div>`:''}</div>`;
  }).join('')||'<div style="color:var(--text3);">Нет зафиксированных случаев</div>';
}
function delDis(i){S.diseases.splice(i,1);save();renderDiseases();}

// ===================== DOSES =====================
// Norms from Guy Sela book, Appendix II — Cherry 15 t/ha
const CHERRY_NORMS = {
  annual: { N:125, P2O5:55, K2O:155, Ca:50, Mg:20 }, // kg/ha per year
  // N:K ratio by phase (from Chapter 4, Sela)
  phaseRatio: {
    'Покой':              { N:0,   P:0,   K:0,   Ca:0,   note:'Покой — удобрения не нужны' },
    'Набухание почек':    { N:0.25,P:0.10,K:0.10,Ca:0.05,note:'Старт вегетации — акцент на N' },
    'Зелёный конус':      { N:0.15,P:0.10,K:0.10,Ca:0.05,note:'Продолжение вегетации' },
    'Розовый бутон':      { N:0.10,P:0.10,K:0.10,Ca:0.10,note:'Подготовка к цветению — Ca важен' },
    'Цветение':           { N:0.05,P:0.05,K:0.05,Ca:0.15,note:'Цветение — акцент Ca и B, N минимум' },
    'Завязь':             { N:0.10,P:0.10,K:0.10,Ca:0.20,note:'Завязь — Ca критичен против растрескивания' },
    'Рост плода':         { N:0.15,P:0.15,K:0.20,Ca:0.20,note:'Рост — K и Ca важны для плода' },
    'Начало окрашивания': { N:0.05,P:0.15,K:0.20,Ca:0.15,note:'Окрашивание — K увеличивает плотность и цвет' },
    'Созревание':         { N:0.05,P:0.15,K:0.15,Ca:0.10,note:'Созревание — минимум N, K для качества' },
    'После сбора':        { N:0.10,P:0.10,K:0,   Ca:0,   note:'После сбора — N для восстановления' },
  },
  // Fertilizer compatibility matrix (Sela Ch.5)
  incompatible: {
    'Ca-нитрат':      ['Фосфаты','MAP','DAP','Сульфаты','Сульфат аммония'],
    'Монофосфат калия':['Ca-нитрат','Кальций'],
    'Фосфорная кислота':['Ca-нитрат','Кальций','Сульфаты'],
    'MAP NP':         ['Ca-нитрат','Кальций'],
  }
};

function popDoseSelects(){
  const cs=document.getElementById('dose-cell');cs.innerHTML='<option value="">— весь сад —</option>';
  Object.keys(S.cells).forEach(k=>{const colors=getCellColors(S.cells[k]);cs.innerHTML+=`<option value="${k}">${k}${colors[0]?' — '+colors[0].name:''}</option>`;});
  const ps=document.getElementById('dose-prod');ps.innerHTML='<option value="">— выбрать препарат —</option>';
  [...new Set(S.treatments.map(t=>t.product).filter(Boolean))].sort().forEach(p=>ps.innerHTML+=`<option>${p}</option>`);
  // Also populate from catalog
  S.catalog.forEach(p=>{if(!ps.querySelector(`option[value="${p.name}"]`)) ps.innerHTML+=`<option value="${p.name}">${p.name}</option>`;});
  calcDose();
}

function calcDose(){
  const cellKey=document.getElementById('dose-cell').value;
  const product=document.getElementById('dose-prod').value;
  const cd=cellKey?S.cells[cellKey]:null;
  const totals=cd?calcCellTotals(cd):{totalHa:0,totalTrees:0,byVariety:{}};

  // Get current GDD phase for dose advice
  const tbase=5; const gdd=getCurrentGdd(tbase);
  const firstVarietyId = S.varieties[0]?.id;
  const currentPhase = firstVarietyId ? getPhaseByGdd(firstVarietyId, gdd) : null;
  const phaseRatio = currentPhase ? CHERRY_NORMS.phaseRatio[currentPhase.name] : null;

  // Find product in treatments or catalog
  const tr = product ? (S.treatments.find(t=>t.product===product) || S.catalog.find(c=>c.name===product)) : null;
  const catalogItem = product ? S.catalog.find(c=>c.name===product) : null;
  const bd = tr ? (parseFloat(tr.dose)||0) : 0;
  const water = parseFloat(tr?.water)||400;
  const method = tr?.method || catalogItem?.method || 'foliar';
  const compat = catalogItem?.compatibility || tr?.compatibility || '';

  let html = '';

  // === Area & trees ===
  if(cd || !cellKey) {
    const ha = cd ? totals.totalHa : null;
    html += `<div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">📐 Площадь</div>`;
    if(cd) {
      html += `<div class="dose-row"><span class="dose-lbl">Клетка</span><span class="dose-val">${cellKey}</span></div>`;
      html += `<div class="dose-row"><span class="dose-lbl">Площадь</span><span class="dose-val" style="color:var(--accent);font-family:'Unbounded',sans-serif;">${totals.totalHa.toFixed(3)} га</span></div>`;
      html += `<div class="dose-row"><span class="dose-lbl">Деревьев</span><span class="dose-val">${totals.totalTrees} шт.</span></div>`;
    }
  }

  // === Product dose ===
  if(tr || product) {
    html += `<div style="height:1px;background:var(--border);margin:10px 0;"></div>`;
    html += `<div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">💊 Препарат</div>`;
    html += `<div class="dose-row"><span class="dose-lbl">Название</span><span class="dose-val" style="font-size:12px;font-weight:600;">${product}</span></div>`;
    if(tr?.activeSubstance) html += `<div class="dose-row"><span class="dose-lbl">Активное в-во</span><span class="dose-val" style="font-size:11px;">${tr.activeSubstance}</span></div>`;
    if(method) html += `<div class="dose-row"><span class="dose-lbl">Способ</span><span class="dose-val">${{foliar:'🌿 Листовая',drip:'💧 Капельное',soil:'🌱 В почву',trunk:'🌳 Прикорневое',any:'🔄 Любой'}[method]||method}</span></div>`;
    if(bd>0) {
      html += `<div class="dose-row"><span class="dose-lbl">Доза на га</span><span class="dose-val" style="color:var(--accent);font-weight:700;">${bd} л/кг</span></div>`;
      if(method==='foliar'&&water>0) html += `<div class="dose-row"><span class="dose-lbl">Вода на га</span><span class="dose-val">${water} л</span></div>`;
      if(cd&&totals.totalHa>0) {
        const totalProd = bd*totals.totalHa;
        const totalWater = method==='foliar' ? water*totals.totalHa : 0;
        html += `<div style="margin-top:10px;padding:12px;background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.2);border-radius:8px;">`;
        html += `<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-family:'Unbounded',sans-serif;">Итого на ${totals.totalHa.toFixed(3)} га</div>`;
        html += `<div class="dose-row"><span class="dose-lbl">Препарата</span><span class="dose-val" style="color:var(--accent);font-family:'Unbounded',sans-serif;font-size:16px;">${totalProd.toFixed(2)} л/кг</span></div>`;
        if(totalWater>0) html += `<div class="dose-row"><span class="dose-lbl">Воды</span><span class="dose-val" style="color:var(--blue);font-family:'Unbounded',sans-serif;">${Math.round(totalWater)} л</span></div>`;
        html += `</div>`;
      }
    }
    // Compatibility warning (Sela Ch.5)
    if(compat) {
      html += `<div style="margin-top:10px;padding:10px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:8px;">
        <div style="font-size:10px;font-weight:700;color:var(--red);margin-bottom:4px;">🚫 Не смешивать (несовместимость)</div>
        <div style="font-size:11px;color:var(--text2);">${compat}</div>
      </div>`;
    }
  }

  // === Phase N:K recommendation ===
  if(phaseRatio && cd && totals.totalHa > 0) {
    html += `<div style="height:1px;background:var(--border);margin:10px 0;"></div>`;
    html += `<div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">📖 Рекомендации по фазе GDD (Sela)</div>`;
    html += `<div style="padding:10px 12px;background:var(--surface2);border-radius:8px;border-left:3px solid ${currentPhase?.color||'var(--accent)'};">`;
    html += `<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:${currentPhase?.color||'var(--accent)'};">🌱 ${currentPhase?.name || '—'}</div>`;
    html += `<div style="font-size:11px;color:var(--text3);margin-bottom:10px;">${phaseRatio.note}</div>`;
    const N = CHERRY_NORMS.annual;
    html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:6px;margin-bottom:8px;">`;
    [['N',phaseRatio.N,N.N,'var(--accent)'],['P₂O₅',phaseRatio.P,N.P2O5,'var(--blue)'],['K₂O',phaseRatio.K,N.K2O,'var(--yellow)'],['Ca',phaseRatio.Ca,N.Ca,'var(--orange)']].forEach(([el,pct,total,col])=>{
      const kg = Math.round(pct*total*totals.totalHa*10)/10;
      html += `<div style="text-align:center;padding:8px 4px;background:var(--surface3);border-radius:6px;">
        <div style="font-size:9px;color:var(--text3);margin-bottom:3px;">${el}</div>
        <div style="font-family:'Unbounded',sans-serif;font-size:13px;font-weight:700;color:${col};">${kg}</div>
        <div style="font-size:9px;color:var(--text3);">кг</div>
      </div>`;
    });
    html += `</div>`;
    html += `<div style="font-size:10px;color:var(--text3);">Расчётная потребность для ${totals.totalHa.toFixed(3)} га в этой фазе (${Math.round(phaseRatio.N*100)}% годовой нормы N)</div>`;
    html += `</div>`;
  } else if(!currentPhase && S.varieties.length) {
    html += `<div style="margin-top:10px;padding:10px;background:var(--surface2);border-radius:8px;font-size:11px;color:var(--text3);">📈 Выберите сорт в GDD для получения рекомендаций по фазам</div>`;
  }

  // === Foliar conditions check ===
  const latest = S.weather[0];
  if(latest && method==='foliar') {
    const tmax = parseFloat(latest.tmax)||0;
    const hum = parseFloat(latest.humidity)||0;
    const warns = [];
    if(tmax>=30) warns.push(`🔥 T° ${tmax}°C — поглощение через лист снижено. Обрабатывать до 9:00 или после 18:00`);
    if(hum>=90) warns.push(`💧 Влажность ${hum}% — риск ожогов. Снизить концентрацию`);
    if(tmax<10) warns.push(`🥶 T° ${tmax}°C — листовое питание малоэффективно. Ждать потепления выше +10°C`);
    if(warns.length) {
      html += `<div style="margin-top:10px;padding:10px;background:rgba(251,191,36,.07);border:1px solid rgba(251,191,36,.2);border-radius:8px;">`;
      html += `<div style="font-size:10px;font-weight:700;color:var(--yellow);margin-bottom:5px;">⚠️ Условия листового питания сегодня</div>`;
      warns.forEach(w=>{ html+=`<div style="font-size:11px;color:var(--text2);margin-bottom:3px;">${w}</div>`; });
      html += `</div>`;
    }
  }

  if(!product && !cd) {
    html = `<div style="color:var(--text3);text-align:center;padding:30px;font-size:12px;">Выберите клетку и/или препарат</div>`;
  }

  if(html) html += `<div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:8px;font-size:10px;color:var(--text3);">📖 Нормы черешни — Guy Sela, Приложение II. Уточняйте по инструкции препарата и анализу почвы.</div>`;
  document.getElementById('dose-result').innerHTML=html||`<div style="color:var(--text3);padding:20px;text-align:center;">Нет данных</div>`;
}

// ═══ AI АГРОНОМ-СОВЕТНИК ════════════════════════════════════════════════

async function runAIPhotoAnalysis(input) {
  const file = input.files[0];
  if(!file) return;

  const resultEl = document.getElementById('ai-advisor-result');
  const label = document.getElementById('ai-photo-label');
  label.style.opacity = '0.6';
  label.style.pointerEvents = 'none';

  // Превью фото
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1];
    const mediaType = file.type || 'image/jpeg';

    resultEl.innerHTML = `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:18px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <span style="font-size:20px;">📷</span>
          <div>
            <div style="font-size:13px;font-weight:700;">Фото-диагностика</div>
            <div style="font-size:10px;color:var(--text3);">Анализирую изображение...</div>
          </div>
        </div>
        <img src="${e.target.result}" style="max-width:100%;max-height:300px;border-radius:8px;margin-bottom:12px;object-fit:contain;">
        <div style="text-align:center;color:var(--text3);font-size:12px;">⏳ AI анализирует фото...</div>
      </div>`;

    // Контекст хозяйства для точного диагноза
    const gdd = getCurrentGdd(5);
    const phase = getPhaseByGdd(S.varieties[0]?.id, gdd);
    const cropNames = [...new Set(Object.values(S.cells).map(cd=>cd?.cropId||'crop_cherry'))]
      .map(cid=>getCropById(cid)?.name).filter(Boolean).join(', ');
    const today = S.weather[0];
    const weatherCtx = today
      ? `Погода: T${today.tmin}/${today.tmax}°C, влажность ${today.humidity||'?'}%, осадки ${today.precip||0}мм за последние дни.`
      : '';

    const prompt = `Ты опытный агроном-фитопатолог. Хозяйство: ${cropNames||'черешневый сад'}, Молдова, Prodanest.
GDD ${gdd}, фаза: ${phase?.name||'вегетация'}. ${weatherCtx}

Проанализируй фото и ответь строго по структуре:

🔍 ДИАГНОЗ: [название болезни/вредителя/дефицита или "Норма"]

📊 УВЕРЕННОСТЬ: [Высокая / Средняя / Низкая]

🧬 ПРИЗНАКИ: [что видно на фото — 2-3 предложения]

⚠️ СТЕПЕНЬ ПОРАЖЕНИЯ: [Начальная / Средняя / Сильная / Норма]

💊 РЕКОМЕНДАЦИЯ:
- Препарат: [название и д.в.]
- Доза: [л/га или кг/га]
- Срок обработки: [когда и как]
- Профилактика: [что делать далее]

⏰ СРОЧНОСТЬ: [Немедленно / В течение 3 дней / Плановая / Не требуется]

Если на фото не видно болезни или проблемы — напиши что растение здорово.`;

    try {
      const response = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 }
              },
              { type: 'text', text: prompt }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || data.error?.message || JSON.stringify(data);

      // Сохраняем в журнал AI
      saveAiRec('photo', text, e.target.result, `Фото: ${file.name} · ${cropNames||'сад'} · ${phase?.name||'вегетация'}`);

      // Форматируем ответ
      const html = text
        .replace(/^(🔍|📊|🧬|⚠️|💊|⏰)(.+)$/gm, '<div style="margin:10px 0 4px;font-weight:700;color:var(--text);">$1$2</div>')
        .replace(/^- (.+)$/gm, '<div style="padding:2px 0 2px 12px;color:var(--text2);">• $1</div>')
        .replace(/\n\n/g, '<br>')
        .replace(/\n/g, '<br>');

      // Цвет по срочности
      const urgency = text.includes('Немедленно') ? 'var(--red)'
        : text.includes('В течение 3') ? 'var(--orange)'
        : text.includes('Плановая') ? 'var(--yellow)'
        : 'var(--accent)';

      resultEl.innerHTML = `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:18px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);">
            <span style="font-size:20px;">📷</span>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:700;">Фото-диагностика</div>
              <div style="font-size:10px;color:var(--text3);">${file.name} · ${(file.size/1024).toFixed(0)}KB · ${new Date().toLocaleString('ru-RU')}</div>
            </div>
            <span style="padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;background:${urgency}22;color:${urgency};">
              ${text.includes('Немедленно')?'🚨 Немедленно':text.includes('В течение 3')?'⚠️ 3 дня':text.includes('Плановая')?'📅 Плановая':'✅ OK'}
            </span>
          </div>
          <img src="${e.target.result}" style="max-width:100%;max-height:250px;border-radius:8px;margin-bottom:14px;object-fit:contain;display:block;">
          <div style="font-size:12px;line-height:1.7;color:var(--text2);">${html}</div>
          <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;">
            <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
              📷 Новое фото
              <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="runAIPhotoAnalysis(this)">
            </label>
            <button class="btn btn-secondary btn-sm" onclick="runAIAdvisor()">✨ Общие рекомендации</button>
          </div>
        </div>`;

    } catch(err) {
      resultEl.innerHTML = `<div style="padding:14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;font-size:12px;color:var(--red);">
        ❌ Ошибка анализа фото: ${err.message}
      </div>`;
    } finally {
      label.style.opacity = '';
      label.style.pointerEvents = '';
      input.value = ''; // сбрасываем чтобы можно было загрузить то же фото
    }
  };
}

async function runAIAdvisor() {
  const btn = document.getElementById('ai-advisor-btn');
  const resultEl = document.getElementById('ai-advisor-result');
  if(!resultEl) return;

  btn.disabled = true;
  btn.textContent = '⏳ Анализирую...';
  resultEl.innerHTML = `<div style="padding:16px;background:var(--surface2);border-radius:10px;border:1px solid var(--border);font-size:12px;color:var(--text3);text-align:center;">
    <div style="font-size:24px;margin-bottom:8px;">🤖</div>
    Анализирую данные хозяйства...
  </div>`;

  try {
    // ── Собираем контекст ──────────────────────────────────────────────
    const today = S.weather[0];
    // Прогноз — конвертируем _forecast (объект daily) в массив дней
    let forecastDays = [];
    if(_forecast && _forecast.time) {
      forecastDays = _forecast.time.map((date, i) => ({
        date,
        tmin: _forecast.temperature_2m_min?.[i],
        tmax: _forecast.temperature_2m_max?.[i],
        precipSum: _forecast.precipitation_sum?.[i] || 0,
        precip: _forecast.precipitation_sum?.[i] || 0,
        precipProb: _forecast.precipitation_probability_max?.[i] || 0,
        wind: _forecast.windspeed_10m_max?.[i] || 0,
      }));
    }
    const forecast = forecastDays.slice(0, 7);

    // Погода последние 7 дней
    const weatherSummary = S.weather.slice(0,7).map(w=>
      `${w.date}: T${w.tmin}/${w.tmax}°C, RH${w.humidity||'?'}%, осадки ${w.precip||0}мм, ветер ${w.wind||'?'}км/ч, ET₀ ${w.et0||'?'}мм`
    ).join('\n');

    // Прогноз
    const forecastSummary = forecast.length ? forecast.map(d=>
      `${d.date}: T${d.tmin}/${d.tmax}°C, осадки ${d.precipSum||d.precip||0}мм`
    ).join('\n') : 'Прогноз недоступен';

    // Стресс-алерты
    const alerts = detectStress(S.weather, forecast);
    const alertsSummary = alerts.length
      ? alerts.map(a=>`[${a.level.toUpperCase()}] ${a.icon} ${a.title}: ${a.body}`).join('\n')
      : 'Стресс-факторов не выявлено';

    // GDD и фаза
    const gdd = getCurrentGdd(5);
    const firstVarId = S.varieties[0]?.id;
    const phase = firstVarId ? getPhaseByGdd(firstVarId, gdd) : null;
    const varieties = S.varieties.slice(0,5).map(v=>v.name).join(', ');

    // Активные обработки
    const now = new Date();
    const activeTr = S.treatments.filter(t=>new Date(t.endDate)>=now);
    const treatmentsSummary = activeTr.length
      ? activeTr.map(t=>`${t.product} (до ${t.endDate}, смыв ${t.washMm}мм)`).join('; ')
      : 'Нет активных обработок';

    // Water Balance
    const wbLog = S.irrigation?.waterBalance?.log||[];
    const lastWb = wbLog[wbLog.length-1];
    const sp = S.irrigation?.waterBalance?.soilParams||{};
    const taw = ((sp.fc||32)-(sp.pwp||14))*(sp.rootDepth||60)*0.1;
    const raw = taw*0.35;
    const wbSummary = lastWb
      ? `Баланс воды: ${lastWb.balance}мм из TAW ${taw.toFixed(0)}мм (RAW ${raw.toFixed(0)}мм). ETc ${lastWb.etc}мм/день. Статус: ${lastWb.status}.`
      : 'Water Balance не рассчитан';

    // Зоны полива
    const zones = (S.irrigation?.zones||[]).map(z=>
      `${z.name} (${IRRIG_TYPE_LABELS[z.irrigType]||z.irrigType}, ${z.flowRate||'?'}м³/ч, ${z.area?.toFixed(2)||'?'}га)`
    ).join('; ');

    // Культуры и клетки
    const cropSummary = [...new Set(Object.values(S.cells).map(cd=>cd?.cropId||'crop_cherry'))]
      .map(cid=>{ const c=getCropById(cid); return c?`${c.emoji}${c.name}`:cid; }).join(', ');
    const totalHa = Object.values(S.cells).reduce((s,cd)=>s+(cd?calcCellTotals(cd).totalHa:0),0);

    // Склад — критически низкие остатки
    const lowStock = (S.warehouse?.chemicals||[]).filter(c=>c.minStock&&c.qty<=c.minStock);
    const stockAlert = lowStock.length ? `Заканчиваются: ${lowStock.map(c=>`${c.name} (${c.qty}${c.unit})`).join(', ')}` : 'Склад в норме';

    // ── Промпт ────────────────────────────────────────────────────────
    const prompt = `Ты опытный агроном-консультант для садоводческого хозяйства в Молдове (Prodanest, район Дрокия).

ДАННЫЕ ХОЗЯЙСТВА:
- Культуры: ${cropSummary}, всего ${totalHa.toFixed(1)} га
- Сорта: ${varieties}
- GDD накоплено: ${gdd} (фаза: ${phase?.name||'не определена'})
- Дата: ${new Date().toLocaleDateString('ru-RU')}

ПОГОДА ПОСЛЕДНИЕ 7 ДНЕЙ:
${weatherSummary}

ПРОГНОЗ НА 7 ДНЕЙ:
${forecastSummary}

СТРЕСС-ФАКТОРЫ (автоматический анализ):
${alertsSummary}

ИРРИГАЦИЯ:
${wbSummary}
Зоны: ${zones||'не настроены'}

АКТИВНЫЕ ОБРАБОТКИ:
${treatmentsSummary}

СКЛАД:
${stockAlert}

Дай конкретные агрономические рекомендации на ближайшие 3–5 дней. Структурируй ответ по разделам:
1. 🚨 Срочные действия (если есть)
2. 💧 Ирригация — когда, сколько, по каким зонам
3. 💊 Обработки — что, когда, условия
4. 🌡️ На что обратить внимание
5. 📅 План на неделю

Отвечай конкретно, с цифрами. Учитывай реальные данные хозяйства. Язык: русский.`;

    // ── Вызов через прокси-сервер ─────────────────────────────────────
    const response = await fetch('/api/ai/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || data.error?.message || JSON.stringify(data);

    // Сохраняем в журнал AI
    const summary = `GDD ${gdd} · ${phase?.name||'вегетация'} · ${alerts.length} алертов`;
    saveAiRec('advisor', text, null, summary);

    // ── Рендер ответа ─────────────────────────────────────────────────
    // Конвертируем Markdown в HTML
    const html = text
      .replace(/^### (.+)$/gm, '<h4 style="font-size:12px;font-weight:700;color:var(--text);margin:14px 0 6px;">$1</h4>')
      .replace(/^## (.+)$/gm,  '<h3 style="font-size:13px;font-weight:700;color:var(--accent);margin:16px 0 8px;">$1</h3>')
      .replace(/^# (.+)$/gm,   '<h2 style="font-size:14px;font-weight:700;margin:16px 0 8px;">$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li style="margin-bottom:4px;">$1</li>')
      .replace(/(<li.*<\/li>\n?)+/g, '<ul style="margin:6px 0 10px 16px;padding:0;list-style:disc;">$&</ul>')
      .replace(/^(\d+)\. (.+)$/gm, '<li style="margin-bottom:4px;"><strong>$1.</strong> $2</li>')
      .replace(/\n\n/g, '</p><p style="margin:0 0 8px;">')
      .replace(/\n/g, '<br>');

    resultEl.innerHTML = `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:18px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);">
          <span style="font-size:20px;">🤖</span>
          <div>
            <div style="font-size:13px;font-weight:700;">AI Агроном-советник</div>
            <div style="font-size:10px;color:var(--text3);">На основе данных хозяйства · ${new Date().toLocaleString('ru-RU')}</div>
          </div>
          <button class="btn btn-secondary btn-sm" style="margin-left:auto;" onclick="runAIAdvisor()">🔄 Обновить</button>
        </div>
        <div style="font-size:12px;line-height:1.7;color:var(--text2);">
          <p style="margin:0 0 8px;">${html}</p>
        </div>
        <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border);font-size:10px;color:var(--text3);">
          Контекст: ${S.weather.length} дней погоды · ${forecast.length} дней прогноза · ${alerts.length} алертов · GDD ${gdd}
        </div>
      </div>`;

  } catch(e) {
    resultEl.innerHTML = `<div style="padding:14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;font-size:12px;color:var(--red);">
      ❌ Ошибка AI советника: ${e.message}
    </div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Получить рекомендации';
  }
}

function renderWeather() {
  const latest = S.weather[0];
  const dash = document.getElementById('weather-dashboard');
  if (latest) {
    const a = analyzeTemperature(latest.tmin, latest.tmax);
    const tempColor = (latest.tmin<=TEMP.frost) ? 'var(--red)' : (latest.tmax>=TEMP.heatStress) ? 'var(--orange)' : 'var(--accent)';
    const tmin = parseFloat(latest.tmin) ?? null;
    const tmax = parseFloat(latest.tmax) ?? null;
    const avg = (tmin!==null&&tmax!==null)?(tmin+tmax)/2:(tmin||tmax||null);

    // Build crop stress indicators dynamically from crops in garden
    const gardenCropIds = [...new Set(Object.values(S.cells).map(cd=>cd?.cropId||'crop_cherry'))];
    const cropIndicators = gardenCropIds.map(cid => {
      const crop = getCropById(cid);
      if (!crop) return '';
      // Stress thresholds per crop — use base temp as cold threshold
      const baseTemp = crop.baseTemp || 5;
      const heatLimit = crop.id==='crop_grape' ? 38 : 32;
      const frostLimit = crop.id==='crop_grape' ? -1 : TEMP.frost;
      let cls = 'good', val = '✅ Норма', sub = '';
      if (tmin!==null && tmin <= frostLimit) {
        cls='bad'; val='❄️ Заморозок'; sub=`${tmin}°C — риск повреждений`;
      } else if (tmin!==null && tmin <= baseTemp) {
        cls='warn'; val='🥶 Холод'; sub=`${tmin}°C ниже базы +${baseTemp}°C`;
      } else if (tmax!==null && tmax >= heatLimit) {
        cls='warn'; val='🔥 Жара'; sub=`${tmax}°C — тепловой стресс`;
      } else {
        sub = avg!==null ? `${avg.toFixed(0)}°C — комфортно` : '';
      }
      return `<div class="weather-indicator ${cls}">
        <div class="wi-icon">${crop.emoji||'🌱'}</div>
        <div class="wi-label">${crop.name}</div>
        <div class="wi-val" style="color:${cls==='good'?'var(--accent)':cls==='warn'?'var(--yellow)':'var(--red)'}">${val}</div>
        <div class="wi-sub">${sub}</div>
      </div>`;
    }).join('');

    dash.innerHTML = `
      <div class="weather-indicator ${a.beesClass}">
        <div class="wi-icon">🐝</div><div class="wi-label">Пчёлы</div>
        <div class="wi-val" style="color:${a.beesClass==='ok'?'var(--accent)':a.beesClass==='warn'?'var(--yellow)':'var(--red)'}">${a.beesClass==='ok'?'Летают':'Не летают'}</div>
        <div class="wi-sub">>+${TEMP.beesMin}°C</div>
      </div>
      ${cropIndicators || `<div class="weather-indicator ${a.cherryClass}">
        <div class="wi-icon">🍒</div><div class="wi-label">Черешня</div>
        <div class="wi-val" style="color:${a.cherryClass==='ok'?'var(--accent)':a.cherryClass==='warn'?'var(--yellow)':'var(--red)'}">${a.cherryClass==='ok'?'Норма':'Стресс'}</div>
        <div class="wi-sub">${a.cherryStress}</div>
      </div>`}
      <div class="weather-indicator ${a.productsClass}">
        <div class="wi-icon">💊</div><div class="wi-label">Препараты</div>
        <div class="wi-val" style="color:${a.productsClass==='ok'?'var(--accent)':'var(--yellow)'}">${a.productsClass==='ok'?'Эффективны':'Осторожно'}</div>
        <div class="wi-sub">+${TEMP.prodMin}°…+${TEMP.prodMax}°C</div>
      </div>
      <div class="weather-indicator ${tmin!==null&&tmin<=TEMP.frost?'bad':tmax>=TEMP.heatStress?'warn':'good'}">
        <div class="wi-icon">🌡️</div><div class="wi-label">Температура</div>
        <div class="wi-val" style="color:${tempColor};">${latest.tmin??'?'}° / ${latest.tmax??'?'}°</div>
        <div class="wi-sub">${latest.date}</div>
      </div>
      <div class="weather-indicator ${latest.precip>0?(latest.precip>=S.settings.washFull?'bad':'warn'):'good'}">
        <div class="wi-icon">🌧️</div><div class="wi-label">Осадки</div>
        <div class="wi-val" style="color:${latest.precip>=S.settings.washFull?'var(--red)':latest.precip>0?'var(--yellow)':'var(--accent)'}">${latest.precip||0} мм</div>
        <div class="wi-sub">${latest.precip>=S.settings.washFull?'⛔ Смыв':'Норма'}</div>
      </div>
      ${latest.humidity!=null?`<div class="weather-indicator good"><div class="wi-icon">💧</div><div class="wi-label">Влажность</div><div class="wi-val" style="color:var(--accent)">${latest.humidity}%</div><div class="wi-sub">${latest.date}</div></div>`:''}
    `;
  } else {
    dash.innerHTML = `<div style="color:var(--text3);font-size:12px;grid-column:1/-1;">Нет данных. Добавьте первый день.</div>`;
  }

  // Стресс-детектор (без прогноза — прогноз добавит loadCherryForecast)
  renderStressAlerts(null);

  // Active treatment warnings based on weather
  const warnEl = document.getElementById('weather-treatment-warn');
  if (latest) {
    const avg = (latest.tmin!=null&&latest.tmax!=null)?(latest.tmin+latest.tmax)/2:(latest.tmin||latest.tmax||15);
    const today = new Date();
    const activeTr = S.treatments.filter(t=>{const e=new Date(t.date);e.setDate(e.getDate()+parseInt(t.duration));return today<=e;});
    const warns = [];
    if (avg < TEMP.prodMin) warns.push(`⚠️ Температура ${avg.toFixed(0)}°C — препараты работают слабо. Рекомендуется отложить обработку до потепления выше +${TEMP.prodMin}°C`);
    if (avg > TEMP.prodMax) warns.push(`⚠️ Температура ${avg.toFixed(0)}°C — риск ожогов листьев. Обрабатывать в утреннее или вечернее время`);
    if (latest.tmax < TEMP.beesMin && activeTr.some(t=>t.type==='insecticide'))
      warns.push(`🐝 Пчёлы не летают при ${latest.tmax}°C — применение инсектицидов менее рискованно для опыления`);
    if (latest.tmax >= TEMP.beesMin && activeTr.some(t=>t.type==='insecticide'))
      warns.push(`⚠️ Пчёлы активны! Обработка инсектицидами опасна для опыления. Работайте после ${TEMP.beesMin}°C — только рано утром или вечером`);
    if (latest.tmin <= TEMP.frost)
      warns.push(`❄️ Заморозок ${latest.tmin}°C! Риск повреждения цветков и завязей`);
    if (warns.length) {
      warnEl.style.display='block';
      warnEl.innerHTML=warns.map(w=>`<div style="padding:10px 14px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:8px;font-size:12px;color:var(--text2);margin-bottom:6px;">${w}</div>`).join('');
    } else warnEl.style.display='none';
  } else warnEl.style.display='none';

  // Update stress column header with garden crops
  const gardenCropIds = [...new Set(Object.values(S.cells).map(cd=>cd?.cropId||'crop_cherry'))];
  const stressHdr = document.getElementById('weather-stress-header');
  if (stressHdr && gardenCropIds.length) {
    stressHdr.textContent = gardenCropIds.map(id=>getCropById(id)?.emoji||'🌱').join(' ') + ' Стресс культур';
  }

  const body = document.getElementById('weather-log-body');
  if (!S.weather.length) {
    body.innerHTML='<div style="padding:20px;color:var(--text3);text-align:center;font-size:12px;">Нет записей</div>';
    return;
  }
  body.innerHTML = S.weather.map(w=>{
    const a = analyzeTemperature(w.tmin, w.tmax);
    const tmin = parseFloat(w.tmin) ?? null;
    const tmax = parseFloat(w.tmax) ?? null;
    // Build stress for each garden crop
    const stressHtml = gardenCropIds.length ? gardenCropIds.map(cid => {
      const crop = getCropById(cid);
      if (!crop) return '';
      const base = crop.baseTemp || 5;
      const heatLimit = crop.id==='crop_grape' ? 38 : 32;
      const frostLimit = TEMP.frost;
      let cls='ok', label='✅';
      if (tmin!==null && tmin<=frostLimit) { cls='bad'; label='❄️'; }
      else if (tmin!==null && tmin<=base) { cls='warn'; label='🥶'; }
      else if (tmax!==null && tmax>=heatLimit) { cls='warn'; label='🔥'; }
      return `<span class="wstatus ${cls}" style="font-size:10px;">${crop.emoji||'🌱'}${label}</span>`;
    }).join(' ') : `<span class="wstatus ${a.cherryClass}">${a.cherryStress||'—'}</span>`;

    return `<div class="weather-row">
      <div style="font-family:'Unbounded',sans-serif;font-size:11px;color:var(--accent);">${w.date}</div>
      <div style="color:${w.tmin<=TEMP.frost?'var(--red)':w.tmin<=TEMP.coldStress?'var(--yellow)':'var(--text)'};">${w.tmin!=null?w.tmin+'°':'—'}</div>
      <div style="color:${w.tmax>=TEMP.heatStress?'var(--orange)':w.tmax>=TEMP.prodMax?'var(--yellow)':'var(--text)'};">${w.tmax!=null?w.tmax+'°':'—'}</div>
      <div><span class="wstatus ${a.beesClass}">${a.beesClass==='ok'?'✅ Летают':'❌ Нет'}</span></div>
      <div>${stressHtml}</div>
      <div><span class="wstatus ${a.productsClass}">${a.productsClass==='ok'?'✅ OK':'⚠️ Осторожно'}</span></div>
      <div style="color:${w.precip>=S.settings.washFull?'var(--red)':w.precip>0?'var(--yellow)':'var(--text3)'};">${w.precip>0?w.precip+'мм':''} ${w.leafwet>0?'🍃'+w.leafwet+'ч':w.precip>0?'':'—'}${w.precip>=S.settings.washFull?' ⛔':''}</div>
      <div style="gap:5px;display:flex;">
        <button class="btn btn-secondary btn-xs" onclick="openWeatherAddModal('${w.id}')">✏️</button>
      </div>
    </div>`;
  }).join('');
}
function openExportModal(){
  // Set default dates: last 30 days to today
  const today=new Date();const from=new Date();from.setDate(from.getDate()-30);
  document.getElementById('exp-from').value=from.toISOString().split('T')[0];
  document.getElementById('exp-to').value=today.toISOString().split('T')[0];
  // Populate cell filter
  const sel=document.getElementById('exp-cell');sel.innerHTML='<option value="">Все клетки</option>';
  Object.keys(S.cells).forEach(k=>{const colors=getCellColors(S.cells[k]);sel.innerHTML+=`<option value="${k}">${k}${colors[0]?' — '+colors[0].name:''}</option>`;});
  updateExpPreview();
  openModal('modal-export');
  // Live preview update
  ['exp-from','exp-to','exp-cell','exp-type'].forEach(id=>{
    const el=document.getElementById(id);
    el.oninput=updateExpPreview;el.onchange=updateExpPreview;
  });
}

function getFilteredTreatments(){
  const from=document.getElementById('exp-from').value;
  const to=document.getElementById('exp-to').value;
  const cell=document.getElementById('exp-cell').value;
  const type=document.getElementById('exp-type').value;
  return S.treatments.filter(t=>{
    if(from&&t.date<from)return false;
    if(to&&t.date>to)return false;
    if(cell&&t.cellTarget!=='all'&&t.cellTarget!==cell)return false;
    if(type&&t.type!==type)return false;
    return true;
  }).sort((a,b)=>a.date.localeCompare(b.date));
}

function updateExpPreview(){
  document.getElementById('exp-count').textContent=getFilteredTreatments().length;
}

function exportToExcel(){
  const treatments=getFilteredTreatments();
  if(!treatments.length){alert('Нет данных для экспорта');return;}

  // Column config: [checkboxId, header, getValue]
  const cols=[
    {id:'ec-date',   hdr:'Дата',                  fn:t=>t.date},
    {id:'ec-product',hdr:'Препарат',               fn:t=>t.product||''},
    {id:'ec-active', hdr:'Активное вещество',       fn:t=>t.activeSubstance||''},
    {id:'ec-type',   hdr:'Тип',                    fn:t=>TYPE_LABELS[t.type]||t.type||''},
    {id:'ec-method', hdr:'Способ внесения',         fn:t=>METHOD_LABELS[t.method||'foliar']||''},
    {id:'ec-dose',   hdr:'Доза (кг/л на га)',       fn:t=>parseFloat(t.dose)||''},
    {id:'ec-water',  hdr:'Расход воды (л/га)',       fn:t=>parseFloat(t.water)||400},
    {id:'ec-cell',   hdr:'Клетка',                  fn:t=>t.cellTarget||'all'},
    {id:'ec-variety',hdr:'Сорт',                   fn:t=>{if(t.varietyTarget==='all')return'Все';return S.varieties.find(v=>v.id===t.varietyTarget)?.name||'Все';}},
    {id:'ec-duration',hdr:'Срок действия (дней)',  fn:t=>parseInt(t.duration)||0},
    {id:'ec-enddate',hdr:'Конец действия',          fn:t=>t.endDate||''},
    {id:'ec-wash',   hdr:'Смывается при (мм)',       fn:t=>parseFloat(t.washMm)||15},
    {id:'ec-ha',     hdr:'Площадь клетки (га)',      fn:t=>{const cd=S.cells[t.cellTarget];if(!cd)return'';const tot=calcCellTotals(cd);return parseFloat(tot.totalHa.toFixed(3));}},
    {id:'ec-totaldose',hdr:'Итого препарата (л/кг)', fn:t=>{const cd=S.cells[t.cellTarget];const dose=parseFloat(t.dose)||0;if(!cd)return'';const tot=calcCellTotals(cd);return parseFloat((dose*tot.totalHa).toFixed(3));}},
    {id:'ec-totalwater',hdr:'Итого воды (л)',        fn:t=>{const cd=S.cells[t.cellTarget];const w=parseFloat(t.water)||400;if(!cd)return'';const tot=calcCellTotals(cd);return Math.round(w*tot.totalHa);}},
    {id:'ec-note',   hdr:'Примечание',              fn:t=>t.note||''},
  ].filter(c=>document.getElementById(c.id)?.checked);

  // Build header row
  const header=cols.map(c=>c.hdr);

  // Build data rows
  const rows=treatments.map(t=>cols.map(c=>c.fn(t)));

  // Create workbook
  const wb=XLSX.utils.book_new();

  // --- Sheet 1: Журнал обработок ---
  const wsData=[header,...rows];
  const ws=XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  const colWidths=cols.map(c=>{
    const max=Math.max(c.hdr.length,...rows.map(r=>{const v=r[cols.indexOf(c)];return v?String(v).length:0;}));
    return{wch:Math.min(Math.max(max+2,10),40)};
  });
  ws['!cols']=colWidths;

  // Style header row (green background, bold, white text)
  const headerRange=XLSX.utils.decode_range(ws['!ref']);
  for(let C=headerRange.s.c;C<=headerRange.e.c;C++){
    const cellRef=XLSX.utils.encode_cell({r:0,c:C});
    if(!ws[cellRef])continue;
    ws[cellRef].s={
      fill:{fgColor:{rgb:'166534'}},
      font:{bold:true,color:{rgb:'FFFFFF'},sz:11},
      alignment:{horizontal:'center',vertical:'center'},
      border:{bottom:{style:'medium',color:{rgb:'4ade80'}}}
    };
  }
  // Style data rows — alternate shading + date column bold
  for(let R=1;R<=rows.length;R++){
    for(let C=0;C<=cols.length-1;C++){
      const cellRef=XLSX.utils.encode_cell({r:R,c:C});
      if(!ws[cellRef])continue;
      ws[cellRef].s={
        fill:{fgColor:{rgb:R%2===0?'1a2e1b':'111812'}},
        font:{color:{rgb:C===0?'4ade80':'e8f5e9'},sz:10,bold:C===0},
        alignment:{horizontal:C===0?'center':'left',vertical:'center'},
      };
    }
  }
  // Freeze header row
  ws['!freeze']={xSplit:0,ySplit:1};

  XLSX.utils.book_append_sheet(wb,ws,'Журнал обработок');

  // --- Sheet 2: Сводка по препаратам ---
  const summary={};
  treatments.forEach(t=>{
    const key=t.product||'—';
    if(!summary[key])summary[key]={product:t.product||'—',active:t.activeSubstance||'—',type:TYPE_LABELS[t.type]||'—',method:METHOD_LABELS[t.method||'foliar']||'—',count:0,dose:parseFloat(t.dose)||0,water:parseFloat(t.water)||400};
    summary[key].count++;
  });
  const sumHeader=['Препарат','Активное вещество','Тип','Способ внесения','Кол-во обработок','Доза (кг/л на га)','Расход воды (л/га)'];
  const sumRows=Object.values(summary).map(s=>[s.product,s.active,s.type,s.method,s.count,s.dose,s.water]);
  const ws2=XLSX.utils.aoa_to_sheet([sumHeader,...sumRows]);
  ws2['!cols']=sumHeader.map(h=>({wch:Math.max(h.length+4,16)}));
  for(let C=0;C<sumHeader.length;C++){
    const cellRef=XLSX.utils.encode_cell({r:0,c:C});
    if(ws2[cellRef])ws2[cellRef].s={fill:{fgColor:{rgb:'0f3a1a'}},font:{bold:true,color:{rgb:'86efac'},sz:11},alignment:{horizontal:'center'}};
  }
  XLSX.utils.book_append_sheet(wb,ws2,'Сводка по препаратам');

  // --- Sheet 3: По клеткам ---
  const byCellData={};
  treatments.forEach(t=>{
    const key=t.cellTarget||'all';
    if(!byCellData[key])byCellData[key]=[];
    byCellData[key].push(t);
  });
  const cellHeader=['Клетка','Сорт (основной)','Дата','Препарат','Тип','Доза','Вода (л/га)','Способ'];
  const cellRows=[];
  Object.entries(byCellData).sort().forEach(([cell,trs])=>{
    const cd=S.cells[cell];const colors=cd?getCellColors(cd):[];
    trs.sort((a,b)=>a.date.localeCompare(b.date)).forEach(t=>{
      cellRows.push([cell,colors[0]?.name||'—',t.date,t.product||'—',TYPE_LABELS[t.type]||'—',parseFloat(t.dose)||'—',parseFloat(t.water)||400,METHOD_LABELS[t.method||'foliar']||'—']);
    });
  });
  const ws3=XLSX.utils.aoa_to_sheet([cellHeader,...cellRows]);
  ws3['!cols']=cellHeader.map(h=>({wch:Math.max(h.length+4,14)}));
  for(let C=0;C<cellHeader.length;C++){
    const cellRef=XLSX.utils.encode_cell({r:0,c:C});
    if(ws3[cellRef])ws3[cellRef].s={fill:{fgColor:{rgb:'0f3a1a'}},font:{bold:true,color:{rgb:'86efac'},sz:11},alignment:{horizontal:'center'}};
  }
  XLSX.utils.book_append_sheet(wb,ws3,'По клеткам');

  // Generate filename with date range
  const from=document.getElementById('exp-from').value||'начало';
  const to=document.getElementById('exp-to').value||'конец';
  const fname=`Обработки_сад_${from}_${to}.xlsx`;
  XLSX.writeFile(wb,fname);
  closeModal('modal-export');
}

function downloadTreatmentsTemplate() {
  // Собираем справочные данные из текущего состояния
  const cellKeys   = Object.keys(S.cells||{}).sort();
  const varieties  = (S.varieties||[]).map(v=>`${v.name}`);
  const products   = (S.catalog||[]).map(p=>p.name);
  const cropNames  = (S.crops||[]).map(c=>`${c.id}=${c.name}`).join(' | ');

  // ── Лист 1: Журнал обработок (баковые смеси) ──
  const mainHeaders = [
    'Дата (ДД.ММ.ГГГГ)',
    'Участок (ключ или "all")',
    'Сорт (название или пусто=все)',
    'Метод (foliar/drip/soil)',
    'Расход воды (л/га)',
    // Препарат 1
    'Препарат 1 (название)',
    'Доза 1 (л/га или кг/га)',
    'Тип 1 (fungicide/insecticide/herbicide/fertilizer)',
    'Д.В. 1',
    // Препарат 2
    'Препарат 2',
    'Доза 2',
    'Тип 2',
    'Д.В. 2',
    // Препарат 3
    'Препарат 3',
    'Доза 3',
    'Тип 3',
    'Д.В. 3',
    // Препарат 4
    'Препарат 4',
    'Доза 4',
    'Тип 4',
    'Д.В. 4',
    'Примечание',
  ];

  // Примеры — типичный сезон черешни с баковыми смесями
  const mainExamples = [
    // Ранняя весна
    ['15.03.2025','all','','foliar',600,
     'Бордоская смесь 3%',6,'fungicide','сульфат меди',
     '','','','',
     '','','','',
     '','','','',
     'До набухания почек — профилактика'],
    // Зелёный конус
    ['05.04.2025','1-1','','foliar',600,
     'Хорус 75WG',0.2,'fungicide','ципродинил',
     'Актара 25WG',0.14,'insecticide','тиаметоксам',
     '','','','',
     '','','','',
     'Зелёный конус — смесь фунгицид+инсектицид'],
    // Цветение — только фунгицид, NO инсектицид
    ['20.04.2025','all','','foliar',600,
     'Свитч 62.5WG',0.8,'fungicide','ципродинил+флудиоксонил',
     'Борная кислота',0.3,'fertilizer','B',
     '','','','',
     '','','','',
     'Цветение — бор для завязи, NO инсектицид!'],
    // Завязь — Ca-программа
    ['10.05.2025','1-1','Кордия (Kordia)','foliar',600,
     'Делан WG',0.3,'fungicide','дифеноконазол',
     'Калипсо SC',0.24,'insecticide','тиаклоприд',
     'Кальцифол',3,'fertilizer','Ca',
     '','','','',
     'Завязь — Ca-программа против растрескивания'],
    // Рост плода — тройная смесь
    ['01.06.2025','1-1','','foliar',600,
     'Хорус 75WG',0.2,'fungicide','ципродинил',
     'Калипсо SC',0.24,'insecticide','тиаклоприд',
     'Кальцифол',3,'fertilizer','Ca',
     'ПАВ Тренд 90',0.05,'surfactant','изодецилспирт',
     'Рост плода — 4 компонента'],
    // Созревание — стоп инсектициды
    ['20.06.2025','all','','foliar',600,
     'Тиовит Джет',3,'fungicide','сера',
     '','','','',
     '','','','',
     '','','','',
     'Созревание — только сера, ПХИ мин.'],
    // Фертигация
    ['15.05.2025','1-2','','drip',50,
     'Кальциевая селитра',5,'fertilizer','Ca(NO3)2',
     'Нитрат калия',3,'fertilizer','KNO3',
     '','','','',
     '','','','',
     'Фертигация — капельный полив'],
  ];

  // ── Лист 2: Инструкция ──
  const instrHeaders = ['Поле','Пояснение','Допустимые значения'];
  const instrRows = [
    ['Дата','Обязательное поле','ДД.ММ.ГГГГ  или  ГГГГ-ММ-ДД'],
    ['Участок','Ключ участка с карты или "all"',cellKeys.length ? cellKeys.join(', ')+', all' : 'all'],
    ['Сорт','Название сорта или пусто = все сорта',varieties.slice(0,8).join(', ')],
    ['Метод','Способ нанесения','foliar (опрыскивание), drip (капля), soil (почва)'],
    ['Расход воды','Литров на гектар','обычно 400–800 (опрыск), 30–80 (капля)'],
    ['Препарат','Точное название из справочника — или любое новое',''],
    ['Доза','Литров или кг на гектар','числовое значение, например 0.3'],
    ['Тип','Тип препарата','fungicide, insecticide, herbicide, fertilizer, surfactant, bio, regulator'],
    ['Д.В.','Действующее вещество (необязательно)',''],
    ['Примечание','Любой текст',''],
    [],
    ['БАКОВАЯ СМЕСЬ','Записывать в одну строку — до 4 препаратов в колонках Препарат1…Препарат4',''],
    ['ОДИН УЧАСТОК','Каждая строка = одна обработка',''],
    ['НЕСКОЛЬКО УЧАСТКОВ','Скопировать строку, изменить только колонку «Участок»',''],
    [],
    ['Справочник препаратов (из базы):','',''],
    ...products.slice(0,20).map(p=>['',p,'']),
    [],
    ['Культуры (cropId):',cropNames,''],
  ];

  // ── Создаём файл ──
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet([mainHeaders, ...mainExamples]);
  // Ширины колонок
  const w1 = [16,16,18,10,12, 22,8,14,18, 22,8,14,18, 22,8,14,18, 22,8,14,18, 28];
  ws1['!cols'] = w1.map(w=>({wch:w}));
  // Заморозить первую строку
  ws1['!freeze'] = {xSplit:0, ySplit:1};
  XLSX.utils.book_append_sheet(wb, ws1, 'Обработки');

  const ws2 = XLSX.utils.aoa_to_sheet([instrHeaders, ...instrRows]);
  ws2['!cols'] = [{wch:24},{wch:50},{wch:40}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Инструкция');

  XLSX.writeFile(wb, 'шаблон_обработки.xlsx');
}

// ═══ ЖУРНАЛ AI РЕКОМЕНДАЦИЙ ══════════════════════════════════════════════

const AI_STATUS = {
  noted:    {icon:'📌', label:'Принято к сведению', color:'var(--blue)'},
  planned:  {icon:'📅', label:'Запланировано',       color:'var(--yellow)'},
  done:     {icon:'✅', label:'Выполнено',            color:'var(--accent)'},
  rejected: {icon:'❌', label:'Отклонено',            color:'var(--red)'},
  question: {icon:'❓', label:'Требует уточнения',    color:'var(--orange)'},
};

const AI_ROLE = {
  agronomist: '🌿 Агроном',
  owner:      '👔 Владелец',
  director:   '📋 Директор',
};

function saveAiRec(type, aiText, photoBase64, promptSummary) {
  if(!S.aiLog) S.aiLog = [];
  const rec = {
    id: uid(),
    date: new Date().toISOString(),
    type,           // 'advisor' | 'photo'
    promptSummary,  // краткое описание контекста
    aiText,
    photoBase64: photoBase64 || null,
    comments: [],
    status: null,   // итоговый статус (из последнего комментария)
  };
  S.aiLog.unshift(rec);
  // Храним только последние 50 записей
  if(S.aiLog.length > 50) S.aiLog = S.aiLog.slice(0, 50);
  save();
  return rec.id;
}

function renderAiLog() {
  const el = document.getElementById('ailog-list');
  if(!el) return;
  const log = S.aiLog || [];
  if(!log.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);">
      <div style="font-size:40px;margin-bottom:12px;">🤖</div>
      <div style="font-size:13px;margin-bottom:6px;">Журнал AI пуст</div>
      <div style="font-size:11px;">Нажмите ✨ Получить рекомендации или 📷 Фото-диагностика на вкладке Погода</div>
    </div>`;
    return;
  }

  el.innerHTML = log.map(rec => {
    const date = new Date(rec.date).toLocaleString('ru-RU');
    const typeLabel = rec.type === 'photo' ? '📷 Фото-диагностика' : '✨ AI Советник';
    const lastStatus = rec.comments?.slice(-1)[0]?.status;
    const statusInfo = lastStatus ? AI_STATUS[lastStatus] : null;

    // Форматируем текст AI
    const aiHtml = (rec.aiText||'')
      .replace(/^(🔍|📊|🧬|⚠️|💊|⏰|🚨|1\.|2\.|3\.|4\.|5\.)(.+)$/gm,
        '<div style="font-weight:700;color:var(--text);margin:8px 0 2px;">$1$2</div>')
      .replace(/^- (.+)$/gm, '<div style="padding:1px 0 1px 12px;color:var(--text2);">• $1</div>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br>')
      .replace(/\n/g, '<br>');

    // Комментарии
    const commentsHtml = (rec.comments||[]).map(c => {
      const cStatus = c.status ? AI_STATUS[c.status] : null;
      return `<div style="margin-top:8px;padding:10px 14px;background:var(--surface);border-left:3px solid ${cStatus?.color||'var(--border)'};border-radius:0 8px 8px 0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:12px;font-weight:700;color:var(--text);">${AI_ROLE[c.role]||c.role} · ${c.author}</span>
          ${cStatus?`<span style="padding:1px 8px;border-radius:8px;font-size:10px;background:${cStatus.color}22;color:${cStatus.color};font-weight:600;">${cStatus.icon} ${cStatus.label}</span>`:''}
          <span style="margin-left:auto;font-size:10px;color:var(--text3);">${new Date(c.date).toLocaleString('ru-RU')}</span>
        </div>
        <div style="font-size:12px;color:var(--text2);line-height:1.5;">${c.text}</div>
      </div>`;
    }).join('');

    return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">
      <!-- Заголовок -->
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border);">
        <span style="font-size:20px;">${rec.type==='photo'?'📷':'🤖'}</span>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:700;">${typeLabel}</span>
            ${statusInfo?`<span style="padding:2px 8px;border-radius:10px;font-size:10px;background:${statusInfo.color}22;color:${statusInfo.color};font-weight:600;">${statusInfo.icon} ${statusInfo.label}</span>`:''}
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">${date} · ${rec.promptSummary||''}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openAiComment('${rec.id}')">💬 Комментировать</button>
      </div>

      <!-- Фото если есть -->
      ${rec.photoBase64?`<img src="${rec.photoBase64}" style="max-width:100%;max-height:200px;border-radius:8px;margin-bottom:10px;object-fit:contain;display:block;">`:'' }

      <!-- Текст AI -->
      <div style="font-size:12px;line-height:1.7;color:var(--text2);margin-bottom:${rec.comments?.length?'12px':'0'};">
        ${aiHtml}
      </div>

      <!-- Комментарии -->
      ${commentsHtml}
    </div>`;
  }).join('');
}

function openAiComment(recId) {
  document.getElementById('aic-rec-id').value = recId;
  document.getElementById('aic-text').value = '';
  document.getElementById('aic-status').value = 'noted';
  // Предзаполняем имя из последнего комментария
  const rec = (S.aiLog||[]).find(r=>r.id===recId);
  const lastComment = rec?.comments?.slice(-1)[0];
  if(lastComment) {
    document.getElementById('aic-author').value = lastComment.author||'';
    document.getElementById('aic-role').value = lastComment.role||'agronomist';
  }
  openModal('modal-ai-comment');
}

function saveAiComment() {
  const recId = document.getElementById('aic-rec-id').value;
  const author = document.getElementById('aic-author').value.trim();
  const text = document.getElementById('aic-text').value.trim();
  if(!author){alert('Введите ваше имя');return;}
  if(!text){alert('Введите комментарий');return;}
  const rec = (S.aiLog||[]).find(r=>r.id===recId);
  if(!rec) return;
  if(!rec.comments) rec.comments = [];
  rec.comments.push({
    id: uid(),
    date: new Date().toISOString(),
    author,
    role: document.getElementById('aic-role').value,
    status: document.getElementById('aic-status').value,
    text,
  });
  rec.status = document.getElementById('aic-status').value;
  save();
  closeModal('modal-ai-comment');
  renderAiLog();
}

// ═══ VEGETABLE ANALYSES ═══════════════════════════════════════════════════
let _vegAnTab = 'all';
let _vegAnEditId = null;

const VEG_LEAF_NORMS = {
  N:  {min:2.0, max:4.0, unit:'%',   name:'Азот',
    deficiency:'Пожелтение старых листьев, угнетённый рост',
    excess:'Тёмно-зелёные листья, затяжная вегетация, мало плодов',
    foliar:'Мочевина 0.5–1% (5–10 кг/га). 2–3 обработки с интервалом 10 дней.',
    drip:'Ca(NO₃)₂ или KNO₃ 3–5 кг/1000 л. ЕС +0.5–1.0 мСм/см.',
    soil:'Аммиачная селитра 34% — 100–200 кг/га. Нитрат аммония.'},
  P:  {min:0.20,max:0.50,unit:'%',   name:'Фосфор',
    deficiency:'Фиолетовый оттенок листьев снизу, слабая корневая',
    excess:'Блокировка Zn и Fe',
    foliar:'Монокалийфосфат МКФ 0.3–0.5%. Фолифос.',
    drip:'MAP 12:52:0 — 1–2 кг/1000 л.',
    soil:'Суперфосфат 200–400 кг/га. MAP или DAP под вспашку.'},
  K:  {min:2.0, max:4.0, unit:'%',   name:'Калий',
    deficiency:'Некроз краёв листьев начиная со старых',
    excess:'Блокировка Ca и Mg',
    foliar:'KNO₃ 0.5–1% или MKP 0.5%. 2–3 обработки.',
    drip:'K₂SO₄ или KNO₃ — 2–4 кг/1000 л.',
    soil:'Сульфат калия 150–300 кг/га.'},
  Ca: {min:1.0, max:3.0, unit:'%',   name:'Кальций',
    deficiency:'Некроз точки роста, вершинная гниль томата/перца',
    excess:'Редко проблема',
    foliar:'Ca(NO₃)₂ 0.5–1%. Кальбор. До и после цветения.',
    drip:'Ca(NO₃)₂ — 2–4 кг/1000 л. Отдельно от фосфата.',
    soil:'Гипс CaSO₄ 1–2 т/га. Нитрат кальция.'},
  Mg: {min:0.25,max:0.75,unit:'%',   name:'Магний',
    deficiency:'Межжилковый хлороз старых листьев',
    excess:'Норма',
    foliar:'MgSO₄ 1–2% (10–20 кг/га). 2–3 обработки.',
    drip:'Нитрат магния Mg(NO₃)₂ — 2–3 кг/1000 л.',
    soil:'MgSO₄ 50–100 кг/га.'},
  Fe: {min:50,  max:200, unit:'ppm', name:'Железо',
    deficiency:'Хлороз молодых листьев, жилки зелёные',
    excess:'Редко',
    foliar:'Хелат Fe-DTPA 0.1–0.2%. 3–5 обработок. pH<6.5: EDTA.',
    drip:'Fe-DTPA — 0.5–1 кг/1000 л. Отдельно от фосфора.',
    soil:'Хелат железа в почву 5–10 кг/га.'},
  Mn: {min:50,  max:250, unit:'ppm', name:'Марганец',
    deficiency:'Хлороз молодых листьев с чёткими жилками',
    excess:'Тёмные пятна на листьях (при кислой почве)',
    foliar:'Хелат Mn 0.1–0.2%. Сульфат Mn 0.3–0.5%.',
    drip:'Хелат Mn — 0.3–0.5 кг/1000 л.',
    soil:'Сульфат марганца 15–30 кг/га.'},
  Zn: {min:20,  max:100, unit:'ppm', name:'Цинк',
    deficiency:'Мелкие листья, розеточность, укороченные междоузлия',
    excess:'Токсичность (редко)',
    foliar:'Хелат Zn 0.1–0.15%. ZnSO₄ 0.2–0.3%.',
    drip:'Хелат Zn — 0.2–0.4 кг/1000 л.',
    soil:'ZnSO₄ 10–20 кг/га.'},
  B:  {min:25,  max:75,  unit:'ppm', name:'Бор',
    deficiency:'Деформация плодов, пустоцвет, растрескивание',
    excess:'Некроз краёв листьев',
    foliar:'Борная кислота 0.15–0.2%. ДО и ПОСЛЕ цветения!',
    drip:'Solubor 0.5–1 кг/1000 л.',
    soil:'Борная кислота 1–2 кг/га.'},
};

const VEG_SOIL_NORMS = {
  pH:  {min:6.0,max:7.0,unit:'',     name:'pH',
    low:'Кислая почва. Вносить известь. Блокирует P, Ca, Mg.',
    high:'Щелочная. Вносить серу или гипс. Блокирует Fe, Mn, Zn.',
    fix_low:'Известкование CaCO₃ 2–5 т/га. Доломитовая мука.',
    fix_high:'Сера молотая 200–500 кг/га. Гипс 1–2 т/га.'},
  OM:  {min:2.0,max:5.0,unit:'%',    name:'Орг. вещество',
    low:'Низкая биоактивность. Плохая структура. Дополнительное удобрение.',
    fix_low:'Компост 20–30 т/га. Сидераты. Мульча.'},
  NO3: {min:15, max:60, unit:'мг/кг',name:'N-NO₃',
    low:'Дефицит азота. Пожелтение.',
    high:'Риск загрязнения. Снизить N-удобрения.',
    fix_low:'Нитрат аммония — 150–200 кг/га. Ca(NO₃)₂ через капельное.',
    fix_high:'Промывные поливы. Снизить дозы N.'},
  P:   {min:60, max:200,unit:'мг/кг',name:'P₂O₅',
    low:'Дефицит фосфора.',
    fix_low:'Суперфосфат 200–400 кг/га. MAP в почву осенью.'},
  K:   {min:120,max:350,unit:'мг/кг',name:'K₂O',
    low:'Дефицит калия.',
    fix_low:'К₂SO₄ 200–300 кг/га. KNO₃ через капельное.'},
};

const VEG_WATER_NORMS = {
  pH:  {min:6.5,max:7.5,unit:'',    name:'pH воды',
    high:'Щелочная. Осадок в капельницах. Кислотование HNO₃ или H₃PO₄.',
    low:'Кислая. Коррозия. Добавить Ca(OH)₂.'},
  EC:  {min:0.1,max:1.5,unit:'мСм/см',name:'EC',
    high:'Высокая солёность. Промывные поливы. Стресс у растений.',
    fix_high:'Промывной полив +30% нормы. Гипс в систему.'},
  Fe:  {min:0,  max:0.3,unit:'мг/л',name:'Железо',
    high:'Засорение капельниц. Хлорирование + кислотная промывка.',
    fix_high:'Фильтрация. Хлорирование 2–5 ppm.'},
  B:   {min:0,  max:0.5,unit:'мг/л',name:'Бор',
    high:'Токсичность бора! Смешать с другой водой.',
    fix_high:'Смешивание. Нет агрохимического исправления.'},
  Cl:  {min:0,  max:150,unit:'мг/л',name:'Хлориды',
    high:'Ожоги краёв листьев при дождевании.',
    fix_high:'Только капельное. Избегать листового орошения.'},
};

function setVegAnTab(tab) {
  _vegAnTab = tab;
  ['all','leaf','soil','water'].forEach(t => {
    document.getElementById('vantab-'+t)?.classList.toggle('active', t===tab);
  });
  renderVegAnalyses();
}

function switchVanTab(tab) {
  document.getElementById('van-type').value = tab;
  ['leaf','soil','water'].forEach(t => {
    document.getElementById('van-fields-'+t).style.display = t===tab?'block':'none';
    document.getElementById('vanmodal-'+t)?.classList.toggle('active', t===tab);
  });
}

function openVegAnalysisModal(type, editId) {
  _vegAnEditId = editId||null;
  type = type||'leaf';
  const ex = editId ? (S.vegAnalyses||[]).find(a=>a.id===editId) : null;
  const t = ex?.type||type;
  document.getElementById('van-title').textContent =
    (ex?'✏️ Редактировать':'🔬 Новый') + ' анализ ' +
    (t==='leaf'?'листа':t==='soil'?'почвы':'воды');
  document.getElementById('van-delete-btn').style.display = ex?'block':'none';
  document.getElementById('van-date').value = ex?.date||today();
  document.getElementById('van-lab').value  = ex?.lab||'';
  document.getElementById('van-note').value = ex?.note||'';
  // Populate parcel select
  const ps = document.getElementById('van-parcel');
  ps.innerHTML = '<option value="">Все участки</option>';
  S.parcels.forEach(p => {
    const c = getCropById(p.cropId);
    ps.innerHTML += `<option value="${p.id}" ${ex?.parcelId===p.id?'selected':''}>${p.name}${c?' · '+c.emoji:''}</option>`;
  });
  // Clear all fields
  Object.keys(VEG_LEAF_NORMS).forEach(f=>{const el=document.getElementById('van-'+f);if(el)el.value=ex?.type==='leaf'?ex[f]??'':'';});
  ['pH','OM','NO3','P','K','Ca','Mg','B'].forEach(f=>{const el=document.getElementById('vso-'+f);if(el)el.value=ex?.type==='soil'?ex[f]??'':'';});
  ['pH','EC','TDS','Fe','Mn','B','Cl','Na'].forEach(f=>{const el=document.getElementById('vwa-'+f);if(el)el.value=ex?.type==='water'?ex[f]??'':'';});
  switchVanTab(t);

  // PDF секция — только при редактировании существующего анализа
  const pdfSection = document.getElementById('van-pdf-section');
  const parseBtn = document.getElementById('van-parse-btn');
  const pdfList = document.getElementById('van-pdf-list');
  const parseStatus = document.getElementById('van-parse-status');
  pdfSection.style.display = ex ? 'block' : 'none';
  parseStatus.style.display = 'none';
  pdfList.innerHTML = '';
  if (ex) {
    // Загрузить список PDF для этого анализа
    loadAnalysisPdfs(ex.id);
  }

  openModal('modal-veg-analysis');
}

function deleteVegAnalysis() {
  if(!_vegAnEditId||!confirm('Удалить анализ?'))return;
  S.vegAnalyses = (S.vegAnalyses||[]).filter(a=>a.id!==_vegAnEditId);
  save(); closeModal('modal-veg-analysis'); renderVegAnalyses();
}

function saveVegAnalysis() {
  const type = document.getElementById('van-type').value||'leaf';
  const date = document.getElementById('van-date').value;
  if(!date){alert('Введите дату');return;}
  const e = {
    id: _vegAnEditId||uid(), type, date,
    parcelId: document.getElementById('van-parcel').value,
    lab: document.getElementById('van-lab').value,
    note: document.getElementById('van-note').value,
  };
  if(type==='leaf'){
    Object.keys(VEG_LEAF_NORMS).forEach(f=>{const v=document.getElementById('van-'+f)?.value;if(v!=='')e[f]=parseFloat(v);});
  } else if(type==='soil'){
    ['pH','OM','NO3','P','K','Ca','Mg','B'].forEach(f=>{const v=document.getElementById('vso-'+f)?.value;if(v!=='')e[f]=parseFloat(v);});
  } else {
    ['pH','EC','TDS','Fe','Mn','B','Cl','Na'].forEach(f=>{const v=document.getElementById('vwa-'+f)?.value;if(v!=='')e[f]=parseFloat(v);});
  }
  if(!S.vegAnalyses) S.vegAnalyses=[];
  if(_vegAnEditId){const i=S.vegAnalyses.findIndex(a=>a.id===_vegAnEditId);if(i>=0)S.vegAnalyses[i]=e;else S.vegAnalyses.push(e);}
  else S.vegAnalyses.push(e);
  _vegAnEditId = e.id; // set for PDF upload
  save();
  renderVegAnalyses();
  // Показать PDF секцию после сохранения
  const pdfSection = document.getElementById('van-pdf-section');
  if (pdfSection) {
    pdfSection.style.display = 'block';
    loadAnalysisPdfs(e.id);
  }
  // Показать уведомление что сохранено
  const btn = document.querySelector('#modal-veg-analysis .btn-primary');
  if (btn) { btn.textContent = '✅ Сохранено!'; setTimeout(()=>btn.textContent='Сохранить', 2000); }
}

function generateVegRecs(analyses) {
  const recs = [];
  const lastLeaf  = [...analyses].filter(a=>a.type==='leaf').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  const lastSoil  = [...analyses].filter(a=>a.type==='soil').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  const lastWater = [...analyses].filter(a=>a.type==='water').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  if(lastLeaf){
    Object.entries(VEG_LEAF_NORMS).forEach(([el,n])=>{
      if(lastLeaf[el]===undefined)return;
      const val=lastLeaf[el];
      if(val<n.min){
        const methods=[];
        if(n.foliar) methods.push({method:'foliar',text:n.foliar});
        if(n.drip)   methods.push({method:'drip',  text:n.drip});
        if(n.soil)   methods.push({method:'soil',  text:n.soil});
        recs.push({level:val<n.min*0.7?'critical':'warn',source:'🍃 Лист',element:el,name:n.name,
          found:val,unit:n.unit,norm:`${n.min}–${n.max}`,symptom:n.deficiency,methods});
      } else if(val>n.max){
        recs.push({level:'excess',source:'🍃 Лист',element:el,name:n.name,
          found:val,unit:n.unit,norm:`${n.min}–${n.max}`,symptom:n.excess,
          methods:[{method:'note',text:'Снизить дозы. Проверить pH почвы.'}]});
      }
    });
  }
  if(lastSoil){
    Object.entries(VEG_SOIL_NORMS).forEach(([key,n])=>{
      if(lastSoil[key]===undefined)return;
      const val=lastSoil[key];
      const isLow=val<n.min, isHigh=val>n.max;
      if(!isLow&&!isHigh)return;
      recs.push({level:isLow?'critical':'excess',source:'🌱 Почва',element:key,name:n.name,
        found:val,unit:n.unit,norm:`${n.min}–${n.max}`,
        symptom:isLow?n.low:n.high,
        methods:isLow&&n.fix_low?[{method:'soil',text:n.fix_low}]:n.fix_high?[{method:'note',text:n.fix_high}]:[]});
    });
  }
  if(lastWater){
    Object.entries(VEG_WATER_NORMS).forEach(([key,n])=>{
      if(lastWater[key]===undefined)return;
      const val=lastWater[key];
      const isHigh=n.max!==undefined&&val>n.max, isLow=n.min!==undefined&&val<n.min;
      if(!isHigh&&!isLow)return;
      recs.push({level:'critical',source:'💧 Вода',element:key,name:n.name,
        found:val,unit:n.unit,norm:`${n.min??0}–${n.max??'∞'}`,
        symptom:isHigh?n.high:n.low,
        methods:n.fix_high&&isHigh?[{method:'water',text:n.fix_high}]:[]});
    });
  }
  return recs;
}

function renderVegAnalyses() {
  // Populate parcel filter
  const pf = document.getElementById('vaf-parcel');
  const curPf = pf?.value||'';
  if(pf){
    pf.innerHTML='<option value="">Все участки</option>';
    S.parcels.forEach(p=>{
      const c=getCropById(p.cropId);
      pf.innerHTML+=`<option value="${p.id}" ${curPf===p.id?'selected':''}>${p.name}${c?' · '+c.emoji:''}</option>`;
    });
  }
  const parcelFilter=pf?.value||'';
  let analyses=[...(S.vegAnalyses||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  if(parcelFilter) analyses=analyses.filter(a=>!a.parcelId||a.parcelId===parcelFilter);
  if(_vegAnTab!=='all') analyses=analyses.filter(a=>a.type===_vegAnTab);

  // Recommendations
  const allFiltered=parcelFilter?(S.vegAnalyses||[]).filter(a=>!a.parcelId||a.parcelId===parcelFilter):S.vegAnalyses||[];
  const recs=generateVegRecs(allFiltered);
  const MC={soil:'🌱 В почву',foliar:'🍃 Листовое',drip:'💧 Капельное',water:'💧 Вода',note:'📝 Примечание'};
  const MC2={soil:'var(--accent)',foliar:'var(--blue)',drip:'var(--teal)',water:'var(--blue)',note:'var(--text3)'};
  const recEl=document.getElementById('veg-analysis-recs');
  if(recEl){
    if(recs.length){
      recEl.innerHTML=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <div style="padding:10px 16px;background:var(--surface2);display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="font-family:'Unbounded',sans-serif;font-size:11px;font-weight:700;color:var(--text2);">💊 Рекомендации</div>
          ${recs.filter(r=>r.level==='critical').length?`<span style="padding:2px 10px;border-radius:10px;background:rgba(255,85,85,.15);color:var(--red);font-size:10px;font-weight:700;">${recs.filter(r=>r.level==='critical').length} дефицитов</span>`:''}
          ${recs.filter(r=>r.level!=='critical').length?`<span style="padding:2px 10px;border-radius:10px;background:rgba(255,216,77,.1);color:var(--yellow);font-size:10px;">${recs.filter(r=>r.level!=='critical').length} отклонений</span>`:''}
        </div>
        ${recs.map(r=>{
          const lc=r.level==='critical'?'var(--red)':r.level==='excess'?'var(--yellow)':'var(--orange)';
          const lt=r.level==='critical'?'❌ Дефицит':r.level==='excess'?'⚠️ Избыток':'⚠️ Отклонение';
          return `<div style="padding:12px 16px;border-top:1px solid var(--border);">
            <div style="display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
              <span style="font-size:10px;padding:2px 8px;border-radius:8px;background:rgba(96,165,250,.1);color:var(--blue);">${r.source}</span>
              <strong style="font-size:13px;color:${lc};">${r.element} — ${r.name}</strong>
              <span style="font-size:11px;color:var(--text3);">Найдено: <strong style="color:${lc};">${r.found} ${r.unit}</strong> · Норма: ${r.norm} ${r.unit}</span>
              <span style="font-size:10px;padding:2px 8px;border-radius:8px;background:${lc}22;color:${lc};">${lt}</span>
            </div>
            ${r.symptom?`<div style="font-size:11px;color:var(--text2);margin-bottom:8px;padding:5px 10px;background:var(--surface2);border-radius:6px;">🔍 ${r.symptom}</div>`:''}
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${r.methods.map(m=>`<div style="padding:8px 12px;border-radius:8px;border:1px solid ${MC2[m.method]||'var(--border)'}44;background:${MC2[m.method]||'var(--surface2)'}11;flex:1;min-width:180px;">
                <div style="font-size:10px;font-weight:700;color:${MC2[m.method]||'var(--text3)'};margin-bottom:3px;">${MC[m.method]||m.method}</div>
                <div style="font-size:11px;color:var(--text2);">${m.text}</div>
              </div>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    } else if(analyses.length) {
      recEl.innerHTML=`<div style="padding:10px 16px;background:rgba(107,221,107,.06);border:1px solid rgba(107,221,107,.2);border-radius:8px;font-size:12px;color:var(--accent);">✅ Все показатели в норме</div>`;
    } else recEl.innerHTML='';
  }

  // Cards
  const grid=document.getElementById('veg-analysis-grid');
  if(!analyses.length){
    grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3);">
      <div style="font-size:32px;margin-bottom:12px;">🔬</div>
      <div style="font-size:13px;margin-bottom:6px;">Нет анализов</div>
      <div style="font-size:11px;">Добавьте анализ листа, почвы или воды</div>
    </div>`;return;
  }
  const ICONS={leaf:'🍃',soil:'🌱',water:'💧'};
  const LABELS={leaf:'Анализ листа',soil:'Анализ почвы',water:'Анализ воды'};
  grid.innerHTML=analyses.map(an=>{
    const parcel=S.parcels.find(p=>p.id===an.parcelId);
    const crop=getCropById(parcel?.cropId);
    let rows='';
    if(an.type==='leaf'){
      rows=Object.entries(VEG_LEAF_NORMS).filter(([el])=>an[el]!==undefined).map(([el,n])=>{
        const val=an[el];const st=val<n.min?'var(--red)':val>n.max?'var(--yellow)':'var(--accent)';
        return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border);">
          <span style="color:var(--text3);">${el} · ${n.name}</span>
          <span style="font-weight:700;color:${st};">${val} ${n.unit}</span>
        </div>`;
      }).join('');
    } else if(an.type==='soil'){
      rows=Object.entries(VEG_SOIL_NORMS).filter(([k])=>an[k]!==undefined).map(([k,n])=>{
        const val=an[k];const st=val<n.min?'var(--red)':val>(n.max||1e9)?'var(--yellow)':'var(--accent)';
        return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border);">
          <span style="color:var(--text3);">${k} · ${n.name}</span>
          <span style="font-weight:700;color:${st};">${val} ${n.unit}</span>
        </div>`;
      }).join('');
    } else {
      rows=Object.entries(VEG_WATER_NORMS).filter(([k])=>an[k]!==undefined).map(([k,n])=>{
        const val=an[k];const st=val>(n.max||1e9)?'var(--red)':'var(--accent)';
        return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border);">
          <span style="color:var(--text3);">${k} · ${n.name}</span>
          <span style="font-weight:700;color:${st};">${val} ${n.unit}</span>
        </div>`;
      }).join('');
    }
    return `<div class="parcel-card" onclick="openVegAnalysisModal('${an.type}','${an.id}')" style="cursor:pointer;border-left-color:${an.type==='leaf'?'var(--accent)':an.type==='soil'?'#8B6914':'var(--blue)'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div style="font-size:18px;">${ICONS[an.type]||'🔬'}</div>
        <div style="text-align:right;">
          <div style="font-size:11px;font-family:'Unbounded',sans-serif;color:var(--text2);">${an.date}</div>
          ${parcel?`<div style="font-size:10px;color:${crop?'var(--accent)':'var(--text3)'};">${parcel.name}${crop?' · '+crop.emoji:''}</div>`:'<div style="font-size:10px;color:var(--text3);">Все участки</div>'}
          ${an.lab?`<div style="font-size:10px;color:var(--text3);">${an.lab}</div>`:''}
          ${an.pdfCount?`<div style="font-size:10px;color:var(--blue);margin-top:2px;">📄 ${an.pdfCount} PDF</div>`:''}
        </div>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:6px;">${LABELS[an.type]||'Анализ'}</div>
      ${rows}
      ${an.note?`<div style="font-size:10px;color:var(--text3);margin-top:6px;">${an.note}</div>`:''}
    </div>`;
  }).join('');
}

// ─── INIT ─────────────────────────────────────────────────────────────────
