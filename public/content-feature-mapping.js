// Preview-only semantic correspondence. No supplier or catalog values are rewritten.
import {comparableSpecificationValue} from './specification-values.js?v=20261012-spec-format';
const fold=value=>String(value??'').normalize('NFKC').trim().toLocaleLowerCase('uk-UA').replace(/\s*[:：]\s*$/u,'').replace(/\s+/gu,' ');
const rules=[
  ['printer','78','Технологія друку',['Print technology','Технологія друку']],
  ['printer','11422','Тип друку',['Printing','Друк','Тип друку']],
  ['printer','3234','Підтримка двостороннього друку',['Duplex printing','Підтримка двостороннього друку']],
  ['printer','9342','Двосторонній друк',['Duplex printing mode','Режим двостороннього друку','Тип дюплексного друку','Двосторонній друк']],
  ['printer','17727','Формат',['Maximum ISO A-series paper size','Максимальний розмір паперу ISO A-формату','Формат','Формат друку','Максимальний формат друку']],
  ['printer','61','Роздільна здатність друку',['Maximum resolution','Максимальна роздільна здатність','Роздільна здатність друку','Максимальна роздільна здатність друку']],
  ['printer','727','Оптична роздільна здатність сканування',['Optical scanning resolution','Оптична роздільна здатність сканування','Роздільна здатність оптичного сканування']],
  ['printer','6435','Роздільна здатність копіювання',['Maximum copy resolution','Максимальна роздільна здатність копіювання','Роздільна здатність копіювання']],
  ['printer','558','Швидкість чорно-білого друку',['Print speed (black, normal quality, A4/US Letter)','Швидкість друку (ч/б, норм. як., А4/US Letter)','Швидкість чорно-білого друку']],
  ['printer','488','Швидкість кольорового друку',['Print speed (colour, normal quality, A4/US Letter)','Швидкість друку (колір, норм. як., A4/US Letter)','Швидкість кольорового друку']],
  ['printer','537','Тип сканера',['Scanner type','Тип сканера']],
  ['printer','1974','Максимальна кількість копій',['Maximum number of copies','Максимальна кількість копій','макс. кількість копій']],
  ['printer','701','Масштабування копіювання',['Copier resize','Масштабування копії','Масштабування копіювання']],
  ['printer','40540','Двостороннє копіювання',['Duplex copying','Дуплексне копіювання','Двостороннє копіювання']],
  ['printer','39184','Режим двостороннього копіювання',['Duplex copying mode','Режим дюплексного копіювання','Режим двостороннього копіювання']],
  ['printer','2417','Формати зображень сканування',['Image formats supported','Формати зображення, що підтримуються','Формати зображень сканування']],
  ['printer','7972','Формати документів сканування',['Document formats supported','Формати документів, що підтримуються','Формати документів сканування']],
  ['printer','7958','Вхідна глибина кольору сканування',['Input colour depth','Глибина вхідного кольору','Вхідна глибина кольору сканування']],
  ['printer','7959','Вихідна глибина кольору сканування',['Output colour depth','Вихідна глибина кольору','Вихідна глибина кольору сканування']],
  ['printer','40560','Наявність ADF',['Auto document feeder (ADF)','Пристрій автоматичного подавання документів (ПАПД)','Наявність ADF']],
  ['printer','823','Місткість ADF',['Auto document feeder (ADF) input capacity','Місткісь автоподавача паперу (АПП)','Місткість ADF']],
  ['printer','40554','Місткість вхідного лотка',['Total input capacity','Загальна місткість вхідного лотка','Місткість вхідного лотка']],
  ['printer','40555','Місткість вихідного лотка',['Total output capacity','Загальна кількість паперу на виході','Місткість вихідного лотка']],
  ['printer','40592','Мови управління принтером',['Page description languages','Мови опису сторінок','Мови опису','Мови управління принтером']],
  ['printer','447','Швидкість модему факсу',['Modem speed','Швидкість модему','Швидкість факсу','Швидкість модему факсу']],
  ['printer','13636','Мобільний друк',['Mobile printing technologies','Технології мобільного друку','Можливість друку з мобільних пристроїв','Мобільний друк']],
  ['printer','6','Оперативна пам’ять',['Internal memory','Оперативна пам’ять','Оперативна пам\'ять']],
  ['printer','5','Частота процесора',['Processor frequency','Тактова частота процесора','Частота процесора']],
  ['projector','11807','Роздільна здатність',['Projector native resolution','Рідна роздільна здатність проектора','Власна роздільна здатність','Native resolution','Роздільна здатність']],
  ['projector','1179','Технологія проекції',['Projection technology','Проекційна технологія','Технологія проєкції','Технологія проекції']],
  ['projector','40499','Джерело світла',['Light source type','Тип джерела світла','Джерело світла']],
  ['projector','1825','Проекційне співвідношення',['Throw ratio','Проєкційне співвідношення','Проекційне співвідношення','Проекційне відношення']],
  ['projector','34','Контраст',['Contrast ratio (typical)','Контрасність (типічна)','Контрастність (типова)','Контраст']],
  // LED lumens are NOT ANSI/ISO lumens. Never match an unqualified brightness field.
  ['projector','45336','Яскравість (LED люмени)',['Projector brightness','Яскравість (LED люмени)']],
  ['projector','1181','Яскравість',['Яскравість проектора','Яскравість','Світловий потік','Світловий потік (лм)']],
  ['projector','1175','Проекційна відстань',['Projection distance','Проекційна відстань','Проєкційна відстань']],
  ['projector','11417','Співвідношення сторін',['Native aspect ratio','Власне форматне співвідношення','Співвідношення сторін']],
  ['projector','759','Фокусування',['Focus','Фокус','Фокусування']],
  ['projector','9188','Тип зуму',['Zoom type','Тип зума','Тип зуму']],
  ['projector','1826','Кратність зуму',['Zoom ratio','Коэфициент приближения','Кратність зуму']],
  ['projector','40501','Ресурс джерела світла (звичайний режим)',['Service life of light source','Термін служби джерела світла','Ресурс джерела світла (звичайний режим)']],
  ['projector','40500','Ресурс джерела світла (екорежим)',['Service life of light source (economic mode)','Термін служби джерела світла (економний режим)','Ресурс джерела світла (екорежим)']],
  ['projector','25972','Потужність лампи',['Lamp power','Потужність лампи']],
  ['projector','7889','Рівень шуму (екорежим)',['Noise level (economic mode)','Рівень шуму (економ. режим)','Рівень шуму (екорежим)']],
  ['projector','37212','Рівень шуму (режим очікування)',['Noise level (standby)','Рівень шуму (в режимі очікування)','Рівень шуму (режим очікування)']],
  ['projector','1854','Сумарна потужність динаміків',['RMS rated power','Номінальна RMS-потужність','Сумарна потужність динаміків']],
  ['projector','1721','Автономність (максимальна)',['Battery life (max)','Час роботи батареї (макс)','Автономність (максимальна)']],
  ['any','3239','Wi-Fi',['Wi-Fi','Wi‑Fi']],
  ['any','1347','Ethernet',['Ethernet LAN','Підключення Ethernet','Ethernet']],
];
export function contentProductKind(product={}){
  if(/^(?:про[єе]ктор|projector)(?=\s|$)/iu.test(product.name||'')||/^(?:(?:laser-|home-|short-throw-|installation-|universal-)?projectors?|erc-display-(?:03|11|12|13))$/u.test(product.category||''))return 'projector';
  if(/^(?:принтер|бфп|мфу|багатофункціональн\p{L}*|printer|mfp|multifunction)(?=\s|$)/iu.test(product.name||'')||/^office-(?:printers|mfp|wide-format)(?:-|$)/u.test(product.category||''))return 'printer';
  return 'other';
}
const applicable=(rule,product)=>rule[0]==='any'||rule[0]===contentProductKind(product);
export function mapContentFeature(feature,product){
  const id=String(feature.Feature?.ID??feature.ID??''),name=fold(feature.Feature?.Name?.Value);
  const rule=rules.find(r=>applicable(r,product)&&r[1]&&r[1]===id)||rules.find(r=>applicable(r,product)&&r[3].some(alias=>fold(alias)===name));
  if(rule?.[1]==='45336'&&!/LED\s*(?:lumens?|люмен\p{L}*|лм)/iu.test(String(feature.PresentationValue??feature.Value??'')))return null;
  if(rule?.[1]==='1181'&&/LED/iu.test(String(feature.PresentationValue??feature.Value??'')))return null;
  return rule?{canonical:rule[2],via:rule[1]===id?'feature-id':'exact-label',id:rule[1]}:null;
}
export function mappedContentKey(key,product){
  const normalized=fold(key).replace(/\s*\(інше значення \d+\)$/u,'');
  return rules.find(r=>applicable(r,product)&&[r[2],...r[3]].some(alias=>fold(alias)===normalized))?.[2]||key;
}
export function contentComparisonValue(key,value){
  let text=comparableSpecificationValue(key,value);
  if(key==='Проекційне співвідношення')text=text.replace(/(?<=\d)\s*-\s*(?=\d)/gu,'-');
  if(key==='Масштабування копіювання')text=text.replace(/(?<=\d)\s*[–—-]\s*(?=\d)/gu,'-');
  if(key==='Максимальна кількість копій'){
    const count=/^(?:до\s*)?(\d+)\s*(?:копій|копії|копія|copies)?$/u.exec(text);
    if(count)return count[1];
  }
  if(key==='Тип друку')text=text.replace(/\s+друк$/u,'');
  if(['Wi-Fi','Ethernet','Підтримка двостороннього друку'].includes(key))text=({yes:'так',true:'так',no:'ні',false:'ні'})[text]||text;
  if(key==='Двосторонній друк')text=({auto:'автоматичний','авто':'автоматичний',manual:'ручний'})[text]||text;
  if(key==='Роздільна здатність'){
    const dimensions=/^(?:(?:1080p|720p|hd|full hd|fhd|wxga|wuxga|xga|4k|uhd)\s*\()?([0-9]{3,5}×[0-9]{3,5})\)?(?:\s*\((?:hd|full hd|fhd|wxga|wuxga|xga|4k|uhd)\))?$/u.exec(text);
    if(dimensions)return dimensions[1];
    return ({hd:'1280×720','720p':'1280×720','full hd':'1920×1080',fhd:'1920×1080','1080p':'1920×1080'})[text]||text;
  }
  return text;
}
export function contentTechnicalNotes(mapping,value,product){
  const notes=[];
  if(mapping?.canonical==='Двосторонній друк'&&/^Керівництво$/iu.test(value))notes.push('Неоднозначний переклад режиму дуплексу. «Керівництво» не є технічним режимом; звірте оригінал і дані виробника.');
  if(mapping?.canonical==='Технологія проекції'&&/^(?:led|laser|лазер)$/iu.test(value))notes.push('Джерело світла не є технологією формування зображення. Потрібна перевірка виробника.');
  if(mapping?.canonical==='Яскравість (LED люмени)')notes.push('LED люмени не прирівнюються до ANSI/ISO люменів.');
  if(mapping?.canonical==='Яскравість')notes.push('Збіг числа люменів не підтверджує однаковий стандарт ANSI/ISO.');
  if(mapping?.canonical==='Фокусування'&&/^Керівництво$/iu.test(value))notes.push('Неоднозначний переклад способу фокусування. Не підмінювати ручний режим цим текстом.');
  if(mapping?.canonical==='Тип зуму'&&/^Керівництво$/iu.test(value))notes.push('Неоднозначний переклад типу зуму. Потрібен оригінал або дані виробника.');
  if(mapping?.canonical==='Роздільна здатність'&&/^ASUS$/iu.test(product.brand||'')&&product.sku==='90LJ00E5-B00070'&&contentComparisonValue(mapping.canonical,value)!=='1280×720')notes.push('ASUS ZenBeam Latte L1: виробник вказує рідну 1280×720; 1920×1080 — максимальний вхідний сигнал. Дані Icecat потребують перевірки.');
  return notes;
}

// Context only: never claim a composite field is equal to one component.
const related={
  'Швидкість чорно-білого друку':['Швидкість друку'],
  'Швидкість кольорового друку':['Швидкість друку'],
  'Місткість вхідного лотка':['Лотки'],
  'Місткість вихідного лотка':['Лотки'],
  'Наявність ADF':['ADF','пристрій автоматичної подачі документів (ADF)'],
  'Місткість ADF':['ADF','пристрій автоматичної подачі документів (ADF)'],
  'Формати зображень сканування':['Формати файлів сканування','Цифрова передача даних'],
  'Формати документів сканування':['Формати файлів сканування','Цифрова передача даних'],
  'Вхідна глибина кольору сканування':['Глибина кольору сканування'],
  'Вихідна глибина кольору сканування':['Глибина кольору сканування'],
  'Оперативна пам’ять':['Пам\'ять','Пам’ять','Обсяг пам\'яті'],
  'Мобільний друк':['Додаткові функції друку'],
  'Сумарна потужність динаміків':['Динамік (Вт)'],
  'Кратність зуму':['Оптичний трансфокатор (зум)'],
  'Рівень шуму (екорежим)':['Шум (дБ)'],
  'Рівень шуму (режим очікування)':['Шум (дБ)'],
  'Автономність (максимальна)':['Батарея (ємність, автономність)'],
  'Ресурс джерела світла (звичайний режим)':['Джерело світла','Джерело світла (тип, термін роботи)'],
  'Ресурс джерела світла (екорежим)':['Джерело світла','Джерело світла (тип, термін роботи)'],
  'Wi-Fi':['Інтерфейс','Інтерфейси','Вхід','Інтерфейси підключення'],
  'Ethernet':['Інтерфейс','Інтерфейси','Вхід','Інтерфейси підключення'],
};
export function relatedContentFields(canonical,specifications={}){
  const names=(related[canonical]||[]).map(fold);
  return Object.entries(specifications).filter(([key])=>names.includes(fold(key))).map(([name,value])=>({name,value}));
}
