import test from 'node:test';
import assert from 'node:assert/strict';
import {buildContentPreview,contentPreviewMarkup} from '../public/product-content-preview.js';
const canon={id:4331,name:'БФП Canon MF667Cdw',brand:'Canon',sku:'6928C001',category:'office-mfp-color',specifications:{'Формат друку':'A4','Тип друку':'Кольоровий','Роздільна здатність':'600×600 dpi','Роздільна здатність копіювання':'600×600 dpi','Двосторонній друк':'Ручний'}};
const asus={id:159,name:'Проєктор Asus ZenBeam Latte L1',brand:'ASUS',sku:'90LJ00E5-B00070',category:'projectors',specifications:{'Роздільна здатність':'HD','Технологія проекції':'DLP','Джерело світла':'LED','Яскравість':'300','Максимальна вхідна роздільна здатність':'1920×1080'}};
function preview(product,fields){return buildContentPreview(product,{msg:'OK',data:{GeneralInfo:{Brand:product.brand,BrandPartCode:product.sku},FeaturesGroups:[{FeatureGroup:{Name:{Value:'Приклад'}},Features:fields.map(([id,name,value,language='UK'])=>({Feature:{ID:id,Name:{Value:name,Language:language}},PresentationValue:value}))}]}});}
test('Canon: feature IDs map translated names without mixing print/copy/scanner resolution',()=>{
  const before=JSON.stringify(canon);
  const result=preview(canon,[['17727','Максимальний розмір паперу ISO A-формату','A4'],['11422','Друк','Кольоровий друк'],['61','Максимальна роздільна здатність','1200 x 1200 dpi'],['6435','Максимальна роздільна здатність копіювання','600 x 600 dpi'],['727','Роздільна здатність оптичного сканування','600 x 600 dpi']]);
  assert.equal(result.rows[0].status,'same');assert.equal(result.rows[1].status,'same');
  assert.equal(result.rows[2].canonical,'Роздільна здатність друку');assert.equal(result.rows[2].current.length,0);
  assert.equal(result.rows[3].status,'same');assert.equal(result.rows[4].current.length,0);
  assert.ok(result.rows.every(r=>r.mapping==='feature-id'&&!r.automatic));assert.equal(JSON.stringify(canon),before);
});
test('Duplex presence is distinct from manual/automatic mode and respects manual tombstones',()=>{
  const result=preview({...canon,manual_overrides:{specifications:{'Формат':true,'Двосторонній друк':true}}},[['3234','Duplex printing','Yes','EN'],['unknown','Duplex printing mode','Auto','EN'],['17727','Paper','A4']]);
  assert.equal(result.rows[0].current.length,0);assert.equal(result.rows[1].status,'manual-protected');assert.equal(result.rows[2].status,'manual-protected');
});
test('Projector: native, input, light source, projection technology and LED brightness remain distinct',()=>{
  const before=JSON.stringify(asus);
  const result=preview(asus,[['11807','Собственная разрешающая способность прэктора','1080p (1920x1080)'],['1179','Проекційна технологія','LED'],['40499','Тип джерела світла','LED'],['45336','Projector brightness','300 LED lumens','EN']]);
  const native=result.rows[0];assert.equal(native.status,'conflict');assert.equal(native.current.length,1);assert.equal(native.current[0].value,'HD');assert.match(native.notes.join(' '),/1280×720/);assert.ok(native.reasons.includes('language-review'));
  assert.equal(result.rows[1].status,'conflict');assert.ok(result.rows[1].notes.length);
  assert.equal(result.rows[2].status,'same');assert.equal(result.rows[3].current.length,0);assert.match(result.rows[3].notes.join(' '),/ANSI/);
  assert.equal(JSON.stringify(asus),before);assert.equal(result.databaseWrites,0);
  const html=contentPreviewMarkup(result);assert.match(html,/ID Icecat/);assert.match(html,/Перевірити технічний зміст/);
});
test('Native comparison recognizes HD vs 1280x720, not maximum input or full HD support',()=>{
  const result=preview(asus,[['11807','Native','1280 x 720'],['2905','Full HD','Так'],['new-id','Maximum input resolution','1920x1080']]);
  assert.equal(result.rows[0].status,'same');assert.equal(result.rows[0].notes.length,0);
  assert.equal(result.rows[1].status,'unmapped');assert.equal(result.rows[1].current.length,0);
  assert.equal(result.rows[2].current.length,0);
});
test('ANSI and unqualified lumens never map to LED brightness',()=>{
  for(const value of ['300 ANSI lumens','300 ISO lumens','300 lm']){
    const result=preview(asus,[['45336','Projector brightness',value,'EN']]);
    assert.equal(result.rows[0].mapping,null);assert.equal(result.rows[0].current.length,0);assert.equal(result.rows[0].status,'unmapped');
  }
});
test('Category scope and unknown fields fail conservatively; language UK is not proof of translation',()=>{
  const unrelated={...canon,name:'Акумулятор',category:'batteries',specifications:{}};
  const result=preview(unrelated,[['11807','Собственный параметр','1920x1080'],['17727','Paper','A4'],['random','Невідомий параметр','Невідоме значення']]);
  assert.ok(result.rows.every(r=>r.status==='unmapped'&&r.mapping===null));
  assert.equal(result.summary.mappingReview,3);assert.equal(result.summary.languageReview,1);
  assert.match(contentPreviewMarkup(result),/Не означає, що характеристики немає/);
});
