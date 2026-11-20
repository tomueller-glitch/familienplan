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
// C: Alte Wochentermine aus dem Familienplan erscheinen nicht mehr
const DIENST = { id: 'e1', title: 'Dienst', who: ['p1'], weekdays: [2], start_time: '12:00', end_time: '20:30', home_time: null, pause_ferien: false, active: true, sort: 1 };
{
  const db = base(); db.ep_settings = [{ key: 'kalender', value: { feeds } }]; db.ep_events = [DIENST, { id: 'e2', title: 'Ballett', who: ['p4'], weekdays: [2], start_time: '16:00', end_time: '17:00', home_time: '17:15', pause_ferien: false, active: true, sort: 2 }];
  const { page, ctx, errs } = await openDisplay(db, 1024, 768);
  console.log('C Termine:', (await page.locator('.anz-heute').innerText()).replace(/\n+/g, ' | '));
  console.log('C Fehler:', errs); await ctx.close();
}
// D: Kalender zählen fürs Abendessen mit Heimweg, auch für Claude und die gespeicherten Essenszeiten. Heimweg einstellen.
{
  const KAL2 = { ...KAL, wege: { an: true, fehler: '' }, tage: { ...KAL.tage,
    '2026-11-19': [...KAL.tage['2026-11-19'], { titel: 'Handball', von: '17:00', bis: '18:30', ganztags: false, zeit: true, kalender: 'k3', ort: 'Sporthalle Rödental', weg: 17 }],
    '2026-11-20': [{ titel: 'Nachtdienst', von: '15:30', bis: null, ganztags: false, zeit: true, weiter: true, kalender: 'k1' }], '2026-11-21': [{ titel: 'Nachtdienst', von: null, bis: '08:00', ganztags: false, zeit: true, kalender: 'k1' }] } };
  KAL2.tage['2026-11-18'] = KAL2.tage['2026-11-18'].map((x) => ({ ...x, zeit: true }));
  const db = base(); db.ep_settings = [{ key: 'kalender', value: { feeds } }, { key: 'heimweg', value: { adresse: 'Am Hang 3, 96450 Coburg', schluessel: 'abc' } }]; db.ep_events = [DIENST];
  const { page, ctx, errs } = await open(db, 0, KAL2);
  await page.evaluate(() => { location.hash = '#woche'; }); await page.waitForTimeout(5500);
  console.log('D Abrufe:', await page.evaluate(() => [window.kalCalls, window.kalTage]));
  const plan = (await calls(page, 'ep_plan')).flat().filter((r) => r.day >= '2026-11-18' && r.day <= '2026-11-21').map((r) => `${r.day}:${r.dinner_time}:${(r.dinner_away || []).join('+')}`);
  console.log('D Essenszeiten gespeichert:', plan.join(' '));
  const ctxRow = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'ki_kontext').pop();
  console.log('D Claude:', ctxRow ? ctxRow.value.tage.slice(0, 3).map((t) => `${t.tag}: ${t.essen}, ${t.esser} Esser, weg ${t.weg.join('+') || '-'}, kurz ${t.kurz}`).join(' | ') : 'nicht geschrieben');
  console.log('D Termine für Claude:', ctxRow ? JSON.stringify(ctxRow.value.auswertung.termine.slice(0, 3)) : '-');
  console.log('D Kachel:', (await page.locator('.plan-kachel').first().innerText()).replace(/\n+/g, ' | '), '| Termine-Knopf:', await page.locator('[data-action="termine"]').count());
  await page.locator('.plan-kachel[data-action="kalender-abos"]').click(); await page.waitForTimeout(400);
  console.log('D Liste:', (await page.locator('#sheet-root .kal-liste').innerText()).replace(/\n+/g, ' | '));
  await page.locator('#sheet-root [data-action="kalender-weg-art"]').nth(1).click(); await page.waitForTimeout(500);
  const st = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'kalender').pop();
  console.log('D Heimweg Jonas:', JSON.stringify(st.value.feeds.map((f) => `${f.name}:${f.weg || 'auto'}`)));
  await page.fill('#sheet-root [name=adresse]', 'Neue Straße 1, 96450 Coburg');
  await page.locator('#sheet-root form[data-form=heimweg] button.knopf').first().click(); await page.waitForTimeout(800);
  const hw = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'heimweg').pop();
  console.log('D Heimweg gespeichert:', JSON.stringify(hw && hw.value), '| Abrufe:', await page.evaluate(() => window.kalCalls));
  await shot(page, '#sheet-root .bogen', '/tmp/kal_heimweg.png');
  console.log('D Fehler:', errs); await ctx.close();
  const d2 = await openDisplay(db, 1024, 768, KAL2);
  console.log('D Display:', (await d2.page.locator('.anz-heute').innerText()).replace(/\n+/g, ' | ').split('Morgen')[1]);
  await d2.ctx.close();
}
// E: iPad mini quer mit vier Ampeln, vollem Tag und langer Zeile zum Abendessen
{
  const KAL3 = { ...KAL, tage: { '2026-11-18': [
    { titel: 'Leseprobe', von: null, bis: null, ganztags: true, kalender: 'k3' }, { titel: 'Abholung schwarze Tonne', von: null, bis: null, ganztags: true, kalender: 'k2' },
    { titel: 'Werkstatt-Termin: CO-JP 1417', von: '10:30', bis: '10:30', ganztags: false, zeit: true, kalender: 'k1' },
    { titel: 'Training D1', von: '17:00', bis: '18:30', ganztags: false, zeit: true, kalender: 'k1' }, { titel: 'Training D1', von: '17:00', bis: '18:30', ganztags: false, zeit: true, kalender: 'k3' },
    { titel: 'GP Märchen', von: '18:00', bis: '21:30', ganztags: false, zeit: true, kalender: 'k1' }],
    '2026-11-19': [{ titel: 'Musik Schulaufgabe', von: null, bis: null, ganztags: true, kalender: 'k3' }, { titel: 'Turnen', von: '15:30', bis: '17:00', ganztags: false, zeit: true, kalender: 'k3' }] } };
  const db = base(); db.ep_settings = [{ key: 'kalender', value: { feeds } }, { key: 'stall', value: { on: true, tage: 5, last: '2026-11-12', by: 'p1' } }];
  for (const [w, h] of [[1024, 768], [1024, 748], [1133, 744], [1024, 690], [744, 1133], [768, 1024]]) {
    const { page, ctx, errs } = await openDisplay(db, w, h, KAL3);
    const r = await page.evaluate(() => [document.querySelectorAll('.anz-ampeln li').length, document.documentElement.scrollHeight, innerHeight]);
    console.log(`E ${w}x${h}: Ampeln ${r[0]}, Höhe ${r[1]} von ${r[2]}${r[1] > r[2] ? ' ZU HOCH' : ''}`, errs.length ? errs : '');
    if (h === 744) await page.screenshot({ path: "/tmp/mini_quer4.png" }); if (w === 744) await page.screenshot({ path: "/tmp/mini_hoch4.png" });
    await ctx.close();
  }
}
// F: Kind legt am Handy eine PIN fest und hakt am Küchen-Display ab. Kein Knopf zum Beenden.
{
  const { createHash } = await import('node:crypto');
  const h = (id, pin) => createHash('sha256').update(`essensplan|${id}|${pin}`).digest('hex');
  // Am Handy: Kind 1 legt die PIN fest
  const db0 = base();
  const ph = await open(db0, 2);
  const box = ph.page.locator('.kasten-text', { hasText: 'PIN fürs Küchen-Display' });
  console.log('F Handy:', (await box.innerText()).replace(/\n+/g, ' | '));
  await box.locator('[data-action="kind-pin"]').click(); await ph.page.waitForTimeout(300);
  console.log('F Bogen:', (await ph.page.locator('#sheet-root .meta').first().innerText()).slice(0, 90));
  await ph.page.fill('#sheet-root [name=pin1]', '1357'); await ph.page.fill('#sheet-root [name=pin2]', '1357');
  await ph.page.locator('#sheet-root form[data-form=pin] button').click(); await ph.page.waitForTimeout(500);
  const saved = (await calls(ph.page, 'ep_persons')).flat().filter((r) => r.id === 'p3').pop();
  console.log('F PIN gespeichert:', !!saved && saved.pin_hash === h('p3', '1357'), '| Fehler:', ph.errs); await ph.ctx.close();
  // Farbwahl im Familie-Fenster
  {
    const ph2 = await open(base(), 0);
    await ph2.page.locator('[data-action="familie"]').first().click(); await ph2.page.waitForTimeout(300);
    await ph2.page.evaluate(() => document.querySelectorAll('#sheet-root details').forEach((d) => { d.open = true; }));
    await ph2.page.locator('[data-action="anzeige-farbe"][data-v="hell"]').click(); await ph2.page.waitForTimeout(300);
    const st = (await calls(ph2.page, 'ep_settings')).flat().filter((r) => r.key === 'anzeige').pop();
    console.log('F Farbe gespeichert:', JSON.stringify(st && st.value), '| gedrückt:', await ph2.page.locator('[data-action="anzeige-farbe"][aria-pressed="true"]').textContent(), '| Fehler:', ph2.errs);
    await ph2.ctx.close();
  }
  // Am Display
  const db = base(); db.ep_persons = db.ep_persons.map((p) => (p.id === 'p3' ? { ...p, pin_hash: h('p3', '1357') } : p.id === 'p1' ? { ...p, pin_hash: h('p1', '2468') } : p));
  const { page, ctx, errs } = await openDisplay(db, 1024, 768);
  console.log('F Beenden-Knopf:', await page.locator('[data-action="anzeige-aus"]').count());
  await page.locator('[data-action="anz-kind"][data-id="p4"]').click(); await page.waitForTimeout(300);
  console.log('F ohne PIN:', await toastText(page));
  await page.locator('[data-action="anz-kind"][data-id="p3"]').click(); await page.waitForTimeout(300);
  for (const z of '1111') await page.locator(`#sheet-root [data-action="anz-ziffer"][data-z="${z}"]`).click();
  await page.waitForTimeout(300);
  console.log('F falsch:', (await page.locator('#sheet-root .fehler').innerText().catch(() => '-')));
  for (const z of '1357') await page.locator(`#sheet-root [data-action="anz-ziffer"][data-z="${z}"]`).click();
  await page.waitForTimeout(400);
  console.log('F Liste:', (await page.locator('#sheet-root .bogen').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
  await shot(page, '#sheet-root .bogen', '/tmp/anz_aufgaben.png');
  const first = page.locator('#sheet-root [data-action="anz-erledigt"]').first();
  const tid = await first.getAttribute('data-id');
  await first.click(); await page.waitForTimeout(400);
  const log = (await calls(page, 'ep_task_log')).flat().pop();
  console.log('F abgehakt:', log && `${log.person_id} ${log.task_id === tid} ${log.status}`, '|', (await page.locator(`#sheet-root li:has([data-id="${tid}"])`).innerText()).replace(/\n+/g, ' | '));
  await page.locator('#sheet-root [data-action="anz-fertig"]').click(); await page.waitForTimeout(300);
  console.log('F nach Fertig:', await page.locator('#sheet-root .bogen').count(), '| Kinder:', (await page.locator('.anz-kinder').innerText()).replace(/\n+/g, ' | ').slice(0, 200));
  await page.locator('[data-action="anz-kind"][data-id="p3"]').click(); await page.waitForTimeout(300);
  console.log('F wieder PIN nötig:', await page.locator('#sheet-root [data-action="anz-ziffer"]').count() > 0);
  await page.locator('#sheet-root [data-action="zu"]').click(); await page.waitForTimeout(200);
  for (let i = 0; i < 4; i += 1) await page.locator('[data-action="anz-blatt"]').click();
  console.log('F vier Tipper:', await page.locator('#sheet-root .bogen').count());
  await page.locator('[data-action="anz-blatt"]').click(); await page.waitForTimeout(300);
  console.log('F Ausgang:', (await page.locator('#sheet-root .bogen').innerText()).replace(/\n+/g, ' | ').slice(0, 160));
  await page.fill('#sheet-root [name=pin1]', '1357'); await page.locator('#sheet-root form[data-form=pin] button').click(); await page.waitForTimeout(300);
  console.log('F Kinder-PIN beendet nicht:', await page.locator('.anzeige').count(), (await page.locator('#sheet-root .fehler').innerText().catch(() => '-')));
  await page.fill('#sheet-root [name=pin1]', '2468'); await page.locator('#sheet-root form[data-form=pin] button').click(); await page.waitForTimeout(500);
  console.log('F Eltern-PIN beendet:', await page.locator('.anzeige').count() === 0);
  console.log('F Fehler:', errs); await ctx.close();
}
// G: Vorschau morgens, nachmittags und nach dem Essen, „Ist alle“ und „Wie war's?“
{
  globalThis.__crypto = await import('node:crypto');
  const NAMES = { p1: 'Papa', p2: 'Mama', p3: 'Philip', p4: 'Julia' };
  const tippe = async (page, pin) => { for (const z of pin) await page.locator(`#sheet-root [data-action="anz-ziffer"][data-z="${z}"]`).click(); await page.waitForTimeout(400); };
  const KAL4 = { ...KAL, feeds: [{ id: 'k1', ok: true, anzahl: 3 }, { id: 'k2', ok: true, anzahl: 1 }, { id: 'k3', ok: true, anzahl: 3 }, { id: 'k5', ok: true, anzahl: 2 }, { id: 'k6', ok: true, anzahl: 2 }], tage: {
    '2026-11-19': [
      { titel: 'Englisch Ex', von: null, bis: null, ganztags: true, kalender: 'k3' },
      { titel: 'Werkstatt-Termin: CO-JP 1417', von: '10:30', bis: '10:30', ganztags: false, zeit: true, kalender: 'k1' },
      { titel: 'Turnen', von: '15:30', bis: '17:00', ganztags: false, zeit: true, kalender: 'k6' },
      { titel: 'Training D1', von: '17:00', bis: '18:30', ganztags: false, zeit: true, kalender: 'k1', weg: 12 },
      { titel: 'Training D1', von: '17:00', bis: '18:30', ganztags: false, zeit: true, kalender: 'k3', weg: 12 },
      { titel: 'GP Märchen', von: '18:00', bis: '21:30', ganztags: false, zeit: true, kalender: 'k5' }],
    '2026-11-20': [{ titel: 'Musik Schulaufgabe', von: null, bis: null, ganztags: true, kalender: 'k3' }, { titel: 'Schwimmen', von: '15:30', bis: '16:30', ganztags: false, zeit: true, kalender: 'k6' }] } };
  const feeds4 = [{ id: 'k1', name: 'Papa', url: 'webcal://x/1', person_id: 'p1' }, { id: 'k2', name: 'Familie', url: 'webcal://x/2', person_id: null }, { id: 'k3', name: 'Philip', url: 'webcal://x/3', person_id: 'p3' }, { id: 'k5', name: 'Mama', url: 'webcal://x/5', person_id: 'p2' }, { id: 'k6', name: 'Julia', url: 'webcal://x/6', person_id: 'p4' }];
  const mk = () => {
    const db = base();
    const { createHash } = globalThis.__crypto;
    const PINS = { p1: '2468', p3: '1357', p4: '1122' };
    db.ep_persons = db.ep_persons.map((p) => ({ ...p, name: NAMES[p.id] || p.name, ...(PINS[p.id] ? { pin_hash: createHash('sha256').update(`essensplan|${p.id}|${PINS[p.id]}`).digest('hex') } : {}) })); db.ep_staples = JSON.parse(JSON.stringify(SEED.staples)); db.ep_shopping = db.ep_shopping.filter((i) => !/milch|joghurt|butter|käse/i.test(i.label));
    db.ep_settings = [{ key: 'kalender', value: { feeds: feeds4 } }, { key: 'stall', value: { on: true, tage: 5, last: '2026-11-15', by: 'p1' } }];
    db.ep_plan = db.ep_plan.map((p) => (p.day === '2026-11-19' ? { ...p, lunchbox: 'Vollkornbrot mit Käse, Paprikastreifen, Apfel' } : p.day === '2026-11-20' ? { ...p, lunchbox: 'Wrap mit Hähnchen und Gurke', prep: 'Hähnchen aus dem Gefrierfach nehmen.' } : p));
    return db;
  };
  const shots = [['morgen', 7, 10], ['abend', 16, 45], ['nachdemessen', 19, 40]];
  for (const [name, hh, mm] of shots) {
    for (const [w, h, lage] of [[1133, 744, 'quer'], [744, 1133, 'hoch']]) {
      const { page, ctx, errs } = await openDisplay(mk(), w, h, KAL4, { stunde: hh, minute: mm, tag: '2026-11-19' });
      const r = await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight]);
      if (lage === 'quer') console.log(`G ${name}:`, (await page.locator('.anz-essen').innerText()).replace(/\n+/g, ' | '), '| Fuß:', (await page.locator('.anz-fuss').innerText()).replace(/\n+/g, ' '));
      console.log(`G ${name} ${lage}: Höhe ${r[0]} von ${r[1]}${r[0] > r[1] ? ' ZU HOCH' : ''}`, errs.length ? errs : '');
      await page.screenshot({ path: `/tmp/vorschau_${name}_${lage}.png` });
      await ctx.close();
    }
  }
  // Farbe: automatisch, fest hell, fest dunkel
  for (const [farbe, hh] of [['auto', 7], ['auto', 19], ['hell', 20], ['dunkel', 9]]) {
    const db = mk(); if (farbe !== 'auto') db.ep_settings.push({ key: 'anzeige', value: { farbe } });
    const { page, ctx, errs } = await openDisplay(db, 1133, 744, KAL4, { stunde: hh, minute: 5, tag: '2026-11-19' });
    const r = await page.evaluate(() => [document.querySelector('.anzeige').className, document.documentElement.className, getComputedStyle(document.body).backgroundColor]);
    console.log(`G Farbe ${farbe} ${hh} Uhr:`, r.join(' | '), errs.length ? errs : '');
    if (farbe === 'auto' && hh === 7) await page.screenshot({ path: '/tmp/vorschau_hell_quer.png' });
    await ctx.close();
  }
  {
    const { page, ctx, errs } = await openDisplay(mk(), 744, 1133, KAL4, { stunde: 16, minute: 45, tag: '2026-11-19' });
    await page.screenshot({ path: '/tmp/vorschau_hell_hoch.png' }); await ctx.close();
  }
  // Ist alle und Wie war's
  const { page, ctx, errs } = await openDisplay(mk(), 1133, 744, KAL4, { stunde: 19, minute: 40, tag: '2026-11-19' });
  console.log('G Wetter-Abruf:', (ctx.wetterUrl || '-').replace(/&.*/, ''));
  await page.locator('.anz-ia', { hasText: 'Milch' }).click(); await page.waitForTimeout(300);
  console.log('G wer:', (await page.locator('#sheet-root .bogen').innerText()).replace(/\n+/g, ' | '));
  await page.screenshot({ path: '/tmp/vorschau_wer.png' });
  await page.locator('#sheet-root [data-action="anz-wer"][data-id="p4"]').click(); await page.waitForTimeout(300);
  await tippe(page, '1122');
  const added = (await calls(page, 'ep_shopping')).flat().pop();
  console.log('G gemeldet von:', added && added.added_by);
  console.log('G Ist alle:', added && `${added.label} ${added.trip} ${added.week_start} manual=${added.manual}`, '|', await toastText(page), '| Knopf:', await page.locator('.anz-ia', { hasText: 'Milch' }).innerText());
  await page.locator('.anz-ia', { hasText: 'Milch' }).click(); await page.waitForTimeout(200);
  console.log('G zweimal:', await toastText(page));
  await page.locator('[data-action="anz-ist-alle-mehr"]').click(); await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/vorschau_istalle.png' });
  await page.fill('#sheet-root [name=was]', 'Backpapier'); await page.locator('#sheet-root form[data-form="anz-ist-alle"] button').click(); await page.waitForTimeout(300);
  await page.locator('#sheet-root [data-action="anz-wer"][data-id="p1"]').click(); await page.waitForTimeout(300);
  await tippe(page, '2468');
  console.log('G anderes:', (await calls(page, 'ep_shopping')).flat().pop().added_by, (await calls(page, 'ep_shopping')).flat().pop().label, '|', await toastText(page));
  if (await page.locator('#sheet-root [data-action="zu"]').count()) { await page.locator('#sheet-root [data-action="zu"]').click(); await page.waitForTimeout(200); }
  await page.locator('[data-action="anz-wie"][data-id="p2"]').click(); await page.waitForTimeout(300);
  console.log('G Mama ohne PIN:', await toastText(page));
  await page.locator('[data-action="anz-wie"][data-id="p4"]').click(); await page.waitForTimeout(300);
  await tippe(page, '1357');
  console.log('G falsche PIN:', await page.locator('#sheet-root .fehler').innerText().catch(() => '-'));
  await tippe(page, '1122');
  await page.screenshot({ path: '/tmp/vorschau_sterne.png' });
  await page.locator('#sheet-root [data-action="anz-stern"][data-n="4"]').click(); await page.waitForTimeout(300);
  const rt = (await calls(page, 'ep_ratings')).flat().pop();
  console.log('G Bewertung:', rt && `${rt.person_id} ${rt.stars} ${rt.day} ${rt.dish_id}`, '|', await toastText(page), '|', (await page.locator('.anz-wie').innerText()).replace(/\n+/g, ' '));
  await page.screenshot({ path: '/tmp/vorschau_bewertet.png' });
  console.log('G Fehler:', errs); await ctx.close();
}
// H: Kassenzettel mit vier 48-Megapixel-Fotos: werden einzeln verkleinert und kommen nicht leer an.
if (fs.existsSync('/tmp/gross48mp.jpg')) {
  const { page, ctx, errs } = await open(base(), 0);
  await page.locator('[data-tab="ausgaben"]').click(); await page.waitForTimeout(300);
  const t0 = Date.now();
  await page.setInputFiles('#beleg-foto', ['/tmp/gross48mp.jpg', '/tmp/gross48mp.jpg', '/tmp/gross48mp.jpg', '/tmp/gross48mp.jpg']);
  await page.waitForFunction(() => window.calls.some((c) => c[0] === 'invoke' && c[2].action === 'kassenzettel'), null, { timeout: 60000 });
  const inv = await page.evaluate(() => window.calls.filter((c) => c[0] === 'invoke' && c[2].action === 'kassenzettel').pop()[2]);
  console.log('H Fotos:', inv.n, '| Base64-Längen:', inv.len.join(', '), '| alle unter 5 MB:', inv.len.every((x) => x > 2000 && x < 5e6), '| Zeit', Math.round((Date.now() - t0) / 1000), 's');
  console.log('H Fehler:', errs); await ctx.close();
}
// I: Schule: Philip aus dem Stundenplan im Lernplaner, Julia mit OGTS, früher aus, Display
{
  const TT = { times: [['08:00','08:45'],['08:45','09:30'],['09:45','10:30'],['10:30','11:15'],['11:30','12:15'],['12:15','13:00'],['13:00','13:45'],['13:45','14:30'],['14:30','15:15'],['15:15','16:00']], ab: true, refWeek: '2026-11-16', refType: 'B', A: {}, B: { 1: ['G','D','D','L','NuT','G'], 2: ['L','M','I','E','Sp','Sp','','Bl','Bl'], 4: ['L','L','M','NuT','E','Mu','','Ku','Ku'], 5: ['D','Geo','Mu','E','M'] } };
  const mkI = (frueher) => {
    const db = base();
    db.ep_persons = db.ep_persons.map((p) => ({ ...p, name: { p1: 'Papa', p2: 'Mama', p3: 'Philip', p4: 'Julia' }[p.id] }));
    db.lp_stand = [{ kind_id: 'p3', siege_woche: 0, siegziel: 4 }]; db.lp_erledigt_heute = [];
    db.lp_data = [{ coll: 'timetable', data: TT }, { coll: 'schoolEnd', data: { 1: '13:00', 2: '15:30', 3: '13:00', 4: '13:00', 5: '12:15' } }];
    db.ep_settings = [{ key: 'kalender', value: { feeds } }, { key: 'schule', value: { kinder: { p4: { quelle: 'eigen', weg: 20, tage: { 1: { bis: '11:20', ogts: '' }, 2: { bis: '12:15', ogts: '16:00' }, 3: { bis: '11:20', ogts: '' }, 4: { bis: '12:15', ogts: '16:00' }, 5: { bis: '11:20', ogts: '' } } } }, ...(frueher ? { frueher } : {}) } }];
    return db;
  };
  // Display am Do 19.11.: Philip 9 Stunden (bis 14:30) plus 30, Julia OGTS bis 16:00 plus 20
  const d1 = await openDisplay(mkI(null), 1133, 744, { ...KAL, tage: {} }, { stunde: 7, minute: 10, tag: '2026-11-19' });
  await d1.page.waitForTimeout(600);
  console.log('I Display Do:', (await d1.page.locator('.anz-heute').innerText()).replace(/\n+/g, ' | '), '| Höhe', await d1.page.evaluate(() => document.documentElement.scrollHeight));
  await d1.page.screenshot({ path: '/tmp/schule_display.png' });
  console.log('I Fehler:', d1.errs); await d1.ctx.close();
  const d2 = await openDisplay(mkI({ '2026-11-19': { p4: '11:20' } }), 1133, 744, { ...KAL, tage: {} }, { stunde: 7, minute: 10, tag: '2026-11-19' });
  await d2.page.waitForTimeout(600);
  console.log('I früher aus:', (await d2.page.locator('.anz-heim').allInnerTexts()).join(' | ').replace(/\n+/g, ' / '));
  await d2.ctx.close();
  // Vorbei ist vorbei: um 17:10 fehlen Werkstatt, Turnen und die Heimkehr, Ganztägiges und Späteres bleibt
  const KALJ = { ...KAL, tage: { '2026-11-19': [
    { titel: 'Englisch Ex', von: null, bis: null, ganztags: true, kalender: 'k3' },
    { titel: 'Werkstatt', von: '10:30', bis: '10:30', ganztags: false, zeit: true, kalender: 'k1' },
    { titel: 'Turnen', von: '15:30', bis: '17:00', ganztags: false, zeit: true, kalender: 'k1' },
    { titel: 'Training D1', von: '17:00', bis: '18:30', ganztags: false, zeit: true, kalender: 'k3' },
    { titel: 'Nachtdienst', von: '16:00', bis: null, ganztags: false, zeit: true, weiter: true, kalender: 'k1' }] } };
  for (const [hh, mm] of [[7, 10], [16, 20], [17, 10], [23, 30]]) {
    const dj = await openDisplay(mkI(null), 1133, 744, KALJ, { stunde: hh, minute: mm, tag: '2026-11-19' });
    await dj.page.waitForTimeout(600);
    console.log(`J ${hh}:${mm}:`, (await dj.page.locator('.anz-heute').innerText()).split('Morgen,')[0].replace(/\n+/g, ' | '));
    await dj.ctx.close();
  }
  // Einstellungen am Handy
  const ph = await open(mkI(null), 0);
  await ph.page.locator('[data-tab="woche"]').click(); await ph.page.waitForTimeout(400);
  console.log('I Kachel:', (await ph.page.locator('.plan-kachel[data-action="schule"]').innerText()).replace(/\n+/g, ' / '));
  await ph.page.locator('.plan-kachel[data-action="schule"]').click(); await ph.page.waitForTimeout(400);
  console.log('I Kachel/Bogen:', (await ph.page.locator('#sheet-root .bogen').innerText()).replace(/\n+/g, ' | ').slice(0, 500));
  await ph.page.screenshot({ path: '/tmp/schule_bogen.png', fullPage: true });
  await ph.page.selectOption('#sheet-root form[data-form=frueher] [name=kind]', 'p3');
  await ph.page.fill('#sheet-root form[data-form=frueher] [name=tag]', '2026-11-20');
  await ph.page.fill('#sheet-root form[data-form=frueher] [name=zeit]', '11:15');
  await ph.page.locator('#sheet-root form[data-form=frueher] button').click(); await ph.page.waitForTimeout(400);
  console.log('I eingetragen:', await toastText(ph.page));
  const st = (await calls(ph.page, 'ep_settings')).flat().filter((r) => r.key === 'schule').pop();
  console.log('I gespeichert:', JSON.stringify(st && st.value.frueher));
  const f4 = ph.page.locator('#sheet-root form[data-form=schule][data-id=p4]');
  await f4.locator('[name="ogts-5"]').fill('14:00'); await f4.locator('button').click(); await ph.page.waitForTimeout(300);
  const st2 = (await calls(ph.page, 'ep_settings')).flat().filter((r) => r.key === 'schule').pop();
  console.log('I Julia Fr:', JSON.stringify(st2.value.kinder.p4.tage[5]), JSON.stringify(st2.value.frueher));
  console.log('I Fehler Handy:', ph.errs); await ph.ctx.close();
}
// K: Neue Version auf dem Display: lädt von selbst neu, aber nicht während jemand seine PIN eingibt
{
  const { createHash } = await import('node:crypto');
  const db = base(); db.ep_persons = db.ep_persons.map((p) => (p.id === 'p3' ? { ...p, pin_hash: createHash('sha256').update('essensplan|p3|1357').digest('hex') } : p));
  const { page, ctx, errs } = await openDisplay(db, 1024, 768);
  let loads = 0; page.on('load', () => { loads += 1; });
  const melden = () => page.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'neue-version' } })));
  await page.locator('[data-action="anz-kind"][data-id="p3"]').click(); await page.waitForTimeout(300);
  await melden(); await page.waitForTimeout(800);
  console.log('K mit offenem PIN-Feld neu geladen:', loads, '| Banner:', await page.locator('#neue-version').count());
  await page.locator('#sheet-root [data-action="zu"]').click(); await page.waitForTimeout(200);
  await page.evaluate(() => { window.__vorher = 1; });
  await melden(); await page.waitForTimeout(1500);
  console.log('K ohne Eingabe neu geladen:', loads, '| alte Seite weg:', await page.evaluate(() => window.__vorher === undefined));
  console.log('K Fehler:', errs); await ctx.close();
}
// L: „Heute Abend für morgen“ abhaken und löschen, Display zeigt nur Offenes
{
  const db = base();
  db.ep_plan = db.ep_plan.map((p) => (p.day === '2026-11-19' ? { ...p, prep: 'Hähnchen aus dem Gefrierfach nehmen.' } : p));
  const d19 = db.ep_plan.find((p) => p.day === '2026-11-19');
  db.ep_dishes = db.ep_dishes.map((d) => (d.id === d19.dish_id ? { ...d, prep: 'Linsen über Nacht einweichen.' } : d));
  const { page, ctx, errs } = await open(db, 0);
  await page.locator('[data-tab="woche"]').click(); await page.waitForTimeout(300);
  const box = () => page.locator('.vorabend').first().innerText().then((t) => t.replace(/\n+/g, ' | '));
  console.log('L vorher:', await box());
  await page.locator('[data-action="vorabend-haken"]').first().click(); await page.waitForTimeout(300);
  console.log('L abgehakt:', await box(), '| an:', await page.locator('.vorabend-liste li.erledigt').count());
  await page.locator('[data-action="vorabend-weg"]').nth(1).click(); await page.waitForTimeout(300);
  console.log('L gelöscht:', await box(), '|', await toastText(page));
  const st = (await calls(page, 'ep_settings')).flat().filter((r) => r.key === 'vorabend').pop();
  console.log('L gespeichert:', JSON.stringify(st && st.value));
  await page.locator('.vorabend').first().screenshot({ path: '/tmp/vorabend.png' });
  console.log('L Fehler:', errs); await ctx.close();
}
// M: Zettel, Kochen am Display, zum Essen rufen, Nachfrage bei mittleren Noten
{
  const { createHash } = await import('node:crypto');
  const mkM = () => {
    const db = base();
    db.ep_persons = db.ep_persons.map((p) => ({ ...p, name: { p1: 'Papa', p2: 'Mama', p3: 'Philip', p4: 'Julia' }[p.id], ...(p.id === 'p4' ? { pin_hash: createHash('sha256').update('essensplan|p4|1122').digest('hex') } : {}) }));
    db.ep_settings = [{ key: 'zettel', value: [{ id: 'z1', text: 'Paket ist beim Nachbarn (Hausnummer 12)', by: 'p2', at: '2026-11-18T09:00:00Z', bis: '2026-11-18' }, { id: 'z2', text: 'Julia heute bei Oma, kommt um 19 Uhr', by: 'p1', at: '2026-11-18T10:00:00Z', bis: '2026-11-19' }, { id: 'z3', text: 'Alt', by: 'p1', at: '2026-11-10T10:00:00Z', bis: '2026-11-11' }] }];
    return db;
  };
  for (const [w, h] of [[1133, 744], [744, 1133]]) {
    const { page, ctx, errs } = await openDisplay(mkM(), w, h, KAL, { stunde: 17, minute: 40 });
    const r = await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight]);
    console.log(`M ${w}x${h}: Zettel ${await page.locator('.zettel').count()}, Knöpfe ${await page.locator('.anz-aktionen button').allInnerTexts()}, Höhe ${r[0]} von ${r[1]}${r[0] > r[1] ? ' ZU HOCH' : ''}`);
    await page.screenshot({ path: `/tmp/m_${w}.png` });
    if (w === 1133) {
      await page.locator('[data-action="anz-essen-ruf"][data-art="jetzt"]').click(); await page.waitForTimeout(400);
      const inv = await page.evaluate(() => window.calls.filter((c) => c[0] === 'invoke' && c[2].action === 'essen-ruf').pop());
      console.log('M gerufen:', JSON.stringify(inv && inv[2]), '|', await toastText(page));
      await page.locator('.zettel:not(.zettel-duell)').first().click(); await page.waitForTimeout(300);
      console.log('M Zettel offen:', (await page.locator('#sheet-root .bogen').innerText()).replace(/\n+/g, ' | ').slice(0, 160));
      await page.locator('#sheet-root [data-action="zettel-weg"]').click(); await page.waitForTimeout(300);
      const z = (await calls(page, 'ep_settings')).flat().filter((x) => x.key === 'zettel').pop();
      console.log('M abgenommen:', JSON.stringify(z && z.value.map((x) => x.id)), '| Zettel jetzt:', await page.locator('.zettel:not(.zettel-duell)').count());
      const kb = page.locator('[data-action="anz-kochen"]');
      if (await kb.count()) {
        await kb.click(); await page.waitForTimeout(300);
        await page.locator('#sheet-root [data-action="koch-schritt"][data-dir="1"]').click(); await page.waitForTimeout(300);
        await page.screenshot({ path: '/tmp/m_kochen.png' });
        console.log('M Kochen:', (await page.locator('#sheet-root .bogen').innerText()).replace(/\n+/g, ' | ').slice(0, 200));
      }
    }
    console.log(`M Fehler ${w}:`, errs); await ctx.close();
  }
  // Nach dem Essen am Display: Julia gibt 3 Sterne, dann die Nachfrage
  const { page, ctx, errs } = await openDisplay(mkM(), 1133, 744, KAL, { stunde: 19, minute: 40 });
  await page.locator('[data-action="anz-wie"][data-id="p4"]').click(); await page.waitForTimeout(300);
  for (const z of '1122') await page.locator(`#sheet-root [data-action="anz-ziffer"][data-z="${z}"]`).click();
  await page.waitForTimeout(400);
  await page.locator('#sheet-root [data-action="anz-stern"][data-n="3"]').click(); await page.waitForTimeout(400);
  console.log('M Nachfrage:', (await page.locator('#sheet-root .bogen').innerText()).replace(/\n+/g, ' | ').slice(0, 220));
  await page.locator('#sheet-root .chip-wahl', { hasText: 'zu scharf' }).click();
  await page.fill('#sheet-root [name=zutat]', 'Pilze');
  await page.screenshot({ path: '/tmp/m_warum.png' });
  await page.locator('#sheet-root form[data-form=warum] button.knopf').first().click(); await page.waitForTimeout(400);
  const n = (await calls(page, 'ep_settings')).flat().filter((x) => x.key === 'rezept_notizen').pop();
  console.log('M Notiz:', JSON.stringify(n && n.value), '|', await toastText(page));
  console.log('M Fehler:', errs); await ctx.close();
  // Am Handy: Zettel aufhängen
  const ph = await open(mkM(), 3);
  await ph.page.locator('[data-tab="woche"]').click(); await ph.page.waitForTimeout(300);
  await ph.page.locator('.plan-kachel[data-action="zettel"]').click(); await ph.page.waitForTimeout(300);
  await ph.page.fill('#sheet-root [name=text]', 'Bin beim Training, komme 19 Uhr'); await ph.page.selectOption('#sheet-root [name=dauer]', '0');
  await ph.page.locator('#sheet-root form[data-form=zettel] button').click(); await ph.page.waitForTimeout(300);
  const zz = (await calls(ph.page, 'ep_settings')).flat().filter((x) => x.key === 'zettel').pop();
  console.log('M Handy Zettel:', JSON.stringify(zz && zz.value.slice(-1)), '|', await toastText(ph.page));
  console.log('M Fehler Handy:', ph.errs); await ph.ctx.close();
  const ph2 = await open(mkM(), 0);
  await ph2.page.locator('[data-tab="woche"]').click(); await ph2.page.waitForTimeout(300);
  const st = ph2.page.locator('[data-action="stern"][data-n="2"]').first();
  if (await st.count()) {
    await st.click(); await ph2.page.waitForTimeout(400);
    console.log('M Handy 2 Sterne:', await ph2.page.locator('#sheet-root .bogen').count() ? (await ph2.page.locator('#sheet-root .bogen h2, #sheet-root .bogen .titel').first().innerText().catch(() => 'Bogen offen')) : 'keine Nachfrage');
    await ph2.page.locator('#sheet-root [data-action="zu"]').first().click().catch(() => {}); await ph2.page.waitForTimeout(200);
    await ph2.page.locator('[data-action="stern"][data-n="5"]').first().click(); await ph2.page.waitForTimeout(300);
    console.log('M Handy 5 Sterne, Nachfrage:', await ph2.page.locator('#sheet-root form[data-form=warum]').count());
  } else console.log('M Handy: keine Sterne sichtbar');
  console.log('M Fehler Handy 2:', ph2.errs); await ph2.ctx.close();
}
await b.close(); srv.close();
