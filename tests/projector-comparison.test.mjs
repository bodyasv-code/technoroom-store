import assert from 'node:assert/strict';
import {comparisonIds,toggleComparison,projectorComparisonRows,comparisonTable} from '../public/projector-comparison.js';

assert.deepEqual(comparisonIds([1,'2',2,-1,0,'<x>',3,4]),[1,2,3]);
assert.deepEqual(comparisonIds({id:1}),[]);
assert.deepEqual(toggleComparison([1,2,3],4),[1,2,3]);
assert.deepEqual(toggleComparison([1,2,3],2),[1,3]);
assert.deepEqual(toggleComparison([1,3],4),[1,3,4]);
const items=[
  {id:1,name:'<img onerror=alert(1)>',sku:'A&1',priceLabel:'10 000 ₴',stockLabel:'В наявності',entries:[['Роздільна здатність','1920 × 1080'],['Яскравість (ANSI лм)','3000'],['Інтерфейси','HDMI'],['Вага','2 кг']]},
  {id:2,name:'Модель 2',entries:[['Яскравість (ISO лм)','3000'],['Інтерфейси','HDMI'],['Інтерфейс','USB'],['Вага','Невідомо']]},
  {id:3,name:'Модель 3',entries:[['Яскравість','4000 лм'],['Роздільна здатність','1920 × 1080'],['Роздільна здатність (інше значення 2)','1280 × 800']]}
];
const original=JSON.stringify(items), rows=Object.fromEntries(projectorComparisonRows(items));
assert.deepEqual(rows['Яскравість (ANSI лм)'],['3000','Не вказано','Не вказано']);
assert.deepEqual(rows['Яскравість (ISO лм)'],['Не вказано','3000','Не вказано']);
assert.deepEqual(rows['Яскравість (стандарт не зазначено)'],['Не вказано','Не вказано','4000 лм']);
assert.deepEqual(rows['Підключення'],['HDMI','Не вказано','Не вказано']);
assert.equal(rows['Роздільна здатність'][2],'Не вказано');
assert(!projectorComparisonRows([{entries:[['Світловий потік (ISO/ANSI, lm)','500']]}]).length);
assert(!projectorComparisonRows([{entries:[['Яскравість','500 ANSI лм']]}]).length);
assert(!projectorComparisonRows([{entries:[['Джерело світла','<script>bad</script>']]}]).length);
assert.equal(JSON.stringify(items),original);
const html=comparisonTable(items);
assert(html.includes('&lt;img onerror=alert(1)&gt;'));
assert(!html.includes('<img onerror'));
assert(html.includes('scope="col"')&&html.includes('scope="row"')&&html.includes('tabindex="0"'));
console.log('Projector comparison: selection limit, malformed storage, conflict exclusion, standard separation and safe rendering PASS');
