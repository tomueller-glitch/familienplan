import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url, 'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200, { 'Content-Type': T[path.extname(f)] || 'text/plain' }); r.end(d); }); }).listen(8831);
const { SEED } = await import(ROOT + '/js/seed.js');
const HEUTE = process.argv[2] || '2026-11-18';
const b = await chromium.launch();
async function open(settings, log) {
  const db = { __heute: HEUTE, ep_persons: SEED.persons.map((p) => ({ ...p, pin_hash: null })), ep_dishes: SEED.dishes, ep_plan: SEED.plan, ep_shopping: [], ep_tasks: SEED.tasks, ep_task_log: log, ep_pantry: [], ep_ai_runs: [], ep_settings: settings };
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
  await ctx.addInitScript((db) => {
    globalThis.ESSENSPLAN_HEUTE = db.__heute;
    window.calls = []; window.__db = db;
    const q = (table) => { const api = { select() { return api; }, order() { return api; }, eq() { return api; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); }, range() { return Promise.resolve({ data: window.__db[table] || [], error: null }); },
      upsert(rows) { window.calls.push(['upsert', table, JSON.parse(JSON.stringify(rows))]); return Promise.resolve({ error: null }); },
      delete() { const d = { gte() { return Promise.resolve({ error: null }); }, eq() { return Object.assign(Promise.resolve({ error: null }), d); }, in(c, v) { window.calls.push(['delete', table, v]); return Promise.resolve({ error: null }); } }; return d; } }; return api; };
    window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: {} } }, error: null }), signOut: async () => {} }, from: q,
      channel: () => ({ on() { return this; }, subscribe() { return this; } }), storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) }, functions: { invoke: async () => ({ data: {}, error: null }) } }) };
  }, db);
  const page = await ctx.newPage(); page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message));
  await page.goto('http://localhost:8831/#woche'); await page.waitForTimeout(1200);
  return page;
}
const logs = (page) => page.evaluate(() => window.calls.filter((c) => c[1] === 'ep_task_log' && c[0] === 'upsert').flatMap((c) => c[2]).map((r) => `${r.task_id}:${r.status}`));
const toastText = (page) => page.evaluate(() => document.querySelector('#toast').textContent);

// Kind, Bestätigung an (Standard)
let page = await open([], []);
await page.locator('[data-action="ich"]').nth(2).click(); await page.waitForTimeout(900);
const banner = page.locator('.aufgaben-hinweis');
console.log('Hinweis oben in der Woche:', await banner.count(), JSON.stringify((await banner.innerText().catch(() => '')).replace(/\s+/g, ' ')));
const top = await page.evaluate(() => { const h = document.querySelector('.aufgaben-hinweis'); const hero = document.querySelector('main .tag, main .hero, main article'); return h && hero ? h.getBoundingClientRect().top < hero.getBoundingClientRect().top : null; });
console.log('Hinweis vor dem Abendessen:', top);
await page.screenshot({ path: 'grund_hinweis.png' });
await banner.click(); await page.waitForTimeout(600);
console.log('Tippen öffnet:', await page.evaluate(() => document.querySelector('.tab[aria-current="page"]').innerText.trim()));
const basic = SEED.tasks.filter((t) => !t.minutes).map((t) => t.id);
const pickBasic = async () => { for (const id of basic) { const l = page.locator(`[data-action="aufgabe"][data-id="${id}"]`); if (await l.count()) { await l.first().click(); return id; } } return null; };
await pickBasic(); await page.waitForTimeout(500);
console.log('Gemeldet:', JSON.stringify(await logs(page)), '| Hinweis:', await toastText(page));
await page.evaluate(() => { location.hash = '#woche'; }); await page.waitForTimeout(600);
await page.evaluate(() => { location.hash = '#aufgaben'; }); await page.waitForTimeout(300); await page.evaluate(() => { location.hash = '#woche'; }); await page.waitForTimeout(600);
console.log('Hinweis danach:', JSON.stringify((await page.locator('.aufgaben-hinweis').innerText().catch(() => 'weg')).replace(/\s+/g, ' ')));
console.log('Fehler:', page.errs);
await page.context().close();

// Kind, Bestätigung ausgeschaltet
page = await open([{ key: 'aufgaben', value: { grund_bestaetigen: false } }], []);
await page.locator('[data-action="ich"]').nth(2).click(); await page.waitForTimeout(900);
await page.evaluate(() => { location.hash = '#aufgaben'; }); await page.waitForTimeout(600);
await pickBasic(); await page.waitForTimeout(500);
console.log('Ohne Bestätigung:', JSON.stringify(await logs(page)), '| Hinweis:', await toastText(page));
await page.context().close();

// Eltern sehen die gemeldete Grundaufgabe
const entry = { id: 'g1', person_id: 'p3', task_id: SEED.tasks.find((t) => !t.minutes).id, day: HEUTE, label: 'Tisch decken', minutes: 0, status: 'offen', created_at: `${HEUTE}T15:00:00Z` };
page = await open([], [entry]);
await page.locator('[data-action="ich"]').nth(0).click(); await page.waitForTimeout(900);
await page.fill('[name=pin1]', '1234'); await page.fill('[name=pin2]', '1234'); await page.click('#sheet-root button.knopf'); await page.waitForTimeout(1500);
await page.evaluate(() => { location.hash = '#aufgaben'; }); await page.waitForTimeout(700);
const q = await page.evaluate(() => [...document.querySelectorAll('[data-action="log-ok"]')].map((x) => x.closest('li, .zeile, div').innerText.replace(/\s+/g, ' ').slice(0, 90)));
console.log('Warteschlange Eltern:', JSON.stringify(q));
if (q.length) await page.locator('[data-action="log-ok"]').first().click(); await page.waitForTimeout(500);
console.log('Bestätigt:', JSON.stringify(await logs(page)));
console.log('Kinder-Hinweis bei Eltern:', await page.locator('.aufgaben-hinweis').count());
console.log('Fehler:', page.errs);
await page.context().close();
// Abgelehnt: Vermerk in der Liste, Hinweis und Kasten zählen gleich
page = await open([], [{ id: 'r1', person_id: 'p3', task_id: 'tisch-decken', day: HEUTE, label: 'Tisch decken', minutes: 0, status: 'abgelehnt', decided_by: 'p1', decided_at: `${HEUTE}T16:00:00Z`, created_at: `${HEUTE}T15:00:00Z` }]);
await page.locator('[data-action="ich"]').nth(2).click(); await page.waitForTimeout(900);
const zahl = await page.locator('.aufgaben-hinweis .ah-zahl').innerText();
await page.evaluate(() => { location.hash = '#aufgaben'; }); await page.waitForTimeout(600);
console.log('Hinweis zählt', zahl, '| Kasten:', await page.locator('.pflicht-kopf span').innerText(), '| Vermerk:', await page.locator('.pflicht .chip.nein').innerText().catch(() => 'fehlt'));
console.log('Fehler:', page.errs);
await page.context().close();
// Alles erledigt: Hinweis wird grün
const fertig = SEED.tasks.filter((x) => x.schedule === 'taeglich' || x.schedule === 'tonne').map((x, i) => ({ id: 'f' + i, person_id: 'p3', task_id: x.id, day: HEUTE, label: x.name, minutes: x.minutes || 0, status: 'offen', created_at: `${HEUTE}T15:00:00Z` }));
page = await open([], fertig);
await page.locator('[data-action="ich"]').nth(2).click(); await page.waitForTimeout(900);
console.log('Alles erledigt:', JSON.stringify((await page.locator('.aufgaben-hinweis.fertig').innerText().catch(() => 'fehlt')).replace(/\s+/g, ' ')));
console.log('Fehler:', page.errs);
await page.context().close();
await b.close(); srv.close();
