import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=name=>readFile(new URL('../public/'+name,import.meta.url),'utf8');
const css=await read('store-modern.css');
for(const page of ['index.html','catalog.html','product.html','articles.html','article.html']){
  const html=await read(page);
  assert.match(html,/<body class="[^"]*\bstore-modern\b/);
  assert.equal((html.match(/href="store-modern\.css\?/g)||[]).length,1);
  assert.ok(html.indexOf('store-modern.css')>html.indexOf('href="styles.css'));
  if(!page.startsWith('article'))assert.match(html,/aria-label="Знайти товари"/);
  assert.equal((html.match(/class="store-footer"/g)||[]).length,1);
  assert.match(html,/aria-label="Навігація внизу сторінки"/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length,'No duplicate IDs: '+page);
}
for(const page of ['admin.html','checkout.html']){
  const html=await read(page);assert.ok(!html.includes('store-modern.css'));assert.ok(!html.includes('class="store-modern'));
}
const home=await read('index.html');
assert.equal((home.match(/data-open-catalog aria-controls="homeCatalogMega"/g)||[]).length,2);
assert.match(home,/class="store-intro-link" href="#homeCategoryCards"/);
const app=await read('app.js');
assert.match(app,/querySelectorAll\('\[data-open-catalog\]'\)/);
assert.match(app,/if\(mega.hidden\) toggle.click\(\)/);
for(const id of ['homeCatalogToggle','homeCatalogMega','homeSearch','homeSearchGo','homeCategoryCards','productGrid','cartCount','cartDrawer','checkoutButton'])assert.ok(home.includes('id="'+id+'"'));
assert.ok(home.indexOf('store-intro home-wide')<home.indexOf('home-stage'));
assert.match(css,/@media\(max-width:700px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(css,/:focus-visible/);
assert.match(css,/min-height: 44px/);
assert.match(css,/font-size: 13px!important/);
// Logo intrinsic/legacy width must not overflow its grid track onto Catalog.
assert.match(css,/grid-template-columns: var\(--store-logo-width\) var\(--store-catalog-width\) minmax\(0,1fr\) var\(--store-cart-width\)/);
assert.match(css,/\.store-modern \.home-logo \{ width: var\(--store-logo-width\)!important; min-width: 0!important/);
assert.match(css,/\.store-modern \.home-catalog-wrap \{ display: flex; align-items: center;/);
assert.match(css,/\.store-modern \.storefront-recommendation-card/);
assert.match(css,/\.store-modern \.article-page #articleView:not\(\.article-empty\)/);
// Lightweight delimiter/quote check; this is not a browser render test.
const cleaned=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'');
const pairs={'{':'}','(':')','[':']'},stack=[];
for(const character of cleaned){if(pairs[character])stack.push(pairs[character]);else if('})]'.includes(character))assert.equal(character,stack.pop());}
assert.equal(stack.length,0);
console.log('Store refresh: opt-in pages, checkout/admin isolation, existing controls, labels, mobile/reduced-motion rules and balanced CSS: PASS (visual QA pending)');
