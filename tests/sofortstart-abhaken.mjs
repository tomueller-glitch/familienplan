import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8836);
const run = JSON.parse(fs.readFileSync(ROOT + '/tests/run.json', 'utf8'));
const { SEED } = await import(ROOT + '/js/seed.js');
const db = { ep_persons: SEED.persons.map(p => p.adult ? { ...p, pin_hash: null } : p), ep_dishes: SEED.dishes, ep_plan: SEED.plan, ep_shopping: SEED.shopping, ep_tasks: SEED.tasks, ep_pantry: SEED.pantry, ep_ai_runs: [], ep_settings: [{ key: 'haushalt', value: { budget: 900 } }], ep_receipts: [{ id: 'rx', day: '2026-09-12', shop: 'Aldi Süd', total: 412.3, items: [{ name: 'Bio-Hackfleisch', preis: 120, kategorie: 'Fleisch und Fisch' }, { name: 'Gemüse', preis: 200, kategorie: 'Obst und Gemüse' }] }, { id: 'r0', day: '2026-11-04', shop: 'Lidl', total: 23.5, items: [{ text: 'BANANEN', name: 'Bananen', preis: 1.99, kategorie: 'Obst und Gemüse' }, { text: 'WASCHMITTEL', name: 'Waschmittel', preis: 21.51, kategorie: 'Haushalt und Putzen' }] }, { id: 'r1', day: '2026-10-28', shop: 'Aldi Süd', total: 80, items: [] }] };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
await ctx.addInitScript((db) => {
  globalThis.ESSENSPLAN_HEUTE = '2026-11-18';
  window.calls = []; window.__db = db;
  const q = (table) => { const api = { select() { return api; }, order() { return api; }, range() { const d = window.__db[table] || []; return new Promise((ok) => setTimeout(() => ok({ data: d, error: null }), Number(sessionStorage.getItem('langsam') || 0))); },
    upsert(rows) { window.calls.push(['upsert', table, JSON.parse(JSON.stringify(rows))]); return Promise.resolve({ error: null }); },
    delete() { const d = { eq() { return Object.assign(Promise.resolve({ error: null }), d); }, in(c, v) { window.calls.push(['delete', table, v.length]); return Promise.resolve({ error: null }); } }; return d; } }; return api; };
  window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: {} } }, error: null }), signOut: async () => {} }, from: q,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({ list: async () => ({ data: [{ name: 'familienplan-2026-11-15-0300.json', metadata: { size: 48213 } }, { name: 'familienplan-2026-11-08-0300.json', metadata: { size: 47001 } }], error: null }), download: async (n) => ({ data: new Blob(['{}'], { type: 'application/json' }), error: null }) }) }, functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, { action: o.body.action, n: (o.body.photos || []).length, len: (o.body.photos || []).map(p => p.data.length) }]); await new Promise(r => setTimeout(r, 400)); if (o.body.action === 'mittag') { window.lastMittag = o.body.mittag; return { data: { mittag: [{ name: 'Rührei mit Spinat', minuten: 10, warum: 'Eiweiß und Gemüse.', zutaten: [{ menge: '4 Stück', name: 'Eier', da: true }, { menge: '100 g', name: 'Feta', da: false }], schritte: ['Eier verquirlen.', 'Braten.'], reste: [] }] }, error: null }; } if (o.body.action === 'kosten') { const ds = window.__db.ep_dishes; return { data: { kosten: { stand: '2026-11-18', kassenzettel: 2, gerichte: Object.fromEntries(ds.map((x, i) => [x.id, 6 + (i * 1.7) % 14])) } }, error: null }; } if (o.body.action === 'fest') { const m = await import('/js/planer.js'); return { data: { fest: m.demoFeast(o.body.fest) }, error: null }; } if (o.body.action === 'ersatz') return { data: { ersatz: { vorschlaege: [{ name: 'Kabeljaufilet TK', menge: '600 g', warum: 'Mild und fest.' }, { name: 'Alaska-Seelachs TK', menge: '600 g', warum: 'Sehr ähnlich.' }], rezept_hinweis: 'Am Vorabend im Kühlschrank auftauen und trocken tupfen.' } }, error: null }; if (o.body.action === 'sicherung') return { data: { name: 'x', anzahl: { ep_dishes: 16, ep_plan: 20 } }, error: null }; if (o.body.action === 'kassenzettel') return { data: { beleg: { markt: 'Aldi Süd', datum: '2026-11-18', summe: 14.10, hinweis: 'Eine Zeile war schwer lesbar.', posten: [ { text: 'BIO HAEHN.BR.FIL', name: 'Bio-Hähnchenbrustfilet', preis: 7.99, kategorie: 'Fleisch und Fisch' }, { text: 'SALATGURKE', name: 'Salatgurke', preis: 0.69, kategorie: 'Obst und Gemüse' }, { text: 'SPUELMASCH.TABS', name: 'Spülmaschinentabs', preis: 3.95, kategorie: 'Sonstiges' }, { text: 'PFAND', name: 'Pfand', preis: 0.25, kategorie: 'Pfand und Rabatt' } ] } }, error: null }; return { data: {}, error: null }; } } }) };
}, db);







const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8836/#woche'); await page.waitForTimeout(1200);
await page.locator('[data-action="ich"]').first().click(); await page.waitForTimeout(400);
await page.fill('[name=pin1]', '1234'); await page.fill('[name=pin2]', '1234'); await page.click('#sheet-root button.knopf'); await page.waitForTimeout(1500);
// Zweiter Start: Datenbank antwortet erst nach 3 Sekunden, ein Gericht hat inzwischen einen neuen Namen.
await page.evaluate(() => { sessionStorage.setItem('langsam', '3000'); });
await page.addInitScript(() => { const d = window.__db; if (d) d.ep_dishes = d.ep_dishes.map((x) => x.id === 'fischstaebchen' ? { ...x, name: 'Fischstäbchen NEU' } : x); });
const t0 = Date.now();
await page.reload(); await page.waitForTimeout(700);
const early = await page.locator('main').innerText().catch(() => '');
console.log('Nach 0,7 s sichtbar:', early.includes('Die Woche') || early.includes('Heute'), 'alter Name:', early.includes('Knusprige Fischstäbchen'), 'Schreibzugriffe:', await page.evaluate(() => JSON.stringify(window.calls.map(c => [c[0], c[1], JSON.stringify(c[2]).slice(0, 80)]))));
await page.waitForTimeout(3500);
const late = await page.locator('main').innerText();
console.log('Nach 4,2 s neuer Name:', late.includes('Fischstäbchen NEU'));
// Abhaken im Einkaufsmodus: kurz sichtbar mit Animation, dann weg
await page.evaluate(() => { sessionStorage.setItem('langsam', '0'); location.hash = '#einkauf'; }); await page.waitForTimeout(500);
await page.locator('[data-action="einkaufsmodus"]').first().click(); await page.waitForTimeout(300);
const first = page.locator('.posten li').first(); const label = (await first.locator('.p-name').innerText()).split('\n')[0];
await first.locator('[data-action="haken"]').click(); await page.waitForTimeout(120);
console.log('Direkt danach sichtbar mit Animation:', await page.locator('.posten li.gerade-abgehakt').count());
await page.waitForTimeout(800);
console.log('Nach 0,9 s ausgeblendet:', await page.locator('.posten li', { hasText: label }).count() === 0, label);
// Aus der Push-Nachricht „Entwurf fertig“ geöffnet: Der Entwurf steht nur in den frischen Daten.
await page.addInitScript((r) => { if (window.__db) window.__db.ep_ai_runs = [r]; }, run);
await page.evaluate(() => { sessionStorage.setItem('langsam', '2000'); });
await page.goto('http://localhost:8836/?entwurf=' + run.id + '#woche'); await page.waitForTimeout(600);
console.log('Entwurf vor frischen Daten offen:', await page.locator('#sheet-root [data-form=entwurf]').count());
await page.waitForTimeout(2600);
console.log('Entwurf nach frischen Daten offen:', await page.locator('#sheet-root [data-form=entwurf]').count());
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
console.log('Fehler:', errs); await b.close(); srv.close();
