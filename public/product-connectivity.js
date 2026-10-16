// Shared by editor, catalog and imports. Do not treat optional hardware as built in.
export const connectivityText=value=>String(value??'').normalize('NFKC').replace(/[‐‑‒–—−]/gu,'-').replace(/\u00a0/gu,' ');
const wifi=/\b(?:wi[\s-]*fi|wireless|wlan|(?:ieee\s*)?802\.11(?:[a-z](?:\/[a-z])*)?)\b/iu;
const wifiKey=/^(?:wi[\s-]*fi|wireless|wlan|бездротове підключення|бездротова мережа)\s*[:：]?$/iu;
const no=/^(?:ні|немає|нема|no|false|0|відсутн\p{L}*|не підтрим\p{L}*)[.!\s]*$/iu;
const yes=/^(?:так|є|yes|true|1|підтрим\p{L}*|вбудован\p{L}*)[.!\s]*$/iu;
export function wifiTextState(raw) {
  let present=false, optional=false, absent=false;
  for(const clause of connectivityText(raw).split(/[;\n]/u)){
    const match=wifi.exec(clause);if(!match)continue;
    const before=clause.slice(Math.max(0,match.index-45),match.index),after=clause.slice(match.index+match[0].length,match.index+match[0].length+65);
    if(/(?:без|немає|відсутн\p{L}*|no|without|не підтрим\p{L}*)\s*$/iu.test(before)||/^\s*[:=-]?\s*(?:ні|немає|нема|no|false|відсутн\p{L}*|не підтрим\p{L}*)(?=$|[\s,.)])/iu.test(after)){absent=true;continue;}
    if(/(?:опці\p{L}*|опційно|optional|додатковий|зовнішній|external|add-on)(?:\s+\p{L}+){0,3}\s*$/iu.test(before)||/^\s*[:(=-]?\s*(?:опці\p{L}*|опційно|optional|докуп\p{L}*|не вход\p{L}*|add-on)(?=$|[\s,.)])/iu.test(after)){optional=true;continue;}
    present=true;
  }
  return absent?'absent':present?'present':optional?'optional':'unknown';
}
export function productWifiState(product={}) {
  const entries=Object.entries(product.specifications||{});
  const explicit=entries.filter(([key])=>wifiKey.test(connectivityText(key).trim()));
  for(const [,value] of explicit)if(no.test(connectivityText(value).trim()))return 'absent';
  for(const [,value] of explicit)if(yes.test(connectivityText(value).trim()))return 'present';
  const state=wifiTextState(entries.map(([key,value])=>key+': '+(Array.isArray(value)?value.join('; '):value)).join('\n'));
  return state!=='unknown'?state:wifiTextState([product.name,product.description].filter(Boolean).join('\n'));
}
export function productInterfaceValues(product={}) {
  const text=connectivityText([product.name,product.description,...Object.entries(product.specifications||{}).map(([key,value])=>key+': '+value)].filter(Boolean).join('\n'));
  return [
    ...(productWifiState(product)==='present'?['Wi‑Fi']:[]),
    ...(/ethernet|\blan\b|rj[ -]?45/iu.test(text)?['Ethernet']:[]),
    ...(/\busb\b/iu.test(text)?['USB']:[]),
    ...(/bluetooth/iu.test(text)?['Bluetooth']:[])
  ];
}
