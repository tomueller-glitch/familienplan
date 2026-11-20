// Wunschessen-Duell (ganze Familie, Gleichstand) und Live-Einkauf (Nachricht, Hinweis, neue Posten markiert).
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8859);
const { SEED } = await import(ROOT + '/js/seed.js');
const b = await chromium.launch();
const base = () => ({ ep_persons: SEED.persons.map(p => p.adult ? { ...p, pin_hash: null } : p), ep_dishes: SEED.dishes, ep_plan: SEED.plan, ep_shopping: SEED.shopping, ep_tasks: SEED.tasks, ep_pantry: SEED.pantry, ep_ai_runs: [], ep_settings: [], ep_task_log: [] });
const INIT = (db) => {
  globalThis.ESSENSPLAN_HEUTE = '2026-11-18';
  window.calls = []; window.__db = db;
  const q = (table) => { const api = { select() { return api; }, order() { return api; }, eq() { return api; }, in() { return api; }, maybeSingle() { return Promise.resolve({ data: (window.__db[table] || [])[0] || null, error: null }); }, then(ok, bad) { return Promise.resolve({ data: window.__db[table] || [], error: null }).then(ok, bad); }, range() { return Promise.resolve({ data: window.__db[table] || [], error: null }); },
    upsert(rows) { window.calls.push(['upsert', table, JSON.parse(JSON.stringify(rows))]); return Promise.resolve({ error: null }); },
    delete() { const d = { eq() { return Object.assign(Promise.resolve({ error: null }), d); }, in(c, v) { window.calls.push(['delete', table, v.length]); return Promise.resolve({ error: null }); } }; return d; } }; return api; };
  window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: {} } }, error: null }), signOut: async () => {} }, from: q,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({ list: async () => ({ data: [{ name: 'familienplan-2026-11-15-0300.json', metadata: { size: 48213 } }, { name: 'familienplan-2026-11-08-0300.json', metadata: { size: 47001 } }], error: null }), download: async (n) => ({ data: new Blob(['{}'], { type: 'application/json' }), error: null }) }) }, functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, { action: o.body.action, n: (o.body.photos || []).length, len: (o.body.photos || []).map(p => p.data.length) }]); await new Promise(r => setTimeout(r, 400)); if (o.body.action === 'kalender') { window.kalCalls = (window.kalCalls || 0) + 1; window.kalTage = o.body.tage; return { data: window.KAL || { stand: '', tage: {}, feeds: [] }, error: null }; } if (o.body.action === 'mittag') { window.lastMittag = o.body.mittag; return { data: { mittag: [{ name: 'Rührei mit Spinat', minuten: 10, warum: 'Eiweiß und Gemüse.', zutaten: [{ menge: '4 Stück', name: 'Eier', da: true }, { menge: '100 g', name: 'Feta', da: false }], schritte: ['Eier verquirlen.', 'Braten.'], reste: [] }] }, error: null }; } if (o.body.action === 'kosten') { const ds = window.__db.ep_dishes; return { data: { kosten: { stand: '2026-11-18', kassenzettel: 2, gerichte: Object.fromEntries(ds.map((x, i) => [x.id, 6 + (i * 1.7) % 14])) } }, error: null }; } if (o.body.action === 'fest') { const m = await import('/js/planer.js'); return { data: { fest: m.demoFeast(o.body.fest) }, error: null }; } if (o.body.action === 'ersatz') return { data: { ersatz: { vorschlaege: [{ name: 'Kabeljaufilet TK', menge: '600 g', warum: 'Mild und fest.' }, { name: 'Alaska-Seelachs TK', menge: '600 g', warum: 'Sehr ähnlich.' }], rezept_hinweis: 'Am Vorabend im Kühlschrank auftauen und trocken tupfen.' } }, error: null }; if (o.body.action === 'sicherung') return { data: { name: 'x', anzahl: { ep_dishes: 16, ep_plan: 20 } }, error: null }; if (o.body.action === 'kassenzettel') return { data: { beleg: { markt: 'Aldi Süd', datum: '2026-11-18', summe: 14.10, hinweis: 'Eine Zeile war schwer lesbar.', posten: [ { text: 'BIO HAEHN.BR.FIL', name: 'Bio-Hähnchenbrustfilet', preis: 7.99, kategorie: 'Fleisch und Fisch' }, { text: 'SALATGURKE', name: 'Salatgurke', preis: 0.69, kategorie: 'Obst und Gemüse' }, { text: 'SPUELMASCH.TABS', name: 'Spülmaschinentabs', preis: 3.95, kategorie: 'Sonstiges' }, { text: 'PFAND', name: 'Pfand', preis: 0.25, kategorie: 'Pfand und Rabatt' } ] } }, error: null }; return { data: {}, error: null }; } } }) };
};
async function open(db, who, kal) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  if (kal) await ctx.addInitScript((k) => { window.KAL = k; }, kal);
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
  await ctx.addInitScript(INIT, db);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8859/#woche'); await page.waitForTimeout(1200);
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
  tage: { '2026-11-18': [{ titel: 'Spätdienst', von: '12:00', bis: '20:30', ganztags: false, kalender: 'k1' }, { titel: 'Training D1', von: '17:00', bis: '18:30', ganztags: false, zeit: true, kalender: 'k1' }, { titel: 'Training D1', von: '17:00', bis: '18:30', ganztags: false, zeit: true, kalender: 'k3' }, { titel: 'Werkstatt', von: '10:30', bis: '10:30', ganztags: false, zeit: true, kalender: 'k1' }, { titel: 'Elternabend 7b', von: '19:30', bis: '21:00', ganztags: false, kalender: 'k2' }],
    '2026-11-19': [{ titel: 'Geburtstag Oma', von: null, bis: null, ganztags: true, kalender: 'k2' }, { titel: 'Nachtdienst', von: '19:30', bis: null, ganztags: false, zeit: true, weiter: true, kalender: 'k1' }] } };
// Das Display hängt von der Uhrzeit ab (morgens, abends, nach dem Essen). Standard: 17:30 Uhr am Testtag.
const WETTER = (() => {
  const time = []; const t = []; const pr = []; const code = [];
  for (const d of ['2026-11-18', '2026-11-19', '2026-11-20']) for (let h = 0; h < 24; h += 1) {
    time.push(`${d}T${String(h).padStart(2, '0')}:00`); t.push(1 + Math.round(7 * Math.sin(Math.PI * Math.max(0, h - 6) / 16) * 10) / 10);
    pr.push(h >= 14 && h <= 19 ? 70 : 10); code.push(h >= 14 && h <= 19 ? 61 : 3);
  }
  return { hourly: { time, temperature_2m: t, precipitation_probability: pr, weather_code: code }, daily: {} };
})();
async function openDisplay(db, w, h, kal = KAL, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.route('**/api.open-meteo.com/**', (r) => { ctx.wetterUrl = r.request().url(); return r.fulfill({ contentType: 'application/json', body: JSON.stringify(WETTER) }); });
  await ctx.addInitScript(([hh, mm, day]) => { globalThis.ESSENSPLAN_STUNDE = hh; globalThis.ESSENSPLAN_MINUTE = mm; if (day) globalThis.ESSENSPLAN_HEUTE_X = day; }, [opts.stunde ?? 17, opts.minute ?? 30, opts.tag || null]);
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
  await ctx.addInitScript(INIT, db);
  await ctx.addInitScript((k) => { window.KAL = k; if (globalThis.ESSENSPLAN_HEUTE_X) globalThis.ESSENSPLAN_HEUTE = globalThis.ESSENSPLAN_HEUTE_X; }, kal);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8859/?anzeige=kueche'); await page.waitForTimeout(2200);
  return { page, ctx, errs };
}

const tippe = async (page, pin) => { for (const z of pin) await page.locator(`#sheet-root [data-action="anz-ziffer"][data-z="${z}"]`).click(); await page.waitForTimeout(400); };
const h = (id, pin) => createHash('sha256').update(`essensplan|${id}|${pin}`).digest('hex');
const settingsOf = async (page, key) => (await calls(page, 'ep_settings')).flat().filter((r) => r.key === key).map((r) => r.value);
// A: Duell am Handy anlegen und abstimmen
{
  const db = base();
  const { page, ctx, errs } = await open(db, 0);
  await page.evaluate(() => { location.hash = '#woche'; }); await page.waitForTimeout(600);
  const d0 = (await settingsOf(page, 'duell')).pop();
  console.log('A angelegt:', d0 && `${d0.week} ${d0.a} gegen ${d0.b}`);
  console.log('A Karte:', (await page.locator('.duell-karte').innerText()).replace(/\n+/g, ' | '));
  await page.locator('.duell-karte [data-seite="a"]').click(); await page.waitForTimeout(400);
  const d1 = (await settingsOf(page, 'duell')).pop();
  console.log('A Stimme:', JSON.stringify(d1.stimmen), '| Sieger:', d1.sieger && d1.sieger.name, '| Toast:', await toastText(page));
  console.log('A danach:', (await page.locator('.duell-karte .duell-stand').innerText()), '| gewählt:', await page.locator('.duell-seite.gewaehlt').count());
  await page.screenshot({ path: 'duell_handy.png', fullPage: false, clip: { x: 0, y: Math.max(0, (await page.locator('.duell-karte').boundingBox()).y - 10), width: 400, height: 300 } });
  // B: Gleichstand 2:2
  const all = { ...d1, stimmen: { p1: 'a', p2: 'b', p3: 'a' }, sieger: null };
  await ctx.close();
  const db2 = base(); db2.ep_settings = [{ key: 'duell', value: all }];
  const o2 = await open(db2, 3);
  await o2.page.evaluate(() => { location.hash = '#woche'; }); await o2.page.waitForTimeout(600);
  await o2.page.locator('.duell-karte [data-seite="b"]').click(); await o2.page.waitForTimeout(400);
  const d2 = (await settingsOf(o2.page, 'duell')).pop();
  console.log('B Gleichstand:', JSON.stringify(d2.sieger), '|', await o2.page.locator('.duell-karte .duell-stand').innerText());
  console.log('A/B Fehler:', errs, o2.errs); await o2.ctx.close();
}
// C: Duell am Display mit PIN
{
  const db = base(); db.ep_persons = db.ep_persons.map((p) => (p.id === 'p4' ? { ...p, pin_hash: h('p4', '1122') } : p));
  const { page, ctx, errs } = await openDisplay(db, 1133, 744);
  console.log('C Zettel:', (await page.locator('.zettel-duell').innerText().catch(() => '-')).replace(/\n+/g, ' | '));
  await page.locator('.zettel-duell').click(); await page.waitForTimeout(300);
  console.log('C Bogen:', (await page.locator('#sheet-root .bogen').innerText()).replace(/\n+/g, ' | ').slice(0, 260));
  await page.screenshot({ path: 'duell_display.png' });
  await page.locator('#sheet-root [data-action="anz-duell-stimme"][data-seite="b"]').click(); await page.waitForTimeout(300);
  await page.locator('#sheet-root [data-action="anz-wer"][data-id="p4"]').click(); await page.waitForTimeout(300);
  await tippe(page, '1122');
  const d = (await settingsOf(page, 'duell')).pop();
  console.log('C Stimme:', JSON.stringify(d && d.stimmen), '| Toast:', await toastText(page), '| Zettel:', (await page.locator('.zettel-duell small').innerText().catch(() => '-')));
  console.log('C Fehler:', errs); await ctx.close();
}
// D: Live-Einkauf
{
  const now = new Date(appNow()).toISOString();
  const db = base();
  db.ep_shopping = [...db.ep_shopping.map((i) => ({ ...i, due: '2026-11-18' })), { id: 'neu1', week_start: '2026-11-16', trip: 'Großeinkauf am 13. oder 14.11.', due: '2026-11-18', category: 'kuehl', label: 'Schlagsahne', qty: '', sort: 99, checked: false, manual: true, added_by: 'p2', created_at: now }];
  const { page, ctx, errs } = await open(db, 0);
  await page.evaluate(() => { location.hash = '#einkauf'; }); await page.waitForTimeout(500);
  await page.locator('.ek-kopf [data-action="einkaufsmodus"]').click(); await page.waitForTimeout(500);
  const inv = await page.evaluate(() => window.calls.filter((c) => c[0] === 'invoke').map((c) => c[2].action));
  console.log('D Nachricht:', JSON.stringify(inv.filter((a) => a === 'einkauf-live')), '| gespeichert:', JSON.stringify((await settingsOf(page, 'einkauf_live')).pop()).slice(0, 60));
  console.log('D Leiste:', (await page.locator('.modus-leiste').innerText()).replace(/\n+/g, ' | '));
  console.log('D neu markiert:', (await page.locator('li.live-neu').innerText().catch(() => '-')).replace(/\n+/g, ' | '));
  await page.screenshot({ path: 'live_laden.png' });
  await page.click('.modus-leiste [data-action="einkaufsmodus"]'); await page.waitForTimeout(400);
  console.log('D beendet:', JSON.stringify((await settingsOf(page, 'einkauf_live')).pop()).slice(0, 40));
  console.log('D Fehler:', errs); await ctx.close();
  // E: Mama sieht den Hinweis, das Display auch
  const db2 = base(); db2.ep_settings = [{ key: 'einkauf_live', value: { by: 'p1', due: '2026-11-18', at: new Date(appNow()).toISOString() } }];
  const m = await open(db2, 1);
  await m.page.evaluate(() => { location.hash = '#einkauf'; }); await m.page.waitForTimeout(500);
  console.log('E Mama:', (await m.page.locator('.live-hinweis').innerText().catch(() => '-')).replace(/\n+/g, ' | '));
  await m.ctx.close();
  const dsp = await openDisplay(db2, 1133, 744);
  console.log('E Display:', await dsp.page.locator('.anz-stand').innerText(), '| Fehler:', m.errs, dsp.errs); await dsp.ctx.close();
}
await b.close(); srv.close();
