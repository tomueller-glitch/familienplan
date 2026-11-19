import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8857);
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
    storage: { from: () => ({ list: async () => ({ data: [{ name: 'familienplan-2026-11-15-0300.json', metadata: { size: 48213 } }, { name: 'familienplan-2026-11-08-0300.json', metadata: { size: 47001 } }], error: null }), download: async (n) => ({ data: new Blob(['{}'], { type: 'application/json' }), error: null }) }) }, functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, { action: o.body.action, n: (o.body.photos || []).length, len: (o.body.photos || []).map(p => p.data.length) }]); await new Promise(r => setTimeout(r, 400)); if (o.body.action === 'neues-gericht') { window.lastNeu = o.body.neu; const k = (o.body.neu.abgelehnt || []).length; return { data: { neu: { warum: 'Nutzt den schon gekauften Lauch, schnell und mit viel Eiweiß.', gericht: { name: k ? 'Lachs-Lauch-Gratin' : 'Hähnchen-Lauch-Pfanne mit Kartoffeln', category: k ? 'fisch' : 'gefluegel', duration_min: 35, tags: ['Schnell'], note: '', prep: '', ingredients: [[600, 'g', k ? 'Lachsfilet' : 'Hähnchenbrustfilet', k ? 'fisch' : 'fleisch'], [2, 'Stange', 'Lauch', 'obst'], [800, 'g', 'Bio-Kartoffeln', 'obst'], [200, 'g', 'Feldsalat', 'obst'], [200, 'g', 'Kochsahne', 'kuehl'], [null, '', '2 EL Öl', 'basis']], steps: ['Kartoffeln kochen.', 'Fleisch anbraten, Lauch dazu.', 'Mit Sahne ablöschen.'] } } }, error: null }; } if (o.body.action === 'mittag') { window.lastMittag = o.body.mittag; return { data: { mittag: [{ name: 'Rührei mit Spinat', minuten: 10, warum: 'Eiweiß und Gemüse.', zutaten: [{ menge: '4 Stück', name: 'Eier', da: true }, { menge: '100 g', name: 'Feta', da: false }], schritte: ['Eier verquirlen.', 'Braten.'], reste: [] }] }, error: null }; } if (o.body.action === 'kosten') { const ds = window.__db.ep_dishes; return { data: { kosten: { stand: '2026-11-18', kassenzettel: 2, gerichte: Object.fromEntries(ds.map((x, i) => [x.id, 6 + (i * 1.7) % 14])) } }, error: null }; } if (o.body.action === 'fest') { const m = await import('/js/planer.js'); return { data: { fest: m.demoFeast(o.body.fest) }, error: null }; } if (o.body.action === 'ersatz') return { data: { ersatz: { vorschlaege: [{ name: 'Kabeljaufilet TK', menge: '600 g', warum: 'Mild und fest.' }, { name: 'Alaska-Seelachs TK', menge: '600 g', warum: 'Sehr ähnlich.' }], rezept_hinweis: 'Am Vorabend im Kühlschrank auftauen und trocken tupfen.' } }, error: null }; if (o.body.action === 'sicherung') return { data: { name: 'x', anzahl: { ep_dishes: 16, ep_plan: 20 } }, error: null }; if (o.body.action === 'kassenzettel') return { data: { beleg: { markt: 'Aldi Süd', datum: '2026-11-18', summe: 14.10, hinweis: 'Eine Zeile war schwer lesbar.', posten: [ { text: 'BIO HAEHN.BR.FIL', name: 'Bio-Hähnchenbrustfilet', preis: 7.99, kategorie: 'Fleisch und Fisch' }, { text: 'SALATGURKE', name: 'Salatgurke', preis: 0.69, kategorie: 'Obst und Gemüse' }, { text: 'SPUELMASCH.TABS', name: 'Spülmaschinentabs', preis: 3.95, kategorie: 'Sonstiges' }, { text: 'PFAND', name: 'Pfand', preis: 0.25, kategorie: 'Pfand und Rabatt' } ] } }, error: null }; return { data: {}, error: null }; } } }) };
};
async function open(db, who) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
  await ctx.addInitScript(INIT, db);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8857/#woche'); await page.waitForTimeout(1200);
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






const W = '2026-11-23';
const { SEED: S2 } = { SEED };
const plan48 = [['2026-11-23', 'chili'], ['2026-11-24', 'haehnchen-nudeln'], ['2026-11-25', 'frittata'], ['2026-11-26', 'putengeschnetzeltes'], ['2026-11-27', 'pizza'], ['2026-11-28', 'burger'], ['2026-11-29', 'gyros']].map(([day, dish_id]) => ({ day, dish_id, lunchbox: '', skipped: false, prep: '' }));
async function openAt(db, url) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
  await ctx.addInitScript(INIT, db);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8857/' + url); await page.waitForTimeout(1200);
  await page.locator('[data-action="ich"]').first().click(); await page.waitForTimeout(400);
  await page.fill('[name=pin1]', '1234'); await page.fill('[name=pin2]', '1234'); await page.click('#sheet-root button.knopf'); await page.waitForTimeout(1500);
  return { page, ctx, errs };
}
const ups = (page, t) => page.evaluate((t) => window.calls.filter((c) => c[0] === 'upsert' && c[1] === t).flatMap((c) => c[2]), t);
const G = 'Großeinkauf am Sa 21.11.', F = 'Frischeeinkauf am Mi 25.11.';
const it = (id, label, qty, purpose, trip, extra = {}) => ({ id, week_start: W, trip, due: trip === G ? '2026-11-21' : '2026-11-25', category: 'obst', label, qty, purpose, sort: Number(id.slice(1)), missing: false, checked: false, manual: false, ...extra });
const list48 = () => [
  it('s1', 'Bio-Nudeln (kein Vollkorn)', '400 g', 'Nudeln (Di)', G, { category: 'vorrat' }), it('s2', 'Bio-Landhähnchen Ministeaks', '600 g', 'Nudeln (Di)', G, { category: 'fleisch' }),
  it('s3', 'Lauch', '2 Stangen', 'Nudeln (Di)', G, { checked: true, checked_by: 'p1' }), it('s4', 'Zwiebeln', '3 Stück', 'Chili con Carne (Mo), Nudeln (Di)', G),
  it('s5', 'Feldsalat', '150 g', 'Pizza (Fr)', F), it('s6', 'Vollkornbrot', '1 Packung', 'Brotbox (Di)', G, { category: 'brot' })];
// A: Dienstag (Nudeln) an Claude zurückgeben, Wunsch und Pause, zweiter Vorschlag, übernehmen
{
  const db = base(); db.ep_plan = [...db.ep_plan.filter((p) => p.day < W), ...plan48]; db.ep_shopping = [...db.ep_shopping, ...list48()];
  const { page, ctx, errs } = await openAt(db, `?woche=${W}#woche`);
  await page.evaluate(() => { location.hash = '#woche'; });
  await page.locator('[data-action="tauschen"][data-day="2026-11-24"], [data-action="tag"][data-day="2026-11-24"]').first().click(); await page.waitForTimeout(400);
  console.log('A Tagesbogen hat Knopf:', await page.locator('#sheet-root [data-action="neu-gericht"]').count(), '|', (await page.locator('#sheet-root h2').first().innerText().catch(() => '')));
  await page.locator('#sheet-root [data-action="neu-gericht"]').first().click(); await page.waitForTimeout(300);
  console.log('A Bogen:', (await page.locator('#sheet-root').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
  await page.fill('#sheet-root [name=wunsch]', 'lieber mit Lauch'); await page.check('#sheet-root [name=pause]');
  await page.locator('#sheet-root form[data-form="neu-gericht"] button').click(); await page.waitForTimeout(150);
  console.log('A lädt:', (await page.locator('#sheet-root').innerText()).replace(/\n+/g, ' | ').slice(0, 120));
  await page.waitForTimeout(900);
  const sent = await page.evaluate(() => window.lastNeu);
  console.log('A gesendet:', JSON.stringify({ ...sent, sammlung: sent.sammlung.length, vorrat: sent.vorrat.length }).slice(0, 900));
  console.log('A Vorschlag:', (await page.locator('#sheet-root').innerText()).replace(/\n+/g, ' | ').slice(0, 500));
  await page.screenshot({ path: '/tmp/neu_gericht.png' });
  await page.fill('#sheet-root [name=wunsch]', 'lieber Fisch');
  await page.locator('#sheet-root form[data-form="neu-gericht"] button').click(); await page.waitForTimeout(1300);
  console.log('A zweiter Vorschlag:', await page.locator('#sheet-root h2').first().innerText(), '| abgelehnt:', JSON.stringify((await page.evaluate(() => window.lastNeu)).abgelehnt), '| Wunsch:', (await page.evaluate(() => window.lastNeu)).wunsch);
  await page.locator('#sheet-root [data-action="neu-gericht-ok"]').click(); await page.waitForTimeout(600);
  const dishes = await ups(page, 'ep_dishes');
  console.log('A Gerichte:', JSON.stringify(dishes.map((d) => [d.name, d.pause_until || null, (d.ingredients || []).length])));
  console.log('A Plan:', JSON.stringify((await ups(page, 'ep_plan')).map((r) => [r.day, r.dish_id === dishes.find((d) => d.name === 'Lachs-Lauch-Gratin').id])));
  const sh = await ups(page, 'ep_shopping');
  console.log('A Liste gespeichert:', JSON.stringify(sh.map((r) => `${r.label} [${r.qty}] ${r.purpose} {${String(r.trip).slice(0, 5)}}`)));
  console.log('A gelöscht:', JSON.stringify(await page.evaluate(() => window.calls.filter((c) => c[0] === 'delete'))));
  console.log('A Toast:', await toastText(page));
  console.log('A Tagesbogen:', await page.locator('#sheet-root h2').first().innerText());
  console.log('A Fehler:', errs); await ctx.close();
}
// B: Gericht tauschen aus der Sammlung passt die Liste jetzt auch an
{
  const db = base(); db.ep_plan = [...db.ep_plan.filter((p) => p.day < W), ...plan48]; db.ep_shopping = [...db.ep_shopping, ...list48()];
  const { page, ctx, errs } = await openAt(db, `?woche=${W}#woche`);
  await page.evaluate(() => { location.hash = '#woche'; });
  await page.locator('[data-action="tauschen"][data-day="2026-11-24"], [data-action="tag"][data-day="2026-11-24"]').first().click(); await page.waitForTimeout(400);
  await page.locator('#sheet-root [data-action="tauschen"]').first().click(); await page.waitForTimeout(300);
  console.log('B Hinweis oben:', await page.locator('#sheet-root .neu-claude').count());
  await page.locator('#sheet-root [data-action="waehlen"]', { hasText: 'Linsenbolognese' }).first().click(); await page.waitForTimeout(600);
  const sh = await ups(page, 'ep_shopping');
  console.log('B Liste:', JSON.stringify(sh.map((r) => `${r.label} [${r.qty}] ${r.purpose} {${String(r.trip).slice(0, 5)}}`)));
  console.log('B Toast:', await toastText(page));
  console.log('B Fehler:', errs); await ctx.close();
}
await b.close(); srv.close();
