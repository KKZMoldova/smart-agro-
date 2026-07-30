// Заводит пользователя в БОЕВОЙ базе (Railway).
//
// Пишет в прод — поэтому требует явного флага --yes и никогда не запускается случайно.
// Пароль задаётся временный, с флагом must_change_password: при первом входе
// приложение само попросит задать свой (см. форму change-form в login.html).
//
// Существующие аккаунты не трогает: при конфликте логина — отказ, а не перезапись.
//
// Запуск:  node create-prod-user.js --yes <логин> <врем.пароль> [роль] [company_id]

const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (!args.includes('--yes')) {
  console.error('Отказ: нужен флаг --yes. Скрипт пишет в БОЕВУЮ базу.');
  process.exit(1);
}
const [username, tempPassword, role = 'owner', companyId = '1'] = args.filter(a => a !== '--yes');
if (!username || !tempPassword) {
  console.error('Использование: node create-prod-user.js --yes <логин> <врем.пароль> [роль] [company_id]');
  process.exit(1);
}

// Боевая строка живёт только здесь и только для этого скрипта.
const envFile = path.join(__dirname, '.env.prod-source');
const line = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find(l => /^\s*PROD_DATABASE_URL\s*=/.test(l));
const url = line ? line.replace(/^\s*PROD_DATABASE_URL\s*=\s*/, '').trim() : '';
if (!url) { console.error('Нет PROD_DATABASE_URL в .env.prod-source'); process.exit(1); }
if (/localhost|127\.0\.0\.1/.test(url)) { console.error('PROD_DATABASE_URL указывает на localhost — это не прод.'); process.exit(1); }

function hashPassword(pw) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(pw, salt, 64, (err, key) => err ? reject(err) : resolve(`${salt}:${key.toString('hex')}`));
  });
}

(async () => {
  const db = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    const exists = await db.query('SELECT id FROM public.agro_users WHERE username=$1', [username]);
    if (exists.rows.length) {
      console.error(`Отказ: пользователь "${username}" уже существует (id=${exists.rows[0].id}). Пароль не менялся.`);
      process.exit(1);
    }
    const hash = await hashPassword(tempPassword);
    const r = await db.query(
      `INSERT INTO public.agro_users (company_id, username, password_hash, role, active, must_change_password)
       VALUES ($1, $2, $3, $4, true, true)
       RETURNING id, username, role, company_id, must_change_password`,
      [Number(companyId), username, hash, role]
    );
    const u = r.rows[0];
    console.log(`Создан в проде: id=${u.id}  логин=${u.username}  роль=${u.role}  компания=${u.company_id}`);
    console.log(`Смена пароля при первом входе: ${u.must_change_password}`);
  } catch (e) {
    console.error('Ошибка:', e.message);
    process.exit(1);
  } finally {
    await db.end();
  }
})();
