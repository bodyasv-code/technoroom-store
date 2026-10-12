// Comparison only: keep original supplier text for display and editing.
export function comparableSpecificationValue(key, raw) {
  const source=Array.isArray(raw)?raw.join(' · '):String(raw??'');
  // Remove symbols before NFKC: otherwise ™ becomes the literal letters TM.
  let result=source.replace(/[™®]/gu,'').normalize('NFKC').trim()
    .replace(/^(?:[:：]\s*)+/u,'').toLocaleLowerCase('uk-UA').replace(/\s+/g,' ')
    .replace(/(\d)\s*[xх×]\s*(?=\d)/gu,'$1×').trim();
  if(/^(?:яскравість(?:,?\s*лм)?|світловий потік(?:\s*\(лм\))?|brightness)[:：]?$/iu.test(String(key).trim()))result=result.replace(/\s*(?:лм|lm)\s*$/u,'');
  return result;
}
