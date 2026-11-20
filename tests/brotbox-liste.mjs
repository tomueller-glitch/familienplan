import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8856);
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
  await page.goto('http://localhost:8856/#woche'); await page.waitForTimeout(1200);
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





// Brotbox-Posten aus Claudes Plan: bleiben beim Neuberechnen, beim Tauschen im Entwurf und lassen sich nachtragen.
const W = '2026-11-23';
const G = 'Großeinkauf am Sa 21.11.', F = 'Frischeeinkauf am Mi 25.11.';
const planDays = [['2026-11-23', 'Hähnchen-Gemüse-Pfanne mit Reis', 'Käsebrot mit Gurke, Apfelschnitze'], ['2026-11-24', 'Chili con Carne mit Reis', 'Vollkornbrot mit Frischkäse, Snackmöhren'],
  ['2026-11-25', 'Linsenbolognese mit Spaghetti', 'Wrap mit Pute'], ['2026-11-26', 'Putengeschnetzeltes mit Champignons und Bulgur', 'Vollkornbrot mit Käse'],
  ['2026-11-27', 'Pizza mit Thunfisch oder Putenschinken', 'Banane und Apfel'], ['2026-11-28', 'Gebackener Seelachs mit Kartoffeln und Kräuterquark', ''], ['2026-11-29', 'Burger mit selbst gebackenen Brötchen und Kartoffelspalten', '']];
const draftShop = [
  { label: 'Vollkornbrot', qty: '2 Packungen', category: 'brot', trip: G, due: '2026-11-21', purpose: 'Brotbox (Di), Brotbox (Do)', shop: '' },
  { label: 'Snackmöhren', qty: '1 Beutel', category: 'obst', trip: G, due: '2026-11-21', purpose: 'Brotbox (Di)', shop: '' },
  { label: 'Putenbrust-Aufschnitt', qty: '1 Packung', category: 'kuehl', trip: F, due: '2026-11-25', purpose: 'Brotbox (Mi)', shop: '' },
  { label: 'Äpfel', qty: '1 kg', category: 'obst', trip: G, due: '2026-11-21', purpose: 'Brotbox (Mo), Brotbox (Fr)', shop: '' },
  { label: 'Seelachsfilet tiefgekühlt', qty: '800 g', category: 'tk', trip: G, due: '2026-11-21', purpose: 'Gebackener Seelachs (Sa)', shop: '' },
  { label: 'Bio-Magerquark', qty: '500 g', category: 'kuehl', trip: F, due: '2026-11-25', purpose: 'Gebackener Seelachs (Sa)', shop: '' },
  { label: 'Bio-Hackfleisch vom Rind', qty: '1,2 kg', category: 'fleisch', trip: F, due: '2026-11-25', purpose: 'Chili con Carne (Di), Burger (So)', shop: '' },
  { label: 'Gouda in Scheiben', qty: '1 Packung', category: 'kuehl', trip: G, due: '2026-11-21', purpose: 'Brotbox (Mo), Brotbox (Do), Pizza (Fr)', shop: 'lidl' },
];
const run = (id, status) => ({ id, week_start: W, status, created_at: '2026-11-20T11:00:00Z', decided_at: status === 'freigegeben' ? '2026-11-20T12:00:00Z' : null, warnings: [],
  draft: { week_start: W, dishes: [], neu: [], angebote: [], plan: planDays.map(([day, dish, lunchbox]) => ({ day, dish, lunchbox, prep: '' })), shopping: draftShop } });
const planRows = (SEED) => planDays.map(([day, dish, lunchbox]) => ({ day, dish_id: SEED.dishes.find((d) => d.name === dish).id, lunchbox, skipped: false, prep: '' }));
async function openAt(db, url) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
  await ctx.addInitScript(INIT, db);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8856/' + url); await page.waitForTimeout(1200);
  await page.locator('[data-action="ich"]').first().click(); await page.waitForTimeout(400);
  await page.fill('[name=pin1]', '1234'); await page.fill('[name=pin2]', '1234'); await page.click('#sheet-root button.knopf'); await page.waitForTimeout(1500);
  return { page, ctx, errs };
}
const listOf = (page) => page.evaluate(() => window.calls.filter((c) => c[0] === 'upsert' && c[1] === 'ep_shopping').flatMap((c) => c[2]));
const show = (rows) => rows.map((r) => `${r.label} [${r.qty}] ${r.purpose} {${String(r.trip).slice(0, 5)}${r.shop ? ' ' + r.shop : ''}}`);

// A: Liste wurde aus den Rezepten gebaut, die Brotbox-Sachen fehlen. Der Kasten trägt sie nach.
{
  const db = base(); db.ep_plan = [...db.ep_plan.filter((p) => p.day < W), ...planRows(SEED)]; db.ep_ai_runs = [run('r1', 'freigegeben')];
  db.ep_shopping = [{ id: 'x1', week_start: W, trip: 'Einkauf', due: '2026-11-21', category: 'fleisch', label: 'Bio-Hackfleisch vom Rind', qty: '1,2 kg', purpose: 'Chili con Carne (Di), Burger (So)', sort: 1, missing: false, checked: false, manual: false },
    { id: 'x2', week_start: W, trip: 'Einkauf', due: '2026-11-21', category: 'obst', label: 'Äpfel', qty: '2 Stück', purpose: 'Burger (So)', sort: 2, missing: false, checked: false, manual: false }];
  const { page, ctx, errs } = await openAt(db, `?woche=${W}#einkauf`);
  console.log('A Kasten:', (await page.locator('.vorrat-frage', { hasText: 'Claudes Plan' }).innerText()).replace(/\n+/g, ' | '));
  await page.locator('[data-action="entwurf-ergaenzen"]').click(); await page.waitForTimeout(400);
  console.log('A ergänzt:', JSON.stringify(show(await listOf(page))));
  console.log('A Kasten danach:', await page.locator('.vorrat-frage', { hasText: 'Claudes Plan' }).count(), '| Toast:', await toastText(page));
  console.log('A Fehler:', errs); await ctx.close();
}
// B: Claudes Liste neu aus dem Plan berechnen: Brotbox-Posten bleiben, Touren bleiben.
{
  const db = base(); db.ep_plan = [...db.ep_plan.filter((p) => p.day < W), ...planRows(SEED)]; db.ep_ai_runs = [run('r1', 'freigegeben')];
  db.ep_shopping = draftShop.map((s, n) => ({ id: 'claude-' + n, week_start: W, ...s, shop: s.shop || null, sort: n, missing: false, checked: n === 0, checked_by: n === 0 ? 'p1' : null, checked_at: null, manual: false }));
  const { page, ctx, errs } = await openAt(db, `?woche=${W}#einkauf`);
  await page.locator(`[data-action="liste-bauen"][data-week="${W}"]`).first().click(); await page.waitForTimeout(400);
  console.log('B Frage:', (await page.locator('#sheet-root, .dialog, [role=dialog]').first().innerText().catch(() => '-')).replace(/\n+/g, ' | ').slice(0, 200));
  await page.locator('#sheet-root [data-action="ja"]').click(); await page.waitForTimeout(800);
  const rows = await listOf(page);
  console.log('B behalten:', JSON.stringify(show(rows.filter((r) => /^claude-/.test(r.id)))), '| Häkchen Vollkornbrot:', rows.find((r) => r.id === 'claude-0') ? rows.find((r) => r.id === 'claude-0').checked : 'unverändert');
  const neu = rows.filter((r) => !/^claude-/.test(r.id));
  console.log('B neu:', neu.length, 'Touren:', JSON.stringify([...new Set(neu.map((r) => r.trip))]), '| Beispiele:', JSON.stringify(show(neu.filter((r) => /Hackfleisch|Quark|Champignons|Bulgur|Gouda|Äpfel|Seelachs/.test(r.label)))));
  console.log('B gelöscht:', JSON.stringify(await page.evaluate(() => window.calls.filter((c) => c[0] === 'delete'))));
  console.log('B Fehler:', errs); await ctx.close();
}
// C: Im Entwurf Samstag tauschen: Claudes Liste bleibt, Seelachs-Zutaten raus, Frittata-Zutaten dazu.
{
  const db = base(); db.ep_ai_runs = [run('r2', 'fertig')];
  const { page, ctx, errs } = await openAt(db, `?entwurf=r2#woche`);
  await page.waitForTimeout(800);
  await page.selectOption('#sheet-root select[name="d_2026-11-28"]', 'Gemüsefrittata mit Feta und Spinat, dazu Salat');
  await page.locator('#sheet-root [data-form=entwurf] button.breit').click(); await page.waitForTimeout(800);
  console.log('C Vorschau Einkauf:', (await page.locator('#sheet-root').innerText()).split('\n').filter((l) => /Einkaufsliste/.test(l)).join(' | '));
  await page.locator('#sheet-root [data-action="vorschau-ok"]').click(); await page.waitForTimeout(1200);
  const rows = (await listOf(page)).filter((r) => r.week_start === W);
  console.log('C Liste:', rows.length, JSON.stringify(show(rows)));
  console.log('C Seelachs noch da:', rows.some((r) => /Seelachs/.test(r.label)), '| Quark:', rows.some((r) => /Magerquark/.test(r.label)));
  console.log('C Fehler:', errs); await ctx.close();
}
// D: Liste der KW 48 wie beim Fehler: alles auf einer Tour „Einkauf“, Brotbox fehlt. Der Kasten teilt auf und ergänzt.
{
  const db = base(); db.ep_plan = [...db.ep_plan.filter((p) => p.day < W), ...planRows(SEED)]; db.ep_ai_runs = [run('r1', 'freigegeben')];
  const mk = (id, label, qty, purpose, category, extra = {}) => ({ id, week_start: W, trip: 'Einkauf', due: '2026-11-21', category, label, qty, purpose, sort: Number(id.slice(1)), missing: false, checked: false, manual: false, ...extra });
  db.ep_shopping = [mk('k1', 'Feldsalat', '150 g', 'Pizza (Fr)', 'obst'), mk('k2', 'Champignons', '400 g', 'Putengeschnetzeltes (Do)', 'obst'), mk('k3', 'Putenfleisch', '600 g', 'Putengeschnetzeltes (Do)', 'fleisch'),
    mk('k4', 'Zwiebeln', '4 Stück', 'Chili con Carne (Di), Putengeschnetzeltes (Do)', 'obst'), mk('k5', 'Hähnchenbrustfilet', '600 g', 'Hähnchen-Gemüse-Pfanne (Mo)', 'fleisch'),
    mk('k6', 'Bulgur', '250 g', 'Putengeschnetzeltes (Do)', 'vorrat'), mk('k7', 'Kartoffeln', '1 kg', 'Gebackener Seelachs (Sa)', 'obst'), mk('k8', 'Spülmittel', '', '', 'haushalt', { manual: true, trip: 'Einkauf', due: null }),
    mk('k9', 'Mozzarella', '2 Packungen', 'Pizza (Fr)', 'kuehl')];
  const { page, ctx, errs } = await openAt(db, `?woche=${W}#einkauf`);
  console.log('D Kasten:', (await page.locator('.vorrat-frage', { hasText: 'passt nicht' }).innerText()).replace(/\n+/g, ' | '));
  await page.locator('[data-action="entwurf-ergaenzen"]').click(); await page.waitForTimeout(400);
  const rows = await listOf(page);
  const byId = {}; for (const r of rows) byId[r.id] = r;
  console.log('D verschoben:', JSON.stringify(Object.values(byId).filter((r) => /^k/.test(r.id)).map((r) => `${r.label} -> ${r.trip.slice(0, 16)} ${r.due}`)));
  console.log('D ergänzt:', JSON.stringify(show(Object.values(byId).filter((r) => !/^k/.test(r.id)))));
  console.log('D Toast:', await toastText(page), '| Kasten danach:', await page.locator('.vorrat-frage', { hasText: 'passt nicht' }).count());
  console.log('D Touren auf der Seite:', JSON.stringify([...await page.locator('h2.tour').allInnerTexts(), ...await page.locator('.ek-tour .ek-name').allInnerTexts()]));
  console.log('D Fehler:', errs); await ctx.close();
}
// E: Liste mit nur einer Tour neu berechnen: danach Groß- und Frischeeinkauf.
{
  const db = base(); db.ep_plan = [...db.ep_plan.filter((p) => p.day < W), ...planRows(SEED)];
  db.ep_shopping = [{ id: 'e1', week_start: W, trip: 'Einkauf', due: null, category: 'obst', label: 'Feldsalat', qty: '150 g', purpose: 'Pizza (Fr)', sort: 1, missing: false, checked: false, manual: false }];
  const { page, ctx, errs } = await openAt(db, `?woche=${W}#einkauf`);
  await page.locator(`[data-action="liste-bauen"][data-week="${W}"]`).first().click(); await page.waitForTimeout(400);
  if (await page.locator('#sheet-root [data-action="ja"]').count()) await page.locator('#sheet-root [data-action="ja"]').click();
  await page.waitForTimeout(800);
  const rows = (await listOf(page)).filter((r) => r.week_start === W);
  const tr = {}; for (const r of rows) (tr[r.trip] ||= []).push(r.label);
  for (const [t, l] of Object.entries(tr)) console.log('E', t, l.length, JSON.stringify(l.slice(0, 14)));
  console.log('E Fehler:', errs); await ctx.close();
}
// F: Claudes Liste mit kurzen Gerichtsnamen („Chili (Di)“, „Gulasch (So)“) neu berechnen: nichts doppelt.
{
  const db = base(); db.ep_plan = [...db.ep_plan.filter((p) => p.day < W), ...planRows(SEED)];
  const short = [
    { label: 'Bio-Hackfleisch vom Rind', qty: '1,2 kg', category: 'fleisch', trip: F, due: '2026-11-25', purpose: 'Chili (Di), Burger (So)', shop: '' },
    { label: 'Champignons', qty: '400 g', category: 'obst', trip: F, due: '2026-11-25', purpose: 'Geschnetzeltes (Do)', shop: '' },
    { label: 'Zwiebeln', qty: '4 Stück', category: 'obst', trip: G, due: '2026-11-21', purpose: 'Chili (Di), Bolognese (Mi), Geschnetzeltes (Do)', shop: '' },
    { label: 'Vollkornbrot', qty: '1 Laib', category: 'brot', trip: G, due: '2026-11-21', purpose: 'Brotbox (Di), Brotbox (Do)', shop: '' },
    { label: 'Äpfel', qty: '1 kg', category: 'obst', trip: G, due: '2026-11-21', purpose: 'Brotbox (Mo), Brotbox (Fr)', shop: '' },
    { label: 'Hähnchenbrustfilet', qty: '600 g', category: 'fleisch', trip: G, due: '2026-11-21', purpose: 'Pfanne (Mo)', shop: '' },
  ];
  db.ep_shopping = short.map((x, n) => ({ id: 'kurz-' + n, week_start: W, ...x, shop: null, sort: n, missing: false, checked: false, checked_by: null, checked_at: null, manual: false }));
  const { page, ctx, errs } = await openAt(db, `?woche=${W}#einkauf`);
  await page.locator(`[data-action="liste-bauen"][data-week="${W}"]`).first().click(); await page.waitForTimeout(400);
  await page.locator('#sheet-root [data-action="ja"]').click(); await page.waitForTimeout(1200);
  // Was auf der Seite steht, nach Touren
  const rows = await page.evaluate(() => [...document.querySelectorAll('.ek-jetzt, .ek-tour:not(.ek-vorbei)')].flatMap((sec) => {
    const trip = ((sec.querySelector('h2.tour, .ek-name') || {}).textContent || '').trim();
    const t = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
    return [...sec.querySelectorAll('.posten li')].map((li) => li.querySelector('.p-name') && ({ trip, label: t(li.querySelector('.p-name')).replace(/ ?(Saison|Bio im Angebot|nicht bekommen)/g, '').trim(), qty: t(li.querySelector('.p-menge')), purpose: t(li.querySelector('.p-wofuer')) })).filter(Boolean);
  }));
  const keys = {}; for (const r of rows) { const k = r.trip + '|' + r.label.toLowerCase().replace(/^bio[- ]/, '').replace(/n$/, ''); (keys[k] ||= []).push(`${r.label} [${r.qty}] ${r.purpose} {${r.trip.slice(0, 5)}}`); }
  console.log('F doppelt:', JSON.stringify(Object.values(keys).filter((x) => x.length > 1)));
  console.log('F Brotbox:', JSON.stringify(rows.filter((r) => /Brotbox/.test(r.purpose)).map((r) => r.label)), '| Hackfleisch:', JSON.stringify(rows.filter((r) => /hack/i.test(r.label)).map((r) => `${r.label} [${r.qty}] ${r.purpose}`)));
  console.log('F Fehler:', errs); await ctx.close();
}
// G: Posten ohne Abhaken von der Liste nehmen, rückgängig machen, wieder entfernen, dann neu berechnen.
{
  const db = base(); db.ep_plan = [...db.ep_plan.filter((p) => p.day < W), ...planRows(SEED)]; db.ep_ai_runs = [run('r1', 'freigegeben')];
  db.ep_shopping = draftShop.map((x, n) => ({ id: 'g-' + n, week_start: W, ...x, shop: x.shop || null, sort: n, missing: false, checked: false, checked_by: null, checked_at: null, manual: false }));
  const { page, ctx, errs } = await openAt(db, `?woche=${W}#einkauf`);
  const row = (t) => page.locator('.posten li', { hasText: t }).first();
  await page.locator('.posten').first().screenshot({ path: '/tmp/liste_kreuz.png' });
  console.log('G Kreuz bei erzeugten Posten:', await page.locator('.posten li [data-action="posten-weg"]').count(), 'von', await page.locator('.posten li:has([data-action="haken"])').count());
  await row('Vollkornbrot').locator('[data-action="posten-weg"]').click(); await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/liste_toast.png' });
  console.log('G Hinweis:', (await page.locator('#toast').innerText()).replace(/\n+/g, ' | '), '| noch da:', await row('Vollkornbrot').count());
  await page.locator('#toast [data-action="toast-undo"]').click(); await page.waitForTimeout(300);
  console.log('G nach Rückgängig da:', await row('Vollkornbrot').count(), '| gemerkt:', JSON.stringify((await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'liste_weg').pop().value));
  await row('Vollkornbrot').locator('[data-action="posten-weg"]').click(); await page.waitForTimeout(300);
  await row('Snackmöhren').locator('[data-action="posten-weg"]').click(); await page.waitForTimeout(300);
  console.log('G Kasten Claude-Plan:', await page.locator('.vorrat-frage', { hasText: 'passt nicht' }).count());
  await page.locator(`[data-action="liste-bauen"][data-week="${W}"]`).first().click(); await page.waitForTimeout(400);
  await page.locator('#sheet-root [data-action="ja"]').click(); await page.waitForTimeout(1000);
  console.log('G nach Neuberechnen da:', await row('Vollkornbrot').count(), await row('Snackmöhren').count(), '| Äpfel:', await row('Äpfel').count());
  await page.locator('[data-action="einkaufen"], [data-action="einkaufsmodus"]').first().click().catch(() => {}); await page.waitForTimeout(300);
  console.log('G Fehler:', errs); await ctx.close();
}
// H: Bio steht nicht im Namen, markiert wird nur ein Bio-Angebot.
{
  const db = base(); db.ep_plan = [...db.ep_plan.filter((p) => p.day < W), ...planRows(SEED)];
  db.ep_ai_runs = [{ ...run('r1', 'freigegeben'), offers: ['Aldi | Bio-Möhren | 1 kg | 1,29 € | Bio | 20.11. | 25.11. | Sortiment', 'Lidl | Hähnchenbrustfilet | 1 kg | 7,99 € | nicht Bio | 19.11. | | Sortiment'].join('\n') }];
  const mk = (id, label, qty, extra = {}) => ({ id, week_start: W, trip: G, due: '2026-11-21', category: 'obst', label, qty, purpose: 'Chili con Carne (Di)', sort: Number(id.slice(1)), missing: false, checked: false, manual: false, ...extra });
  db.ep_shopping = [mk('h1', 'Bio-Möhren', '1 kg'), mk('h2', 'Bio-Hähnchenbrustfilet', '600 g, Angebot ab 19.11., nicht Bio', { category: 'fleisch' }), mk('h3', 'Feldsalat', '150 g, Angebot ab 20.11., Bio'), mk('h4', 'Bio passierte Tomaten', '2 Packungen', { category: 'vorrat' })];
  const { page, ctx, errs } = await openAt(db, `?woche=${W}#einkauf`);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.posten li:has([data-action="haken"])')].map((li) => li.innerText.replace(/\n+/g, ' / ')));
  console.log('H Zeilen:', JSON.stringify(rows));
  await page.locator('.posten li:has([data-action="haken"])').first().locator('xpath=ancestor::ul[1]').screenshot({ path: '/tmp/bio_angebot.png' });
  console.log('H Fehler:', errs); await ctx.close();
}
await b.close(); srv.close();
