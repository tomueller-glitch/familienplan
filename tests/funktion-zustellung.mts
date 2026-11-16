import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
(globalThis as any).Deno = { env: { get: () => undefined }, serve: () => {} };
const m = await import(ROOT + '/supabase/functions/push/index.ts');
const b64u = (b: Uint8Array) => Buffer.from(b).toString('base64url');
async function keys() {
  const k = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', k.publicKey));
  const jwk: any = await crypto.subtle.exportKey('jwk', k.privateKey);
  return { pub: b64u(raw), priv: jwk.d };
}
const v = await keys();
const dev = await keys();
const vapid = { publicKey: v.pub, privateKey: v.priv, subject: 'mailto:test@example.org' };
const subs = [
  { endpoint: 'https://web.push.apple.com/a', person_id: 'p3', p256dh: dev.pub, auth: b64u(crypto.getRandomValues(new Uint8Array(16))) },
  { endpoint: 'https://fcm.googleapis.com/b', person_id: 'p4', p256dh: dev.pub, auth: b64u(crypto.getRandomValues(new Uint8Array(16))) },
];
const urgency: string[] = [];
function fakeStore() {
  const log: string[] = [];
  const calls: string[] = [];
  return {
    log, calls,
    claim: async (k: string[]) => { const f = new Set(k.filter((x) => !log.includes(x))); log.push(...f); return f; },
    release: async (k: string) => { calls.push(`frei:${k}`); log.splice(log.indexOf(k), 1); },
    markSub: async (e: string, f: any) => { calls.push(`status:${new URL(e).host}:${f.last_ok_at ? 'ok' : f.last_error.split(' am ')[0]}${f.history ? `:protokoll=${f.history.map((h: any) => (h.ok ? 'ok' : h.why + (h.again ? '+wieder' : ''))).join('|')}` : ''}`); },
    dropSub: async (e: string) => { calls.push(`weg:${new URL(e).host}`); },
  };
}
const due = [
  { key: 'a', to: ['p3'], ttl: 600, msg: { title: 'A', body: 'x', tag: 'grundaufgaben' } },
  { key: 'b', to: ['p4'], ttl: 600, msg: { title: 'B', body: 'y', tag: 'grundaufgaben' } },
];
async function run(answer: (url: string) => number | Error) {
  (globalThis as any).fetch = async (url: string, init: any) => {
    urgency.push(init.headers.Urgency);
    const r = answer(url);
    if (r instanceof Error) throw r;
    return new Response(null, { status: r });
  };
  const st = fakeStore();
  const r = await m.sendDue(st as any, subs, due as any, vapid);
  return { r, log: st.log.join(','), calls: st.calls.join(' ') };
}
console.log('Alles gut:', JSON.stringify(await run(() => 201)));
console.log('Apple 503, Google ok:', JSON.stringify(await run((u) => (u.includes('apple') ? 503 : 201))));
console.log('Netz weg:', JSON.stringify(await run(() => new Error('connection reset'))));
console.log('Apple 410:', JSON.stringify(await run((u) => (u.includes('apple') ? 410 : 201))));
console.log('Apple 403 (kein Wiederholen):', JSON.stringify(await run((u) => (u.includes('apple') ? 403 : 201))));
console.log('Urgency:', [...new Set(urgency)].join(','));
