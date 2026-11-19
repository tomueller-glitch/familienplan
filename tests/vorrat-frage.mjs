import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8855);
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
  await page.goto('http://localhost:8855/#woche'); await page.waitForTimeout(1200);
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




// Aus dem Vorrat: wirklich da? Ab heute (Mi 18.11.) geplante Gerichte, deren Zutaten laut Vorrat da sind.
{
  const db = base();
  const { page, ctx, errs } = await open(db, 0);
  await page.locator('[data-tab="einkauf"]').click(); await page.waitForTimeout(400);
  const box = page.locator('.vorrat-frage');
  console.log('A Frage:', (await box.innerText()).replace(/\n+/g, ' | '));
  await box.screenshot({ path: '/tmp/vorrat_frage.png' });
  await box.locator('[data-action="vorrat-da"]').first().click(); await page.waitForTimeout(300);
  const s1 = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'vorrat_check').pop();
  console.log('A Ist da:', JSON.stringify(s1 && s1.value), '| Vorrat:', JSON.stringify((await calls(page, 'ep_pantry')).flat().map((x) => [x.label, x.have, x.seen_at])));
  await box.locator('[data-action="vorrat-fehlt"]').first().click(); await page.waitForTimeout(300);
  const it = (await calls(page, 'ep_shopping')).flat().pop();
  console.log('A Fehlt:', JSON.stringify(it && [it.label, it.qty, it.purpose, it.category, it.trip, it.due, it.manual]), '| Vorrat:', JSON.stringify((await calls(page, 'ep_pantry')).flat().pop()), '| Toast:', await toastText(page));
  console.log('A danach noch Frage:', await page.locator('.vorrat-frage').count());
  console.log('Fehler:', errs); await ctx.close();
}
{
  const db = base(); db.ep_shopping = db.ep_shopping.filter((i) => !/passierte|Tomatenmark|Bohnen|Mais|Reis|Semmel|Erbsen/i.test(i.label));
  const { page, ctx, errs } = await open(db, 2);
  await page.locator('[data-tab="einkauf"]').click(); await page.waitForTimeout(400);
  console.log('A2 Kind sieht:', (await page.locator('.vorrat-frage').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
  await page.locator('[data-action="vorrat-alle-da"]').click(); await page.waitForTimeout(300);
  const s1 = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'vorrat_check').pop();
  console.log('A2 nach Alles da:', await page.locator('.vorrat-frage').count(), Object.keys((s1 && s1.value['2026-11-16']) || {}).length, '| Toast:', await toastText(page));
  console.log('Fehler:', errs); await ctx.close();
}
// B: Liste aus den Rezepten neu bauen: abgehakte Vorrat-Posten, Fehlt holt sie zurück auf die Liste
{
  const db = base(); db.ep_shopping = [];
  const { page, ctx, errs } = await open(db, 0);
  await page.locator('[data-tab="einkauf"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="liste-bauen"]').first().click(); await page.waitForTimeout(2200);
  console.log('B Toast:', await toastText(page));
  const vor = await page.evaluate(() => [...document.querySelectorAll('.posten li')].map((l) => l.innerText.replace(/\n+/g, ' ')).filter((t) => /Vorrat/.test(t)));
  console.log('B Vorrat-Posten:', JSON.stringify(vor.slice(0, 4)));
  await page.locator('.vorrat-frage [data-action="vorrat-fehlt"]').first().click(); await page.waitForTimeout(300);
  const it = (await calls(page, 'ep_shopping')).flat().pop();
  console.log('B Fehlt:', JSON.stringify(it && [it.label, it.qty, it.category, it.checked, it.id.length]));
  console.log('Fehler:', errs); await ctx.close();
}
await b.close(); srv.close();
