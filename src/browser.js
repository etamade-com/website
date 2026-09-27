// Enhanced interactions only. All public content is rendered at build time.
// __FORM_TRANSLATIONS__ is replaced by the build script.
const translations = /*__FORM_TRANSLATIONS__*/ {};
const locale = document.documentElement.lang === 'ro' ? 'ro' : 'en';
const t = translations[locale];
document.documentElement.classList.add('js');

// A local, optional display preference. No analytics or cross-domain identifier.
const appearance = document.querySelector('#appearance');
const themeButton = document.querySelector('.theme-toggle');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
let preference = document.documentElement.dataset.theme || 'system';
function resolvedTheme() {
  return preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
}
let lastTheme = resolvedTheme();
function applyAppearance(value, persist = false) {
  preference = ['light','dark'].includes(value) ? value : 'system';
  if (preference === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = preference;
  if (appearance) appearance.value = preference;
  if (persist) {
    try {
      if (preference === 'system') localStorage.removeItem('etamade-appearance');
      else localStorage.setItem('etamade-appearance', preference);
    } catch { /* Private browsing/storage restrictions are supported. */ }
  }
  if (themeButton && appearance) {
    const label = document.querySelector('label[for="appearance"]').textContent;
    const state = appearance.selectedOptions[0].textContent;
    themeButton.setAttribute('aria-label', `${label}: ${state}`);
    themeButton.title = `${label}: ${state}`;
  }
  const effective = resolvedTheme();
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.content = effective === 'dark' ? '#08080a' : '#f5f5f7';
  });
  if (effective !== lastTheme) {
    lastTheme = effective;
    window.dispatchEvent(new CustomEvent('etamade:theme', { detail: {theme: effective} }));
  }
}
applyAppearance(preference);
appearance?.addEventListener('change', () => applyAppearance(appearance.value, true));
themeButton?.addEventListener('click', () => {
  applyAppearance(resolvedTheme() === 'dark' ? 'light' : 'dark', true);
});
systemTheme.addEventListener('change', () => applyAppearance(preference));
window.addEventListener('storage', event => {
  if (event.key === 'etamade-appearance') applyAppearance(event.newValue || 'system');
});

// Only off-screen sections fade in; all content stays visible without JS.
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (!motion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.remove('is-reveal-ready');
      observer.unobserve(entry.target);
    }
  }, {threshold: 0.06, rootMargin: '0px 0px 35px 0px'});
  document.querySelectorAll('.reveal').forEach(element => {
    if (element.getBoundingClientRect().top > window.innerHeight) {
      element.classList.add('is-reveal-ready');
      observer.observe(element);
    }
  });
  const showAll = () => {
    observer.disconnect();
    document.querySelectorAll('.is-reveal-ready').forEach(el => el.classList.remove('is-reveal-ready'));
  };
  motion.addEventListener('change', event => { if (event.matches) showAll(); });
  window.addEventListener('beforeprint', showAll);
  document.addEventListener('focusin', event => event.target.closest('.reveal')?.classList.remove('is-reveal-ready'));
}


const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-nav');
function closeMenu(returnFocus = false) {
  navigation?.classList.remove('is-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  if (menuButton) menuButton.querySelector('span').textContent = menuButton.dataset.openLabel;
  if (returnFocus) menuButton?.focus();
}
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.querySelector('span').textContent = open ? menuButton.dataset.closeLabel : menuButton.dataset.openLabel;
  navigation.classList.toggle('is-open', open);
});
navigation?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') closeMenu(true); });

document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
window.matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

// Local / pages.dev language previews never change production host routing.
const preview = ['localhost','127.0.0.1','[::1]'].includes(location.hostname) || location.hostname.endsWith('.pages.dev');
if (preview) {
  document.querySelectorAll('a[href^="/"]').forEach(link => {
    const target = new URL(link.getAttribute('href'), location.origin);
    target.searchParams.set('lang', locale);
    link.href = target.toString();
  });
  document.querySelectorAll('[data-language]').forEach(link => {
    const target = new URL(link.href);
    target.host = location.host;
    target.protocol = location.protocol;
    target.searchParams.set('lang', link.dataset.language);
    link.href = target.toString();
  });
}

document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => {
  const select = document.querySelector('#service');
  if (select) select.value = link.dataset.service;
}));

const form = document.querySelector('#contact-form');
if (form && t) initialiseContact(form);

function initialiseContact(form) {
  const submit = document.querySelector('#submit-button');
  const submitText = submit.querySelector('span');
  const status = document.querySelector('#form-status');
  let token = '', widgetId = null, busy = false, enabled = false, started = false;
  let preserveStatus = false, challengeConfig = null, renderedTheme = null;
  function setStatus(key, state = 'waiting', reference = '') {
    status.textContent = t.status[key] || t.status.upstream;
    if (reference) status.textContent += ` ${t.status.reference}: ${reference}`;
    status.dataset.state = state;
  }
  function updateButton() { submit.disabled = !enabled || !token || busy; }
  function clearToken() { token = ''; updateButton(); }
  function resetChallenge() {
    clearToken();
    if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
  }
  function renderChallenge() {
    clearToken();
    if (widgetId !== null && window.turnstile) window.turnstile.remove(widgetId);
    widgetId = null;
    renderedTheme = resolvedTheme();
      widgetId = window.turnstile.render('#turnstile-container', {
        sitekey: challengeConfig.siteKey,
        action: 'contact',
        language: locale,
        theme: resolvedTheme(),
        size: document.querySelector('#turnstile-container').clientWidth < 300 ? 'compact' : 'flexible',
        appearance: 'always',
        'response-field': false,
        callback(value) {
          token = value;
          updateButton();
          if (!preserveStatus) setStatus('ready');
        },
        'expired-callback'() {
          clearToken();
          if (!preserveStatus) setStatus('turnstile', 'error');
        },
        'error-callback'() {
          clearToken();
          if (!preserveStatus) setStatus('turnstile', 'error');
        },
        'timeout-callback'() {
          clearToken();
          if (!preserveStatus) setStatus('turnstile', 'error');
        }
      });
  }
  window.addEventListener('etamade:theme', () => {
    if (busy || !enabled || !challengeConfig || !window.turnstile || renderedTheme === resolvedTheme()) return;
    try { renderChallenge(); } catch {
      enabled = false; clearToken(); setStatus('unavailable', 'error');
    }
  });
  async function start() {
    if (started) return;
    started = true;
    setStatus('loading');
    try {
      const response = await fetch('/api/config', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('configuration unavailable');
      const config = await response.json();
      if (!config.enabled || !config.siteKey) throw new Error('form disabled');
      await loadTurnstile();
      enabled = true;
      challengeConfig = config;
      renderChallenge();
      if (!token) setStatus('waiting');
    } catch {
      enabled = false;
      setStatus('unavailable', 'error');
      updateButton();
    }
  }
  form.addEventListener('focusin', start, { once: true });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { start(); observer.disconnect(); }
    }, { rootMargin: '180px' });
    observer.observe(form);
  } else start();
  form.addEventListener('input', () => {
    if (preserveStatus && !busy) {
      preserveStatus = false;
      status.textContent = '';
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (!form.reportValidity()) return;
    if (!enabled || !token) { setStatus('turnstile', 'error'); return; }
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      company: String(data.get('company') || '').trim(),
      service: String(data.get('service') || 'other'),
      message: String(data.get('message') || '').trim(),
      website: String(data.get('website') || ''),
      privacyAcknowledged: data.get('privacyAcknowledged') === 'on',
      turnstileToken: token,
      locale
    };
    window.dispatchEvent(new CustomEvent('etamade:activity',{detail:{name:'contact_submit'}}));
    busy = true;
    preserveStatus = true;
    updateButton();
    submitText.textContent = t.sending;
    status.textContent = '';
    try {
      const response = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify(payload), signal: AbortSignal.timeout(25000)
      });
      const result = await response.json();
      if (response.ok && result.ok === true) {
        window.dispatchEvent(new CustomEvent('etamade:activity',{detail:{name:'generate_lead'}}));
        form.reset();
        setStatus('success', 'success', typeof result.reference === 'string' ? result.reference : '');
      } else {
        const supported = ['invalid','blocked','turnstile','rate_limited','upstream','unavailable'];
        const errorCode = supported.includes(result.code) ? result.code : 'upstream';
        window.dispatchEvent(new CustomEvent('etamade:activity',{detail:{name:'contact_error',params:{code:errorCode}}}));
        setStatus(errorCode, 'error');
      }
    } catch {
      // A connection loss does not prove that the backend failed to send.
      window.dispatchEvent(new CustomEvent('etamade:activity',{detail:{name:'contact_error',params:{code:'network'}}}));
      setStatus('network', 'error');
    } finally {
      busy = false;
      submitText.textContent = t.submit;
      if (renderedTheme !== resolvedTheme() && challengeConfig) {
        try { renderChallenge(); } catch { enabled = false; clearToken(); }
      } else resetChallenge();
      status.focus({ preventScroll: true });
    }
  });
}

let turnstilePromise;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (turnstilePromise) return turnstilePromise;
  turnstilePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => reject(new Error('challenge load timeout')), 15000);
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => { clearTimeout(timeout); window.turnstile ? resolve() : reject(new Error('challenge missing')); };
    script.onerror = () => { clearTimeout(timeout); reject(new Error('challenge load failed')); };
    document.head.appendChild(script);
  });
  return turnstilePromise;
}
