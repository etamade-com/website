import { brandMark, brandLogo } from './brand.mjs';
import { content } from './content.mjs';
import { privacySections, storageRows } from './privacy.mjs';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHtml;
const linebreaks = s => e(s).replace(/\n/g, '<br>');
const json = v => JSON.stringify(v).replace(/</g, '\\u003c');
export const icons = {
  chevron: '<path d="m9 5 7 7-7 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  diagonal: '<path d="M6 18 18 6M6 6h12v12"/>',
  window: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01M8 13l-2 2 2 2M16 13l2 2-2 2"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  bag: '<path d="M5 7h14l1 14H4L5 7ZM8 8V6a4 4 0 0 1 8 0v2M9 12h6"/>',
  nodes: '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a20 20 0 0 0 0 18 20 20 0 0 0 0-18Z"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
};
export function icon(name, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.code}</svg>`; }
export function organization(site, t) {
  return { '@type':'Organization', '@id':`${site.domains.en}/#organization`, name:site.name, legalName:site.legalName, url:site.domains.en, logo:`${site.domains.en}/logo.svg`, taxID:site.taxId, email:site.email, telephone:site.phone,
    description:t.ai.summary, sameAs:[site.linkedin, site.github],
    address: { '@type':'PostalAddress', streetAddress:site.streetAddress, addressLocality:site.city, addressRegion:site.region, postalCode:site.postalCode, addressCountry:site.country },
    contactPoint: { '@type':'ContactPoint', contactType:'business enquiries', email:site.email, availableLanguage:['en','ro'] }
  };
}
export function layout({lang, type = 'home', body, site, assets}) {
  const t = content[lang], d = t.design, other = lang === 'en' ? 'ro' : 'en';
  const path = t.paths[type] || '/404/';
  const canonical = site.domains[lang] + path;
  const title = type === 'home' ? t.title : `${type === 'privacy' ? t.privacyTitle : type === 'legal' ? t.legalTitle : t.notFound} | ETAMADE`;
  const mdPath = type === 'home' ? '/index.md' : path.replace(/\/$/, '') + '.md';
  const graph = [organization(site, t), { '@type':'WebSite', '@id':`${site.domains[lang]}/#website`, url:site.domains[lang]+'/', name:site.name, inLanguage:lang, publisher:{'@id':`${site.domains.en}/#organization`} },
    { '@type':'WebPage', '@id':canonical, url:canonical, name:title, description:t.description, inLanguage:lang, isPartOf:{'@id':`${site.domains[lang]}/#website`} }];
  if (type === 'home') for (const s of t.services) graph.push({ '@type':'Service', '@id':`${site.domains[lang]}/#${s.id}`, name:s.name, description:s.desc, provider:{'@id':`${site.domains.en}/#organization`} });
  const schema = json({'@context':'https://schema.org','@graph':graph});
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title><meta name="description" content="${e(t.description)}">
<meta name="theme-color" content="#f5f5f7" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#08080a" media="(prefers-color-scheme: dark)"><meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="canonical" href="${e(canonical)}">
${type !== '404' ? ['en','ro'].map(l=>`<link rel="alternate" hreflang="${l}" href="${site.domains[l]}${content[l].paths[type]}">`).join('\n') : ''}
${type !== '404' ? `<link rel="alternate" hreflang="x-default" href="${site.domains.en}${content.en.paths[type]}"><link rel="alternate" type="text/markdown" href="${e(mdPath)}" title="Markdown"><link rel="describedby" href="/llms.txt" type="text/plain">` : '<meta name="robots" content="noindex">'}
<meta property="og:type" content="website"><meta property="og:site_name" content="ETAMADE"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(t.description)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:locale" content="${lang === 'ro' ? 'ro_RO' : 'en_GB'}"><meta property="og:locale:alternate" content="${lang === 'ro' ? 'en_GB' : 'ro_RO'}">
<meta property="og:image" content="${site.domains[lang]}/assets/social-${lang}.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${e(t.hero.join(' '))}"><meta name="twitter:card" content="summary_large_image">
<script src="${assets.theme}"></script><link rel="stylesheet" href="${assets.css}"><script src="${assets.js}" type="module"></script><script src="${assets.privacy}" type="module"></script>
<script type="application/ld+json">${schema}</script>
</head>
<body data-locale="${lang}" data-page="${type}">
<a class="skip-link" href="#main">${e(t.skip)}</a>
<header class="site-header"><div class="container nav-wrap">
<a class="brand" href="/" aria-label="ETAMADE ${lang === 'ro' ? 'pagina principal&#259;' : 'home'}">${brandLogo()}</a>
<nav id="primary-nav" class="primary-nav" aria-label="${lang === 'ro' ? 'Navigare principal&#259;' : 'Main navigation'}">
${['services','approach','about'].map((id,i)=>`<a href="/#${id}">${e(t.nav[i])}</a>`).join('')}
<a class="nav-contact" href="/#contact">${e(t.nav[3])}${icon('diagonal')}</a>
</nav>
<div class="nav-tools"><a class="language-switch" href="${site.domains[other]}${content[other].paths[type] || '/'}" hreflang="${other}" lang="${other}" data-language="${other}" aria-label="${e(t.otherLanguage)}"><span class="current-language" aria-hidden="true">${lang.toUpperCase()}</span><span class="language-divider" aria-hidden="true">/</span><span>${other.toUpperCase()}</span></a>
<button class="theme-toggle" type="button" aria-label="${e(d.changeTheme)}" title="${e(d.changeTheme)}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/></svg></button>
<button class="menu-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" data-open-label="${e(t.menu)}" data-close-label="${e(t.closeMenu)}"><span class="sr-only">${e(t.menu)}</span><span class="menu-bars" aria-hidden="true"></span></button></div>
</div></header>
${languageSuggestionBody(lang, type, site)}
<main id="main">${body}</main>
<footer class="site-footer"><div class="container">
<div class="footer-top"><div><a href="/" class="brand footer-brand" aria-label="ETAMADE">${brandLogo()}</a><p>${e(t.footer)}</p></div><div class="footer-connect"><a class="footer-email" href="mailto:${site.email}">${site.email}${icon('diagonal')}</a><div><a href="${site.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn${icon('diagonal')}</a><a href="${site.github}" target="_blank" rel="noopener noreferrer">GitHub${icon('diagonal')}</a></div></div></div>
<div class="footer-bottom"><p>&copy; ${new Date().getUTCFullYear()} ${e(site.legalName)} <span class="footer-tax">CUI ${site.taxId}</span></p><nav aria-label="${lang === 'ro' ? 'Informa&#539;ii' : 'Information'}"><a href="${t.paths.legal}">${e(t.footerLegal)}</a><a href="${t.paths.privacy}">${e(t.footerPrivacy)}</a><a href="/llms.txt">${e(t.footerAi)}</a><button class="footer-privacy-button" data-privacy-open hidden type="button">${e(t.consent.settings)}</button></nav><div class="appearance-control"><label for="appearance">${e(d.theme)}</label><select id="appearance" aria-label="${e(d.theme)}"><option value="system">${e(d.system)}</option><option value="light">${e(d.light)}</option><option value="dark">${e(d.dark)}</option></select></div></div>
</div></footer>
${consentBody(lang)}
</body></html>`;
}
function serviceArt(index) {
  const art = [
    `<div class="mini-browser"><div class="mini-toolbar"><i></i><i></i><i></i><span></span></div><div class="mini-body"><div class="mini-sidebar"><b></b><i></i><i></i><i></i></div><div class="mini-workspace"><div class="mini-title"></div><div class="mini-line"></div><div class="mini-widget-row"><div><span></span><b></b></div><div><span></span><b></b></div></div><div class="mini-chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div></div>`,
    `<div class="platform-stack"><div class="stack-sheet sheet-back"></div><div class="stack-sheet sheet-mid"><div></div><div></div></div><div class="stack-sheet sheet-front">${brandMark()}<div class="stack-apps"><span>${icon('window')}</span><span>${icon('nodes')}</span><span>${icon('layers')}</span></div></div></div>`,
    `<div class="commerce-art"><div class="store-tile">${icon('bag')}</div><div class="payment-tile"><span class="payment-chip"></span><div class="payment-lines"><i></i><i></i><i></i></div><span class="payment-check">${icon('check')}</span></div></div>`,
    `<div class="connections-art"><div class="connected-node node-a">${icon('window')}</div><div class="connection-wire wire-a"></div><div class="connected-core">${brandMark()}</div><div class="connection-wire wire-b"></div><div class="connected-node node-b">${icon('layers')}</div><div class="connection-wire wire-c"></div><div class="connected-node node-c">${icon('code')}</div></div>`
  ];
  return `<div class="service-art art-${index}" aria-hidden="true">${art[index]}</div>`;
}
export function homeBody(lang, site) {
  const t=content[lang], f=t.form, d=t.design;
  return `<section class="hero"><div class="container hero-copy">
<p class="eyebrow hero-eyebrow">${e(t.eyebrow)}</p>
<h1>${e(t.hero[0])}<span>${e(t.hero[1])}</span></h1>
<p class="hero-intro">${e(t.intro)}</p>
<div class="hero-actions"><a class="button button-primary" href="#contact">${e(t.primary)}${icon('arrow')}</a><a class="text-link" href="#services">${e(t.secondary)}${icon('chevron')}</a></div>
</div>
<div class="hero-stage" role="img" aria-label="${e(d.illustration)}"><div class="stage-halo"></div><div class="stage-orbit"></div>
<div class="floating-tile floating-web" aria-hidden="true"><div class="float-dots"><i></i><i></i><i></i></div><div class="float-rule"></div><div class="float-boxes"><i></i><i></i></div><div class="float-rule short"></div></div>
<img class="hero-sculpture" src="/assets/brand-sculpture.svg" alt="" width="760" height="410" fetchpriority="high">
<div class="floating-tile floating-layers" aria-hidden="true">${icon('layers')}</div><div class="floating-tile floating-code" aria-hidden="true">${icon('code')}</div>
<span class="stage-point point-a" aria-hidden="true"></span><span class="stage-point point-b" aria-hidden="true"></span>
</div>
<p class="hero-note">${e(d.artCaption)}</p>
<div class="capability-strip container">${t.strip.map((s,i)=>`<a href="#${t.services[i].id}">${e(s)}${icon('chevron')}</a>`).join('')}</div>
</section>
<section id="services" class="section services"><div class="container"><div class="section-heading centered reveal"><p class="eyebrow">${e(t.servicesLabel)}</p><h2>${linebreaks(t.servicesTitle)}</h2><p class="section-intro">${e(t.servicesIntro)}</p></div>
<div class="services-grid">${t.services.map((s,i)=>`<article class="service-card reveal" id="${s.id}"><div class="service-copy"><p class="service-kicker">${e(d.serviceMini[i])}</p><h3>${e(s.name)}</h3><p>${e(s.desc)}</p></div>${serviceArt(i)}<details class="service-details"><summary><span>${e(d.serviceDetails)}<span class="sr-only">: ${e(s.name)}</span></span><span class="plus-circle">${icon('plus')}</span></summary><div class="service-expanded"><ul>${s.items.map(item=>`<li>${icon('check')}${e(item)}</li>`).join('')}</ul><a class="text-link" href="#contact" data-service="${s.id}">${e(d.discuss)}${icon('arrow')}</a></div></details></article>`).join('')}</div>
<p class="illustration-note">${e(d.artDisclaimer)}</p>
<div class="support-note reveal"><span class="support-icon">${icon('layers')}</span><div><h3>${e(t.support)}</h3><p>${e(t.supportText)}</p></div><a href="#contact" class="round-link" data-service="maintenance" aria-label="${e(t.support)}">${icon('arrow')}</a></div>
</div></section>
<section id="approach" class="section approach"><div class="container"><div class="section-heading centered reveal"><p class="eyebrow">${e(t.approachLabel)}</p><h2>${linebreaks(t.approachTitle)}</h2><p class="section-intro">${e(t.approachIntro)}</p></div><ol class="steps">${t.steps.map(([title,desc],i)=>`<li class="reveal"><div class="step-track"><span class="step-num">0${i+1}</span><span class="step-line" aria-hidden="true"></span></div><h3>${e(title)}</h3><p>${e(desc)}</p></li>`).join('')}</ol><p class="approach-signoff">${e(t.heroNote)}</p></div></section>
<section id="about" class="section about"><div class="container about-grid"><div class="about-copy reveal"><p class="eyebrow">${e(t.aboutLabel)}</p><h2>${linebreaks(t.aboutTitle)}</h2>${t.about.map(p=>`<p class="about-text">${e(p)}</p>`).join('')}<div class="about-links"><a class="text-link" href="${site.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn${icon('diagonal')}</a><a class="text-link" href="${site.github}" target="_blank" rel="noopener noreferrer">GitHub${icon('diagonal')}</a></div></div><aside class="brand-story reveal"><div class="brand-story-art" aria-hidden="true">${brandMark()}</div><h3>${e(d.brandTitle)}</h3><p>${e(d.brandText)}</p><div class="brand-formula"><div><strong>eta</strong><span>${e(d.brandLeft)}</span></div><span aria-hidden="true">+</span><div><strong>made</strong><span>${e(d.brandRight)}</span></div></div></aside></div></section>
<section class="section faq"><div class="container faq-grid"><div class="reveal"><p class="eyebrow">${e(t.faqLabel)}</p><h2>${e(t.faqTitle)}</h2></div><div class="faq-items">${t.faqs.map(([q,a])=>`<details><summary>${e(q)}<span class="faq-plus" aria-hidden="true">${icon('plus')}</span></summary><p>${e(a)}</p></details>`).join('')}</div></div></section>
<section id="contact" class="section contact"><div class="container contact-grid"><div class="contact-copy"><p class="eyebrow">${e(t.contactLabel)}</p><h2>${linebreaks(t.contactTitle)}</h2><p class="contact-intro">${e(t.contactIntro)}</p><div class="contact-direct"><small>${e(t.contactEmail)}</small><a href="mailto:${site.email}">${site.email}${icon('diagonal')}</a></div><div class="contact-location">${icon('globe')}<div><strong>${e(t.contactWhere)}</strong><p>${e(t.contactWhereText)}</p></div></div></div>
<form id="contact-form" action="/api/contact" method="post" class="contact-form" aria-label="${e(t.nav[3])}">
<div class="form-row"><div class="field"><label for="name">${e(f.name)} <span aria-hidden="true">*</span></label><input id="name" name="name" autocomplete="name" placeholder="${e(f.namePlaceholder)}" minlength="2" maxlength="100" required></div><div class="field"><label for="email">${e(f.email)} <span aria-hidden="true">*</span></label><input id="email" name="email" type="email" autocomplete="email" placeholder="${e(f.emailPlaceholder)}" maxlength="254" required></div></div>
<div class="form-row"><div class="field"><label for="company">${e(f.company)} <small>(${e(f.optional)})</small></label><input id="company" name="company" autocomplete="organization" placeholder="${e(f.companyPlaceholder)}" maxlength="120"></div><div class="field"><label for="service">${e(f.service)}</label><select id="service" name="service"><option value="other">${e(f.choose)}</option>${f.services.map(([id,name])=>`<option value="${id}">${e(name)}</option>`).join('')}</select></div></div>
<div class="field"><label for="message">${e(f.message)} <span aria-hidden="true">*</span></label><textarea id="message" name="message" minlength="20" maxlength="5000" rows="5" placeholder="${e(f.messagePlaceholder)}" aria-describedby="message-hint" required></textarea><small id="message-hint" class="field-hint">${e(f.hint)}</small></div>
<div class="honeypot" aria-hidden="true"><label for="website">Website</label><input id="website" name="website" tabindex="-1" autocomplete="off" maxlength="200"></div>
<label class="privacy-check"><input name="privacyAcknowledged" type="checkbox" required><span>${e(f.privacyPrefix)} <a href="${t.paths.privacy}" target="_blank" rel="noopener">${e(f.privacyLink)}</a> ${e(f.privacySuffix)}</span></label>
<div id="turnstile-container" class="turnstile-container"></div><p id="form-status" class="form-status" role="status" aria-live="polite" aria-atomic="true" tabindex="-1"></p>
<button id="submit-button" class="button button-primary form-submit" type="submit" disabled><span>${e(f.submit)}</span>${icon('diagonal')}</button><p class="form-security">${e(f.protected)} <a href="https://www.cloudflare.com/turnstile-privacy-policy/" target="_blank" rel="noopener noreferrer">${e(f.privacyCloudflare)}</a></p>
<noscript><p class="form-status">${e(f.javascript)} <a href="mailto:${site.email}">${site.email}</a></p></noscript>
</form></div></section>`;
}
export function legalBody(lang, site) {
  const t=content[lang];
  const vals=[site.legalName,site.taxId,`${site.streetAddress}, ${site.city}, ${site.region}, ${site.postalCode}, ${lang==='ro'?'Rom\u00e2nia':'Romania'}`,site.email,site.phoneDisplay,site.tradeRegisterNumber,site.shareCapital];
  return `<section class="section legal-page"><div class="container prose"><a class="text-link back-link" href="/">&larr; ${e(t.back)}</a><p class="eyebrow">ETAMADE S.R.L.</p><h1>${e(t.legalTitle)}</h1><p class="prose-intro">${e(t.legalIntro)}</p><dl class="company-details">${vals.map((v,i)=>v?`<div><dt>${e(t.legalLabels[i])}</dt><dd>${i===3?`<a href="mailto:${e(v)}">${e(v)}</a>`:e(v)}</dd></div>`:'').join('')}</dl>${t.legalSections.map(([a,b])=>`<h2>${e(a)}</h2><p>${e(b)}</p>`).join('')}<p><a href="${site.linkedin}">LinkedIn</a> &middot; <a href="${site.github}">GitHub</a></p></div></section>`;
}
export function privacyBody(lang, site) {
  const t=content[lang];
  return `<section class="section legal-page"><div class="container prose"><a class="text-link back-link" href="/">&larr; ${e(t.back)}</a><p class="eyebrow">ETAMADE S.R.L.</p><h1>${e(t.privacyTitle)}</h1><p class="updated">${e(t.updated)}: <time datetime="${site.privacyUpdated}">${site.privacyUpdated}</time></p>${privacySections(lang,site).map(([a,b])=>`<h2>${e(a)}</h2><p>${e(b)}</p>`).join('')}${cookieTable(lang)}<p><button type="button" class="button privacy-policy-action" data-privacy-open hidden>${e(t.consent.policyAction)}</button></p><p><a href="https://policies.google.com/technologies/partner-sites?hl=${lang}" target="_blank" rel="noopener noreferrer">${e(t.consent.provider)}</a> &middot; <a href="https://www.cloudflare.com/turnstile-privacy-policy/">Cloudflare Turnstile</a> &middot; <a href="https://www.dataprotection.ro/">ANSPDCP</a> &middot; <a href="mailto:${site.email}">${site.email}</a></p></div></section>`;
}
export function notFoundBody(lang) {
  const t=content[lang]; return `<section class="section error-page"><div class="container"><p class="eyebrow">404</p><h1>${e(t.notFound)}</h1><p>${e(t.notFoundText)}</p><a class="button button-primary" href="/">${e(t.back)}${icon('arrow')}</a></div></section>`;
}

function languageSuggestionBody(lang, type, site) {
  const t = content[lang], p = t.languagePrompt, other = lang === 'en' ? 'ro' : 'en';
  return `<aside id="language-suggestion" class="language-suggestion" lang="${other}" aria-labelledby="language-title" hidden><div class="container language-inner"><div class="language-message">${icon('globe')}<p><strong id="language-title">${e(p.title)}</strong> <span>${e(p.text)}</span></p></div><div class="language-actions"><a href="${site.domains[other]}${content[other].paths[type] || '/'}" data-language="${other}" hreflang="${other}" class="language-go">${e(p.go)}${icon('arrow')}</a><button type="button" data-language-stay class="language-stay">${e(p.stay)}</button></div><button type="button" data-language-stay class="language-dismiss" aria-label="${e(p.close)}">${icon('plus')}</button></div></aside>`;
}
function shieldIcon() {
  return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.3 2.3 4.7-4.7"/></svg>';
}
function consentBody(lang) {
  const t = content[lang], c = t.consent;
  return `<section id="consent-banner" class="consent-banner" role="region" aria-labelledby="consent-title" hidden>
<div class="consent-heading"><div><p class="eyebrow">${e(c.eyebrow)}</p><h2 id="consent-title">${e(c.title)}</h2></div><span class="privacy-emblem">${shieldIcon()}</span></div>
<p class="consent-copy">${e(c.text)}</p>
<div class="consent-actions"><button type="button" class="consent-choice" data-consent-reject>${e(c.reject)}</button><button type="button" class="consent-choice" data-consent-accept>${e(c.accept)}</button></div>
<div class="consent-links"><button type="button" data-privacy-open>${e(c.manage)}</button><a href="${t.paths.privacy}">${e(c.details)}</a></div>
</section>
<dialog id="privacy-dialog" class="privacy-dialog" aria-labelledby="privacy-title" aria-describedby="privacy-intro">
<div class="privacy-dialog-head"><div><p class="eyebrow">${e(c.eyebrow)}</p><h2 id="privacy-title">${e(c.dialogTitle)}</h2></div><button type="button" data-privacy-close class="privacy-close" aria-label="${e(c.close)}" autofocus>${icon('plus')}</button></div>
<p id="privacy-intro" class="privacy-intro">${e(c.dialogIntro)}</p>
<div class="privacy-category"><div class="privacy-category-heading"><h3>${e(c.essential)}</h3><span class="essential-badge">${e(c.always)}</span></div><p>${e(c.essentialText)}</p></div>
<div class="privacy-category"><div class="privacy-category-heading"><label for="analytics-consent">${e(c.analytics)}</label><label class="privacy-switch"><span class="sr-only">${e(c.analytics)}</span><input type="checkbox" id="analytics-consent" name="analytics" role="switch" aria-describedby="analytics-description"><span class="switch-track" aria-hidden="true"></span></label></div><p id="analytics-description">${e(c.analyticsText)}</p></div>
<p class="privacy-retention">${e(c.retention)} <a href="${t.paths.privacy}">${e(c.details)}</a>.</p>
<div class="consent-actions"><button type="button" class="consent-choice" data-consent-reject>${e(c.reject)}</button><button type="button" class="consent-choice" data-consent-accept>${e(c.accept)}</button></div><button type="button" class="button button-primary privacy-save" data-consent-save>${e(c.save)}</button>
</dialog>
<button id="privacy-launcher" class="privacy-launcher" data-privacy-open hidden type="button">${shieldIcon()}</button>
<p id="privacy-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
<noscript><p class="container privacy-noscript">${e(c.noJs)}</p></noscript>`;
}
function cookieTable(lang) {
  const c = content[lang].consent;
  return `<h2>${e(c.tableTitle)}</h2><div class="storage-table-wrap"><table class="storage-table"><thead><tr><th scope="col">${e(c.item)}</th><th scope="col">${e(c.purpose)}</th><th scope="col">${e(c.duration)}</th></tr></thead><tbody>${storageRows(lang).map(([name,purpose,duration])=>`<tr><th scope="row"><code>${e(name)}</code></th><td>${e(purpose)}</td><td>${e(duration)}</td></tr>`).join('')}</tbody></table></div>`;
}
