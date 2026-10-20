import {randomUUID} from 'node:crypto';
export const adminInviteRedirect='https://www.technoroom.com.ua/admin';
export function validateAdminInvitation(body){
  const email=String(body?.email??'').trim().toLowerCase(),fullName=String(body?.fullName??'').trim(),role=body?.role;
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!fullName||fullName.length>120||/[\r\n\u0000-\u001f]/.test(fullName)||!['owner','manager'].includes(role)||body.confirm!==true)throw new Error('invalid_invitation');
  return {email,fullName,role};
}
export async function inviteAdminUser(db,actor,input,{sender,attempt=randomUUID(),configured=true}={}){
  const {email,fullName,role}=validateAdminInvitation(input);
  if(!configured)return {status:503,error:'Надсилання запрошень не налаштоване. Користувача не створено.'};
  const claimed=await db.rpc('claim_admin_user_invitation',{p_actor:actor,p_email:email,p_name:fullName,p_role:role,p_attempt:attempt});
  if(claimed.error){
    const setup=['42883','PGRST202','42P01','PGRST205'].includes(claimed.error.code);
    return {status:setup?503:409,error:setup?'Виконайте admin-users-upgrade.sql перед додаванням користувачів.':'Запрошення заблоковане: email уже використовується, спроба виконується або діє ліміт. Для активного користувача використовуйте відновлення пароля.'};
  }
  const inv=claimed.data;
  try{
    const generated=await db.auth.admin.generateLink({type:inv.target_user_id?'recovery':'invite',email:inv.email,options:{redirectTo:adminInviteRedirect,data:{full_name:inv.full_name,technoroom_admin_invitation:inv.id}}});
    if(generated.error||!generated.data?.user?.id||!generated.data?.properties?.action_link)throw new Error('link_failed');
    const user=generated.data.user;
    if(String(user.email).toLowerCase()!==inv.email||(inv.target_user_id&&user.id!==inv.target_user_id))throw new Error('target_mismatch');
    const bound=await db.rpc('bind_admin_user_invitation',{p_actor:actor,p_id:inv.id,p_attempt:attempt,p_target:user.id});
    if(bound.error)throw new Error('profile_failed');
    const sent=await sender({email:inv.email,fullName:inv.full_name,role:inv.role,actionLink:generated.data.properties.action_link});
    if(sent.status!=='accepted')throw new Error('mail_failed');
    const finished=await db.rpc('finish_admin_user_invitation',{p_actor:actor,p_id:inv.id,p_attempt:attempt,p_status:'accepted'});
    if(finished.error)return {status:202,message:'Microsoft прийняв лист, але статус журналу не оновився. Перевірте пошту; не надсилайте повторно одразу.'};
    return {status:202,message:'Microsoft прийняв запрошення. Користувач задасть пароль за посиланням у листі. Доставку ще потрібно перевірити.'};
  }catch{
    await db.rpc('finish_admin_user_invitation',{p_actor:actor,p_id:inv.id,p_attempt:attempt,p_status:'failed'});
    return {status:502,error:'Запрошення не завершено. Обліковий запис міг бути створений. Перевірте пошту та список користувачів перед повторною спробою; повтор не змінює роль. Пароль або посилання в журналі не зберігаються.'};
  }
}
export async function handleAdminUsers(request,response,{db,sender,configured}={}){
  response.setHeader('Cache-Control','no-store');
  if(request.method!=='POST'){response.setHeader('Allow','POST');return response.status(405).json({error:'Method not allowed'});}
  const origin=request.headers.origin;
  if(origin&&!['https://www.technoroom.com.ua','https://technoroom.com.ua'].includes(origin))return response.status(403).json({error:'Джерело запиту заборонено.'});
  const bearer=/^Bearer (.+)$/i.exec(request.headers.authorization||'');
  if(!bearer)return response.status(401).json({error:'Потрібен вхід власника.'});
  const auth=await db.auth.getUser(bearer[1]);
  if(auth.error||!auth.data?.user)return response.status(401).json({error:'Потрібен вхід власника.'});
  const actor=auth.data.user.id,profile=await db.from('profiles').select('role').eq('id',actor).maybeSingle();
  if(profile.error||profile.data?.role!=='owner')return response.status(403).json({error:'Керувати користувачами може лише власник.'});
  if(request.body?.action==='list'){
    const result=await db.rpc('list_admin_users',{p_actor:actor});
    if(result.error)return response.status(503).json({error:'Керування користувачами ще не підключено. Виконайте admin-users-upgrade.sql.'});
    return response.status(200).json({users:result.data||[]});
  }
  if(!['invite','resend'].includes(request.body?.action))return response.status(400).json({error:'Невідома дія.'});
  try{const result=await inviteAdminUser(db,actor,request.body,{sender,configured});return response.status(result.status).json(result.error?{error:result.error}:{message:result.message});}
  catch{return response.status(400).json({error:'Перевірте email, ім’я, роль і підтвердження доступу.'});}
}
