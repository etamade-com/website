/** Shared, side-effect-free consent and analytics validation.
 * Bundled verbatim into both browser runtimes. Never accept arbitrary event data.
 */
export const PRIVACY = Object.freeze({
  version: '2026-09-27.1',
  storageKey: 'etamade-consent-v1',
  languageKey: 'etamade-language-v1',
  lifetimeDays: 180,
  cookieSeconds: 180 * 24 * 60 * 60,
  retentionMonths: 2
});
const METHODS = new Set(['accept', 'reject', 'save']);
export function makeConsent(analytics, method = 'save', now = Date.now()) {
  return { version: PRIVACY.version, analytics: analytics === true,
    decidedAt: now, expiresAt: now + PRIVACY.cookieSeconds * 1000,
    method: METHODS.has(method) ? method : 'save' };
}
export function parseConsent(value, now = Date.now()) {
  try {
    const choice = typeof value === 'string' ? JSON.parse(value) : value;
    if (!choice || choice.version !== PRIVACY.version || typeof choice.analytics !== 'boolean' ||
        !Number.isSafeInteger(choice.decidedAt) || !Number.isSafeInteger(choice.expiresAt) ||
        choice.decidedAt < 0 || choice.decidedAt > now || choice.expiresAt <= now ||
        choice.expiresAt !== choice.decidedAt + PRIVACY.cookieSeconds * 1000 || !METHODS.has(choice.method)) return null;
    return {version:choice.version, analytics:choice.analytics, decidedAt:choice.decidedAt, expiresAt:choice.expiresAt, method:choice.method};
  } catch { return null; }
}
export function preferredLocale(languages, language) {
  // Only the FIRST preference counts: English is a common fallback for other languages.
  const first = Array.isArray(languages) && languages.length ? languages[0] : language;
  if (typeof first !== 'string') return null;
  const base = first.trim().toLowerCase().split(/[-_]/)[0];
  return ['ro', 'en'].includes(base) ? base : null;
}
export function isProductionHost(hostname, domains) {
  return Object.values(domains).some(origin => new URL(origin).hostname === hostname);
}
export function languageSuggestion(hostname, preferred, domains) {
  if (!preferred || !isProductionHost(hostname, domains)) return null;
  return new URL(domains[preferred]).hostname === hostname ? null : preferred;
}
export function safePage(rawUrl, locale, domains, paths, titles) {
  const url = new URL(rawUrl);
  if (!isProductionHost(url.hostname, domains) || !['en','ro'].includes(locale) || url.origin !== domains[locale]) return null;
  const page = Object.keys(paths[locale]).find(key => paths[locale][key] === url.pathname) || '404';
  return {
    page_location: domains[locale] + (paths[locale][page] || '/404/'),
    page_title: titles[locale][page] || 'ETAMADE',
    page_referrer: '',
    site_language: locale,
    language: locale
  };
}
const SERVICES = new Set(['web','saas','commerce','integrations','maintenance','other']);
const SECTIONS = new Set(['services','approach','about','contact']);
const PLACEMENTS = new Set(['header','hero','service','footer','content','language_prompt']);
export function sanitizeActivity(name, input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const data = {};
  switch (name) {
    case 'page_view': case 'contact_start': case 'contact_submit': case 'generate_lead': break;
    case 'service_open': case 'select_service':
      if (!SERVICES.has(source.service)) return null;
      data.service = source.service; break;
    case 'faq_open':
      if (!Number.isInteger(source.question) || source.question < 1 || source.question > 4) return null;
      data.question = source.question; break;
    case 'section_view':
      if (!SECTIONS.has(source.section)) return null;
      data.section = source.section; break;
    case 'scroll_depth':
      if (![25,50,75,90].includes(source.percent)) return null;
      data.percent = source.percent; break;
    case 'language_switch':
      if (!['en','ro'].includes(source.target_language)) return null;
      data.target_language = source.target_language; break;
    case 'cta_click':
      if (!['home','services','approach','about','contact','privacy','legal','ai'].includes(source.target)) return null;
      data.target = source.target;
      if (PLACEMENTS.has(source.placement)) data.placement = source.placement;
      break;
    case 'outbound_click':
      if (!['linkedin','github','email','phone'].includes(source.target)) return null;
      data.target = source.target; break;
    case 'contact_error':
      if (!['invalid','blocked','turnstile','rate_limited','upstream','unavailable','network'].includes(source.code)) return null;
      data.code = source.code; break;
    case 'engagement_time':
      if (!Number.isInteger(source.engagement_time_msec) || source.engagement_time_msec < 1 || source.engagement_time_msec > 60000) return null;
      data.engagement_time_msec = source.engagement_time_msec; break;
    default: return null;
  }
  return {name, params:data};
}
export function analyticsCookieNames(cookieString) {
  return String(cookieString).split(';').map(item => item.trim().split('=')[0])
    .filter(name => /^_ga(?:_|$)/.test(name));
}
