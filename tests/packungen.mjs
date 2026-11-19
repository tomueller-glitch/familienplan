import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8839);
const run = JSON.parse(fs.readFileSync(ROOT + '/tests/run.json', 'utf8'));
const { SEED } = await import(ROOT + '/js/seed.js');
const db = { ep_persons: SEED.persons.map(p => p.adult ? { ...p, pin_hash: null } : p), ep_dishes: SEED.dishes, ep_plan: SEED.plan, ep_shopping: SEED.shopping, ep_tasks: SEED.tasks, ep_pantry: SEED.pantry, ep_ai_runs: [], ep_settings: [{ key: 'haushalt', value: { budget: 900 } }], ep_receipts: [{ id: 'rx', day: '2026-09-12', shop: 'Aldi Süd', total: 412.3, items: [{ name: 'Bio-Hackfleisch', preis: 120, kategorie: 'Fleisch und Fisch' }, { name: 'Gemüse', preis: 200, kategorie: 'Obst und Gemüse' }] }, { id: 'r0', day: '2026-11-04', shop: 'Lidl', total: 23.5, items: [{ text: 'BANANEN', name: 'Bananen', preis: 1.99, kategorie: 'Obst und Gemüse' }, { text: 'WASCHMITTEL', name: 'Waschmittel', preis: 21.51, kategorie: 'Haushalt und Putzen' }] }, { id: 'r1', day: '2026-10-28', shop: 'Aldi Süd', total: 80, items: [] }] };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
await ctx.addInitScript((db) => {
  globalThis.ESSENSPLAN_HEUTE = '2026-11-18';
  window.calls = []; window.__db = db;
  const q = (table) => { const api = { select() { return api; }, order() { return api; }, range() { return Promise.resolve({ data: window.__db[table] || [], error: null }); },
    upsert(rows) { window.calls.push(['upsert', table, JSON.parse(JSON.stringify(rows))]); return Promise.resolve({ error: null }); },
    delete() { const d = { eq() { return Object.assign(Promise.resolve({ error: null }), d); }, in(c, v) { window.calls.push(['delete', table, v.length]); return Promise.resolve({ error: null }); } }; return d; } }; return api; };
  window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: {} } }, error: null }), signOut: async () => {} }, from: q,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({ list: async () => ({ data: [{ name: 'familienplan-2026-11-15-0300.json', metadata: { size: 48213 } }, { name: 'familienplan-2026-11-08-0300.json', metadata: { size: 47001 } }], error: null }), download: async (n) => ({ data: new Blob(['{}'], { type: 'application/json' }), error: null }) }) }, functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, { action: o.body.action, n: (o.body.photos || []).length, len: (o.body.photos || []).map(p => p.data.length) }]); await new Promise(r => setTimeout(r, 400)); if (o.body.action === 'mittag') { window.lastMittag = o.body.mittag; return { data: { mittag: [{ name: 'Rührei mit Spinat', minuten: 10, warum: 'Eiweiß und Gemüse.', zutaten: [{ menge: '4 Stück', name: 'Eier', da: true }, { menge: '100 g', name: 'Feta', da: false }], schritte: ['Eier verquirlen.', 'Braten.'], reste: [] }] }, error: null }; } if (o.body.action === 'kosten') { const ds = window.__db.ep_dishes; return { data: { kosten: { stand: '2026-11-18', kassenzettel: 2, gerichte: Object.fromEntries(ds.map((x, i) => [x.id, 6 + (i * 1.7) % 14])) } }, error: null }; } if (o.body.action === 'fest') { const m = await import('/js/planer.js'); return { data: { fest: m.demoFeast(o.body.fest) }, error: null }; } if (o.body.action === 'ersatz') return { data: { ersatz: { vorschlaege: [{ name: 'Kabeljaufilet TK', menge: '600 g', warum: 'Mild und fest.' }, { name: 'Alaska-Seelachs TK', menge: '600 g', warum: 'Sehr ähnlich.' }], rezept_hinweis: 'Am Vorabend im Kühlschrank auftauen und trocken tupfen.' } }, error: null }; if (o.body.action === 'sicherung') return { data: { name: 'x', anzahl: { ep_dishes: 16, ep_plan: 20 } }, error: null }; if (o.body.action === 'kassenzettel') return { data: { beleg: { markt: 'Aldi Süd', datum: '2026-11-18', summe: 14.10, hinweis: 'Eine Zeile war schwer lesbar.', posten: [ { text: 'BIO HAEHN.BR.FIL', name: 'Bio-Hähnchenbrustfilet', preis: 7.99, kategorie: 'Fleisch und Fisch' }, { text: 'SALATGURKE', name: 'Salatgurke', preis: 0.69, kategorie: 'Obst und Gemüse' }, { text: 'SPUELMASCH.TABS', name: 'Spülmaschinentabs', preis: 3.95, kategorie: 'Sonstiges' }, { text: 'PFAND', name: 'Pfand', preis: 0.25, kategorie: 'Pfand und Rabatt' } ] } }, error: null }; return { data: {}, error: null }; } } }) };
}, db);







const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
const sheet = async () => (await page.locator('#sheet-root').innerText()).replace(/\n+/g, ' | ');
await page.goto('http://localhost:8839/#einkauf'); await page.waitForTimeout(1200);
await page.locator('[data-action="ich"]').first().click(); await page.waitForTimeout(400);
await page.fill('[name=pin1]', '1234'); await page.fill('[name=pin2]', '1234'); await page.click('#sheet-root button.knopf'); await page.waitForTimeout(1200);
await page.evaluate(() => { location.hash = '#einkauf'; }); await page.waitForTimeout(500);
// Zu Hause: über „Packungsgrößen“ einen Posten wählen
await page.locator('[data-action="packungen"]').click(); await page.waitForTimeout(300);
await page.locator('#sheet-root details.pack-auswahl > summary').click(); await page.waitForTimeout(200);
await page.locator('#sheet-root [data-action="packung"]', { hasText: 'Seelachs' }).first().click(); await page.waitForTimeout(300);
console.log('Schritt 1:', (await sheet()).slice(0, 200));
await page.fill('#sheet-root [name=groesse]', '400 g'); await page.locator('#sheet-root form[data-form="packung-groesse"] button').click(); await page.waitForTimeout(300);
console.log('Schritt 2:', (await sheet()).slice(0, 700));
await page.screenshot({ path: 'p_wahl.png' });
await page.evaluate(() => { window.calls.length = 0; });
await page.locator('#sheet-root form[data-form="packung-wahl"] button').click(); await page.waitForTimeout(500);
const calls = await page.evaluate(() => window.calls.map((c) => [c[1], c[1] === 'ep_dishes' ? { servings: c[2].servings, fisch: (c[2].ingredients || []).find((g) => /Seelachs/.test(g.n)) } : c[1] === 'ep_shopping' ? c[2].map((x) => `${x.label}: ${x.qty}`) : c[1] === 'ep_settings' ? c[2].map((x) => x.key + ' ' + JSON.stringify(x.value).slice(0, 160)) : '']));
console.log('Gespeichert:', JSON.stringify(calls));
console.log('Toast:', await page.locator('#toast').innerText());
// Im Laden: „fehlt“ und „Andere Größe“
await page.locator('[data-action="einkaufsmodus"]').first().click(); await page.waitForTimeout(300);
const row = page.locator('.posten li:has([data-action="haken"])', { hasText: 'Erbsen' }).first();
await row.locator('[data-action="fehlt"]').click(); await page.waitForTimeout(300);
await page.locator('.fehlt-kasten [data-action="packung"]').first().click(); await page.waitForTimeout(300);
await page.fill('#sheet-root [name=groesse]', '1 kg'); await page.locator('#sheet-root form[data-form="packung-groesse"] button').click(); await page.waitForTimeout(300);
console.log('Erbsen Schritt 2:', (await sheet()).slice(0, 500));
await page.locator('#sheet-root input[name=wahl][value=c]').check();
await page.locator('#sheet-root form[data-form="packung-wahl"] button').click(); await page.waitForTimeout(500);
console.log('Erbsen auf der Liste:', await page.locator('.posten li:has([data-action="haken"])', { hasText: 'Erbsen' }).first().innerText().catch(() => 'nicht sichtbar'));
console.log('Reste:', JSON.stringify(await page.evaluate(() => { const r = window.calls.filter((c) => c[1] === 'ep_settings' && c[2][0].key === 'reste').pop(); return r ? r[2][0].value.map((x) => [x.text, x.ab]) : null; })));
await page.locator('.modus-leiste [data-action="einkaufsmodus"]').click(); await page.waitForTimeout(300);
// Packungsliste
await page.locator('[data-action="packungen"]').click(); await page.waitForTimeout(300);
console.log('Liste:', (await sheet()).slice(0, 400));
await page.screenshot({ path: 'p_liste.png' });
console.log('Fehler:', errs); await b.close(); srv.close();
