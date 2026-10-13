const duplexKey = /^(?:дуплекс(?:ний друк)?|автоматичний двосторонній друк|двосторонній друк|duplex(?: printing)?)(?:\s*\(інше значення \d+\))?$/iu;
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
