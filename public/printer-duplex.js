export const duplexKey = /^(?:дуплекс(?:ний друк)?|автоматичний двосторонній друк|двосторонній друк|duplex(?: printing)?)(?:\s*\(інше значення \d+\))?\s*[:：]?$/iu;
const negative = /^(?:ні|немає|нема|відсутн[\p{L}]*|no|false|вручну|ручн[\p{L}]*|manual)(?=\s|$|[,.])/iu;
const positive = /^(?:є|так|yes|true|автомат(?:ично|ичний)?|стандарт(?:но|ний)?)(?=\s|$|[,.])/iu;
const optional = /опці|optional|докуп|add[ -]?on|не входить/iu;

export function printerDuplexState(entries = [], text = '') {
  let yes = false, no = false, option = false;
  for (const [key, raw] of entries) {
    if (!duplexKey.test(String(key).trim())) continue;
    const value = String(raw).trim().replace(/^[:：]\s*/u,'');
    if (negative.test(value)) no = true;
    else if (optional.test(value)) option = true;
    else if (positive.test(value)) yes = true;
  }
  const source = String(text);
  if (/(?:ручн[\p{L}]*|вручну)\s+двосторонн[\p{L}]*\s+друк|manual\s+duplex/iu.test(source)) no = true;
  const records = source.matchAll(/(?:дуплекс(?:ний друк)?|двосторонн(?:ій|є) друк|duplex(?: printing)?|two[ -]?sided printing)\s*[:–-]?\s*([^;\n.]{0,55})/giu);
  for (const record of records) {
    if (negative.test(record[1].trim())) no = true;
    else if (optional.test(record[1])) option = true;
    else if (positive.test(record[1].trim())) yes = true;
  }
  // A model's Duplex token is weak evidence; explicit negatives always win.
  if (!no && !option && /\bduplex\b/iu.test(source)) yes = true;
  if (yes && no) return 'conflict';
  if (no) return 'no';
  if (option) return 'optional';
  return yes ? 'yes' : 'unknown';
}

export const duplexLabels = {automatic:'Автоматичний',manual:'Ручний',unsupported:'Не підтримується'};

// Legacy «Ні/Немає» only denies automatic duplex; it does not prove manual support.
export function printerDuplexMode(entries = [], text = '') {
  const modes = new Set();
  let no = false, option = false;
  const inspect = (raw, key = '') => {
    const value = String(raw).trim().replace(/^[:：]\s*/u,'');
    if (/^(?:не підтримується|не підтримує|unsupported|not supported)(?=\s|$|[,.])/iu.test(value)) {
      if (/автомат|automatic/iu.test(key+' '+value)) no = true;
      else modes.add('unsupported');
    }
    else if (/^(?:ручн[\p{L}]*|вручну|manual)(?=\s|$|[,(.])/iu.test(value)) modes.add('manual');
    else if (negative.test(value)) no = true;
    else if (optional.test(value)) option = true;
    else if (positive.test(value)) modes.add('automatic');
  };
  for (const [key, raw] of entries) if (duplexKey.test(String(key).trim())) {
    for (const value of Array.isArray(raw) ? raw : [raw]) inspect(value, String(key));
  }
  // Structured fields take precedence over weaker free text/model-name tokens.
  if (!modes.size && !no && !option) {
    const source = String(text);
    for (const record of source.matchAll(/(?:дуплекс(?:ний друк)?|двосторонн(?:ій|є) друк|duplex(?: printing)?|two[ -]?sided printing)\s*[:–-]?\s*([^;\n.]{0,55})/giu)) inspect(record[1]);
    if (/(?:ручн[\p{L}]*|вручну)\s+двосторонн[\p{L}]*\s+друк|manual\s+duplex/iu.test(source)) modes.add('manual');
  }
  if (modes.size > 1 || (modes.has('automatic') && no)) return 'conflict';
  return modes.values().next().value || (option ? 'optional' : 'unknown');
}

export function printerDuplexFilterValues(product = {}) {
  const mode = printerDuplexMode(Object.entries(product.specifications || {}),
    [product.name, product.description, ...Object.values(product.specifications || {})].join(' '));
  return duplexLabels[mode] ? [duplexLabels[mode]] : [];
}

// Only replaces duplex aliases after the administrator explicitly changes the select.
export function writePrinterDuplex(specifications, mode) {
  const result = Object.fromEntries(Object.entries(specifications).filter(([key]) => !duplexKey.test(key.trim())));
  if (duplexLabels[mode]) result['Двосторонній друк'] = duplexLabels[mode];
  return result;
}
