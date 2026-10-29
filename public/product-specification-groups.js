import {renderProjectorSpecificationHelp} from './projector-specification-help.js?v=20261029-help';
// Product-detail presentation only. No supplier records are rewritten.
const labelKey = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('uk-UA')
  .replace(/[’ʼ`]/gu,"'").replace(/\s+/gu,' ').replace(/\s*[:：]+$/u,'')
  .replace(/\s*\(інше значення \d+\)$/u,'');
const valueKey = value => (Array.isArray(value) ? value.join(' · ') : String(value ?? ''))
  .normalize('NFKC').trim().toLocaleLowerCase('uk-UA').replace(/\s+/gu,' ');
const plainLightTypes = new Map([['laser','laser'],['лазер','laser'],['led','led'],['світлодіод','led'],['lamp','lamp'],['лампа','lamp']]);
const identity = (key, value, projector) => {
  const name = labelKey(key), text = valueKey(value);
  if (/^(виробник|бренд|manufacturer|brand)$/u.test(name)) return 'manufacturer\0'+text;
  // Only complete type tokens are interchangeable. RGB/hybrid/lifespan details
  // must not disappear merely because both strings contain the word "laser".
  if (projector && /^(джерело світла|технологія джерела світла)$/u.test(name) && plainLightTypes.has(text)) return 'light-type\0'+plainLightTypes.get(text);
  return name+'\0'+text;
};

const definitions = [
  ['general','Загальні відомості',/^(виробник|бренд|manufacturer|brand|тип пристрою|тип продукту|тип товару|призначення|модель|артикул|тип витратного матеріалу|серія картриджа|ємність картриджа)$/u],
  ['image','Зображення',/^(?:технологія про[еє]кції|роздільна здатність$|роздільна здатність екрана|яскравість|світловий потік|контраст|про[еє]кційне співвідношення|діагональ|співвідношення сторін|формат екрана|тип матриці|фокусування|оптичний трансфокатор|корекція трапецеїдальних)/u],
  ['light','Джерело світла',/^(?:джерело світла|технологія джерела світла|тип лампи|ресурс (?:джерела світла|лампи)|потужність лампи)/u],
  ['print','Друк',/^(?:технологія друку|тип друку|колір друку|ресурс друку|кольоровість|формат(?: друку)?$|максимальний формат|роздільна здатність друку|швидкість (?:друку|чорно-білого друку|кольорового друку)|двосторонній друк|дуплекс|мови управління принтером|час виходу першої сторінки)/u],
  ['scan','Сканування',/^(?:тип сканера|технологія сканування|оптична роздільна здатність сканування|роздільна здатність сканування|швидкість сканування|формат сканування|формати файлів сканування|глибина кольору сканування|сканер|сканування|adf)/u],
  ['copy','Копіювання та факс',/^(?:копір|копіювання|швидкість копіювання|масштабування копіювання|максимальна кількість копій|двостороннє копіювання|факс)/u],
  ['paper','Папір та навантаження',/^(?:лотки|щільність паперу|типи друкованих носіїв|навантаження|рекомендований міс\.|рекомендований місячний|витратні матеріали)/u],
  ['compatibility','Сумісність',/^(?:сумісні пристрої|сумісний бренд)$/u],
  ['connections','Підключення',/^(?:інтерфейс|підключення|вхід(?:$|\s|,)|вихід(?:$|\s|,)|бездротовий|wi[‑-]?fi|bluetooth|ethernet|usb|hdmi|мережеві|можливості мережевого|можливість друку з мобільних)/u],
  ['system','Система та пам’ять',/^(?:ос$|операційн|сумісність з ос|windows|процесор|пам'ять|оперативна пам'ять|обсяг пам'яті|вбудована пам'ять|накопичувач|панель управління)/u],
  ['sound','Звук',/^(?:динамік|звук|аудіо|потужність звуку)/u],
  ['physical','Корпус та живлення',/^(?:габарити|розміри|маса|вага|шум|енергоспоживання|споживана потужність|живлення|акумулятор|колір(?:$|\s|,)|матеріал корпусу)/u],
];

export function groupProductSpecifications(entries, {projector = false, printer = false} = {}) {
  const seen = new Set();
  const groups = new Map();
  for (const [key, value] of entries) {
    const token = identity(key, value, projector);
    if (seen.has(token)) continue;
    seen.add(token);
    const name = labelKey(key);
    // Generic resolution means print resolution in printer cards only. Scanner
    // resolution remains separate and never merges into the generic field.
    const definition = printer && /^(роздільна здатність|дозвіл)$/u.test(name)
      ? definitions.find(([id]) => id === 'print')
      : definitions.find(([, , pattern]) => pattern.test(name));
    const [id, title] = definition || ['other','Інші характеристики'];
    if (!groups.has(id)) groups.set(id,{id,title,entries:[]});
    groups.get(id).entries.push([key, value]);
  }
  return [...definitions.map(([id]) => id),'other'].filter(id => groups.has(id)).map(id => groups.get(id));
}

const escape = value => String(value ?? '').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function renderProductSpecificationGroups(groups, {projector=false}={}) {
  return groups.map(group => '<section class="product-specification-group" aria-labelledby="product-spec-group-'+escape(group.id)+'">'
    + '<h3 id="product-spec-group-'+escape(group.id)+'">'+escape(group.title)+'</h3><dl class="specs">'
    + group.entries.map(([key,value])=>'<div><dt>'+escape(key)+(projector?renderProjectorSpecificationHelp(key):'')+'</dt><dd>'+escape(Array.isArray(value)?value.join(' · '):value)+'</dd></div>').join('')
    + '</dl></section>').join('');
}

export function specificationCountLabel(count) {
  const form = new Intl.PluralRules('uk-UA').select(count);
  return count+' '+({one:'параметр',few:'параметри',many:'параметрів',other:'параметра'}[form]);
}
