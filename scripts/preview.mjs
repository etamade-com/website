/** Dependency-free local preview, using the actual built Pages Worker routing.
 * This emulates static asset fetches, not the Cloudflare platform. Email disabled.
 */
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {join,resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from '../dist/_worker.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.PORT||8788);
const mime={'.svg':'image/svg+xml','.css':'text/css','.js':'text/javascript','.png':'image/png','.html':'text/html','.txt':'text/plain','.md':'text/markdown','.json':'application/json','.xml':'application/xml'};
const env={CONTACT_ENABLED:'false',TURNSTILE_SITE_KEY:'',ASSETS:{async fetch(request){
  let p;try{p=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Not found',{status:404});}
  let file=resolve(root,'.'+p);
  if(!file.startsWith(root+'/'))return new Response('Not found',{status:404});
  try{if((await stat(file)).isDirectory())file=join(file,'index.html');const data=await readFile(file);return new Response(request.method==='HEAD'?null:data,{headers:{'Content-Type':mime[extname(file)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}
}}};
const server=createServer(async(req,res)=>{
  try{
    const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
    const request=new Request(`http://${req.headers.host||`localhost:${port}`}${req.url}`,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
    const response=await worker.fetch(request,env);
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Local preview error');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Preview (email disabled): http://localhost:${port}/ | Romanian: http://localhost:${port}/?lang=ro`));
