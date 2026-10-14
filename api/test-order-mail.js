import {createClient} from '@supabase/supabase-js';
import {sendMicrosoftMail} from './microsoft-order-mail.js';
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
let lastTest=0;
export default async function handler(request,response) {
  response.setHeader('Cache-Control','no-store');
  if(request.method!=='POST'){response.setHeader('Allow','POST');return response.status(405).json({error:'Method not allowed'});}
  const bearer=/^Bearer (.+)$/i.exec(request.headers.authorization||'');
  if(!bearer)return response.status(401).json({error:'Потрібен вхід адміністратора.'});
  const auth=await supabase.auth.getUser(bearer[1]);
  if(auth.error||!auth.data.user)return response.status(401).json({error:'Потрібен вхід адміністратора.'});
  const profile=await supabase.from('profiles').select('id').eq('id',auth.data.user.id).maybeSingle();
  if(profile.error||!profile.data)return response.status(403).json({error:'Доступ лише адміністраторам.'});
  if(Date.now()-lastTest<60000)return response.status(429).json({error:'Зачекайте хвилину перед повторним тестом.'});
  lastTest=Date.now();
  try {
    const result=await sendMicrosoftMail({subject:'TECHNOROOM: тест сповіщень про замовлення',
      text:'Це тестовий лист із сайту TECHNOROOM. Замовлення не створювалося, залишки не змінювалися.\nЧас тесту: '+new Date().toISOString()});
    if(result.status==='not_configured')return response.status(503).json({error:'MS_GRAPH_CLIENT_SECRET не налаштований для цього розгортання.'});
    return response.status(202).json({message:'Microsoft прийняв тестовий лист. Перевірте office@tehnoroom.com.ua та папку «Спам».'});
  } catch(error) {
    return response.status(502).json({error:'Тестовий лист не прийнятий Microsoft.',code:/^mail_[a-z0-9_]+$/.test(error.message)?error.message:'mail_internal_error'});
  }
}
