import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8858);
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
    storage: { from: () => ({ list: async () => ({ data: [{ name: 'familienplan-2026-11-15-0300.json', metadata: { size: 48213 } }, { name: 'familienplan-2026-11-08-0300.json', metadata: { size: 47001 } }], error: null }), download: async (n) => ({ data: new Blob(['{}'], { type: 'application/json' }), error: null }) }) }, functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, { action: o.body.action, n: (o.body.photos || []).length, len: (o.body.photos || []).map(p => p.data.length) }]); await new Promise(r => setTimeout(r, 400)); if (o.body.action === 'kalender') { window.kalCalls = (window.kalCalls || 0) + 1; return { data: window.KAL || { stand: '', tage: {}, feeds: [] }, error: null }; } if (o.body.action === 'mittag') { window.lastMittag = o.body.mittag; return { data: { mittag: [{ name: 'Rührei mit Spinat', minuten: 10, warum: 'Eiweiß und Gemüse.', zutaten: [{ menge: '4 Stück', name: 'Eier', da: true }, { menge: '100 g', name: 'Feta', da: false }], schritte: ['Eier verquirlen.', 'Braten.'], reste: [] }] }, error: null }; } if (o.body.action === 'kosten') { const ds = window.__db.ep_dishes; return { data: { kosten: { stand: '2026-11-18', kassenzettel: 2, gerichte: Object.fromEntries(ds.map((x, i) => [x.id, 6 + (i * 1.7) % 14])) } }, error: null }; } if (o.body.action === 'fest') { const m = await import('/js/planer.js'); return { data: { fest: m.demoFeast(o.body.fest) }, error: null }; } if (o.body.action === 'ersatz') return { data: { ersatz: { vorschlaege: [{ name: 'Kabeljaufilet TK', menge: '600 g', warum: 'Mild und fest.' }, { name: 'Alaska-Seelachs TK', menge: '600 g', warum: 'Sehr ähnlich.' }], rezept_hinweis: 'Am Vorabend im Kühlschrank auftauen und trocken tupfen.' } }, error: null }; if (o.body.action === 'sicherung') return { data: { name: 'x', anzahl: { ep_dishes: 16, ep_plan: 20 } }, error: null }; if (o.body.action === 'kassenzettel') return { data: { beleg: { markt: 'Aldi Süd', datum: '2026-11-18', summe: 14.10, hinweis: 'Eine Zeile war schwer lesbar.', posten: [ { text: 'BIO HAEHN.BR.FIL', name: 'Bio-Hähnchenbrustfilet', preis: 7.99, kategorie: 'Fleisch und Fisch' }, { text: 'SALATGURKE', name: 'Salatgurke', preis: 0.69, kategorie: 'Obst und Gemüse' }, { text: 'SPUELMASCH.TABS', name: 'Spülmaschinentabs', preis: 3.95, kategorie: 'Sonstiges' }, { text: 'PFAND', name: 'Pfand', preis: 0.25, kategorie: 'Pfand und Rabatt' } ] } }, error: null }; return { data: {}, error: null }; } } }) };
};
async function open(db, who) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
  await ctx.addInitScript(INIT, db);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8858/#woche'); await page.waitForTimeout(1200);
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



const shot = async (page, sel, file) => { const el = page.locator(sel).first(); if (await el.count()) await el.screenshot({ path: file }); };
const feeds = [{ id: 'k1', name: 'Dienst', url: 'webcal://p52-caldav.icloud.com/published/2/AAA', person_id: 'p1' },
  { id: 'k2', name: 'Familie', url: 'webcal://p52-caldav.icloud.com/published/2/BBB', person_id: null },
  { id: 'k3', name: 'Jonas', url: 'webcal://p52-caldav.icloud.com/published/2/CCC', person_id: 'p3' }];
const KAL = { stand: '2026-11-18T10:00:00Z', feeds: [{ id: 'k1', ok: true, anzahl: 2 }, { id: 'k2', ok: true, anzahl: 2 }, { id: 'k3', ok: false, fehler: 'Den Kalender gibt es unter dieser Adresse nicht (mehr). Ist er noch öffentlich?' }],
  tage: { '2026-11-18': [{ titel: 'Spätdienst', von: '12:00', bis: '20:30', ganztags: false, kalender: 'k1' }, { titel: 'Elternabend 7b', von: '19:30', bis: '21:00', ganztags: false, kalender: 'k2' }],
    '2026-11-19': [{ titel: 'Geburtstag Oma', von: null, bis: null, ganztags: true, kalender: 'k2' }, { titel: 'Nachtdienst', von: '19:30', bis: null, ganztags: false, kalender: 'k1' }] } };
async function openDisplay(db, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
  await ctx.addInitScript(INIT, db);
  await ctx.addInitScript((k) => { window.KAL = k; }, KAL);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8858/?anzeige=kueche'); await page.waitForTimeout(2200);
  return { page, ctx, errs };
}
// A: Display mit drei Kalendern, iPad mini quer und hoch
{
  const db = base(); db.ep_settings = [{ key: 'kalender', value: { feeds } }];
  const { page, ctx, errs } = await openDisplay(db, 1024, 768);
  console.log('A Abrufe:', await page.evaluate(() => window.kalCalls));
  console.log('A Termine:', (await page.locator('.anz-heute').innerText()).replace(/\n+/g, ' | '));
  console.log('A Fuß:', (await page.locator('.anz-fuss').innerText()).replace(/\n+/g, ' | '));
  console.log('A passt quer:', await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight]));
  await page.screenshot({ path: '/tmp/mini_quer.png' });
  await page.setViewportSize({ width: 768, height: 1024 }); await page.waitForTimeout(300);
  console.log('A passt hoch:', await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight]));
  await page.screenshot({ path: '/tmp/mini_hoch.png' });
  console.log('A Fehler:', errs); await ctx.close();
}
// B: Eltern tragen einen Kalender ein, prüfen und entfernen ihn
{
  const db = base();
  const { page, ctx, errs } = await open(db, 0);
  await page.locator('[data-action="familie"]').first().click(); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelectorAll('#sheet-root details').forEach((d) => { d.open = true; }));
  await page.locator('#sheet-root [data-action="kalender-abos"]').click(); await page.waitForTimeout(300);
  console.log('B Bogen:', (await page.locator('#sheet-root').innerText()).replace(/\n+/g, ' | ').slice(0, 300));
  await page.fill('#sheet-root [name=name]', 'Dienst');
  await page.fill('#sheet-root [name=url]', 'webcal://p52-caldav.icloud.com/published/2/AAA');
  await page.selectOption('#sheet-root [name=person]', 'p1');
  await page.locator('#sheet-root form[data-form=kalender] button').click(); await page.waitForTimeout(900);
  const st = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'kalender').pop();
  console.log('B gespeichert:', JSON.stringify(st && st.value));
  console.log('B Liste:', (await page.locator('#sheet-root .kal-liste').innerText()).replace(/\n+/g, ' | '), '| Abrufe:', await page.evaluate(() => window.kalCalls));
  await shot(page, '#sheet-root .bogen', '/tmp/kal_bogen.png');
  await page.locator('#sheet-root [data-action="kalender-weg"]').click(); await page.waitForTimeout(300);
  await page.locator('#sheet-root [data-action="ja"]').click(); await page.waitForTimeout(400);
  const st2 = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'kalender').pop();
  console.log('B nach Entfernen:', JSON.stringify(st2 && st2.value));
  console.log('B Fehler:', errs); await ctx.close();
}
await b.close(); srv.close();
