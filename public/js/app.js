// Smart Agro — app.js
// ===================== STATE =====================
let S = {
  rows:6, cols:8,
  warehouse: { chemicals: [], parts: [], seeds: [], history: [] },
  irrigEquip: { pumps: [], valves: [], drip: [], frost: [] },
  rootstocks: [],
  aiLog: [],
  techLog: {}, // {phaseKey: {tasks:{taskIdx:{done,date,comment}}, irrigNote, weatherNote, agronNote}} // [{id, date, type, prompt_summary, ai_text, photo_base64, comments:[{date,author,role,text}]}]
  varieties:[
    {id:'v1',name:'Регина',  ripening:'Поздний',pollType:'cross',pollinators:'Кордия, Наполеон, Карина',color:'vc0',note:'',cropId:'crop_cherry'},
    {id:'v2', name:'Кордия (Kordia)', ripening:'Средне-поздний', pollType:'cross',
     pollinators:'Регина, Саммит, Карина',
     color:'vc1', cropId:'crop_cherry',
     // Помологический паспорт (статья Kordia)
     origin: 'Чехия', year: 1963,
     fruitWeight: 10,        // 9-11 г
     fruitColor: 'Тёмно-бордовый, при созревании глянцево-чёрный',
     fruitFirmness: 'Очень плотная (Бигарро)',
     fruitTaste: 'Эталонный десертный, богатый сортовой аромат',
     brix: 19.5,             // 18-21% Brix
     crackResistance: '3',   // 3/5 — уязвима к дождю, нужна плёнка
     // Дерево
     vigor: 'Сильнорослый',
     crown: 'Раскидистая широкоокруглая, ветви поникают под урожаем',
     bearingYear: 3,
     yield: 14,              // 12-16 т/га на Gisela 5
     spacing: '4×2',
     rootstockRec: 'Гизела 5',
     // Устойчивость к болезням
     resMonilia: '4',        // высокая
     resCocco: '4',          // средне-высокая
     resClaster: '4',        // высокая
     resScab: '3',
     frost: '4',             // зимостойкость древесины 3.8/5
     // GDD и CP
     cp: 58,                 // 55-60 CP
     daysFlower: 52,         // созревает за ~52 дня от цветения
     // Генетика
     pollSAlleles: 'S3S6',   // самобесплодна
     note: 'Королева чёрных черешен. Созревает на 7-10 дней раньше Регины (20-25 июня Молдова). Регина (S1S3) и Кордия (S3S6) — частично совместимы, Кордия зацветает на 2-3 дня раньше. Растрескивание у вершины ягоды при дожде — ОБЯЗАТЕЛЬНА плёнка. Длинная плодоножка — удобна для сбора и гидрокулинга.',
    },
    {id:'v3',name:'Наполеон',ripening:'Средний',pollType:'cross',pollinators:'Коралл, Регина',  color:'vc2',note:'',cropId:'crop_cherry'},
    {id:'v4', name:'Скина (Skeena)', ripening:'Поздний', pollType:'self',
     pollinators:'Самоплодная — опылитель для Регины и Кордии',
     color:'vc3', cropId:'crop_cherry',
     // Помологический паспорт (статья Skeena)
     origin: 'Канада (Summerland, BC)', year: 1999,
     fruitWeight: 11.5,       // 11-12 г
     fruitColor: 'Тёмно-бордовый, при созревании насыщенно-чёрный',
     fruitFirmness: 'Высокая хрящеватость (Бигарро)',
     fruitTaste: 'Очень сладкий, насыщенный, сбалансированный',
     brix: 19,                // 18-20% Brix
     crackResistance: '4',    // 3.5/5 — лучше Кордии, уступает Регине
     // Дерево
     vigor: 'Среднерослый',
     crown: 'Полупрямостоячая, ветви под правильными углами — идеальна для Slender Spindle',
     bearingYear: 3,
     yield: 17,               // 15-19 т/га на Gisela 5
     spacing: '4×2',
     rootstockRec: 'Гизела 5',
     // Устойчивость к болезням
     resMonilia: '4',
     resCocco: '4',
     resClaster: '4',
     resScab: '4',
     frost: '4',              // 4.2/5 — высокая, канадская селекция
     // GDD и CP
     cp: 62,                  // 60-65 CP
     daysFlower: 55,          // между Кордией и Региной
     // Генетика
     pollSAlleles: 'S1S4\'',  // самоплодная
     note: 'Канадская селекция. Самоплодная (S1S4\') — одновременно даёт урожай и опыляет Регину и Кордию. Созревает между Кордией и Региной (конец июня — начало июля). Риск перегрузки урожаем → мельчание ягоды: обязательна нормировочная обрезка и фертигация в фазу налива. Пленку закрывать одновременно с Кордией.',
    },
    // Sour cherry varieties with full GDD profiles (base 4.5°C, 14 phases)
    {id:'vs1',name:'Молодёжная',  ripening:'Средний',pollType:'self',pollinators:'',color:'vc0',note:'Широко распространена в Молдове. Урожайный. Коккомикоз 5/5.',cropId:'crop_sour_cherry'},
    {id:'vs2',name:'Тургеневка',  ripening:'Поздний', pollType:'self',pollinators:'',color:'vc1',note:'Позднеспелая. Хорошая лёжкость плодов.',cropId:'crop_sour_cherry'},
    {id:'vs3',name:'Владимирская',ripening:'Средний',pollType:'cross',pollinators:'Тургеневка, Любская',color:'vc2',note:'Старинный сорт. Очень вкусный плод.',cropId:'crop_sour_cherry'},
    {id:'vs4',name:'Любская',     ripening:'Поздний', pollType:'self',pollinators:'',color:'vc4',note:'Позднеспелая, самоопыляемая. Высокий риск монилиоза.',cropId:'crop_sour_cherry'},
    // Sour cherry default varieties
    {id:'vs1',name:'Молодёжная',  ripening:'Средний',pollType:'self',pollinators:'',            color:'vc4',note:'Самоопыляемый. Средний срок. Универсальная.',cropId:'crop_sour_cherry'},
    {id:'vs2',name:'Любская',     ripening:'Поздний', pollType:'self',pollinators:'',            color:'vc5',note:'Самоопыляемый. Поздний. Кислая, для переработки.',cropId:'crop_sour_cherry'},
    {id:'vs3',name:'Шпанка',      ripening:'Ранний',  pollType:'cross',pollinators:'Любская',   color:'vc6',note:'Ранний. Сладко-кислая. Перекрёстное опыление.',cropId:'crop_sour_cherry'},
    {id:'vs4',name:'Норд Стар',   ripening:'Средний', pollType:'self',pollinators:'',            color:'vc7',note:'Самоопыляемый. Компактное дерево. Устойчив к болезням.',cropId:'crop_sour_cherry'},
    // Apple varieties with full GDD profiles
    {id:'va1',name:'Granny Smith',  ripening:'Поздний', pollType:'cross',pollinators:'Golden Delicious, Red Delicious',color:'vc3',note:'GDD 1750–1950. Высокий риск жары, мучнистой росы, fire blight. Зелёный, поздний сбор.',cropId:'crop_apple'},
    {id:'va2',name:'Red Delicious', ripening:'Средний', pollType:'cross',pollinators:'Golden Delicious, Jonagold',     color:'vc1',note:'GDD 1650–1850. Критичен цвет (ночные T° <18°C) и Ca-программа против bitter pit.',cropId:'crop_apple'},
    {id:'va3',name:'Jonagold',      ripening:'Средний', pollType:'cross',pollinators:'Golden Delicious, Granny Smith', color:'vc4',note:'GDD 1700–1900. Сильнорослый. Главные риски: fire blight (5) и парша (4).',cropId:'crop_apple'},
    {id:'va4',name:'Braeburn',      ripening:'Поздний', pollType:'cross',pollinators:'Granny Smith, Jonagold',         color:'vc5',note:'GDD 1800–2000. Поздний. Парша (5), мучнистая роса (4), стресс жары (4).',cropId:'crop_apple'},
  ],
  catalog:[
    {id:'p1',name:'Хорус',type:'fungicide',activeSubstance:'Ципродинил + Флудиоксонил',dose:0.2,water:400,duration:10,washMm:10,washType:'partial',method:'foliar',phi:7,hazard:3,targets:'Монилиоз, Коккомикоз',note:'Работает при низких температурах от +3°C'},
    {id:'p2',name:'Скор',type:'fungicide',activeSubstance:'Дифеноконазол',dose:0.2,water:400,duration:14,washMm:15,washType:'partial',method:'foliar',phi:20,hazard:3,targets:'Коккомикоз, Клястероспориоз',note:''},
    {id:'p3',name:'Актара',type:'insecticide',activeSubstance:'Тиаметоксам',dose:0.14,water:400,duration:21,washMm:25,washType:'resistant',method:'foliar',phi:14,hazard:2,targets:'Тля, Долгоносик, Вишнёвая муха',note:'Системный, не смывается дождём'},
    {id:'p4',name:'Топаз',type:'fungicide',activeSubstance:'Пенконазол',dose:0.15,water:400,duration:14,washMm:12,washType:'partial',method:'foliar',phi:14,hazard:3,targets:'Мучнистая роса',note:''},
  ],
  cells:{}, treatments:[], analyses:[], diseases:[],
  // IRRIGATION — sensors and readings
  irrigation: {
    method: 'percent',
    thresholds: { dry:15, low:25, ok:45, wet:55 },
    sensors: [],
    readings: [],
    zones: [],
    // zones: [{id, name, cellKeys[], valveId, pumpId, area, flowRate, pressure,
    //   dripperType, dripperFlow, drippersPerTree, irrigType, note}]
    waterBalance: {
      // {date, balance, rainfall, irrigation, etc, drainage}[]
      log: [],
      soilParams: {
        fc: 32,      // Field Capacity %VWC
        pwp: 14,     // Permanent Wilting Point %VWC
        rootDepth: 60, // cm
        bulkDensity: 1.35,
        infiltrationRate: 15, // mm/h
        wetArea: 60, // % wetted area
      },
    },
    events: [], // факт полива: [{id,date,zoneId,cellKeys,durationMin,volumeM3,mm,note,phase}]
    fertigation: {
      // программы фертигации
      programs: [],
      // анализы воды
      waterQuality: [],
    },
  },
  // ===== CHILL PORTIONS (Dynamic Model) =====
  chillPortions: {
    seasonStart: null,
    seasonEnd: null,
    // cultivarSettings: per-variety (cherries mainly)
    cultivarSettings: [
      {varietyId:'v1', name:'Регина (Regina)',  cpMin:65, cpTarget:68, cpMax:72, isActive:true, gddStartDate:null},
      {varietyId:'v2', name:'Кордия (Kordia)', cpMin:55, cpTarget:58, cpMax:62, isActive:true, gddStartDate:null},
      {varietyId:'v3', name:'Наполеон',         cpMin:50, cpTarget:55, cpMax:60, isActive:true, gddStartDate:null},
      {varietyId:'v4', name:'Скина (Skeena)', cpMin:60, cpTarget:62, cpMax:65, isActive:true, gddStartDate:null},
    ],
    // cropSettings: per-crop CP requirements (for cultures without per-variety data)
    cropSettings: [
      {cropId:'crop_cherry',      name:'Черешня',       emoji:'🍒', cpMin:45, cpTarget:55, cpMax:70},
      {cropId:'crop_sour_cherry', name:'Вишня',         emoji:'🍒', cpMin:40, cpTarget:50, cpMax:65},
      {cropId:'crop_apricot',     name:'Абрикос',       emoji:'🍑', cpMin:30, cpTarget:40, cpMax:55},
      {cropId:'crop_apple',       name:'Яблоко',        emoji:'🍎', cpMin:40, cpTarget:55, cpMax:75},
      {cropId:'crop_peach',       name:'Персик',        emoji:'🍑', cpMin:25, cpTarget:45, cpMax:60},
      {cropId:'crop_plum',        name:'Слива',         emoji:'🫐', cpMin:35, cpTarget:50, cpMax:65},
      {cropId:'crop_grape',       name:'Виноград',      emoji:'🍇', cpMin:10, cpTarget:20, cpMax:35},
      {cropId:'crop_walnut',      name:'Грецкий орех',  emoji:'🌰', cpMin:30, cpTarget:45, cpMax:60},
    ],
    dailyLog: [],
  },
  // All cultures — fully parameterized, no hardcoding in engine
  crops: [
    {
      id:'crop_cherry', name:'Черешня', emoji:'🍒', baseTemp:4.5,
      nutrientNorms:{N:125,P2O5:55,K2O:155,Ca:50,Mg:20}, // Sela App.II: 15 т/га
      phases:[
        {name:'Покой',              color:'#374151'},
        {name:'Набухание почек',    color:'#78350f'},
        {name:'Зелёный конус',      color:'#166534'},
        {name:'Розовый бутон',      color:'#9d174d'},
        {name:'Цветение',           color:'#f9a8d4'},
        {name:'Завязь',             color:'#86efac'},
        {name:'Рост плода',         color:'#4ade80'},
        {name:'Начало окрашивания', color:'#eab308'},
        {name:'Созревание',         color:'#dc2626'},
        {name:'После сбора',        color:'#92400e'},
      ],
      diseases:['dc1','dc2','dc3','dc4','dc5','dc6','dc7'], // refs to diseaseCatalog
      pests:[
        {id:'p_cfly',name:'Вишнёвая муха',gddThreshold:300,phaseRisk:'Созревание',alertLevel:'spray',products:'Актара, Калипсо',recommendation:'Жёлтые ловушки. Обработка при первых уловах.'},
        {id:'p_aph', name:'Вишнёвая тля', gddThreshold:100,phaseRisk:'Завязь',    alertLevel:'watch',products:'Актара, Биотлин',recommendation:'Осмотр верхушек побегов.'},
        {id:'p_wvl', name:'Долгоносик',   gddThreshold:60, phaseRisk:'Розовый бутон',alertLevel:'spray',products:'Актара, Децис',recommendation:'Встряхивание ветвей утром.'},
      ],
      note:'Косточковая культура. База 5°C. Молдова: цветение апрель.',
      kc:{dormant:0.50, flowering:0.75, fruitGrowth:1.05, ripening:0.90, postHarvest:0.65},
    },
    {
      id:'crop_apricot', name:'Абрикос', emoji:'🍑', baseTemp:4,
      nutrientNorms:{N:110,P2O5:50,K2O:140,Ca:45,Mg:18},
      phases:[
        {name:'Покой',              color:'#374151'},
        {name:'Набухание почек',    color:'#78350f'},
        {name:'Зелёный конус',      color:'#166534'},
        {name:'Розовый бутон',      color:'#9d174d'},
        {name:'Цветение',           color:'#fda4af'},
        {name:'Завязь',             color:'#86efac'},
        {name:'Рост плода',         color:'#4ade80'},
        {name:'Созревание',         color:'#f97316'},
        {name:'После сбора',        color:'#92400e'},
      ],
      diseases:['dc1','dc3','dc5'], // монилиоз, клястероспориоз, бактериальный рак
      pests:[
        {id:'pa_moth',name:'Плодожорка',gddThreshold:200,phaseRisk:'Рост плода',alertLevel:'spray',products:'Децис, Калипсо',recommendation:'Феромонные ловушки для мониторинга.'},
        {id:'pa_aph', name:'Тля зелёная',gddThreshold:80, phaseRisk:'Завязь',   alertLevel:'watch',products:'Актара',recommendation:'Осмотр молодых побегов.'},
      ],
      note:'Раннецветущая. Чувствителен к весенним заморозкам. База 4°C.',
      kc:{dormant:0.50, flowering:0.75, fruitGrowth:1.00, ripening:0.90, postHarvest:0.65},
    },
    {
      id:'crop_apple', name:'Яблоко', emoji:'🍎', baseTemp:4.5,
      nutrientNorms:{N:170,P2O5:74,K2O:240,Ca:80,Mg:30}, // Sela App.II: 60 т/га
      phases:[
        {name:'Покой',              color:'#374151'},
        {name:'Набухание почек',    color:'#78350f'},
        {name:'Зелёный конус',      color:'#166534'},
        {name:'Мышиное ухо',        color:'#15803d'},
        {name:'Розовый бутон',      color:'#9d174d'},
        {name:'Цветение',           color:'#fda4af'},
        {name:'Завязь',             color:'#86efac'},
        {name:'Рост плода',         color:'#4ade80'},
        {name:'Созревание',         color:'#dc2626'},
        {name:'После сбора',        color:'#92400e'},
      ],
      diseases:[],
      pests:[
        {id:'app_codm',name:'Яблонная плодожорка',gddThreshold:250,phaseRisk:'Рост плода',alertLevel:'spray',products:'Калипсо, Димилин',recommendation:'Феромонные ловушки с апреля.'},
        {id:'app_saph',name:'Яблонная тля',       gddThreshold:100,phaseRisk:'Зелёный конус',alertLevel:'watch',products:'Актара, Биотлин',recommendation:'Осмотр листьев, обработка при колониях.'},
        {id:'app_scab',name:'Парша (sporothecium)',gddThreshold:150,phaseRisk:'Мышиное ухо',  alertLevel:'watch',products:'Хорус, Скор',recommendation:'Обработка при первых симптомах.'},
      ],
      note:'Семечковая. База 4.5°C. Высокие нормы Ca для предотвращения bitter pit.',
      kc:{dormant:0.55, flowering:0.80, fruitGrowth:1.10, ripening:0.95, postHarvest:0.70},
    },
    {
      id:'crop_peach', name:'Персик', emoji:'🍑', baseTemp:4,
      nutrientNorms:{N:135,P2O5:45,K2O:155,Ca:40,Mg:20}, // Sela App.II: 40 т/га
      phases:[
        {name:'Покой',              color:'#374151'},
        {name:'Набухание почек',    color:'#78350f'},
        {name:'Цветение',           color:'#fda4af'},
        {name:'Завязь',             color:'#86efac'},
        {name:'Рост плода I',       color:'#4ade80'},
        {name:'Рост плода II',      color:'#16a34a'},
        {name:'Созревание',         color:'#f97316'},
        {name:'После сбора',        color:'#92400e'},
      ],
      diseases:[],
      pests:[
        {id:'pe_curld',name:'Курчавость листьев',gddThreshold:50, phaseRisk:'Набухание почек',alertLevel:'spray',products:'Хорус, медь',recommendation:'Обработка ДО распускания почек.'},
        {id:'pe_moth', name:'Персиковая плодожорка',gddThreshold:220,phaseRisk:'Рост плода I',alertLevel:'spray',products:'Децис',recommendation:'Феромонные ловушки.'},
      ],
      note:'База 4°C. Очень чувствителен к заморозкам в цветение.',
      kc:{dormant:0.50, flowering:0.75, fruitGrowth:1.10, ripening:0.90, postHarvest:0.65},
    },
    {
      id:'crop_plum', name:'Слива', emoji:'🫐', baseTemp:4,
      nutrientNorms:{N:75,P2O5:38,K2O:110,Ca:30,Mg:15}, // Sela App.II: 25 т/га
      phases:[
        {name:'Покой',              color:'#374151'},
        {name:'Набухание почек',    color:'#78350f'},
        {name:'Зелёный конус',      color:'#166534'},
        {name:'Розовый бутон',      color:'#9d174d'},
        {name:'Цветение',           color:'#c084fc'},
        {name:'Завязь',             color:'#86efac'},
        {name:'Рост плода',         color:'#4ade80'},
        {name:'Созревание',         color:'#7c3aed'},
        {name:'После сбора',        color:'#92400e'},
      ],
      diseases:[],
      pests:[
        {id:'pl_saw', name:'Сливовый пилильщик',gddThreshold:90, phaseRisk:'Цветение',alertLevel:'spray',products:'Актара',recommendation:'Обработка до цветения при уловах.'},
        {id:'pl_moth',name:'Сливовая плодожорка',gddThreshold:250,phaseRisk:'Рост плода',alertLevel:'spray',products:'Калипсо',recommendation:'Феромонные ловушки с мая.'},
      ],
      note:'Невысокие нормы питания. База 4°C.',
      kc:{dormant:0.50, flowering:0.75, fruitGrowth:1.05, ripening:0.90, postHarvest:0.65},
    },
    {
      id:'crop_grape', name:'Виноград', emoji:'🍇', baseTemp:10,
      nutrientNorms:{N:80,P2O5:40,K2O:120,Ca:25,Mg:20},
      phases:[
        {name:'Покой',              color:'#374151'},
        {name:'Сокодвижение',       color:'#6b7280'},
        {name:'Распускание почек',  color:'#166534'},
        {name:'Рост побегов',       color:'#16a34a'},
        {name:'Цветение',           color:'#c084fc'},
        {name:'Завязь ягод',        color:'#86efac'},
        {name:'Рост ягод',          color:'#4ade80'},
        {name:'Véraison (окраска)', color:'#7c3aed'},
        {name:'Созревание',         color:'#581c87'},
        {name:'После сбора',        color:'#92400e'},
      ],
      diseases:[],
      pests:[
        {id:'gr_per',name:'Виноградная листовёртка',gddThreshold:150,phaseRisk:'Цветение',alertLevel:'watch',products:'Димилин',recommendation:'Феромонные ловушки для мониторинга.'},
        {id:'gr_acar',name:'Клещ паутинный',         gddThreshold:200,phaseRisk:'Рост ягод',alertLevel:'watch',products:'Акарицид',recommendation:'Осмотр нижней стороны листьев.'},
      ],
      note:'База 10°C! GDD считается от более высокой базы чем косточковые.',
      kc:{dormant:0.30, flowering:0.60, fruitGrowth:0.85, ripening:0.75, postHarvest:0.45},
    },
    {
      id:'crop_walnut', name:'Грецкий орех', emoji:'🌰', baseTemp:7,
      nutrientNorms:{N:90,P2O5:35,K2O:100,Ca:35,Mg:15},
      phases:[
        {name:'Покой',              color:'#374151'},
        {name:'Набухание почек',    color:'#78350f'},
        {name:'Распускание листьев',color:'#166534'},
        {name:'Цветение',           color:'#86efac'},
        {name:'Рост плода',         color:'#4ade80'},
        {name:'Созревание',         color:'#92400e'},
        {name:'После сбора',        color:'#374151'},
      ],
      diseases:[],
      pests:[],
      note:'База 7°C. Орехоплодная культура.',
      kc:{dormant:0.45, flowering:0.70, fruitGrowth:1.10, ripening:0.80, postHarvest:0.65},
    },
    {
      id:'crop_sour_cherry', name:'Вишня', emoji:'🍒', baseTemp:4.5,
      nutrientNorms:{N:90,P2O5:40,K2O:120,Ca:35,Mg:18},
      phases:[
        {name:'Покой',                  color:'#374151'}, // 0-60 GDD
        {name:'Набухание почек',        color:'#78350f'}, // 60-100
        {name:'Распускание почек',      color:'#92400e'}, // 100-150
        {name:'Зелёный конус',          color:'#166534'}, // 150-220
        {name:'Бутонизация',            color:'#9d174d'}, // 220-300
        {name:'Начало цветения',        color:'#fda4af'}, // 300-420
        {name:'Полное цветение',        color:'#f9a8d4'}, // 420-560
        {name:'Опадение лепестков',     color:'#86efac'}, // 560-680
        {name:'Завязь 4–8 мм',          color:'#4ade80'}, // 680-850
        {name:'Рост плода',             color:'#16a34a'}, // 850-1050
        {name:'Окрашивание плода',      color:'#eab308'}, // 1050-1250
        {name:'Созревание',             color:'#dc2626'}, // 1250-1450
        {name:'После сбора',            color:'#92400e'}, // 1450-1650
        {name:'Подготовка к листопаду', color:'#374151'}, // 1650+
      ],
      diseases:['dc1','dc2','dc3','dc4','dc5','dc6','dc7','dc11','dc12','dc13','dc14','dc15','dc16','dc17','dc18','dc19'],
      pests:[
        {id:'sc_fly',  name:'Вишнёвая муха',       gddThreshold:850,  phaseRisk:'Окрашивание плода', alertLevel:'spray', products:'Актара, Калипсо, Спинтор',  recommendation:'Жёлтые ловушки с начала июня. Обработка при 5+ мухах/ловушку. GDD 1050-1450 = КРИТИЧНО.'},
        {id:'sc_swd',  name:'Drosophila suzukii',   gddThreshold:1050, phaseRisk:'Окрашивание плода', alertLevel:'spray', products:'Спинтор, Калипсо',          recommendation:'Ловушки с дрожжевой приманкой. Красный риск при GDD>1050 + мягкий плод.'},
        {id:'sc_aph',  name:'Тля чёрная вишнёвая', gddThreshold:100,  phaseRisk:'Завязь',            alertLevel:'watch', products:'Актара, Конфидор, Биотлин', recommendation:'Осмотр побегов при T>15°C + активный рост. Скручивание = поздно.'},
        {id:'sc_wvl',  name:'Долгоносик (цветоед)', gddThreshold:60,  phaseRisk:'Набухание почек',   alertLevel:'spray', products:'Актара, Децис, Каратэ',     recommendation:'Встряхивание ветвей при T>12°C. Обработка ДО цветения.'},
        {id:'sc_mite', name:'Паутинный клещ',        gddThreshold:850, phaseRisk:'Рост плода',       alertLevel:'watch', products:'Омайт, Ниссоран, Акарициды', recommendation:'При T>28°C + RH<45% — вспышка. Осмотр нижней стороны листьев.'},
        {id:'sc_moth', name:'Плодожорка вишнёвая',   gddThreshold:300, phaseRisk:'Рост плода',       alertLevel:'spray', products:'Децис, Калипсо, Димилин',   recommendation:'Феромонные ловушки с мая. 2 генерации/сезон.'},
        {id:'sc_tort', name:'Листовёртки',            gddThreshold:220, phaseRisk:'Бутонизация',      alertLevel:'watch', products:'Димилин, Матч, Децис',      recommendation:'Феромонные ловушки. Обработка при отрождении гусениц.'},
        {id:'sc_saw',  name:'Пилильщики',             gddThreshold:100, phaseRisk:'Зелёный конус',    alertLevel:'watch', products:'Актара, Децис',             recommendation:'Скелетирование листьев с июня. Обработка при обнаружении.'},
      ],
      note:'Prunus cerasus. База 4.5°C (GDD-модель UC IPM). Молдова: коккомикоз+монилиоз+вишнёвая муха+бакрак = ТОП угрозы. После сбора — не бросать сад! Защита листа до осени = урожай следующего года.',
      kc:{dormant:0.50, flowering:0.75, fruitGrowth:1.00, ripening:0.85, postHarvest:0.60},
    },
  ],
  gddDb: {
    startDate: null,
    baseTemp: 4.5,  // Tbase черешни для Молдовы (международный стандарт +4.4-4.5°C)
    // История калибровок по годам: {varietyId: {year: {gddValues:[], dates:[], notes:[], calibratedAt:''}}}
    calibrationHistory: {},
    // Стандартные фазы — шаблон названий и цветов
    // Stored as template; actual per-variety values in varietyGdd
    standardPhases: [
      {name:'Покой',           color:'#374151'},
      {name:'Набухание почек', color:'#78350f'},
      {name:'Зелёный конус',   color:'#166534'},
      {name:'Розовый бутон',   color:'#9d174d'},
      {name:'Цветение',        color:'#f9a8d4'},
      {name:'Завязь',          color:'#86efac'},
      {name:'Рост плода',      color:'#4ade80'},
      {name:'Начало окрашивания', color:'#eab308'},
      {name:'Созревание',      color:'#dc2626'},
      {name:'После сбора',     color:'#92400e'},
    ],
    // varietyGdd: {varietyId: [gdd_start_for_each_phase]}
    // Array length = standardPhases.length, value = GDD at START of that phase
    // Last phase ends at 9999
    varietyGdd: {
      // Cherry varieties (10 phases, base 5°C)
      'v1': [0, 120, 225, 320, 465, 635, 760, 900, 1050, 1200],  // Регина (Молдова, cut-off 30°C)
      'v2': [0, 105, 200, 295, 420, 570, 650, 800, 950, 1100],  // Кордия (Kordia) — созревает на 7-10 дн. раньше Регины
      'v3': [0, 48, 115, 192, 270, 338, 485, 720, 900, 1050],  // Наполеон
      'v4': [0, 108, 207, 308, 438, 600, 690, 840, 990, 1140],  // Скина (Skeena) — между Кордией (650) и Региной (760)
      // Sour cherry varieties (14 phases, base 4.5°C — UC IPM GDD-модель)
      // Покой|Набухание|Распускание|Зелёный конус|Бутонизация|
      // Нач.цветения|Полн.цветения|Опад.лепестков|Завязь|Рост плода|
      // Окрашивание|Созревание|После сбора|Листопад
      'vs1': [0,60,100,150,220,300,420,560,680,850,1050,1250,1450,1650], // Молодёжная (средний)
      'vs2': [0,65,110,165,240,325,445,585,715,890,1090,1295,1495,1695], // Тургеневка (поздний)
      'vs3': [0,58,98, 148,215,295,410,550,670,840,1040,1240,1440,1640], // Владимирская (средний)
      'vs4': [0,65,112,162,238,325,445,585,715,885,1085,1290,1490,1690], // Любская (поздний)
      // Apple varieties (10 phases — base 4.5°C)
      'va1': [0, 60, 115, 170, 230, 340, 610, 760, 1750, 1950], // Granny Smith
      'va2': [0, 60, 110, 165, 220, 330, 590, 740, 1650, 1850], // Red Delicious
      'va3': [0, 60, 115, 170, 225, 340, 600, 750, 1700, 1900], // Jonagold
      'va4': [0, 60, 115, 175, 235, 350, 610, 770, 1800, 2000], // Braeburn
    },
    // OLD varietyPhases kept for backward compat but not used in new UI
    varietyPhases: {},
    // pestThresholds: [{id, name, gddThreshold, phaseRisk, alertLevel, products, recommendation}]
    pestThresholds: [
      {id:'pt1',name:'Вишнёвая муха',gddThreshold:300,phaseRisk:'Созревание',alertLevel:'spray',products:'Актара, Калипсо',recommendation:'Установить жёлтые клеевые ловушки. Обработка при первых уловах мух.'},
      {id:'pt2',name:'Вишнёвая тля',gddThreshold:100,phaseRisk:'Завязь',alertLevel:'watch',products:'Актара, Биотлин',recommendation:'Осмотр верхушек побегов. При колониях — обработка.'},
      {id:'pt3',name:'Долгоносик',gddThreshold:60,phaseRisk:'Розовый бутон',alertLevel:'spray',products:'Актара, Децис',recommendation:'Встряхивание ветвей утром. Обработка до цветения.'},
    ],
    // varietySensitivity: {varietyId: {diseaseCatalogId: 1-5 scale}}
    // 1=устойчивый, 2=слабо, 3=средний, 4=чувствительный, 5=очень чувствительный
    varietySensitivity: {
      // Cherry varieties {diseaseCatalogId: 1-5}
      'v1': {'dc1':4,'dc2':3,'dc3':2,'dc4':3,'dc5':3,'dc6':5,'dc7':3},
      'v2': {'dc1':3,'dc2':4,'dc3':3,'dc4':2,'dc5':3,'dc6':4,'dc7':2},
      'v3': {'dc1':3,'dc2':3,'dc3':4,'dc4':3,'dc5':2,'dc6':4,'dc7':3},
      'v4': {'dc1':2,'dc2':2,'dc3':3,'dc4':2,'dc5':2,'dc6':3,'dc7':2},
      // Apple varieties
      'va1': {'dc3':4,'dc4':5,'dc5':5}, // Granny Smith
      'va2': {'dc3':3,'dc4':3,'dc5':2}, // Red Delicious
      'va3': {'dc3':4,'dc4':4,'dc5':5}, // Jonagold
      'va4': {'dc3':5,'dc4':4,'dc5':3}, // Braeburn
      // Sour cherry varieties — коккомикоз(dc2) главная угроза
      // Все сорта вишни восприимчивы к коккомикозу — без устойчивых!
      // dc2=коккомикоз, dc1=монилиоз, dc3=клястероспориоз, dc5=бакрак, dc6=муха, dc11=антракноз
    },
  },  // end gddDb
  weather:[], // [{id, date, tmin, tmax, precip, humidity, wind, note}]
  // diseaseCatalog: scientific thresholds + custom diseases
  diseaseCatalog:[
    // ===== ЧЕРЕШНЯ + ВИШНЯ (общие) =====
    {id:'dc1',name:'Монилиоз',latin:'Monilia cinerea / M. laxa',type:'fungal',danger:5,
     cropIds:['crop_cherry','crop_sour_cherry','crop_apricot','crop_peach','crop_plum'],
     tmin:10,tmax:25,topt:20,hmin:75,rainMin:2,leafWetHours:4,rainDays:2,
     criticalPhases:['Цветение','Розовый бутон'],phase:'flowering',
     symptoms:'Побурение и усыхание цветков, завязей, молодых побегов. На плодах — серая гниль.',
     products:'Хорус, Свитч, Луна Транквилити',
     prevention:'Обработка в фазу розового бутона и начало цветения. Удаление мумифицированных плодов.'},
    {id:'dc2',name:'Коккомикоз',latin:'Blumeriella jaapii',type:'fungal',danger:5,
     cropIds:['crop_cherry','crop_sour_cherry'],
     tmin:10,tmax:28,topt:18,hmin:80,rainMin:3,leafWetHours:6,rainDays:3,
     criticalPhases:['Завязь','Рост плода'],phase:'all',
     symptoms:'Красно-бурые пятна на листьях. Розово-белый налёт спор снизу листа. Преждевременное опадение листвы.',
     products:'Скор, Топаз, Абига-Пик, Хорус',
     prevention:'Обработки с фазы распускания листьев. Уничтожение опавших листьев осенью. Триггер: листья > 6ч влажные + T > 12°C.'},
    {id:'dc3',name:'Клястероспориоз',latin:'Clasterosporium carpophilum',type:'fungal',danger:4,
     cropIds:['crop_cherry','crop_sour_cherry','crop_apricot','crop_peach','crop_plum'],
     tmin:4,tmax:30,topt:20,hmin:70,rainMin:2,leafWetHours:4,rainDays:2,
     criticalPhases:['Зелёный конус','Завязь'],phase:'all',
     symptoms:'Округлые бурые пятна на листьях, выпадающие — "дырки". Камедетечение на плодах.',
     products:'Хорус, Скор, медьсодержащие',
     prevention:'Ранневесенняя обработка медьсодержащими. Прореживание кроны для вентиляции.'},
    {id:'dc4',name:'Мучнистая роса',latin:'Podosphaera clandestina',type:'fungal',danger:3,
     cropIds:['crop_cherry','crop_sour_cherry'],
     tmin:10,tmax:32,topt:22,hmin:50,rainMin:0,leafWetHours:0,rainDays:0,
     criticalPhases:['Набухание почек','Зелёный конус'],phase:'all',
     symptoms:'Белый мучнистый налёт на молодых листьях и побегах. Листья скручиваются.',
     products:'Топаз, Тиовит Джет, Каратан',
     prevention:'Обработки при первых симптомах. Не допускать загущения кроны.'},
    {id:'dc5',name:'Бактериальный рак',latin:'Pseudomonas syringae',type:'bacterial',danger:5,
     cropIds:['crop_cherry','crop_sour_cherry','crop_apricot','crop_peach','crop_plum'],
     tmin:2,tmax:20,topt:12,hmin:80,rainMin:3,leafWetHours:5,rainDays:3,
     criticalPhases:['Покой','Набухание почек'],phase:'all',
     symptoms:'Тёмные язвы на ветвях. Камедетечение. Гибель ветвей. Риск потери сада при запоздалом реагировании.',
     products:'Медьсодержащие, Бордоская жидкость, Купроксат',
     prevention:'Обработка до распускания почек. Не обрезать в сырую погоду. Дезинфекция инструментов.'},
    {id:'dc6',name:'Вишнёвая муха',latin:'Rhagoletis cerasi',type:'insect',danger:5,
     cropIds:['crop_cherry','crop_sour_cherry'],
     tmin:15,tmax:35,topt:25,hmin:0,rainMin:0,leafWetHours:0,rainDays:0,
     criticalPhases:['Созревание','Начало окрашивания'],phase:'ripening',
     symptoms:'Личинки внутри плодов. Плоды деформируются, загнивают. Продукция = брак. GDD триггер: 800–900.',
     products:'Актара, Калипсо, Золон, Спинтор',
     prevention:'Жёлтые клеевые ловушки. Обработка при первых уловах мух. Строгий мониторинг.'},
    {id:'dc7',name:'Вишнёвая тля',latin:'Myzus cerasi',type:'insect',danger:4,
     cropIds:['crop_cherry','crop_sour_cherry'],
     tmin:8,tmax:28,topt:20,hmin:0,rainMin:0,leafWetHours:0,rainDays:0,
     criticalPhases:['Зелёный конус','Завязь'],phase:'all',
     symptoms:'Колонии чёрных тлей на концах побегов. Скручивание листьев. Липкая падь. Переносит вирусы.',
     products:'Актара, Конфидор, Биотлин',
     prevention:'Ранневесенняя обработка до распускания почек. Триггер: T > 15°C + рост побегов.'},
    // ===== ВИШНЯ (специфические) =====
    {id:'dc11',name:'Антракноз плодов',latin:'Colletotrichum acutatum',type:'fungal',danger:4,
     cropIds:['crop_sour_cherry','crop_cherry'],
     tmin:15,tmax:30,topt:25,hmin:80,rainMin:4,leafWetHours:6,rainDays:3,
     criticalPhases:['Рост плода','Созревание'],phase:'all',
     symptoms:'Тёмные вдавленные пятна на плодах. В дождливые годы — массовое поражение. Потеря товарного вида.',
     products:'Свитч, Хорус, Скор, Луна Транквилити',
     prevention:'Обработки в период роста плодов. Быстрый сбор урожая.'},
    {id:'dc12',name:'Ржавчина вишни',latin:'Tranzschelia pruni-spinosae',type:'fungal',danger:3,
     cropIds:['crop_sour_cherry','crop_cherry'],
     tmin:10,tmax:28,topt:18,hmin:70,rainMin:2,leafWetHours:4,rainDays:2,
     criticalPhases:['Рост плода'],phase:'all',
     symptoms:'Жёлтые угловатые пятна на листьях сверху. Оранжево-коричневые подушечки урединий снизу.',
     products:'Байлетон, Топаз, Цинебом',
     prevention:'Обработки при первых симптомах. Уничтожение опавших листьев.'},
    {id:'dc13',name:'Вертициллёз',latin:'Verticillium dahliae',type:'fungal',danger:4,
     cropIds:['crop_sour_cherry','crop_cherry'],
     tmin:10,tmax:28,topt:20,hmin:60,rainMin:0,leafWetHours:0,rainDays:0,
     criticalPhases:['Рост плода'],phase:'all',
     symptoms:'Внезапное увядание ветвей. Побурение сосудистой ткани. Усыхание без видимых причин.',
     products:'Нет эффективных фунгицидов — только профилактика',
     prevention:'Избегать повреждений корней. Не сажать после картофеля/томата. Удаление больных ветвей.'},
    {id:'dc14',name:'Вирусы (мозаика, карликовость)',latin:'PNRSV / PDV',type:'viral',danger:3,
     cropIds:['crop_sour_cherry','crop_cherry'],
     tmin:0,tmax:40,topt:20,hmin:0,rainMin:0,leafWetHours:0,rainDays:0,
     criticalPhases:['Всё время'],phase:'all',
     symptoms:'Деформация листьев, мозаичная окраска, карликовость побегов. Снижение урожая. Лечения нет.',
     products:'Нет — только профилактика и удаление',
     prevention:'Сертифицированный посадочный материал. Дезинфекция инструментов. Немедленное удаление больных деревьев.'},
    {id:'dc15',name:'Долгоносик (цветоед)',latin:'Anthonomus rectirostris',type:'insect',danger:4,
     cropIds:['crop_sour_cherry','crop_cherry'],
     tmin:8,tmax:25,topt:15,hmin:0,rainMin:0,leafWetHours:0,rainDays:0,
     criticalPhases:['Набухание почек','Зелёный конус','Розовый бутон'],phase:'all',
     symptoms:'Выеденные бутоны и цветки. Самки откладывают яйца в бутоны. Потеря завязи.',
     products:'Актара, Децис, Каратэ Зеон',
     prevention:'Стряхивание жуков ранним утром. Обработка до цветения при обнаружении жуков.'},
    {id:'dc16',name:'Плодожорка вишнёвая',latin:'Grapholita funebrana',type:'insect',danger:3,
     cropIds:['crop_sour_cherry','crop_cherry'],
     tmin:10,tmax:30,topt:22,hmin:0,rainMin:0,leafWetHours:0,rainDays:0,
     criticalPhases:['Рост плода','Созревание'],phase:'all',
     symptoms:'Червивые плоды. Гусеница в мякоти вокруг косточки. Липкие выделения у плодоножки.',
     products:'Калипсо, Децис, Димилин',
     prevention:'Феромонные ловушки для мониторинга. Обработка при массовом лёте бабочек.'},
    {id:'dc17',name:'Паутинный клещ',latin:'Tetranychus urticae',type:'insect',danger:4,
     cropIds:['crop_sour_cherry','crop_cherry'],
     tmin:20,tmax:40,topt:30,hmin:0,rainMin:0,leafWetHours:0,rainDays:0,
     criticalPhases:['Рост плода','Созревание'],phase:'all',
     symptoms:'Бледные обесцвеченные листья. Паутина на нижней стороне. Вспышка при жаре и сухости.',
     products:'Ниссоран, Санмайт, Омайт, акарициды',
     prevention:'Мониторинг нижней стороны листьев. Применять при T > 28°C + сухо.'},
    {id:'dc18',name:'Листовёртки',latin:'Archips sp.',type:'insect',danger:3,
     cropIds:['crop_sour_cherry','crop_cherry'],
     tmin:10,tmax:30,topt:20,hmin:0,rainMin:0,leafWetHours:0,rainDays:0,
     criticalPhases:['Зелёный конус','Завязь'],phase:'all',
     symptoms:'Свёрнутые листья, скреплённые шёлковыми нитями. Повреждённые завязи и молодые побеги.',
     products:'Децис, Каратэ, Димилин, Матч',
     prevention:'Феромонные ловушки. Обработка в фазу зелёного конуса.'},
    {id:'dc19',name:'Пилильщик вишнёвый',latin:'Caliroa cerasi',type:'insect',danger:3,
     cropIds:['crop_sour_cherry','crop_cherry'],
     tmin:15,tmax:32,topt:22,hmin:0,rainMin:0,leafWetHours:0,rainDays:0,
     criticalPhases:['Рост плода'],phase:'all',
     symptoms:'Личинки скелетируют листья, оставляя прозрачную кожицу. Листья буреют и опадают.',
     products:'Актара, Децис, Конфидор',
     prevention:'Мониторинг с июня. Обработка при первых личинках.'},
    // ===== ЯБЛОКО =====
    {id:'dc8',name:'Парша яблони',latin:'Venturia inaequalis',type:'fungal',danger:5,cropIds:['crop_apple'],
     tmin:6,tmax:24,topt:18,hmin:70,rainMin:2,leafWetHours:4,rainDays:2,
     criticalPhases:['Зелёный конус','Мышиное ухо','Розовый бутон'],phase:'all',
     symptoms:'Оливково-зелёные бархатистые пятна на листьях и плодах. Растрескивание, уродство плодов.',
     products:'Хорус, Делан, Мерпан, Скор, Топаз',
     prevention:'Обработка от "зелёного конуса". Уничтожение опавших листьев. Мониторинг Mills table.'},
    {id:'dc9',name:'Мучнистая роса яблони',latin:'Podosphaera leucotricha',type:'fungal',danger:4,cropIds:['crop_apple'],
     tmin:10,tmax:28,topt:20,hmin:40,rainMin:0,leafWetHours:0,rainDays:0,
     criticalPhases:['Набухание почек','Зелёный конус','Мышиное ухо','Цветение'],phase:'all',
     symptoms:'Белый мучнистый налёт на листьях, побегах, соцветиях. Деформация побегов.',
     products:'Топаз, Луна Экспириенс, Сера коллоидная, Тиовит',
     prevention:'Вырезать поражённые "ведьмины метлы" ранней весной. Не применять серу >28°C.'},
    {id:'dc10',name:'Плодожорка яблонная',latin:'Cydia pomonella',type:'pest',danger:4,cropIds:['crop_apple'],
     tmin:10,tmax:30,topt:22,hmin:0,rainMin:0,leafWetHours:0,rainDays:0,
     criticalPhases:['Завязь','Рост плода'],phase:'all',
     symptoms:'Характерный ход в мякоти плода с кучкой буроватых экскрементов. Опадение плодов.',
     products:'Калипсо, Декис, Димилин, Матч',
     prevention:'Феромонные ловушки с апреля. Обработка при 250 GDD (первый лёт).'},
  ],
  settings:{washPartial:10,washFull:25},
  selectedCell:null,
  editingCatalogId:null,
  editingWeatherId:null,
};

// ===================== CALCULATIONS =====================
// For one row-entry: trees per row = floor(rowLength / treeSpacing)
// rowCount = to - from + 1
// total trees = treesPerRow * rowCount
// area ha = rowCount * rowLength * rowSpacing / 10000

function calcRowEntry(entry, rowSpacing, treeSpacing) {
  const rowCount = Math.max(0, (parseInt(entry.to)||0) - (parseInt(entry.from)||0) + 1);
  const rowLength = parseFloat(entry.rowLength) || 0;
  const ts = parseFloat(treeSpacing) || 1;
  const rs = parseFloat(rowSpacing) || 1;
  const treesPerRow = rowLength > 0 ? Math.floor(rowLength / ts) : 0;
  const totalTrees = treesPerRow * rowCount;
  const areaHa = rowCount * rowLength * rs / 10000;
  return { rowCount, treesPerRow, totalTrees, areaHa };
}

function calcCellTotals(cd) {
  if (!cd || !cd.rows) return { totalHa:0, totalTrees:0, byVariety:{} };
  const rs = parseFloat(cd.rowSpacing)||5;
  const ts = parseFloat(cd.treeSpacing)||3;
  let totalHa=0, totalTrees=0, byVariety={};
  cd.rows.forEach(row => {
    const c = calcRowEntry(row, rs, ts);
    totalHa += c.areaHa;
    totalTrees += c.totalTrees;
    if (row.varietyId) {
      if (!byVariety[row.varietyId]) byVariety[row.varietyId]={trees:0,ha:0};
      byVariety[row.varietyId].trees += c.totalTrees;
      byVariety[row.varietyId].ha += c.areaHa;
    }
  });
  return { totalHa, totalTrees, byVariety };
}

// ===================== PERSIST =====================
// ═══════════════════════════════════════════════════════════════════════════
// SERVER API LAYER
// Replaces localStorage with Railway PostgreSQL via REST API
// Falls back to localStorage if server unavailable (offline mode)
// ═══════════════════════════════════════════════════════════════════════════

const API = (() => {
  const BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
  let _token = sessionStorage.getItem('agro_token') || '';
  let _role  = sessionStorage.getItem('agro_role')  || '';

  const headers = () => ({
    'Content-Type': 'application/json',
    'Authorization': _token ? `Bearer ${_token}` : '',
  });

  const get = async (path) => {
    try {
      const r = await fetch(BASE + path, { headers: headers() });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch(e) {
      console.warn('[API] GET failed:', path, e.message);
      return null;
    }
  };

  const post = async (path, body) => {
    try {
      const r = await fetch(BASE + path, {
        method: 'POST', headers: headers(), body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch(e) {
      console.warn('[API] POST failed:', path, e.message);
      return null;
    }
  };

  const del = async (path) => {
    try {
      const r = await fetch(BASE + path, { method: 'DELETE', headers: headers() });
      return r.ok;
    } catch(e) {
      console.warn('[API] DELETE failed:', path, e.message);
      return false;
    }
  };

  return {
    setToken(token, role) {
      _token = token; _role = role;
      sessionStorage.setItem('agro_token', token);
      sessionStorage.setItem('agro_role', role);
    },
    getRole: () => _role,
    getToken: () => _token,
    login: (pin) => post('/api/auth/login', { pin }),
    weather: (days=60) => get(`/api/weather?days=${days}`),
    getTreatments: () => get('/api/treatments'),
    saveTreatment: (t) => post('/api/treatments', t),
    deleteTreatment: (id) => del(`/api/treatments/${id}`),
    getAnalyses: () => get('/api/analyses'),
    saveAnalysis: (a) => post('/api/analyses', a),
    deleteAnalysis: (id) => del(`/api/analyses/${id}`),
    getSetting: (key) => get(`/api/settings/${key}`),
    setSetting: (key, value) => post(`/api/settings/${key}`, { value }),
    getCatalog: () => get('/api/catalog'),
    saveCatalogItem: (c) => post('/api/catalog', c),
    deleteCatalogItem: (id) => del(`/api/catalog/${id}`),
  };
})();

// ── Tenant auth headers ───────────────────────────────────────────────────
function getAuthHeaders() {
  const token    = sessionStorage.getItem('agro_jwt') || localStorage.getItem('agro_jwt') || '';
  const tenantId = sessionStorage.getItem('agro_tenant') || 'kkz';
  return {
    'Content-Type':  'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    'x-tenant-id':   tenantId,
  };
}

// ── Server availability check ─────────────────────────────────────────────
let _serverAvailable = false;
async function checkServer() {
  try {
    const r = await fetch('/api/weather?days=1', {
      headers: getAuthHeaders(),
      signal: (() => { const c=new AbortController(); setTimeout(()=>c.abort(),4000); return c.signal; })()
    });
    _serverAvailable = r.ok || r.status === 401;
  } catch { _serverAvailable = false; }
  return _serverAvailable;
}

// ── Save — dual mode: API + localStorage backup ───────────────────────────
async function save() {
  // Always keep localStorage as backup
  localStorage.setItem('cherry_v5', JSON.stringify(S));

  if (!_serverAvailable) return;

  // Save full orchard state (varieties, rootstocks, cells, aiLog, etc.)
  try {
    await fetch('/api/state/orchard', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        varieties:   S.varieties,
        rootstocks:  S.rootstocks||[],
        cells:       S.cells,
        treatments:  S.treatments,
        catalog:     S.catalog,
        warehouse:   S.warehouse,
        irrigation:  S.irrigation,
        irrigEquip:  S.irrigEquip,
        aiLog:       S.aiLog||[],
        gddDb:       S.gddDb,
        settings:    S.settings,
        chillPortions: S.chillPortions,
        analyses:    S.analyses,
        diseases:    S.diseases,
      })
    });
  } catch(e) { console.warn('[save] Full state sync failed:', e.message); }

  // Save treatments
  for (const t of S.treatments) {
    await API.saveTreatment({
      id: String(t.id), date: t.date,
      parcel_name: t.cellTarget || 'all',
      crop_id: t.cropId || null,
      products: t.products || [{ name: t.product, type: t.type, dose: t.dose }],
      method: t.method, volume: t.water || 400,
      max_whi: t.duration || 14, whi_date: t.endDate || null,
      note: t.note || '',
    });
  }

  // Save analyses
  for (const a of (S.analyses || [])) {
    const values = {};
    // Листовой анализ
    ['N','P','K','Ca','Mg','Fe','Mn','Zn','B','Cu','Mo','S'].forEach(el => {
      if (a[el] !== undefined) values[el] = a[el];
    });
    // Почвенный анализ
    ['pH','OM','CEC','BS','depth','NO3','B','Fe','Mn','Zn','Cu'].forEach(el => {
      if (a[el] !== undefined) values[el] = a[el];
    });
    // Анализ воды
    ['EC','TDS','hard','SAR','Cl','Na','H2S'].forEach(el => {
      if (a[el] !== undefined) values[el] = a[el];
    });
    await API.saveAnalysis({
      id: String(a.id || a.date + '_' + (a.type||'leaf')),
      type: a.type || 'leaf',
      date: a.date,
      parcel_id: a.cellKey || null,
      lab: a.lab || '',
      values,
      note: a.note || '',
    });
  }

  // Save GDD calibration settings
  if (S.gddDb?.varietyGdd) {
    await API.setSetting('varietyGdd', S.gddDb.varietyGdd);
  }
  if (S.settings) {
    await API.setSetting('orchardSettings', S.settings);
  }

  // Save catalog
  for (const c of (S.catalog || [])) {
    await API.saveCatalogItem({
      id: String(c.id), name: c.name, type: c.type,
      active_substance: c.activeSubstance || '',
      dose: String(c.dose || ''), whi: c.whi || 0,
      frac: c.fracGroup || '', note: c.note || '',
    });
  }
}

// ── Load — API first, localStorage fallback ───────────────────────────────
async function load() {
  // Always load localStorage first (instant, no flash)
  const s = localStorage.getItem('cherry_v5');
  if (s) {
    try {
      const parsed = JSON.parse(s);
      _mergeState(parsed);
    } catch(e) {}
  }

  // If server available, sync fresh data on top
  if (!_serverAvailable) return;

  try {
    // Weather from server
    const wRes = await API.weather(90);
    if (wRes?.data?.length) {
      S.weather = wRes.data.map(d => ({
        date: d.date, tmax: d.tmax, tmin: d.tmin,
        humidity: d.humidity, precip: d.precip, et0: d.et0,
      }));
    }

    // Treatments from server
    const tRes = await API.getTreatments();
    if (tRes?.data?.length) {
      S.treatments = tRes.data.map(t => ({
        id: t.id, date: t.date,
        product: (t.products?.[0]?.name) || t.parcel_name || '',
        products: t.products || [],
        type: t.products?.[0]?.type || 'fungicide',
        method: t.method, water: t.volume || 400,
        duration: t.max_whi || 14,
        endDate: t.whi_date || null,
        cellTarget: t.parcel_name || 'all',
        cropId: t.crop_id || null,
        note: t.note || '',
      }));
    }

    // Analyses from server
    const aRes = await API.getAnalyses();
    if (aRes?.data?.length) {
      S.analyses = aRes.data.map(a => ({
        id: a.id, type: a.type, date: a.date,
        cellKey: a.parcel_id || '',
        lab: a.lab || '', note: a.note || '',
        ...( a.values || {}),
      }));
    }

    // GDD calibration from server
    const gddRes = await API.getSetting('varietyGdd');
    if (gddRes?.value && Object.keys(gddRes.value).length) {
      S.gddDb.varietyGdd = Object.assign({}, S.gddDb.varietyGdd, gddRes.value);
    }

    // Catalog from server
    const catRes = await API.getCatalog();
    if (catRes?.data?.length) {
      const serverCat = catRes.data.map(c => ({
        id: c.id, name: c.name, type: c.type,
        activeSubstance: c.active_substance,
        dose: c.dose, whi: c.whi, fracGroup: c.frac, note: c.note,
      }));
      // Merge: keep built-ins, add server items
      const builtinIds = S.catalog.map(c=>c.id);
      const serverOnly = serverCat.filter(c=>!builtinIds.includes(c.id));
      S.catalog = [...S.catalog, ...serverOnly];
    }

    // Update localStorage with fresh server data
    localStorage.setItem('cherry_v5', JSON.stringify(S));

  } catch(e) {
    console.warn('[load] Server sync error:', e.message);
  }
}

// ── State merge (same logic as before) ───────────────────────────────────
function _mergeState(parsed) {
  if(parsed.gddDb){
    const savedGddDb = parsed.gddDb;
    parsed.gddDb = Object.assign({}, S.gddDb, savedGddDb);
    parsed.gddDb.standardPhases = S.gddDb.standardPhases;
    if(!parsed.gddDb.varietyGdd) parsed.gddDb.varietyGdd = {};
    parsed.gddDb.varietyGdd = Object.assign({}, S.gddDb.varietyGdd, parsed.gddDb.varietyGdd);
  }
  if(parsed.irrigation){
    parsed.irrigation = Object.assign({sensors:[],readings:[]}, S.irrigation, parsed.irrigation);
  }
  if(parsed.chillPortions){
    parsed.chillPortions = Object.assign({}, S.chillPortions, parsed.chillPortions);
    if(!parsed.chillPortions.cultivarSettings) parsed.chillPortions.cultivarSettings = S.chillPortions.cultivarSettings;
    const savedCropSettings = parsed.chillPortions.cropSettings || [];
    parsed.chillPortions.cropSettings = S.chillPortions.cropSettings.map(bc => {
      const saved = savedCropSettings.find(c=>c.cropId===bc.cropId);
      return saved ? Object.assign({},bc,saved) : bc;
    });
  }
  if(parsed.crops && Array.isArray(parsed.crops)){
    const builtinIds = S.crops.map(c=>c.id);
    const userAdded = parsed.crops.filter(c=>!builtinIds.includes(c.id));
    // Только те встроенные которые есть в сохранённом (не были удалены)
    const merged = parsed.crops.filter(c=>builtinIds.includes(c.id))
      .map(saved=>{ const builtin=S.crops.find(b=>b.id===saved.id); return Object.assign({},builtin||{},saved); });
    parsed.crops = [...merged, ...userAdded];
  }
  if(parsed.varieties && Array.isArray(parsed.varieties)){
    const builtinIds = S.varieties.map(v=>v.id);
    // Сохранённые сорта с приоритетом над встроенными
    const userAdded = parsed.varieties.filter(v=>!builtinIds.includes(v.id));
    const merged = parsed.varieties.filter(v=>builtinIds.includes(v.id))
      .map(saved=>{
        const builtin = S.varieties.find(b=>b.id===saved.id)||{};
        // saved имеет приоритет — перезаписывает builtin
        return Object.assign({}, builtin, saved);
      });
    // Встроенные которых нет в saved = удалены пользователем, не восстанавливаем
    parsed.varieties = [...merged, ...userAdded];
  }
  if(parsed.diseaseCatalog && Array.isArray(parsed.diseaseCatalog)){
    const builtinDcIds = S.diseaseCatalog.map(d=>d.id);
    const userDiseases = parsed.diseaseCatalog.filter(d=>!builtinDcIds.includes(d.id));
    const mergedDc = S.diseaseCatalog.map(bd=>{
      const saved = parsed.diseaseCatalog.find(d=>d.id===bd.id);
      return saved ? Object.assign({},bd,saved) : bd;
    });
    parsed.diseaseCatalog = [...mergedDc, ...userDiseases];
  }
  if(parsed.gddDb && parsed.gddDb.varietyGdd){
    // parsed (saved) имеет приоритет над встроенными S.gddDb.varietyGdd
    parsed.gddDb.varietyGdd = Object.assign({}, S.gddDb.varietyGdd, parsed.gddDb.varietyGdd);
  }
  // Защита анализов: не перезаписывать пустым массивом
  if (Array.isArray(parsed.analyses) && parsed.analyses.length === 0 && S.analyses?.length > 0) {
    delete parsed.analyses; // сохраняем что уже есть в S
  }
  Object.assign(S, parsed);
}

// ── Server status indicator ───────────────────────────────────────────────
function updateServerIndicator() {
  const el = document.getElementById('server-status');
  if (!el) return;
  el.textContent    = _serverAvailable ? '🟢 Сервер' : '🟡 Офлайн';
  el.title          = _serverAvailable
    ? 'Данные синхронизируются с сервером'
    : 'Работа офлайн — данные в браузере';
}

// ===================== TABS =====================
function switchTab(tab,el){
  window.scrollTo(0,0);
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');document.getElementById('panel-'+tab).classList.add('active');
  if(tab==='crops'){switchCropsSub('overview'); renderCrops();}
  if(tab==='chill'){renderChill();}
  if(tab==='weather'){renderWeather(); loadCherryForecast(); switchWeatherSub('weather');}
  if(tab==='irrigation'){renderIrrigation(); switchIrrigSub('sensors');}
  if(tab==='gdd'){
    populateGddVarietySelect();
    renderGdd();
    switchGddSub('gdd');
  }
  if(tab==='catalog')renderCatalog();
  if(tab==='diseases'){popDFilter();renderDiseaseRisks();}
  if(tab==='treatments'){renderTreatments(); autoFillPrecip();}
  if(tab==='analysis'){popAFilter();renderAnalysis();setTimeout(loadAllAnalysisPdfs,300);}
  if(tab==='diseases'){popDFilter();renderDiseases();}
  if(tab==='doses')popDoseSelects();
  if(tab==='dashboard'){renderDashboard();}
  if(tab==='settings'){loadSettings(); loadEquipLists(); loadIrrigLists(); renderRolesSettings();}
  if(tab==='warehouse')renderWarehouse();
  if(tab==='tasks')renderTasks();
  if(tab==='ailog')renderAiLog();
}

// ===================== SETTINGS =====================
