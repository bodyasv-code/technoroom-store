// Free-form descriptions are not structured specifications. Only accept clear
// label/value records; rejected prose remains in the supplier description.
const plain=value=>String(value??'').replace(/\s+/gu,' ').trim();
const fold=value=>plain(value).normalize('NFKC').toLocaleLowerCase('uk-UA');
export function specificationLabelProblem(raw) {
  const key=plain(raw).replace(/\s*\(інше значення \d+\)$/u,'');
  if(/^(?:https?|ftp)(?::|$)|^\/\//iu.test(key))return 'url-label';
  if(/^(?:до\s+\d|\d+base[-–]|mopria\s*,)/iu.test(key))return 'prose-label';
  const opens=(key.match(/\(/gu)||[]).length,closes=(key.match(/\)/gu)||[]).length;
  if(opens!==closes||/^(?:кол\.?|ч\/б|max у копій|windows(?: \d.*)?|macos(?: .*)?)$/iu.test(key)||/^["',)]/u.test(key))return 'fragment';
  return null;
}
export function isSpecificationLabel(raw) {
  const key=plain(raw);
  if(specificationLabelProblem(key)||key.length<2||key.length>100||!/^(?:\p{L}|3D\b|[345]G\b)/iu.test(key))return false;
  if(/[;:<>\n]|\.\s|^["',)]/u.test(key))return false;
  let depth=0;
  for(const char of key){if(char==='(')depth++;if(char===')'&&--depth<0)return false;}
  if(depth!==0||/^(?:кол\.?|ч\/б|max у копій|windows(?: \d.*)?|macos(?: .*)?)$/iu.test(key))return false;
  return true;
}
export function appendSpecification(target,key,value) {
  const label=plain(key).replace(/\s*\(інше значення \d+\)$/u,''), identity=fold(label);
  const comparable=raw=>fold(Array.isArray(raw)?raw.join(' · '):raw).replace(/(\d)\s*[xх×]\s*(?=\d)/gu,'$1×');
  const matching=Object.keys(target).filter(k=>fold(k).replace(/\s*\(інше значення \d+\)$/u,'')===identity);
  if(matching.some(k=>comparable(target[k])===comparable(value)))return;
  let unique=label,index=2;
  while(Object.hasOwn(target,unique)){unique=label+' (інше значення '+index+')';index++;}
  Object.defineProperty(target,unique,{value,enumerable:true,writable:true,configurable:true});
}
export function mergeSpecificationSources(...sources) {
  const result={};
  for(const source of sources)for(const [key,value] of Object.entries(source||{}))appendSpecification(result,key,value);
  return result;
}
export function parseSpecificationText(source,{canonicalKey=plain}={}) {
  const result={};
  const records=[];let depth=0,start=0;const input=String(source??'');
  for(let index=0;index<input.length;index++){
    if(input[index]==='(')depth++;
    if(input[index]===')')depth=Math.max(0,depth-1);
    if(input[index]==='\n'||input[index]===';'&&depth===0){records.push(input.slice(start,index));start=index+1;if(input[index]==='\n')depth=0;}
  }
  records.push(input.slice(start));
  for(const record of records){
    // A standalone URL is a source document, never a key named "https".
    // Retain its complete address rather than discarding supplier information.
    if(/^https?:\/\/[^\s<>]+$/iu.test(record.trim())){
      appendSpecification(result,'Документ постачальника',record.trim());continue;
    }
    const match=/^([^:：]+)[:：]\s*(.+)$/u.exec(record.trim());
    if(!match||!isSpecificationLabel(match[1]))continue;
    const value=plain(match[2]);
    // Another textual label means a flattened multi-field paragraph. Numeric
    // ratios, times and URLs remain valid, as do ordinary sentence details.
    if(!value||value.length>700||/[\p{L})]\s*[:：]\s*(?=\S)/u.test(value.replace(/https?:\/\/\S+/giu,'')))continue;
    appendSpecification(result,canonicalKey(match[1]),value);
  }
  return result;
}
export function specificationContentProblems(specifications={}) {
  const problems=[];
  for(const [key,raw] of Object.entries(specifications||{})){
    const label=plain(key).replace(/\s*\(інше значення \d+\)$/u,''),value=String(Array.isArray(raw)?raw.join(' · '):raw??'');
    const labelProblem=specificationLabelProblem(label);
    if(labelProblem)problems.push({key,reason:labelProblem});
    else if(/<\/?(?:br|p|div|span|b|strong)(?:\s|\/?>)/iu.test(label+' '+value))problems.push({key,reason:'markup'});
    else if(/(?:^|\s)(?:Дуплекс|Інтерфейс(?:и)?|Глибина кольору|Пам.?ять|Лотки|ОС|Панель управління|Навантаження)\s*:\s*\S/iu.test(value))problems.push({key,reason:'flattened'});
  }
  return problems;
}
export function parseSupplierSpecificationMarkup(markup,{canonicalKey=plain}={}) {
  const parsed=new DOMParser().parseFromString(String(markup??''),'text/html'),structured={};
  parsed.querySelectorAll('script,style').forEach(node=>node.remove());
  parsed.querySelectorAll('tr').forEach(row=>{
    const cells=[...row.querySelectorAll('th,td')].map(cell=>supplierSpecificationText(cell.innerHTML)).filter(Boolean);
    if(cells.length>=2&&isSpecificationLabel(cells[0])&&cells.slice(1).join(' ').length<=700)appendSpecification(structured,canonicalKey(cells[0]),cells.slice(1).join(' '));
  });
  parsed.querySelectorAll('table').forEach(node=>node.remove());
  const lineMarkup=parsed.body.innerHTML.replace(/<(?:br\s*\/?|\/(?:p|div|li|tr|h[1-6]))\s*[^>]*>/giu,'\n');
  const lines=new DOMParser().parseFromString(lineMarkup,'text/html').body.textContent||'';
  return mergeSpecificationSources(structured,parseSpecificationText(lines,{canonicalKey}));
}
export function supplierSpecificationText(value) {
  const parsed=new DOMParser().parseFromString(String(value??'').replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/giu,' '),'text/html');
  parsed.querySelectorAll('script,style').forEach(node=>node.remove());
  return plain(parsed.body.textContent);
}
