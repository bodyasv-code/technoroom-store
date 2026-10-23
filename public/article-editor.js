import {renderArticleContent,serializeArticleContent,sanitizeArticleHtml,plainTextToHtml,safeArticleUrl} from './article-format.js?v=20261011-article-links';

export function createArticleEditor(textarea,{uploadImage,label='Текст статті',placeholder='Напишіть текст статті…'}={}){
  if(textarea.parentElement.tagName==='LABEL'){
    const field=document.createElement('div');field.className='article-editor-field';
    const fieldLabel=document.createElement('div');fieldLabel.className='article-editor-label';fieldLabel.textContent=label;
    textarea.parentElement.replaceWith(field);field.append(fieldLabel,textarea);
  }
  textarea.hidden=true;textarea.required=false;
  const shell=document.createElement('div');shell.className='article-editor';
  shell.innerHTML=`<div class="article-editor-toolbar" role="toolbar" aria-label="Форматування тексту">
    <select aria-label="Стиль абзацу"><option value="p">Абзац</option><option value="h2">Заголовок 2</option><option value="h3">Заголовок 3</option><option value="blockquote">Цитата</option></select>
    <button type="button" data-command="bold" title="Жирний (Ctrl+B)" aria-label="Жирний"><b>B</b></button>
    <button type="button" data-command="italic" title="Курсив (Ctrl+I)" aria-label="Курсив"><i>I</i></button>
    <button type="button" data-command="underline" title="Підкреслений" aria-label="Підкреслений"><u>U</u></button>
    <button type="button" data-command="insertUnorderedList" aria-label="Маркований список">• Список</button>
    <button type="button" data-command="insertOrderedList" aria-label="Нумерований список">1. Список</button>
    <button type="button" data-command="justifyLeft" aria-label="Вирівняти ліворуч">Ліворуч</button>
    <button type="button" data-command="justifyCenter" aria-label="Вирівняти по центру">По центру</button>
    <button type="button" data-action="link">Посилання</button><button type="button" data-command="unlink">Без посилання</button>
    <button type="button" data-action="image">Зображення</button><button type="button" data-command="removeFormat">Очистити формат</button>
    <button type="button" data-command="undo" aria-label="Скасувати останню дію">↶</button><button type="button" data-command="redo" aria-label="Повторити дію">↷</button>
    <button type="button" data-action="preview" aria-pressed="false">Попередній перегляд</button>
  </div><div class="article-editor-body article-rich-content" contenteditable="true" role="textbox" aria-label="Текст статті" aria-multiline="true" data-placeholder="Напишіть текст статті…"></div>
  <div class="article-editor-preview article-rich-content" hidden></div><p class="article-editor-status" role="status"></p>
  <input type="file" class="article-editor-file" accept="image/jpeg,image/png,image/webp,image/avif" hidden>`;
  textarea.after(shell);
  const body=shell.querySelector('.article-editor-body'),preview=shell.querySelector('.article-editor-preview'),status=shell.querySelector('.article-editor-status');
  body.setAttribute('aria-label',label);body.dataset.placeholder=placeholder;
  let bookmark=null,pending=false,version=0;
  function remember(){const selection=window.getSelection();if(selection.rangeCount&&body.contains(selection.anchorNode)&&body.contains(selection.focusNode))bookmark=selection.getRangeAt(0).cloneRange()}
  function restore(){body.focus();const selection=window.getSelection();selection.removeAllRanges();if(bookmark&&body.contains(bookmark.commonAncestorContainer)){selection.addRange(bookmark)}else{const range=document.createRange();range.selectNodeContents(body);range.collapse(false);selection.addRange(range)}}
  function sync(){textarea.value=serializeArticleContent(body.innerHTML);remember()}
  function command(name,value=null){restore();document.execCommand(name,false,value);sync()}
  body.addEventListener('keyup',remember);body.addEventListener('mouseup',remember);body.addEventListener('blur',remember);body.addEventListener('input',sync);
  body.addEventListener('paste',event=>{
    event.preventDefault();remember();
    const html=event.clipboardData.getData('text/html');
    command('insertHTML',html?sanitizeArticleHtml(html):plainTextToHtml(event.clipboardData.getData('text/plain')));
  });
  // Do not accept unsanitized dragged HTML or embedded local files.
  body.addEventListener('drop',event=>{event.preventDefault();status.textContent='Для фото скористайтеся кнопкою «Зображення».'});
  shell.querySelectorAll('[data-command]').forEach(button=>{
    button.addEventListener('mousedown',event=>event.preventDefault());
    button.onclick=()=>command(button.dataset.command);
  });
  shell.querySelector('select').onchange=event=>command('formatBlock',event.target.value);
  shell.querySelector('[data-action="link"]').onclick=()=>{
    const value=prompt('Введіть адресу посилання (https://…):');if(value===null)return;
    const href=safeArticleUrl(value);if(!href){status.textContent='Вкажіть коректну HTTP/HTTPS адресу.';return}
    restore();const selection=window.getSelection();
    if(selection.isCollapsed){const a=document.createElement('a');a.href=href;a.textContent=value;command('insertHTML',a.outerHTML)}else command('createLink',href);
    status.textContent='';
  };
  const fileInput=shell.querySelector('.article-editor-file');
  shell.querySelector('[data-action="image"]').onclick=()=>{if(!pending)fileInput.click()};
  fileInput.onchange=async()=>{
    const file=fileInput.files?.[0];if(!file)return;
    const uploadVersion=version;pending=true;status.textContent='Завантажую зображення…';
    try{const url=safeArticleUrl(await uploadImage(file),{image:true});if(uploadVersion!==version)return;if(!url)throw new Error('Неправильна адреса зображення');const img=document.createElement('img');img.src=url;img.alt=prompt('Опис зображення (для доступності):',file.name)||'';command('insertHTML',img.outerHTML+'<p><br></p>');status.textContent='Зображення додано.'}catch(error){if(uploadVersion===version)status.textContent='Не вдалося додати фото: '+error.message}finally{pending=false;fileInput.value=''}
  };
  const previewButton=shell.querySelector('[data-action="preview"]');
  previewButton.onclick=()=>{
    const show=preview.hidden;sync();preview.innerHTML=renderArticleContent(textarea.value);preview.hidden=!show;body.hidden=show;previewButton.setAttribute('aria-pressed',String(show));
    shell.querySelectorAll('button:not([data-action="preview"]),select').forEach(control=>control.disabled=show);
    previewButton.textContent=show?'Повернутися до редагування':'Попередній перегляд';
  };
  return {
    setValue(value){version++;body.innerHTML=renderArticleContent(value);bookmark=null;body.hidden=false;preview.hidden=true;previewButton.setAttribute('aria-pressed','false');previewButton.textContent='Попередній перегляд';shell.querySelectorAll('button,select').forEach(control=>control.disabled=false);status.textContent='';sync()},
    getValue(){sync();return textarea.value},
    isUploading(){return pending},
  };
}
