// Smart Agro — map.js
// Smart Agro — ui.js
// ===================== CELL MODAL =====================
let editingCellKey=null;
let rowEntries=[];

function openCellModal(r,c,editing=false){
  editingCellKey=r&&c?ck(r,c):null;
  const cd=editingCellKey?S.cells[editingCellKey]:null;
  document.getElementById('cell-modal-title').textContent=editing?`Клетка ${r}-${c}`:'Новая клетка';
  document.getElementById('cm-row').value=r||'';
  document.getElementById('cm-col').value=c||'';
  document.getElementById('cm-note').value=cd?.note||'';
  document.getElementById('cm-row-spacing').value=cd?.rowSpacing||'5';
  document.getElementById('cm-tree-spacing').value=cd?.treeSpacing||'3';
  document.getElementById('btn-del-cell').style.display=cd?'inline-flex':'none';
  // Инфраструктура клетки
  document.getElementById('cm-cover').value       = cd?.cover||'none';
  document.getElementById('cm-rootstock').value   = cd?.rootstock||'';
  document.getElementById('cm-plant-year').value  = cd?.plantYear||'';
  document.getElementById('cm-planting-scheme').value = cd?.plantingScheme||'';
  // Populate and set crop selector
  populateCropSelect();
  const cropId = cd?.cropId || 'crop_cherry';
  document.getElementById('cm-crop').value = cropId;
  // Show crop info
  const cropInfoEl = document.getElementById('cm-crop-info');
  if (cropInfoEl) {
    const crop = getCropById(cropId);
    cropInfoEl.innerHTML = crop ? `${crop.emoji||''} <strong>${crop.name}</strong> · База GDD: +${crop.baseTemp}°C` : '';
  }
  rowEntries=cd?.rows?JSON.parse(JSON.stringify(cd.rows)):[{from:'',to:'',rowLength:'',varietyId:''}];
  renderRowEntries();
  recalcAll();

  // Маршруты от тракторной бригады
  const routes = cd?.routes||[];
  const r1 = routes[0]||{};
  const r2 = routes[1]||{};
  document.getElementById('cm-route1-name').value = r1.name||'';
  document.getElementById('cm-route1-dist').value = r1.distanceKm||'';
  document.getElementById('cm-route1-type').value = r1.roadType||'asphalt';
  document.getElementById('cm-route1-cond').value = r1.condition||'good';
  document.getElementById('cm-route1-note').value = r1.note||'';
  document.getElementById('cm-route2-name').value = r2.name||'';
  document.getElementById('cm-route2-dist').value = r2.distanceKm||'';
  document.getElementById('cm-route2-type').value = r2.roadType||'dirt';
  document.getElementById('cm-route2-cond').value = r2.condition||'good';
  document.getElementById('cm-route2-note').value = r2.note||'';

  openModal('modal-cell');
}

function renderRowEntries(){
  const tbody=document.getElementById('rows-tbody');
  const cellCropId = document.getElementById('cm-crop')?.value || 'crop_cherry';
  const cellVarieties = S.varieties.filter(v=>(v.cropId||'crop_cherry')===cellCropId);
  const varOptions = cellVarieties.map(v=>`<option value="${v.id}">${v.name}</option>`).join('');
  tbody.innerHTML=rowEntries.map((row,i)=>{
    const rs=parseFloat(document.getElementById('cm-row-spacing').value)||5;
    const ts=parseFloat(document.getElementById('cm-tree-spacing').value)||3;
    const rc=calcRowEntry(row,rs,ts);
    return`<tr>
      <td><input type="number" value="${row.from||''}" min="1" placeholder="1" oninput="rowEntries[${i}].from=this.value;recalcAll()"></td>
      <td><input type="number" value="${row.to||''}" min="1" placeholder="10" oninput="rowEntries[${i}].to=this.value;recalcAll()"></td>
      <td><input type="number" value="${row.rowLength||''}" min="0" step="1" placeholder="200" oninput="rowEntries[${i}].rowLength=this.value;recalcAll()"></td>
      <td><select onchange="rowEntries[${i}].varietyId=this.value;recalcAll()"><option value="">— сорт —</option>${varOptions.replace(`value="${row.varietyId}"`,`value="${row.varietyId}" selected`)}</select></td>
      <td><input class="calc" readonly value="${rc.totalTrees||''}"></td>
      <td><input class="calc" readonly value="${rc.areaHa>0?rc.areaHa.toFixed(3):''}"></td>
      <td><button class="btn btn-danger btn-xs" onclick="removeRowEntry(${i})">✕</button></td>
    </tr>`;
  }).join('');
}

function recalcAll(){
  // re-read spacing
  const rs=parseFloat(document.getElementById('cm-row-spacing').value)||5;
  const ts=parseFloat(document.getElementById('cm-tree-spacing').value)||3;
  // recalc each row
  let totalHa=0,totalTrees=0,byVar={};
  rowEntries.forEach((row,i)=>{
    const rc=calcRowEntry(row,rs,ts);
    totalHa+=rc.areaHa;totalTrees+=rc.totalTrees;
    if(row.varietyId){if(!byVar[row.varietyId])byVar[row.varietyId]={trees:0,ha:0};byVar[row.varietyId].trees+=rc.totalTrees;byVar[row.varietyId].ha+=rc.areaHa;}
  });
  document.getElementById('cm-total-ha').value=totalHa>0?totalHa.toFixed(3):'';
  document.getElementById('cm-total-trees').value=totalTrees>0?totalTrees:'';
  // Update calc cells in table
  const rows=document.querySelectorAll('#rows-tbody tr');
  rows.forEach((tr,i)=>{
    const rc=calcRowEntry(rowEntries[i],rs,ts);
    const calcs=tr.querySelectorAll('.calc');
    if(calcs[0])calcs[0].value=rc.totalTrees||'';
    if(calcs[1])calcs[1].value=rc.areaHa>0?rc.areaHa.toFixed(3):'';
  });
  // Variety totals
  const vtEl=document.getElementById('cm-var-totals');
  const vtBody=document.getElementById('cm-var-totals-body');
  const varEntries=Object.entries(byVar).filter(([vid,v])=>v.trees>0||v.ha>0);
  if(varEntries.length>0){
    vtEl.style.display='block';
    vtBody.innerHTML=varEntries.map(([vid,vt])=>{
      const v=S.varieties.find(v=>v.id===vid);
      return`<div class="var-total-row">
        <div style="width:12px;height:12px;border-radius:3px;flex-shrink:0;" class="${v?.color||'vc3'}"></div>
        <span style="font-weight:600;font-size:12px;">${v?.name||'?'}</span>
        <span style="margin-left:auto;font-family:'Unbounded',sans-serif;font-size:12px;color:var(--accent);">${vt.trees} дер.</span>
        <span style="font-size:11px;color:var(--text3);margin-left:8px;">${vt.ha.toFixed(3)} га</span>
      </div>`;
    }).join('');
  } else vtEl.style.display='none';
}

function addRowEntry(){rowEntries.push({from:'',to:'',rowLength:'',varietyId:''});renderRowEntries();recalcAll();}
function removeRowEntry(i){rowEntries.splice(i,1);renderRowEntries();recalcAll();}

function saveCell(){
  const r=parseInt(document.getElementById('cm-row').value);const c=parseInt(document.getElementById('cm-col').value);
  if(!r||!c){alert('Укажите номер клетки');return;}
  const key=ck(r,c);
  // Read rows from current DOM
  const rows=[];
  document.querySelectorAll('#rows-tbody tr').forEach((tr,i)=>{
    const inputs=tr.querySelectorAll('input:not(.calc),select');
    const from=inputs[0]?.value;const to=inputs[1]?.value;const rowLength=inputs[2]?.value;const varietyId=inputs[3]?.value;
    if(varietyId||rowLength)rows.push({from:parseInt(from)||1,to:parseInt(to)||1,rowLength:parseFloat(rowLength)||0,varietyId});
  });
  // Читаем маршруты
  const routes = [];
  const r1dist = parseFloat(document.getElementById('cm-route1-dist').value)||0;
  const r1name = document.getElementById('cm-route1-name').value.trim();
  if(r1dist || r1name) {
    routes.push({
      id: S.cells[key]?.routes?.[0]?.id || uid(),
      name: r1name || 'Маршрут 1',
      distanceKm: r1dist,
      roadType:  document.getElementById('cm-route1-type').value,
      condition: document.getElementById('cm-route1-cond').value,
      note:      document.getElementById('cm-route1-note').value.trim(),
    });
  }
  const r2dist = parseFloat(document.getElementById('cm-route2-dist').value)||0;
  const r2name = document.getElementById('cm-route2-name').value.trim();
  if(r2dist || r2name) {
    routes.push({
      id: S.cells[key]?.routes?.[1]?.id || uid(),
      name: r2name || 'Маршрут 2',
      distanceKm: r2dist,
      roadType:  document.getElementById('cm-route2-type').value,
      condition: document.getElementById('cm-route2-cond').value,
      note:      document.getElementById('cm-route2-note').value.trim(),
    });
  }

  S.cells[key]={
    note:document.getElementById('cm-note').value,
    cropId:document.getElementById('cm-crop').value||'crop_cherry',
    rowSpacing:parseFloat(document.getElementById('cm-row-spacing').value)||5,
    treeSpacing:parseFloat(document.getElementById('cm-tree-spacing').value)||3,
    rows,
    cover:       document.getElementById('cm-cover').value||'none',
    rootstock:   document.getElementById('cm-rootstock').value||'',
    plantYear:   parseInt(document.getElementById('cm-plant-year').value)||null,
    plantingScheme: document.getElementById('cm-planting-scheme').value||'',
    routes,
  };
  S.selectedCell=key;save();closeModal('modal-cell');renderMap();renderCellDetail(key);
}

function deleteCell(){
  if(!editingCellKey)return;if(!confirm('Удалить клетку?'))return;
  delete S.cells[editingCellKey];S.selectedCell=null;save();closeModal('modal-cell');renderMap();
  document.getElementById('detail-panel').innerHTML='<div class="no-sel">👈 Выберите клетку на карте</div>';
}

// ===================== VARIETIES =====================
const POLL_LABELS={cross:'🐝 Перекрёстное',self:'✅ Самоопыляемый',partial:'⚡ Частично само'};
const POLL_CLASS={cross:'cross',self:'self',partial:'partial'};

let _varietyCropFilter = 'crop_cherry'; // currently selected crop in variety modal

function openVarietyModal() {
  _varietyCropFilter = S.crops[0]?.id || 'crop_cherry';
  renderVarietyCropTabs();
  renderVList();
  // Populate crop select in add form
  const csel = document.getElementById('nv-crop');
  csel.innerHTML = '<option value="">— выбрать культуру —</option>';
  S.crops.forEach(c => csel.innerHTML += `<option value="${c.id}" ${c.id===_varietyCropFilter?'selected':''}>${c.emoji||''} ${c.name}</option>`);
  openModal('modal-variety');
}

function renderVarietyCropTabs() {
  const tabs = document.getElementById('variety-crop-tabs');
  if (!tabs) return;
  tabs.innerHTML = S.crops.map(c => {
    const count = S.varieties.filter(v=>(v.cropId||'crop_cherry')===c.id).length;
    const isActive = c.id === _varietyCropFilter;
    return `<button onclick="selectVarietyCrop('${c.id}')" class="btn btn-sm ${isActive?'btn-primary':'btn-secondary'}"
      style="display:flex;align-items:center;gap:6px;">
      <span style="font-size:14px;">${c.emoji||'🌱'}</span>
      ${c.name}
      ${count>0?`<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:rgba(74,222,128,.15);color:var(--accent);">${count}</span>`:''}
    </button>`;
  }).join('');
}

function selectVarietyCrop(cropId) {
  _varietyCropFilter = cropId;
  renderVarietyCropTabs();
  renderVList();
  // Update add form crop select
  const csel = document.getElementById('nv-crop');
  if (csel) csel.value = cropId;
}

function onVarietyCropChange() {
  _varietyCropFilter = document.getElementById('nv-crop').value || _varietyCropFilter;
  renderVarietyCropTabs();
  renderVList();
}

function renderVList() {
  const crop = S.crops.find(c=>c.id===_varietyCropFilter);
  const varieties = S.varieties.filter(v=>(v.cropId||'crop_cherry')===_varietyCropFilter);
  const el = document.getElementById('variety-list');
  if (!el) return;

  if (!varieties.length) {
    el.innerHTML = `<div style="padding:16px;background:var(--surface2);border-radius:8px;text-align:center;color:var(--text3);font-size:12px;">
      ${crop?`${crop.emoji||''} Нет сортов ${crop.name}. Добавьте первый сорт ниже.`:'Выберите культуру'}
    </div>`;
    return;
  }

  el.innerHTML = `
    <div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">
      ${crop?.emoji||''} ${crop?.name||''} — ${varieties.length} ${varieties.length===1?'сорт':'сортов'}
    </div>
    ${varieties.map(v => {
      const i = S.varieties.indexOf(v);
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:var(--surface2);border-radius:8px;margin-bottom:6px;border:1px solid var(--border);">
        <div style="width:18px;height:18px;border-radius:4px;flex-shrink:0;margin-top:2px;" class="${v.color}"></div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <strong style="font-size:13px;">${v.name}</strong>
            <span style="font-size:10px;color:var(--text3);">${v.ripening}</span>
            <span class="poll-badge ${POLL_CLASS[v.pollType||'cross']}">${POLL_LABELS[v.pollType||'cross']}</span>
          </div>
          ${v.pollinators?`<div style="font-size:11px;color:var(--text3);margin-top:2px;">Опылители: ${v.pollinators}</div>`:''}
          ${v.note?`<div style="font-size:11px;color:var(--text2);margin-top:2px;">💬 ${v.note}</div>`:''}
        </div>
        <button class="btn btn-danger btn-xs" onclick="removeVariety(${i})">✕</button>
      </div>`;
    }).join('')}`;
}

function addVariety() {
  const name = document.getElementById('nv-name').value.trim();
  if (!name) { alert('Введите название сорта'); return; }
  const cropId = document.getElementById('nv-crop').value || _varietyCropFilter || 'crop_cherry';
  if (!cropId) { alert('Выберите культуру'); return; }
  S.varieties.push({
    id: 'v'+Date.now(), name, cropId,
    ripening: document.getElementById('nv-rip').value,
    pollType: document.getElementById('nv-poll-type').value,
    pollinators: document.getElementById('nv-pol').value,
    color: document.getElementById('nv-col').value,
    note: document.getElementById('nv-note').value,
  });
  document.getElementById('nv-name').value='';
  document.getElementById('nv-pol').value='';
  document.getElementById('nv-note').value='';
  _varietyCropFilter = cropId;
  save(); renderVarietyCropTabs(); renderVList(); renderMap();
}

function removeVariety(i) {
  if (confirm(`Удалить "${S.varieties[i].name}"?`)) {
    S.varieties.splice(i,1);
    save(); renderVarietyCropTabs(); renderVList(); renderMap();
  }
}

