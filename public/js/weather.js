// Smart Agro — weather.js
// ===================== WEATHER =====================
// Temperature thresholds
const TEMP = {
  beesMin: 10,       // Пчёлы летают выше +10
  heatStress: 32,    // Стресс от жары выше +32
  coldStress: 2,     // Стресс от холода ниже +2
  frost: 0,          // Заморозок
  prodMin: 5,        // Препараты работают плохо ниже +5
  prodMax: 30,       // Препараты работают плохо выше +30
};

function analyzeTemperature(tmin, tmax) {
  const t = { tmin: parseFloat(tmin)||null, tmax: parseFloat(tmax)||null };
  const avg = (t.tmin!==null && t.tmax!==null) ? (t.tmin+t.tmax)/2 : (t.tmin||t.tmax||null);
  const result = {
    bees: null, cherryStress: null, products: null,
    beesClass:'', cherryClass:'', productsClass:'',
  };
  if (avg === null) return result;

  // Bees
  if (t.tmax !== null && t.tmax >= TEMP.beesMin) {
    result.bees = `🐝 Летают (>${TEMP.beesMin}°C)`;
    result.beesClass = 'ok';
  } else {
    result.bees = `🐝 Не летают (<${TEMP.beesMin}°C)`;
    result.beesClass = 'bad';
  }

  // Cherry stress
  if (t.tmin !== null && t.tmin <= TEMP.frost) {
    result.cherryStress = `❄️ Заморозок! (${t.tmin}°C)`;
    result.cherryClass = 'bad';
  } else if (t.tmin !== null && t.tmin <= TEMP.coldStress) {
    result.cherryStress = `🥶 Холодовой стресс (${t.tmin}°C)`;
    result.cherryClass = 'warn';
  } else if (t.tmax !== null && t.tmax >= TEMP.heatStress) {
    result.cherryStress = `🔥 Тепловой стресс (${t.tmax}°C)`;
    result.cherryClass = 'warn';
  } else {
    result.cherryStress = `✅ Норма`;
    result.cherryClass = 'ok';
  }

  // Products
  if (avg < TEMP.prodMin) {
    result.products = `⚠️ Слабо работают (<${TEMP.prodMin}°C)`;
    result.productsClass = 'warn';
  } else if (avg > TEMP.prodMax) {
    result.products = `⚠️ Риск ожогов (>${TEMP.prodMax}°C)`;
    result.productsClass = 'warn';
  } else {
    result.products = `✅ Эффективны`;
    result.productsClass = 'ok';
  }
  return result;
}

function openWeatherAddModal(id) {
  S.editingWeatherId = id || null;
  const w = id ? S.weather.find(w=>w.id===id) : null;
  document.getElementById('weather-modal-title').textContent = w ? `✏️ Редактировать: ${w.date}` : '🌡️ Добавить день';
  document.getElementById('w-del-btn').style.display = w ? 'inline-flex' : 'none';
  document.getElementById('w-date').value = w?.date || new Date().toISOString().split('T')[0];
  document.getElementById('w-tmin').value = w?.tmin ?? '';
  document.getElementById('w-tmax').value = w?.tmax ?? '';
  document.getElementById('w-precip').value = w?.precip ?? '';
  document.getElementById('w-humidity').value = w?.humidity ?? '';
  document.getElementById('w-leafwet').value = w?.leafwet ?? '';
  document.getElementById('w-wind').value = w?.wind ?? '';
  document.getElementById('w-phase').value = w?.phase ?? '';
  document.getElementById('w-note').value = w?.note ?? '';
  document.getElementById('w-status-preview').style.display = 'none';
  openModal('modal-weather-add');
}

function previewWeatherStatus() {
  const tmin = document.getElementById('w-tmin').value;
  const tmax = document.getElementById('w-tmax').value;
  if (!tmin && !tmax) { document.getElementById('w-status-preview').style.display='none'; return; }
  const a = analyzeTemperature(tmin, tmax);
  const el = document.getElementById('w-status-preview');
  el.style.display = 'grid';
  el.style.gridTemplateColumns = '1fr 1fr 1fr';
  el.style.gap = '8px';
  el.innerHTML = [
    {icon:'🐝',label:'Пчёлы',val:a.bees,cls:a.beesClass},
    {icon: (() => { const ids=[...new Set(Object.values(S.cells).map(cd=>cd?.cropId||'crop_cherry'))]; return getCropById(ids[0])?.emoji||'🍒'; })(),
     label: (() => { const ids=[...new Set(Object.values(S.cells).map(cd=>cd?.cropId||'crop_cherry'))]; return getCropById(ids[0])?.name||'Черешня'; })(),
     val:a.cherryStress, cls:a.cherryClass},
    {icon:'💊',label:'Препараты',val:a.products,cls:a.productsClass},
  ].map(s=>`<div style="background:var(--surface2);border-radius:8px;padding:10px;border:1px solid var(--border);">
    <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;font-family:'Unbounded',sans-serif;">${s.label}</div>
    <div class="wstatus ${s.cls}" style="font-size:10px;">${s.val||'—'}</div>
  </div>`).join('');
}

function saveWeatherDay() {
  const date = document.getElementById('w-date').value;
  if (!date) { alert('Укажите дату'); return; }
  const entry = {
    id: S.editingWeatherId || ('w'+Date.now()),
    date,
    tmin: document.getElementById('w-tmin').value !== '' ? parseFloat(document.getElementById('w-tmin').value) : null,
    tmax: document.getElementById('w-tmax').value !== '' ? parseFloat(document.getElementById('w-tmax').value) : null,
    precip: parseFloat(document.getElementById('w-precip').value) || 0,
    humidity: parseFloat(document.getElementById('w-humidity').value) || null,
    leafwet: parseFloat(document.getElementById('w-leafwet').value) || 0,
    wind: parseFloat(document.getElementById('w-wind').value) || null,
    phase: document.getElementById('w-phase').value || null,
    note: document.getElementById('w-note').value,
  };
  if (S.editingWeatherId) {
    const i = S.weather.findIndex(w=>w.id===S.editingWeatherId);
    if (i>=0) S.weather[i]=entry; else S.weather.push(entry);
  } else {
    // Check for duplicate date
    const existing = S.weather.findIndex(w=>w.date===date);
    if (existing>=0) S.weather[existing]=entry; else S.weather.push(entry);
  }
  S.weather.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  save(); closeModal('modal-weather-add'); renderWeather();
}

function deleteWeatherDay() {
  if (!S.editingWeatherId) return;
  if (!confirm('Удалить запись?')) return;
  S.weather = S.weather.filter(w=>w.id!==S.editingWeatherId);
  save(); closeModal('modal-weather-add'); renderWeather();
}

function switchWeatherSub(sub) {
  const isWeather = sub === 'weather';
  // Sub-panels
  document.getElementById('wsub-panel-weather').style.display = isWeather ? '' : 'none';
  document.getElementById('wsub-panel-chill').style.display  = isWeather ? 'none' : '';
  // Кнопки действий в header
  document.getElementById('weather-panel-actions').style.display = isWeather ? 'flex' : 'none';
  document.getElementById('chill-panel-actions').style.display   = isWeather ? 'none' : 'flex';
  // Заголовок
  document.getElementById('weather-panel-title').textContent = isWeather ? '🌡️ Журнал погоды' : '❄️ Chill Portions — Зимний холод';
  // Вкладки — подсветка
  const wBtn = document.getElementById('wsub-weather');
  const cBtn = document.getElementById('wsub-chill');
  if(wBtn){ wBtn.style.color = isWeather ? 'var(--accent)' : 'var(--text3)'; wBtn.style.borderBottom = isWeather ? '2px solid var(--accent)' : '2px solid transparent'; wBtn.style.fontWeight = isWeather ? '700' : '400'; }
  if(cBtn){ cBtn.style.color = isWeather ? 'var(--text3)' : 'var(--blue)'; cBtn.style.borderBottom = isWeather ? '2px solid transparent' : '2px solid var(--blue)'; cBtn.style.fontWeight = isWeather ? '400' : '700'; }
  // Рендер данных
  if(!isWeather) renderChill();
}

// ═══ СТРЕСС-ДЕТЕКТОР ════════════════════════════════════════════════════

function calcVPD(tC, rhPct) {
  // VPD (кПа) = es - ea, где es = 0.6108 * exp(17.27*T/(T+237.3))
  const es = 0.6108 * Math.exp(17.27 * tC / (tC + 237.3));
  const ea = es * (rhPct / 100);
  return Math.round((es - ea) * 100) / 100;
}

function detectStress(weatherArr, forecast) {
  const alerts = [];
  if(!weatherArr || !weatherArr.length) return alerts;

  const w = weatherArr[0]; // последний день
  const tmax = parseFloat(w.tmax) || 0;
  const tmin = parseFloat(w.tmin) || 0;
  const tavg = (tmax + tmin) / 2;
  const rh   = parseFloat(w.humidity) || 60;
  const wind = parseFloat(w.wind) || 0;
  const precip = parseFloat(w.precip) || 0;

  // Текущая GDD фаза
  const gdd = getCurrentGdd(5);
  const firstVarId = S.varieties[0]?.id;
  const phase = firstVarId ? getPhaseByGdd(firstVarId, gdd) : null;
  const phaseName = phase?.name || '';
  const isFlowering = phaseName.toLowerCase().includes('цвет') || phaseName.toLowerCase().includes('flower');
  const isDormant   = phaseName.toLowerCase().includes('покой') || phaseName.toLowerCase().includes('dormant');

  // VPD
  const vpd = calcVPD(tavg, rh);

  // ── 1. Тепловой стресс ──────────────────────────────────────────────
  if(tmax >= 35) {
    alerts.push({
      level: tmax>=38 ? 'critical' : 'warning',
      icon: '🌡️',
      title: `Тепловой стресс — Tmax ${tmax}°C`,
      body: `Критическая жара. Избегать обработок. Полив ночью или рано утром. ${vpd>2.5?'Высокий VPD — усиленное испарение.':''}`,
      tags: ['Ирригация','Обработки'],
    });
  } else if(tmax >= 32) {
    alerts.push({
      level: 'watch',
      icon: '🔥',
      title: `Жара — Tmax ${tmax}°C`,
      body: `Обработки только до 9:00 или после 19:00. Контролировать влажность почвы.`,
      tags: ['Обработки'],
    });
  }

  // ── 2. VPD стресс ───────────────────────────────────────────────────
  if(vpd >= 2.5 && tmax >= 28) {
    alerts.push({
      level: vpd>=3.5 ? 'critical' : 'warning',
      icon: '💨',
      title: `Высокий VPD — ${vpd} кПа`,
      body: `Испарение значительно превышает поглощение воды корнями. Повышенная потребность в поливе. Стресс транспирации.`,
      tags: ['Ирригация','Стресс'],
    });
  }

  // ── 3. Заморозок ────────────────────────────────────────────────────
  if(tmin <= 0) {
    const isCritical = tmin <= -2 || isFlowering;
    alerts.push({
      level: isCritical ? 'critical' : 'warning',
      icon: '❄️',
      title: `Заморозок — Tmin ${tmin}°C${isFlowering?' (фаза цветения!)':''}`,
      body: isFlowering
        ? `⚠️ Критично! Цветки повреждаются при -0.5°C. Немедленно включить антизаморозку.`
        : `Риск повреждения почек/цветков. Проверить антизаморозку.`,
      tags: ['Антизаморозка', isFlowering ? '🚨 СРОЧНО' : ''],
    });
  } else if(tmin <= 2 && isFlowering) {
    alerts.push({
      level: 'warning',
      icon: '🌸❄️',
      title: `Риск заморозка в фазу цветения — Tmin ${tmin}°C`,
      body: `Цветение чувствительно к температуре ниже 0°C. Контролировать ночные температуры.`,
      tags: ['Антизаморозка'],
    });
  }

  // ── 4. Ветровой стресс / запрет обработок ───────────────────────────
  if(wind >= 20) {
    alerts.push({
      level: 'warning',
      icon: '🌬️',
      title: `Сильный ветер — ${wind} км/ч`,
      body: `Запрещено опрыскивание. Снос препарата более 30%. Риск ожогов.`,
      tags: ['Обработки'],
    });
  } else if(wind >= 12) {
    alerts.push({
      level: 'watch',
      icon: '💨',
      title: `Умеренный ветер — ${wind} км/ч`,
      body: `Опрыскивание только с антисносными насадками. Использовать ПАВ.`,
      tags: ['Обработки'],
    });
  }

  // ── 5. Риск болезней (температура + влажность) ──────────────────────
  // Монилиоз: T 15–24°C + влажность > 80% + осадки
  if(tavg>=15 && tavg<=24 && rh>=80 && precip>0 && !isDormant) {
    alerts.push({
      level: rh>=90 && precip>=5 ? 'critical' : 'warning',
      icon: '🍄',
      title: `Риск монилиоза — T${tavg.toFixed(0)}°C / RH${rh}%`,
      body: `Оптимальные условия для монилиоза. ${isFlowering?'Цветение — критическая фаза заражения!':''} Профилактическая обработка фунгицидом.`,
      tags: ['Обработки', isFlowering?'Монилиоз🚨':'Монилиоз'],
    });
  }

  // Коккомикоз вишни: T 16–22°C + влажность > 75%
  const hasSourCherry = Object.values(S.cells).some(cd=>cd?.cropId==='crop_sour_cherry');
  if(hasSourCherry && tavg>=16 && tavg<=22 && rh>=75 && !isDormant) {
    alerts.push({
      level: 'watch',
      icon: '🍒',
      title: `Риск коккомикоза — T${tavg.toFixed(0)}°C / RH${rh}%`,
      body: `Условия благоприятны для коккомикоза вишни. Контролировать листья, профилактика фунгицидом.`,
      tags: ['Обработки','Коккомикоз'],
    });
  }

  // ── 6. Водный стресс (из Water Balance) ─────────────────────────────
  const wbLog = S.irrigation?.waterBalance?.log || [];
  const lastWb = wbLog[wbLog.length-1];
  if(lastWb) {
    const sp = S.irrigation?.waterBalance?.soilParams || {};
    const fc=sp.fc||32, pwp=sp.pwp||14, root=sp.rootDepth||60;
    const taw = (fc-pwp)*root*0.1;
    const raw = taw*0.35;
    const pct = taw>0 ? lastWb.balance/taw*100 : 50;
    if(lastWb.balance <= 0) {
      alerts.push({
        level: 'critical',
        icon: '🏜️',
        title: 'Критический дефицит воды — баланс исчерпан',
        body: `Немедленный полив. Растения в состоянии завядания. Потери урожая неизбежны при задержке.`,
        tags: ['Ирригация','🚨 СРОЧНО'],
      });
    } else if(lastWb.balance < raw*0.4) {
      const et0 = parseFloat(S.weather[0]?.et0)||2.5;
      const daysLeft = Math.floor(lastWb.balance/Math.max(et0,0.1));
      alerts.push({
        level: 'warning',
        icon: '💧',
        title: `Водный стресс — ${pct.toFixed(0)}% TAW (${daysLeft} дн. до критики)`,
        body: `Запас доступной воды критически низкий. Полив необходим сегодня.`,
        tags: ['Ирригация'],
      });
    } else if(lastWb.balance < raw*0.7) {
      alerts.push({
        level: 'watch',
        icon: '💦',
        title: `Снижение влажности — ${pct.toFixed(0)}% TAW`,
        body: `Запланируйте полив в течение 1–2 дней.`,
        tags: ['Ирригация'],
      });
    }
  }

  // ── 7. Кальциевый дефицит (Молдова специфика) ───────────────────────
  // При жаре >30°C листья забирают кальций у плодов — риск потери плотности
  const isFruitGrowth = phaseName.includes('Завязь') || phaseName.includes('Налив') ||
    phaseName.includes('Рост') || phaseName.includes('Окрашив');
  if(tmax >= 30 && isFruitGrowth) {
    alerts.push({
      level: tmax >= 34 ? 'critical' : 'warning',
      icon: '🧪',
      title: `Риск Ca-дефицита — Tmax ${tmax}°C в фазу налива`,
      body: `При жаре листья перехватывают весь кальций, обделяя плоды. Ягода теряет плотность и растрескивается. Листовая подкормка CaCl₂ 0.3–0.5% или хелат Ca сегодня / завтра утром (до 9:00). Избегать N и K в этот период.`,
      tags: ['Ca-дефицит', 'Фертигация'],
    });
  }

  // ── 8. Управление плёнкой по BBCH фазе ──────────────────────────────
  // Проверяем укрытие — смотрим клетки (каждая может иметь своё)
  const cellsWithCover = Object.values(S.cells).filter(cd=>cd.cover && cd.cover!=='none');
  const hasCover = cellsWithCover.length > 0 ||
    S.settings?.orchardCover === 'film' || S.settings?.orchardCover === 'net' ||
    S.settings?.orchardCover === 'both';
  const hasFilm = cellsWithCover.some(cd=>cd.cover==='film'||cd.cover==='both') ||
    S.settings?.orchardCover === 'film' || S.settings?.orchardCover === 'both';
  if(hasFilm) {
    const coverStatus = (() => {
      if(phaseName.includes('Покой') || phaseName.includes('Набухание') || phaseName.includes('Бутон')) {
        return {action:'open', msg:'BBCH 01–57 — плёнка должна быть открыта. Деревья развиваются в естественных условиях, закалка кроны.', urgent:false};
      }
      if(isFlowering) {
        return {action:'open', msg:'BBCH 61–69 — цветение. Плёнку максимально открыть для свободного лёта пчёл. Закрывать только при дожде.', urgent:true};
      }
      if(phaseName.includes('Завязь') || phaseName.includes('Рост')) {
        return {action:'open', msg:'BBCH 71–81 — рост завязи. Плёнка открыта. Парниковый эффект вызовет сброс завязи и температурный стресс.', urgent:false};
      }
      if(phaseName.includes('Окрашив') || phaseName.includes('Созрев') || phaseName.includes('Налив')) {
        return {action:'close', msg:'BBCH 81–89 — начало окрашивания. Закрыть верхнюю крышу! Боковые пологи открыть для вентиляции.', urgent:true};
      }
      if(phaseName.includes('Уборка') || phaseName.includes('После')) {
        return {action:'open', msg:'После уборки — законсервировать плёнку. Максимум солнца для закладки почек следующего года.', urgent:false};
      }
      return null;
    })();
    if(coverStatus) {
      alerts.push({
        level: coverStatus.urgent ? 'warning' : 'watch',
        icon: coverStatus.action === 'close' ? '🎪' : '🌬️',
        title: `Плёнка: ${coverStatus.action === 'close' ? 'ЗАКРЫТЬ' : 'ОТКРЫТЬ'} — ${phaseName}`,
        body: coverStatus.msg,
        tags: ['Плёнка', 'BBCH'],
      });
      // Парниковый эффект под плёнкой
      if(coverStatus.action === 'close' && tmax >= 28) {
        alerts.push({
          level: tmax >= 32 ? 'critical' : 'warning',
          icon: '🌡️',
          title: `Парниковый эффект под плёнкой — реальная T° ~${tmax+4}°C`,
          body: `Под плёнкой температура на +3–5°C выше чем снаружи. При Tmax ${tmax}°C под плёнкой уже ${tmax+4}°C — порог стресса Регины. Открыть боковые пологи для сквозного проветривания.`,
          tags: ['Плёнка', 'Перегрев'],
        });
      }
    }
  }

  // ── 9. Опыление + суховей ────────────────────────────────────────────
  // RH < 40% в фазу цветения → рыльце пестика пересыхает
  if(isFlowering) {
    if(rh < 40) {
      alerts.push({
        level: rh < 30 ? 'critical' : 'warning',
        icon: '🐝',
        title: `Суховей в цветение — RH ${rh}% (норма >60%)`,
        body: `При влажности ниже 40% рыльце пестика Регины высыхает за несколько часов. Пыльца опылителей (Kordia, Karina) не прорастает → массовое бесплодие. Утреннее мелкодисперсное дождевание кроны (6:00–9:00). Пчёлы активны утром и вечером.`,
        tags: ['Опыление', '🚨 СРОЧНО'],
      });
    }
    if(wind >= 12 && rh < 55) {
      alerts.push({
        level: 'warning',
        icon: '🐝',
        title: `Ветер ${wind} км/ч + сухо (RH ${rh}%) в цветение`,
        body: `Ветер сносит пыльцу, сухой воздух ухудшает опыление. Норма пчёл: мин. 3–4 семьи/га. Опыление идёт в 6:00–10:00 и 17:00–20:00 когда ветер стихает.`,
        tags: ['Опыление'],
      });
    }
  }

  // ── 10. Мучнистая роса под плёнкой ──────────────────────────────────
  // Под плёнкой нет смывания дождём → порог ниже чем в открытом поле
  const isCoverClosed = hasFilm && (
    phaseName.includes('Окрашив') || phaseName.includes('Созрев') || phaseName.includes('Налив')
  );
  if(isCoverClosed && tavg >= 18 && rh >= 65 && !isDormant) {
    alerts.push({
      level: rh >= 80 ? 'warning' : 'watch',
      icon: '🍄',
      title: `Риск мучнистой росы под плёнкой — T${tavg.toFixed(0)}°C / RH${rh}%`,
      body: `Под укрытием отсутствует смывание дождём. Споры накапливаются. Регина: устойчивость 3.5/5. Профилактика: сера, флуопирам (Топаз) каждые 7–10 дней. Формировка — прозрачная крона без застоя воздуха.`,
      tags: ['Мучнистая роса', 'Под плёнкой'],
    });
  }

  // ── 11. Кордия — плёнку закрывать раньше чем для Регины ─────────────
  const hasKordia = S.varieties.some(v=>v.id==='v2'&&(v.name.includes('Кордия')||v.name.includes('Kordia')));
  const hasFilmKordia = hasFilm && hasKordia;
  if(hasFilmKordia) {
    // Кордия созревает на 7-10 дней раньше Регины → BBCH 81 наступает раньше
    const gddKordia = getCurrentGdd(4.5);
    const phaseKordia = getPhaseByGdd('v2', gddKordia);
    // Предупреждение когда Кордия входит в фазу роста завязи (скоро начало окрашивания)
    if(phaseKordia?.name?.includes('Завязь') || phaseKordia?.name?.includes('Рост')) {
      const phaseRegina = getPhaseByGdd('v1', gddKordia);
      if(phaseRegina && !phaseRegina.name.includes('Окрашив')) {
        alerts.push({
          level: 'warning',
          icon: '🎪',
          title: 'Кордия созревает раньше Регины — готовьте плёнку',
          body: 'Кордия (S3S6) войдёт в фазу окрашивания на 7–10 дней раньше Регины. Закройте плёнку над рядами Кордии как только ягода начнёт окрашиваться. Кордия растрескивается при дожде значительно сильнее Регины (3/5 vs 5/5).',
          tags: ['Кордия', 'Плёнка'],
        });
      }
    }
  }

  // ── 12. Скина — риск перегрузки урожаем ─────────────────────────────
  const hasSkeena = S.varieties.some(v=>v.id==='v4'&&(v.name.includes('Скина')||v.name.includes('Skeena')));
  if(hasSkeena) {
    const phSkeena = getPhaseByGdd('v4', getCurrentGdd(4.5));
    // В фазу активного роста завязи — предупреждение о нормировке
    if(phSkeena?.name?.includes('Завязь') || phSkeena?.name?.includes('Рост')) {
      alerts.push({
        level: 'watch',
        icon: '🍒',
        title: 'Скина — контроль нагрузки урожаем',
        body: 'Скина самоплодная — под плёнкой завязываемость ~100%. Избыток завязи снижает калибр с 32 до 26 мм. Проверьте нагрузку на ветвь. При необходимости — ручное прореживание или регулировка фертигации N/K для налива.',
        tags: ['Скина', 'Нормировка'],
      });
    }
  }

  // ── 13. Анализ воды — риск засоления и pH ────────────────────────────
  const waterAn = [...(S.analyses||[])].filter(a=>a.type==='water').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  if(waterAn) {
    const wNa  = parseFloat(waterAn.Na||waterAn.na||0);
    const wPh  = parseFloat(waterAn.pH||waterAn.ph||0);
    const wEc  = parseFloat(waterAn.EC||waterAn.ec||0);
    const wFe  = parseFloat(waterAn.Fe||waterAn.fe||0);
    const wMg  = parseFloat(waterAn.Mg||waterAn.mg||0);
    const wSar = parseFloat(waterAn.SAR||waterAn.sar||0);

    // Высокий Na — риск засоления почвы
    if(wNa > 100) {
      alerts.push({
        level: 'critical',
        icon: '🧂',
        title: `Высокий Na в воде — ${wNa} мг/л (норма <50)`,
        body: `Риск засоления почвы при капельном поливе. Gisela 5 особенно чувствителен. SAR=${wSar.toFixed(1)} — структура чернозема деградирует. Меры: гипсование 1–2 т/га, промывной полив после сезона, мониторинг EC почвы.`,
        tags: ['Вода', 'Засоление', 'Na'],
      });
    } else if(wNa > 50) {
      alerts.push({
        level: 'warning',
        icon: '🧂',
        title: `Na в воде повышен — ${wNa} мг/л (норма <50)`,
        body: `Умеренный риск засоления. Контролировать EC почвенного раствора ежемесячно. SAR=${wSar.toFixed(1)}.`,
        tags: ['Вода', 'Na'],
      });
    }

    // pH воды — блокировка микроэлементов
    if(wPh > 7.5) {
      alerts.push({
        level: wPh > 8.0 ? 'warning' : 'watch',
        icon: '⚗️',
        title: `pH воды ${wPh} — блокировка Fe, Mn, Zn, B`,
        body: `При pH >7.5 в зоне корней Gisela 5 блокируется усвоение Fe, Mn, Zn, B. Подкисление ортофосфорной кислотой H₃PO₄ до pH 6.5–7.0 перед подачей в систему. Доза ~0.8–1.2 мл/л воды. Бонус: P из кислоты ~5–8 ppm — учесть в программе фертигации.`,
        tags: ['Вода', 'pH', 'Подкисление'],
      });
    }

    // Высокий EC воды
    if(wEc > 1.0) {
      alerts.push({
        level: wEc > 1.5 ? 'warning' : 'watch',
        icon: '⚡',
        title: `EC воды ${wEc} mS/cm — ограниченный запас для удобрений`,
        body: `Исходный EC воды уже ${wEc} mS/cm. При добавлении удобрений суммарный EC не должен превышать 2.5 mS/cm для черешни (Gisela 5). Максимальный EC от удобрений: ${(2.5-wEc).toFixed(1)} mS/cm.`,
        tags: ['Вода', 'EC', 'Фертигация'],
      });
    }

    // Высокий Fe — риск засорения капельниц
    if(wFe > 0.3) {
      alerts.push({
        level: 'watch',
        icon: '🔧',
        title: `Fe в воде ${wFe} мг/л — риск засорения капельниц`,
        body: `При pH >7 железо осаждается в форме гидроксида Fe(OH)₃ и засоряет эмиттеры. Промывать систему кислотным раствором (H₃PO₄ 0.1%) раз в 2–4 недели. Дисковые фильтры обязательны.`,
        tags: ['Вода', 'Fe', 'Капельницы'],
      });
    }

    // Высокий Mg — не вносить сульфат магния
    if(wMg > 20) {
      alerts.push({
        level: 'watch',
        icon: '🧪',
        title: `Mg в воде ${wMg} мг/л — сульфат магния не вносить`,
        body: `Вода уже содержит ${wMg} мг/л Mg — норма для черешни. Сульфат магния в программе фертигации исключить или минимизировать чтобы не создавать антагонизм с Ca и K.`,
        tags: ['Вода', 'Mg', 'Фертигация'],
      });
    }
  }

  // ── 14. Анализ прогноза (следующие 3 дня) ────────────────────────────
  if(forecast && forecast.length) {
    const next3 = forecast.slice(0,3);
    const frostDay = next3.find(d=>parseFloat(d.tmin)<=0);
    const heatDay  = next3.find(d=>parseFloat(d.tmax)>=35);
    const rainDay  = next3.find(d=>parseFloat(d.precip||d.precipSum||0)>=10);

    if(frostDay && !tmin<=0) { // не предупреждали уже
      alerts.push({
        level: 'warning',
        icon: '❄️',
        title: `Прогноз: заморозок ${frostDay.date}`,
        body: `Ожидается Tmin ${frostDay.tmin}°C. Подготовьте антизаморозку.`,
        tags: ['Прогноз','Антизаморозка'],
      });
    }
    if(heatDay && tmax<35) {
      alerts.push({
        level: 'watch',
        icon: '🌡️',
        title: `Прогноз: жара ${heatDay.date}`,
        body: `Ожидается Tmax ${heatDay.tmax}°C. Спланируйте усиленный полив заранее.`,
        tags: ['Прогноз','Ирригация'],
      });
    }
    if(rainDay) {
      const activeTr = S.treatments.filter(t=>{
        const ed=new Date(t.endDate||'2000-01-01');
        return ed>=new Date();
      });
      if(activeTr.length) {
        alerts.push({
          level: 'watch',
          icon: '🌧️',
          title: `Прогноз: дождь ${rainDay.date} — проверить смыв препаратов`,
          body: `Ожидается ${rainDay.precip||rainDay.precipSum}мм. Активных обработок: ${activeTr.length}. Проверить порог смыва.`,
          tags: ['Прогноз','Обработки'],
        });
      }
    }
  }

  return alerts;
}

function renderStressAlerts(forecast) {
  const el = document.getElementById('stress-alerts-banner');
  if(!el) return;
  const alerts = detectStress(S.weather, forecast);
  if(!alerts.length) {
    el.innerHTML = `<div style="padding:10px 16px;background:rgba(74,222,128,.06);border:1px solid rgba(74,222,128,.2);border-radius:10px;font-size:12px;color:var(--accent);display:flex;align-items:center;gap:8px;">
      <span style="font-size:16px;">✅</span>
      <span><strong>Стресс-факторов не выявлено</strong> — условия благоприятные для всех культур</span>
      <span style="margin-left:auto;font-size:10px;color:var(--text3);">${S.weather[0]?.date||''}</span>
    </div>`;
    return;
  }

  const LEVEL = {
    critical: { bg:'rgba(239,68,68,.08)', border:'rgba(239,68,68,.3)', color:'var(--red)' },
    warning:  { bg:'rgba(251,146,60,.08)', border:'rgba(251,146,60,.3)', color:'var(--orange)' },
    watch:    { bg:'rgba(251,191,36,.06)', border:'rgba(251,191,36,.25)', color:'var(--yellow)' },
  };

  // Сортируем: critical → warning → watch
  const sorted = [...alerts].sort((a,b)=>
    ['critical','warning','watch'].indexOf(a.level) - ['critical','warning','watch'].indexOf(b.level)
  );

  el.innerHTML = sorted.map(a => {
    const s = LEVEL[a.level] || LEVEL.watch;
    const tags = a.tags.filter(Boolean).map(t=>
      `<span style="padding:1px 7px;border-radius:8px;font-size:10px;background:${s.color}22;color:${s.color};font-weight:600;">${t}</span>`
    ).join('');
    return `<div style="padding:12px 16px;background:${s.bg};border:1px solid ${s.border};border-radius:10px;margin-bottom:6px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:18px;line-height:1;">${a.icon}</span>
        <strong style="font-size:13px;color:${s.color};">${a.title}</strong>
        <div style="margin-left:auto;display:flex;gap:4px;">${tags}</div>
      </div>
      <div style="font-size:11px;color:var(--text2);line-height:1.5;padding-left:26px;">${a.body}</div>
    </div>`;
  }).join('');
}

// ===================== ПРОГНОЗ ПОГОДЫ (Open-Meteo) =====================

const CHERRY_LAT = 47.9342;
const CHERRY_LON = 28.4167;

const FORECAST_ICONS = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',
  45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌦️',55:'🌧️',
  61:'🌧️',63:'🌧️',65:'🌧️',
  71:'🌨️',73:'🌨️',75:'🌨️',
  80:'🌦️',81:'🌧️',82:'⛈️',
  95:'⛈️',96:'⛈️',99:'⛈️'
};

const FORECAST_DESC = {
  0:'Ясно',1:'Преим. ясно',2:'Переменная',3:'Пасмурно',
  45:'Туман',48:'Туман',
  51:'Морось',53:'Морось',55:'Морось',
  61:'Дождь',63:'Дождь',65:'Сильный дождь',
  71:'Снег',73:'Снег',75:'Сильный снег',
  80:'Ливень',81:'Ливень',82:'Сильный ливень',
  95:'Гроза',96:'Гроза с градом',99:'Сильная гроза'
};

async function loadCherryForecast() {
  const grid = document.getElementById('cherry-forecast-grid');
  const recs = document.getElementById('cherry-forecast-recs');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);font-size:12px;padding:20px;">⏳ Загрузка...</div>';

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CHERRY_LAT}&longitude=${CHERRY_LON}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,` +
      `weathercode,windspeed_10m_max,precipitation_hours,et0_fao_evapotranspiration,` +
      `windgusts_10m_max,shortwave_radiation_sum` +
      `&timezone=Europe%2FChisinau&forecast_days=14`;
    const _ctrl = new AbortController();
    const _timer = setTimeout(() => _ctrl.abort(), 8000);
    const r = await fetch(url, { signal: _ctrl.signal });
    clearTimeout(_timer);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const f = data.daily;

    const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    grid.innerHTML = f.time.map((date, i) => {
      const tmax = f.temperature_2m_max[i];
      const tmin = f.temperature_2m_min[i];
      const precip = f.precipitation_sum[i] || 0;
      const precipProb = f.precipitation_probability_max[i] || 0;
      const wcode = f.weathercode[i] || 0;
      const wind = f.windspeed_10m_max[i] || 0;
      const precipHours = f.precipitation_hours[i] || 0;
      const et0 = f.et0_fao_evapotranspiration?.[i] || 0;
      const rhMin = 50; const vpd = 0;

      const d = new Date(date);
      const dayName = i===0 ? 'Сегодня' : i===1 ? 'Завтра' : days[d.getDay()];
      const dayNum = d.getDate() + '.' + String(d.getMonth()+1).padStart(2,'0');

      const isFrost = tmin <= 0;
      const isHeat = tmax >= 32;
      const isRain = precip > 5 || precipProb > 60;
      const isDry = false;
      const isSprayOk = precip < 2 && precipProb < 40 && wind < 15 && !isFrost && tmax >= 8 && tmax <= 30;

      let borderColor = 'var(--border)';
      if (isFrost) borderColor = '#4fc3f7';
      else if (isRain) borderColor = 'var(--blue)';
      else if (isHeat) borderColor = 'var(--orange)';
      else if (isDry) borderColor = 'var(--yellow)';
      else if (isSprayOk) borderColor = 'var(--accent)';

      // Kc текущей фазы
      const gdd = getCurrentGdd(4.5);
      const phase = getPhaseByGdd(S.varieties[0]?.id, gdd);
      const kc = phase?.kc || 1.0;
      const etc = et0 > 0 ? (et0 * kc).toFixed(1) : null;

      return `<div style="background:var(--surface2);border:1px solid ${borderColor};border-radius:10px;padding:10px 6px;text-align:center;position:relative;min-width:0;">
        ${i===0?'<div style="position:absolute;top:-1px;left:50%;transform:translateX(-50%);background:var(--accent);color:#000;font-size:8px;font-family:\'Unbounded\',sans-serif;padding:1px 6px;border-radius:0 0 6px 6px;">СЕГОДНЯ</div>':''}
        ${i===7?'<div style="position:absolute;top:-1px;left:50%;transform:translateX(-50%);background:var(--blue);color:#fff;font-size:8px;padding:1px 6px;border-radius:0 0 6px 6px;">+7</div>':''}
        <div style="font-size:9px;color:var(--text3);font-family:'Unbounded',sans-serif;margin-bottom:2px;margin-top:${i===0?'8px':'0'}">${dayName}</div>
        <div style="font-size:9px;color:var(--text3);margin-bottom:4px;">${dayNum}</div>
        <div style="font-size:20px;margin-bottom:4px;">${FORECAST_ICONS[wcode]||'🌡️'}</div>
        <div style="font-size:12px;font-weight:700;color:var(--text);">${Math.round(tmax)}°</div>
        <div style="font-size:10px;color:var(--text3);">${Math.round(tmin)}°</div>
        ${precip>0.1?`<div style="font-size:9px;color:var(--blue);margin-top:3px;">💧${precip.toFixed(1)}мм</div>`:''}
        ${precipProb>20?`<div style="font-size:9px;color:var(--text3);">${precipProb}%</div>`:''}
        ${etc?`<div style="font-size:9px;color:var(--orange);margin-top:2px;">ET${etc}мм</div>`:''}
        ${isSprayOk?'<div style="font-size:9px;color:var(--accent);margin-top:3px;">✅ Обр.</div>':''}
        ${isFrost?'<div style="font-size:9px;color:#4fc3f7;margin-top:3px;">❄️ Мороз</div>':''}
        ${isDry?'<div style="font-size:9px;color:var(--yellow);margin-top:2px;">🌵 Сухо</div>':''}
      </div>`;
    }).join('');

    // Генерировать рекомендации агронома
    renderCherryForecastRecs(f);

    // Обновляем стресс-детектор с данными прогноза
    renderStressAlerts(f);

  } catch(e) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text3);font-size:12px;padding:20px;">❌ Не удалось загрузить прогноз: ${e.message}</div>`;
  }
}

function renderCherryForecastRecs(f) {
  const el = document.getElementById('cherry-forecast-recs');
  if (!el) return;
  const alerts = [];

  const gdd = getCurrentGdd(4.5);
  const phase = getPhaseByGdd(S.varieties[0]?.id, gdd);
  const phaseName = phase?.name || '';
  const kc = phase?.kc || 1.0;

  const sprayWindows = [];
  f.time.forEach((date, i) => {
    const tmax = f.temperature_2m_max[i];
    const tmin = f.temperature_2m_min[i];
    const precip = f.precipitation_sum[i] || 0;
    const precipProb = f.precipitation_probability_max[i] || 0;
    const wind = f.windspeed_10m_max[i] || 0;
    const precipHours = f.precipitation_hours[i] || 0;
    const et0 = f.et0_fao_evapotranspiration?.[i] || 0;
    const rhMin = 50;
    const vpd = f.vapor_pressure_deficit_max?.[i] || 0;
    const d = new Date(date);
    const dayStr = d.getDate() + '.' + String(d.getMonth()+1).padStart(2,'0');
    const etc = (et0 * kc).toFixed(1);

    if (tmin <= 0) alerts.push({type:'danger',icon:'❄️',
      text:`<b>${dayStr}</b> — Заморозок T°мин ${Math.round(tmin)}°C. Риск повреждения${phaseName.includes('Цвет')?' цветков':phaseName.includes('Завязь')?' завязей':' плодов'} черешни!`});
    if (tmin <= -2 && phaseName.includes('Цвет')) alerts.push({type:'danger',icon:'🚨',
      text:`<b>${dayStr}</b> — КРИТИЧНО: ${Math.round(tmin)}°C в цветение. 100% гибель цветков. Антизаморозковое дождевание!`});
    if (precip >= 3 && tmax >= 10 && precipHours >= 4) alerts.push({type:'warn',icon:'🍄',
      text:`<b>${dayStr}</b> — Дождь ${precip.toFixed(1)}мм · ${precipHours}ч. Риск монилиоза. Хорус или Свитч ДО дождя.`});
    if (precipHours >= 6 && tmax >= 15) alerts.push({type:'warn',icon:'🍂',
      text:`<b>${dayStr}</b> — ${precipHours}ч дождя при ${Math.round(tmax)}°C. Риск коккомикоза. Луна Сенсейшн после дождя.`});
    if (rhMin < 40 && vpd > 2.5 && phaseName.includes('Цвет')) alerts.push({type:'warn',icon:'🌵',
      text:`<b>${dayStr}</b> — Суховей: RH мин ${rhMin}% · VPD ${vpd.toFixed(1)} кПа. Дождевание кроны 6:00–9:00.`});
    if (tmax >= 35) alerts.push({type:'warn',icon:'🌡️',
      text:`<b>${dayStr}</b> — Жара ${Math.round(tmax)}°C. ETc ${etc}мм/день. Обработки только до 9:00 или после 19:00.`});
    if (precip < 1 && precipProb < 30 && wind < 12 && tmax >= 10 && tmax <= 28 && i <= 6) sprayWindows.push(dayStr);
  });

  const et7 = f.et0_fao_evapotranspiration?.slice(0,7).reduce((s,v)=>s+(v||0),0) || 0;
  const etc7 = (et7 * kc).toFixed(1);
  const rain7 = f.precipitation_sum.slice(0,7).reduce((s,v)=>s+(v||0),0).toFixed(1);
  alerts.unshift({type:'info',icon:'📊',
    text:`Прогноз 7 дней: ETc <b>${etc7}мм</b> · Осадки <b>${rain7}мм</b> · Баланс: <b>${(parseFloat(rain7)-parseFloat(etc7)).toFixed(1)}мм</b>. Фаза: <b>${phaseName}</b>, Kc ${kc}`});

  if (sprayWindows.length) alerts.push({type:'good',icon:'✅',
    text:`Оптимальные окна для опрыскивания: <b>${sprayWindows.slice(0,5).join(', ')}</b>. Без дождя, ветер <12км/ч, T 10–28°C.`});

  // Авто-рекомендации по анализу листа
  const lastLeaf = [...(S.analyses||[])].filter(a=>a.type==='leaf').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  const waterAn = [...(S.analyses||[])].filter(a=>a.type==='water').filter(a=>a.date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  const wCa = parseFloat(waterAn?.Ca||waterAn?.ca||0);
  const wMg = parseFloat(waterAn?.Mg||waterAn?.mg||0);
  const wPh = parseFloat(waterAn?.pH||waterAn?.ph||0);
  const nextSpray = sprayWindows[0] || 'нет окна в 7 дней';

  if (lastLeaf) {
    const leafDate = lastLeaf.date;
    const checks = [
      {el:'N', found:parseFloat(lastLeaf.N||lastLeaf.n), min:2.4, max:3.0, unit:'%',
        low:`Дефицит N (<2.4%). Ca(NO₃)₂ 84ppm через капельницу 8 нед. от опадания лепестков. Листовая: мочевина 0.5% ранним утром. Окно: <b>${nextSpray}</b>`,
        high:`Избыток N (>3.0%). Прекратить N-удобрения! Риск мельчания плода (Neilsen 2007).`},
      {el:'P', found:parseFloat(lastLeaf.P||lastLeaf.p), min:0.14, max:0.25, unit:'%',
        low:`Дефицит P (<0.14%). MAP 20г/дерево при цветении. Листовая: МКФ 0.3% 2–3 обработки. Окно: <b>${nextSpray}</b>`,
        high:`Избыток P. Снизить дозы фосфора.`},
      {el:'K', found:parseFloat(lastLeaf.K||lastLeaf.k), min:1.5, max:2.5, unit:'%',
        low:`Дефицит K (<1.5%). Нитрат калия 20г/дерево в июне. Листовая: KNO₃ 0.5–1%. Критично для Brix! Окно: <b>${nextSpray}</b>`,
        high:`Избыток K — антагонизм с Ca и Mg. Снизить K, добавить Ca.`},
      {el:'Ca', found:parseFloat(lastLeaf.Ca||lastLeaf.ca), min:1.0, max:2.0, unit:'%',
        low:`Дефицит Ca (<1.0%). Хелат Ca 3–5 кг/га каждые 7–10 дней. При жаре: CaCl₂ 0.3% листовая. Вода: ${wCa}ppm Ca уже есть.`,
        high:`Ca в норме.`},
      {el:'Mg', found:parseFloat(lastLeaf.Mg||lastLeaf.mg), min:0.25, max:0.5, unit:'%',
        low:`Дефицит Mg (<0.25%). Листовая: MgSO₄ 1–2% 2–3 обработки. Вода даёт ${wMg}мг/л — учесть! Окно: <b>${nextSpray}</b>`,
        high:`Высокий Mg — не вносить MgSO₄! Вода уже ${wMg}мг/л.`},
      {el:'Fe', found:parseFloat(lastLeaf.Fe||lastLeaf.fe), min:60, max:200, unit:'ppm',
        low:`Дефицит Fe (<60ppm). pH воды ${wPh} >7.5 блокирует Fe. Хелат Fe-DTPA 0.5–1кг/1000л капельно. Листовая: Fe-EDTA 0.1–0.2%.`,
        high:`Fe в норме.`},
      {el:'B', found:parseFloat(lastLeaf.B||lastLeaf.b), min:25, max:60, unit:'ppm',
        low:`Дефицит B (<25ppm). Борная кислота 0.15–0.2% ДО цветения и после. НЕ в цветение! Окно: <b>${nextSpray}</b>`,
        high:`Избыток B — токсичен! Прекратить бор.`},
    ];

    const leafIssues = checks.filter(c => !isNaN(c.found) && c.found > 0 && (c.found < c.min || c.found > c.max));
    if (leafIssues.length) {
      alerts.push({type:'leaf',icon:'🍃',text:`<b>Анализ листа (${leafDate}) — требует действий по ${leafIssues.length} элементам:</b>`});
      leafIssues.forEach(c => {
        const isLow = c.found < c.min;
        alerts.push({
          type: isLow ? (c.found < c.min*0.7 ? 'danger':'warn') : 'excess',
          icon: isLow ? '📉':'📈',
          text: `<b>${c.el} = ${c.found}${c.unit}</b> (норма ${c.min}–${c.max}): ` + (isLow ? c.low : c.high),
        });
      });
    } else {
      alerts.push({type:'good',icon:'🍃',text:`Анализ листа (${leafDate}) — все показатели в норме по Neilsen et al. (CAB 2017).`});
    }
  } else {
    alerts.push({type:'info',icon:'🍃',text:'Анализ листа не найден. Добавьте анализ в блоке 🔬 Анализы для авто-рекомендаций.'});
  }

  el.innerHTML = `
    <div style="font-family:'Unbounded',sans-serif;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🌿 Рекомендации агронома</div>
    ${alerts.map(a=>`
      <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 12px;margin-bottom:5px;border-radius:8px;font-size:11px;line-height:1.5;
        background:${a.type==='danger'?'rgba(226,75,74,.08)':a.type==='warn'?'rgba(251,146,60,.08)':a.type==='good'?'rgba(74,222,128,.08)':a.type==='leaf'?'rgba(96,165,250,.06)':a.type==='excess'?'rgba(234,179,8,.08)':'rgba(96,165,250,.05)'};
        border-left:3px solid ${a.type==='danger'?'var(--red)':a.type==='warn'?'var(--orange)':a.type==='good'?'var(--accent)':a.type==='leaf'?'var(--blue)':a.type==='excess'?'var(--yellow)':'var(--blue)'};">
        <span style="font-size:14px;flex-shrink:0;">${a.icon}</span>
        <span>${a.text}</span>
      </div>`).join('')}`;
}


// ═══ ПРОГНОЗ ПОГОДЫ (FieldClimate / Open-Meteo fallback) ════════════════
let _forecast = null;      // кэш [{date,tmax,tmin,precip,humidity,wind,et0}]
let _forecastSource = '';

async function fetchForecast() {
  try {
    const token = sessionStorage.getItem('agro_token') || sessionStorage.getItem('agro_jwt') || '';
    const r = await fetch('/api/weather/forecast', {
      headers: { 'Authorization': 'Bearer ' + token },
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })(),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (data.ok && data.forecast?.length) {
      _forecast = data.forecast;
      _forecastSource = data.source || 'fieldclimate';
      console.log('[Forecast] Loaded from', _forecastSource, data.forecast.length, 'days');
      return _forecast;
    }
    throw new Error('Empty');
  } catch(e) {
    console.warn('[Forecast] Server failed, trying Open-Meteo directly:', e.message);
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=47.7321801&longitude=28.5216181' +
        '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,' +
        'relativehumidity_2m_max,et0_fao_evapotranspiration' +
        '&timezone=Europe%2FChisinau&forecast_days=7';
      const om = await fetch(url, { signal: (() => { const c=new AbortController(); setTimeout(()=>c.abort(),6000); return c.signal; })() });
      const d  = await om.json();
      _forecast = (d.daily?.time || []).map((date, i) => ({
        date,
        tmax:     d.daily.temperature_2m_max?.[i]         ?? null,
        tmin:     d.daily.temperature_2m_min?.[i]         ?? null,
        precip:   d.daily.precipitation_sum?.[i]          ?? 0,
        wind:     d.daily.windspeed_10m_max?.[i]          ?? null,
        humidity: d.daily.relativehumidity_2m_max?.[i]    ?? null,
        et0:      d.daily.et0_fao_evapotranspiration?.[i] ?? null,
      }));
      _forecastSource = 'open-meteo';
      return _forecast;
    } catch(e2) {
      console.warn('[Forecast] Both failed:', e2.message);
      return null;
    }
  }
}

// WMO weather codes → иконка + описание
function wmoIcon(code) {
  if (code === 0) return { icon:'☀️', label:'Ясно' };
  if (code <= 2) return { icon:'🌤️', label:'Малооблачно' };
  if (code === 3) return { icon:'☁️', label:'Пасмурно' };
  if (code <= 49) return { icon:'🌫️', label:'Туман' };
  if (code <= 57) return { icon:'🌧️', label:'Морось' };
  if (code <= 67) return { icon:'🌧️', label:'Дождь' };
  if (code <= 77) return { icon:'❄️', label:'Снег' };
  if (code <= 82) return { icon:'🌦️', label:'Ливень' };
  if (code <= 99) return { icon:'⛈️', label:'Гроза' };
  return { icon:'🌡️', label:'—' };
}

function renderForecastStrip() {
  const el = document.getElementById('forecast-strip');
  if (!el) return;

  if (!_forecast || !_forecast.length) {
    el.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
      background:var(--surface);border:1px solid var(--border);border-radius:10px;
      font-size:11px;color:var(--text3);">
      <span>🌡️</span>
      <span>Загрузка прогноза погоды...</span>
      <button class="btn btn-secondary btn-sm" onclick="loadForecastAndRender()">🔄 Загрузить</button>
    </div>`;
    return;
  }

  const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

  // Окно опрыскивания
  const sprayWindow = _forecast.filter(d =>
    (d.precip||0) < 1 && (d.wind||0) < 20 && (d.tmax||0) > 8 && (d.tmax||0) < 30
  ).map(d => d.date);

  // Smith Period (риск болезней)
  const smithForecast = _forecast.filter(d => (d.tmin||0) >= 10 && (d.humidity||0) >= 80).map(d => d.date);

  // Заморозки
  const frostDays = _forecast.filter(d => (d.tmin||0) <= 2).map(d => d.date);

  // Иконка по температуре + осадкам (замена WMO кода)
  function forecastIcon(d) {
    if ((d.precip||0) >= 5)  return { icon:'🌧️', label:'Дождь' };
    if ((d.precip||0) >= 1)  return { icon:'🌦️', label:'Ливень' };
    if ((d.tmin||0) <= 0)    return { icon:'🌨️', label:'Снег/мороз' };
    if ((d.humidity||0) >= 85) return { icon:'🌫️', label:'Туман' };
    if ((d.tmax||0) >= 28)   return { icon:'☀️', label:'Жарко' };
    if ((d.humidity||0) >= 70) return { icon:'🌤️', label:'Облачно' };
    return { icon:'☀️', label:'Ясно' };
  }

  const sourceLabel = _forecastSource === 'fieldclimate'
    ? '<span style="font-size:9px;padding:1px 7px;border-radius:8px;background:rgba(107,221,107,.12);color:var(--accent);">📡 FieldClimate</span>'
    : '<span style="font-size:9px;padding:1px 7px;border-radius:8px;background:rgba(96,165,250,.12);color:var(--blue);">🌐 Open-Meteo</span>';

  const html = `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
    <div style="padding:10px 16px;background:var(--surface2);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-family:'Unbounded',sans-serif;font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1px;">🌡️ Прогноз погоды · 7 дней</span>
        ${sourceLabel}
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        ${sprayWindow.length > 0
          ? `<span style="font-size:10px;padding:2px 10px;border-radius:10px;background:rgba(107,221,107,.15);color:var(--accent);">💊 Опрыскивание: ${sprayWindow.slice(0,3).map(d=>d.slice(5)).join(', ')}</span>`
          : '<span style="font-size:10px;padding:2px 10px;border-radius:10px;background:rgba(255,153,68,.15);color:var(--orange);">⚠️ Нет окна для опрыскивания</span>'}
        <button class="btn btn-secondary btn-sm" onclick="loadForecastAndRender()" title="Обновить прогноз">🔄</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--border);">
      ${_forecast.map(day => {
        const date    = day.date;
        const d       = new Date(date + 'T12:00:00');
        const dayName = dayNames[d.getDay()];
        const isToday = date === new Date().toISOString().slice(0,10);
        const tmax    = day.tmax ?? '—';
        const tmin    = day.tmin ?? '—';
        const rain    = day.precip || 0;
        const wind    = day.wind ? Math.round(day.wind) : 0;
        const hum     = day.humidity ? Math.round(day.humidity) : 0;
        const isFrost    = (day.tmin||99) <= 2;
        const isHeat     = (day.tmax||0) >= 32;
        const isSmith    = (day.tmin||0) >= 10 && hum >= 80;
        const isGoodSpray = rain < 1 && wind < 20 && (day.tmax||0) > 8 && (day.tmax||0) < 30;
        const w = forecastIcon(day);
        return `<div style="padding:10px 8px;background:${isToday?'var(--surface3)':'var(--surface)'};text-align:center;position:relative;">
          ${isToday?'<div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent);"></div>':''}
          <div style="font-size:9px;color:${isToday?'var(--accent)':'var(--text3)'};font-weight:${isToday?'700':'400'};margin-bottom:3px;">${isToday?'СЕГОДНЯ':dayName} ${date.slice(5)}</div>
          <div style="font-size:22px;margin-bottom:3px;">${w.icon}</div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:5px;">${w.label}</div>
          <div style="margin-bottom:4px;">
            <span style="font-size:13px;font-weight:700;color:${isHeat?'var(--red)':'var(--text)'};"><b>${tmax}°</b></span>
            <span style="font-size:11px;color:${isFrost?'var(--blue)':'var(--text3)'};"> ${tmin}°</span>
          </div>
          ${rain > 0 ? `<div style="font-size:10px;color:var(--blue);">💧 ${rain.toFixed(1)}мм</div>` : '<div style="font-size:10px;color:var(--text3);">—</div>'}
          <div style="font-size:9px;color:var(--text3);margin-top:2px;">💨${wind}км/ч 💦${hum}%</div>
          <div style="margin-top:5px;display:flex;gap:2px;justify-content:center;flex-wrap:wrap;">
            ${isGoodSpray?'<span title="Окно для опрыскивания" style="font-size:9px;padding:1px 5px;border-radius:6px;background:rgba(107,221,107,.2);color:var(--accent);">💊</span>':''}
            ${isSmith?'<span title="Smith Period — риск болезней" style="font-size:9px;padding:1px 5px;border-radius:6px;background:rgba(255,85,85,.2);color:var(--red);">🟤</span>':''}
            ${isFrost?'<span title="Риск заморозка" style="font-size:9px;padding:1px 5px;border-radius:6px;background:rgba(100,180,255,.2);color:#60a5fa;">❄️</span>':''}
            ${isHeat?'<span title="Тепловой стресс" style="font-size:9px;padding:1px 5px;border-radius:6px;background:rgba(255,85,85,.2);color:var(--red);">🔥</span>':''}
          </div>
        </div>`;
      }).join('')}
    </div>

    <div style="padding:6px 14px;background:var(--surface2);display:flex;gap:12px;flex-wrap:wrap;font-size:10px;color:var(--text3);">
      <span>💊 Окно опрыскивания</span>
      <span>🟤 Smith Period</span>
      <span>❄️ Заморозок</span>
      <span>🔥 Тепловой стресс</span>
    </div>
  </div>`;

  el.innerHTML = html;
}

async function loadForecastAndRender() {
  const el = document.getElementById('forecast-strip');
  if (el) el.innerHTML = `<div style="padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;font-size:11px;color:var(--text3);">⏳ Загрузка прогноза...</div>`;
  await fetchForecast();
  renderForecastStrip();
  renderSmartRecs();
}

// ===================== METEO STATION XLS IMPORT =====================
function importMeteoStation(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const statusEl = document.getElementById('meteo-import-status');
  if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:8px;font-size:12px;color:var(--yellow);">⏳ Читаю ${file.name}...</div>`; }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      // XML SpreadsheetML format from FieldClimate
      const xml = new TextDecoder('utf-8').decode(new Uint8Array(e.target.result));
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const ns = 'urn:schemas-microsoft-com:office:spreadsheet';
      const rows = doc.getElementsByTagNameNS(ns, 'Row');

      let added = 0, skipped = 0, updated = 0;

      // Row 0: headers, Row 1: sub-headers, Row 2+: data
      for (let i = 2; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagNameNS(ns, 'Cell');
        const get = (idx) => {
          const c = cells[idx];
          const d = c ? c.getElementsByTagNameNS(ns, 'Data')[0] : null;
          return d ? d.textContent.trim() : '';
        };

        const dateStr = get(0).slice(0, 10); // "2026-05-23 00:00:00" → "2026-05-23"
        if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

        const tavg  = parseFloat(get(1)) || null;
        const tmax  = parseFloat(get(2)) || null;
        const tmin  = parseFloat(get(3)) || null;
        const humid = parseFloat(get(6)) || null;
        const precip = parseFloat(get(7)) || 0;
        const leafwet = parseFloat(get(8)) || 0;
        const wind = parseFloat(get(9)) || null;

        if (!tmax && !tmin && !tavg) continue;

        // Check duplicate
        const existing = S.weather.findIndex(w => w.date === dateStr);
        const entry = {
          id: 'w_' + dateStr.replace(/-/g,''),
          date: dateStr,
          tmax, tmin,
          tavg: tavg || (tmax !== null && tmin !== null ? Math.round((tmax+tmin)/2*10)/10 : null),
          humidity: humid,
          precip,
          et0: null, leafwet: leafwet, wind: wind, phase: null,
          note: 'Импорт с метеостанции',
        };

        if (existing >= 0) {
          S.weather[existing] = entry;
          updated++;
        } else {
          S.weather.push(entry);
          added++;
        }
      }

      S.weather.sort((a,b) => b.date.localeCompare(a.date));
      save();
      renderWeather();
      // Sync to server
      const token = sessionStorage.getItem('agro_token') || sessionStorage.getItem('agro_jwt') || '';
      if (token) {
        const toSync = S.weather.filter(w => w.date >= '2026-01-01');
        fetch('/api/weather', {
          method: 'POST',
          headers: {'Content-Type':'application/json','Authorization':'Bearer '+token},
          body: JSON.stringify(toSync)
        }).then(r=>r.json()).then(d=>console.log('[weather] Synced to server:', d.saved));
      }

      const msg = `✅ Импорт погоды завершён: добавлено ${added}, обновлено ${updated}`;
      if (statusEl) statusEl.innerHTML = `<div style="padding:10px 14px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.3);border-radius:8px;font-size:12px;color:var(--accent);">${msg}</div>`;
      setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 8000);

    } catch(err) {
      if (statusEl) statusEl.innerHTML = `<div style="padding:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--red);">❌ Ошибка: ${err.message}</div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}
