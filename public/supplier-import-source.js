const partsAt=value=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(value).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
export function kyivSourceDate(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value||'');
  if(!match)throw new Error('Вкажіть дату й час формування прайсу за Києвом.');
  const [year,month,day,hour,minute,second]=match.slice(1).map(Number);const target=Date.UTC(year,month-1,day,hour,minute,second||0);
  let candidate=target;
  for(let i=0;i<3;i++){const p=partsAt(new Date(candidate));candidate+=target-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);}
  const p=partsAt(new Date(candidate));
  if([p.year,p.month,p.day,p.hour,p.minute,p.second].join()!==[year,month,day,hour,minute,second||0].join())throw new Error('Некоректна дата або час прайсу.');
  return new Date(candidate).toISOString();
}
export function sourceDateFromName(name=''){
  const match=/(?:^|[^\d])(20\d{2})-(\d{2})-(\d{2})[ T_](\d{2})[_:.-](\d{2})[_:.-](\d{2})(?!\d)/.exec(name);
  if(!match)return '';
  const local=match.slice(1,4).join('-')+'T'+match.slice(4).join(':');
  try{kyivSourceDate(local);return local;}catch{return '';}
}
export async function sourceDigest(value){
  const bytes=typeof value==='string'?new TextEncoder().encode(value):value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function sourceFactsFor(row,current,options={}){
  const facts={};
  if((!current||options.price!==false)&&row.hasPrice&&Number.isFinite(Number(row.price))&&Number(row.price)>0)facts.price=Number(row.price);
  if((!current||options.stock!==false)&&row.hasStock&&Number.isSafeInteger(Number(row.stock))&&Number(row.stock)>=0)facts.stock={quantity:Number(row.stock),status:row.availabilityStatus||(row.stock>0?'in_stock':'out_of_stock')};
  return facts;
}
export function mountImportSource(anchor,{supplier,onChange=()=>{}}){
  const box=document.createElement('div');box.className='import-report';
  const label=document.createElement('label');label.textContent='Дата й час прайсу '+supplier+' (Київ) ';
  const input=document.createElement('input');input.type='datetime-local';input.step='1';input.dataset.sourceDate='';label.append(input);
  const help=document.createElement('p');help.className='recovery-help';help.textContent='Вкажіть дату формування джерела. Час завантаження файлу не робить прайс новішим.';box.append(label,help);anchor.after(box);
  let hash='',name='',primary=null,generation=0,currentSupplier=supplier;
  input.addEventListener('change',onChange);
  return {
    invalidate(){hash='';generation++;},
    async setFiles(files,nextSupplier=supplier){
      const token=++generation;hash='';currentSupplier=nextSupplier;name=(files[0]?.file.name||'').slice(0,240);
      if(primary!==files[0]?.file){primary=files[0]?.file;input.value=sourceDateFromName(name);}
      const fingerprints=[];
      for(const {role,file}of [...files].sort((a,b)=>a.role.localeCompare(b.role))){fingerprints.push([role,await sourceDigest(await file.arrayBuffer())]);}
      const value=await sourceDigest(JSON.stringify(fingerprints));if(token!==generation)return;hash=value;
      help.textContent=input.value?'Дата взята з назви файлу — перевірте її перед імпортом. Повторно оброблені рядки будуть пропущені.':'Дата не визначена. Вкажіть час формування прайсу перед записом. Дата зміни файлу на комп’ютері не використовується.';
    },
    async setApi(payload,receivedAt,files=[]){
      const token=++generation;hash='';currentSupplier='ERC';primary=null;name='ERC API';
      const time=new Date(receivedAt);if(!Number.isFinite(time.getTime()))throw new Error('ERC API не вказав час отримання даних. Повторіть завантаження.');
      const p=partsAt(time);input.value=p.year+'-'+String(p.month).padStart(2,'0')+'-'+String(p.day).padStart(2,'0')+'T'+[p.hour,p.minute,p.second].map(n=>String(n).padStart(2,'0')).join(':');
      const extras=[];for(const {role,file}of files)extras.push([role,await sourceDigest(await file.arrayBuffer())]);
      const value=await sourceDigest(JSON.stringify({payload,receivedAt,extras}));if(token!==generation)return;hash=value;
      help.textContent='Для прямого запиту ERC API використано час отримання відповіді. Для файлу потрібна дата його формування.';
    },
    get(){
      if(!hash)throw new Error('Спочатку дочекайтеся читання всіх файлів прайсу.');
      const observedAt=kyivSourceDate(input.value);
      if(Date.parse(observedAt)>Date.now()||Date.parse(observedAt)<Date.UTC(2000,0,1))throw new Error('Дата прайсу не може бути в майбутньому або раніше 2000 року.');
      return {supplier:currentSupplier,hash,observedAt,name};
    },input,
  };
}
