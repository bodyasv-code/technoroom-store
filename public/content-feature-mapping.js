// Preview-only semantic correspondence. No supplier or catalog values are rewritten.
const fold=value=>String(value??'').normalize('NFKC').trim().toLocaleLowerCase('uk-UA').replace(/\s*[:：]\s*$/u,'').replace(/\s+/gu,' ');
const rules=[
  ['printer','78','Технологія друку',['Print technology','Технологія друку']],
  ['printer','11422','Тип друку',['Printing','Друк','Тип друку']],
  ['printer','3234','Підтримка двостороннього друку',['Duplex printing','Підтримка двостороннього друку']],
  ['printer',null,'Двосторонній друк',['Duplex printing mode','Режим двостороннього друку','Двосторонній друк']],
  ['printer','17727','Формат',['Maximum ISO A-series paper size','Максимальний розмір паперу ISO A-формату','Формат','Формат друку','Максимальний формат друку']],
  ['printer','61','Роздільна здатність друку',['Maximum resolution','Максимальна роздільна здатність','Роздільна здатність друку','Максимальна роздільна здатність друку']],
  ['printer','727','Оптична роздільна здатність сканування',['Optical scanning resolution','Оптична роздільна здатність сканування','Роздільна здатність оптичного сканування']],
  ['printer','6435','Роздільна здатність копіювання',['Maximum copy resolution','Максимальна роздільна здатність копіювання','Роздільна здатність копіювання']],
  ['projector','11807','Роздільна здатність',['Projector native resolution','Рідна роздільна здатність проектора','Власна роздільна здатність','Native resolution','Роздільна здатність']],
  ['projector','1179','Технологія проекції',['Projection technology','Проекційна технологія','Технологія проєкції','Технологія проекції']],
  ['projector','40499','Джерело світла',['Light source type','Тип джерела світла','Джерело світла']],
  ['projector','1825','Проекційне співвідношення',['Throw ratio','Проєкційне співвідношення','Проекційне співвідношення','Проекційне відношення']],
  ['projector','34','Контраст',['Contrast ratio (typical)','Контрасність (типічна)','Контрастність (типова)','Контраст']],
  // LED lumens are NOT ANSI/ISO lumens. Never match an unqualified brightness field.
  ['projector','45336','Яскравість (LED люмени)',['Projector brightness','Яскравість (LED люмени)']],
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
  return rule?{canonical:rule[2],via:rule[1]===id?'feature-id':'exact-label',id:rule[1]}:null;
}
export function mappedContentKey(key,product){
  const normalized=fold(key).replace(/\s*\(інше значення \d+\)$/u,'');
  return rules.find(r=>applicable(r,product)&&[r[2],...r[3]].some(alias=>fold(alias)===normalized))?.[2]||key;
}
export function contentComparisonValue(key,value){
  let text=fold(Array.isArray(value)?value.join(' · '):value).replace(/(\d)\s*[xх×]\s*(?=\d)/gu,'$1×');
  if(key==='Тип друку')text=text.replace(/\s+друк$/u,'');
  if(['Wi-Fi','Ethernet','Підтримка двостороннього друку'].includes(key))text=({yes:'так',true:'так',no:'ні',false:'ні'})[text]||text;
  if(key==='Двосторонній друк')text=({auto:'автоматичний','авто':'автоматичний',manual:'ручний'})[text]||text;
  if(key==='Роздільна здатність'){
    const dimensions=/^(?:(?:1080p|720p|hd|full hd|fhd|wxga|wuxga|xga|4k|uhd)\s*\()?([0-9]{3,5}×[0-9]{3,5})\)?$/u.exec(text);
    if(dimensions)return dimensions[1];
    return ({hd:'1280×720','720p':'1280×720','full hd':'1920×1080',fhd:'1920×1080','1080p':'1920×1080'})[text]||text;
  }
  return text;
}
export function contentTechnicalNotes(mapping,value,product){
  const notes=[];
  if(mapping?.canonical==='Технологія проекції'&&/^(?:led|laser|лазер)$/iu.test(value))notes.push('Джерело світла не є технологією формування зображення. Потрібна перевірка виробника.');
  if(mapping?.canonical==='Яскравість (LED люмени)')notes.push('LED люмени не прирівнюються до ANSI/ISO люменів.');
  if(mapping?.canonical==='Роздільна здатність'&&/^ASUS$/iu.test(product.brand||'')&&product.sku==='90LJ00E5-B00070'&&contentComparisonValue(mapping.canonical,value)!=='1280×720')notes.push('ASUS ZenBeam Latte L1: виробник вказує рідну 1280×720; 1920×1080 — максимальний вхідний сигнал. Дані Icecat потребують перевірки.');
  return notes;
}
