import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleContact, validEmail, privateKey, readLimitedJson} from '../workers/contact/src/index.js';
const payload={name:'Alex Popescu',email:'alex@example.org',company:'Example',service:'web',message:'Please help us improve our existing web application.',website:'',privacyAcknowledged:true,turnstileToken:'valid-test-token',locale:'en'};
function env(overrides={}){const sent=[];return {sent,CONTACT_ENABLED:'true',CONTACT_FROM:'website@forms.etamade.com',CONTACT_TO:'contact@etamade.com',ALLOWED_ORIGINS:'https://etamade.com,https://etamade.ro',TURNSTILE_SECRET_KEY:'not-a-real-secret-just-a-unit-test-value',RATE_LIMIT_SALT:'unit-test-salt-not-a-real-secret-123456789',IP_LIMITER:{limit:async()=>({success:true})},EMAIL_LIMITER:{limit:async()=>({success:true})},EMAIL:{send:async message=>{sent.push(message);return{messageId:'test-message-id'};}},...overrides};}
function request(data=payload,options={}){const url=options.url||'https://etamade.com/api/contact';return new Request(url,{method:options.method||'POST',headers:{'Content-Type':'application/json',Origin:new URL(url).origin,'X-ETAMADE-Client-IP':'192.0.2.10',...options.headers},...((options.method||'POST')==='POST'?{body:options.body??JSON.stringify(data)}:{})});}
const verifier=(result={success:true,hostname:'etamade.com',action:'contact'})=>({verifyFetch:async()=>new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}})});
async function expectFailure(data,status,code,environment=env(),options={}){const result=await handleContact(request(data,options),environment,verifier());assert.equal(result.status,status);assert.equal((await result.json()).code,code);assert.equal(environment.sent.length,0);}
test('valid English enquiry is awaited and sent to the fixed destination',async()=>{const e=env();const response=await handleContact(request(),e,verifier());assert.equal(response.status,200);const result=await response.json();assert.equal(result.ok,true);assert.match(result.reference,/^[a-f0-9-]{36}$/);assert.equal(e.sent.length,1);assert.equal(e.sent[0].to,'contact@etamade.com');assert.equal(e.sent[0].from.email,e.CONTACT_FROM);assert.equal(e.sent[0].replyTo.email,payload.email);assert.ok(e.sent[0].text.includes(payload.message));assert.ok(!e.sent[0].text.includes('192.0.2.10'));assert.ok(!e.sent[0].text.includes(payload.turnstileToken));assert.ok(!response.headers.has('Access-Control-Allow-Origin'));});
test('Romanian host validates Romanian locale and hostname',async()=>{const e=env();const response=await handleContact(request({...payload,locale:'ro',name:'\u0218tefan Popescu'},{url:'https://etamade.ro/api/contact'}),e,verifier({success:true,hostname:'etamade.ro',action:'contact'}));assert.equal(response.status,200);assert.ok(e.sent[0].text.includes('Language: ro'));});
for(const [label,patch]of [
  ['short name',{name:'A'}],['long name',{name:'A'.repeat(101)}],['missing name',{name:null}],
  ['invalid email',{email:'bad@'}],['header injection in email',{email:'test@example.org\r\nBcc: bad@example.org'}],
  ['header injection in name',{name:'Good\r\nBcc: bad@example.org'}],['long company',{company:'a'.repeat(121)}],
  ['short message',{message:'short'}],['long message',{message:'a'.repeat(5001)}],['non-string message',{message:{x:1}}],
  ['nul in message',{message:'bad\u0000'.repeat(10)}],['honeypot filled',{website:'https://spam.example'}],
  ['no acknowledgement',{privacyAcknowledged:false}],['string acknowledgement',{privacyAcknowledged:'true'}],
  ['no token',{turnstileToken:''}],['oversized token',{turnstileToken:'a'.repeat(2049)}],
  ['unsupported service',{service:'injected'}],['invalid locale',{locale:'fr'}],['wrong host locale',{locale:'ro'}],
  ['arbitrary recipient',{to:'attacker@example.org'}]
])test(`rejects ${label}`,()=>expectFailure({...payload,...patch},400,'invalid'));
for(const [label,result]of [
  ['failed token',{success:false}],['wrong hostname',{success:true,hostname:'attacker.example',action:'contact'}],
  ['wrong action',{success:true,hostname:'etamade.com',action:'login'}],['absent hostname',{success:true,action:'contact'}],
  ['nonboolean success',{success:'true',hostname:'etamade.com',action:'contact'}]
])test(`rejects Turnstile ${label}`,async()=>{const e=env();const r=await handleContact(request(),e,verifier(result));assert.equal(r.status,400);assert.equal((await r.json()).code,'turnstile');assert.equal(e.sent.length,0);});
test('fails closed on verification outage',async()=>{const e=env();const r=await handleContact(request(),e,{verifyFetch:async()=>{throw new Error('offline');}});assert.equal(r.status,503);assert.equal(e.sent.length,0);});
test('fails closed on verification HTTP error',async()=>{const e=env();const r=await handleContact(request(),e,{verifyFetch:async()=>new Response('',{status:502})});assert.equal(r.status,503);assert.equal(e.sent.length,0);});
test('verifier receives token, IP and idempotency key server-side',async()=>{const e=env();let params;const r=await handleContact(request(),e,{verifyFetch:async(url,init)=>{assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');params=JSON.parse(init.body);return new Response(JSON.stringify({success:true,hostname:'etamade.com',action:'contact'}));}});assert.equal(r.status,200);assert.equal(params.response,payload.turnstileToken);assert.equal(params.secret,e.TURNSTILE_SECRET_KEY);assert.equal(params.remoteip,'192.0.2.10');assert.match(params.idempotency_key,/^[a-f0-9-]{36}$/);});
test('rejects a reused token when Siteverify rejects the second use',async()=>{const e=env();let n=0;const deps={verifyFetch:async()=>new Response(JSON.stringify(++n===1?{success:true,hostname:'etamade.com',action:'contact'}:{success:false,'error-codes':['timeout-or-duplicate']}))};assert.equal((await handleContact(request(),e,deps)).status,200);assert.equal((await handleContact(request(),e,deps)).status,400);assert.equal(e.sent.length,1);});
test('blocks a foreign origin',()=>expectFailure(payload,403,'blocked',env(),{headers:{Origin:'https://attacker.example'}}));
test('blocks null origin',()=>expectFailure(payload,403,'blocked',env(),{headers:{Origin:'null'}}));
test('blocks missing origin',async()=>{const req=request();req.headers.delete('origin');const e=env();assert.equal((await handleContact(req,e,verifier())).status,403);assert.equal(e.sent.length,0);});
test('blocks missing trusted IP',()=>expectFailure(payload,403,'blocked',env(),{headers:{'X-ETAMADE-Client-IP':''}}));
test('blocks plain HTTP',()=>expectFailure(payload,403,'blocked',env(),{url:'http://etamade.com/api/contact'}));
test('blocks foreign host even with matching Origin',()=>expectFailure(payload,403,'blocked',env(),{url:'https://attacker.example/api/contact'}));
test('blocks cross-site fetch metadata',()=>expectFailure(payload,403,'blocked',env(),{headers:{'Sec-Fetch-Site':'cross-site'}}));
test('GET cannot send email',()=>expectFailure(payload,405,'invalid',env(),{method:'GET'}));
test('wrong endpoint cannot send email',()=>expectFailure(payload,404,'invalid',env(),{url:'https://etamade.com/api/other'}));
test('form can be disabled',()=>expectFailure(payload,503,'unavailable',env({CONTACT_ENABLED:'false'})));
for(const field of ['TURNSTILE_SECRET_KEY','RATE_LIMIT_SALT','EMAIL','IP_LIMITER','EMAIL_LIMITER'])test(`missing ${field} fails closed`,()=>expectFailure(payload,503,'unavailable',env({[field]:undefined})));
test('known Turnstile test secret cannot enable production',()=>expectFailure(payload,503,'unavailable',env({TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA'})));
test('IP rate limit blocks before verification',async()=>{const e=env({IP_LIMITER:{limit:async()=>({success:false})}});let verified=false;const r=await handleContact(request(),e,{verifyFetch:async()=>{verified=true;throw new Error();}});assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'60');assert.equal(verified,false);assert.equal(e.sent.length,0);});
test('email rate limit blocks after verification',()=>expectFailure(payload,429,'rate_limited',env({EMAIL_LIMITER:{limit:async()=>({success:false})}})));
test('email failure never returns success',async()=>{const e=env({EMAIL:{send:async()=>{throw new Error('mail failure');}}});const r=await handleContact(request(),e,verifier());assert.equal(r.status,503);assert.equal((await r.json()).ok,false);});
test('rejects invalid JSON',()=>expectFailure(payload,400,'invalid',env(),{body:'{oops'}));
test('rejects non-JSON content',()=>expectFailure(payload,415,'invalid',env(),{headers:{'Content-Type':'text/plain'}}));
test('checks actual streamed size even without Content-Length',()=>expectFailure(payload,413,'invalid',env(),{body:JSON.stringify({...payload,message:'a'.repeat(40000)})}));
test('checks declared oversized Content-Length',()=>expectFailure(payload,413,'invalid',env(),{headers:{'Content-Length':'999999'}}));
test('private rate keys are deterministic and salted',async()=>{const a=await privateKey('ip:192.0.2.10','salt-one');assert.match(a,/^[a-f0-9]{64}$/);assert.equal(a,await privateKey('ip:192.0.2.10','salt-one'));assert.notEqual(a,await privateKey('ip:192.0.2.10','salt-two'));});
for(const mail of ['hello@example.com','a+b@example.co.uk','test@xn--example-ova.com'])test(`accepts conventional email ${mail}`,()=>assert.equal(validEmail(mail),true));
for(const mail of ['a..b@example.com','.x@example.com','x.@example.com','a@-example.com','a@example..com','a b@example.com','a@example.com>','a@localhost'])test(`rejects malformed email ${mail}`,()=>assert.equal(validEmail(mail),false));
