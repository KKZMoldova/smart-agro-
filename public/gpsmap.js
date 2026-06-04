// Smart Agro — gpsmap.js
// Local toast (fallback if global showToast not available)
function gpsToast(msg, duration) {
  if (typeof showToast === 'function') { showToast(msg, duration||2500); return; }
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--accent,#4ade80);color:#000;padding:10px 20px;border-radius:10px;font-size:12px;font-weight:600;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,.3);';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration||2500);
}

// ═══ GPS КАРТА (Leaflet) ═══════════════════════════════════════════════════

let _gpsMap = null;
let _gpsTileLayer = null;
let _gpsSatellite = false;
let _gpsDrawing = false;
let _gpsDrawPoints = [];
let _gpsDrawMarkers = [];
let _gpsDrawPolyline = null;
let _gpsCellLayers = {};
let _gpsTractorMarkers = {};
let _gpsTrackLayers = {};
let _gpsStopMarkers = [];
let _gpsLiveInterval = null;

function initGpsMap() {
  if (_gpsMap) return;
  if (!document.getElementById('gps-map')) return;
  _gpsMap = L.map('gps-map', { center: [47.732, 28.522], zoom: 15, zoomControl: true });
  _gpsTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri', maxZoom: 20,
  }).addTo(_gpsMap);
  _gpsMap.on('click', gpsMapClick);
  gpsLoadCells();
  gpsStartLive();
  setTimeout(() => { _gpsMap.invalidateSize(true); }, 300);
  setTimeout(() => { _gpsMap.invalidateSize(true); }, 800);
  console.log('[GPS] Map initialized');
  wialonStart(); // Запуск Wialon если токен настроен
}

function gpsToggleSatellite() {
  _gpsSatellite = !_gpsSatellite;
  if (_gpsTileLayer) _gpsMap.removeLayer(_gpsTileLayer);
  const url = _gpsSatellite
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
  _gpsTileLayer = L.tileLayer(url, { attribution: '© Esri', maxZoom: 20 }).addTo(_gpsMap);
}

function gpsStartDraw() {
  _gpsDrawing = true;
  _gpsDrawPoints = [];
  _gpsDrawMarkers.forEach(m => _gpsMap.removeLayer(m));
  _gpsDrawMarkers = [];
  if (_gpsDrawPolyline) _gpsMap.removeLayer(_gpsDrawPolyline);
  _gpsMap.getContainer().style.cursor = 'crosshair';
  document.getElementById('gps-btn-draw').style.display = 'none';
  document.getElementById('gps-btn-stop').style.display = 'inline-flex';
  gpsToast('Кликайте на карте чтобы нарисовать клетку. Нажмите ⏹ чтобы закончить.', 4000);
}

function gpsStopDraw() {
  _gpsDrawing = false;
  _gpsMap.getContainer().style.cursor = '';
  document.getElementById('gps-btn-draw').style.display = 'inline-flex';
  document.getElementById('gps-btn-stop').style.display = 'none';

  if (_gpsDrawPoints.length < 3) {
    gpsToast('Нужно минимум 3 точки для полигона');
    _gpsDrawMarkers.forEach(m => _gpsMap.removeLayer(m));
    _gpsDrawMarkers = [];
    if (_gpsDrawPolyline) _gpsMap.removeLayer(_gpsDrawPolyline);
    return;
  }

  const savedPoints = _gpsDrawPoints.slice();
  _gpsDrawMarkers.forEach(m => _gpsMap.removeLayer(m));
  _gpsDrawMarkers = [];
  if (_gpsDrawPolyline) _gpsMap.removeLayer(_gpsDrawPolyline);
  _gpsDrawPoints = [];

  gpsShowZonePicker(savedPoints);
}

function gpsShowZonePicker(points) {
  const zones = (typeof S !== 'undefined' && S.irrigation && S.irrigation.zones) || [];

  let zoneSelectHtml = '';
  if (zones.length) {
    const opts = zones.map(z => '<option value="' + z.id + '">' + z.name + (z.area ? ' · ' + z.area + ' га' : '') + '</option>').join('');
    zoneSelectHtml = '<div style="margin-bottom:12px;">'
      + '<label style="font-size:11px;color:var(--text3);display:block;margin-bottom:5px;">Зона из справочника</label>'
      + '<select id="gps-zone-select" style="width:100%;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);">'
      + '<option value="">— выбрать зону —</option>' + opts
      + '</select></div>'
      + '<div style="text-align:center;font-size:11px;color:var(--text3);margin-bottom:12px;">— или —</div>';
  }

  const el = document.createElement('div');
  el.id = 'gps-zone-modal';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;';
  el.innerHTML = '<div style="background:var(--surface);border-radius:16px;padding:24px;width:420px;max-width:94vw;border:1px solid var(--border);">'
    + '<div style="font-family:\'Unbounded\',sans-serif;font-size:12px;font-weight:700;color:var(--accent);margin-bottom:16px;">📐 Привязать клетку к зоне</div>'
    + zoneSelectHtml
    + '<div style="margin-bottom:16px;">'
    + '<label style="font-size:11px;color:var(--text3);display:block;margin-bottom:5px;">Название вручную</label>'
    + '<input type="text" id="gps-zone-name" placeholder="напр. Черешня 1-1, Яблоня А2..." style="width:100%;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);box-sizing:border-box;">'
    + '</div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;">'
    + '<button onclick="document.getElementById(\'gps-zone-modal\').remove()" class="btn btn-secondary">Отмена</button>'
    + '<button id="gps-zone-save-btn" class="btn btn-primary">💾 Сохранить клетку</button>'
    + '</div></div>';

  document.body.appendChild(el);

  const sel = document.getElementById('gps-zone-select');
  if (sel) {
    sel.addEventListener('change', function() {
      const z = zones.find(z => z.id === this.value);
      if (z) document.getElementById('gps-zone-name').value = z.name;
    });
  }

  document.getElementById('gps-zone-save-btn').onclick = function() {
    const zoneId = document.getElementById('gps-zone-select') ? document.getElementById('gps-zone-select').value : null;
    const nameVal = document.getElementById('gps-zone-name').value.trim();
    const zone = zones.find(z => z.id === zoneId);
    const label = nameVal || (zone && zone.name) || '';
    if (!label) { alert('Введите название или выберите зону'); return; }

    document.getElementById('gps-zone-modal').remove();
    const cellId = 'gc_' + Date.now();
    const cell = { id: cellId, name: label, zoneId: zoneId || null, points: points };
    if (!S.gpsCells) S.gpsCells = {};
    S.gpsCells[cellId] = cell;
    save();
    gpsDrawCell(cell);
    document.getElementById('gps-cells-count').textContent = Object.keys(S.gpsCells || {}).length;
    gpsToast('✅ Клетка "' + label + '" сохранена');
  };
}

function gpsMapClick(e) {
  if (!_gpsDrawing) return;
  const pt = [e.latlng.lat, e.latlng.lng];
  _gpsDrawPoints.push(pt);
  const m = L.circleMarker(pt, { radius: 5, color: '#4ade80', fillColor: '#4ade80', fillOpacity: 1 }).addTo(_gpsMap);
  _gpsDrawMarkers.push(m);
  if (_gpsDrawPolyline) _gpsMap.removeLayer(_gpsDrawPolyline);
  if (_gpsDrawPoints.length > 1) {
    _gpsDrawPolyline = L.polyline([..._gpsDrawPoints, _gpsDrawPoints[0]], {
      color: '#4ade80', weight: 2, dashArray: '5,5'
    }).addTo(_gpsMap);
  }
}

function gpsClearDraw() {
  if (!confirm('Очистить все нарисованные клетки?')) return;
  Object.values(_gpsCellLayers).forEach(l => _gpsMap.removeLayer(l));
  _gpsCellLayers = {};
  S.gpsCells = {};
  save();
  document.getElementById('gps-cells-count').textContent = '0';
  gpsToast('Клетки очищены');
}

function gpsLoadCells() {
  const cells = S.gpsCells || {};
  Object.values(cells).forEach(cell => gpsDrawCell(cell));
  document.getElementById('gps-cells-count').textContent = Object.keys(cells).length;
}

function gpsDrawCell(cell) {
  if (!cell.points || cell.points.length < 3) return;
  if (_gpsCellLayers[cell.id]) _gpsMap.removeLayer(_gpsCellLayers[cell.id]);
  const areaM2 = L.GeometryUtil ? L.GeometryUtil.geodesicArea(cell.points.map(p => L.latLng(p[0], p[1]))) : 0;
  const areaHa = (areaM2 / 10000).toFixed(2);
  const polygon = L.polygon(cell.points, {
    color: '#4ade80', fillColor: '#4ade80', fillOpacity: 0.1, weight: 2,
  }).addTo(_gpsMap);
  polygon.bindTooltip('<b>' + cell.name + '</b>' + (areaHa > 0 ? '<br>' + areaHa + ' га' : ''), {
    permanent: true, direction: 'center', className: 'gps-cell-label'
  });
  polygon.on('click', function() { if (!_gpsDrawing) gpsShowCellInfo(cell); });
  _gpsCellLayers[cell.id] = polygon;
}

function gpsShowCellInfo(cell) {
  const areaM2 = L.GeometryUtil ? L.GeometryUtil.geodesicArea(cell.points.map(p => L.latLng(p[0], p[1]))) : 0;
  const areaHa = (areaM2 / 10000).toFixed(2);
  if (confirm('Клетка: ' + cell.name + '\nПлощадь: ~' + areaHa + ' га\n\nУдалить клетку?')) {
    _gpsMap.removeLayer(_gpsCellLayers[cell.id]);
    delete _gpsCellLayers[cell.id];
    delete S.gpsCells[cell.id];
    save();
    document.getElementById('gps-cells-count').textContent = Object.keys(S.gpsCells || {}).length;
  }
}

function gpsFitBounds() {
  const layers = Object.values(_gpsCellLayers);
  if (layers.length) {
    _gpsMap.fitBounds(L.featureGroup(layers).getBounds().pad(0.1));
  } else {
    _gpsMap.setView([47.732, 28.522], 15);
  }
}

function gpsStartLive() {
  if (_gpsLiveInterval) clearInterval(_gpsLiveInterval);
  _gpsLiveInterval = setInterval(gpsUpdateLive, 5000);
  gpsUpdateLive();
}

async function gpsUpdateLive() {
  try {
    const token = sessionStorage.getItem('agro_token') || '';
    const r = await fetch('/api/gps/live', {
      headers: { 'Authorization': 'Bearer ' + token },
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 4000); return c.signal; })(),
    });
    if (!r.ok) return;
    const data = await r.json();
    const devices = data.devices || [];
    const activeIds = new Set();
    devices.forEach(d => { activeIds.add(d.device_id); gpsupdateTractorMarker(d); });
    Object.keys(_gpsTractorMarkers).forEach(id => {
      if (!activeIds.has(id)) { _gpsMap.removeLayer(_gpsTractorMarkers[id]); delete _gpsTractorMarkers[id]; }
    });
    document.getElementById('gps-tractors-count').textContent = 'Тракторов онлайн: ' + devices.length;
    const badge = document.getElementById('gps-live-badge');
    if (badge) badge.style.display = devices.length > 0 ? 'inline-block' : 'none';
    document.getElementById('gps-sessions-count').textContent = devices.length;
  } catch(e) {}
}

function gpsupdateTractorMarker(d) {
  const pos = [d.lat, d.lon];
  const statusColor = d.status === 'working' ? '#4ade80' : d.status === 'stopped' ? '#facc15' : '#60a5fa';
  const icon = L.divIcon({
    html: '<div style="background:' + statusColor + ';width:20px;height:20px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 2px 6px rgba(0,0,0,.4);">🚜</div>',
    className: '', iconSize: [20, 20], iconAnchor: [10, 10],
  });
  if (_gpsTractorMarkers[d.device_id]) {
    _gpsTractorMarkers[d.device_id].setLatLng(pos);
    _gpsTractorMarkers[d.device_id].setIcon(icon);
  } else {
    const m = L.marker(pos, { icon })
      .bindPopup('<b>🚜 ' + (d.name || d.device_id) + '</b><br>Скорость: ' + (d.speed || 0) + ' км/ч<br>Статус: ' + (d.status || '—'))
      .addTo(_gpsMap);
    _gpsTractorMarkers[d.device_id] = m;
  }
}

function onGpsMapTabOpen() {
  const panel = document.getElementById('panel-gpsmap');
  if (panel) { panel.style.display = 'block'; panel.style.width = '100%'; }
  setTimeout(() => {
    if (!_gpsMap) initGpsMap(); else _gpsMap.invalidateSize(true);
  }, 200);
  setTimeout(() => { if (_gpsMap) _gpsMap.invalidateSize(true); }, 500);
}

// ═══ WIALON API ИНТЕГРАЦИЯ ════════════════════════════════════════════════
// Документация: https://sdk.wialon.com/wiki/en/sidebar/remoteapi/apiref/apiref
// Заполнить WIALON_TOKEN в Railway Variables когда получишь API ключ

let WIALON_HOST = 'https://hst-api.wialon.com'; // будет обновлён из /api/wialon/token

let _wialonSid = null; // session id после авторизации
let _wialonUnits = []; // список единиц (тракторов)

// Авторизация в Wialon
async function wialonLogin(token) {
  try {
    const url = WIALON_HOST + '/wialon/ajax.html?svc=token/login&params=' +
      encodeURIComponent(JSON.stringify({ token, fl: 1 }));
    const r = await fetch(url);
    const d = await r.json();
    if (d.error) { console.error('[Wialon] Login error:', d.error); return false; }
    _wialonSid = d.eid;
    console.log('[Wialon] Logged in, sid:', _wialonSid);
    await wialonLoadUnits();
    return true;
  } catch(e) {
    console.error('[Wialon] Login failed:', e.message);
    return false;
  }
}

// Загрузить список единиц (тракторов)
async function wialonLoadUnits() {
  if (!_wialonSid) return;
  try {
    const params = {
      spec: { itemsType:'avl_unit', propName:'sys_name', propValueMask:'*', sortType:'sys_name' },
      force: 1, flags: 1025, from: 0, to: 0
    };
    const url = WIALON_HOST + '/wialon/ajax.html?svc=core/search_items&params=' +
      encodeURIComponent(JSON.stringify(params)) + '&sid=' + _wialonSid;
    const r = await fetch(url);
    const d = await r.json();
    _wialonUnits = (d.items || []).map(u => ({
      id: u.id, name: u.nm, lastPos: u.pos
    }));
    console.log('[Wialon] Units loaded:', _wialonUnits.length);
    return _wialonUnits;
  } catch(e) {
    console.error('[Wialon] Load units failed:', e.message);
  }
}

// Получить текущие позиции всех единиц
async function wialonGetPositions() {
  if (!_wialonSid || !_wialonUnits.length) return [];
  try {
    const ids = _wialonUnits.map(u => u.id);
    const params = { ids, flags: 1025 };
    const url = WIALON_HOST + '/wialon/ajax.html?svc=core/update_data_flags&params=' +
      encodeURIComponent(JSON.stringify([{ type:'type', data:'avl_unit', flags:1025, mode:0 }])) +
      '&sid=' + _wialonSid;
    const r = await fetch(url);
    const d = await r.json();

    return _wialonUnits.map(u => {
      const item = Array.isArray(d) ? d.find(i => i.i === u.id) : null;
      const pos = item?.d?.pos;
      return pos ? {
        device_id: String(u.id),
        name: u.name,
        lat: pos.y,
        lon: pos.x,
        speed: pos.s || 0,
        status: pos.s > 1 ? 'working' : 'stopped',
        timestamp: new Date().toISOString(),
      } : null;
    }).filter(Boolean);
  } catch(e) {
    console.error('[Wialon] Get positions failed:', e.message);
    return [];
  }
}

// Запуск Wialon интеграции (вызывается автоматически если токен задан)
async function wialonStart() {
  // Токен будет передан через сервер чтобы не светить в коде
  try {
    const r = await fetch('/api/wialon/token');
    if (!r.ok) return; // токен не настроен
    const d = await r.json();
    if (!d.token) return;
    if (d.host) WIALON_HOST = d.host; // Wialon Local support
    const ok = await wialonLogin(d.token);
    if (ok) {
      console.log('[Wialon] Integration active');
      // Переключаем live на Wialon
      if (_gpsLiveInterval) clearInterval(_gpsLiveInterval);
      _gpsLiveInterval = setInterval(async () => {
        const positions = await wialonGetPositions();
        if (positions.length) {
          const activeIds = new Set();
          positions.forEach(d => { activeIds.add(d.device_id); gpsupdateTractorMarker(d); });
          Object.keys(_gpsTractorMarkers).forEach(id => {
            if (!activeIds.has(id)) { _gpsMap.removeLayer(_gpsTractorMarkers[id]); delete _gpsTractorMarkers[id]; }
          });
          document.getElementById('gps-tractors-count').textContent = 'Тракторов онлайн: ' + positions.length;
          const badge = document.getElementById('gps-live-badge');
          if (badge) badge.style.display = 'inline-block';
        }
      }, 5000);
    }
  } catch(e) {
    console.log('[Wialon] Not configured yet');
  }
}
