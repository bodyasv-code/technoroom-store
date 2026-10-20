export function isInvitePasswordSetup(search='',hash=''){return new URLSearchParams(search).get('setup')==='invite'||new URLSearchParams(hash.replace(/^#/,'' )).get('type')==='invite';}
export function isAdminPasswordSetup(search='',hash=''){
  const type=new URLSearchParams(hash.replace(/^#/,'' )).get('type');
  return isInvitePasswordSetup(search,hash)||type==='recovery'||new URLSearchParams(search).get('setup')==='recovery';
}
// Recheck after each asynchronous read: a recovery event may arrive while the
// dashboard is loading. Never let that in-flight load replace the password form.
export async function openAdminDashboard(db,{isPasswordSetup,show,onProfile,onReady,onDenied}){
  if(isPasswordSetup()){show('recovery');return;}
  const {data:{user}}=await db.auth.getUser();
  if(isPasswordSetup()){show('recovery');return;}
  if(!user){show('login');return;}
  const {data:profile}=await db.from('profiles').select('full_name,role').eq('id',user.id).maybeSingle();
  if(isPasswordSetup()){show('recovery');return;}
  if(!profile){await db.auth.signOut();show('login');onDenied();return;}
  show('app');onProfile(profile,user);await onReady();
}
export async function saveAdminPassword(db,password,confirmation){
  if(typeof password!=='string'||password.length<10)throw new Error('Пароль має містити щонайменше 10 символів.');
  if(password!==confirmation)throw new Error('Паролі не збігаються.');
  const updated=await db.auth.updateUser({password});if(updated.error)throw new Error('Не вдалося зберегти пароль. Посилання могло втратити чинність.');
  const signedOut=await db.auth.signOut();if(signedOut.error)throw new Error('Пароль збережено, але не вдалося завершити сеанс. Спробуйте вийти вручну.');
}
