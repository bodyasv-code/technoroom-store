import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const s = createClient(window.TECHNOROOM_SUPABASE.url, window.TECHNOROOM_SUPABASE.publishableKey);
const money = n => new Intl.NumberFormat('uk-UA').format(n) + ' в‚ґ';
const categories = {projector:'РџСЂРѕС”РєС‚РѕСЂРё',audio:'РђРєСѓСЃС‚РёРєР°',tv:'РўРµР»РµРІС–Р·РѕСЂРё'};
const view = name => document.querySelectorAll('[data-view]').forEach(x=>x.hidden=x.dataset.view!==name);
const notice = (text,error=false) => {const n=document.querySelector('#notice');n.textContent=text;n.hidden=false;n.classList.toggle('error',error)};
async function dashboard(){
  const {data:profile}=await s.from('profiles').select('full_name').single(); if(!profile){await s.auth.signOut();view('login');notice('Р”РѕСЃС‚СѓРї РґРѕ Р°РґРјС–РЅРєРё РІС–РґСЃСѓС‚РЅС–Р№',true);return}
  view('app');document.querySelector('#adminName').textContent=profile.full_name||'РђРґРјС–РЅС–СЃС‚СЂР°С‚РѕСЂ';
  const [{data:products,error:pe},{data:orders,error:oe}]=await Promise.all([s.from('products').select('*').order('created_at',{ascending:false}),s.from('orders').select('*,order_items(count)').order('created_at',{ascending:false})]);
  if(pe||oe)return notice('РќРµ РІРґР°Р»РѕСЃСЏ РѕС‚СЂРёРјР°С‚Рё РґР°РЅС–',true);
  document.querySelector('#productMetric').textContent=products.length;document.querySelector('#orderMetric').textContent=orders.length;document.querySelector('#revenueMetric').textContent=money(orders.reduce((a,o)=>a+Number(o.total),0));
  document.querySelector('#adminProducts').innerHTML=products.map(p=>`<tr><td><b>${p.name}</b><small>${p.brand||'вЂ”'}</small></td><td>${categories[p.category]||p.category}</td><td>${money(p.price)}</td><td><button data-stock="${p.id}" class="stock-toggle ${p.in_stock?'in-stock':'out-stock'}">${p.in_stock?'Р’ РЅР°СЏРІРЅРѕСЃС‚С–':'РџС–Рґ Р·Р°РјРѕРІР»РµРЅРЅСЏ'}</button></td></tr>`).join('')||'<tr><td colspan="4">РўРѕРІР°СЂС–РІ РїРѕРєРё РЅРµРјР°С”</td></tr>';
  document.querySelector('#adminOrders').innerHTML=orders.map(o=>`<tr><td>#${o.id}</td><td>${o.customer_name}<small>${o.customer_phone}</small></td><td>${o.order_items?.[0]?.count||0}</td><td>${money(o.total)}</td><td>${o.status}</td></tr>`).join('')||'<tr><td colspan="5">Р—Р°РјРѕРІР»РµРЅСЊ РїРѕРєРё РЅРµРјР°С”</td></tr>';
  document.querySelectorAll('[data-stock]').forEach(b=>b.onclick=async()=>{const p=products.find(x=>x.id===Number(b.dataset.stock));const {error}=await s.from('products').update({in_stock:!p.in_stock}).eq('id',p.id);if(error)return notice('РќРµ РІРґР°Р»РѕСЃСЏ РѕРЅРѕРІРёС‚Рё С‚РѕРІР°СЂ',true);dashboard()});
}
document.querySelector('#loginForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));const {error}=await s.auth.signInWithPassword({email:d.email,password:d.password});if(error)return notice('РќРµРІС–СЂРЅР° email-Р°РґСЂРµСЃР° Р°Р±Рѕ РїР°СЂРѕР»СЊ',true);document.querySelector('#notice').hidden=true;dashboard()};
document.querySelector('#logout').onclick=async()=>{await s.auth.signOut();view('login')};
s.auth.getSession().then(({data:{session}})=>session?dashboard():view('login'));

