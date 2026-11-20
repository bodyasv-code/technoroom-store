import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {projectionFinishSql} from './projection-finish-maintenance.mjs';
const live=JSON.parse(await readFile('.projection-final-before-20261120.json','utf8'));
const photos=JSON.parse(await readFile('.manufacturer-pages-20261116/optoma-final-images.json','utf8'));
const matrix=JSON.parse(await readFile('.mti-matrix-20261112.json','utf8'));
const variation=JSON.parse(await readFile('.manufacturer-pages-20261116/tripod-variations.json','utf8')).find(v=>v.sku==='T120UWH');
const viewsonicRow=matrix.find(r=>r[10]==='VS16905'&&r[6]==='VIEWSONIC');
if(viewsonicRow?.[22]!=='766907904710')throw Error('PA503S GTIN evidence changed');
if(variation?.attributes.attribute_pa_color!=='black'||variation?.attributes.attribute_pa_size!=='120-169'||variation?.image.full_src!=='https://elitescreens.com/wp-content/uploads/Tripod_ZType_Angle.jpg')throw Error('T120UWH variation changed');
const plans=[];
for(const id of [6141,6142,6162,6177]){
 const p=live.products.find(p=>p.id===id);if(!p)throw Error('Missing current card '+id);
 const reviewBefore=live.reviews.find(r=>r.product_id===id)||null;
 const plan={id,sku:p.sku,brand:p.brand,name:p.name,source:'',reviewBefore,before:Object.fromEntries(['description','specifications','manual_overrides','image_path','image_paths'].map(k=>[k,p[k]])),patch:{}};
 if(id===6141||id===6142){
  if(p.image_path||p.image_paths?.length)throw Error('Photo gallery is no longer empty');
  const model=id===6141?'hz147x':'hz151x',selected=id===6141?[6,9,7,3,2]:[10,11,13,2,1,3];
  const items=selected.map(index=>{const image=photos.find(p=>p.model===model&&p.index===index);if(!image)throw Error('Missing reviewed photo');return image;});
  plan.source=`https://${id===6141?'www':'beta'}.optomaeurope.com/product/${model}`;
  plan.patch.image_paths=items.map(p=>p.url);plan.patch.image_path=items[0].url;
  plan.evidence={galleryApi:plan.source.replace('/product/'+model,'/product/index/galleryimages'),request:{productName:model,regionCode:'en'},photos:items,excluded:'Lifestyle scenes, OMS badges and duplicate reflection views'};
 }else if(id===6162){
  plan.source='https://elitescreens.com/products/tripod-series/?attribute_pa_color=black&attribute_pa_size=120-169';
  plan.patch.image_path=variation.image.full_src;plan.patch.image_paths=[variation.image.full_src,...p.image_paths];
  plan.evidence={sku:variation.sku,variationId:variation.variation_id,attributes:variation.attributes,url:variation.image.full_src,sha256:createHash('sha256').update(await readFile('.photo-review/final-20261120/tripod-ztype.jpg')).digest('hex'),note:'Manufacturer binds this series illustration to the exact black 120-inch 16:9 variation. Existing exact-model dimensional drawing stays second.'};
 }else{
  if(reviewBefore)throw Error('PA503S review enrollment changed');
  plan.source='https://www.viewsonic.com/media/wysiwyg/pdfs/US_MSRP_040124.pdf';
  plan.patch.specifications={...p.specifications,'Яскравість':'3800 лм'};
  plan.patch.description='ViewSonic PA503S — ламповий DLP-проєктор із власною роздільною здатністю SVGA 800 × 600 та яскравістю 3800 лм для презентацій у навчальних і робочих приміщеннях. Має вхід HDMI та вертикальну корекцію трапеції.';
  plan.newReview={keys:['Яскравість']};
  plan.evidence={supplierPrice:'Прайс-лист-2026-11-12 23_37_04.xlsx',manufacturerPart:p.sku,gtin:viewsonicRow[22],supplierModel:viewsonicRow[7],supplierDescription:viewsonicRow[9],manufacturerDocumentDate:'2024-04-01',manufacturerDocumentPage:4,manufacturerModel:'PA503S',manufacturerUpc:'766907904710',manufacturerBrightness:'3800 lumens',decision:'Exact UPC in owner price matches the older 3800-lumen manufacturer row; the newer 4000-lumen version has another UPC. Do not transfer its brightness.'};
 }
 plans.push(plan);
}
await writeFile('docs/projection-content-finish-plan-20261120.json',JSON.stringify(plans,null,2)+'\n');
await writeFile('supabase/projection-content-finish-20261120.sql',projectionFinishSql(plans));
await writeFile('supabase/restore-projection-content-finish-20261120.sql',projectionFinishSql(plans,{restore:true}));
const unresolved={id:6176,sku:'MR.JQU11.001',model:'Acer S1386WH',gtin:'4713883722711',field:'Яскравість',status:'source-conflict',source:'https://www.acer.com/si-en/projectors/classroom/pdp/MR.JQU11.001',summaryBrightness:'3600 lm',detailedBrightness:'4000 ANSI Lumens (Standard), 2880 ANSI Lumens (ECO)',supplierPriceBrightness:'4000 lm',decision:'Same exact manufacturer part and GTIN have conflicting manufacturer facts. Leave brightness unset; require written manufacturer clarification or a document tied to the supplied hardware revision. Preserve the entire card.'};
await writeFile('docs/projection-content-unresolved-20261120.json',JSON.stringify([unresolved],null,2)+'\n');
console.log(JSON.stringify({cards:plans.length,photosAdded:12,photoGalleries:3,brightnessResolved:1,unresolved:1}));
