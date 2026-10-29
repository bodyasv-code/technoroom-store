import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseMtiPriceRows,matchMtiPriceRows,mtiNumber,mtiStock,mtiWorksheetRange} from '../public/mti-price.js';
import {mtiPreviewMarkup} from '../public/mti-price-admin.js';
const headers=['Категорія верхнього рівня','Код категорії товару','Категорія товару ','Тип','Номер','Кількість для  замовлення','Бренд','Модель','Код товара постачальника','Опис ','Парт номер','РРЦ, грн','Ціна продажу, грн','Знижка, грн','Контроль РРЦ','Придбання без курс. ризиків','На складі','Зарезервовано клієнтом','Одиниця виміру','Кількість в упаковці','Одиниця продажу','Гарантія, міс.','Штрихкод (GTIN)','Код УКТЗЕД','Країна виробника'];
const source=(changes={})=>{
  const row=['Презентаційне обладнання','ПРОЕКТОРИ','Проектори','Товар','sample-1',99,'EPSON','TestModel','TEST-MPN','Проектор для презентацій','TEST-MPN',12000,10000,2000,'ТАК','Ні',3,0,'Штука',1,'Штука',24,'','',''];
  for(const [key,value]of Object.entries(changes))row[Number(key)]=value;return row;
};
const parse=(rows=[source()],headings=headers)=>parseMtiPriceRows([['Замовлення МТІ'],['Магазин'],[],headings,...rows]);
test('actual populated cells override stale exported dimensions without allocating unbounded sheets',()=>{
  assert.equal(mtiWorksheetRange({'!ref':'A1:Z4',A1:{v:'Title'},Y4:{v:'Header'},Y108:{v:'Product'},Z200:{v:''}}),'A1:Y108');
  assert.equal(mtiWorksheetRange({'!ref':'A1:XFD1048576',A1:{v:'Title'}}),'A1:A1');
  assert.throws(()=>mtiWorksheetRange({A50001:{v:'Too far'}}),/діапазон/);
  assert.throws(()=>mtiWorksheetRange({XFD4:{v:'Too wide'}}),/діапазон/);
});

test('MTI columns are mapped by headers, retail uses RRP and all source identifiers stay separate',()=>{
  const result=parse(),row=result.rows[0];
  assert.equal(result.headerRow,4);assert.equal(row.sourceRow,5);
  assert.equal(row.price,12000);assert.equal(row.supplierPrice,10000);assert.equal(row.priceBasis,'rrp');
  assert.equal(row.supplierId,'sample-1');assert.equal(row.supplierSku,'TEST-MPN');assert.equal(row.sku,'TEST-MPN');
  assert.equal(row.stock,3);assert.equal(row.hasStock,true);assert.equal(row.vendor,'Epson');
  assert.equal(row.content.specifications['Гарантія'],'24 міс.');assert.deepEqual(row.images,[]);
  const shuffled=headers.map((_,i)=>i).reverse();
  const matrix=[shuffled.map(i=>headers[i]),shuffled.map(i=>source()[i])];
  assert.equal(parseMtiPriceRows(matrix).rows[0].price,12000);
});

test('missing RRP never falls back to supplier price or order quantity',()=>{
  const row=parse([source({11:'',16:'-'})]).rows[0];
  assert.equal(row.hasPrice,false);assert.equal(row.price,0);assert.equal(row.supplierPrice,10000);
  assert.equal(row.hasStock,false);assert.equal(row.stockDetail.quantity,null);
  assert.ok(row.issues.length);
  assert.equal(mtiNumber('-4'),null);assert.equal(mtiNumber('1 200,50'),1200.5);
  assert.equal(mtiNumber('1e5'),null);assert.equal(mtiNumber('9'.repeat(500)),null);
});

test('at-least stock and reservations are preserved as uncertain, never invented exact stock',()=>{
  assert.deepEqual(mtiStock('10 і більше'),{kind:'at_least',quantity:null,minimum:10,label:'10 і більше'});
  for(const value of ['-',null,'yes','2.5'])assert.equal(mtiStock(value).kind,'unknown');
  const row=parse([source({16:'10 і більше',17:2})]).rows[0];
  assert.equal(row.hasStock,false);assert.equal(row.stockDetail.minimum,10);
  assert.equal(row.reserved,2);assert.equal(row.stock,0);assert.ok(row.issues.some(i=>i.includes('резерву')));
});

test('codes that differ, duplicate part numbers and catalog collisions require review',()=>{
  const row=parse([source({6:'VIEWSONIC',7:'MODEL-A',8:'MODEL-B',10:'VS-TEST'})]).rows[0];
  assert.equal(row.vendor,'ViewSonic');assert.ok(row.issues.length);
  assert.equal(matchMtiPriceRows([row],[{id:1,sku:'VS-TEST',brand:'ViewSonic'}])[0].matchedProductId,null);
  assert.ok(parse([source(),source({4:'sample-2'})]).rows.every(r=>r.issues.some(i=>i.includes('повторюються'))));
  const plain=parse().rows;
  assert.equal(matchMtiPriceRows(plain,[{id:1,sku:'TEST-MPN',brand:'Canon'}])[0].matchedProductId,null);
  assert.ok(matchMtiPriceRows(plain,[{id:1,sku:'TEST-MPN',brand:'Canon'}])[0].issues.length);
  assert.equal(matchMtiPriceRows(plain,[{id:1,sku:'test-mpn',brand:'EPSON'}])[0].matchedProductId,1);
  assert.equal(matchMtiPriceRows(plain,[{id:1,sku:'TEST-MPN',brand:'Epson'},{id:2,sku:'TEST-MPN',brand:'Epson',is_active:false}])[0].matchedProductId,null);
});

test('unrecognized currency, duplicate headers and empty workbooks are rejected',()=>{
  assert.throws(()=>parse([],headers),/не знайдено товарів/);
  assert.throws(()=>parse([source()],headers.map(h=>h==='РРЦ, грн'?'РРЦ, USD':h)),/не розпізнано/);
  assert.throws(()=>parse([source()],[...headers,'Бренд']),/Неоднозначна/);
  assert.ok(parse([source({1:'ІНШАКАТЕГОРІЯ'})]).rows[0].issues.some(i=>i.includes('Категорію')));
});

test('preview escapes supplier text and has no product-writing capability',()=>{
  const row=matchMtiPriceRows(parse([source({7:'<img onerror=alert(1)>'})]).rows,[])[0];
  const markup=mtiPreviewMarkup([row]);assert.ok(markup.includes('&lt;img'));assert.ok(!markup.includes('<img'));
  for(const file of ['mti-price.js','mti-price-admin.js']){
    const code=readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
    assert.doesNotMatch(code,/\.rpc\(|\.from\(|\.insert\(|\.update\(|\.upload\(/);
  }
});
