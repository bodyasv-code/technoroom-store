import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isAdminPasswordSetup,openAdminDashboard} from '../public/admin-password-setup.js';

for(const type of ['recovery','invite']){
  assert.equal(isAdminPasswordSetup('',`#access_token=TEST&type=${type}&refresh_token=TEST`),true);
  assert.equal(isAdminPasswordSetup(`?setup=${type}`,''),true);
}
for(const hash of ['#overview','#adminUsers','#type=signup','#type=magiclink',''])assert.equal(isAdminPasswordSetup('',hash),false);

// Initial recovery callback, and recovery arriving during either dashboard read.
for(const stage of ['initial','user','profile','normal','missing-user','missing-profile']){
  let setup=stage==='initial',loaded=0,denied=0,signedOut=0;const views=[];
  const db={auth:{getUser:async()=>{if(stage==='user')setup=true;return {data:{user:stage==='missing-user'?null:{id:'TEST'}}};},signOut:async()=>{signedOut++;}},from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>{if(stage==='profile')setup=true;return {data:stage==='missing-profile'?null:{full_name:'Test',role:'owner'}};}})};
  await openAdminDashboard(db,{isPasswordSetup:()=>setup,show:x=>views.push(x),onProfile:()=>{},onReady:async()=>{loaded++;},onDenied:()=>{denied++;}});
  if(['initial','user','profile'].includes(stage)){assert.deepEqual(views,['recovery']);assert.equal(loaded,0);assert.equal(signedOut,0);}
  else if(stage==='normal'){assert.deepEqual(views,['app']);assert.equal(loaded,1);}
  else {assert.deepEqual(views,['login']);assert.equal(loaded,0);assert.equal(denied,stage==='missing-profile'?1:0);}
}
const source=await readFile(new URL('../public/admin.js',import.meta.url),'utf8');
assert.ok(source.indexOf('let passwordSetupMode=isAdminPasswordSetup')<source.indexOf('const supabase=createClient'));
assert.match(source,/ev==='PASSWORD_RECOVERY'\)passwordSetupMode=true/);
console.log('Admin password recovery: callback captured before Auth initialization and asynchronous dashboard races blocked: PASS');
