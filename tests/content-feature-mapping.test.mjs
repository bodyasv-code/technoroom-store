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
test('Epson: supplier separators and range spacing are not technical conflicts',()=>{
  const epson={id:247,name:'Проєктор Epson EB-994F',brand:'Epson',sku:'V11HB60042',category:'projectors',specifications:{'Технологія':': 3LCD','Технологія проекції':'3LCD','Контраст':': 16000:1','Проекційне співвідношення':'1.3-2.09','Роздільна здатність':'1920 x 1080 (Full HD)'}};
  const before=JSON.stringify(epson);
  const result=preview(epson,[['1179','Проекційна технологія','3LCD'],['34','Контраст','16000:1'],['1825','Throw ratio','1.3 - 2.09'],['11807','Native','1080p (1920x1080)']]);
  assert.ok(result.rows.every(r=>r.status==='same'));assert.equal(JSON.stringify(epson),before);
  const asusSame=preview({...asus,specifications:{'Роздільна здатність':'1280 x 720 (HD)'}},[['11807','Native','720p (1280x720)']]);
  assert.equal(asusSame.rows[0].status,'same');
});
test('Category scope and unknown fields fail conservatively; language UK is not proof of translation',()=>{
  const unrelated={...canon,name:'Акумулятор',category:'batteries',specifications:{}};
  const result=preview(unrelated,[['11807','Собственный параметр','1920x1080'],['17727','Paper','A4'],['random','Невідомий параметр','Невідоме значення']]);
  assert.ok(result.rows.every(r=>r.status==='unmapped'&&r.mapping===null));
  assert.equal(result.summary.mappingReview,3);assert.equal(result.summary.languageReview,1);
  assert.match(contentPreviewMarkup(result),/Не означає, що характеристики немає/);
});
test('HP: translated duplex mode is compared separately from presence and is never auto-translated',()=>{
  const hp={...canon,id:4530,name:'Багатофункціональний пристрій HP Color Laser 178nw',brand:'HP',sku:'4ZB96A',specifications:{'Двосторонній друк':'Ручний'}};
  const result=preview(hp,[['9342','Тип дюплексного друку','Керівництво'],['3234','Підтримка двостороннього друку','Так']]);
  assert.equal(result.rows[0].canonical,'Двосторонній друк');assert.equal(result.rows[0].current[0].value,'Ручний');assert.equal(result.rows[0].value,'Керівництво');
  assert.equal(result.rows[0].status,'conflict');assert.ok(result.rows[0].reasons.includes('language-review'));assert.ok(result.rows[0].notes.length);
  assert.equal(result.rows[1].current.length,0);assert.equal(result.rows[1].canonical,'Підтримка двостороннього друку');
  const protectedResult=preview({...hp,manual_overrides:{specifications:{'Двосторонній друк':true}}},[['9342','Duplex printing mode','Auto','EN']]);
  assert.equal(protectedResult.rows[0].status,'manual-protected');assert.equal(protectedResult.rows[0].current[0].value,'Ручний');
  assert.equal(result.databaseWrites,0);assert.ok(result.rows.every(r=>!r.automatic));
});
test('Composite trays, ADF and generic memory are context, never inferred components',()=>{
  const card={...canon,specifications:{'Лотки':'подачі — 250 л., прийому — 100 л.','ADF':'є 50 л. Дуплекс: так',"пам'ять":'до 512 стор'}};
  const before=JSON.stringify(card);
  const result=preview(card,[['40554','Input','250 sheets'],['40555','Output','100 sheets'],['40560','ADF','Так'],['823','Capacity','50 sheets'],['6','RAM','1000 МБ']]);
  assert.ok(result.rows.every(r=>r.status==='related'&&r.current.length===0&&r.relatedCurrent.length===1));
  assert.equal(result.summary.related,5);assert.equal(result.rows[4].relatedCurrent[0].value,'до 512 стор');
  assert.equal(JSON.stringify(card),before);assert.equal(result.databaseWrites,0);
  const html=contentPreviewMarkup(result);assert.match(html,/не точна відповідність/);assert.match(html,/Не створювати дубль/);
});
test('Composite context manual overrides and tombstones remain protected',()=>{
  for(const specifications of [{Лотки:'250/100'},{}]){
    const card={...canon,specifications,manual_overrides:{specifications:{Лотки:true}}};
    const result=preview(card,[['40554','Input','250 sheets'],['40555','Output','100 sheets']]);
    assert.ok(result.rows.every(r=>r.status==='manual-protected'&&!r.automatic));
  }
});
test('Input/output scan depth, file formats and copy duplex stay independent',()=>{
  const card={...canon,specifications:{'Глибина кольору сканування':'24 біти','Формати файлів сканування':'PDF; JPEG; TIFF','Двосторонній друк':'Ручний'}};
  const result=preview(card,[['7958','Input','24 біт'],['7959','Output','24 біт'],['2417','Images','JPEG, TIFF'],['7972','Documents','PDF'],['40540','Copy duplex','Так'],['39184','Copy mode','Авто']]);
  assert.ok(result.rows.slice(0,4).every(r=>r.status==='related'&&r.current.length===0));
  assert.notEqual(result.rows[0].canonical,result.rows[1].canonical);assert.notEqual(result.rows[2].canonical,result.rows[3].canonical);
  assert.ok(result.rows.slice(4).every(r=>r.current.length===0));assert.equal(result.rows[4].canonical,'Двостороннє копіювання');
});
test('Copy limit exposes Canon discrepancy but recognizes explicit maximum count units',()=>{
  const result=preview({...canon,specifications:{'макс. кількість копій':'9999','Масштабування копіювання':'25–400%'}},[['1974','Maximum','999 копій'],['701','Resize','25 - 400%']]);
  assert.equal(result.rows[0].status,'conflict');assert.equal(result.rows[0].current[0].value,'9999');assert.equal(result.rows[1].status,'same');
  assert.equal(preview({...canon,specifications:{'Максимальна кількість копій':'До 999'}},[['1974','Maximum','999 копій']]).rows[0].status,'same');
});
test('Projector brightness, noise modes, light lifespan and speaker details do not collapse',()=>{
  const card={...asus,specifications:{'Яскравість':'4100 лм','Світловий потік (лм)':': 4100','Шум (дБ)':'37/28','Джерело світла':'UHP 230W, 5500/12000','Динамік (Вт)':'2x5Вт'}};
  const result=preview(card,[['1181','Brightness','4100 лм'],['7889','Eco noise','28 дБ'],['37212','Standby noise','30 дБ'],['40501','Life','6500 год.'],['40500','Eco life','17000 год.'],['1854','Power','10 Вт']]);
  assert.equal(result.rows[0].status,'same');assert.ok(result.rows[0].notes.length);
  assert.ok(result.rows.slice(1).every(r=>r.status==='related'&&r.current.length===0));
  assert.notEqual(result.rows[1].canonical,result.rows[2].canonical);assert.notEqual(result.rows[3].canonical,result.rows[4].canonical);
  const bad=preview(card,[['1181','Brightness','4100 LED lumens']]);assert.equal(bad.rows[0].mapping,null);
});
test('Related text is escaped and never extracted into new technical facts',()=>{
  const card={...canon,specifications:{Лотки:'<img src=x onerror=bad()> 250/100'}};
  const result=preview(card,[['40554','Input','250 листів']]);
  assert.equal(result.rows[0].status,'related');assert.ok(!contentPreviewMarkup(result).includes('<img'));assert.match(contentPreviewMarkup(result),/&lt;img/);
  assert.equal(result.rows[0].current.length,0);assert.equal(result.rows[0].value,'250 листів');
});
