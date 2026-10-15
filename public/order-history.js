import {shippingHistoryValue} from './order-shipping.js?v=20261015-shipping-null';
import {paymentHistoryValue} from './order-payment.js?v=20261015-payment';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses={new:'Нове',processing:'В обробці',supplier_check:'Очікуємо постачальника',confirmed:'Підтверджене',paid:'Оплачене',shipped:'Відправлене',completed:'Виконане',cancelled:'Скасоване'};
const emails={retrying:'Почато повторне надсилання',accepted:'Microsoft прийняв лист (не підтвердження доставки)',failed:'Надсилання не вдалося',not_configured:'Пошта не налаштована'};
export function orderHistoryMarkup(events) {
  if(!events.length)return '<p>Подій ще немає. Журнал записує зміни лише після його підключення.</p>';
  return '<ol>'+events.map(event=>{
    const time=new Date(event.created_at),at=Number.isFinite(time.getTime())?time.toLocaleString('uk-UA',{timeZone:'Europe/Kyiv'}):'Час невідомий';
    const kind=event.kind||event.event_type;
    const label=kind==='status'?'Статус: '+(statuses[event.previous_value]||event.previous_value||'—')+' → '+(statuses[event.next_value]||event.next_value):kind==='email'?'Email: '+(emails[event.next_value]||event.next_value):kind==='shipping'?'Доставка: '+shippingHistoryValue(event.previous_value)+' → '+shippingHistoryValue(event.next_value):kind==='payment'?'Облік оплати: '+paymentHistoryValue(event.previous_value)+' → '+paymentHistoryValue(event.next_value):'Операції: '+event.next_value;
    return '<li><b>'+escape(label)+'</b><small>'+escape(at)+' · '+escape(event.actor_name||(event.actor_id?'Адміністратор (старий запис)':'Система / SQL'))+'</small>'+(event.error_code?'<small>Код: '+escape(event.error_code)+'</small>':'')+'</li>';
  }).join('')+'</ol>';
}
export async function readOrderHistory(db,id) {
  const result=await db.from('order_events').select('id,kind,event_type,created_at,actor_id,actor_name,previous_value,next_value,error_code').eq('order_id',id).order('id',{ascending:false}).limit(100);
  if(result.error){
    if(['42P01','42703','PGRST204','PGRST205'].includes(result.error.code))return {setupRequired:true};
    throw new Error('Не вдалося завантажити журнал. Спробуйте відкрити замовлення ще раз.');
  }
  return {events:result.data||[]};
}
