export const paymentStatuses={'':'Не вказано',unpaid:'Не оплачено',partial:'Частково оплачено',paid:'Оплачено'};
export function paymentCents(value){
  const text=String(value??'').replace(/\s+/g,'');
  if(!/^\d+(?:[.,]\d{1,2})?$/.test(text))throw new Error('Вкажіть невід’ємну суму з максимум двома знаками після коми.');
  const [whole,fraction='']=text.replace(',','.').split('.'),cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(cents)||cents>999999999999)throw new Error('Сума завелика.');
  return cents;
}
const amountText=cents=>(cents/100).toFixed(2);
export function paymentFieldsReady(order){return ['manual_payment_status','manual_amount_paid'].every(key=>Object.hasOwn(order,key)&&order[key]!==undefined)}
export function normalizePayment(status,amount,total){
  if(!Object.hasOwn(paymentStatuses,status))throw new Error('Оберіть статус оплати зі списку.');
  if(status===''){
    if(String(amount??'').trim()!=='')throw new Error('Для невідомого статусу залиште суму порожньою.');
    return {manual_payment_status:null,manual_amount_paid:null};
  }
  const cents=paymentCents(amount),totalCents=paymentCents(total);
  if(cents>totalCents)throw new Error('Отримана сума не може перевищувати суму замовлення.');
  if((status==='unpaid'&&cents!==0)||(status==='partial'&&(cents<=0||cents>=totalCents))||(status==='paid'&&cents!==totalCents))throw new Error('Статус оплати не відповідає сумі отриманих коштів.');
  return {manual_payment_status:status,manual_amount_paid:amountText(cents)};
}
export async function saveOrderPayment(db,order,status,amount){
  if(!Number.isSafeInteger(Number(order?.id))||Number(order.id)<1)throw new Error('Некоректне замовлення.');
  if(!paymentFieldsReady(order))throw new Error('Спочатку підключіть order-payment-upgrade.sql у Supabase.');
  const changes=normalizePayment(status,amount,order.total);
  const originalAmount=order.manual_amount_paid===null?null:amountText(paymentCents(order.manual_amount_paid));
  if(changes.manual_payment_status===order.manual_payment_status&&changes.manual_amount_paid===originalAmount)return false;
  let query=db.from('orders').update(changes).eq('id',Number(order.id)).eq('total',order.total);
  for(const key of ['manual_payment_status','manual_amount_paid'])query=order[key]===null?query.is(key,null):query.eq(key,order[key]);
  const result=await query.select('id,manual_payment_status,manual_amount_paid,total');
  if(result.error)throw new Error('Не вдалося зберегти оплату: '+result.error.message);
  if(result.data?.length!==1)throw new Error('Оплату або суму замовлення вже змінено чи немає доступу. Відкрийте замовлення знову.');
  return result.data[0];
}
export function paymentHistoryValue(value){
  try{const fields=JSON.parse(value),status=Object.hasOwn(fields,'manual_payment_status')?fields.manual_payment_status:fields.payment_status,amount=Object.hasOwn(fields,'manual_amount_paid')?fields.manual_amount_paid:fields.amount_paid;return(paymentStatuses[status??'']||'Невідомий статус')+' · отримано: '+(amount==null?'не вказано':amountText(paymentCents(amount))+' ₴')}catch{return 'Дані невідомі'}
}
export function mountOrderPayment({db,order,before,onSaved}){
  const section=document.createElement('section');section.className='order-payment';before.before(section);
  section.innerHTML='<h3>Облік оплати</h3>';
  if(!paymentFieldsReady(order)){section.innerHTML+='<p>Для обліку оплати виконайте order-payment-upgrade.sql у Supabase.</p>';return}
  let current=order;
  section.innerHTML+='<label>Статус оплати<select id="orderPaymentStatus">'+Object.entries(paymentStatuses).map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')+'</select></label><label>Отримано коштів загалом, ₴<input id="orderAmountPaid" type="text" inputmode="decimal" autocomplete="off" maxlength="20"></label><p id="orderPaymentBalance"></p><button type="button" id="saveOrderPayment">Зберегти облік оплати</button><p class="payment-hint">Вказуйте загальну отриману суму, не черговий платіж. Це ручний запис: гроші не списуються, статус замовлення не змінюється, листи не надсилаються. Порожній статус означає, що оплату ще не перевірено.</p><p id="orderPaymentMessage" role="status" hidden></p>';
  const status=section.querySelector('select'),amount=section.querySelector('input'),button=section.querySelector('button'),message=section.querySelector('#orderPaymentMessage'),balance=section.querySelector('#orderPaymentBalance');
  const show=(text,error=false)=>{message.textContent=text;message.hidden=!text;message.classList.toggle('error',error)};
  const updateBalance=()=>{
    try{const normalized=normalizePayment(status.value,amount.value,current.total);balance.textContent=normalized.manual_amount_paid===null?'Залишок не визначений — оплату ще не перевірено.':'Залишилось отримати: '+amountText(paymentCents(current.total)-paymentCents(normalized.manual_amount_paid))+' ₴';}
    catch{balance.textContent='Перевірте відповідність статусу та суми.'}
  };
  status.value=current.manual_payment_status??'';amount.value=current.manual_amount_paid??'';updateBalance();
  status.onchange=()=>{if(status.value==='unpaid')amount.value='0.00';if(status.value==='paid')amount.value=amountText(paymentCents(current.total));if(status.value==='')amount.value='';updateBalance()};
  amount.oninput=updateBalance;
  button.onclick=async()=>{
    if(button.disabled)return;button.disabled=true;show('Зберігаємо облік оплати…');
    try{
      const saved=await saveOrderPayment(db,current,status.value,amount.value);
      if(!section.isConnected)return;
      if(!saved){show('Дані оплати не змінені.');return}
      current={...current,...saved};status.value=current.manual_payment_status??'';amount.value=current.manual_amount_paid??'';updateBalance();show('Облік оплати збережено.');onSaved(saved);
    }catch(error){if(section.isConnected)show(error.message||'Не вдалося зберегти оплату.',true)}
    finally{button.disabled=false}
  };
}
