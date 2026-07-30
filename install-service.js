// Регистрация Smart Agro (server.js, порт 3002) как службы Windows с автозапуском.
// Переменные окружения берутся из .env через флаг node --env-file (секреты
// остаются только в .env, в конфиг службы не попадают).
// Запускать от имени администратора:  node install-service.js
const path = require('path');
const { Service } = require('node-windows');

const svc = new Service({
  name: 'smart-agro',
  description: 'Smart Agro — Node/Express, порт 3002',
  script: path.join(__dirname, 'server.js'),
  workingDirectory: __dirname,
  nodeOptions: ['--env-file=' + path.join(__dirname, '.env')],
  maxRestarts: 3,
  wait: 2,
  grow: 0.5,
});

svc.on('install', () => {
  console.log('[install-service] служба установлена, запускаю...');
  svc.start();
});
svc.on('alreadyinstalled', () => {
  console.log('[install-service] служба уже установлена');
  process.exit(0);
});
svc.on('start', () => {
  console.log('[install-service] служба ЗАПУЩЕНА: smart-agro (http://localhost:3002)');
  process.exit(0);
});
svc.on('error', (e) => {
  console.error('[install-service] ошибка:', e);
  process.exit(1);
});

console.log('[install-service] устанавливаю службу smart-agro...');
svc.install();
