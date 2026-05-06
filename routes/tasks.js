const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

async function sendTelegram(message) {
  try {
    const cfg = await db.query("SELECT value FROM settings WHERE key='telegram'");
    if (!cfg.rows.length) return;
    const { bot_token, group_chat_id } = cfg.rows[0].value;
    if (!bot_token || !group_chat_id) return;
    await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: group_chat_id, text: message, parse_mode: 'HTML' })
    });
  } catch (e) { console.error('Telegram error:', e.message); }
}

function buildMessage(task) {
  const due = task.due_date ? new Date(task.due_date).toLocaleDateString('ru-RU') : '—';
  const chems = task.chemicals ? JSON.parse(task.chemicals) : [];
  const chemStr = chems.length ? '\n💊 ' + chems.map(c=>`${c.name} ${c.dose_actual||c.dose_default||''}`).join(', ') : '';
  return `🌿 <b>ЗАДАНИЕ #${task.id.slice(-4).toUpperCase()}</b>\n📋 <b>${task.work_type_name||'Работа'}</b>\n🌱 ${task.parcel_name||'—'}${task.total_ha?' ('+task.total_ha+' га)':''}\n📝 ${task.description||''}${chemStr}\n👤 Агроном: ${task.created_by_name||'—'}\n👷 Исполнитель: ${task.assigned_to_name||'—'}\n📅 Срок: ${due}`;
}

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { work_type_id, work_type_name, description, parcel_id, parcel_name,
            parcels_json, total_ha, chemicals,
            created_by_id, created_by_name, assigned_to_id, assigned_to_name,
            due_date } = req.body;
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO tasks (id, work_type_id, work_type_name, description,
        parcel_id, parcel_name, parcels_json, total_ha, chemicals,
        created_by_id, created_by_name, assigned_to_id, assigned_to_name,
        due_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'new') RETURNING *`,
      [id, work_type_id||null, work_type_name||null, description||null,
       parcel_id||null, parcel_name||null,
       parcels_json||null, total_ha||null, chemicals||null,
       created_by_id||null, created_by_name||null,
       assigned_to_id||null, assigned_to_name||null,
       due_date||null]
    );
    const task = result.rows[0];
    await sendTelegram(buildMessage(task));
    await db.query('UPDATE tasks SET telegram_sent=true, telegram_sent_at=NOW() WHERE id=$1', [id]);
    res.status(201).json(task);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status, problem_note, closed_by_name,
            equipment_id, equipment_name, attachment,
            mechanic_id, mechanic_name, speed_kmh, note } = req.body;
    const allowed = ['new','assigned','accepted','in_progress','done','closed','problem'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    let q = `UPDATE tasks SET status=$1, updated_at=NOW()`;
    const params = [status];

    if (status === 'in_progress') q += `, started_at=NOW()`;
    if (status === 'done' || status === 'closed') q += `, finished_at=NOW()`;
    if (problem_note)   { params.push(problem_note);   q += `, problem_note=$${params.length}`; }
    if (closed_by_name) { params.push(closed_by_name); q += `, closed_by_name=$${params.length}`, q += `, closed_at=NOW()`; }
    if (equipment_id)   { params.push(equipment_id);   q += `, equipment_id=$${params.length}`;
                          params.push(equipment_name);  q += `, equipment_name=$${params.length}`; }
    if (attachment)     { params.push(attachment);      q += `, attachment=$${params.length}`; }
    if (mechanic_id)    { params.push(mechanic_id);     q += `, mechanic_id=$${params.length}`;
                          params.push(mechanic_name);   q += `, mechanic_name=$${params.length}`; }
    if (speed_kmh)      { params.push(speed_kmh);       q += `, speed_kmh=$${params.length}`; }
    if (note)           { params.push(note);             q += `, note=$${params.length}`; }

    params.push(req.params.id);
    q += ` WHERE id=$${params.length} RETURNING *`;
    const result = await db.query(q, params);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    const task = result.rows[0];

    if (status === 'assigned') {
      await sendTelegram(`🔧 <b>Техника назначена #${task.id.slice(-4).toUpperCase()}</b>\n📋 ${task.work_type_name||''}\n🌱 ${task.parcel_name||'—'}\n🚜 ${task.equipment_name||'—'} · ${task.attachment||'—'}\n👷 Механизатор: ${task.mechanic_name||'—'}`);
    }
    if (status === 'accepted') {
      await sendTelegram(`✓ <b>Задание принято #${task.id.slice(-4).toUpperCase()}</b>\n👷 ${task.mechanic_name||task.assigned_to_name||'—'}`);
    }
    if (status === 'in_progress') {
      await sendTelegram(`▶ <b>Работа начата #${task.id.slice(-4).toUpperCase()}</b>\n📋 ${task.work_type_name||''}\n🌱 ${task.parcel_name||'—'}\n👷 ${task.mechanic_name||'—'}`);
    }
    if (status === 'done') {
      await sendTelegram(`✅ <b>Работа завершена #${task.id.slice(-4).toUpperCase()}</b>\n📋 ${task.work_type_name||''}\n🌱 ${task.parcel_name||'—'}\n👷 ${task.mechanic_name||'—'}\n⏳ Ожидает подтверждения агронома`);
    }
    if (status === 'closed') {
      await sendTelegram(`🎉 <b>Задание закрыто #${task.id.slice(-4).toUpperCase()}</b>\n📋 ${task.work_type_name||''}\n✅ Подтвердил: ${task.closed_by_name||'—'}`);
    }
    if (status === 'problem') {
      await sendTelegram(`⚠️ <b>ПРОБЛЕМА #${task.id.slice(-4).toUpperCase()}</b>\n👷 ${task.mechanic_name||task.assigned_to_name||'—'}\n❗ ${problem_note}`);
    }
    res.json(task);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
