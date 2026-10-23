// Local, data-free UI fixture. Does not load admin.js, Supabase or real orders.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {sidebarGroups} from '../public/admin-sidebar.js';
const base=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const source=await readFile(resolve(base,'admin.html'),'utf8');
const aside=source.match(/<aside class="admin-nav">[\s\S]*?<\/aside>/)[0];
const inline=[...source.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match=>'<style>'+match[1]+'</style>').join('');
const labels={supplierImport:'Імпорт ERC / ASBIS',supplierRegistry:'Постачальники / виключення',ercCatalogApi:'ERC API',adminUsers:'Користувачі адмінки'};
const html='<!doctype html><html lang="uk"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css">'+inline+'<link rel="stylesheet" href="/admin-modern.css"><title>Попередній перегляд адмінки</title></head><body class="admin-body admin-modern"><div class="admin-shell">'+aside+'<main class="admin-main"><header class="admin-top"><div><p class="eyebrow">Попередній перегляд · без реальних даних</p><h1>Керування магазином</h1></div><button class="button primary">+ Додати товар</button></header>'+sidebarGroups.flatMap(g=>g.ids).map(id=>'<section id="'+id+'" class="admin-section"><div class="admin-title"><div><h2>'+(labels[id]||({overview:'Огляд',reports:'Звіти',quality:'Потребують уваги',products:'Товари',categories:'Категорії',brands:'Бренди',orders:'Замовлення',customers:'Клієнти',promotions:'Акції',banners:'Банери',articles:'Статті'})[id])+'</h2><span>Локальний перегляд оновленої навігації</span></div></div><div class="admin-metrics"><article><span>Навігація</span><strong>4 групи</strong><small>Розділи згруповано за завданнями</small></article><article><span>Швидкий доступ</span><strong>15 розділів</strong><small>Усі звичні інструменти збережено</small></article></div></section>').join('')+'</main></div><script type="module">import {mountAdminNavigation} from "/admin-navigation.js";import {mountAdminSidebar} from "/admin-sidebar.js";const nav=document.querySelector(".admin-nav");for(const [id,label] of Object.entries('+JSON.stringify(labels)+')){const a=document.createElement("a");a.href="#"+id;a.textContent=label;nav.append(a)}mountAdminNavigation();mountAdminSidebar();</script></body></html>';
const types={'.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/mobile-preview'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<!doctype html><html lang="uk"><meta charset="UTF-8"><title>Мобільна перевірка · 390px</title><body style="margin:24px;background:#e2e8f0;font-family:Arial"><p>Локальний перегляд · ширина 390px · без реальних даних</p><iframe title="Мобільна адмінка" src="/preview#orders" style="width:390px;height:844px;border:1px solid #cbd5e1;border-radius:12px;background:white"></iframe></body></html>');return;
  }
  if(pathname==='/preview'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return}
  const path=resolve(base,'.'+decodeURIComponent(pathname));
  if(!path.startsWith(base+sep)){res.writeHead(403).end();return}
  res.setHeader('Content-Type',(types[extname(path)]||'text/plain')+'; charset=utf-8');res.end(await readFile(path));
}catch{res.writeHead(404).end('Not found')}}).listen(4173,'127.0.0.1',()=>console.log('Data-free admin preview: http://127.0.0.1:4173/preview#orders'));
