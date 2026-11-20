import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8854);
const { SEED } = await import(ROOT + '/js/seed.js');
const b = await chromium.launch();
const base = () => ({ ep_persons: SEED.persons.map(p => p.adult ? { ...p, pin_hash: null } : p), ep_dishes: SEED.dishes, ep_plan: SEED.plan, ep_shopping: SEED.shopping, ep_tasks: SEED.tasks, ep_pantry: SEED.pantry, ep_ai_runs: [], ep_settings: [], ep_task_log: [] });
const INIT = (db) => {
  globalThis.ESSENSPLAN_HEUTE = '2026-11-18';
  window.calls = []; window.__db = db;
  const q = (table) => { const api = { select() { return api; }, order() { return api; }, range() { return Promise.resolve({ data: window.__db[table] || [], error: null }); },
    upsert(rows) { window.calls.push(['upsert', table, JSON.parse(JSON.stringify(rows))]); return Promise.resolve({ error: null }); },
    delete() { const d = { eq() { return Object.assign(Promise.resolve({ error: null }), d); }, in(c, v) { window.calls.push(['delete', table, v.length]); return Promise.resolve({ error: null }); } }; return d; } }; return api; };
  window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: {} } }, error: null }), signOut: async () => {} }, from: q,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({ list: async () => ({ data: [{ name: 'familienplan-2026-11-15-0300.json', metadata: { size: 48213 } }, { name: 'familienplan-2026-11-08-0300.json', metadata: { size: 47001 } }], error: null }), download: async (n) => ({ data: new Blob(['{}'], { type: 'application/json' }), error: null }) }) }, functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, { action: o.body.action, n: (o.body.photos || []).length, len: (o.body.photos || []).map(p => p.data.length) }]); await new Promise(r => setTimeout(r, 400)); if (o.body.action === 'mittag') { window.lastMittag = o.body.mittag; return { data: { mittag: [{ name: 'Rührei mit Spinat', minuten: 10, warum: 'Eiweiß und Gemüse.', zutaten: [{ menge: '4 Stück', name: 'Eier', da: true }, { menge: '100 g', name: 'Feta', da: false }], schritte: ['Eier verquirlen.', 'Braten.'], reste: [] }] }, error: null }; } if (o.body.action === 'kosten') { const ds = window.__db.ep_dishes; return { data: { kosten: { stand: '2026-11-18', kassenzettel: 2, gerichte: Object.fromEntries(ds.map((x, i) => [x.id, 6 + (i * 1.7) % 14])) } }, error: null }; } if (o.body.action === 'fest') { const m = await import('/js/planer.js'); return { data: { fest: m.demoFeast(o.body.fest) }, error: null }; } if (o.body.action === 'ersatz') return { data: { ersatz: { vorschlaege: [{ name: 'Kabeljaufilet TK', menge: '600 g', warum: 'Mild und fest.' }, { name: 'Alaska-Seelachs TK', menge: '600 g', warum: 'Sehr ähnlich.' }], rezept_hinweis: 'Am Vorabend im Kühlschrank auftauen und trocken tupfen.' } }, error: null }; if (o.body.action === 'sicherung') return { data: { name: 'x', anzahl: { ep_dishes: 16, ep_plan: 20 } }, error: null }; if (o.body.action === 'kassenzettel') return { data: { beleg: { markt: 'Aldi Süd', datum: '2026-11-18', summe: 14.10, hinweis: 'Eine Zeile war schwer lesbar.', posten: [ { text: 'BIO HAEHN.BR.FIL', name: 'Bio-Hähnchenbrustfilet', preis: 7.99, kategorie: 'Fleisch und Fisch' }, { text: 'SALATGURKE', name: 'Salatgurke', preis: 0.69, kategorie: 'Obst und Gemüse' }, { text: 'SPUELMASCH.TABS', name: 'Spülmaschinentabs', preis: 3.95, kategorie: 'Sonstiges' }, { text: 'PFAND', name: 'Pfand', preis: 0.25, kategorie: 'Pfand und Rabatt' } ] } }, error: null }; return { data: {}, error: null }; } } }) };
};
async function open(db, who) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
  await ctx.addInitScript(INIT, db);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8854/#woche'); await page.waitForTimeout(1200);
  await page.locator('[data-action="ich"]').nth(who).click(); await page.waitForTimeout(400);
  if (who < 2) { await page.fill('[name=pin1]', '1234'); await page.fill('[name=pin2]', '1234'); await page.click('#sheet-root button.knopf'); await page.waitForTimeout(1500); }
  await page.evaluate(() => { location.hash = '#aufgaben'; }); await page.waitForTimeout(600);
  return { page, ctx, errs };
}
const calls = (page, table) => page.evaluate((t) => window.calls.filter((c) => c[0] === 'upsert' && c[1] === t).map((c) => c[2]), table);
const toastText = (page) => page.evaluate(() => [...document.querySelectorAll('.toast, [role=status]')].map((x) => x.textContent.trim()).filter(Boolean).join(' | '));
// Die App rechnet mit dem Testtag 18.11. und der echten Uhrzeit. Dieselbe Uhr für die Testdaten.
const appNow = () => { const n = new Date(); return new Date(2026, 10, 18, n.getHours(), n.getMinutes(), n.getSeconds()).getTime(); };
const iso = new Date(appNow()).toISOString();



// Gleiche Posten auf der Einkaufsliste: Einzahl und Mehrzahl, Stk. und Stück, kg und g.
const it = (id, label, qty, purpose, sort, extra = {}) => ({ id, week_start: '2026-11-16', trip: 'Großeinkauf am Sa 14.11.', due: '2026-11-14', label, qty, purpose, sort, category: 'obst', shop: null, missing: false, checked: false, checked_by: null, checked_at: null, manual: false, ...extra });
const liste = () => [
  it('a', 'Knoblauchzehen', '2 Stück', 'Chili con Carne (Di)', 1), it('b', 'Knoblauchzehe', '2 Stk.', 'Spinat-Lasagne (Sa), Fränkisches Rindergulasch (So)', 2),
  it('c', 'Zwiebel', '2 Stk.', 'Seelachs-Frikadellen (Mo), Spinat-Lasagne (Sa)', 7), it('d', 'Zwiebeln', '2 Stück', 'Chili con Carne (Di), Gemüsefrittata (Mi)', 8),
  it('e', 'Rotkohl', '700 g', 'Rindergulasch (So)', 5), it('f', 'Kopfsalat', '1 Kopf', 'Gemüsefrittata (Mi)', 6),
  it('g', 'Zwiebeln', '1 Stück', 'von Hand', 9, { manual: true }), it('h', 'Knoblauchzehe', '1 Stück', 'schon gekauft', 10, { checked: true }),
];
{
  const db = base(); db.ep_shopping = liste();
  const { page, ctx, errs } = await open(db, 0);
  await page.waitForTimeout(600);
  const del = (await calls(page, 'ep_shopping')).flat();
  console.log('Gespeichert:', JSON.stringify(del.map((r) => [r.id, r.label, r.qty, r.purpose])));
  console.log('Gelöscht:', JSON.stringify(await page.evaluate(() => window.calls.filter((c) => c[0] === 'delete' && c[1] === 'ep_shopping'))));
  await page.locator('[data-tab="einkauf"]').click(); await page.waitForTimeout(400);
  const txt = (await page.locator('main').innerText()).replace(/\n+/g, ' | ');
  for (const w of ['Knoblauch', 'Zwiebel', 'Rotkohl']) console.log(w, '->', (txt.match(new RegExp(`${w}[^|]*\\| [^|]*\\| [^|]*`, 'g')) || []).join(' || '));
  console.log('Fehler:', errs); await ctx.close();
}
// Zwei Touren auf denselben Tag gelegt: eine Liste, doppelte Posten zusammengefasst.
{
  const G = 'Großeinkauf am Sa 21.11.'; const F = 'Frischeeinkauf am Mi 25.11.';
  const t = (id, label, qty, trip, due, extra = {}) => ({ ...it(id, label, qty, '', Number(id.slice(1)), extra), week_start: '2026-11-23', trip, due, buyer: trip === G ? 'p1' : null });
  const db = base(); db.ep_plan = [...db.ep_plan];
  db.ep_shopping = [t('x1', 'Zwiebeln', '2 Stück', G, '2026-11-21'), t('x2', 'Feldsalat', '150 g', F, '2026-11-25'), t('x3', 'Zwiebel', '1 Stück', F, '2026-11-25'), t('x4', 'Nudeln', '500 g', G, '2026-11-21', { category: 'vorrat' }), t('x5', 'Milch', '1 l', F, '2026-11-25', { manual: true, category: 'kuehl' })];
  const { page, ctx, errs } = await open(db, 0);
  await page.locator('[data-tab="einkauf"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="woche"][data-dir="1"]').first().click(); await page.waitForTimeout(400);
  const heads = async () => (await page.locator('main').innerText()).split('\n').filter((l) => /einkauf am|Einkaufstag/i.test(l)).join(' | ');
  console.log('Z vorher:', await heads());
  const form = page.locator(`form[data-form="einkaufstag"]:has(input[name=trip][value="${F}"])`);
  await page.evaluate((f) => { const d = [...document.querySelectorAll('details.einkaufstag')].find((x) => x.querySelector(`input[value="${f}"]`)); if (d) d.open = true; }, F);
  await form.locator('input[type=date]').fill('2026-11-21'); await form.locator('button').click(); await page.waitForTimeout(600);
  console.log('Z Hinweis:', await toastText(page));
  const saved = (await calls(page, 'ep_shopping')).flat();
  const last = new Map(); for (const r of saved) last.set(r.id, r);
  console.log('Z Posten:', [...last.values()].filter((r) => r.id.startsWith('x')).map((r) => `${r.id}:${r.label}:${r.qty}:${r.trip}:${r.due}:${r.buyer}`).join(' | '));
  console.log('Z x2:', saved.filter((r) => r.id === 'x2').map((r) => `${r.trip}/${r.due}/${r.buyer}`).join(' , '));
  console.log('Z gelöscht:', JSON.stringify(await page.evaluate(() => window.calls.filter((c) => c[0] === 'delete' && c[1] === 'ep_shopping'))));
  console.log('Z nachher:', await heads());
  console.log('Z Fehler:', errs); await ctx.close();
}
// Zwei Wochen, ein Einkaufstag: eine Liste, gleiche Sachen in einer Zeile, ein Haken für beide.
{
  const G = 'Großeinkauf am Sa 21.11.'; const F = 'Frischeeinkauf am Mi 18.11.';
  const t = (id, label, qty, trip, due, week, extra = {}) => ({ ...it(id, label, qty, '', Number(id.slice(1)), extra), week_start: week, trip, due });
  const db = base();
  db.ep_shopping = [t('y1', 'Zwiebeln', '2 Stück', F, '2026-11-18', '2026-11-16'), t('y2', 'Feldsalat', '150 g', F, '2026-11-18', '2026-11-16'),
    t('y3', 'Zwiebel', '1 Stück', G, '2026-11-21', '2026-11-23'), t('y4', 'Nudeln', '500 g', G, '2026-11-21', '2026-11-23', { category: 'vorrat' })];
  const { page, ctx, errs } = await open(db, 0);
  await page.locator('[data-tab="einkauf"]').click(); await page.waitForTimeout(300);
  const form = page.locator(`form[data-form="einkaufstag"]:has(input[name=trip][value="${F}"])`);
  await page.evaluate(() => document.querySelectorAll('details.einkaufstag').forEach((d) => { d.open = true; }));
  await form.locator('input[type=date]').fill('2026-11-21'); await form.locator('button').click(); await page.waitForTimeout(600);
  console.log('Y Hinweis:', await toastText(page));
  const rows = async () => (await page.locator('main .posten').allInnerTexts()).join(' | ').replace(/\n+/g, ' / ');
  console.log('Y KW 47:', await rows(), '|', (await page.locator('.tour-gast').innerText().catch(() => '-')));
  await page.locator('.posten li', { hasText: 'Zwiebel' }).locator('[data-action="haken"]').click(); await page.waitForTimeout(500);
  const saved = (await calls(page, 'ep_shopping')).flat().filter((r) => ['y1', 'y3'].includes(r.id)).slice(-2);
  console.log('Y Haken:', saved.map((r) => `${r.id}:${r.checked}`).join(' '));
  await page.locator('[data-action="woche"][data-dir="1"]').first().click(); await page.waitForTimeout(400);
  console.log('Y KW 48:', await rows());
  console.log('Y Fehler:', errs); await ctx.close();
}
// Logik: Touren am selben Tag
{
  const L = await import(ROOT + '/js/logic.js');
  const mk = (id, trip, due, buyer = null, week = '2026-11-23') => ({ id, trip, due, buyer, week_start: week });
  const ch = L.sameDayTrips([mk('a', 'Groß', '2026-11-21', 'p1'), mk('b', 'Groß', '2026-11-21'), mk('c', 'Frisch', '2026-11-21'), mk('d', 'Frisch', '2026-11-25'), mk('e', 'Andere Woche', '2026-11-21', null, '2026-11-16'), mk('f', 'Einzeln', '2026-11-27')]);
  console.log('Z Logik:', ch.map((x) => `${x.id}->${x.trip}/${x.buyer}`).join(' '));
}
await b.close(); srv.close();
