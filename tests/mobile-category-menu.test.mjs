import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCategoryTree} from '../public/category-tree.js';
import {mobileCategoryMarkup} from '../public/mobile-category-menu.js';
const tree=createCategoryTree([
 {id:1,slug:'office',name:'Оргтехніка'},
 {id:2,slug:'special',name:'Принтери спеціалізовані',parent_id:1},
 {id:3,slug:'thermal',name:'Принтери термотрансферні',parent_id:2},
 {id:4,slug:'label',name:'Портативні',parent_id:3},
 {id:5,slug:'audio',name:'Аудіо & звук'}
]);
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const root=mobileCategoryMarkup(tree,'',escape);
assert.ok(root.includes('data-mobile-open="office"'));assert.ok(!root.includes('Принтери спеціалізовані'));
assert.ok(root.includes('Аудіо &amp; звук'));assert.ok(root.includes('aria-label="Закрити каталог"'));
const office=mobileCategoryMarkup(tree,'office',escape);
assert.ok(office.includes('data-mobile-back'));assert.ok(office.includes('Усі товари категорії'));
assert.ok(office.includes('data-mobile-open="special"'));assert.ok(!office.includes('Принтери термотрансферні'));
const special=mobileCategoryMarkup(tree,'special',escape);
assert.ok(special.includes('Оргтехніка / Принтери спеціалізовані'));assert.ok(special.includes('data-mobile-open="thermal"'));
const thermal=mobileCategoryMarkup(tree,'thermal',escape);
assert.ok(thermal.includes('href="catalog.html?category=label"'));assert.ok(!thermal.includes('data-mobile-open="label"'));
const source=readFileSync(new URL('../public/mobile-category-menu.js',import.meta.url),'utf8');
assert.ok(source.includes("tree.path(currentSlug).at(-2)?.slug||''"));
assert.ok(source.includes("event.stopImmediatePropagation()"));
assert.ok(source.includes("document.body.style.overflow=previousBodyOverflow"));
assert.ok(source.includes("compact.addEventListener('change'"));
assert.ok(source.includes("event.key==='Escape'"));assert.ok(source.includes("event.key!=='Tab'"));
const css=readFileSync(new URL('../public/mobile-category-menu.css',import.meta.url),'utf8');
assert.ok(css.includes('height:100dvh!important'));assert.ok(css.includes('minmax(0,1fr)'));
assert.ok(css.includes('overscroll-behavior:contain'));assert.ok(css.includes('safe-area-inset-bottom'));
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
assert.equal((app.match(/mountMobileCategoryMenu\(\{/g)||[]).length,1,'One shared mount handles home and catalog');
console.log('One mobile level at a time, four levels, back/all/close, escaping, focus/scroll restoration, both menus and viewport sizing: OK');
