import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {supplierProductContent,supplierBrandConflict} from '../public/supplier-product-content.js';
import {buildImportChangePlan} from '../public/import-change-plan.js';
import {createImportAudit} from '../public/import-audit.js';

const projector={sku:'V11HB60042',vendor:'EPSON PROJECTORS',name:'Проєктор Epson EB-994F',
  description:'Проєктор для презентацій. Шановні партнери! Дилерська акція.',
  specifications:{'Роздільна здатність':'1920x1080','Джерело світла':'Lamp'},
  hasPrice:true,price:61425,hasStock:true,stock:2,images:['https://example.org/product.jpg']};

test('mapped supplier rows share content rules without altering their commercial data',()=>{
  const snapshot=structuredClone(projector);
  const expected=supplierProductContent(projector,'projectors');
  assert.equal(expected.brand,'Epson');
  assert.equal(expected.description,'Проєктор для презентацій.');
  assert.equal(expected.specifications['Джерело світла'],'Lamp');
  for(const supplier of ['ERC','ASBIS','MTI']){
    const row={...structuredClone(projector),supplier};
    assert.deepEqual(supplierProductContent(row,'projectors'),expected);
    assert.equal(row.price,61425);assert.equal(row.stock,2);
    assert.equal(row.supplier,supplier);assert.deepEqual(row.images,projector.images);
  }
  assert.deepEqual(projector,snapshot);
});

test('new-product preview uses exactly the normalized content passed to the writer',()=>{
  const content=supplierProductContent(projector,'projectors');
  const plan=buildImportChangePlan(projector,null,{publish:true},'projectors');
  for(const key of ['name','brand','description','specifications']){
    assert.deepEqual(plan.changes.find(c=>c.key===key)?.after,content[key]);
  }
  const source=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
  assert.match(source,/const content=supplierProductContent\(row,category\);/);
  assert.match(source,/description: content.description \|\| null, specifications: content.specifications/);
});

test('existing manual content remains protected for every mapped supplier',()=>{
  const current={id:1,sku:projector.sku,name:'Перевірена назва',brand:'Epson',category:'projectors',
    description:'Перевірений опис',image_path:'manual.jpg',specifications:{'Роздільна здатність':'1920x1080'},
    manual_overrides:{verified_specifications:true,description:true}};
  for(const supplier of ['ERC','ASBIS','MTI']){
    const plan=buildImportChangePlan({...projector,supplier},current,{images:true},'projectors');
    assert.equal(plan.patch.name,undefined);assert.equal(plan.patch.description,undefined);
    assert.equal(plan.patch.specifications,undefined);assert.equal(plan.images,'preserve');
  }
});

test('same SKU of a different brand is blocked before any supplier write',()=>{
  for(const supplier of ['ERC','ASBIS','MTI']){
    const row={...projector,supplier};
    const saved={id:1,sku:row.sku,brand:'Canon',category:'projectors'};
    const audit=createImportAudit([row],[saved])(row,{mapped:true,category:'projectors',updateCategory:false});
    assert.ok(audit.blocked);
    assert.ok(audit.issues.some(i=>i.code==='brand-conflict'&&i.level==='block'));
  }
  assert.equal(supplierBrandConflict(projector,{brand:'Epson'}),false);
  assert.equal(supplierBrandConflict({...projector,vendor:'Canon Printing'},{brand:'CANON'}),false);
  assert.equal(supplierBrandConflict({...projector,vendor:''},{brand:'Canon'}),false);
});
