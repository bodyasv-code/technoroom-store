import {normalizeProjectorLightSource} from './projector-specs.js?v=20261013-spec-colons';

// Presentation only: do not rewrite imported or manually entered specifications.
// A slash alone does not establish which operating modes the supplier meant.
export function projectorDisplayEntries(entries, description = '') {
  const descriptionPair = /Світловий потік\s*\(лм\)\s*:\s*(\d+)\s*\/\s*(\d+)(?!\d)/iu.exec(String(description));
  if (descriptionPair && !entries.some(([key, value]) => /^Яскравість/u.test(key) && /\d\s*\/\s*\d/u.test(String(value)))) {
    entries = [...entries, ['Яскравість', descriptionPair[1] + '/' + descriptionPair[2]]];
  }
  const result = [];
  const sourceTypes = new Set(entries.filter(([key]) => /^Джерело світла(?: \(інше значення \d+\))?$/u.test(key))
    .map(([, value]) => normalizeProjectorLightSource(value)).filter(Boolean));
  const add = (key, value) => {
    if (!result.some(([k, v]) => k === key && v === value)) result.push([key, value]);
  };
  for (const [key, raw] of entries) {
    const value = String(raw);
    if (/^Джерело світла(?: \(інше значення \d+\))?$/u.test(key) && sourceTypes.size === 1) {
      const type = normalizeProjectorLightSource(value);
      // Only a complete, recognized type + lifespan record is decomposed.
      const parts = /^(.*?)\s*,\s*(\d{3,6})(?:\s*\/\s*(\d{3,6}))?\s*(?:год(?:ин)?\.?|h(?:ours)?)?$/iu.exec(value);
      if (parts && type) {
        add('Джерело світла', type);
        add(type === 'Лампа' ? 'Тип лампи' : 'Технологія джерела світла', parts[1].trim());
        add('Ресурс джерела світла', parts[2] + (parts[3] ? ' / ' + parts[3] : '') + ' год' + (parts[3] ? ' (режими не уточнено)' : ''));
        continue;
      }
      if (value === type) { add('Джерело світла', type); continue; }
    }
    if (/^Яскравість(?: \(інше значення \d+\))?$/u.test(key)) {
      const pair = /^(\d+)\s*\/\s*(\d+)\s*(?:лм|lm)?$/iu.exec(value);
      if (pair) {
        add('Яскравість за різних режимів', `${pair[1]} / ${pair[2]} лм (режими не уточнено)`);
        continue;
      }
    }
    add(key, raw);
  }
  return result;
}
