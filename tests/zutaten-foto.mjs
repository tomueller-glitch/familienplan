import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8798);
const run = JSON.parse(fs.readFileSync(ROOT + '/tests/run.json', 'utf8'));
const { SEED } = await import(ROOT + '/js/seed.js');
const db = { ep_persons: SEED.persons.map(p => p.adult ? { ...p, pin_hash: null } : p), ep_dishes: SEED.dishes, ep_plan: SEED.plan, ep_shopping: SEED.shopping, ep_tasks: SEED.tasks, ep_pantry: SEED.pantry, ep_ai_runs: [], ep_settings: [{ key: 'haushalt', value: { budget: 900 } }], ep_receipts: [{ id: 'r0', day: '2026-11-04', shop: 'Lidl', total: 23.5, items: [{ text: 'BANANEN', name: 'Bananen', preis: 1.99, kategorie: 'Obst und Gemüse' }, { text: 'WASCHMITTEL', name: 'Waschmittel', preis: 21.51, kategorie: 'Haushalt und Putzen' }] }, { id: 'r1', day: '2026-10-28', shop: 'Aldi Süd', total: 80, items: [] }] };
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
    functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, { action: o.body.action, n: (o.body.photos || []).length, len: (o.body.photos || []).map(p => p.data.length) }]); await new Promise(r => setTimeout(r, 400)); if (o.body.action === 'zutaten') { const m = await import('/js/haushalt.js'); return { data: { zutaten: m.demoIngredients() }, error: null }; } if (o.body.action === 'rezept') { const m = await import('/js/haushalt.js'); const r = m.demoRecipe(); r.name = 'Burger'; r.meta = { portionen_original: 2, naehrwerte_vom_rezept: true }; return { data: { rezept: r }, error: null }; } if (o.body.action === 'kassenzettel') return { data: { beleg: { markt: 'Aldi Süd', datum: '2026-11-20', summe: 14.10, hinweis: 'Eine Zeile war schwer lesbar.', posten: [ { text: 'BIO HAEHN.BR.FIL', name: 'Bio-Hähnchenbrustfilet', preis: 7.99, kategorie: 'Fleisch und Fisch' }, { text: 'SALATGURKE', name: 'Salatgurke', preis: 0.69, kategorie: 'Obst und Gemüse' }, { text: 'SPUELMASCH.TABS', name: 'Spülmaschinentabs', preis: 3.95, kategorie: 'Sonstiges' }, { text: 'PFAND', name: 'Pfand', preis: 0.25, kategorie: 'Pfand und Rabatt' } ] } }, error: null }; return { data: {}, error: null }; } } }) };
}, db);




const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8798/#einkauf'); await page.waitForTimeout(1200);
await page.locator('[data-action="ich"]').first().click(); await page.waitForTimeout(400);
await page.fill('[name=pin1]', '1234'); await page.fill('[name=pin2]', '1234'); await page.click('#sheet-root button.knopf'); await page.waitForTimeout(800);
await page.evaluate(() => { location.hash = '#einkauf'; }); await page.waitForTimeout(500);
const f = page.locator('[data-form="posten"]'); await f.scrollIntoViewIfNeeded();
await page.locator('.werkzeuge').screenshot({ path: 'z_knopf.png' });
await page.setInputFiles('#zutaten-foto', [ROOT + '/icons/haus-192.png']);
await page.waitForTimeout(1500);
console.log('Bogen:', (await page.locator('#sheet-root').innerText()).replace(/\n/g, ' | ').slice(0, 500));
await page.screenshot({ path: 'z_bogen.png' });
await page.evaluate(() => window.calls.splice(0));
await page.locator('[data-form="zutaten"] button.knopf:not(.zweit)').click(); await page.waitForTimeout(500);
const c = (await page.evaluate(() => window.calls.splice(0))).filter(x => x[1] === 'ep_shopping').flatMap(x => x[2]).map(r => `${r.label}|${r.qty}|${r.category}|${r.trip}|${r.purpose}|${r.added_by}`);
console.log('Gespeichert:', c.join(' / '));
console.log('Toast:', await page.locator('.toast').innerText().catch(() => '-'));
// Einfügen
await page.locator('#neu-posten').click();
await page.evaluate(() => {
  const dt = new DataTransfer(); dt.setData('text/plain', '200 g Feta\n2 Paprika\n1 EL Olivenöl\nSpülmittel');
  document.querySelector('#neu-posten').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
});
await page.waitForTimeout(400);
console.log('Einfügen:', (await page.locator('#sheet-root').innerText()).replace(/\n/g, ' | ').slice(0, 400));
await page.screenshot({ path: 'z_einfuegen.png' });
console.log('Fehler:', errs); await b.close(); srv.close();
