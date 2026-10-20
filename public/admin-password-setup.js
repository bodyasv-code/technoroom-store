export function isInvitePasswordSetup(search='',hash=''){return new URLSearchParams(search).get('setup')==='invite'||new URLSearchParams(hash.replace(/^#/,'' )).get('type')==='invite';}
export async function saveAdminPassword(db,password,confirmation){
  if(typeof password!=='string'||password.length<10)throw new Error('Пароль має містити щонайменше 10 символів.');
  if(password!==confirmation)throw new Error('Паролі не збігаються.');
  const updated=await db.auth.updateUser({password});if(updated.error)throw new Error('Не вдалося зберегти пароль. Посилання могло втратити чинність.');
  const signedOut=await db.auth.signOut();if(signedOut.error)throw new Error('Пароль збережено, але не вдалося завершити сеанс. Спробуйте вийти вручну.');
}
