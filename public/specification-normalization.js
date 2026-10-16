import {comparableSpecificationValue} from './specification-values.js?v=20261012-spec-format';
import {cleanCustomerSpecifications} from './product-content-policy.js?v=20261017-customer-content';
const cleanLabel = raw => String(raw ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').replace(/\s*[:：]+\s*$/u, '');
const folded = raw => cleanLabel(raw).toLocaleLowerCase('uk-UA');
// Supplier separators are not part of the value. Preserve interior colons
// (contrast 350:1, URLs, times) and retain numeric/boolean value types.
export function cleanSpecificationValue(value) {
  if (Array.isArray(value)) return value.map(cleanSpecificationValue);
  if (typeof value !== 'string') return value;
  return value.trim().replace(/^(?:[:：]\s*)+/u, '');
}
const projectorAliases = new Map([
  ['Технологія проекції', ['Технологія', 'Технологія проєкції', 'Projection technology', 'Projection system']],
  ['Роздільна здатність', ['Resolution', 'Native resolution', 'Власна роздільна здатність']],
  ['Яскравість', ['Яскравість, лм', 'Світловий потік', 'Світловий потік (лм)', 'Brightness']],
  ['Проекційне співвідношення', ['Проекційне відношення', 'Проєкційне співвідношення', 'Throw ratio', 'Projection ratio']],
  ['Джерело світла', ['Тип джерела', 'Джерело світла (тип, термін роботи)', 'Light source']]
].flatMap(([canonical, aliases]) => [canonical, ...aliases].map(alias => [folded(alias), canonical])));

export function normalizeSpecificationEntries(specifications = {}, {projector = false} = {}) {
  const entries = [], seen = new Set();
  const source = Object.entries(cleanCustomerSpecifications(specifications));
  if (projector) source.sort(([left], [right]) => {
    const priority = key => projectorAliases.has(folded(key)) && folded(key) === folded(projectorAliases.get(folded(key))) ? 0 : 1;
    return priority(left) - priority(right);
  });
  for (const [rawKey, rawValue] of source) {
    const label = cleanLabel(rawKey);
    const key = projector ? projectorAliases.get(folded(label)) || label : label;
    const value = cleanSpecificationValue(rawValue);
    const comparison = comparableSpecificationValue(key,value);
    if (!key || !comparison) continue;
    const identity = folded(key) + '\u0000' + comparison;
    if (seen.has(identity)) continue;
    seen.add(identity);
    // Different values are deliberately retained, even when their labels are aliases.
    entries.push([key, value]);
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
