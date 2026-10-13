import {normalizeSpecifications} from './specification-normalization.js?v=20261012-spec-format';
const value = item => Array.isArray(item) ? item.join(' · ') : String(item ?? '');
const get = (specifications, keys) => {
  const entries=Object.entries(specifications||{});
  for(const key of keys){const found=entries.find(([name])=>name.trim().toLowerCase()===key.toLowerCase());if(found&&value(found[1]).trim())return value(found[1]).trim();}
  return '';
};
export function normalizeProjectorLightSource(raw='') {
  const source=value(raw);
  // Store policy: RGB laser and LED/laser hybrids share the simplified Laser filter.
  if(/лазер|\blaser\b/iu.test(source))return 'Лазер';
  if(/світлодіод|\b(?:led|wled)\b/iu.test(source))return 'LED';
  if(/ламп|\b(?:lamp|uhp|uhe|hid)\b/iu.test(source))return 'Лампа';
  return '';
}
export function normalizeProjectorResolution(raw='') {
  const source=value(raw).trim();
  const dimensions=/^(\d{3,5})\s*[×xхXХ]\s*(\d{3,5})(?:\s*\((?:FHD|Full HD|HD|4K|UHD|WXGA|WUXGA|XGA)\))?\s*$/iu.exec(source);
  if(dimensions) return dimensions[1]+' × '+dimensions[2];
  const standards={'fhd':'Full HD','full hd':'Full HD','1080p':'Full HD','hd':'HD','720p':'HD','4k':'4K UHD','4k uhd':'4K UHD','uhd':'4K UHD','8k':'8K UHD','8k uhd':'8K UHD',svga:'SVGA',xga:'XGA',wxga:'WXGA',wuxga:'WUXGA',wqxga:'WQXGA',wvga:'WVGA'};
  return standards[source.toLowerCase().replace(/\s+/g,' ')]||'';
}
const resolutionPixels={SVGA:'800 × 600',WVGA:'854 × 480',XGA:'1024 × 768',HD:'1280 × 720',WXGA:'1280 × 800','Full HD':'1920 × 1080',WUXGA:'1920 × 1200',WQXGA:'2560 × 1600','4K UHD':'3840 × 2160','8K UHD':'7680 × 4320'};
export const projectorResolutionStandards=Object.keys(resolutionPixels);
export function projectorResolutionFilterValue(raw='') {
  const resolution=normalizeProjectorResolution(raw);
  return Object.keys(resolutionPixels).find(standard=>resolutionPixels[standard]===resolution)||resolution;
}
export function projectorResolutionLabel(raw='') {
  const resolution=projectorResolutionFilterValue(raw),pixels=resolutionPixels[resolution];
  return pixels?(resolution==='Full HD'?'FULL HD':resolution)+' ('+pixels+')':value(raw);
}
export function compareProjectorResolutions(left,right) {
  const pixels=raw=>resolutionPixels[projectorResolutionFilterValue(raw)]||normalizeProjectorResolution(raw);
  const area=raw=>{const match=/^(\d+) × (\d+)$/.exec(pixels(raw));return match?Number(match[1])*Number(match[2]):Infinity;};
  return area(left)-area(right)||value(left).localeCompare(value(right));
}
export function isProjectorProduct(product={}) {
  return /^(?:про[єе]ктор|projector)(?=\s|$)/iu.test(value(product.name).trim()) || ['projector','projectors','laser-projectors','home-projectors','short-throw-projectors','installation-projectors','universal-projectors','erc-display-03','erc-display-11','erc-display-12','erc-display-13'].includes(product.category||product.type);
}
export function resolveProjectorSpecifications(product={}) {
  const specifications=normalizeSpecifications(product.specifications, {projector:true});
  const description=value(product.description), name=value(product.name);
  const resolution=get(specifications,['Роздільна здатність','Native resolution','Resolution']);
  let normalized=normalizeProjectorResolution(resolution);
  if(!normalized) {
    const fromDescription=/(?:рідна|власна|native)\s*(?:роздільна\s*здатність|resolution)?\s*[:–-]?\s*(\d{3,5}\s*[×xх]\s*\d{3,5})|(?<!максимальна\s)(?<!підтримувана\s)роздільна\s*здатність\s*[:–-]?\s*(\d{3,5}\s*[×xх]\s*\d{3,5})/iu.exec(description);
    normalized=normalizeProjectorResolution(fromDescription?.[1]||fromDescription?.[2]||'');
    if(!normalized) normalized=normalizeProjectorResolution(/\b(Full\s*HD|FHD|WUXGA|WXGA|XGA|SVGA|4K\s*UHD|8K\s*UHD)\b/iu.exec(name)?.[1]||'');
  }
  if(normalized) specifications['Роздільна здатність']=normalized;
  else if(resolution) delete specifications['Роздільна здатність'];
  const technology=get(specifications,['Технологія проекції','Projection technology','Projection system','Технологія']);
  const technologyMatch=/^(3LCD|DLP|LCD|LCoS)(?:\b|™)/iu.exec(technology)
    || /(?:Технологія(?:\s+проекції)?|Projection\s+(?:technology|system))\s*[:–-]?\s*(3LCD|DLP|LCD|LCoS)\b/iu.exec(description);
  if(technologyMatch) specifications['Технологія проекції']=({'3lcd':'3LCD',dlp:'DLP',lcd:'LCD',lcos:'LCoS'})[technologyMatch[1].toLowerCase()];
  // TECHNOROOM rule: Epson projectors default to 3LCD; explicit supplier/manual values win.
  else if(!technology && isProjectorProduct(product) && /\bepson\b/iu.test([product.brand,name].join(' '))) specifications['Технологія проекції']='3LCD';
  const source=get(specifications,['Джерело світла','Тип джерела','Light source']);
  const lightText=source||[name,description].join(' ');
  const light=normalizeProjectorLightSource(lightText);
  // Keep lifespan, RGB/hybrid details and original wording when supplied.
  if(light&&!source) specifications['Джерело світла']=light;
  const purposeSource=[get(specifications,['Призначення','Тип / призначення']),name,description].join(' ');
  const purposes=[];
  if(light==='Лазер'||/лазерн|\blaser\b/iu.test(purposeSource)) purposes.push('Лазерний');
  if(/домашн|home\s*(?:cinema|theat(?:er|re))/iu.test(purposeSource)||['home-projectors','erc-display-03'].includes(product.category||product.type)) purposes.push('Домашній');
  if(/ультра[\s-]*короткофокус|ultra[\s-]*short[\s-]*throw/iu.test(purposeSource)) purposes.push('Ультракороткофокусний','Короткофокусний');
  else if(/короткофокус|short[\s-]*throw/iu.test(purposeSource)||['short-throw-projectors','erc-display-12'].includes(product.category||product.type)) purposes.push('Короткофокусний');
  if(/інсталяційн|\binstallation\b/iu.test(purposeSource)||['installation-projectors','erc-display-11'].includes(product.category||product.type)) purposes.push('Інсталяційний');
  if(/універсальн|\buniversal\b/iu.test(purposeSource)||['universal-projectors','erc-display-13'].includes(product.category||product.type)) purposes.push('Універсальний');
  if(purposes.length) specifications['Призначення']=[...new Set(purposes)].join(' · ');
  return specifications;
}
