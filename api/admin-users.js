import {createClient} from '@supabase/supabase-js';
import {handleAdminUsers} from './admin-users-service.js';
import {sendAdminInvitationMail} from './microsoft-order-mail.js';
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
export default async function handler(request,response){
  try{return await handleAdminUsers(request,response,{db,sender:sendAdminInvitationMail,configured:Boolean(process.env.MS_GRAPH_CLIENT_SECRET)});}
  catch{return response.status(500).json({error:'Не вдалося обробити запит. Оновіть список перед повторною спробою.'});}
}
