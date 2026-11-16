import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = ROOT;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); fs.readFile(f, (e, d) => { r.writeHead(e?404:200, {'Content-Type': T[path.extname(f)]||'text/plain'}); r.end(d); }); }).listen(8815);
const run = JSON.parse(fs.readFileSync(ROOT + '/tests/run.json', 'utf8'));
const { SEED } = await import(ROOT + '/js/seed.js');
const db = { ep_persons: SEED.persons.map(p => p.adult ? { ...p, pin_hash: null } : p), ep_dishes: SEED.dishes, ep_plan: SEED.plan, ep_shopping: [...SEED.shopping, {id:'n1',week_start:'2026-11-23',trip:'Großeinkauf',due:'2026-11-21',category:'obst',label:'Lauch',qty:'2',sort:1,checked:true,manual:false}, {id:'n2',week_start:'2026-11-23',trip:'Großeinkauf',due:'2026-11-21',category:'obst',label:'Äpfel',qty:'1 kg',sort:2,checked:false,manual:false}, {id:'n3',week_start:'2026-11-23',trip:'Einkauf',due:null,category:'sonst',label:'Backpapier',qty:'aus KW 47',sort:3,checked:false,manual:true}], ep_tasks: SEED.tasks, ep_pantry: SEED.pantry, ep_ai_runs: [run], ep_settings: [] };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.ESSENSPLAN_CONFIG={supabaseUrl:'https://abcdefghijkl.supabase.co',supabaseKey:'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',vapidPublicKey:''};` }));
await ctx.addInitScript((db) => {
  globalThis.ESSENSPLAN_HEUTE = '2026-11-20';
  window.calls = []; window.__db = db;
  const q = (table) => { const api = { select() { return api; }, order() { return api; }, range() { return Promise.resolve({ data: window.__db[table] || [], error: null }); },
    upsert(rows) { window.calls.push(['upsert', table, JSON.parse(JSON.stringify(rows))]); return Promise.resolve({ error: null }); },
    delete() { const d = { eq() { return Object.assign(Promise.resolve({ error: null }), d); }, in(c, v) { window.calls.push(['delete', table, v.length]); return Promise.resolve({ error: null }); } }; return d; } }; return api; };
  window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: {} } }, error: null }), signOut: async () => {} }, from: q,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    functions: { invoke: async (n, o) => { window.calls.push(['invoke', n, o.body]); return { data: { id: 'neu' }, error: null }; } } }) };
}, db);
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8815/?entwurf=' + run.id + '#woche'); await page.waitForTimeout(1200);
await page.locator('[data-action="ich"]').first().click(); await page.waitForTimeout(400);
await page.fill('[name=pin1]', '1234'); await page.fill('[name=pin2]', '1234'); await page.click('#sheet-root button.knopf'); await page.waitForTimeout(700);
console.log('Fehler früh:', errs, page.url(), await page.locator('button.ich').innerText().catch(()=>'-'), (await page.locator('body').innerText()).slice(0,200).replace(/\n/g,' / ')); console.log('Banner:', await page.locator('.entwurf-kasten').count(), (await page.locator('#app').innerText()).slice(0,300).replace(/\n/g,' / ')); console.log('Bogen:', (await page.locator('#sheet-root').innerText()).split('\n').slice(0, 8).join(' | '));
await page.screenshot({ path: 'k_entwurf.png' });
await page.waitForTimeout(3500);
const c0 = await page.evaluate(() => window.calls.splice(0).map(c => c[1] + (c[1] === 'ep_settings' ? ':' + c[2][0].key + ' ' + JSON.stringify(c[2][0].value).length : '')));
console.log('Abgleich:', c0.join(', '));
// Tausch Samstag gegen Burger, Wunsch, Freigeben
await page.selectOption('#sheet-root select[name="d_2026-11-28"]', 'Burger mit selbst gebackenen Brötchen und Kartoffelspalten');
await page.fill('#sheet-root [data-form=entwurf] [name=wunsch]', 'Mehr Suppen');
await page.locator('#sheet-root [data-form=entwurf] button.breit').click(); await page.waitForTimeout(800);
console.log('Vorschau:', (await page.locator('#sheet-root').innerText()).replace(/\n+/g,' | ').slice(0,600)); await page.screenshot({ path: 'v_entwurf.png' }); await page.locator('#sheet-root [data-action="vorschau-ok"]').click(); await page.waitForTimeout(800);
console.log('Toast:', await page.locator('#toast').innerText());
const c1 = await page.evaluate(() => window.calls.splice(0).map(c => c[0] + ' ' + c[1] + ' ' + (Array.isArray(c[2]) ? c[2].length + ' ' + (c[1] === 'ep_ai_runs' ? c[2][0]?.status ?? c[2].status : c[1] === 'ep_settings' ? c[2][0].key : '') : (c[2] && c[2].status) || c[2])));
console.log('Gespeichert:', c1.join(' | '));
console.log('Woche:', (await page.locator('#app').innerText()).split('\n').filter(l => /Kabeljau|Burger|Linsen-Bolognese|KW/.test(l)).slice(0, 5).join(' | '));
await page.click('.tab[data-tab="einkauf"]'); await page.waitForTimeout(300);
console.log('Einkauf:', (await page.locator('#app').innerText()).split('\n').filter(l => /einkauf am|Großeinkauf|erledigt/.test(l)).slice(0, 4).join(' | '));
await page.click('.tab[data-tab="gerichte"]'); await page.waitForTimeout(300);
console.log('Karte:', (await page.locator('.planer').innerText()).replace(/\n/g, ' | '));
console.log('Neue Gerichte in Sammlung:', await page.locator('.g-zeile', { hasText: 'Kabeljau' }).count(), await page.locator('.g-zeile', { hasText: 'Linsen-Bolognese-Lasagne' }).count());
await page.click('[data-action="planer-regeln"]'); await page.waitForTimeout(300);
await page.fill('#sheet-root [name=ausschluesse]', 'Brokkoli\nRosenkohl\nVollkornnudeln\nOfenlachs\nRosinen');
await page.fill('#sheet-root [name=neue_rezepte]', '3');
await page.locator('#sheet-root [data-form=regeln] button').click(); await page.waitForTimeout(400);
console.log('Regeln:', JSON.stringify((await page.evaluate(() => window.calls.splice(0)))[0][2][0].value).slice(0, 160));
await page.click('[data-action="planer-start"]'); await page.waitForTimeout(600);
console.log('Start:', await page.locator('#sheet-root').innerText().catch(() => ''), '|', JSON.stringify(await page.evaluate(() => window.calls.filter(c => c[0] === 'invoke'))));
await page.screenshot({ path: 'k_karte.png' });
console.log('Fehler:', errs);
await b.close(); srv.close();
