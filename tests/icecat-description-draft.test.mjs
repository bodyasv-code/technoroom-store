import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIcecatDescriptionDraft as build} from '../public/icecat-description-draft.js';
import {buildContentPreview,contentPreviewMarkup} from '../public/product-content-preview.js';
const product={id:247,name:'Проєктор Epson EB-994F',brand:'Epson',sku:'V11HB60042'};
test('Uses one full summary plus brand bullets, without administrative headings or repeated lines',()=>{
  const general={Title:'Epson EB-994F',SummaryDescription:{ShortSummaryDescription:'Короткий дубль',LongSummaryDescription:'Epson EB-994F. Опис товару\nОпис товару'},BulletPoints:{Language:'UK',Values:['Bullet Points Epson:','3LCD 4100 лм','3LCD 4100 лм','Короткий підсумковий опис Epson:','Сумарний опис Epson:']},GeneratedBulletPoints:{Values:['Не використовувати коли є брендові переваги']}};
  const before=JSON.stringify(general),draft=build(product,general);
  assert.deepEqual(draft.paragraphs,['Опис товару']);assert.deepEqual(draft.bullets,['3LCD 4100 лм']);
  assert.ok(!/Bullet Points|Короткий підсумковий опис|Сумарний опис|Короткий дубль/.test(draft.html));
  assert.equal(draft.source,'LongSummaryDescription');assert.equal(JSON.stringify(general),before);
});
test('Known Russian phrases are translated without changing numbers, model names or technology',()=>{
  const draft=build(product,{SummaryDescription:{LongSummaryDescription:'Собственная разрешающая способность прэктора: 1080p (1920x1080). Тип источника света: Лампа.'},GeneratedBulletPoints:{Language:'UK',Values:['Встроенные динамики 16 Вт','Проекционная технология: 3LCD']}});
  assert.match(draft.html,/Рідна роздільна здатність проєктора: 1080p \(1920x1080\)/);
  assert.match(draft.html,/Тип джерела світла: Лампа/);assert.match(draft.html,/Вбудовані динаміки 16 Вт/);assert.match(draft.html,/3LCD/);
  assert.equal(draft.translation.replacements,4);assert.equal(draft.translation.fullTranslationVerified,false);
});
test('Unknown Russian and bad Manual translation never become approved content',()=>{
  const draft=build({...product,sku:'OTHER'},{SummaryDescription:{LongSummaryDescription:'Фокус: Керівництво. Высокая яркость.'}});
  assert.ok(draft.translation.remainingRussian);assert.ok(draft.warnings.some(w=>w.includes('російськомовний')));assert.ok(draft.warnings.some(w=>w.includes('Керівництво')));
  assert.equal(draft.automatic,false);assert.equal(draft.status,'editorial-review');assert.equal(draft.readOnly,true);
});
test('Verified Epson focus/zoom wording is limited to the exact brand and MPN',()=>{
  const general={SummaryDescription:{LongSummaryDescription:'Фокус: Керівництво. Тип зума: Керівництво.'}};
  const draft=build(product,general);assert.match(draft.html,/Фокусування: ручне/);assert.match(draft.html,/Тип зуму: ручний/);assert.equal(draft.translation.verifiedCorrections,2);
  for(const card of [{...product,sku:'V11HB60042DA'},{...product,brand:'OTHER'}])assert.match(build(card,general).html,/Керівництво/);
});
test('HTML is converted to text, scripts and token-bearing URLs never reach output',()=>{
  const draft=build(product,{Description:{Language:'UK',LongDesc:'<script>private-secret</script><p>Текст</p><img src="https://host/private-token"><p><a href="https://host/token">Опис</a> https://host/private-token</p><b>&lt;img onerror=bad()&gt;</b>'}});
  assert.ok(!draft.html.includes('<script'));assert.ok(!draft.html.includes('<img'));assert.ok(!JSON.stringify(draft).includes('private-token'));assert.ok(!JSON.stringify(draft).includes('private-secret'));assert.match(draft.html,/&lt;img/);
});
test('Generated bullets fallback, disclaimer, empty/large inputs and manual protection',()=>{
  const draft=build({...product,manual_overrides:{description:true}},{Description:{Language:'EN',LongDesc:'Текст',Disclaimer:'Умови виробника'},GeneratedBulletPoints:{Language:'UK',Values:['Перевага',null,{}]}});
  assert.deepEqual(draft.bullets,['Перевага']);assert.ok(draft.paragraphs.includes('Умови виробника'));assert.ok(draft.manualProtected);assert.ok(draft.warnings.some(w=>w.includes('іншу мовну')));
  assert.equal(build(product,{}).available,false);assert.equal(build(product,{Description:{LongDesc:'a'.repeat(40001)}}).available,false);
});
test('Identity mismatch and demo response do not expose draft text; renderer does not trust HTML',()=>{
  const general={Brand:'Epson',BrandPartCode:product.sku,Description:{LongDesc:'Текст'}};
  assert.equal(buildContentPreview({...product,sku:'OTHER'},{data:{GeneralInfo:general}}).descriptionDraft,undefined);
  assert.equal(buildContentPreview(product,{data:{DemoAccount:true,GeneralInfo:general}}).descriptionDraft,undefined);
  const preview=buildContentPreview(product,{data:{GeneralInfo:general}});
  assert.ok(preview.descriptionDraft.available);assert.equal(preview.databaseWrites,0);
  preview.descriptionDraft.html='<img src=x onerror=bad()>';preview.descriptionDraft.paragraphs=['<script>bad()</script>'];
  const html=contentPreviewMarkup(preview);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script/);
});
