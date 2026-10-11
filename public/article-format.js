const marker='<!--technoroom-rich-text:v1-->';
const tags=new Set(['P','DIV','BR','H2','H3','STRONG','B','EM','I','U','S','UL','OL','LI','BLOCKQUOTE','A','IMG','HR']);
const discard=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','TEMPLATE','FORM','INPUT','BUTTON','TEXTAREA','SELECT']);

export function safeArticleUrl(value,{image=false}={}){
  const raw=String(value||'').trim();
  if(!raw)return '';
  try{const url=new URL(raw,location.href);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return '';if(image&&raw.startsWith('#'))return '';return url.href}catch{return ''}
}

// Rebuild an allowlisted tree: never publish pasted scripts, event handlers or styles.
export function sanitizeArticleHtml(value){
  const source=new DOMParser().parseFromString(String(value||''),'text/html');
  const output=document.createElement('div');
  function append(node,parent){
    if(node.nodeType===3){parent.append(document.createTextNode(node.textContent));return}
    if(node.nodeType!==1||discard.has(node.tagName))return;
    if(!tags.has(node.tagName)){for(const child of node.childNodes)append(child,parent);return}
    const clean=document.createElement(node.tagName.toLowerCase());
    if(node.tagName==='A'){
      const href=safeArticleUrl(node.getAttribute('href'));
      if(href){clean.setAttribute('href',href);clean.setAttribute('rel','noopener noreferrer')}
    }
    if(node.tagName==='IMG'){
      const src=safeArticleUrl(node.getAttribute('src'),{image:true});
      if(!src)return;
      clean.setAttribute('src',src);clean.setAttribute('alt',node.getAttribute('alt')||'');clean.setAttribute('loading','lazy');
    }
    if(['P','DIV','H2','H3','LI','BLOCKQUOTE'].includes(node.tagName)){
      const align=node.style.textAlign||node.getAttribute('align');
      if(['left','center','right','justify'].includes(align))clean.style.textAlign=align;
    }
    for(const child of node.childNodes)append(child,clean);
    parent.append(clean);
  }
  for(const node of source.body.childNodes)append(node,output);
  return output.innerHTML;
}

export function plainTextToHtml(value){
  return String(value||'').split(/\n\s*\n/).map(part=>{
    const p=document.createElement('p');
    part.split('\n').forEach((line,index)=>{if(index)p.append(document.createElement('br'));p.append(document.createTextNode(line))});
    return p.outerHTML;
  }).join('');
}
export function renderArticleContent(value){
  const content=String(value||'');
  const root=document.createElement('div');
  root.innerHTML=content.startsWith(marker)?sanitizeArticleHtml(content.slice(marker.length)):plainTextToHtml(content);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())if(!walker.currentNode.parentElement.closest('a'))nodes.push(walker.currentNode);
  for(const node of nodes){
    const text=node.textContent,fragment=document.createDocumentFragment();let offset=0;
    for(const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)){
      let address=match[0].replace(/[.,!?;:]+$/,'');
      // Keep balanced parentheses in URLs, but not surrounding sentence punctuation.
      while(address.endsWith(')')&&(address.match(/\)/g)||[]).length>(address.match(/\(/g)||[]).length)address=address.slice(0,-1);
      const href=safeArticleUrl(address);if(!href)continue;
      fragment.append(document.createTextNode(text.slice(offset,match.index)));
      const link=document.createElement('a');link.href=href;link.textContent=address;link.target='_blank';link.rel='noopener noreferrer';fragment.append(link);
      offset=match.index+address.length;
    }
    if(offset){fragment.append(document.createTextNode(text.slice(offset)));node.replaceWith(fragment)}
  }
  return root.innerHTML;
}
export function serializeArticleContent(html){return marker+sanitizeArticleHtml(html)}
export function articleHasContent(value){
  const fragment=document.createElement('div');fragment.innerHTML=renderArticleContent(value);
  return Boolean(fragment.textContent.replace(/\u00a0/g,' ').trim()||fragment.querySelector('img'));
}
