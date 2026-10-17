// Inference for incoming supplier text only. Never rewrites saved specifications.
export function printerDeviceKind(name='') {
  const value=String(name).trim();
  if(/^(?:бфп|мфу|mfp|multifunction|багатофункціональн[\p{L}]*\s+(?:пристрій|апарат))(?=$|[^\p{L}\p{N}])/iu.test(value))return 'mfp';
  if(/^(?:принтер|printer|термопринтер)(?=$|[^\p{L}\p{N}])/iu.test(value))return 'printer';
  return '';
}
export function verifiedCanonPrintMode(name='') {
  if(!printerDeviceKind(name)||!/(?:^|\s)canon(?=\s)/iu.test(name))return '';
  // Manufacturer specifications verified 2026-10-17. GM4040 colour is optional.
  if(/\bGM4040\b/iu.test(name))return 'mono';
  if(/\b(?:GX4040|BX110)\b/iu.test(name))return 'color';
  return '';
}
export function inferredPrintColour(source='') {
  const verified=verifiedCanonPrintMode(source);
  if(verified)return verified;
  // Mono screens and colour scanners are not evidence of PRINT colour.
  const text=String(source).replace(/(?:рк[ -]?)?(?:екран|дисплей|\bscreen\b|\bdisplay\b|сканер|скануван[\p{L}]*|\bscanner\b|\bscanning\b)[^;.!?\n]*(?:[;.!?\n]|$)/giu,' ');
  const colour='(?:кольоров[\\p{L}]*|colou?r)',mono='(?:монохром[\\p{L}]*|моно(?=$|[^\\p{L}])|чорно[ -]?біл[\\p{L}]*|ч/б|monochrome|mono)';
  const device='(?:бфп|мфу|принтер[\\p{L}]*|printer|mfp|друк[\\p{L}]*|print(?:ing)?)';
  // A mono device title wins over later colour copy/scan/ink descriptions.
  const primary=new RegExp('^'+device+'[^;.!?\\n]{0,90}?('+mono+'|'+colour+')','iu').exec(text)?.[1];
  if(primary)return new RegExp('^'+mono+'$','iu').test(primary)?'mono':'color';
  const has=mode=>new RegExp('(?:'+device+'[^;.!?\\n]{0,45}'+mode+'|'+mode+'[ \\p{L}-]{0,25}'+device+')','iu').test(text);
  return has(colour)?'color':has(mono)?'mono':'';
}
export const installationAccessory=name=>/^(?:комплект|набір|installation|install)(?:\s+[\p{L}-]+){0,2}\s+(?:інсталяц|установ|installation|install)|^(?:installation|install)\s+kit/iu.test(String(name).trim());
export function printPaperPlan(name='') {
  const title=String(name).trim();
  if(!/^(?:папір|фотопапір|paper|photo\s+paper)(?=$|[^\p{L}\p{N}])/iu.test(title))return null;
  const photo=/^(?:фотопапір|photo\s+paper)(?=$|[^\p{L}\p{N}])|\bzink\b|фотографічн[\p{L}]*\s+папір/iu.test(title);
  return {rootSlug:'office-consumables',rootName:'Витратні матеріали для друку',
    childSlug:photo?'office-consumables-photo-paper':'office-consumables-paper',childName:photo?'Фотопапір':'Папір для друку'};
}
