// Smart Agro — catalog.js
// ===================== CATALOG =====================
const TYPE_LABELS={fungicide:'Фунгицид',insecticide:'Инсектицид',herbicide:'Гербицид',fertilizer:'Удобрение',microelement:'Микроэлементы',other:'Другое'};
const WASH_LABELS={partial:'Частичный смыв',full:'Полный смыв',resistant:'Устойчив к дождю'};
const WASH_COLORS={partial:'var(--yellow)',full:'var(--red)',resistant:'var(--accent)'};
const METHOD_LABELS={foliar:'🌿 Листовая',soil:'🌱 В почву',drip:'💧 Капельное',trunk:'🌳 Прикорневое',any:'🔄 Любой'};
const METHOD_COLORS={foliar:'rgba(74,222,128,.15)',soil:'rgba(251,191,36,.15)',drip:'rgba(96,165,250,.15)',trunk:'rgba(251,146,60,.15)',any:'rgba(148,163,184,.15)'};

function renderCatalog(){
  const grid=document.getElementById('prod-grid');
  const typeF=document.getElementById('cat-type-filter').value;
  const search=document.getElementById('cat-search').value.toLowerCase();
  let prods=S.catalog.filter(p=>{
    if(typeF&&p.type!==typeF)return false;
    if(search&&!p.name.toLowerCase().includes(search)&&!p.activeSubstance.toLowerCase().includes(search))return false;
    return true;
  });
  if(!prods.length){grid.innerHTML='<div style="color:var(--text3);grid-column:1/-1;padding:30px;text-align:center;">Нет препаратов. Нажмите "+ Добавить препарат"</div>';return;}
  grid.innerHTML=prods.map(p=>{
    // Wash visualization: 10 segments, color up to washMm threshold
    const washPct=Math.min(100,Math.round((p.washMm/50)*10))*10;
    const washSegs=[...Array(10)].map((_,i)=>{
      const filled=(i+1)*5<=p.washMm;
      return`<div class="wash-seg" style="background:${filled?WASH_COLORS[p.washType]||'var(--yellow)':'var(--surface3)'};"></div>`;
    }).join('');
    return`<div class="prod-card">
      <div class="pc-type ${p.type}">${TYPE_LABELS[p.type]||p.type}</div>
      <div class="pc-name">${p.name}</div>
      <div class="pc-active">${p.activeSubstance}${(p.fracCode||p.moaGroup)?` · <span style="color:${(MOA_DB.frac[p.fracCode]||MOA_DB.irac[p.fracCode]||{}).color||'var(--text3)'};font-weight:600;">FRAC ${p.fracCode||'?'}</span> ${p.moaGroup||''}`:''}</div>
      <div class="pc-row"><span class="pc-lbl">Доза</span><span class="pc-val">${p.dose} кг/л·га</span></div>
      <div class="pc-row"><span class="pc-lbl">Расход воды</span><span class="pc-val">${p.water} л/га</span></div>
      <div class="pc-row"><span class="pc-lbl">Способ внесения</span><span class="pc-val" style="padding:2px 8px;border-radius:10px;font-size:10px;background:${METHOD_COLORS[p.method||'foliar']||'rgba(74,222,128,.15)'};">${METHOD_LABELS[p.method||'foliar']||'—'}</span></div>
      <div class="pc-row"><span class="pc-lbl">Срок действия</span><span class="pc-val">${p.duration} дней</span></div>
      <div class="pc-row"><span class="pc-lbl">Период ожидания</span><span class="pc-val">${p.phi} дней</span></div>
      <div class="pc-row"><span class="pc-lbl">Класс опасности</span><span class="pc-val">${p.hazard}</span></div>
      ${p.targets?`<div class="pc-row"><span class="pc-lbl">Против</span><span class="pc-val" style="text-align:right;max-width:160px;">${p.targets}</span></div>`:''}
      ${p.compatibility?`<div class="pc-row"><span class="pc-lbl" style="color:var(--red);">🚫 Не смешивать</span><span class="pc-val" style="text-align:right;max-width:160px;font-size:11px;color:var(--red);">${p.compatibility}</span></div>`:''}
      <div style="margin-top:10px;">
        <div style="font-size:10px;color:var(--text3);margin-bottom:4px;">${WASH_LABELS[p.washType]||''} при ${p.washMm}мм+</div>
        <div class="wash-bar">${washSegs}</div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-top:2px;"><span>0мм</span><span>25мм</span><span>50мм</span></div>
      </div>
      ${p.note?`<div style="margin-top:8px;font-size:11px;color:var(--text2);border-top:1px solid var(--border);padding-top:8px;">💡 ${p.note}</div>`:''}
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="btn btn-secondary btn-xs" onclick="editCatalogProduct('${p.id}')">✏️ Изменить</button>
        <button class="btn btn-primary btn-xs" onclick="quickAddTreatment('${p.id}')">💊 Применить</button>
      </div>
    </div>`;
  }).join('');
}

/** Sync catalog from all treatments history — adds missing products */
function syncCatalogFromTreatments() {
  let added = 0;
  S.treatments.forEach(t => {
    if (!t.product || t.type === 'other') return;
    const inCatalog = S.catalog.some(c => c.name.toLowerCase() === t.product.toLowerCase());
    if (inCatalog) return;
    const defDuration = {fungicide:14,insecticide:21,herbicide:30,fertilizer:7}[t.type]||7;
    const defWashMm = {fungicide:15,insecticide:25,herbicide:20,fertilizer:5}[t.type]||15;
    S.catalog.push({
      id: 'p'+Date.now()+Math.random().toString(36).slice(2,6),
      name: t.product,
      type: t.type,
      activeSubstance: '',
      dose: t.dose||0,
      water: t.water||(t.method==='foliar'?400:0),
      duration: defDuration,
      washMm: defWashMm,
      washType: 'partial',
      method: t.method||'foliar',
      phi: 7, hazard: 3,
      targets: '',
      note: `Из истории обработок (${t.date})`,
    });
    added++;
  });
  save();
  renderCatalog();
  if (added > 0)
    alert(`✅ Добавлено ${added} новых препаратов в справочник.\nОткройте каждый (✏️ Изменить) и заполните активное вещество, дозу, срок действия.`);
  else
    alert('Все препараты из истории обработок уже есть в справочнике.');
}

function openCatalogAddModal(){
  S.editingCatalogId=null;
  document.getElementById('cat-modal-title').textContent='📦 Новый препарат';
  document.getElementById('cp-del-btn').style.display='none';
  ['cp-name','cp-active','cp-targets','cp-note'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('cp-dose').value='';
  document.getElementById('cp-water').value='400';
  document.getElementById('cp-duration').value='14';
  document.getElementById('cp-wash-mm').value='15';
  document.getElementById('cp-phi').value='7';
  document.getElementById('cp-type').value='fungicide';
  document.getElementById('cp-wash-type').value='partial';
  document.getElementById('cp-hazard').value='3';
  document.getElementById('cp-vat-rate').value='20';
  openModal('modal-catalog-add');
}

function editCatalogProduct(id){
  const p=S.catalog.find(p=>p.id===id);if(!p)return;
  S.editingCatalogId=id;
  document.getElementById('cat-modal-title').textContent='✏️ Редактировать: '+p.name;
  document.getElementById('cp-del-btn').style.display='inline-flex';
  document.getElementById('cp-name').value=p.name;
  document.getElementById('cp-active').value=p.activeSubstance;
  document.getElementById('cp-frac').value=p.fracCode||p.fracGroup||MOA_PRODUCTS[p.name]?.frac||MOA_PRODUCTS[p.name]?.irac||'';
  document.getElementById('cp-moa-group').value=p.moaGroup||p.fracGroup||MOA_PRODUCTS[p.name]?.fracGroup||MOA_PRODUCTS[p.name]?.iracGroup||'';
  document.getElementById('cp-type').value=p.type;
  document.getElementById('cp-dose').value=p.dose;
  document.getElementById('cp-water').value=p.water;
  document.getElementById('cp-duration').value=p.duration;
  document.getElementById('cp-wash-mm').value=p.washMm;
  document.getElementById('cp-wash-type').value=p.washType;
  document.getElementById('cp-method').value=p.method||'foliar';
  document.getElementById('cp-phi').value=p.phi;
  document.getElementById('cp-hazard').value=p.hazard;
  document.getElementById('cp-vat-rate').value=String(p.vatRate ?? 20);
  document.getElementById('cp-targets').value=p.targets||'';
  document.getElementById('cp-compat').value=p.compatibility||'';
  document.getElementById('cp-note').value=p.note||'';
  openModal('modal-catalog-add');
}

function saveCatalogProduct(){
  const name=document.getElementById('cp-name').value.trim();if(!name){alert('Введите название');return;}
  const prod={
    id:S.editingCatalogId||('p'+Date.now()),
    name,
    type:document.getElementById('cp-type').value,
    activeSubstance:document.getElementById('cp-active').value,
    fracCode: document.getElementById('cp-frac').value.trim(),
    moaGroup: document.getElementById('cp-moa-group').value.trim(),
    dose:parseFloat(document.getElementById('cp-dose').value)||0,
    water:parseFloat(document.getElementById('cp-water').value)||400,
    duration:parseInt(document.getElementById('cp-duration').value)||14,
    washMm:parseFloat(document.getElementById('cp-wash-mm').value)||15,
    washType:document.getElementById('cp-wash-type').value,
    method:document.getElementById('cp-method').value,
    phi:parseInt(document.getElementById('cp-phi').value)||0,
    hazard:parseInt(document.getElementById('cp-hazard').value)||3,
    targets:document.getElementById('cp-targets').value,
    compatibility:document.getElementById('cp-compat').value,
    vatRate: parseFloat(document.getElementById('cp-vat-rate').value) || 0,
    note:document.getElementById('cp-note').value,
  };
  if(S.editingCatalogId){const i=S.catalog.findIndex(p=>p.id===S.editingCatalogId);if(i>=0)S.catalog[i]=prod;}
  else S.catalog.push(prod);
  save();closeModal('modal-catalog-add');renderCatalog();
}

function deleteCatalogProduct(){
  if(!S.editingCatalogId)return;
  if(!confirm('Удалить препарат из справочника?'))return;
  S.catalog=S.catalog.filter(p=>p.id!==S.editingCatalogId);
  save();closeModal('modal-catalog-add');renderCatalog();
}

// Fill treatment form from catalog selection
function fillFromCatalog(){
  const id=document.getElementById('t-catalog-select').value;
  if(!id){document.getElementById('t-auto-fill').style.display='none';return;}
  const p=S.catalog.find(p=>p.id===id);if(!p)return;
  document.getElementById('t-prod').value=p.name;
  document.getElementById('t-active').value=p.activeSubstance;
  document.getElementById('t-type').value=p.type;
  document.getElementById('t-dose').value=p.dose;
  document.getElementById('t-water').value=p.water;
  document.getElementById('t-dur').value=p.duration;
  document.getElementById('t-wash-mm').value=p.washMm;
  // store method in a data attribute on the form
  document.getElementById('t-catalog-select').dataset.method=p.method||'foliar';
  const af=document.getElementById('t-auto-fill');
  af.style.display='block';
  af.innerHTML=`✅ Заполнено: <strong>${p.name}</strong> · ${p.activeSubstance} · ${p.duration} дн. · ${METHOD_LABELS[p.method||'foliar']||''} · смыв при ${p.washMm}мм · ${WASH_LABELS[p.washType]||''}${p.targets?' · Против: '+p.targets:''}`;
}

// Quick apply from catalog card button
function quickAddTreatment(prodId){
  // Открываем журнал работ с предзаполненным препаратом
  const taskTab = document.querySelector('[onclick*="switchTab(\'tasks\'"]');
  if(taskTab) switchTab('tasks', taskTab);
  openNewTask().then(()=>{
    // Предзаполняем препарат
    addNtChem(prodId);
    // Выбираем вид работ "Обработка"
    const wtSel = document.getElementById('nt-wt');
    if(wtSel) {
      const opt = Array.from(wtSel.options).find(o=>o.text.toLowerCase().includes('обработка')||o.text.toLowerCase().includes('опрыскив'));
      if(opt) wtSel.value = opt.value;
    }
  });
}

// ===================== GRID =====================
function ck(r,c){return r+'-'+c;}
function rebuildGrid(){S.rows=parseInt(document.getElementById('set-rows').value)||6;S.cols=parseInt(document.getElementById('set-cols').value)||8;save();renderMap();}

function getCellColors(cd){
  if(!cd||!cd.rows||!cd.rows.length)return[];
  const rs=parseFloat(cd.rowSpacing)||5;const ts=parseFloat(cd.treeSpacing)||3;
  const counts={};
  cd.rows.forEach(r=>{
    const c=calcRowEntry(r,rs,ts);
    if(r.varietyId){counts[r.varietyId]=(counts[r.varietyId]||0)+c.areaHa;}
  });
  const total=Object.values(counts).reduce((a,b)=>a+b,0)||1;
  return Object.entries(counts).map(([vid,ha])=>{
    const v=S.varieties.find(v=>v.id===vid);
    return{vid,color:v?.color||'vc3',pct:Math.round(ha/total*100),name:v?.name||'?'};
  }).sort((a,b)=>b.pct-a.pct);
}

function getActiveTr(key){
  const today=new Date();const precip=parseFloat(document.getElementById('precip-input')?.value)||0;
  return S.treatments.filter(t=>{
    if(t.cellTarget!=='all'&&t.cellTarget!==key)return false;
    const washMm=parseFloat(t.washMm)||15;
    let dur=parseInt(t.duration);
    // Per-treatment wash logic: use treatment's own washMm threshold
    if(precip>=washMm*2)dur=0; // full wash at 2x threshold
    else if(precip>=washMm)dur=Math.round(dur*.65); // partial at threshold
    const end=new Date(t.date);end.setDate(end.getDate()+dur);
    if(today>end)return false;
    t._days=Math.ceil((end-today)/86400000);
    t._ws=precip>=washMm*2?'washed':precip>=washMm?'partial':'active';
    return true;
  });
}

function renderMap(){
  const area=document.getElementById('map-area');
  let ch='<div class="col-hdr-row"><div class="col-hdr-empty"></div>';
  for(let c=1;c<=S.cols;c++)ch+=`<div class="col-hdr">${c}</div>`;
  ch+='</div>';area.innerHTML=ch;
  const g=document.createElement('div');g.className='orchard-grid';
  g.style.gridTemplateColumns=`38px repeat(${S.cols},80px)`;
  for(let r=1;r<=S.rows;r++){
    const rh=document.createElement('div');rh.className='row-hdr';rh.textContent='Р'+r;g.appendChild(rh);
    for(let c=1;c<=S.cols;c++){
      const key=ck(r,c);const cd=S.cells[key];const div=document.createElement('div');div.className='cell';
      if(!cd){
        div.classList.add('empty');div.innerHTML='<span style="font-size:20px;color:var(--border)">+</span>';
        div.onclick=()=>openCellModal(r,c);
      } else {
        if(S.selectedCell===key)div.classList.add('selected');
        const colors=getCellColors(cd);
        if(colors.length===0){div.style.background='var(--surface3)';}
        else if(colors.length===1){
          const cropEmoji=getCropById(cd?.cropId)?.emoji||'';
          div.classList.add(colors[0].color);
          div.innerHTML=`<div class="cell-stripe"><span class="stripe-label">${cropEmoji} ${colors[0].name}</span></div>`;
        }
        else{
          const cropEmoji=getCropById(cd?.cropId)?.emoji||'';
          div.style.display='flex';div.style.flexDirection='row';
          colors.forEach((col,ci)=>{const stripe=document.createElement('div');stripe.className='cell-stripe '+col.color;stripe.style.flex=col.pct;stripe.innerHTML=`<span class="stripe-label">${ci===0?cropEmoji+' ':''}${col.pct>25?col.name:''}</span>`;div.appendChild(stripe);});
        }
        const atr=getActiveTr(key);
        if(atr.length){const dot=document.createElement('div');dot.className='tdot';dot.style.background=atr[0]._ws==='active'?'#4ade80':atr[0]._ws==='partial'?'#fbbf24':'#ef4444';div.appendChild(dot);}
        const dis=S.diseases.filter(d=>d.cellKey===key||d.cellKey==='');
        if(dis.length){const dd=document.createElement('div');dd.className='ddot';const ms=Math.max(...dis.map(d=>parseInt(d.severity)));dd.style.background=ms>=4?'#ef4444':ms>=2?'#fbbf24':'#4ade80';div.appendChild(dd);}
        const cid=document.createElement('div');cid.className='cell-id';cid.textContent=r+'-'+c;div.appendChild(cid);
        div.onclick=()=>selectCell(key);
      }
      g.appendChild(div);
    }
  }
  area.appendChild(g);renderLegend();renderStats();updateHdr();
}

function selectCell(key){S.selectedCell=key;renderMap();renderCellDetail(key);}

function renderCellDetail(key){
  const cd=S.cells[key];if(!cd)return;
  const [r,c]=key.split('-');
  const totals=calcCellTotals(cd);
  const colors=getCellColors(cd);
  const atr=getActiveTr(key);
  const dis=S.diseases.filter(d=>d.cellKey===key||d.cellKey==='');
  const ans=S.analyses.filter(a=>a.cellKey===key||a.cellKey==='');
  const dp=document.getElementById('detail-panel');

  // Variety summary
  const varSum=colors.map(col=>{
    const v=S.varieties.find(v=>v.id===col.vid);
    const pollLabel=POLL_LABELS[v?.pollType||'cross']||'';
    const pollCls=POLL_CLASS[v?.pollType||'cross']||'cross';
    return`<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">
      <div style="width:12px;height:12px;border-radius:3px;flex-shrink:0;margin-top:2px;" class="${col.color}"></div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span style="font-weight:600;">${col.name}</span>
          <span style="color:var(--text3);font-size:11px;">${col.pct}%</span>
          <span class="poll-badge ${pollCls}" style="font-size:9px;">${pollLabel}</span>
        </div>
        ${v?.pollinators?`<div style="font-size:10px;color:var(--text3);margin-top:2px;">Опылители: ${v.pollinators}</div>`:''}
      </div>
      <div style="text-align:right;font-size:11px;">
        <div style="color:var(--accent);font-family:'Unbounded',sans-serif;">${totals.byVariety[col.vid]?.trees||0} дер.</div>
        <div style="color:var(--text3);">${(totals.byVariety[col.vid]?.ha||0).toFixed(3)} га</div>
      </div>
    </div>`;
  }).join('');

  // Rows detail
  const rowsHtml=(cd.rows||[]).map(row=>{
    const v=S.varieties.find(v=>v.id===row.varietyId);
    const rc=calcRowEntry(row,cd.rowSpacing,cd.treeSpacing);
    return`<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:5px 8px;font-size:11px;color:var(--accent);font-family:'Unbounded',sans-serif;">${row.from}–${row.to}</td>
      <td style="padding:5px 8px;font-size:11px;">${row.rowLength||'—'} м</td>
      <td style="padding:5px 8px;">
        <div style="display:flex;align-items:center;gap:5px;">
          <div style="width:9px;height:9px;border-radius:2px;" class="${v?.color||'vc3'}"></div>
          <span style="font-size:11px;">${v?.name||'?'}</span>
        </div>
      </td>
      <td style="padding:5px 8px;font-size:11px;color:var(--accent2);">${rc.totalTrees}</td>
      <td style="padding:5px 8px;font-size:10px;color:var(--text3);">${rc.areaHa.toFixed(3)} га</td>
    </tr>`;
  }).join('');

  let html=`<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
    <div>
      <div style="font-family:'Unbounded',sans-serif;font-size:14px;color:var(--accent);">Клетка ${r}-${c}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:3px;">Схема: ${cd.rowSpacing||'?'}м × ${cd.treeSpacing||'?'}м${cd.note?' · '+cd.note:''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px;">
        ${cd.cover&&cd.cover!=='none'?`<span style="padding:1px 8px;border-radius:8px;font-size:10px;background:rgba(96,165,250,.12);color:var(--blue);">${{net:'🕸 Сетка',film:'🎪 Плёнка',both:'🎪🕸 Плёнка+сетка'}[cd.cover]||cd.cover}</span>`:''}
        ${cd.rootstock?`<span style="padding:1px 8px;border-radius:8px;font-size:10px;background:var(--surface2);color:var(--text3);">🌳 ${cd.rootstock}</span>`:''}
        ${cd.plantYear?`<span style="padding:1px 8px;border-radius:8px;font-size:10px;background:var(--surface2);color:var(--text3);">📅 ${cd.plantYear}</span>`:''}
        ${cd.plantingScheme?`<span style="padding:1px 8px;border-radius:8px;font-size:10px;background:var(--surface2);color:var(--text3);">📐 ${cd.plantingScheme}</span>`:''}
      </div>
    </div>
    <button class="btn btn-secondary btn-sm" onclick="openCellModal(${r},${c},true)">✏️</button>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
    <div style="background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.15);border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:9px;color:var(--text3);font-family:'Unbounded',sans-serif;text-transform:uppercase;letter-spacing:1px;">Всего га</div>
      <div style="font-family:'Unbounded',sans-serif;font-size:20px;font-weight:700;color:var(--accent);">${totals.totalHa.toFixed(3)}</div>
    </div>
    <div style="background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.15);border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:9px;color:var(--text3);font-family:'Unbounded',sans-serif;text-transform:uppercase;letter-spacing:1px;">Всего деревьев</div>
      <div style="font-family:'Unbounded',sans-serif;font-size:20px;font-weight:700;color:var(--accent);">${totals.totalTrees}</div>
    </div>
  </div>
  <div style="margin-bottom:12px;">${varSum}</div>
  <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;font-family:'Unbounded',sans-serif;">Ряды</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <thead><tr style="border-bottom:1px solid var(--border);">
      <th style="text-align:left;padding:5px 8px;font-size:9px;color:var(--text3);font-family:'Unbounded',sans-serif;">РЯДЫ</th>
      <th style="text-align:left;padding:5px 8px;font-size:9px;color:var(--text3);font-family:'Unbounded',sans-serif;">ДЛИНА</th>
      <th style="text-align:left;padding:5px 8px;font-size:9px;color:var(--text3);font-family:'Unbounded',sans-serif;">СОРТ</th>
      <th style="text-align:left;padding:5px 8px;font-size:9px;color:var(--text3);font-family:'Unbounded',sans-serif;">ДЕРЕВЬЕВ</th>
      <th style="text-align:left;padding:5px 8px;font-size:9px;color:var(--text3);font-family:'Unbounded',sans-serif;">ПЛОЩАДЬ</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>`;

  if(atr.length){
    html+=`<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-family:'Unbounded',sans-serif;">Активные обработки</div>`;
    atr.forEach(t=>{const pct=Math.max(0,Math.min(100,(t._days/t.duration)*100));const col=pct>50?'#4ade80':pct>20?'#fbbf24':'#ef4444';html+=`<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:6px;"><div style="display:flex;justify-content:space-between;"><span style="font-weight:600;">${t.product}</span><span style="font-size:10px;color:var(--text3);">${t.activeSubstance||''}</span></div><div class="tl-bar"><div class="tl-fill" style="width:${pct}%;background:${col};"></div><div class="tl-lbl">Осталось ${t._days} дн.</div></div></div>`;});
  }
  if(ans.length){
    const last=ans[ans.length-1];const norms=getNorms();
    html+=`<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-top:10px;margin-bottom:6px;font-family:'Unbounded',sans-serif;">Анализ листа (${last.date})</div>`;
    ['N','P','K','Ca','Mg'].forEach(el=>{if(!last[el])return;const n=norms[el];const val=parseFloat(last[el]);const ic=val<n.min?'🔴':val>n.max?'🟡':'🟢';html+=`<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text2);">${el}</span><span style="font-family:'Unbounded',sans-serif;font-size:11px;">${val}%</span><span>${ic}</span></div>`;});
  }
  if(dis.length){const d=dis[0];const sc=['','#4ade80','#4ade80','#fbbf24','#fb923c','#ef4444'];html+=`<div style="margin-top:10px;background:var(--surface2);border-radius:8px;padding:10px;"><div style="display:flex;justify-content:space-between;"><span style="font-weight:600;">${d.name}</span><span style="color:${sc[d.severity]};">● ${d.severity}/5</span></div>${d.recommendation?`<div style="font-size:11px;color:var(--accent2);margin-top:3px;">💊 ${d.recommendation}</div>`:''}</div>`;}
  dp.innerHTML=html;
}

function renderLegend(){
  document.getElementById('legend').innerHTML=S.varieties.map(v=>`<div class="legend-item"><div class="legend-dot ${v.color}"></div><span>${v.name} (${v.ripening})</span></div>`).join('')+`<div class="legend-item"><div style="width:8px;height:8px;border-radius:50%;background:#4ade80;"></div><span>Обработка</span></div><div class="legend-item"><div style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></div><span>Болезнь</span></div>`;
}

function renderStats(){
  const cellArr=Object.values(S.cells);
  let totalHa=0,totalTrees=0;
  cellArr.forEach(cd=>{const t=calcCellTotals(cd);totalHa+=t.totalHa;totalTrees+=t.totalTrees;});
  const today=new Date();const ac=S.treatments.filter(t=>{const e=new Date(t.date);e.setDate(e.getDate()+parseInt(t.duration));return today<=e;}).length;
  document.getElementById('stats-row').innerHTML=`
    <div class="stat-card"><div class="sl">Клеток</div><div class="sv">${cellArr.length}</div><div class="ss">из ${S.rows*S.cols}</div></div>
    <div class="stat-card"><div class="sl">Площадь</div><div class="sv">${totalHa.toFixed(2)}</div><div class="ss">га</div></div>
    <div class="stat-card"><div class="sl">Деревьев</div><div class="sv">${totalTrees}</div><div class="ss">всего</div></div>
    <div class="stat-card"><div class="sl">Сортов</div><div class="sv">${S.varieties.length}</div></div>
    <div class="stat-card"><div class="sl">Обработок</div><div class="sv">${S.treatments.length}</div><div class="ss">${ac} активных</div></div>`;
}
function updateHdr(){
  const cellArr=Object.values(S.cells);let totalHa=0,totalTrees=0;
  cellArr.forEach(cd=>{const t=calcCellTotals(cd);totalHa+=t.totalHa;totalTrees+=t.totalTrees;});
  document.getElementById('h-cells').textContent=cellArr.length;
  document.getElementById('h-trees').textContent=totalTrees;
  document.getElementById('h-ha').textContent=totalHa.toFixed(1);
  const today=new Date();document.getElementById('h-active').textContent=S.treatments.filter(t=>{const e=new Date(t.date);e.setDate(e.getDate()+parseInt(t.duration));return today<=e;}).length;
}

// ═══ МОА-РОТАЦИЯ (контроль резистентности) ══════════════════════════════

// Полная FRAC/IRAC база для черешни/садоводства
const MOA_DB = {
  // FRAC — фунгициды
  frac: {
    '1':  {name:'Бензимидазолы', risk:'ВЫСОКИЙ', color:'#dc2626', examples:'Топсин-М, Дерозал', note:'Быстрое развитие резистентности у Botrytis. Не более 2 обр./сезон'},
    '2':  {name:'Дикарбоксимиды', risk:'ВЫСОКИЙ', color:'#dc2626', examples:'Ровраль, Суммилекс', note:'Резистентность у серой гнили'},
    '3':  {name:'ДМИ Триазолы', risk:'СРЕДНИЙ', color:'#f59e0b', examples:'Скор, Топаз, Делан, Тилт', note:'Чередовать с группами 7, 11, 9. Не более 3 обр./сезон'},
    '7':  {name:'SDHI Карбоксамиды', risk:'СРЕДНИЙ', color:'#f59e0b', examples:'Луна Сенсейшн, Белис, Пиктор', note:'Чередовать с группой 3 и 11. Нельзя 2 SDHI подряд'},
    '9':  {name:'Аниламиды (Анилинопиримидины)', risk:'СРЕДНИЙ', color:'#f59e0b', examples:'Хорус, Свитч (компонент)', note:'Эффективен при低 температурах. Макс 2 обр.'},
    '11': {name:'QoI Стробилурины', risk:'ВЫСОКИЙ', color:'#dc2626', examples:'Квадрис, Строби, Свитч (нет)', note:'Резистентность широко распространена у Botrytis и Uncinula. Макс 2 обр./сезон'},
    '12': {name:'Фенилпирролы', risk:'НИЗКИЙ', color:'#16a34a', examples:'Свитч (компонент)', note:'Низкий риск резистентности. Можно использовать шире'},
    '4':  {name:'Фениламиды', risk:'ВЫСОКИЙ', color:'#dc2626', examples:'Ридомил Голд', note:'Только против оомицетов (ложная мучнистая роса). Высокий риск'},
    '33': {name:'Многоцелевые контактные', risk:'НИЗКИЙ', color:'#16a34a', examples:'Медь, Бордоская смесь, Делан', note:'Нет риска резистентности. Основа программы'},
    'M':  {name:'Многоцелевые (Multisite)', risk:'НИЗКИЙ', color:'#16a34a', examples:'Зинеб, Манкоцеб, Каптан', note:'Используются как "якорные" препараты в ротации'},
  },
  // IRAC — инсектициды/акарициды
  irac: {
    '1a': {name:'Органофосфаты', risk:'СРЕДНИЙ', color:'#f59e0b', examples:'Золон, Дурсбан', note:''},
    '1b': {name:'Органофосфаты II', risk:'СРЕДНИЙ', color:'#f59e0b', examples:'Актеллик', note:''},
    '3':  {name:'Пиретроиды', risk:'ВЫСОКИЙ', color:'#dc2626', examples:'Децис, Каратэ, Фастак', note:'Резистентность у Panonychus и Tetranychus'},
    '4a': {name:'Неоникотиноиды', risk:'ВЫСОКИЙ', color:'#dc2626', examples:'Актара, Конфидор, Имидор', note:'Токсично для пчёл. Высокий риск резистентности у тли'},
    '4c': {name:'Неоникотиноиды (тиаклоприд)', risk:'ВЫСОКИЙ', color:'#dc2626', examples:'Калипсо', note:'Токсично для пчёл. Не применять в цветение'},
    '5':  {name:'Спинозины', risk:'СРЕДНИЙ', color:'#f59e0b', examples:'Спинтор, Успин', note:'Осторожно в цветение — токсичен для пчёл'},
    '6':  {name:'Авермектины', risk:'НИЗКИЙ', color:'#16a34a', examples:'Вертимек, Актофит', note:'Хороший для ротации с пиретроидами'},
    '10a':{name:'Клофентезин', risk:'НИЗКИЙ', color:'#16a34a', examples:'Ниссоран', note:'Только против яиц и ранних личинок клеща'},
    '21a':{name:'METI-акарициды', risk:'НИЗКИЙ', color:'#16a34a', examples:'Санмайт, Ортус', note:'Эффективны против всех стадий клеща'},
    '28': {name:'Диамиды', risk:'НИЗКИЙ', color:'#16a34a', examples:'Коряген, Амплиго', note:'Эффективны против гусениц. Низкий риск резистентности'},
  }
};

// Расширенная база препарат → FRAC/IRAC
const MOA_PRODUCTS = {
  'Хорус':          {frac:'9',   fracGroup:'Аниламиды'},
  'Свитч':          {frac:'9+12',fracGroup:'Аниламиды+Фенилпирролы'},
  'Скор':           {frac:'3',   fracGroup:'ДМИ Триазолы'},
  'Топаз':          {frac:'3',   fracGroup:'ДМИ Триазолы'},
  'Делан':          {frac:'3',   fracGroup:'ДМИ Триазолы'},
  'Тилт':           {frac:'3',   fracGroup:'ДМИ Триазолы'},
  'Фалькон':        {frac:'3+7', fracGroup:'ДМИ+SDHI'},
  'Луна Сенсейшн':  {frac:'7+9', fracGroup:'SDHI+Аниламиды'},
  'Луна Транквилити':{frac:'7+9',fracGroup:'SDHI+Аниламиды'},
  'Белис':          {frac:'7+11',fracGroup:'SDHI+Стробилурины'},
  'Пиктор':         {frac:'7+11',fracGroup:'SDHI+Стробилурины'},
  'Квадрис':        {frac:'11',  fracGroup:'QoI Стробилурины'},
  'Строби':         {frac:'11',  fracGroup:'QoI Стробилурины'},
  'Ридомил Голд':   {frac:'4',   fracGroup:'Фениламиды'},
  'Тельдор':        {frac:'17',  fracGroup:'Боскалид (SDHI)'},
  'Топсин':         {frac:'1',   fracGroup:'Бензимидазолы'},
  'Дерозал':        {frac:'1',   fracGroup:'Бензимидазолы'},
  'Актара':         {irac:'4a',  iracGroup:'Неоникотиноиды'},
  'Конфидор':       {irac:'4a',  iracGroup:'Неоникотиноиды'},
  'Калипсо':        {irac:'4c',  iracGroup:'Неоникотиноиды'},
  'Спинтор':        {irac:'5',   iracGroup:'Спинозины'},
  'Вертимек':       {irac:'6',   iracGroup:'Авермектины'},
  'Актеллик':       {irac:'1b',  iracGroup:'Органофосфаты'},
  'Децис':          {irac:'3',   iracGroup:'Пиретроиды'},
  'Каратэ':         {irac:'3',   iracGroup:'Пиретроиды'},
  'Фастак':         {irac:'3',   iracGroup:'Пиретроиды'},
  'Коряген':        {irac:'28',  iracGroup:'Диамиды'},
  'Ниссоран':       {irac:'10a', iracGroup:'Клофентезин'},
  'Санмайт':        {irac:'21a', iracGroup:'METI-акарицид'},
  'Омайт':          {irac:'1a',  iracGroup:'Органофосфаты'},
};

// ── МУЛЬТИ-АГРЕГАТНАЯ СИСТЕМА ────────────────────────────────────────────
let _ntMachines = []; // [{id, equipId, equipName, attachId, attachName, mechanicId, mechanicName, speed, parcelIds, zoneIds}]

function renderNtMachines() {
  const el = document.getElementById('nt-machines-list');
  if(!el) return;
  if(!_ntMachines.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:8px;border:1px dashed var(--border);border-radius:8px;text-align:center;">Нажмите "+ Добавить агрегат" чтобы назначить технику и механизаторов</div>';
    return;
  }
  el.innerHTML = _ntMachines.map((m,i) => `
    <div style="padding:10px 12px;background:var(--surface2);border-radius:8px;border-left:3px solid var(--blue);margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-size:12px;font-weight:700;color:var(--blue);">Агрегат ${i+1}</div>
        <button onclick="_ntMachines.splice(${i},1);renderNtMachines();"
          style="border:none;background:none;color:var(--red);cursor:pointer;font-size:14px;">🗑</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">🚜 Техника</div>
          <select onchange="_ntMachines[${i}].equipId=this.value;_ntMachines[${i}].equipName=this.selectedOptions[0]?.dataset.name||'';renderNtMachines();"
            style="width:100%;padding:6px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;">
            <option value="">— не выбрана —</option>
            ${(_allEquip||[]).map(e=>`<option value="${e.id}" data-name="${e.name}" ${m.equipId===e.id?'selected':''}>${e.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">🔧 Навесное</div>
          <select onchange="_ntMachines[${i}].attachId=this.value;_ntMachines[${i}].attachName=this.selectedOptions[0]?.dataset.name||'';renderNtMachines();"
            style="width:100%;padding:6px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;">
            <option value="">— не выбрано —</option>
            ${(_allAttach||[]).map(a=>`<option value="${a.id}" data-name="${a.name}" ${m.attachId===a.id?'selected':''}>${a.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">👤 Механизатор</div>
          <select onchange="_ntMachines[${i}].mechanicId=this.value;_ntMachines[${i}].mechanicName=this.selectedOptions[0]?.dataset.name||'';renderNtMachines();"
            style="width:100%;padding:6px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;">
            <option value="">— не назначен —</option>
            ${(_taskStaff||[]).map(s=>`<option value="${s.id}" data-name="${s.name}" ${m.mechanicId===s.id?'selected':''}>${s.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">⚡ Скорость (км/ч)</div>
          <input type="number" value="${m.speed||''}" placeholder="5"
            onchange="_ntMachines[${i}].speed=parseFloat(this.value)||0;"
            style="width:100%;padding:6px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;">
        </div>
      </div>
      <!-- Привязка клеток и зон к агрегату -->
      <div style="font-size:10px;color:var(--text3);margin-bottom:4px;">🌳 Клетки / зоны для этого агрегата</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${Object.entries(S.cells||{}).map(([key,cd])=>{
          const crop = getCropById(cd.cropId||'crop_cherry');
          const ha = calcCellTotals(cd)?.totalHa||0;
          const selParcel = (m.parcelIds||[]).includes(key);
          const cellZones = (S.irrigation?.zones||[]).filter(z=>(z.cellKeys||[]).includes(key));
          return `<div style="margin-bottom:4px;width:100%;">
            <div onclick="_ntToggleParcel(${i},'${key}',${ha})" id="ntm-${i}-${key}"
              style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:6px;cursor:pointer;
                background:${selParcel?'rgba(96,165,250,.15)':'var(--surface3)'};
                border:1px solid ${selParcel?'var(--blue)':'var(--border)'};
                color:${selParcel?'var(--blue)':'var(--text3)'};font-size:11px;">
              ${selParcel?'☑':'☐'} ${crop?.emoji||'🌳'} ${key} (${ha.toFixed(2)}га)
            </div>
            ${cellZones.length?cellZones.map(z=>{
              const selZone=(m.zoneIds||[]).includes(z.id);
              return `<span onclick="_ntToggleZone(${i},'${z.id}')" id="ntmz-${i}-${z.id}"
                style="margin-left:6px;padding:2px 8px;border-radius:6px;cursor:pointer;font-size:10px;
                  background:${selZone?'rgba(96,165,250,.15)':'transparent'};
                  border:1px solid ${selZone?'var(--blue)':'var(--border)'};
                  color:${selZone?'var(--blue)':'var(--text3)'};">
                💧 ${z.name}
              </span>`;
            }).join(''):''}
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');
}

function addNtMachine() {
  _ntMachines.push({
    id: uid(),
    equipId:'', equipName:'', attachId:'', attachName:'',
    mechanicId:'', mechanicName:'', speed:0,
    parcelIds:[], zoneIds:[],
  });
  renderNtMachines();
}

function _ntToggleParcel(machineIdx, parcelKey, ha) {
  const m = _ntMachines[machineIdx];
  if(!m) return;
  const idx = m.parcelIds.indexOf(parcelKey);
  if(idx>=0) {
    m.parcelIds.splice(idx,1);
    // Снимаем зоны этой клетки
    const cellZones = (S.irrigation?.zones||[]).filter(z=>(z.cellKeys||[]).includes(parcelKey)).map(z=>z.id);
    m.zoneIds = m.zoneIds.filter(zid=>!cellZones.includes(zid));
  } else {
    m.parcelIds.push(parcelKey);
    // Автовыбор зон клетки
    const cellZones = (S.irrigation?.zones||[]).filter(z=>(z.cellKeys||[]).includes(parcelKey)).map(z=>z.id);
    cellZones.forEach(zid=>{ if(!m.zoneIds.includes(zid)) m.zoneIds.push(zid); });
  }
  renderNtMachines();
  ntUpdateCalc();
}

function _ntToggleZone(machineIdx, zoneId) {
  const m = _ntMachines[machineIdx];
  if(!m) return;
  const idx = m.zoneIds.indexOf(zoneId);
  if(idx>=0) m.zoneIds.splice(idx,1);
  else m.zoneIds.push(zoneId);
  renderNtMachines();
}

let _allEquip = [], _allAttach = [];

function toggleIzVariety(id, el) {
  if(_izSelectedVarieties.has(id)) {
    _izSelectedVarieties.delete(id);
    el.style.background = 'var(--surface3)';
    el.style.color = 'var(--text3)';
    el.style.borderColor = 'var(--border)';
  } else {
    _izSelectedVarieties.add(id);
    el.style.background = 'rgba(74,222,128,.15)';
    el.style.color = 'var(--accent)';
    el.style.borderColor = 'rgba(74,222,128,.3)';
  }
}

function getMoaForProduct(p) {
  // 1. Из самого препарата если есть поле fracGroup
  if(p.fracGroup) return {frac: p.fracGroup, code: p.fracCode||p.fracGroup};
  // 2. Из базы по названию
  const key = Object.keys(MOA_PRODUCTS).find(k => p.name?.includes(k));
  if(key) return MOA_PRODUCTS[key];
  return null;
}

function showMoaAnalysis() {
  const panel = document.getElementById('moa-analysis-panel');
  if(!panel) return;
  if(panel.style.display !== 'none') { panel.style.display='none'; return; }
  panel.style.display = 'block';
  renderMoaAnalysis();
}

function renderMoaAnalysis() {
  const panel = document.getElementById('moa-analysis-panel');
  if(!panel) return;

  // Берём обработки за последние 90 дней
  const cutoff = new Date(Date.now() - 90*864e5).toISOString().split('T')[0];
  const recentTreatments = (S.treatments||[]).filter(t => t.date >= cutoff).sort((a,b)=>a.date.localeCompare(b.date));

  // Группируем по FRAC коду
  const fracUsage = {}; // {fracCode: [{date, product, name}]}
  const catalog = S.catalog||[];

  recentTreatments.forEach(t => {
    const prodName = t.product || t.products?.map(x=>x.name).join('+') || '';
    // Ищем препарат в каталоге
    const catProduct = catalog.find(c => prodName.includes(c.name) || c.name.includes(prodName.split('+')[0]));
    const moa = getMoaForProduct(catProduct||{name:prodName});

    const code = moa?.frac || moa?.fracGroup || moa?.irac || moa?.iracGroup || '?';
    if(!fracUsage[code]) fracUsage[code] = [];
    fracUsage[code].push({date:t.date, name:prodName, product:catProduct});
  });

  // Проверяем повторное применение одной группы подряд
  const warnings = [];
  Object.entries(fracUsage).forEach(([code, uses]) => {
    if(uses.length >= 2 && code !== '?' && code !== 'M' && code !== '33') {
      const moaInfo = MOA_DB.frac[code] || MOA_DB.irac[code] || {};
      if(moaInfo.risk === 'ВЫСОКИЙ') {
        warnings.push({
          level: 'danger',
          code, uses, moaInfo,
          msg: `Группа ${code} (${moaInfo.name||code}) применена ${uses.length} раз — ВЫСОКИЙ риск резистентности!`,
        });
      } else if(moaInfo.risk === 'СРЕДНИЙ' && uses.length >= 3) {
        warnings.push({
          level: 'warn',
          code, uses, moaInfo,
          msg: `Группа ${code} (${moaInfo.name||code}) применена ${uses.length} раз — риск накопления резистентности.`,
        });
      }
    }
  });

  // Рекомендации по ротации
  const usedFracCodes = new Set(Object.keys(fracUsage).filter(c=>c!=='?'));
  const recommendations = [];

  // Если много стробилуринов (11)
  if((fracUsage['11']||[]).length >= 2) {
    recommendations.push('⚠️ Стробилурины (FRAC 11) применены 2+ раз — заменить на SDHI (гр.7) или ДМИ (гр.3)');
  }
  // Если нет "якорного" препарата
  if(!usedFracCodes.has('M') && !usedFracCodes.has('33')) {
    recommendations.push('💡 Добавить "якорный" препарат без риска резистентности (медь, манкоцеб, каптан) в программу');
  }
  // Следующий рекомендуемый класс
  const avoidNext = [...usedFracCodes].slice(-2);
  const allFrac = Object.keys(MOA_DB.frac);
  const nextRec = allFrac.find(c => !avoidNext.includes(c) && MOA_DB.frac[c].risk !== 'ВЫСОКИЙ');
  if(nextRec) {
    recommendations.push(`✅ Следующая обработка: рекомендуется группа FRAC ${nextRec} — ${MOA_DB.frac[nextRec].name} (${MOA_DB.frac[nextRec].examples})`);
  }

  // Строим временную шкалу
  const timelineHtml = recentTreatments.slice(0,15).map(t => {
    const prodName = t.product || t.products?.map(x=>x.name).join('+') || '—';
    const catProduct = catalog.find(c => prodName.includes(c.name));
    const moa = getMoaForProduct(catProduct||{name:prodName});
    const code = moa?.frac || moa?.fracGroup || moa?.irac || moa?.iracGroup || '?';
    const moaInfo = MOA_DB.frac[code] || MOA_DB.irac[code] || {};
    const color = moaInfo.color || 'var(--text3)';
    const riskColor = moaInfo.risk==='ВЫСОКИЙ'?'#dc2626':moaInfo.risk==='СРЕДНИЙ'?'#f59e0b':moaInfo.risk==='НИЗКИЙ'?'#16a34a':'var(--text3)';
    return `<div style="display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:6px;background:var(--surface2);margin-bottom:4px;font-size:11px;">
      <span style="color:var(--text3);min-width:40px;">${t.date?.slice(5)}</span>
      <span style="flex:1;font-weight:600;">${prodName}</span>
      <span style="padding:1px 8px;border-radius:6px;font-size:10px;background:${riskColor}22;color:${riskColor};font-weight:600;">FRAC ${code}</span>
      <span style="font-size:10px;color:var(--text3);">${moaInfo.name||''}</span>
      ${moaInfo.risk?`<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${riskColor}15;color:${riskColor};">${moaInfo.risk}</span>`:''}
    </div>`;
  }).join('');

  panel.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="font-family:'Unbounded',sans-serif;font-size:11px;font-weight:700;">🔄 МОА-ротация — анализ резистентности (90 дней)</div>
        <button onclick="showMoaAnalysis()" style="border:none;background:none;color:var(--text3);cursor:pointer;font-size:18px;">×</button>
      </div>

      ${warnings.length ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">⚠️ Предупреждения о резистентности</div>
          ${warnings.map(w=>`<div style="padding:8px 12px;border-radius:8px;margin-bottom:5px;font-size:11px;
            background:${w.level==='danger'?'rgba(220,38,38,.08)':'rgba(245,158,11,.08)'};
            border-left:3px solid ${w.level==='danger'?'#dc2626':'#f59e0b'};">
            <div style="font-weight:600;margin-bottom:3px;">${w.msg}</div>
            <div style="color:var(--text3);">Применения: ${w.uses.map(u=>`${u.date.slice(5)} ${u.name}`).join(' → ')}</div>
            ${w.moaInfo.note?`<div style="color:var(--text3);margin-top:2px;">📋 ${w.moaInfo.note}</div>`:''}
          </div>`).join('')}
        </div>` : `<div style="padding:8px 12px;border-radius:8px;background:rgba(22,163,74,.08);border-left:3px solid #16a34a;font-size:11px;margin-bottom:12px;">✅ Ротация удовлетворительная — нарушений не обнаружено</div>`}

      ${recommendations.length ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">💡 Рекомендации</div>
          ${recommendations.map(r=>`<div style="font-size:11px;padding:5px 0;color:var(--text2);">${r}</div>`).join('')}
        </div>` : ''}

      <div>
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📅 Хронология обработок (последние 90 дней)</div>
        ${timelineHtml || '<div style="font-size:11px;color:var(--text3);">Обработок не найдено</div>'}
      </div>

      <!-- Справочник FRAC групп -->
      <details style="margin-top:14px;">
        <summary style="font-size:11px;color:var(--text3);cursor:pointer;padding:6px 0;">📚 Справочник FRAC групп (риски резистентности)</summary>
        <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          ${Object.entries(MOA_DB.frac).map(([code,m])=>`
            <div style="padding:8px;border-radius:6px;background:var(--surface2);font-size:10px;">
              <div style="display:flex;gap:6px;align-items:center;margin-bottom:3px;">
                <span style="font-weight:700;">FRAC ${code}</span>
                <span style="padding:1px 6px;border-radius:4px;background:${m.color}22;color:${m.color};font-size:9px;">${m.risk}</span>
              </div>
              <div style="color:var(--text2);margin-bottom:2px;">${m.name}</div>
              <div style="color:var(--text3);">${m.examples}</div>
            </div>`).join('')}
        </div>
      </details>
    </div>`;
}
