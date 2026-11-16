const imageTypes=new Set(['image/jpeg','image/png','image/webp','image/avif']);

export function productGalleryPaths(product={},main=product?.image_path){
  const primary=String(main||product?.image_path||'').trim();
  const paths=Array.isArray(product?.image_paths)?product.image_paths:[];
  return [...new Set([primary,...paths.filter(path=>primary===product?.image_path||path!==product?.image_path)]
    .filter(path=>typeof path==='string'&&path.trim()).map(path=>path.trim()))];
}

export function galleryImageUrl(path,storageUrl){
  const value=String(path||'').trim();
  if(!value||/[\u0000-\u001f]/.test(value)||value.startsWith('//'))return '';
  if(/^[a-z][a-z\d+.-]*:/i.test(value)){
    try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}
  }
  return storageUrl(value);
}

export function mountProductGallery({form,host,storageUrl}){
  const grid=host.querySelector('[data-product-photo-grid]'),count=host.querySelector('#productGalleryCount');
  const empty=host.querySelector('[data-product-photo-empty]'),hint=host.querySelector('#productGalleryExisting');
  const viewer=document.createElement('dialog');viewer.id='productPhotoPreview';viewer.setAttribute('aria-labelledby','productPhotoPreviewTitle');
  viewer.innerHTML='<div class="product-photo-preview-header"><h3 id="productPhotoPreviewTitle"></h3><div class="product-photo-preview-controls"><button type="button" data-photo-previous aria-label="Попереднє фото">←</button><button type="button" data-photo-next aria-label="Наступне фото">→</button><button type="button" data-photo-close aria-label="Закрити перегляд фото">×</button></div></div><img alt=""><p data-photo-error hidden>Не вдалося завантажити фото.</p>';
  document.body.append(viewer);
  const large=viewer.querySelector('img'),error=viewer.querySelector('[data-photo-error]');
  const previous=viewer.querySelector('[data-photo-previous]'),next=viewer.querySelector('[data-photo-next]');
  let product=null,items=[],localUrls=[],index=0;
  function releaseLocal(){localUrls.forEach(url=>URL.revokeObjectURL(url));localUrls=[];}
  function showPhoto(position){
    index=position;const item=items[index];if(!item)return;
    viewer.querySelector('h3').textContent='Фото '+(index+1)+' із '+items.length+(item.pending?' · нове':'');
    large.hidden=false;error.hidden=true;large.alt='Фото '+(index+1)+' товару';large.src=item.url;
    previous.disabled=index===0;next.disabled=index===items.length-1;
  }
  large.onerror=()=>{large.hidden=true;error.hidden=false;};
  previous.onclick=()=>{if(index>0)showPhoto(index-1);};
  next.onclick=()=>{if(index<items.length-1)showPhoto(index+1);};
  viewer.querySelector('[data-photo-close]').onclick=()=>viewer.close();
  viewer.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'&&index>0){event.preventDefault();showPhoto(index-1);}if(event.key==='ArrowRight'&&index<items.length-1){event.preventDefault();showPhoto(index+1);}});
  function render(){
    if(viewer.open)viewer.close();releaseLocal();
    items=productGalleryPaths(product,form.elements.image_path.value).map(path=>({url:galleryImageUrl(path,storageUrl),pending:false})).filter(item=>item.url);
    for(const file of form.elements.image_files.files||[]){if(imageTypes.has(file.type)){const url=URL.createObjectURL(file);localUrls.push(url);items.push({url,pending:true});}}
    grid.replaceChildren();count.textContent=items.length+' фото';empty.hidden=items.length>0;
    const pending=items.filter(item=>item.pending).length;
    hint.textContent=pending?'Нових фото: '+pending+'. Додадуться після збереження.':'JPEG, PNG або WebP. Можна вибрати кілька файлів.';
    items.forEach((item,position)=>{
      const button=document.createElement('button');button.type='button';button.className='product-photo-tile'+(position===0?' is-main':'');
      button.setAttribute('aria-label','Відкрити фото '+(position+1)+(position===0?' — головне':''));
      const image=document.createElement('img');image.src=item.url;image.alt='';image.loading='lazy';
      const fallback=document.createElement('span');fallback.className='product-photo-fallback';fallback.textContent='Фото '+(position+1);fallback.hidden=true;
      image.onerror=()=>{image.hidden=true;fallback.hidden=false;};button.append(image,fallback);
      if(position===0||item.pending){const badge=document.createElement('span');badge.className='product-photo-badge';badge.textContent=position===0?'Головне'+(item.pending?' · нове':''):'Нове';button.append(badge);}
      button.onclick=()=>{showPhoto(position);viewer.showModal();};grid.append(button);
    });
  }
  form.elements.image_files.addEventListener('change',render);
  form.elements.image_path.addEventListener('change',render);
  form.closest('dialog').addEventListener('close',()=>{if(viewer.open)viewer.close();releaseLocal();grid.replaceChildren();items=[];});
  return {setProduct(value){product=value||{};render();}};
}
