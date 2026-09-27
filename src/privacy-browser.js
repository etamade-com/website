// The build prepends privacy-model.mjs and embeds public translations/configuration.
const PUBLIC = /*__PRIVACY_PUBLIC__*/ {};
const lang = document.documentElement.lang === 'ro' ? 'ro' : 'en';
const labels = PUBLIC.labels[lang];
const banner = document.querySelector('#consent-banner');
const dialog = document.querySelector('#privacy-dialog');
const analyticsInput = document.querySelector('#analytics-consent');
const status = document.querySelector('#privacy-status');
const launchers = document.querySelectorAll('[data-privacy-open]');
let memoryOnly = false;
let choice = null, memoryChoice = null, frame = null, generation = 0, configRequest = null;
let frameReady = false, pending = [], stopObserving = () => {}, returnFocus = null;
let frameTimer = null, expiryTimer = null;
const production = isProductionHost(location.hostname, PUBLIC.domains) && location.protocol === 'https:';
const consented = () => Boolean(parseConsent(choice)?.analytics);
function readChoice() {
  if (memoryOnly) return parseConsent(memoryChoice);
  try {
    const raw = localStorage.getItem(PRIVACY.storageKey);
    const parsed = parseConsent(raw);
    if (raw && !parsed) localStorage.removeItem(PRIVACY.storageKey);
    return parsed;
  }
  catch { return parseConsent(memoryChoice); }
}
function announce(message) { if (status) status.textContent = message; }
function clearAnalyticsCookies() {
  let names = [];
  try { names = analyticsCookieNames(document.cookie); } catch { return; }
  for (const name of names) {
    // This implementation only sets host-only cookies at /. Also clean historical
    // domain variants, without touching unrelated application/security cookies.
    for (const domain of ['', location.hostname, '.' + location.hostname]) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${domain ? '; Domain=' + domain : ''}`;
    }
  }
}
function stopAnalytics(eraseCookies = true) {
  generation++;
  configRequest?.abort(); configRequest = null;
  // Destroy the entire tag execution context: removing a script alone is NOT enough.
  frameReady = false; pending = [];
  try { frame?.contentWindow?.etamadeStopAnalytics?.(); } catch { /* A not-yet-loaded frame has no tag. */ }
  frame?.remove(); frame = null;
  clearTimeout(frameTimer); frameTimer = null;
  stopObserving(); stopObserving = () => {};
  if (eraseCookies) clearAnalyticsCookies();
  document.documentElement.dataset.analytics = 'off';
}
function pageContext() { return safePage(location.href, lang, PUBLIC.domains, PUBLIC.paths, PUBLIC.titles); }
function emit(name, detail = {}) {
  if (!consented() || !frame) return;
  const activity = sanitizeActivity(name, detail);
  if (!activity) return;
  if (!frameReady) {
    // Only post-consent interactions enter this small, page-local queue.
    if (pending.length < 30) pending.push(activity);
    return;
  }
  frame.contentWindow?.postMessage({type:'etamade:analytics:event', activity}, location.origin);
}
function observeActivity() {
  const controller = new AbortController(), opts = {signal:controller.signal};
  const seenSections = new Set(), seenDepths = new Set();
  let sectionObserver = null, startedForm = false, engagementStart = Date.now();
  const placement = node => node.closest('.site-header') ? 'header' : node.closest('.hero') ? 'hero' :
    node.closest('.service-card') ? 'service' : node.closest('.site-footer') ? 'footer' :
    node.closest('#language-suggestion') ? 'language_prompt' : 'content';
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || link.closest('#consent-banner, #privacy-dialog')) return;
    if (link.dataset.language) { emit('language_switch',{target_language:link.dataset.language}); return; }
    if (link.dataset.service) { emit('select_service',{service:link.dataset.service}); return; }
    let url; try { url = new URL(link.href,location.origin); } catch { return; }
    if (url.protocol === 'mailto:') return emit('outbound_click',{target:'email'});
    if (url.protocol === 'tel:') return emit('outbound_click',{target:'phone'});
    if (['www.linkedin.com','linkedin.com'].includes(url.hostname)) return emit('outbound_click',{target:'linkedin'});
    if (url.hostname === 'github.com') return emit('outbound_click',{target:'github'});
    if (url.origin !== location.origin) return;
    const hash = url.hash.slice(1);
    const target = ['services','approach','about','contact'].includes(hash) ? hash :
      url.pathname === PUBLIC.paths[lang].privacy ? 'privacy' : url.pathname === PUBLIC.paths[lang].legal ? 'legal' :
      url.pathname === '/llms.txt' ? 'ai' : url.pathname === '/' ? 'home' : null;
    if (target) emit('cta_click',{target,placement:placement(link)});
  },opts);
  document.querySelectorAll('.service-details, .faq details').forEach((el) => {
    el.addEventListener('toggle',() => {
      if (!el.open) return;
      if (el.classList.contains('service-details')) emit('service_open',{service:el.closest('.service-card').id});
      else emit('faq_open',{question:[...document.querySelectorAll('.faq details')].indexOf(el)+1});
    },opts);
  });
  document.querySelector('#contact-form')?.addEventListener('focusin',() => {
    if (!startedForm) { startedForm = true; emit('contact_start'); }
  },opts);
  document.querySelector('#service')?.addEventListener('change',event => emit('select_service',{service:event.target.value}),opts);
  window.addEventListener('etamade:activity',event => emit(event.detail?.name,event.detail?.params),opts);
  window.addEventListener('scroll',() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max <= 0) return;
    const percentage = scrollY / max * 100;
    for (const percent of [25,50,75,90]) if (percentage >= percent && !seenDepths.has(percent)) {
      seenDepths.add(percent); emit('scroll_depth',{percent});
    }
  },{...opts,passive:true});
  if ('IntersectionObserver' in window) {
    sectionObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting && !seenSections.has(entry.target.id)) {
        seenSections.add(entry.target.id); emit('section_view',{section:entry.target.id});
      }
    },{threshold:0,rootMargin:'-15% 0px -15% 0px'});
    document.querySelectorAll('#services,#approach,#about,#contact').forEach(el => sectionObserver.observe(el));
  }
  function engagement() {
    const now = Date.now();
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      const ms = Math.min(60000,now-engagementStart);
      if (ms > 0) emit('engagement_time',{engagement_time_msec:ms});
    }
    engagementStart = now;
  }
  const interval = setInterval(engagement,15000);
  document.addEventListener('visibilitychange',() => { engagementStart = Date.now(); },opts);
  return () => { controller.abort(); sectionObserver?.disconnect(); clearInterval(interval); };
}
async function startAnalytics() {
  if (!production || !consented() || frame || configRequest) return;
  const current = ++generation;
  configRequest = new AbortController();
  const controller = configRequest;
  const timeout = setTimeout(() => controller.abort(),10000);
  try {
    const response = await fetch('/api/analytics-config',{
      credentials:'same-origin',cache:'no-store',signal:controller.signal
    });
    const config = response.ok ? await response.json() : null;
    if (current !== generation || !consented()) return;
    if (!config?.enabled || config.version !== PRIVACY.version) {
      document.documentElement.dataset.analytics = 'unconfigured'; return;
    }
    frame = document.createElement('iframe');
    frame.id = 'analytics-runtime'; frame.hidden = true;
    frame.setAttribute('aria-hidden','true'); frame.tabIndex = -1;
    frame.title = 'Optional Google Analytics runtime';
    frame.referrerPolicy = 'no-referrer'; frame.src = '/api/analytics-frame';
    document.body.appendChild(frame);
    stopObserving = observeActivity();
    frameTimer = setTimeout(() => {
      if (current === generation && !frameReady) stopAnalytics();
    },15000);
  } catch { /* Network/ad-blocking failures never prevent using the website. */ }
  finally { clearTimeout(timeout); if (current === generation) configRequest = null; }
}
window.addEventListener('message',event => {
  if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin || !consented()) return;
  if (event.data?.type === 'etamade:analytics:ready') {
    frame.contentWindow.postMessage({type:'etamade:analytics:init',consent:choice,page:pageContext()},location.origin);
  } else if (event.data?.type === 'etamade:analytics:started') {
    frameReady = true; clearTimeout(frameTimer);
    document.documentElement.dataset.analytics = 'on';
    for (const item of pending.splice(0)) emit(item.name,item.params);
  } else if (event.data?.type === 'etamade:analytics:expired') refreshChoice();
});
function refreshUI() {
  if (banner) banner.hidden = Boolean(choice);
  if (analyticsInput) analyticsInput.checked = consented();
  document.querySelector('#privacy-launcher')?.removeAttribute('hidden');
  clearTimeout(expiryTimer);
  if (choice) expiryTimer = setTimeout(refreshChoice,Math.min(2147483647,choice.expiresAt-Date.now()+50));
}
function refreshChoice() {
  const previous = consented();
  choice = readChoice();
  if (!choice?.analytics) stopAnalytics();
  else if (!previous || !frame) startAnalytics();
  refreshUI();
}
function closeSettings() {
  if (dialog?.open) dialog.close();
  returnFocus?.focus({preventScroll:true});
}
function saveChoice(allowed, method) {
  // Switch the in-memory guard BEFORE any asynchronous operation or notification.
  choice = makeConsent(allowed,method);
  memoryChoice = choice;
  let stored = true;
  try { localStorage.setItem(PRIVACY.storageKey,JSON.stringify(choice)); }
  catch {
    stored = false;
    try { localStorage.removeItem(PRIVACY.storageKey); } catch { /* No persistent storage access. */ }
  }
  memoryOnly = !stored;
  if (!allowed) stopAnalytics();
  else startAnalytics();
  closeSettings(); refreshUI();
  announce(!stored ? labels.memoryOnly : allowed ? labels.saved : labels.withdrawn);
}
function openSettings(trigger) {
  returnFocus = trigger || document.activeElement;
  if (analyticsInput) analyticsInput.checked = consented();
  if (!dialog?.open) dialog?.showModal();
}
launchers.forEach(button => {
  button.hidden = false;
  button.addEventListener('click',() => openSettings(button));
});
document.querySelectorAll('[data-consent-accept]').forEach(button => button.addEventListener('click',() => saveChoice(true,'accept')));
document.querySelectorAll('[data-consent-reject]').forEach(button => button.addEventListener('click',() => saveChoice(false,'reject')));
document.querySelector('[data-consent-save]')?.addEventListener('click',() => saveChoice(analyticsInput.checked,'save'));
document.querySelector('[data-privacy-close]')?.addEventListener('click',closeSettings);
dialog?.addEventListener('cancel',() => { /* Escape dismisses settings; it does not grant or change consent. */ });
dialog?.addEventListener('click',event => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSettings();
  }
});
window.addEventListener('storage',event => {
  if (event.key === PRIVACY.storageKey || event.key === null) { memoryChoice = null; memoryOnly = false; refreshChoice(); }
});
window.addEventListener('pageshow',refreshChoice);
// Retire tags on a page entering the back/forward cache. Recheck consent on return.
window.addEventListener('pagehide',() => stopAnalytics(false));
document.addEventListener('visibilitychange',() => {
  if (document.visibilityState === 'visible') refreshChoice();
});
window.etamadePrivacy = Object.freeze({open:() => openSettings(),withdraw:() => saveChoice(false,'reject'),getChoice:() => choice ? {...choice} : null});
refreshChoice();

// Language suggestions are entirely local. No geolocation, third-party lookup,
// shared consent, analytics identifier or automatic cross-domain redirect.
const languageBanner = document.querySelector('#language-suggestion');
let languageDismissed = false;
function dismissLanguage() {
  languageDismissed = true;
  if (languageBanner) languageBanner.hidden = true;
  try { sessionStorage.setItem(PRIVACY.languageKey,lang); } catch { /* Session-only in memory. */ }
}
const currentUrl = new URL(location.href);
if (production && currentUrl.searchParams.get('lang-choice') === lang) {
  dismissLanguage(); currentUrl.searchParams.delete('lang-choice');
  history.replaceState(history.state,'',currentUrl.pathname + currentUrl.search + currentUrl.hash);
}
try { languageDismissed ||= sessionStorage.getItem(PRIVACY.languageKey) === lang; } catch { /* Browsing still works. */ }
// A direct/manual move from our other domain is already an explicit language choice.
try { if (document.referrer && isProductionHost(new URL(document.referrer).hostname,PUBLIC.domains) && new URL(document.referrer).hostname !== location.hostname) dismissLanguage(); } catch { /* Ignore invalid referrer. */ }
function decorateLanguageLinks() {
  if (!production) return;
  for (const link of document.querySelectorAll('[data-language]')) {
    const target = link.dataset.language;
    if (!['ro','en'].includes(target)) continue;
    const url = new URL(link.href);
    if (url.origin !== PUBLIC.domains[target]) continue;
    // Route translations come from each page's generated alternate link.
    url.search = ''; url.searchParams.set('lang-choice',target);
    url.hash = /^#(services|approach|about|contact|web|saas|commerce|integrations)$/.test(location.hash) ? location.hash : '';
    link.href = url.href;
    link.referrerPolicy = 'no-referrer';
  }
}
function showLanguageSuggestion() {
  if (!languageBanner || !production || languageDismissed) return;
  const preferred = preferredLocale(navigator.languages,navigator.language);
  languageBanner.hidden = !languageSuggestion(location.hostname,preferred,PUBLIC.domains);
}
document.querySelectorAll('[data-language-stay]').forEach(button => button.addEventListener('click',dismissLanguage));
document.querySelectorAll('[data-language]').forEach(link => link.addEventListener('click',dismissLanguage));
window.addEventListener('hashchange',decorateLanguageLinks);
window.addEventListener('languagechange',showLanguageSuggestion);
decorateLanguageLinks(); showLanguageSuggestion();
