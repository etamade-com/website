import {readFile} from 'node:fs/promises';
import {site} from '../src/site.config.mjs';
let errors=0;
function ok(condition,label){console.log(`${condition?'PASS':'REVIEW'}: ${label}`);if(!condition)errors++;}
const page=await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8');
const worker=await readFile(new URL('../workers/contact/wrangler.jsonc',import.meta.url),'utf8');
ok(!!site.tradeRegisterNumber,'Confirm and fill Trade Register number in src/site.config.mjs.');
ok(!!site.shareCapital,'Confirm and fill share capital in src/site.config.mjs where applicable.');
ok(!!page.match(/"TURNSTILE_SITE_KEY":\s*"([^"]+)"/),'Set the real public Turnstile site key (keep preview disabled).');
// Preview deliberately has a blank key; manually review production section.
console.log('INFO: Check the production TURNSTILE_SITE_KEY specifically; the preview key stays blank.');
ok(/"CONTACT_ENABLED":\s*"true"/.test(page),'Enable contact in production Pages configuration after setup.');
ok(/"CONTACT_ENABLED":\s*"true"/.test(worker),'Enable contact in private Worker configuration after setup.');
console.log('\nMANUAL: Verify registered address, internal destination, sender DNS, mailbox retention, processor terms and secret bindings.');
console.log('This check does not log in, query Cloudflare, send email or certify legal compliance.');
process.exitCode=errors?1:0;

console.log('\nANALYTICS: add a real GA_MEASUREMENT_ID and enable only after docs/PRIVACY-ANALYTICS.md.');
console.log('ANALYTICS: review GA4 Enhanced Measurement, signals, advertising, retention, sharing and processor/transfer terms.');
console.log('LANGUAGE: validate both mismatch directions and explicit-choice/dismissal behavior on production domains.');
