"""Offline browser regression with real built CSS/JS and mocked browser origins,
storage, Cloudflare APIs and analytics-frame transport. This environment blocks
all browser navigation. Node tests independently exercise Worker routing/CSP and
the actual tag-frame code. No Google, Cloudflare, email or public site is contacted.
"""
import asyncio, base64, json, os, re, shutil
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'
PREVIEWS=Path(os.environ.get('PREVIEW_DIR',str(ROOT/'docs/previews')))
RESULTS=[]

def check(name, value, detail=None):
    item={'name':name,'passed':bool(value)}
    if detail is not None:item['detail']=detail
    RESULTS.append(item)
    print(('PASS' if value else 'FAIL')+' '+name,flush=True)
    if not value:print('DETAIL',detail,flush=True)

def data_url(path):
    f=DIST/path.lstrip('/')
    mime={'.svg':'image/svg+xml','.png':'image/png'}.get(f.suffix,'application/octet-stream')
    return 'data:'+mime+';base64,'+base64.b64encode(f.read_bytes()).decode()

def html_for(lang='en',route='home',scripts=True):
    path='index.html' if route=='home' else route+'/index.html'
    html=(DIST/'_site'/lang/path).read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(DIST/m[1].lstrip('/')).read_text()+'</style>',html)
    def script(m):
        if not scripts:return ''
        code=(DIST/m[1].lstrip('/')).read_text()
        # Substitute only environment boundaries, not consent or routing decisions.
        prefix="const location = window.__location; const history = window.__history;\n" if '/privacy.' in m[1] or '/site.' in m[1] else ''
        return '<script'+m[2]+'>'+prefix+code+'</script>'
    html=re.sub(r'<script src="([^"]+)"([^>]*)></script>',script,html)
    return re.sub(r'(src|href)="(/(?:assets/[^" ]+\.(?:png|svg)|favicon\.svg))"',lambda m:m[1]+'="'+data_url(m[2])+'"',html)

MOCKS=r'''options => {
 window.__location = new URL(options.url);
 window.__history = {state:null,replaceState(state,title,url){this.state=state;window.__location.href=new URL(url,window.__location).href;}};
 window.__store = options.storage || {}; window.__session = options.session || {};
 window.__config = {analytics:options.analytics !== false, contact:options.contact === true};
 window.__calls=[];window.__activity=[];window.__remoteRequests=[];window.__stops=0;window.__cookies={};window.__delayConfig=false;
 const storage = (data) => ({getItem:k=>{if(options.blockStorage)throw new Error('blocked');return data[k]??null;},setItem:(k,v)=>{if(options.blockStorage||options.blockWrites)throw new Error('blocked');data[k]=String(v);},removeItem:k=>{if(options.blockStorage)throw new Error('blocked');delete data[k];}});
 Object.defineProperty(window,'localStorage',{configurable:true,value:storage(window.__store)});
 Object.defineProperty(window,'sessionStorage',{configurable:true,value:storage(window.__session)});
 Object.defineProperty(navigator,'languages',{configurable:true,value:options.languages || [options.lang==='ro'?'ro-RO':'en-GB']});
 Object.defineProperty(navigator,'language',{configurable:true,value:(options.languages||[options.lang==='ro'?'ro-RO':'en-GB'])[0]});
 Object.defineProperty(document,'referrer',{configurable:true,get:()=>options.referrer||''});
 Object.defineProperty(document,'cookie',{configurable:true,get:()=>Object.entries(window.__cookies).map(([k,v])=>k+'='+v).join('; '),set:value=>{const [pair]=value.split(';');const idx=pair.indexOf('=');const key=pair.slice(0,idx);if(/Max-Age=0/.test(value))delete window.__cookies[key];else window.__cookies[key]=pair.slice(idx+1);}});
 window.fetch=async (url,init={}) => {
  window.__calls.push({url:String(url),body:init.body||null});
  if(String(url)==='/api/analytics-config') {
   if(window.__delayConfig)await new Promise((resolve,reject)=>{window.__resolveConfig=resolve;init.signal?.addEventListener('abort',()=>reject(new Error('aborted')));});
   return new Response(JSON.stringify({enabled:window.__config.analytics,version:'2026-09-27.1'}),{status:200});
  }
  if(String(url)==='/api/config')return new Response(JSON.stringify({enabled:window.__config.contact,siteKey:window.__config.contact?'mock-public-site-key':null}),{status:200});
  if(String(url)==='/api/contact')return new Response(JSON.stringify(window.__contactResult||{ok:true,reference:'LOCAL-TEST'}),{status:window.__contactStatus||200});
  throw new Error('External network prohibited in tests: '+url);
 };
 window.turnstile={render(selector,options){window.__turnstileOptions=options;setTimeout(()=>options.callback('mock-token'),0);return 1;},remove(){},reset(){window.__turnstileOptions?.callback('mock-token');}};
 const create=document.createElement.bind(document);
 document.createElement=(tag,...args)=>{
  const element=create(tag,...args);
  if(tag.toLowerCase()==='iframe')Object.defineProperty(element,'src',{configurable:true,get:()=>element.dataset.mockSrc||'',set:v=>element.dataset.mockSrc=v});
  return element;
 };
 const append=Node.prototype.appendChild;
 Node.prototype.appendChild=function(element){
  const result=append.call(this,element);
  if(element.tagName==='IFRAME' && element.id==='analytics-runtime') {
   const send=type=>window.dispatchEvent(new MessageEvent('message',{origin:window.__location.origin,source:element.contentWindow,data:{type}}));
   element.contentWindow.etamadeStopAnalytics=()=>{window.__stops++;};
   element.contentWindow.postMessage=(data)=>{
    if(data.type==='etamade:analytics:init'){
     window.__remoteRequests.push('mock Google tag load after consent');
     window.__activity.push({name:'page_view',params:data.page});
     document.cookie='_ga=mock-consented-id; Path=/';document.cookie='_ga_ETATEST001=mock-state; Path=/';
     send('etamade:analytics:started');
    } else if(data.type==='etamade:analytics:event')window.__activity.push(data.activity);
   };
   setTimeout(()=>send('etamade:analytics:ready'),5);
  }
  return result;
 };
}'''

async def new_page(browser,lang='en',route='home',width=1440,theme='light',languages=None,storage=None,session=None,analytics=True,contact=False,url=None,block_storage=False,block_writes=False,referrer=None,scripts=True):
    ctx=await browser.new_context(viewport={'width':width,'height':1000 if width>560 else 844},color_scheme=theme,reduced_motion='reduce',java_script_enabled=scripts)
    page=await ctx.new_page();page.set_default_timeout(5000)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    path={'home':'/','privacy':'/confidentialitate/' if lang=='ro' else '/privacy/','legal':'/informatii-legale/' if lang=='ro' else '/legal/','404':'/missing/'}[route]
    if scripts:
        await page.evaluate(MOCKS,{'url':url or 'https://etamade.'+('ro' if lang=='ro' else 'com')+path,'lang':lang,'languages':languages,'storage':storage,'session':session,'analytics':analytics,'contact':contact,'blockStorage':block_storage,'blockWrites':block_writes,'referrer':referrer})
    await page.set_content(html_for(lang,route,scripts),wait_until='load')
    await page.wait_for_timeout(100)
    return ctx,page,errors

async def accept(page):
    await page.locator('#consent-banner [data-consent-accept]').click()
    await page.wait_for_timeout(80)
async def reject(page):
    await page.locator('#consent-banner [data-consent-reject]').click()
    await page.wait_for_timeout(40)
async def overflow(page):
    return await page.evaluate('document.documentElement.scrollWidth <= innerWidth')

async def main():
    PREVIEWS.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
        # Mobile/desktop, both themes, no input needed: no Google runtime before consent.
        for lang in ['en','ro']:
            for theme in ['light','dark']:
                for width in [320,390,768,1440]:
                    ctx,page,errors=await new_page(browser,lang=lang,theme=theme,width=width)
                    check(f'{lang}/{theme}/{width}: no overflow',await overflow(page))
                    check(f'{lang}/{theme}/{width}: no JS errors',not errors,errors)
                    check(f'{lang}/{theme}/{width}: banner visible; no tag or analytics request',await page.locator('#consent-banner').is_visible() and await page.evaluate('!__remoteRequests.length && !__calls.some(x=>x.url.includes("analytics"))'))
                    if lang=='en' and theme=='light' and width==1440:await page.screenshot(path=str(PREVIEWS/'desktop-en-consent.png'))
                    if lang=='ro' and theme=='light' and width==390:await page.screenshot(path=str(PREVIEWS/'mobile-ro-consent.png'))
                    if lang=='en' and theme=='dark' and width==1440:await page.screenshot(path=str(PREVIEWS/'desktop-en-dark.png'))
                    await page.locator('#consent-banner [data-privacy-open]').click()
                    check(f'{lang}/{theme}/{width}: preferences fit viewport',await overflow(page) and await page.locator('#privacy-dialog').is_visible())
                    check(f'{lang}/{theme}/{width}: optional analytics starts unchecked',not await page.locator('#analytics-consent').is_checked())
                    if lang=='ro' and theme=='light' and width==390:await page.screenshot(path=str(PREVIEWS/'mobile-ro-preferences.png'))
                    await page.keyboard.press('Escape')
                    check(f'{lang}/{theme}/{width}: Escape is not consent',await page.locator('#consent-banner').is_visible() and await page.evaluate('!__remoteRequests.length'))
                    await ctx.close()
        # Language directions, regional codes, dismissal, explicit choices and preview.
        for lang,languages,wanted in [('en',['ro-RO','en-US'],True),('en',['ro-MD'],True),('ro',['en-GB'],True),('ro',['en-US'],True),('ro',['ro-RO'],False),('en',['en-GB'],False),('ro',['fr-FR','en-US'],False),('en',['de-DE','ro-RO'],False)]:
            ctx,page,_=await new_page(browser,lang=lang,languages=languages)
            visible=await page.locator('#language-suggestion').is_visible()
            check(f'Language {lang}/{languages}: correct suggestion',visible==wanted)
            check(f'Language {lang}/{languages}: no automatic redirect',await page.evaluate('__location.hostname')==('etamade.ro' if lang=='ro' else 'etamade.com'))
            if wanted:
                check('Suggestion is written in proposed language',await page.locator('#language-suggestion').get_attribute('lang')==('ro' if lang=='en' else 'en'))
                await page.locator('.language-stay').click()
                check('Dismissal remembered for tab session',not await page.locator('#language-suggestion').is_visible() and bool(await page.evaluate('__session["etamade-language-v1"]')))
            await ctx.close()
        ctx,page,_=await new_page(browser,lang='en',route='privacy',languages=['ro-RO'],url='https://etamade.com/privacy/?email=private@example.com')
        check('Privacy route maps to Romanian without leaking incoming query',await page.locator('.language-go').get_attribute('href')=='https://etamade.ro/confidentialitate/?lang-choice=ro')
        await ctx.close()
        ctx,page,_=await new_page(browser,lang='ro',languages=['en-GB'],url='https://etamade.ro/?lang-choice=ro#services')
        check('Explicit chosen language suppresses suggestion and cleans marker',not await page.locator('#language-suggestion').is_visible() and await page.evaluate('__location.href')=='https://etamade.ro/#services')
        check('Manual language switch retains recognized section',await page.locator('.language-switch').get_attribute('href')=='https://etamade.com/?lang-choice=en#services')
        await ctx.close()
        ctx,page,_=await new_page(browser,lang='en',languages=['ro-RO'],session={'etamade-language-v1':'en'})
        check('Previously dismissed suggestion stays dismissed',not await page.locator('#language-suggestion').is_visible());await ctx.close()
        ctx,page,_=await new_page(browser,lang='ro',languages=['en-GB'],referrer='https://etamade.com/')
        check('Arrival from sibling domain respects manual choice',not await page.locator('#language-suggestion').is_visible());await ctx.close()
        ctx,page,_=await new_page(browser,lang='en',languages=['ro-RO'],url='https://etamade-website.pages.dev/')
        await accept(page)
        check('Preview origin never loads analytics or suggests production redirect',not await page.locator('#language-suggestion').is_visible() and await page.evaluate('!__remoteRequests.length && !__calls.some(x=>x.url.includes("analytics"))'));await ctx.close()
        # Full consent lifecycle and cookie cleanup without losing unsent form contents.
        ctx,page,errors=await new_page(browser,contact=True,url='https://etamade.com/?email=private@example.com#private')
        await page.evaluate('document.querySelector(".hero-actions .text-link").click()')
        check('Pre-consent interactions are not collected',await page.evaluate('__activity.length===0 && __remoteRequests.length===0'))
        await accept(page)
        check('Opt-in creates one runtime and one page view',await page.evaluate('__remoteRequests.length===1 && __activity.filter(x=>x.name==="page_view").length===1'))
        check('Consent record has version and expiry, not a visitor ID',await page.evaluate('const r=JSON.parse(__store["etamade-consent-v1"]);r.analytics===true && r.version==="2026-09-27.1" && r.expiresAt-r.decidedAt===15552000000'))
        check('Analytics page context removes private query/hash',await page.evaluate('!JSON.stringify(__activity).includes("private")'))
        await page.locator('#name').fill('PRIVATE PERSON')
        await page.locator('#email').fill('private@example.com')
        await page.locator('#message').fill('PRIVATE MESSAGE - this stays in the contact form only.')
        await page.locator('#privacy-launcher').click()
        await page.locator('#privacy-dialog [data-consent-reject]').click()
        check('Withdrawal stops runtime synchronously and removes its cookies',await page.evaluate('!document.querySelector("#analytics-runtime") && __stops===1 && !Object.keys(__cookies).some(k=>k.startsWith("_ga"))'))
        check('Withdrawal does not erase an unsent enquiry',await page.locator('#message').input_value()=='PRIVATE MESSAGE - this stays in the contact form only.')
        before=await page.evaluate('__activity.length')
        await page.evaluate('window.dispatchEvent(new CustomEvent("etamade:activity",{detail:{name:"generate_lead"}}))')
        check('No events after withdrawal',await page.evaluate('__activity.length')==before)
        await page.locator('#privacy-launcher').click();await page.locator('#analytics-consent').check();await page.locator('[data-consent-save]').click();await page.wait_for_timeout(80)
        check('Re-consent starts a fresh runtime',await page.evaluate('__remoteRequests.length===2 && !!document.querySelector("#analytics-runtime")'))
        await page.evaluate('window.dispatchEvent(new CustomEvent("etamade:activity",{detail:{name:"generate_lead",params:{email:"private@example.com",message:"PRIVATE MESSAGE"}}}))')
        check('Personal values never enter analytics event payloads',await page.evaluate('!JSON.stringify(__activity).includes("private@example.com") && !JSON.stringify(__activity).includes("PRIVATE MESSAGE")'))
        await page.locator('[name=privacyAcknowledged]').check()
        await page.locator('#submit-button').click();await page.wait_for_timeout(100)
        check('Contact success records lead after the accepted response',await page.evaluate('__activity.some(x=>x.name==="contact_submit") && __activity.some(x=>x.name==="generate_lead")'))
        check('Form still sends its normal payload only to private contact API',await page.evaluate('__calls.some(x=>x.url==="/api/contact" && x.body.includes("private@example.com"))'))
        record=await page.evaluate('JSON.parse(__store["etamade-consent-v1"])')
        await page.evaluate('const r=JSON.parse(__store["etamade-consent-v1"]);Date.now=()=>r.expiresAt+1;window.dispatchEvent(new Event("pageshow"));')
        check('Expired consent stops tracking and asks again',await page.locator('#consent-banner').is_visible() and await page.evaluate('!document.querySelector("#analytics-runtime")'))
        check('Lifecycle produced no JS exceptions',not errors,errors)
        await ctx.close()
        # Returning consent / old versions / rejection / blocked storage / cross-tab.
        ctx,page,_=await new_page(browser,storage={'etamade-consent-v1':json.dumps(record)})
        check('Returning valid opt-in resumes without another banner',not await page.locator('#consent-banner').is_visible() and await page.evaluate('__remoteRequests.length===1'))
        await page.evaluate('delete __store["etamade-consent-v1"];window.dispatchEvent(new StorageEvent("storage",{key:"etamade-consent-v1",newValue:null}));')
        check('Cross-tab deletion withdraws consent immediately',await page.evaluate('!document.querySelector("#analytics-runtime")') and await page.locator('#consent-banner').is_visible())
        await ctx.close()
        old={**record,'version':'old'}
        ctx,page,_=await new_page(browser,storage={'etamade-consent-v1':json.dumps(old)})
        check('A new policy version requires a new choice',await page.locator('#consent-banner').is_visible() and await page.evaluate('!__remoteRequests.length'));await ctx.close()
        for option in ['blocked','quota']:
            ctx,page,errors=await new_page(browser,block_storage=option=='blocked',block_writes=option=='quota')
            await accept(page)
            check('Storage '+option+': consent can be page-local without breaking site',await page.evaluate('__remoteRequests.length===1 && etamadePrivacy.getChoice().analytics') and not errors,errors)
            await page.evaluate('window.dispatchEvent(new Event("pageshow"))');await page.wait_for_timeout(30)
            check('Storage '+option+': page-local consent survives refresh checks',await page.evaluate('etamadePrivacy.getChoice().analytics===true'))
            await page.locator('#privacy-launcher').click();await page.locator('#privacy-dialog [data-consent-reject]').click()
            check('Storage '+option+': withdrawal remains effective',await page.evaluate('!document.querySelector("#analytics-runtime")'))
            await ctx.close()
        ctx,page,_=await new_page(browser,contact=True)
        await reject(page)
        check('Reject makes no analytics config or tag requests',await page.evaluate('!__calls.some(x=>x.url.includes("analytics")) && !__remoteRequests.length'))
        await page.locator('#name').fill('Alex Test');await page.locator('#email').fill('test@example.com');await page.locator('#message').fill('This is a local contact-only test with analytics rejected.');await page.locator('[name=privacyAcknowledged]').check();await page.locator('#submit-button').click();await page.wait_for_timeout(80)
        check('Contact remains functional with analytics rejected',await page.locator('#form-status').get_attribute('data-state')=='success' and await page.evaluate('!__activity.length'))
        await ctx.close()
        ctx,page,_=await new_page(browser)
        await page.evaluate('__delayConfig=true')
        await accept(page);await page.locator('#privacy-launcher').click();await page.locator('#privacy-dialog [data-consent-reject]').click();await page.evaluate('__resolveConfig?.()');await page.wait_for_timeout(50)
        check('Withdrawal during pending config cannot start a late tracker',await page.evaluate('!__remoteRequests.length && !document.querySelector("#analytics-runtime")'));await ctx.close()
        ctx,page,_=await new_page(browser,analytics=False)
        await accept(page)
        check('Missing deployment configuration never loads Google',await page.evaluate('!__remoteRequests.length && document.documentElement.dataset.analytics==="unconfigured"'));await ctx.close()
        # SVG branding, manual themes, accessible dialogs, no-JS layouts and previews.
        for lang in ['en','ro']:
            ctx,page,_=await new_page(browser,lang=lang)
            await reject(page)
            fill1=await page.locator('.site-header .brand-wordmark path').first.evaluate('(el)=>getComputedStyle(el).fill')
            await page.locator('.theme-toggle').click()
            fill2=await page.locator('.site-header .brand-wordmark path').first.evaluate('(el)=>getComputedStyle(el).fill')
            check(lang+': SVG changes with manual page theme',fill1!=fill2,(fill1,fill2))
            await page.locator('#privacy-launcher').click()
            check(lang+': native dialog receives keyboard focus',await page.evaluate('document.querySelector("#privacy-dialog").contains(document.activeElement)'))
            await page.keyboard.press('Escape')
            check(lang+': dialog closes with Escape',not await page.locator('#privacy-dialog').is_visible())
            await ctx.close()
            for width in [320,1440]:
                ctx,page,_=await new_page(browser,lang=lang,width=width,scripts=False)
                check(f'{lang}/{width}: no-JS content and navigation stay visible',await page.locator('h1').is_visible() and await page.locator('#primary-nav').is_visible() and await overflow(page))
                await ctx.close()
        ctx,page,_=await new_page(browser,lang='en',languages=['ro-RO'])
        await reject(page)
        await page.screenshot(path=str(PREVIEWS/'desktop-language-suggestion.png'))
        await ctx.close()
        ctx,page,_=await new_page(browser,lang='ro',width=390)
        await reject(page)
        await page.screenshot(path=str(PREVIEWS/'mobile-ro-full.png'),full_page=True)
        await ctx.close()
        ctx,page,_=await new_page(browser,lang='ro',route='privacy',width=390)
        await reject(page)
        check('Romanian privacy page/table remains within mobile viewport',await overflow(page))
        await ctx.close()
        await browser.close()
    report=ROOT/'docs/reports/browser-results-v3.json';report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps({'mode':'offline, real CSS/JS, mocked origin/storage/service transport; no live requests','passed':sum(r['passed'] for r in RESULTS),'failed':sum(not r['passed'] for r in RESULTS),'checks':RESULTS},indent=2))
    print('TOTAL',len(RESULTS),'PASS',sum(r['passed'] for r in RESULTS),'FAIL',sum(not r['passed'] for r in RESULTS),flush=True)
    if any(not r['passed'] for r in RESULTS):raise SystemExit(1)

if __name__=='__main__':asyncio.run(main())
