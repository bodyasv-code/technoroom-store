// Plain-text source -> escaped preview. Never execute or retain supplier HTML/URLs.
const escape=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=value=>String(value).normalize('NFKC').toLocaleLowerCase('uk-UA').replace(/\s+/gu,' ').trim();
const excluded=/^(?:bullet\s+points|короткий\s+підсумковий\s+опис|сумарний\s+опис)(?:\s|:|$)/iu;
const translations=[
  [/Собственная\s+разрешающая\s+способность\s+пр(?:ое|э)ктора/giu,'Рідна роздільна здатність проєктора'],
  [/Проекционная\s+технология/giu,'Технологія проєкції'],
  [/Яркость\s+проектора/giu,'Яскравість проєктора'],
  [/Тип\s+источника\s+света/giu,'Тип джерела світла'],
  [/Срок\s+службы\s+источника\s+света/giu,'Ресурс джерела світла'],
  [/Стандартный\s+проектор/giu,'Стандартний проєктор'],
  [/Ручная\s+фокусировка/giu,'Ручне фокусування'],
  [/Встроенные\s+динамики/giu,'Вбудовані динаміки'],
  [/Тип послідовного інтерфейса/giu,'Тип послідовного інтерфейсу'],
  [/Тип сервісного порта/giu,'Тип сервісного порту'],
];
function plain(raw){
  return String(raw??'')
    .replace(/<(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/giu,'')
    .replace(/<\/?(?:p|div|h[1-6]|li|ul|ol|br|table|tr)\b[^>]*>/giu,'\n')
    .replace(/<[^>]*>/gu,'')
    .replace(/&#(x[0-9a-f]+|\d+);/giu,(_,number)=>{const code=number[0].toLowerCase()==='x'?parseInt(number.slice(1),16):Number(number);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';})
    .replace(/&(nbsp|amp|quot|apos|lt|gt);/giu,(_,entity)=>({nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'})[entity.toLowerCase()])
    .replace(/(?:https?:\/\/|www\.)[^\s<>]+/giu,'')
    .replace(/[\t\r ]+/gu,' ').split('\n').map(line=>line.trim()).filter(line=>line&&!excluded.test(line)).join('\n');
}
function translated(raw,audit,product){
  let value=plain(raw);
  for(const [pattern,replacement] of translations){
    value=value.replace(pattern,()=>{audit.replacements++;return replacement;});
  }
  // Exact model check; Epson lists Manual focus/zoom for this MPN.
  // https://www.epson-africa.com/projectors/professional/business-education/eb-994f-v11hb60042
  if(key(product.brand)==='epson'&&product.sku==='V11HB60042'){
    value=value.replace(/(?:Фокус(?:ування)?)\s*:\s*Керівництво/giu,()=>{audit.verifiedCorrections++;return 'Фокусування: ручне';})
      .replace(/Тип\s+зум[ау]\s*:\s*Керівництво/giu,()=>{audit.verifiedCorrections++;return 'Тип зуму: ручний';});
  }
  return value;
}
export function buildIcecatDescriptionDraft(product,general){
  const warnings=['Це чернетка, не збережений опис. Потрібна редакторська й технічна перевірка.'];
  const translation={replacements:0,verifiedCorrections:0,remainingRussian:false,fullTranslationVerified:false};
  const description=general.Description||{},summary=general.SummaryDescription||{};
  const brandBullets=general.BulletPoints||{},generated=general.GeneratedBulletPoints||{};
  const bulletBlock=Array.isArray(brandBullets.Values)&&brandBullets.Values.length?brandBullets:generated;
  const source=summary.LongSummaryDescription?'LongSummaryDescription':description.LongDesc?'LongDesc':summary.ShortSummaryDescription?'ShortSummaryDescription':null;
  const raw=source==='LongDesc'?description.LongDesc:source==='LongSummaryDescription'?summary.LongSummaryDescription:summary.ShortSummaryDescription;
  const bulletValues=Array.isArray(bulletBlock.Values)?bulletBlock.Values.filter(value=>typeof value==='string'):[];
  const total=String(raw||'').length+String(description.Disclaimer||'').length+bulletValues.reduce((n,value)=>n+String(value).length,0);
  if(total>40000||bulletValues.length>60)return {available:false,automatic:false,readOnly:true,warnings:['Опис завеликий для безпечного перегляду. Потрібна окрема редактура.']};
  let body=translated(raw,translation,product);
  const title=plain(general.Title);
  if(title&&body.startsWith(title))body=body.slice(title.length).replace(/^[.\s:]+/u,'');
  const modelIntro=plain([general.Brand,general.ProductName].filter(Boolean).join(' '));
  if(modelIntro&&body.startsWith(modelIntro+'.'))body=body.slice(modelIntro.length+1).trim();
  const paragraphs=[],bullets=[],excludedBullets=[],seen=new Set();
  for(const paragraph of body.split('\n'))if(paragraph&&!seen.has(key(paragraph))){seen.add(key(paragraph));paragraphs.push(paragraph);}
  for(const item of bulletValues){
    for(const line of translated(item,translation,product).split('\n'))if(line&&!seen.has(key(line))){
      seen.add(key(line));
      if(/^Кабель\s+змінного\s+струму\s+\d+(?:[.,]\d+)?\s*Вт\s*$/iu.test(line)){excludedBullets.push(line);continue;}
      bullets.push(line);
    }
  }
  const disclaimer=translated(description.Disclaimer,translation,product);
  if(disclaimer&&!seen.has(key(disclaimer)))paragraphs.push(disclaimer);
  const combined=[...paragraphs,...bullets].join('\n');
  translation.remainingRussian=/[ыэъё]|(?:^|[^\p{L}])(?:разрешающая|источника|встроенн\p{L}*)(?=$|[^\p{L}])/iu.test(combined);
  if(translation.remainingRussian)warnings.push('Залишився можливий російськомовний текст. Потрібен повний переклад перед збереженням.');
  if(/Керівництво/iu.test(combined))warnings.push('Є неоднозначне «Керівництво». Не публікувати без перевірки оригіналу: це може бути помилковий переклад Manual.');
  const languages=[description.Language,bulletBlock.Language].filter(Boolean).map(value=>String(value).toUpperCase());
  if(languages.some(language=>!['UK','UA'].includes(language)))warnings.push('Окремі частини джерела мають іншу мовну позначку. Потрібен переклад і редактура.');
  if(product.manual_overrides?.description)warnings.push('Поточний опис редагувався вручну: автоматична заміна заборонена.');
  if(excludedBullets.length)warnings.push('Виключено некоректно побудований пункт про кабель і потужність. Потрібна технічна перевірка джерела; правильне значення не підставлялось.');
  return {available:Boolean(combined),readOnly:true,automatic:false,status:'editorial-review',source,paragraphs,bullets,translation,languages,
    manualProtected:Boolean(product.manual_overrides?.description),warnings,excludedBullets,
    html:paragraphs.map(value=>'<p>'+escape(value)+'</p>').join('')+(bullets.length?'<ul>'+bullets.map(value=>'<li>'+escape(value)+'</li>').join('')+'</ul>':'')};
}
