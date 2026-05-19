# Smart Agro v2.0

## Структура проекта

```
smart-agro/
├── server.js              # Express сервер (API + статика)
├── package.json
├── public/                # Статические файлы (раздаются браузеру)
│   ├── cherry-orchard-passport.html
│   ├── smart-vegetable.html
│   ├── app.css            # Все стили
│   ├── lib/
│   │   └── xlsx.min.js    # XLSX библиотека
│   └── js/                # JS модули (загружаются по порядку)
│       ├── app.js         # State, init, tabs, persist, calculations
│       ├── catalog.js     # Препараты, МОА-ротация
│       ├── treatments.js  # Обработки, дозы
│       ├── analysis.js    # Анализы, болезни, AI советник
│       ├── irrigation.js  # Полив, фертигация, water balance
│       ├── warehouse.js   # Склад
│       ├── weather.js     # Погода, стресс-детектор, прогноз
│       ├── map.js         # Карта, клетки, ряды
│       ├── dashboard.js   # Дашборд, персонал
│       ├── gdd.js         # GDD, Chill, BBCH, культуры, сорта
│       ├── fuel.js        # ГСМ модуль
│       ├── import.js      # XLS импорты
│       ├── tasks.js       # Журнал работ, посевная, отчёты
│       └── init.js        # Инициализация, роли, доступы
```

## Railway Variables

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | PostgreSQL (Railway даёт автоматически) |
| `ANTHROPIC_API_KEY` | Ключ Claude API |
| `FIELDCLIMATE_ID` | Публичный ключ FieldClimate |
| `FIELDCLIMATE_SECRET` | Приватный ключ FieldClimate |
| `JWT_SECRET` | Секрет для токенов (любая строка) |
| `PIN_OWNER` | PIN владельца (по умолч. 1111) |
| `PIN_AGRONOMIST` | PIN агронома (по умолч. 2222) |
| `PIN_DIRECTOR` | PIN директора (по умолч. 3333) |
| `PIN_OPERATOR` | PIN оператора (по умолч. 4444) |
