import test from 'node:test';
import assert from 'node:assert/strict';
import {planDuplicateSpecificationTails as plan} from '../public/specification-duplicate-tails.js';
import {normalizeImportedProductSpecifications} from '../public/import-specification-rules.js';
import {specificationContentProblems} from '../public/supplier-specification-parser.js';

const specs={'Накопичувач':'256 Гб, опціонально 1 Тб (497K25310) Процесор: чотирьохядерний 1.91 GHz Лотки подачі: 2*520 арк. + 100 арк. обхідний лоток','Процесор':'чотирьохядерний 1.91 GHz','Лотки подачі':'2*520 арк. + 100 арк. обхідний лоток',"Маштабування":"25-400% Пам'ять: 4 Гб","Пам'ять":'4 Гб','Роздільна здатність':'600*600 dpi Можливості сканування: Scan to E-mail Макс кількість копій: 9999','Можливості сканування':'Scan to E-mail','Макс кількість копій':9999};
const product={id:4760,sku:'B8201V_F',category:'office-mfp-mono',specifications:specs};
test('multiple exact repeated tails shorten the original fields; optional equipment and all sibling values remain',()=>{
  const snapshot=JSON.stringify(product),result=plan(product);
  assert.equal(result.changes.length,3);assert.equal(result.after['Накопичувач'],'256 Гб, опціонально 1 Тб (497K25310)');
  assert.equal(result.after['Маштабування'],'25-400%');assert.equal(result.after['Роздільна здатність'],'600*600 dpi');
  for(const [key,value] of Object.entries(specs))if(!result.changes.some(c=>c.key===key))assert.equal(result.after[key],value);
  assert.equal(JSON.stringify(product),snapshot);assert.deepEqual(plan({...product,specifications:result.after}).changes,[]);
});
test('never extract missing facts, shorten disagreements, change unit case or clean unrelated categories',()=>{
  for(const specifications of [
    {Память:'4 Гб Процесор: ABC'},
    {Память:'4 Гб Процесор: ABC',Процесор:'XYZ'},
    {Память:'4 Гб Потужність: 4 mW',Потужність:'4 MW'},
    {Память:'4 Гб Процесор: ABC extra',Процесор:'ABC'},
    {Память:'Процесор: ABC',Процесор:'ABC'},
    {Память:'4 Гб Оперативна пам’ять: 8 Гб','пам’ять':'8 Гб'},
    {Память:'4 Гб Процесор: ABC',Процесор:'ABC','процесор (інше значення 2)':'ABC'},
  ])assert.deepEqual(plan({...product,specifications}).changes,[]);
  assert.deepEqual(plan({...product,category:'cat-power'}).changes,[]);
});
test('manual or reviewed fields, arrays and booleans are preserved',()=>{
  assert.deepEqual(plan({...product,manual_overrides:{verified_specifications:true}}).changes,[]);
  for(const manual_overrides of [{specifications:{Накопичувач:true}},{reviewed_specifications:['Накопичувач']}]){
    const result=plan({...product,manual_overrides});assert.equal(result.after['Накопичувач'],specs['Накопичувач']);assert.equal(result.changes.length,2);
  }
  const result=plan({...product,specifications:{Память:['4 Гб Процесор: ABC'],Процесор:'ABC',Опція:false}});
  assert.deepEqual(result.changes,[]);assert.equal(result.after.Опція,false);
  assert.doesNotThrow(()=>plan({...product,manual_overrides:{reviewed_specifications:true}}));
});
test('future imports use the same cleanup and suspicious unsupported fields are sent for review',()=>{
  const source={category:'office-accessories',specifications:{ОС:'Windows Процесор: ARM',Процесор:'ARM'}};
  assert.equal(normalizeImportedProductSpecifications(source).ОС,'Windows');
  for(const value of ['iOS Тип та розмір екрану: РК','600 dpi Можливості сканування: E-mail','256 Гб Процесор: ARM'])assert.equal(specificationContentProblems({Поле:value})[0].reason,'flattened');
  assert.deepEqual(specificationContentProblems({Інтерфейс:'Wi-Fi: IEEE802.11 b/g/n',Контраст:'350:1',Документ:'https://example.com/a:b'}),[]);
});
test('nested sibling copies are cleaned in one operation regardless of field order',()=>{
  const result=plan({category:'office-scanners',specifications:{EMC:'клас B Завадостійкість 55035:2017','Завадостійкість 55035':'2017 Безпека IEC 62368-1:2018','Безпека IEC 62368-1':'2018'}});
  assert.equal(result.after.EMC,'клас B');assert.equal(result.after['Завадостійкість 55035'],'2017');
  assert.deepEqual(plan({category:'office-scanners',specifications:result.after}).changes,[]);
});
