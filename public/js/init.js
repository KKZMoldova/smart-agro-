// Smart Agro — init.js
// ===================== INIT =====================
async function init(){
  await checkServer();
  updateServerIndicator();
  if (_serverAvailable) {
    try {
      const r = await fetch('/api/state/orchard',{headers:getAuthHeaders()});
      const json = await r.json();
      if (json.ok && json.data) {
        const d = typeof json.data === 'string' ? JSON.parse(json.data) : json.data;
        _mergeState(d);
        console.log('[init] Loaded full state from server');
        localStorage.setItem('cherry_v5', JSON.stringify(S));
      } else {
        await load();
      }
    } catch(e) {
      console.warn('[init] Server state load failed:', e.message);
      await load();
    }
    try {
      const wRes = await fetch('/api/weather?days=90&station='+(sessionStorage.getItem('agro_fc_orchard')||'00002158'),{headers:getAuthHeaders()});
      const wJson = await wRes.json();
      if (wJson.ok && wJson.data && wJson.data.length) {
        S.weather = wJson.data.map(d => ({
          id: 'w_' + d.date.replace(/-/g,''),
          date: d.date,
          tmax: d.tmax,
          tmin: d.tmin,
          tavg: d.tavg,
          humidity: d.humidity,
          precip: d.precip,
          et0: d.et0,
          leafwet: d.leaf_wet || 0,
          wind: null,
          phase: null,
          note: 'Авто-импорт с метеостанции',
        }));
        S.weather.sort((a,b) => b.date.localeCompare(a.date));
        localStorage.setItem('cherry_v5', JSON.stringify(S));
        console.log('[init] Weather loaded:', S.weather.length, 'days');
      }
    } catch(e) {
      console.warn('[init] Weather load failed:', e.message);
    }
  } else {
    await load();
  }
  renderMap();
  loadSettings();
  populateGddVarietySelect();
  if (S.weather.length) renderWeather();
  loadCherryForecast();
  console.log('[init] Server:', _serverAvailable ? 'online' : 'offline');
  console.log('[init] Weather records:', S.weather.length);

  // Показываем имя пользователя в шапке
  const userName = sessionStorage.getItem('agro_user_name') || '';
  const tenantName = sessionStorage.getItem('agro_tenant_name') || '';
  if(userName) {
    const hdr = document.querySelector('.topbar-stats') || document.querySelector('.topbar');
    if(hdr) {
      const badge = document.createElement('div');
      badge.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text3);';
      badge.innerHTML = `<span>👤 ${userName}</span>${tenantName?`<span style="color:var(--text3);">· ${tenantName}</span>`:''}
        <a href="/smart-vegetable.html"
          style="padding:2px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text3);font-size:10px;cursor:pointer;text-decoration:none;">🥦 Овощи</a>
        <button onclick="if(confirm('Выйти?')){sessionStorage.clear();window.location.href='/login';}"
          style="padding:2px 8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text3);font-size:10px;cursor:pointer;">Выйти</button>`;
      hdr.appendChild(badge);
    }
  }

  // Применяем роль
  applyRoleAccess();

  // Открываем дашборд после применения ролей
  const role = sessionStorage.getItem('agro_role')||'agronomist';
  if(['agronomist','owner','shareholder','director','superadmin'].includes(role)) {
    setTimeout(()=>{
      const dashTab = document.querySelector('.tab[onclick*="dashboard"]');
      if(dashTab && dashTab.style.display !== 'none') {
        switchTab('dashboard', dashTab);
        dashTab.classList.add('active');
        document.querySelectorAll('.tab').forEach(t=>{ if(t!==dashTab) t.classList.remove('active'); });
      }
    }, 200);
  }
}
init();
// Патч: скролл к активной панели при переключении вкладок
(function patchSwitchTab(){
  if(typeof switchTab !== 'function'){ setTimeout(patchSwitchTab,50); return; }
  const _sw = switchTab;
  window.switchTab = function(tab, el) {
    _sw(tab, el);
    setTimeout(() => {
      const p = document.getElementById('panel-' + tab);
      if(p) { p.scrollIntoView({behavior:'instant',block:'start'}); window.scrollBy(0,-100); }
    }, 10);
  };
})();

// ═══ СИСТЕМА РОЛЕЙ И ДОСТУПОВ ════════════════════════════════════════════

const ROLE_ACCESS = {
  agronomist:          ['dashboard','map','crops','weather','gdd','irrigation','catalog','treatments',
                        'analysis','diseases','warehouse','tasks','ailog','doses','settings'],
  owner:               ['dashboard','map','crops','weather','gdd','irrigation','catalog','treatments',
                        'analysis','diseases','warehouse','tasks','ailog','doses','settings'],
  shareholder:         ['dashboard','map','crops','weather','gdd','irrigation','catalog','treatments',
                        'analysis','diseases','warehouse','tasks'],
  director:            ['dashboard','map','crops','weather','gdd','irrigation','catalog','treatments',
                        'analysis','diseases','warehouse','tasks'],
  accountant:          ['dashboard','map','crops','weather','gdd','irrigation','catalog','treatments',
                        'analysis','diseases','warehouse','tasks'],
  engineer:            ['map','irrigation','warehouse','tasks','settings'],
  irrigation_engineer: ['map','weather','irrigation','analysis'],
  operator:            ['treatments','warehouse','tasks'],
  superadmin:          ['dashboard','map','crops','weather','gdd','irrigation','catalog','treatments',
                        'analysis','diseases','warehouse','tasks','ailog','doses','settings'],
};

// Только просмотр для этих ролей (кнопки редактирования скрыты)
const ROLE_READONLY = ['shareholder','director','accountant','irrigation_engineer'];

const ROLE_LABELS = {
  agronomist:          '🌱 Агроном',
  owner:               '👑 Владелец',
  shareholder:         '📊 Акционер',
  director:            '📋 Директор',
  accountant:          '💼 Бухгалтер',
  engineer:            '🔧 Инженер',
  irrigation_engineer: '💧 Инж. ирригации',
  operator:            '⚙️ Оператор',
  superadmin:          '🔑 Суперадмин',
};

function applyRoleAccess() {
  const role = sessionStorage.getItem('agro_role') || 'agronomist';
  const allowed = ROLE_ACCESS[role] || ROLE_ACCESS.agronomist;
  const isReadonly = ROLE_READONLY.includes(role);

  // Показываем роль в шапке
  const roleBadge = document.getElementById('role-badge');
  if(roleBadge) {
    roleBadge.textContent = ROLE_LABELS[role] || role;
    roleBadge.style.display = 'inline-block';
  }

  // Скрываем/показываем табы
  document.querySelectorAll('.tab[onclick*="switchTab"]').forEach(tab => {
    const m = tab.getAttribute('onclick').match(/switchTab\('(\w+)'/);
    if(!m) return;
    const tabId = m[1];
    tab.style.display = allowed.includes(tabId) ? '' : 'none';
  });

  // Для режима readonly скрываем кнопки редактирования
  if(isReadonly) {
    const style = document.createElement('style');
    style.id = 'readonly-style';
    style.textContent = `
      .btn-primary:not(.allow-readonly),
      button[onclick*="openCatalogAdd"],
      button[onclick*="openTreatment"],
      button[onclick*="openWarehouse"],
      button[onclick*="openAnalysis"],
      button[onclick*="openIrrig"],
      .btn-danger { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  // Кнопка "Задание" — только для агронома
  const irrigBtn = document.getElementById('irrig-task-btn');
  if(irrigBtn) irrigBtn.style.display = role === 'agronomist' ? 'block' : 'none';
  if(role === 'irrigation_engineer') {
    // Добавляем кнопку "Записать полив" в шапку если её нет
    const hdr = document.querySelector('.topbar');
    if(hdr && !document.getElementById('irrig-quick-btn')) {
      const btn = document.createElement('button');
      btn.id = 'irrig-quick-btn';
      btn.className = 'btn btn-primary btn-sm';
      btn.innerHTML = '💧 Записать полив';
      btn.onclick = () => { switchTab('irrigation', document.querySelector('.tab[onclick*="irrigation"]')); setTimeout(openIrrigEventModal, 300); };
      btn.style.cssText = 'margin-left:8px;';
      hdr.appendChild(btn);
    }
    // Переключаемся на ирригацию по умолчанию
    const irrigTab = document.querySelector('.tab[onclick*="switchTab(\'irrigation\'"]');
    if(irrigTab) setTimeout(()=>irrigTab.click(), 500);
  }

  // Первый доступный таб — активируем только если текущий недоступен и это не dashboard
  const activeTab = document.querySelector('.tab.active');
  if(activeTab) {
    const m = activeTab.getAttribute('onclick').match(/switchTab\('(\w+)'/);
    if(m && m[1] !== 'dashboard' && !allowed.includes(m[1])) {
      const firstAllowed = document.querySelector('.tab[onclick*="switchTab"]:not([style*="none"])');
      if(firstAllowed) setTimeout(()=>firstAllowed.click(), 100);
    }
  }
}

// ═══ УПРАВЛЕНИЕ РОЛЯМИ В НАСТРОЙКАХ ══════════════════════════════════════

function renderRolesSettings() {
  const el = document.getElementById('roles-settings-panel');
  if(!el) return;

  const myRole = sessionStorage.getItem('agro_role');
  if(!['owner','agronomist','superadmin'].includes(myRole)) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);">Управление ролями доступно только владельцу и агроному.</div>';
    return;
  }

  el.innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;font-weight:600;">👥 Управление ролями пользователей</div>
    <div id="roles-users-list" style="font-size:12px;color:var(--text3);">⏳ Загрузка...</div>
    <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="openAddUserRoleModal()">+ Добавить пользователя</button>
  `;
  loadRolesUsers();
}

async function loadRolesUsers() {
  const el = document.getElementById('roles-users-list');
  if(!el) return;
  try {
    const token = sessionStorage.getItem('agro_jwt')||'';
    const r = await fetch('/api/auth/users', {headers:{'Authorization':`Bearer ${token}`,'x-tenant-id':sessionStorage.getItem('agro_tenant')||'kkz'}});
    const data = await r.json();
    const users = data.users||[];
    if(!users.length){el.innerHTML='<div style="color:var(--text3);">Нет пользователей</div>';return;}

    el.innerHTML = users.map(u=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px;">
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:600;">${u.name||u.login}</div>
          <div style="font-size:10px;color:var(--text3);">@${u.login}</div>
        </div>
        <select onchange="changeUserRole('${u.id}',this.value)"
          style="padding:4px 8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;">
          ${Object.entries(ROLE_LABELS).map(([k,v])=>`<option value="${k}" ${u.role===k?'selected':''}>${v}</option>`).join('')}
        </select>
        <span style="font-size:10px;padding:2px 8px;border-radius:6px;background:${u.active?'rgba(74,222,128,.12)':'rgba(226,75,74,.12)'};color:${u.active?'var(--accent)':'var(--red)'};">${u.active?'Активен':'Неактивен'}</span>
      </div>`).join('');
  } catch(e) {
    if(el) el.innerHTML = '<div style="color:var(--red);">Ошибка загрузки</div>';
  }
}

async function changeUserRole(userId, newRole) {
  try {
    const token = sessionStorage.getItem('agro_jwt')||'';
    const r = await fetch(`/api/auth/users/${userId}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body: JSON.stringify({role: newRole, active: true})
    });
    const d = await r.json();
    if(d.ok) {
      // Показываем подтверждение
      const msg = document.createElement('div');
      msg.style.cssText = 'position:fixed;top:20px;right:20px;padding:10px 18px;background:var(--accent);color:#000;border-radius:8px;font-size:12px;z-index:9999;font-weight:600;';
      msg.textContent = `✅ Роль изменена на ${ROLE_LABELS[newRole]||newRole}`;
      document.body.appendChild(msg);
      setTimeout(()=>msg.remove(), 2500);
    }
  } catch(e) { console.error(e); }
}

async function openAddUserRoleModal() {
  const login = prompt('Логин нового пользователя:');
  if(!login) return;
  const password = prompt('Пароль (минимум 6 символов):');
  if(!password || password.length < 6) { alert('Пароль минимум 6 символов'); return; }
  const name = prompt('Имя (необязательно):') || login;
  const roleKeys = Object.keys(ROLE_LABELS);
  const roleList = roleKeys.map((k,i)=>`${i+1}. ${ROLE_LABELS[k]}`).join('\n');
  const roleIdx = parseInt(prompt(`Выберите роль:\n${roleList}`)) - 1;
  const role = roleKeys[roleIdx] || 'operator';

  try {
    const token = sessionStorage.getItem('agro_jwt')||'';
    const r = await fetch('/api/auth/users', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body: JSON.stringify({login, password, role, name, tenantId: sessionStorage.getItem('agro_tenant')||'kkz'})
    });
    const d = await r.json();
    if(d.ok) { alert(`✅ Пользователь ${login} создан с ролью ${ROLE_LABELS[role]}`); loadRolesUsers(); }
    else alert('Ошибка: ' + d.error);
  } catch(e) { alert('Ошибка: ' + e.message); }
}

// ═══ TELEGRAM ЗАДАНИЕ ДЛЯ ИНЖЕНЕРА ИРРИГАЦИИ ══════════════════════════════

async function sendIrrigationTask(zoneId, instruction, deadline) {
  // Отправляет задание инженеру ирригации через Telegram
  const zone = (S.irrigation.zones||[]).find(z=>z.id===zoneId);
  const msg = `💧 <b>Задание на полив</b>\n\n` +
    `🗺 Зона: <b>${zone?.name||zoneId}</b>\n` +
    `📋 Инструкция: ${instruction}\n` +
    `⏰ Срок: ${deadline||'сегодня'}\n\n` +
    `👤 Агроном: ${sessionStorage.getItem('agro_user_name')||'Агроном'}\n` +
    `📱 Войдите в систему → 💧 Ирригация → Записать полив`;

  try {
    const r = await fetch('/api/send-irrigation-task', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${sessionStorage.getItem('agro_jwt')||''}`},
      body: JSON.stringify({message: msg, zone: zone?.name, instruction, deadline})
    });
    return await r.json();
  } catch(e) { return {ok:false, error:e.message}; }
}

function openSendIrrigTaskModal() {
  const zones = S.irrigation.zones||[];
  if(!zones.length){alert('Сначала создайте зоны полива');return;}

  const zoneOpts = zones.map(z=>`<option value="${z.id}">${z.name}</option>`).join('');
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:24px;width:420px;max-width:94vw;">
      <h3 style="margin-bottom:16px;font-size:14px;">📱 Задание инженеру ирригации</h3>
      <div style="margin-bottom:10px;">
        <label style="font-size:11px;color:var(--text3);">Зона полива</label>
        <select id="irrig-task-zone" style="width:100%;padding:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);margin-top:4px;">${zoneOpts}</select>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:11px;color:var(--text3);">Инструкция</label>
        <textarea id="irrig-task-text" placeholder="Полить зону А, норма 20мм, давление 1.5 бар..." style="width:100%;height:80px;padding:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);resize:none;margin-top:4px;font-family:inherit;font-size:12px;"></textarea>
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-size:11px;color:var(--text3);">Срок выполнения</label>
        <input type="text" id="irrig-task-deadline" value="${new Date().toLocaleDateString('ru-RU')}" style="width:100%;padding:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);margin-top:4px;">
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="this.closest('div[style*=fixed]').remove()" class="btn btn-secondary">Отмена</button>
        <button onclick="
          const z=document.getElementById('irrig-task-zone').value;
          const t=document.getElementById('irrig-task-text').value;
          const d=document.getElementById('irrig-task-deadline').value;
          if(!t){alert('Введите инструкцию');return;}
          sendIrrigationTask(z,t,d).then(r=>{
            if(r.ok){alert('✅ Задание отправлено в Telegram');this.closest('div[style*=fixed]').remove();}
            else alert('Ошибка: '+(r.error||'нет'));
          });
        " class="btn btn-primary">📱 Отправить</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
