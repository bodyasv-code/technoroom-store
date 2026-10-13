export function formatCheckoutPhone(value) {
  let digits=String(value).replace(/\D/g,'');
  if(digits.startsWith('380'))digits=digits.slice(3);
  else if(digits.startsWith('0'))digits=digits.slice(1);
  digits=digits.slice(0,9);
  const parts=['+380'];
  if(digits.length)parts.push(' ('+digits.slice(0,2)+(digits.length>=2?') ':''));
  if(digits.length>2)parts.push(digits.slice(2,5));
  if(digits.length>5)parts.push('-'+digits.slice(5,7));
  if(digits.length>7)parts.push('-'+digits.slice(7,9));
  return parts.join('');
}
export function validCheckoutPhone(value) {
  return /^380\d{9}$/.test(String(value).replace(/\D/g,''));
}
