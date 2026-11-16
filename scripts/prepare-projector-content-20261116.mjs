import {readFile,writeFile} from 'node:fs/promises';
import {projectorContentSql} from './projector-content-maintenance.mjs';
const live=JSON.parse(await readFile('.mti-equipment-live-20261116.json','utf8'));
const images=JSON.parse(await readFile('.manufacturer-image-candidates-20261116.json','utf8'));
const facts=[
 [6136,'1920 × 1080','3800 ANSI лм','https://www.benq.eu/en-eu/business/projector/mh560c/specifications.html','BenQ MH560C — ламповий DLP-проєктор Full HD 1920 × 1080 із яскравістю 3800 ANSI лм. Модель призначена для презентацій і відео, має вхід HDMI та вбудований динамік потужністю 10 Вт. Оптичний зум 1,1× допомагає підібрати розмір зображення під час встановлення.'],
 [6137,'1024 × 768','4000 ANSI лм','https://www.benq.com/en-in/business/projector/mx560c/specifications.html','BenQ MX560C — ламповий DLP-проєктор із власною роздільною здатністю XGA 1024 × 768, форматом 4:3 і яскравістю 4000 ANSI лм. Призначений для презентацій, таблиць і навчальних матеріалів. Оснащений оптичним зумом 1,1×, входом HDMI та динаміком потужністю 10 Вт.'],
 [6165,'3840 × 2160','3200 ANSI лм','https://www.benq.com/en-us/projector/home-projectors/tk700/spec.html','BenQ TK700 — ламповий DLP-проєктор 4K UHD 3840 × 2160 із яскравістю 3200 ANSI лм для домашнього перегляду відео та ігор. Підтримує HDR10 і HLG. Оптичний зум 1,3× та корекція трапеції допомагають налаштувати зображення відповідно до розташування проєктора.'],
 [6166,'1920 × 1080','3800 ANSI лм','https://www.benq.com/en-us/projector/cinema/th575i.html','BenQ TH575i — ламповий DLP-проєктор Full HD 1920 × 1080 із яскравістю 3800 ANSI лм. Модель для домашнього перегляду та ігор має Google TV, вбудований динамік потужністю 10 Вт і оптичний зум 1,1×. Автоматична вертикальна корекція трапеції спрощує встановлення.'],
 [6167,'1920 × 1080','500 ANSI лм','https://www.benq.com/en-us/projector/portable/gv50/spec.html','BenQ GV50 — переносний лазерний DLP-проєктор Full HD 1920 × 1080 із яскравістю 500 ANSI лм. Поворотна конструкція дозволяє спрямувати зображення на стіну або стелю. Передбачено Google TV, автоматичне фокусування, акумулятор і акустичну систему 2.1 загальною потужністю 18 Вт.'],
 [6168,'3840 × 2160','2600 ANSI лм','https://esupportdownload.benq.com/esupport/PROJECTOR%20FOR%20CONSUMER/UserManual/GP520/GP520_UM_EN_260324150604.pdf',null],
 [6169,'3840 × 2160','3000 ANSI лм','https://esupportdownload.benq.com/esupport/PROJECTOR%20FOR%20CONSUMER/UserManual/TK705i/TK705i_UM_EN_260316112238.pdf','BenQ TK705i — домашній DLP-проєктор 4K UHD 3840 × 2160 із джерелом світла 4LED і яскравістю 3000 ANSI лм. Оснащений Google TV, автоматичним фокусуванням і корекцією трапеції. Оптичний зум 1,3× допомагає налаштувати розмір зображення без перенесення проєктора.'],
 [6170,'3840 × 2160','3000 ANSI лм','https://www.benq.com/en-us/projector/home-projectors/tk705sti/spec.html','BenQ TK705STi — короткофокусний DLP-проєктор 4K UHD 3840 × 2160 із джерелом світла 4LED і яскравістю 3000 ANSI лм. Проєкційне співвідношення 0,8 дозволяє отримувати велике зображення з меншої відстані. Передбачено Google TV, автоматичне фокусування, корекцію трапеції та два динаміки по 8 Вт.'],
 [6172,'1920 × 1080','4000 ANSI лм','https://www.viewsonic.com/us/products/projectors/standard-throw/lsd401hd.html','ViewSonic LSD401HD — лазерний DLP-проєктор Full HD 1920 × 1080 із яскравістю 4000 ANSI лм для навчальних аудиторій, переговорних кімнат і презентацій. Лазерне джерело світла дозволяє працювати без регулярної заміни лампи. Підходить для показу тексту, графіки та відео на великому екрані.'],
 [6173,'1280 × 800','6000 ANSI лм','https://www.viewsonic.com/education/products/projectors/LSD600W','ViewSonic LSD600W — лазерний DLP-проєктор із власною роздільною здатністю WXGA 1280 × 800 та яскравістю 6000 ANSI лм. Призначений для великих переговорних кімнат, аудиторій і стаціонарних інсталяцій. Має оптичний зум 1,3×, горизонтальну й вертикальну корекцію трапеції та підтримує встановлення з поворотом на 360°.'],
 [6141,'1920 × 1080','4000 ISO лм','https://www.optomaeurope.com/product/hz147x','Optoma HZ147X — лазерний DLP-проєктор Full HD 1920 × 1080 із яскравістю 4000 ISO лм. Технологія DuraCore розрахована на тривалу роботу без заміни лампи. Проєктор приймає сигнали 4K UHD і HDR, відображаючи зображення у власній роздільній здатності Full HD.'],
 [6142,'1920 × 1080','5000 ISO лм','https://beta.optomaeurope.com/product/hz151x','Optoma HZ151X — лазерний DLP-проєктор Full HD 1920 × 1080 із яскравістю 5000 ISO лм. Джерело світла DuraCore призначене для тривалої роботи без заміни лампи. Передбачено оптичний зум 1,3×, підтримку встановлення з поворотом на 360° і приймання сигналу 4K UHD.'],
 [6145,'3840 × 2160','1100 ISO лм','https://www.optomausa.com/product/photon-life-pk32','Optoma Photon Life PK32 — компактний домашній DLP-проєктор 4K UHD 3840 × 2160 із джерелом світла 4LED та яскравістю 1100 ISO лм. Підтримує HDR10, автоматичне фокусування і корекцію трапеції. Два входи HDMI, USB-C та вбудовані динаміки дозволяють підключати різні джерела відео.'],
 [238,null,null,'https://asm.epson.eu/es_ES/productos/projector/distancia-ultracorta/eb-815e-super-ultra-short-throw-projector/p/41719','Epson EB-815E — ультракороткофокусний лазерний проєктор 3LCD із яскравістю 5000 лм. Власна роздільна здатність становить Full HD 1920 × 1080; технологія 4K Enhancement підвищує деталізацію зображення. Проєктор формує зображення діагоналлю 80–160 дюймів при встановленні поблизу поверхні проєкції.']
];
const plans=facts.map(([id,resolution,brightness,source,description])=>{
 const p=live.products.find(p=>p.id===id);if(!p)throw Error('Missing product '+id);
 const specifications={};
 if(resolution)specifications['Роздільна здатність']=resolution;
 if(brightness)specifications['Яскравість']=brightness;
 if(!p.specifications['Технологія проекції'])specifications['Технологія проекції']='DLP';
 if(id===6145)specifications['Джерело світла']='4LED';
 if(id===6137){specifications['Співвідношення сторін']='4:3';specifications['Проекційне співвідношення']='1,96–2,15';}
 if(id===238){specifications['Роздільна здатність']='1920 × 1080';specifications['Покращення роздільної здатності']='4K Enhancement';}
 const patch={specifications};if(description)patch.description=description;
 if(id===238)patch.name='Проєктор ультракороткофокусний Epson EB-815E, 4K Enhancement (V11HA99180)';
 const image=images.find(image=>image.id===id&&!image.error);
 if(image){if(p.image_path||p.image_paths?.length)throw Error('Existing photo '+id);patch.image_path=image.url;patch.image_paths=[image.url];}
 return {id,sku:p.sku,brand:p.brand,name:p.name,source,keys:Object.keys(specifications),protectDescription:!!description,
  before:Object.fromEntries(['description','specifications','manual_overrides','image_path','image_paths'].map(k=>[k,p[k]])),patch,
  photoEvidence:image?{page:image.source,original:image.original,url:image.url,sha256:image.sha256}:null};
}).sort((a,b)=>a.id-b.id);
await writeFile('docs/mti-projector-content-plan-20261116.json',JSON.stringify(plans,null,2)+'\n');
await writeFile('supabase/mti-projector-content-20261116.sql',projectorContentSql(plans));
await writeFile('supabase/restore-mti-projector-content-20261116.sql',projectorContentSql(plans,{restore:true}));
console.log(JSON.stringify({cards:plans.length,fields:plans.reduce((n,p)=>n+p.keys.length,0),descriptions:plans.filter(p=>p.protectDescription).length,photos:plans.filter(p=>p.patch.image_path).length}));
