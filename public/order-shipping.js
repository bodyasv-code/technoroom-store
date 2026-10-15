export const shippingCarriers={'':'Не вказано',nova_poshta:'Нова пошта',ukrposhta:'Укрпошта',other:'Інший перевізник'};
export function shippingFieldsReady(order){
  return ['shipping_carrier','tracking_number'].every(key=>Object.hasOwn(order,key)&&(order[key]===null||typeof order[key]==='string'));
}
export function normalizeShipping(carrier,number){
  const shipping_carrier=String(carrier??''),tracking_number=String(number??'').replace(/\s+/g,'').toUpperCase();
  if(!Object.hasOwn(shippingCarriers,shipping_carrier))throw new Error('Оберіть перевізника зі списку.');
  if(tracking_number&&(!shipping_carrier||!/^[A-Z0-9-]{5,40}$/.test(tracking_number)))throw new Error('Перевірте перевізника та номер відправлення (5–40 латинських літер, цифр або дефісів).');
  if(tracking_number&&shipping_carrier==='nova_poshta'&&!/^\d{14}$/.test(tracking_number))throw new Error('ТТН Нової пошти має містити 14 цифр.');
  if(tracking_number&&shipping_carrier==='ukrposhta'&&!/^[A-Z0-9]{13}$/.test(tracking_number))throw new Error('Номер Укрпошти має містити 13 цифр або латинських літер.');
  return{shipping_carrier,tracking_number};
}
export function shippingTrackingUrl(carrier,number){
  try{if(!normalizeShipping(carrier,number).tracking_number)return null}catch{return null}
  // Fixed official domains only. Opening these pages is a deliberate manager action.
  return carrier==='nova_poshta'?'https://tracking.novaposhta.ua/#/uk/':carrier==='ukrposhta'?'https://track.ukrposhta.ua/tracking_UA.html?barcode='+encodeURIComponent(number):null;
}
export async function saveOrderShipping(db,order,carrier,number){
  if(!Number.isSafeInteger(Number(order?.id))||Number(order.id)<1)throw new Error('Некоректне замовлення.');
  if(!shippingFieldsReady(order))throw new Error('Спочатку підключіть order-shipping-upgrade.sql у Supabase.');
  const changes=normalizeShipping(carrier,number);
  if(changes.shipping_carrier===(order.shipping_carrier??'')&&changes.tracking_number===(order.tracking_number??''))return false;
  let query=db.from('orders').update(changes).eq('id',Number(order.id));
  for(const key of ['shipping_carrier','tracking_number'])query=order[key]===null?query.is(key,null):query.eq(key,order[key]);
  const result=await query.select('id');
  if(result.error)throw new Error('Не вдалося зберегти доставку: '+result.error.message);
  if(result.data?.length!==1)throw new Error('Доставку вже змінено або немає доступу. Відкрийте замовлення знову.');
  return true;
}
export function shippingHistoryValue(value){
  try{const fields=JSON.parse(value);return(shippingCarriers[fields.shipping_carrier]||'Не вказано')+' · ТТН: '+(fields.tracking_number||'не вказано')}catch{return 'Дані невідомі'}
}
