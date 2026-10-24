// A conservative summary of existing structured specifications, not new facts.
const keyText = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('uk-UA')
  .replace(/[’ʼ`]/gu,"'").replace(/\s+/gu,' ').replace(/\s*[:：]+$/u,'').replace(/\s*\(інше значення \d+\)$/u,'');
const text = value => Array.isArray(value) ? value.join(' · ') : String(value ?? '');
const comparable = value => text(value).normalize('NFKC').trim().toLocaleLowerCase('uk-UA')
  .replace(/\s+/gu,' ').replace(/(\d)\s*[xх×]\s*(?=\d)/gu,'$1×');
const readable = value => {
  const v = text(value).trim();
  return v.length > 0 && v.length <= 125 && !/[<>*?\r\n]/u.test(v)
    && !/^(?:[-–—]+|н\/?д|n\/?a|null|undefined|unknown|tbd|true|false)$/iu.test(v)
    && !/(?:потребує|уточн|не вказан|невідом|за запитом|режими не уточнено)/iu.test(v)
    && !/(?:навантаження|пам.?ять|лотки|витратні матеріали|панель управління)\s*:/iu.test(v);
};
const field = (pattern, validate = () => true, equivalent = comparable) => ({pattern,validate,equivalent});
const resolution = field(/^(?:роздільна здатність|власна роздільна здатність|native resolution|resolution)$/u,
  v => /(?:\d{3,5}\s*[xх×]\s*\d{3,5}|\b(?:full hd|fhd|wuxga|wxga|xga|svga|[48]k|uhd)\b)/iu.test(v));
const lightValue = value => ({laser:'laser','лазер':'laser',led:'led','світлодіод':'led',lamp:'lamp','лампа':'lamp'}[comparable(value)] || comparable(value));
const light = field(/^(?:джерело світла|технологія джерела світла|light source)$/u,
  v => /^(?:лазер|laser|rgb laser|led|rgb led|led\s*\+\s*laser|лампа|lamp)$/iu.test(v.trim()),lightValue);
const interfaces = field(/^(?:інтерфейси|інтерфейс|вхід|підключення)$/u);
const dimensions = field(/^(?:габарити|розміри)(?:\s*\(мм\))?$/u);
const weight = field(/^(?:маса|вага)(?:\s*\(кг\))?$/u);
const projectorProfile = [resolution,field(/^технологія про[еє]кції$/u),light,
  field(/^про[еє]кційне (?:співвідношення|відношення)$/u),interfaces,
  field(/^бездротовий зв'язок$/u),weight];
const printerProfile = [field(/^тип друку$/u),field(/^(?:формат|формат друку)$/u),field(/^технологія друку$/u),
  field(/^швидкість друку$/u),field(/^(?:двосторонній друк|дуплекс|дуплексний друк)$/u),interfaces];
const screenProfile = [field(/^діагональ(?: екрана)?$/u),field(/^(?:співвідношення сторін|формат екрана)$/u),
  field(/^(?:тип конструкції|тип екрану)$/u),field(/^монтаж$/u),field(/^привід$/u),dimensions];
const genericProfile = [field(/^тип пристрою$/u),field(/^діагональ(?: екрана)?$/u),
  field(/^(?:ємність|обсяг|об'єм)(?:\s*\([^)]*\))?$/u),field(/^потужність(?:\s*\(вт\))?$/u),dimensions,weight];

export function selectProductHighlights(entries, {projector = false, printer = false, screen = false} = {}) {
  const profile = projector ? projectorProfile : printer ? printerProfile : screen ? screenProfile : genericProfile;
  const selected = [];
  for (const {pattern,validate,equivalent} of profile) {
    const candidates = entries.filter(([key]) => pattern.test(keyText(key)));
    if (!candidates.length) continue;
    // An unclear or conflicting candidate invalidates the whole topic; do not
    // pick a convenient value or infer missing units/modes from other fields.
    if (candidates.some(([,value]) => !readable(value) || !validate(text(value)))) continue;
    if (new Set(candidates.map(([,value]) => equivalent(value))).size !== 1) continue;
    const [key,value] = candidates[0];
    selected.push([key,text(value).trim()]);
    if (selected.length === 6) break;
  }
  return selected;
}

const escape = value => String(value).replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderProductHighlights(entries, options) {
  const selected = selectProductHighlights(entries,options);
  if (selected.length < 2) return '';
  return '<section class="product-highlights" aria-labelledby="product-highlights-title"><h2 id="product-highlights-title">Коротко про товар</h2>'
    + '<dl>'+selected.map(([key,value])=>'<div><dt>'+escape(key)+'</dt><dd>'+escape(value)+'</dd></div>').join('')+'</dl>'
    + '<a href="#product-specifications">Усі характеристики →</a></section>';
}
