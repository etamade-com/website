import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import worker, {analyticsEnabled} from '../dist/_worker.js';
import {PRIVACY,makeConsent,parseConsent,preferredLocale,languageSuggestion,safePage,sanitizeActivity,analyticsCookieNames} from '../src/privacy-model.mjs';
import {site} from '../src/site.config.mjs';
import {content} from '../src/content.mjs';
import {brandLogo} from '../src/brand.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const text=p=>readFile(join(root,p),'utf8');
const assets={async fetch(req){let p=join(root,'dist',new URL(req.url).pathname);try{if((await stat(p)).isDirectory())p=join(p,'index.html');return new Response(req.method==='HEAD'?null:await readFile(p));}catch{return new Response('',{status:404});}}};
const env={ASSETS:assets,ANALYTICS_ENABLED:'true',GA_MEASUREMENT_ID:'G-ETATEST001'};
const paths={en:content.en.paths,ro:content.ro.paths};
const titles={en:{home:content.en.title},ro:{home:content.ro.title}};
const get=(url,options={},vars=env)=>worker.fetch(new Request(url,options),vars);
for (const granted of [true,false]) test(`consent ${granted}: round trip preserves a minimal 180-day record`,()=>{
 const now=1000000000,record=makeConsent(granted,granted?'accept':'reject',now);
 assert.equal(record.expiresAt-now,180*86400000);assert.deepEqual(parseConsent(JSON.stringify(record),now),record);
 assert.equal(parseConsent(record,record.expiresAt),null);
 assert.equal(Object.keys(record).length,5);
});
for (const [label,mutate] of [
 ['old version',r=>({...r,version:'old'})],['future date',r=>({...r,decidedAt:r.decidedAt+1})],
 ['string boolean',r=>({...r,analytics:'true'})],['forged expiry',r=>({...r,expiresAt:r.expiresAt+1})],
 ['unrecognized method',r=>({...r,method:'scroll'})]
]) test('invalid consent fails closed: '+label,()=>{const now=1000000;assert.equal(parseConsent(mutate(makeConsent(true,'accept',now)),now),null);});
for (const value of [null,undefined,'bad JSON','{}',[],true]) test('absent/malformed consent: '+String(value),()=>assert.equal(parseConsent(value),null));
for (const [languages,fallback,expected] of [
 [['ro-RO','en-US'],'en-US','ro'],[['ro-MD'],'','ro'],[['en-GB'],'','en'],[['EN_us'],'','en'],
 [['fr-FR','en-US'],'en-US',null],[[],'ro','ro'],[[],'de-DE',null],[null,undefined,null]
]) test('primary browser language: '+JSON.stringify(languages),()=>assert.equal(preferredLocale(languages,fallback),expected));
for (const [host,preferred,result] of [
 ['etamade.com','ro','ro'],['etamade.ro','en','en'],['etamade.com','en',null],['etamade.ro','ro',null],
 ['localhost','ro',null],['etamade-website.pages.dev','ro',null],['evil-etamade.com','ro',null]
]) test('language suggestion '+host+'/'+preferred,()=>assert.equal(languageSuggestion(host,preferred,site.domains),result));
test('page analytics excludes query strings and fragments',()=>{
 const p=safePage('https://etamade.com/?email=private@example.com#private','en',site.domains,paths,titles);
 assert.equal(p.page_location,'https://etamade.com/');assert.equal(p.page_referrer,'');assert.ok(!JSON.stringify(p).includes('private'));
});
test('unknown personal URL path is replaced by generic 404',()=>assert.equal(safePage('https://etamade.ro/private@example.com','ro',site.domains,paths,titles).page_location,'https://etamade.ro/404/'));
test('hostname/locale mismatch is not accepted for analytics',()=>assert.equal(safePage('https://etamade.com/','ro',site.domains,paths,titles),null));
test('arbitrary third-party origin is not an analytics page',()=>assert.equal(safePage('https://example.com/','en',site.domains,paths,titles),null));
for (const name of ['page_view','contact_start','contact_submit','generate_lead']) test(name+' cannot carry personal fields',()=>assert.deepEqual(sanitizeActivity(name,{email:'secret',name:'secret',message:'secret',company:'secret',page_location:'evil'}),{name,params:{}}));
for (const [name,input,valid] of [
 ['select_service',{service:'web',email:'secret'},true],['select_service',{service:'private@example.com'},false],
 ['contact_error',{code:'network',message:'secret'},true],['contact_error',{code:'Email: secret'},false],
 ['scroll_depth',{percent:25},true],['scroll_depth',{percent:26},false],['faq_open',{question:4},true],['faq_open',{question:5},false],
 ['section_view',{section:'about'},true],['section_view',{section:'hidden-user'},false],['language_switch',{target_language:'ro'},true],
 ['outbound_click',{target:'github',url:'secret'},true],['outbound_click',{target:'private@example.com'},false],
 ['engagement_time',{engagement_time_msec:15000},true],['engagement_time',{engagement_time_msec:60001},false],['unknown',{foo:1},false]
]) test(`event allowlist ${name} ${JSON.stringify(input)}`,()=>{const v=sanitizeActivity(name,input);assert.equal(Boolean(v),valid);assert.ok(!JSON.stringify(v).includes('secret'));});
test('cookie cleanup targets GA names, not contact/security/application cookies',()=>assert.deepEqual(analyticsCookieNames('_ga=x; _ga_XYZ=y; cf_clearance=z; app_session=1; _garden=a'),['_ga','_ga_XYZ']));
for(const host of ['etamade.com','etamade.ro']) {
 test(host+' analytics requires explicit server enablement and valid ID',async()=>{
   const u='https://'+host+'/api/analytics-config';assert.equal((await (await get(u)).json()).enabled,true);
   for(const vars of [{},{...env,ANALYTICS_ENABLED:'false'},{...env,GA_MEASUREMENT_ID:''},{...env,GA_MEASUREMENT_ID:'G-XXXXXXXXXX'}]) assert.equal((await (await get(u,{},vars)).json()).enabled,false);
 });
 test(host+' analytics frame is private to same-origin embedding, not cacheable',async()=>{
  const r=await get('https://'+host+'/api/analytics-frame');assert.equal(r.status,200);
  assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-frame-options'),'SAMEORIGIN');
  assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'self'/);
  const html=await r.text();assert.ok(!html.includes('<script src="https:'));assert.match(html,/data-measurement-id="G-ETATEST001"/);
 });
 test(host+' page CSP blocks Google directly; only the consent-created frame can load it',async()=>{
  const r=await get('https://'+host+'/');const csp=r.headers.get('content-security-policy');assert.ok(!csp.includes('google'));assert.match(csp,/frame-src 'self'/);
 });
}
for(const host of ['localhost','etamade-website.pages.dev','abc.etamade-website.pages.dev']) test(host+' never enables analytics even with production configuration',async()=>{
 const r=await get('https://'+host+'/api/analytics-config');assert.equal((await r.json()).enabled,false);
 assert.equal((await get('https://'+host+'/api/analytics-frame')).status,503);
});
for(const path of ['/api/analytics-config','/api/analytics-frame']) test(path+' is GET/HEAD only',async()=>{
 assert.equal((await get('https://etamade.com'+path,{method:'POST'})).status,405);
 assert.equal(await (await get('https://etamade.com'+path,{method:'HEAD'})).text(),'');
});
test('cross-site frame request is rejected',async()=>assert.equal((await get('https://etamade.com/api/analytics-frame',{headers:{'sec-fetch-site':'cross-site'}})).status,403));
test('measurement ID cannot inject HTML',()=>assert.equal(analyticsEnabled({...env,GA_MEASUREMENT_ID:'G-ABCDEF"><script>'},false),false));
for(const lang of ['en','ro']) {
 test(lang+' consent UI is present on every page with optional analytics unchecked',async()=>{
  for(const page of ['index','privacy/index','legal/index','404/index']) {
   const html=await text(`dist/_site/${lang}/${page}.html`);assert.match(html,/id="consent-banner"/);assert.match(html,/id="privacy-dialog"/);
   assert.match(html,/class="consent-choice" data-consent-reject/);assert.match(html,/class="consent-choice" data-consent-accept/);
   assert.ok(!/id="analytics-consent"[^>]*checked/.test(html));assert.ok(html.includes(content[lang].consent.reject));
   assert.ok(!/src="https:\/\/(www\.)?google/.test(html));
  }
 });
 test(lang+' full wordmarks are SVG in header and footer',async()=>{
  const html=await text(`dist/_site/${lang}/index.html`);assert.equal((html.match(/class="brand-wordmark /g)||[]).length,2);
  assert.ok(!html.includes('<span>etamade</span>'));
 });
 test(lang+' privacy HTML and LLM content describe analytics, cookies and language preference',async()=>{
  for(const file of [`dist/_site/${lang}/privacy/index.html`,`dist/_site/${lang}/llms-full.txt`]) {
   const html=await text(file);for(const value of ['Google Analytics',PRIVACY.storageKey,PRIVACY.languageKey,'180','_ga']) assert.ok(html.includes(value));
   assert.ok(!html.includes('does not include advertising scripts, audience analytics'));
  }
 });
}
test('standalone SVG has dark mode; inline SVG retains exactly the same 8 outlines',async()=>{
 const logo=await text('public/logo.svg');assert.match(logo,/prefers-color-scheme:dark/);
 const paths=[...logo.matchAll(/<path[^>]*d="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(paths.length,8);for(const p of paths)assert.ok(brandLogo().includes(p));assert.ok(brandLogo().includes('fill="currentColor"'));
});
// Execute the ACTUAL built frame JS in a VM with fake DOM/network boundaries.
async function frameHarness(standalone=false) {
 const r=await get('https://etamade.com/api/analytics-frame');const html=await r.text();const path=html.match(/src="([^"]+)"/)[1];
 const scripts=[],messages=[],listeners={};
 const parent={postMessage:m=>messages.push(m)};
 const w={parent,addEventListener:(type,fn)=>listeners[type]=fn};if(standalone)w.parent=w;
 const context={window:w,document:{body:{dataset:{measurementId:'G-ETATEST001'}},head:{appendChild:el=>scripts.push(el)},createElement:()=>({})},location:new URL('https://etamade.com/api/analytics-frame'),URL,Date,Set,JSON,Object,Array,String,Number,Boolean,encodeURIComponent,setTimeout:()=>1,clearTimeout:()=>{}};
 vm.runInNewContext(await text('dist'+path),context);
 const send=(data,origin='https://etamade.com',source=parent)=>listeners.message?.({data,origin,source});
 return {w,scripts,messages,send};
}
test('standalone analytics endpoint script cannot load Google',async()=>{const h=await frameHarness(true);assert.equal(h.scripts.length,0);assert.equal(h.messages.length,0);});
test('frame rejects missing consent, wrong origin/source and malformed page',async()=>{
 const h=await frameHarness();const payload={type:'etamade:analytics:init',consent:makeConsent(true),page:safePage('https://etamade.com/','en',site.domains,paths,titles)};
 h.send({...payload,consent:makeConsent(false)});h.send(payload,'https://evil.example');h.send(payload,'https://etamade.com',{});h.send({...payload,page:{page_location:'https://evil.example',site_language:'en'}});
 assert.equal(h.scripts.length,0);
});
test('frame loads once after consent and applies privacy-limited GA config',async()=>{
 const h=await frameHarness();const payload={type:'etamade:analytics:init',consent:makeConsent(true),page:safePage('https://etamade.com/','en',site.domains,paths,titles)};
 h.send(payload);h.send(payload);assert.equal(h.scripts.length,1);assert.ok(h.scripts[0].src.includes('gtag/js?id=G-ETATEST001'));
 const commands=h.w.dataLayer.map(a=>Array.from(a));
 assert.equal(commands.find(a=>a[0]==='consent'&&a[1]==='default')[2].analytics_storage,'denied');
 assert.equal(commands.find(a=>a[0]==='consent'&&a[1]==='update')[2].ad_user_data,'denied');
 const config=commands.find(a=>a[0]==='config')[2];assert.equal(config.send_page_view,false);assert.equal(config.cookie_domain,'none');assert.equal(config.cookie_update,false);assert.equal(config.allow_google_signals,false);assert.equal(config.allow_ad_personalization_signals,false);assert.equal(config.cookie_expires,15552000);
 assert.equal(commands.filter(a=>a[0]==='event'&&a[1]==='page_view').length,1);
 h.send({type:'etamade:analytics:event',activity:{name:'generate_lead',params:{email:'private@example.com',message:'secret'}}});
 assert.ok(!JSON.stringify(h.w.dataLayer).includes('private@example.com'));
 h.w.etamadeStopAnalytics();assert.equal(h.w['ga-disable-G-ETATEST001'],true);assert.equal(h.w.dataLayer.length,0);
 h.send({type:'etamade:analytics:event',activity:{name:'page_view',params:{}}});assert.equal(h.w.dataLayer.length,0);
});
