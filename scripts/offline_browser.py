"""Render the generated site without network access (browser navigation is blocked).
Only the resource transport is replaced; the built CSS and JS are used verbatim.
Cloudflare routing/CSP are independently covered by the Node test suite.
"""
import base64,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'
def data_url(path):
 p=DIST/path.lstrip('/')
 mime={'.svg':'image/svg+xml','.png':'image/png','.js':'text/javascript'}.get(p.suffix,'application/octet-stream')
 return 'data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
def html_for(lang='en',page='home',scripts=True):
 suffix='index.html' if page=='home' else page+'/index.html'
 html=(DIST/'_site'/lang/suffix).read_text()
 html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+ (DIST/m[1].lstrip('/')).read_text()+'</style>',html)
 html=re.sub(r'<script src="([^"]+)"([^>]*)></script>',lambda m:('<script'+m[2]+'>'+ (DIST/m[1].lstrip('/')).read_text()+'</script>') if scripts else '',html)
 html=re.sub(r'(src|href)="(/(?:assets/[^" ]+\.(?:png|svg)|favicon\.svg))"',lambda m:m[1]+'="'+data_url(m[2])+'"',html)
 return html
async def load(page,lang='en',route='home',scripts=True):
 # Deliberately disabled: no real service/token/email operation is attempted.
 await page.evaluate("""() => {window.fetch=async () => new Response(JSON.stringify({enabled:false,siteKey:null}),{status:200,headers:{'Content-Type':'application/json'}});} """)
 await page.set_content(html_for(lang,route,scripts),wait_until='load')
 await page.wait_for_timeout(120)
