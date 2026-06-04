// Smart Agro — gpsmap.js
// ═══ GPS КАРТА (Leaflet) ═══════════════════════════════════════════════════

let _gpsMap = null;
let _gpsTileLayer = null;
let _gpsSatellite = false;
let _gpsDrawing = false;
let _gpsDrawPoints = [];
let _gpsDrawMarkers = [];
let _gpsDrawPolyline = null;
let _gpsCellLayers = {};      // polygons клеток
let _gpsTractorMarkers = {};  // маркеры тракторов
let _gpsTrackLayers = {};     // треки сессий
let _gpsStopMarkers = [];     // точки остановки (смесь)
let _gpsLiveInterval = null;

// ── Инициализация карты ──────────────────────────────────────────────────
function initGpsMap() {
  if (_gpsMap) return;
  if (!document.getElementById('gps-map')) return;

  // Leaflet подключён через CDN в HTML
  _gpsMap = L.map('gps-map', {
    center: [47.732, 28.522],
    zoom: 15,
    zoomControl: true,
  });

  // Tile layers
  _gpsTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri',
    maxZoom: 20,
  }).addTo(_gpsMap);

  // Click handler for drawing
  _gpsMap.on('click', gpsMapClick);

  // Load saved cells
  gpsLoadCells();

  // Start live tracking
  gpsStartLive();

  // Force size after short delay
  setTimeout(() => { _gpsMap.invalidateSize(true); }, 300);
  setTimeout(() => { _gpsMap.invalidateSize(true); }, 800);

  console.log('[GPS] Map initialized');
}

// ── Переключение спутника ────────────────────────────────────────────────
function gpsToggleSatellite() {
  _gpsSatellite = !_gpsSatellite;
  if (_gpsTileLayer) _gpsMap.removeLayer(_gpsTileLayer);
  if (_gpsSatellite) {
    _gpsTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri World Imagery',
      maxZoom: 20,
    }).addTo(_gpsMap);
  } else {
    _gpsTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri World Street Map',
      maxZoom: 20,
    }).addTo(_gpsMap);
  }
}

// ── Рисование полигонов клеток ───────────────────────────────────────────
function gpsStartDraw() {
  _gpsDrawing = true;
  _gpsDrawPoints = [];
  _gpsDrawMarkers.forEach(m => _gpsMap.removeLayer(m));
  _gpsDrawMarkers = [];
  if (_gpsDrawPolyline) _gpsMap.removeLayer(_gpsDrawPolyline);
  _gpsMap.getContainer().style.cursor = 'crosshair';
  document.getElementById('gps-btn-draw').style.display = 'none';
  document.getElementById('gps-btn-stop').style.display = 'inline-flex';
  showToast('Кликайте на карте чтобы нарисовать клетку. Нажмите ⏹ чтобы закончить.', 4000);
}

function gpsStopDraw() {
  _gpsDrawing = false;
  _gpsMap.getContainer().style.cursor = '';
  document.getElementById('gps-btn-draw').style.display = 'inline-flex';
  document.getElementById('gps-btn-stop').style.display = 'none';

  if (_gpsDrawPoints.length < 3) {
    showToast('Нужно минимум 3 точки для полигона');
    _gpsDrawMarkers.forEach(m => _gpsMap.removeLayer(m));
    _gpsDrawMarkers = [];
    if (_gpsDrawPolyline) _gpsMap.removeLayer(_gpsDrawPolyline);
    return;
  }

  // Ask for cell name
  const name = prompt('Название клетки (например: 1-1, A2, Черешня-3):');
  if (!name) return;

  const cellId = 'gc_' + Date.now();
  const cell = { id: cellId, name, points: _gpsDrawPoints.slice() };

  // Save
  if (!S.gpsCells) S.gpsCells = {};
  S.gpsCells[cellId] = cell;
  save();

  // Draw on map
  gpsDrawCell(cell);

  // Clear temp drawing
  _gpsDrawMarkers.forEach(m => _gpsMap.removeLayer(m));
  _gpsDrawMarkers = [];
  if (_gpsDrawPolyline) _gpsMap.removeLayer(_gpsDrawPolyline);
  _gpsDrawPoints = [];

  document.getElementById('gps-cells-count').textContent = Object.keys(S.gpsCells||{}).length;
  showToast(`✅ Клетка "${name}" сохранена`);
}

function gpsMapClick(e) {
  if (!_gpsDrawing) return;
  const pt = [e.latlng.lat, e.latlng.lng];
  _gpsDrawPoints.push(pt);

  // Add vertex marker
  const m = L.circleMarker(pt, { radius: 5, color: '#4ade80', fillColor: '#4ade80', fillOpacity: 1 }).addTo(_gpsMap);
  _gpsDrawMarkers.push(m);

  // Update preview polyline
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
  showToast('Клетки очищены');
}

// ── Загрузка и отрисовка клеток ──────────────────────────────────────────
function gpsLoadCells() {
  const cells = S.gpsCells || {};
  Object.values(cells).forEach(cell => gpsDrawCell(cell));
  document.getElementById('gps-cells-count').textContent = Object.keys(cells).length;
}

function gpsDrawCell(cell) {
  if (!cell.points || cell.points.length < 3) return;
  if (_gpsCellLayers[cell.id]) _gpsMap.removeLayer(_gpsCellLayers[cell.id]);

  // Calculate area in ha
  const areaM2 = L.GeometryUtil ? L.GeometryUtil.geodesicArea(cell.points.map(p => L.latLng(p[0], p[1]))) : 0;
  const areaHa = (areaM2 / 10000).toFixed(2);

  const polygon = L.polygon(cell.points, {
    color: '#4ade80',
    fillColor: '#4ade80',
    fillOpacity: 0.1,
    weight: 2,
  }).addTo(_gpsMap);

  polygon.bindTooltip(`<b>${cell.name}</b>${areaHa > 0 ? '<br>' + areaHa + ' га' : ''}`, {
    permanent: true, direction: 'center', className: 'gps-cell-label'
  });

  polygon.on('click', () => {
    if (!_gpsDrawing) gpsShowCellInfo(cell);
  });

  _gpsCellLayers[cell.id] = polygon;
}

function gpsShowCellInfo(cell) {
  const areaM2 = L.GeometryUtil ? L.GeometryUtil.geodesicArea(cell.points.map(p => L.latLng(p[0], p[1]))) : 0;
  const areaHa = (areaM2 / 10000).toFixed(2);
  if (confirm(`Клетка: ${cell.name}\nПлощадь: ~${areaHa} га\n\nУдалить клетку?`)) {
    _gpsMap.removeLayer(_gpsCellLayers[cell.id]);
    delete _gpsCellLayers[cell.id];
    delete S.gpsCells[cell.id];
    save();
    document.getElementById('gps-cells-count').textContent = Object.keys(S.gpsCells||{}).length;
  }
}

// ── По центру ────────────────────────────────────────────────────────────
function gpsFitBounds() {
  const layers = Object.values(_gpsCellLayers);
  if (layers.length) {
    const group = L.featureGroup(layers);
    _gpsMap.fitBounds(group.getBounds().pad(0.1));
  } else {
    _gpsMap.setView([47.732, 28.522], 15);
  }
}

// ── Live GPS трекинг ─────────────────────────────────────────────────────
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

    // Update tractor markers
    const activeIds = new Set();
    devices.forEach(d => {
      activeIds.add(d.device_id);
      gpsupdateTractorMarker(d);
    });

    // Remove offline tractors
    Object.keys(_gpsTractorMarkers).forEach(id => {
      if (!activeIds.has(id)) {
        _gpsMap.removeLayer(_gpsTractorMarkers[id]);
        delete _gpsTractorMarkers[id];
      }
    });

    document.getElementById('gps-tractors-count').textContent = 'Тракторов онлайн: ' + devices.length;
    const badge = document.getElementById('gps-live-badge');
    if (badge) badge.style.display = devices.length > 0 ? 'inline-block' : 'none';
    document.getElementById('gps-sessions-count').textContent = devices.length;

  } catch(e) {
    // Server might not have GPS endpoint yet — silent fail
  }
}

function gpsupdateTractorMarker(d) {
  const pos = [d.lat, d.lon];
  const statusColor = d.status === 'working' ? '#4ade80' : d.status === 'stopped' ? '#facc15' : '#60a5fa';
  const icon = L.divIcon({
    html: `<div style="background:${statusColor};width:20px;height:20px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 2px 6px rgba(0,0,0,.4);">🚜</div>`,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  if (_gpsTractorMarkers[d.device_id]) {
    _gpsTractorMarkers[d.device_id].setLatLng(pos);
    _gpsTractorMarkers[d.device_id].setIcon(icon);
  } else {
    const m = L.marker(pos, { icon })
      .bindPopup(`<b>🚜 ${d.name||d.device_id}</b><br>Скорость: ${d.speed||0} км/ч<br>Статус: ${d.status||'—'}`)
      .addTo(_gpsMap);
    _gpsTractorMarkers[d.device_id] = m;
  }
}

// ── Инициализация при переключении вкладки ───────────────────────────────
// Вызывается из switchTab
function onGpsMapTabOpen() {
  const panel = document.getElementById('panel-gpsmap');
  if (panel) {
    panel.style.display = 'block';
    panel.style.width = '100%';
  }
  setTimeout(() => {
    if (!_gpsMap) {
      initGpsMap();
    } else {
      _gpsMap.invalidateSize(true);
    }
  }, 200);
  setTimeout(() => {
    if (_gpsMap) _gpsMap.invalidateSize(true);
  }, 500);
}
