import {printFormatKey} from './verified-printer-rules.js?v=20261016-import-guards-2';

export const printerEditorFormats=['A4','A3/A3+','A3','A3+'];
export function normalizePrinterEditorFormat(raw) {
  const value=String(raw||'').trim().toUpperCase().replace(/А/gu,'A').replace(/\s+/gu,'');
  return printerEditorFormats.includes(value)?value:'';
}
export const hasPrinterFormat = specifications => Object.keys(specifications).some(key=>printFormatKey.test(key.trim()));
export function readPrinterEditorFormat(specifications={},title='') {
  // Explicit print format wins; scanner/tray/media mentions are not print-format evidence.
  const explicit=Object.entries(specifications).filter(([key])=>printFormatKey.test(key.trim()));
  const canonical=explicit.find(([key])=>/^формат\s*[:：]?$/iu.test(key.trim()));
  if(canonical)return normalizePrinterEditorFormat(canonical[1]);
  for(const [,value] of explicit){const format=normalizePrinterEditorFormat(value);if(format)return format;}
  const opening=/^(?:БФП|МФУ|MFP|принтер|printer|багатофункціональний пристрій)\s+(?:(?:ink|laser|color|colour|mono|кольоровий|монохромний|лазерний|струменевий)\s+)*([AА][34](?:\s*\/\s*[AА]3\s*\+|\+)?)(?=\s|$|[,(])/iu.exec(String(title).trim());
  return opening?normalizePrinterEditorFormat(opening[1]):'';
}
export function writePrinterEditorFormat(specifications,raw) {
  const result=Object.fromEntries(Object.entries(specifications).filter(([key])=>!printFormatKey.test(key.trim())));
  const format=normalizePrinterEditorFormat(raw);
  if(format)result['Формат']=format;
  return result;
}
