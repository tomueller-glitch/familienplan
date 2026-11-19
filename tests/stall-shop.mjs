import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8853);
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
  await page.goto('http://localhost:8853/#woche'); await page.waitForTimeout(1200);
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
// A: Eltern schalten die Stall-Ampel ein (alle 5 Tage, zuletzt 13.11. -> heute fällig)
{
  const { page, ctx, errs } = await open(base(), 0);
  const card = page.locator('.km-karte.eltern', { hasText: 'Stall-Ampel' });
  console.log('A vorher:', (await card.innerText()).replace(/\n+/g, ' | ').slice(0, 200));
  await card.locator('select[name=tage]').selectOption('5');
  await card.locator('input[name=last]').fill('2026-11-13');
  await card.locator('button.knopf').click(); await page.waitForTimeout(500);
  const s = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'stall').pop();
  console.log('A gespeichert:', JSON.stringify(s && s.value));
  console.log('A Karte:', (await page.locator('.km-karte.eltern', { hasText: 'Zuletzt am' }).innerText()).replace(/\n+/g, ' | '));
  await shot(page, '.km-karte.eltern:has-text("Zuletzt am")', '/tmp/st_eltern.png');
  console.log('A Fehler:', errs); await ctx.close();
}
// B: Kind 1 sieht Rot und meldet, die Wochenaufgabe ist weg
{
  const db = base(); db.ep_settings = [{ key: 'stall', value: { on: true, tage: 5, last: '2026-11-13', by: 'p1' } }];
  const { page, ctx, errs } = await open(db, 2);
  console.log('B Karte:', (await page.locator('.st-karte').innerText()).replace(/\n+/g, ' | '));
  console.log('B Käfig in Listen:', await page.locator('.posten', { hasText: 'Käfig' }).count(), 'Badge:', await page.locator('.tab[data-tab="aufgaben"]').innerText());
  await shot(page, '.st-karte', '/tmp/st_kind_rot.png');
  await page.locator('[data-action="st-raus"]').click(); await page.waitForTimeout(400);
  const e = (await calls(page, 'ep_task_log')).flat().pop();
  console.log('B Meldung:', e && e.id.slice(0, 3), e && e.label, e && e.status, e && e.minutes);
  console.log('B danach:', (await page.locator('.st-karte').innerText()).replace(/\n+/g, ' | '));
  console.log('B Fehler:', errs); await ctx.close();
}
// C: Eltern bestätigen, der Rhythmus startet neu
{
  const db = base(); db.ep_settings = [{ key: 'stall', value: { on: true, tage: 5, last: '2026-11-13', by: 'p1' } }];
  db.ep_task_log = [{ id: 'st-abc', person_id: 'p3', task_id: 'meerschwein-kaefig', day: '2026-11-18', label: 'Meerschweinchen-Käfig sauber machen', minutes: 30, status: 'offen', created_at: iso, decided_by: null, decided_at: null }];
  const { page, ctx, errs } = await open(db, 0);
  await page.locator('[data-action="log-ok"][data-id="st-abc"]').click(); await page.waitForTimeout(400);
  const s = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'stall').pop();
  console.log('C nach Bestätigen:', JSON.stringify(s && s.value), '|', (await page.locator('.km-karte.eltern', { hasText: 'Zuletzt am' }).innerText()).replace(/\n+/g, ' | ').slice(0, 120));
  console.log('C Fehler:', errs); await ctx.close();
}
// D: Kind 2 ist diese Woche nicht dran, sieht keine Stall-Karte
{
  const db = base(); db.ep_settings = [{ key: 'stall', value: { on: true, tage: 5, last: '2026-11-13', by: 'p1' } }];
  const { page, ctx, errs } = await open(db, 3);
  console.log('D Stall-Karte bei Kind 2:', await page.locator('.st-karte').count());
  console.log('D Fehler:', errs); await ctx.close();
}
// E: Eltern richten den Minuten-Shop ein
{
  const { page, ctx, errs } = await open(base(), 0);
  await page.locator('[data-action="shop-verwalten"]').click(); await page.waitForTimeout(300);
  await page.locator('#sheet-root .shop-admin-zeile input[name=name]').nth(4).fill('Kinoabend aussuchen');
  await page.locator('#sheet-root .shop-admin-zeile input[name=cost]').nth(4).fill('90');
  await page.locator('#sheet-root .shop-admin-zeile input[name=name]').nth(2).fill('');
  await page.screenshot({ path: '/tmp/shop_admin.png' });
  await page.locator('#sheet-root form[data-form=shop] button.knopf').click(); await page.waitForTimeout(400);
  const s = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'shop').pop();
  console.log('E Shop:', JSON.stringify(s && s.value));
  console.log('E Toast:', await toastText(page));
  console.log('E Fehler:', errs); await ctx.close();
}
// F: Kind kauft, Konto sinkt, Eltern sehen den Kauf
const shopDb = () => { const db = base(); db.ep_settings = [{ key: 'shop', value: { aus: false, items: [{ id: 'essen', name: 'Abendessen aussuchen', cost: 40 }, { id: 'kino', name: 'Kinoabend aussuchen', cost: 90 }] } }];
  const gestern = new Date(Date.parse(iso) - 20 * 3600000).toISOString();
  db.ep_task_log = [{ id: 'm1', person_id: 'p3', task_id: null, day: '2026-11-18', label: 'Rasen mähen', minutes: 30, status: 'bestaetigt', created_at: iso, decided_by: 'p1', decided_at: iso },
    { id: 'm2', person_id: 'p3', task_id: null, day: '2026-11-17', label: 'Laub rechen', minutes: 30, status: 'bestaetigt', created_at: gestern, decided_by: 'p1', decided_at: gestern }]; return db; };
{
  const { page, ctx, errs } = await open(shopDb(), 2);
  console.log('F Konto:', (await page.locator('.konto').first().innerText()).replace(/\n+/g, ' | '));
  await page.locator('[data-action="shop"]').click(); await page.waitForTimeout(300);
  console.log('F Shop:', (await page.locator('#sheet-root').innerText()).replace(/\n+/g, ' | '));
  await page.locator('[data-action="shop-kaufen"][data-id="essen"]').click(); await page.waitForTimeout(200);
  await page.screenshot({ path: '/tmp/shop_kind.png' });
  await page.locator('[data-action="shop-ja"]').click(); await page.waitForTimeout(400);
  const e = (await calls(page, 'ep_task_log')).flat().pop();
  console.log('F Kauf:', e && e.id.slice(0, 5), e && e.label, e && e.minutes, e && e.status, '| Toast:', await toastText(page));
  console.log('F Konto danach:', (await page.locator('.konto').first().innerText()).replace(/\n+/g, ' | '));
  console.log('F Fehler:', errs); await ctx.close();
}
{
  const db = shopDb(); db.ep_task_log.push({ id: 'shop-k1', person_id: 'p3', task_id: null, day: '2026-11-18', label: 'Minuten-Shop: Abendessen aussuchen', minutes: -40, status: 'offen', created_at: iso, decided_by: null, decided_at: null },
    { id: 'x9', person_id: 'p4', task_id: 'staubsaugen', day: '2026-11-18', label: 'Staubsaugen', minutes: 15, status: 'offen', created_at: iso, decided_by: null, decided_at: null });
  const { page, ctx, errs } = await open(db, 0);
  console.log('G Warteschlange:', (await page.locator('.bestaetigen').innerText()).replace(/\n+/g, ' | '));
  console.log('G Alle bestätigen:', await page.locator('[data-action="log-alle"]').count());
  await shot(page, '.bestaetigen', '/tmp/shop_eltern.png');
  await page.locator('[data-action="log-nein"][data-id="shop-k1"]').click(); await page.waitForTimeout(400);
  const e = (await calls(page, 'ep_task_log')).flat().pop();
  console.log('G Zurückgebucht:', e && e.id, e && e.status);
  console.log('G Fehler:', errs); await ctx.close();
}
// H: Küchen-Display auf einem Tablet, ohne Personenwahl
async function openDisplay(db, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
  await ctx.addInitScript(INIT, db);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8853/?anzeige=kueche'); await page.waitForTimeout(1500);
  return { page, ctx, errs };
}
{
  const db = base();
  db.ep_settings = [{ key: 'stall', value: { on: true, tage: 5, last: '2026-11-12', by: 'p1' } },
    { key: 'kuechenmuell', value: { plastik: { stufe: 'rot', at: iso, by: 'p1' }, rest: { stufe: 'gruen', at: iso, by: 'p1' } } },
    { key: 'spuelmaschine', value: { stufe: 'gelb', at: iso, by: 'p1', bis: new Date(appNow() + 3600000).toISOString() } }];
  const { page, ctx, errs } = await openDisplay(db, 1180, 820);
  console.log('H Display:', (await page.locator('.anzeige').innerText()).replace(/\n+/g, ' | '));
  console.log('H gemerkt:', await page.evaluate(() => localStorage.getItem('essensplan.anzeige')), '| URL:', await page.evaluate(() => location.search));
  await page.screenshot({ path: '/tmp/anzeige_quer.png' });
  await page.setViewportSize({ width: 820, height: 1180 }); await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/anzeige_hoch.png' });
  await page.reload(); await page.waitForTimeout(1500);
  console.log('H nach Neuladen noch Display:', await page.locator('.anzeige').count());
  await page.locator('[data-action="anzeige-aus"]').click(); await page.waitForTimeout(400);
  console.log('H beendet:', await page.locator('.anzeige').count(), await page.evaluate(() => localStorage.getItem('essensplan.anzeige')), '| Personenwahl:', await page.locator('[data-action="ich"]').count());
  console.log('H Fehler:', errs); await ctx.close();
}
await b.close(); srv.close();
