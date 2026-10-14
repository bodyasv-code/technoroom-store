import {createClient} from '@supabase/supabase-js';
import {notifyNewOrder} from './microsoft-order-mail.js';
import {canRetryNotification} from '../public/order-admin.js';
import {randomUUID} from 'node:crypto';
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
export default async function handler(request,response) {
  response.setHeader('Cache-Control','no-store');
  if(request.method!=='POST'){response.setHeader('Allow','POST');return response.status(405).json({error:'Method not allowed'});}
  const bearer=/^Bearer (.+)$/i.exec(request.headers.authorization||'');
  if(!bearer)return response.status(401).json({error:'Потрібен вхід адміністратора.'});
  const auth=await supabase.auth.getUser(bearer[1]);
  if(auth.error||!auth.data.user)return response.status(401).json({error:'Потрібен вхід адміністратора.'});
  const profile=await supabase.from('profiles').select('id').eq('id',auth.data.user.id).maybeSingle();
  if(profile.error||!profile.data)return response.status(403).json({error:'Доступ лише адміністраторам.'});
  const id=Number(request.body?.orderId);
  if(!Number.isSafeInteger(id)||id<1||request.body?.confirmPossibleDuplicate!==true)return response.status(400).json({error:'Підтвердьте можливість повторного листа.'});
  const loaded=await supabase.from('orders').select('id,checkout_details').eq('id',id).single();
  if(loaded.error||!loaded.data)return response.status(404).json({error:'Замовлення не знайдено.'});
  const previous=loaded.data.checkout_details;
  if(!canRetryNotification(previous?.notification))return response.status(409).json({error:'Повторне надсилання зараз недоступне.'});
  const details={...previous,notification:{status:'retrying',at:new Date().toISOString(),attempt:randomUUID()}};
  // Atomic compare-and-swap: only one admin request can claim the same failure.
  const claimed=await supabase.from('orders').update({checkout_details:details}).eq('id',id)
    .eq('checkout_details',JSON.stringify(previous)).select('id');
  if(claimed.error||claimed.data?.length!==1)return response.status(409).json({error:'Інший запит уже обробляє це сповіщення. Оновіть замовлення.'});
  let result;
  try{result=await notifyNewOrder(supabase,id)}
  catch{return response.status(502).json({error:'Спроба перервалася. Перевірте пошту; повтор стане доступним через 5 хвилин.'})}
  if(result.status!=='accepted')return response.status(502).json({error:'Лист не прийнятий. Статус спроби збережено.',status:result.status});
  return response.status(202).json({message:'Microsoft прийняв повторний лист. Перевірте пошту.'});
}
