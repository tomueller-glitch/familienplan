import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8813);
const run = JSON.parse(fs.readFileSync(ROOT + '/tests/run.json', 'utf8'));
const { SEED } = await import(ROOT + '/js/seed.js');
const HEUTE = process.argv[2] || '2026-11-18';
const broken = SEED.dishes.map(d => d.id === 'hackbaellchen' ? { ...d, ingredients: [], steps: [] } : d);
const backup = { app: 'Familienplan', version: 1, daten: { ep_ratings: [{ day: '2026-11-19', person_id: 'p1', stars: 5 }], ep_dishes: [...SEED.dishes], ep_plan: SEED.plan.map(p => p.day === '2026-11-19' ? { ...p, dish_id: 'bohnen-wraps' } : p) } };
const db = { __heute: HEUTE, __backup: backup, ep_persons: SEED.persons.map(p => p.adult ? { ...p, pin_hash: null } : p), ep_ratings: [{ day: '2026-11-19', person_id: 'p1', stars: 2 }, { day: '2026-11-19', person_id: 'p2', stars: 3 }], ep_dishes: broken, ep_plan: SEED.plan, ep_shopping: SEED.shopping, ep_tasks: SEED.tasks, ep_pantry: SEED.pantry, ep_ai_runs: [], ep_settings: [{ key: 'haushalt', value: { budget: 900 } }, { key: 'kosten', value: { stand: '2026-11-15', kassenzettel: 2, gerichte: Object.fromEntries(SEED.dishes.map((d, i) => [d.id, 8 + i])) } }, { key: 'feste', value: [{ id: 'f1', anlass: 'Heiligabend', datum: '2025-12-24', erwachsene: 4, kinder: 2, wunsch: 'Fondue', plan: { titel: 'Fondue chinoise', menue: [{ gang: 'Haupt', gericht: 'Fondue' }], mengen: [], dips: [], gerichte: [], einkauf: [] } }] }], ep_receipts: [{ id: 'rx', day: '2026-09-12', shop: 'Aldi Süd', total: 412.3, items: [{ name: 'Bio-Hackfleisch', preis: 120, kategorie: 'Fleisch und Fisch' }, { name: 'Gemüse', preis: 200, kategorie: 'Obst und Gemüse' }] }, { id: 'r0', day: '2026-11-04', shop: 'Lidl', total: 23.5, items: [{ text: 'BANANEN', name: 'Bananen', preis: 1.99, kategorie: 'Obst und Gemüse' }, { text: 'WASCHMITTEL', name: 'Waschmittel', preis: 21.51, kategorie: 'Haushalt und Putzen' }] }, { id: 'r1', day: '2026-10-28', shop: 'Aldi Süd', total: 80, items: [] }] };
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
const say = async (l) => console.log(l, (await page.locator('#sheet-root').innerText()).replace(/\n+/g, ' | ').slice(0, 700));
await page.goto('http://localhost:8813/#woche'); await page.waitForTimeout(1200);
await page.locator('[data-action="ich"]').first().click(); await page.waitForTimeout(400);
await page.fill('[name=pin1]', '1234'); await page.fill('[name=pin2]', '1234'); await page.click('#sheet-root button.knopf'); await page.waitForTimeout(1200);
await page.evaluate(() => { location.hash = '#woche'; }); await page.waitForTimeout(500);
const main = (await page.locator('main').innerText());
console.log('Kosten:', (main.match(/Kosten der Woche[^\n]*\n[^\n]*/) || ['-'])[0]);
console.log('Abfuhr-Hinweis:', main.includes('Abfuhrtermine gehen zu Ende'));
await page.screenshot({ path: 'r_woche.png', fullPage: true });
// Einkauf Saison
await page.evaluate(() => { location.hash = '#einkauf'; }); await page.waitForTimeout(500);
console.log('Saison-Marken:', await page.locator('.marke.saison').count(), (await page.locator('.marke.saison').first().locator('xpath=..').innerText().catch(()=>'')));
// Familie: Abfuhr hochladen
await page.locator('[data-action="familie"]').first().click(); await page.waitForTimeout(400);
const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20270107\r\nSUMMARY:Restmüll\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20270114\r\nSUMMARY:Biotonne\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20270120\r\nSUMMARY:Papiertonne\r\nEND:VEVENT\r\nEND:VCALENDAR';
await page.setInputFiles('#abfuhr-datei', { name: 'abfuhr.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics) });
await page.waitForTimeout(600);
console.log('Toast:', await page.locator('.toast').innerText().catch(() => '-'));
console.log('Abfuhr-Calls:', JSON.stringify(await page.evaluate(() => window.calls.filter(c => c[1] === 'ep_abfuhr' || (c[1] === 'ep_settings' && JSON.stringify(c).includes('abfuhr'))).map(c => [c[0], c[1], JSON.stringify(c[2]).slice(0, 120)]))));
// Sicherung zurückholen
await page.locator('#sheet-root details#sicherung > summary').click(); await page.waitForTimeout(200);
await page.locator('#sheet-root [data-action="sicherungen"]').click(); await page.waitForTimeout(600);
await page.locator('#sheet-root [data-action="sicherung-zurueck"]').first().click(); await page.waitForTimeout(800);
await say('Zurückholen:');
await page.screenshot({ path: 'r_zurueck.png' });
await page.selectOption('#sheet-root [name=woche]', '2026-11-16');
await page.locator('#sheet-root button.knopf.breit').click(); await page.waitForTimeout(500);
await say('Vorschau:');
await page.screenshot({ path: 'r_vorschau.png' });
await page.evaluate(() => { window.calls.length = 0; });
await page.locator('#sheet-root [data-action="vorschau-ok"]').click(); await page.waitForTimeout(600);
console.log('Nach Übernahme:', JSON.stringify(await page.evaluate(() => window.calls.map(c => [c[0], c[1], Array.isArray(c[2]) ? c[2].length : JSON.stringify(c[2]).slice(0, 80)]))));

// Plan einfügen mit Vorschau
await page.locator('[data-action="familie"]').first().click(); await page.waitForTimeout(400);
await page.locator('#sheet-root details.klapp > summary', { hasText: 'Von Hand' }).click(); await page.waitForTimeout(200);
await page.locator('#sheet-root [data-action="import"]').click(); await page.waitForTimeout(300);
await page.fill('#sheet-root [name=json]', JSON.stringify({ week_start: '2026-11-16', dishes: [{ name: 'Hackbällchen in Tomatensauce mit Reis', ingredients: [], steps: [] }], plan: [{ day: '2026-11-20', dish: null }, { day: '2026-11-21', dish: 'Hackbällchen in Tomatensauce mit Reis' }] }));
await page.locator('#sheet-root button.knopf').last().click(); await page.waitForTimeout(400);
await say('Import-Vorschau:');
await page.screenshot({ path: 'r_import.png' });
await page.locator('#sheet-root [data-action="vorschau-zurueck"]').click(); await page.waitForTimeout(300);
console.log('Zurück, Text noch da:', (await page.inputValue('#sheet-root [name=json]')).length > 10);
await page.locator('#sheet-root .knopf-x, #sheet-root [data-action="schliessen"]').first().click().catch(()=>{}); 
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
// Festtage
await page.evaluate(() => { location.hash = '#woche'; }); await page.waitForTimeout(400);
await page.locator('[data-action="feste"]').first().click(); await page.waitForTimeout(400);
await say('Feste:');
await page.locator('#sheet-root [data-action="fest-wieder"]').click(); await page.waitForTimeout(400);
await say('Neues Fest:');
// Regeln Saison aus
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.evaluate(() => { location.hash = '#gerichte'; }); await page.waitForTimeout(400);
await page.locator('[data-action="planer-regeln"]').first().click(); await page.waitForTimeout(400);
await page.locator('#sheet-root [name=saison]').uncheck();
await page.locator('#sheet-root form[data-form="regeln"] button.knopf').last().click(); await page.waitForTimeout(400);
await page.evaluate(() => { location.hash = '#einkauf'; }); await page.waitForTimeout(400);
console.log('Saison-Marken nach Abwahl:', await page.locator('.marke.saison').count());
console.log('Fehler:', errs); await b.close(); srv.close();
