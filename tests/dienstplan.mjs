// Dienstplan als „nur fürs Essen“: keine Dienste am Display außer Rufdiensten, Zeiten zählen fürs Essen, Titel bleiben privat.
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8861);
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
    storage: { from: () => ({ list: async () => ({ data: [{ name: 'familienplan-2026-11-15-0300.json', metadata: { size: 48213 } }, { name: 'familienplan-2026-11-08-0300.json', metadata: { size: 47001 } }], error: null }), download: async (n) => ({ data: new Blob(['{}'], { type: 'application/json' }), error: null }) }) }, functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, { action: o.body.action, n: (o.body.photos || []).length, len: (o.body.photos || []).map(p => p.data.length) }]); await new Promise(r => setTimeout(r, 400)); if (o.body.action === 'pv' && window.PV) return { data: { ...window.PV, stand: new Date().toISOString() }, error: null }; if (o.body.action === 'kalender') { window.kalCalls = (window.kalCalls || 0) + 1; window.kalTage = o.body.tage; return { data: window.KAL || { stand: '', tage: {}, feeds: [] }, error: null }; } if (o.body.action === 'mittag') { window.lastMittag = o.body.mittag; return { data: { mittag: [{ name: 'Rührei mit Spinat', minuten: 10, warum: 'Eiweiß und Gemüse.', zutaten: [{ menge: '4 Stück', name: 'Eier', da: true }, { menge: '100 g', name: 'Feta', da: false }], schritte: ['Eier verquirlen.', 'Braten.'], reste: [] }] }, error: null }; } if (o.body.action === 'kosten') { const ds = window.__db.ep_dishes; return { data: { kosten: { stand: '2026-11-18', kassenzettel: 2, gerichte: Object.fromEntries(ds.map((x, i) => [x.id, 6 + (i * 1.7) % 14])) } }, error: null }; } if (o.body.action === 'fest') { const m = await import('/js/planer.js'); return { data: { fest: m.demoFeast(o.body.fest) }, error: null }; } if (o.body.action === 'ersatz') return { data: { ersatz: { vorschlaege: [{ name: 'Kabeljaufilet TK', menge: '600 g', warum: 'Mild und fest.' }, { name: 'Alaska-Seelachs TK', menge: '600 g', warum: 'Sehr ähnlich.' }], rezept_hinweis: 'Am Vorabend im Kühlschrank auftauen und trocken tupfen.' } }, error: null }; if (o.body.action === 'sicherung') return { data: { name: 'x', anzahl: { ep_dishes: 16, ep_plan: 20 } }, error: null }; if (o.body.action === 'kassenzettel') return { data: { beleg: { markt: 'Aldi Süd', datum: '2026-11-18', summe: 14.10, hinweis: 'Eine Zeile war schwer lesbar.', posten: [ { text: 'BIO HAEHN.BR.FIL', name: 'Bio-Hähnchenbrustfilet', preis: 7.99, kategorie: 'Fleisch und Fisch' }, { text: 'SALATGURKE', name: 'Salatgurke', preis: 0.69, kategorie: 'Obst und Gemüse' }, { text: 'SPUELMASCH.TABS', name: 'Spülmaschinentabs', preis: 3.95, kategorie: 'Sonstiges' }, { text: 'PFAND', name: 'Pfand', preis: 0.25, kategorie: 'Pfand und Rabatt' } ] } }, error: null }; return { data: {}, error: null }; } } }) };
};
async function open(db, who, kal) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  if (kal) await ctx.addInitScript((k) => { window.KAL = k; }, kal);
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
  await ctx.addInitScript(INIT, db);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8861/#woche'); await page.waitForTimeout(1200);
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
  if (opts.pv) await ctx.addInitScript((v) => { window.PV = v; }, opts.pv);
  await ctx.addInitScript((k) => { window.KAL = k; if (globalThis.ESSENSPLAN_HEUTE_X) globalThis.ESSENSPLAN_HEUTE = globalThis.ESSENSPLAN_HEUTE_X; }, kal);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8861/?anzeige=kueche'); await page.waitForTimeout(2200);
  return { page, ctx, errs };
}

const FEEDS = [{ id: 'ar', name: 'Arbeit', url: 'webcal://p195-caldav.icloud.com/published/2/ARBEIT', person_id: 'p1', anzeige: false }];
const KALA = { stand: '2026-11-18T10:00:00Z', feeds: [{ id: 'ar', ok: true, anzahl: 6 }], tage: {
  '2026-11-18': [{ titel: 'Rufdienst', von: null, bis: null, ganztags: true, kalender: 'ar' }, { titel: 'OA Intensiv', von: '07:00', bis: '15:30', ganztags: false, zeit: true, kalender: 'ar' }],
  '2026-11-19': [{ titel: 'Rufdienst ITS', von: null, bis: null, ganztags: true, kalender: 'ar' }, { titel: 'Notarzt NEC', von: '08:00', bis: '20:00', ganztags: false, zeit: true, kalender: 'ar' }],
  '2026-11-20': [{ titel: 'Rufdienst', von: null, bis: null, ganztags: true, kalender: 'ar' }, { titel: 'Weiterbildungsgespräch Max Muster', von: '14:00', bis: '14:30', ganztags: false, zeit: true, kalender: 'ar' }],
  '2026-11-21': [{ titel: 'Notarzt NEC', von: '20:00', bis: null, ganztags: false, zeit: true, weiter: true, kalender: 'ar' }],
} };
const db = () => { const d = base(); d.ep_settings = [{ key: 'kalender', value: { feeds: FEEDS } }]; return d; };
{
  const { page, ctx, errs } = await openDisplay(db(), 1133, 744, KALA);
  console.log('A heute:', (await page.locator('.anz-termine').first().innerText().catch(() => '-')).replace(/\n+/g, ' | '));
  console.log('A Seite enthält Dienst-Titel:', /OA Intensiv|Notarzt|Weiterbildung/.test(await page.locator('body').innerText()));
  await page.screenshot({ path: 'dienst_display.png' });
  console.log('A Fehler:', errs); await ctx.close();
}
{
  const { page, ctx, errs } = await openDisplay(db(), 1133, 744, KALA, { tag: '2026-11-19' });
  const t = (await page.locator('body').innerText()).replace(/\n+/g, ' | ');
  console.log('B Notarzt-Tag:', (t.match(/Heute Abend.{0,160}/) || [''])[0]);
  console.log('B Rufdienst ITS am Display:', t.includes('Rufdienst ITS'), '| Titel sichtbar:', /Notarzt/.test(t));
  console.log('B Fehler:', errs); await ctx.close();
}
{
  const { page, ctx, errs } = await open(db(), 0, KALA);
  await page.evaluate(() => { location.hash = '#woche'; }); await page.waitForTimeout(5000);
  const kk = (await page.evaluate(() => window.calls.filter((c) => c[0] === 'upsert' && c[1] === 'ep_settings').flatMap((c) => c[2]).filter((r) => r.key === 'ki_kontext').map((r) => r.value))).pop();
  if (kk) {
    console.log('C Tage:', kk.tage.slice(0, 3).map((x) => `${x.tag} essen ${x.essen} esser ${x.esser} kurz ${x.kurz} ruf ${JSON.stringify(x.rufdienst)}`).join(' / '));
    console.log('C Titel bei Claude:', JSON.stringify(kk).match(/Notarzt|Weiterbildung|Max Muster|OA Intensiv/g) || 'keine', '| Termine:', JSON.stringify((kk.auswertung.termine || []).slice(0, 3)));
  } else console.log('C kein Kontext geschrieben');
  await page.locator('[data-action="familie"]').click().catch(() => {}); 
  console.log('C Fehler:', errs); await ctx.close();
}
{
  const { page, ctx, errs } = await openDisplay(db(), 1133, 744, KALA, { tag: '2026-11-21' });
  const t = (await page.locator('body').innerText()).replace(/\n+/g, ' | ');
  console.log('D 24-Stunden-Dienst ab 20 Uhr:', (t.match(/Heute Abend.{0,140}/) || [''])[0], '| Fehler:', errs); await ctx.close();
}
{
  // Nachtruhe: 2 Uhr schwarz, ein Tipp zeigt das Display, 6 Uhr wieder normal.
  const n = await openDisplay(db(), 1133, 744, KALA, { stunde: 2, minute: 10 });
  console.log('N 2 Uhr:', await n.page.locator('.anz-nacht').count(), '| Text:', JSON.stringify((await n.page.locator('body').innerText()).trim().slice(0, 20)), '| Klasse:', await n.page.evaluate(() => document.documentElement.classList.contains('anzeige-nacht')));
  await n.page.locator('.anz-nacht').click(); await n.page.waitForTimeout(300);
  console.log('N nach Tipp:', await n.page.locator('.anz-nacht').count(), '| Uhr sichtbar:', await n.page.locator('.anz-blatt').count());
  console.log('N Fehler:', n.errs); await n.ctx.close();
  const m = await openDisplay(db(), 1133, 744, KALA, { stunde: 6, minute: 0 });
  console.log('N 6 Uhr:', await m.page.locator('.anz-nacht').count(), await m.page.locator('.anz-blatt').count()); await m.ctx.close();
}
{
  // Strompreis: Viertelstunden für heute und morgen, Kurve unten in der Terminspalte.
  const preise = [];
  for (let i = 0; i < 192; i += 1) {
    const ms = Date.parse('2026-11-17T23:00:00Z') + i * 900000; const h = new Date(ms).getUTCHours() + 1;
    const ct = 22 + 8 * Math.sin(((h % 24) - 13) / 24 * 2 * Math.PI + Math.PI) + (h % 24 >= 17 && h % 24 <= 20 ? 6 : 0);
    preise.push({ t: new Date(ms).toISOString(), p: Math.round(ct * 100) / 10000 });
  }
  const d = db(); d.ep_settings = [...d.ep_settings, { key: 'strompreis', value: { tag: '2026-11-18', stand: '2026-11-18T12:00:00Z', morgen: true, preise } }];
  for (const [w, h] of [[1133, 744], [744, 1133]]) {
    const o = await openDisplay(d, w, h, KALA, { stunde: 17, minute: 40, pv: { sonne: 3.2, haus: 0.9, netz: -1.4, speicher: 85 } });
    const box = (await o.page.locator('.anz-pv').innerText().catch(() => 'kein PV')) + ' || ' + await o.page.locator('.anz-strom').innerText().catch(() => '-');
    const fit = await o.page.evaluate(() => [document.documentElement.scrollHeight, innerHeight]);
    console.log(`S ${w}x${h}:`, box.replace(/\n+/g, ' | '), '| Balken:', await o.page.locator('.anz-strom rect').count(), '| passt:', fit.join(' von '), '| Abruf:', await o.page.evaluate(() => window.calls.filter((c) => c[0] === 'invoke' && c[2].action === 'strompreis').length));
    await o.page.screenshot({ path: `strom_${w}.png` });
    console.log('S Fehler:', o.errs); await o.ctx.close();
  }
}
{
  // Waschmaschine als Ampel am Display und bei den Eltern.
  const d = db(); const jetzt = new Date(Date.now() - 60000).toISOString();
  d.ep_settings = [...d.ep_settings, { key: 'waschmaschine', value: { verbunden: true, name: 'Siemens iQ500', op: 'Run', tuer: 'Locked', stufe: 'gelb', bis: new Date(Date.now() + 45 * 60000).toISOString(), stand: jetzt } }];
  for (const [w, h] of [[1133, 744], [744, 1133]]) {
    const o = await openDisplay(d, w, h, KALA, { stunde: 10, minute: 30 });
    const fit = await o.page.evaluate(() => [document.documentElement.scrollHeight, innerHeight]);
    console.log(`W ${w}:`, (await o.page.locator('.anz-ampeln').innerText().catch(() => '-')).replace(/\n+/g, ' | '), '| passt:', fit.join(' von '), '| Fehler:', o.errs);
    if (w === 1133) await o.page.screenshot({ path: 'wasch_1133.png' });
    await o.ctx.close();
  }
  const p = await open(d, 0, KALA);
  await p.page.evaluate(() => { location.hash = '#aufgaben'; }); await p.page.waitForTimeout(600);
  console.log('W Eltern:', (await p.page.locator('h2:has-text("Waschmaschine") + * , .km-karte:has-text("Siemens")').first().innerText().catch(() => '-')).replace(/\n+/g, ' | ').slice(0, 160), '| Fehler:', p.errs);
  await p.ctx.close();
  const d2 = db(); const p2 = await open(d2, 0, KALA);
  await p2.page.evaluate(() => { location.hash = '#aufgaben'; }); await p2.page.waitForTimeout(600);
  await p2.page.locator('[data-action="hc-verbinden"]').click().catch((e) => console.log('kein Knopf', e.message.slice(0, 60))); await p2.page.waitForTimeout(800);
  console.log('W ohne Secrets:', (await p2.page.locator('.km-karte:has([data-action="hc-verbinden"]), .km-karte:has-text("Supabase")').first().innerText().catch(() => '-')).replace(/\n+/g, ' | ').slice(0, 200), '| Fehler:', p2.errs);
  await p2.ctx.close();
}
{
  // Wetter im Kopf statt Kleidungstipp.
  for (const [w, h, st] of [[1133, 744, 8], [744, 1133, 8], [1133, 744, 17]]) {
    const d = db(); d.ep_settings = [...d.ep_settings, { key: 'zettel', value: [{ id: 'z1', text: 'Paket ist beim Nachbarn', by: 'p2', at: '2026-11-18T08:00:00Z', bis: '2026-11-19' }, { id: 'z2', text: 'Julia heute bei Oma', by: 'p1', at: '2026-11-18T07:00:00Z', bis: '2026-11-18' }] }];
    const o = await openDisplay(d, w, h, KALA, { stunde: st, minute: 10 });
    const fit = await o.page.evaluate(() => [document.documentElement.scrollHeight, innerHeight, document.querySelector('.anz-kopf').scrollWidth, document.querySelector('.anz-kopf').clientWidth]);
    console.log(`R ${w} ${st} Uhr:`, (await o.page.locator('.anz-wetter').innerText().catch(() => '-')).replace(/\n+/g, ' | '), '| Karte:', (await o.page.locator('.anz-essen').innerText()).replace(/\n+/g, ' | ').slice(0, 120), '| passt:', fit.join(' / '), '| Fehler:', o.errs);
    await o.page.screenshot({ path: `wetter_${w}_${st}.png` }); await o.ctx.close();
  }
}
{
  // Wachhalten: stummes Video tagsüber an, nachts aus.
  for (const st of [10, 2]) {
    const o = await openDisplay(db(), 1133, 744, KALA, { stunde: st, minute: 0 });
    const v = await o.page.evaluate(() => { const x = document.querySelector('video'); return x ? { da: true, pausiert: x.paused, stumm: x.muted, inline: x.playsInline } : { da: false }; });
    console.log(`V ${st} Uhr:`, JSON.stringify(v), '| Fehler:', o.errs); await o.ctx.close();
  }
}
await b.close(); srv.close();
