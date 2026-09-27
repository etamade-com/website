import { mkdir, rm, cp, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PRIVACY } from '../src/privacy-model.mjs';
import { site } from '../src/site.config.mjs';
import { content } from '../src/content.mjs';
import { privacySections, storageRows } from '../src/privacy.mjs';
import { layout, homeBody, legalBody, privacyBody, notFoundBody, organization, escapeHtml } from '../src/templates.mjs';

const root=join(dirname(fileURLToPath(import.meta.url)),'..'), out=join(root,'dist');
const hash=text=>createHash('sha256').update(text).digest('hex').slice(0,12);
const write=async(path,data)=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,data);};
const exists=async(path)=>{try{await access(path);return true;}catch{return false;}};
async function walk(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=join(dir,entry.name);result.push(...entry.isDirectory()?await walk(p):[p]);}return result;}
const types={'.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.md':'text/markdown; charset=utf-8','.html':'text/html; charset=utf-8'};
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await cp(join(root,'public'),out,{recursive:true});
// Preserve existing public domain-verification and mail-policy assets when this
// package is merged into the current repository. Nothing else is copied.
for(const old of ['.well-known','bimi-logo.svg']) if(await exists(join(root,old))) await cp(join(root,old),join(out,old),{recursive:true});
const css=await readFile(join(root,'public/assets/site.css'),'utf8');
const browser=(await readFile(join(root,'src/browser.js'),'utf8')).replace('/*__FORM_TRANSLATIONS__*/ {}',JSON.stringify({en:content.en.form,ro:content.ro.form}));
const theme=await readFile(join(root,'public/assets/theme.js'),'utf8');
const privacyModel=(await readFile(join(root,'src/privacy-model.mjs'),'utf8')).replace(/^export /gm,'');
const privacyPublic={domains:site.domains,paths:{en:content.en.paths,ro:content.ro.paths},
  labels:{en:content.en.consent,ro:content.ro.consent},
  titles:Object.fromEntries(['en','ro'].map(lang=>[lang,{home:content[lang].title,privacy:content[lang].privacyTitle+' | ETAMADE',legal:content[lang].legalTitle+' | ETAMADE','404':content[lang].notFound+' | ETAMADE'}]))};
async function privacyBundle(file){return privacyModel+'\n'+(await readFile(join(root,'src',file),'utf8')).replace('/*__PRIVACY_PUBLIC__*/ {}',JSON.stringify(privacyPublic));}
const privacyBrowser=await privacyBundle('privacy-browser.js'),analyticsBrowser=await privacyBundle('analytics-frame.js');
const assets={theme:`/assets/theme.${hash(theme)}.js`,css:`/assets/site.${hash(css)}.css`,js:`/assets/site.${hash(browser)}.js`,
  privacy:`/assets/privacy.${hash(privacyBrowser)}.js`,analytics:`/assets/analytics.${hash(analyticsBrowser)}.js`};
await write(join(out,assets.theme),theme);await rm(join(out,'assets/theme.js'),{force:true});
await write(join(out,assets.css),css);await write(join(out,assets.js),browser);
await write(join(out,assets.privacy),privacyBrowser);await write(join(out,assets.analytics),analyticsBrowser);
await rm(join(out,'assets/site.css'),{force:true});
const publicFiles=(await walk(out)).map(f=>'/'+relative(out,f).split('\\').join('/'));
const assetTypes=Object.fromEntries(publicFiles.map(f=>[f,types[extname(f)]||'application/octet-stream']));
const manifest={analyticsScript:assets.analytics,privacyVersion:PRIVACY.version,domains:site.domains,pagesHost:site.pagesHost,paths:{en:content.en.paths,ro:content.ro.paths},routes:{en:{},ro:{}},notFound:{},publicFiles,assetTypes,schemaHashes:[]};
const schemaHashes=new Set();
function rememberSchema(html){for(const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))schemaHashes.add(`'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);}
const markdownPath=(type,t)=>type==='home'?'/index.md':t.paths[type].replace(/\/$/,'')+'.md';
for(const lang of ['en','ro']){
  const t=content[lang], base=`/_site/${lang}`;
  const add=async(publicPath,asset,body,type)=>{await write(join(out,asset),body);manifest.routes[lang][publicPath]={asset,type};};
  for(const type of ['home','privacy','legal','404']){
    const body=type==='home'?homeBody(lang,site):type==='privacy'?privacyBody(lang,site):type==='legal'?legalBody(lang,site):notFoundBody(lang);
    const html=layout({lang,type,body,site,assets});rememberSchema(html);
    const asset=type==='home'?`${base}/`:`${base}/${type}/`;
    await write(join(out,asset,'index.html'),html);
    const route={asset,type:'text/html; charset=utf-8',...(type!=='404'?{markdown:markdownPath(type,t)}:{})};
    if(type==='404')manifest.notFound[lang]=route;else manifest.routes[lang][t.paths[type]]=route;
    if(lang==='en'&&(type==='home'||type==='404'))await write(join(out,type==='home'?'index.html':'404.html'),html);
  }
  const services=`# ${t.ai.services}\n\n${t.servicesIntro}\n\n${t.services.map(s=>`## ${s.name}\n\n${s.desc}\n\n${s.items.map(i=>`- ${i}`).join('\n')}`).join('\n\n')}\n\n## ${t.support}\n\n${t.supportText}\n`;
  const contact=`# ${t.ai.contact}\n\n${site.legalName}\n\n- Email: ${site.email}\n- ${t.legalLabels[4]}: ${site.phoneDisplay}\n- ${t.nav[3]}: ${site.domains[lang]}/#contact\n- LinkedIn: ${site.linkedin}\n- GitHub: ${site.github}\n\n${t.contactIntro}\n\n${t.form.hint}\n\n${t.ai.note}\n`;
  const home=`# ETAMADE\n\n> ${t.ai.summary}\n\n${t.hero.join(' ')}\n\n${t.intro}\n\n## ${t.design.brandTitle}\n\n${t.design.brandText}\n\n## ${t.aboutTitle.replace(/\n/g,' ')}\n\n${t.about.join('\n\n')}\n\n${services.replace(/^(#{1,2}) /gm,'#$1 ')}\n\n## ${t.approachTitle.replace(/\n/g,' ')}\n\n${t.approachIntro}\n\n${t.steps.map(([h,p])=>`### ${h}\n\n${p}`).join('\n\n')}\n\n## ${t.faqTitle}\n\n${t.faqs.map(([h,p])=>`### ${h}\n\n${p}`).join('\n\n')}\n\n${contact.replace(/^# /,'## ')}\n`;
  const legalVals=[site.legalName,site.taxId,`${site.streetAddress}, ${site.city}, ${site.region}, ${site.postalCode}, ${lang==='ro'?'Rom\u00e2nia':'Romania'}`,site.email,site.phoneDisplay,site.tradeRegisterNumber,site.shareCapital];
  const legal=`# ${t.legalTitle}\n\n${t.legalIntro}\n\n${legalVals.map((v,i)=>v?`- ${t.legalLabels[i]}: ${v}`:'').filter(Boolean).join('\n')}\n\n${t.legalSections.map(([h,p])=>`## ${h}\n\n${p}`).join('\n\n')}\n`;
  const storageMarkdown=`## ${t.consent.tableTitle}\n\n| ${t.consent.item} | ${t.consent.purpose} | ${t.consent.duration} |\n| --- | --- | --- |\n${storageRows(lang).map(row=>'| '+row.join(' | ')+' |').join('\n')}\n`;
  const privacy=`# ${t.privacyTitle}\n\n${t.updated}: ${site.privacyUpdated}\n\n${privacySections(lang,site).map(([h,p])=>`## ${h}\n\n${p}`).join('\n\n')}\n\n${storageMarkdown}\n- Google: https://policies.google.com/technologies/partner-sites\n- Cloudflare Turnstile: https://www.cloudflare.com/turnstile-privacy-policy/\n- ANSPDCP: https://www.dataprotection.ro/\n`;
  const other=lang==='en'?'ro':'en';
  const llms=`# ETAMADE\n\n> ${t.ai.summary}\n\n${t.ai.note}\n\n${site.legalName} | CUI ${site.taxId} | ${site.email}\n\n## ${t.ai.heading}\n\n- [${t.ai.home}](${site.domains[lang]}/index.md)\n- [${t.ai.services}](${site.domains[lang]}/services.md)\n- [${t.ai.contact}](${site.domains[lang]}/contact.md)\n- [${t.ai.legal}](${site.domains[lang]}${markdownPath('legal',t)})\n- [${t.ai.privacy}](${site.domains[lang]}${markdownPath('privacy',t)})\n- [${t.ai.profile}](${site.domains[lang]}/company.json)\n\n## Optional\n\n- [${t.ai.full}](${site.domains[lang]}/llms-full.txt)\n- [${t.ai.alternate}](${site.domains[other]}/llms.txt)\n- [LinkedIn](${site.linkedin})\n- [GitHub](${site.github})\n`;
  const mappings={
    '/index.md':home,'/services.md':services,'/contact.md':contact,
    [markdownPath('legal',t)]:legal,[markdownPath('privacy',t)]:privacy,
    '/llms.txt':llms,'/llms-full.txt':`${home}\n\n---\n\n${legal}\n\n---\n\n${privacy}`
  };
  for(const [url,body]of Object.entries(mappings))await add(url,base+url,body,url.endsWith('.md')?'text/markdown; charset=utf-8':'text/plain; charset=utf-8');
  const company={schemaVersion:'1.0',language:lang,organization:{'@context':'https://schema.org',...organization(site,t)},websites:Object.entries(site.domains).map(([language,url])=>({language,url:url+'/'})),services:t.services.map(s=>({id:s.id,name:s.name,description:s.desc,features:s.items})),contact:{email:site.email,telephone:site.phone,url:site.domains[lang]+'/#contact'},notes:t.ai.note};
  await add('/company.json',base+'/company.json',JSON.stringify(company,null,2)+'\n',types['.json']);
  const robots=`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /_site/\n\nSitemap: ${site.domains[lang]}/sitemap.xml\n`;
  await add('/robots.txt',base+'/robots.txt',robots,types['.txt']);
  const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${['home','privacy','legal'].map(type=>`  <url><loc>${site.domains[lang]}${t.paths[type]}</loc>${['en','ro'].map(l=>`<xhtml:link rel="alternate" hreflang="${l}" href="${site.domains[l]}${content[l].paths[type]}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${site.domains.en}${content.en.paths[type]}"/></url>`).join('\n')}\n</urlset>\n`;
  await add('/sitemap.xml',base+'/sitemap.xml',sitemap,types['.xml']);
}
manifest.schemaHashes=[...schemaHashes];
const worker=(await readFile(join(root,'src/pages-worker.js'),'utf8')).replace('/*__BUILD_CONFIG__*/ {}',JSON.stringify(manifest));
await write(join(out,'_worker.js'),worker);
await write(join(out,'_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:['/assets/*','/logo.svg','/favicon.svg','/bimi-logo.svg','/.well-known/*']},null,2)+'\n');
await write(join(out,'_headers'),`/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n\n${assets.css}\n  Cache-Control: public, max-age=31536000, immutable\n\n${assets.theme}\n  Cache-Control: public, max-age=31536000, immutable\n\n${assets.js}\n  Cache-Control: public, max-age=31536000, immutable\n\n${assets.privacy}\n  Cache-Control: public, max-age=31536000, immutable\n\n${assets.analytics}\n  Cache-Control: public, max-age=31536000, immutable\n`);
console.log(`Built ${site.name}: 2 languages, ${Object.keys(manifest.routes.en).length} public routes per language, ${publicFiles.length} shared assets.`);
console.log('Output: dist/ | Preview: npm run dev | Deploy guide: docs/DEPLOYMENT.md');
