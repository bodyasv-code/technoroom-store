import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {printerEditorFormats,readPrinterEditorFormat as read,writePrinterEditorFormat as write} from '../public/printer-format-editor.js';
import {printerFormatFilterValues} from '../public/printer-format-filter.js';
import {mergeImportedSpecifications} from '../public/import-specification-rules.js';
import {createQualityAudit} from '../public/catalog-quality.js';
import {verifiedCatalogRepair} from '../public/verified-catalog-repair.js';
assert.deepEqual(printerEditorFormats,['A4','A3','A2','A1','A0','B0']);
for(const format of printerEditorFormats){const saved=write({'Інтерфейси':['USB']},format);assert.equal(read(saved),format);assert.deepEqual(saved['Інтерфейси'],['USB']);assert.equal(read(mergeImportedSpecifications(saved,{'Формат друку':'A4'},{name:'БФП Інший'})),format);}
assert.equal(read({'Формат':'А3+'},'БФП A3 Epson'),'A3+');
assert.equal(read({'Формат':'A3/A3+'},'БФП A3 Epson'),'A3/A3+');
assert.equal(read({},'БФП А4 Canon MAXIFY GX2040 з Wi-Fi'),'A4');
assert.equal(read({},'БФП ink color A3 Epson L15150'),'A3');
assert.equal(read({'Сканування':'A4','Формат сканування':'A4','Лотки':'A4'},'БФП Canon'), '');
assert.equal(read({'Формат':'A3+'},'БФП A4'),'A3+');
assert.deepEqual(printerFormatFilterValues('A3/A3+'),['A3']);
const original={'Формат':'A3','Формат друку':'A3+','Сканування':'A4','Інтерфейси':['USB']};
assert.deepEqual(write(original,'A3/A3+'),{'Формат':'A3/A3+','Сканування':'A4','Інтерфейси':['USB']});
assert.equal(original['Формат'],'A3');
for(const format of ['A3','A3+','A3/A3+']){
  const product={id:4418,sku:'C11CH72404',name:'БФП Epson L15150',specifications:{'Формат':format}};
  assert.equal(verifiedCatalogRepair(product),null);
  assert.equal(mergeImportedSpecifications(product.specifications,{'Формат':'A3'},product)['Формат'],format);
}
assert.equal(verifiedCatalogRepair({id:4418,sku:'C11CH72404',name:'БФП Epson L15150',specifications:{'Формат':'A3','Принтер, сканер. Формат':'А3+'}}).specifications['Формат'],'A3+');
const product={id:4346,name:'БФП А4 Canon GX2040',brand:'Canon',category:'office-mfp-color',price:1,image_path:'x',specifications:write({'Тип друку':'Кольоровий','Технологія друку':'Струменевий'},'A4')};
assert.equal(createQualityAudit([product],[{slug:'office-mfp-color'}])[0].issues.some(i=>i.code==='filters'),false);
const admin=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
assert.match(admin,/<option value="A3">A3<\/option>/);
assert.doesNotMatch(admin,/<option value="A3\/A3\+">/);
assert.doesNotMatch(admin,/<option value="A3\+">A3\+<\/option>/);
assert.ok(admin.includes("formatSelect.value=formatValue==='A3/A3+'?'A3':formatValue.replace"));
assert.match(admin,/formatControl.dataset.changed==='true'\|\|!hasPrinterFormat\(specifications\)/);
console.log('Editor formats, exact/grouped persistence, filter mapping, import preservation and quality check: OK');
