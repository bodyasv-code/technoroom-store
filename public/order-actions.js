import {hasFailedOrderEmail} from './order-admin.js?v=20261015-order-search';
import {supplyState,kyivToday} from './order-supply.js?v=20261015-supply';
export function orderActionSummary(orders,today=kyivToday()){
  const summary={new:0,overdue:0,email:0};
  for(const order of orders){if(order.status==='new')summary.new++;if(supplyState(order,today)==='overdue')summary.overdue++;if(hasFailedOrderEmail(order))summary.email++}
  return summary;
}
export function orderActionFilters(kind){
  if(!['new','overdue','email'].includes(kind))return null;
  return{search:'',status:kind==='new'?'new':'all',supply:kind==='overdue'?'overdue':'all',email:kind==='email'?'failed':'all'};
}
export function mountOrderActions({root=document,onSelect}){
  const overview=root.querySelector('#overview');if(!overview)return()=>{};
  const panel=root.createElement('div');panel.className='overview-order-actions';panel.setAttribute('role','region');panel.setAttribute('aria-labelledby','orderActionsTitle');
  panel.innerHTML='<h2 id="orderActionsTitle">Потребують дії</h2><p>Замовлення, які варто перевірити. Натисніть картку, щоб відкрити відповідний список.</p><div class="overview-order-action-grid"><button type="button" data-order-action="new" disabled><span>Нові замовлення</span><strong>—</strong><small>Переглянути нові заявки →</small></button><button type="button" data-order-action="overdue" disabled><span>Прострочене постачання</span><strong>—</strong><small>Уточнити строки постачання →</small></button><button type="button" data-order-action="email" disabled><span>Невдалі email-сповіщення</span><strong>—</strong><small>Перевірити надсилання →</small></button></div><p id="orderActionsHint" role="status">Завантаження замовлень…</p>';
  overview.append(panel);
  const buttons=[...panel.querySelectorAll('[data-order-action]')],hint=panel.querySelector('#orderActionsHint');
  for(const button of buttons)button.onclick=()=>{if(!button.disabled){const filters=orderActionFilters(button.dataset.orderAction);if(filters)onSelect(filters)}};
  return(orders,{ready=true,today=kyivToday()}={})=>{
    const summary=orderActionSummary(orders,today);
    for(const button of buttons){const count=summary[button.dataset.orderAction];button.disabled=!ready;button.querySelector('strong').textContent=ready?String(count):'—';button.classList.toggle('has-actions',ready&&count>0)}
    hint.textContent=ready?'Одне замовлення може бути в кількох картках. Строки рахуються за Києвом; відправлені, виконані й скасовані замовлення не позначаються простроченими.':'Завантаження замовлень…';
  };
}
