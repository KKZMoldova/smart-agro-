// Smart Agro — import.js
// ===================== CELLS (УЧАСТКИ) XLS IMPORT =====================

function downloadCellsTemplate() {
  const headers = [
    'Участок (строка)', 'Участок (колонка)', 'Культура (ID)',
    'Расст. между рядами (м)', 'Расст. между дер. (м)',
    'Год посадки', 'Подвой', 'Схема посадки', 'Укрытие',
    'Ряды С (от)', 'Ряды С (до)', 'Длина ряда (м)', 'Сорт (ID)',
    'Примечание'
  ];
  const cropIds = (S.crops||[]).map(c=>`${c.id} = ${c.name}`).join(' | ');
  const varIds  = (S.varieties||[]).map(v=>`${v.id} = ${v.name}`).join(' | ');

  const examples = [
    [1, 1, 'crop_cherry', 5, 3, 2018, 'Гизела 5', '4×2', 'none', 1, 25, 200, 'v2', 'Кордия'],
    [1, 1, 'crop_cherry', 5, 3, 2018, 'Гизела 5', '4×2', 'none', 26, 50, 200, 'v1', ''],
    [1, 2, 'crop_cherry', 5, 3, 2019, 'Гизела 5', '4×2', 'film',  1, 30, 180, 'v4', 'Скина'],
    [2, 1, 'crop_apple',  4, 2, 2020, 'М9',       '3×1', 'none',  1, 40, 250, 'va1',''],
  ];

  const infoRows = [
    [], ['СПРАВОЧНИК культур (cropId):'], [cropIds],
    [], ['СПРАВОЧНИК сортов (varietyId):'], [varIds],
    [], ['ВНИМАНИЕ: Один участок (строка+колонка) может занимать несколько строк — по одной строке на каждую группу рядов с одним сортом.'],
    ['Укрытие: none | film | net | hail_net'],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples, ...infoRows]);
  ws['!cols'] = [6,8,16,12,12,10,14,14,10,8,8,12,12,20].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws, 'Участки');
  XLSX.writeFile(wb, 'шаблон_участки.xlsx');
}

function importCellsFromExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const statusEl = document.getElementById('cells-import-status');
  statusEl.style.display = 'block';
  statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:8px;font-size:12px;color:var(--yellow);">⏳ Читаю ${file.name}...</div>`;

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
        if (r.some(c => c.includes('участ') || c.includes('строк') || c.includes('row') || c.includes('rând'))) { hi = i; break; }
      }
      const H = rows[hi].map(c => String(c).toLowerCase().trim());
      const col = (...kws) => { for (const kw of kws) { const i = H.findIndex(h=>h.includes(kw)); if(i>=0) return i; } return -1; };

      const iRow    = col('строк','row','rând','участок (с');
      const iCol    = col('колон','col','valvă','участок (к');
      const iCrop   = col('культур','crop','cultură');
      const iRSp    = col('между рядами','row spac','distanţa r');
      const iTSp    = col('между дер','tree spac','distanţa t');
      const iYear   = col('год посадки','plant year','an');
      const iRoot   = col('подвой','rootstock','portaltoi');
      const iScheme = col('схема','scheme','schemă');
      const iCover  = col('укрытие','cover','acoper');
      const iFrom   = col('от','from','de la','ряды с (от');
      const iTo     = col('до','to','până','ряды с (до');
      const iLen    = col('длина','length','lungim');
      const iVar    = col('сорт','variety','soi','varietate');
      const iNote   = col('примеч','note','observ');

      if (iRow < 0 || iCol < 0) {
        statusEl.innerHTML = `<div style="padding:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ Не найдены колонки «Участок (строка)» и «Участок (колонка)». Используйте шаблон.</div>`;
        return;
      }

      // Группируем строки по ключу участка
      const cellMap = {}; // key → {meta, rows[]}
      let addedCells = 0, addedRows = 0, skipped = 0;

      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i];
        const rn = parseInt(r[iRow]);
        const cn = parseInt(r[iCol]);
        if (!rn || !cn) continue;
        const key = `${rn}-${cn}`;
        if (!cellMap[key]) {
          cellMap[key] = {
            cropId:   iCrop  >= 0 ? String(r[iCrop]).trim()  : 'crop_cherry',
            rowSpacing: iRSp  >= 0 ? parseFloat(String(r[iRSp]).replace(',','.'))  || 5 : 5,
            treeSpacing:iTSp  >= 0 ? parseFloat(String(r[iTSp]).replace(',','.'))  || 3 : 3,
            plantYear:  iYear >= 0 ? parseInt(r[iYear]) || null : null,
            rootstock:  iRoot >= 0 ? String(r[iRoot]).trim() : '',
            plantingScheme: iScheme >= 0 ? String(r[iScheme]).trim() : '',
            cover:      iCover >= 0 ? String(r[iCover]).trim() || 'none' : 'none',
            note:       iNote >= 0 ? String(r[iNote]).trim() : '',
            rows: [],
          };
        }
        const fromV = iFrom >= 0 ? parseInt(r[iFrom]) : null;
        const toV   = iTo   >= 0 ? parseInt(r[iTo])   : null;
        const lenV  = iLen  >= 0 ? parseFloat(String(r[iLen]).replace(',','.')) : null;
        const varV  = iVar  >= 0 ? String(r[iVar]).trim() : '';
        if (fromV && lenV) {
          // Найти varietyId по имени или ID
          let vid = varV;
          if (varV && !S.varieties.find(v=>v.id===varV)) {
            const found = S.varieties.find(v=>v.name.toLowerCase().includes(varV.toLowerCase()));
            vid = found ? found.id : '';
          }
          cellMap[key].rows.push({from: fromV, to: toV||fromV, rowLength: lenV, varietyId: vid});
          addedRows++;
        }
      }

      // Записываем в S.cells
      for (const [key, data] of Object.entries(cellMap)) {
        if (S.cells[key]) { skipped++; continue; } // не перезаписываем существующие
        S.cells[key] = data;
        addedCells++;
      }

      save(); renderMap(); updateHdr();

      statusEl.innerHTML = `<div style="padding:12px 16px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.3);border-radius:8px;font-size:12px;">
        ✅ <strong>Импорт участков завершён</strong><br>
        • Добавлено участков: <strong style="color:var(--accent)">${addedCells}</strong><br>
        • Строк рядов: <strong style="color:var(--accent)">${addedRows}</strong><br>
        ${skipped ? `• Пропущено (уже существуют): ${skipped}` : ''}
        <div style="margin-top:6px;color:var(--text3);">Проверьте участки на карте. Нажмите клетку для редактирования.</div>
      </div>`;
      setTimeout(() => statusEl.style.display = 'none', 10000);

    } catch(err) {
      statusEl.innerHTML = `<div style="padding:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ Ошибка: ${err.message}</div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

// ===================== IRRIGATION ZONES XLS IMPORT =====================

function downloadZonesTemplate() {
  const headers = [
    'Название зоны', 'Участки (ключи через запятую)',
    'Тип полива', 'Расход воды (м³/ч)', 'Давление (бар)',
    'Расст. капельниц (см)', 'Расход капельницы (л/ч)', 'Капельниц/дерево',
    'Тип почвы', 'Глубина корней (см)', 'Макс. длит. (мин)', 'Мин. интервал (ч)',
    'Время старта', 'Примечание'
  ];
  const cellKeys = Object.keys(S.cells||{}).slice(0,8).join(', ') || '1-1, 1-2, 2-1';
  const examples = [
    ['Черешня valva 1', '1-1, 1-2', 'drip', 15, 2.5, 50, 1.6, 2, 'clay_loam', 50, 120, 12, '06:00', ''],
    ['Черешня valva 2', '2-1',      'drip', 12, 2.0, 50, 1.6, 2, 'clay_loam', 50, 90,  12, '08:00', ''],
    ['Яблоня',         '3-1, 3-2', 'sprinkler', 20, 3, '', '', '', 'loam', 60, 60, 24, '05:00', ''],
  ];
  const infoRows = [
    [],
    ['Тип полива: drip | sprinkler | micro_sprinkler | surface'],
    ['Тип почвы: clay_loam | loam | sandy_loam | clay | sand'],
    [`Доступные участки (ключи): ${cellKeys}`],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples, ...infoRows]);
  ws['!cols'] = [20,25,14,14,12,15,16,14,14,14,14,14,12,20].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws, 'Зоны полива');
  XLSX.writeFile(wb, 'шаблон_зоны_полива.xlsx');
}

function importZonesFromExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  if (!S.irrigation) S.irrigation = {};
  if (!S.irrigation.zones) S.irrigation.zones = [];

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
        if (r.some(c => c.includes('назван') || c.includes('zone') || c.includes('zonă') || c.includes('зона'))) { hi = i; break; }
      }
      const H = rows[hi].map(c => String(c).toLowerCase().trim());
      const col = (...kws) => { for (const kw of kws) { const i = H.findIndex(h=>h.includes(kw)); if(i>=0) return i; } return -1; };

      const iName    = col('назван','name','zonă','зона');
      const iCells   = col('участ','cell','parcelă','keys');
      const iType    = col('тип полива','type','tip irig');
      const iFlow    = col('расход воды','flow','debit');
      const iPress   = col('давлен','press','presiu');
      const iEmSp    = col('расст. кап','emitter','distanţa');
      const iDrFlow  = col('расход кап','dripper flow','debit pic');
      const iDrTree  = col('кап/дер','drippers per','picurăt');
      const iSoil    = col('тип почв','soil','sol');
      const iRoot    = col('глубина','root','rădăcin');
      const iMaxDur  = col('макс','max dur','durată');
      const iMinInt  = col('мин. инт','min int','interval');
      const iStart   = col('время ст','start','pornire');
      const iNote    = col('примеч','note','observ');

      if (iName < 0) {
        alert('Не найдена колонка «Название зоны». Используйте шаблон.');
        return;
      }

      let added = 0, skipped = 0;

      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i];
        const name = String(r[iName]||'').trim();
        if (!name) continue;

        // Пропускаем дубликаты по имени
        if (S.irrigation.zones.some(z => z.name.toLowerCase() === name.toLowerCase())) { skipped++; continue; }

        // Участки: "1-1, 1-2" → ['1-1','1-2']
        const cellRaw = iCells >= 0 ? String(r[iCells]||'') : '';
        const cellKeys = cellRaw.split(/[,;]+/).map(k=>k.trim()).filter(k=>k && /^\d+-\d+$/.test(k));

        const zone = {
          id: uid(),
          name,
          cellKeys,
          irrigType:    iType   >= 0 ? String(r[iType]||'drip').trim() : 'drip',
          flowRate:     iFlow   >= 0 ? parseFloat(String(r[iFlow]).replace(',','.'))   || null : null,
          pressure:     iPress  >= 0 ? parseFloat(String(r[iPress]).replace(',','.'))  || null : null,
          emitterSpacing: iEmSp >= 0 ? parseInt(r[iEmSp])   || null : null,
          dripperFlow:  iDrFlow >= 0 ? parseFloat(String(r[iDrFlow]).replace(',','.')) || null : null,
          drippersPerTree: iDrTree >= 0 ? parseInt(r[iDrTree]) || null : null,
          soilType:     iSoil   >= 0 ? String(r[iSoil]||'clay_loam').trim() : 'clay_loam',
          rootDepth:    iRoot   >= 0 ? parseInt(r[iRoot])   || 50  : 50,
          maxDuration:  iMaxDur >= 0 ? parseInt(r[iMaxDur]) || 120 : 120,
          minInterval:  iMinInt >= 0 ? parseInt(r[iMinInt]) || 12  : 12,
          startTime:    iStart  >= 0 ? String(r[iStart]||'06:00').trim() : '06:00',
          note:         iNote   >= 0 ? String(r[iNote]||'').trim() : '',
          // вычисляем площадь из участков
          area: cellKeys.reduce((s,k)=>{ const cd=S.cells[k]; return s+(cd?calcCellTotals(cd).totalHa:0); },0),
          varietyIds: [],
          valveId:'', pumpId:'', dripperType:'',
          station:'00002158',
          irrigMode:'deficit', targetMoisture:80, stressThreshold:50,
          wettedArea:35,
        };
        S.irrigation.zones.push(zone);
        added++;
      }

      save(); renderIrrigZones();

      // Показываем статус в панели ирригации
      let statusEl = document.getElementById('zones-import-status');
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'zones-import-status';
        statusEl.style.cssText = 'margin:8px 0 12px;';
        const actionsDiv = document.getElementById('irrig-actions-zones');
        actionsDiv?.insertAdjacentElement('afterend', statusEl);
      }
      statusEl.innerHTML = `<div style="padding:12px 16px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.3);border-radius:8px;font-size:12px;">
        ✅ <strong>Импорт зон полива завершён</strong><br>
        • Добавлено зон: <strong style="color:var(--accent)">${added}</strong><br>
        ${skipped ? `• Пропущено (дубликаты): ${skipped}` : ''}
        <div style="margin-top:6px;color:var(--text3);">Откройте каждую зону для проверки и уточнения параметров.</div>
      </div>`;
      statusEl.style.display = 'block';
      setTimeout(() => statusEl.style.display = 'none', 10000);

    } catch(err) {
      alert('Ошибка чтения файла: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ===================== IRRIGATION LOG XLS IMPORT =====================

function downloadIrrigTemplate() {
  const zones   = (S.irrigation?.zones||[]);
  const cells   = Object.keys(S.cells||{}).sort();

  // ── Лист 1: Журнал полива ──
  const headers = [
    'Дата (ДД.ММ.ГГГГ)',
    'Зона полива (название)',
    'Участок (ключ, если без зоны)',
    'Продолжительность (мин)',
    'Объём воды (м³)',
    'Норма (мм)',
    'Примечание',
  ];

  // Примеры — заполняем реальными зонами если есть
  const zEx = zones.length ? zones[0].name : 'Черешня valva 1';
  const zEx2 = zones.length > 1 ? zones[1].name : 'Черешня valva 2';
  const cEx  = cells.length ? cells[0] : '1-1';

  const examples = [
    ['01.04.2025', zEx,  '',   120, 18,   15, 'Плановый'],
    ['03.04.2025', zEx,  '',   90,  13.5, 11, ''],
    ['05.04.2025', zEx2, '',   120, 15,   12, 'Плановый'],
    ['07.04.2025', zEx,  '',   150, 22.5, 18, 'После жары'],
    ['10.04.2025', '',   cEx,  '',  10,   8,  'Ручной полив без зоны'],
    ['12.04.2025', zEx,  '',   '',  '',   20, 'Только мм'],
    ['15.04.2025', zEx,  '',   120, '',   '',  'Только минуты — объём рассчитается'],
    ['20.04.2025', zEx2, '',   90,  '',   '',  ''],
  ];

  // ── Лист 2: Справочник зон (для заполнения) ──
  const zoneHeaders = ['Название зоны', 'Участки', 'Расход (м³/ч)', 'Площадь (га)', 'ID'];
  const zoneRows = zones.length
    ? zones.map(z=>[z.name, (z.cellKeys||[]).join(', '), z.flowRate||'', (z.area||0).toFixed(2), z.id])
    : [['(зоны не настроены — введите название вручную)', '', '', '', '']];

  // Подсказки
  const noteRows = [
    [],
    ['ПРАВИЛА ЗАПОЛНЕНИЯ:'],
    ['• Зона полива — скопируйте точное название из листа «Зоны» ниже'],
    ['• Или укажите Участок (ключ: 1-1, 2-3 и т.д.) если без зоны'],
    ['• Продолжительность (мин) — если указана и зона имеет расход, объём рассчитается авто'],
    ['• Объём (м³) — если указан, мм рассчитается авто из площади зоны'],
    ['• Норма (мм) — можно указать напрямую (например из счётчика)'],
    ['• Достаточно заполнить одно из трёх: минуты / м³ / мм'],
    [],
    ['Участки (ключи):'],
    [cells.join(', ') || 'нет участков — добавьте на карте'],
  ];

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet([headers, ...examples, ...noteRows]);
  ws1['!cols'] = [{wch:16},{wch:22},{wch:14},{wch:16},{wch:14},{wch:12},{wch:30}];
  ws1['!freeze'] = {xSplit:0, ySplit:1};
  XLSX.utils.book_append_sheet(wb, ws1, 'Журнал полива');

  const ws2 = XLSX.utils.aoa_to_sheet([zoneHeaders, ...zoneRows]);
  ws2['!cols'] = [{wch:24},{wch:20},{wch:14},{wch:12},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Зоны');

  XLSX.writeFile(wb, 'шаблон_журнал_полива.xlsx');
}

function importIrrigFromExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  // Показываем статус
  let statusEl = document.getElementById('irrig-import-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'irrig-import-status';
    statusEl.style.cssText = 'margin:8px 0 12px;';
    const actionsDiv = document.getElementById('irrig-actions-balance');
    actionsDiv?.insertAdjacentElement('afterend', statusEl);
  }
  statusEl.style.display = 'block';
  statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:8px;font-size:12px;color:var(--yellow);">⏳ Читаю ${file.name}...</div>`;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
      // Читаем первый лист (журнал полива)
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});

      // Найти строку заголовков
      let hi = 0;
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const r = rows[i].map(c => String(c||'').toLowerCase());
        if (r.some(c => c.includes('дата') || c.includes('date') || c.includes('data'))) { hi = i; break; }
      }
      const H = rows[hi].map(c => String(c||'').toLowerCase().trim());
      const col = (...kws) => { for (const kw of kws) { const i = H.findIndex(h=>h.includes(kw)); if(i>=0) return i; } return -1; };

      const iDate  = col('дата','date','data');
      const iZone  = col('зона','zone','zonă');
      const iCell  = col('участок','cell','parcela','клетка');
      const iDur   = col('продолж','дурат','minut','duration','min');
      const iVol   = col('объём','volume','м³','m3','volum');
      const iMm    = col('норма','мм','mm','norme');
      const iNote  = col('примеч','note','observ');

      if (iDate < 0) {
        statusEl.innerHTML = `<div style="padding:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ Не найдена колонка «Дата». Используйте шаблон.</div>`;
        return;
      }

      if (!S.irrigation) S.irrigation = {};
      if (!S.irrigation.events) S.irrigation.events = [];

      const zones = S.irrigation.zones || [];
      let added = 0, skipped = 0, errors = [];

      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i];
        const rawDate = r[iDate];
        if (!rawDate) continue;

        // Парсим дату (DD.MM.YYYY / YYYY-MM-DD / Excel serial)
        let date = null;
        const ds = String(rawDate).trim();
        const m1 = ds.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (m1) date = `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
        else if (ds.match(/^\d{4}-\d{2}-\d{2}/)) date = ds.slice(0,10);
        else if (/^\d{5}$/.test(ds)) {
          const d = new Date(Math.round((parseInt(ds)-25569)*86400*1000));
          date = d.toISOString().split('T')[0];
        }
        if (!date) { errors.push(`Строка ${i+1}: не распознана дата "${ds}"`); continue; }

        // Зона — по названию
        const zoneName = iZone >= 0 ? String(r[iZone]||'').trim() : '';
        const zone = zoneName ? zones.find(z => z.name.toLowerCase() === zoneName.toLowerCase()
          || z.name.toLowerCase().includes(zoneName.toLowerCase())) : null;

        // Участок — если нет зоны
        const cellRaw = iCell >= 0 ? String(r[iCell]||'').trim() : '';
        const cellKeys = zone ? (zone.cellKeys||[])
          : (cellRaw && S.cells[cellRaw] ? [cellRaw] : []);

        // Числовые значения
        const durationMin = iDur >= 0 ? parseFloat(String(r[iDur]).replace(',','.')) || 0 : 0;
        let volumeM3      = iVol >= 0 ? parseFloat(String(r[iVol]).replace(',','.')) || 0 : 0;
        let mm            = iMm  >= 0 ? parseFloat(String(r[iMm]).replace(',','.'))  || 0 : 0;

        // Авто-расчёт недостающих значений
        const areaHa = zone?.area || cellKeys.reduce((s,k)=>s+(calcCellTotals(S.cells[k]||{}).totalHa||0), 0) || 1;
        if (!volumeM3 && durationMin && zone?.flowRate) {
          volumeM3 = Math.round(zone.flowRate * durationMin / 60 * 10) / 10;
        }
        if (!mm && volumeM3 && areaHa) {
          mm = Math.round(volumeM3 / areaHa / 10 * 10) / 10;
        }
        if (!volumeM3 && mm && areaHa) {
          volumeM3 = Math.round(mm * areaHa * 10 * 10) / 10;
        }

        if (!mm && !volumeM3 && !durationMin) { skipped++; continue; }

        // Проверяем дубликат (та же дата + та же зона)
        const isDup = S.irrigation.events.some(ev =>
          ev.date === date &&
          ev.zoneId === (zone?.id||'') &&
          ev.cellKeys?.join(',') === cellKeys.join(',')
        );
        if (isDup) { skipped++; continue; }

        // GDD фаза
        const phase = (() => {
          try { return getPhaseByGdd(S.varieties[0]?.id, getCurrentGdd(5))?.name || ''; }
          catch { return ''; }
        })();

        S.irrigation.events.unshift({
          id: uid(),
          date,
          zoneId:   zone?.id || '',
          zoneName: zone?.name || zoneName || cellRaw || 'Ручной ввод',
          cellKeys,
          durationMin,
          volumeM3,
          mm,
          phase,
          note: iNote >= 0 ? String(r[iNote]||'').trim() : '',
        });
        added++;
      }

      // Сортируем по дате убыванию
      S.irrigation.events.sort((a,b) => b.date.localeCompare(a.date));
      save();
      calcWaterBalance();

      const errHtml = errors.length
        ? `<br><span style="color:var(--orange);">⚠️ Пропущено строк с ошибкой даты: ${errors.length}</span>`
        : '';
      statusEl.innerHTML = `<div style="padding:12px 16px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.3);border-radius:8px;font-size:12px;">
        ✅ <strong>Журнал полива импортирован</strong><br>
        • Добавлено записей: <strong style="color:var(--accent)">${added}</strong><br>
        ${skipped ? `• Пропущено (дубликаты / пустые): ${skipped}<br>` : ''}
        ${errHtml}
        <div style="margin-top:6px;color:var(--text3);">Water Balance пересчитан автоматически.</div>
      </div>`;
      setTimeout(() => statusEl.style.display = 'none', 10000);

    } catch(err) {
      statusEl.innerHTML = `<div style="padding:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ Ошибка: ${err.message}</div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

// ===================== CATALOG XLS IMPORT =====================

function importCatalogFromExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const TYPE_MAP = {
    'фунгицид':'fungicide','fungicide':'fungicide','fungicid':'fungicide',
    'инсектицид':'insecticide','insecticide':'insecticide','insecticid':'insecticide',
    'гербицид':'herbicide','herbicide':'herbicide','erbicid':'herbicide',
    'регулятор':'regulator','growth regulator':'regulator','регулятор роста':'regulator',
    'листовое питание':'foliar_nutrition','удобрение листовое':'foliar_nutrition','foliar':'foliar_nutrition',
    'пав':'surfactant','surfactant':'surfactant','adjuvant':'surfactant',
    'биопрепарат':'bio','bio':'bio','biological':'bio',
  };

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});

      // Найти строку заголовков (первая строка с "название" или "name")
      let headerRow = 0;
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const r = rows[i].map(c => String(c).toLowerCase());
        if (r.some(c => c.includes('назван') || c.includes('name') || c.includes('препарат') || c.includes('produs'))) {
          headerRow = i; break;
        }
      }

      const headers = rows[headerRow].map(c => String(c).toLowerCase().trim());
      const col = (keywords) => {
        for (const kw of keywords) {
          const idx = headers.findIndex(h => h.includes(kw));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const iName    = col(['назван','name','препарат','produs','denumire']);
      const iType    = col(['тип','type','tip','категор','categ']);
      const iActive  = col(['д.в','active','substanţ','вещест','a.i.','действ']);
      const iDose    = col(['доза','dose','doza','норма','rate','л/га','кг/га']);
      const iWater   = col(['вода','water','apă','расход воды','л/га воды']);
      const iDur     = col(['срок','duration','period','защит','interval','кзр']);
      const iPhi     = col(['пхи','phi','пред уб','harvest','сбор']);
      const iHazard  = col(['класс','hazard','hazard','опасн','danger']);
      const iTargets = col(['культур','target','crop','объект','против']);
      const iNote    = col(['примеч','note','observ','коммент']);

      if (iName < 0) {
        alert('Не найдена колонка с названием препарата.\nПроверьте что в файле есть заголовок: Название / Name / Препарат');
        return;
      }

      const imported = [];
      const skipped = [];

      for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row[iName] || '').trim();
        if (!name) continue;

        // Пропускаем дубликаты
        if (S.catalog.some(p => p.name.toLowerCase() === name.toLowerCase())) {
          skipped.push(name);
          continue;
        }

        const rawType = String(row[iType] || '').toLowerCase().trim();
        let type = 'fungicide';
        for (const [key, val] of Object.entries(TYPE_MAP)) {
          if (rawType.includes(key)) { type = val; break; }
        }

        const prod = {
          id: 'imp_' + Date.now() + '_' + i,
          name,
          type,
          activeSubstance: iActive >= 0 ? String(row[iActive] || '').trim() : '',
          fracCode: '',
          moaGroup: '',
          dose:     iDose   >= 0 ? parseFloat(String(row[iDose]).replace(',','.'))   || 0   : 0,
          water:    iWater  >= 0 ? parseFloat(String(row[iWater]).replace(',','.'))  || 400 : 400,
          duration: iDur    >= 0 ? parseInt(row[iDur])    || 14  : 14,
          washMm:   15,
          washType: 'partial',
          method:   'foliar',
          phi:      iPhi    >= 0 ? parseInt(row[iPhi])    || 7   : 7,
          hazard:   iHazard >= 0 ? parseInt(row[iHazard]) || 3   : 3,
          targets:  iTargets >= 0 ? String(row[iTargets] || '').trim() : '',
          compatibility: '',
          note:     iNote   >= 0 ? String(row[iNote]   || '').trim() : '',
        };
        S.catalog.push(prod);
        imported.push(name);
      }

      save();
      renderCatalog();

      // Показываем результат
      const statusHtml = `
        <div style="padding:12px 16px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.3);border-radius:8px;font-size:12px;">
          ✅ <strong>Импорт завершён</strong> из ${file.name}<br>
          • Добавлено: <strong style="color:var(--accent)">${imported.length}</strong> препаратов<br>
          ${skipped.length ? `• Пропущено (дубликаты): ${skipped.length} — ${skipped.slice(0,5).join(', ')}${skipped.length>5?'…':''}` : ''}
          ${imported.length ? `<div style="margin-top:6px;color:var(--text3);">Проверьте типы и дозы — при необходимости отредактируйте вручную.</div>` : ''}
        </div>`;
      // Показать статус под заголовком каталога
      let statusEl = document.getElementById('catalog-import-status');
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'catalog-import-status';
        statusEl.style.marginBottom = '14px';
        const panel = document.getElementById('panel-catalog');
        const sectionHdr = panel?.querySelector('.section-hdr');
        if (sectionHdr) sectionHdr.insertAdjacentElement('afterend', statusEl);
      }
      statusEl.innerHTML = statusHtml;
      statusEl.style.display = 'block';
      setTimeout(() => { statusEl.style.display = 'none'; }, 8000);

    } catch(err) {
      alert('Ошибка чтения файла: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function downloadCatalogTemplate() {
  const headers = ['Название','Тип','Д.В. (действующее вещество)','Доза (л/га или кг/га)','Расход воды (л/га)','Срок защиты (дней)','ПХИ (дней до сбора)','Класс опасности (1-4)','Культуры / Цели','Примечание'];
  const examples = [
    ['Делан WG','фунгицид','дифеноконазол','0.3','600','14','7','3','черешня, яблоня','парша, монилиоз'],
    ['Хорус 75WG','фунгицид','ципродинил','0.2','600','10','7','3','черешня','монилиоз, коккомикоз'],
    ['Актара 25WG','инсектицид','тиаметоксам','0.14','600','21','14','2','черешня, яблоня','тля, долгоносик'],
    ['Калипсо SC','инсектицид','тиаклоприд','0.24','600','14','7','3','черешня','вишнёвая муха'],
    ['Свитч 62.5WG','фунгицид','ципродинил + флудиоксонил','0.8','600','14','7','3','черешня','серая гниль, монилиоз'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  ws['!cols'] = headers.map((h,i) => ({wch: [25,15,30,18,18,18,18,18,25,25][i]}));
  XLSX.utils.book_append_sheet(wb, ws, 'Препараты');
  XLSX.writeFile(wb, 'шаблон_препараты.xlsx');
}

// ===================== TREATMENTS XLS IMPORT =====================
// Supports the farm management system export format (Romanian/Russian)
// Sections: Stropire livada (foliar), Fertigare (drip), Erbecidare (soil), Incorporarea (soil)

function importTreatmentsFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  const statusEl = document.getElementById('treatments-import-status');
  statusEl.style.display = 'block';
  statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:8px;font-size:12px;color:var(--yellow);">⏳ Читаю файл ${file.name}...</div>`;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      // Show crop/cell picker before processing
      showTreatmentImportPicker(rows, file.name, statusEl);
    } catch(err) {
      statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ Ошибка: ${err.message}</div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

/** Backfill cropId on existing treatments that have cellTarget but no cropId */
function backfillTreatmentCrops() {
  let fixed = 0;
  S.treatments.forEach(t => {
    if (!t.cropId && t.cellTarget && t.cellTarget !== 'all') {
      const cd = S.cells[t.cellTarget];
      if (cd?.cropId) { t.cropId = cd.cropId; fixed++; }
    }
  });
  save(); renderTreatments();
  const statusEl = document.getElementById('treatments-import-status');
  statusEl.style.display = 'block';
  statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.3);border-radius:8px;font-size:12px;color:var(--accent);">
    ✅ Привязано культур: <strong>${fixed}</strong> обработок обновлено
    ${fixed===0?'· Все обработки уже имеют привязку к культуре или привязаны к "Весь сад"':''}
  </div>`;
}

function showTreatmentImportPicker(rows, filename, statusEl) {
  _importRows = rows;

  // Build grouped options: crop-level + cell-level
  const gardenCropIds = [...new Set(Object.values(S.cells).map(cd=>cd?.cropId||'crop_cherry'))];
  const cellsByCrop = {};
  Object.entries(S.cells).sort().forEach(([k,cd]) => {
    const cid = cd?.cropId||'crop_cherry';
    if (!cellsByCrop[cid]) cellsByCrop[cid] = [];
    cellsByCrop[cid].push({k,cd});
  });

  let optHtml = '<option value="all">🌍 Весь сад (все культуры)</option>';
  optHtml += '<optgroup label="── Вся культура ──">';
  gardenCropIds.forEach(cid => {
    const crop = getCropById(cid);
    if (!crop) return;
    const cnt = (cellsByCrop[cid]||[]).length;
    optHtml += `<option value="crop:${cid}">${crop.emoji||'🌱'} Вся ${crop.name} (${cnt} клет.)</option>`;
  });
  optHtml += '</optgroup>';
  gardenCropIds.forEach(cid => {
    const crop = getCropById(cid);
    const cells = cellsByCrop[cid]||[];
    if (!cells.length) return;
    optHtml += `<optgroup label="── ${crop?.emoji||''} ${crop?.name||''} по клеткам ──">`;
    cells.forEach(({k,cd}) => {
      const col = getCellColors(cd);
      optHtml += `<option value="${k}">${crop?.emoji||'🌱'} Клетка ${k}${col[0]?' — '+col[0].name:''}</option>`;
    });
    optHtml += '</optgroup>';
  });

  const preview = rows.slice(0,4).map(r=>r.filter(v=>String(v||'').trim()).slice(0,4).join(' | ')).filter(Boolean).join('<br>');
  const defaultNote = filename.replace(/\.(xls|xlsx)$/i,'');

  const html = `
    <div class="modal-overlay open" id="modal-import-picker">
      <div class="modal" style="width:660px;">
        <h2>📂 Импорт обработок — ${filename}</h2>
        <div style="font-size:11px;color:var(--text3);background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:14px;font-family:monospace;line-height:1.6;">${preview}</div>
        <div class="form-grid">
          <div class="ff"><label>🌿 К чему относятся обработки</label>
            <select id="imp-cell" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);width:100%;" onchange="onImportCellChange()">
              ${optHtml}
            </select>
            <div id="imp-crop-info" style="font-size:11px;color:var(--accent);margin-top:5px;min-height:16px;"></div>
          </div>
          <div class="ff"><label>📝 Примечание</label>
            <input type="text" id="imp-note" value="${defaultNote}" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);width:100%;">
          </div>
        </div>
        <div style="padding:10px 12px;background:rgba(74,222,128,.05);border:1px solid rgba(74,222,128,.15);border-radius:8px;font-size:11px;color:var(--text2);margin-top:8px;line-height:1.7;">
          💡 <strong>Вся черешня</strong> — видны при фильтре "Черешня" · 
          <strong>Клетка</strong> — привязка к конкретной клетке · 
          <strong>Весь сад</strong> — видны только при "Все культуры"
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('modal-import-picker').remove();_importRows=null;">Отмена</button>
          <button class="btn btn-primary" onclick="confirmTreatmentImport()">📥 Импортировать</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function onImportCellChange() {
  const val = document.getElementById('imp-cell')?.value||'';
  const el = document.getElementById('imp-crop-info');
  if (!val||val==='all') { el.textContent='Обработки видны только при фильтре "Все культуры"'; return; }
  if (val.startsWith('crop:')) {
    const crop = getCropById(val.replace('crop:',''));
    el.innerHTML=`${crop?.emoji||''} <strong>Вся ${crop?.name||''}</strong> — все клетки этой культуры`;
    return;
  }
  const cd=S.cells[val]; const crop=getCropById(cd?.cropId||'crop_cherry'); const col=getCellColors(cd||{});
  el.innerHTML=`${crop?.emoji||''} <strong>${crop?.name||''}</strong> · Клетка ${val}${col[0]?' · '+col[0].name:''}`;
}

function confirmTreatmentImport() {
  if (!_importRows) { alert('Нет данных для импорта'); return; }
  const rawTarget = document.getElementById('imp-cell')?.value || 'all';
  const note = document.getElementById('imp-note')?.value || 'Импорт';
  document.getElementById('modal-import-picker').remove();
  const statusEl = document.getElementById('treatments-import-status');

  // Determine cellTarget and cropId from selection
  let cellTarget = 'all';
  let importCropId = null;

  if (rawTarget.startsWith('crop:')) {
    // Whole crop selected — cellTarget stays 'all', set cropId
    importCropId = rawTarget.replace('crop:', '');
    cellTarget = 'all';
  } else if (rawTarget !== 'all') {
    // Specific cell selected
    cellTarget = rawTarget;
    const cd = S.cells[cellTarget];
    importCropId = cd?.cropId || null;
  }

  try {
    const treats = parseTreatmentRows(_importRows, cellTarget, note);
    // Set cropId on all imported treatments
    if (importCropId) treats.forEach(t => t.cropId = importCropId);
    mergeTreatments(treats, statusEl, note);
  } catch(err) {
    statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ Ошибка: ${err.message}</div>`;
  }
  _importRows = null;
}

function parseTreatmentRows(rows, cellTarget, importNote) {
  cellTarget = cellTarget || 'all';
  importNote = importNote || 'Импорт';
  const SECTIONS = ['Stropire livada','Fertigare','Erbecidare','Incorporarea ingrasaminte'];

  function detectType(tip) {
    const t = String(tip).toLowerCase();
    if (t.includes('fungicide') || t.includes('фунгицид')) return 'fungicide';
    if (t.includes('insecticide') || t.includes('инсектицид')) return 'insecticide';
    if (t.includes('erbicide') || t.includes('гербицид')) return 'herbicide';
    if (t.includes('fertiliz') || t.includes('удобрен') || t.includes('fertilizer')) return 'fertilizer';
    if (t.includes('surfactant') || t.includes('пав')) return 'surfactant';
    if (t.includes('bio')) return 'bio';
    if (t.includes('regulator')) return 'regulator';
    if (t.includes('materiale')) return 'other';
    return 'fertilizer';
  }

  function parseDate(str) {
    const s = String(str).trim();
    const m1 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
    if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0,10);
    // Excel serial date number
    if (/^\d{5}$/.test(s)) {
      const d = new Date(Math.round((parseInt(s) - 25569) * 86400 * 1000));
      return d.toISOString().split('T')[0];
    }
    return null;
  }

  // ── Определяем формат: наш шаблон или румынский секционный ──
  let headerRow = -1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const r = rows[i].map(c => String(c||'').toLowerCase());
    if (r.some(c => c.includes('дата') || c.includes('date') || c.includes('data'))) {
      // Проверяем что это строка с нашими заголовками (есть "препарат" или "метод")
      if (r.some(c => c.includes('препарат') || c.includes('метод') || c.includes('method') || c.includes('produs'))) {
        headerRow = i;
        break;
      }
    }
  }

  // ── Наш формат: строка = одна обработка с баковой смесью ──
  if (headerRow >= 0) {
    const H = rows[headerRow].map(c => String(c||'').toLowerCase().trim());
    const col = (...kws) => { for (const kw of kws) { const i = H.findIndex(h=>h.includes(kw)); if(i>=0) return i; } return -1; };

    const iDate    = col('дата','date','data');
    const iCell    = col('участок','cell','parcel','клетка');
    const iVar     = col('сорт','variety','soi');
    const iMethod  = col('метод','method','metod','способ');
    const iWater   = col('расход воды','water','apă');
    const iNote    = col('примеч','note','observ');

    // Препараты 1..4: ищем по паттерну "препарат N" / "product N"
    const prodCols = []; // [{name, dose, type, active}]
    for (let n = 1; n <= 4; n++) {
      const iN   = col(`препарат ${n}`, `product ${n}`, `produs ${n}`);
      const iD   = col(`доза ${n}`, `dose ${n}`, `doza ${n}`);
      const iT   = col(`тип ${n}`, `type ${n}`, `tip ${n}`);
      const iAI  = col(`д.в. ${n}`, `a.i. ${n}`, `active ${n}`);
      if (iN >= 0) prodCols.push({iN, iD, iT, iAI});
    }

    const treats = [];
    let baseId = Date.now();

    for (let i = headerRow + 1; i < rows.length; i++) {
      const r = rows[i];
      const dateRaw = iDate >= 0 ? r[iDate] : r[0];
      const date = parseDate(dateRaw);
      if (!date) continue;

      // Читаем участок из файла, но если пришёл cellTarget из пикера — он приоритетнее
      const fileCellRaw = iCell >= 0 ? String(r[iCell]||'').trim() : '';
      const resolvedCell = (cellTarget && cellTarget !== 'all') ? cellTarget : (fileCellRaw || 'all');

      const method = iMethod >= 0 ? String(r[iMethod]||'foliar').trim() : 'foliar';
      const water  = iWater  >= 0 ? parseFloat(String(r[iWater]).replace(',','.')) || 400 : 400;
      const varT   = iVar    >= 0 ? String(r[iVar]||'').trim() : '';
      const note   = iNote   >= 0 ? String(r[iNote]||importNote).trim() : importNote;

      // Собираем баковую смесь
      const products = [];
      for (const {iN, iD, iT, iAI} of prodCols) {
        const name = String(r[iN]||'').trim();
        if (!name) continue;
        const doseVal = iD >= 0 ? parseFloat(String(r[iD]).replace(',','.')) || 0 : 0;
        const typeRaw = iT >= 0 ? String(r[iT]||'').trim() : '';
        const active  = iAI >= 0 ? String(r[iAI]||'').trim() : '';
        // Ищем в каталоге
        const cat = S.catalog.find(p => p.name.toLowerCase() === name.toLowerCase());
        products.push({
          name,
          dose: doseVal || cat?.dose || 0,
          type: typeRaw ? detectType(typeRaw) : (cat?.type || 'fungicide'),
          active: active || cat?.activeSubstance || '',
          dur: cat?.duration || 14,
          washMm: cat?.washMm || 15,
          catId: cat?.id || null,
        });
      }

      if (!products.length) continue;

      const maxDur = Math.max(...products.map(p=>p.dur||14));
      const minWash = Math.min(...products.map(p=>p.washMm||15));
      const endDt = new Date(date);
      endDt.setDate(endDt.getDate() + maxDur);

      // cropId из участка
      const cd = S.cells[resolvedCell];
      const cropId = cd?.cropId || null;

      baseId++;
      treats.push({
        id: baseId,
        date,
        product: products.map(p=>p.name).join(' + '),
        products,
        activeSubstance: products.map(p=>p.active).filter(Boolean).join(', '),
        type: products[0].type,
        method,
        dose: products[0].dose,
        water,
        duration: maxDur,
        washMm: minWash,
        catalogId: products[0].catId || null,
        endDate: endDt.toISOString().split('T')[0],
        cellsTarget: resolvedCell !== 'all' ? [resolvedCell] : [],
        cellTarget: resolvedCell,
        cropId,
        varietyTarget: varT,
        note,
      });
    }
    return treats;
  }

  // ── Румынский секционный формат (оригинальный парсер) ──

  function detectMethod(section) {
    const m = {'Stropire livada':'foliar','Fertigare':'drip',
               'Erbecidare':'soil','Incorporarea ingrasaminte':'soil'};
    return m[section] || 'foliar';
  }

  const treats = [];
  let section = null, curDate = null;
  let baseId = Date.now();

  rows.forEach(row => {
    const vals = row.map(v => String(v||'').trim());
    const f = vals[0];
    if (!f) return;

    // Section header
    if (SECTIONS.includes(f)) { section = f; curDate = null; return; }

    // Date line
    const d = parseDate(f);
    if (d) { curDate = d; return; }

    // Skip non-data rows
    if (!section || !curDate) return;
    if (f === 'Apa Stropiri' || f === 'KORDIA' || f.startsWith('Параметры') || f.startsWith('Отбор')) return;

    // Product line — find tip_chimie (last non-empty value)
    let tip = '';
    for (let i = vals.length-1; i >= 0; i--) { if (vals[i]) { tip = vals[i]; break; } }

    // Dose: col 6 (7th column) in the farm system format
    let dose = 0;
    for (let col of [6, 3, 7]) {
      if (vals[col] && !isNaN(parseFloat(vals[col]))) {
        dose = Math.round(parseFloat(vals[col])*1000)/1000;
        break;
      }
    }

    const ptype = detectType(tip);
    const method = detectMethod(section);
    const dur = {fungicide:14, insecticide:21, herbicide:30}[ptype] || 7;

    // End date
    const endDt = new Date(curDate);
    endDt.setDate(endDt.getDate() + dur);
    const endDate = endDt.toISOString().split('T')[0];

    const methodLabel = {foliar:'Листовая',drip:'Капельное орошение',soil:'В почву'}[method]||'';

    baseId++;
    treats.push({
      id: baseId,
      date: curDate,
      product: f,
      activeSubstance: '',
      type: ptype,
      method: method,
      dose: dose,
      water: method === 'foliar' ? 400 : 0,
      duration: dur,
      washMm: 15,
      endDate: endDate,
      cellTarget: cellTarget,
      cropId: (cellTarget && cellTarget!=='all' && S.cells[cellTarget]) ? S.cells[cellTarget].cropId||null : null,
      varietyTarget: 'all',
      catalogId: null,
      note: `${importNote} · ${methodLabel}`,
    });
  });

  return treats;
}

function mergeTreatments(treats, statusEl, filename) {
  if (!treats.length) {
    statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ Обработки не найдены в файле</div>`;
    return;
  }
  let added = 0, skipped = 0, updated = 0, catalogAdded = 0;
  treats.forEach(t => {
    const existingIdx = S.treatments.findIndex(ex => ex.date === t.date && ex.product === t.product);
    if (existingIdx >= 0) {
      // If duplicate but new import has cropId and existing doesn't — update cropId
      if (t.cropId && !S.treatments[existingIdx].cropId) {
        S.treatments[existingIdx].cropId = t.cropId;
        updated++;
      } else {
        skipped++;
      }
      return;
    }
    S.treatments.push(t);
    added++;

    // Auto-add to catalog if not exists
    const inCatalog = S.catalog.some(c => c.name.toLowerCase() === t.product.toLowerCase());
    if (!inCatalog && t.product && t.type !== 'other') {
      const defDuration = {fungicide:14,insecticide:21,herbicide:30,fertilizer:7}[t.type]||7;
      const defWashMm = {fungicide:15,insecticide:25,herbicide:20,fertilizer:5}[t.type]||15;
      S.catalog.push({
        id: 'p'+Date.now()+Math.random().toString(36).slice(2,6),
        name: t.product,
        type: t.type,
        activeSubstance: '',
        dose: t.dose || 0,
        water: t.water || (t.method==='foliar'?400:0),
        duration: defDuration,
        washMm: defWashMm,
        washType: 'partial',
        method: t.method || 'foliar',
        phi: 7,
        hazard: 3,
        targets: '',
        note: `Импортировано из ${filename}`,
      });
      catalogAdded++;
    }
  });
  S.treatments.sort((a,b) => b.date.localeCompare(a.date));
  save();
  renderTreatments();
  updateHdr();
  const dates = treats.map(t=>t.date).sort();
  const byMethod = {};
  treats.forEach(t => byMethod[t.method] = (byMethod[t.method]||0)+1);
  statusEl.innerHTML = `<div style="padding:12px 16px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.3);border-radius:8px;font-size:12px;color:var(--accent);">
    ✅ <strong>${added}</strong> обработок добавлено
    ${updated>0?`· <strong>${updated}</strong> привязано к культуре`:''}
    ${skipped>0?`· ${skipped} дублей пропущено`:''}
    <div style="margin-top:6px;font-size:11px;color:var(--text2);">
      📅 ${dates[0]} — ${dates[dates.length-1]}
      &nbsp;·&nbsp; 🌿 ${byMethod.foliar||0} листовых &nbsp; 💧 ${byMethod.drip||0} капельных &nbsp; 🌱 ${byMethod.soil||0} в почву
      ${catalogAdded>0?`<br>📦 ${catalogAdded} препаратов добавлено в справочник`:''}
    </div>
  </div>`;
}

