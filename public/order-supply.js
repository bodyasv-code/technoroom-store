export function normalizeSupply(date,note){
  const supply_expected_on=String(date??'').trim()||null,supply_note=String(note??'').trim();
  if(supply_expected_on){
    const parsed=new Date(supply_expected_on+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(supply_expected_on)||supply_expected_on.startsWith('0000')||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==supply_expected_on)throw new Error('Вкажіть коректну дату постачання.');
  }
  if(supply_note.length>2000)throw new Error('Примітка постачальника — максимум 2000 символів.');
  return {supply_expected_on,supply_note};
}
export function kyivToday(now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(part=>[part.type,part.value]));
  return parts.year+'-'+parts.month+'-'+parts.day;
}
export function supplyDateLabel(date){return date?String(date).split('-').reverse().join('.'):'Не вказано'}
export function supplyState(order,today=kyivToday()){
  if(!order.supply_expected_on)return 'none';
  try{normalizeSupply(order.supply_expected_on,'')}catch{return 'none'}
  if(['shipped','completed','cancelled'].includes(order.status))return 'closed';
  return order.supply_expected_on<today?'overdue':order.supply_expected_on===today?'today':'upcoming';
}
export function supplyFieldsReady(order){return ['supply_expected_on','supply_note'].every(key=>Object.hasOwn(order,key)&&order[key]!==undefined)}
export async function saveOrderSupply(db,order,date,note){
  if(!Number.isSafeInteger(Number(order?.id))||Number(order.id)<1)throw new Error('Некоректне замовлення.');
  if(!supplyFieldsReady(order))throw new Error('Спочатку підключіть order-supply-upgrade.sql у Supabase.');
  const changes=normalizeSupply(date,note);
  if(changes.supply_expected_on===order.supply_expected_on&&changes.supply_note===(order.supply_note??''))return false;
  let query=db.from('orders').update(changes).eq('id',Number(order.id)).eq('status',order.status);
  for(const key of ['supply_expected_on','supply_note'])query=order[key]===null?query.is(key,null):query.eq(key,order[key]);
  const result=await query.select('id,supply_expected_on,supply_note');
  if(result.error)throw new Error('Не вдалося зберегти постачання: '+result.error.message);
  if(result.data?.length!==1)throw new Error('Дані постачання або статус уже змінено чи немає доступу. Відкрийте замовлення знову.');
  return result.data[0];
}
export function supplyHistoryValue(value){
  try{const fields=JSON.parse(value);return supplyDateLabel(fields.supply_expected_on)+(fields.supply_note?' · '+fields.supply_note:'')}catch{return 'Дані невідомі'}
}
export function mountOrderSupply({db,order,before,onSaved}){
  const section=document.createElement('section');section.className='order-supply';before.before(section);
  section.innerHTML='<h3>Строк постачання</h3>';
  if(!supplyFieldsReady(order)){section.innerHTML+='<p>Для обліку постачання виконайте order-supply-upgrade.sql у Supabase.</p>';return}
  let current=order;
  section.innerHTML+='<label>Очікувана дата постачання<input id="orderSupplyDate" type="date" max="9999-12-31"></label><label>Примітка постачальника<textarea id="orderSupplyNote" rows="3" maxlength="2000"></textarea></label><p id="orderSupplyState"></p><button type="button" id="saveOrderSupply">Зберегти строк постачання</button><p>Це внутрішня очікувана дата постачання, не обіцянка доставки покупцю. Минулі дати позначаються як прострочені лише для невідправлених, незавершених і нескaсованих замовлень. День рахується за Києвом. Статус замовлення й листи не змінюються.</p><p id="orderSupplyMessage" role="status" hidden></p>';
  const date=section.querySelector('input'),note=section.querySelector('textarea'),button=section.querySelector('button'),hint=section.querySelector('#orderSupplyState'),message=section.querySelector('#orderSupplyMessage');
  date.value=current.supply_expected_on??'';note.value=current.supply_note??'';
  const show=(text,error=false)=>{message.textContent=text;message.hidden=!text;message.classList.toggle('error',error)};
  const updateHint=()=>{
    const state=supplyState({...current,supply_expected_on:date.value||null});
    hint.textContent={none:'Дата постачання не вказана.',overdue:'Постачання прострочене.',today:'Постачання очікується сьогодні.',upcoming:'Постачання очікується '+supplyDateLabel(date.value)+'.',closed:'Замовлення відправлене або закрите — прострочення не позначається.'}[state];
    hint.classList.toggle('error',state==='overdue');
  };
  date.oninput=updateHint;updateHint();
  button.onclick=async()=>{
    if(button.disabled)return;button.disabled=true;show('Зберігаємо постачання…');
    try{
      const saved=await saveOrderSupply(db,current,date.value,note.value);
      if(!section.isConnected)return;
      if(!saved){show('Дані постачання не змінені.');return}
      current={...current,...saved};date.value=current.supply_expected_on??'';note.value=current.supply_note??'';updateHint();show('Строк постачання збережено.');onSaved(saved);
    }catch(error){if(section.isConnected)show(error.message||'Не вдалося зберегти постачання.',true)}
    finally{button.disabled=false}
  };
}
