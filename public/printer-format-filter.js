import {readPrinterEditorFormat} from './printer-format-editor.js?v=20261016-wide-format';
import {wideFormatRule,mediaWidthKey,mediaWidthLabels} from './wide-format-printers.js?v=20261016-wide-format';
// Group only in the catalog filter; retain precise product specifications.
export function printerFormatFilterValues(source) {
  const values=[];
  for(const format of ['B0','A0','A1','A2'])if(new RegExp('(?:^|[^a-zа-яіїєґ0-9])'+format.replace('A','[aа]').replace('B','[bв]')+'(?:$|[^a-zа-яіїєґ0-9])','iu').test(source))values.push(format);
  if (/(?:^|[^a-zа-яіїєґ0-9])[aа]3(?:$|[^a-zа-яіїєґ0-9])/iu.test(source)) values.push('A3');
  if (/(?:^|[^a-zа-яіїєґ0-9])[aа]4(?:$|[^a-zа-яіїєґ0-9])/iu.test(source)) values.push('A4');
  return values;
}
export function printerProductFormatValues(product={}) {
  // Only direct printing fields or the opening product classification count.
  const format=readPrinterEditorFormat(product.specifications||{},product.name)||wideFormatRule(product)?.format;
  return format?printerFormatFilterValues(format):[];
}
export function printerMediaWidthValues(product={}) {
  if(!/^office-wide-format$/u.test(String(product.category||product.type||'')))return [];
  const saved=String(product.specifications?.[mediaWidthKey]||'').trim();
  if(saved)return [saved];
  const rule=wideFormatRule(product);
  if(rule?.width)return [mediaWidthLabels[rule.width]];
  // A quoted width in a wide-format device name is not its scanner width.
  if(!/^(?:принтер|printer|бфп|багатофункціональний пристрій)\s/iu.test(String(product.name||'')))return [];
  const width=/\b(24|36|44)\s*["'″”]/u.exec(String(product.name||''))?.[1];
  return width?[mediaWidthLabels[width]]:[];
}
