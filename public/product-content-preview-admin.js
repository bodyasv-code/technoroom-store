import {contentPreviewMarkup} from './product-content-preview.js?v=20261025-expanded';
export function mountProductContentPreview({root=document,client}={}){
  const host=root.querySelector('#ercCatalogApi');if(!host||root.querySelector('#productContentPreview'))return;
  const panel=root.createElement('section');panel.id='productContentPreview';
  panel.innerHTML='<h3>Контент товару: порівняння з Icecat</h3><p>Наявна картка залишається без змін. Джерело кожного поля й розбіжності показуються окремо. Демодоступ вимкнено; потрібен власний доступ Icecat. Кнопки збереження тут немає.</p><div class="admin-controls"><label>Код товару на сайті <input type="number" min="1" step="1" id="contentPreviewProductId" placeholder="Напр. 4331"></label><button type="button" class="button outline" data-content-status>Перевірити налаштування контенту</button><button type="button" class="button outline" data-content-preview>Порівняти без збереження</button></div><p role="status" aria-live="polite" data-content-message></p><div data-content-result></div>';
  host.append(panel);
  const message=panel.querySelector('[data-content-message]'),result=panel.querySelector('[data-content-result]'),buttons=[...panel.querySelectorAll('button')];
  let pending=false;
  const request=async(action)=>{
    if(pending)return;
    const productId=Number(panel.querySelector('input').value);
    if(action==='preview'&&(!Number.isSafeInteger(productId)||productId<=0)){message.textContent='Вкажіть числовий код товару на сайті.';return;}
    pending=true;buttons.forEach(b=>b.disabled=true);result.replaceChildren();message.textContent='Перевіряю…';
    try{
      const {data:{session}}=await client.auth.getSession();if(!session?.access_token)throw new Error('Увійдіть в адмінку повторно.');
      const response=await fetch('/api/erc-catalog',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'content-'+action,...(action==='preview'?{productId}:{})}),signal:AbortSignal.timeout(25000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Не вдалося перевірити контент.');
      if(action==='status')message.textContent=data.configured?'Серверні параметри задані. Працездатність доступу перевіряється запитом конкретного товару.':'Власний доступ Icecat на сервері не налаштований. Демодоступ не використовується.';
      else{message.textContent='Перегляд отримано. Жодних змін у каталозі.';result.innerHTML=contentPreviewMarkup(data.preview);}
    }catch(error){message.textContent=error.name==='TimeoutError'?'Час перевірки вичерпано. Каталог не змінено.':error.message;}
    finally{pending=false;buttons.forEach(b=>b.disabled=false);}
  };
  panel.querySelector('[data-content-status]').onclick=()=>request('status');
  panel.querySelector('[data-content-preview]').onclick=()=>request('preview');
}
