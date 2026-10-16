import {readPrinterMediaWidth,mediaWidthKey,mediaWidthLabels} from './printer-media-width.js?v=20261016-connectivity';
export {mediaWidthKey,mediaWidthLabels};
// Exact-model evidence: docs/wide-format-verification-2026-10-16.md.
const rows=[
  [4375,'6856C006','PRO-1100','A2',0],
  [4472,'C11CJ36301A0','SC-T3100M','A1',24],
  [4473,'C11CH65301A0','SC-T5400M','A0',36],
  [4474,'C11CH82301A0','SC-T5700DM','A0',36],
  [4475,'C11CH84301A0','SC-T7700DM','A0',44],
  [4476,'C11CJ50301A0','SC-P8500D','B0',44],
  [4479,'C11CJ15301A0','SC-T3100X','A1',24],
  [4481,'C11CH80301A0','SC-T3700D','A1',24],
  [4484,'C11CJ56301A0','SC-T5405','A0',36],
  [4485,'C11CH81301A0','SC-T5700D','A0',36],
  [4486,'C11CH83301A0','SC-T7700D','B0',44],
  [4610,'F9A28D','T830','A1',24],
  [4611,'2Y9H2A','T850','A0',36],
  [4612,'2Y9H3A','T950','A0',36],
  [4613,'W6B55A','T1700','A0',44],
  [4614,'1VD87A','T1700','A0',44],
  [4615,'W6B56A','T1700DR','A0',44],
  [4616,'1VD88A','T1700DR','A0',44],
  [4623,'2Y9H1A','T950','A0',36]
];
export const wideFormatRules=rows.map(([id,sku,model,format,width])=>({id,sku,model,format,width}));
export function wideFormatRule(product={}) {
  const name=String(product.name||'').trim();
  if(!/^(?:принтер|printer|бфп|мфу|mfp|багатофункціональний пристрій)\s/iu.test(name))return null;
  const compact=name.toUpperCase().replace(/\s+(DM|DR)\b/gu,'$1');
  return wideFormatRules.find(rule=>String(product.sku||'').trim().toUpperCase()===rule.sku&&new RegExp('\\b'+rule.model+'\\b','u').test(compact))||null;
}
export function applyWideFormatRule(specifications={},product={}) {
  const rule=wideFormatRule(product), result={...specifications};
  const inferredWidth=readPrinterMediaWidth({...product,specifications});
  if(inferredWidth&&!String(result[mediaWidthKey]||'').trim())result[mediaWidthKey]=inferredWidth;
  if(!rule)return result;
  // Fill gaps, and correct only the two reviewed legacy A4 summaries.
  if(!String(result['Формат']||'').trim()||([4610,4611].includes(rule.id)&&/^[AА]4$/iu.test(String(result['Формат']).trim())))result['Формат']=rule.format;
  if(rule.width&&!String(result[mediaWidthKey]||'').trim())result[mediaWidthKey]=mediaWidthLabels[rule.width];
  return result;
}
export function wideFormatRepair(product={}) {
  const rule=wideFormatRule(product);
  if(!rule||Number(product.id)!==rule.id||!product.specifications||Array.isArray(product.specifications))return null;
  const specifications=applyWideFormatRule(product.specifications,product);
  return JSON.stringify(specifications)===JSON.stringify(product.specifications)?null:{id:rule.id,sku:rule.sku,before:product.specifications,specifications};
}
