const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses={new:'Нове',processing:'В обробці',supplier_check:'Очікуємо постачальника',confirmed:'Підтверджене',paid:'Оплачене',shipped:'Відправлене',completed:'Виконане',cancelled:'Скасоване'};
const emails={retrying:'Почато повторне надсилання',accepted:'Microsoft прийняв лист (не підтвердження доставки)',failed:'Надсилання не вдалося',not_configured:'Пошта не налаштована'};
export function orderHistoryMarkup(events) {
  if(!events.length)return '<p>Подій ще немає. Журнал записує зміни лише після його підключення.</p>';
  return '<ol>'+events.map(event=>{
    const time=new Date(event.created_at),at=Number.isFinite(time.getTime())?time.toLocaleString('uk-UA',{timeZone:'Europe/Kyiv'}):'Час невідомий';
    const label=event.kind==='status'?'Статус: '+(statuses[event.previous_value]||event.previous_value||'—')+' → '+(statuses[event.next_value]||event.next_value):'Email: '+(emails[event.next_value]||event.next_value);
    return '<li><b>'+escape(label)+'</b><small>'+escape(at)+' · '+escape(event.actor_name||'Система / SQL')+'</small>'+(event.error_code?'<small>Код: '+escape(event.error_code)+'</small>':'')+'</li>';
  }).join('')+'</ol>';
}
export async function readOrderHistory(db,id) {
  const result=await db.from('order_events').select('id,kind,created_at,actor_name,previous_value,next_value,error_code').eq('order_id',id).order('id',{ascending:false}).limit(100);
  if(result.error){
    if(['42P01','PGRST205'].includes(result.error.code))return {setupRequired:true};
    throw new Error('Не вдалося завантажити журнал. Спробуйте відкрити замовлення ще раз.');
  }
  return {events:result.data||[]};
}
