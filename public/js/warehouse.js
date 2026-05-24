// Smart Agro — warehouse.js
// ═══ СКЛАД (WAREHOUSE) ════════════════════════════════════════════════

// ═══ СКЛАД (WAREHOUSE) ════════════════════════════════════════════════
// Вспомогательные функции склада
function uid() { return '_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function today() { return new Date().toISOString().split('T')[0]; }
let _whTab = 'chemicals';

function showWarehouseTab(tab) {
  _whTab = tab;
  ['chemicals','parts','seeds','fuel','history'].forEach(t => {
    const el = document.getElementById('wh-'+t);
    const btn = document.getElementById('wh-tab-'+t);
    if(el) el.style.display = t===tab ? '' : 'none';
    if(btn) btn.classList.toggle('active', t===tab);
  });
  if(tab === 'fuel') renderFuelTab();
  else renderWarehouse();
}

function switchWhModalTab(type) {
  document.getElementById('wh-modal-type').value = type;
  document.getElementById('wh-modal-chemical').style.display = type==='chemical' ? '' : 'none';
  document.getElementById('wh-modal-part').style.display = type==='part' ? '' : 'none';
  document.getElementById('wh-modal-seed').style.display = type==='seed' ? '' : 'none';
  document.getElementById('wh-modal-tab-chemical').classList.toggle('active', type==='chemical');
  document.getElementById('wh-modal-tab-part').classList.toggle('active', type==='part');
  document.getElementById('wh-modal-tab-seed').classList.toggle('active', type==='seed');
}
function openWarehouseModal() {
  if (!S.warehouse) S.warehouse = { chemicals: [], parts: [], history: [] };
  document.getElementById('wh-modal-title').textContent = '📦 Приход товара';
  document.getElementById('wh-date').value = today();
  document.getElementById('wh-part-date').value = today();
  document.getElementById('wh-qty').value = '';
  document.getElementById('wh-price').value = '';
  document.getElementById('wh-supplier').value = '';
  document.getElementById('wh-min-stock').value = '';
  document.getElementById('wh-note').value = '';
  document.getElementById('wh-chemical-name').value = '';
  document.getElementById('wh-part-name').value = '';
  document.getElementById('wh-part-qty').value = '';
  document.getElementById('wh-part-price').value = '';
  document.getElementById('wh-part-supplier').value = '';
  document.getElementById('wh-part-min-stock').value = '';
  document.getElementById('wh-part-resource-hours').value = '';
  document.getElementById('wh-part-resource-seasons').value = '';
  document.getElementById('wh-part-installed').value = '';
  document.getElementById('wh-part-worked').value = '';
  document.getElementById('wh-part-note').value = '';
  document.getElementById('wh-seed-date').value = today();
  document.getElementById('wh-seed-variety').value = '';
  document.getElementById('wh-seed-qty').value = '';
  document.getElementById('wh-seed-price').value = '';
  document.getElementById('wh-seed-supplier').value = '';
  document.getElementById('wh-seed-min-stock').value = '';
  document.getElementById('wh-seed-rate').value = '';
  document.getElementById('wh-seed-year').value = '';
  document.getElementById('wh-seed-note').value = '';
  // Populate chemicals select
  const sel = document.getElementById('wh-chemical-id');
  sel.innerHTML = '<option value="">— выбрать из каталога —</option>';
  S.catalog.forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });
  switchWhModalTab('chemical');
  openModal('modal-warehouse');
}

// ── НДС в модале прихода склада ─────────────────────────────────────────
function _whVatIds(type) {
  if (type === 'chemical') return { price: 'wh-price', vat: 'wh-vat-rate', withVat: 'wh-price-with-vat', vatAmt: 'wh-vat-amount' };
  if (type === 'part')     return { price: 'wh-part-price', vat: 'wh-part-vat-rate', withVat: 'wh-part-price-with-vat', vatAmt: 'wh-part-vat-amount' };
  if (type === 'seed')     return { price: 'wh-seed-price', vat: 'wh-seed-vat-rate', withVat: 'wh-seed-price-with-vat', vatAmt: 'wh-seed-vat-amount' };
}

function whCalcVat(type) {
  // Вводим цену без НДС → считаем цену с НДС
  const ids = _whVatIds(type);
  const priceEx = parseFloat(document.getElementById(ids.price)?.value?.replace(',','.')) || 0;
  const rate = parseFloat(document.getElementById(ids.vat)?.value) || 0;
  const priceInc = Math.round(priceEx * (1 + rate / 100) * 100) / 100;
  const vatAmt   = Math.round((priceInc - priceEx) * 100) / 100;
  if (document.getElementById(ids.withVat)) document.getElementById(ids.withVat).value = priceEx > 0 ? priceInc : '';
  if (document.getElementById(ids.vatAmt))  document.getElementById(ids.vatAmt).textContent = priceEx > 0 ? `${vatAmt.toFixed(2)} (${rate}%)` : '—';
}

function whCalcVatReverse(type) {
  // Вводим цену с НДС → считаем цену без НДС
  const ids = _whVatIds(type);
  const priceInc = parseFloat(document.getElementById(ids.withVat)?.value?.replace(',','.')) || 0;
  const rate = parseFloat(document.getElementById(ids.vat)?.value) || 0;
  const priceEx  = Math.round(priceInc / (1 + rate / 100) * 100) / 100;
  const vatAmt   = Math.round((priceInc - priceEx) * 100) / 100;
  if (document.getElementById(ids.price))   document.getElementById(ids.price).value = priceInc > 0 ? priceEx : '';
  if (document.getElementById(ids.vatAmt))  document.getElementById(ids.vatAmt).textContent = priceInc > 0 ? `${vatAmt.toFixed(2)} (${rate}%)` : '—';
}

function onWhChemicalSelect() {
  const id = document.getElementById('wh-chemical-id').value;
  const item = S.catalog.find(c => c.id === id);
  if (!item) return;
  document.getElementById('wh-chemical-name').value = item.name;
  if (item.price)    document.getElementById('wh-price').value = item.price;
  if (item.supplier) document.getElementById('wh-supplier').value = item.supplier;
  if (item.unit)     document.getElementById('wh-unit').value = item.unit;
  if (item.minStock) document.getElementById('wh-min-stock').value = item.minStock;
  if (item.payment)  document.getElementById('wh-payment').value = item.payment;
  // Подтягиваем ставку НДС из карточки
  const vatSel = document.getElementById('wh-vat-rate');
  if (vatSel && item.vatRate !== undefined) {
    vatSel.value = String(item.vatRate);
  }
  // Пересчитываем цену с НДС
  whCalcVat('chemical');
}

function saveWarehouseItem() {
  if (!S.warehouse) S.warehouse = { chemicals: [], parts: [], seeds: [], history: [] };
  if (!S.warehouse.seeds) S.warehouse.seeds = [];
  const type = document.getElementById('wh-modal-type').value;

  if (type === 'chemical') {
    let catId = document.getElementById('wh-chemical-id').value;
    const manualName = document.getElementById('wh-chemical-name').value.trim();
    if (!manualName) { alert('Введите название препарата'); return; }
    const qty = parseFloat(document.getElementById('wh-qty').value) || 0;
    if (!qty) { alert('Введите количество'); return; }

    const priceRaw = parseFloat(document.getElementById('wh-price').value) || 0;
    const priceCurrency = document.getElementById('wh-price-currency').value;
    const rateUsed = getRate(priceCurrency);
    const price = Math.round(convertPrice(priceRaw, priceCurrency) * 10000) / 10000;
    const vatRate = parseFloat(document.getElementById('wh-vat-rate').value) || 0;
    const priceWithVat = Math.round(price * (1 + vatRate / 100) * 10000) / 10000;
    const vatAmount = Math.round((priceWithVat - price) * 10000) / 10000;
    const unit = document.getElementById('wh-unit').value;
    const supplier = document.getElementById('wh-supplier').value.trim();
    const minStock = parseFloat(document.getElementById('wh-min-stock').value) || 0;
    const payment = document.getElementById('wh-payment').value;
    const note = document.getElementById('wh-note').value.trim();
    const date = document.getElementById('wh-date').value;

    // Найти или создать запись в каталоге
    let cat = S.catalog.find(c => c.id === catId) ||
              S.catalog.find(c => c.name.toLowerCase() === manualName.toLowerCase());
    if (!cat) {
      // Автоматически создать в каталоге
      cat = {
        id: uid(),
        name: manualName,
        type: 'other',
        ai: '', dose: '', whi: 0, crops: '', targets: '',
        buhName: manualName,
        legal: 'legal', payment, inBuh: 'yes',
        priceOrig: priceRaw, priceCurrency,
        price, supplier, unit, minStock,
      };
      S.catalog.push(cat);
      console.log('[Warehouse] Auto-created catalog entry:', manualName);
    }
    catId = cat.id;
    // Обновляем ставку НДС в карточке каталога (сохраняется как дефолт)
    cat.vatRate = vatRate;

    let stock = S.warehouse.chemicals.find(c => c.catId === catId);
    if (!stock) {
      stock = { id: uid(), catId, name: cat.name, type: cat.type, unit, qty: 0, minStock, price, supplier, payment };
      S.warehouse.chemicals.push(stock);
    }
    stock.qty = Math.round((stock.qty + qty) * 1000) / 1000;
    stock.price = price || stock.price;
    stock.supplier = supplier || stock.supplier;
    stock.minStock = minStock || stock.minStock;
    stock.unit = unit;
    stock.payment = payment;
    S.warehouse.history.unshift({
      id: uid(), date, type: 'chemical', name: cat.name,
      operation: 'in', qty, unit,
      priceOrig: priceRaw, currencyOrig: priceCurrency, rateUsed,
      price, priceWithVat, vatRate, vatAmount,
      total: Math.round(qty * price * 10000) / 10000,
      totalWithVat: Math.round(qty * priceWithVat * 10000) / 10000,
      supplier, payment, note
    });

  } else if (type === 'part') {
    const name = document.getElementById('wh-part-name').value.trim();
    if (!name) { alert('Введите название запчасти'); return; }
    const qty = parseFloat(document.getElementById('wh-part-qty').value) || 0;
    if (!qty) { alert('Введите количество'); return; }
    const date = document.getElementById('wh-part-date').value;
    const category = document.getElementById('wh-part-category').value;
    const unit = document.getElementById('wh-part-unit').value;
    const priceRaw = parseFloat(document.getElementById('wh-part-price').value) || 0;
    const priceCurrency = document.getElementById('wh-part-price-currency').value;
    const price = Math.round(convertPrice(priceRaw, priceCurrency) * 10000) / 10000;
    const supplier = document.getElementById('wh-part-supplier').value.trim();
    const minStock = parseFloat(document.getElementById('wh-part-min-stock').value) || 0;
    const resourceHours = parseFloat(document.getElementById('wh-part-resource-hours').value) || null;
    const resourceSeasons = parseFloat(document.getElementById('wh-part-resource-seasons').value) || null;
    const installed = document.getElementById('wh-part-installed').value || null;
    const worked = parseFloat(document.getElementById('wh-part-worked').value) || 0;
    const note = document.getElementById('wh-part-note').value.trim();
    let part = S.warehouse.parts.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (!part) {
      part = { id: uid(), name, category, unit, qty: 0, installedQty: 0, minStock, price, supplier, resourceHours, resourceSeasons, installed, worked, note };
      S.warehouse.parts.push(part);
    }
    part.qty += qty;
    const installedQty = parseFloat(document.getElementById('wh-part-installed-qty').value) || 0;
    part.installedQty = installedQty;
    part.price = price || part.price;
    part.supplier = supplier || part.supplier;
    part.minStock = minStock || part.minStock;
    part.resourceHours = resourceHours || part.resourceHours;
    part.resourceSeasons = resourceSeasons || part.resourceSeasons;
    if (installed) part.installed = installed;
    part.worked = worked || part.worked;
    const priceRawPart = parseFloat(document.getElementById('wh-part-price').value) || 0;
    const priceCurrencyPart = document.getElementById('wh-part-price-currency').value;
    const rateUsedPart = getRate(priceCurrencyPart);
    const vatRatePart = parseFloat(document.getElementById('wh-part-vat-rate').value) || 0;
    const priceWithVatPart = Math.round(price * (1 + vatRatePart / 100) * 10000) / 10000;
    const vatAmountPart = Math.round((priceWithVatPart - price) * 10000) / 10000;
    S.warehouse.history.unshift({
      id: uid(), date, type: 'part', name,
      operation: 'in', qty, unit,
      priceOrig: priceRawPart, currencyOrig: priceCurrencyPart, rateUsed: rateUsedPart,
      price, priceWithVat: priceWithVatPart, vatRate: vatRatePart, vatAmount: vatAmountPart,
      total: Math.round(qty * price * 10000) / 10000,
      totalWithVat: Math.round(qty * priceWithVatPart * 10000) / 10000,
      supplier, note
    });

  } else if (type === 'seed') {
    const cropId = document.getElementById('wh-seed-crop').value;
    const variety = document.getElementById('wh-seed-variety').value.trim();
    if (!variety) { alert('Введите сорт/гибрид'); return; }
    const qty = parseFloat(document.getElementById('wh-seed-qty').value) || 0;
    if (!qty) { alert('Введите количество'); return; }
    const date = document.getElementById('wh-seed-date').value;
    const seedType = document.getElementById('wh-seed-type').value;
    const unit = document.getElementById('wh-seed-unit').value;
    const rate = parseFloat(document.getElementById('wh-seed-rate').value) || null;
    const rateUnit = document.getElementById('wh-seed-rate-unit').value;
    const priceRaw = parseFloat(document.getElementById('wh-seed-price').value) || 0;
    const priceCurrency = document.getElementById('wh-seed-price-currency').value;
    const price = Math.round(convertPrice(priceRaw, priceCurrency) * 10000) / 10000;
    const supplier = document.getElementById('wh-seed-supplier').value.trim();
    const minStock = parseFloat(document.getElementById('wh-seed-min-stock').value) || 0;
    const year = parseInt(document.getElementById('wh-seed-year').value) || null;
    const note = document.getElementById('wh-seed-note').value.trim();
    const name = `${cropId}_${variety}`.toLowerCase().replace(/\s+/g,'_');
    let seed = S.warehouse.seeds.find(s => s.cropId === cropId && s.variety.toLowerCase() === variety.toLowerCase());
    if (!seed) {
      seed = { id: uid(), cropId, variety, seedType, unit, qty: 0, minStock, price, supplier, rate, rateUnit, year, note };
      S.warehouse.seeds.push(seed);
    }
    seed.qty = Math.round((seed.qty + qty) * 1000) / 1000;
    seed.price = price || seed.price;
    seed.supplier = supplier || seed.supplier;
    seed.minStock = minStock || seed.minStock;
    seed.rate = rate || seed.rate;
    seed.rateUnit = rateUnit || seed.rateUnit;
    const vatRateSeed = parseFloat(document.getElementById('wh-seed-vat-rate').value) || 0;
    const priceWithVatSeed = Math.round(price * (1 + vatRateSeed / 100) * 10000) / 10000;
    const vatAmountSeed = Math.round((priceWithVatSeed - price) * 10000) / 10000;
    S.warehouse.history.unshift({
      id: uid(), date, type: 'seed',
      name: `${cropId} · ${variety}`,
      operation: 'in', qty, unit,
      priceOrig: priceRaw, currencyOrig: priceCurrency, rateUsed: getRate(priceCurrency),
      price, priceWithVat: priceWithVatSeed, vatRate: vatRateSeed, vatAmount: vatAmountSeed,
      total: Math.round(qty * price * 10000) / 10000,
      totalWithVat: Math.round(qty * priceWithVatSeed * 10000) / 10000,
      supplier, note
    });
  }

  save();
  if (_serverAvailable) {
    fetch('/api/state/vegetable', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ warehouse: S.warehouse })
    }).catch(e => console.warn('Warehouse sync failed:', e));
  }
  closeModal('modal-warehouse');
  renderWarehouse();
}

function renderWarehouse() {
  if (!S.warehouse) S.warehouse = { chemicals: [], parts: [], history: [] };
  const chemicals = S.warehouse.chemicals || [];
  const parts = S.warehouse.parts || [];

 const seeds = S.warehouse.seeds || [];
  // KPIs
  const lowChemicals = chemicals.filter(c => c.qty <= c.minStock).length;
  const lowParts = parts.filter(p => p.qty <= p.minStock).length;
  const lowSeeds = seeds.filter(s => s.minStock && s.qty <= s.minStock).length;
  const totalValue = chemicals.reduce((s,c) => s + (c.qty * (c.price||0)), 0);
  document.getElementById('warehouse-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-val">${chemicals.length}</div><div class="kpi-lbl">Препаратов</div></div>
    <div class="kpi-card"><div class="kpi-val">${parts.length}</div><div class="kpi-lbl">Запчастей</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--accent);">${seeds.length}</div><div class="kpi-lbl">Семян</div></div>
    <div class="kpi-card" style="${lowChemicals||lowParts||lowSeeds?'background:rgba(255,85,85,.08);border-color:rgba(255,85,85,.3)':''}">
      <div class="kpi-val" style="color:${lowChemicals||lowParts||lowSeeds?'var(--red)':'var(--accent)'};">${lowChemicals+lowParts+lowSeeds}</div>
      <div class="kpi-lbl">Мало на складе</div>
    </div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--accent);">${totalValue.toFixed(4)}</div><div class="kpi-lbl">Стоимость склада (${getCurrencySymbol()})</div></div>`;
  // Chemicals table

  // Chemicals table
  const CAT_COLORS={fungicide:'var(--teal)',insecticide:'var(--orange)',herbicide:'var(--yellow)',fertilizer:'var(--accent)',acaricide:'var(--purple)',surfactant:'var(--blue)',microelement:'var(--teal)',other:'var(--text3)'};
  document.getElementById('wh-chemicals-tbody').innerHTML = chemicals.length
    ? chemicals.map(c => {
        const low = c.minStock && c.qty <= c.minStock;
        const critical = c.minStock && c.qty <= c.minStock * 0.5;
        return `<tr style="${critical?'background:rgba(255,85,85,.05)':low?'background:rgba(255,216,77,.05)':''}">
          <td style="font-weight:600;">${c.name}</td>
          <td><span style="font-size:10px;padding:2px 7px;border-radius:8px;background:${CAT_COLORS[c.type]||'var(--surface2)'}22;color:${CAT_COLORS[c.type]||'var(--text3)'};">${c.type}</span></td>
          <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${critical?'var(--red)':low?'var(--yellow)':'var(--accent)'};">${c.qty} ${c.unit||'л'}</td>
          <td style="font-size:11px;color:var(--text3);">${c.unit||'л'}</td>
          <td style="font-size:11px;color:var(--text3);">${c.minStock||'—'} ${c.unit||'л'}</td>
          <td style="font-size:11px;">${c.price?formatPrice(c.price):'—'}</td>
          <td style="font-size:11px;color:var(--text3);">${c.supplier||'—'}</td>
          <td>${critical?'<span class="badge badge-red">❌ МАЛО</span>':low?'<span class="badge badge-yellow">⚠️ Мало</span>':'<span class="badge badge-green">✅ OK</span>'}</td>
          <td><button class="btn btn-primary btn-xs" onclick="openWarehouseModalForChemical('${c.catId}')">+ Приход</button></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px;">Нет препаратов на складе. Нажмите + Приход.</td></tr>`;

  // Parts table
  const CAT_PART_LABELS={filter:'Фильтрация',drip:'Капельное',pump:'Насосы',mechanical:'Механика',electrical:'Электрика',other:'Другое'};
  document.getElementById('wh-parts-tbody').innerHTML = parts.length
    ? parts.map(p => {
        const low = p.minStock && p.qty <= p.minStock;
        const critical = p.minStock && p.qty <= p.minStock * 0.5;
        let resourceHtml = '—';
let resourceStatus = '—';
let pct = 0;
if (p.resourceHours && p.installed) {
  const hoursWorked = p.worked || 0;
  pct = Math.round((hoursWorked / p.resourceHours) * 100);
  resourceHtml = hoursWorked+'/'+p.resourceHours+'ч ('+pct+'%)';
  resourceStatus = pct >= 90 ? '🔴 ЗАМЕНА' : pct >= 70 ? '⚠️ Скоро' : '✅ OK';
} else if (p.resourceSeasons) {
  resourceHtml = p.resourceSeasons+' сезонов';
  resourceStatus = '✅ OK';
}
        return '<tr style="'+(critical?'background:rgba(255,85,85,.05)':low?'background:rgba(255,216,77,.05)':'')+'">'+
          '<td style="font-weight:600">'+p.name+'</td>'+
          '<td style="font-size:11px;color:var(--text3);">'+(CAT_PART_LABELS[p.category]||p.category)+'</td>'+
          '<td style="font-family:JetBrains Mono,monospace;font-weight:700;color:'+(critical?'var(--red)':low?'var(--yellow)':'var(--accent)')+'"><div>'+(p.qty-(p.installedQty||0))+' '+(p.unit||'шт')+' <span style="font-size:10px;color:var(--text3);">свободно</span></div></td>'+
          '<td style="font-size:11px;">'+(p.unit||'шт')+'</td>'+
          '<td style="font-size:11px;color:var(--text3);">'+(p.minStock||'—')+'</td>'+
          '<td style="font-size:11px;">'+resourceHtml+'</td>'+
          '<td style="font-size:11px;color:var(--text3);">'+(p.installed||'—')+'</td>'+
          '<td style="font-size:11px;color:'+(pct>=90?'var(--red)':pct>=70?'var(--yellow)':'var(--accent)')+';">'+resourceStatus+'</td>'+
          '<td>'+(critical?'<span class="badge badge-red">❌ МАЛО</span>':low?'<span class="badge badge-yellow">⚠️ Мало</span>':'<span class="badge badge-green">✅ OK</span>')+'</td>'+
          '<td><button class="btn btn-secondary btn-xs" onclick="openWarehousePartModal(\''+p.id+'\')">✏️</button></td>'+
          '</tr>';
      }).join('')
    : '<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:20px;">Нет запчастей на складе. Нажмите + Приход.</td></tr>';

 // Seeds table
  const CROP_NAMES = {pea:'🫛 Горошек',sweet_corn:'🌽 Кукуруза',tomato:'🍅 Томат',
    cucumber:'🥒 Огурец',pepper:'🫑 Перец',onion:'🧅 Лук',other:'Другое'};
  const SEED_TYPE_LABELS = {purchased:'🛒 Покупные',own:'🌾 Собственные'};
  const UNIT_LABELS = {kg:'кг',pe:'п.е.',bag:'мешок',dose:'доза'};
  document.getElementById('wh-seeds-tbody').innerHTML = seeds.length
    ? seeds.map(s => {
        const low = s.minStock && s.qty <= s.minStock;
        const critical = s.minStock && s.qty <= s.minStock * 0.5;
        return `<tr style="${critical?'background:rgba(255,85,85,.05)':low?'background:rgba(255,216,77,.05)':''}">
          <td style="font-weight:600;">${CROP_NAMES[s.cropId]||s.cropId}</td>
          <td style="color:var(--accent);">${s.variety}</td>
          <td style="font-size:11px;">${SEED_TYPE_LABELS[s.seedType]||s.seedType}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${critical?'var(--red)':low?'var(--yellow)':'var(--accent)'};">${s.qty} ${UNIT_LABELS[s.unit]||s.unit}</td>
          <td style="font-size:11px;color:var(--text3);">${UNIT_LABELS[s.unit]||s.unit}</td>
          <td style="font-size:11px;">${s.rate?s.rate+' '+s.rateUnit:'—'}</td>
          <td style="font-size:11px;color:var(--text3);">${s.minStock||'—'}</td>
          <td style="font-size:11px;">${s.price?formatPrice(s.price):'—'}</td>
          <td style="font-size:11px;color:var(--text3);">${s.supplier||'—'}</td>
          <td>${critical?'<span class="badge badge-red">❌ МАЛО</span>':low?'<span class="badge badge-yellow">⚠️ Мало</span>':'<span class="badge badge-green">✅ OK</span>'}</td>
          <td><button class="btn btn-primary btn-xs" onclick="openWarehouseModalSeed('${s.id}')">+ Приход</button></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:20px;">Нет семян на складе. Нажмите + Приход → 🌱 Семена.</td></tr>';
  document.getElementById('wh-history-tbody').innerHTML = (S.warehouse.history||[]).slice(0,50).map(h => {
    const vatRate = h.vatRate ?? 0;
    const priceWithVat = h.priceWithVat || (h.price ? Math.round(h.price*(1+vatRate/100)*100)/100 : 0);
    const totalWithVat = h.totalWithVat || (h.total ? Math.round(h.total*(1+vatRate/100)*100)/100 : 0);
    return '<tr>'+
    '<td style="font-family:JetBrains Mono,monospace;font-size:11px;">'+h.date+'</td>'+
    '<td style="font-size:11px;">'+(h.type==='chemical'?'💊':h.type==='seed'?'🌱':'🔧')+'</td>'+
    '<td style="font-weight:600">'+h.name+'</td>'+
    '<td>'+(h.operation==='in'?'📥 Приход':'📤 Списание')+'</td>'+
    '<td style="font-family:JetBrains Mono,monospace;">'+h.qty+' '+(h.unit||'')+'</td>'+
    '<td style="font-size:11px;">'+(h.price?formatPrice(h.price):'—')+'</td>'+
    '<td style="font-size:11px;text-align:center;color:'+(vatRate>0?'var(--accent2)':'var(--text3)')+';">'+vatRate+'%</td>'+
    '<td style="font-size:11px;">'+(priceWithVat?formatPrice(priceWithVat):'—')+'</td>'+
    '<td style="font-weight:600;color:var(--accent);">'+(totalWithVat?formatPrice(totalWithVat):h.total?formatPrice(h.total):'—')+'</td>'+
    '<td style="font-size:11px;color:var(--text3);">'+(h.supplier||h.parcelName||'—')+'</td>'+
    '</tr>';
  }).join('') || '<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:20px;">История пуста</td></tr>';

  // ── Итоги НДС по истории ──────────────────────────────────────────────
  const histIn  = (S.warehouse.history||[]).filter(h=>h.operation==='in');
  const histOut = (S.warehouse.history||[]).filter(h=>h.operation!=='in');
  const sumIn       = histIn.reduce((s,h)=>s+(h.total||0),0);
  const sumInVat    = histIn.reduce((s,h)=>{
    const vr = h.vatRate||0;
    const twv = h.totalWithVat || (h.total?Math.round(h.total*(1+vr/100)*100)/100:0);
    return s+(twv-h.total||0);
  },0);
  const sumInWithVat= histIn.reduce((s,h)=>{
    const vr = h.vatRate||0;
    return s+(h.totalWithVat||(h.total?Math.round(h.total*(1+vr/100)*100)/100:0));
  },0);
  const sumOut   = histOut.reduce((s,h)=>s+(h.total||0),0);
  const vatSummEl = document.getElementById('wh-vat-summary');
  if (vatSummEl) {
    vatSummEl.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:10px;padding:10px 14px;background:var(--surface2);border-radius:10px;margin-top:8px;border:1px solid var(--border);">
        <div style="font-size:11px;font-weight:600;color:var(--text3);width:100%;margin-bottom:2px;">📊 ИТОГИ ПО НДС (история приходов)</div>
        <div style="flex:1;min-width:120px;">
          <div style="font-size:10px;color:var(--text3);">Сумма без НДС</div>
          <div style="font-size:13px;font-weight:700;">${formatPrice(Math.round(sumIn*100)/100)}</div>
        </div>
        <div style="flex:1;min-width:120px;">
          <div style="font-size:10px;color:var(--text3);">Сумма НДС</div>
          <div style="font-size:13px;font-weight:700;color:var(--accent2);">${formatPrice(Math.round(sumInVat*100)/100)}</div>
        </div>
        <div style="flex:1;min-width:120px;">
          <div style="font-size:10px;color:var(--text3);">Итого с НДС</div>
          <div style="font-size:13px;font-weight:700;color:var(--accent);">${formatPrice(Math.round(sumInWithVat*100)/100)}</div>
        </div>
        <div style="flex:1;min-width:120px;">
          <div style="font-size:10px;color:var(--text3);">Списано (без НДС)</div>
          <div style="font-size:13px;font-weight:700;color:var(--orange);">${formatPrice(Math.round(sumOut*100)/100)}</div>
        </div>
      </div>`;
  }
}

function openWarehouseModalForChemical(catId) {
  openWarehouseModal();
  switchWhModalTab('chemical');
  setTimeout(() => {
    const cat = S.catalog.find(c => c.id === catId);
    if (cat) {
      document.getElementById('wh-chemical-id').value = catId;
      document.getElementById('wh-chemical-name').value = cat.name;
      if (cat.price) document.getElementById('wh-price').value = cat.priceOrig || cat.price;
      if (cat.supplier) document.getElementById('wh-supplier').value = cat.supplier;
      if (cat.unit) document.getElementById('wh-unit').value = cat.unit;
      if (cat.minStock) document.getElementById('wh-min-stock').value = cat.minStock;
      if (cat.payment) document.getElementById('wh-payment').value = cat.payment;
      // Подтягиваем ставку НДС из карточки
      if (cat.vatRate !== undefined) document.getElementById('wh-vat-rate').value = String(cat.vatRate);
      whCalcVat('chemical');
      if (cat.priceCurrency) document.getElementById('wh-price-currency').value = cat.priceCurrency;
    }
  }, 100);
}

function openWarehousePartModal(partId) {
  openWarehouseModal();
  switchWhModalTab('part');
  const part = S.warehouse?.parts?.find(p => p.id === partId);
  if (!part) return;
  setTimeout(() => {
    document.getElementById('wh-part-name').value = part.name || '';
    document.getElementById('wh-part-category').value = part.category || 'other';
    document.getElementById('wh-part-price').value = part.price || '';
    document.getElementById('wh-part-supplier').value = part.supplier || '';
    document.getElementById('wh-part-min-stock').value = part.minStock || '';
    document.getElementById('wh-part-resource-hours').value = part.resourceHours || '';
    document.getElementById('wh-part-resource-seasons').value = part.resourceSeasons || '';
    document.getElementById('wh-part-installed').value = part.installed || '';
    document.getElementById('wh-part-worked').value = part.worked || '';
    document.getElementById('wh-part-note').value = part.note || '';
  }, 100);
}

  function updateCatalogPriceConverted() {
  const priceRaw = parseFloat(document.getElementById('c-price').value) || 0;
  const currency = document.getElementById('c-price-currency').value;
  const el = document.getElementById('c-price-converted');
  if(!priceRaw || currency === getCurrency()) { el.textContent = ''; return; }
  const converted = convertPrice(priceRaw, currency);
  el.textContent = `= ${converted.toFixed(4)} ${getCurrencySymbol()}`;
}
function showWarehouseSnapshot(type='chemicals') {
  const snap = document.getElementById('warehouse-snapshot');
  if(type==='chemicals') {
    const chemicals = S.warehouse?.chemicals||[];
    if(!chemicals.length){snap.style.display='none';alert('Склад пуст');return;}
    const rows = chemicals.map(c=>{
      const low=c.minStock&&c.qty<=c.minStock;
      const critical=c.minStock&&c.qty<=c.minStock*0.5;
      const status=critical?'🔴':low?'🟡':'🟢';
      return '<tr style="'+(critical?'background:rgba(255,85,85,.05)':low?'background:rgba(255,216,77,.05)':'')+'">'+
        '<td style="font-weight:600;">'+c.name+'</td>'+
        '<td style="font-family:JetBrains Mono,monospace;font-weight:700;color:'+(critical?'var(--red)':low?'var(--yellow)':'var(--accent)')+';">'+c.qty+' '+(c.unit||'л')+'</td>'+
        '<td style="font-size:11px;color:var(--text3);">'+(c.minStock?'мин: '+c.minStock+' '+(c.unit||'л'):'—')+'</td>'+
        '<td>'+status+'</td>'+
        '<td style="font-size:11px;">'+(c.price?formatPrice(c.price)+'/'+(c.unit||'л'):'—')+'</td>'+
        '</tr>';
    }).join('');
    const total=chemicals.reduce((s,c)=>s+(c.qty*(c.price||0)),0);
    const low=chemicals.filter(c=>c.minStock&&c.qty<=c.minStock).length;
    snap.innerHTML='<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;">'+
      '<div style="padding:12px 16px;background:var(--surface2);display:flex;justify-content:space-between;align-items:center;">'+
      '<span style="font-weight:700;color:var(--accent);">💊 Остатки препаратов</span>'+
      '<div style="display:flex;gap:8px;align-items:center;">'+
      '<span style="font-size:11px;color:var(--text3);">'+chemicals.length+' позиций · '+low+' мало · '+formatPrice(total)+' итого</span>'+
      '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'warehouse-snapshot\').style.display=\'none\'">✕</button>'+
      '</div></div>'+
      '<table class="data-table"><thead><tr><th>Препарат</th><th>Остаток</th><th>Мин. запас</th><th></th><th>Цена</th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table></div>';
  } else {
    const parts = S.warehouse?.parts||[];
    if(!parts.length){snap.style.display='none';alert('Запчастей нет');return;}
    const CAT={filter:'Фильтрация',drip:'Капельное',pump:'Насосы',mechanical:'Механика',electrical:'Электрика',other:'Другое'};
    const rows = parts.map(p=>{
      const low=p.minStock&&p.qty<=p.minStock;
      const critical=p.minStock&&p.qty<=p.minStock*0.5;
      const status=critical?'🔴':low?'🟡':'🟢';
      let resource='—';
     if(p.resourceHours){
        const pct=Math.round(((p.worked||0)/p.resourceHours)*100);
        resource=(p.worked||0)+'/'+p.resourceHours+'ч ('+pct+'%)';
      } else if(p.resourceSeasons) resource=p.resourceSeasons+' сезонов';
      return '<tr style="'+(critical?'background:rgba(255,85,85,.05)':low?'background:rgba(255,216,77,.05)':'')+'">'+
        '<td style="font-weight:600;">'+p.name+'</td>'+
        '<td style="color:var(--text3);font-size:11px;">'+(CAT[p.category]||p.category)+'</td>'+
        '<td style="font-family:JetBrains Mono,monospace;font-weight:700;color:'+(critical?'var(--red)':low?'var(--yellow)':'var(--accent)')+';">'+(p.qty-(p.installedQty||0))+' '+(p.unit||'шт')+(p.installedQty?'<br><span style="font-size:10px;color:var(--text3);">установлено: '+p.installedQty+'</span>':'')+'</td>'+
       '<td style="font-size:11px;color:var(--blue);">'+(p.installedQty||0)+' '+(p.unit||'шт')+'</td>'+
        '<td style="font-size:11px;color:var(--text3);">'+(p.minStock?'мин: '+p.minStock:'—')+'</td>'+
        '<td style="font-size:11px;">'+resource+'</td>'+
        '<td style="font-size:11px;">'+(p.installed||'—')+'</td>'+
        '<td>'+status+'</td>'+
        '</tr>';
    }).join('');
    snap.innerHTML='<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;">'+
      '<div style="padding:12px 16px;background:var(--surface2);display:flex;justify-content:space-between;align-items:center;">'+
      '<span style="font-weight:700;color:var(--accent);">🔧 Остатки запчастей</span>'+
      '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'warehouse-snapshot\').style.display=\'none\'">✕</button>'+
      '</div>'+
      '<table class="data-table"><thead><tr><th>Запчасть</th><th>Категория</th><th>На складе</th><th>Установлено</th><th>Мин. запас</th><th>Ресурс</th><th>Установлен</th><th></th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table></div>';
  }
  snap.style.display='block';
}
  // ── Import/Export ─────────────────────────────────────────────────────────
function exportData() {
  const data=JSON.stringify(S,null,2);
  const a=document.createElement('a');a.href='data:application/json,'+encodeURIComponent(data);
  a.download='smart_vegetable_'+today()+'.json';a.click();
}
function importData(event) {
  const file=event.target.files[0];if(!file)return;event.target.value='';
  const reader=new FileReader();
  reader.onload=e=>{try{Object.assign(S,JSON.parse(e.target.result));save();renderParcels();}catch(err){alert('Ошибка импорта: '+err.message);}};
  reader.readAsText(file);
}
function saveSetting(key,val) {
  S.settings[key]=val; S[key]=val; save();
  if (_serverAvailable) {
    fetch('/api/state/vegetable', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ settings: S.settings })
    }).catch(e => console.warn('Settings sync failed:', e));
  }
}

function getCurrency() { return S.settings?.currency || S.currency || 'MDL'; }
function getCurrencySymbol() {
  const map = {MDL:'лей',EUR:'€',USD:'$',RON:'RON',RUB:'руб'};
  return map[getCurrency()] || 'лей';
}
function getRate(fromCurrency) {
  if(!fromCurrency || fromCurrency === getCurrency()) return 1;
  const cur = getCurrency();
  // Курсы введены как: 1 fromCurrency = X workingCurrency
  // Например если рабочая валюта RUB и курс EUR=21 — значит 1 EUR = 21 RUB
  const rateKey = {
    'EUR': 'rateEUR',
    'USD': 'rateUSD',
    'RON': 'rateRON',
    'RUB': 'rateRUB',
  };
  // Прямой курс: fromCurrency → рабочая валюта
  const key = rateKey[fromCurrency];
  if(key && S.settings?.[key]) return S.settings[key];
  // Обратный курс: рабочая валюта → fromCurrency
  const reverseKey = rateKey[cur];
  if(reverseKey && S.settings?.[reverseKey]) return 1 / S.settings[reverseKey];
  return 1;
}
function convertPrice(price, fromCurrency) {
  if(!price) return 0;
  return Math.round(parseFloat(price) * getRate(fromCurrency) * 10000) / 10000;
}
function formatPrice(price) {
  if(!price && price !== 0) return '—';
  return parseFloat(price).toFixed(4) + ' ' + getCurrencySymbol();
}
function renderCurrencySymbol() {
  const cur = getCurrency();
  const sel = document.getElementById('set-currency');
  if(sel) sel.value = cur;
  document.querySelectorAll('.currency-symbol').forEach(el => el.textContent = getCurrencySymbol());

  const h = {
    MDL: { eur:'1 EUR = ? MDL', usd:'1 USD = ? MDL', ron:'1 RON = ? MDL', rub:'1 РУБ = ? MDL' },
    EUR: { eur:null, usd:'1 USD = ? EUR', ron:'1 RON = ? EUR', rub:'1 РУБ = ? EUR' },
    USD: { eur:'1 EUR = ? USD', usd:null, ron:'1 RON = ? USD', rub:'1 РУБ = ? USD' },
    RON: { eur:'1 EUR = ? RON', usd:'1 USD = ? RON', ron:null, rub:'1 РУБ = ? RON' },
    RUB: { eur:'1 EUR = ? РУБ', usd:'1 USD = ? РУБ', ron:'1 RON = ? РУБ', rub:null }
  }[cur] || { eur:'1 EUR = ? MDL', usd:'1 USD = ? MDL', ron:'1 RON = ? MDL', rub:'1 РУБ = ? MDL' };

  ['eur','usd','ron','rub'].forEach(key => {
    const block = document.getElementById('rate-'+key+'-block');
    const hint = document.getElementById('rate-'+key+'-hint');
    if(!block) return;
    if(h[key] === null) {
      block.style.display = 'none';
    } else {
      block.style.display = '';
      const curName = getCurrencySymbol();
const labels = {eur:'Курс EUR → '+curName, usd:'Курс USD → '+curName, ron:'Курс RON → '+curName, rub:'Курс РУБ → '+curName};
      block.querySelector('label').textContent = labels[key];
      if(hint) hint.textContent = h[key];
    }
  });
}


// ─── ROLE SYSTEM ──────────────────────────────────────────────────────────
const ROLES = {
  owner: {
    label:'👑 Владелец',
    pinKey:'pin_owner',
    defaultPin:'1111',
    color:'#fbbf24',
    tabs:['parcels','weather','gdd','diseases','irrigation','treatments','catalog','varieties','settings'],
    canEdit: true,
    canDelete: true,
    canSettings: true,
    description:'Полный доступ ко всем разделам и настройкам'
  },
  agronomist: {
    label:'👨‍🌾 Агроном',
    pinKey:'pin_agronomist',
    defaultPin:'2222',
    color:'#4ade80',
    tabs:['parcels','weather','gdd','diseases','irrigation','treatments','catalog','varieties'],
    canEdit: true,
    canDelete: false,
    canSettings: false,
    description:'Полный рабочий доступ, без настроек и удаления'
  },
  operator: {
    label:'📋 Оператор',
    pinKey:'pin_operator',
    defaultPin:'4444',
    color:'#a78bfa',
    tabs:['weather','irrigation','treatments'],
    canEdit: true,
    canDelete: false,
    canSettings: false,
    description:'Ввод данных: погода, поливы, обработки'
  },
  factory: {
    label:'🏭 Директор завода',
    pinKey:'pin_factory',
    defaultPin:'3333',
    color:'#60a5fa',
    tabs:['parcels','gdd','irrigation'],
    canEdit: false,
    canDelete: false,
    canSettings: false,
    description:'Только участки, GDD/фазы и ирригация — мониторинг уборки'
  },
};

let _currentRole = null;

function initRoleSystem() {
  // Check if already logged in this session
  const sessionRole = sessionStorage.getItem('sveg_role');
  if (sessionRole && ROLES[sessionRole]) {
    applyRole(sessionRole);
    return;
  }
  showLoginScreen();
}

function showLoginScreen() {
  const overlay = document.createElement('div');
  overlay.id = 'login-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:#0a0f0a;z-index:9999;
    display:flex;align-items:center;justify-content:center;
    font-family:'Inter',sans-serif;
  `;
  overlay.innerHTML = `
    <div style="width:100%;max-width:480px;padding:24px;">
      <!-- Logo -->
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:48px;margin-bottom:8px;">🥦</div>
        <div style="font-family:'Unbounded',sans-serif;font-size:18px;font-weight:700;color:#6bdd6b;letter-spacing:3px;">SMART VEGETABLE</div>
        <div style="font-size:11px;color:#5a7a5a;letter-spacing:4px;text-transform:uppercase;margin-top:4px;">System · Digital Agronomist</div>
      </div>

      <!-- Role selection -->
      <div style="font-size:11px;color:#5a7a5a;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;font-family:'Unbounded',sans-serif;">Выберите роль</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px;" id="role-btns">
        ${Object.entries(ROLES).map(([key, r]) => `
          <button onclick="selectLoginRole('${key}')" id="rolebtn-${key}"
            style="padding:14px 16px;border:1px solid #2a3a2a;border-radius:10px;background:#101810;
              color:#a8c8a8;cursor:pointer;text-align:left;transition:all .2s;display:flex;align-items:center;gap:12px;">
            <span style="font-size:22px;">${r.label.split(' ')[0]}</span>
            <div>
              <div style="font-size:13px;font-weight:600;color:#e8f5e8;">${r.label.split(' ').slice(1).join(' ')}</div>
              <div style="font-size:10px;color:#5a7a5a;margin-top:2px;">${r.description}</div>
            </div>
          </button>`).join('')}
      </div>

      <!-- PIN input -->
      <div id="pin-block" style="display:none;">
        <div style="font-size:11px;color:#5a7a5a;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-family:'Unbounded',sans-serif;" id="pin-role-label"></div>
        <div style="display:flex;gap:8px;">
          <input type="password" id="pin-input" maxlength="4" placeholder="••••"
            style="flex:1;background:#182018;border:1px solid #2a3a2a;border-radius:8px;padding:12px 16px;
              color:#e8f5e8;font-size:20px;letter-spacing:8px;text-align:center;outline:none;"
            onkeydown="if(event.key==='Enter')doLogin()"
            oninput="document.getElementById('pin-error').textContent=''">
          <button onclick="doLogin()"
            style="padding:12px 20px;background:#6bdd6b;color:#0a0f0a;border:none;border-radius:8px;
              font-weight:700;cursor:pointer;font-size:13px;">Войти</button>
        </div>
        <div id="pin-error" style="color:#ff5555;font-size:11px;margin-top:8px;min-height:16px;"></div>
        <button onclick="backToRoles()"
          style="margin-top:12px;background:none;border:none;color:#5a7a5a;cursor:pointer;font-size:11px;">← Назад</button>
      </div>

      <!-- First time hint -->
      <div id="first-time-hint" style="margin-top:20px;padding:10px 14px;background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.15);border-radius:8px;font-size:11px;color:#a8c8a8;line-height:1.7;">
        💡 <strong>PIN по умолчанию:</strong><br>
        👑 Владелец: <strong>1111</strong> &nbsp;·&nbsp; 👨‍🌾 Агроном: <strong>2222</strong><br>
        🏭 Завод: <strong>3333</strong> &nbsp;·&nbsp; 📋 Оператор: <strong>4444</strong><br>
        Изменить PIN можно в ⚙️ Настройки после входа как Владелец.
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

let _selectedLoginRole = null;
function selectLoginRole(roleKey) {
  _selectedLoginRole = roleKey;
  const role = ROLES[roleKey];
  // Highlight selected
  Object.keys(ROLES).forEach(k => {
    const btn = document.getElementById('rolebtn-'+k);
    if (btn) btn.style.borderColor = k===roleKey ? role.color : '#2a3a2a';
  });
  document.getElementById('pin-block').style.display = 'block';
  document.getElementById('pin-role-label').textContent = role.label + ' — введите PIN';
  document.getElementById('pin-role-label').style.color = role.color;
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-input').focus();
  document.getElementById('first-time-hint').style.display = 'none';
}

function backToRoles() {
  _selectedLoginRole = null;
  document.getElementById('pin-block').style.display = 'none';
  document.getElementById('first-time-hint').style.display = 'block';
  Object.keys(ROLES).forEach(k => {
    const btn = document.getElementById('rolebtn-'+k);
    if (btn) btn.style.borderColor = '#2a3a2a';
  });
}

function doLogin() {
  if (!_selectedLoginRole) return;
  const role = ROLES[_selectedLoginRole];
  const enteredPin = document.getElementById('pin-input').value;
  const savedPin = localStorage.getItem(role.pinKey) || role.defaultPin;
  if (enteredPin === savedPin) {
    sessionStorage.setItem('sveg_role', _selectedLoginRole);
    document.getElementById('login-overlay').remove();
    applyRole(_selectedLoginRole);
  } else {
    document.getElementById('pin-error').textContent = '❌ Неверный PIN';
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-input').focus();
  }
}

function applyRole(roleKey) {
  _currentRole = roleKey;
  const role = ROLES[roleKey];

  // Show role badge in header
  const badge = document.createElement('div');
  badge.id = 'role-badge';
  badge.style.cssText = `display:flex;align-items:center;gap:8px;`;
  badge.innerHTML = `
    <div style="font-size:11px;padding:5px 12px;border-radius:20px;
      background:${role.color}22;border:1px solid ${role.color}44;color:${role.color};
      font-weight:600;cursor:pointer;" onclick="logout()" title="Нажмите чтобы сменить роль">
      ${role.label} &nbsp;·&nbsp; Выйти
    </div>`;
  document.querySelector('.header-stats').prepend(badge);

  // Show/hide tabs based on role
  const allTabs = ['parcels','weather','gdd','diseases','irrigation','treatments','catalog','settings'];
  const tabEls = document.querySelectorAll('.tab');
  allTabs.forEach((tabId, i) => {
    if (tabEls[i]) {
      tabEls[i].style.display = role.tabs.includes(tabId) ? '' : 'none';
    }
  });

  // Show/hide edit controls based on role
  if (!role.canEdit) {
    // Factory role: mark read-only mode (checked dynamically in modals)
    document.body.setAttribute('data-readonly', 'true');
  } else {
    document.body.removeAttribute('data-readonly');
  }

  // Show first allowed tab
  const firstTab = role.tabs[0];
  showTab(firstTab);

  // Operator: show quick-entry banner
  if (roleKey === 'operator') {
    const banner = document.createElement('div');
    banner.id = 'operator-banner';
    banner.style.cssText = 'background:rgba(167,139,250,.08);border-bottom:1px solid rgba(167,139,250,.2);padding:8px 24px;font-size:11px;color:#a78bfa;display:flex;align-items:center;gap:16px;flex-wrap:wrap;';
    banner.innerHTML = `
      <span>📋 <strong>Режим оператора</strong> — ввод данных</span>
      <button class="btn btn-sm" style="background:rgba(167,139,250,.15);color:#a78bfa;border:1px solid rgba(167,139,250,.3);" onclick="showTab('weather');openWeatherModal()">+ День вручную</button>
      <button class="btn btn-sm" style="background:rgba(96,165,250,.2);color:#60a5fa;border:1px solid rgba(96,165,250,.4);font-weight:700;" onclick="showTab('weather');document.getElementById('meteo-input').click()">📂 Импорт XLS метеостанции</button>
      <button class="btn btn-sm" style="background:rgba(167,139,250,.15);color:#a78bfa;border:1px solid rgba(167,139,250,.3);" onclick="showTab('irrigation');openIrrigModal()">+ Полив</button>
      <button class="btn btn-sm" style="background:rgba(74,222,128,.2);color:var(--accent);border:1px solid rgba(74,222,128,.4);font-weight:700;" onclick="switchTab('tasks',document.querySelector('[onclick*=tasks]'));openNewTask()">📋 Новое задание</button>`;
    document.querySelector('.nav').after(banner);
  }

  // Add PIN change to settings if owner
  if (roleKey === 'owner') {
    renderPinSettings();
  }

  // Render main view
  renderParcels();
}

function logout() {
  if (!confirm('Сменить роль?')) return;
  sessionStorage.removeItem('sveg_role');
  _currentRole = null;
  const badge = document.getElementById('role-badge');
  if (badge) badge.remove();
  const banner = document.getElementById('operator-banner');
  if (banner) banner.remove();
  // Restore all tabs
  document.querySelectorAll('.tab').forEach(t => t.style.display = '');
  showLoginScreen();
}

function renderPinSettings() {
  const settingsPanel = document.getElementById('panel-settings');
  if (!settingsPanel) return;
  const pinBlock = document.createElement('div');
  pinBlock.style.cssText = 'margin-top:24px;';
  pinBlock.innerHTML = `
    <div style="font-family:'Unbounded',sans-serif;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">🔐 Управление PIN-кодами</div>
    <div style="display:flex;flex-direction:column;gap:10px;max-width:400px;">
      ${Object.entries(ROLES).map(([key, r]) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);">
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:600;color:${r.color};">${r.label}</div>
            <div style="font-size:10px;color:var(--text3);">Текущий PIN: ${localStorage.getItem(r.pinKey)||r.defaultPin}</div>
          </div>
          <input type="password" id="newpin-${key}" maxlength="4" placeholder="новый PIN"
            style="width:100px;background:var(--surface3);border:1px solid var(--border);border-radius:6px;
              padding:6px 10px;color:var(--text);font-size:14px;letter-spacing:4px;text-align:center;">
          <button onclick="changePin('${key}')" class="btn btn-secondary btn-sm">Изменить</button>
        </div>`).join('')}
    </div>
    <div id="pin-change-msg" style="margin-top:8px;font-size:11px;"></div>`;
  settingsPanel.appendChild(pinBlock);
}

function changePin(roleKey) {
  const role = ROLES[roleKey];
  const newPin = document.getElementById('newpin-'+roleKey).value;
  if (!newPin || newPin.length < 3) {
    document.getElementById('pin-change-msg').innerHTML = '<span style="color:var(--red);">PIN должен быть минимум 3 цифры</span>';
    return;
  }
  if (!/^\d+$/.test(newPin)) {
    document.getElementById('pin-change-msg').innerHTML = '<span style="color:var(--red);">Только цифры</span>';
    return;
  }
  localStorage.setItem(role.pinKey, newPin);
  document.getElementById('newpin-'+roleKey).value = '';
  document.getElementById('pin-change-msg').innerHTML = `<span style="color:var(--accent);">✅ PIN для ${role.label} изменён</span>`;
  renderPinSettings(); // refresh to show new PIN
}
