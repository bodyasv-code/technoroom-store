// Customer-facing facets must not expose raw distributor taxonomy or HTML.
const text=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function printerKindValues(product={}) {
  const name=text(product.name);
  if(/^(?:бфп|мфу|mfp|багатофункціональн\S*\s+пристрій)(?=\s|$|[,(-])/iu.test(name))return ['БФП'];
  if(/^(?:принтер|printer)\s/iu.test(name))return ['Принтер'];
  if(/^(?:сканер|scanner)\s/iu.test(name))return ['Сканер'];
  return [];
}
const specs=(product,pattern)=>Object.entries(product.specifications||{}).filter(([key])=>pattern.test(text(key))).flatMap(([,value])=>Array.isArray(value)?value:[value]).map(text);
export function screenAspectValues(product) {
  return [...new Set(specs(product,/співвідношення сторін|формат екра[нн]а|aspect ratio/iu).map(value=>{
    const match=/^(\d{1,2})\s*[:xх×*]\s*(\d{1,2})$/iu.exec(value);
    if(!match)return '';
    const ratio=match[1]+':'+match[2];
    return ['1:1','4:3','16:9','16:10','2:1','21:9'].includes(ratio)?ratio:'';
  }).filter(Boolean))];
}
export function screenDiagonalValues(product) {
  return [...new Set(specs(product,/діагональ|diagonal/iu).map(value=>{
    const match=/^(\d{2,3}(?:[.,]\d+)?)\s*(?:["″”]|дюйм\S*|inch(?:es)?)?$/iu.exec(value);
    return match&&Number(match[1].replace(',','.'))<=400?match[1].replace(',','.')+'″':'';
  }).filter(Boolean))];
}
export function screenConstructionValues(product) {
  const source=[...specs(product,/тип екран[уа]|конструкці/iu),text(product.name)].join(' ');
  if(/триноз|штатив|tripod/iu.test(source))return ['На тринозі'];
  if(/фіксован|рамн|fixed|frame/iu.test(source))return ['Рамний'];
  if(/настін|стельов|підвіс|рулон|моториз|електроприв|пружин/iu.test(source))return ['Рулонний'];
  return [];
}
export function screenMountValues(product) {
  const source=specs(product,/установка|встановлення|монтаж|тип екран[уа]/iu).join(' ');
  return [...(/настін/iu.test(source)?['Настінний']:[]),...(/стельов/iu.test(source)?['Стельовий']:[]),...(/підлог|триноз|штатив/iu.test(source)?['Підлоговий']:[])];
}
export function screenDriveValues(product) {
  const source=[...specs(product,/тип екран[уа]|привід/iu),text(product.name)].join(' ');
  return /моториз|електроприв/iu.test(source)?['Моторизований']:/ручн|пружин/iu.test(source)?['Ручний']:[];
}
export const screenFacetDefinitions=[
  {id:'diagonal',label:'Діагональ, дюйми',values:screenDiagonalValues},
  {id:'format',label:'Формат екрана',values:screenAspectValues},
  {id:'construction',label:'Конструкція',values:screenConstructionValues},
  {id:'mounting',label:'Монтаж',values:screenMountValues},
  {id:'drive',label:'Привід',values:screenDriveValues}
];
