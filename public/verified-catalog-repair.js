import {verifiedDuplexRepair} from './verified-duplex-repair.js?v=20261016-canon-duplex';
import {verifiedPrinterRule,applyVerifiedPrinterRule} from './verified-printer-rules.js?v=20261016-import-guards';

export function verifiedCatalogRepair(product) {
  const rule=verifiedPrinterRule(product);
  if(!rule||Number(product.id)!==rule.id||!product.specifications||Array.isArray(product.specifications))return verifiedDuplexRepair(product);
  // Preserve later explicit editor choices; resolve only legacy representations.
  if(rule.duplex&&Object.hasOwn(product.specifications,'Двосторонній друк'))return null;
  // Keep already-completed legacy nine-product repairs intact.
  if([4433,4443,4444,4530,4531,4551,4599,4600,4607].includes(rule.id))return verifiedDuplexRepair(product);
  const specifications=applyVerifiedPrinterRule(product.specifications,rule);
  const unchanged=Object.keys(specifications).length===Object.keys(product.specifications).length&&Object.entries(specifications).every(([key,value])=>JSON.stringify(product.specifications[key])===JSON.stringify(value));
  return unchanged?null:{id:rule.id,sku:rule.sku,before:product.specifications,specifications};
}
