// Smart Agro — admin.js
// Компании, пользователи, доступ по культурам (мультитенантность)

let _adminCurrentCompanyId = null;
let _adminCurrentCompanyName = '';

const CROP_ACCESS_LABELS = {
  none:     { label:'Нет доступа',   color:'var(--text3)' },
  trial:    { label:'Пробный',       color:'var(--blue)' },
  paid:     { label:'Оплачен',       color:'var(--accent)' },
  disabled: { label:'Отключён',      color:'var(--red)' },
};

function cropLabel(cropId) {
  const c = (S.crops||[]).find(x=>x.id===cropId);
  return c ? `${c.emoji||'🌱'} ${c.name}` : cropId;
}

// ═══ КОМПАНИИ ═══════════════════════════════════════════════════════════
async function renderAdminCompanies() {
  const el = document.getElementById('admin-companies-list');
  el.innerHTML = '<div style="color:var(--text3);font-size:12px;">Загрузка...</div>';
  try {
    const r = await fetch('/api/admin/companies', { headers: getAuthHeaders() });
    const d = await r.json();
    if (!d.ok) { el.innerHTML = `<div style="color:var(--red);font-size:12px;">${d.error||'Ошибка'}</div>`; return; }
    if (!d.data.length) { el.innerHTML = '<div style="color:var(--text3);font-size:12px;">Компаний пока нет</div>'; return; }
    el.innerHTML = `<table class="data-table">
      <thead><tr><th>Компания</th><th>Статус</th><th>Создана</th><th></th></tr></thead>
      <tbody>${d.data.map(c => `
        <tr>
          <td style="font-weight:600;">${c.name}</td>
          <td>${c.status==='active' ? '<span class="badge badge-green">Активна</span>' : '<span class="badge badge-red">Приостановлена</span>'}</td>
          <td style="font-size:11px;color:var(--text3);">${String(c.created_at).slice(0,10)}</td>
          <td><button class="btn btn-secondary btn-xs" onclick="openCompanyDetail(${c.id},'${c.name.replace(/'/g,"\\'")}')">Открыть</button></td>
        </tr>`).join('')}</tbody>
    </table>`;
  } catch(e) { el.innerHTML = `<div style="color:var(--red);font-size:12px;">Ошибка загрузки: ${e.message}</div>`; }
}

function openCompanyAddModal() {
  document.getElementById('cmp-name').value = '';
  document.getElementById('cmp-username').value = '';
  document.getElementById('cmp-password').value = '';
  document.getElementById('cmp-role').value = 'owner';
  openModal('modal-company-add');
}

async function saveCompany() {
  const name = document.getElementById('cmp-name').value.trim();
  if (!name) { alert('Введите название компании'); return; }
  const username = document.getElementById('cmp-username').value.trim();
  const password = document.getElementById('cmp-password').value;
  const role = document.getElementById('cmp-role').value;
  try {
    const r = await fetch('/api/admin/companies', {
      method:'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ name, username: username||undefined, password: password||undefined, role })
    });
    const d = await r.json();
    if (!d.ok) { alert('Ошибка: ' + d.error); return; }
    closeModal('modal-company-add');
    renderAdminCompanies();
  } catch(e) { alert('Ошибка: ' + e.message); }
}

function openCompanyDetail(companyId, name) {
  _adminCurrentCompanyId = companyId;
  _adminCurrentCompanyName = name;
  document.getElementById('admin-detail-title').textContent = '🏢 ' + name;
  document.getElementById('admin-company-detail').style.display = 'block';
  renderAdminUsers();
  renderAdminCropAccess();
}

// ═══ ПОЛЬЗОВАТЕЛИ ═══════════════════════════════════════════════════════
const ROLE_LABELS_ADMIN = { owner:'👑 Владелец', agronomist:'🌱 Агроном', accountant:'💼 Бухгалтер', director:'📋 Директор', operator:'⚙️ Оператор' };

async function renderAdminUsers() {
  const el = document.getElementById('admin-users-list');
  if (!_adminCurrentCompanyId) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:12px;">Загрузка...</div>';
  try {
    const r = await fetch(`/api/admin/users?companyId=${_adminCurrentCompanyId}`, { headers: getAuthHeaders() });
    const d = await r.json();
    if (!d.ok) { el.innerHTML = `<div style="color:var(--red);font-size:12px;">${d.error||'Ошибка'}</div>`; return; }
    if (!d.data.length) { el.innerHTML = '<div style="color:var(--text3);font-size:12px;">Пользователей нет</div>'; return; }
    el.innerHTML = `<table class="data-table">
      <thead><tr><th>Логин</th><th>Роль</th><th>Статус</th><th></th></tr></thead>
      <tbody>${d.data.map(u => `
        <tr>
          <td style="font-weight:600;">${u.username}</td>
          <td style="font-size:11px;">${ROLE_LABELS_ADMIN[u.role]||u.role}</td>
          <td>${u.active ? '<span class="badge badge-green">Активен</span>' : '<span class="badge badge-red">Отключён</span>'}</td>
          <td><button class="btn btn-secondary btn-xs" onclick="toggleUserActive(${u.id},${!u.active})">${u.active?'Отключить':'Включить'}</button></td>
        </tr>`).join('')}</tbody>
    </table>`;
  } catch(e) { el.innerHTML = `<div style="color:var(--red);font-size:12px;">Ошибка загрузки: ${e.message}</div>`; }
}

function openUserAddModal() {
  if (!_adminCurrentCompanyId) { alert('Сначала откройте компанию'); return; }
  document.getElementById('usr-username').value = '';
  document.getElementById('usr-password').value = '';
  document.getElementById('usr-role').value = 'agronomist';
  openModal('modal-user-add');
}

async function saveUser() {
  const username = document.getElementById('usr-username').value.trim();
  const password = document.getElementById('usr-password').value;
  const role = document.getElementById('usr-role').value;
  if (!username || !password) { alert('Заполните логин и пароль'); return; }
  try {
    const r = await fetch('/api/admin/users', {
      method:'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ companyId: _adminCurrentCompanyId, username, password, role })
    });
    const d = await r.json();
    if (!d.ok) { alert('Ошибка: ' + d.error); return; }
    closeModal('modal-user-add');
    renderAdminUsers();
  } catch(e) { alert('Ошибка: ' + e.message); }
}

async function toggleUserActive(userId, active) {
  try {
    await fetch(`/api/admin/users/${userId}`, {
      method:'PUT', headers: getAuthHeaders(), body: JSON.stringify({ active })
    });
    renderAdminUsers();
  } catch(e) { alert('Ошибка: ' + e.message); }
}

// ═══ ДОСТУП ПО КУЛЬТУРАМ ════════════════════════════════════════════════
async function renderAdminCropAccess() {
  const el = document.getElementById('admin-crop-access-list');
  if (!_adminCurrentCompanyId) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:12px;">Загрузка...</div>';
  try {
    const r = await fetch(`/api/admin/crop-access?companyId=${_adminCurrentCompanyId}`, { headers: getAuthHeaders() });
    const d = await r.json();
    if (!d.ok) { el.innerHTML = `<div style="color:var(--red);font-size:12px;">${d.error||'Ошибка'}</div>`; return; }
    el.innerHTML = `<table class="data-table">
      <thead><tr><th>Культура</th><th>Статус</th><th>Пробный до</th><th>Оплата подтверждена</th><th></th></tr></thead>
      <tbody>${d.data.map(row => {
        const st = CROP_ACCESS_LABELS[row.status] || CROP_ACCESS_LABELS.none;
        const actions = [];
        if (row.status !== 'paid') actions.push(`<button class="btn btn-secondary btn-xs" onclick="openTrialModal('${row.crop_id}')">🎁 Пробный</button>`);
        if (row.status !== 'paid') actions.push(`<button class="btn btn-secondary btn-xs" onclick="confirmCropPayment('${row.crop_id}')">💳 Подтвердить оплату</button>`);
        if (row.paid_confirmed_at && row.status !== 'paid') actions.push(`<button class="btn btn-primary btn-xs" onclick="enableCropAccess('${row.crop_id}')">✅ Включить</button>`);
        if (row.status !== 'disabled' && row.status !== 'none') actions.push(`<button class="btn btn-danger btn-xs" onclick="disableCropAccess('${row.crop_id}')">🚫 Отключить</button>`);
        return `<tr>
          <td style="font-weight:600;">${cropLabel(row.crop_id)}</td>
          <td><span style="color:${st.color};font-weight:600;">${st.label}</span></td>
          <td style="font-size:11px;color:var(--text3);">${row.trial_expires_at ? String(row.trial_expires_at).slice(0,10) : '—'}</td>
          <td style="font-size:11px;color:var(--text3);">${row.paid_confirmed_at ? String(row.paid_confirmed_at).slice(0,10) : '—'}</td>
          <td style="display:flex;gap:4px;flex-wrap:wrap;">${actions.join('')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  } catch(e) { el.innerHTML = `<div style="color:var(--red);font-size:12px;">Ошибка загрузки: ${e.message}</div>`; }
}

function openTrialModal(cropId) {
  document.getElementById('trial-crop-id').value = cropId;
  const start = today();
  document.getElementById('trial-start').value = start;
  document.getElementById('trial-end').value = start;
  openModal('modal-trial-access');
}

async function saveTrialAccess() {
  const cropId = document.getElementById('trial-crop-id').value;
  const start = document.getElementById('trial-start').value;
  const end = document.getElementById('trial-end').value;
  if (!start || !end) { alert('Укажите обе даты'); return; }
  const days = (new Date(end) - new Date(start)) / 86400000;
  if (!(days > 0) || days > 365) { alert('Пробный период не может быть больше 365 дней'); return; }
  try {
    const r = await fetch('/api/admin/crop-access/trial', {
      method:'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ companyId: _adminCurrentCompanyId, cropId, trialStartedAt: start, trialExpiresAt: end })
    });
    const d = await r.json();
    if (!d.ok) { alert('Ошибка: ' + d.error); return; }
    closeModal('modal-trial-access');
    renderAdminCropAccess();
  } catch(e) { alert('Ошибка: ' + e.message); }
}

async function confirmCropPayment(cropId) {
  if (!confirm('Подтвердить получение оплаты за ' + cropLabel(cropId) + '?')) return;
  try {
    const r = await fetch('/api/admin/crop-access/confirm-payment', {
      method:'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ companyId: _adminCurrentCompanyId, cropId })
    });
    const d = await r.json();
    if (!d.ok) { alert('Ошибка: ' + d.error); return; }
    renderAdminCropAccess();
  } catch(e) { alert('Ошибка: ' + e.message); }
}

async function enableCropAccess(cropId) {
  try {
    const r = await fetch('/api/admin/crop-access/enable', {
      method:'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ companyId: _adminCurrentCompanyId, cropId })
    });
    const d = await r.json();
    if (!d.ok) { alert('Ошибка: ' + d.error); return; }
    renderAdminCropAccess();
  } catch(e) { alert('Ошибка: ' + e.message); }
}

async function disableCropAccess(cropId) {
  if (!confirm('Отключить доступ к ' + cropLabel(cropId) + '?')) return;
  try {
    const r = await fetch('/api/admin/crop-access/disable', {
      method:'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ companyId: _adminCurrentCompanyId, cropId })
    });
    const d = await r.json();
    if (!d.ok) { alert('Ошибка: ' + d.error); return; }
    renderAdminCropAccess();
  } catch(e) { alert('Ошибка: ' + e.message); }
}
