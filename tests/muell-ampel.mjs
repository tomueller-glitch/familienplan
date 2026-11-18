import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8852);
const { SEED } = await import(ROOT + '/js/seed.js');
const b = await chromium.launch();
const base = () => ({ ep_persons: SEED.persons.map(p => p.adult ? { ...p, pin_hash: null } : p), ep_dishes: SEED.dishes, ep_plan: SEED.plan, ep_shopping: SEED.shopping, ep_tasks: SEED.tasks, ep_pantry: SEED.pantry, ep_ai_runs: [], ep_settings: [], ep_task_log: [] });
async function open(db, who) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
  await ctx.addInitScript((db) => {
  globalThis.ESSENSPLAN_HEUTE = '2026-11-18';
  window.calls = []; window.__db = db;
  const q = (table) => { const api = { select() { return api; }, order() { return api; }, range() { return Promise.resolve({ data: window.__db[table] || [], error: null }); },
    upsert(rows) { window.calls.push(['upsert', table, JSON.parse(JSON.stringify(rows))]); return Promise.resolve({ error: null }); },
    delete() { const d = { eq() { return Object.assign(Promise.resolve({ error: null }), d); }, in(c, v) { window.calls.push(['delete', table, v.length]); return Promise.resolve({ error: null }); } }; return d; } }; return api; };
  window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: {} } }, error: null }), signOut: async () => {} }, from: q,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({ list: async () => ({ data: [{ name: 'familienplan-2026-11-15-0300.json', metadata: { size: 48213 } }, { name: 'familienplan-2026-11-08-0300.json', metadata: { size: 47001 } }], error: null }), download: async (n) => ({ data: new Blob(['{}'], { type: 'application/json' }), error: null }) }) }, functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, { action: o.body.action, n: (o.body.photos || []).length, len: (o.body.photos || []).map(p => p.data.length) }]); await new Promise(r => setTimeout(r, 400)); if (o.body.action === 'mittag') { window.lastMittag = o.body.mittag; return { data: { mittag: [{ name: 'Rührei mit Spinat', minuten: 10, warum: 'Eiweiß und Gemüse.', zutaten: [{ menge: '4 Stück', name: 'Eier', da: true }, { menge: '100 g', name: 'Feta', da: false }], schritte: ['Eier verquirlen.', 'Braten.'], reste: [] }] }, error: null }; } if (o.body.action === 'kosten') { const ds = window.__db.ep_dishes; return { data: { kosten: { stand: '2026-11-18', kassenzettel: 2, gerichte: Object.fromEntries(ds.map((x, i) => [x.id, 6 + (i * 1.7) % 14])) } }, error: null }; } if (o.body.action === 'fest') { const m = await import('/js/planer.js'); return { data: { fest: m.demoFeast(o.body.fest) }, error: null }; } if (o.body.action === 'ersatz') return { data: { ersatz: { vorschlaege: [{ name: 'Kabeljaufilet TK', menge: '600 g', warum: 'Mild und fest.' }, { name: 'Alaska-Seelachs TK', menge: '600 g', warum: 'Sehr ähnlich.' }], rezept_hinweis: 'Am Vorabend im Kühlschrank auftauen und trocken tupfen.' } }, error: null }; if (o.body.action === 'sicherung') return { data: { name: 'x', anzahl: { ep_dishes: 16, ep_plan: 20 } }, error: null }; if (o.body.action === 'kassenzettel') return { data: { beleg: { markt: 'Aldi Süd', datum: '2026-11-18', summe: 14.10, hinweis: 'Eine Zeile war schwer lesbar.', posten: [ { text: 'BIO HAEHN.BR.FIL', name: 'Bio-Hähnchenbrustfilet', preis: 7.99, kategorie: 'Fleisch und Fisch' }, { text: 'SALATGURKE', name: 'Salatgurke', preis: 0.69, kategorie: 'Obst und Gemüse' }, { text: 'SPUELMASCH.TABS', name: 'Spülmaschinentabs', preis: 3.95, kategorie: 'Sonstiges' }, { text: 'PFAND', name: 'Pfand', preis: 0.25, kategorie: 'Pfand und Rabatt' } ] } }, error: null }; return { data: {}, error: null }; } } }) };
}, db);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8852/#woche'); await page.waitForTimeout(1200);
  await page.locator('[data-action="ich"]').nth(who).click(); await page.waitForTimeout(400);
  if (who < 2) { await page.fill('[name=pin1]', '1234'); await page.fill('[name=pin2]', '1234'); await page.click('#sheet-root button.knopf'); await page.waitForTimeout(1500); }
  await page.evaluate(() => { location.hash = '#aufgaben'; }); await page.waitForTimeout(600);
  return { page, ctx, errs };
}
const calls = (page, table) => page.evaluate((t) => window.calls.filter((c) => c[0] === 'upsert' && c[1] === t).map((c) => c[2]), table);
const toastText = (page) => page.evaluate(() => [...document.querySelectorAll('.toast, [role=status]')].map((x) => x.textContent.trim()).filter(Boolean).join(' | '));
const iso = new Date().toISOString();

// A: Eltern schalten die Ampel
{
  const { page, ctx, errs } = await open(base(), 0);
  await page.screenshot({ path: '/tmp/km_eltern_gruen.png', fullPage: true });
  await page.locator('[data-action="km-stufe"][data-bin="plastik"][data-stufe="rot"]').click(); await page.waitForTimeout(300);
  console.log('A Toast:', await toastText(page));
  await page.locator('[data-action="km-stufe"][data-bin="rest"][data-stufe="gelb"]').click(); await page.waitForTimeout(300);
  const s = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'kuechenmuell').pop();
  console.log('A gespeichert:', s && s.value.plastik.stufe, s && s.value.rest.stufe, !!(s && s.value.plastik.at));
  await page.locator('.km-karte.eltern').first().screenshot({ path: '/tmp/km_eltern.png' });
  console.log('A Fehler:', errs); await ctx.close();
}
// B: Kind sieht Rot und Gelb und meldet den Plastikmüll
{
  const db = base(); db.ep_settings = [{ key: 'kuechenmuell', value: { plastik: { stufe: 'rot', at: iso, by: 'p1' }, rest: { stufe: 'gelb', at: iso, by: 'p1' } } }];
  const { page, ctx, errs } = await open(db, 2);
  console.log('B Extras mit Müll:', await page.locator('.extra-zeile', { hasText: 'Müll aus der Küche' }).count());
  console.log('B Badge:', await page.locator('.tab[data-tab="aufgaben"]').innerText());
  await page.screenshot({ path: '/tmp/km_kind_rot.png' });
  await page.locator('[data-action="km-raus"][data-bin="plastik"]').click(); await page.waitForTimeout(400);
  const e = (await calls(page, 'ep_task_log')).flat().pop();
  console.log('B Meldung:', e && e.id.slice(0, 11), e && e.label, e && e.status, e && e.minutes);
  console.log('B Knöpfe danach:', await page.locator('[data-action="km-raus"]').count());
  await page.locator('.km-karte').screenshot({ path: '/tmp/km_kind_gemeldet.png' });
  console.log('B Fehler:', errs); await ctx.close();
}
// C: alles grün
{
  const { page, ctx, errs } = await open(base(), 3);
  console.log('C Knöpfe:', await page.locator('[data-action="km-raus"]').count(), 'Text:', (await page.locator('.km-karte').innerText()).replace(/\n/g, ' | '));
  await page.locator('.km-karte').screenshot({ path: '/tmp/km_kind_gruen.png' });
  console.log('C Fehler:', errs); await ctx.close();
}
// D: Eltern bestätigen, Ampel springt auf Grün
{
  const db = base(); db.ep_settings = [{ key: 'kuechenmuell', value: { plastik: { stufe: 'rot', at: iso, by: 'p1' }, rest: { stufe: 'gelb', at: iso, by: 'p1' } } }];
  db.ep_task_log = [{ id: 'km-plastik-abc', person_id: 'p3', task_id: 'muell', day: '2026-11-18', label: 'Müll aus der Küche rausbringen: Plastikmüll', minutes: 5, status: 'offen', created_at: iso, decided_by: null, decided_at: null }];
  const { page, ctx, errs } = await open(db, 0);
  await page.screenshot({ path: '/tmp/km_eltern_bestaetigen.png', fullPage: true });
  await page.locator('[data-action="log-ok"][data-id="km-plastik-abc"]').click(); await page.waitForTimeout(400);
  const s = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'kuechenmuell').pop();
  console.log('D nach Bestätigen:', s && s.value.plastik.stufe, s && s.value.rest.stufe);
  console.log('D Fehler:', errs); await ctx.close();
}
// E: Spülmaschine lief bis vor einer Stunde, Kind räumt aus
{
  const db = base();
  const past = new Date(Date.now() - 3600000).toISOString();
  db.ep_settings = [{ key: 'spuelmaschine', value: { stufe: 'gelb', at: past, by: 'p1', bis: past } }];
  const { page, ctx, errs } = await open(db, 2);
  console.log('E Karte:', (await page.locator('.km-karte').innerText()).replace(/\n+/g, ' | '));
  console.log('E Extras mit Spülmaschine:', await page.locator('.extra-zeile', { hasText: 'Spülmaschine' }).count(), 'Badge:', await page.locator('.tab[data-tab="aufgaben"]').innerText());
  await page.locator('.km-karte').screenshot({ path: '/tmp/sm_kind_rot.png' });
  await page.locator('[data-action="sm-raus"]').click(); await page.waitForTimeout(400);
  const e = (await calls(page, 'ep_task_log')).flat().pop();
  console.log('E Meldung:', e && e.id.slice(0, 3), e && e.label, e && e.status, e && e.minutes);
  console.log('E danach:', (await page.locator('.km-karte').innerText()).replace(/\n+/g, ' | '));
  console.log('E Fehler:', errs); await ctx.close();
}
// F: Eltern stellen auf Gelb und wählen die Endzeit
{
  const { page, ctx, errs } = await open(base(), 0);
  await page.locator('[data-action="sm-stufe"][data-stufe="gelb"]').click(); await page.waitForTimeout(300);
  console.log('F Toast:', await toastText(page));
  await page.locator('[data-action="sm-bis"][data-wert="120"]').click(); await page.waitForTimeout(300);
  let st = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'spuelmaschine').pop();
  console.log('F nach 2 Std.:', st && st.value.stufe, st && Math.round((Date.parse(st.value.bis) - Date.now()) / 60000), 'Min.');
  await page.locator('.sm-zeit').fill('23:45'); await page.locator('.sm-zeit').dispatchEvent('change'); await page.waitForTimeout(300);
  st = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'spuelmaschine').pop();
  console.log('F um 23:45:', st && new Date(st.value.bis).toTimeString().slice(0, 5), 'Text:', (await page.locator('.km-karte.eltern').last().innerText()).replace(/\n+/g, ' | '));
  await page.locator('.km-karte.eltern').last().screenshot({ path: '/tmp/sm_eltern.png' });
  console.log('F Fehler:', errs); await ctx.close();
}
// G: Eltern bestätigen das Ausräumen, Ampel springt auf Grün
{
  const db = base();
  db.ep_settings = [{ key: 'spuelmaschine', value: { stufe: 'rot', at: iso, by: 'p1' } }];
  db.ep_task_log = [{ id: 'sm-abc', person_id: 'p3', task_id: 'spuelmaschine', day: '2026-11-18', label: 'Spülmaschine ausräumen', minutes: 10, status: 'offen', created_at: iso, decided_by: null, decided_at: null }];
  const { page, ctx, errs } = await open(db, 0);
  await page.locator('[data-action="log-ok"][data-id="sm-abc"]').click(); await page.waitForTimeout(400);
  const st = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'spuelmaschine').pop();
  console.log('G nach Bestätigen:', st && st.value.stufe);
  console.log('G Fehler:', errs); await ctx.close();
}
// H: Spülmaschine läuft noch, sonst alles grün
{
  const db = base();
  db.ep_settings = [{ key: 'spuelmaschine', value: { stufe: 'gelb', at: iso, by: 'p1', bis: new Date(Date.now() + 5400000).toISOString() } }];
  const { page, ctx, errs } = await open(db, 3);
  console.log('H Karte:', (await page.locator('.km-karte').innerText()).replace(/\n+/g, ' | '), 'Knöpfe:', await page.locator('[data-action="sm-raus"]').count());
  await page.locator('.km-karte').screenshot({ path: '/tmp/sm_kind_laeuft.png' });
  console.log('H Fehler:', errs); await ctx.close();
}
await b.close(); srv.close();
