// The build embeds the route manifest and public configuration. No runtime deps.
const BUILD = /*__BUILD_CONFIG__*/ {};
const TEST_SITE_KEYS = new Set(['1x00000000000000000000AA','1x00000000000000000000BB','2x00000000000000000000AB','2x00000000000000000000BB','3x00000000000000000000FF']);

function headersFor(preview = false) {
  const headers = new Headers({
    'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY',
    'Referrer-Policy':'strict-origin-when-cross-origin',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy':[
      "default-src 'self'",
      `script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com ${BUILD.schemaHashes.join(' ')}`,
      "style-src 'self'", "img-src 'self' data:", "font-src 'self'",
      "connect-src 'self' https://challenges.cloudflare.com", "frame-src 'self' https://challenges.cloudflare.com",
      "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'",
      ...(preview ? [] : ['upgrade-insecure-requests'])
    ].join('; ')
  });
  if (preview) headers.set('X-Robots-Tag', 'noindex, nofollow');
  else headers.set('Strict-Transport-Security', 'max-age=15552000');
  return headers;
}
function json(status, data, preview = false) {
  const headers = headersFor(preview);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control','no-store');
  if (status === 405) headers.set('Allow', 'POST');
  return new Response(JSON.stringify(data), { status, headers });
}
function redirect(url, preview = false) {
  const headers = headersFor(preview);
  headers.set('Location', url.toString());
  headers.set('Cache-Control', preview ? 'no-store' : 'public, max-age=3600');
  return new Response(null, { status:308, headers });
}
export function resolveSite(url) {
  const host = url.hostname.toLowerCase();
  for (const [locale, origin] of Object.entries(BUILD.domains)) {
    const canonicalHost = new URL(origin).hostname;
    if (host === canonicalHost || host === `www.${canonicalHost}`) return { locale, preview:false, canonicalHost };
  }
  const local = ['localhost','127.0.0.1','[::1]'].includes(host);
  if (local || host === BUILD.pagesHost || host.endsWith(`.${BUILD.pagesHost}`)) return { locale:url.searchParams.get('lang') === 'ro' ? 'ro' : 'en', preview:true, canonicalHost:null };
  return null;
}
function formEnabled(env, preview) {
  return !preview && env.CONTACT_ENABLED === 'true' && typeof env.CONTACT_WORKER?.fetch === 'function' &&
    typeof env.TURNSTILE_SITE_KEY === 'string' && /^[A-Za-z0-9_-]{10,100}$/.test(env.TURNSTILE_SITE_KEY) && !TEST_SITE_KEYS.has(env.TURNSTILE_SITE_KEY);
}
export function analyticsEnabled(env, preview) {
  const id = typeof env.GA_MEASUREMENT_ID === 'string' ? env.GA_MEASUREMENT_ID.trim() : '';
  return !preview && env.ANALYTICS_ENABLED === 'true' && /^G-[A-Z0-9]{6,20}$/.test(id) &&
    !['G-XXXXXXXXXX','G-0000000000','G-EXAMPLE1234'].includes(id);
}
function analyticsFrame(request, env, preview) {
  if (!analyticsEnabled(env,preview)) return json(503,{ok:false,code:'unavailable'},preview);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return json(403,{ok:false,code:'blocked'},preview);
  const headers = headersFor(preview);
  headers.set('Content-Type','text/html; charset=utf-8');
  headers.set('Cache-Control','no-store');
  headers.set('X-Frame-Options','SAMEORIGIN');
  headers.set('X-Robots-Tag','noindex, nofollow');
  headers.set('Referrer-Policy','no-referrer');
  headers.set('Content-Security-Policy',[
    "default-src 'none'",
    "script-src 'self' https://www.googletagmanager.com https://static.cloudflareinsights.com",
    "connect-src 'self' https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.googletagmanager.com",
    "img-src https://*.google-analytics.com",
    "style-src 'none'", "frame-src 'none'",
    "frame-ancestors 'self'", "base-uri 'none'", "form-action 'none'", "object-src 'none'", 'upgrade-insecure-requests'
  ].join('; '));
  const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Optional audience measurement</title><script type="module" src="${BUILD.analyticsScript}"></script></head><body data-measurement-id="${env.GA_MEASUREMENT_ID.trim()}"></body></html>`;
  return new Response(request.method==='HEAD'?null:html,{headers});
}
async function handleApi(request, env, state) {
  const url = new URL(request.url), { preview } = state;
  if (['/api/analytics-config','/api/analytics-frame'].includes(url.pathname)) {
    if (!['GET','HEAD'].includes(request.method)) {
      const response=json(405,{ok:false,code:'invalid'},preview);response.headers.set('Allow','GET, HEAD');return response;
    }
    if (url.pathname === '/api/analytics-frame') return analyticsFrame(request,env,preview);
    const response=json(200,{enabled:analyticsEnabled(env,preview),version:BUILD.privacyVersion},preview);
    return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;
  }
  if (url.pathname === '/api/config') {
    if (!['GET','HEAD'].includes(request.method)) {
      const response = json(405,{ok:false,code:'invalid'},preview);
      response.headers.set('Allow','GET, HEAD');
      return response;
    }
    const enabled = formEnabled(env, preview);
    const response = json(200,{enabled,siteKey:enabled?env.TURNSTILE_SITE_KEY:null},preview);
    if (request.method === 'HEAD') return new Response(null, {status:response.status,headers:response.headers});
    return response;
  }
  if (url.pathname !== '/api/contact') return json(404,{ok:false,code:'invalid'},preview);
  if (request.method !== 'POST') return json(405,{ok:false,code:'invalid'},preview);
  if (!formEnabled(env, preview)) return json(503,{ok:false,code:'unavailable'},preview);
  if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') return json(403,{ok:false,code:'blocked'},preview);
  const headers = new Headers(request.headers);
  // A browser cannot choose this trusted value; overwrite any supplied header.
  headers.set('x-etamade-client-ip', request.headers.get('cf-connecting-ip') || '');
  try {
    const upstream = await env.CONTACT_WORKER.fetch(new Request(request,{headers}));
    const responseHeaders = headersFor(preview);
    responseHeaders.set('Content-Type','application/json; charset=utf-8');
    responseHeaders.set('Cache-Control','no-store');
    if (upstream.headers.has('Retry-After')) responseHeaders.set('Retry-After', upstream.headers.get('Retry-After'));
    return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  } catch { return json(503,{ok:false,code:'upstream'},preview); }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const state = resolveSite(url);
    if (!state) return new Response('Misdirected request',{status:421,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});
    const {locale,preview,canonicalHost}=state;
    if (!preview && (url.hostname !== canonicalHost || url.protocol !== 'https:')) {
      url.hostname=canonicalHost;url.protocol='https:';url.port='';return redirect(url);
    }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return handleApi(request,env,state);
    if (!['GET','HEAD'].includes(request.method)) {
      const response=json(405,{ok:false,code:'invalid'},preview);response.headers.set('Allow','GET, HEAD');return response;
    }
    if (preview && url.pathname === '/robots.txt') {
      const headers=headersFor(true);headers.set('Content-Type','text/plain; charset=utf-8');headers.set('Cache-Control','no-store');
      return new Response(request.method==='HEAD'?null:'User-agent: *\nDisallow: /\n',{headers});
    }
    let pathname=url.pathname;
    if (pathname==='/index.html') {url.pathname='/';return redirect(url,preview);}
    for (const page of ['privacy','legal']) {
      const target=BUILD.paths[locale][page];
      const variants=new Set(Object.values(BUILD.paths).flatMap(p=>[p[page],p[page].replace(/\/$/,'')]));
      if (variants.has(pathname) && pathname!==target) {url.pathname=target;return redirect(url,preview);}
    }
    if (pathname==='/index.html.md') pathname='/index.md';
    let route=BUILD.routes[locale][pathname];
    // Explicit Markdown negotiation. HTML browsers continue to receive HTML.
    const accept=request.headers.get('accept')||'';
    let negotiated=false;
    if (route?.markdown && accept.includes('text/markdown') && !accept.includes('text/html')) {
      route=BUILD.routes[locale][route.markdown];negotiated=true;
    }
    if (BUILD.publicFiles.includes(pathname)) route={asset:pathname,type:BUILD.assetTypes[pathname]||'application/octet-stream',shared:true};
    const missing=!route;
    if (!route) route=BUILD.notFound[locale];
    try {
      const assetUrl=new URL(route.asset,url.origin);
      const upstream=await env.ASSETS.fetch(new Request(assetUrl,{method:request.method}));
      if (!upstream.ok) return new Response('Static asset unavailable',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
      const headers=new Headers(upstream.headers);
      headersFor(preview).forEach((value,key)=>headers.set(key,value));
      headers.set('Content-Type',route.type);
      headers.set('Cache-Control',preview?'no-store':route.shared?'public, max-age=86400':'public, max-age=0, must-revalidate');
      if (!route.shared) headers.set('Content-Language',locale);
      if (missing) headers.set('X-Robots-Tag','noindex');
      if (route.markdown || negotiated) headers.set('Vary','Accept');
      if (!route.shared) {
        const links=['</llms.txt>; rel="describedby"'];
        if (route.markdown) links.push(`<${route.markdown}>; rel="alternate"; type="text/markdown"`);
        headers.set('Link',links.join(', '));
      }
      return new Response(request.method==='HEAD'?null:upstream.body,{status:missing?404:200,headers});
    } catch {
      return new Response('Temporarily unavailable',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
    }
  }
};
