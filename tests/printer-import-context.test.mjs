import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {printerDeviceKind,verifiedCanonPrintMode,inferredPrintColour,installationAccessory,printPaperPlan} from '../public/printer-import-context.js';
import {isSpecializedPrinterName} from '../public/product-identity.js';
import {createImportAudit} from '../public/import-audit.js';
assert.equal(printerDeviceKind('Багатофункціональний пристрій A3 Xerox (Базовий блок, 1 лоток)'),'mfp');
assert.equal(printerDeviceKind('Комплект інсталяції Xerox VersaLink'),'');
assert.equal(printerDeviceKind('Картридж для принтера Canon GM4040'),'');
assert.ok(installationAccessory('Комплект інсталяції Xerox C7120'));
assert.ok(installationAccessory('Installation kit Xerox'));
assert.equal(inferredPrintColour('Принтер невідомий; OLED-дисплей (монохромний)'), '');
assert.equal(inferredPrintColour('БФП кольоровий; РК-екран монохромний; Сканер кольоровий'), 'color');
assert.equal(inferredPrintColour('БФП монохромний; Сканер кольоровий;'), 'mono');
assert.equal(inferredPrintColour('БФП моно A4 Pantum M6500W; Кольорове копіювання: опис'), 'mono');
assert.equal(inferredPrintColour('БФП А3 ч/б Canon iR2224 II; Кольоровий сканер'), 'mono');
assert.equal(inferredPrintColour('Принтер кольоровий; Швидкість монохромного друку 20'), 'color');
assert.equal(inferredPrintColour('Принтер Canon MAXIFY BX110; OLED-дисплей (монохромний)'), 'color');
assert.equal(inferredPrintColour('БФП Canon MAXIFY GX4040; РК-екран монохромний'), 'color');
assert.equal(inferredPrintColour('БФП Canon PIXMA GM4040 БФП струменеві кольорові'), 'mono');
assert.equal(verifiedCanonPrintMode('Картридж для Canon GM4040'),'');
assert.equal(verifiedCanonPrintMode('БФП Canon PIXMA GM4040X'),'');
assert.equal(verifiedCanonPrintMode('БФП Canon PIXMA UNKNOWN'),'');
assert.equal(printPaperPlan('Папір Canon ZINK 2x3').childSlug,'office-consumables-paper');
assert.equal(printPaperPlan('Принтер для паперу'),null);

// Exercise actual production category functions without DOM, network or writes.
const source=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
const extract=name=>source.match(new RegExp('  const '+name+' = \\(row\\) => \\{[\\s\\S]*?\\n  };'))?.[0];
const deps={isSpecializedPrinterName,installationAccessory,verifiedCanonPrintMode,cleanImportText:value=>String(value||'').trim(),
  isWideFormat:()=>false,printColourMode:()=>'',printerDeviceKind};
const production=name=>new Function('deps','with(deps){'+extract(name)+';return '+name+';}')(deps);
const office=production('officeEquipmentCategoryPlan'),standard=production('standardCategoryPlan');
for(const [name,subcategory,slug] of [
  ['Багатофункціональний пристрій A3 кольоровий Xerox C7120 (Базовий блок, 1 лоток)','БФП лазерні кольорові','office-mfp-color'],
  ['Багатофункціональний пристрій A3 монохромний Xerox B7125 (Базовий блок, 1 лоток)','БФП лазерні монохромні','office-mfp-mono'],
  ['Комплект інсталяції Xerox C7120','БФП лазерні кольорові','office-accessories'],
  ['БФП Canon PIXMA GM4040','БФП струменеві кольорові','office-mfp-mono']])
  assert.equal(office({name,subcategory}).childSlug,slug,name);
for(const name of ['Телевізор 40 2E','Телевізор 75 Samsung','Телевізор LG','Television LG','TV Sony'])
  assert.equal(standard({name,subcategory:'Телевізори споживчі'}).childSlug,'erc-display-07',name);

const row={sku:'S',name:'БФП Canon MAXIFY GX4040',hasPrice:true,price:1,specifications:{'Тип друку':'Кольоровий'},subcategory:'БФП кольорові'};
const saved={sku:'S',category:'office-mfp-color',specifications:{'Тип друку':'Кольоровий'}};
const meta={mapped:true,category:'office-mfp-color',updateCategory:false};
assert.equal(createImportAudit([row],[saved])(row,meta).blocked,false);
const moved=createImportAudit([row],[{...saved,category:'old'}]);
assert.ok(!moved(row,meta).issues.some(i=>i.code==='category-change'));
assert.ok(moved(row,{...meta,updateCategory:true}).issues.some(i=>i.code==='category-change'));
assert.ok(createImportAudit([row],[{...saved,category:'планшетнии-комп-ютер'}])(row,meta).issues.some(i=>i.code==='saved-device-category'));
const paper={...row,name:'Папір Canon ZINK'};
assert.ok(createImportAudit([paper],[{...saved,category:'office-consumables-cartridges'}])(paper,{...meta,category:'office-consumables-paper'}).issues.some(i=>i.code==='saved-paper-category'));
const realConflict={...row,name:'Принтер інший',specifications:{'Тип друку':'Монохромний'}};
assert.ok(createImportAudit([realConflict],[saved])(realConflict,meta).blocked);
const wide={...row,name:'Принтер HP DesignJet',specifications:{},subcategory:'Широкоформатні'};
assert.ok(!createImportAudit([wide],[saved])(wide,{...meta,category:'office-wide-format'}).issues.some(i=>i.code==='unknown-print'));
console.log('Unicode device/category matching, screen/scanner separation, exact Canon exceptions, real conflicts and preserved-category warnings: OK');
