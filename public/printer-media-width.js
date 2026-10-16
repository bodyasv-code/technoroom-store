export const mediaWidthKey='Максимальна ширина носія';
export const mediaWidthLabels={24:'24″ (610 мм)',36:'36″ (914 мм)',44:'44″ (1118 мм)'};
const formatWidth=mm=>{
  for(const [inch,label] of Object.entries(mediaWidthLabels))if(Math.abs(mm-Number(inch)*25.4)<1.5)return label;
  return mm>0&&mm<=5000?String(Number(mm.toFixed(1)))+' мм':'';
};
export function normalizeMediaWidth(raw) {
  const text=String(raw??'').replace(/,/gu,'.');
  const inches=/(\d{1,3}(?:\.\d+)?)\s*(?:["'″”’]|дюйм\p{L}*|inches|inch)(?=$|[^\p{L}])/iu.exec(text);
  if(inches)return mediaWidthLabels[inches[1]]||formatWidth(Number(inches[1])*25.4);
  const mm=/(\d{2,4}(?:\.\d+)?)\s*(?:мм|mm)(?=$|[^\p{L}])/iu.exec(text);
  return mm?formatWidth(Number(mm[1])):'';
}
export function readPrinterMediaWidth(product={}) {
  const specs=product.specifications||{};
  // An explicit saved choice, including custom widths, has priority.
  if(String(specs[mediaWidthKey]||'').trim())return normalizeMediaWidth(specs[mediaWidthKey])||String(specs[mediaWidthKey]).trim();
  const entries=Object.entries(specs);
  const eligible=entries.filter(([key])=>!(/скан|scan|габарит|dimensions|лот|tray|крапл/iu.test(key))&&/^(?:максимальна ширина (?:друку|носія)|ширина (?:друку|носія|рулону)|max(?:imum)? (?:media|print) width|формат(?: носія| друку)?)\s*[:：]?$/iu.test(key.trim()));
  for(const [key,value] of eligible){
    // Read only the format prefix, not unrelated display/scan sizes in a long tail.
    const text=/^формат\s*[:：]?$/iu.test(key.trim())?String(value).split(';')[0]:String(value);
    const width=normalizeMediaWidth(text);if(width)return width;
  }
  if(!/^office-wide-format$/u.test(String(product.category||product.type||'')))return '';
  if(!/^(?:принтер|printer|бфп|мфу|mfp|багатофункціональний пристрій)\s/iu.test(String(product.name||'')))return '';
  return normalizeMediaWidth(product.name);
}
