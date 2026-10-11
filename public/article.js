import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {renderArticleContent,safeArticleUrl} from './article-format.js?v=20261011-editor';
const supabase=createClient(window.TECHNOROOM_SUPABASE.url,window.TECHNOROOM_SUPABASE.publishableKey);
const esc=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const root=document.querySelector('#articleView'),slug=new URLSearchParams(location.search).get('slug');
const articlesBackLink=document.createElement('a');
articlesBackLink.href='articles.html';
articlesBackLink.textContent='← Усі статті та новини';
articlesBackLink.style.cssText='display:inline-block;margin:0 0 24px;color:#0875e9;font-weight:700';
root.before(articlesBackLink);
if(!slug){root.textContent='Статтю не вказано.'}else{const {data,error}=await supabase.from('articles').select('*').eq('slug',slug).eq('is_published',true).maybeSingle();if(error||!data){root.textContent='Статтю не знайдено або вона ще не опублікована.'}else{document.title=data.title+' — TECHNOROOM';root.className='';const cover=safeArticleUrl(data.image_url,{image:true});root.innerHTML='<h1>'+esc(data.title)+'</h1>'+(data.excerpt?'<p class="article-excerpt">'+esc(data.excerpt)+'</p>':'')+(cover?'<img src="'+esc(cover)+'" alt="'+esc(data.title)+'">':'')+'<div class="article-content article-rich-content">'+renderArticleContent(data.content)+'</div>'}}
