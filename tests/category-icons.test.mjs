import assert from 'node:assert/strict';
import {categoryIcon, categoryIconKind} from '../public/category-icons.js';
for (const [name, kind] of Object.entries({
  'Проєктори та екрани': 'projector', 'Оргтехніка': 'printer',
  'Акустика й звук': 'audio', 'Витратні матеріали для друку': 'ink',
  'Побутова техніка': 'appliance', 'Послуги': 'service',
  'Телевізори, монітори та дисплеї': 'display', 'Кріплення та аксесуари': 'mount',
  'Зарядні станції': 'power', 'Планшети': 'phone',
})) assert.equal(categoryIconKind({name}), kind);
assert.equal(categoryIconKind({slug:'cat-projectors',name:'Нова назва'}), 'projector');
assert.equal(categoryIconKind({}), 'grid');
const svg = categoryIcon({name:'<script>alert(1)</script>'});
assert.match(svg, /aria-hidden="true"/);
assert.match(svg, /viewBox="0 0 32 32"/);
assert.ok(!svg.includes('<script>'));
console.log('Category icons: OK');
