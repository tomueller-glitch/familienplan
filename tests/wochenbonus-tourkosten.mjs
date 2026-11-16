import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8817);
const run = JSON.parse(fs.readFileSync(ROOT + '/tests/run.json', 'utf8'));
const { SEED } = await import(ROOT + '/js/seed.js');
const HEUTE = process.argv[2] || '2026-11-18';
const broken = SEED.dishes.map(d => d.id === 'hackbaellchen' ? { ...d, ingredients: [], steps: [] } : d);
const backup = { app: 'Familienplan', version: 1, daten: { ep_ratings: [{ day: '2026-11-19', person_id: 'p1', stars: 5 }], ep_dishes: [...SEED.dishes], ep_plan: SEED.plan.map(p => p.day === '2026-11-19' ? { ...p, dish_id: 'bohnen-wraps' } : p) } };
const A = await import(ROOT + '/js/aufgaben.js');
const L = await import(ROOT + '/js/logic.js');
const log = [];
const wk = L.mondayOf(HEUTE);
for (let n = 0; n < 7; n++) { const day = L.addDays(wk, n); if (day > HEUTE) break; for (const f of A.tasksFor(SEED.tasks, [], 'p3', day).fixed.filter(f => !f.task.minutes && !f.weekly)) log.push({ id: 'l' + day + f.task.id, person_id: 'p3', task_id: f.task.id, day, label: f.label, minutes: 0, status: 'bestaetigt', created_at: day + 'T18:00:00Z' }); }
// Kind 2: Dienstag fehlt
for (let n = 0; n < 7; n++) { const day = L.addDays(wk, n); if (day > HEUTE || n === 1) continue; for (const f of A.tasksFor(SEED.tasks, [], 'p4', day).fixed.filter(f => !f.task.minutes && !f.weekly)) log.push({ id: 'm' + day + f.task.id, person_id: 'p4', task_id: f.task.id, day, label: f.label, minutes: 0, status: 'bestaetigt', created_at: day + 'T18:00:00Z' }); }
const rcpt = { id: 'rk', day: '2026-11-07', shop: 'Aldi Süd', total: 40, items: ['Bio-Hackfleisch vom Rind|5.49','Bio-Hähnchenbrustfilet|7.99','Seelachsfilet|3.49','Erbsen TK|1.19','Bio-Eier 10er|3.29','Bio-Milch 1 l|1.15','Bio-Butter|2.49','Frischkäse|1.19','Naturjoghurt|0.89','Parmesan|2.99','Skyr|1.29','Hefe|0.15','Bio-Karotten|1.29','Zwiebeln 1 kg|1.19','Knoblauch|0.79','Bio-Kartoffeln 2 kg|2.99'].map(x => ({ name: x.split('|')[0], preis: Number(x.split('|')[1]), kategorie: 'Lebensmittel' })) };
const db = { __heute: HEUTE, ep_task_log: log, __backup: backup, ep_persons: SEED.persons.map(p => p.adult ? { ...p, pin_hash: null } : p), ep_ratings: [{ day: '2026-11-19', person_id: 'p1', stars: 2 }, { day: '2026-11-19', person_id: 'p2', stars: 3 }], ep_dishes: broken, ep_plan: SEED.plan, ep_shopping: SEED.shopping, ep_tasks: SEED.tasks, ep_pantry: SEED.pantry, ep_ai_runs: [], ep_settings: [{ key: 'ki_verbrauch', value: { '2026-11': { usd: 0.6123, n: 9, arten: { wochenplan: 0.41, kassenzettel: 0.12, mittag: 0.004, kosten: 0.07 } }, '2026-10': { usd: 1.83, n: 20, arten: {} } } }, { key: 'haushalt', value: { budget: 900 } }, { key: 'kosten', value: { stand: '2026-11-15', kassenzettel: 2, gerichte: Object.fromEntries(SEED.dishes.map((d, i) => [d.id, 8 + i])) } }, { key: 'feste', value: [{ id: 'f1', anlass: 'Heiligabend', datum: '2025-12-24', erwachsene: 4, kinder: 2, wunsch: 'Fondue', plan: { titel: 'Fondue chinoise', menue: [{ gang: 'Haupt', gericht: 'Fondue' }], mengen: [], dips: [], gerichte: [], einkauf: [] } }] }], ep_receipts: [rcpt, { id: 'rx', day: '2026-09-12', shop: 'Aldi Süd', total: 412.3, items: [{ name: 'Bio-Hackfleisch', preis: 120, kategorie: 'Fleisch und Fisch' }, { name: 'Gemüse', preis: 200, kategorie: 'Obst und Gemüse' }] }, { id: 'r0', day: '2026-11-04', shop: 'Lidl', total: 23.5, items: [{ text: 'BANANEN', name: 'Bananen', preis: 1.99, kategorie: 'Obst und Gemüse' }, { text: 'WASCHMITTEL', name: 'Waschmittel', preis: 21.51, kategorie: 'Haushalt und Putzen' }] }, { id: 'r1', day: '2026-10-28', shop: 'Aldi Süd', total: 80, items: [] }] };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
await ctx.addInitScript((db) => {
  globalThis.ESSENSPLAN_HEUTE = db.__heute;
  window.calls = []; window.__db = db;
  const q = (table) => { const api = { select() { return api; }, order() { return api; }, range() { return Promise.resolve({ data: window.__db[table] || [], error: null }); },
    upsert(rows) { window.calls.push(['upsert', table, JSON.parse(JSON.stringify(rows))]); return Promise.resolve({ error: null }); },
    delete() { const d = { gte(c, v) { window.calls.push(['delete-gte', table, v]); return Promise.resolve({ error: null }); }, eq() { return Object.assign(Promise.resolve({ error: null }), d); }, in(c, v) { window.calls.push(['delete', table, v.length]); return Promise.resolve({ error: null }); } }; return d; } }; return api; };
  window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: {} } }, error: null }), signOut: async () => {} }, from: q,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({ list: async () => ({ data: [{ name: 'familienplan-2026-11-15-0300.json', metadata: { size: 48213 } }, { name: 'familienplan-2026-11-08-0300.json', metadata: { size: 47001 } }], error: null }), download: async (n) => ({ data: new Blob([JSON.stringify(window.__db.__backup)], { type: 'application/json' }), error: null }) }) }, functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, { action: o.body.action, n: (o.body.photos || []).length, len: (o.body.photos || []).map(p => p.data.length) }]); await new Promise(r => setTimeout(r, 400)); if (o.body.action === 'mittag') { window.lastMittag = o.body.mittag; return { data: { mittag: [{ name: 'Rührei mit Spinat', minuten: 10, warum: 'Eiweiß und Gemüse.', zutaten: [{ menge: '4 Stück', name: 'Eier', da: true }, { menge: '100 g', name: 'Feta', da: false }], schritte: ['Eier verquirlen.', 'Braten.'], reste: [] }] }, error: null }; } if (o.body.action === 'kosten') { const ds = window.__db.ep_dishes; return { data: { kosten: { stand: '2026-11-20', kassenzettel: 2, gerichte: Object.fromEntries(ds.map((x, i) => [x.id, 6 + (i * 1.7) % 14])) } }, error: null }; } if (o.body.action === 'fest') { const m = await import('/js/planer.js'); return { data: { fest: m.demoFeast(o.body.fest) }, error: null }; } if (o.body.action === 'ersatz') return { data: { ersatz: { vorschlaege: [{ name: 'Kabeljaufilet TK', menge: '600 g', warum: 'Mild und fest.' }, { name: 'Alaska-Seelachs TK', menge: '600 g', warum: 'Sehr ähnlich.' }], rezept_hinweis: 'Am Vorabend im Kühlschrank auftauen und trocken tupfen.' } }, error: null }; if (o.body.action === 'sicherung') return { data: { name: 'x', anzahl: { ep_dishes: 16, ep_plan: 20 } }, error: null }; if (o.body.action === 'kassenzettel') return { data: { beleg: { markt: 'Aldi Süd', datum: '2026-11-20', summe: 14.10, hinweis: 'Eine Zeile war schwer lesbar.', posten: [ { text: 'BIO HAEHN.BR.FIL', name: 'Bio-Hähnchenbrustfilet', preis: 7.99, kategorie: 'Fleisch und Fisch' }, { text: 'SALATGURKE', name: 'Salatgurke', preis: 0.69, kategorie: 'Obst und Gemüse' }, { text: 'SPUELMASCH.TABS', name: 'Spülmaschinentabs', preis: 3.95, kategorie: 'Sonstiges' }, { text: 'PFAND', name: 'Pfand', preis: 0.25, kategorie: 'Pfand und Rabatt' } ] } }, error: null }; return { data: {}, error: null }; } } }) };
}, db);







const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8817/#aufgaben'); await page.waitForTimeout(1200);
await page.locator('[data-action="ich"]').nth(2).click(); await page.waitForTimeout(1200);
await page.evaluate(() => { location.hash = '#aufgaben'; }); await page.waitForTimeout(600);
console.log('Bonus-Upserts:', JSON.stringify(await page.evaluate(() => window.calls.filter(c => c[1] === 'ep_task_log').map(c => c[2].map(r => [r.id, r.person_id, r.minutes, r.label])))));
console.log('Kind 1:', (await page.locator('.bonus-kasten').innerText()).replace(/\n/g, ' | '), '| Konto:', await page.locator('.konto-zahl .n').first().innerText());
await page.screenshot({ path: 'b_kind1.png' });
// Kind 2
await page.locator('header [data-action="familie"], [data-action="familie"]').first().click(); await page.waitForTimeout(400);
await page.locator('#sheet-root input[name=ich][value=p4]').check(); await page.locator('#sheet-root form[data-form=familie] button.knopf').click(); await page.waitForTimeout(600);
await page.evaluate(() => { location.hash = '#aufgaben'; }); await page.waitForTimeout(500);
console.log('Kind 2:', (await page.locator('.bonus-kasten').innerText().catch(() => '-')).replace(/\n/g, ' | '));
await page.screenshot({ path: 'b_kind2.png' });
// Einkauf Tourkosten
await page.evaluate(() => { location.hash = '#einkauf'; }); await page.waitForTimeout(500);
console.log('Tourkosten:', JSON.stringify(await page.locator('.tour-kosten').allInnerTexts()));
console.log('Fehler:', errs); await b.close(); srv.close();
