// Smart Agro — treatments.js
// ===================== TREATMENTS =====================

// ═══════════════════════════════════════════════════════════════════════════
// ORCHARD TREATMENT SYSTEM — баковые смеси, ротация, редактирование
// ═══════════════════════════════════════════════════════════════════════════

// FRAC / IRAC группы для ротации (расширенный список для сада)
const ORCHARD_RESIST = {
  'Скор':{frac:'3',g:'ДМИ Триазолы'},'Топаз':{frac:'3',g:'ДМИ Триазолы'},
  'Хорус':{frac:'9',g:'Аниламиды'},'Свитч':{frac:'9+12',g:'Аниламиды+Фенилпирролы'},
  'Квадрис':{frac:'11',g:'QoI Стробилурины'},'Строби':{frac:'11',g:'QoI Стробилурины'},
  'Делан':{frac:'3',g:'ДМИ'},'Луна Транквилити':{frac:'7+9',g:'SDHI+Аниламиды'},
  'Ридомил Голд':{frac:'4',g:'Фениламиды'},'Актара':{irac:'4a',g:'Неоникотиноиды'},
  'Конфидор':{irac:'4a',g:'Неоникотиноиды'},'Калипсо':{irac:'4c',g:'Неоникотиноиды'},
  'Спинтор':{irac:'5',g:'Спинозины'},'Децис':{irac:'3',g:'Пиретроиды'},
  'Каратэ':{irac:'3',g:'Пиретроиды'},'Коряген':{irac:'28',g:'Диамиды'},
  'Ниссоран':{irac:'10a',g:'Клофентезин'},'Санмайт':{irac:'21a',g:'METI-акарицид'},
  'Омайт':{irac:'12b',g:'Органофосфаты'},'Золон':{irac:'1b',g:'Органофосфаты'},
};

const ORCHARD_INCOMPAT = [
  ['Медь','Ридомил'],['Медь','Фосфат'],['Бордоская','Органик'],
  ['Са-нитрат','Фосфат'],['Са-нитрат','Сульфат'],['MAP','Са-нитрат'],
  ['Карбамид','Кальций'],['Сера','Масло'],['Сера','Каптан'],
  ['Сера','Карбамат'],['Известь','Кислота'],
];

function orchardCheckCompat(names) {
  const w=[];
  for(let i=0;i<names.length;i++) for(let j=i+1;j<names.length;j++) {
    for(const [x,y] of ORCHARD_INCOMPAT) {
      if((names[i].includes(x)&&names[j].includes(y))||(names[i].includes(y)&&names[j].includes(x)))
        w.push(`❌ ${names[i]} + ${names[j]} — несовместимы`);
    }
  }
  return w;
}

function orchardCheckRotation(prodName, cellTarget) {
  const g=ORCHARD_RESIST[prodName]; if(!g) return null;
  const key=g.frac||g.irac;
  const recent=[...S.treatments]
    .filter(t=>cellTarget==='all'||(t.cellTarget===cellTarget||t.cellTarget==='all'))
    .sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,8);
  const cnt=recent.filter(t=>(t.products||[{name:t.product}]).some(p=>{
    const gr=ORCHARD_RESIST[p.name]; return gr&&(gr.frac||gr.irac)===key;
  })).length;
  return cnt>=2?{warning:`⚠️ РОТАЦИЯ: ${prodName} (гр.${key}/${g.g}) применён ${cnt}× подряд — смените FRAC/IRAC группу!`}:null;
}

let _otProductRows=[];
let _otEditId=null;
let _otCells=[]; // выбранные клетки для обработки

function _buildTreatCellList(selectedKeys=[]) {
  _otCells = selectedKeys.slice();
  const listEl = document.getElementById('t-cell-list');
  if(!listEl) return;
  const cells = Object.keys(S.cells).sort();
  // "Весь сад" кнопка
  listEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:6px;cursor:pointer;margin-bottom:4px;border-bottom:1px solid var(--border);"
      onclick="toggleTrCellAll()" id="trc-all">
    <input type="checkbox" id="trcc-all" style="accent-color:var(--accent);" ${!_otCells.length?'checked':''}>
    <span style="font-weight:600;">🌳 Весь сад (все клетки)</span>
  </div>` + cells.map(k => {
    const cd = S.cells[k];
    const col = getCellColors(cd);
    const crop = getCropById(cd?.cropId||'crop_cherry');
    const ha = calcCellTotals(cd)?.totalHa||0;
    const sel = _otCells.includes(k);
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:6px;cursor:pointer;${sel?'background:rgba(107,221,107,.1);':''}"
        onclick="toggleTrCell('${k}')" id="trc-${k}">
      <input type="checkbox" id="trcc-${k}" style="accent-color:var(--accent);" ${sel?'checked':''} onclick="event.stopPropagation();toggleTrCell('${k}')">
      <span>${crop?.emoji||'🌳'} <strong>${k}</strong>${col[0]?' — '+col[0].name:''}</span>
      <span style="margin-left:auto;color:var(--text3);font-size:11px;">${ha.toFixed(3)} га</span>
    </div>`;
  }).join('');
  _updateTrCellInfo();
}

function toggleTrCellAll() {
  _otCells = [];
  document.querySelectorAll('[id^="trc-"]').forEach(el => el.style.background='');
  document.querySelectorAll('[id^="trcc-"]').forEach(cb => cb.checked=false);
  document.getElementById('trcc-all').checked = true;
  _updateTrCellInfo();
  orchardUpdateChecks();
}

function toggleTrCell(k) {
  const idx = _otCells.indexOf(k);
  if(idx>=0) _otCells.splice(idx,1); else _otCells.push(k);
  // обновляем UI
  const row = document.getElementById('trc-'+k);
  const cb = document.getElementById('trcc-'+k);
  if(row) row.style.background = _otCells.includes(k) ? 'rgba(107,221,107,.1)' : '';
  if(cb) cb.checked = _otCells.includes(k);
  // "Весь сад" — снять если выбрана конкретная клетка
  const allCb = document.getElementById('trcc-all');
  if(allCb) allCb.checked = !_otCells.length;
  _updateTrCellInfo();
  orchardUpdateChecks();
}

function _updateTrCellInfo() {
  const infoEl = document.getElementById('t-cell-crop-info');
  const tagsEl = document.getElementById('t-cell-tags');
  if(!infoEl||!tagsEl) return;
  if(!_otCells.length) {
    tagsEl.innerHTML = '';
    infoEl.textContent = '';
    return;
  }
  let totalHa = 0;
  const tags = _otCells.map(k => {
    const cd = S.cells[k]; if(!cd) return '';
    const col = getCellColors(cd);
    const ha = calcCellTotals(cd)?.totalHa||0;
    totalHa += ha;
    return `<span style="padding:2px 8px;border-radius:10px;background:rgba(107,221,107,.15);color:var(--accent);font-size:11px;">${k}${col[0]?' '+col[0].name:''}</span>`;
  });
  tagsEl.innerHTML = tags.join('');
  infoEl.textContent = `${_otCells.length} кл. · ${totalHa.toFixed(3)} га`;
}

function openTreatmentModal(prefillProdId){
  _otEditId=null; _otProductRows=[];
  document.getElementById('ot-modal-title').textContent='💊 Новая обработка';
  document.getElementById('ot-delete-btn').style.display='none';
  document.getElementById('t-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('t-note').value='';
  document.getElementById('t-water').value='400';
  document.getElementById('t-method-global').value='foliar';
  document.getElementById('ot-compat-warning').style.display='none';
  document.getElementById('ot-rotation-warning').style.display='none';
  document.getElementById('ot-tank-order').style.display='none';

  // Мультивыбор клеток — по умолчанию весь сад
  _buildTreatCellList([]);

  // Variety select
  const vs=document.getElementById('t-var');
  vs.innerHTML='<option value="all">Все сорта</option>';
  S.varieties.forEach(v=>vs.innerHTML+=`<option value="${v.id}">${v.name}</option>`);

  // Copy-from
  const cf=document.getElementById('ot-copy-from');
  cf.innerHTML='<option value="">— скопировать из предыдущей —</option>';
  [...S.treatments].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,15).forEach(t=>{
    const names=(t.products||[{name:t.product}]).map(p=>p.name).join(', ');
    cf.innerHTML+=`<option value="${t.id}">${t.date} · ${t.cellTarget||'сад'} · ${names}</option>`;
  });

  if(prefillProdId){
    const cat=S.catalog.find(c=>c.id===prefillProdId);
    _otProductRows=[{catId:prefillProdId,name:cat?.name||'',type:cat?.type||'fungicide',dose:cat?.dose||'',dur:cat?.duration||14,washMm:cat?.washMm||15,active:cat?.activeSubstance||''}];
  } else {
    _otProductRows=[{catId:'',name:'',type:'fungicide',dose:'',dur:14,washMm:15,active:''}];
  }
  orchardRenderProductRows();
  openModal('modal-treatment');
}

function openTreatmentEditModal(treatId){
  const t=S.treatments.find(x=>x.id==treatId); if(!t) return;
  openTreatmentModal(); // init
  _otEditId=treatId;
  document.getElementById('ot-modal-title').textContent='✏️ Редактировать обработку';
  document.getElementById('ot-delete-btn').style.display='block';
  document.getElementById('t-date').value=t.date||'';
  // Восстанавливаем выбор клеток
  const savedCells = t.cellsTarget?.length ? t.cellsTarget : (t.cellTarget&&t.cellTarget!=='all'?[t.cellTarget]:[]);
  _buildTreatCellList(savedCells);
  document.getElementById('t-var').value=t.varietyTarget||'all';
  document.getElementById('t-method-global').value=t.method||'foliar';
  document.getElementById('t-water').value=t.water||400;
  document.getElementById('t-note').value=t.note||'';
  // Load products
  if(t.products?.length){
    _otProductRows=t.products.map(p=>({...p}));
  } else {
    _otProductRows=[{catId:t.catalogId||'',name:t.product||'',type:t.type||'fungicide',
      dose:t.dose||'',dur:t.duration||14,washMm:t.washMm||15,active:t.activeSubstance||''}];
  }
  orchardRenderProductRows();
}

function orchardRenderProductRows(){
  const TC={fungicide:'var(--teal)',insecticide:'var(--orange)',herbicide:'var(--yellow)',
    fertilizer:'var(--accent)',acaricide:'var(--purple)',microelement:'var(--blue)',other:'var(--text3)'};
  const TL={fungicide:'Фунгицид',insecticide:'Инсектицид',herbicide:'Гербицид',
    fertilizer:'Удобрение',acaricide:'Акарицид',microelement:'Микроэл',other:'Другое'};
  document.getElementById('ot-products-list').innerHTML=_otProductRows.map((row,idx)=>`
    <div style="display:grid;grid-template-columns:1fr 120px 80px 55px 60px 65px 30px;gap:5px;align-items:start;
      padding:8px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);margin-bottom:4px;">
      <div>
        <select onchange="orchardOnProductSelect(${idx},this.value)"
          style="width:100%;background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:5px 7px;color:var(--text);font-size:11px;margin-bottom:3px;">
          <option value="">— из справочника —</option>
          ${S.catalog.map(c=>`<option value="${c.id}" ${row.catId===c.id?'selected':''}>${c.name}</option>`).join('')}
        </select>
        <input type="text" value="${row.name||''}" placeholder="или ввести вручную"
          oninput="_otProductRows[${idx}].name=this.value;orchardUpdateChecks()"
          style="width:100%;background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:5px 7px;color:var(--text);font-size:11px;">
        <div style="font-size:10px;color:var(--text3);margin-top:2px;">${row.active||''}</div>
      </div>
      <select onchange="_otProductRows[${idx}].type=this.value;orchardRenderProductRows()"
        style="background:${TC[row.type]||'var(--surface2)'}22;border:1px solid ${TC[row.type]||'var(--border)'};border-radius:6px;padding:5px 7px;color:${TC[row.type]||'var(--text)'};font-size:11px;">
        ${Object.entries(TL).map(([v,l])=>`<option value="${v}" ${row.type===v?'selected':''}>${l}</option>`).join('')}
      </select>
      <input type="text" value="${row.dose||''}" placeholder="доза"
        oninput="_otProductRows[${idx}].dose=this.value"
        style="background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:5px 7px;color:var(--text);font-size:11px;">
      <input type="number" value="${row.dur||14}" placeholder="дн"
        oninput="_otProductRows[${idx}].dur=parseInt(this.value)||14"
        style="background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:5px 7px;color:var(--text);font-size:11px;" title="Срок защиты (дней)">
      <input type="number" value="${row.washMm||15}" placeholder="мм"
        oninput="_otProductRows[${idx}].washMm=parseFloat(this.value)||15"
        style="background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:5px 7px;color:var(--text);font-size:11px;" title="Смыв при (мм)">
      <div style="font-size:9px;color:var(--yellow);text-align:center;padding-top:6px;">${(()=>{const g=ORCHARD_RESIST[row.name];return g?`${g.frac?'F'+g.frac:'I'+g.irac}<br><span style="font-size:8px;">${g.g.split(' ')[0]}</span>`:'—';})()}</div>
      <button onclick="_otProductRows.splice(${idx},1);if(!_otProductRows.length)_otProductRows=[{catId:'',name:'',type:'fungicide',dose:'',dur:14,washMm:15}];orchardRenderProductRows();"
        style="width:26px;height:26px;border:none;background:rgba(255,85,85,.15);color:var(--red);border-radius:6px;cursor:pointer;">✕</button>
    </div>`).join('');
  orchardUpdateChecks();
}

function orchardOnProductSelect(idx,catId){
  const cat=S.catalog.find(c=>c.id===catId); if(!cat) return;
  _otProductRows[idx]={..._otProductRows[idx],catId,name:cat.name,type:cat.type||'fungicide',
    dose:cat.dose||'',dur:cat.duration||14,washMm:cat.washMm||15,active:cat.activeSubstance||''};
  orchardRenderProductRows();
}

function orchardAddProductRow(){
  _otProductRows.push({catId:'',name:'',type:'fungicide',dose:'',dur:14,washMm:15,active:''});
  orchardRenderProductRows();
}

function orchardUpdateChecks(){
  const names=_otProductRows.map(r=>r.name).filter(Boolean);
  const cellTarget=document.getElementById('t-cell')?.value||'all';
  // Compat
  const cw=orchardCheckCompat(names);
  const cwEl=document.getElementById('ot-compat-warning');
  if(cw.length){cwEl.style.display='block';cwEl.innerHTML='<strong>⚗️ Несовместимость в баке:</strong><br>'+cw.join('<br>');}
  else cwEl.style.display='none';
  // Rotation
  const rw=[];
  names.forEach(n=>{const r=orchardCheckRotation(n,cellTarget);if(r)rw.push(r.warning);});
  const rwEl=document.getElementById('ot-rotation-warning');
  if(rw.length){rwEl.style.display='block';rwEl.innerHTML='<strong>🔄 Риск резистентности (FRAC/IRAC):</strong><br>'+rw.join('<br>');}
  else rwEl.style.display='none';
  // Tank order
  if(names.length>=2){
    const ord={fertilizer:1,fungicide:2,herbicide:2,microelement:3,insecticide:4,acaricide:4,other:5};
    const sorted=[..._otProductRows].filter(r=>r.name).sort((a,b)=>(ord[a.type]||5)-(ord[b.type]||5));
    document.getElementById('ot-tank-order-text').innerHTML=
      '<span style="color:var(--text3);">½ воды →</span> '+
      sorted.map((r,i)=>`<strong>${i+1}. ${r.name}</strong>${r.dose?' ('+r.dose+')':''}`).join(' → ')+
      ' <span style="color:var(--text3);">→ долить воду → перемешать → опрыскивать</span>';
    document.getElementById('ot-tank-order').style.display='block';
  } else document.getElementById('ot-tank-order').style.display='none';

  // Расчёт итого на площадь клеток
  const waterPerHa = parseFloat(document.getElementById('t-water')?.value)||400;
  // Суммируем площадь выбранных клеток
  let totalHa = 0;
  if(_otCells.length) {
    _otCells.forEach(k => { const cd=S.cells[k]; if(cd) totalHa+=calcCellTotals(cd)?.totalHa||0; });
  }
  const calcEl = document.getElementById('ot-calc-summary');
  if(!calcEl) return;
  if(!names.length){ calcEl.style.display='none'; return; }
  const rows = _otProductRows.filter(r=>r.name);
  const totalWater = totalHa>0 ? Math.round(waterPerHa*totalHa) : null;
  let html = '';
  if(totalHa>0){
    html += `<div style="font-size:10px;color:var(--text3);margin-bottom:8px;">📐 Площадь: <strong style="color:var(--accent);">${totalHa.toFixed(3)} га</strong> · Вода: <strong style="color:var(--blue);">${totalWater} л</strong></div>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:6px;">`;
    rows.forEach(r=>{
      const dose=parseFloat(r.dose)||0;
      if(!dose) return;
      const total=Math.round(dose*totalHa*1000)/1000;
      const TC={fungicide:'var(--teal)',insecticide:'var(--orange)',herbicide:'var(--yellow)',
        fertilizer:'var(--accent)',acaricide:'var(--purple)',microelement:'var(--blue)',other:'var(--text3)'};
      html+=`<div style="padding:6px 10px;border-radius:8px;background:var(--surface3);border:1px solid var(--border);">
        <div style="font-size:11px;font-weight:600;">${r.name}</div>
        <div style="font-family:'Unbounded',sans-serif;font-size:14px;font-weight:700;color:${TC[r.type]||'var(--accent)'};">${total} <span style="font-size:10px;">л/кг</span></div>
      </div>`;
    });
    html += `</div>`;
  } else {
    html = rows.map(r=>{
      const dose=parseFloat(r.dose)||0;
      return dose ? `<span style="font-size:11px;color:var(--text2);">${r.name}: <strong>${dose} л/кг·га</strong></span>` : '';
    }).filter(Boolean).join(' · ');
  }
  calcEl.innerHTML = html;
  calcEl.style.display = html ? 'block' : 'none';
}

function orchardCopyFromTreatment(){
  const id=document.getElementById('ot-copy-from').value; if(!id) return;
  const t=S.treatments.find(x=>x.id==id); if(!t) return;
  if(t.products?.length){
    _otProductRows=t.products.map(p=>({...p}));
  } else {
    _otProductRows=[{catId:t.catalogId||'',name:t.product||'',type:t.type||'fungicide',
      dose:t.dose||'',dur:t.duration||14,washMm:t.washMm||15,active:t.activeSubstance||''}];
  }
  document.getElementById('t-method-global').value=t.method||'foliar';
  document.getElementById('t-water').value=t.water||t.water||400;
  document.getElementById('t-note').value=t.note||'';
  const savedCells = t.cellsTarget?.length ? t.cellsTarget : (t.cellTarget&&t.cellTarget!=='all'?[t.cellTarget]:[]);
  _buildTreatCellList(savedCells);
  orchardRenderProductRows();
}

function orchardDeleteTreatmentFromModal(){
  if(!_otEditId||!confirm('Удалить обработку?'))return;
  const idx=S.treatments.findIndex(t=>t.id==_otEditId);
  if(idx<0){closeModal('modal-treatment');return;}

  const t = S.treatments[idx];

  // Возвращаем препараты на склад
  const products = t.products || (t.product ? [{name:t.product, dose:t.dose, type:t.type}] : []);
  if(products.length && S.warehouse?.chemicals) {
    products.forEach(p => {
      if(!p.name) return;
      const stock = S.warehouse.chemicals.find(x=>x.name.toLowerCase()===p.name.toLowerCase())
                 || S.warehouse.chemicals.find(x=>x.name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]));
      if(stock && p.dose) {
        const doseNum = parseFloat(p.dose)||0;
        if(doseNum > 0) {
          stock.qty = Math.round((parseFloat(stock.qty||0) + doseNum) * 100) / 100;
          // Добавляем в историю склада
          if(!S.warehouse.history) S.warehouse.history=[];
          S.warehouse.history.unshift({
            date: new Date().toISOString().split('T')[0],
            type: 'return',
            name: p.name,
            qty: doseNum,
            unit: stock.unit||'кг',
            note: `Возврат: удалена обработка ${t.date}`,
          });
        }
      }
    });
  }

  S.treatments.splice(idx,1);
  save();closeModal('modal-treatment');renderTreatments();updateHdr();
}

// When crop changes — repopulate variety filter
function onTrCropChange() {
  const cropId = document.getElementById('tr-crop-filter')?.value||'';
  const varSel = document.getElementById('tr-variety-filter');
  if (!varSel) return;
  const curVar = varSel.value;
  varSel.innerHTML = '<option value="">🌿 Все сорта</option>';
  // Show varieties for selected crop
  const vars = cropId
    ? S.varieties.filter(v => (v.cropId||'crop_cherry') === cropId)
    : S.varieties;
  vars.forEach(v => varSel.innerHTML += `<option value="${v.id}" ${curVar===v.id?'selected':''}>${v.name}</option>`);
  renderTreatments();
}

// ─── renderTreatments ────────────────────────────────────────────────────────
// ── Мультиселект обработок ────────────────────────────────────────────────
function trGetSelected() {
  return [...document.querySelectorAll('.tr-check:checked')].map(cb => parseInt(cb.dataset.idx));
}

function trUpdateBulkBar() {
  const sel = trGetSelected();
  const bar = document.getElementById('tr-bulk-bar');
  const cnt = document.getElementById('tr-sel-count');
  if (bar) {
    bar.style.display = sel.length > 0 ? 'flex' : 'none';
  }
  if (cnt) cnt.textContent = `${sel.length} выбрано`;
  // Синхронизируем чекбокс "выбрать все"
  const all = document.querySelectorAll('.tr-check');
  const chkAll = document.getElementById('tr-check-all');
  if (chkAll) chkAll.indeterminate = sel.length > 0 && sel.length < all.length;
  if (chkAll) chkAll.checked = sel.length > 0 && sel.length === all.length;
}

function trToggleAll(checked) {
  document.querySelectorAll('.tr-check').forEach(cb => cb.checked = checked);
  trUpdateBulkBar();
}

function trClearSelection() {
  document.querySelectorAll('.tr-check').forEach(cb => cb.checked = false);
  const chkAll = document.getElementById('tr-check-all');
  if (chkAll) { chkAll.checked = false; chkAll.indeterminate = false; }
  trUpdateBulkBar();
}

function trDeleteSelected() {
  const idxs = trGetSelected();
  if (!idxs.length) return;
  if (!confirm(`Удалить ${idxs.length} обработок? Это действие нельзя отменить.`)) return;
  // Удаляем от большего индекса к меньшему чтобы не сбить позиции
  const sorted = [...idxs].sort((a,b) => b - a);
  sorted.forEach(i => S.treatments.splice(i, 1));
  save();
  renderTreatments();
  updateHdr();
  trUpdateBulkBar();
}

function renderTreatments(){
  const todayDate=new Date(); todayDate.setHours(0,0,0,0);
  const precip=parseFloat(document.getElementById('precip-input')?.value)||0;

  // ══ УВЕДОМЛЕНИЯ ══
  const alertsEl = document.getElementById('tr-alerts');
  if(alertsEl) {
    const alerts = [];
    S.treatments.forEach(t => {
      const products = t.products||[{name:t.product,washMm:t.washMm,duration:t.duration}];
      products.forEach(p => {
        const endDate = new Date(t.endDate||'2000-01-01');
        const daysLeft = Math.ceil((endDate-todayDate)/86400000);
        const washMm = parseFloat(p.washMm||t.washMm)||15;
        const cellLabel = t.cellsTarget?.length ? t.cellsTarget.join(', ') : (t.cellTarget||'сад');

        // Смыв дождём
        if(precip>0 && precip>=washMm && daysLeft>0) {
          const washed = precip>=washMm*2;
          alerts.push({
            type: washed?'red':'yellow',
            icon: washed?'⛔':'⚠️',
            text: washed
              ? `<strong>${p.name||t.product}</strong> — смыт дождём (${precip}мм ≥ ${washMm*2}мм). Клетки: ${cellLabel}`
              : `<strong>${p.name||t.product}</strong> — частичный смыв (${precip}мм). Эффективность -35%. Клетки: ${cellLabel}`,
            priority: 1,
          });
        }

        // Заканчивает действие через ≤3 дня
        if(daysLeft>0 && daysLeft<=3 && precip<washMm) {
          alerts.push({
            type: daysLeft<=1 ? 'red' : 'yellow',
            icon: '⏳',
            text: `<strong>${p.name||t.product}</strong> — действие заканчивается ${daysLeft===1?'<strong>завтра</strong>':`через <strong>${daysLeft} дн.</strong>`}. Клетки: ${cellLabel}`,
            priority: 2,
          });
        }
      });
    });

    if(alerts.length) {
      alertsEl.innerHTML = alerts
        .sort((a,b)=>a.priority-b.priority)
        .map(a=>`<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-radius:10px;margin-bottom:6px;
          background:${a.type==='red'?'rgba(239,68,68,.08)':'rgba(251,191,36,.08)'};
          border:1px solid ${a.type==='red'?'rgba(239,68,68,.25)':'rgba(251,191,36,.25)'};">
          <span style="font-size:16px;line-height:1.2;">${a.icon}</span>
          <span style="font-size:12px;color:var(--text2);line-height:1.5;">${a.text}</span>
        </div>`).join('');
    } else {
      alertsEl.innerHTML = '';
    }
  }
  // ══════════════════

  // Populate filters
  const cropSel=document.getElementById('tr-crop-filter');
  const cellSel=document.getElementById('tr-cell-filter');
  const varSel=document.getElementById('tr-variety-filter');
  if(cropSel){
    const curCrop=cropSel.value;
    cropSel.innerHTML='<option value="">🌿 Все культуры</option>';
    S.crops.forEach(c=>cropSel.innerHTML+=`<option value="${c.id}" ${curCrop===c.id?'selected':''}>${c.emoji||''} ${c.name}</option>`);
  }
  // Populate variety filter based on selected crop
  if(varSel){
    const curVar=varSel.value;
    const cropId=cropSel?.value||'';
    const vars=cropId?S.varieties.filter(v=>(v.cropId||'crop_cherry')===cropId):S.varieties;
    varSel.innerHTML='<option value="">🌿 Все сорта</option>';
    vars.forEach(v=>varSel.innerHTML+=`<option value="${v.id}" ${curVar===v.id?'selected':''}>${v.name}</option>`);
  }
  if(cellSel){
    const curCell=cellSel.value;
    cellSel.innerHTML='<option value="">📍 Все клетки</option>';
    Object.keys(S.cells).forEach(k=>{
      const col=getCellColors(S.cells[k]);
      cellSel.innerHTML+=`<option value="${k}" ${curCell===k?'selected':''}>${k}${col[0]?' — '+col[0].name:''}</option>`;
    });
  }

  const cropFilter=document.getElementById('tr-crop-filter')?.value||'';
  const varietyFilter=document.getElementById('tr-variety-filter')?.value||'';
  const cellFilter=document.getElementById('tr-cell-filter')?.value||'';
  const typeFilter=document.getElementById('tr-type-filter')?.value||'';
  const periodFilter=parseInt(document.getElementById('tr-period-filter')?.value)||0;
  const strictVariety=document.getElementById('tr-strict-variety')?.checked||false;
  const cutoff=periodFilter?new Date(Date.now()-periodFilter*86400000).toISOString().split('T')[0]:'0';

  let treatments=[...S.treatments];
  if(periodFilter) treatments=treatments.filter(t=>t.date>=cutoff);
  if(cellFilter) treatments=treatments.filter(t=>t.cellTarget===cellFilter||t.cellTarget==='all');
  if(typeFilter==='drip') treatments=treatments.filter(t=>t.method==='drip');
  else if(typeFilter) treatments=treatments.filter(t=>t.type===typeFilter);

  // Crop filter
  if(cropFilter){
    treatments=treatments.filter(t=>{
      if(t.cropId) return t.cropId===cropFilter;
      if(t.cellTarget&&t.cellTarget!=='all'){const cd=S.cells[t.cellTarget];return cd&&(cd.cropId||'crop_cherry')===cropFilter;}
      if(cropFilter==='crop_cherry') return true;
      return false;
    });
  }

  // Variety filter
  // Default (strict=OFF): показывать обработки этого сорта + весь сад (применимы ко всем)
  // Strict (strict=ON):   показывать ТОЛЬКО явно назначенные этому сорту (исключить "весь сад")
  if(varietyFilter){
    const variety=S.varieties.find(v=>v.id===varietyFilter);
    const varCropId=variety?.cropId||'crop_cherry';
    treatments=treatments.filter(t=>{
      // Прямое совпадение сорта
      if(t.varietyTarget===varietyFilter) return true;
      // "Все сорта" — включаем если не строгий режим
      if(!t.varietyTarget||t.varietyTarget==='all'){
        if(strictVariety) return false;
        // Проверяем что культура клетки совпадает с культурой сорта
        if(t.cellTarget==='all'||!t.cellTarget) return true;
        const cellCropId=S.cells[t.cellTarget]?.cropId||'crop_cherry';
        return cellCropId===varCropId;
      }
      return false;
    });
  }

  const cntEl=document.getElementById('tr-count-badge');
  if(cntEl) cntEl.textContent=`${treatments.length} из ${S.treatments.length} обработок`;

  if(!treatments.length){
    document.getElementById('tr-tbody').innerHTML=`<tr><td colspan="10" style="color:var(--text3);text-align:center;padding:24px;">
      Нет обработок${cropFilter||cellFilter||typeFilter?' по фильтрам' : ' — нажмите + Обработка'}
    </td></tr>`;
    return;
  }

  document.getElementById('tr-tbody').innerHTML = treatments.map((t) => {
    try {
      const origIdx = S.treatments.indexOf(t);
      const washMm = parseFloat(t.washMm)||15;
      let dur = parseInt(t.duration)||14;
      let wn = '—';
      if(precip>=washMm*2){dur=0;wn=`<span style="color:var(--red)">⛔ Смыт</span>`;}
      else if(precip>=washMm){dur=Math.round(dur*.65);wn=`<span style="color:var(--yellow)">⚠️ -35%</span>`;}
      else if(precip>0) wn=`<span style="color:var(--accent)">✅ Цел</span>`;
      const end=new Date(t.date||'2000-01-01');end.setDate(end.getDate()+dur);
      const dl=Math.ceil((end-todayDate)/86400000);
      const pct=dur>0?Math.max(0,Math.min(100,(dl/Math.max(1,t.duration))*100)):0;
      const colHex=pct>50?'#4ade80':pct>20?'#fbbf24':'#ef4444';
      const isAct=todayDate<=end&&dur>0;
      const sb=dur===0?`<span class="badge badge-red">Смыт</span>`:isAct?`<span class="badge badge-${pct>50?'green':pct>20?'yellow':'red'}">${dl} дн.</span>`:`<span class="badge badge-gray">Завершён</span>`;
      const vn=t.varietyTarget==='all'?'Все':(S.varieties.find(v=>v.id===t.varietyTarget)?.name||t.varietyTarget||'Все');

      // Multi-product or single product display
      const prodHtml = (() => {
        if (t.products && t.products.length) {
          return t.products.map(p => {
            const g = ORCHARD_RESIST[p.name];
            const frac = g ? `<span style="font-size:9px;color:var(--yellow);margin-left:4px;">${g.frac?'F'+g.frac:'I'+g.irac}</span>` : '';
            return `<div style="font-size:11px;"><strong>${p.name||'—'}</strong>${frac} <span style="color:var(--text3);font-size:10px;">${p.dose||''}</span></div>`;
          }).join('');
        }
        return `<strong>${t.product||'—'}</strong>`;
      })();

      const typeLabel = t.type ? `<span style="font-size:9px;padding:2px 6px;border-radius:10px;margin-left:4px;" class="pc-type ${t.type}">${TYPE_LABELS[t.type]||t.type}</span>` : '';
      const methodLabel = t.method ? `<div style="font-size:10px;margin-top:2px;padding:2px 6px;border-radius:8px;display:inline-block;background:${METHOD_COLORS[t.method]||'rgba(74,222,128,.1)'};">${METHOD_LABELS[t.method]||t.method}</div>` : '';

      const cd = t.cellTarget && t.cellTarget!=='all' ? S.cells[t.cellTarget] : null;
      const cropId = t.cropId || (cd?.cropId) || null;
      const crop = cropId ? getCropById(cropId) : null;
      const cropBadge = crop
        ? `<div style="font-size:11px;display:flex;align-items:center;gap:4px;"><span style="font-size:14px;">${crop.emoji||'🌱'}</span>${crop.name}</div>`
        : `<div style="font-size:11px;color:var(--text3);">Весь сад</div>`;

      return `<tr id="tr-row-${origIdx}">
        <td style="text-align:center;"><input type="checkbox" class="tr-check" data-idx="${origIdx}" onchange="trUpdateBulkBar()" style="cursor:pointer;width:15px;height:15px;"></td>
        <td style="font-size:11px;font-family:'Unbounded',sans-serif;white-space:nowrap;">${t.date||'—'}</td>
        <td>${cropBadge}</td>
        <td>${prodHtml}${typeLabel}${methodLabel}${t.note?`<br><span style="font-size:10px;color:var(--text3);">${t.note}</span>`:''}</td>
        <td style="font-size:11px;">${t.dose||'—'}${t.dose?' л/га':''}<br><span style="font-size:10px;color:var(--text3);">${t.water||400} л/га воды</span></td>
        <td style="font-size:12px;">${t.cellTarget||'все'}<br><span style="color:var(--text3);">${vn}</span></td>
        <td><span style="font-size:11px;font-family:'Unbounded',sans-serif;">${t.duration||14}д</span>
          <div class="tl-bar" style="width:90px;"><div class="tl-fill" style="width:${pct}%;background:${colHex};"></div><div class="tl-lbl">${dl>0?dl+'д':0}</div></div>
        </td>
        <td style="font-size:11px;white-space:nowrap;">${t.endDate||'—'}</td>
        <td>${sb}</td>
        <td style="font-size:11px;">${wn}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-danger btn-xs" onclick="if(confirm('Удалить?')){S.treatments.splice(${origIdx},1);save();renderTreatments();updateHdr();}">✕</button>
        </td>
      </tr>`;
    } catch(err) {
      return `<tr><td colspan="10" style="color:var(--red);font-size:11px;padding:8px;">Ошибка рендеринга: ${err.message}</td></tr>`;
    }
  }).join('');
}

function onTreatmentCellChange() { orchardUpdateChecks(); } // legacy, мультивыбор через _otCells

function saveTreatment(){
  const date=document.getElementById('t-date').value;
  if(!date){alert('Введите дату');return;}
  const products=_otProductRows.filter(r=>r.name?.trim());
  if(!products.length){alert('Добавьте хотя бы один препарат');return;}

  // Use first product for backward compat fields
  const first=products[0];
  const maxDur=Math.max(...products.map(p=>p.dur||14));
  const minWash=Math.min(...products.map(p=>p.washMm||15));
  const end=new Date(date);end.setDate(end.getDate()+maxDur);

  const entry={
    id:_otEditId||Date.now(),date,
    product:products.map(p=>p.name).join(' + '),
    products,
    activeSubstance:products.map(p=>p.active).filter(Boolean).join(', '),
    type:first.type,
    method:document.getElementById('t-method-global').value,
    dose:first.dose,
    water:document.getElementById('t-water').value||400,
    duration:maxDur, washMm:minWash, catalogId:first.catId||null,
    endDate:end.toISOString().split('T')[0],
    cellsTarget:_otCells.length ? _otCells : [],
    cellTarget:_otCells.length===1 ? _otCells[0] : (_otCells.length>1 ? _otCells.join(',') : 'all'),
    cropId:(()=>{if(_otCells.length===1&&S.cells[_otCells[0]])return S.cells[_otCells[0]].cropId||null;return null;})(),
    varietyTarget:document.getElementById('t-var').value,
    note:document.getElementById('t-note').value
  };

  if(_otEditId){
    const idx=S.treatments.findIndex(t=>t.id==_otEditId);
    if(idx>=0) S.treatments[idx]=entry; else S.treatments.unshift(entry);
  } else {
    S.treatments.unshift(entry);
  }
  save();closeModal('modal-treatment');renderTreatments();updateHdr();
}


// ─── ORCHARD GDD CALIBRATION ─────────────────────────────────────────────
function toggleOrchardCalibration() {
  const el = document.getElementById('orchard-calibration');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  if (el.style.display === 'block') renderOrchardCalibRows();
}

// ── Расчёт среднего GDD по годам ────────────────────────────────────────
function calcAverageGdd(varietyId, phaseCount) {
  const history = S.gddDb.calibrationHistory?.[varietyId] || {};
  const years = Object.keys(history).sort();
  if(!years.length) return S.gddDb.varietyGdd?.[varietyId] || [];

  // Для каждой фазы считаем среднее по всем годам
  const result = [];
  for(let i = 0; i < phaseCount; i++) {
    const vals = years.map(y => history[y].gddValues?.[i]).filter(v => v != null && !isNaN(v));
    if(!vals.length) {
      result.push(S.gddDb.varietyGdd?.[varietyId]?.[i] || i*100);
    } else {
      // Среднее с округлением
      result.push(Math.round(vals.reduce((s,v)=>s+v,0) / vals.length * 10) / 10);
    }
  }
  // Обеспечиваем возрастание
  for(let i=1;i<result.length;i++) {
    if(result[i]<=result[i-1]) result[i]=result[i-1]+1;
  }
  return result;
}

// ── История калибровок — показываем в панели GDD ─────────────────────────
function renderCalibrationHistory(varietyId, phases) {
  const history = S.gddDb.calibrationHistory?.[varietyId] || {};
  const years = Object.keys(history).sort();
  if(!years.length) return `<div style="font-size:11px;color:var(--text3);padding:8px;">История пуста — первая калибровка появится здесь после сохранения.</div>`;

  const avgGdds = calcAverageGdd(varietyId, phases.length);
  const confInterval = years.length >= 2 ? calcConfidenceInterval(varietyId, phases.length) : null;

  return `
    <div style="margin-top:16px;padding:14px;background:var(--surface);border-radius:10px;border:1px solid var(--border);">
      <div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
        <span>📊 История калибровок (${years.length} ${years.length===1?'год':years.length<5?'года':'лет'})</span>
        ${years.length>=2?`<span style="color:var(--accent);font-size:10px;">✅ Среднее активно</span>`:`<span style="color:var(--yellow);font-size:10px;">⏳ Нужно 2+ года для среднего</span>`}
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table" style="font-size:11px;">
          <thead><tr>
            <th>Фаза</th>
            ${years.map(y=>`<th style="color:var(--blue);">${y}</th>`).join('')}
            ${years.length>=2?`<th style="color:var(--accent);">Среднее</th><th style="color:var(--text3);">±</th>`:''}
          </tr></thead>
          <tbody>
            ${phases.map((ph,i)=>`<tr>
              <td style="color:${ph.color};font-weight:600;">${ph.name}</td>
              ${years.map(y=>{
                const v = history[y]?.gddValues?.[i];
                const d = history[y]?.dates?.[i];
                return `<td style="color:var(--text2);">${v!=null?v:'—'}${d?`<br><span style="color:var(--text3);font-size:9px;">${d}</span>`:''}`;
              }).join('')}
              ${years.length>=2?`
                <td style="color:var(--accent);font-weight:700;">${avgGdds[i]}</td>
                <td style="color:var(--text3);">${confInterval?'±'+confInterval[i]:''}</td>
              `:''}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${years.length>=2?`<div style="margin-top:10px;padding:8px 12px;background:rgba(74,222,128,.06);border-radius:8px;font-size:11px;color:var(--text2);">
        🎯 Рабочие пороги обновлены автоматически как среднее за ${years.length} лет.
        ${years.length>=3?`Доверительный интервал сужается с каждым годом.`:'Добавь данные за 3+ лет для более высокой точности.'}
      </div>`:''}
    </div>`;
}

function calcConfidenceInterval(varietyId, phaseCount) {
  const history = S.gddDb.calibrationHistory?.[varietyId] || {};
  const years = Object.keys(history).sort();
  if(years.length < 2) return null;
  return Array.from({length: phaseCount}, (_, i) => {
    const vals = years.map(y=>history[y].gddValues?.[i]).filter(v=>v!=null&&!isNaN(v));
    if(vals.length < 2) return '—';
    const mean = vals.reduce((s,v)=>s+v,0)/vals.length;
    const std = Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/(vals.length-1));
    return Math.round(std*10)/10;
  });
}

function renderOrchardCalibRows() {
  const varietyId = document.getElementById('gdd-variety-select')?.value;
  const cropId    = document.getElementById('gdd-crop-select')?.value;
  const crop      = getCropById(cropId);
  const container = document.getElementById('orchard-calib-rows');
  if (!container || !crop || !varietyId) {
    if (container) container.innerHTML = '<div style="color:var(--text3);font-size:12px;">Выберите культуру и сорт выше</div>';
    return;
  }

  // Current GDD thresholds for this variety
  const currentGdds = S.gddDb.varietyGdd?.[varietyId] || [];
  const calibKey    = `calib_${varietyId}`;
  const calib       = S.settings?.[calibKey] || {};

  // GDD start date
  const gddStartDate = S.gddDb?.startDate || (new Date().getFullYear() + '-03-01');
  const baseTemp     = crop.baseTemp || 5;

  container.innerHTML = `
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px;padding:8px 12px;background:var(--surface);border-radius:8px;border:1px solid var(--border);">
      💡 <strong>Как работает калибровка:</strong> введи дату когда ты наблюдал начало фазы в саду.
      Система сама посчитает накопленный GDD на ту дату из данных погоды и обновит пороги для сорта
      <strong>${S.varieties.find(v=>v.id===varietyId)?.name||varietyId}</strong>.
      После сохранения — все риски, алерты и фазы пересчитаются автоматически.
    </div>
    <div style="display:grid;grid-template-columns:170px 150px 80px 1fr 100px;gap:6px;padding:6px 10px;
      background:var(--surface2);border-radius:6px;font-family:'Unbounded',sans-serif;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">
      <div>Фаза</div><div>Факт. дата</div><div>GDD факт.</div><div>Наблюдение</div><div>Статус</div>
    </div>
    ${(crop.phases||[]).map((ph, idx) => {
      const saved      = calib[idx] || {};
      const stdGdd     = currentGdds[idx] !== undefined ? currentGdds[idx] : '—';
      const calibrated = saved.calibratedGdd !== undefined;
      const factGdd    = saved.calibratedGdd !== undefined ? saved.calibratedGdd : '—';
      const statusColor = calibrated ? 'var(--accent)' : 'var(--text3)';
      const statusText  = calibrated ? `✅ ${factGdd} GDD` : 'стандарт ' + stdGdd;
      return `<div style="display:grid;grid-template-columns:170px 150px 80px 1fr 100px;gap:6px;align-items:center;
        padding:7px 10px;background:var(--surface);border-radius:7px;border:1px solid ${calibrated?'rgba(107,221,107,.3)':'var(--border)'};margin-bottom:3px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:${ph.color};">${ph.name}</div>
          <div style="font-size:10px;color:var(--text3);">Станд. GDD: ${stdGdd}</div>
        </div>
        <div>
          <input type="date" id="orcalib-${idx}" value="${saved.actualDate||''}"
            onchange="onOrchardCalibDateChange(${idx},'${varietyId}','${cropId}')"
            style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;
              padding:4px 7px;color:var(--text);font-size:11px;">
        </div>
        <div id="orcalib-gdd-${idx}" style="font-family:'JetBrains Mono',monospace;font-size:12px;
          font-weight:700;color:${statusColor};text-align:center;">${factGdd !== '—' ? factGdd : '—'}</div>
        <input type="text" id="orcalib-note-${idx}" value="${saved.note||''}"
          placeholder="что видели в саду..."
          style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;
            padding:4px 7px;color:var(--text);font-size:11px;">
        <div style="font-size:10px;color:${statusColor};text-align:center;">${statusText}</div>
      </div>`;
    }).join('')}
    ${renderCalibrationHistory(varietyId, crop.phases||[])}
  `;
}

// Called when user enters a date — immediately calculate GDD and show it
function onOrchardCalibDateChange(phaseIdx, varietyId, cropId) {
  const dateVal = document.getElementById(`orcalib-${phaseIdx}`)?.value;
  if (!dateVal) return;

  const crop     = getCropById(cropId);
  const baseTemp = crop?.baseTemp || 5;
  const startDate = S.gddDb?.startDate || (new Date().getFullYear() + '-03-01');

  // Calculate cumulative GDD from startDate to the entered date
  const sorted = [...(S.weather||[])].sort((a,b)=>a.date.localeCompare(b.date));
  let cumGdd = 0;
  for (const w of sorted) {
    if (w.date < startDate) continue;
    if (w.date > dateVal) break;
    const tmax = parseFloat(w.tmax) || 0;
    const tmin = parseFloat(w.tmin) || 0;
    cumGdd += calcDailyGdd(tmin, tmax, baseTemp, 30);
  }
  cumGdd = Math.round(cumGdd * 10) / 10;

  // Show calculated GDD immediately
  const gddEl = document.getElementById(`orcalib-gdd-${phaseIdx}`);
  if (gddEl) {
    gddEl.textContent = cumGdd;
    gddEl.style.color = 'var(--yellow)';
    gddEl.title = `GDD на ${dateVal} от ${startDate} (база ${baseTemp}°C)`;
  }
}

// Save calibration and recalculate all GDD thresholds for this variety
function saveOrchardCalibration() {
  const varietyId = document.getElementById('gdd-variety-select')?.value;
  const cropId    = document.getElementById('gdd-crop-select')?.value;
  const crop      = getCropById(cropId);
  if (!varietyId || !crop) { alert('Выберите культуру и сорт'); return; }

  const baseTemp  = crop.baseTemp || 5;
  const startDate = S.gddDb?.startDate || (new Date().getFullYear() + '-03-01');
  const phases    = crop.phases || [];

  if (!S.settings) S.settings = {};
  const calibKey = `calib_${varietyId}`;
  const calib    = {};

  // Get current standard GDD array
  const stdGdds = [...(S.gddDb.varietyGdd?.[varietyId] || phases.map((_,i)=>i*100))];

  // For each phase that has a date entered — calculate actual GDD
  const calibratedGdds = [...stdGdds]; // start with standard values
  const enteredPhases  = [];

  phases.forEach((ph, idx) => {
    const dateVal = document.getElementById(`orcalib-${idx}`)?.value;
    const note    = document.getElementById(`orcalib-note-${idx}`)?.value || '';
    if (dateVal) {
      // Calculate GDD from weather data
      const sorted = [...(S.weather||[])].sort((a,b)=>a.date.localeCompare(b.date));
      let cumGdd = 0;
      for (const w of sorted) {
        if (w.date < startDate) continue;
        if (w.date > dateVal) break;
        const tmax = parseFloat(w.tmax)||0;
        const tmin = parseFloat(w.tmin)||0;
        cumGdd += calcDailyGdd(tmin, tmax, baseTemp, 30);
      }
      cumGdd = Math.round(cumGdd * 10) / 10;
      calibratedGdds[idx] = cumGdd;
      calib[idx]          = { actualDate: dateVal, note, calibratedGdd: cumGdd };
      enteredPhases.push({ idx, gdd: cumGdd });
    } else if (note) {
      calib[idx] = { note };
    }
  });

  // Interpolate: fill gaps between calibrated anchor points
  // If we have anchors at idx=4 (GDD=280) and idx=7 (GDD=560),
  // intermediate phases are scaled proportionally
  if (enteredPhases.length >= 2) {
    for (let i = 0; i < enteredPhases.length - 1; i++) {
      const a = enteredPhases[i];
      const b = enteredPhases[i+1];
      // Linear interpolation for phases between a and b
      for (let idx = a.idx + 1; idx < b.idx; idx++) {
        if (!document.getElementById(`orcalib-${idx}`)?.value) {
          // Standard ratio in this interval
          const stdA = stdGdds[a.idx] || 0;
          const stdB = stdGdds[b.idx] || 1;
          const stdI = stdGdds[idx]   || 0;
          if (stdB > stdA) {
            const ratio = (stdI - stdA) / (stdB - stdA);
            calibratedGdds[idx] = Math.round(a.gdd + ratio * (b.gdd - a.gdd));
          }
        }
      }
    }
  }

  // Ensure ascending order (GDD can only increase)
  for (let i = 1; i < calibratedGdds.length; i++) {
    if (calibratedGdds[i] <= calibratedGdds[i-1]) {
      calibratedGdds[i] = calibratedGdds[i-1] + 1;
    }
  }

  // ── Сохраняем в историю по годам ──────────────────────────────────────
  const year = new Date().getFullYear().toString();
  if(!S.gddDb.calibrationHistory) S.gddDb.calibrationHistory = {};
  if(!S.gddDb.calibrationHistory[varietyId]) S.gddDb.calibrationHistory[varietyId] = {};

  // Собираем даты и примечания для истории
  const historyDates = {}, historyNotes = {};
  phases.forEach((ph, idx) => {
    const dateVal = document.getElementById(`orcalib-${idx}`)?.value;
    const note    = document.getElementById(`orcalib-note-${idx}`)?.value||'';
    if(dateVal) historyDates[idx] = dateVal;
    if(note)    historyNotes[idx] = note;
  });

  S.gddDb.calibrationHistory[varietyId][year] = {
    gddValues:    [...calibratedGdds],
    dates:        historyDates,
    notes:        historyNotes,
    calibratedAt: new Date().toISOString(),
    season:       startDate,
  };

  // ── Пересчитываем среднее по всем годам ──────────────────────────────
  const avgGdds = calcAverageGdd(varietyId, phases.length);
  S.gddDb.varietyGdd[varietyId] = avgGdds;
  S.settings[calibKey] = calib;
  save();

  const years = Object.keys(S.gddDb.calibrationHistory[varietyId]||{}).sort();
  alert(`✅ Калибровка ${year} сохранена!\n\nДанных за ${years.length} ${years.length===1?'год':years.length<5?'года':'лет'}: ${years.join(', ')}\n${years.length>=2?`Пороги фаз обновлены как среднее за ${years.length} лет.`:'Накопи данные за 2+ года для автоматического усреднения.'}`);

  // Re-render everything that depends on GDD
  renderGdd();
  renderOrchardCalibRows();

  // Show summary
  const changedCount = enteredPhases.length;
  const msg = changedCount > 0
    ? `✅ Калибровка применена для ${S.varieties.find(v=>v.id===varietyId)?.name||varietyId}:\n` +
      enteredPhases.map(ep => {
        const ph = phases[ep.idx];
        const std = stdGdds[ep.idx];
        const diff = Math.round(ep.gdd - std);
        return `  ${ph.name}: ${std} → ${ep.gdd} GDD (${diff>0?'+':''}${diff})`;
      }).join('\n') +
      `\n\nФазы пересчитаны. Риски и алерты обновлены.`
    : '⚠️ Введите хотя бы одну фактическую дату фазы';

  alert(msg);
}

function autoFillPrecip() {
  // Суммируем осадки за последние 7 дней из метеостанции
  if(!S.weather?.length) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate()-7);
  const recent = S.weather.filter(w => {
    const d = new Date(w.date); return d >= weekAgo && d <= today;
  });
  if(!recent.length) return;
  const total7 = recent.reduce((s,w) => s+parseFloat(w.precip||0), 0);
  const rounded = Math.round(total7*10)/10;
  const inp = document.getElementById('precip-input');
  if(inp && !inp._userEdited) {
    inp.value = rounded > 0 ? rounded : '';
    inp.title = `Автозаполнено из метеостанции: осадки за 7 дней (${recent.length} дн.)`;
    inp.style.borderColor = 'rgba(74,222,128,.5)';
  }
  updateRain();
}

function updateRain(){
  const inp = document.getElementById('precip-input');
  const p = parseFloat(inp?.value)||0;
  const b = document.getElementById('rain-badge');
  if(p<=0){b.style.display='none'; renderTreatments(); return;}
  b.style.display='inline-block';
  const washMms = S.treatments.filter(t=>{
    const end = new Date(t.endDate||'2000-01-01');
    return end >= new Date();
  }).map(t=>parseFloat(t.washMm)||15);
  const minWash = washMms.length ? Math.min(...washMms) : 15;
  if(p>=minWash*2){
    b.style.background='rgba(239,68,68,.15)';b.style.color='var(--red)';
    b.textContent=`⛔ ${p}мм — смывает препараты`;
  } else if(p>=minWash){
    b.style.background='rgba(251,191,36,.15)';b.style.color='var(--yellow)';
    b.textContent=`⚠️ ${p}мм — частичный смыв`;
  } else {
    b.style.background='rgba(74,222,128,.15)';b.style.color='var(--accent)';
    b.textContent=`✅ ${p}мм — препараты в норме`;
  }
  renderTreatments(); renderMap();
}
