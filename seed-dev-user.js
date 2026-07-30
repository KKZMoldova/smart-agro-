// Заводит локального пользователя для входа через форму /login.
//
// Только для локальной копии базы — скрипт откажется работать, если DATABASE_URL
// смотрит не на localhost. В API создания пользователей нет, поэтому пишем в базу
// напрямую, тем же scrypt-хэшем, что и server.js.
//
// Запуск:  node --env-file=.env seed-dev-user.js [логин] [пароль] [роль]
// По умолчанию: dev / dev12345 / owner, компания 1 (KKZ).

const { Pool } = require('pg');
const crypto = require('crypto');

const [, , username = 'dev', password = 'dev12345', role = 'owner'] = process.argv;
const COMPANY_ID = 1;

const url = process.env.DATABASE_URL || '';
if (!/@(localhost|127\.0\.0\.1)[:\/]/.test(url)) {
  console.error('Отказ: DATABASE_URL не указывает на localhost.');
  console.error('Скрипт предназначен только для локальной копии, не для боевой базы.');
  process.exit(1);
}

function hashPassword(pw) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(pw, salt, 64, (err, key) => {
      if (err) return reject(err);
      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

(async () => {
  const db = new Pool({ connectionString: url, ssl: false });
  try {
    const hash = await hashPassword(password);
    const r = await db.query(
      `INSERT INTO public.agro_users (company_id, username, password_hash, role, active, must_change_password)
       VALUES ($1, $2, $3, $4, true, false)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash,
                                            role = EXCLUDED.role,
                                            active = true,
                                            must_change_password = false
       RETURNING id, username, role, company_id`,
      [COMPANY_ID, username, hash, role]
    );
    const u = r.rows[0];
    console.log(`Готово: id=${u.id}  логин=${u.username}  роль=${u.role}  компания=${u.company_id}`);
    console.log(`Вход: http://localhost:${process.env.PORT || 3000}/login`);
  } catch (e) {
    console.error('Ошибка:', e.message);
    process.exit(1);
  } finally {
    await db.end();
  }
})();
