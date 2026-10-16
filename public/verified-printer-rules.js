import {duplexKey,writePrinterDuplex} from './printer-duplex.js?v=20261016-import-guards-2';

// Manufacturer-verified exact SKU + model rules, not brand/series guesses.
// Evidence: docs/printer-import-verification-2026-10-16.md and earlier duplex reports.
export const verifiedPrinterRules = [
  {id:4417,sku:'C11CH96404',model:/\bL14150\b/iu,format:'A3+'},
  {id:4418,sku:'C11CH72404',model:/\bL15150\b/iu,format:'A3+'},
  {id:4419,sku:'C11CH71404',model:/\bL15160\b/iu,format:'A3+'},
  {id:4420,sku:'C11CJ21403',model:/\bL8180\b/iu,format:'A3+'},
  {id:4512,sku:'B11B252402',model:/\bDS[ -]?70\b/iu,scanner:true},
  {id:4557,sku:'3G631A',model:/\b3103fdn\b/iu,duplex:'automatic'},
  {id:4558,sku:'3G632A',model:/\b3103fdw\b/iu,duplex:'automatic'},
  {id:4579,sku:'CE710A',model:/\bCP5225\b/iu,duplex:'manual'},
  {id:4581,sku:'CE711A',model:/\bCP5225n\b/iu,duplex:'manual'},
  {id:4583,sku:'4ZB95A',model:/\b150nw\b/iu,duplex:'manual'},
  {id:4666,sku:'P2207',model:/\bP2207\b/iu,duplex:'manual'},
  {id:4667,sku:'P2500NW',model:/\bP2500NW\b/iu,duplex:'manual'},
  {id:4668,sku:'P2500W',model:/\bP2500W\b/iu,duplex:'manual'},
  {id:4730,sku:'B110V_BI',model:/\bB110\b/iu,duplex:'manual'},
  ...[[4351,'6672C039','E3640'],[4360,'1366C009','E414'],[4361,'0727C067','MG2541S'],[4362,'6670C007','TS3640'],[4376,'8747B007','iX6840'],
    [4433,'C11CL59405','L5390'],[4443,'C11CJ19401','M2110'],[4530,'4ZB96A','178nw'],[4531,'4ZB97A','179fnw'],[4607,'2Z611A','4003n']]
    .map(([id,sku,model])=>({id,sku,model:new RegExp('\\b'+model+'\\b','iu'),duplex:'manual'})),
  ...[[4444,'C11CJ18404','M2120'],[4551,'7MD73A','M141a'],[4599,'7MD67A','M111a'],[4600,'7MD68A','M111w']]
    .map(([id,sku,model])=>({id,sku,model:new RegExp('\\b'+model+'\\b','iu'),duplex:'no-automatic'})),
];
export const printFormatKey = /^(?:формат(?: друку)?|максимальний формат друку|(?:принтер|бфп).*\.\s*формат)(?:\s*\(інше значення \d+\))?\s*[:：]?$/iu;
export const scannerOnly = product => /^(?:сканер|scanner)(?=\s|$)/iu.test(String(product.name||'').trim()) || /^office-scanners(?:-|$)/u.test(String(product.category||product.type||''));
export function verifiedPrinterRule(product) {
  if(!/^(?:принтер|printer|бфп|мфу|mfp|багатофункціональн[\p{L}]*|multifunction|сканер|scanner)(?=\s|$)/iu.test(String(product.name||'').trim()))return null;
  return verifiedPrinterRules.find(rule=>rule.sku===String(product.sku||'').trim().toUpperCase()&&rule.model.test(String(product.name||'')));
}
export function applyVerifiedPrinterRule(specifications,rule) {
  let result={...specifications};
  if(rule.format){result=Object.fromEntries(Object.entries(result).filter(([key])=>!printFormatKey.test(key.trim())));result['Формат']=rule.format;}
  if(rule.duplex){
    result=writePrinterDuplex(result,rule.duplex);
    if(rule.duplex==='no-automatic')result['Автоматичний двосторонній друк']='Немає';
  }
  if(rule.scanner){result=Object.fromEntries(Object.entries(result).filter(([key])=>!duplexKey.test(key.trim())));result['Двостороннє сканування']='Ні';}
  return result;
}
