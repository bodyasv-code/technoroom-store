import assert from 'node:assert/strict';
import {wideFormatRules,wideFormatRule,applyWideFormatRule,wideFormatRepair,mediaWidthKey} from '../public/wide-format-printers.js';
import {printerProductFormatValues as formats,printerMediaWidthValues as widths} from '../public/printer-format-filter.js';
import {readPrinterEditorFormat as read} from '../public/printer-format-editor.js';
import {normalizeImportedProductSpecifications as incoming,mergeImportedSpecifications as merge} from '../public/import-specification-rules.js';
import {verifiedCatalogRepair} from '../public/verified-catalog-repair.js';
for(const rule of wideFormatRules){
  const product={id:rule.id,sku:rule.sku,name:'Принтер '+rule.model,category:'office-wide-format',specifications:{'Сканування':'A4','Інтерфейси':['USB']}};
  assert.equal(wideFormatRule(product),rule);
  const repaired=verifiedCatalogRepair(product);
  assert.equal(repaired.specifications['Формат'],rule.format);
  assert.deepEqual(repaired.specifications['Інтерфейси'],['USB']);
  assert.equal(verifiedCatalogRepair({...product,specifications:repaired.specifications}),null);
  assert.equal(incoming(product)['Формат'],rule.format);
  assert.equal(wideFormatRepair({...product,id:0}),null);
  assert.equal(wideFormatRule({...product,sku:'unknown'}),null);
  assert.equal(wideFormatRule({...product,name:'Картридж '+rule.model}),null);
  assert.equal(merge({'Формат':'A2',[mediaWidthKey]:'custom'},incoming(product),product)['Формат'],'A2');
  assert.equal(merge({'Формат':'A2',[mediaWidthKey]:'custom'},incoming(product),product)[mediaWidthKey],'custom');
}
for(const [id,sku,name,format] of [[4610,'F9A28D','Багатофункціональний пристрій HP DesignJet T830','A1'],[4611,'2Y9H2A','БФП HP DesignJet T850','A0']]){
  const product={id,sku,name,specifications:{'Формат':'A4','Принтер, сканер, копір. Формат':format}};
  const repaired=wideFormatRepair(product);
  assert.equal(repaired.specifications['Формат'],format);
  assert.equal(repaired.specifications['Принтер, сканер, копір. Формат'],format);
}
assert.equal(wideFormatRule({sku:'C11CH82301A0',name:'БФП Epson SureColor SC-T5700 DM 36'}).format,'A0');
assert.deepEqual(formats({name:'Принтер A2 Canon',specifications:{'Формат сканування':'A4','Лоток':'A3'}}),['A2']);
assert.deepEqual(formats({name:'Принтер Other',specifications:{'Формат сканування':'A4'}}),[]);
assert.deepEqual(formats({specifications:{'Формат':'A0 (36, 914 мм)','Підтримувані розміри носіїв':'A4,A3'}}),['A0']);
assert.deepEqual(formats({specifications:{'Формат':'A3+'}}),['A3']);
assert.equal(read({'Формат':'A1+ (24, 610 мм)'}),'A1+');
assert.deepEqual(widths({name:'Принтер Wide 36\"',category:'office-wide-format',specifications:{'Ширина сканування':'24\"'}}),['36″ (914 мм)']);
assert.deepEqual(widths({name:'Сканер 44\"',category:'office-scanners'}),[]);
assert.deepEqual(widths({sku:'C11CH84301A0',name:'БФП Epson SC-T7700 DM',category:'office-wide-format'}),['44″ (1118 мм)']);
const detailed={'Формат':'A1+ (24, 610 мм)','Докладно':'original'};
assert.equal(applyWideFormatRule(detailed,{sku:'C11CJ15301A0',name:'Принтер SC-T3100X'})['Формат'],detailed['Формат']);
console.log('Wide-format exact SKU repairs, import priority, A-series/media/scanner separation: OK');
