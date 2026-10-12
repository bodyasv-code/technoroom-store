const cleanLabel = raw => String(raw ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').replace(/\s*[:：]+\s*$/u, '');
const folded = raw => cleanLabel(raw).toLocaleLowerCase('uk-UA');
const projectorAliases = new Map([
  ['Технологія проекції', ['Технологія', 'Технологія проєкції', 'Projection technology', 'Projection system']],
  ['Роздільна здатність', ['Resolution', 'Native resolution', 'Власна роздільна здатність']],
  ['Яскравість', ['Яскравість, лм', 'Світловий потік', 'Світловий потік (лм)', 'Brightness']],
  ['Проекційне співвідношення', ['Проекційне відношення', 'Проєкційне співвідношення', 'Throw ratio', 'Projection ratio']],
  ['Джерело світла', ['Тип джерела', 'Джерело світла (тип, термін роботи)', 'Light source']]
].flatMap(([canonical, aliases]) => [canonical, ...aliases].map(alias => [folded(alias), canonical])));

function comparable(raw, key) {
  const value = Array.isArray(raw) ? raw.join(' · ') : String(raw ?? '');
  let result = value.normalize('NFKC').trim().toLocaleLowerCase('uk-UA').replace(/\s+/g, ' ').replace(/(\d)\s*[xх×]\s*(?=\d)/gu, '$1×');
  // Units are implicit only for the brightness field; do not strip units from arbitrary specs.
  if (key === 'Яскравість') result = result.replace(/\s*(?:лм|lm)\s*$/u, '');
  return result;
}

export function normalizeSpecificationEntries(specifications = {}, {projector = false} = {}) {
  const entries = [], seen = new Set();
  const source = Object.entries(specifications || {});
  if (projector) source.sort(([left], [right]) => {
    const priority = key => projectorAliases.has(folded(key)) && folded(key) === folded(projectorAliases.get(folded(key))) ? 0 : 1;
    return priority(left) - priority(right);
  });
  for (const [rawKey, rawValue] of source) {
    const label = cleanLabel(rawKey);
    const key = projector ? projectorAliases.get(folded(label)) || label : label;
    const comparison = comparable(rawValue, key);
    if (!key || !comparison) continue;
    const identity = folded(key) + '\u0000' + comparison;
    if (seen.has(identity)) continue;
    seen.add(identity);
    // Different values are deliberately retained, even when their labels are aliases.
    entries.push([key, Array.isArray(rawValue) ? [...rawValue] : rawValue]);
  }
  return entries;
}

export function normalizeSpecifications(specifications = {}, options = {}) {
  const result = {};
  for (const [key, value] of normalizeSpecificationEntries(specifications, options)) {
    let uniqueKey = key, suffix = 2;
    while (Object.hasOwn(result, uniqueKey)) uniqueKey = key + ' (інше значення ' + suffix++ + ')';
    Object.defineProperty(result, uniqueKey, {value, enumerable: true, configurable: true, writable: true});
  }
  return result;
}
