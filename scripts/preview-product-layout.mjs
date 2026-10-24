// Read-only local storefront preview; never accepts POST requests or loads analytics.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const base=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
createServer(async(req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/mobile-preview'){
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end('<!doctype html><html lang="uk"><meta charset="UTF-8"><title>Картка товару · мобільна перевірка</title><body style="margin:16px;background:#e2e8f0;font-family:Arial"><p>Локальний перегляд · 390 × 844</p><iframe title="Картка товару 390px" src="/product.html?id=439" style="width:390px;height:844px;border:1px solid #cbd5e1;background:white"></iframe></body></html>');return;
    }
    if(url.pathname==='/api/product-image'&&/^\d+$/.test(url.searchParams.get('id')||'')){
      res.writeHead(302,{Location:'https://www.technoroom.com.ua/api/product-image?id='+url.searchParams.get('id')}).end();return;
    }
    let pathname=decodeURIComponent(url.pathname);
    if(pathname==='/')pathname='/product.html';
    if(!extname(pathname))pathname+='.html';
    const path=resolve(base,'.'+pathname);
    if(!path.startsWith(base+sep)){res.writeHead(403).end();return;}
    let body=await readFile(path);
    if(extname(path)==='.html')body=Buffer.from(body.toString().replace(/<script type="module" src="store-analytics\.js[^>]*><\/script>/g,''));
    res.setHeader('Content-Type',(types[extname(path)]||'application/octet-stream')+'; charset=utf-8');
    res.setHeader('Cache-Control','no-store');res.end(body);
  }catch{res.writeHead(404).end('Not found');}
}).listen(4182,'127.0.0.1',()=>console.log('Read-only product preview: http://127.0.0.1:4182/product.html?id=439'));
