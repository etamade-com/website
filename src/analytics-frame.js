// Optional Google tag runtime. Served only by the Pages endpoint when configured.
// Loaded in its own same-origin document ONLY after opt-in. This is lifecycle
// isolation, not a security boundary against trusted third-party JavaScript.
const PUBLIC = /*__PRIVACY_PUBLIC__*/ {};
const measurementId = document.body.dataset.measurementId || '';
let active = false, initialized = false, consent = null, context = null, expires = null;
function stopTag() {
  active = false;
  window['ga-disable-' + measurementId] = true;
  clearTimeout(expires);
  if (Array.isArray(window.dataLayer)) window.dataLayer.length = 0;
}
// The parent invokes this synchronously before removing the frame, including on
// withdrawal, so pending unload/engagement handlers do not send new measurements.
window.etamadeStopAnalytics = stopTag;
function validPage(value) {
  if (!value || typeof value.page_location !== 'string' || !['en','ro'].includes(value.site_language)) return null;
  try {
    const expected = safePage(value.page_location,value.site_language,PUBLIC.domains,PUBLIC.paths,PUBLIC.titles);
    if (!expected || expected.page_location !== value.page_location || new URL(expected.page_location).origin !== location.origin) return null;
    return expected;
  } catch { return null; }
}
function event(name, params) {
  if (!active || !parseConsent(consent)?.analytics || !context) return;
  const item = sanitizeActivity(name,params);
  if (!item) return;
  window.gtag('event',item.name,{...context,...item.params,send_to:measurementId});
}
function initialize(message) {
  if (initialized || !/^G-[A-Z0-9]{6,20}$/.test(measurementId)) return;
  consent = parseConsent(message.consent);
  context = validPage(message.page);
  if (!consent?.analytics || !context) return;
  initialized = true; active = true;
  window['ga-disable-' + measurementId] = false;
  window.dataLayer = [];
  window.gtag = function() { if (active) window.dataLayer.push(arguments); };
  // Basic Consent Mode: these commands and the remote tag do not exist before
  // opt-in. Advertising is NEVER granted by this website's analytics choice.
  window.gtag('consent','default',{
    analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',
    personalization_storage:'denied',functionality_storage:'denied',security_storage:'granted'
  });
  window.gtag('set','ads_data_redaction',true);
  window.gtag('set','url_passthrough',false);
  window.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  window.gtag('js',new Date());
  window.gtag('config',measurementId,{
    ...context,
    consent_policy:PRIVACY.version,
    send_page_view:false,
    allow_google_signals:false,
    allow_ad_personalization_signals:false,
    ignore_referrer:true,
    cookie_domain:'none',cookie_path:'/',cookie_flags:'SameSite=Lax;Secure',
    cookie_expires:PRIVACY.cookieSeconds,cookie_update:false,
    linker:{accept_incoming:false,domains:[],decorate_forms:false}
  });
  event('page_view',{});
  const tag = document.createElement('script');
  tag.async = true;
  tag.referrerPolicy = 'no-referrer';
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
  tag.onerror = () => { stopTag(); };
  document.head.appendChild(tag);
  function armExpiry() {
    expires = setTimeout(() => {
      if (parseConsent(consent)?.analytics) armExpiry();
      else { stopTag(); window.parent.postMessage({type:'etamade:analytics:expired'},location.origin); }
    },Math.min(2147483647,Math.max(0,consent.expiresAt-Date.now())));
  }
  armExpiry();
  window.parent.postMessage({type:'etamade:analytics:started'},location.origin);
}
// A stand-alone visit to this endpoint never loads Google or emits a page view.
if (window.parent !== window && location.protocol === 'https:' && isProductionHost(location.hostname,PUBLIC.domains)) {
  window.addEventListener('message',message => {
    if (message.source !== window.parent || message.origin !== location.origin) return;
    if (message.data?.type === 'etamade:analytics:init') initialize(message.data);
    else if (message.data?.type === 'etamade:analytics:event') event(message.data.activity?.name,message.data.activity?.params);
  });
  window.parent.postMessage({type:'etamade:analytics:ready'},location.origin);
}
