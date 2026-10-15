const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const orderStatuses=['new','processing','supplier_check','confirmed','paid','shipped','completed','cancelled'];
const searchText=value=>String(value??'').toLocaleLowerCase('uk-UA').replace(/[ʼ'’`]/g,'').replace(/[\s_\-–—/.,]+/g,'');
export function matchesOrderSearch(order,query,productsById=new Map()) {
  const q=searchText(query);if(!q)return true;
  const fields=[order.id,order.customer_name,order.customer_phone,order.customer_email,order.comment];
  for(const item of order.order_items||[]){
    fields.push(item.product_name,item.sku);
    const product=productsById.get(Number(item.product_id));
    if(product)fields.push(product.sku,product.name);
  }
  return fields.some(value=>searchText(value).includes(q));
}
export function hasFailedOrderEmail(order) {
  return ['failed','not_configured'].includes(order.checkout_details?.notification?.status);
}
export function notificationLabel(status) {
  return {accepted:'Microsoft прийняв лист (доставка окремо не підтверджена)',failed:'Надсилання не вдалося',
    not_configured:'Пошта не налаштована',retrying:'Повторне надсилання виконується'}[status]||'Статус надсилання невідомий';
}
export function canRetryNotification(notification,now=Date.now()) {
  if(['failed','not_configured'].includes(notification?.status))return true;
  return notification?.status==='retrying'&&Number.isFinite(Date.parse(notification.at))&&now-Date.parse(notification.at)>300000;
}
export function orderDetailsMarkup(order) {
  const details=order.checkout_details||{},delivery=details.delivery||{},company=details.company;
  const deliveryNames={nova_poshta:'Нова пошта',courier:'Кур’єр',pickup:'Самовивіз'};
  const paymentNames={cod:'При отриманні',invoice:'За рахунком',card:'Карткою онлайн'};
  const block=(title,lines)=>`<section><h3>${title}</h3>${lines.filter(Boolean).map(line=>`<p>${escape(line)}</p>`).join('')}</section>`;
  const notification=details.notification;
  return '<div class="order-detail-blocks">'+
    block('Покупець',[order.customer_name,order.customer_phone,order.customer_email])+
    block('Доставка',[deliveryNames[delivery.method]||'Спосіб не вказаний',order.city,order.address])+
    block('Оплата',[paymentNames[details.payment?.method]||'Спосіб не вказаний'])+
    (company?block('Реквізити компанії',[company.name,'ЄДРПОУ / ІПН: '+(company.code||'—'),company.contact,company.invoiceEmail]):'')+
    (order.comment?block('Коментар і деталі оформлення',[order.comment]):'')+
    block('Email-сповіщення',[notificationLabel(notification?.status),notification?.at?'Остання спроба: '+notification.at:null])+
    '</div>'+(canRetryNotification(notification)?
      '<div class="order-email-retry"><p>Після мережевого збою лист міг уже надійти. Перевірте пошту перед повтором.</p><label><input type="checkbox" id="confirmOrderEmailRetry"> Розумію, що може надійти повторний лист</label><button type="button" id="retryOrderEmail" disabled>Повторити email-сповіщення</button></div>':'');
}
export async function saveOrderChanges(db,order,status,managerNote) {
  if(!Number.isSafeInteger(Number(order?.id))||Number(order.id)<1||!orderStatuses.includes(status))throw new Error('Некоректний статус замовлення.');
  const result=await db.from('orders').update({status,manager_note:String(managerNote||'').trim()})
    .eq('id',Number(order.id)).eq('status',order.status).select('id');
  if(result.error)throw new Error('Не вдалося зберегти зміни: '+result.error.message);
  if(result.data?.length!==1)throw new Error('Статус уже змінено або немає доступу. Оновіть список і перевірте замовлення.');
}
