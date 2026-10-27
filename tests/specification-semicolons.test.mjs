import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hasSpecificationCode} from '../public/specification-values.js';
import {normalizeSpecificationEntries} from '../public/specification-normalization.js';
import {groupProductSpecifications,renderProductSpecificationGroups} from '../public/product-specification-groups.js';
test('Technical semicolon lists survive display while code/CSS fragments remain excluded',async()=>{
 for(const value of ['Canon i-SENSYS MF664Cdw; MF667Cdw; LBP646Cdw; LBP647Cdw','USB 2.0; Ethernet; Wi-Fi','PDF; JPEG; TIFF','176–280 В; 110–176 В зі зниженням','Яскравість: 1000 лм; ресурс: 20000 год','https://example.com/document.pdf','Color: Black'])assert.equal(hasSpecificationCode(value),false,value);
 for(const value of ['display: block;','width:100%; height: 20px','@media screen','container-widget','function foo() {}','document.write("x");','javascript:alert(1)','x=>x','color:red; margin:0'])assert.equal(hasSpecificationCode(value),true,value);
 const plans=JSON.parse(await readFile(new URL('../docs/canon-075-content-plan-2026-10-27.json',import.meta.url),'utf8'));
 for(const p of plans){const entries=normalizeSpecificationEntries(p.after.specifications).filter(([,value])=>!hasSpecificationCode(value));assert.equal(entries.length,7);const groups=groupProductSpecifications(entries);const html=renderProductSpecificationGroups(groups);assert.match(html,/Сумісні пристрої/);assert.match(html,/MF664Cdw; MF667Cdw; LBP646Cdw; LBP647Cdw/);assert.ok(groups.find(g=>g.id==='print').entries.some(([key])=>key==='Колір друку'));assert.ok(groups.find(g=>g.id==='compatibility').entries.some(([key])=>key==='Сумісні пристрої'));assert.equal(groups.some(g=>g.id==='physical'),false);}
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');assert.match(app,/if \(hasSpecificationCode\(text\)\) return ''/);
});
