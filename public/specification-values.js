// Display classification and comparison; never rewrite stored supplier values.
// A semicolon is a normal list separator in technical text, not code evidence.
export function hasSpecificationCode(value) {
  return /[{}]|(?:@media|iframe|display\s*:|container[-_:]|#\w+[\s\w-]*\{)|(?:^|;)\s*(?:width|height|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|position|background(?:-[a-z]+)?|font(?:-[a-z]+)?|color|overflow|z-index)\s*:[^;]*;|(?:javascript\s*:|(?:document|window)\.(?:write|cookie|location|querySelector|getElementById|createElement|addEventListener|setTimeout)\b|=>|\bfunction\s*\()/iu.test(String(value??''));
}
export function comparableSpecificationValue(key, raw) {
  const source=Array.isArray(raw)?raw.join(' · '):String(raw??'');
  // Remove symbols before NFKC: otherwise ™ becomes the literal letters TM.
  let result=source.replace(/[™®]/gu,'').normalize('NFKC').trim()
    .replace(/^(?:[:：]\s*)+/u,'').toLocaleLowerCase('uk-UA').replace(/\s+/g,' ')
    .replace(/(\d)\s*[xх×]\s*(?=\d)/gu,'$1×').trim();
  if(/^(?:яскравість(?:,?\s*лм)?|світловий потік(?:\s*\(лм\))?|brightness)[:：]?$/iu.test(String(key).trim()))result=result.replace(/\s*(?:лм|lm)\s*$/u,'');
  return result;
}
