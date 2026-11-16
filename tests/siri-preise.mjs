import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8799);
const run = JSON.parse(fs.readFileSync(ROOT + '/tests/run.json', 'utf8'));
const { SEED } = await import(ROOT + '/js/seed.js');
const db = { ep_persons: SEED.persons.map(p => p.adult ? { ...p, pin_hash: null } : p), ep_dishes: SEED.dishes, ep_plan: SEED.plan, ep_shopping: SEED.shopping, ep_tasks: SEED.tasks, ep_pantry: SEED.pantry.map((p, n) => n < 3 ? { ...p, have: true, seen_at: '2026-10-10' } : p), ep_ai_runs: [], ep_settings: [{ key: 'haushalt', value: { budget: 900 } }, { key: 'wuensche', value: [{ id: 'w1', person_id: 'p4', week: '2026-11-23', text: 'Pfannkuchen', dish_id: null, status: 'offen' }] }], ep_receipts: [{ id: 'r0', day: '2026-11-04', shop: 'Lidl', total: 23.5, items: [{ text: 'BANANEN', name: 'Bananen', preis: 1.99, kategorie: 'Obst und Gemüse' }, { text: 'WASCHMITTEL', name: 'Waschmittel', preis: 21.51, kategorie: 'Haushalt und Putzen' }] }, { id: 'r1', day: '2026-10-28', shop: 'Aldi Süd', total: 80, items: [] }] };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
await ctx.addInitScript((db) => {
  globalThis.ESSENSPLAN_HEUTE = '2026-11-20';
  window.calls = []; window.__db = db;
  const q = (table) => { const api = { select() { return api; }, order() { return api; }, range() { return Promise.resolve({ data: window.__db[table] || [], error: null }); },
    upsert(rows) { window.calls.push(['upsert', table, JSON.parse(JSON.stringify(rows))]); return Promise.resolve({ error: null }); },
    delete() { const d = { eq() { return Object.assign(Promise.resolve({ error: null }), d); }, in(c, v) { window.calls.push(['delete', table, v.length]); return Promise.resolve({ error: null }); } }; return d; } }; return api; };
  window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: {} } }, error: null }), signOut: async () => {} }, from: q,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, { action: o.body.action, n: (o.body.photos || []).length, len: (o.body.photos || []).map(p => p.data.length) }]); await new Promise(r => setTimeout(r, 400)); if (o.body.action === 'kassenzettel') return { data: { beleg: { markt: 'Aldi Süd', datum: '2026-11-20', summe: 14.10, hinweis: 'Eine Zeile war schwer lesbar.', posten: [ { text: 'BIO HAEHN.BR.FIL', name: 'Bio-Hähnchenbrustfilet', preis: 7.99, kategorie: 'Fleisch und Fisch' }, { text: 'SALATGURKE', name: 'Salatgurke', preis: 0.69, kategorie: 'Obst und Gemüse' }, { text: 'SPUELMASCH.TABS', name: 'Spülmaschinentabs', preis: 3.95, kategorie: 'Sonstiges' }, { text: 'PFAND', name: 'Pfand', preis: 0.25, kategorie: 'Pfand und Rabatt' } ] } }, error: null }; return { data: {}, error: null }; } } }) };
}, db);



const errs = [];
const login = async (page, who, pin) => {
  await page.goto('http://localhost:8799/#woche'); await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload(); await page.waitForTimeout(1200);
  await page.locator('[data-action="ich"]', { hasText: who }).first().click(); await page.waitForTimeout(400);
  if (pin && await page.locator('[name=pin1]').count()) { await page.fill('[name=pin1]', '1234'); await page.fill('[name=pin2]', '1234'); await page.click('#sheet-root button.knopf'); await page.waitForTimeout(800); }
};
console.log('Vorrat:', JSON.stringify(db.ep_pantry.slice(0, 3).map(p => p.label)));
// Kind
const kid = await ctx.newPage(); kid.on('pageerror', e => errs.push(e.message));
await login(kid, 'Kind 1');
await kid.evaluate(() => { location.hash = '#aufgaben'; }); await kid.waitForTimeout(500);
const card = kid.locator('.wunsch').first(); await card.scrollIntoViewIfNeeded();
console.log('Kind Wunsch:', (await card.innerText()).replace(/\n/g, ' | '));
await kid.fill('[data-form="wunsch"] input', 'Pfannkuchen mit Apfelmus'); await kid.locator('[data-form="wunsch"] button').click(); await kid.waitForTimeout(500);
console.log('Kind nachher:', (await kid.locator('.wunsch').first().innerText()).replace(/\n/g, ' | '));
await kid.locator('.wunsch').first().screenshot({ path: 'w_kind.png' });
const kc = (await kid.evaluate(() => window.calls.splice(0))).filter(c => c[1] === 'ep_settings').map(c => JSON.stringify(c[2][0].value));
console.log('Gespeichert:', kc.join(' / '));
await kid.close();
// Eltern
const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
await login(page, 'Papa', true);
await page.evaluate(() => { location.hash = '#woche'; }); await page.waitForTimeout(400);
await page.locator('[data-action="woche"][data-dir="1"]').first().click(); await page.waitForTimeout(400);
console.log('Banner:', (await page.locator('.wunsch').first().innerText().catch(() => '-')).replace(/\n/g, ' | ')); await page.locator('.wunsch').first().screenshot({ path: 'w_banner.png' }).catch(() => {});
// Gäste am Sa 21.11.
await page.evaluate(() => { location.hash = '#woche'; }); await page.waitForTimeout(300);
await page.locator('.pfeil[data-dir="-1"], [aria-label*="Vorige Woche"], [aria-label*="Vorherige"]').first().click().catch(() => {}); await page.waitForTimeout(300);
await page.locator('[data-action="tag"][data-day="2026-11-21"]').first().click(); await page.waitForTimeout(400);
await page.locator('.abend details summary').click(); await page.waitForTimeout(200);
await page.fill('[name=gaeste]', '2'); await page.evaluate(() => window.calls.splice(0));
await page.locator('[data-form="anwesenheit"] button.knopf').click(); await page.waitForTimeout(500);
console.log('Gäste gespeichert:', JSON.stringify((await page.evaluate(() => window.calls.splice(0))).filter(c => c[1] === 'ep_plan').map(c => c[2].map(r => r.day + ':' + r.guests))));
const day = (await page.locator('#sheet-root').innerText()).replace(/\n/g, ' | ');
console.log('Tagbogen:', day.match(/Abendessen um[^|]*\|[^|]*/)?.[0], '||', day.match(/Zutaten für[^|]*\|[^|]*\|[^|]*/)?.[0]);
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
// Vorrat
await page.evaluate(() => { location.hash = '#einkauf'; }); await page.waitForTimeout(400);
console.log('Vorrat-Knopf:', await page.locator('[data-action="vorrat"]').first().innerText());
await page.locator('[data-action="vorrat"]').first().click(); await page.waitForTimeout(300);
console.log('Noch da:', (await page.locator('#sheet-root .kasten-text').first().innerText().catch(() => '-')).replace(/\n/g, ' | ').slice(0, 300));
await page.screenshot({ path: 'w_vorrat.png' });
const ja = page.locator('[data-action="vorrat-ja"]').first(); if (await ja.count()) { await page.evaluate(() => window.calls.splice(0)); await ja.click(); await page.waitForTimeout(300); console.log('Ja:', JSON.stringify((await page.evaluate(() => window.calls.splice(0))).filter(c => c[1] === 'ep_pantry').map(c => c[2].map(r => r.label + ':' + r.seen_at)))); }
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
// Siri
await page.locator('[data-action="siri"]').first().click(); await page.waitForTimeout(300);
await page.locator('[data-action="siri-schluessel"]').click(); await page.waitForTimeout(400);
console.log('Siri:', (await page.locator('#sheet-root').innerText()).replace(/\n/g, ' | ').slice(0, 300));
await page.screenshot({ path: 'w_siri.png', fullPage: false });
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
// Preise
await page.evaluate(() => { location.hash = '#ausgaben'; }); await page.waitForTimeout(400);
await page.locator('[data-action="preise"]').click(); await page.waitForTimeout(300);
await page.fill('#preis-suche', 'bana'); await page.waitForTimeout(200);
console.log('Preise sichtbar:', await page.locator('.preis-zeile:not([hidden])').count(), 'von', await page.locator('.preis-zeile').count());
await page.fill('#preis-suche', ''); await page.screenshot({ path: 'w_preise.png' });
console.log('Fehler:', errs); await b.close(); srv.close();
