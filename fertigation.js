// ═══ ИМПОРТ ФЕРТИГАЦИИ ИЗ EXCEL ══════════════════════════════════════════
// Читает шаблон: Дата | Культура | Клетка/Сорт | Препарат | Тип | Норма л/га | Норма кг/га | Объём воды | Площадь га | Итого | Примечание

function importFertigationFromExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const statusEl = document.getElementById('fertigation-import-status');
  statusEl.style.display = 'block';
  statusEl.innerHTML = '<div style="padding:10px 14px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:8px;font-size:12px;color:var(--yellow);">⏳ Читаю файл...</div>';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });

      // Ищем лист "Журнал фертигации" или берём первый
      const sheetName = wb.SheetNames.find(n => n.includes('Журнал') || n.includes('журнал')) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Ищем строку заголовка (содержит "Дата" и "Препарат")
      let headerRow = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const r = rows[i].map(c => String(c).toLowerCase());
        if (r.some(c => c.includes('дат')) && r.some(c => c.includes('препарат') || c.includes('удобрение'))) {
          headerRow = i;
          break;
        }
      }
      if (headerRow === -1) headerRow = 2; // по умолчанию строка 3 (index 2)

      const headers = rows[headerRow].map(h => String(h).toLowerCase().trim());

      // Определяем индексы колонок
      const colIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

      const cols = {
        date:    colIdx(['дат']),
        culture: colIdx(['культур']),
        block:   colIdx(['клетк', 'сорт', 'участ']),
        product: colIdx(['препарат', 'удобрени', 'наименован']),
        type:    colIdx(['тип']),
        normL:   colIdx(['л/га', 'норма л']),
        normKg:  colIdx(['кг/га', 'норма кг']),
        water:   colIdx(['вод', 'объём']),
        area:    colIdx(['площ', 'га']),
        total:   colIdx(['итого', 'кол-во']),
        note:    colIdx(['примечани']),
      };

      // Парсим данные начиная с строки после заголовка
      const parsed = [];
      for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(c => c === '' || c === null)) continue;

        const rawDate = String(row[cols.date] || '').trim();
        const product = String(row[cols.product] !== undefined ? row[cols.product] : '').trim();
        if (!rawDate || !product) continue;

        // Нормализуем дату
        let date = rawDate;
        // DD.MM.YYYY или DD/MM/YYYY → YYYY-MM-DD
        const dmyMatch = rawDate.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
        if (dmyMatch) date = `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`;
        // Excel serial number
        if (!isNaN(rawDate) && parseFloat(rawDate) > 40000) {
          const d = new Date((parseFloat(rawDate) - 25569) * 86400 * 1000);
          date = d.toISOString().split('T')[0];
        }
        if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

        const normL  = parseFloat(String(row[cols.normL]  || '').replace(',','.')) || null;
        const normKg = parseFloat(String(row[cols.normKg] || '').replace(',','.')) || null;
        const area   = parseFloat(String(row[cols.area]   || '').replace(',','.')) || null;
        const water  = parseFloat(String(row[cols.water]  || '').replace(',','.')) || null;
        const total  = area && (normL || normKg) ? Math.round((normL || normKg) * area * 1000) / 1000 : null;
        const unit   = normKg ? 'кг' : 'л';

        parsed.push({
          id: uid(),
          date,
          culture: String(row[cols.culture] || 'Черешня').trim(),
          block:   String(row[cols.block]   || 'Все').trim(),
          product,
          type:    String(row[cols.type]    || '').trim(),
          normL,
          normKg,
          norm:    normL || normKg || null,
          unit,
          water,
          area,
          total,
          note:    cols.note >= 0 ? String(row[cols.note] || '').trim() : '',
        });
      }

      if (!parsed.length) {
        statusEl.innerHTML = '<div style="padding:10px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ Данные не найдены. Проверьте формат файла — ожидается шаблон с колонками: Дата, Препарат, Норма л/га или кг/га.</div>';
        return;
      }

      // Сохраняем в S.irrigation.fertigation.history
      if (!S.irrigation.fertigation) S.irrigation.fertigation = { programs: [], waterQuality: [], history: [] };
      if (!S.irrigation.fertigation.history) S.irrigation.fertigation.history = [];

      // Дедупликация по дате + препарат
      const existing = new Set(S.irrigation.fertigation.history.map(h => `${h.date}_${h.product}`));
      let added = 0, skipped = 0;

      parsed.forEach(rec => {
        const key = `${rec.date}_${rec.product}`;
        if (existing.has(key)) { skipped++; return; }
        existing.add(key);
        S.irrigation.fertigation.history.unshift(rec);
        added++;

        // Автосписание со склада если есть площадь и норма
        if (rec.total && rec.total > 0) {
          if (!S.warehouse) S.warehouse = { chemicals: [], parts: [], seeds: [], history: [] };
          if (!S.warehouse.history) S.warehouse.history = [];
          // Ищем препарат на складе
          const stockItem = S.warehouse.chemicals?.find(c =>
            c.name.toLowerCase().includes(rec.product.toLowerCase().split(' ')[0].toLowerCase())
          );
          if (stockItem) {
            stockItem.qty = Math.round(Math.max(0, (stockItem.qty || 0) - rec.total) * 1000) / 1000;
          }
          S.warehouse.history.unshift({
            id: uid(),
            date: rec.date,
            type: 'chemical',
            name: rec.product,
            operation: 'out',
            qty: rec.total,
            unit: rec.unit,
            price: stockItem?.price || 0,
            total: Math.round(rec.total * (stockItem?.price || 0) * 100) / 100,
            parcelName: rec.block || 'Фертигация',
            note: `Фертигация ${rec.culture}${rec.area ? ' · ' + rec.area + 'га' : ''}${rec.note ? ' · ' + rec.note : ''}`,
          });
        }
      });

      // Сортируем по дате (новые сначала)
      S.irrigation.fertigation.history.sort((a, b) => b.date.localeCompare(a.date));
      save();

      // Показываем результат
      statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.3);border-radius:8px;font-size:12px;color:var(--accent);">
        ✅ Импортировано <strong>${added}</strong> записей${skipped ? ` · ${skipped} дублей пропущено` : ''}
        ${added > 0 && parsed[0]?.total ? ' · Остатки на складе обновлены' : ''}
      </div>`;

      // Обновляем таблицу истории
      renderFertigationHistory();
      renderFertigation();

    } catch (err) {
      statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ Ошибка: ${err.message}</div>`;
      console.error('[importFertigationFromExcel]', err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Таблица истории фертигации ────────────────────────────────────────────

function renderFertigationHistory() {
  const el = document.getElementById('fertigation-history-block');
  if (!el) return;

  const history = S.irrigation?.fertigation?.history || [];
  if (!history.length) {
    el.innerHTML = '';
    return;
  }

  // KPI строка
  const totalProducts = [...new Set(history.map(h => h.product))].length;
  const totalRecords  = history.length;
  const dateFrom = history[history.length - 1]?.date || '';
  const dateTo   = history[0]?.date || '';

  // Группируем по препарату для итогов
  const byProduct = {};
  history.forEach(h => {
    if (!byProduct[h.product]) byProduct[h.product] = { normL: 0, normKg: 0, count: 0, unit: h.unit };
    byProduct[h.product].count++;
    if (h.normL) byProduct[h.product].normL += h.normL;
    if (h.normKg) byProduct[h.product].normKg += h.normKg;
  });

  const TYPE_COLORS = {
    'Стимулятор': 'var(--blue)',
    'Гуминовый':  'var(--accent)',
    'Активатор':  '#a855f7',
    'Удобрение':  'var(--yellow)',
    'Фунгицид':   'var(--teal)',
  };

  el.innerHTML = `
    <div style="margin-bottom:12px;">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
        📋 ИСТОРИЯ ФЕРТИГАЦИИ · ${totalRecords} записей · ${totalProducts} препаратов · ${dateFrom} — ${dateTo}
      </div>

      <!-- Сводка по препаратам -->
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
        ${Object.entries(byProduct).map(([name, d]) => {
          const norm = d.normKg > 0 ? d.normKg.toFixed(2) + ' кг/га' : d.normL.toFixed(2) + ' л/га';
          const color = TYPE_COLORS[history.find(h => h.product === name)?.type] || 'var(--text3)';
          return `<div style="padding:8px 12px;background:var(--surface2);border-radius:10px;border-left:3px solid ${color};">
            <div style="font-size:12px;font-weight:600;">${name}</div>
            <div style="font-size:10px;color:var(--text3);">${d.count}× · Σ ${norm}</div>
          </div>`;
        }).join('')}
      </div>

      <!-- Таблица -->
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr>
            <th>Дата</th><th>Препарат</th><th>Тип</th>
            <th>Норма л/га</th><th>Норма кг/га</th><th>Площадь га</th><th>Итого</th><th>Примечание</th>
          </tr></thead>
          <tbody>
            ${history.slice(0, 50).map(h => {
              const color = TYPE_COLORS[h.type] || 'var(--text3)';
              return `<tr>
                <td style="font-family:'JetBrains Mono',monospace;font-size:11px;">${h.date}</td>
                <td style="font-weight:600;">${h.product}</td>
                <td><span style="padding:1px 8px;border-radius:8px;font-size:10px;background:${color}18;color:${color};">${h.type || '—'}</span></td>
                <td style="text-align:center;color:var(--blue);">${h.normL != null ? h.normL : '—'}</td>
                <td style="text-align:center;color:var(--orange);">${h.normKg != null ? h.normKg : '—'}</td>
                <td style="text-align:center;">${h.area != null ? h.area : '—'}</td>
                <td style="text-align:center;font-weight:600;color:var(--accent);">${h.total != null ? h.total + ' ' + h.unit : '—'}</td>
                <td style="font-size:11px;color:var(--text3);">${h.note || '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${history.length > 50 ? `<div style="font-size:11px;color:var(--text3);padding:8px;">Показано 50 из ${history.length} записей</div>` : ''}
    </div>`;
}
