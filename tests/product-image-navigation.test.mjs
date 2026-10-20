import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const binder=source.match(/^function bind\(root = document\).*$/m)?.[0];
assert.ok(binder);
let added=null,inquiry=null;
const bind=runInNewContext('('+binder+')',{add:id=>{added=id;},openInquiry:id=>{inquiry=id;},openLightbox:()=>{throw Error('Card navigation must not open a lightbox');}});
for(const scope of ['homepage','catalog','related products']){
  const image={onclick:null},buy={dataset:{add:'123'}},ask={dataset:{inquiry:'456'}},selectors=[];
  bind({querySelectorAll:selector=>{selectors.push(selector);return selector==='[data-add]'?[buy]:selector==='[data-inquiry]'?[ask]:[image];}});
  assert.equal(image.onclick,null,scope+': native link navigation stays untouched');
  assert.deepEqual(selectors,['[data-add]','[data-inquiry]']);
  buy.onclick();ask.onclick();assert.equal(added,'123');assert.equal(inquiry,'456');
}
assert.ok(source.includes("event.target.closest('.product-detail-visual .product-image img')"),'Explicit zoom inside product detail remains available');
console.log('Product image links: no fullscreen flash on homepage/catalog/related navigation; buy, inquiry and detail zoom retained: PASS');
