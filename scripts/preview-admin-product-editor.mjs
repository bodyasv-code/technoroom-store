// Local, read-only UI fixture. Never serves repository credentials or accepts writes.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),publicRoot=resolve(root,'public');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
createServer(async(request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405).end();return;}
  try{
    const path=new URL(request.url,'http://127.0.0.1').pathname;
    let file;
    if(path==='/')file=resolve(root,'tests/admin-product-editor-preview.html');
    else if(path.startsWith('/public/')){file=resolve(publicRoot,decodeURIComponent(path.slice(8)));if(!file.startsWith(publicRoot+sep))throw Error('outside public');}
    else{response.writeHead(404).end();return;}
    const body=await readFile(file);response.setHeader('Content-Type',(types[extname(file)]||'application/octet-stream')+'; charset=utf-8');response.setHeader('Cache-Control','no-store');response.end(body);
  }catch{response.writeHead(404).end();}
}).listen(4186,'127.0.0.1',()=>console.log('Read-only editor preview: http://127.0.0.1:4186/'));
