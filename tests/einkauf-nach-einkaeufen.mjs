// Einkaufsliste nach Einkäufen: aktueller Einkauf oben, kein „Nachkauf“, Fehlendes wandert weiter, Neues landet auf dem aktuellen Einkauf.
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8834);
const run = JSON.parse(fs.readFileSync(ROOT + '/tests/run.json', 'utf8'));
const { SEED } = await import(ROOT + '/js/seed.js');

const P = (id, week, trip, due, category, label, qty, purpose, extra = {}) => ({ id, week_start: week, trip, due, category, label, qty, purpose, sort: Number(id.replace(/\D/g, '')) || 1, checked: false, manual: false, missing: false, buyer: 'p1', ...extra });
const G47 = 'Großeinkauf am Sa 14.11.', F47 = 'Frischeeinkauf am Mi 18.11.', G48 = 'Großeinkauf am Sa 21.11.', F48 = 'Frischeeinkauf am Mi 25.11.';
const W = '2026-11-16', V = '2026-11-23';
const ok = { checked: true, checked_by: 'p1' };
const shopping = [
  P('a1', W, G47, '2026-11-14', 'fleisch', 'Hähnchenbrustfilet', '600 g', 'Hähnchen-Curry (Mo)', ok),
  P('a2', W, G47, '2026-11-14', 'kuehl', 'Magerquark', '500 g', 'Brotbox (Mo, Di)', ok),
  P('a3', W, G47, '2026-11-14', 'vorrat', 'Basmatireis', '1 kg', 'Hähnchen-Curry (Mo)', ok),
  P('a4', W, G47, '2026-11-14', 'obst', 'Zwiebeln', '1 kg', 'Curry (Mo), Chili (Di)', ok),
  P('a5', W, G47, '2026-11-14', 'vorrat', 'Kidneybohnen', '2 Dosen', 'Chili (Di)', ok),
  P('a6', W, G47, '2026-11-14', 'tk', 'Fischstäbchen', '2 Packungen', 'Fischstäbchen (Mi)', ok),
  P('a7', W, G47, '2026-11-14', 'kuehl', 'Butter', '250 g', '', ok),
  P('a8', W, G47, '2026-11-14', 'haushalt', 'Backpapier', '', '', { ...ok, manual: true }),
  P('b1', W, F47, '2026-11-18', 'obst', 'Feldsalat', '200 g', 'Brotzeit (Fr)', ok),
  P('b2', W, F47, '2026-11-18', 'brot', 'Vollkornbrot', '1 Laib', 'Brotzeit (Fr)', ok),
  P('b3', W, F47, '2026-11-18', 'fleisch', 'Lachsfilet', '400 g', 'Lachs mit Gemüse (Do)', ok),
  P('b4', W, F47, '2026-11-18', 'obst', 'Brokkoli', '500 g', 'Lachs mit Gemüse (Do)', ok),
  P('c1', W, 'Nachkauf', null, 'obst', 'Frühlingszwiebeln', '1 Bund, am 18.11. nicht bekommen', 'Brotzeit (Fr)'),
  P('c2', W, 'Nachkauf', null, 'kuehl', 'Schmand', '200 g, am 18.11. nicht bekommen', 'Chili (Di)'),
  P('c3', W, 'Nachkauf', null, 'haushalt', 'Spülmittel', '', 'ist alle', { manual: true, added_by: 'p4' }),
  P('d1', V, G48, '2026-11-21', 'fleisch', 'Rinderhackfleisch', '800 g', 'Lasagne (So), Bolognese (Mi)'),
  P('d2', V, G48, '2026-11-21', 'vorrat', 'Lasagneplatten', '1 Packung', 'Lasagne (So)'),
  P('d3', V, G48, '2026-11-21', 'vorrat', 'Passierte Tomaten', '3 Packungen', 'Lasagne (So), Bolognese (Mi)'),
  P('d4', V, G48, '2026-11-21', 'kuehl', 'Mozzarella', '2 Stück', 'Lasagne (So)'),
  P('d5', V, G48, '2026-11-21', 'kuehl', 'Milch', '2 l', 'Frühstück'),
  P('d6', V, G48, '2026-11-21', 'obst', 'Möhren', '1 kg', 'Bolognese (Mi), Brotbox'),
  P('d7', V, G48, '2026-11-21', 'obst', 'Äpfel', '1,5 kg', 'Brotbox'),
  P('d8', V, G48, '2026-11-21', 'tk', 'Erbsen', '1 Packung', 'Reispfanne (Mo)'),
  P('d9', V, G48, '2026-11-21', 'vorrat', 'Spaghetti', '1 kg', 'Bolognese (Mi)'),
  P('d10', V, G48, '2026-11-21', 'haushalt', 'Spülmaschinentabs', '', 'ist alle', { manual: true, added_by: 'p3' }),
  P('e1', V, F48, '2026-11-25', 'obst', 'Zucchini', '2 Stück', 'Gemüsepfanne (Do)'),
  P('e2', V, F48, '2026-11-25', 'fleisch', 'Putenschnitzel', '600 g', 'Schnitzel (Fr)'),
  P('e3', V, F48, '2026-11-25', 'brot', 'Brötchen', '8 Stück', 'Brotzeit (Fr)'),
];
const db = { ep_persons: SEED.persons.map(p => p.adult ? { ...p, pin_hash: null } : p), ep_dishes: SEED.dishes, ep_plan: SEED.plan, ep_shopping: shopping, ep_tasks: SEED.tasks, ep_pantry: SEED.pantry, ep_ai_runs: [], ep_settings: [], ep_receipts: [] };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
await ctx.addInitScript((db) => {
  globalThis.ESSENSPLAN_HEUTE = window.__heute || '2026-11-20';
  window.calls = []; window.__db = db;
  const q = (table) => { const api = { select() { return api; }, order() { return api; }, range() { return Promise.resolve({ data: window.__db[table] || [], error: null }); },
    upsert(rows) { window.calls.push(['upsert', table, JSON.parse(JSON.stringify(rows))]); return Promise.resolve({ error: null }); },
    delete() { const d = { eq() { return Object.assign(Promise.resolve({ error: null }), d); }, in(c, v) { window.calls.push(['delete', table, v.length]); return Promise.resolve({ error: null }); } }; return d; } }; return api; };
  window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: {} } }, error: null }), signOut: async () => {} }, from: q,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({ list: async () => ({ data: [{ name: 'familienplan-2026-11-15-0300.json', metadata: { size: 48213 } }, { name: 'familienplan-2026-11-08-0300.json', metadata: { size: 47001 } }], error: null }), download: async (n) => ({ data: new Blob(['{}'], { type: 'application/json' }), error: null }) }) }, functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, { action: o.body.action, n: (o.body.photos || []).length, len: (o.body.photos || []).map(p => p.data.length) }]); await new Promise(r => setTimeout(r, 400)); if (o.body.action === 'mittag') { window.lastMittag = o.body.mittag; return { data: { mittag: [{ name: 'Rührei mit Spinat', minuten: 10, warum: 'Eiweiß und Gemüse.', zutaten: [{ menge: '4 Stück', name: 'Eier', da: true }, { menge: '100 g', name: 'Feta', da: false }], schritte: ['Eier verquirlen.', 'Braten.'], reste: [] }] }, error: null }; } if (o.body.action === 'kosten') { const ds = window.__db.ep_dishes; return { data: { kosten: { stand: '2026-11-16', kassenzettel: 2, gerichte: Object.fromEntries(ds.map((x, i) => [x.id, 6 + (i * 1.7) % 14])) } }, error: null }; } if (o.body.action === 'fest') { const m = await import('/js/planer.js'); return { data: { fest: m.demoFeast(o.body.fest) }, error: null }; } if (o.body.action === 'ersatz') return { data: { ersatz: { vorschlaege: [{ name: 'Kabeljaufilet TK', menge: '600 g', warum: 'Mild und fest.' }, { name: 'Alaska-Seelachs TK', menge: '600 g', warum: 'Sehr ähnlich.' }], rezept_hinweis: 'Am Vorabend im Kühlschrank auftauen und trocken tupfen.' } }, error: null }; if (o.body.action === 'sicherung') return { data: { name: 'x', anzahl: { ep_dishes: 16, ep_plan: 20 } }, error: null }; if (o.body.action === 'kassenzettel') return { data: { beleg: { markt: 'Aldi Süd', datum: '2026-11-16', summe: 14.10, hinweis: 'Eine Zeile war schwer lesbar.', posten: [ { text: 'BIO HAEHN.BR.FIL', name: 'Bio-Hähnchenbrustfilet', preis: 7.99, kategorie: 'Fleisch und Fisch' }, { text: 'SALATGURKE', name: 'Salatgurke', preis: 0.69, kategorie: 'Obst und Gemüse' }, { text: 'SPUELMASCH.TABS', name: 'Spülmaschinentabs', preis: 3.95, kategorie: 'Sonstiges' }, { text: 'PFAND', name: 'Pfand', preis: 0.25, kategorie: 'Pfand und Rabatt' } ] } }, error: null }; return { data: {}, error: null }; } } }) };
}, db);









const saved = () => page.evaluate(() => window.calls.filter((c) => c[0] === 'upsert' && c[1] === 'ep_shopping').flatMap((c) => c[2]));
const short = (i) => `${i.label}@${i.due}/${i.week_start.slice(5)}${i.missing ? '!' : ''}${i.qty ? ` (${i.qty})` : ''}`;
let page; const errs = [];
async function open(heute, data) {
  if (page) await page.close();
  page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(([h, d]) => { window.__heute = h; globalThis.ESSENSPLAN_HEUTE = h; if (d) window.__db.ep_shopping = d; }, [heute, data || null]);
  await page.goto('http://localhost:8834/#einkauf'); await page.waitForTimeout(1200);
  if (await page.locator('[data-action="ich"]').count()) {
    await page.locator('[data-action="ich"]').first().click(); await page.waitForTimeout(400);
    await page.fill('[name=pin1]', '1234'); await page.fill('[name=pin2]', '1234'); await page.click('#sheet-root button.knopf'); await page.waitForTimeout(1500);
  }
  await page.evaluate(() => { location.hash = '#einkauf'; }); await page.waitForTimeout(700);
}
const text = async () => (await page.locator('main').innerText()).replace(/\n+/g, ' | ');
const toastText = async () => (await page.locator('#toast').innerText().catch(() => '')).trim();

// 1) Freitag: Nachkauf aufgelöst, morgen oben, Danach und Erledigt zugeklappt.
await open('2026-11-20');
const t1 = await text();
console.log('A Kopf:', t1.slice(0, 110));
console.log('A Nachkauf weg:', !/Nachkauf/.test(t1), '| Danach/Erledigt:', /Danach \| Frischeeinkauf, Mittwoch 25\.11\. \| 3 Posten/.test(t1), /Erledigt \| Frischeeinkauf, Mittwoch 18\.11\. \| 4 gekauft \| Großeinkauf, Samstag 14\.11\. \| 8 gekauft/.test(t1));
console.log('A gewandert:', (await saved()).map(short).join('; '));
console.log('A Wochenleiste weg:', await page.locator('.wochen-nav, [data-action="woche"]').count(), '| Tab:', (await page.locator('[data-tab="einkauf"]').innerText()).replace(/\n/g, ' '));
await page.screenshot({ path: 'ek_a.png', fullPage: true });

// 2) Eigener Eintrag landet auf dem aktuellen Einkauf, sortiert in die Abteilung.
await page.fill('#neu-posten', 'Joghurt'); await page.click('form[data-form="posten"] button'); await page.waitForTimeout(400);
const j = (await saved()).filter((i) => i.label === 'Joghurt').pop();
console.log('B Eintrag:', j ? `${j.label} ${j.due} ${j.week_start} ${j.trip} ${j.category}` : 'fehlt');

// 3) Einkaufsmodus: zwei fehlen, Fertig, beide wandern auf den Mittwoch.
await page.click('.ek-kopf [data-action="einkaufsmodus"]'); await page.waitForTimeout(400);
await page.locator('li:has-text("Rinderhackfleisch") [data-action="fehlt"]').click(); await page.waitForTimeout(300);
await page.locator('li:has-text("Mozzarella") [data-action="fehlt"]').click(); await page.waitForTimeout(300);
console.log('C Kasten:', (await page.locator('.fehlt-kasten').innerText()).replace(/\n+/g, ' | '));
await page.locator('li:has-text("Möhren") [data-action="haken"]').click(); await page.waitForTimeout(900);
await page.click('.modus-leiste [data-action="einkaufsmodus"]'); await page.waitForTimeout(500);
console.log('C Toast:', await toastText());
console.log('C gewandert:', (await saved()).filter((i) => /Rinder|Mozza/.test(i.label)).slice(-2).map(short).join('; '));
await page.locator('.ek-tour:has-text("Mittwoch 25.11.") > summary').click(); await page.waitForTimeout(300);
console.log('C Danach offen:', (await page.locator('.ek-tour:has-text("Mittwoch 25.11.")').innerText()).replace(/\n+/g, ' | '));
await page.screenshot({ path: 'ek_c.png', fullPage: true });

// 4) Späteren Einkauf auf morgen legen: ein Einkauf.
await page.locator('.ek-tour:has-text("Mittwoch 25.11.") summary.textknopf').click(); await page.waitForTimeout(200);
await page.locator('.ek-tour:has-text("Mittwoch 25.11.") input[name=due]').fill('2026-11-21');
await page.locator('.ek-tour:has-text("Mittwoch 25.11.") form[data-form="einkaufstag"] button').click(); await page.waitForTimeout(500);
console.log('D Toast:', await toastText(), '| Danach noch da:', await page.locator('.ek-tour:has-text("Mittwoch 25.11.")').count());

// 5) Donnerstag nach dem Frischeeinkauf ohne kommende Liste: Fehlendes und Eigenes wandern auf den Samstag (neue Woche), Abendessen von gestern bleibt liegen.
const P2 = (id, trip, due, label, qty, purpose, extra = {}) => ({ id, week_start: '2026-11-16', trip, due, category: 'kuehl', label, qty, purpose, sort: 1, checked: false, manual: false, missing: false, ...extra });
await open('2026-11-19', [
  P2('x1', 'Frischeeinkauf am Mi 18.11.', '2026-11-18', 'Lachsfilet', '400 g', 'Lachs (Mi)', { checked: true, checked_by: 'p1' }),
  P2('x2', 'Frischeeinkauf am Mi 18.11.', '2026-11-18', 'Schmand', '200 g', 'Burger (Sa)', { missing: true }),
  P2('x3', 'Frischeeinkauf am Mi 18.11.', '2026-11-18', 'Sahne', '200 g', 'Lachs (Mi)'),
  P2('x4', 'Frischeeinkauf am Mi 18.11.', '2026-11-18', 'Batterien', '', '', { manual: true, category: 'sonst' }),
]);
console.log('E Liste:', (await text()).slice(0, 260));
console.log('E gewandert:', (await saved()).map(short).join('; '), '| Toast:', await toastText());

// 6) Einkaufsmodus durch Bereichswechsel verlassen: Fehlendes wandert auch, der Hinweis bekommt das neue Datum.
await open('2026-11-25', [
  P2('y1', 'Frischeeinkauf am Mi 25.11.', '2026-11-25', 'Rinderhackfleisch', '800 g, am 20.11. nicht bekommen', 'Bolognese (Mi)', { week_start: '2026-11-23', category: 'fleisch' }),
  P2('y2', 'Frischeeinkauf am Mi 25.11.', '2026-11-25', 'Milch', '1 l', '', { week_start: '2026-11-23' }),
]);
await page.click('.ek-kopf [data-action="einkaufsmodus"]'); await page.waitForTimeout(400);
await page.screenshot({ path: 'ek_modus.png' });
console.log('F Wofür im Laden sichtbar:', await page.locator('.posten .p-wofuer:visible').count());
await page.locator('li:has-text("Rinderhackfleisch") [data-action="fehlt"]').click(); await page.waitForTimeout(300);
await page.locator('[data-tab="woche"]').click(); await page.waitForTimeout(600);
console.log('F Toast:', await toastText(), '| gespeichert:', (await saved()).filter((i) => i.id === 'y1').map(short).pop());
// 7) Einkaufstag in der Vergangenheit geht nicht.
await page.locator('[data-tab="einkauf"]').click(); await page.waitForTimeout(400);
await page.locator('.ek-jetzt summary.textknopf').click(); await page.waitForTimeout(200);
console.log('G min:', await page.locator('.ek-jetzt input[name=due]').getAttribute('min'));
await page.evaluate(() => { const f = document.querySelector('.ek-jetzt form[data-form="einkaufstag"]'); f.querySelector('input[name=due]').removeAttribute('min'); f.querySelector('input[name=due]').value = '2026-11-20'; f.requestSubmit(); });
await page.waitForTimeout(400);
console.log('G Toast:', await toastText());

console.log('Fehler:', errs);
await b.close(); srv.close();
