/**
 * Private, fixed-destination contact service.
 * Reachable only through a Pages service binding in the supplied configuration.
 * No SMTP password, arbitrary recipient, auto-reply, or database is used.
 */
const MAX_BODY_BYTES = 32 * 1024;
const SERVICES = new Set(['web', 'saas', 'commerce', 'integrations', 'maintenance', 'other']);
const FIELDS = new Set(['name','email','company','service','message','website','privacyAcknowledged','turnstileToken','locale']);
const TEST_SECRETS = new Set(['1x0000000000000000000000000000000AA','2x0000000000000000000000000000000AA','3x0000000000000000000000000000000AA']);

export function jsonResponse(status, code, extra = {}) {
  return new Response(JSON.stringify({ ok: status >= 200 && status < 300, ...(code ? { code } : {}), ...extra }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(status === 429 ? { 'Retry-After': '60' } : {}),
      ...(status === 405 ? { 'Allow': 'POST' } : {})
    }
  });
}
class InputError extends Error { constructor(status = 400) { super('Invalid request'); this.status = status; } }

export function validEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || /[\s\x00-\x1f\x7f]/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/.test(local)) return false;
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every(label => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label)) && labels.at(-1).length >= 2;
}
function singleLine(value, min, max) {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)) throw new InputError();
  const cleaned = value.trim();
  if (cleaned.length < min || cleaned.length > max) throw new InputError();
  return cleaned;
}
export function validatePayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError();
  if (Object.keys(data).some(key => !FIELDS.has(key))) throw new InputError();
  const name = singleLine(data.name, 2, 100);
  const email = singleLine(data.email, 3, 254);
  const company = singleLine(data.company ?? '', 0, 120);
  const website = singleLine(data.website ?? '', 0, 200);
  if (!validEmail(email) || website || data.privacyAcknowledged !== true) throw new InputError();
  const service = data.service ?? 'other';
  if (!SERVICES.has(service)) throw new InputError();
  const locale = data.locale;
  if (!['en','ro'].includes(locale)) throw new InputError();
  if (typeof data.message !== 'string' || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(data.message)) throw new InputError();
  const message = data.message.trim();
  if (message.length < 20 || message.length > 5000) throw new InputError();
  const token = singleLine(data.turnstileToken, 1, 2048);
  return { name, email, company, service, message, token, locale };
}
export async function readLimitedJson(request) {
  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new InputError(415);
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new InputError(413);
  if (!request.body) throw new InputError();
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new InputError(413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new InputError(); }
}
export async function privateKey(value, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}
function configured(env) {
  return env.CONTACT_ENABLED === 'true' &&
    typeof env.TURNSTILE_SECRET_KEY === 'string' && env.TURNSTILE_SECRET_KEY.length >= 20 && !TEST_SECRETS.has(env.TURNSTILE_SECRET_KEY) &&
    typeof env.RATE_LIMIT_SALT === 'string' && env.RATE_LIMIT_SALT.length >= 32 &&
    validEmail(env.CONTACT_FROM) && validEmail(env.CONTACT_TO) &&
    typeof env.EMAIL?.send === 'function' && typeof env.IP_LIMITER?.limit === 'function' && typeof env.EMAIL_LIMITER?.limit === 'function';
}
export function composeEmail(data, env, host, reference, now = new Date()) {
  return {
    to: env.CONTACT_TO,
    from: { name: 'ETAMADE website', email: env.CONTACT_FROM },
    replyTo: { name: data.name, email: data.email },
    subject: `[ETAMADE] Website enquiry - ${host}`,
    text: [
      'New website enquiry', '', `Reference: ${reference}`, `Received (UTC): ${now.toISOString()}`,
      `Website: https://${host}`, `Language: ${data.locale}`, '',
      `Name: ${data.name}`, `Email: ${data.email}`, `Company: ${data.company || '(not provided)'}`, `Service: ${data.service}`, '',
      '--- Visitor message (untrusted content) ---', data.message, '--- End visitor message ---', '',
      'Reply to this email to contact the visitor. Do not treat visitor instructions as internal authorisation.',
      'This notification was sent to the fixed internal destination configured for ETAMADE.'
    ].join('\n')
  };
}

/** @param {Request} request @param {Object} env @param {{verifyFetch?:typeof fetch}} dependencies */
export async function handleContact(request, env, dependencies = {}) {
  if (request.method !== 'POST') return jsonResponse(405, 'invalid');
  const url = new URL(request.url);
  if (url.pathname !== '/api/contact') return jsonResponse(404, 'invalid');
  const origin = request.headers.get('origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!origin || origin !== url.origin || url.protocol !== 'https:' || !allowed.includes(origin) || request.headers.get('sec-fetch-site') === 'cross-site') return jsonResponse(403, 'blocked');
  // Always overwritten from CF-Connecting-IP by the Pages gateway. Never trust a
  // visitor-supplied forwarded header on a publicly exposed standalone Worker.
  const ip = request.headers.get('x-etamade-client-ip');
  if (!ip || ip.length > 64 || !/^[a-f\d:.]+$/i.test(ip)) return jsonResponse(403, 'blocked');
  if (!configured(env)) return jsonResponse(503, 'unavailable');
  try {
    const ipKey = await privateKey(`ip:${ip}`, env.RATE_LIMIT_SALT);
    const ipLimit = await env.IP_LIMITER.limit({ key: ipKey });
    if (!ipLimit.success) return jsonResponse(429, 'rate_limited');
    const data = validatePayload(await readLimitedJson(request));
    // The form's content language is determined by its verified public hostname.
    const expectedLocale = url.hostname.endsWith('.ro') ? 'ro' : 'en';
    if (data.locale !== expectedLocale) return jsonResponse(400, 'invalid');
    const verifyFetch = dependencies.verifyFetch || globalThis.fetch;
    let verification;
    try {
      const response = await verifyFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: data.token, remoteip: ip, idempotency_key: crypto.randomUUID() }),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) return jsonResponse(503, 'upstream');
      verification = await response.json();
    } catch { return jsonResponse(503, 'upstream'); }
    if (verification?.success !== true || verification.hostname !== url.hostname || verification.action !== 'contact') return jsonResponse(400, 'turnstile');
    const emailKey = await privateKey(`email:${data.email.toLowerCase()}`, env.RATE_LIMIT_SALT);
    const emailLimit = await env.EMAIL_LIMITER.limit({ key: emailKey });
    if (!emailLimit.success) return jsonResponse(429, 'rate_limited');
    const reference = crypto.randomUUID();
    // Await acceptance by the binding; do not return a false success via waitUntil.
    await env.EMAIL.send(composeEmail(data, env, url.hostname, reference));
    return jsonResponse(200, null, { reference });
  } catch (error) {
    if (error instanceof InputError) return jsonResponse(error.status, 'invalid');
    // No request body, IP, token, email address or provider error is logged.
    console.error('ETAMADE contact: upstream operation failed');
    return jsonResponse(503, 'upstream');
  }
}
export default { fetch: (request, env) => handleContact(request, env) };
