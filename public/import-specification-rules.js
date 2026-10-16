import {normalizeSpecifications} from './specification-normalization.js?v=20261017-customer-content';
import {isProjectorProduct,resolveProjectorSpecifications} from './projector-specs.js?v=20261013-spec-colons';
import {isPrinterDevice} from './printer-display.js?v=20261016-import-guards-2';
import {duplexKey,duplexLabels,printerDuplexMode,writePrinterDuplex} from './printer-duplex.js?v=20261016-import-guards-2';
import {verifiedPrinterRule,applyVerifiedPrinterRule,printFormatKey,scannerOnly} from './verified-printer-rules.js?v=20261016-import-guards-2';
import {applyWideFormatRule} from './wide-format-printers.js?v=20261017-customer-content';
import {productInterfaceValues} from './product-connectivity.js?v=20261017-customer-content';
import {applyCustomerProductPolicy} from './product-content-policy.js?v=20261017-customer-content';

export function normalizeImportedProductSpecifications(product) {
  product=applyCustomerProductPolicy(product);
  const projector=isProjectorProduct(product);
  let specs=normalizeSpecifications(product.specifications||{},{projector});
  if(isPrinterDevice(product)||scannerOnly(product)){
    const interfaces=productInterfaceValues({...product,specifications:specs});
    if(interfaces.includes('Wi‑Fi')&&!String(specs['Інтерфейси']||'').trim())specs['Інтерфейси']=interfaces.join(', ');
  }
  if(projector)return resolveProjectorSpecifications({...product,specifications:specs});
  const rule=verifiedPrinterRule(product);
  if(rule)return applyVerifiedPrinterRule(specs,rule);
  if(scannerOnly(product)) {
    // A scanner's generic «Дуплекс» refers to scanning, never to printing.
    return Object.fromEntries(Object.entries(specs).filter(([key])=>!duplexKey.test(key)||/^дуплекс\s*[:：]?$/iu.test(key)));
  }
  if(isPrinterDevice(product)){
    specs=applyWideFormatRule(specs,product);
    const mode=printerDuplexMode(Object.entries(specs),[product.description,...Object.values(specs)].join(' '));
    if(duplexLabels[mode])specs=writePrinterDuplex(specs,mode);
  }
  return specs;
}
const base=key=>String(key).trim().toLocaleLowerCase('uk-UA').replace(/\s*\(інше значення \d+\)$/u,'');
export function mergeImportedSpecifications(current,incoming,product={}) {
  const projector=isProjectorProduct(product);
  const saved=normalizeSpecifications(current||{},{projector});
  const fresh=normalizeImportedProductSpecifications({...product,specifications:incoming});
  const protectedKeys=new Set(Object.keys(saved).map(base));
  const hasDuplex=Object.keys(saved).some(key=>duplexKey.test(key));
  const hasFormat=Object.keys(saved).some(key=>printFormatKey.test(key));
  const additions=Object.fromEntries(Object.entries(fresh).filter(([key])=>!protectedKeys.has(base(key))&&!(hasDuplex&&duplexKey.test(key))&&!(hasFormat&&printFormatKey.test(key))));
  return normalizeSpecifications({...additions,...saved},{projector});
}
