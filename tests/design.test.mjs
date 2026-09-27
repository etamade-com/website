import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {content} from '../src/content.mjs';
import {site} from '../src/site.config.mjs';
import {brandMark} from '../src/brand.mjs';
const text=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
for(const lang of ['en','ro']) {
  test(`${lang}: new brand copy and service descriptions are pre-rendered`,async()=>{
    const html=await text(`dist/_site/${lang}/index.html`);
    for(const line of content[lang].hero) assert.ok(html.includes(line));
    assert.ok(html.includes('class="hero-sculpture"'));
    for(const service of content[lang].services) assert.ok(html.includes(`id="${service.id}"`));
    assert.equal((html.match(/class="service-details"/g)||[]).length,4);
  });
  test(`${lang}: all local resource references exist in dist`,async()=>{
    const html=await text(`dist/_site/${lang}/index.html`);
    const refs=[...html.matchAll(/(?:src|href)="(\/(?:assets\/[^"#]+|favicon\.svg))"/g)];
    assert.ok(refs.length>=6);
    for(const match of refs) await access(new URL('../dist'+match[1],import.meta.url));
  });
  test(`${lang}: appearance init precedes stylesheet, no inline executable/style blocks`,async()=>{
    const html=await text(`dist/_site/${lang}/index.html`);
    assert.ok(html.indexOf('<script src="/assets/theme.')<html.indexOf('<link rel="stylesheet"'));
    assert.match(html,/<meta name="color-scheme" content="light dark">/);
    assert.ok(!/ style=|<style\b|on(?:click|load|error)=/.test(html));
    for(const script of html.matchAll(/<script([^>]*)>/g)) assert.ok(/\bsrc=|application\/ld\+json/.test(script[1]));
  });
  test(`${lang}: theme controls and visible labels are localized`,async()=>{
    const html=await text(`dist/_site/${lang}/index.html`);
    assert.ok(html.includes(`>${content[lang].design.light}</option>`));
    assert.ok(html.includes(`>${content[lang].design.dark}</option>`));
    assert.ok(html.includes('aria-controls="primary-nav" aria-expanded="false"'));
    assert.ok(html.includes('prefers-color-scheme: dark'));
  });
  test(`${lang}: AI files include the revised brand description`,async()=>{
    const md=await text(`dist/_site/${lang}/index.md`);
    assert.ok(md.includes(content[lang].design.brandText));
    assert.ok(md.includes(content[lang].hero.join(' ')));
    const company=JSON.parse(await text(`dist/_site/${lang}/company.json`));
    assert.equal(company.organization.legalName,site.legalName);
    assert.equal(company.services.length,4);
  });
  test(`${lang}: privacy notice documents the local theme preference`,async()=>{
    const html=await text(`dist/_site/${lang}/privacy/index.html`);
    assert.ok(html.includes('etamade-appearance'));
    assert.ok(html.includes('2026-09-27'));
  });
}
test('owner favicon remains byte-identical, including its media query',async()=>{
  const source=await text('public/favicon.svg');
  assert.equal(createHash('sha256').update(source).digest('hex'),'c5a55eedbe07ce71e365cd10a43f2549fe410786500a30c2c9addf7b01398530');
  assert.equal(source,await text('dist/favicon.svg'));
  assert.ok(source.includes('@media (prefers-color-scheme:dark)'));
});
test('inline brand reuses the supplied path but inherits page color',async()=>{
  const source=await text('public/favicon.svg');
  const path=source.match(/\sd="([^"]+)"/)[1];
  assert.ok(brandMark().includes(path));
  assert.ok(brandMark().includes('fill="currentColor"'));
  assert.ok(!brandMark().includes('<style'));
});
test('reduced motion and no-JavaScript fallbacks are present',async()=>{
  const css=await text('public/assets/site.css');
  const js=await text('src/browser.js');
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(css.includes('.js .primary-nav'));
  assert.ok(css.includes('.reveal.is-reveal-ready'));
  assert.ok(js.includes("'IntersectionObserver' in window"));
  assert.ok(js.includes("window.addEventListener('beforeprint'"));
});
test('contact theme re-render retains server verification and immutable recipient model',async()=>{
  const js=await text('src/browser.js');
  assert.ok(js.includes('theme: resolvedTheme()'));
  assert.ok(js.includes("action: 'contact'"));
  assert.ok(js.includes("if (busy || !enabled"));
  assert.ok(js.includes('turnstileToken: token'));
  assert.ok(!js.includes('CONTACT_TO'));
});
test('no remote font stylesheet or font binaries required',async()=>{
  const html=await text('dist/_site/en/index.html');
  const css=await text('public/assets/site.css');
  assert.ok(!html.includes('fonts.googleapis'));
  assert.ok(!css.includes('@font-face'));
});
