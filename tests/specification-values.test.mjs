import assert from 'node:assert/strict';
import {equivalentSpecification} from '../public/specification-comparison.js';
import {normalizeSpecificationEntries} from '../public/specification-normalization.js';
import {createQualityAudit} from '../public/catalog-quality.js';
const pairs=[['Технологія проекції','DLP',': DLP™'],['Технологія проекції','3LCD',': 3LCD'],['Проекційне співвідношення','0.254',': 0.254'],['Яскравість','4000 лм',': 4000'],['Бренд','Brand®',': Brand']];
for(const [key,left,right] of pairs){
  assert.equal(equivalentSpecification(key,left,right),true,key);
  assert.equal(normalizeSpecificationEntries({[key]:left,[key+':']:right}).length,1,key);
}
assert.equal(equivalentSpecification('Контраст','1000:1',': 2000:1'),false);
assert.equal(equivalentSpecification('Проекційне співвідношення','0.254',': 0.25'),false);
assert.equal(equivalentSpecification('Технологія проекції','DLP',': 3LCD™'),false);
assert.equal(equivalentSpecification('Яскравість','4000 лм',': 4500'),false);
assert.equal(equivalentSpecification('Потужність','4000 Вт',': 4000'),false);
assert.equal(equivalentSpecification('Модель','TM',': ™'),false);
const product={id:1,name:'Проєктор Epson',category:'projectors',price:100,brand:'Epson',image_path:'photo.jpg',specifications:{'Технологія проекції':'3LCD','Технологія:':': 3LCD™','Яскравість':'4000 лм','Світловий потік (лм):':': 4000','Проекційне співвідношення':'0.254','Проекційне відношення:':': 0.254'}};
const before=JSON.stringify(product);
assert.equal(createQualityAudit([product],[{slug:'projectors'}])[0].issues.some(issue=>issue.code==='conflict'),false);
assert.equal(normalizeSpecificationEntries(product.specifications,{projector:true}).length,3);
assert.equal(JSON.stringify(product),before);
console.log('Site-wide specification formatting comparisons: checks passed');
