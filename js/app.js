// Oberfläche des Familienplans: Wochenplan, Aufgaben, Einkaufsliste, Gerichte, Bewertungen.

import * as L from './logic.js';
import * as A from './aufgaben.js';
import * as T from './termine.js';
import { ABFUHR, TONNEN, useImported, parseIcs } from './abfuhr.js';
import { SEED_TASKS, SEED } from './seed.js';
import { createStore } from './store.js';
import * as Push from './push.js';
import * as N from './naehrwerte.js';
import * as KI from './planer.js';
import * as HB from './haushalt.js';
import * as P from './packungen.js';
import * as NEU from './neu.js';
import * as RB from './rueckblick.js';

const store = createStore(window.ESSENSPLAN_CONFIG);
const ME_KEY = 'essensplan.ich';
const TESTDAY_KEY = 'essensplan.testdatum';
const NEWS_KEY = 'essensplan.neu-gesehen';
if (store.mode === 'local') {
  const t = readLocal(TESTDAY_KEY);
  if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) globalThis.ESSENSPLAN_HEUTE = t;
}
const FORM_SHEETS = ['shop-admin', 'foto', 'packung', 'packungen', 'zurueckholen', 'vorschau', 'mittag', 'mittag-laden', 'mittag-ergebnis', 'app-wuensche', 'moegen', 'feste', 'fest', 'fest-laden', 'jahr', 'ersatz', 'ersatz-laden', 'reste', 'laufweg', 'kochen', 'preise', 'siri', 'zutaten', 'zutaten-laden', 'rezept-laden', 'rezept-neu', 'beleg', 'beleg-laden', 'haushalt', 'urlaub', 'gericht-form', 'import', 'familie', 'frage', 'pin', 'export', 'einloesen', 'aufgabe-form', 'termin-form', 'vorrat', 'immer', 'regeln', 'entwurf'];
const EPOCH = '1970-01-01T00:00:00Z';
// Küchen-Display: Mit ?anzeige=kueche merkt sich das Gerät, dass es als Anzeige an der Wand hängt (?anzeige=aus beendet).
const DISPLAY_KEY = 'essensplan.anzeige';
let display = (() => {
  try {
    const q = new URLSearchParams(location.search).get('anzeige');
    if (q === 'kueche') localStorage.setItem(DISPLAY_KEY, 'kueche');
    else if (q === 'aus') localStorage.removeItem(DISPLAY_KEY);
    if (q) history.replaceState(null, '', location.pathname + location.hash);
    return localStorage.getItem(DISPLAY_KEY);
  } catch (e) { return null; }
})();

const state = {
  phase: 'laden',            // laden, anmelden, einrichten, wer, app, fehler
  error: '',
  data: { persons: [], dishes: [], plan: [], ratings: [], shopping: [], lunchRatings: [], hearts: [], tasks: [], taskLog: [], events: [], attendance: [], pantry: [], staples: [], settings: [], aiRuns: [], receipts: [] },
  me: readLocal(ME_KEY),
  month: null,
  receiptDraft: null,
  ingredientDraft: null,
  wishEdit: false,
  backups: undefined,
  backupBusy: false,
  cookStep: 0,
  cookChecked: [],
  timers: [],
  substDraft: null,
  feastEdit: null,
  costBusy: false,
  shopMode: false,
  lunchForm: null,
  lunchResult: null,
  tempDishes: {},
  recipeDraft: null,
  tab: 'woche',
  week: L.mondayOf(L.todayISO()),
  sheet: null,
  hideDone: false,
  sort: 'beliebt',
  draft: '',
  stale: false,
  busy: false,
  push: null,               // Stand der Push-Nachrichten auf diesem Gerät
  lp: null,                 // Stand aus dem Lernplaner (lernen.html)
};
let stats = {};
store.bind(() => state.data);
// Netz weg oder wieder da: Hinweis aktualisieren und nach der Rückkehr den Stand neu laden.
let wasOffline = false;
store.onStatus = () => {
  if (state.phase !== 'app') return;
  if (wasOffline && !store.offline) onRemote('all');
  wasOffline = store.offline;
  render();
};

/* ---------- kleine Helfer ---------- */

function readLocal(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function writeLocal(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* ohne Speicher fragt die App beim nächsten Start erneut */ } }
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byDay = (a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0);

const dishById = (id) => state.data.dishes.find((d) => d.id === id);
const planOf = (day) => state.data.plan.find((p) => p.day === day);
const personById = (id) => state.data.persons.find((p) => p.id === id);
// Nur Erwachsene ändern den Plan. Ist niemand als erwachsen markiert, darf jeder alles,
// damit sich die Familie nicht aussperrt.
const isAdult = (p) => !!(p && p.adult);
const canPlan = () => !state.data.persons.some(isAdult) || isAdult(personById(state.me));
// Reiter, die eine Push-Nachricht über die Adresse direkt öffnen kann.
const HASH_TABS = ['woche', 'aufgaben', 'einkauf', 'gerichte', 'ausgaben'];
const ADULT_ACTIONS = new Set(['entwurf-ergaenzen', 'anzeige-an', 'st-heute', 'st-aus', 'shop-verwalten', 'sm-stufe', 'sm-bis', 'rueckblick', 'rueckblick-woche', 'rueckblick-push', 'foto-ok', 'foto-nein', 'km-stufe', 'kinder-sperre', 'sicherung-zurueck', 'vorschau-ok', 'vorschau-zurueck', 'fest-wieder', 'abfuhr', 'kosten-schaetzen', 'app-wunsch-erledigt', 'feste', 'fest', 'fest-bearbeiten', 'fest-liste', 'fest-plan', 'fest-loeschen', 'ersatz', 'ersatz-nehmen', 'sicherungen', 'sicherung-jetzt', 'sicherung-laden', 'siri', 'siri-schluessel', 'rezept-speichern', 'rezept-verwerfen', 'beleg-neu', 'beleg-posten-neu', 'beleg-posten-weg', 'beleg-loeschen', 'haushalt-einstellungen', 'haushalt-standard', 'haushalt-vergessen', 'grund-zuerst', 'grund-bestaetigen', 'fehlt-markt', 'urlaub-weg', 'planer-regeln', 'planer-start', 'entwurf', 'entwurf-verwerfen', 'termin-neu', 'termin-bearbeiten', 'vorrat-start', 'aufgaben-start', 'log-ok', 'log-nein', 'log-alle', 'einloesen', 'aufgaben-liste', 'aufgabe-neu', 'aufgabe-bearbeiten', 'tauschen', 'tag-tausch', 'tag-tausch-mit', 'waehlen', 'woche-fuellen', 'import', 'gericht-neu', 'gericht-bearbeiten', 'aussortieren', 'aufnehmen', 'ausfall', 'liste-bauen']);
const ADULT_FORMS = new Set(['stall', 'shop', 'erinnerungen', 'packung-wahl', 'wochenbonus', 'zurueckholen', 'fest', 'beleg', 'haushalt', 'urlaub', 'gericht', 'import', 'einloesen', 'aufgabe', 'termin', 'einkaufstag', 'vorabend', 'regeln', 'entwurf', 'entwurf-neu']);
const ONLY_ADULTS = 'Das können nur Mama und Papa.';

// Brotbox: bewerten dürfen die Kinder. Gibt es keine Erwachsenen, alle.
const lunchOf = (day) => { const p = planOf(day); return p && p.lunchbox ? p.lunchbox : ''; };
const lunchRaters = () => {
  const kids = state.data.persons.filter((p) => !isAdult(p));
  return kids.length && state.data.persons.some(isAdult) ? kids : state.data.persons;
};
const canRateLunch = () => lunchRaters().some((p) => p.id === state.me);
// Herz der Woche: vergeben dürfen dieselben Personen wie bei der Brotbox, also die Kinder.
const myHeart = (week) => state.data.hearts.find((h) => h.week_start === week && h.person_id === state.me);
function heartOptions(week) {
  const today = L.todayISO();
  const seen = new Set();
  return L.weekDays(week).map(planOf).filter((p) => {
    if (!p || !p.dish_id || p.skipped || p.day > today || seen.has(p.dish_id) || !dishById(p.dish_id)) return false;
    seen.add(p.dish_id);
    return true;
  });
}
// Eine Wertung gilt nur für den Brotbox-Text, zu dem sie abgegeben wurde.
const lunchRatingsOf = (day) => { const t = lunchOf(day); return state.data.lunchRatings.filter((r) => r.day === day && r.lunchbox === t); };

/* ---------- PIN der Erwachsenen ---------- */

let pinNext = null;
let pinFails = 0;
let pinLock = 0;
async function pinHash(id, pin) {
  if (!globalThis.crypto || !crypto.subtle) throw new Error('Die PIN lässt sich nur prüfen, wenn die App über https geöffnet ist.');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`essensplan|${id}|${pin}`));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
// Führt onOk aus, wenn die Person kein Erwachsener ist oder die PIN stimmt.
// Kinder dürfen nicht einfach zum anderen Kind wechseln: Ist die Sperre an, braucht der Wechsel die PIN eines Erwachsenen.
const kidLock = () => (KI.settingOf(state.data.settings, 'geraete') || {}).kinder_sperre !== false;
function requirePin(id, onOk) {
  const person = personById(id);
  if (!isAdult(person)) {
    const me = personById(state.me);
    const locked = kidLock() && me && !isAdult(me) && me.id !== id && state.data.persons.some((p) => isAdult(p) && p.pin_hash);
    if (!locked) { onOk(); return; }
    pinNext = onOk;
    openSheet({ type: 'pin', id, mode: 'eltern' });
    return;
  }
  pinNext = onOk;
  openSheet({ type: 'pin', id, mode: person.pin_hash ? 'pruefen' : 'neu' });
}
const myRating = (day) => state.data.ratings.find((r) => r.day === day && r.person_id === state.me);

let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('sichtbar');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('sichtbar'), 4200);
}

function durationText(min) {
  if (!min) return '';
  if (min < 60) return `${min} Minuten`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} Std.${m ? ` ${m} Min.` : ''}`;
}
function metaText(dish) {
  return [durationText(dish.duration_min), L.DISH_CATS[dish.category], dish.favorite ? 'Lieblingsgericht' : '', ...(dish.tags || [])].filter(Boolean).join(', ');
}

const HEART = '<svg class="herz" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.3 4.5 6.8 4.5c2.1 0 3.6 1.2 4.4 2.6h1.6c.8-1.4 2.3-2.6 4.4-2.6 3.5 0 5.4 3.5 4.1 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"/></svg>';
const MINI = '<svg class="mini-stern" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const LEFT = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const RIGHT = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const ICONS = {
  ausgaben: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  aufgaben: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="5" height="5" rx="1"/><path d="M4.8 6.6l1.2 1.2 2-2.2M11.5 6.5H20.5M11.5 15.5H20.5"/><rect x="3.5" y="13" width="5" height="5" rx="1"/></svg>',
  woche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  einkauf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h16l-1.6 9.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8z"/><path d="M8.5 9l3.5-5 3.5 5"/></svg>',
  gerichte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 21v-8M17 13c-2 0-3-2-3-5s1-5 3-5z"/></svg>',
};

function avatar(person, small) {
  if (!person) return '';
  return `<span class="kreis${small ? ' klein' : ''}" style="background:${esc(person.color || '#4F6972')}" aria-hidden="true">${esc((person.name || '?').trim().charAt(0).toUpperCase())}</span>`;
}
function avgHtml(stat) {
  if (!stat || stat.avg == null) return '';
  return `<span class="schnitt">${MINI} ${L.fmtStars(stat.avg)}</span>`;
}

// Rückfrage als eigener Bogen. confirm() ist in manchen Ansichten gesperrt.
let askResolve = null;
function ask(text, ok) {
  return new Promise((resolve) => {
    askResolve = resolve;
    state.sheet = { type: 'frage', text, ok };
    renderSheet();
  });
}
function answer(yes) {
  const r = askResolve;
  askResolve = null;
  state.sheet = null;
  renderSheet();
  if (r) r(yes);
}

/* ---------- Start ---------- */

/* ---------- Neue Version ---------- */

// Der Service Worker meldet, wenn er eine neue Fassung der App geladen hat. Ein Tipp lädt sie.
function updateBanner() {
  if (document.getElementById('neue-version')) return;
  const b = document.createElement('button');
  b.id = 'neue-version';
  b.className = 'neue-version';
  b.type = 'button';
  b.textContent = 'Neue Version der App. Tippen zum Laden.';
  b.addEventListener('click', () => location.reload());
  document.body.appendChild(b);
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'neue-version') updateBanner(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'pruefen' });
  });
}

/* ---------- Was ist neu? ---------- */

// Nach einem Update einmal pro Gerät zeigen, was dazugekommen ist (Liste in js/neu.js).
// Im Testmodus nicht, damit das Fenster keinen Ablauf blockiert. Aus der Hilfe lässt es sich jederzeit öffnen.
function showNews() {
  if (state.phase !== 'app' || state.sheet || globalThis.ESSENSPLAN_HEUTE) return;
  const list = NEU.forAudience(NEU.unseen(NEU.NEUES, readLocal(NEWS_KEY), Date.now()), canPlan());
  writeLocal(NEWS_KEY, NEU.newest(NEU.NEUES));
  if (list.length) openSheet({ type: 'neu', list });
}
function sheetNews(sh) {
  const list = sh.list || NEU.forAudience(NEU.NEUES, canPlan());
  return {
    over: sh.list ? 'Update' : 'Hilfe',
    title: 'Was ist neu?',
    body: `${list.map((n) => `<section class="neu-eintrag"><h3 class="abteilung">${esc(n.titel)}</h3><p class="meta">${esc(n.datum)}</p>
      <ul>${n.punkte.map((p) => `<li>${esc(p.text)}</li>`).join('')}</ul></section>`).join('')}
      <div class="knopfreihe"><button class="knopf" data-action="zu">Alles klar</button></div>`,
  };
}

async function boot() {
  render();
  Push.register();
  try {
    const { signedIn } = await store.init();
    if (!signedIn) { state.phase = 'anmelden'; render(); return; }
    await enter();
  } catch (e) {
    state.phase = 'fehler';
    state.error = e.message;
    render();
  }
}

let listening = false;
function normalize(data) {
  for (const k of ['persons', 'dishes', 'plan', 'ratings', 'shopping', 'lunchRatings', 'hearts', 'tasks', 'taskLog', 'events', 'attendance', 'pantry', 'staples', 'settings', 'aiRuns', 'receipts']) if (!Array.isArray(data[k])) data[k] = [];
  return data;
}

async function enter() {
  // Sofortstart: Mit gespeichertem Stand vom letzten Mal sofort anzeigen und im Hintergrund frisch laden.
  const cached = store.mode === 'supabase' && !store.offline && store.cachedState ? store.cachedState() : null;
  const quick = !!(cached && Array.isArray(cached.dishes) && cached.dishes.length && Array.isArray(cached.persons) && cached.persons.length);
  state.data = normalize(quick ? cached : await store.loadAll());
  state.fresh = !quick;
  if (quick) {
    store.loadAll().then((d) => {
      state.data = normalize(d);
      state.fresh = true;
      if (!store.offline) store.remember();
      carryOver();
      if (state.sheet && FORM_SHEETS.includes(state.sheet.type)) state.stale = true;
      else refresh();
      if (state.phase === 'app') runPending();
    }).catch(() => { state.fresh = true; });
  }
  if (!state.data.dishes.length) {
    if (store.mode === 'local') {
      await store.seed();
      state.data = normalize(await store.loadAll());
    } else {
      state.phase = 'einrichten';
      render();
      return;
    }
  }
  if (store.mode === 'local' && state.data.persons.length && state.data.persons.every((p) => p.adult === undefined)) {
    state.data.persons = state.data.persons.map((p) => ({ ...p, adult: p.id === 'p1' || p.id === 'p2' }));
    await store.savePersons(state.data.persons);
  }
  state.week = defaultWeek();
  state.phase = display ? 'anzeige' : personById(state.me) ? 'app' : 'wer';
  if (HASH_TABS.includes(location.hash.slice(1))) state.tab = location.hash.slice(1);
  readStartParams();
  carryOver();
  refresh();
  initPush();
  setTimeout(showNews, 800);
  loadSchool().then((ok) => { if (ok && state.phase === 'app') render(); });
  if (!listening) {
    listening = true;
    store.onChange(onRemote);
    window.addEventListener('hashchange', () => {
      const t = location.hash.slice(1);
      if (HASH_TABS.includes(t) && state.phase === 'app') { state.tab = t; render(); }
      if (t === 'rueckblick' && state.phase === 'app' && canPlan()) { history.replaceState(null, '', `${location.pathname}#woche`); state.tab = 'woche'; render(); openReview(); }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.phase === 'app') onRemote('all');
    });
  }
}

// Aktuelle Woche, wenn sie geplant ist. Sonst die nächste geplante Woche.
function defaultWeek() {
  const today = L.todayISO();
  const mon = L.mondayOf(today);
  const days = L.weekDays(mon);
  if (state.data.plan.some((p) => days.includes(p.day) && p.dish_id)) return mon;
  const next = state.data.plan.filter((p) => p.day > today && p.dish_id).sort(byDay)[0];
  return next ? L.mondayOf(next.day) : mon;
}

/* ---------- Push-Nachrichten ---------- */

async function initPush() {
  useImported((KI.settingOf(state.data.settings, 'abfuhr') || {}).liste);
  if (store.mode === 'supabase') store.syncAbfuhr(ABFUHR.map(([day, bin]) => ({ day, bin }))).catch(() => {});
  await Push.register();
  await refreshPush(true);
}

// Liest den Stand auf diesem Gerät. Mit rebind wird das Abo der aktuellen Person zugeordnet.
async function refreshPush(rebind) {
  try { state.push = await Push.status(store.mode); } catch (e) { state.push = { available: false, reason: 'Der Stand der Benachrichtigungen ließ sich nicht prüfen.' }; }
  if (rebind && state.push.subscribed && state.me) {
    const sub = await Push.current().catch(() => null);
    if (sub) await store.savePushSub({ ...sub, person_id: state.me }).catch(() => {});
  }
  if (state.push.subscribed && state.push.endpoint) state.push.server = await store.pushSubState(state.push.endpoint).catch(() => null);
  if (state.sheet && state.sheet.type === 'familie') renderSheet();
}

// Was der Server über die letzte Zustellung an dieses Gerät weiß.
function deliveryNote(sv) {
  if (!sv) return '';
  if (!sv.known) return '<p class="meta push-stand warn">Dieses Gerät ist beim Server nicht angemeldet. Bitte einmal aus- und wieder einschalten.</p>';
  const when = (iso) => { const d = new Date(iso); const day = L.toISO(d); return `${day === L.todayISO() ? 'heute' : `am ${L.fmtShort(day)}`} um ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} Uhr`; };
  if (sv.last_error) {
    const m = String(sv.last_error).match(/^(.*?) am (\d{4}-\S+)/);
    const why = m ? m[1] : sv.last_error;
    const st = Number(sv.last_status) || 0;
    const retry = !st || st === 429 || st >= 500 || /nicht erreichbar/.test(sv.last_error);
    return `<p class="meta push-stand warn">Die letzte Nachricht kam nicht an (${esc(why)}${m ? `, ${when(m[2])}` : ''}). ${retry ? 'Der Server versucht es in ein paar Minuten noch einmal.' : 'Hilft das nicht, Benachrichtigungen einmal aus- und wieder einschalten.'}${sv.last_ok_at ? ` Zuletzt angekommen: ${when(sv.last_ok_at)}.` : ''}</p>`;
  }
  if (sv.last_ok_at) return `<p class="meta push-stand">Letzte Nachricht an dieses Gerät: ${when(sv.last_ok_at)}.</p>`;
  return '';
}

// Die letzten zehn Nachrichten an dieses Gerät, wie der Server sie verschickt hat.
function deliveryLog(sv) {
  const list = sv && Array.isArray(sv.history) ? sv.history.filter((h) => h && h.at) : [];
  if (!list.length) return '';
  const when = (iso) => { const d = new Date(iso); const day = L.toISO(d); const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; return day === L.todayISO() ? t : `${L.fmtShort(day)} ${t}`; };
  const result = (h) => (h.ok ? 'an den Push-Dienst übergeben' : `${h.why || 'nicht zugestellt'}${h.again ? ', wird wiederholt' : ''}`);
  return fold(`<div class="kasten-text zustellung"><strong>Letzte Nachrichten an dieses Gerät</strong>
    <p class="meta">Steht hier „übergeben“ und auf dem Handy ist nichts erschienen, liegt es am Handy (Mitteilungen, Fokus, Stromsparmodus), nicht am Server.</p>
    <ul>${list.map((h) => `<li><span class="z-zeit">${esc(when(h.at))}</span><span class="z-titel">${esc(h.title || '')}</span><span class="z-ergebnis${h.ok ? '' : ' warn'}">${esc(result(h))}</span></li>`).join('')}</ul></div>`);
}

function pushBlock() {
  const me = personById(state.me);
  const ps = state.push;
  const hasBinTask = state.data.tasks.some((t) => t.schedule === 'tonne' && t.active !== false);
  const what = !me ? '' : isAdult(me)
    ? `Wenn ein Kind eine Aufgabe als erledigt meldet, ${remindTimes().eltern ? `um ${clockText(remindTimes().eltern)} der Stand bei den Kindern, ` : ''}wer einkaufen geht, was am Vorabend vorzubereiten ist${hasBinTask ? '' : ' und wann die Tonne rausmuss'}.`
    : `${kidRemindText()} Am Vorabend der Müllabfuhr, wenn du mit der Tonne dran bist. Wenn eine Aufgabe bestätigt oder abgelehnt wurde. Freitags ans Herz der Woche.`.trim();
  let inner;
  if (!ps) inner = '<p class="meta">Wird geprüft.</p>';
  else if (!ps.available) inner = `<p class="meta">${esc(ps.reason)}</p>`;
  else if (ps.subscribed) {
    inner = `<p class="meta">Eingeschaltet für ${esc(me ? me.name : '')}. ${what}</p>${deliveryNote(ps.server)}${deliveryLog(ps.server)}
      <div class="knopfreihe" style="margin-top:10px"><button class="knopf zweit" data-action="push-test">Testnachricht</button><button class="textknopf" data-action="push-aus">Ausschalten</button></div>`;
  } else {
    inner = `<p class="meta">${what}</p><div class="knopfreihe" style="margin-top:10px"><button class="knopf" data-action="push-an">Einschalten</button></div>`;
  }
  const morning = me && ps && ps.available
    ? `<label class="schalter" style="margin-top:10px"><input type="checkbox" data-action="morgen-ueberblick"${me.notify_morning !== false ? ' checked' : ''}> Morgenüberblick <small>werktags um 7 Uhr, am Wochenende um 8:30 Uhr: ${isAdult(me) ? 'Abendessen, Einkauf und offene Aufgaben' : 'deine Aufgaben für heute und das Abendessen'}</small></label>`
    : '';
  const rating = me && ps && ps.available
    ? `<label class="schalter" style="margin-top:10px"><input type="checkbox" data-action="bewerten-erinnerung"${me.notify_rating !== false ? ' checked' : ''}> Erinnerung ans Bewerten <small>abends, wenn du mitgegessen und noch keine Sterne vergeben hast${isAdult(me) ? '' : ', spätestens um 20:15 Uhr'}</small></label>`
    : '';
  const list = me && isAdult(me) && ps && ps.available
    ? `<label class="schalter" style="margin-top:10px"><input type="checkbox" data-action="liste-erinnerung"${me.notify_list !== false ? ' checked' : ''}> Neue Einträge auf der Einkaufsliste <small>wenn jemand anderes etwas dazuschreibt, zwischen 7 und 21:30 Uhr</small></label>`
    : '';
  const cook = me && isAdult(me) && ps && ps.available
    ? `<label class="schalter" style="margin-top:10px"><input type="checkbox" data-action="kochen-erinnerung"${me.notify_cook !== false ? ' checked' : ''}> Erinnerung, wenn es Zeit zum Kochen ist <small>berechnet aus Essenszeit und Kochdauer des Gerichts</small></label>`
    : '';
  return `<div class="kasten-text" id="push-kasten"><strong>Benachrichtigungen auf diesem Gerät</strong>${inner}${morning}${rating}${cook}${list}</div>`;
}

function offlineNote() {
  const n = store.pendingCount();
  if (!store.offline && !n) return '';
  const wait = n === 1 ? '1 Änderung wird' : `${n} Änderungen werden`;
  const text = store.offline
    ? `Kein Netz. Die Einkaufsliste lässt sich weiter abhaken${n ? `, ${wait} nachgetragen` : ''}.`
    : `${wait} gerade nachgetragen.`;
  return `<p class="hinweis-offline" role="status">${text}</p>`;
}

/* ---------- Abgleich mit anderen Geräten ---------- */

const pending = new Set();
let remoteTimer;
function onRemote(table) {
  pending.add(table);
  clearTimeout(remoteTimer);
  remoteTimer = setTimeout(syncRemote, 500);
}
async function syncRemote() {
  const tables = [...pending];
  pending.clear();
  try {
    if (store.mode === 'local' || tables.includes('all')) {
      state.data = normalize(await store.loadAll());
    } else {
      for (const t of tables) {
        const key = store.stateKey(t);
        if (key) state.data[key] = await store.loadTable(t);
      }
    }
  } catch (e) {
    return;
  }
  if (tables.includes('all') || tables.includes('lp_data')) await loadSchool();
  stats = L.computeStats(state.data.dishes, state.data.plan, state.data.ratings, L.todayISO(), state.data.hearts);
  if (!store.offline) store.remember();
  carryOver();
  const typing = typeof document !== 'undefined' && document.activeElement && document.activeElement.closest && document.activeElement.closest('.notiz-form');
  if (state.sheet && (FORM_SHEETS.includes(state.sheet.type) || typing)) state.stale = true;
  else render();
}

async function commit(apply, persist) {
  apply();
  refresh();
  try {
    await persist();
  } catch (e) {
    console.error(e);
    toast('Speichern hat nicht geklappt. Der Stand wird neu geladen.');
    try { state.data = normalize(await store.loadAll()); } catch (e2) { /* offline: Stand bleibt stehen */ }
    refresh();
  }
}

/* ---------- Zeichnen ---------- */

// Doppelte Posten in den Listen ab der Vorwoche zusammenfassen, auch in Listen, die vor dieser Regel entstanden sind.
// Nur erzeugte, offene Posten. Das Ergebnis ist auf jedem Gerät gleich, deshalb stört es nicht, wenn zwei es zugleich tun.
function dedupeShopping() {
  if (state.dedupeBusy || !['app', 'anzeige'].includes(state.phase)) return;
  const from = L.addDays(L.mondayOf(L.todayISO()), -7);
  const { changed, removed } = L.mergeDuplicates(state.data.shopping.filter((i) => i.week_start >= from), (i) => !i.manual && !i.checked && !i.missing);
  if (!removed.length) return;
  state.dedupeBusy = true;
  const gone = new Set(removed);
  commit(() => {
    state.data.shopping = state.data.shopping.filter((i) => !gone.has(i.id)).map((i) => changed.find((c) => c.id === i.id) || i);
  }, async () => {
    await store.saveItems(changed);
    await store.deleteItems(removed);
  }).finally(() => { state.dedupeBusy = false; });
}

function refresh() {
  state.loadedAt = Date.now();
  grantBonus();
  useImported((KI.settingOf(state.data.settings, 'abfuhr') || {}).liste);
  stats = L.computeStats(state.data.dishes, state.data.plan, state.data.ratings, L.todayISO(), state.data.hearts);
  render();
}

// Essenszeit der nächsten 14 Tage in den Plan schreiben, damit die Push-Funktion weiß,
// wann die Kocherinnerung fällig ist. Geschrieben wird nur, was sich geändert hat.
let dinnerSyncTimer = null;
function scheduleDinnerSync() {
  if (store.mode !== 'supabase' || state.phase !== 'app') return;
  clearTimeout(dinnerSyncTimer);
  dinnerSyncTimer = setTimeout(syncDinnerTimes, 1500);
}
// Kontext für den Wochenplan mit Claude in ep_settings ablegen. Geschrieben wird nur bei Änderungen,
// höchstens einmal alle zehn Minuten.
let ctxTimer = null;
let ctxWritten = 0;
function scheduleContextSync() {
  if (store.mode !== 'supabase' || state.phase !== 'app' || store.offline) return;
  clearTimeout(ctxTimer);
  ctxTimer = setTimeout(syncContext, Math.max(3000, ctxWritten + 600000 - Date.now()));
}
function syncContext() {
  if (!state.fresh) { scheduleContextSync(); return; }
  try {
    const ctx = KI.buildContext(state.data, stats, exportNutrition);
    const old = KI.settingOf(state.data.settings, 'ki_kontext');
    const strip = (c) => JSON.stringify({ ...c, stand: '', auswertung: { ...(c && c.auswertung), erstellt: '' } });
    if (old && old.stand === ctx.stand && strip(old) === strip(ctx)) return;
    const row = { key: 'ki_kontext', value: ctx, updated_at: new Date().toISOString() };
    state.data.settings = [...state.data.settings.filter((x) => x.key !== row.key), row];
    ctxWritten = Date.now();
    store.saveSettings([row]).catch(() => {});
  } catch (e) { console.warn('Kontext für Claude', e); }
}

function syncDinnerTimes() {
  // Nie mit dem gespeicherten Stand vom letzten Mal schreiben, er kann veraltet sein.
  if (!state.fresh) { scheduleDinnerSync(); return; }
  const today = L.todayISO();
  const end = L.addDays(today, 13);
  const changed = [];
  for (const p of state.data.plan) {
    if (p.day < today || p.day > end || !p.dish_id || p.skipped) continue;
    const info = T.dinnerInfo(state.data.persons, state.data.events, state.data.attendance, p.day);
    const away = info.away.map((x) => x.person.id).sort();
    if (p.dinner_time === info.time && JSON.stringify([...(p.dinner_away || [])].sort()) === JSON.stringify(away)) continue;
    changed.push({ ...p, dinner_time: info.time, dinner_away: away });
  }
  if (!changed.length) return;
  state.data.plan = state.data.plan.map((p) => changed.find((c) => c.day === p.day) || p);
  store.savePlan(changed).catch(() => {});
}

let lastView = '';
function render() {
  const app = $('#app');
  const focusDraft = document.activeElement && document.activeElement.id === 'neu-posten';
  const viewKey = `${state.phase}|${state.tab}|${state.week}`;
  const scrollY = window.scrollY;
  dedupeShopping();
  app.innerHTML = view();
  document.documentElement.classList.toggle('anzeige-modus', state.phase === 'anzeige');
  if (state.phase === 'anzeige') keepAwake(true);
  scheduleDinnerSync();
  scheduleContextSync();
  if (viewKey === lastView) window.scrollTo(0, scrollY); else window.scrollTo(0, 0);
  lastView = viewKey;
  if (focusDraft) {
    const input = $('#neu-posten');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }
  if (state.sheet && !FORM_SHEETS.includes(state.sheet.type)) renderSheet();
}

function view() {
  switch (state.phase) {
    case 'laden': return '<p class="lade">Familienplan wird geladen</p>';
    case 'fehler': return viewError();
    case 'anmelden': return viewLogin();
    case 'einrichten': return viewSetup();
    case 'wer': return viewWho();
    case 'anzeige': return viewDisplay();
    default: return viewApp();
  }
}

/* ---------- Küchen-Display ---------- */
// Große Ansicht für ein Tablet in der Küche, nur zum Anschauen: Uhr, Abendessen, Ampeln, Termine, Kinder, Einkauf.
// Ohne Personenwahl. Aktualisiert sich über die Live-Verbindung, zur Sicherheit alle zehn Minuten komplett,
// und hält den Bildschirm wach. Nachts (22 bis 6 Uhr) wird es dunkler.
function viewDisplay() {
  const now = new Date();
  const today = L.todayISO();
  const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const night = now.getHours() >= 22 || now.getHours() < 6;
  const away = holidayOf(today);

  // Abendessen
  const p = planOf(today);
  const dish = p && !p.skipped ? dishById(p.dish_id) : null;
  const info = dinnerOf(today);
  const names = (list) => list.map((x) => x.person.name).join(' und ');
  const dinnerMeta = [
    dish ? `${info.time} Uhr` : '',
    info.away.length ? `ohne ${names(info.away)}` : info.eaters ? (info.eaters === state.data.persons.length ? 'alle da' : `${info.eaters} am Tisch`) : '',
    ...info.later.map((x) => `${x.person.name} kommt ${String(Math.floor(x.home / 60)).padStart(2, '0')}:${String(x.home % 60).padStart(2, '0')}`),
  ].filter(Boolean);
  const pm = planOf(L.addDays(today, 1));
  const tomorrow = pm && !pm.skipped ? dishById(pm.dish_id) : null;
  const dinner = away && away.weg !== false
    ? `<p class="anz-gericht">${esc(away.name || 'Urlaub')}</p><p class="anz-meta">Bis ${esc(L.fmtLong(away.bis))}</p>`
    : `<p class="anz-gericht">${dish ? esc(dish.name) : p && p.skipped ? 'Heute kein Abendessen geplant' : 'Noch nichts geplant'}</p>
      ${dinnerMeta.length && dish ? `<p class="anz-meta">${esc(dinnerMeta.join(', '))}</p>` : ''}
      ${tomorrow ? `<p class="anz-morgen">Morgen: ${esc(tomorrow.name)}</p>` : ''}`;

  // Ampeln
  const lamps = [];
  if (A.kmTask(state.data.tasks)) for (const x of A.kmView(kmValue(), state.data.taskLog)) lamps.push({ name: x.name, stufe: x.stufe, text: x.pending ? 'gemeldet' : KM_WORT[x.stufe] });
  if (A.smTask(state.data.tasks)) { const v = smNow(); lamps.push({ name: 'Spülmaschine', stufe: v.stufe, text: v.pending ? 'gemeldet' : v.stufe === 'gelb' && v.bis ? `läuft bis ${clockOf(v.bis)}` : SM_WORT[v.stufe] }); }
  if (stOn()) { const v = stNow(); lamps.push({ name: 'Stall', stufe: v.stufe, text: v.pending ? 'gemeldet' : v.stufe === 'gruen' ? `wieder am ${L.WD_SHORT[L.wdIndex(v.due)]}` : v.left < 0 ? `${stLate(v)} dran` : ST_WORT[v.stufe] }); }
  const ampeln = lamps.length ? `<section class="anz-feld anz-ampeln"><h2>Ampeln</h2><ul>${lamps.map((x) => `<li class="s-${x.stufe}"><span class="km-ampel" role="img" aria-label="${esc(x.name)}: ${x.stufe === 'rot' ? 'Rot' : x.stufe === 'gelb' ? 'Gelb' : 'Grün'}">${kmLamps(x.stufe)}</span><span class="anz-a-name">${esc(x.name)}</span><span class="anz-a-text">${esc(x.text)}</span></li>`).join('')}</ul></section>` : '';

  // Termine und Tonne
  const evs = T.eventsOn(state.data.events, today).slice().sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
  const who = (e) => (e.who || []).map((id) => (personById(id) || {}).name).filter(Boolean).join(', ');
  const bin = A.trashTomorrow(today);
  const termine = `<section class="anz-feld anz-heute"><h2>Heute</h2>
    ${evs.length || bin ? `<ul class="anz-termine">${evs.map((e) => `<li><span class="anz-zeit">${esc(String(e.start_time || '').slice(0, 5))}</span><span>${esc(e.title)}${who(e) ? `<small>${esc(who(e))}</small>` : ''}</span></li>`).join('')}
      ${bin ? `<li class="anz-tonne"><span class="anz-zeit">Abend</span><span>${esc(bin)} raus<small>wird morgen abgeholt</small></span></li>` : ''}</ul>` : '<p class="anz-leer">Keine Termine.</p>'}</section>`;

  // Kinder
  const kids = kidsList();
  const kinder = kids.length && !(away && away.weg !== false) ? `<section class="anz-feld anz-kinder"><h2>Aufgaben</h2><ul>${kids.map((k) => {
    const fixed = A.tasksFor(state.data.tasks, state.data.taskLog, k.id, today).fixed.filter((f) => !stHides(f.task));
    const must = A.mustToday(fixed, today);
    const open = must.filter((f) => !f.done);
    const acc = A.account(state.data.taskLog, k.id, capOf(k), nowMs(), today);
    return `<li><span class="anz-k-name">${avatar(k, true)}${esc(k.name)}</span>
      <span class="anz-k-text">${!must.length ? 'Heute keine festen Aufgaben' : open.length ? `Noch offen: ${esc(open.map((f) => f.label).join(', '))}` : 'Alles erledigt'}</span>
      <span class="anz-k-min">${acc.balance} Min.</span></li>`;
  }).join('')}</ul></section>` : '';

  // Einkauf
  const open = state.data.shopping.filter((i) => i.week_start === L.mondayOf(today) && !i.checked && i.category !== 'vorhanden').length;

  return `<div class="anzeige${night ? ' nacht' : ''}">
    <header class="anz-kopf"><div class="anz-blatt" aria-label="${esc(L.fmtLong(today))}"><span class="anz-wt">${esc(L.fmtLong(today).split(',')[0])}</span><b>${L.parseISO(today).getDate()}</b><span class="anz-mon">${esc(L.MONTHS[L.parseISO(today).getMonth()])}</span></div>
      <span class="anz-uhr">${hm(now)}</span></header>
    <div class="anz-raster${lamps.length ? '' : ' ohne-ampeln'}">
      <section class="anz-feld anz-essen"><h2>Heute Abend</h2>${dinner}</section>
      ${ampeln}
      ${termine}
      ${kinder}
    </div>
    <footer class="anz-fuss"><span>${open ? `${open} ${open === 1 ? 'Sache' : 'Sachen'} auf der Einkaufsliste` : 'Einkaufsliste leer'}</span>
      <span>${store.offline ? 'Keine Verbindung, zeigt den letzten Stand' : `Stand ${hm(new Date(state.loadedAt || Date.now()))}`}</span>
      <button class="anz-aus" data-action="anzeige-aus">Anzeige beenden</button></footer>
  </div>`;
}
setInterval(() => { if (state.phase === 'anzeige' && document.visibilityState === 'visible' && !state.sheet) render(); }, 30000);
setInterval(() => {
  if (state.phase !== 'anzeige' || store.offline || document.visibilityState !== 'visible') return;
  store.loadAll().then((d) => { state.data = normalize(d); state.loadedAt = Date.now(); refresh(); }).catch(() => {});
}, 10 * 60000);

function viewError() {
  return `<div class="tor"><h1>Keine Verbindung</h1>
    <p>${esc(state.error)}</p>
    <button class="knopf" data-action="neu-laden">Noch einmal versuchen</button></div>`;
}

function viewLogin() {
  return `<div class="tor"><h1>Familienplan</h1>
    <p>Meldet euch einmal mit dem Familienzugang an. Das Gerät merkt sich die Anmeldung.</p>
    <form class="form" data-form="anmelden">
      <label>E-Mail<input class="feld" type="email" name="email" autocomplete="username" required></label>
      <label>Passwort<input class="feld" type="password" name="password" autocomplete="current-password" required></label>
      ${state.error ? `<p class="fehler">${esc(state.error)}</p>` : ''}
      <button class="knopf breit"${state.busy ? ' disabled' : ''}>Anmelden</button>
    </form></div>`;
}

function viewSetup() {
  return `<div class="tor"><h1>Fast fertig</h1>
    <p>Die Datenbank ist noch leer. Mit einem Tipp kommen 16 Gerichte, der Wochenplan vom 16. bis 22. November und die Einkaufsliste hinein.</p>
    ${state.error ? `<p class="fehler">${esc(state.error)}</p>` : ''}
    <button class="knopf breit" data-action="einrichten"${state.busy ? ' disabled' : ''}>Startdaten einspielen</button></div>`;
}

function viewWho() {
  return `<div class="tor"><h1>Wer bist du?</h1>
    <p>Die Auswahl gilt für dieses Gerät. Deine Sterne und Häkchen laufen dann unter deinem Namen.</p>
    <div class="wer">${state.data.persons.map((p) =>
      `<button data-action="ich" data-id="${esc(p.id)}">${avatar(p)}${esc(p.name)}</button>`).join('')}</div>
    <div class="fuss"><button class="textknopf" data-action="familie">Namen ändern</button></div></div>`;
}

function viewApp() {
  const me = personById(state.me);
  const openCount = state.data.shopping.filter((i) => i.week_start === state.week && !i.checked).length;
  const views = { woche: viewWoche, aufgaben: viewAufgaben, einkauf: viewEinkauf, gerichte: viewGerichte, ausgaben: viewAusgaben };
  const body = (views[state.tab] || viewWoche)();
  const tabs = [['woche', 'Woche'], ['aufgaben', 'Aufgaben'], ['einkauf', 'Einkauf'], ['gerichte', 'Gerichte'], ['ausgaben', 'Ausgaben']];
  const taskCount = taskBadge();
  return `<div class="rahmen">
    <header class="kopf">
      <div class="kopf-zeile"><h1>Familienplan</h1>
        <span class="kopf-knoepfe"><button class="hilfe-knopf" data-action="hilfe" aria-label="Hilfe: Was kann die App?">?</button>
        <button class="ich" data-action="familie" aria-label="Familie und Einstellungen, angemeldet als ${esc(me ? me.name : '')}">${esc(me ? me.name : '')}${avatar(me)}</button></span></div>
      ${['gerichte', 'aufgaben', 'ausgaben'].includes(state.tab) ? '' : weekNav()}
    </header>
    ${offlineNote()}
    ${store.mode === 'local' ? `<p class="hinweis-demo">Demo: Die Daten bleiben nur auf diesem Gerät.${globalThis.ESSENSPLAN_HEUTE ? ` Testdatum ${L.fmtShort(L.todayISO())}` : ''} <button class="textknopf" data-action="familie" style="padding:0">${globalThis.ESSENSPLAN_HEUTE ? 'ändern' : 'Testdatum setzen'}</button></p>` : ''}
    <main class="inhalt">${body}</main>
    <nav class="tabs" aria-label="Bereiche"><div class="tabs-innen">${tabs.map(([id, label]) =>
      `<button class="tab" data-action="tab" data-tab="${id}"${state.tab === id ? ' aria-current="page"' : ''}>${ICONS[id]}<span>${label}${id === 'einkauf' && openCount ? ` <span class="zahl-offen">(${openCount})</span>` : ''}${id === 'aufgaben' && taskCount ? ` <span class="zahl-offen">(${taskCount})</span>` : ''}</span></button>`).join('')}</div></nav>
  </div>`;
}

function weekNav() {
  const current = L.mondayOf(L.todayISO());
  return `<div class="wochenwahl">
      <button class="pfeil" data-action="woche" data-dir="-1" aria-label="Vorige Woche">${LEFT}</button>
      <div class="mitte"><span class="kw">KW ${L.isoWeek(state.week)}</span><span class="spanne">${L.fmtRange(state.week)}</span></div>
      <button class="pfeil" data-action="woche" data-dir="1" aria-label="Nächste Woche">${RIGHT}</button>
    </div>
    ${state.week === current ? '' : '<button class="zurueck-heute" data-action="woche-heute">Zur aktuellen Woche</button>'}`;
}

/* ---------- Woche ---------- */

function counterText(dish, day) {
  const s = stats[dish.id];
  const today = L.todayISO();
  if (!s) return '';
  if (day === today && s.served > 0) return s.served === 1 ? 'Heute zum ersten Mal dran.' : `Heute zum ${s.served}. Mal dran.`;
  if (!s.served) return 'War bisher noch nicht dran.';
  return `War schon ${s.served} mal dran, zuletzt am ${L.fmtShort(s.lastServed)}`;
}

function ratingBlock(day) {
  const p = planOf(day);
  if (!p || !p.dish_id) return '';
  if (p.skipped) return '<div class="bewertung"><p class="meta">Ausgefallen, deshalb ohne Bewertung.</p></div>';
  if (day > L.todayISO()) return `<div class="bewertung"><p class="meta">Bewerten geht ab ${L.fmtLong(day)}.</p></div>`;
  const mine = myRating(day);
  const me = personById(state.me);
  const n = mine ? mine.stars : 0;
  const stars = [1, 2, 3, 4, 5].map((v) =>
    `<button class="stern${v <= n ? ' an' : ''}" data-action="stern" data-day="${day}" data-n="${v}" role="radio" aria-checked="${v === n}" aria-label="${v} ${v === 1 ? 'Stern' : 'Sterne'}">${STAR}</button>`).join('');
  const round = state.data.persons.map((person) => {
    const r = state.data.ratings.find((x) => x.day === day && x.person_id === person.id);
    return `<li>${avatar(person, true)}<span>${esc(person.name)}</span>${r ? `<span class="schnitt">${r.stars} ${MINI}</span>` : '<span class="offen">offen</span>'}</li>`;
  }).join('');
  return `<div class="bewertung">
    <p class="frage">Wie hat es dir geschmeckt${me ? `, ${esc(me.name)}` : ''}?</p>
    <div class="sterne" role="radiogroup" aria-label="Deine Bewertung">${stars}</div>
    <ul class="runde">${round}</ul></div>`;
}

function lunchRatingBlock(day) {
  const text = lunchOf(day);
  if (!text || !L.isSchoolDay(day)) return '';
  if (day > L.todayISO()) return `<p class="meta">Bewerten geht ab ${L.fmtLong(day)}.</p>`;
  const rows = lunchRatingsOf(day);
  let stars = '';
  if (canRateLunch()) {
    const me = personById(state.me);
    const mine = rows.find((r) => r.person_id === state.me);
    const n = mine ? mine.stars : 0;
    stars = `<p class="frage">Wie war deine Brotbox${me ? `, ${esc(me.name)}` : ''}?</p>
      <div class="sterne" role="radiogroup" aria-label="Bewertung der Brotbox">${[1, 2, 3, 4, 5].map((v) =>
        `<button class="stern${v <= n ? ' an' : ''}" data-action="brotbox-stern" data-day="${day}" data-n="${v}" role="radio" aria-checked="${v === n}" aria-label="Brotbox ${v} ${v === 1 ? 'Stern' : 'Sterne'}">${STAR}</button>`).join('')}</div>`;
  }
  const round = lunchRaters().map((person) => {
    const r = rows.find((x) => x.person_id === person.id);
    return `<li>${avatar(person, true)}<span>${esc(person.name)}</span>${r ? `<span class="schnitt">${r.stars} ${MINI}</span>` : '<span class="offen">offen</span>'}</li>`;
  }).join('');
  return `${stars}<ul class="runde">${round}</ul>`;
}

function heroLunch(day) {
  if (L.wdIndex(day) > 4) return '';
  const free = L.schoolFree(day);
  if (free) return `<div class="bewertung brotbox"><p class="frage-klein">Heute schulfrei</p><p class="meta">${esc(free)}, keine Brotbox nötig.</p></div>`;
  if (!lunchOf(day)) return '';
  return `<div class="bewertung brotbox"><p class="frage-klein">Brotbox heute</p><p class="meta">${esc(lunchOf(day))}</p>${lunchRatingBlock(day)}</div>`;
}

function heroHtml(day) {
  const p = planOf(day);
  const dish = p && dishById(p.dish_id);
  const d = L.parseISO(day);
  const so = L.wdIndex(day) === 6 ? ' so' : '';
  const head = `<div class="blatt-band"><span>Heute</span><span>KW ${L.isoWeek(day)}</span></div>
    <div class="blatt-koerper">
    <div class="datum"><span class="zahl${so}">${d.getDate()}</span><div><span class="wtag">${L.WEEKDAYS[L.wdIndex(day)]}</span><span class="monat">${L.MONTHS[d.getMonth()]} ${d.getFullYear()}</span></div></div>`;
  const away = holidayOf(day);
  if (away && !dish) {
    return `<article class="blatt urlaub">${head}
      <h2 class="gericht">${esc(away.name || 'Urlaub')}</h2>
      <p class="meta">Heute isst niemand zu Hause. Bis ${esc(L.fmtLong(away.bis))} ist nichts geplant.</p></div></article>`;
  }
  if (!dish) {
    return `<article class="blatt">${head}
      <h2 class="gericht">Heute ist nichts geplant</h2>
      ${dinnerLine(day)}
      ${canPlan() ? `<div class="knopfreihe"><button class="knopf" data-action="tauschen" data-day="${day}">Gericht wählen</button></div>` : '<p class="meta">Mama oder Papa tragen das Essen ein.</p>'}</div></article>`;
  }
  return `<article class="blatt${p.skipped ? ' ausgefallen' : ''}">${head}
    <h2 class="gericht">${esc(dish.name)}</h2>
    <p class="meta">${esc(metaText(dish))}</p>
    <p class="zaehler">${esc(counterText(dish, day))}</p>
    ${dinnerLine(day)}
    ${ratingBlock(day)}
    ${heroLunch(day)}
    <div class="knopfreihe"><button class="knopf" data-action="tag" data-day="${day}">Rezept ansehen</button></div>
    </div></article>`;
}

function dayRow(day) {
  const p = planOf(day);
  const dish = p && dishById(p.dish_id);
  const today = L.todayISO();
  const wd = L.wdIndex(day);
  const leaf = `<span class="mini-blatt${wd === 6 ? ' so' : ''}"><span class="mw">${L.WD_SHORT[wd]}</span><span class="mz">${L.parseISO(day).getDate()}</span></span>`;
  const cls = `tag-zeile${day === today ? ' heute' : ''}${day < today ? ' vorbei' : ''}`;
  const away = holidayOf(day);
  if (away && !dish) {
    return `<li><button class="${cls} urlaub" data-action="urlaub" aria-label="${L.fmtLong(day)}, ${esc(away.name || 'Urlaub')}">${leaf}<span class="tz-text"><span class="tz-name">${esc(away.name || 'Urlaub')}</span><span class="tz-meta">niemand isst zu Hause</span></span></button></li>`;
  }
  if (!dish) {
    const plan = canPlan();
    return `<li><button class="${cls}" data-action="${plan ? 'tauschen' : 'tag'}" data-day="${day}" aria-label="${L.fmtLong(day)}, ${plan ? 'Gericht wählen' : 'noch nichts geplant'}">${leaf}<span class="tz-text"><span class="tz-name tz-leer">Noch nichts geplant</span>${plan ? '<span class="tz-meta">Tippen, um ein Gericht zu wählen</span>' : ''}</span></button></li>`;
  }
  const dayRatings = state.data.ratings.filter((r) => r.day === day);
  const dayAvg = dayRatings.length ? dayRatings.reduce((a, r) => a + r.stars, 0) / dayRatings.length : null;
  const bits = [durationText(dish.duration_min), L.DISH_CATS[dish.category]];
  if (p.skipped) bits.push('ausgefallen');
  if (wd < 5 && L.schoolFree(day)) bits.push(`schulfrei, ${L.schoolFree(day)}`);
  const din = dinnerOf(day);
  if (din.shifted) bits.push(`Essen ${din.time}`);
  if (din.away.length) bits.push(`ohne ${din.away.map((x) => x.person.name).join(' und ')}`);
  return `<li><button class="${cls}" data-action="tag" data-day="${day}" aria-label="${L.fmtLong(day)}, ${esc(dish.name)}">${leaf}
    <span class="tz-text"><span class="tz-name${p.skipped ? ' gestrichen' : ''}">${esc(dish.name)}${dayHearts(day, dish.id)}</span>
    <span class="tz-meta">${esc(bits.filter(Boolean).join(', '))}${dayAvg != null ? ` &nbsp;<span class="schnitt">${MINI} ${L.fmtStars(dayAvg)}</span>` : ''}</span></span></button></li>`;
}

function viewWoche() {
  const today = L.todayISO();
  const days = L.weekDays(state.week);
  const planned = days.filter((d) => { const p = planOf(d); return p && p.dish_id; });
  let html = days.includes(today) ? kidTodayBanner() + heroHtml(today) + lunchButton() : '';
  const awayDays = days.filter((d) => holidayOf(d));
  if (!planned.length && awayDays.length === 7) {
    const u = holidayOf(days[0]);
    return `${html}<div class="leer"><h2 class="abschnitt">${esc(u.name || 'Urlaub')}</h2><p>In dieser Woche isst niemand zu Hause, deshalb ist nichts geplant.</p></div>
      <div class="fuss"><button class="textknopf" data-action="urlaub">Urlaub und Tage auswärts</button></div>`;
  }
  if (!planned.length) {
    return `${html}${draftBanner()}${reviewBanner()}${wishBanner(state.week)}${feastBanner(state.week)}${canPlan() ? leftoverCard() : ''}${heartReminder()}${abfuhrBox(false)}<div class="leer"><h2 class="abschnitt">Für diese Woche steht noch nichts fest</h2>
      ${canPlan() ? `<p>Der Vorschlag nimmt gut bewertete Gerichte, die länger nicht dran waren.</p>
      <div class="knopfreihe"><button class="knopf" data-action="woche-fuellen">Woche vorschlagen</button>
</div>` : '<p>Mama oder Papa planen die Woche.</p>'}</div>
      ${planTiles()}`;
  }
  // Für die Kinder steht die Wahl oben, solange sie offen ist. Die Eltern sehen das Ergebnis unter der Woche.
  const heartFirst = canRateLunch() && L.heartOpen(state.week);
  html += draftBanner();
  html += reviewBanner();
  html += wishBanner(state.week);
  html += feastBanner(state.week);
  if (canPlan()) html += leftoverCard();
  html += prepBox();
  html += abfuhrBox(false);
  html += heartReminder();
  if (heartFirst) html += heartCard(state.week);
  html += `<h2 class="abschnitt">Die Woche</h2><ul class="woche">${days.map(dayRow).join('')}</ul>
    ${days.some((d) => !(planOf(d) || {}).dish_id && !holidayOf(d)) && canPlan() ? '<div class="fuss"><button class="textknopf" data-action="woche-fuellen">Leere Tage füllen</button></div>' : ''}
    ${planTiles()}`;
  if (!heartFirst) html += heartCard(state.week);
  html += weekNutrition(days);
  html += weekCost(days);
  html += weekReview(state.week);
  return html;
}

// Kacheln unter der Woche: Termine, Urlaub, Reste und Festtage, jeweils mit dem aktuellen Stand.
function planTiles() {
  const today = L.todayISO();
  const ev = state.data.events.filter((e) => e.active !== false);
  const away = KI.holidays(state.data.settings).filter((u) => u.bis >= today).sort((a, b) => (a.von < b.von ? -1 : 1))[0];
  const rest = leftovers().length;
  const feast = feastList().filter((f) => f.datum >= today).sort((a, b) => (a.datum < b.datum ? -1 : 1))[0];
  const tile = (action, title, meta) => `<button class="plan-kachel" data-action="${action}"><span class="pk-titel">${title}</span><span class="pk-meta">${esc(meta)}</span></button>`;
  return `<h2 class="abschnitt" style="margin-top:26px">Planen</h2><div class="plan-kacheln">
    ${tile('termine', 'Termine', ev.length ? `${ev.length} ${ev.length === 1 ? 'fester Termin' : 'feste Termine'}` : 'Training, Dienste, Kurse')}
    ${tile('urlaub', 'Urlaub und auswärts', away ? `${away.name || 'Urlaub'} ab ${L.fmtShort(away.von)}` : 'Nichts eingetragen')}
    ${tile('reste', 'Was muss weg?', rest ? `${rest} ${rest === 1 ? 'Eintrag' : 'Einträge'}` : 'Reste und Gartenernte')}
    ${canPlan() ? tile('feste', 'Festtage', feast ? `${feast.anlass}, ${L.fmtShort(feast.datum)}` : 'Fondue, Geburtstag und Co.') : ''}
    ${canPlan() ? tile('rueckblick', 'Wochenrückblick', `KW ${L.isoWeek(reviewWeek())}: Essen, Aufgaben, Lernen, Ausgaben`) : ''}</div>`;
}

// Geschätzte Kosten der geplanten Abendessen, nach Zahl der Esser und Gäste, dazu der Rest vom Monatsbudget.
function weekCost(days) {
  const factors = T.portionFactors(state.data.persons, state.data.events, state.data.attendance, days, state.data.plan);
  let sum = 0; let known = 0; let missing = 0;
  for (const d of days) {
    const p = planOf(d);
    const dish = p && !p.skipped && dishById(p.dish_id);
    if (!dish || holidayOf(d)) continue;
    const c = KI.costOf(state.data.settings, dish);
    if (!c) { missing += 1; continue; }
    sum += c.euro * (factors[d] || 1);
    known += 1;
  }
  if (!known) return '';
  const H = hbSettings();
  const today = L.todayISO();
  const month = HB.monthOf(today);
  const b = days.includes(today) && H.budget ? HB.budgetState(HB.summary(state.data.receipts, month).total, H.budget, month, today) : null;
  const budget = b ? (b.left >= 0 ? ` Vom Budget für ${HB.monthLabel(month)} sind noch ${HB.euroShort(b.left)} übrig.` : ` Das Budget für ${HB.monthLabel(month)} ist schon um ${HB.euroShort(-b.left)} überschritten.`) : '';
  return `<div class="kasten-text kosten-woche"><strong>Kosten der Woche: etwa ${HB.euroShort(Math.round(sum))}</strong>Für ${known} Abendessen${missing ? ` (${missing} noch ohne Schätzung)` : ''}, geschätzt mit euren Preisen und der Zahl der Esser.${budget}</div>`;
}

// Erklärtexte hinter einem kleinen „i“: Ein Tipp blendet den Text ein und wieder aus.
const infoOpen = (key) => !!(state.info && state.info[key]);
const infoBtn = (key, label) => `<button class="info-knopf" data-action="info" data-key="${key}" aria-expanded="${infoOpen(key)}" aria-label="${esc(label || 'Erklärung')}">i</button>`;
const infoText = (key, html) => (infoOpen(key) ? `<p class="meta info-text">${html}</p>` : '');

// Für die Kinder ganz oben in der Woche: Was heute noch an Grundaufgaben offen ist.
function kidTodayBanner() {
  const me = personById(state.me);
  if (!me || !isKidMe() || !state.data.tasks.length) return '';
  const today = L.todayISO();
  const h = holidayOf(today);
  if (h && h.weg !== false) return '';
  const must = A.mustToday(A.tasksFor(state.data.tasks, state.data.taskLog, me.id, today).fixed, today);
  if (!must.length) return '';
  const left = must.filter((f) => !f.done).map((f) => f.label);
  // Alles erledigt: grün statt rot, damit das Kind sieht, dass es geschafft ist.
  if (!left.length) {
    const waiting = must.some((f) => f.done.status === 'offen');
    return `<button class="aufgaben-hinweis fertig" data-action="tab" data-tab="aufgaben"><span class="ah-zahl">${CHECK}</span>
    <span class="ah-text"><span class="ah-titel">Heute alles erledigt</span><span class="ah-liste">${waiting ? 'Danke! Mama oder Papa schauen noch drüber.' : 'Danke, alles bestätigt.'}</span></span><span class="ah-pfeil" aria-hidden="true">›</span></button>`;
  }
  return `<button class="aufgaben-hinweis" data-action="tab" data-tab="aufgaben"><span class="ah-zahl">${left.length}</span>
    <span class="ah-text"><span class="ah-titel">${left.length === 1 ? 'Heute noch eine Aufgabe' : `Heute noch ${left.length} Aufgaben`}</span><span class="ah-liste">${esc(left.join(', '))}</span></span><span class="ah-pfeil" aria-hidden="true">›</span></button>`;
}

function weekNutrition(days) {
  const dishes = days.map((d) => { const p = planOf(d); return p && !p.skipped && dishById(p.dish_id); }).filter(Boolean);
  const avg = N.average(dishes);
  if (!avg) return '';
  const v = avg.values;
  const cell = (k, label, unit) => `<div><span class="n">${N.fmtValue(k, v[k])}${unit ? `<small> ${unit}</small>` : ''}</span><span class="l">${label}</span></div>`;
  return `<h2 class="abschnitt mit-info" style="margin-top:26px">Nährwerte der Woche ${infoBtn('naehr', 'Wie die Nährwerte berechnet sind')}</h2>
    <p class="meta" style="margin:-4px 2px 10px">Schnitt aus ${avg.n} Abendessen pro Portion.</p>${infoText('naehr', 'Eine Portion ist ein Viertel des Rezepts, Kinder essen meist weniger. Geschätzt aus den Zutaten.')}
    <div class="werte vier">${cell('kcal', 'kcal', '')}${cell('protein', 'Eiweiß', 'g')}${cell('carbs', 'Kohlenhydrate', 'g')}${cell('fat', 'Fett', 'g')}</div>${weekAmpel(dishes)}`;
}

// Die Woche im Überblick: wie viele Abendessen viel Eiweiß haben und wo etwas hoch ausfällt.
function weekAmpel(dishes) {
  if (!seesAmpel()) return '';
  const rows = dishes.map((d) => ({ d, a: N.ampel(d) })).filter((x) => x.a);
  if (!rows.length) return '';
  const lines = [];
  for (const [key, label] of N.PLUS) {
    const n = rows.filter((x) => x.a.plus.some((p) => p.key === key)).length;
    lines.push(`<li class="ampel-plus"><span class="punkt" aria-hidden="true"></span>${n} von ${rows.length} mit ${label === 'viel Eiweiß' ? 'viel Eiweiß' : 'vielen Ballaststoffen'}</li>`);
  }
  for (const [key, label] of N.AMPEL) {
    if (key === 'salt') continue; // ohne Nachsalzen gerechnet, deshalb hier nicht gezählt
    const high = rows.filter((x) => x.a.items.find((i) => i.key === key).level === 'rot');
    if (high.length) lines.push(`<li class="ampel-rot"><span class="punkt" aria-hidden="true"></span>${high.length} mit viel ${label === 'gesättigtes Fett' ? 'gesättigtem Fett' : label}: ${high.map((x) => esc(L.shortDish(x.d.name))).join(', ')}</li>`);
  }
  return `<ul class="ampel woche">${lines.join('')}</ul>`;
}

// Karte zum Vergeben und Anzeigen der Herzen einer Woche.
function dayHearts(day, dishId) {
  const n = state.data.hearts.filter((h) => h.week_start === L.mondayOf(day) && h.dish_id === dishId).length;
  return n ? ` <span class="herz-mini" aria-label="${n} ${n === 1 ? 'Herz' : 'Herzen'}">${HEART}${n > 1 ? n : ''}</span>` : '';
}

function heartCard(week) {
  if (!L.heartOpen(week) && !state.data.hearts.some((h) => h.week_start === week)) return '';
  const opts = heartOptions(week);
  if (!opts.length) return '';
  const open = L.heartOpen(week);
  let pick = '';
  if (open && canRateLunch()) {
    const mine = myHeart(week);
    pick = `<p class="frage">Welches Essen war diese Woche dein Liebling?</p>
      <ul class="herz-liste">${opts.map((p) => {
        const d = dishById(p.dish_id);
        const on = !!mine && mine.dish_id === d.id;
        return `<li><button class="herz-knopf${on ? ' an' : ''}" data-action="herz" data-week="${week}" data-id="${esc(d.id)}" aria-pressed="${on}">${HEART}
          <span class="tz-text"><span class="tz-name">${esc(d.name)}</span><span class="tz-meta">${L.WEEKDAYS[L.wdIndex(p.day)]}</span></span></button></li>`;
      }).join('')}</ul>`;
  }
  const round = lunchRaters().map((person) => {
    const h = state.data.hearts.find((x) => x.week_start === week && x.person_id === person.id);
    const d = h && dishById(h.dish_id);
    return `<li>${avatar(person, true)}<span>${esc(person.name)}</span>${d ? `<span class="herz-wahl">${HEART}${esc(d.name)}</span>` : `<span class="offen">${open ? 'offen' : 'kein Herz vergeben'}</span>`}</li>`;
  }).join('');
  return `<section class="herz-karte"><h2 class="abschnitt">Lieblingsgericht der Woche</h2>
    ${open ? '' : '<p class="meta">Die Wahl ist abgeschlossen.</p>'}${pick}<ul class="runde herz-runde">${round}</ul></section>`;
}

// Erinnerung in der neuen Woche, falls das Herz für die Vorwoche noch fehlt.
function heartReminder() {
  const current = L.mondayOf(L.todayISO());
  if (state.week !== current || !canRateLunch()) return '';
  const prev = L.addDays(current, -7);
  if (!L.heartOpen(prev) || myHeart(prev) || !heartOptions(prev).length) return '';
  return `<div class="kasten-text herz-hinweis"><strong>Dein Herz für letzte Woche fehlt noch</strong>Bis Sonntag kannst du es noch vergeben.
    <div class="knopfreihe" style="margin-top:10px"><button class="knopf zweit" data-action="woche" data-dir="-1">Zur letzten Woche</button></div></div>`;
}

/* ---------- Einkauf ---------- */

// Eine Push-Nachricht kann die App mit ?woche=JJJJ-MM-TT öffnen, mit &uebernehmen=1 auch gleich
// den heutigen Einkauf für die Person auf diesem Gerät eintragen (Knopf „Ich gehe einkaufen“).
// Mit ?tag=JJJJ-MM-TT öffnet sie gleich den Tag, etwa zum Bewerten des Abendessens.
let pendingClaim = false;
let pendingDay = null;
let pendingDraft = null;
let pendingReview = false;
function readStartParams() {
  const q = new URLSearchParams(location.search);
  if (location.hash === '#rueckblick') { pendingReview = true; state.tab = 'woche'; history.replaceState(null, '', `${location.pathname}#woche`); }
  const w = q.get('woche');
  const t = q.get('tag');
  const e = q.get('entwurf');
  if (e && /^[\w-]{1,80}$/.test(e)) pendingDraft = e;
  if (w && /^\d{4}-\d{2}-\d{2}$/.test(w)) state.week = L.mondayOf(w);
  if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) { state.week = L.mondayOf(t); state.tab = 'woche'; pendingDay = t; }
  if (q.get('uebernehmen') === '1') pendingClaim = true;
  if (w || t || e || pendingClaim) history.replaceState(null, '', location.pathname + location.hash);
  // Aus einer Push-Nachricht geöffnet: erst mit frischen Daten handeln (zum Beispiel einen neuen Entwurf öffnen).
  if (state.phase === 'app' && state.fresh) runPending();
}
function runPending() {
  if (pendingReview && canPlan()) { pendingReview = false; openReview(); }
  if (pendingClaim) claimToday();
  if (pendingDay) { const day = pendingDay; pendingDay = null; openSheet({ type: 'tag', day }); }
  if (pendingDraft && canPlan()) {
    const run = state.data.aiRuns.find((x) => x.id === pendingDraft);
    pendingDraft = null;
    if (run) { state.week = String(run.week_start).slice(0, 10); openSheet({ type: 'entwurf', id: run.id }); }
  }
}
function claimToday() {
  pendingClaim = false;
  if (!canPlan()) return;
  const today = L.todayISO();
  const trips = [...new Set(state.data.shopping.filter((i) => i.due === today && !i.checked).map((i) => `${i.week_start}|${i.trip || 'Einkauf'}`))];
  if (!trips.length) return;
  for (const t of trips) setBuyer(t.split('|')[0], t.split('|')[1], state.me);
  toast('Eingetragen: Du gehst heute einkaufen.');
}
function setBuyer(week, trip, buyer) {
  const changed = state.data.shopping.filter((i) => i.week_start === week && (i.trip || 'Einkauf') === trip).map((i) => ({ ...i, buyer }));
  if (!changed.length) return;
  commit(() => {
    state.data.shopping = state.data.shopping.map((i) => changed.find((c) => c.id === i.id) || i);
  }, () => store.saveItems(changed));
}

// Hinweis auf Listen aus anderen Wochen, deren Einkaufstag heute ist.
function dueElsewhere() {
  const today = L.todayISO();
  const other = [...new Set(state.data.shopping
    .filter((i) => i.due === today && !i.checked && i.week_start !== state.week)
    .map((i) => i.week_start))];
  return other.map((w) => {
    const trip = state.data.shopping.find((i) => i.week_start === w && i.due === today).trip || 'Einkauf';
    return `<div class="kasten-text einkauf-hinweis"><strong>Heute ist auch Einkauf</strong>${esc(trip)}, Liste der KW ${L.isoWeek(w)}.
      <div class="knopfreihe" style="margin-top:10px"><button class="knopf zweit" data-action="zur-woche" data-week="${w}">Diese Liste zeigen</button></div></div>`;
  }).join('');
}

/* ---------- Aus dem Vorrat: wirklich da? ---------- */
// Was der Plan aus dem Vorrat nimmt, steht nicht (oder nur abgehakt) auf der Liste. Vor dem Einkauf fragt die App nach,
// ob es wirklich da ist. „Ist da“ merkt sich die Antwort pro Woche (ep_settings "vorrat_check"), „Fehlt“ setzt den
// Vorrat auf leer und stellt die Zutat mit Menge und Gerichten auf die Liste.
const pantryChecks = () => { const v = KI.settingOf(state.data.settings, 'vorrat_check'); return v && typeof v === 'object' ? v : {}; };
function pantryAsk(week) {
  if (week < L.addDays(L.mondayOf(L.todayISO()), -7)) return [];
  const factors = T.portionFactors(state.data.persons, state.data.events, state.data.attendance, L.weekDays(week), state.data.plan);
  const ok = pantryChecks()[week] || {};
  // Was schon richtig auf der Liste steht (offen oder gekauft), muss niemand im Vorrat suchen.
  const listed = new Set(state.data.shopping.filter((i) => i.week_start === week && i.category !== 'vorhanden').map((i) => L.itemKey(i.label)));
  return L.fromPantry(week, state.data.plan, state.data.dishes, state.data.pantry, factors, L.todayISO()).filter((x) => !ok[x.key] && !listed.has(x.key));
}
function pantryBox(week) {
  const ask = pantryAsk(week);
  if (!ask.length) return '';
  return `<div class="kasten-text vorrat-frage"><strong>Aus dem Vorrat: wirklich da?</strong>
    Diese Sachen nimmt der Plan aus dem Vorrat und kauft sie deshalb nicht ein. Kurz nachschauen:
    <ul class="posten">${ask.map((x) => `<li><div class="extra-zeile"><span class="p-text"><span class="p-name">${esc(x.label)}</span><span class="p-menge">${esc(x.qty)} für ${esc(x.purpose)}</span></span>
      <span class="ja-nein"><button class="knopf zweit klein" data-action="vorrat-da" data-id="${esc(x.key)}" aria-label="${esc(x.label)} ist da">Ist da</button><button class="knopf klein" data-action="vorrat-fehlt" data-id="${esc(x.key)}" aria-label="${esc(x.label)} fehlt, auf die Liste">Fehlt</button></span></div></li>`).join('')}</ul>
    ${ask.length > 1 ? '<div class="knopfreihe"><button class="knopf zweit klein" data-action="vorrat-alle-da">Alles da</button></div>' : ''}</div>`;
}
// Hat eine frühere Fassung beim Neuberechnen die Brotbox-Posten aus Claudes Plan verloren, fehlen sie auf der Liste.
// Der Kasten zeigt sie und stellt sie mit einem Tipp wieder drauf.
const DRAFT_SEEN = 'essensplan.brotbox-ok';
function draftMissing(week) {
  if (!canPlan() || week < L.mondayOf(L.todayISO())) return [];
  try { if ((localStorage.getItem(DRAFT_SEEN) || '').split(',').includes(week)) return []; } catch (e) { /* weiter */ }
  const run = state.data.aiRuns.filter((r) => String(r.week_start).slice(0, 10) === week && r.status === 'freigegeben' && r.draft)
    .sort((a, b) => String(b.decided_at || '').localeCompare(String(a.decided_at || '')))[0];
  const list = state.data.shopping.filter((i) => i.week_start === week);
  if (!run || !list.length) return [];
  const names = L.dinnerNamesOf(state.data.dishes, (run.draft.plan || []).map((p) => p.dish));
  const onList = new Set(list.map((i) => L.itemKey(i.label)));
  return (run.draft.shopping || []).filter((x) => x && x.label && !onList.has(L.itemKey(x.label))
    && L.usesOf(x.purpose).some((u) => !L.isDinnerUse(u, names)));
}
// Steht alles auf einer einzigen Tour, obwohl die Woche einen Frischeeinkauf hat, schlägt die Liste die Aufteilung vor:
// Frisches für die Tage nach dem Frischeeinkauf dorthin, der Rest auf den Großeinkauf.
function splitPlan(week) {
  if (!canPlan() || week < L.mondayOf(L.todayISO())) return [];
  try { if ((localStorage.getItem(DRAFT_SEEN) || '').split(',').includes(week)) return []; } catch (e) { /* weiter */ }
  const list = state.data.shopping.filter((i) => i.week_start === week);
  const gen = list.filter((i) => !i.manual);
  if (!gen.length || L.tripsOf(gen).length > 1) return [];
  const trips = KI.shopTrips(week);
  if (trips[1].due < L.todayISO()) return [];
  const moves = list.map((i) => {
    const t = i.manual || i.checked ? trips[0] : L.tripFor(i, trips, week);
    return (i.trip || 'Einkauf') === t.trip && (i.due || null) === t.due ? null : { ...i, trip: t.trip, due: t.due };
  }).filter(Boolean);
  return moves.some((i) => i.trip === trips[1].trip) ? moves : [];
}
function draftBox(week) {
  const miss = draftMissing(week);
  const split = splitPlan(week);
  if (!miss.length && !split.length) return '';
  const frisch = split.filter((i) => i.trip === KI.shopTrips(week)[1].trip);
  const lines = [
    split.length ? `Alles steht auf einem Einkauf. ${frisch.length === 1 ? '1 frischer Posten' : `${frisch.length} frische Posten`} für die zweite Wochenhälfte ${frisch.length === 1 ? 'gehört' : 'gehören'} auf den ${esc(KI.shopTrips(week)[1].trip)}: ${esc(frisch.slice(0, 6).map((i) => i.label).join(', '))}${frisch.length > 6 ? ' und weitere' : ''}.` : '',
    miss.length ? `Aus Claudes Plan ${miss.length === 1 ? 'fehlt ein Posten' : `fehlen ${miss.length} Posten`} für die Brotboxen: ${esc(miss.map((x) => `${x.label}${x.qty ? ` (${x.qty})` : ''}`).join(', '))}.` : '',
  ].filter(Boolean);
  const label = split.length && miss.length ? 'Aufteilen und ergänzen' : split.length ? 'Aufteilen' : 'Auf die Liste';
  return `<div class="kasten-text vorrat-frage"><strong>Die Liste passt nicht ganz zur Woche</strong>
    ${lines.map((l) => `<p class="kasten-zeile">${l}</p>`).join('')}
    <div class="knopfreihe"><button class="knopf klein" data-action="entwurf-ergaenzen">${label}</button><button class="knopf zweit klein" data-action="entwurf-nicht">So lassen</button></div></div>`;
}
function splitApply(week) {
  const moves = splitPlan(week);
  if (!moves.length) return 0;
  commit(() => { state.data.shopping = state.data.shopping.map((i) => moves.find((m) => m.id === i.id) || i); }, () => store.saveItems(moves));
  return moves.filter((i) => i.trip === KI.shopTrips(week)[1].trip).length;
}
function draftAdd(week) {
  const miss = draftMissing(week);
  if (!miss.length) return 0;
  const list = state.data.shopping.filter((i) => i.week_start === week);
  const trips = L.tripsOf(list);
  let sort = list.length ? Math.max(...list.map((i) => i.sort || 0)) : 0;
  const items = miss.map((x) => {
    // Gleiche Tour wie bei Claude, sonst die Tour der Liste mit dem passenden Einkaufstag oder die erste.
    const t = trips.find((y) => y.trip === x.trip) || trips.find((y) => y.due && y.due === x.due) || trips[0] || { trip: x.trip || 'Einkauf', due: x.due || null };
    return {
      id: L.uid(), week_start: week, trip: t.trip, due: t.due || null, category: L.SHOP_CATS[x.category] ? x.category : 'sonst',
      label: String(x.label), qty: String(x.qty || ''), purpose: String(x.purpose || ''), missing: false, shop: x.shop === 'lidl' ? 'lidl' : null,
      sort: ++sort, checked: false, checked_by: null, checked_at: null, manual: false,
    };
  });
  commit(() => { state.data.shopping = [...state.data.shopping, ...items]; }, () => store.saveItems(items));
  return items.length;
}

function pantryConfirm(keys) {
  const week = state.week;
  const all = pantryChecks();
  const from = L.addDays(L.mondayOf(L.todayISO()), -14);
  const value = Object.fromEntries(Object.entries(all).filter(([w]) => w >= from));
  value[week] = { ...(value[week] || {}) };
  const by = state.me || null;
  for (const k of keys) value[week][k] = { by, at: new Date().toISOString() };
  const row = { key: 'vorrat_check', value, updated_at: new Date().toISOString() };
  // Wer nachgeschaut hat, hat den Vorrat gerade gesehen: Die Frage „Noch da?“ im Vorrat fängt von vorn an.
  const ids = new Set(pantryAsk(week).filter((x) => keys.includes(x.key)).map((x) => x.pantryId));
  const seen = state.data.pantry.filter((x) => ids.has(x.id)).map((x) => ({ ...x, have: true, seen_at: L.todayISO() }));
  commit(() => {
    state.data.settings = [...state.data.settings.filter((x) => x.key !== 'vorrat_check'), row];
    state.data.pantry = state.data.pantry.map((x) => seen.find((y) => y.id === x.id) || x);
  }, async () => { await store.saveSettings([row]); if (seen.length) await store.savePantry(seen); });
}
function pantryMissing(key) {
  const week = state.week;
  const x = pantryAsk(week).find((y) => y.key === key);
  if (!x) return;
  const today = L.todayISO();
  const inWeek = state.data.shopping.filter((i) => i.week_start === week).sort((a, b) => a.sort - b.sort);
  const old = inWeek.find((i) => i.category === 'vorhanden' && L.itemKey(i.label) === key);
  // Auf die nächste Tour, die noch kommt. Sind alle Touren vorbei, auf den Nachkauf.
  const trip = inWeek.find((i) => !i.manual && !i.checked && (!i.due || i.due >= today))
    || (inWeek.length ? { trip: 'Nachkauf', due: null } : null);
  const item = old
    ? { ...old, category: L.SHOP_CATS[x.category] ? x.category : L.guessCat(x.label), qty: x.qty, purpose: x.purpose, checked: false, checked_by: null, checked_at: null }
    : {
      id: L.uid(), week_start: week, trip: trip ? trip.trip || 'Einkauf' : 'Einkauf', due: trip ? trip.due || null : null,
      category: L.SHOP_CATS[x.category] ? x.category : L.guessCat(x.label), label: x.label, qty: x.qty, purpose: x.purpose,
      missing: false, shop: null, sort: (inWeek.length ? Math.max(...inWeek.map((i) => i.sort || 0)) : 0) + 1,
      checked: false, checked_by: null, checked_at: null, manual: false,
    };
  const pan = state.data.pantry.find((y) => y.id === x.pantryId);
  const empty = pan ? { ...pan, have: false } : null;
  commit(() => {
    state.data.shopping = old ? state.data.shopping.map((i) => (i.id === old.id ? item : i)) : [...state.data.shopping, item];
    if (empty) state.data.pantry = state.data.pantry.map((y) => (y.id === empty.id ? empty : y));
  }, async () => { await store.saveItems([item]); if (empty) await store.savePantry([empty]); });
  toast(`${x.label} steht jetzt auf der Liste${item.trip && item.trip !== 'Einkauf' ? ` (${item.trip})` : ''}.`);
}

function viewEinkauf() {
  const items = state.data.shopping.filter((i) => i.week_start === state.week).sort((a, b) => a.sort - b.sort);
  const hasPlan = L.weekDays(state.week).some((d) => { const p = planOf(d); return p && p.dish_id; });
  const addForm = `<form class="dazu" data-form="posten">
      <input class="feld" id="neu-posten" name="label" aria-label="Eigenen Eintrag ergänzen" placeholder="Etwas ergänzen, z. B. Spülmittel" value="${esc(state.draft)}" autocomplete="off" enterkeyhint="done">
      ${lidlOn() ? `<select class="feld markt-wahl" name="shop" aria-label="Markt"><option value="">Aldi</option><option value="lidl"${state.draftShop === 'lidl' ? ' selected' : ''}>Lidl</option></select>` : ''}
      <button class="knopf">Dazu</button></form>`;
  if (!items.length) {
    return `<div class="leer"><h2 class="abschnitt">Für diese Woche gibt es noch keine Einkaufsliste</h2>
      ${hasPlan && canPlan()
        ? '<p>Die Zutaten aller geplanten Gerichte werden zusammengerechnet.</p><div class="knopfreihe"><button class="knopf" data-action="liste-bauen">Aus dem Wochenplan erstellen</button></div>'
        : hasPlan ? '<p>Mama oder Papa erstellen die Liste aus dem Wochenplan.</p>' : '<p>Plant zuerst die Woche, dann entsteht die Liste daraus.</p><div class="knopfreihe"><button class="knopf" data-action="tab" data-tab="woche">Zum Wochenplan</button></div>'}
      </div>${addForm}${shopTools(false, 0)}${dueElsewhere()}`;
  }
  const done = items.filter((i) => i.checked).length;
  // Touren nach Einkaufstag, ohne Tag zum Schluss.
  const tripDue = (t) => items.filter((i) => (i.trip || 'Einkauf') === t && i.due).map((i) => i.due).sort()[0] || '9999';
  const trips = [...new Set(items.map((i) => i.trip || 'Einkauf'))].sort((a, b) => tripDue(a).localeCompare(tripDue(b)));
  let list = '';
  for (const trip of trips) {
    const inTrip = items.filter((i) => (i.trip || 'Einkauf') === trip);
    // Zwei Märkte: Was bei Lidl gekauft wird, steht in einem eigenen Block unter Aldi.
    const shops = inTrip.some((i) => KI.shopOf(i) === 'lidl') ? ['', 'lidl'] : [''];
    let block = '';
    for (const shop of shops) {
      const inShop = inTrip.filter((i) => KI.shopOf(i) === shop);
      let part = '';
      for (const cat of catOrder(shop)) {
        const rows = inShop.filter((i) => (L.SHOP_CATS[i.category] ? i.category : 'sonst') === cat && !((state.hideDone || state.shopMode) && i.checked && i.id !== state.justChecked));
        if (!rows.length) continue;
        part += `<h3 class="abteilung">${L.SHOP_CATS[cat]}</h3><ul class="posten">${rows.map(itemRow).join('')}</ul>`;
      }
      if (shops.length > 1) {
        const open = inShop.filter((i) => !i.checked).length;
        block += `<div class="markt markt-${shop || 'aldi'}"><h3 class="markt-kopf"><span class="markt-name">${KI.SHOPS[shop]}</span> <span class="markt-ort">${KI.SHOP_PLACES[shop]}</span><span class="markt-zahl">${open ? `${open} offen` : 'erledigt'}</span></h3>${part}</div>`;
      } else block += part;
    }
    if (block) list += `${trips.length > 1 ? `<h2 class="tour">${esc(trip)}</h2>` : ''}${dueLine(trip, inTrip)}${missingBox(trip, inTrip, trips)}${block}`;
  }
  if (!list) list = '<div class="leer"><h2 class="abschnitt">Alles erledigt</h2><p>Jeder Eintrag ist abgehakt.</p></div>';
  if (state.shopMode) {
    return `<div class="modus-leiste"><span><b>Einkaufsmodus</b> ${items.length - done} offen</span><button class="knopf klein" data-action="einkaufsmodus">Beenden</button></div>
      <div class="balken" role="progressbar" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${done}" aria-label="Einkauf erledigt"><span style="width:${Math.round((done / items.length) * 100)}%"></span></div>
      ${pantryBox(state.week)}${list}${addForm}`;
  }
  return `${dueElsewhere()}${draftBox(state.week)}${pantryBox(state.week)}<div class="fortschritt">
      <div class="zeile"><span class="gross">${done} von ${items.length} erledigt</span>
      <label class="schalter"><input type="checkbox" data-action="erledigte"${state.hideDone ? ' checked' : ''}> Erledigte ausblenden</label></div>
      <button class="knopf klein modus-start" data-action="einkaufsmodus">Einkaufsmodus</button>
      <div class="balken" role="progressbar" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${done}" aria-label="Einkauf erledigt"><span style="width:${Math.round((done / items.length) * 100)}%"></span></div>
    </div>${list}${addForm}
    ${shopTools(hasPlan, done)}`;
}
// Werkzeuge unter der Einkaufsliste, in zwei Gruppen.
function shopTools(hasPlan, done) {
  const chip = (action, label) => `<button class="knopf zweit klein" data-action="${action}">${label}</button>`;
  const add = [canPlan() ? '<label class="knopf zweit klein foto-knopf"><input type="file" id="zutaten-foto" accept="image/*" multiple>Zutaten aus Foto</label>' : '',
    chip('immer', 'Immer wieder'), canPlan() ? chip('siri', 'Per Siri') : ''].join('');
  const list = [hasPlan && canPlan() ? chip('liste-bauen', 'Aus dem Plan neu erstellen') : '', chip('vorrat', pantryHint()), chip('laufweg-oeffnen', 'Reihenfolge im Laden'), chip('packungen', 'Packungsgrößen'),
    done ? chip('erledigte-loeschen', 'Erledigte löschen') : ''].join('');
  return `<div class="werkzeuge"><div class="w-gruppe"><h3>Mehr ergänzen</h3><div class="w-knoepfe">${add}</div></div>
    <div class="w-gruppe"><h3>Liste</h3><div class="w-knoepfe">${list}</div></div></div>`;
}
// Kleine Marke „Saison“ bei Obst und Gemüse aus der Region, solange die Regel eingeschaltet ist.
function seasonMark(item) {
  if (item.category !== 'obst' || item.checked || KI.rulesOf(state.data.settings).saison === false) return '';
  const day = item.due || L.addDays(item.week_start, 3);
  return KI.isSeasonal(item.label, Number(day.slice(5, 7))) ? ' <span class="marke saison">Saison</span>' : '';
}
function pantryHint() {
  const n = pantryToCheck().length;
  return n ? `Vorrat: ${n === 1 ? '1 Sache prüfen' : `${n} Sachen prüfen`}` : 'Vorrat: Was haben wir noch?';
}

// Was beim Einkauf nicht zu bekommen war: Übersicht mit betroffenen Gerichten und Knopf zum Verschieben.
function nextTrip(trip, trips) {
  const n = trips.indexOf(trip);
  return n >= 0 && n < trips.length - 1 ? trips[n + 1] : 'Nachkauf';
}
const lidlOn = () => KI.rulesOf(state.data.settings).lidl !== false;

/* ---------- Packungsgrößen ---------- */

// Gespeichert in ep_settings unter "packungen" (siehe js/packungen.js).
const packsAll = () => { const v = KI.settingOf(state.data.settings, 'packungen'); return v && typeof v === 'object' ? v : {}; };
function savePacks(all) {
  const row = { key: 'packungen', value: all, updated_at: new Date().toISOString() };
  commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'packungen'), row]; }, () => store.saveSettings([row]));
}
// Wofür ein Posten in seiner Woche gebraucht wird: Gericht, Tag und Rezeptzutat.
function packUses(item) {
  const days = L.weekDays(item.week_start);
  const out = [];
  for (const p of state.data.plan.filter((x) => days.includes(x.day) && x.dish_id && !x.skipped).sort(byDay)) {
    const dish = dishById(p.dish_id);
    if (!dish || out.some((u) => u.dish.id === dish.id)) continue;
    const i = P.findIngredient(dish.ingredients, item.label);
    if (i >= 0) out.push({ dish, day: p.day, index: i, ing: dish.ingredients[i] });
  }
  return out;
}
// Menge auf der Liste: „500 g“ oder bei Packungen der Teil „(für 500 g)“.
function itemNeed(item) {
  const qty = String(item.qty || '');
  const inner = qty.match(/für ([^)]*)\)/);
  const text = /packung/i.test(qty) ? (inner ? inner[1] : '') : qty;
  const m = text.match(/^\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|stück|stk)?/i);
  return m ? P.parseSize(`${m[1]} ${m[2] || 'Stück'}`) : null;
}
const packSentence = (item) => (/packung/i.test(item.qty || '') ? '' : (() => { const p = P.packFor(packsAll(), item.label); return p ? `Packung ${P.fmtSize(p.q, p.u)}` : ''; })());

function sheetPack({ id }) {
  const item = state.data.shopping.find((i) => i.id === id);
  if (!item) return { over: '', title: 'Nicht gefunden', body: '' };
  const d = state.packDraft && state.packDraft.id === id ? state.packDraft : null;
  const known = P.packFor(packsAll(), item.label);
  const uses = packUses(item);
  const use = uses.length === 1 ? uses[0] : null;
  const need = use ? P.needOf(use.ing) : itemNeed(item);
  if (!d || !d.size) {
    return {
      over: 'Packungsgröße',
      title: item.label,
      body: `<p class="meta" style="margin-bottom:12px">${need ? `Gebraucht werden ${esc(P.fmtSize(need.q, need.u))}` : `Auf der Liste: ${esc(item.qty || 'ohne Menge')}`}${use ? ` für ${esc(L.shortDish(use.dish.name))} am ${esc(L.WD_SHORT[L.wdIndex(use.day)])}` : uses.length > 1 ? ` für ${uses.length} Gerichte` : ''}.</p>
      <form class="form" data-form="packung-groesse"><input type="hidden" name="id" value="${esc(id)}">
        <label>Welche Packungsgröße gibt es bei ${esc(KI.SHOPS[KI.shopOf(item)])}?<input class="feld" name="groesse" required placeholder="z. B. 400 g, 1 kg oder 6 Stück" value="${esc(known ? P.fmtSize(known.q, known.u) : '')}" autocomplete="off" data-autofocus></label>
        <button class="knopf breit">Weiter</button></form>
      <p class="meta unter">Die App merkt sich die Größe für alle Rezepte, und Claude plant künftig mit ganzen Packungen.</p>`,
    };
  }
  const { size, options: o } = d;
  const fmtF = (f) => `× ${String(Math.round(f * 100) / 100).replace('.', ',')}`;
  const portions = (f) => { const n = P.servingsFor(f); return n > 4 ? `Ergibt etwa ${n} Portionen. ${n - 4 === 1 ? 'Eine Portion bleibt für den Tag danach und kommt' : `${n - 4} Portionen bleiben für den Tag danach und kommen`} auf „Was muss weg?“.` : 'Reicht für 4.'; };
  const fresh = P.isFresh(use.ing.c || item.category);
  const keeps = ['tk', 'vorrat'].includes(use.ing.c || item.category);
  const rest = o.rest <= 0 ? 'Es bleibt nichts übrig.' : keeps ? `${P.fmtSize(o.rest, size.u)} bleiben im Vorrat.`
    : `${P.fmtSize(o.rest, size.u)} bleiben übrig und kommen auf „Was muss weg?“.${fresh ? ' Weil es frisch ist: einfrieren oder in zwei Tagen verbrauchen.' : ''}`;
  const opt = (key, title, text) => `<label class="pack-wahl"><input type="radio" name="wahl" value="${key}"${o.rec === key ? ' checked' : ''}>
    <span><span class="pw-titel">${esc(title)}${o.rec === key ? ' <span class="marke">Vorschlag</span>' : ''}</span><span class="pw-text">${esc(text)}</span></span></label>`;
  return {
    over: `${item.label}, Packung ${P.fmtSize(size.q, size.u)}`,
    title: 'Rezept anpassen?',
    body: `<p class="meta" style="margin-bottom:12px">${esc(L.shortDish(use.dish.name))} braucht ${esc(P.fmtSize(need.q, need.u))}.</p>
      <form class="form" data-form="packung-wahl"><input type="hidden" name="id" value="${esc(id)}">
        ${o.f1 >= 0.5 && o.f1 <= 2 ? opt('a', `Auf 1 Packung (${P.fmtSize(size.q, size.u)}) umrechnen`, `Alle Zutaten ${fmtF(o.f1)}. ${portions(o.f1)} Das Rezept bleibt so gespeichert.`) : ''}
        ${o.f2 >= 0.5 && o.f2 <= 2 ? opt('b', `Auf 2 Packungen (${P.fmtSize(2 * size.q, size.u)}) umrechnen`, `Alle Zutaten ${fmtF(o.f2)}. ${portions(o.f2)} Das Rezept bleibt so gespeichert.`) : ''}
        ${opt('c', 'Rezept lassen', `${P.packText(o.count, size)} kaufen. ${rest} Gilt nur dieses Mal.`)}
        <button class="knopf breit">Übernehmen</button></form>`,
  };
}

function sheetPacks() {
  const all = Object.entries(packsAll()).sort((a, b) => a[1].name.localeCompare(b[1].name, 'de'));
  const items = state.data.shopping.filter((i) => i.week_start === state.week && !i.checked && i.category !== 'vorhanden' && itemNeed(i) && !/packung/i.test(i.qty || ''))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));
  return {
    over: 'Einkaufsliste',
    title: 'Packungsgrößen',
    body: `<p class="meta" style="margin-bottom:12px">Wie es die Sachen im Markt wirklich gibt. Claude plant damit ganze Packungen, und die Einkaufsliste rechnet in Packungen. Größen vom Kassenzettel kommen von selbst dazu.</p>
      ${items.length ? `<details class="pack-auswahl"><summary>Aus der Einkaufsliste wählen</summary><ul class="posten">${items.map((i) => `<li><button class="g-zeile" data-action="packung" data-id="${esc(i.id)}"><span class="tz-text"><span class="tz-name">${esc(i.label)}</span><span class="tz-meta">${esc(i.qty)}</span></span></button></li>`).join('')}</ul></details>` : ''}
      ${all.length ? `<h3 class="abteilung">Bekannt</h3><ul class="posten">${all.map(([key, p]) => `<li><div class="extra-zeile"><span class="p-text"><span class="p-name">${esc(p.name)}</span><span class="p-menge">${esc(P.fmtSize(p.q, p.u))}${p.markt === 'lidl' ? ', Lidl' : ''}${p.quelle === 'kassenzettel' ? ', vom Kassenzettel' : ''}</span></span>
        <button class="weg" data-action="packung-weg" data-key="${esc(key)}" aria-label="${esc(p.name)} löschen">${CROSS}</button></div></li>`).join('')}</ul>` : '<p class="meta">Noch keine Packungsgröße eingetragen.</p>'}
      <h3 class="abteilung">Dazuschreiben</h3>
      <form class="dazu" data-form="packung-neu"><input class="feld" name="name" placeholder="z. B. Putenbrustfilet" aria-label="Produkt" required autocomplete="off">
        <input class="feld pack-groesse" name="groesse" placeholder="400 g" aria-label="Packungsgröße" required autocomplete="off"><button class="knopf">Dazu</button></form>`,
  };
}

function missingBox(trip, inTrip, trips) {
  const miss = inTrip.filter((i) => i.missing && !i.checked);
  if (!miss.length) return '';
  const rows = miss.map((i) => {
    const p = L.purposeOf(i, state.data.plan, state.data.dishes);
    return `<li><span class="fehlt-text">${esc(i.label)}${p ? `<span class="p-wofuer">betrifft ${esc(p)}</span>` : ''}</span><span class="w-knoepfe"><button class="knopf zweit klein" data-action="packung" data-id="${esc(i.id)}">Andere Größe</button>${canPlan() ? `<button class="knopf zweit klein" data-action="ersatz" data-id="${esc(i.id)}">Ersatz?</button>` : ''}</span></li>`;
  }).join('');
  return `<div class="kasten-text fehlt-kasten"><strong>${miss.length === 1 ? '1 Posten nicht bekommen' : `${miss.length} Posten nicht bekommen`}</strong>
    <ul>${rows}</ul>
    <div class="knopfreihe" style="margin-top:10px">${nextTrip(trip, trips) !== trip ? `<button class="knopf zweit" data-action="fehlt-verschieben" data-trip="${esc(trip)}">Auf „${esc(nextTrip(trip, trips))}“ setzen</button>` : ''}
    ${lidlOn() && canPlan() ? `<button class="knopf zweit" data-action="fehlt-markt" data-trip="${esc(trip)}">${miss.every((i) => KI.shopOf(i) === 'lidl') ? 'Bei Aldi versuchen' : 'Bei Lidl versuchen'}</button>` : ''}</div></div>`;
}

// Einkaufstag einer Tour: An diesem Tag bekommen die Eltern morgens eine Push-Nachricht.
// Schätzung über einer Tour, sobald für genug Posten Preise aus den Kassenzetteln bekannt sind.
function tripCost(inTrip) {
  if (!state.data.receipts.length) return '';
  const since = L.addDays(L.todayISO(), -120);
  const e = HB.tripEstimate(inTrip, state.data.receipts.filter((r) => String(r.day || '') >= since));
  if (e.known < 3 || e.known < e.total * 0.3) return '';
  return `<p class="meta tour-kosten">Etwa ${HB.euroShort(e.sum)}${e.lidl >= 1 ? `, davon Lidl ${HB.euroShort(e.lidl)}` : ''}. Geschätzt mit euren Preisen für ${e.known} von ${e.total} Posten.</p>`;
}
function dueLine(trip, inTrip) {
  const due = inTrip.map((i) => i.due).find(Boolean) || '';
  const open = inTrip.filter((i) => !i.checked).length;
  const text = due
    ? `Einkaufstag ${esc(L.fmtShort(due))}${due === L.todayISO() && open ? ', heute' : ''}`
    : 'Noch kein Einkaufstag festgelegt';
  const buyerId = inTrip.map((i) => i.buyer).find(Boolean) || null;
  const buyer = personById(buyerId);
  const mine = buyerId && buyerId === state.me;
  const who = buyer ? `<p class="einkaeufer">${mine ? 'Du gehst einkaufen.' : `${esc(buyer.name)} geht einkaufen.`}</p>` : '';
  const est = tripCost(inTrip);
  if (!canPlan()) return (due ? `<p class="meta einkaufstag">${text}</p>` : '') + est + who;
  const claim = `<label class="schalter einkaeufer"><input type="checkbox" data-action="einkauf-uebernehmen" data-trip="${esc(trip)}"${mine ? ' checked' : ''}>
      ${buyer && !mine ? `${esc(buyer.name)} geht einkaufen. Stattdessen ich` : 'Ich gehe einkaufen'}</label>`;
  return claim + est + `<details class="einkaufstag"${due ? '' : ' open'}><summary class="meta">${text}${due ? ' <span class="textknopf">ändern</span>' : ''}</summary>
    <form class="dazu" data-form="einkaufstag"><input type="hidden" name="trip" value="${esc(trip)}">
      <input class="feld" type="date" name="due" value="${esc(due)}" aria-label="Einkaufstag für ${esc(trip)}">
      <button class="knopf">${due ? 'Ändern' : 'Festlegen'}</button></form>
    <p class="meta">Am Einkaufstag kommt um 7 Uhr eine Erinnerung an Mama und Papa, solange noch etwas offen ist.</p></details>`;
}

function itemRow(item) {
  const who = item.checked && personById(item.checked_by);
  const sub = [item.qty, !item.checked ? packSentence(item) : '', who ? `abgehakt von ${who.name}` : ''].filter(Boolean).join(', ');
  const purpose = L.purposeOf(item, state.data.plan, state.data.dishes);
  return `<li class="${item.checked ? 'erledigt' : ''}${item.missing ? ' fehlt' : ''}${state.justChecked === item.id ? ' gerade-abgehakt' : ''}">
    <button class="haken-knopf" data-action="haken" data-id="${esc(item.id)}" aria-pressed="${!!item.checked}">
      <span class="kasten">${CHECK}</span>
      <span class="p-text"><span class="p-name">${esc(item.label)}${item.missing ? ' <span class="marke warn">nicht bekommen</span>' : ''}${seasonMark(item)}</span>${sub ? `<span class="p-menge">${esc(sub)}</span>` : ''}${purpose ? `<span class="p-wofuer">für ${esc(purpose)}</span>` : ''}</span></button>
    ${!item.checked && item.category !== 'vorhanden' && (state.shopMode || item.missing) ? `<button class="fehlt-knopf" data-action="fehlt" data-id="${esc(item.id)}" aria-pressed="${!!item.missing}" aria-label="${esc(item.label)} ${item.missing ? 'doch bekommen' : 'nicht bekommen'}">${item.missing ? 'doch da' : 'fehlt'}</button>` : ''}
    ${item.manual ? `<button class="weg" data-action="posten-weg" data-id="${esc(item.id)}" aria-label="${esc(item.label)} entfernen">${CROSS}</button>` : ''}</li>`;
}

/* ---------- Gerichte ---------- */

function dishRow(dish) {
  const s = stats[dish.id] || { served: 0 };
  const bits = [];
  if (s.avg != null) bits.push(`${avgHtml(s)} aus ${s.count}`);
  if (s.hearts) bits.push(`<span class="herz-mini">${HEART}${s.hearts}</span>`);
  if (L.isDinner(dish)) bits.push(esc(L.rhythmLabel(s)));
  const nr = N.nutrition(dish);
  const nv = nr.values;
  if (nv) bits.push(`${N.fmtValue('kcal', nv.kcal, nr.source === 'eingetragen')} kcal, ${N.fmtValue('protein', nv.protein)} g Eiweiß${dish.pieces ? ' pro Stück' : ''}`);
  const cost = KI.costOf(state.data.settings, dish);
  if (cost) bits.push(`etwa ${HB.euro(cost.portion)} pro ${cost.unit}`);
  return `<li class="${s.archived ? 'raus' : ''}"><button class="g-zeile" data-action="gericht" data-id="${esc(dish.id)}">
    ${L.isDinner(dish) ? `<span class="mal"><span class="n">${s.served}</span><span class="x">mal dran</span></span>` : `<span class="mal"><span class="n">${dish.pieces || 1}</span><span class="x">${dish.pieces ? 'Stück' : 'Rezept'}</span></span>`}
    <span class="tz-text"><span class="tz-name">${esc(dish.name)}${dish.favorite ? ' <span class="marke lieb">Liebling</span>' : ''}${pauseMark(dish)}</span><span class="tz-meta">${bits.join(', ')}</span>${ampelDots(dish)}</span></button></li>`;
}

function dishCostLine(dish) {
  const c = KI.costOf(state.data.settings, dish);
  if (!c) return '';
  return `<p class="meta kosten-zeile">Zutaten etwa ${HB.euro(c.euro)}${c.unit === 'Portion' ? ` für 4 Portionen, ${HB.euro(c.portion)} pro Portion` : c.unit === 'Stück' ? `, ${HB.euro(c.portion)} pro Stück` : ''} (geschätzt, Stand ${esc(L.fmtShort(c.stand))})</p>`;
}

function costNote() {
  const v = KI.settingOf(state.data.settings, 'kosten');
  const has = v && v.gerichte && Object.keys(v.gerichte).length;
  return `<p class="meta kosten-stand">${has ? `Geschätzte Kosten der Zutaten, Stand ${esc(L.fmtShort(v.stand))}, ${v.kassenzettel ? `mit euren Preisen aus ${v.kassenzettel} Kassenzetteln` : 'nach üblichen Discounter-Preisen'}. Sonntags frischt die App das auf.` : 'Noch keine Kosten geschätzt.'}
    ${canPlan() ? `<button class="textknopf" data-action="kosten-schaetzen" style="padding:0"${state.costBusy ? ' disabled' : ''}>${state.costBusy ? 'Wird geschätzt …' : 'Jetzt schätzen'}</button>` : ''}</p>`;
}

function pauseMark(dish) {
  return dish.pause_until && dish.pause_until >= L.todayISO() ? ` <span class="marke">Pause bis ${esc(L.fmtShort(dish.pause_until))}</span>` : '';
}

function viewGerichte() {
  const all = [...state.data.dishes];
  const sorters = {
    beliebt: (a, b) => L.ratingFactor(stats[b.id].avg) - L.ratingFactor(stats[a.id].avg) || a.name.localeCompare(b.name, 'de'),
    oft: (a, b) => stats[b.id].served - stats[a.id].served || a.name.localeCompare(b.name, 'de'),
    az: (a, b) => a.name.localeCompare(b.name, 'de'),
    preis: (a, b) => ((KI.costOf(state.data.settings, a) || { portion: 999 }).portion - (KI.costOf(state.data.settings, b) || { portion: 999 }).portion) || a.name.localeCompare(b.name, 'de'),
  };
  all.sort(sorters[state.sort]);
  const boxes = all.filter((d) => !L.isDinner(d));
  const active = all.filter((d) => L.isDinner(d) && !stats[d.id].archived);
  const out = all.filter((d) => L.isDinner(d) && stats[d.id].archived);
  const sortBtn = (id, label) => `<button data-action="sortieren" data-sort="${id}" aria-pressed="${state.sort === id}">${label}</button>`;
  return `${planerCard()}<h2 class="abschnitt mit-info">${active.length} Gerichte im Umlauf ${infoBtn('gerichte', 'Wie Gerichte auf den Plan kommen')}</h2>
    ${infoText('gerichte', `Viele Sterne und jedes Herz der Kinder bringen ein Gericht schneller zurück auf den Plan. Liegt der Schnitt unter ${L.RULE.threshold} Sternen und haben mindestens ${L.RULE.minRaters} von euch bewertet, wird es aussortiert.${seesAmpel() ? ' Die vier Punkte stehen für Fett, gesättigtes Fett, Zucker und Salz pro Portion: grün wenig, gelb mittel, rot viel.' : ''} „Rezept aus Foto“ liest Fotos oder Screenshots, zum Beispiel aus Cookidoo, von einer Kochbox-Karte oder aus dem Kochbuch, bis zu vier pro Rezept.`)}
    ${canPlan() ? `<div class="neu-rezept"><label class="knopf klein foto-knopf"><input type="file" id="rezept-foto" accept="image/*" multiple>Rezept aus Foto</label>
    <button class="knopf zweit klein" data-action="gericht-neu">Eigenes Rezept</button></div>` : ''}
    <div class="sortierung" role="group" aria-label="Sortierung">${sortBtn('beliebt', 'Beliebt')}${sortBtn('oft', 'Oft dran')}${sortBtn('preis', 'Günstig')}${sortBtn('az', 'A bis Z')}</div>
    ${state.sort === 'preis' ? costNote() : ''}
    <ul class="gerichte">${active.map(dishRow).join('')}</ul>
    ${out.length ? `<h2 class="abschnitt" style="margin-top:26px">Aussortiert</h2><ul class="gerichte">${out.map(dishRow).join('')}</ul>` : ''}
    ${boxes.length ? `<h2 class="abschnitt" style="margin-top:26px">Brotbox-Rezepte</h2><p class="meta" style="margin:-4px 2px 14px">Zum Vorbereiten für die Brotbox. Diese Rezepte kommen nicht in den Abendessen-Plan.</p><ul class="gerichte">${boxes.map(dishRow).join('')}</ul>` : ''}
    ${lunchTop()}
    <div class="fuss"><button class="textknopf" data-action="moegen" data-year="${L.todayISO().slice(0, 4)}">Was mögen wir? Unsere Auswertung ${L.todayISO().slice(0, 4)}</button></div>
`;
}

// Brotboxen nach Bewertung der Kinder, gruppiert nach Text.
function lunchTop() {
  const groups = new Map();
  for (const r of state.data.lunchRatings) {
    if (!r.lunchbox) continue;
    const g = groups.get(r.lunchbox) || { text: r.lunchbox, sum: 0, n: 0, last: r.day };
    g.sum += r.stars; g.n += 1;
    if (r.day > g.last) g.last = r.day;
    groups.set(r.lunchbox, g);
  }
  if (!groups.size) return '';
  const list = [...groups.values()].sort((a, b) => b.sum / b.n - a.sum / a.n || b.n - a.n).slice(0, 10);
  return `<h2 class="abschnitt" style="margin-top:26px">Brotboxen der Kinder</h2>
    <p class="meta" style="margin:-4px 2px 14px">Die Favoriten gehören in den nächsten Plan.</p>
    <ul class="gerichte">${list.map((g) => `<li><div class="g-zeile">
      <span class="mal"><span class="n">${L.fmtStars(g.sum / g.n)}</span><span class="x">Sterne</span></span>
      <span class="tz-text"><span class="tz-name brotbox-text">${esc(g.text)}</span><span class="tz-meta">${g.n} ${g.n === 1 ? 'Bewertung' : 'Bewertungen'}, zuletzt am ${L.fmtShort(g.last)}</span></span></div></li>`).join('')}</ul>`;
}

/* ---------- Termine und Abendessen ---------- */

const dinnerOf = (day) => T.dinnerInfo(state.data.persons, state.data.events, state.data.attendance, day);
const hm = (min) => T.toHM(min);

const guestsOf = (day) => Math.max(0, Number((planOf(day) || {}).guests) || 0);

function dinnerNotes(info, day) {
  const notes = [];
  const g = day ? guestsOf(day) : 0;
  if (g) notes.push(g === 1 ? '1 Gast kommt dazu' : `${g} Gäste kommen dazu`);
  for (const x of info.later) notes.push(`${x.person.name} kommt um ${hm(x.home)}${x.reason ? ` vom ${x.reason}` : ''}${info.afterDinner.includes(x) ? ', isst später' : ''}`);
  for (const x of info.leaving) notes.push(`${x.person.name} muss um ${hm(x.leaves.at)} los${x.leaves.title ? ` zum ${x.leaves.title}` : ''}`);
  for (const x of info.away) notes.push(`${x.person.name} isst nicht mit`);
  return notes;
}

// Kurze Zeile für das Kalenderblatt.
function dinnerLine(day) {
  const info = dinnerOf(day);
  const notes = dinnerNotes(info, day);
  return `<p class="essenszeit${info.late ? ' spaet' : ''}"><span class="uhr">${info.time}</span> Abendessen${notes.length ? `<span class="essen-notiz">${esc(notes.join('. '))}.</span>` : ''}</p>
    ${info.late ? '<p class="meta">Spät heute. Vielleicht vorkochen und aufwärmen, oder die Kinder bekommen vorher einen Snack.</p>' : ''}
    ${info.afterDinner.length ? `<p class="meta">Für ${esc(info.afterDinner.map((x) => x.person.name).join(' und '))} eine Portion zur Seite stellen.</p>` : ''}`;
}

// Ausführlich im Tagesbogen, mit Termine und Auswahl, wer mitisst.
function dinnerBlock(day) {
  const info = dinnerOf(day);
  const notes = dinnerNotes(info, day);
  const edit = (p) => canPlan() || p.id === state.me;
  const rows = info.people.map((x) => {
    const p = x.person;
    const own = state.data.attendance.find((a) => a.day === day && a.person_id === p.id);
    const val = own ? own.status : 'auto';
    const dis = edit(p) ? '' : ' disabled';
    const autoText = x.manual ? 'wie die Termine' : x.status === 'spaet' ? `später, ${hm(x.home)}` : 'dabei';
    return `<div class="mitesser">${avatar(p, true)}<span class="m-name">${esc(p.name)}</span>
      <select class="feld klein" name="st-${esc(p.id)}" aria-label="${esc(p.name)} beim Abendessen"${dis}>
        <option value="auto"${val === 'auto' ? ' selected' : ''}>${esc(autoText)}</option>
        <option value="da"${val === 'da' ? ' selected' : ''}>dabei</option>
        <option value="spaet"${val === 'spaet' ? ' selected' : ''}>später</option>
        <option value="weg"${val === 'weg' ? ' selected' : ''}>isst nicht mit</option></select>
      <input class="feld klein zeit" type="time" name="t-${esc(p.id)}" aria-label="Uhrzeit für ${esc(p.name)}" value="${esc(own && own.time ? own.time : x.home != null ? hm(x.home) : '19:30')}"${dis}></div>`;
  }).join('');
  const evs = info.events.map((e) => `<li>${esc((e.who || []).map((id) => (personById(id) || {}).name).filter(Boolean).join(', '))}: ${esc(e.title)}, ${esc(e.start_time || '')}${e.end_time ? ` bis ${esc(e.end_time)}` : ''}${e.home_time ? `, zu Hause ${esc(e.home_time)}` : ''}</li>`).join('');
  return `<div class="kasten-text abend">
    <strong>Abendessen um ${info.time}</strong>${notes.length ? `${esc(notes.join('. '))}.` : 'Alle sind dabei.'}
    ${evs ? `<ul class="termine-tag">${evs}</ul>` : ''}
    <details><summary>Wer isst mit?</summary>
    <form class="form" data-form="anwesenheit"><input type="hidden" name="day" value="${day}">${rows}
    ${canPlan() ? `<label class="gaeste">Gäste zum Essen<input class="feld klein" type="number" name="gaeste" min="0" max="20" inputmode="numeric" value="${guestsOf(day)}"></label>` : ''}
    <p class="meta">„Später“ mit Uhrzeit, wann die Person zu Hause ist. Gegessen wird um 18:30 Uhr oder sobald alle da sind. Mit Gästen rechnen Rezept und Einkaufsliste die Mengen für den Tag hoch.</p>
    <button class="knopf">Speichern</button></form></details></div>`;
}

function sheetEvents() {
  const wdNames = (e) => (e.weekdays || []).slice().sort().map((w) => L.WD_SHORT[w]).join(', ');
  const rows = [...state.data.events].sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.title.localeCompare(b.title, 'de')).map((e) => `<li${e.active === false ? ' class="raus"' : ''}>
    <button class="g-zeile" data-action="${canPlan() ? 'termin-bearbeiten' : 'termine'}" data-id="${esc(e.id)}">
      <span class="mal"><span class="n klein">${esc(wdNames(e))}</span></span>
      <span class="tz-text"><span class="tz-name">${esc(e.title)}</span>
      <span class="tz-meta">${esc([(e.who || []).map((id) => (personById(id) || {}).name).filter(Boolean).join(', '), `${e.start_time || ''}${e.end_time ? ` bis ${e.end_time}` : ''}`, e.home_time ? `zu Hause ${e.home_time}` : '', e.pause_ferien ? 'Pause in den Ferien' : ''].filter(Boolean).join(', '))}</span></span></button></li>`).join('');
  return {
    over: 'Familie',
    title: 'Termine',
    body: `<p class="meta" style="margin-bottom:12px">Wiederkehrende Termine wie Training, Ballett oder Dienste. Daraus ergibt sich, wann gegessen wird: um 18:30 Uhr, oder sobald alle zu Hause sind. Termine, die erst zur Essenszeit beginnen, verschieben nichts. An vollen Tagen schlägt die App nur Rezepte bis ${T.BUSY_MAX_MIN} Minuten vor.</p>
      ${rows ? `<ul class="gerichte">${rows}</ul>` : '<p class="meta">Noch keine Termine eingetragen.</p>'}
      ${canPlan() ? '<div class="knopfreihe"><button class="knopf" data-action="termin-neu">Termin eintragen</button></div>' : ''}`,
  };
}

function sheetEventForm({ id }) {
  const e = id ? state.data.events.find((x) => x.id === id) : null;
  return {
    over: e ? 'Termin bearbeiten' : 'Neuer Termin',
    title: e ? e.title : 'Termin eintragen',
    body: `<form class="form" data-form="termin"><input type="hidden" name="id" value="${esc(id || '')}">
      <label>Was<input class="feld" name="title" required maxlength="60" placeholder="z. B. Handballtraining, Ballett, Spätdienst" value="${esc(e ? e.title : '')}"></label>
      <fieldset class="feldgruppe"><legend>Wer</legend><div class="monate">${state.data.persons.map((p) => `<label class="schalter"><input type="checkbox" name="who" value="${esc(p.id)}"${e && (e.who || []).includes(p.id) ? ' checked' : ''}> ${esc(p.name)}</label>`).join('')}</div></fieldset>
      <fieldset class="feldgruppe"><legend>An welchen Tagen</legend><div class="monate tage">${L.WD_SHORT.map((w, i) => `<label class="schalter"><input type="checkbox" name="weekdays" value="${i}"${e && (e.weekdays || []).includes(i) ? ' checked' : ''}> ${w}</label>`).join('')}</div></fieldset>
      <div class="zwei"><label>Von<input class="feld" type="time" name="start_time" required value="${esc(e ? e.start_time || '' : '')}"></label>
      <label>Bis<input class="feld" type="time" name="end_time" value="${esc(e ? e.end_time || '' : '')}"></label></div>
      <label>Wieder zu Hause um <small>leer lassen, wenn es das Ende des Termins ist</small><input class="feld" type="time" name="home_time" value="${esc(e ? e.home_time || '' : '')}"></label>
      <label class="schalter"><input type="checkbox" name="pause_ferien"${!e || e.pause_ferien ? ' checked' : ''}> Pause in den bayerischen Schulferien und an Feiertagen</label>
      <div class="zwei"><label>Gilt ab <small>optional</small><input class="feld" type="date" name="valid_from" value="${esc(e ? e.valid_from || '' : '')}"></label>
      <label>Gilt bis <small>optional</small><input class="feld" type="date" name="valid_to" value="${esc(e ? e.valid_to || '' : '')}"></label></div>
      <label class="schalter"><input type="checkbox" name="active"${!e || e.active !== false ? ' checked' : ''}> Aktiv</label>
      <p class="fehler" id="termin-fehler" hidden></p>
      <button class="knopf breit">Termin speichern</button>
      ${e ? '<button type="button" class="knopf rot breit" data-action="termin-loeschen" data-id="' + esc(e.id) + '">Termin löschen</button>' : ''}</form>`,
  };
}

/* ---------- Vorrat ---------- */

/* ---------- Urlaub und Tage auswärts ---------- */

function sheetHolidays() {
  const today = L.todayISO();
  const list = KI.holidays(state.data.settings).filter((u) => u.bis >= today).sort((a, b) => (a.von < b.von ? -1 : 1));
  const rows = list.map((u) => `<li><div class="extra-zeile"><span class="p-text"><span class="p-name">${esc(u.name || 'Urlaub')}</span>
    <span class="p-menge">${esc(u.von === u.bis ? L.fmtLong(u.von) : `${L.fmtLong(u.von)} bis ${L.fmtLong(u.bis)}`)}${u.weg === false ? ', nur auswärts essen' : ', verreist'}</span></span>
    ${canPlan() ? `<button class="weg" data-action="urlaub-weg" data-id="${esc(u.id)}" aria-label="${esc(u.name || 'Urlaub')} löschen">${CROSS}</button>` : ''}</div></li>`).join('');
  return {
    over: 'Wochenplan',
    title: 'Urlaub und Tage auswärts',
    body: `<p class="meta" style="margin-bottom:12px">An diesen Tagen isst niemand zu Hause. Es wird kein Abendessen und keine Brotbox geplant, auch nicht von Claude, und es kommen keine Erinnerungen zum Kochen und Bewerten. Seid ihr verreist, pausieren außerdem die festen Aufgaben der Kinder, die Tonne und der Morgenüberblick.</p>
      ${rows ? `<ul class="posten">${rows}</ul>` : '<p class="meta">Nichts eingetragen.</p>'}
      ${canPlan() ? `<form class="form" data-form="urlaub" style="margin-top:14px">
        <label>Bezeichnung<input class="feld" name="name" placeholder="z. B. Skiurlaub, Wochenende bei Oma" autocomplete="off"></label>
        <div class="zwei"><label>Von<input class="feld" type="date" name="von" required value="${esc(L.addDays(today, 1))}"></label>
        <label>Bis<input class="feld" type="date" name="bis" required value="${esc(L.addDays(today, 1))}"></label></div>
        <label class="schalter"><input type="checkbox" name="weg" checked> Wir sind verreist <small>dann pausieren auch die Aufgaben der Kinder, die Tonne und der Morgenüberblick. Ohne Haken wird nur nicht gekocht.</small></label>
        <button class="knopf breit">Eintragen</button></form>` : ''}`,
  };
}

/* ---------- Wunschessen der Kinder ---------- */

const wishesAll = () => { const v = KI.settingOf(state.data.settings, 'wuensche'); return Array.isArray(v) ? v : []; };
// Ziel ist die nächste Woche. Ist die schon geplant, die Woche danach.
function wishWeek() {
  const next = L.addDays(L.mondayOf(L.todayISO()), 7);
  return L.weekDays(next).some((d) => (planOf(d) || {}).dish_id) ? L.addDays(next, 7) : next;
}
function saveWishes(list) {
  const cut = L.addDays(L.mondayOf(L.todayISO()), -70);
  const row = { key: 'wuensche', value: list.filter((w) => w.week >= cut), updated_at: new Date().toISOString() };
  commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'wuensche'), row]; }, () => store.saveSettings([row]));
}
const wishPlanned = (w) => {
  const dish = w.dish_id ? dishById(w.dish_id) : state.data.dishes.find((d) => d.name.toLowerCase() === String(w.text || '').toLowerCase());
  return !!dish && L.weekDays(w.week).some((d) => (planOf(d) || {}).dish_id === dish.id);
};

function wishCard(person) {
  const week = wishWeek();
  const mine = wishesAll().find((w) => w.person_id === person.id && w.week === week);
  const last = wishesAll().filter((w) => w.person_id === person.id && w.week < week).sort((a, b) => (a.week < b.week ? 1 : -1))[0];
  const lastText = last ? (last.status === 'erfuellt' || wishPlanned(last) ? `Dein letzter Wunsch „${last.text}“ kam auf den Plan.` : last.status === 'nicht' ? `Dein letzter Wunsch „${last.text}“ hat diesmal nicht gepasst.` : '') : '';
  const names = state.data.dishes.filter((d) => L.isDinner(d) && !(stats[d.id] || {}).archived).map((d) => d.name).sort((a, b) => a.localeCompare(b, 'de'));
  return `<h2 class="abschnitt abstand">Wunschessen</h2>
    <div class="kasten-text wunsch">
      <strong>Für die Woche ab ${esc(L.fmtShort(week))}</strong>
      ${mine && !state.wishEdit ? `<p>Dein Wunsch: <b>${esc(mine.text)}</b>${wishPlanned(mine) ? ', steht schon im Plan.' : '.'}</p>
        <div class="knopfreihe"><button class="knopf zweit klein" data-action="wunsch-aendern">Ändern</button><button class="knopf zweit klein" data-action="wunsch-weg" data-id="${esc(mine.id)}">Zurücknehmen</button></div>`
      : `<p class="meta">Such dir ein Gericht aus der Liste aus oder schreib eine eigene Idee. Pro Woche kommt ein Wunsch von euch beiden auf den Plan.</p>
        <form class="dazu" data-form="wunsch"><input class="feld" name="text" list="wunsch-gerichte" value="${esc(mine ? mine.text : '')}" placeholder="z. B. Pfannkuchen" aria-label="Wunschessen" autocomplete="off" required>
        <button class="knopf">Wünschen</button></form>
        <datalist id="wunsch-gerichte">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>`}
      ${lastText ? `<p class="meta">${esc(lastText)}</p>` : ''}
    </div>`;
}

// Für die Eltern: Wünsche für die angezeigte Woche.
function wishBanner(week) {
  const list = wishesAll().filter((w) => w.week === week);
  if (!list.length || !canPlan()) return '';
  return `<div class="kasten-text wunsch"><strong>Wunschessen</strong><ul class="liste">${list.map((w) => {
    const p = personById(w.person_id);
    const ok = w.status === 'erfuellt' || wishPlanned(w);
    return `<li>${esc(p ? p.name : 'Kind')}: ${esc(w.text)}${ok ? ' <span class="chip ja">im Plan</span>' : w.status === 'nicht' ? ' <span class="chip">diesmal nicht</span>' : ''}
      <button class="textknopf" data-action="wunsch-weg" data-id="${esc(w.id)}" style="padding:0 0 0 6px">löschen</button></li>`;
  }).join('')}</ul><p class="meta">Claude baut einen Wunsch pro Woche ein. Beim Planen von Hand: über „Gericht wählen“ am Tag.</p></div>`;
}

/* ---------- Zutaten übernehmen (Foto oder eingefügter Text) ---------- */

// Abgewählt wird, was man meist im Haus hat, was laut Vorrat da ist und was schon auf der Liste steht.
function ingredientDraft(source, gericht, hinweis, posten) {
  const norm = (x) => String(x || '').toLowerCase().trim();
  const have = state.data.pantry.filter((p) => p.have).map((p) => norm(p.label));
  const onList = state.data.shopping.filter((i) => i.week_start === state.week && !i.checked).map((i) => norm(i.label));
  const hit = (name, list) => list.some((x) => x && (x === name || (x.length >= 4 && name.includes(x)) || (name.length >= 4 && x.includes(name))));
  return {
    source, gericht, hinweis,
    purpose: gericht ? `${source === 'foto' ? 'Rezept' : 'Liste'}: ${gericht}` : '',
    posten: posten.map((p) => {
      const n = norm(p.name);
      const why = p.abteilung === 'basis' ? 'meist im Haus' : hit(n, onList) ? 'steht schon drauf' : hit(n, have) ? 'laut Vorrat da' : '';
      return { ...p, on: !why, why };
    }),
  };
}

async function readIngredientPhotos(files) {
  const list = [...(files || [])].slice(0, 4);
  if (!list.length || !canPlan()) return;
  if (files.length > 4) toast('Es werden die ersten vier Fotos gelesen.');
  openSheet({ type: 'zutaten-laden', n: list.length });
  try {
    const photos = await Promise.all(list.map(shrinkImage));
    const res = await store.readIngredients(photos);
    state.ingredientDraft = ingredientDraft('foto', res.gericht, res.hinweis, res.posten);
    openSheet({ type: 'zutaten' });
  } catch (err) {
    closeSheet();
    toast(store.offline ? 'Ohne Internet kann Claude die Zutaten nicht lesen.' : `Hat nicht geklappt: ${err.message || err}`);
  }
}

function pastedIngredients(text) {
  const known = L.knownIngredientCats(state.data.dishes);
  const posten = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 60).map((line) => {
    const x = L.parseIngredientLine(line, known);
    if (!x || !x.n) return null;
    // Ohne Menge gilt eine Zeile beim Einlesen als Grundzutat. Hier nur echte Grundzutaten abwählen.
    const basic = /(salz|pfeffer|öl\b|olivenöl|rapsöl|zucker|wasser|gewürz|paprikapulver|curry|kreuzkümmel|zimt|muskat|brühe|essig|oregano|thymian|chili)/i.test(x.n);
    const guess = x.c === 'basis' ? (basic ? 'basis' : L.guessCat(String(x.n))) : x.c;
    const c = guess === 'basis' ? 'basis' : (L.SHOP_CATS[guess] ? guess : 'sonst');
    return { name: x.n, menge: L.fmtQty(x.q, x.u), abteilung: c };
  }).filter(Boolean);
  return ingredientDraft('text', '', '', posten);
}

function sheetIngredientsLoading({ n }) {
  return {
    over: 'Einkaufsliste',
    title: 'Zutaten werden gelesen',
    body: `<p class="meta">Claude liest ${n > 1 ? `die ${n} Fotos` : 'das Foto'}. Das dauert meist 10 bis 30 Sekunden. Danach wählst du aus, was auf die Liste soll.</p><div class="lade-balken" aria-hidden="true"><span></span></div>`,
  };
}

function sheetIngredients() {
  const d = state.ingredientDraft;
  if (!d) return { over: '', title: 'Keine Zutaten', body: '' };
  const items = state.data.shopping.filter((i) => i.week_start === state.week);
  const trips = [...new Set(items.sort((a, b) => (a.sort || 0) - (b.sort || 0)).map((i) => i.trip || 'Einkauf'))];
  const target = targetTrip(state.week).trip;
  if (!trips.includes(target)) trips.push(target);
  const rows = d.posten.map((p, n) => `<label class="zutat"><input type="checkbox" name="nimm" value="${n}"${p.on ? ' checked' : ''}>
      <span class="z-text"><span class="z-name">${esc(p.name)}</span>${p.menge ? `<span class="z-menge">${esc(p.menge)}</span>` : ''}${p.why ? `<span class="z-warum">${esc(p.why)}</span>` : ''}</span></label>`).join('');
  return {
    over: 'Einkaufsliste',
    title: d.gericht ? d.gericht : 'Zutaten übernehmen',
    body: `<form class="form" data-form="zutaten">
      ${d.hinweis ? `<div class="kasten-text"><strong>Hinweis von Claude</strong>${esc(d.hinweis)}</div>` : ''}
      <div class="zutaten-liste">${rows}</div>
      <label>Auf welchen Einkauf<select class="feld" name="trip">${trips.map((t) => `<option${t === target ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label>Wofür (optional)<input class="feld" name="purpose" value="${esc(d.purpose)}" placeholder="z. B. Linsen-Dal am Donnerstag" autocomplete="off"></label>
      ${lidlOn() ? '<label>Markt<select class="feld" name="shop"><option value="">Aldi Süd</option><option value="lidl">Lidl</option></select></label>' : ''}
      <div class="knopfreihe"><button class="knopf">Auf die Liste</button><button type="button" class="knopf zweit" data-action="zu">Abbrechen</button></div></form>`,
  };
}

/* ---------- Rezept aus Foto ---------- */

async function readRecipePhotos(files) {
  const list = [...(files || [])].slice(0, 4);
  if (!list.length || !canPlan()) return;
  if (files.length > 4) toast('Es werden die ersten vier Fotos gelesen.');
  openSheet({ type: 'rezept-laden', n: list.length });
  try {
    const photos = await Promise.all(list.map(shrinkImage));
    state.recipeDraft = await store.readRecipe(photos);
    openSheet({ type: 'rezept-neu' });
  } catch (err) {
    closeSheet();
    toast(store.offline ? 'Ohne Internet kann Claude das Rezept nicht lesen.' : `Hat nicht geklappt: ${err.message || err}`);
  }
}

function sheetRecipeLoading({ n }) {
  return {
    over: 'Gerichte',
    title: 'Rezept wird gelesen',
    body: `<p class="meta">Claude liest ${n > 1 ? `die ${n} Fotos` : 'das Foto'} und rechnet auf 4 Portionen um. Das dauert meist 20 bis 60 Sekunden. Danach siehst du das Rezept, bevor es gespeichert wird.</p><div class="lade-balken" aria-hidden="true"><span></span></div>`,
  };
}

function recipeDraftDish() {
  const raw = state.recipeDraft;
  if (!raw) return null;
  const { meta, ...rest } = raw;
  let name = String(rest.name || '').trim();
  if (state.data.dishes.some((d) => d.name.toLowerCase() === name.toLowerCase())) name = `${name} (neu)`;
  return normalizeDish({ ...rest, name });
}

function sheetRecipeNew() {
  const raw = state.recipeDraft;
  const dish = recipeDraftDish();
  if (!dish) return { over: '', title: 'Kein Rezept', body: '' };
  const meta = raw.meta || {};
  const facts = [
    meta.portionen_original && meta.portionen_original !== 4 ? `Mengen von ${meta.portionen_original} auf 4 Portionen umgerechnet.` : '',
    dish.nutrition ? (meta.naehrwerte_vom_rezept ? 'Nährwerte vom Rezept übernommen.' : 'Nährwerte von Claude geschätzt.') : '',
  ].filter(Boolean).join(' ');
  return {
    over: 'Rezept aus Foto',
    title: dish.name,
    body: `<p class="meta">${esc(metaText(dish))}</p>
      ${facts ? `<p class="meta">${esc(facts)}</p>` : ''}
      ${recipeHtml(dish)}
      <div class="knopfreihe"><button class="knopf" data-action="rezept-speichern">Speichern</button>
      <button class="knopf zweit" data-action="rezept-speichern" data-edit="1">Speichern und bearbeiten</button>
      <button class="knopf zweit" data-action="rezept-verwerfen">Verwerfen</button></div>
      <p class="meta unter">Gespeicherte Rezepte kommen in die Sammlung und können wie jedes andere Gericht geplant werden. Ihre Zutaten landen dann über den Wochenplan auf der Einkaufsliste.</p>`,
  };
}

/* ---------- Einkaufsliste per Siri ---------- */

const shortcutKey = () => String((KI.settingOf(state.data.settings, 'kurzbefehl') || {}).schluessel || '');

function copyField(label, value, id) {
  return `<div class="kopierfeld"><span class="k-label">${esc(label)}</span>
    <input class="feld" id="${id}" value="${esc(value)}" readonly aria-label="${esc(label)}">
    <button type="button" class="knopf zweit klein" data-action="kopieren" data-ziel="${id}">Kopieren</button></div>`;
}

function sheetSiri() {
  const key = shortcutKey();
  const me = personById(state.me);
  const url = `${String((window.ESSENSPLAN_CONFIG || {}).supabaseUrl || '').replace(/\/$/, '')}/functions/v1/push`;
  if (store.mode === 'local') return { over: 'Einkaufsliste', title: 'Per Siri ergänzen', body: '<p class="meta">Das geht nur mit der gemeinsamen Datenbank, nicht im Demo-Modus.</p>' };
  if (!key) {
    return {
      over: 'Einkaufsliste', title: 'Per Siri ergänzen',
      body: `<p>Mit einem Kurzbefehl auf dem iPhone sagt ihr „Hey Siri, Einkaufsliste“, Siri fragt nach, und was ihr sagt, steht auf der Liste. Die anderen bekommen wie gewohnt eine Push-Nachricht.</p>
        <p class="meta">Dafür braucht die Familie einen eigenen Schlüssel. Er erlaubt nur, etwas auf die Einkaufsliste zu setzen.</p>
        <div class="knopfreihe"><button class="knopf" data-action="siri-schluessel">Schlüssel erzeugen</button></div>`,
    };
  }
  const full = `${url}?schluessel=${encodeURIComponent(key)}&person=${encodeURIComponent(state.me || '')}&text=`;
  return {
    over: 'Einkaufsliste', title: 'Per Siri ergänzen',
    body: `<p class="meta">Einmal pro iPhone einrichten. Die Adresse unten gilt für ${esc(me ? me.name : 'dieses Gerät')}, damit die Push-Nachricht sagt, wer etwas eingetragen hat. Auf den anderen Handys diesen Bogen dort öffnen und deren eigene Adresse nehmen.</p>
      ${copyField(`Adresse für ${me ? me.name : 'dieses Gerät'}`, full, 'siri-url')}
      <p class="meta">Die Aktionen findest du jeweils über das Suchfeld für Aktionen im Kurzbefehl. Heißt eine Aktion bei dir etwas anders, hilft das Stichwort in Klammern.</p>
      <ol class="schritte siri-schritte">
        <li>App „Kurzbefehle“ öffnen, einen neuen Kurzbefehl anlegen und ihn <b>Einkaufsliste</b> nennen. Der Name ist der Satz für Siri.</li>
        <li>Aktion <b>Nach Eingabe fragen</b> hinzufügen (Stichwort „Eingabe“). Als Frage zum Beispiel „Was soll auf die Liste?“.</li>
        <li>Aktion <b>URL codieren</b> hinzufügen (Stichwort „codieren“). Sie nimmt automatisch die Antwort aus Schritt 2.</li>
        <li>Aktion <b>Text</b> hinzufügen (Stichwort „Text“, die Aktion heißt nur so). In ihr Feld die kopierte Adresse einfügen. Direkt dahinter, ohne Leerzeichen, über die Variablenleiste <b>Text der codierten URL</b> einsetzen. Bitte nicht die Aktion „URL“ nehmen, dort wird die Adresse zerlegt.</li>
        <li>Aktion <b>Inhalte von URL abrufen</b> hinzufügen. Steht dort nicht schon <b>Text</b>, auf die blaue Variable tippen und <b>Text</b> aus Schritt 4 wählen. Sonst nichts eintragen.</li>
        <li>Aktion <b>Text sprechen</b> hinzufügen (Stichwort „sprechen“). Sie liest die Antwort vor, zum Beispiel „Milch und Brot stehen jetzt auf der Einkaufsliste“.</li>
      </ol>
      <p class="meta">Dann: „Hey Siri, Einkaufsliste“, Siri fragt nach, ihr sagt zum Beispiel „Milch, Brot und Eier“. Mehrere Dinge mit Komma oder „und“ trennen. Was schon offen auf der Liste steht, kommt nicht doppelt dazu. Alles landet auf dem nächsten offenen Einkauf der Woche unter „Sonstiges“.</p>
      <p class="meta">Zum Testen ohne Siri: Kurzbefehl antippen. Kommt „Der Schlüssel stimmt nicht“, die Adresse noch einmal kopieren. Kommt „Ungültige URL“, prüfen, ob in der Aktion „Text“ die Variable direkt hinter „text=“ steht und „Inhalte von URL abrufen“ wirklich „Text“ verwendet.</p>
      <details><summary>Schlüssel erneuern</summary><p class="meta">Falls die Adresse in falsche Hände geraten ist. Mit ihr lässt sich nur etwas auf die Einkaufsliste setzen. Nach dem Erneuern brauchen alle Kurzbefehle die neue Adresse.</p>
      <button class="knopf zweit klein" data-action="siri-schluessel">Neuen Schlüssel erzeugen</button></details>`,
  };
}

/* ---------- Haushaltsbuch ---------- */

const hbSettings = () => HB.settingsOf(state.data.settings);
const curMonth = () => state.month || HB.monthOf(L.todayISO());

function viewAusgaben() {
  const H = hbSettings();
  const month = curMonth();
  const now = HB.monthOf(L.todayISO());
  const sum = HB.summary(state.data.receipts, month);
  const prevMonth = HB.addMonths(month, -1);
  const prev = HB.summary(state.data.receipts, prevMonth);
  const b = HB.budgetState(sum.total, H.budget, month, L.todayISO());
  const bars = (list) => {
    const max = Math.max(1, ...list.map((x) => x.sum));
    return `<ul class="ausgaben-balken">${list.map((x) => `<li><span class="b-name">${esc(x.name)}</span><span class="b-wert">${HB.euro(x.sum)}</span>
      <span class="b-spur" aria-hidden="true"><span style="width:${Math.max(0, Math.round(x.sum / max * 100))}%"></span></span></li>`).join('')}</ul>`;
  };
  const budget = b ? `<div class="budget budget-${b.level}"><div class="budget-spur" aria-hidden="true"><span style="width:${Math.min(100, Math.round(b.share * 100))}%"></span></div>
    <p class="meta">${b.left >= 0 ? `Noch ${HB.euro(b.left)} vom Budget (${HB.euroShort(H.budget)})` : `${HB.euro(-b.left)} über dem Budget (${HB.euroShort(H.budget)})`}${b.running && b.level !== 'rot' && b.projected ? `. Hochgerechnet auf den Monat: ${HB.euroShort(b.expected)}` : ''}.</p></div>` : '';
  const photo = canPlan() ? `<div class="knopfreihe"><label class="knopf foto-knopf"><input type="file" id="beleg-foto" accept="image/*" multiple>Kassenzettel fotografieren</label>
    <button class="knopf zweit" data-action="beleg-neu">Ohne Foto eintragen</button></div>
    <p class="meta unter">Lange Zettel gern in zwei bis vier Fotos von oben nach unten, alle auf einmal auswählen.</p>` : '';
  const list = [...sum.receipts].sort((a, x) => (a.day < x.day ? 1 : a.day > x.day ? -1 : 0)).map((r) => `<li><button class="g-zeile" data-action="beleg" data-id="${esc(r.id)}">
    <span class="tz-text"><span class="tz-name">${esc(r.shop || 'Ohne Markt')}</span><span class="tz-meta">${L.WD_SHORT[L.wdIndex(r.day)]} ${esc(L.fmtShort(r.day))}, ${(r.items || []).length} Posten</span></span>
    <span class="beleg-betrag">${HB.euro(r.total)}</span></button></li>`).join('');
  return `<div class="monat"><button class="pfeil" data-action="monat" data-dir="-1" aria-label="Vormonat">‹</button>
      <h2>${esc(HB.monthLabel(month))}</h2>
      <button class="pfeil" data-action="monat" data-dir="1" aria-label="Nächster Monat"${month >= now ? ' disabled' : ''}>›</button></div>
    <div class="ausgaben-summe"><span class="betrag">${HB.euro(sum.total)}</span>
      <span class="meta">${sum.count === 1 ? '1 Kassenzettel' : `${sum.count} Kassenzettel`}${prev.count ? `, im ${esc(HB.monthLabel(prevMonth).split(' ')[0])} ${HB.euroShort(prev.total)}` : ''}</span>${budget}</div>
    ${photo}
    ${sum.count ? `<h2 class="abschnitt abstand">Nach Kategorie</h2>${bars(sum.byCat)}
      ${sum.byShop.length > 1 ? `<h2 class="abschnitt abstand">Nach Markt</h2>${bars(sum.byShop)}` : ''}
      <h2 class="abschnitt abstand">Kassenzettel</h2><ul class="gerichte">${list}</ul>`
      : `<div class="leer"><p>${month === now ? 'In diesem Monat ist noch kein Kassenzettel eingetragen.' : 'Für diesen Monat gibt es keine Kassenzettel.'}</p></div>`}
    <div class="fuss">${(state.data.receipts || []).length ? `<button class="textknopf" data-action="jahr" data-year="${month.slice(0, 4)}">Jahresüberblick ${month.slice(0, 4)}</button><button class="textknopf" data-action="preise">Preisgedächtnis: was kostet was?</button>` : ''}
    ${canPlan() ? '<button class="textknopf" data-action="haushalt-einstellungen">Budget und Kategorien</button>' : ''}</div>`;
}

// Foto verkleinern: Claude rechnet ohnehin mit höchstens etwa 1568 Pixeln an der langen Kante.
async function shrinkImage(file, max = 1568, quality = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = () => fail(new Error('Das Foto ließ sich nicht öffnen.')); img.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', quality).split(',')[1], media: 'image/jpeg' };
  } finally { URL.revokeObjectURL(url); }
}

function draftFromResult(res) {
  const H = hbSettings();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(res.datum || '') ? res.datum : L.todayISO();
  const items = HB.applyLearned(res.posten || [], H.merken, H.kategorien).map((p) => ({ ...p, preis: HB.money(p.preis) }));
  // Offene Posten der Woche des Einkaufs und der Woche danach (der Großeinkauf am Samstag gilt schon für die nächste Woche).
  const weeks = [L.mondayOf(day), L.addDays(L.mondayOf(day), 7)];
  const week = state.data.shopping.filter((i) => weeks.includes(i.week_start));
  return {
    isNew: true, id: L.uid(), day, shop: res.markt || '', total: HB.money(res.summe) || HB.itemsSum(items), note: res.hinweis || '',
    items, before: items.map((p) => ({ kategorie: p.kategorie })), matches: HB.matchShopping(items, week),
  };
}

async function readPhotos(files) {
  const list = [...(files || [])].slice(0, 4);
  if (!list.length || !canPlan()) return;
  if (files.length > 4) toast('Es werden die ersten vier Fotos gelesen.');
  openSheet({ type: 'beleg-laden', n: list.length });
  try {
    const photos = await Promise.all(list.map(shrinkImage));
    const res = await store.readReceipt(photos);
    state.receiptDraft = draftFromResult(res);
    openSheet({ type: 'beleg' });
  } catch (err) {
    closeSheet();
    toast(store.offline ? 'Ohne Internet kann Claude den Kassenzettel nicht lesen.' : `Hat nicht geklappt: ${err.message || err}`);
  }
}

function sheetReceiptLoading({ n }) {
  return {
    over: 'Haushaltsbuch',
    title: 'Kassenzettel wird gelesen',
    body: `<p class="meta">Claude liest ${n > 1 ? `die ${n} Fotos` : 'das Foto'}. Das dauert meist 10 bis 30 Sekunden. Danach kannst du alles prüfen, bevor es gespeichert wird.</p><div class="lade-balken" aria-hidden="true"><span></span></div>`,
  };
}

function draftOf(r) {
  return { isNew: false, id: r.id, day: r.day, shop: r.shop || '', total: HB.money(r.total), note: r.note || '', created_at: r.created_at,
    items: (r.items || []).map((p) => ({ ...p })), before: (r.items || []).map((p) => ({ kategorie: p.kategorie })), matches: [] };
}

const parseEuro = (v) => { const n = parseFloat(String(v || '').replace(/\s|€/g, '').replace(',', '.')); return Number.isFinite(n) ? HB.money(n) : null; };
const fmtInput = (n) => (n === '' || n == null ? '' : HB.money(n).toFixed(2).replace('.', ','));

// Eingaben aus dem Formular in den Entwurf übernehmen, damit beim Hinzufügen und Löschen nichts verloren geht.
function readReceiptForm(form) {
  const d = state.receiptDraft;
  if (!form || !d) return;
  const fd = new FormData(form);
  d.shop = String(fd.get('shop') || '').trim();
  d.day = String(fd.get('day') || d.day);
  d.total = parseEuro(fd.get('total'));
  d.items = d.items.map((p, n) => ({
    ...p,
    name: String(fd.get(`p_name_${n}`) ?? p.name).trim(),
    preis: parseEuro(fd.get(`p_preis_${n}`)) ?? 0,
    kategorie: String(fd.get(`p_kat_${n}`) || p.kategorie || 'Sonstiges'),
  }));
  d.checked = fd.getAll('abhaken').map(String);
}

function sheetReceipt() {
  const d = state.receiptDraft;
  if (!d) return { over: '', title: 'Nicht gefunden', body: '' };
  const H = hbSettings();
  const cats = [...H.kategorien, ...d.items.map((p) => p.kategorie).filter((k) => k && !H.kategorien.includes(k))];
  const sum = HB.itemsSum(d.items);
  const diff = d.total != null && d.total !== '' ? HB.money(d.total - sum) : 0;
  if (!canPlan()) {
    return {
      over: `${L.WD_SHORT[L.wdIndex(d.day)]} ${L.fmtShort(d.day)}`,
      title: `${d.shop || 'Kassenzettel'}, ${HB.euro(d.total)}`,
      body: `<ul class="beleg-liste">${d.items.map((p) => `<li><span class="p-text"><span class="p-name">${esc(p.name)}</span><span class="p-menge">${esc(p.kategorie)}</span></span><span>${HB.euro(p.preis)}</span></li>`).join('')}</ul>`,
    };
  }
  const shopping = d.isNew && d.matches.length ? state.data.shopping.filter((i) => d.matches.includes(i.id)) : [];
  const checked = d.checked || d.matches;
  const rows = d.items.map((p, n) => `<li class="beleg-zeile">
      <input class="feld" name="p_name_${n}" value="${esc(p.name)}" aria-label="Artikel ${n + 1}" autocomplete="off">
      <input class="feld preis" name="p_preis_${n}" value="${esc(fmtInput(p.preis))}" inputmode="decimal" aria-label="Preis von ${esc(p.name || `Artikel ${n + 1}`)}" autocomplete="off">
      <select class="feld" name="p_kat_${n}" aria-label="Kategorie von ${esc(p.name || `Artikel ${n + 1}`)}">${cats.map((c) => `<option${c === p.kategorie ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <button type="button" class="weg" data-action="beleg-posten-weg" data-n="${n}" aria-label="${esc(p.name || 'Posten')} entfernen">${CROSS}</button>
      ${p.text && p.text !== p.name ? `<span class="p-menge beleg-roh">Auf dem Zettel: ${esc(p.text)}</span>` : ''}</li>`).join('');
  return {
    over: 'Haushaltsbuch',
    title: d.isNew ? 'Kassenzettel prüfen' : 'Kassenzettel',
    body: `<form class="form" data-form="beleg">
      ${d.note ? `<div class="kasten-text"><strong>Hinweis von Claude</strong>${esc(d.note)}</div>` : ''}
      <div class="zwei"><label>Markt<input class="feld" name="shop" value="${esc(d.shop)}" list="maerkte" autocomplete="off"></label>
      <label>Datum<input class="feld" type="date" name="day" value="${esc(d.day)}" required></label></div>
      <datalist id="maerkte">${HB.MARKETS.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
      <label>Betrag laut Kassenzettel<input class="feld" name="total" value="${esc(fmtInput(d.total))}" inputmode="decimal" placeholder="${esc(fmtInput(sum))}" autocomplete="off"></label>
      <p class="meta">Die Posten ergeben zusammen ${HB.euro(sum)}.${Math.abs(diff) >= 0.01 ? ` <strong class="warnung">Das sind ${HB.euro(Math.abs(diff))} ${diff > 0 ? 'weniger' : 'mehr'} als der Betrag.</strong> Der Unterschied zählt als „Sonstiges“.` : ''}</p>
      <h3 class="abteilung">Posten</h3>
      <ul class="beleg-posten">${rows}</ul>
      <div class="knopfreihe"><button type="button" class="knopf zweit klein" data-action="beleg-posten-neu">Posten hinzufügen</button></div>
      <p class="meta">Ändert ihr eine Kategorie, merkt sich die App das für den nächsten Kassenzettel.</p>
      ${shopping.length ? `<h3 class="abteilung">Auf der Einkaufsliste abhaken</h3><div class="haken-liste">${shopping.map((i) => `<label class="schalter"><input type="checkbox" name="abhaken" value="${esc(i.id)}"${checked.includes(i.id) ? ' checked' : ''}> ${esc(i.label)}</label>`).join('')}</div>` : ''}
      <div class="knopfreihe"><button class="knopf">${d.isNew ? 'Speichern' : 'Änderungen speichern'}</button>
      ${d.isNew ? '' : `<button type="button" class="knopf zweit" data-action="beleg-loeschen" data-id="${esc(d.id)}">Löschen</button>`}</div></form>`,
  };
}

function sheetYear({ year }) {
  const y = Number(year) || Number(L.todayISO().slice(0, 4));
  const now = L.todayISO().slice(0, 7);
  const sum = HB.yearSummary(state.data.receipts, y);
  const prev = HB.yearSummary(state.data.receipts, y - 1);
  const H = hbSettings();
  const max = Math.max(1, ...sum.months.map((m) => m.total), H.budget || 0);
  const pct = (x) => `${Math.round(x * 100)} %`;
  const names = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const rows = sum.months.map((m, i) => {
    const future = m.month > now;
    const over = H.budget && m.total > H.budget;
    return `<li class="${future ? 'zukunft' : ''}"><span class="j-monat">${names[i]}</span>
      <span class="j-spur" aria-hidden="true"><span class="${over ? 'ueber' : ''}" style="width:${Math.round((m.total / max) * 100)}%"></span>${H.budget ? `<i style="left:${Math.round((H.budget / max) * 100)}%"></i>` : ''}</span>
      <span class="j-wert">${m.count ? HB.euroShort(m.total) : future ? '' : '–'}</span>
      <span class="j-bio">${m.bioShare != null ? `Bio ${pct(m.bioShare)}` : ''}</span></li>`;
  }).join('');
  return {
    over: 'Haushaltsbuch',
    title: `Jahresüberblick ${y}`,
    body: `<div class="jahr-nav"><button class="knopf zweit klein" data-action="jahr" data-year="${y - 1}"${prev.activeMonths ? '' : ' disabled'}>‹ ${y - 1}</button>
        <button class="knopf zweit klein" data-action="jahr" data-year="${y + 1}"${y + 1 > Number(now.slice(0, 4)) ? ' disabled' : ''}>${y + 1} ›</button></div>
      <div class="ausgaben-summe"><span class="betrag">${HB.euro(sum.total)}</span>
        <span class="meta">${sum.activeMonths ? `Im Schnitt ${HB.euroShort(sum.avg)} pro Monat mit Kassenzetteln (${sum.activeMonths} ${sum.activeMonths === 1 ? 'Monat' : 'Monate'})` : 'Noch keine Kassenzettel in diesem Jahr'}${prev.activeMonths ? `, ${y - 1}: ${HB.euroShort(prev.avg)} pro Monat` : ''}.</span>
        ${sum.bioShare != null ? `<span class="meta">Bio-Anteil bei Lebensmitteln: <b>${pct(sum.bioShare)}</b>${prev.bioShare != null ? ` (${y - 1}: ${pct(prev.bioShare)})` : ''}</span>` : ''}</div>
      <h3 class="abteilung">Pro Monat${H.budget ? ` <small>(Strich: Budget ${HB.euroShort(H.budget)})</small>` : ''}</h3>
      <ul class="jahr-liste">${rows}</ul>
      ${sum.cats.length ? `<h3 class="abteilung">Nach Kategorie</h3><ul class="ausgaben-balken">${sum.cats.map((c) => `<li><span class="b-name">${esc(c.name)}</span><span class="b-wert">${HB.euroShort(c.sum)} <small>${pct(c.share)}</small></span>
        <span class="b-spur" aria-hidden="true"><span style="width:${Math.max(0, Math.round(c.share * 100))}%"></span></span></li>`).join('')}</ul>` : ''}
      <p class="meta">Bio zählt, wenn „Bio“ im Artikelnamen steht. Lebensmittel sind alle Kategorien außer Drogerie, Haushalt, Tierbedarf, Pfand und Sonstiges.</p>`,
  };
}

function sheetPrices() {
  const book = HB.priceBook(state.data.receipts);
  const rows = book.map((e) => `<li class="preis-zeile" data-suche="${esc(e.name.toLowerCase())}">
      <span class="p-name">${esc(e.name)}</span>
      <span class="preis-maerkte">${e.shops.map((x) => `<span class="${e.cheapest === x.shop ? 'guenstig' : ''}">${esc(x.shop)} ${HB.euro(x.median)}${x.n > 1 ? ` <small>(${x.n}x, zuletzt ${HB.euro(x.last)})</small>` : ` <small>(${esc(L.fmtShort(x.lastDay))})</small>`}</span>`).join('')}</span></li>`).join('');
  return {
    over: 'Haushaltsbuch',
    title: 'Preisgedächtnis',
    body: `<p class="meta">Was ihr laut Kassenzetteln wo bezahlt habt. Bei mehreren Käufen steht der übliche Preis. Gibt es einen Artikel in beiden Märkten, ist der günstigere markiert. Claude nutzt diese Preise beim Wochenplan, um Angebote zu prüfen und die Kosten zu schätzen.</p>
      <input class="feld" id="preis-suche" placeholder="Suchen, z. B. Milch" aria-label="Artikel suchen" autocomplete="off" style="margin:12px 0">
      ${rows ? `<ul class="preis-liste">${rows}</ul>` : '<p class="meta">Noch keine Preise.</p>'}`,
  };
}

function sheetHousehold() {
  const H = hbSettings();
  return {
    over: 'Haushaltsbuch',
    title: 'Budget und Kategorien',
    body: `<form class="form" data-form="haushalt">
      <label>Monatsbudget in Euro<input class="feld" name="budget" inputmode="numeric" value="${H.budget || ''}" placeholder="leer lassen für kein Budget" autocomplete="off"></label>
      <label>Kategorien, eine pro Zeile<textarea class="feld" name="kategorien" rows="12">${esc(H.kategorien.join('\n'))}</textarea></label>
      <p class="meta">Claude sortiert jeden Posten in eine dieser Kategorien. Umbenannte Kategorien gelten ab dem nächsten Kassenzettel, ältere behalten ihren Namen. „Sonstiges“ bleibt immer dabei.</p>
      <p class="meta">Gemerkte Zuordnungen: ${Object.keys(H.merken).length}${Object.keys(H.merken).length ? ' <button type="button" class="textknopf" data-action="haushalt-vergessen" style="padding:0">alle vergessen</button>' : ''}</p>
      <div class="knopfreihe"><button class="knopf">Speichern</button><button type="button" class="knopf zweit" data-action="haushalt-standard">Kategorien zurücksetzen</button></div></form>`,
  };
}

function saveHousehold(patch) {
  const cur = (KI.settingOf(state.data.settings, 'haushalt') || {});
  const row = { key: 'haushalt', value: { ...cur, ...patch }, updated_at: new Date().toISOString() };
  commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'haushalt'), row]; }, () => store.saveSettings([row]));
}

/* ---------- Wochenplan mit Claude ---------- */


// Für welche Woche ein neuer Entwurf gedacht ist: die angezeigte, wenn sie in der Zukunft liegt, sonst die nächste.
const holidayOf = (day) => KI.holidayOn(state.data.settings, day);

function draftTarget() {
  const next = L.addDays(L.mondayOf(L.todayISO()), 7);
  return state.week > L.mondayOf(L.todayISO()) ? state.week : next;
}

/* ---------- Wochenrückblick ---------- */
// Sonntags die laufende Woche, sonst die letzte abgeschlossene. Auswertung in js/rueckblick.js.
function reviewWeek() {
  const today = L.todayISO();
  return L.wdIndex(today) === 6 ? L.mondayOf(today) : L.addDays(L.mondayOf(today), -7);
}
function reviewBanner() {
  const today = L.todayISO();
  const wd = L.wdIndex(today);
  if (!canPlan() || !(wd === 6 || wd === 0) || !L.weekDays(state.week).includes(today)) return '';
  const w = reviewWeek();
  return `<button class="kasten-text rb-banner" data-action="rueckblick"><strong>Wochenrückblick KW ${L.isoWeek(w)}</strong>Essen, Aufgaben der Kinder, Lernen und Ausgaben auf einen Blick. ›</button>`;
}
function openReview(week) {
  const w = week || reviewWeek();
  state.review = { week: w, lern: undefined };
  openSheet({ type: 'rueckblick' });
  loadLearnWeek(w).then((x) => {
    if (!state.review || state.review.week !== w) return;
    state.review.lern = x;
    if (state.sheet && state.sheet.type === 'rueckblick') renderSheet();
  });
}
// Lernen aus dem Lernplaner: nur mit Datenbank und wenn der Lernplaner benutzt wird.
async function loadLearnWeek(week) {
  if (store.mode !== 'supabase' || !store.sb || store.offline || !state.lp) return null;
  try {
    const sun = L.addDays(week, 6);
    const [a, b] = await Promise.all([
      store.sb.from('lp_data').select('coll,data').eq('deleted', false).in('coll', ['settings', 'win', 'day', 'help', 'exam']),
      store.sb.from('lp_data').select('data').eq('deleted', false).eq('coll', 'task').gte('data->>doneAt', week).lte('data->>doneAt', sun),
    ]);
    if (a.error || b.error) return null;
    return RB.learnWeek(a.data || [], (b.data || []).map((r) => r.data), week);
  } catch (e) { return null; }
}
const stars1 = (x) => x.toFixed(1).replace('.', ',');
const timeText = (m) => (m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60 ? `${m % 60} Min.` : ''}`.trim() : `${m} Min.`);
function sheetReview() {
  const r = state.review || { week: reviewWeek() };
  const H = hbSettings();
  const v = RB.weekReview(state.data, r.week, { today: L.todayISO(), budget: H.budget, away: (d) => { const h = holidayOf(d); return !!(h && h.weg !== false); } });
  const nav = `<div class="rb-nav"><button class="textknopf" data-action="rueckblick-woche" data-wert="-7">‹ Woche davor</button>${r.week < reviewWeek() ? '<button class="textknopf" data-action="rueckblick-woche" data-wert="7">Woche danach ›</button>' : ''}</div>`;
  const e = v.essen;
  const meals = e.meals.filter((m) => m.dish).map((m) => `<li><span class="rb-tag">${L.WD_SHORT[L.wdIndex(m.day)]}</span><span class="rb-was">${esc(m.dish)}</span><span class="rb-wert">${m.avg != null ? `${stars1(m.avg)} ★` : ''}</span></li>`).join('');
  const essen = `<h3 class="abteilung">Essen</h3>
    ${e.cooked ? `<ul class="rb-liste">${meals}</ul>
    <p class="meta">${[e.best ? `Am besten kam ${esc(e.best.dish)} an (${stars1(e.best.avg)} Sterne).` : '', e.worst && e.worst.avg < 3.5 ? `Am wenigsten ${esc(e.worst.dish)} (${stars1(e.worst.avg)}).` : '', e.hearts.length ? `Herz der Woche: ${e.hearts.map((h) => `${esc(h.person)} für ${esc(h.dish)}`).join(', ')}.` : ''].filter(Boolean).join(' ') || 'Noch keine Sterne vergeben.'}</p>` : '<p class="meta">In dieser Woche war kein Abendessen geplant.</p>'}`;
  const kinder = v.kinder.length ? `<h3 class="abteilung">Aufgaben der Kinder</h3><ul class="rb-kinder">${v.kinder.map((k) => `<li><strong>${esc(k.name)}</strong>
    <span>${k.basicsDue ? `Grundaufgaben an ${k.basicsOk} von ${k.basicsDue} Tagen geschafft` : 'Keine Grundaufgaben'}${k.bonus ? `, Wochenbonus ${k.bonus} Min.` : ''}${k.siege ? `, ${k.siege === 1 ? 'ein Tagessieg' : `${k.siege} Tagessiege`} im Lernplaner (${k.siegMin} Min.)` : ''}.</span>
    <span>${k.extras ? `${k.extras} ${k.extras === 1 ? 'Extra-Aufgabe' : 'Extra-Aufgaben'}, ${k.earned} Min. verdient` : 'Keine Extra-Aufgaben'}${k.redeemed ? `, ${k.redeemed} Min. eingelöst` : ''}.</span>
    ${k.muell || k.spuel || k.stall || k.rejected ? `<span>${[k.muell ? `Müll ${k.muell}-mal rausgebracht` : '', k.spuel ? `Spülmaschine ${k.spuel}-mal ausgeräumt` : '', k.stall ? `Stall ${k.stall}-mal sauber gemacht` : '', k.rejected ? `${k.rejected}-mal nicht anerkannt` : ''].filter(Boolean).join(', ')}.</span>` : ''}</li>`).join('')}</ul>` : '';
  const l = r.lern;
  const lernen = l === undefined && state.lp ? '<h3 class="abteilung">Lernen</h3><p class="meta">Wird geladen …</p>'
    : l ? `<h3 class="abteilung">Lernen</h3><ul class="rb-kinder"><li>
      <span>Tagessiege: ${l.wins} von 5${l.wins >= l.goal ? ', Wochenspiel gewonnen' : ` (Ziel ${l.goal})`}${l.verlegt ? `, ${l.verlegt}-mal Spiel verlegt` : ''}.</span>
      <span>${l.done ? `${l.done} ${l.done === 1 ? 'Aufgabe' : 'Aufgaben'} erledigt, zusammen ${timeText(l.minutes)}.` : 'Keine Aufgaben erledigt.'}</span>
      ${l.help.length ? `<span>Schwer war: ${esc(l.help.join(', '))}.</span>` : ''}
      ${l.exams.length ? `<span>Als Nächstes: ${l.exams.slice(0, 3).map((x) => `${L.WD_SHORT[L.wdIndex(x.date)]} ${L.fmtShort(x.date)} ${esc(x.text)}`).join(', ')}.</span>` : ''}</li></ul>` : '';
  const a = v.ausgaben;
  const ausgaben = `<h3 class="abteilung">Ausgaben</h3><p class="meta">${a.count ? `Diese Woche ${HB.euro(a.total)} auf ${a.count} ${a.count === 1 ? 'Kassenzettel' : 'Kassenzetteln'}.` : 'Diese Woche keine Kassenzettel.'} ${HB.monthLabel(a.month)} bisher ${HB.euroShort(a.monthTotal)}${a.left != null ? (a.left >= 0 ? `, vom Budget sind noch ${HB.euroShort(a.left)} übrig` : `, das Budget ist um ${HB.euroShort(-a.left)} überzogen`) : ''}.</p>`;
  const ausblick = r.week === reviewWeek() ? `<h3 class="abteilung">Nächste Woche</h3><p class="meta">${v.ausblick.planned === 7 ? 'Alle sieben Abendessen sind geplant.' : v.ausblick.planned ? `${v.ausblick.planned} von 7 Abendessen sind geplant.` : 'Für nächste Woche ist noch nichts geplant.'}</p>` : '';
  const off = ((KI.settingOf(state.data.settings, 'rueckblick') || {}).aus || []).includes(state.me);
  return {
    over: 'Wochenrückblick',
    title: `KW ${L.isoWeek(r.week)}, ${L.fmtShort(r.week)} bis ${L.fmtShort(v.sun)}`,
    body: `${essen}${kinder}${lernen}${ausgaben}${ausblick}
      <label class="schalter" style="margin-top:18px"><input type="checkbox" data-action="rueckblick-push"${off ? '' : ' checked'}> Sonntags um 18:30 Uhr eine Nachricht <small>wenn der Rückblick für die Woche fertig ist</small></label>
      ${nav}`,
  };
}

function draftBanner() {
  if (!canPlan()) return '';
  const run = KI.runFor(state.data.aiRuns, state.week);
  if (!run) return '';
  if (run.status === 'fertig') {
    return `<div class="kasten-text entwurf-kasten"><strong>Claude hat einen Plan vorgeschlagen</strong>${esc(run.draft && run.draft.hinweise ? run.draft.hinweise : 'Der Entwurf für diese Woche liegt bereit.')}
      <div class="knopfreihe" style="margin-top:10px"><button class="knopf" data-action="entwurf" data-id="${esc(run.id)}">Ansehen und freigeben</button></div></div>`;
  }
  if (KI.RUNNING.includes(run.status)) return `<div class="kasten-text entwurf-kasten laeuft"><strong>Wochenplan in Arbeit</strong>${esc(KI.runText(run))}</div>`;
  if (run.status === 'fehler' && Date.parse(run.updated_at || run.created_at) > Date.now() - 3 * 86400000) {
    return `<div class="kasten-text entwurf-kasten fehler"><strong>Der Entwurf hat nicht geklappt</strong>${esc(run.error || '')}
      <div class="knopfreihe" style="margin-top:10px"><button class="knopf zweit" data-action="planer-start" data-week="${esc(state.week)}">Noch einmal versuchen</button><button class="knopf zweit" data-action="woche-fuellen">Woche vorschlagen</button></div></div>`;
  }
  return '';
}

function planerCard() {
  if (!canPlan()) return '';
  const rules = KI.rulesOf(state.data.settings);
  const target = draftTarget();
  const latest = [...state.data.aiRuns].filter((x) => x.status !== 'ersetzt').sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  const auto = rules.auto ? `Jeden ${KI.WEEKDAYS[rules.tag] || 'Freitag'} ab ${esc(rules.zeit)} Uhr schreibt Claude einen Entwurf für die nächste Woche.` : 'Der automatische Entwurf ist ausgeschaltet.';
  if (store.mode !== 'supabase') {
    return `<div class="kasten-text planer"><strong>Wochenplan mit Claude</strong>Gibt es nur mit der gemeinsamen Datenbank, nicht im Demo-Modus.
      <div class="knopfreihe" style="margin-top:10px"><button class="knopf zweit" data-action="planer-regeln">Unsere Regeln ansehen</button></div></div>`;
  }
  return `<div class="kasten-text planer"><strong>Wochenplan mit Claude</strong>${auto}
    ${latest ? `<p class="meta" style="margin-top:6px">Zuletzt: ${esc(KI.runText(latest))}${latest.status === 'fertig' ? ` <button class="textknopf" data-action="entwurf" data-id="${esc(latest.id)}">Ansehen</button>` : ''}</p>` : ''}
    <div class="knopfreihe" style="margin-top:10px">
      <button class="knopf" data-action="planer-start" data-week="${esc(target)}">Entwurf für KW ${L.isoWeek(target)} erstellen</button>
      <button class="knopf zweit" data-action="planer-regeln">Unsere Regeln</button></div></div>`;
}

function sheetRules() {
  const r = KI.rulesOf(state.data.settings);
  const num = (name, label, value, min, max, hint = '') => `<label>${label}${hint ? ` <small>${hint}</small>` : ''}<input class="feld" type="number" inputmode="numeric" name="${name}" min="${min}" max="${max}" value="${esc(String(value))}"></label>`;
  return {
    over: 'Wochenplan mit Claude',
    title: 'Unsere Regeln',
    body: `<p class="meta" style="margin-bottom:12px">Das schickt die App mit jeder Anfrage an Claude, zusammen mit euren Bewertungen, Herzen, Terminen und Schulferien. Änderungen gelten ab dem nächsten Entwurf.</p>
      <form class="form" data-form="regeln">
        <label>Was nie vorkommen soll <small>eins pro Zeile. Die App prüft jeden Entwurf selbst darauf.</small><textarea class="feld" name="ausschluesse" rows="4">${esc(r.ausschluesse.join('\n'))}</textarea></label>
        <label>Ziele <small>zum Beispiel proteinreich, Bio, Thermomix</small><textarea class="feld" name="ziele" rows="3">${esc(r.ziele)}</textarea></label>
        <label>Vorlieben <small>was ihr gern esst und wie</small><textarea class="feld" name="vorlieben" rows="3">${esc(r.vorlieben)}</textarea></label>
        <div class="zwei">
          ${num('kochzeit', 'Kochzeit werktags in Minuten', r.kochzeit, 15, 120)}
          ${num('neue_rezepte', 'Neue Rezepte pro Woche', r.neue_rezepte, 0, 7)}
          ${num('vegan', 'Vegane Abendessen pro Woche', r.vegan, 0, 7)}
        </div>
        <label class="schalter"><input type="checkbox" name="lidl"${r.lidl !== false ? ' checked' : ''}> Lidl als zweiten Markt einbeziehen <small>bevorzugt bleibt Aldi Süd (Creidlitz). Was bei Lidl (Ketschendorf) im Angebot deutlich günstiger, besser oder nur dort zu haben ist, kommt auf die Lidl-Liste.</small></label>
        <label class="schalter"><input type="checkbox" name="saison"${r.saison !== false ? ' checked' : ''}> Obst und Gemüse der Saison bevorzugen <small>was gerade in Franken wächst oder als Lagerware aus der Region kommt. In der Einkaufsliste steht dann „Saison“ dabei.</small></label>
        <label class="schalter"><input type="checkbox" name="auto"${r.auto ? ' checked' : ''}> Jede Woche automatisch einen Entwurf erstellen</label>
        <div class="zwei">
          <label>An diesem Tag<select class="feld" name="tag">${KI.WEEKDAYS.map((d, n) => `<option value="${n}"${Number(r.tag) === n ? ' selected' : ''}>${d}</option>`).join('')}</select></label>
          <label>Ab Uhrzeit<input class="feld" type="time" name="zeit" value="${esc(r.zeit)}"></label>
        </div>
        <label>Modell<select class="feld" name="modell">${KI.MODELS.map(([id, name, hint]) => `<option value="${id}"${r.modell === id ? ' selected' : ''}>${name}, ${hint}</option>`).join('')}</select></label>
        <button class="knopf breit">Regeln speichern</button>
      </form>`,
  };
}

function sheetDraft(sh) {
  const run = state.data.aiRuns.find((x) => x.id === sh.id);
  if (!run || !run.draft) return { over: 'Wochenplan mit Claude', title: 'Kein Entwurf', body: '<p class="meta">Diesen Entwurf gibt es nicht mehr.</p>' };
  const d = run.draft;
  const week = String(run.week_start).slice(0, 10);
  const decided = run.status === 'freigegeben' || run.status === 'verworfen';
  const isNew = (name) => (d.neu || []).some((n) => n.toLowerCase() === String(name).toLowerCase());
  const own = state.data.dishes.filter((x) => L.isDinner(x) && !(stats[x.id] && stats[x.id].archived)).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const days = (d.plan || []).map((p) => {
    const options = [`<option value="${esc(p.dish)}" selected>Behalten</option>`,
      `<optgroup label="Aus eurer Sammlung">${own.filter((x) => x.name !== p.dish).map((x) => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('')}</optgroup>`,
      '<option value="">Nichts planen</option>'].join('');
    return `<li class="entwurf-tag"><div class="et-kopf"><span class="et-tag">${esc(L.fmtLong(p.day))}</span>${isNew(p.dish) ? '<span class="marke">neu</span>' : ''}</div>
      <p class="et-gericht">${esc(p.dish)}</p>
      ${decided ? '' : `<label class="et-tausch">Tauschen gegen<select class="feld" name="d_${p.day}" aria-label="Abendessen am ${esc(L.fmtLong(p.day))} tauschen">${options}</select></label>`}
      ${p.lunchbox ? `<p class="meta">Brotbox: ${esc(p.lunchbox)}</p>` : ''}${p.prep ? `<p class="meta">Am Vorabend: ${esc(p.prep)}</p>` : ''}</li>`;
  }).join('');
  const recipes = (d.dishes || []).map((g) => {
    const dish = normalizeDish(g, null);
    return `<details class="entwurf-rezept"><summary>${esc(dish.name)} <span class="meta">${dish.duration_min} Min.</span></summary>${recipeHtml(dish)}</details>`;
  }).join('');
  const trips = [...new Set((d.shopping || []).map((x) => x.trip))];
  const existing = L.weekDays(week).filter((day) => planOf(day) && planOf(day).dish_id).length;
  const warn = (run.warnings || []).length ? `<div class="kasten-text"><strong>Hinweise der App</strong><ul class="liste">${run.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '';
  const offers = (d.angebote || []).length ? `<details class="entwurf-rezept"><summary>Berücksichtigte Angebote (${d.angebote.length})</summary><ul class="liste">${d.angebote.map((a) => `<li>${esc(a)}</li>`).join('')}</ul><p class="meta">Laut Claude von aldi-sued.de${lidlOn() ? ' und lidl.de' : ''}. Ob alles vorrätig ist, zeigt sich im Laden.</p></details>` : '';
  return {
    over: `Vorschlag von Claude, KW ${L.isoWeek(week)}`,
    title: decided ? (run.status === 'freigegeben' ? 'Freigegebener Entwurf' : 'Verworfener Entwurf') : 'Wochenplan-Entwurf',
    body: `${d.hinweise ? `<p>${esc(d.hinweise)}</p>` : ''}
      ${d.kosten || d.wunsch ? `<p class="meta">${[d.kosten ? `Geschätzte Kosten für den Einkauf: etwa ${d.kosten} €${(state.data.receipts || []).length ? ', nach euren Preisen von den Kassenzetteln' : ''}.` : '', d.wunsch ? `Wunschessen von ${esc(d.wunsch)} ist dabei.` : ''].filter(Boolean).join(' ')}</p>` : ''}${warn}
      <form class="form" data-form="entwurf"><input type="hidden" name="id" value="${esc(run.id)}">
        <ul class="entwurf-tage">${days}</ul>
        ${recipes ? `<h3>Neue Rezepte</h3>${recipes}` : ''}
        ${offers}
        <p class="meta">Einkaufsliste: ${(d.shopping || []).length} Posten${(d.shopping || []).some((x) => x.shop === 'lidl') ? `, davon ${(d.shopping || []).filter((x) => x.shop === 'lidl').length} bei Lidl` : ''}${trips.length ? `, ${trips.map(esc).join(' und ')}` : ''}. Tauscht ihr ein Gericht, passt die App diese Liste an: Was nur für das alte Gericht war, fällt weg, die Zutaten des neuen kommen dazu. Brotboxen, Angebote und Touren bleiben.</p>
        ${existing && !decided ? `<p class="meta warn-text">In dieser Woche stehen schon ${existing} Gerichte. Beim Freigeben ersetzt der Entwurf den Plan und die Einkaufsliste, eigene Einträge bleiben.</p>` : ''}
        ${decided ? '' : `<label>Wunsch für den nächsten Plan <small>optional, zum Beispiel „mehr Fisch“</small><input class="feld" name="wunsch" autocomplete="off"></label>
        <button class="knopf breit">Freigeben</button>`}
      </form>
      ${decided ? '' : `<details class="entwurf-neu"><summary>Nicht zufrieden?</summary>
        <form class="form" data-form="entwurf-neu"><input type="hidden" name="id" value="${esc(run.id)}">
          <label>Was soll anders sein?<input class="feld" name="wunsch" placeholder="z. B. weniger Nudeln, ein Fischgericht mehr" autocomplete="off"></label>
          <button class="knopf zweit">Neuen Entwurf erstellen</button></form>
        <div class="knopfreihe" style="margin-top:10px"><button class="textknopf" data-action="entwurf-verwerfen" data-id="${esc(run.id)}">Entwurf verwerfen</button></div></details>`}`,
  };
}

async function startDraft(week, wish, confirmed = false) {
  const old = KI.runFor(state.data.aiRuns, week);
  if (!confirmed && old && KI.RUNNING.includes(old.status) && !(await ask(`Für KW ${L.isoWeek(week)} arbeitet Claude schon an einem Entwurf. Neu starten?`, 'Neu starten'))) return;
  if (!confirmed && old && old.status === 'fertig' && !(await ask(`Für KW ${L.isoWeek(week)} liegt schon ein Entwurf bereit. Einen neuen erstellen?`, 'Neu erstellen'))) return;
  try {
    toast('Anfrage wird gestartet.');
    await store.startDraft(week, wish || '');
    toast(`Claude arbeitet am Plan für KW ${L.isoWeek(week)}. Ihr bekommt eine Nachricht, sobald er da ist.`);
    onRemote('ep_ai_runs');
  } catch (e) { toast(e.message); }
}

/* ---------- Immer wieder ---------- */

// Auf welche Einkaufstour kommt ein „Immer wieder“-Posten? Die nächste noch offene Tour der Woche.
function targetTrip(week) {
  const items = state.data.shopping.filter((i) => i.week_start === week).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const trips = [...new Set(items.map((i) => i.trip || 'Einkauf'))];
  const today = L.todayISO();
  const open = trips.find((t) => items.some((i) => (i.trip || 'Einkauf') === t && !i.checked && (!i.due || i.due >= today)));
  const trip = open || trips[trips.length - 1] || 'Einkauf';
  const sample = items.find((i) => (i.trip || 'Einkauf') === trip) || {};
  return { trip, due: sample.due || null, buyer: sample.buyer || null };
}
// Nicht abgehakte Posten aus vergangenen Wochen wandern in die aktuelle Woche, bis sie abgehakt sind.
// Sie gelten danach als selbst eingetragen, damit ein neu erstellter Einkaufszettel sie nicht löscht.
let carrying = false;
function carryOver() {
  // Erst mit frisch geladenen Daten, nie mit dem gespeicherten Stand vom letzten Mal.
  if (!state.fresh) return;
  if (carrying || store.offline || !state.data || !state.data.persons.length) return;
  const today = L.todayISO();
  const week = L.mondayOf(today);
  // Nur die Vorwoche: ältere Listen sind abgeschlossen. Übernommenes wandert so jede Woche ein Stück weiter.
  const prev = L.addDays(week, -7);
  const old = state.data.shopping.filter((i) => !i.checked && i.week_start === prev && i.category !== 'vorhanden' && (!i.due || i.due < today));
  if (!old.length) return;
  const key = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const cleanQty = (q) => String(q || '').replace(/(,\s*)?aus KW \d+/g, '').replace(/^,\s*/, '').trim();
  const t = targetTrip(week);
  const inWeek = state.data.shopping.filter((i) => i.week_start === week);
  let maxSort = inWeek.reduce((m, i) => Math.max(m, i.sort || 0), 0);
  const moved = [];
  const gone = [];
  for (const i of old.sort((a, b) => (a.week_start < b.week_start ? -1 : 1) || (a.sort || 0) - (b.sort || 0))) {
    const qty = cleanQty(i.qty);
    const twin = [...inWeek, ...moved].find((x) => !x.checked && key(x.label) === key(i.label));
    if (twin && (!qty || cleanQty(twin.qty) === qty)) { gone.push(i.id); continue; }
    const from = L.isoWeek(i.week_start);
    const purpose = i.purpose || L.purposeOf(i, state.data.plan, state.data.dishes) || '';
    moved.push({
      ...i, week_start: week, trip: t.trip, due: t.due, buyer: t.buyer, manual: true, missing: false, purpose,
      sort: ++maxSort, qty: [qty, `aus KW ${from}`].filter(Boolean).join(', '),
    });
  }
  if (!moved.length && !gone.length) return;
  carrying = true;
  if (moved.length) toast(`${moved.length === 1 ? '1 offener Posten' : `${moved.length} offene Posten`} aus KW ${L.isoWeek(prev)} ${moved.length === 1 ? 'steht' : 'stehen'} jetzt auf der Liste dieser Woche.`);
  commit(() => {
    state.data.shopping = state.data.shopping.filter((i) => !gone.includes(i.id)).map((i) => moved.find((m) => m.id === i.id) || i);
  }, async () => {
    try {
      if (moved.length) await store.saveItems(moved);
      if (gone.length) await store.deleteItems(gone);
    } finally { carrying = false; }
  });
}
const stapleOnList = (x, week) => state.data.shopping.find((i) => i.week_start === week && !i.checked
  && (i.staple_id === x.id || i.label.trim().toLowerCase() === x.label.trim().toLowerCase()));

function sheetStaples() {
  const order = (c) => { const n = L.SHOP_CAT_ORDER.indexOf(c); return n < 0 ? 99 : n; };
  const items = [...state.data.staples].sort((a, b) => order(a.category) - order(b.category) || (a.sort || 0) - (b.sort || 0));
  const target = targetTrip(state.week);
  const catOptions = L.SHOP_CAT_ORDER.filter((c) => c !== 'vorhanden').map((c) => `<option value="${c}"${c === 'haushalt' ? ' selected' : ''}>${esc(L.SHOP_CATS[c])}</option>`).join('');
  let lastCat = '';
  const rows = items.map((x) => {
    const on = stapleOnList(x, state.week);
    const head = x.category !== lastCat ? `<li class="abteilung-kopf">${esc(L.SHOP_CATS[x.category] || 'Sonstiges')}</li>` : '';
    lastCat = x.category;
    const meta = on ? 'steht auf der Liste' : x.last_added ? `zuletzt am ${L.fmtShort(x.last_added)} auf der Liste` : (x.qty || '');
    return `${head}<li class="${on ? 'auf-liste' : ''}"><div class="extra-zeile">
      <span class="p-text"><span class="p-name">${esc(x.label)}</span>${meta ? `<span class="p-menge">${esc(meta)}</span>` : ''}</span>
      <button class="knopf ${on ? '' : 'zweit'} klein" data-action="immer-umschalten" data-id="${esc(x.id)}" aria-pressed="${!!on}">${on ? 'Steht drauf' : 'Auf die Liste'}</button>
      ${canPlan() ? `<button class="weg" data-action="immer-weg" data-id="${esc(x.id)}" aria-label="${esc(x.label)} aus „Immer wieder“ entfernen">${CROSS}</button>` : ''}</div></li>`;
  }).join('');
  return {
    over: 'Einkauf',
    title: 'Immer wieder',
    body: `<p class="meta" style="margin-bottom:12px">Was ihr regelmäßig braucht, unabhängig vom Wochenplan. Ein Tipp setzt es auf „${esc(target.trip)}“ in der KW ${L.isoWeek(state.week)}, ein zweiter nimmt es wieder herunter.</p>
      ${items.length ? `<ul class="posten immer">${rows}</ul>`
        : `<p class="meta">Noch nichts eingetragen.</p><div class="knopfreihe"><button class="knopf zweit" data-action="immer-start">Typische Dinge eintragen</button></div>`}
      <form class="dazu immer-dazu" data-form="immer">
        <input class="feld" name="label" aria-label="Neuer Eintrag für „Immer wieder“" placeholder="z. B. Zahnpasta" autocomplete="off" required>
        <select class="feld" name="category" aria-label="Abteilung">${catOptions}</select>
        <button class="knopf">Dazu</button></form>`,
  };
}

// Vorrat, der vor einer Weile gekauft wurde und seitdem in geplanten Gerichten steckte: Ist noch etwas da?
const PANTRY_ASK_DAYS = 28;
function pantryToCheck() {
  const today = L.todayISO();
  const norm = (x) => String(x || '').toLowerCase().replace(/^bio[- ]/, '').trim();
  return state.data.pantry.filter((x) => x.have && x.seen_at && L.addDays(x.seen_at, PANTRY_ASK_DAYS) <= today).filter((x) => {
    const key = norm(x.label).split(/\s+/)[0];
    if (key.length < 3) return false;
    return state.data.plan.some((p) => p.dish_id && !p.skipped && p.day > x.seen_at && p.day <= today
      && ((dishById(p.dish_id) || {}).ingredients || []).some((g) => norm(g.n).includes(key)));
  });
}

function sheetPantry() {
  const items = [...state.data.pantry].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const ask = pantryToCheck();
  return {
    over: 'Einkauf',
    title: 'Was haben wir noch?',
    body: `${ask.length ? `<div class="kasten-text"><strong>Noch da?</strong>Vor über vier Wochen gekauft und seitdem verkocht:
      <ul class="posten">${ask.map((x) => `<li><div class="extra-zeile"><span class="p-text"><span class="p-name">${esc(x.label)}</span><span class="p-menge">zuletzt ${esc(L.fmtShort(x.seen_at))}</span></span>
      <button class="knopf zweit klein" data-action="vorrat-ja" data-id="${esc(x.id)}">Noch da</button><button class="knopf klein" data-action="vorrat-umschalten" data-id="${esc(x.id)}">Leer</button></div></li>`).join('')}</ul></div>` : ''}
      <p class="meta" style="margin-bottom:12px">Was hier als „da“ steht, setzt die App bei neuen Einkaufslisten schon als abgehakt ans Ende. Ist etwas leer, kommt es mit einem Tipp auf die Einkaufsliste dieser Woche. Kassenzettel setzen gekaufte Vorräte automatisch auf „da“.</p>
      ${items.length ? `<ul class="posten">${items.map((x) => `<li class="${x.have ? '' : 'leer-zeile'}"><div class="extra-zeile">
        <span class="p-text"><span class="p-name">${esc(x.label)}</span><span class="p-menge">${x.have ? 'da' : 'leer, steht auf der Einkaufsliste'}</span></span>
        <button class="knopf ${x.have ? 'zweit' : ''} klein" data-action="vorrat-umschalten" data-id="${esc(x.id)}">${x.have ? 'Ist leer' : 'Wieder da'}</button>
        ${canPlan() ? `<button class="weg" data-action="vorrat-weg" data-id="${esc(x.id)}" aria-label="${esc(x.label)} aus dem Vorrat entfernen">${CROSS}</button>` : ''}</div></li>`).join('')}</ul>`
        : `<p class="meta">Noch nichts eingetragen.</p>${canPlan() ? '<div class="knopfreihe"><button class="knopf zweit" data-action="vorrat-start">Typischen Vorrat eintragen</button></div>' : ''}`}
      <form class="dazu" data-form="vorrat"><input class="feld" name="label" aria-label="Vorrat ergänzen" placeholder="z. B. Bio-Reis" autocomplete="off" required><button class="knopf">Dazu</button></form>`,
  };
}

/* ---------- Kalender-Erinnerungen für die Mülltonnen ---------- */

const framed = () => { try { return window.self !== window.top; } catch (e) { return true; } };

function trashIcs() {
  const today = L.todayISO();
  const esc2 = (t) => t.replace(/([,;\\])/g, '\\$1');
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Familienplan//DE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Mülltonnen'];
  for (const [d, t] of ABFUHR) {
    if (d <= today) continue;
    const eve = L.addDays(d, -1).replace(/-/g, '');
    const bin = cap(TONNEN[t] || t);
    lines.push('BEGIN:VEVENT', `UID:tonne-${d}-${t}@familienplan`, `DTSTAMP:${stamp}`, `DTSTART:${eve}T180000`, `DTEND:${eve}T181500`,
      `SUMMARY:${esc2(`${bin} an die Straße stellen`)}`, `DESCRIPTION:${esc2(`Abholung am ${L.fmtLong(d)}. Am nächsten Tag zurückholen.`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc2(`${bin} rausstellen`)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// Abfuhrtermine: wie lange sie reichen, und Hochladen der Kalenderdatei der CEB.
const abfuhrEnd = () => (ABFUHR.length ? ABFUHR[ABFUHR.length - 1][0] : '');
const abfuhrLow = () => abfuhrEnd() < L.addDays(L.todayISO(), 21);
function abfuhrBox(always) {
  if (!canPlan() || (!always && !abfuhrLow())) return '';
  const end = abfuhrEnd();
  const low = abfuhrLow();
  return `<div class="kasten-text${low ? ' kasten-warn' : ''}" style="margin-top:14px"><strong>${low ? 'Abfuhrtermine gehen zu Ende' : 'Müllabfuhr'}</strong>${end ? `Bekannt sind die Termine bis ${esc(L.fmtLong(end))}.` : 'Es sind keine Termine hinterlegt.'}
    ${low ? ' Danach gibt es keine Tonnen-Aufgabe und keine Erinnerung mehr.' : ''} Auf abfuhrkalender.ceb-coburg.de eure Straße wählen, die Kalenderdatei (.ics) laden und hier hochladen.
    <div class="knopfreihe" style="margin-top:10px"><label class="knopf zweit klein foto-knopf"><input type="file" id="abfuhr-datei" accept=".ics,text/calendar">Kalenderdatei hochladen</label></div></div>`;
}
async function readAbfuhrFile(file) {
  if (!file) return;
  let parsed;
  try { parsed = parseIcs(await file.text()); } catch (e) { toast('Die Datei ließ sich nicht lesen.'); return; }
  if (!parsed.list.length) { toast('In der Datei stehen keine Termine für schwarze, grüne oder gelbe Tonne.'); return; }
  const old = (KI.settingOf(state.data.settings, 'abfuhr') || {}).liste || [];
  const from = parsed.list[0][0];
  const liste = [...old.filter(([d]) => d < from), ...parsed.list];
  const row = { key: 'abfuhr', value: { liste, datei: file.name, stand: L.todayISO() }, updated_at: new Date().toISOString() };
  const merged = useImported(liste);
  commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'abfuhr'), row]; }, async () => {
    await store.saveSettings([row]);
    await store.replaceAbfuhr(from, merged.filter(([d]) => d >= from).map(([day, bin]) => ({ day, bin })));
  });
  const n = parsed.list.length;
  toast(`${n} ${n === 1 ? 'Abholtermin' : 'Abholtermine'} bis ${L.fmtShort(parsed.list[n - 1][0])} eingelesen.${parsed.skipped.length ? ` Nicht übernommen: ${parsed.skipped.slice(0, 3).join(', ')}.` : ''}`);
}

function reminderBox() {
  if (state.push && state.push.subscribed) return '';
  const next = ABFUHR.filter(([d]) => d > L.todayISO());
  if (!next.length) return '';
  return `<div class="kasten-text erinnerung"><strong>Erinnerung an die Mülltonnen</strong>Eine Kalenderdatei mit allen Abholterminen bis ${L.fmtShort(next[next.length - 1][0])} Auf dem Handy öffnen, dann erinnert der Kalender jeweils am Vorabend um 18 Uhr.
    ${framed() ? '<p class="meta">In der veröffentlichten App lässt sich die Datei hier laden.</p>' : '<div class="knopfreihe" style="margin-top:10px"><button class="knopf zweit" data-action="tonnen-ics">Erinnerungen in den Kalender</button></div>'}</div>`;
}

/* ---------- Wochenbilanz ab Freitag ---------- */

function weekReview(week) {
  const today = L.todayISO();
  if (week !== L.mondayOf(today) || L.wdIndex(today) < 4) return '';
  const days = L.weekDays(week).filter((d) => d <= today);
  const dinners = days.map((d) => {
    const p = planOf(d);
    const r = state.data.ratings.filter((x) => x.day === d);
    return p && p.dish_id && r.length ? { d, dish: dishById(p.dish_id), avg: r.reduce((a, x) => a + x.stars, 0) / r.length } : null;
  }).filter((x) => x && x.dish).sort((a, b) => b.avg - a.avg);
  const hearts = {};
  for (const h of state.data.hearts.filter((x) => x.week_start === week)) hearts[h.dish_id] = (hearts[h.dish_id] || 0) + 1;
  const topHeart = Object.entries(hearts).sort((a, b) => b[1] - a[1])[0];
  const lunches = days.map((d) => {
    const r = lunchRatingsOf(d);
    return r.length ? { d, text: lunchOf(d), avg: r.reduce((a, x) => a + x.stars, 0) / r.length } : null;
  }).filter(Boolean).sort((a, b) => b.avg - a.avg);
  const kids = kidsList().map((k) => {
    const rows = state.data.taskLog.filter((e) => e.person_id === k.id && e.day >= week && e.day <= today && e.status === 'bestaetigt' && e.minutes >= 0);
    return { k, n: rows.length, min: rows.reduce((a, e) => a + e.minutes, 0) };
  });
  const items = [];
  if (dinners[0]) items.push(`<li><span class="b-l">Bestes Abendessen</span><span class="b-w">${esc(dinners[0].dish.name)} <span class="schnitt">${MINI} ${L.fmtStars(dinners[0].avg)}</span></span></li>`);
  if (topHeart) items.push(`<li><span class="b-l">Herz der Kinder</span><span class="b-w">${esc((dishById(topHeart[0]) || {}).name || '')} <span class="herz-mini">${HEART}${topHeart[1] > 1 ? topHeart[1] : ''}</span></span></li>`);
  if (lunches[0]) items.push(`<li><span class="b-l">Beste Brotbox</span><span class="b-w">${esc(lunches[0].text)} <span class="schnitt">${MINI} ${L.fmtStars(lunches[0].avg)}</span></span></li>`);
  if (state.data.tasks.length) for (const x of kids) items.push(`<li><span class="b-l">${esc(x.k.name)}</span><span class="b-w">${x.n} ${x.n === 1 ? 'Aufgabe' : 'Aufgaben'} erledigt, ${x.min} Min. verdient</span></li>`);
  if (!items.length) return '';
  return `<section class="bilanz"><h2 class="abschnitt">Die Woche im Rückblick</h2><ul>${items.join('')}</ul>
    ${canPlan() ? '<div class="knopfreihe"><button class="knopf zweit" data-action="export">Auswertung für Claude</button></div><p class="meta">Mit der Auswertung plant Claude die nächste Woche.</p>' : ''}</section>`;
}

/* ---------- Aufgaben und Bildschirmzeit ---------- */

// Zeitstempel zum heutigen Datum der App, im Demo-Modus also zum Testdatum.
function nowStamp() {
  const [y, m, d] = L.todayISO().split('-').map(Number);
  const n = new Date();
  return new Date(y, m - 1, d, n.getHours(), n.getMinutes(), n.getSeconds()).toISOString();
}
const nowMs = () => Date.parse(nowStamp());
const kidsList = () => (state.data.persons.some(isAdult) ? state.data.persons.filter((p) => !isAdult(p)) : state.data.persons);
const isKidMe = () => kidsList().some((p) => p.id === state.me);
const capOf = (p) => (p && p.earn_cap != null && p.earn_cap !== '' ? Number(p.earn_cap) : null);
const taskById = (id) => state.data.tasks.find((t) => t.id === id);

function fmtClock(ms) {
  const d = new Date(ms);
  const day = L.toISO(d);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${day === L.todayISO() ? 'heute' : day === L.addDays(L.todayISO(), 1) ? 'morgen' : `${L.WD_SHORT[L.wdIndex(day)]} ${L.fmtShort(day)}`} um ${hm}`;
}

function taskBadge() {
  if (!state.data.tasks.length) return 0;
  if (canPlan() && state.data.persons.some(isAdult)) return state.data.taskLog.filter((e) => e.status === 'offen').length;
  if (isKidMe()) return A.tasksFor(state.data.tasks, state.data.taskLog, state.me, L.todayISO()).fixed.filter((f) => !f.done && !stHides(f.task)).length + (kmFor(personById(state.me)) ? kmRedOpen() : 0) + (smFor(personById(state.me)) ? smRedOpen() : 0) + (stFor(personById(state.me)) ? stRedOpen() : 0);
  return 0;
}

// Familienregel: Minuten erst nach den Grundaufgaben. Im Urlaub (verreist) gilt sie nicht.
const basicsFirst = () => (KI.settingOf(state.data.settings, 'aufgaben') || {}).grund_zuerst !== false;
// Auch Grundaufgaben (ohne Minuten) bestätigen die Eltern. Bis dahin zählen sie als erledigt.
const basicsConfirm = () => (KI.settingOf(state.data.settings, 'aufgaben') || {}).grund_bestaetigen !== false;
// Aufgaben mit Fotonachweis (Kennungen in ep_settings "aufgaben".foto).
const fotoTasks = () => { const v = (KI.settingOf(state.data.settings, 'aufgaben') || {}).foto; return Array.isArray(v) ? v : []; };
const needsFoto = (task) => !!task && fotoTasks().includes(task.id);
// Wochenbonus in Minuten, 0 heißt aus. Voreingestellt sind 30 Minuten.
const bonusMinutes = () => { const v = (KI.settingOf(state.data.settings, 'aufgaben') || {}).wochenbonus; return v == null ? 30 : Math.max(0, Number(v) || 0); };
const awayOn = (day) => { const h = holidayOf(day); return !!(h && h.weg !== false); };
const weekBonusOf = (person, week) => A.weekBonus(state.data.tasks, state.data.taskLog, person.id, week, L.todayISO(), awayOn);

// Geschaffte Wochen gutschreiben: die Vorwoche und, sobald am Sonntag alles erledigt ist, auch die laufende Woche.
let granting = false;
// Uhrzeiten der Aufgaben-Erinnerungen, wie sie die Push-Funktion liest. Leer heißt aus.
const REMIND_DEFAULT = { kind1: '16:30', kind2: '19:00', eltern: '20:00' };
const remindTimes = () => ({ ...REMIND_DEFAULT, ...((KI.settingOf(state.data.settings, 'aufgaben') || {}).erinnerung || {}) });
const clockText = (t) => { const [h, m] = String(t).split(':'); return `${Number(h)}${m === '00' ? '' : `:${m}`} Uhr`; };
const kidRemindText = () => {
  const t = [remindTimes().kind1, remindTimes().kind2].filter(Boolean).sort();
  return t.length ? `Um ${t.map(clockText).join(' und ')}, wenn Aufgaben für heute noch offen sind.` : '';
};
const REMIND_OPTIONS = Array.from({ length: 17 }, (_, i) => { const m = 14 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });
const remindSelect = (name, label, value) => `<label class="feld-label">${label}<select class="feld" name="${name}" aria-label="${label}">
  <option value=""${value ? '' : ' selected'}>aus</option>${[...new Set([...REMIND_OPTIONS, ...(value ? [value] : [])])].sort().map((o) => `<option value="${o}"${o === value ? ' selected' : ''}>${clockText(o)}</option>`).join('')}</select></label>`;

// Grundaufgaben der Woche, die noch auf Mama oder Papa warten. Der Bonus kommt erst danach.
const basicsWaiting = (pid, week) => state.data.taskLog.some((e) => e.person_id === pid && e.task_id && !e.minutes && e.status === 'offen' && e.day >= week && e.day <= L.addDays(week, 6));

function grantBonus() {
  if (!state.fresh) return;
  const minutes = bonusMinutes();
  if (granting || !minutes || store.offline || !state.data || !state.data.tasks.length) return;
  const today = L.todayISO();
  const weeks = [L.addDays(L.mondayOf(today), -7), ...(L.wdIndex(today) === 6 ? [L.mondayOf(today)] : [])];
  const now = nowStamp();
  const rows = [];
  for (const p of kidsList()) {
    for (const w of weeks) {
      if (state.data.taskLog.some((e) => e.id === A.bonusId(w, p.id))) continue;
      if (!weekBonusOf(p, w).complete || basicsWaiting(p.id, w)) continue;
      rows.push({ id: A.bonusId(w, p.id), person_id: p.id, task_id: null, day: today, label: `Wochenbonus KW ${L.isoWeek(w)}: alle Grundaufgaben geschafft`, minutes, status: 'bestaetigt', created_at: now, decided_by: null, decided_at: now });
    }
  }
  if (!rows.length) return;
  granting = true;
  commit(() => { state.data.taskLog = [...state.data.taskLog, ...rows]; }, async () => { try { await store.saveLog(rows); } finally { granting = false; } });
  const mine = rows.find((r) => r.person_id === state.me);
  if (mine) toast(`Wochenbonus: ${minutes} Extra-Minuten, weil du alle Grundaufgaben geschafft hast.`);
}

// Fortschritt für das Kind: sieben Punkte für die Woche und ein Satz dazu.
function bonusCard(person) {
  const minutes = bonusMinutes();
  if (!minutes) return '';
  const today = L.todayISO();
  const week = L.mondayOf(today);
  const b = weekBonusOf(person, week);
  const got = state.data.taskLog.some((e) => e.id === A.bonusId(week, person.id));
  const dot = (d, n) => `<span class="bonus-tag ${d}" title="${L.WD_SHORT[n]}">${L.WD_SHORT[n].slice(0, 2)}</span>`;
  const text = got ? `Geschafft! ${minutes} Extra-Minuten sind gutgeschrieben.`
    : b.complete && basicsWaiting(person.id, week) ? `Geschafft! Die ${minutes} Extra-Minuten kommen, sobald Mama oder Papa alles bestätigt haben.`
    : b.missed ? 'Diese Woche hat es nicht an jedem Tag geklappt. Ab Montag gibt es eine neue Chance.'
      : `Schaffst du bis Sonntag jeden Tag alle Grundaufgaben, gibt es ${minutes} Extra-Minuten.`;
  return `<div class="kasten-text bonus-kasten"><strong>Wochenbonus</strong>${text}<div class="bonus-tage" aria-label="${b.ok} von ${b.due} Tagen geschafft">${b.days.map(dot).join('')}</div></div>`;
}
function lockOf(e) {
  if (!basicsFirst() || !e) return [];
  const h = holidayOf(e.day);
  if (h && h.weg !== false) return [];
  return A.lockedBy(state.data.tasks, state.data.taskLog, e);
}

function statusChip(e) {
  if (!e) return '';
  if (e.status === 'offen' && lockOf(e).length) return '<span class="chip warten">wartet auf deine Grundaufgaben</span>';
  if (e.status === 'offen') return '<span class="chip warten">wartet auf Bestätigung</span>';
  if (e.status === 'abgelehnt') return '<span class="chip nein">nicht anerkannt</span>';
  return e.minutes ? `<span class="chip ja">+${e.minutes} Min.</span>` : '<span class="chip ja">erledigt</span>';
}

function accountCard(person, compact) {
  const acc = A.account(state.data.taskLog, person.id, capOf(person), nowMs(), L.todayISO());
  const lines = [];
  if (person.screen_base) lines.push(`Grundzeit ${person.screen_base} Min. pro Tag`);
  if (acc.cap != null) lines.push(`heute ${acc.todayEarned} von ${acc.cap} Min. verdient`);
  if (acc.pending) lines.push(`${acc.pending} Min. warten auf Bestätigung`);
  if (acc.nextExpiry) lines.push(`${acc.nextExpiry.minutes} Min. verfallen ${fmtClock(acc.nextExpiry.at)}`);
  return `<div class="konto${compact ? ' klein' : ''}">
    ${compact ? `<div class="konto-kopf">${avatar(person)}<span class="konto-name">${esc(person.name)}</span></div>` : ''}
    <div class="konto-zahl"><span class="n">${acc.balance}</span><span class="l">Minuten Bildschirmzeit verdient</span></div>
    <p class="meta">${esc(lines.join(', '))}</p>
    ${acc.todayCapped ? '<p class="meta">Das Tageslimit ist erreicht. Weitere Aufgaben zählen erst morgen wieder.</p>' : ''}
    ${compact && canPlan() ? `<div class="knopfreihe"><button class="knopf zweit" data-action="einloesen" data-id="${esc(person.id)}"${acc.balance ? '' : ' disabled'}>Bildschirmzeit einlösen</button></div>` : ''}
    ${!compact && isKidMe() && state.me === person.id ? shopTeaser(person) : ''}
  </div>`;
}

function taskRow(item) {
  const t = item.task;
  const e = item.done;
  const reward = t.minutes ? `+${t.minutes} Min.` : 'Grundaufgabe';
  const meta = [item.weekly && L.wdIndex(L.todayISO()) === 6 ? 'Wochenaufgabe, heute letzter Tag' : '', reward].filter(Boolean).join(', ') + (reward.endsWith('.') ? '' : '.');
  return `<li class="${e && e.status !== 'abgelehnt' ? 'erledigt' : ''}"><button class="haken-knopf" data-action="aufgabe" data-id="${esc(t.id)}" aria-pressed="${!!e}">
    <span class="kasten">${CHECK}</span>
    <span class="p-text"><span class="p-name">${esc(item.label)}</span><span class="p-menge">${esc(meta)}${t.note ? ` ${esc(t.note)}` : ''}</span>${e ? statusChip(e) : item.rejected ? '<span class="chip nein">nicht anerkannt, bitte noch einmal</span>' : ''}</span></button></li>`;
}

function extraRow(item) {
  const t = item.task;
  const today = state.data.taskLog.filter((e) => e.task_id === t.id && e.person_id === state.me && e.day === L.todayISO() && e.status !== 'abgelehnt');
  return `<li><div class="extra-zeile">
    <span class="p-text"><span class="p-name">${esc(t.name)}</span><span class="p-menge">+${t.minutes} Min.${t.note ? ` ${esc(t.note)}` : ''}</span>
    ${today.map(statusChip).join(' ')}</span>
    ${item.left ? `<button class="knopf zweit klein" data-action="extra" data-id="${esc(t.id)}">Erledigt</button>` : '<span class="chip">heute geschafft</span>'}</div></li>`;
}

function basicsHint(person, day, away) {
  if (!basicsFirst() || away) return '';
  const open = A.basicsOpen(state.data.tasks, state.data.taskLog, person.id, day);
  if (!open.length) return '';
  return `<div class="kasten-text grund-zuerst"><strong>Erst die Grundaufgaben</strong>Extra-Aufgaben kannst du schon abhaken. Die Minuten werden aber erst bestätigt, wenn das erledigt ist: ${esc(open.join(', '))}.</div>`;
}

// Tagesaufgaben zuerst und deutlich, Wochenaufgaben darunter mit der Zeit, die noch bleibt.
// Am Sonntag gehört eine offene Wochenaufgabe zu heute.
function fixedSections(fixed, today) {
  if (!fixed.length) return '<p class="meta">Heute stehen keine festen Aufgaben an.</p>';
  const left = 6 - L.wdIndex(today);
  const daily = A.mustToday(fixed, today);
  const weekly = fixed.filter((f) => !daily.includes(f));
  const openToday = daily.filter((f) => !f.done).length;
  const head = daily.length
    ? `<div class="pflicht${openToday ? '' : ' fertig'}"><div class="pflicht-kopf"><strong>Heute auf jeden Fall</strong><span>${openToday ? `${openToday} offen` : 'alles erledigt'}</span></div><ul class="posten">${daily.map(taskRow).join('')}</ul></div>`
    : '';
  const rest = weekly.length
    ? `<h2 class="abschnitt abstand">Diese Woche</h2><p class="meta unter">Irgendwann bis Sonntag, ${left === 1 ? 'noch 1 Tag' : `noch ${left} Tage`} Zeit.</p><ul class="posten">${weekly.map(taskRow).join('')}</ul>`
    : '';
  return head + rest;
}

function kidTasks(person) {
  const today = L.todayISO();
  const { fixed: allFixed, extras: allExtras } = A.tasksFor(state.data.tasks, state.data.taskLog, person.id, today);
  // Den Küchenmüll, die Spülmaschine und (mit Ampel) den Stall gibt es nur über die Ampel.
  const km = A.kmTask(state.data.tasks);
  const sm = A.smTask(state.data.tasks);
  const extras = allExtras.filter((x) => (!km || x.task.id !== km.id) && (!sm || x.task.id !== sm.id) && !stHides(x.task));
  const fixed = allFixed.filter((f) => !stHides(f.task));
  const week = L.mondayOf(today);
  const doneWeek = state.data.taskLog.filter((e) => e.person_id === person.id && e.day >= week && e.day <= today && e.minutes !== 0)
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  const h = holidayOf(today);
  const away = h && h.weg !== false ? h : null;
  return `${accountCard(person)}${bonusCard(person)}
    <h2 class="abschnitt">${L.fmtLong(today)}</h2>
    ${away ? '' : kmCard(person) + stCard(person)}
    ${away ? `<div class="kasten-text"><strong>${esc(away.name || 'Urlaub')}</strong>Bis ${esc(L.fmtLong(away.bis))} pausieren die festen Aufgaben. Wer trotzdem hilft, kann eine Extra-Aufgabe abhaken.</div>` : fixedSections(fixed, today)}
    ${fixed.some((f) => f.bin) || state.data.tasks.some((t) => t.schedule === 'tonne' && (t.who || []).includes(person.id)) ? reminderBox() : ''}
    ${extras.length ? `<h2 class="abschnitt abstand">Extra-Aufgaben</h2><p class="meta unter">Wenn es nötig ist und du Zeit hast.</p>${basicsHint(person, today, away)}<ul class="posten">${extras.map(extraRow).join('')}</ul>` : ''}
    ${wishCard(person)}
    ${doneWeek.length ? `<h2 class="abschnitt abstand">Diese Woche</h2><ul class="verlauf">${doneWeek.map((e) => `<li><span>${L.WD_SHORT[L.wdIndex(e.day)]}</span><span class="v-text">${esc(e.label)}</span>${e.minutes < 0 ? shopChip(e) : statusChip(e)}</li>`).join('')}</ul>` : ''}`;
}

function parentTasks() {
  const pending = state.data.taskLog.filter((e) => e.status === 'offen').sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const today = L.todayISO();
  const kids = kidsList();
  // Käufe im Minuten-Shop lösen die Eltern selbst ein, deshalb nicht bei „Alle bestätigen“.
  const free = pending.filter((e) => !lockOf(e).length && !A.isShop(e));
  ensureFotoLinks(pending.filter(fotoEntry).map((e) => e.id));
  const queue = pending.length ? `<h2 class="abschnitt">Zu bestätigen</h2><ul class="posten bestaetigen">${pending.map((e) => {
    const p = personById(e.person_id);
    const lock = lockOf(e);
    if (A.isShop(e)) return shopQueueRow(e, p, today);
    return `<li${lock.length ? ' class="gesperrt"' : ''}><div class="extra-zeile">${avatar(p, true)}<span class="p-text"><span class="p-name">${esc(e.label)}</span>
      <span class="p-menge">${esc(p ? p.name : '')}, ${e.day === today ? 'heute' : `${L.WD_SHORT[L.wdIndex(e.day)]} ${L.fmtShort(e.day)}`}, ${e.minutes ? `+${e.minutes} Min.` : 'Grundaufgabe'}</span>
      ${lock.length ? `<span class="p-wofuer">Wartet auf die Grundaufgaben: ${esc(lock.join(', '))}</span>` : ''}${fotoEntry(e) ? fotoThumb(e) : ''}</span>
      <span class="ja-nein"><button class="knopf ${lock.length ? 'zweit ' : ''}klein" data-action="log-ok" data-id="${esc(e.id)}"${lock.length ? ` aria-label="${esc(e.label)} trotzdem bestätigen"` : ''}>${lock.length ? 'Trotzdem' : 'Bestätigen'}</button>
      <button class="knopf zweit klein" data-action="log-nein" data-id="${esc(e.id)}" aria-label="${esc(e.label)} nicht anerkennen">Nein</button></span></div></li>`;
  }).join('')}</ul>${free.length > 1 ? `<div class="fuss"><button class="textknopf" data-action="log-alle">${free.length < pending.length ? `Alle freigegebenen bestätigen (${free.length})` : 'Alle bestätigen'}</button></div>` : ''}` : '';
  const cards = kids.map((k) => {
    const { fixed } = A.tasksFor(state.data.tasks, state.data.taskLog, k.id, today);
    const must = A.mustToday(fixed, today);
    const open = must.filter((f) => !f.done).map((f) => f.label);
    const week = fixed.filter((f) => !must.includes(f) && !f.done && !stHides(f.task)).map((f) => f.label);
    const line = !fixed.length ? 'Heute keine festen Aufgaben.'
      : `${open.length ? `Heute noch offen: ${esc(open.join(', '))}.` : must.length ? 'Heute alles erledigt.' : ''}${week.length ? ` Diese Woche noch: ${esc(week.join(', '))}.` : ''}`.trim() || 'Heute keine festen Aufgaben.';
    return `${accountCard(k, true).replace(/<\/div>\s*$/, '')}
      <p class="meta">${line}</p></div>`;
  }).join('');
  const kmBox = kmParent() + smParent() + stParent();
  return `${queue}${kmBox ? `<div${pending.length ? ' class="km-abstand"' : ''}>${kmBox}</div>` : ''}<h2 class="abschnitt mit-info${pending.length || kmBox ? ' abstand' : ''}">Minutenkonten ${infoBtn('konten', 'Wie die Minuten verfallen')}</h2>${infoText('konten', `Verdiente Minuten verfallen ${A.EXPIRY_HOURS} Stunden nach der Bestätigung. Beim Einlösen gehen die ältesten zuerst weg.`)}<div class="konten">${cards}</div>
    <div class="knopfreihe"><button class="knopf zweit" data-action="aufgaben-liste">Aufgaben verwalten</button><button class="knopf zweit" data-action="shop-verwalten">Minuten-Shop</button></div>
    ${reminderBox()}${abfuhrBox(false)}`;
}

function viewAufgaben() {
  if (!state.data.tasks.length) {
    return `<div class="leer"><h2 class="abschnitt">Noch keine Aufgaben</h2>${canPlan()
      ? '<p>Die Startliste enthält Meerschweinchen, Tisch, Spülmaschine, Müll, Mülltonne, Staubsaugen, Kochen und Laub, aufgeteilt nach Alter.</p><div class="knopfreihe"><button class="knopf" data-action="aufgaben-start">Startaufgaben einspielen</button></div>'
      : '<p>Mama oder Papa richten die Aufgaben ein.</p>'}</div>`;
  }
  const me = personById(state.me);
  let html = schoolCard();
  if (isKidMe() && me) html += kidTasks(me);
  if (canPlan()) html += (html ? '<hr class="trenner">' : '') + parentTasks();
  return html;
}

/* ---------- Lernplaner (lernen.html) ---------- */
// Der Lernplaner speichert in der Tabelle lp_data. Hier wird nur der Stand gelesen und als Karte gezeigt.
async function loadSchool() {
  if (store.mode !== 'supabase' || !store.sb || store.offline) return false;
  try {
    const [st, list] = await Promise.all([
      store.sb.from('lp_stand').select('*').maybeSingle(),
      store.sb.from('lp_erledigt_heute').select('*'),
    ]);
    if (st.error || list.error || !st.data) { state.lp = null; return false; }
    state.lp = { ...st.data, liste: list.data || [] };
    return true;
  } catch (e) {
    return false; // Lernplaner noch nicht eingerichtet
  }
}

function schoolCard() {
  const s = state.lp;
  if (!s) return '';
  const me = personById(state.me);
  const kid = personById(s.kind_id);
  const forMe = !!(me && kid && me.id === kid.id);
  if (!forMe && !(me && isAdult(me))) return '';
  const won = s.siege_woche >= s.siegziel;
  const start = s.anpfiff ? `Anpfiff um ${esc(s.anpfiff)}` : 'noch nicht angefangen';
  const list = (s.liste || []).map((x) => `<li><span class="sk-fach">${esc(x.fach)}</span> ${esc(x.aufgabe)}${x.minuten ? ` <small>${x.minuten} Min.</small>` : ''}</li>`).join('');
  return `<div class="schul-karte${s.tagessieg ? ' sieg' : ''}">
    <div class="sk-kopf"><strong>${forMe ? 'Dein Lerntag' : `Schule${kid ? ` · ${esc(kid.name)}` : ''}`}</strong>${s.tagessieg ? '<span class="sk-chip">Tagessieg</span>' : ''}</div>
    <div class="sk-zeile">Heute ${s.heute_erledigt} erledigt, ${s.heute_minuten} Min. gelernt, ${start}.</div>
    <div class="sk-zeile">Wochenspiel: ${s.siege_woche} von ${s.siegziel} Tagessiegen${won ? `. Siegprämie: ${s.aufbleiben_min} Min. länger aufbleiben am Freitag und Samstag.` : '.'}</div>
    ${!forMe && s.hilfe_offen ? `<div class="sk-hilfe">${s.hilfe_offen}× als schwer markiert. Im Lernplaner unter „Braucht Hilfe“ nachsehen.</div>` : ''}
    ${list ? `<ul class="sk-liste">${list}</ul>` : ''}
    <a class="knopf${forMe ? ' breit' : ' zweit klein'}" href="lernen.html">${forMe ? 'Zum Lernplaner' : 'Lernplaner öffnen'}</a>
  </div>`;
}

/* ---------- Mülleimer in der Küche ---------- */
// Ampel für Plastik- und Restmüll (Logik in js/aufgaben.js). Die Eltern schalten die Stufen, bei Gelb und Rot
// melden die Kinder „Rausgebracht“, mit der Bestätigung springt der Eimer auf Grün. Bei Rot schickt die Push-Funktion
// den Kindern eine Nachricht (7 bis 20:30 Uhr, sonst am nächsten Morgen).
const KM_WORT = { rot: 'Voll', gelb: 'Fast voll', gruen: 'Noch Platz' };
const KM_KIND = { rot: 'Bitte jetzt rausbringen.', gelb: 'Du kannst ihn schon rausbringen.', gruen: 'Gerade nichts zu tun.' };
const KM_PUSH_VON = 7 * 60;
const KM_PUSH_BIS = 20 * 60 + 30;
const kmValue = () => KI.settingOf(state.data.settings, 'kuechenmuell');
const kmKids = () => { const t = A.kmTask(state.data.tasks); return t ? A.assignees(t, L.todayISO()).filter((id) => kidsList().some((k) => k.id === id)) : []; };
const kmFor = (person) => !!person && kmKids().includes(person.id);
const kmLamps = (stufe) => A.STUFEN.map((x) => `<i class="km-l ${x}${x === stufe ? ' an' : ''}"></i>`).join('');
function kmSince(x) {
  if (!x.at) return '';
  const ms = Date.parse(x.at);
  return Number.isFinite(ms) ? `seit ${fmtClock(ms).replace(/^heute um /, '')}` : '';
}
function kmSave(changes) {
  const cur = A.kmState(kmValue());
  const now = nowStamp();
  const value = { ...cur };
  for (const [bin, stufe] of Object.entries(changes)) value[bin] = { stufe, at: now, by: state.me };
  const row = { key: 'kuechenmuell', value, updated_at: new Date().toISOString() };
  commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'kuechenmuell'), row]; }, () => store.saveSettings([row]));
}
// Bestätigte Meldungen stellen ihren Eimer auf Grün.
function kmConfirmed(entries) {
  const st = A.kmState(kmValue());
  const bins = [...new Set(entries.filter((e) => e.status === 'bestaetigt').map(A.kmBinOf).filter(Boolean))].filter((b) => st[b].stufe !== 'gruen');
  if (bins.length) kmSave(Object.fromEntries(bins.map((b) => [b, 'gruen'])));
  smConfirmed(entries);
  stConfirmed(entries);
}
const kmRedOpen = () => A.kmView(kmValue(), state.data.taskLog).filter((x) => x.stufe === 'rot' && !x.pending).length;

/* ---------- Spülmaschine ---------- */
// Ampel wie beim Müll (Logik in js/aufgaben.js): Grün wird eingeräumt, Gelb läuft, Rot fertig zum Ausräumen.
// Mit Endzeit springt Gelb von selbst auf Rot, dann schickt die Push-Funktion den Kindern eine Nachricht.
const SM_WORT = { rot: 'Fertig', gelb: 'Läuft', gruen: 'Wird eingeräumt' };
const smValue = () => KI.settingOf(state.data.settings, 'spuelmaschine');
const smKids = () => { const t = A.smTask(state.data.tasks); return t ? A.assignees(t, L.todayISO()).filter((id) => kidsList().some((k) => k.id === id)) : []; };
const smFor = (person) => !!person && smKids().includes(person.id);
const smNow = () => A.smView(smValue(), state.data.taskLog, nowMs());
const clockOf = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function smSave(stufe, bis = null) {
  const cur = A.smState(smValue(), nowMs());
  const keepAt = stufe === 'gelb' && cur.stufe === 'gelb' && !cur.auto;
  const value = { stufe, at: keepAt ? cur.at : nowStamp(), by: keepAt ? cur.by : state.me, bis: stufe === 'gelb' ? bis : null };
  const row = { key: 'spuelmaschine', value, updated_at: new Date().toISOString() };
  commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'spuelmaschine'), row]; }, () => store.saveSettings([row]));
}
function smConfirmed(entries) {
  if (entries.some((e) => A.isSm(e) && e.status === 'bestaetigt') && A.smState(smValue(), nowMs()).stufe !== 'gruen') smSave('gruen');
}
const smRedOpen = () => { const v = smNow(); return v.stufe === 'rot' && !v.pending ? 1 : 0; };
// Läuft sie mit Endzeit, zur Endzeit einmal neu zeichnen, damit die Ampel ohne Neuladen auf Rot springt.
let smTimer = null;
function smWatch(v) {
  const end = v.stufe === 'gelb' && v.bis ? Date.parse(v.bis) - nowMs() : -1;
  if (smTimer && smTimer.bis === v.bis) return;
  if (smTimer) clearTimeout(smTimer.id);
  smTimer = end > 0 && end < 12 * 3600000 ? { bis: v.bis, id: setTimeout(() => { smTimer = null; render(); }, end + 1000) } : null;
}

/* ---------- Stall ---------- */
// Ampel nach Rhythmus (Logik in js/aufgaben.js). Die Eltern stellen ein, alle wie viele Tage der Stall dran ist.
// Gelb heißt morgen, Rot heißt heute oder überfällig. Die Bestätigung einer Meldung startet den Rhythmus neu.
const ST_WORT = { rot: 'Heute dran', gelb: 'Morgen dran', gruen: 'Sauber' };
const stValue = () => KI.settingOf(state.data.settings, 'stall');
const stOn = () => !!A.stTask(state.data.tasks) && A.stState(stValue()).on;
const stHides = (task) => !!task && stOn() && task.id === (A.stTask(state.data.tasks) || {}).id;
const stKids = () => { const t = A.stTask(state.data.tasks); return t ? A.assignees(t, L.todayISO()).filter((id) => kidsList().some((k) => k.id === id)) : []; };
const stFor = (person) => !!person && stOn() && stKids().includes(person.id);
const stNow = () => A.stView(stValue(), state.data.taskLog, L.todayISO());
const stTitle = () => (/meerschw/i.test((A.stTask(state.data.tasks) || {}).name || '') ? 'Meerschweinchen-Stall' : 'Stall');
const stLate = (v) => (v.left < 0 ? (v.left === -1 ? 'seit gestern' : `seit ${-v.left} Tagen`) : '');
function stDue(v) {
  if (v.left < 0) return `${stLate(v)} fällig`;
  if (v.left === 0) return 'heute fällig';
  if (v.left === 1) return 'morgen fällig';
  return `nächstes Mal am ${L.fmtLong(v.due)}`;
}
function stSave(changes) {
  const cur = A.stState(stValue());
  const value = { on: cur.on, tage: cur.tage, last: cur.last, by: cur.by, ...changes };
  const row = { key: 'stall', value, updated_at: new Date().toISOString() };
  commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'stall'), row]; }, () => store.saveSettings([row]));
}
function stConfirmed(entries) {
  const e = entries.filter((x) => A.isSt(x) && x.status === 'bestaetigt').pop();
  if (!e) return;
  const cur = A.stState(stValue());
  if (!cur.last || e.day >= cur.last) stSave({ last: e.day, by: e.person_id });
}
const stRedOpen = () => { const v = stNow(); return v.on && v.stufe === 'rot' && !v.pending ? 1 : 0; };
function stCard(person) {
  const t = A.stTask(state.data.tasks);
  if (!t || !stFor(person)) return '';
  const v = stNow();
  const title = stTitle();
  if (v.stufe === 'gruen' && !v.pending) {
    return `<div class="km-karte ruhig st-karte"><div class="km-kopf"><strong>${title}</strong></div>
      <div class="km-ruhig"><span class="km-mini"><span class="km-ampel klein" role="img" aria-label="${title}: Grün, sauber">${kmLamps('gruen')}</span>Sauber</span></div>
      <p class="km-text">Gerade nichts zu tun, ${esc(stDue(v))}.</p></div>`;
  }
  const reward = t.minutes ? `, +${t.minutes} Min.` : '';
  const [head, text] = v.pending
    ? ['Gemeldet.', v.pending.person_id === person.id ? 'Mama oder Papa schauen noch drüber.' : `${esc((personById(v.pending.person_id) || {}).name || 'Jemand')} hat ihn sauber gemacht.`]
    : v.stufe === 'gelb' ? ['Morgen dran.', 'Du kannst ihn auch heute schon sauber machen.']
      : v.left < 0 ? ['Überfällig.', `Schon ${stLate(v)} dran, bitte heute sauber machen.`] : ['Heute dran.', 'Bitte sauber machen.'];
  const alarm = v.stufe === 'rot' && !v.pending;
  return `<div class="km-karte st-karte${alarm ? ' alarm' : ''}"><div class="km-kopf"><strong>${title}</strong></div>
    <div class="km-eimer-liste"><div class="km-eimer s-${v.pending ? 'gelb' : v.stufe} breit">
      <span class="km-ampel" role="img" aria-label="${title}: ${v.stufe === 'rot' ? 'Rot' : 'Gelb'}, ${ST_WORT[v.stufe]}">${kmLamps(v.stufe)}</span>
      <p class="km-text"><b>${head}</b> ${text}</p>
      ${v.canReport ? `<button class="knopf klein breit${v.stufe === 'rot' ? '' : ' zweit'}" data-action="st-raus">Sauber gemacht${reward}</button>` : ''}
    </div></div></div>`;
}
function stParent() {
  const t = A.stTask(state.data.tasks);
  if (!t) return '';
  const v = stNow();
  const today = L.todayISO();
  const names = stKids().map((id) => (personById(id) || {}).name).filter(Boolean);
  const form = `<form class="form st-form" data-form="stall">
      <div class="st-felder"><label class="feld-label">Sauber machen alle<select class="feld" name="tage">${[3, 4, 5, 6, 7, 8, 10, 14].map((n) => `<option value="${n}"${n === v.tage ? ' selected' : ''}>${n} Tage</option>`).join('')}</select></label>
      <label class="feld-label">Zuletzt sauber am<input class="feld" type="date" name="last" value="${esc(v.last || today)}" max="${today}"></label></div>
      <button class="knopf${v.on ? ' zweit' : ''} klein">${v.on ? 'Speichern' : 'Stall-Ampel einschalten'}</button></form>`;
  if (!v.on) {
    return `<h2 class="abschnitt abstand">${stTitle()}</h2>
      <div class="km-karte eltern"><p class="km-text st-intro">Mit der Stall-Ampel seht ihr und ${names.length ? esc(names.join(' und ')) : 'die Kinder'}, wann der Stall wieder dran ist. Stellt ein, alle wie viele Tage er sauber gemacht werden soll und wann es zuletzt war.</p>${form}</div>`;
  }
  const at = remindTimes().kind1 || '16:30';
  return `<h2 class="abschnitt mit-info abstand">${stTitle()} ${infoBtn('stall', 'Wie die Stall-Ampel funktioniert')}</h2>
    ${infoText('stall', `Grün: noch Zeit. Gelb: morgen dran. Rot: heute dran oder überfällig. Ab Gelb können ${names.length ? esc(names.join(' und ')) : 'die Kinder'} „Sauber gemacht“ melden, eure Bestätigung startet den Rhythmus neu. Bei Rot kommt um ${esc(at)} Uhr eine Push-Nachricht. Solange die Ampel an ist, steht die Stall-Aufgabe nicht mehr in der Wochenliste.`)}
    <div class="km-karte eltern"><div class="km-eimer s-${v.stufe}">
      <span class="km-ampel" role="img" aria-label="${stTitle()}: ${ST_WORT[v.stufe]}">${kmLamps(v.stufe)}</span>
      <p class="km-text"><b>${v.stufe === 'gruen' ? 'Sauber' : v.stufe === 'gelb' ? 'Morgen dran' : v.left < 0 ? 'Überfällig' : 'Heute dran'}</b>${v.stufe === 'gruen' ? `, ${esc(stDue(v))}` : v.left < 0 ? `, ${stLate(v)} dran` : ''}. Zuletzt am ${L.fmtShort(v.last)}, alle ${v.tage} Tage.</p>
      ${v.pending ? `<p class="km-text">${esc((personById(v.pending.person_id) || {}).name || 'Jemand')} hat ihn sauber gemacht. Oben bestätigen.</p>` : ''}
      <div class="knopfreihe"><button class="knopf klein${v.stufe === 'gruen' ? ' zweit' : ''}" data-action="st-heute">Heute sauber gemacht</button></div>
      ${form}
      <button class="textknopf" data-action="st-aus">Stall-Ampel ausschalten</button>
    </div></div>`;
}

/* ---------- Minuten-Shop ---------- */
// Die Kinder tauschen Minuten gegen Belohnungen, die die Eltern festlegen. Ein Kauf hält die Minuten fest,
// die Eltern lösen ihn unter „Zu bestätigen“ ein oder buchen ihn zurück.
const shopNow = () => A.shopState(KI.settingOf(state.data.settings, 'shop'));
function shopChip(e) {
  if (!A.isShop(e)) return `<span class="chip">${e.minutes} Min. eingelöst</span>`;
  if (e.status === 'offen') return `<span class="chip warten">${-e.minutes} Min., wartet</span>`;
  if (e.status === 'abgelehnt') return '<span class="chip nein">zurückgebucht</span>';
  return `<span class="chip">${e.minutes} Min. eingelöst</span>`;
}
function shopTeaser(person) {
  const sh = shopNow();
  if (!sh.on || !sh.items.length) return '';
  const open = A.shopOpen(state.data.taskLog, person.id);
  return `<div class="knopfreihe"><button class="knopf zweit" data-action="shop">Minuten-Shop</button></div>
    ${open.length ? `<p class="meta">Gekauft: ${esc(open.map((e) => String(e.label).replace(/^Minuten-Shop: /, '')).join(', '))}. Mama oder Papa lösen es ein.</p>` : ''}`;
}
function sheetShop() {
  const me = personById(state.me);
  const acc = A.account(state.data.taskLog, state.me, capOf(me), nowMs(), L.todayISO());
  const sh = shopNow();
  const pick = state.shopPick;
  const rows = sh.items.map((x) => {
    const ok = acc.balance >= x.cost;
    const chosen = pick === x.id;
    return `<li class="shop-zeile${chosen ? ' gewaehlt' : ''}"><span class="shop-preis"><b>${x.cost}</b> Min.</span><span class="shop-name">${esc(x.name)}</span>
      ${chosen ? `<span class="shop-frage">Für ${x.cost} Minuten kaufen?<span class="knopfreihe"><button class="knopf klein" data-action="shop-ja" data-id="${esc(x.id)}">Ja, kaufen</button><button class="knopf zweit klein" data-action="shop-nein">Abbrechen</button></span></span>`
        : `<button class="knopf zweit klein" data-action="shop-kaufen" data-id="${esc(x.id)}"${ok ? '' : ' disabled'} aria-label="${esc(x.name)} für ${x.cost} Minuten kaufen">${ok ? 'Kaufen' : `noch ${x.cost - acc.balance} Min.`}</button>`}</li>`;
  }).join('');
  return {
    over: 'Minuten-Shop',
    title: `${acc.balance} Minuten auf deinem Konto`,
    body: `<p class="meta" style="margin-bottom:12px">Statt Bildschirmzeit kannst du deine Minuten hier eintauschen. Mama oder Papa lösen den Kauf ein. Klappt es nicht, bekommst du die Minuten zurück.</p>
      <ul class="shop-liste">${rows}</ul>`,
  };
}
function sheetShopAdmin() {
  const sh = shopNow();
  const rows = [...sh.items, { id: '', name: '', cost: '' }, { id: '', name: '', cost: '' }];
  return {
    over: 'Aufgaben',
    title: 'Minuten-Shop',
    body: `<p class="meta" style="margin-bottom:12px">Hier legt ihr fest, wofür die Kinder ihre Minuten eintauschen können. Ein Kauf landet bei „Zu bestätigen“. „Erledigt“ löst ihn ein, „Zurückbuchen“ gibt die Minuten zurück. Leere Zeilen werden ignoriert.</p>
      <form class="form" data-form="shop">
        <label class="schalter" style="margin-bottom:10px"><input type="checkbox" name="on"${sh.on || !sh.set ? ' checked' : ''}> Shop für die Kinder anzeigen</label>
        <div class="shop-admin">${rows.map((x, i) => `<div class="shop-admin-zeile"><input type="hidden" name="id" value="${esc(x.id || `s${Date.now().toString(36)}${i}`)}">
          <input class="feld" name="name" value="${esc(x.name)}" placeholder="Belohnung" aria-label="Belohnung ${i + 1}" maxlength="80">
          <input class="feld shop-kosten" name="cost" type="number" inputmode="numeric" min="1" max="600" value="${esc(String(x.cost))}" placeholder="Min." aria-label="Preis in Minuten ${i + 1}"></div>`).join('')}</div>
        <button class="knopf breit">Speichern</button></form>`,
  };
}
function shopQueueRow(e, p, today) {
  return `<li class="shop-kauf"><div class="extra-zeile">${avatar(p, true)}<span class="p-text"><span class="p-name">${esc(String(e.label).replace(/^Minuten-Shop: /, ''))}</span>
      <span class="p-menge">${esc(p ? p.name : '')}, ${e.day === today ? 'heute' : `${L.WD_SHORT[L.wdIndex(e.day)]} ${L.fmtShort(e.day)}`}, im Minuten-Shop für ${-e.minutes} Min. gekauft</span></span>
      <span class="ja-nein"><button class="knopf klein" data-action="log-ok" data-id="${esc(e.id)}" aria-label="${esc(e.label)} einlösen">Erledigt</button>
      <button class="knopf zweit klein" data-action="log-nein" data-id="${esc(e.id)}" aria-label="${esc(e.label)} zurückbuchen">Zurückbuchen</button></span></div></li>`;
}

// Karte für das Kind, immer an derselben Stelle unter dem Datum: Mülleimer und Spülmaschine.
function kmCard(person) {
  const kmT = A.kmTask(state.data.tasks);
  const smT = A.smTask(state.data.tasks);
  const bins = kmT && kmFor(person) ? A.kmView(kmValue(), state.data.taskLog) : [];
  const sm = smT && smFor(person) ? smNow() : null;
  if (!bins.length && !sm) return '';
  if (sm) smWatch(sm);
  const title = bins.length && sm ? 'In der Küche' : bins.length ? 'Mülleimer in der Küche' : 'Spülmaschine';
  const smCalm = !sm || (sm.stufe !== 'rot' && !sm.pending);
  const calm = bins.every((x) => x.stufe === 'gruen' && !x.pending) && smCalm;
  const binAlarm = bins.some((x) => x.stufe === 'rot' && !x.pending);
  const smAlarm = !!sm && sm.stufe === 'rot' && !sm.pending;
  const smBis = sm && sm.stufe === 'gelb' && sm.bis ? clockOf(sm.bis) : '';
  if (calm) {
    const minis = [...bins.map((x) => ({ name: x.name, stufe: x.stufe, label: 'Grün, noch Platz' })), ...(sm ? [{ name: 'Spülmaschine', stufe: sm.stufe, label: sm.stufe === 'gelb' ? 'Gelb, läuft' : 'Grün, wird eingeräumt' }] : [])];
    const text = sm && sm.stufe === 'gelb'
      ? `Die Spülmaschine läuft${smBis ? ` bis etwa ${smBis} Uhr` : ''}. Sonst gerade nichts zu tun.`
      : bins.length && !sm ? 'Beide grün. Gerade nichts zu tun.' : 'Alles grün. Gerade nichts zu tun.';
    return `<div class="km-karte ruhig"><div class="km-kopf"><strong>${title}</strong></div>
      <div class="km-ruhig">${minis.map((x) => `<span class="km-mini"><span class="km-ampel klein" role="img" aria-label="${esc(x.name)}: ${x.label}">${kmLamps(x.stufe)}</span>${esc(x.name)}</span>`).join('')}</div>
      <p class="km-text">${text}</p></div>`;
  }
  const kmReward = kmT && kmT.minutes ? `, +${kmT.minutes} Min.` : '';
  const smReward = smT && smT.minutes ? `, +${smT.minutes} Min.` : '';
  const who = (pending) => (pending.person_id === person.id ? 'Mama oder Papa schauen noch drüber.' : `${esc((personById(pending.person_id) || {}).name || 'Jemand')} hat`);
  const tiles = bins.map((x) => `<div class="km-eimer s-${x.stufe}">
      <span class="km-name">${esc(x.name)}</span>
      <span class="km-ampel" role="img" aria-label="${esc(x.name)}: ${x.stufe === 'gruen' ? 'Grün' : x.stufe === 'gelb' ? 'Gelb' : 'Rot'}, ${KM_WORT[x.stufe]}">${kmLamps(x.stufe)}</span>
      ${x.pending ? `<p class="km-text"><b>Gemeldet.</b> ${x.pending.person_id === person.id ? who(x.pending) : `${who(x.pending)} ihn rausgebracht.`}</p>`
        : `<p class="km-text"><b>${KM_WORT[x.stufe]}.</b> ${KM_KIND[x.stufe]}</p>`}
      ${x.canReport ? `<button class="knopf klein breit${x.stufe === 'rot' ? '' : ' zweit'}" data-action="km-raus" data-bin="${x.bin}">Rausgebracht${kmReward}</button>` : ''}
    </div>`);
  if (sm) {
    const smText = sm.stufe === 'rot' ? 'Bitte jetzt ausräumen.' : sm.stufe === 'gelb' ? (smBis ? `Fertig gegen ${smBis} Uhr. Dann kommt eine Nachricht.` : 'Wenn sie fertig ist, kommt eine Nachricht.') : 'Gerade nichts zu tun.';
    tiles.push(`<div class="km-eimer s-${sm.stufe}${bins.length % 2 === 0 ? ' breit' : ''}">
      <span class="km-name">Spülmaschine</span>
      <span class="km-ampel" role="img" aria-label="Spülmaschine: ${sm.stufe === 'gruen' ? 'Grün' : sm.stufe === 'gelb' ? 'Gelb' : 'Rot'}, ${SM_WORT[sm.stufe]}">${kmLamps(sm.stufe)}</span>
      ${sm.pending ? `<p class="km-text"><b>Gemeldet.</b> ${sm.pending.person_id === person.id ? who(sm.pending) : `${who(sm.pending)} sie ausgeräumt.`}</p>`
        : `<p class="km-text"><b>${SM_WORT[sm.stufe]}.</b> ${smText}</p>`}
      ${sm.canReport ? `<button class="knopf klein breit" data-action="sm-raus">Ausgeräumt${smReward}</button>` : ''}
    </div>`);
  }
  const flag = binAlarm && smAlarm ? 'jetzt dran' : binAlarm ? 'muss raus' : smAlarm ? 'bitte ausräumen' : '';
  return `<div class="km-karte${flag ? ' alarm' : ''}"><div class="km-kopf"><strong>${title}</strong>${flag ? `<span>${flag}</span>` : ''}</div>
    <div class="km-eimer-liste">${tiles.join('')}</div></div>`;
}

// Schalter für die Eltern: drei Lampen, bei Gelb dazu die Endzeit.
function smParent() {
  if (!A.smTask(state.data.tasks)) return '';
  const v = smNow();
  smWatch(v);
  const names = smKids().map((id) => (personById(id) || {}).name).filter(Boolean);
  const label = { rot: 'Rot, fertig zum Ausräumen', gelb: 'Gelb, läuft', gruen: 'Grün, wird eingeräumt' };
  const since = v.stufe === 'rot' && v.at ? `fertig seit ${clockOf(v.at)} Uhr` : v.stufe === 'gelb' ? (v.bis ? `fertig um ${clockOf(v.bis)} Uhr, dann springt sie von selbst auf Rot` : 'ohne Endzeit') : '';
  const bisWert = v.stufe === 'gelb' && v.bis ? clockOf(v.bis) : '';
  return `<h2 class="abschnitt mit-info abstand">Spülmaschine ${infoBtn('spuelmaschine', 'Wie die Spülmaschinen-Ampel funktioniert')}</h2>
    ${infoText('spuelmaschine', `Grün: wird eingeräumt. Gelb: läuft. Rot: fertig zum Ausräumen. Nur bei Rot können ${names.length ? esc(names.join(' und ')) : 'die Kinder'} „Ausgeräumt“ melden. Stellst du bei Gelb eine Endzeit ein, springt die Ampel zu dieser Zeit von selbst auf Rot. Bei Rot kommt eine Push-Nachricht (zwischen 7 und 20:30 Uhr, sonst am nächsten Morgen). Bestätigst du die Meldung, springt die Ampel auf Grün.`)}
    <div class="km-karte eltern"><div class="km-eimer s-${v.stufe}">
      <div class="km-ampel knoepfe" role="group" aria-label="Spülmaschine">${A.STUFEN.map((st) => `<button class="km-l ${st}${st === v.stufe ? ' an' : ''}" data-action="sm-stufe" data-stufe="${st}" aria-pressed="${st === v.stufe}" aria-label="Spülmaschine: ${label[st]}"></button>`).join('')}</div>
      <p class="km-text"><b>${SM_WORT[v.stufe]}</b>${since ? `, ${esc(since)}` : ''}</p>
      ${v.stufe === 'gelb' ? `<div class="sm-ende"><span class="km-text">Fertig in</span>${[60, 120, 180, 240].map((m) => `<button class="knopf zweit klein" data-action="sm-bis" data-wert="${m}">${m / 60} Std.</button>`).join('')}
        <label class="sm-zeit-l">oder um <input type="time" class="sm-zeit" value="${bisWert}" aria-label="Endzeit der Spülmaschine"></label></div>` : ''}
      ${v.pending ? `<p class="km-text">${esc((personById(v.pending.person_id) || {}).name || 'Jemand')} hat sie ausgeräumt. Oben bestätigen.</p>` : ''}
    </div></div>`;
}

// Schalter für die Eltern: drei Lampen pro Eimer zum Antippen.
function kmParent() {
  if (!A.kmTask(state.data.tasks)) return '';
  const view = A.kmView(kmValue(), state.data.taskLog);
  const names = kmKids().map((id) => (personById(id) || {}).name).filter(Boolean);
  const label = { rot: 'Rot, voll', gelb: 'Gelb, fast voll', gruen: 'Grün, noch Platz' };
  return `<h2 class="abschnitt mit-info">Mülleimer in der Küche ${infoBtn('kuechenmuell', 'Wie die Müll-Ampel funktioniert')}</h2>
    ${infoText('kuechenmuell', `Tippe auf die Farbe, die gerade passt. Bei Gelb und Rot können ${names.length ? esc(names.join(' und ')) : 'die Kinder'} den Eimer als rausgebracht melden, bei Grün nicht. Bei Rot kommt eine Push-Nachricht (zwischen 7 und 20:30 Uhr, sonst am nächsten Morgen). Bestätigst du die Meldung, springt die Ampel von selbst auf Grün.`)}
    <div class="km-karte eltern"><div class="km-eimer-liste">${view.map((x) => `<div class="km-eimer s-${x.stufe}">
      <span class="km-name">${esc(x.name)}</span>
      <div class="km-ampel knoepfe" role="group" aria-label="${esc(x.name)}">${A.STUFEN.map((st) => `<button class="km-l ${st}${st === x.stufe ? ' an' : ''}" data-action="km-stufe" data-bin="${x.bin}" data-stufe="${st}" aria-pressed="${st === x.stufe}" aria-label="${esc(x.name)}: ${label[st]}"></button>`).join('')}</div>
      <p class="km-text"><b>${KM_WORT[x.stufe]}</b>${x.stufe !== 'gruen' && kmSince(x) ? `, ${esc(kmSince(x))}` : ''}</p>
      ${x.pending ? `<p class="km-text">${esc((personById(x.pending.person_id) || {}).name || 'Jemand')} hat ihn rausgebracht. Oben bestätigen.</p>` : ''}
    </div>`).join('')}</div></div>`;
}

function logTask(task, label, id, opts = {}) {
  // Mit Foto entscheiden immer die Eltern, auch bei Grundaufgaben ohne Bestätigung.
  const open = !!(task.minutes || basicsConfirm() || opts.foto);
  const entry = {
    id: id || L.uid(), person_id: state.me, task_id: task.id, day: L.todayISO(), label, minutes: task.minutes,
    status: open ? 'offen' : 'bestaetigt', created_at: nowStamp(), decided_by: null, decided_at: open ? null : nowStamp(),
  };
  const left = A.minutesLeftToday(state.data.taskLog, state.me, capOf(personById(state.me)), L.todayISO());
  commit(() => { state.data.taskLog = [...state.data.taskLog, entry]; }, () => store.saveLog([entry]));
  kmConfirmed([entry]);
  if (!task.minutes) { if (open) toast(opts.foto ? 'Foto ist angekommen. Mama oder Papa schauen es sich an.' : 'Erledigt, danke! Mama oder Papa schauen noch drüber.'); return; }
  if (!left) toast('Erledigt, danke! Dein Tageslimit ist schon erreicht, deshalb gibt es heute keine Minuten mehr dafür.');
  else if (left < task.minutes) toast(`Erledigt. Bis zum Tageslimit zählen heute nur noch ${left} Minuten.`);
  else if (basicsFirst() && A.basicsOpen(state.data.tasks, state.data.taskLog, state.me, L.todayISO()).length) toast(`Erledigt. Die ${task.minutes} Minuten gibt es, sobald deine Grundaufgaben für heute erledigt sind.`);
  else toast(`Erledigt. Mama oder Papa bestätigen die ${task.minutes} Minuten.`);
}

function decide(ids, status) {
  const now = nowStamp();
  const rows = state.data.taskLog.filter((e) => ids.includes(e.id)).map((e) => ({ ...e, status, decided_by: state.me, decided_at: now }));
  commit(() => { state.data.taskLog = state.data.taskLog.map((e) => rows.find((r) => r.id === e.id) || e); }, () => store.saveLog(rows));
  kmConfirmed(rows);
}

/* ---------- Fotonachweis ---------- */
// Das Kind macht beim Melden ein Foto. Es geht verkleinert an die Push-Funktion und liegt privat im Speicher.
// Die Eltern sehen es in „Zu bestätigen“. Nach 14 Tagen löscht die Funktion die Fotos wieder.
function startFoto(task, label, id) {
  state.fotoDraft = null;
  openSheet({ type: 'foto', task: task.id, label, id: id || '', key: L.uid() });
}
function sheetFoto(sh) {
  const d = state.fotoDraft && state.fotoDraft.for === sh.key ? state.fotoDraft : null;
  return {
    over: 'Foto als Nachweis',
    title: sh.label,
    body: `<p class="meta">Mach ein Foto, auf dem man sieht, dass es erledigt ist. Mama oder Papa schauen es sich beim Bestätigen an.</p>
      ${d ? `<img class="foto-vorschau" src="${d.url}" alt="Dein Foto">` : ''}
      <div class="knopfreihe"><label class="knopf${d ? ' zweit' : ''} foto-knopf">${d ? 'Neues Foto' : 'Foto machen'}<input type="file" accept="image/*" capture="environment" id="nachweis-foto" hidden></label>
      ${d ? `<button class="knopf" data-action="foto-melden"${state.fotoBusy ? ' disabled' : ''}>${state.fotoBusy ? 'Wird gesendet …' : 'Erledigt melden'}</button>` : ''}</div>`,
  };
}
async function fotoChosen(file) {
  const sh = state.sheet;
  if (!file || !sh || sh.type !== 'foto') return;
  try {
    const img = await shrinkImage(file, 1280, 0.72);
    state.fotoDraft = { for: sh.key, data: img.data, url: `data:image/jpeg;base64,${img.data}` };
  } catch (e) { toast(e.message || 'Das Foto ließ sich nicht öffnen.'); }
  renderSheet();
}
const fotoEntry = (e) => !!e && (fotoTasks().includes(e.task_id));
// Links zu den Fotos holen (gelten eine Stunde), danach neu zeichnen.
function ensureFotoLinks(ids) {
  state.fotoLinks = state.fotoLinks || {};
  const now = Date.now();
  // Neu holen: noch nie geholt, Link bald abgelaufen (gilt eine Stunde) oder letzter Versuch vor über einer Minute gescheitert.
  const missing = ids.filter((id) => { const x = state.fotoLinks[id]; return !x || (!x.busy && ((x.url && now - x.at > 50 * 60000) || (x.err && now - x.at > 60000))); });
  if (!missing.length) return;
  missing.forEach((id) => { state.fotoLinks[id] = { busy: true, at: now }; });
  setTimeout(() => {
    store.fotoLinks(missing).then((links) => {
      missing.forEach((id) => { state.fotoLinks[id] = { url: links[id] || null, at: Date.now() }; });
    }).catch(() => {
      missing.forEach((id) => { state.fotoLinks[id] = { url: null, at: Date.now(), err: true }; });
    }).finally(() => { if (state.tab === 'aufgaben' || (state.sheet && state.sheet.type === 'foto-gross')) { render(); if (state.sheet) renderSheet(); } });
  }, 0);
}
function fotoThumb(e) {
  const x = (state.fotoLinks || {})[e.id];
  if (!x || x.busy) return '<span class="p-wofuer">Foto lädt …</span>';
  if (!x.url) return `<span class="p-wofuer">${x.err ? 'Foto ließ sich gerade nicht laden.' : 'Kein Foto dabei.'}</span>`;
  return `<button class="foto-mini" data-action="foto-gross" data-id="${esc(e.id)}" aria-label="Foto zu ${esc(e.label)} groß ansehen"><img src="${esc(x.url)}" alt="" loading="lazy"></button>`;
}
function sheetFotoBig({ id }) {
  const e = state.data.taskLog.find((x) => x.id === id);
  const x = (state.fotoLinks || {})[id] || {};
  const p = e && personById(e.person_id);
  return {
    over: p ? `Foto von ${p.name}` : 'Foto',
    title: e ? e.label : 'Foto',
    body: `${x.url ? `<img class="foto-gross" src="${esc(x.url)}" alt="Foto zu ${esc(e ? e.label : '')}">` : '<p class="meta">Das Foto ist nicht mehr da.</p>'}
      ${e && e.status === 'offen' ? `<div class="knopfreihe"><button class="knopf" data-action="foto-ok" data-id="${esc(id)}">Bestätigen</button><button class="knopf zweit" data-action="foto-nein" data-id="${esc(id)}">Nein</button></div>` : ''}`,
  };
}

function sheetRedeem({ id }) {
  const person = personById(id);
  const acc = A.account(state.data.taskLog, id, capOf(person), nowMs(), L.todayISO());
  const quick = [15, 30].filter((v) => v < acc.balance);
  return {
    over: person ? person.name : '',
    title: 'Bildschirmzeit einlösen',
    body: `<p class="meta" style="margin-bottom:12px">${acc.balance} Minuten sind verdient, zusätzlich zur Grundzeit${person && person.screen_base ? ` von ${person.screen_base} Minuten` : ''}. Die Bildschirmzeit selbst gebt ihr am Gerät frei, hier wird sie nur abgebucht.</p>
      <form class="form" data-form="einloesen"><input type="hidden" name="id" value="${esc(id)}">
      <label>Minuten<input class="feld" id="einloesen-min" name="minutes" type="number" inputmode="numeric" min="1" max="${acc.balance}" value="${Math.min(30, acc.balance)}" required data-autofocus></label>
      <div class="knopfreihe">${quick.map((v) => `<button type="button" class="knopf zweit klein" data-action="einloesen-wert" data-n="${v}">${v} Min.</button>`).join('')}
      <button type="button" class="knopf zweit klein" data-action="einloesen-wert" data-n="${acc.balance}">Alles, ${acc.balance} Min.</button></div>
      <p class="fehler" id="einloesen-fehler" hidden></p>
      <button class="knopf breit">Abbuchen</button></form>`,
  };
}

function whoText(t) {
  const names = (t.who || []).map((id) => (personById(id) || {}).name || id);
  if (!names.length) return 'niemand';
  if (!t.rotate) return names.join(' und ');
  const now = A.assignees(t, L.todayISO()).map((id) => (personById(id) || {}).name || id);
  return `${names.join(' und ')} im Wechsel, diese Woche ${now.join('')}`;
}

function sheetTaskList() {
  const rows = [...state.data.tasks].sort((a, b) => (a.sort || 0) - (b.sort || 0)).map((t) => `<li${t.active === false ? ' class="raus"' : ''}><button class="g-zeile" data-action="aufgabe-bearbeiten" data-id="${esc(t.id)}">
      <span class="mal"><span class="n">${t.minutes || '0'}</span><span class="x">Min.</span></span>
      <span class="tz-text"><span class="tz-name">${esc(t.name)}${t.active === false ? ' <span class="marke">pausiert</span>' : ''}</span>
      <span class="tz-meta">${esc([A.RHYTHMEN[t.schedule], whoText(t), t.school_only ? 'nur an Schultagen' : '', needsFoto(t) ? 'mit Foto' : '', (t.months || []).length ? `nur ${t.months.map((m) => A.MONATE[m - 1]).join(', ')}` : ''].filter(Boolean).join(', '))}</span></span></button></li>`).join('');
  return {
    over: 'Aufgaben',
    title: 'Aufgaben verwalten',
    body: `<p class="meta" style="margin-bottom:12px">0 Minuten heißt Grundaufgabe ohne Bildschirmzeit. Die Tonnen-Aufgabe erscheint am Abend vor jeder Abholung.</p>
      <form class="dazu" data-form="wochenbonus" style="margin-bottom:6px;align-items:flex-end"><label class="feld-label">Wochenbonus <select class="feld" name="minuten" aria-label="Wochenbonus in Minuten">${[0, 15, 20, 30, 45, 60].map((n) => `<option value="${n}"${bonusMinutes() === n ? ' selected' : ''}>${n ? `${n} Minuten` : 'aus'}</option>`).join('')}</select></label><button class="knopf zweit klein">Speichern</button></form>
      <p class="meta" style="margin-bottom:14px">Wer an jedem Tag der Woche alle Grundaufgaben erledigt, bekommt die Minuten am Sonntag gutgeschrieben. Urlaubstage zählen nicht mit. Der Bonus zählt nicht zum Tageslimit.</p>
      <label class="schalter" style="margin-bottom:10px"><input type="checkbox" data-action="grund-bestaetigen"${basicsConfirm() ? ' checked' : ''}> Grundaufgaben bestätigen <small>Auch Tisch decken, Spülmaschine und Co. landen bei „Zu bestätigen“. Bis dahin zählen sie für das Kind als erledigt. Lehnt ihr ab, ist die Aufgabe wieder offen.</small></label>
      <label class="schalter" style="margin-bottom:14px"><input type="checkbox" data-action="grund-zuerst"${basicsFirst() ? ' checked' : ''}> Minuten erst nach den Grundaufgaben <small>Extra-Aufgaben lassen sich jederzeit abhaken. Bestätigen könnt ihr die Minuten erst, wenn die täglichen Grundaufgaben des Tages erledigt sind (Wochenaufgaben zählen nicht). Mit „Trotzdem“ geht es auch vorher.</small></label>
      <form class="form erinnerung-form" data-form="erinnerungen" style="margin-bottom:16px"><strong class="feld-titel">Erinnerungen</strong>
        <div class="zeiten">${remindSelect('kind1', 'Kinder, erste', remindTimes().kind1)}${remindSelect('kind2', 'Kinder, mit Nachdruck', remindTimes().kind2)}${remindSelect('eltern', 'Eltern, Stand des Tages', remindTimes().eltern)}</div>
        <p class="meta">Kommen nur, wenn noch etwas offen ist, und nicht im Urlaub. An Tagen mit Training oder Terminen einfach später legen.</p>
        <div class="knopfreihe"><button class="knopf zweit klein">Speichern</button></div></form>
      <ul class="gerichte">${rows}</ul>
      <div class="knopfreihe"><button class="knopf" data-action="aufgabe-neu">Neue Aufgabe</button></div>`,
  };
}

function sheetTaskForm({ id }) {
  const t = id ? taskById(id) : null;
  const opt = (k, v, cur) => `<option value="${k}"${cur === k ? ' selected' : ''}>${v}</option>`;
  const kids = kidsList();
  return {
    over: t ? 'Aufgabe bearbeiten' : 'Neue Aufgabe',
    title: t ? t.name : 'Aufgabe anlegen',
    body: `<form class="form" data-form="aufgabe"><input type="hidden" name="id" value="${esc(id || '')}">
      <label>Name<input class="feld" name="name" required maxlength="80" value="${esc(t ? t.name : '')}"></label>
      <div class="zwei"><label>Bildschirmzeit in Minuten<input class="feld" name="minutes" type="number" inputmode="numeric" min="0" max="120" value="${t ? t.minutes : 10}"></label>
      <label>Wie oft<select class="feld" name="schedule">${Object.entries(A.RHYTHMEN).map(([k, v]) => opt(k, v, t ? t.schedule : 'bedarf')).join('')}</select></label></div>
      <fieldset class="feldgruppe"><legend>Wer</legend>${kids.map((k) => `<label class="schalter"><input type="checkbox" name="who" value="${esc(k.id)}"${!t || (t.who || []).includes(k.id) ? ' checked' : ''}> ${esc(k.name)}</label>`).join('')}
      <label class="schalter"><input type="checkbox" name="rotate"${t && t.rotate ? ' checked' : ''}> Im wöchentlichen Wechsel</label></fieldset>
      <label class="schalter"><input type="checkbox" name="school_only"${t && t.school_only ? ' checked' : ''}> Nur an Schultagen <small>nicht am Wochenende, in den bayerischen Ferien und an Feiertagen</small></label>
      <label class="schalter"><input type="checkbox" name="foto"${t && needsFoto(t) ? ' checked' : ''}> Foto als Nachweis <small>beim Melden macht das Kind ein Foto, ihr seht es beim Bestätigen. Dann bestätigt ihr auch Grundaufgaben.</small></label>
      <label>Bei Bedarf höchstens pro Tag<input class="feld" name="max_per_day" type="number" inputmode="numeric" min="1" max="10" value="${t ? t.max_per_day || 1 : 1}"></label>
      <fieldset class="feldgruppe"><legend>Nur in diesen Monaten <small>nichts angehakt heißt ganzjährig</small></legend><div class="monate">${A.MONATE.map((m, i) => `<label class="schalter"><input type="checkbox" name="months" value="${i + 1}"${t && (t.months || []).includes(i + 1) ? ' checked' : ''}> ${m}</label>`).join('')}</div></fieldset>
      <label>Hinweis für die Kinder<input class="feld" name="note" maxlength="200" value="${esc(t ? t.note || '' : '')}"></label>
      <label class="schalter"><input type="checkbox" name="active"${!t || t.active !== false ? ' checked' : ''}> Aktiv</label>
      <button class="knopf breit">Aufgabe speichern</button></form>`,
  };
}

/* ---------- Bögen ---------- */

function renderSheet() {
  const root = $('#sheet-root');
  if (!state.sheet) {
    root.innerHTML = '';
    root.dataset.key = '';
    document.documentElement.classList.remove('gesperrt');
    return;
  }
  const key = JSON.stringify(state.sheet);
  const same = root.dataset.key === key;
  const old = $('.bogen', root);
  const scroll = old ? old.scrollTop : 0;
  const makers = { termine: sheetEvents, 'termin-form': sheetEventForm, vorrat: sheetPantry, immer: sheetStaples, urlaub: sheetHolidays, regeln: sheetRules, entwurf: sheetDraft, einloesen: sheetRedeem, shop: sheetShop, 'shop-admin': sheetShopAdmin, 'aufgaben-liste': sheetTaskList, 'aufgabe-form': sheetTaskForm, frage: (sh) => ({ over: '', title: 'Bist du sicher?', body: `<p>${esc(sh.text)}</p><div class="knopfreihe"><button class="knopf" data-action="ja">${esc(sh.ok)}</button><button class="knopf zweit" data-action="nein">Abbrechen</button></div>` }), pin: sheetPin, export: sheetExport, tag: sheetDay, gericht: sheetDish, tauschen: sheetSwap, 'tag-tausch': sheetDayTrade, mittag: sheetLunch, 'mittag-laden': sheetLunchLoading, 'mittag-ergebnis': sheetLunchResult, 'app-wuensche': sheetAppWishes, moegen: sheetReport, feste: sheetFeasts, fest: sheetFeast, 'fest-laden': feastLoading, hilfe: sheetHelp, neu: sheetNews, rueckblick: sheetReview, foto: sheetFoto, 'foto-gross': sheetFotoBig, packung: sheetPack, packungen: sheetPacks, vorschau: sheetPreview, zurueckholen: sheetRestore, ersatz: sheetSubst, 'ersatz-laden': sheetSubstLoading, reste: sheetLeftovers, laufweg: sheetRoute, kochen: sheetCook, zutaten: sheetIngredients, 'zutaten-laden': sheetIngredientsLoading, 'rezept-laden': sheetRecipeLoading, 'rezept-neu': sheetRecipeNew, beleg: sheetReceipt, preise: sheetPrices, jahr: sheetYear, siri: sheetSiri, 'beleg-laden': sheetReceiptLoading, haushalt: sheetHousehold, 'gericht-form': sheetDishForm, import: sheetImport, familie: sheetFamily };
  const { over, title, body } = makers[state.sheet.type](state.sheet);
  root.innerHTML = `<div class="schleier"><section class="bogen" role="dialog" aria-modal="true" aria-labelledby="bogen-titel" tabindex="-1"${same ? ' style="animation:none"' : ''}>
    <div class="bogen-kopf"><div>${over ? `<p class="ueber">${esc(over)}</p>` : ''}<h2 id="bogen-titel">${esc(title)}</h2></div>
    <button class="zu" data-action="zu" aria-label="Schließen">${CROSS}</button></div>${body}</section></div>`;
  root.dataset.key = key;
  document.documentElement.classList.add('gesperrt');
  const sheet = $('.bogen', root);
  if (same) sheet.scrollTop = scroll; else sheet.focus();
  const auto = $('[data-autofocus]', root);
  if (!same && auto) auto.focus();
}
function openSheet(sheet) { state.sheet = sheet; renderSheet(); }
function closeSheet() {
  if (askResolve) { answer(false); return; }
  if (state.sheet && state.sheet.type === 'kochen' && !state.shopMode) keepAwake(false);
  pinNext = null;
  state.sheet = null;
  state.stale = false;
  renderSheet();
  render();
}

/* ---------- Notizen fürs nächste Mal ---------- */

// Pro Rezept, gespeichert in ep_settings unter "rezept_notizen": { gerichtId: [{ id, text, by, at }] }.
const recipeNotesAll = () => { const v = KI.settingOf(state.data.settings, 'rezept_notizen'); return v && typeof v === 'object' ? v : {}; };
const recipeNotes = (id) => (Array.isArray(recipeNotesAll()[id]) ? recipeNotesAll()[id] : []);
function saveRecipeNotes(id, list) {
  const all = { ...recipeNotesAll(), [id]: list };
  if (!list.length) delete all[id];
  const row = { key: 'rezept_notizen', value: all, updated_at: new Date().toISOString() };
  commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'rezept_notizen'), row]; }, () => store.saveSettings([row]));
}
// Notizen zum Rezept und ein unauffälliges Feld zum Dazuschreiben. "open" klappt das Feld auf (Ende des Kochmodus).
function notesHtml(dish, open = false) {
  if (!dish || !dishById(dish.id)) return '';
  const list = recipeNotes(dish.id);
  const may = (n) => canPlan() || n.by === state.me;
  const items = list.map((n) => `<li><span class="notiz-text">${esc(n.text)}</span><span class="notiz-meta">${esc([(personById(n.by) || {}).name, n.at ? L.fmtShort(String(n.at).slice(0, 10)) : ''].filter(Boolean).join(', '))}</span>
    ${may(n) ? `<button class="notiz-weg" data-action="notiz-weg" data-dish="${esc(dish.id)}" data-id="${esc(n.id)}" aria-label="Notiz löschen">${CROSS}</button>` : ''}</li>`).join('');
  const form = `<form class="dazu notiz-form" data-form="notiz"><input type="hidden" name="dish" value="${esc(dish.id)}">
      <input class="feld" name="text" maxlength="200" placeholder="z. B. Möhren zu den Erbsen, mehr Soße" aria-label="Notiz fürs nächste Mal" autocomplete="off" required><button class="knopf">Merken</button></form>`;
  if (!list.length) return `<details class="notiz-neu"${open ? ' open' : ''}><summary>Notiz fürs nächste Mal</summary>${form}</details>`;
  return `<div class="kasten-text notizen"><strong>Fürs nächste Mal</strong><ul class="notiz-liste">${items}</ul>
    <details class="notiz-neu"${open ? ' open' : ''}><summary>Noch etwas dazuschreiben</summary>${form}</details></div>`;
}

function recipeHtml(dish, inDay, guests = 0) {
  // Rezepte sind für 4 Personen. Mit Gästen werden die Mengen für den Tag hochgerechnet.
  const g = L.isDinner(dish) ? Math.max(0, Number(guests) || 0) : 0;
  const base = L.isDinner(dish) ? Math.max(1, Number(dish.servings) || 4) : 4;
  const f = (base + g) / base;
  const scaled = (ing) => (g && ing.q != null ? { ...ing, q: L.scaleQty(ing.q, ing.u, f) } : ing);
  return `${dish.note ? `<div class="kasten-text">${esc(dish.note)}</div>` : ''}
    ${notesHtml(dish)}
    ${dish.prep && !inDay ? `<div class="kasten-text vorabend"><strong>Am Vorabend</strong>${esc(dish.prep)}</div>` : ''}
    <h3>${L.isDinner(dish) ? (base > 4 ? `Zutaten für etwa ${base + g} Portionen${g ? ` (mit ${g === 1 ? '1 Gast' : `${g} Gästen`})` : ''}` : g ? `Zutaten für 4 Personen und ${g === 1 ? '1 Gast' : `${g} Gäste`}` : 'Zutaten für 4 Personen') : `Zutaten${dish.pieces ? ` für ${dish.pieces} Stück` : ''}`}</h3>
    <ul class="zutaten">${(dish.ingredients || []).map((ing) => `<li>${esc(L.fmtIngredient(scaled(ing)))}</li>`).join('')}</ul>
    <h3>Zubereitung</h3>
    <ol class="schritte">${(dish.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    ${nutritionHtml(dish)}`;
}

function sheetDay({ day }) {
  const p = planOf(day);
  const dish = p && dishById(p.dish_id);
  const free = L.wdIndex(day) < 5 ? L.schoolFree(day) : null;
  const weekday = L.isSchoolDay(day);
  const lunch = free ? `<div class="kasten-text"><strong>Schulfrei</strong>${esc(free)}, keine Brotbox nötig.</div>` : weekday ? `<div class="kasten-text"><strong>Brotbox</strong>${esc(p && p.lunchbox ? p.lunchbox : 'Noch nichts eingetragen.')}${lunchRatingBlock(day)}
      <details><summary>Brotbox ändern</summary>
      <form class="form" data-form="brotbox"><input type="hidden" name="day" value="${day}">
      <textarea class="feld" name="lunchbox" aria-label="Brotbox">${esc(p ? p.lunchbox || '' : '')}</textarea>
      <button class="knopf">Brotbox speichern</button></form></details></div>` : '';
  const preps = prepFor(day);
  const prep = (preps.length || canPlan()) ? `<div class="kasten-text vorabend"><strong>Am Vorabend vorbereiten</strong>${preps.length ? preps.map(esc).join(' ') : 'Nichts eingetragen.'}
      ${canPlan() ? `<details><summary>Notiz ändern</summary>
      <form class="form" data-form="vorabend"><input type="hidden" name="day" value="${day}">
      <input class="feld" name="prep" aria-label="Notiz für den Vorabend" placeholder="z. B. Brötchen für die Brotbox aufbacken" value="${esc(p && p.prep ? p.prep : '')}">
      <button class="knopf">Notiz speichern</button></form></details>` : ''}</div>` : '';
  if (!dish) {
    return { over: L.fmtLong(day), title: 'Nichts geplant', body: `${prep}${lunch}${canPlan() ? `<div class="knopfreihe"><button class="knopf" data-action="tauschen" data-day="${day}">Gericht wählen</button></div>` : ''}` };
  }
  return {
    over: L.fmtLong(day),
    title: dish.name,
    body: `<p class="meta">${esc(metaText(dish))}</p><p class="zaehler">${esc(counterText(dish, day))}</p>
      ${dinnerBlock(day)}
      ${ratingBlock(day)}${prep}${lunch}${dayNoteHtml(day)}
      ${(dish.steps || []).length ? `<div class="knopfreihe koch-start"><button class="knopf" data-action="kochmodus" data-id="${esc(dish.id)}" data-day="${day}">Kochmodus</button></div>` : ''}
      ${recipeHtml(dish, true, guestsOf(day))}
      ${canPlan() ? `<div class="knopfreihe">${day >= L.todayISO() ? `<button class="knopf zweit" data-action="tag-tausch" data-day="${day}">Mit anderem Tag tauschen</button>` : ''}<button class="knopf zweit" data-action="tauschen" data-day="${day}">Gericht tauschen</button>
      <button class="knopf zweit" data-action="ausfall" data-day="${day}">${p.skipped ? 'Fand doch statt' : 'Ist ausgefallen'}</button></div>` : ''}`,
  };
}

function sheetDish({ id }) {
  const dish = dishById(id);
  if (!dish) return { over: '', title: 'Gericht nicht gefunden', body: '' };
  const s = stats[id];
  const people = state.data.persons.filter((p) => s.perPerson[p.id] != null).map((p) =>
    `<li>${avatar(p, true)}<span>${esc(p.name)}</span><span class="schnitt">${L.fmtStars(s.perPerson[p.id])} ${MINI}</span></li>`).join('');
  let status = '';
  if (s.autoArchived) status = `<div class="kasten-text"><strong>Aussortiert</strong>Der Schnitt liegt bei ${L.fmtStars(s.ruleAvg)} Sternen. Beim Wiederaufnehmen zählt die Regel nur noch neue Bewertungen.</div>`;
  else if (s.archived) status = '<div class="kasten-text"><strong>Aussortiert</strong>Von Hand herausgenommen. Das Gericht taucht in keinem Vorschlag mehr auf.</div>';
  else if (dish.pause_until && dish.pause_until >= L.todayISO()) status = `<div class="kasten-text"><strong>Pause bis ${esc(L.fmtShort(dish.pause_until))}</strong>Bis dahin schlägt die App das Gericht nicht vor. Von Hand eintragen geht trotzdem.</div>`;
  const when = [s.lastServed ? `Zuletzt am ${L.fmtShort(s.lastServed)}` : '', s.nextPlanned ? `wieder geplant am ${L.fmtShort(s.nextPlanned)}` : ''].filter(Boolean).join(', ');
  return {
    over: metaText(dish),
    title: dish.name,
    body: `${dishCostLine(dish)}${L.isDinner(dish) ? `<div class="werte">
        <div><span class="n">${s.served}</span><span class="l">mal dran</span></div>
        <div><span class="n">${s.avg == null ? 'ohne' : L.fmtStars(s.avg)}</span><span class="l">Sterne im Schnitt</span></div>
        <div><span class="n">${s.count}</span><span class="l">Bewertungen</span></div></div>
      <p class="meta">${esc([when, L.rhythmLabel(s)].filter(Boolean).join(', '))}</p>` : ''}
      ${people ? `<ul class="runde">${people}</ul>` : ''}
      ${s.hearts ? `<p class="meta herz-zeile"><span class="herz-mini">${HEART}</span> ${s.hearts} mal Lieblingsgericht der Woche: ${esc(Object.entries(s.heartsBy).map(([pid, n]) => `${(personById(pid) || {}).name || pid} ${n}`).join(', '))}</p>` : ''}${status}
      ${canPlan() ? `<div class="knopfreihe">${s.archived
        ? `<button class="knopf" data-action="aufnehmen" data-id="${esc(id)}">Wieder aufnehmen</button>`
        : `<button class="knopf rot" data-action="aussortieren" data-id="${esc(id)}">Aussortieren</button>`}
      <button class="knopf zweit" data-action="gericht-bearbeiten" data-id="${esc(id)}">Bearbeiten</button></div>` : ''}
      ${(dish.steps || []).length ? `<div class="knopfreihe koch-start"><button class="knopf" data-action="kochmodus" data-id="${esc(id)}">Kochmodus</button></div>` : ''}
      ${recipeHtml(dish)}`,
  };
}

// Zwei Tage tauschen ihr Abendessen. Brotbox, Essenszeit und Urlaub bleiben am Tag.
function sheetDayTrade({ day }) {
  const today = L.todayISO();
  const start = L.mondayOf(day);
  const days = Array.from({ length: 14 }, (_, n) => L.addDays(start, n)).filter((d) => d !== day && d >= today);
  const rows = days.map((d) => {
    const p = planOf(d);
    const dish = p && dishById(p.dish_id);
    const away = holidayOf(d);
    const meta = dish ? esc(durationText(dish.duration_min)) : away ? esc(away.name || 'Urlaub') : 'noch nichts geplant';
    return `<li><button class="g-zeile" data-action="tag-tausch-mit" data-day="${day}" data-with="${d}"${away && !dish ? ' disabled' : ''}>
      <span class="tz-text"><span class="tz-name">${L.WEEKDAYS[L.wdIndex(d)]}, ${esc(L.fmtShort(d))}: ${dish ? esc(dish.name) : '<span class="tz-leer">frei</span>'}</span><span class="tz-meta">${meta}</span></span></button></li>`;
  }).join('');
  const mine = dishById((planOf(day) || {}).dish_id);
  return {
    over: L.fmtLong(day),
    title: 'Mit welchem Tag tauschen?',
    body: `<p class="meta" style="margin-bottom:12px">${mine ? `„${esc(mine.name)}“ wandert auf den gewählten Tag, dessen Gericht kommt hierher.` : 'Das Gericht des gewählten Tages kommt hierher.'} Vorabend-Notizen wandern mit, Brotboxen bleiben am Tag.</p>
      <ul class="auswahl">${rows}</ul>`,
  };
}

// Was beim Tausch auffallen sollte: Reste für Brotboxen, Einkauf erst später, wenig Zeit, Bewertungen.
function tradeWarnings(a, b) {
  const out = [];
  const pa = planOf(a); const pb = planOf(b);
  const da = pa && dishById(pa.dish_id); const db = pb && dishById(pb.dish_id);
  const moves = [[da, b], [db, a]].filter(([d]) => d);
  // Brotboxen, die Reste von einem der beiden Tage einplanen ("vom Montag").
  const weekDaysAll = Array.from({ length: 14 }, (_, n) => L.addDays(L.mondayOf(a < b ? a : b), n));
  for (const d of [a, b]) {
    const name = L.WEEKDAYS[L.wdIndex(d)];
    for (const x of weekDaysAll) {
      const text = lunchOf(x) || '';
      if (x > d && x <= L.addDays(d, 2) && new RegExp(`\\b(vom|von|aus|am)\\s+${name}`, 'i').test(text)) {
        out.push(`Die Brotbox am ${L.WEEKDAYS[L.wdIndex(x)]} rechnet mit Resten vom ${name}.`);
      }
    }
  }
  // Zutaten, die erst nach dem neuen Tag eingekauft werden.
  for (const [dish, to] of moves) {
    const short = L.shortDish(dish.name).toLowerCase();
    const late = state.data.shopping.filter((i) => !i.checked && i.due && i.due > to && i.week_start === L.mondayOf(to) && (i.purpose
      ? i.purpose.toLowerCase().includes(short)
      : !!L.purposeOf({ ...i, purpose: '' }, [{ day: to, dish_id: dish.id }], state.data.dishes)));
    if (late.length) {
      const names = late.slice(0, 3).map((i) => i.label).join(', ') + (late.length > 3 ? ' und mehr' : '');
      out.push(`Für „${L.shortDish(dish.name)}“ am ${L.WD_SHORT[L.wdIndex(to)]} wird erst am ${L.WD_SHORT[L.wdIndex(late[0].due)]} eingekauft: ${names}.`);
    }
  }
  // Wenig Zeit am neuen Tag.
  const limits = T.durationLimits(state.data.persons, state.data.events, state.data.attendance, [a, b]);
  for (const [dish, to] of moves) {
    if (dish.duration_min && dish.duration_min > limits[to]) out.push(`„${L.shortDish(dish.name)}“ braucht ${durationText(dish.duration_min)}, am ${L.WD_SHORT[L.wdIndex(to)]} ist es knapp.`);
  }
  if (state.data.ratings.some((r) => r.day === a || r.day === b)) out.push('Für einen der Tage gibt es schon Bewertungen, sie werden gelöscht.');
  return out;
}

async function swapDays(a, b) {
  if (!a || !b || a === b) return;
  const pa = planOf(a); const pb = planOf(b);
  if (!(pa && pa.dish_id) && !(pb && pb.dish_id)) { toast('An beiden Tagen ist nichts geplant.'); return; }
  const warn = tradeWarnings(a, b);
  if (warn.length && !(await ask(warn.join(' '), 'Trotzdem tauschen'))) { openSheet({ type: 'tag-tausch', day: a }); return; }
  const build = (day, own, from) => ({ ...(own || { day, lunchbox: '' }), day, dish_id: from ? from.dish_id || null : null, prep: from ? from.prep || '' : '', skipped: false });
  const na = build(a, pa, pb); const nb = build(b, pb, pa);
  const keep = (r) => r.dish_id || r.lunchbox;
  const save = [na, nb].filter(keep);
  const drop = [na, nb].filter((r) => !keep(r) && planOf(r.day)).map((r) => r.day);
  const rated = state.data.ratings.some((r) => r.day === a || r.day === b);
  commit(() => {
    state.data.plan = [...state.data.plan.filter((x) => x.day !== a && x.day !== b), ...save].sort(byDay);
    state.data.ratings = state.data.ratings.filter((r) => r.day !== a && r.day !== b);
  }, async () => {
    if (rated) { await store.deleteRatingsForDay(a); await store.deleteRatingsForDay(b); }
    if (save.length) await store.savePlan(save);
    if (drop.length) await store.deletePlan(drop);
  });
  closeSheet();
  toast(`${L.WEEKDAYS[L.wdIndex(a)]} und ${L.WEEKDAYS[L.wdIndex(b)]} getauscht.`);
}

function sheetSwap({ day }) {
  const p = planOf(day);
  const week = L.mondayOf(day);
  const ranked = L.rankDishes(state.data.dishes.filter(L.isDinner), stats, state.data.plan, week);
  ranked.sort((a, b) => L.isPaused(a.dish, week) - L.isPaused(b.dish, week));
  const rows = ranked.map((r) => {
    const s = stats[r.dish.id];
    const bits = [];
    if (s.avg != null) bits.push(avgHtml(s));
    bits.push(r.days == null ? 'noch nie dran' : `zuletzt vor ${r.days} Tagen`);
    bits.push(esc(durationText(r.dish.duration_min)));
    const current = p && p.dish_id === r.dish.id;
    const uses = leftoverHits(r.dish);
    if (uses.length) bits.unshift(`<b>verbraucht ${esc(uses.join(', '))}</b>`);
    return `<li><button class="g-zeile" data-action="waehlen" data-day="${day}" data-id="${esc(r.dish.id)}"${current ? ' aria-current="true"' : ''}>
      <span class="tz-text"><span class="tz-name">${esc(r.dish.name)}${current ? ' <span class="marke">geplant</span>' : ''}${L.isPaused(r.dish, week) ? pauseMark(r.dish) : ''}</span><span class="tz-meta">${bits.join(', ')}</span></span></button></li>`;
  }).join('');
  return {
    over: L.fmtLong(day),
    title: 'Gericht wählen',
    body: `<p class="meta" style="margin-bottom:12px">Oben stehen die Gerichte, die als Nächstes an der Reihe wären.</p>
      <ul class="auswahl">${rows}</ul>
      ${p && p.dish_id ? `<div class="knopfreihe"><button class="knopf zweit" data-action="waehlen" data-day="${day}" data-id="">Tag frei lassen</button></div>` : ''}`,
  };
}

function sheetDishForm({ id }) {
  const dish = id ? dishById(id) : null;
  const cats = Object.entries(L.DISH_CATS).map(([k, v]) => `<option value="${k}"${dish && dish.category === k ? ' selected' : ''}>${v}</option>`).join('');
  return {
    over: dish ? 'Bearbeiten' : 'Neues Gericht',
    title: dish ? dish.name : 'Gericht hinzufügen',
    body: `<form class="form" data-form="gericht"><input type="hidden" name="id" value="${esc(id || '')}">
      <label>Name<input class="feld" name="name" required value="${esc(dish ? dish.name : '')}"></label>
      <div class="zwei"><label>Art<select class="feld" name="category">${cats}</select></label>
      <label>Dauer in Minuten<input class="feld" name="duration" type="number" inputmode="numeric" min="5" max="600" value="${dish ? dish.duration_min : 30}"></label></div>
      <label>Stichworte <small>mit Komma getrennt, z. B. Thermomix, Airfryer, Schnell</small><input class="feld" name="tags" value="${esc(dish ? (dish.tags || []).join(', ') : '')}"></label>
      <label class="schalter haken-gross"><input type="checkbox" name="favorite"${dish && dish.favorite ? ' checked' : ''}> Lieblingsgericht der Familie <small>kommt im Wochenvorschlag öfter dran</small></label>
      <label>Nicht einplanen bis einschließlich <small>leer lassen, wenn das Gericht sofort vorgeschlagen werden darf</small><input class="feld" name="pause_until" type="date" value="${esc(dish && dish.pause_until ? dish.pause_until : '')}"></label>
      <label>Das Rezept ist für <span class="inline-zahl"><input class="feld" name="servings" type="number" inputmode="numeric" min="1" max="30" value="4" aria-label="Anzahl Personen"> Personen</span>
        <small>Die App rechnet die Mengen beim Speichern auf 4 Personen um.</small></label>
      <label>Zutaten <small>eine pro Zeile, so wie sie im Rezept stehen, z. B. 200 g Mehl, 1/2 TL Salz, 3 Eier, 1 Pck. Backpulver. Gewürze und Zeilen ohne Menge kommen nicht auf die Einkaufsliste.</small>
      <textarea class="feld" name="ingredients" rows="8">${esc(dish ? dish.ingredients.map(L.fmtIngredient).join('\n') : '')}</textarea></label>
      <label>Zubereitung <small>ein Schritt pro Zeile oder Absatz, Nummern werden entfernt</small><textarea class="feld" name="steps" rows="8">${esc(dish ? dish.steps.join('\n') : '')}</textarea></label>
      <label>Hinweis<input class="feld" name="note" value="${esc(dish ? dish.note || '' : '')}"></label>
      <label>Am Vorabend vorbereiten <small>z. B. Fisch auftauen. Dazu kommt am Abend vorher um 19 Uhr eine Erinnerung.</small><input class="feld" name="prep" value="${esc(dish ? dish.prep || '' : '')}"></label>
      <label>Stückzahl <small>nur bei Brotbox-Rezepten, z. B. 20 Bällchen. Die Nährwerte gelten dann pro Stück.</small><input class="feld" name="pieces" type="number" inputmode="numeric" min="1" max="200" value="${dish && dish.pieces ? dish.pieces : ''}"></label>
      <details class="naehr-form"${dish && dish.nutrition ? ' open' : ''}><summary>Nährwerte selbst eintragen</summary>
        <p class="meta">Leer lassen, dann schätzt die App die Werte aus den Zutaten. Mit Werten von der Packung oder Rezeptkarte wird es genauer. Angaben pro Portion.</p>
        <div class="zwei">${N.FIELDS.map(([k, label, unit]) => `<label>${label} in ${unit}<input class="feld" name="n_${k}" inputmode="decimal" value="${dish && dish.nutrition && dish.nutrition[k] != null ? String(dish.nutrition[k]).replace('.', ',') : ''}"></label>`).join('')}</div></details>
      <button class="knopf breit">Gericht speichern</button></form>`,
  };
}

function sheetImport() {
  return {
    over: 'Neue Woche von Claude',
    title: 'Plan einfügen',
    body: `<p class="meta" style="margin-bottom:12px">Bitte Claude um den Wochenplan als Import für den Familienplan. Den Textblock hier einfügen. Neue Gerichte, die Tage und die Einkaufsliste werden übernommen.</p>
      <form class="form" data-form="import">
      <textarea class="feld" name="json" rows="10" aria-label="Plan als Text" placeholder='{ "week_start": "2026-11-23", ... }' required>${esc(state.importText || '')}</textarea>
      <p class="fehler" id="import-fehler" hidden></p>
      <button class="knopf breit">Plan übernehmen</button></form>`,
  };
}

function exportText() {
  const data = L.buildExport(state.data, stats, L.todayISO(), exportNutrition);
  return `${L.EXPORT_INTRO}\n\n${JSON.stringify(data, null, 1)}`;
}

function sheetExport() {
  const data = L.buildExport(state.data, stats, L.todayISO(), exportNutrition);
  const nDinner = data.abendessen.reduce((a, d) => a + Object.keys(d.sterne).length, 0);
  const nLunch = data.brotboxen.reduce((a, d) => a + Object.keys(d.sterne).length, 0);
  const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  return {
    over: 'Gerichte',
    title: 'Auswertung für Claude',
    body: `<div class="werte">
        <div><span class="n">${data.abendessen.length}</span><span class="l">Abendessen</span></div>
        <div><span class="n">${nDinner}</span><span class="l">Sterne fürs Essen</span></div>
        <div><span class="n">${nLunch}</span><span class="l">Sterne für Brotboxen</span></div></div>
      <p class="meta" style="margin-top:12px">Kopiere die Auswertung und füge sie im Chat mit Claude ein, zum Beispiel mit dem Satz „Mach mir daraus den Plan für nächste Woche“. Namen und Bewertungen sind enthalten, PINs und Zugangsdaten nicht.</p>
      <div class="knopfreihe"><button class="knopf" data-action="export-kopieren">Auswertung kopieren</button>
      ${framed ? '' : '<button class="knopf zweit" data-action="export-datei">Als Datei speichern</button>'}</div>
      <details id="export-details"><summary>Text ansehen</summary>
      <textarea class="feld export" id="export-text" readonly rows="12" aria-label="Auswertung">${esc(exportText())}</textarea></details>`,
  };
}

function sheetPin({ id, mode }) {
  const person = personById(id);
  const name = person ? person.name : '';
  const neu = mode === 'neu';
  const eltern = mode === 'eltern';
  const field = (n, label) => `<label>${label}<input class="feld pin" id="${n}" name="${n}" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required${n === 'pin1' ? ' data-autofocus' : ''}></label>`;
  return {
    over: name,
    title: neu ? 'PIN festlegen' : eltern ? `Wechsel zu ${name}` : 'PIN eingeben',
    body: `<p class="meta" style="margin-bottom:14px">${neu
        ? `Mit dieser PIN wechselt ${esc(name)} auf jedem Gerät zu den Rechten der Erwachsenen. Die Kinder sollten sie nicht kennen.`
        : eltern ? 'Damit niemand für den anderen abhakt oder Minuten einlöst, braucht der Wechsel die PIN von Mama oder Papa.'
          : `${esc(name)} darf den Plan ändern. Zum Wechseln die vierstellige PIN eingeben.`}</p>
      <form class="form" data-form="pin"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="mode" value="${neu ? 'neu' : eltern ? 'eltern' : 'pruefen'}">
      ${field('pin1', neu ? 'Neue PIN, vier Ziffern' : eltern ? 'PIN eines Erwachsenen' : 'PIN')}${neu ? field('pin2', 'PIN wiederholen') : ''}
      <p class="fehler" id="pin-fehler" hidden></p>
      <button class="knopf breit">${neu ? 'PIN speichern' : 'Weiter'}</button></form>`,
  };
}

// Selten gebrauchte Kästen im Einstellungs-Fenster zum Aufklappen: Die Überschrift bleibt sichtbar.
function fold(html, open) {
  if (!html) return '';
  return html.trim().replace(/^<div class="kasten-text([^"]*)"([^>]*)><strong>([\s\S]*?)<\/strong>/, (m, cls, attrs, title) => `<details class="kasten-text klapp${cls}"${attrs}${open ? ' open' : ''}><summary>${title}</summary>`)
    .replace(/<\/div>$/, '</details>');
}
function sheetFamily() {
  const edit = canPlan();
  const noAdult = !state.data.persons.some(isAdult);
  const rows = state.data.persons.map((p) => `<div class="person-zeile">
      <input type="radio" name="ich" value="${esc(p.id)}"${p.id === state.me ? ' checked' : ''} aria-label="Ich bin ${esc(p.name)}">
      ${avatar(p)}<input class="feld" name="name-${esc(p.id)}" value="${esc(p.name)}" aria-label="Name von ${esc(p.name)}" required maxlength="24"${edit ? '' : ' disabled'}>
      <label class="schalter"><input type="checkbox" name="adult-${esc(p.id)}"${isAdult(p) ? ' checked' : ''}${edit ? '' : ' disabled'}> Erwachsen</label></div>
      ${isAdult(p) ? '' : `<div class="person-minuten"><label>Grundzeit pro Tag<span class="inline-zahl"><input class="feld" name="base-${esc(p.id)}" type="number" inputmode="numeric" min="0" max="600" value="${p.screen_base ?? ''}"${edit ? '' : ' disabled'}> Min.</span></label>
      <label>Dazuverdienen höchstens<span class="inline-zahl"><input class="feld" name="cap-${esc(p.id)}" type="number" inputmode="numeric" min="0" max="600" value="${p.earn_cap ?? ''}"${edit ? '' : ' disabled'}> Min.</span></label></div>`}`).join('');
  return {
    over: 'Einstellungen',
    title: 'Familie',
    body: `<p class="meta" style="margin-bottom:12px">Links auswählen, wer dieses Gerät benutzt. ${edit
        ? 'Nur Erwachsene können Gerichte tauschen, die Woche planen, Gerichte bearbeiten und Aufgaben bestätigen. Bei den Kindern steht die tägliche Grundzeit und wie viel sie dazuverdienen können.'
        : 'Namen und Rollen ändern Mama oder Papa.'}</p>
      ${noAdult ? '<p class="fehler" style="margin-bottom:12px">Noch ist niemand als erwachsen markiert. Bis dahin kann jeder alles ändern.</p>' : ''}
      <form class="form" data-form="familie">${rows}<p class="fehler" id="familie-fehler" hidden></p><button class="knopf breit">Speichern</button></form>
      ${edit && state.data.persons.some(isAdult) ? `<h3>PIN der Erwachsenen</h3><ul class="zutaten">${state.data.persons.filter(isAdult).map((p) => `<li class="pin-zeile"><span>${esc(p.name)}: ${p.pin_hash ? 'PIN gesetzt' : 'noch keine PIN'}</span>${p.id === state.me
        ? `<button class="textknopf" data-action="pin-aendern">${p.pin_hash ? 'Meine PIN ändern' : 'PIN festlegen'}</button>`
        : p.pin_hash ? `<button class="textknopf" data-action="pin-zuruecksetzen" data-id="${esc(p.id)}">Zurücksetzen</button>` : ''}</li>`).join('')}</ul>
      <p class="meta">Wer seine PIN vergessen hat, bekommt sie von einem anderen Erwachsenen zurückgesetzt und legt beim nächsten Wechsel eine neue fest.</p>
      <label class="schalter" style="margin-top:12px"><input type="checkbox" data-action="kinder-sperre"${kidLock() ? ' checked' : ''}> Kinder wechseln nur mit PIN <small>Wechselt ein Kind auf dem Handy zum anderen Kind, braucht es die PIN von Mama oder Papa.</small></label>` : ''}
      ${pushBlock()}
      <div class="knopfreihe"><button class="knopf zweit klein" data-action="app-wuensche">Wunschzettel für die App${appWishes().filter((w) => !w.done).length ? ` (${appWishes().filter((w) => !w.done).length})` : ''}</button></div>
      ${fold(backupBlock(), state.backups !== undefined || !!state.backupBusy)}
      ${edit ? fold(aiCostBlock()) : ''}
      ${fold(abfuhrBox(true), abfuhrLow())}
      ${edit ? fold(`<div class="kasten-text"><strong>Küchen-Display</strong>Ein altes Tablet in der Küche zeigt dann groß Uhr, Abendessen, Ampeln, Termine, die Aufgaben der Kinder und die Einkaufsliste. Nur zum Anschauen, ohne Personenwahl, der Bildschirm bleibt an. Zurück geht es unten über „Anzeige beenden“.
      <div class="knopfreihe" style="margin-top:10px"><button class="knopf zweit klein" data-action="anzeige-an">Dieses Gerät wird Küchen-Display</button></div></div>`) : ''}
      ${edit ? fold(`<div class="kasten-text"><strong>Von Hand mit Claude im Chat</strong>Für den Weg ohne automatischen Wochenplan: die Auswertung in den Chat mit Claude kopieren und den fertigen Plan hier wieder einfügen.
      <div class="knopfreihe" style="margin-top:10px"><button class="knopf zweit klein" data-action="export">Auswertung erstellen</button><button class="knopf zweit klein" data-action="import">Plan einfügen</button></div></div>`) : ''}
      <div class="kasten-text">${store.mode === 'local'
        ? `<strong>Demo-Modus</strong>Ohne Supabase-Zugang in js/config.js bleiben alle Daten auf diesem Gerät.</div>
      <div class="kasten-text"><strong>Testdatum</strong>Bewerten geht erst ab dem Tag, an dem das Essen auf dem Plan steht. Zum Ausprobieren kannst du ein anderes Datum vorgeben.
      <div class="dazu" style="margin-top:10px"><input class="feld" type="date" id="testdatum" aria-label="Testdatum" value="${esc(L.todayISO())}"><button class="knopf" data-action="testdatum">Übernehmen</button></div>
      ${globalThis.ESSENSPLAN_HEUTE ? '<button class="textknopf" data-action="testdatum" data-wert="echt">Echtes Datum verwenden</button>' : ''}`
        : '<strong>Gemeinsame Datenbank</strong>Alle angemeldeten Geräte sehen denselben Stand.'}</div>
      <div class="knopfreihe">${store.mode === 'local'
        ? '<button class="knopf rot" data-action="demo-reset">Demo zurücksetzen</button>'
        : '<button class="knopf zweit" data-action="abmelden">Abmelden</button>'}</div>`,
  };
}

/* ---------- Schnelles Mittagessen ---------- */

function lunchButton() {
  return `<div class="mittag-start"><button class="knopf zweit" data-action="mittag">Schnelles Mittagessen</button><span class="meta">wenn mittags jemand früher zu Hause ist</span></div>`;
}

function sheetLunch() {
  const d = state.lunchForm || { personen: 1, minuten: 15, wunsch: '' };
  return {
    over: 'Heute Mittag',
    title: 'Schnelles Mittagessen',
    body: `<form class="form" data-form="mittag">
      <div class="zwei"><label>Personen<input class="feld" type="number" name="personen" min="1" max="10" inputmode="numeric" value="${esc(String(d.personen))}"></label>
      <label>Zeit<select class="feld" name="minuten">${[10, 15, 20, 30].map((m) => `<option value="${m}"${Number(d.minuten) === m ? ' selected' : ''}>höchstens ${m} Minuten</option>`).join('')}</select></label></div>
      <label>Lust auf etwas Bestimmtes? (optional)<input class="feld" name="wunsch" value="${esc(d.wunsch || '')}" placeholder="z. B. was Warmes, ohne Brot" autocomplete="off"></label>
      <button class="knopf breit">Vorschläge holen</button>
      <p class="meta">Claude schaut, was laut Vorrat und den letzten Einkäufen im Haus ist, nimmt bevorzugt, was weg muss, und lässt die Zutaten fürs Abendessen heute und morgen in Ruhe.${canPlan() ? '' : ' Die Vorschläge sind so, dass du sie allein machen kannst.'}</p></form>`,
  };
}

function sheetLunchLoading() {
  return { over: 'Heute Mittag', title: 'Claude überlegt', body: '<p class="meta">Das dauert meist nur ein paar Sekunden.</p><div class="lade-balken" aria-hidden="true"><span></span></div>' };
}

// Was laut App im Haus sein müsste, und was fürs Abendessen gebraucht wird.
function lunchContext() {
  const today = L.todayISO();
  const since = L.addDays(today, -8);
  const bought = state.data.shopping.filter((i) => i.checked && i.category !== 'vorhanden' && String(i.checked_at || '').slice(0, 10) >= since)
    .map((i) => [i.label, i.qty].filter(Boolean).join(' ')).slice(0, 60);
  const tabu = [];
  let tonight = '';
  for (const day of [today, L.addDays(today, 1)]) {
    const p = planOf(day);
    const dish = p && !p.skipped && dishById(p.dish_id);
    if (!dish) continue;
    if (day === today) tonight = dish.name;
    for (const g of dish.ingredients || []) if (g.c !== 'basis' && g.q != null) tabu.push(L.fmtIngredient(g));
  }
  return {
    vorrat: state.data.pantry.filter((x) => x.have).map((x) => x.label),
    eingekauft: bought, reste: leftovers().filter((x) => !x.ab || x.ab <= today).map((x) => x.text), nicht_verbrauchen: tabu.slice(0, 40), heute_abend: tonight,
  };
}

function sheetLunchResult() {
  const list = state.lunchResult || [];
  const n = (state.lunchForm || {}).personen || 1;
  return {
    over: `Für ${n} ${Number(n) === 1 ? 'Person' : 'Personen'}`,
    title: 'Vorschläge fürs Mittagessen',
    body: `${list.map((v, i) => `<details class="entwurf-rezept mittag-vorschlag"${i === 0 ? ' open' : ''}><summary><b>${esc(v.name)}</b> <span class="meta">${v.minuten} Min.</span></summary>
        ${v.warum ? `<p class="meta">${esc(v.warum)}</p>` : ''}
        <ul class="zutaten">${v.zutaten.map((z) => `<li${z.da ? '' : ' class="fehlt-zutat"'}>${esc([z.menge, z.name].filter(Boolean).join(' '))}${z.da ? '' : ' <span class="marke warn">fehlt vielleicht</span>'}</li>`).join('')}</ul>
        <ol class="schritte">${v.schritte.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        <div class="knopfreihe"><button class="knopf klein" data-action="mittag-kochen" data-n="${i}">Kochmodus</button>
        ${v.reste.length ? `<button class="knopf zweit klein" data-action="mittag-reste" data-n="${i}">${esc(v.reste.join(', '))} als verbraucht abhaken</button>` : ''}</div></details>`).join('')}
      <div class="knopfreihe"><button class="knopf zweit" data-action="mittag">Andere Vorschläge</button></div>`,
  };
}

/* ---------- Festtage ---------- */

const feastList = () => KI.feasts(state.data.settings);
function saveFeasts(list) {
  const row = { key: 'feste', value: list, updated_at: new Date().toISOString() };
  commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'feste'), row]; }, () => store.saveSettings([row]));
}
const feastPeople = (f) => (Number(f.erwachsene) || 0) + (Number(f.kinder) || 0);
function nextChristmasEve() {
  const y = Number(L.todayISO().slice(0, 4));
  return L.todayISO() <= `${y}-12-24` ? `${y}-12-24` : `${y + 1}-12-24`;
}

function feastForm(f) {
  const v = f || { anlass: 'Heiligabend', datum: nextChristmasEve(), wunsch: '', erwachsene: 2, kinder: 2, besonderheiten: '' };
  return `<form class="form" data-form="fest">${f ? `<input type="hidden" name="id" value="${esc(f.id)}">` : ''}
    <div class="zwei"><label>Anlass<input class="feld" name="anlass" value="${esc(v.anlass)}" required autocomplete="off"></label>
    <label>Datum<input class="feld" type="date" name="datum" value="${esc(v.datum)}" required></label></div>
    <label>Was soll es geben?<textarea class="feld" name="wunsch" rows="3" placeholder="z. B. Fondue wie jedes Jahr, mit Brühe, Fleisch und Garnelen, dazu Baguette und viele Dips">${esc(v.wunsch)}</textarea></label>
    <div class="zwei"><label>Erwachsene<input class="feld" type="number" name="erwachsene" min="0" max="40" inputmode="numeric" value="${esc(String(v.erwachsene))}"></label>
    <label>Kinder<input class="feld" type="number" name="kinder" min="0" max="40" inputmode="numeric" value="${esc(String(v.kinder))}"></label></div>
    <label>Was ist zu beachten? (optional)<input class="feld" name="besonderheiten" value="${esc(v.besonderheiten)}" placeholder="z. B. Oma isst kein Schwein, ein Gast ist Vegetarier" autocomplete="off"></label>
    <button class="knopf breit">${f ? 'Neu planen lassen' : 'Von Claude planen lassen'}</button>
    <p class="meta">Claude schlägt Menü, Dips, Mengen pro Person, einen Zeitplan und die Einkaufsliste vor. Das dauert etwa eine Minute.</p></form>`;
}

function sheetFeasts() {
  const today = L.todayISO();
  const all = feastList().sort((a, b) => (a.datum < b.datum ? -1 : 1));
  const list = all.filter((f) => f.datum >= today);
  // Vergangene Feste mit Plan, die es noch nicht als Vorlage für ein späteres Jahr gibt.
  const past = all.filter((f) => f.datum < today && f.plan && !all.some((x) => x.vorlage === f.id)).reverse();
  const row = (f) => `<li><button class="g-zeile" data-action="fest" data-id="${esc(f.id)}"><span class="tz-text">
        <span class="tz-name">${esc(f.anlass)}, ${esc(L.fmtShort(f.datum))}</span>
        <span class="tz-meta">${esc(f.plan ? f.plan.titel : 'noch nicht geplant')}, ${feastPeople(f)} Personen</span></span></button></li>`;
  return {
    over: 'Wochenplan',
    title: 'Festtage planen',
    body: `${list.length ? `<ul class="gerichte">${list.map(row).join('')}</ul>` : ''}
      ${past.length ? `<h3 class="abteilung">Wie letztes Jahr</h3><ul class="posten">${past.map((f) => `<li><div class="extra-zeile"><span class="p-text"><span class="p-name">${esc(f.anlass)}, ${esc(L.fmtShort(f.datum))}${esc(f.datum.slice(0, 4))}</span>
        <span class="p-menge">${esc(f.plan.titel)}, ${feastPeople(f)} Personen</span></span>
        <button class="knopf zweit klein" data-action="fest-wieder" data-id="${esc(f.id)}">Für ${nextFeastDate(f.datum).slice(0, 4)} übernehmen</button></div></li>`).join('')}</ul>
        <p class="meta">Menü, Dips, Mengen und Einkaufsliste werden übernommen. Ändert ihr danach die Personenzahl, plant Claude die Mengen neu.</p>` : ''}
      ${list.length || past.length ? '<h3 class="abteilung">Neuer Festtag</h3>' : ''}
      ${feastForm(null)}`,
  };
}
// Gleicher Kalendertag im nächsten Jahr, das noch nicht vorbei ist.
function nextFeastDate(datum) {
  const today = L.todayISO();
  let y = Number(datum.slice(0, 4)) + 1;
  while (`${y}${datum.slice(4)}` < today) y += 1;
  return `${y}${datum.slice(4)}`;
}

function feastLoading() {
  return { over: 'Festtage', title: 'Claude plant das Festessen', body: '<p class="meta">Menü, Dips, Mengen, Zeitplan und Einkaufsliste. Das dauert meist eine knappe Minute, bitte das Fenster offen lassen.</p><div class="lade-balken" aria-hidden="true"><span></span></div>' };
}

const fmtZutaten = (list) => (list || []).map((x) => L.fmtIngredient(Array.isArray(x) ? { q: x[0], u: x[1], n: x[2], c: x[3] } : x));

function sheetFeast({ id }) {
  const f = feastList().find((x) => x.id === id);
  if (!f) return { over: '', title: 'Nicht gefunden', body: '' };
  if (state.feastEdit === id || !f.plan) return { over: `${f.anlass}, ${L.fmtShort(f.datum)}`, title: 'Festtag bearbeiten', body: feastForm(f) };
  const p = f.plan;
  const ul = (items) => `<ul class="liste">${items.join('')}</ul>`;
  return {
    over: `${f.anlass}, ${L.fmtLong(f.datum)}`,
    title: p.titel,
    body: `<p class="meta">${f.erwachsene} Erwachsene und ${f.kinder} Kinder${f.besonderheiten ? `. ${esc(f.besonderheiten)}` : ''}${f.vorlage ? '. Plan vom letzten Mal übernommen' : ''}</p>
      <div class="knopfreihe"><button class="knopf zweit klein" data-action="fest-bearbeiten" data-id="${esc(f.id)}">Personen oder Wunsch ändern</button></div>
      <h3 class="abteilung">Menü</h3>${ul((p.menue || []).map((m) => `<li><b>${esc(m.gang)}:</b> ${esc(m.gericht)}${m.beschreibung ? `. ${esc(m.beschreibung)}` : ''}</li>`))}
      ${(p.mengen || []).length ? `<h3 class="abteilung">Mengen</h3><div class="tabelle-rahmen"><table class="mengen"><thead><tr><th>Was</th><th>Erwachsene</th><th>Kinder</th><th>Gesamt</th></tr></thead><tbody>
        ${p.mengen.map((m) => `<tr><td>${esc(m.was)}</td><td>${esc(m.pro_erwachsener)}</td><td>${esc(m.pro_kind)}</td><td><b>${esc(m.gesamt)}</b></td></tr>`).join('')}</tbody></table></div>` : ''}
      ${(p.dips || []).length ? `<h3 class="abteilung">Dips und Soßen</h3>${p.dips.map((d) => `<details class="entwurf-rezept"><summary>${esc(d.name)}${d.kinder ? ' <span class="chip ja">kindertauglich</span>' : ''}</summary>
        <ul class="zutaten">${fmtZutaten(d.zutaten).map((z) => `<li>${esc(z)}</li>`).join('')}</ul><p>${esc(d.zubereitung)}</p></details>`).join('')}` : ''}
      ${(p.gerichte || []).length ? `<h3 class="abteilung">Rezepte</h3>${p.gerichte.map((g) => `<details class="entwurf-rezept"><summary>${esc(g.name)}</summary>
        <ul class="zutaten">${fmtZutaten(g.zutaten).map((z) => `<li>${esc(z)}</li>`).join('')}</ul><ol class="schritte">${(g.schritte || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>`).join('')}` : ''}
      ${(p.zeitplan || []).length ? `<h3 class="abteilung">Zeitplan</h3>${ul(p.zeitplan.map((z) => `<li><b>${esc(z.wann)}:</b> ${esc(z.was)}</li>`))}` : ''}
      ${(p.kinder || []).length ? `<h3 class="abteilung">Da können die Kinder helfen</h3>${ul(p.kinder.map((k) => `<li>${esc(k)}</li>`))}` : ''}
      ${p.tipps ? `<div class="kasten-text"><strong>Tipps</strong>${esc(p.tipps)}</div>` : ''}
      <h3 class="abteilung">Einkauf (${(p.einkauf || []).length} Posten)</h3>
      <p class="meta">Haltbares kommt auf einen Festeinkauf drei Tage vorher, Fleisch, Fisch und Frisches auf einen Einkauf am Vortag.${f.listed ? ' <b>Steht schon auf der Einkaufsliste.</b>' : ''}</p>
      <div class="knopfreihe"><button class="knopf" data-action="fest-liste" data-id="${esc(f.id)}">${f.listed ? 'Noch einmal auf die Liste' : 'Auf die Einkaufsliste'}</button>
      <button class="knopf zweit" data-action="fest-plan" data-id="${esc(f.id)}">${f.dish_id ? 'Im Wochenplan erneuern' : 'In den Wochenplan'}</button></div>
      <div class="fuss"><button class="textknopf" data-action="fest-loeschen" data-id="${esc(f.id)}">Festtag löschen</button></div>`,
  };
}

async function runFeast(entry) {
  openSheet({ type: 'fest-laden' });
  try {
    const plan = await store.planFeast({ anlass: entry.anlass, datum: entry.datum, wunsch: entry.wunsch, erwachsene: entry.erwachsene, kinder: entry.kinder, besonderheiten: entry.besonderheiten });
    const { usage, ...clean } = plan || {};
    saveFeasts([...feastList().filter((x) => x.id !== entry.id), { ...entry, plan: clean, listed: false }]);
    state.feastEdit = null;
    openSheet({ type: 'fest', id: entry.id });
  } catch (e) {
    openSheet({ type: 'fest', id: entry.id });
    toast(store.offline ? 'Ohne Internet kann Claude nicht planen.' : `Hat nicht geklappt: ${e.message}`);
  }
}

// Banner im Wochenplan für Festtage in der angezeigten Woche.
function feastBanner(week) {
  if (!canPlan()) return '';
  const list = feastList().filter((f) => L.mondayOf(f.datum) === week);
  return list.map((f) => `<div class="kasten-text fest-kasten"><strong>${esc(f.anlass)}, ${esc(L.fmtShort(f.datum))}</strong>${esc(f.plan ? `${f.plan.titel}, ${feastPeople(f)} Personen` : 'noch nicht geplant')}
    <div class="knopfreihe" style="margin-top:8px"><button class="knopf zweit klein" data-action="fest" data-id="${esc(f.id)}">Ansehen</button></div></div>`).join('');
}

/* ---------- Was mögen wir? ---------- */

function sheetReport({ year }) {
  const y = Number(year) || Number(L.todayISO().slice(0, 4));
  const r = L.familyReport(state.data, y, L.todayISO());
  const prev = L.familyReport(state.data, y - 1, L.todayISO());
  const stars = (x) => `${L.fmtStars(x)} ${MINI}`;
  const dish = (x) => esc(L.shortDish(x.dish.name));
  const people = r.people.map((p, n) => `<div class="moegen-person">
      <div class="mp-kopf">${avatar(p.person, true)}<b>${esc(p.person.name)}</b><span class="meta">${p.n} Bewertungen, im Schnitt ${stars(p.avg)}${r.people.length > 1 && n === 0 ? ', am strengsten' : r.people.length > 1 && n === r.people.length - 1 ? ', am großzügigsten' : ''}</span></div>
      ${p.top.length ? `<p><span class="mp-label">Lieblinge</span> ${p.top.map((x) => `${dish(x)} (${L.fmtStars(x.avg)})`).join(', ')}</p>` : ''}
      ${p.flop ? `<p><span class="mp-label">Mag es nicht</span> ${dish(p.flop)} (${L.fmtStars(p.flop.avg)})</p>` : ''}</div>`).join('');
  const list = (items, f) => `<ol class="liste moegen-liste">${items.map((x) => `<li>${f(x)}</li>`).join('')}</ol>`;
  return {
    over: 'Gerichte',
    title: `Was mögen wir? ${y}`,
    body: `<div class="jahr-nav"><button class="knopf zweit klein" data-action="moegen" data-year="${y - 1}"${prev.ratings || prev.dinners ? '' : ' disabled'}>‹ ${y - 1}</button>
        <button class="knopf zweit klein" data-action="moegen" data-year="${y + 1}"${y + 1 > Number(L.todayISO().slice(0, 4)) ? ' disabled' : ''}>${y + 1} ›</button></div>
      ${!r.ratings && !r.dinners ? '<p class="meta">Für dieses Jahr gibt es noch keine Bewertungen.</p>' : `
      <div class="moegen-zahlen"><div><span class="n">${r.dinners}</span><span class="l">Abendessen</span></div><div><span class="n">${r.different}</span><span class="l">verschiedene Gerichte</span></div><div><span class="n">${r.newDishes}</span><span class="l">zum ersten Mal</span></div><div><span class="n">${r.ratings}</span><span class="l">Bewertungen</span></div></div>
      ${r.best.length ? `<h3 class="abteilung">Familienlieblinge</h3>${list(r.best, (x) => `${dish(x)} <span class="meta">${stars(x.avg)}</span>`)}` : ''}
      ${r.hearts.length ? `<h3 class="abteilung">Die meisten Herzen</h3>${list(r.hearts, (x) => `${dish(x)} <span class="herz-mini">${HEART}${x.n > 1 ? x.n : ''}</span>`)}` : ''}
      ${r.cooked.length ? `<h3 class="abteilung">Am häufigsten gekocht</h3>${list(r.cooked, (x) => `${dish(x)} <span class="meta">${x.n} mal</span>`)}` : ''}
      ${people ? `<h3 class="abteilung">Jeder für sich</h3>${people}` : ''}
      ${r.worst.length ? `<h3 class="abteilung">Die Flops</h3>${list(r.worst, (x) => `${dish(x)} <span class="meta">${stars(x.avg)}</span>`)}` : ''}
      <p class="meta">Familienlieblinge und Flops zählen nur Gerichte, die mindestens zwei von euch bewertet haben.</p>`}`,
  };
}

/* ---------- Wunschzettel für die App ---------- */

const appWishes = () => { const v = KI.settingOf(state.data.settings, 'app_wuensche'); return Array.isArray(v) ? v : []; };
function saveAppWishes(list) {
  const row = { key: 'app_wuensche', value: list, updated_at: new Date().toISOString() };
  commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'app_wuensche'), row]; }, () => store.saveSettings([row]));
}
function appWishText() {
  return appWishes().filter((w) => !w.done).map((w) => `- ${w.text} (${(personById(w.person_id) || {}).name || 'jemand'}, ${L.fmtShort(String(w.created_at).slice(0, 10))})`).join('\n');
}

function sheetAppWishes() {
  const list = appWishes().slice().sort((a, b) => (a.done - b.done) || (a.created_at < b.created_at ? 1 : -1));
  const open = list.filter((w) => !w.done);
  return {
    over: 'Familienplan',
    title: 'Wunschzettel für die App',
    body: `<p class="meta">Was nervt, was fehlt, was soll anders werden? Jeder kann hier etwas notieren. Die Eltern schicken die Liste ab und zu an Claude, dann wird genau das verbessert.</p>
      <form class="dazu" data-form="app-wunsch" style="margin:12px 0"><input class="feld" name="text" placeholder="z. B. Die Brotbox-Erinnerung kommt zu spät" aria-label="Wunsch für die App" autocomplete="off" required maxlength="200"><button class="knopf">Dazu</button></form>
      ${list.length ? `<ul class="posten">${list.map((w) => `<li class="${w.done ? 'erledigt' : ''}"><div class="extra-zeile"><span class="p-text"><span class="p-name">${esc(w.text)}</span>
        <span class="p-menge">${esc((personById(w.person_id) || {}).name || '')}, ${esc(L.fmtShort(String(w.created_at).slice(0, 10)))}${w.done ? ', erledigt' : ''}</span></span>
        ${canPlan() ? `<button class="knopf zweit klein" data-action="app-wunsch-erledigt" data-id="${esc(w.id)}">${w.done ? 'Wieder offen' : 'Erledigt'}</button>` : ''}
        ${canPlan() || w.person_id === state.me ? `<button class="weg" data-action="app-wunsch-weg" data-id="${esc(w.id)}" aria-label="${esc(w.text)} löschen">${CROSS}</button>` : ''}</div></li>`).join('')}</ul>` : '<p class="meta">Noch nichts notiert.</p>'}
      ${canPlan() && open.length ? `<h3 class="abteilung">Für Claude</h3><textarea class="feld" id="app-wunsch-text" rows="${Math.min(8, open.length + 1)}" readonly>${esc(`Wunschzettel für den Familienplan:\n${appWishText()}`)}</textarea>
        <div class="knopfreihe"><button class="knopf zweit" data-action="kopieren" data-ziel="app-wunsch-text">Kopieren</button></div>
        <p class="meta">In den Chat mit Claude einfügen. Danach die umgesetzten Punkte auf „Erledigt“ setzen.</p>` : ''}`,
  };
}

/* ---------- Hilfe ---------- */

const HELP_KIDS = [
  ['Aufgaben und Bildschirmzeit', 'Unter „Aufgaben“ stehen deine Aufgaben für heute. Grundaufgaben wie Tisch decken gehören einfach dazu. Was noch offen ist, steht ganz oben in der Woche, und nachmittags und abends kommt eine Erinnerung. Mama oder Papa schauen auch bei Grundaufgaben drüber. Für Extra-Aufgaben gibt es Minuten Bildschirmzeit, sobald Mama oder Papa sie bestätigen. Die Minuten gibt es erst, wenn deine Grundaufgaben für heute erledigt sind. Verdiente Minuten verfallen nach drei Tagen, oben siehst du dein Konto.'],
  ['Spülmaschine', 'Neben den Mülleimern siehst du die Ampel der Spülmaschine. Grün heißt: wird eingeräumt. Gelb heißt: läuft noch, wenn sie fertig ist, kommt eine Nachricht aufs Handy. Rot heißt: fertig, bitte ausräumen. Danach auf „Ausgeräumt“ tippen. Bestätigen Mama oder Papa, gibt es die Minuten und die Ampel springt auf Grün.'],
  ['Stall', 'Bist du mit dem Stall dran, siehst du unter „Aufgaben“ seine Ampel. Grün heißt: sauber, gerade nichts zu tun. Gelb heißt: morgen dran, du kannst ihn aber schon heute machen. Rot heißt: heute dran. Nach dem Saubermachen auf „Sauber gemacht“ tippen. Bei Rot kommt nachmittags eine Nachricht.'],
  ['Minuten-Shop', 'Unter „Aufgaben“ bei deinem Minutenkonto öffnet „Minuten-Shop“ eine Liste mit Belohnungen, zum Beispiel das Abendessen aussuchen. Kaufen hält die Minuten fest, Mama oder Papa lösen den Kauf ein. Klappt es gerade nicht, bekommst du die Minuten zurück.'],
  ['Foto als Nachweis', 'Bei manchen Aufgaben möchten Mama oder Papa ein Foto sehen. Dann öffnet sich beim Abhaken die Kamera. Mach ein Foto, auf dem man sieht, dass es erledigt ist, und tipp auf „Erledigt melden“.'],
  ['Mülleimer in der Küche', 'Unter „Aufgaben“ siehst du direkt unter dem Datum die Ampel für Plastikmüll und Restmüll. Grün heißt: noch Platz, gerade nichts zu tun. Gelb heißt: fast voll, du kannst ihn schon rausbringen. Rot heißt: voll, bitte jetzt rausbringen, dazu kommt eine Nachricht aufs Handy. Danach auf „Rausgebracht“ tippen. Bestätigen Mama oder Papa, gibt es die Minuten und die Ampel springt auf Grün.'],
  ['Tonne', 'Bist du mit der Tonne dran, kommt am Vorabend ab 18 Uhr eine Erinnerung. Hak die Aufgabe ab, wenn die Tonne an der Straße steht. Um 21 Uhr schauen Mama und Papa nach.'],
  ['Lernplaner', 'Wer den Lernplaner benutzt, sieht unter „Aufgaben“ oben die Karte „Dein Lerntag“: was heute erledigt ist, wie lange du gelernt hast und wie das Wochenspiel steht. „Zum Lernplaner“ öffnet ihn.'],
  ['Wunschessen', 'Unter „Aufgaben“ kannst du dir für nächste Woche ein Gericht wünschen, aus der Liste oder als eigene Idee. Jede Woche kommt ein Wunsch auf den Plan, abwechselnd von euch beiden.'],
  ['Essen bewerten', 'Nach dem Abendessen vergibst du Sterne, im Wochenplan beim jeweiligen Tag. Abends um spätestens 20:15 Uhr kommt eine Erinnerung, wenn du es vergessen hast. Gut bewertete Gerichte kommen öfter, schlecht bewertete fliegen raus.'],
  ['Brotbox und Herz der Woche', 'Deine Brotbox steht beim jeweiligen Tag, du kannst sie auch mit Sternen bewerten. Ab Freitag vergibst du ein Herz für dein Lieblingsgericht der Woche.'],
  ['Schnelles Mittagessen', 'Bist du mittags früher zu Hause, tipp unter „Woche“ unter dem heutigen Tag auf „Schnelles Mittagessen“. Claude schlägt etwas vor, das du mit dem, was da ist, allein machen kannst.'],
  ['Einkaufsliste und Reste', 'Unter „Einkauf“ kannst du etwas auf die Liste schreiben, zum Beispiel wenn das Duschgel leer ist. Unter „Woche“ bei „Planen“ trägst du bei „Was muss weg?“ ein, was bald gegessen werden muss, auch Gemüse aus dem Garten.'],
];
const HELP_ADULTS = [
  ['Wochenplan', 'Unter „Woche“ steht für jeden Tag das Abendessen mit Essenszeit, Brotbox und Vorabend-Notiz. Tippt auf einen Tag für Rezept, Kochmodus, „Wer isst mit?“ mit Gästen, Gericht tauschen oder mit einem anderen Tag tauschen. „Woche vorschlagen“ plant von selbst aus euren Bewertungen. Unter dem heutigen Tag gibt es „Schnelles Mittagessen“ für alle, die mittags früher zu Hause sind. Ganz unten: Termine der Familie, Urlaub und Tage auswärts, Was muss weg? und Festtage planen (zum Beispiel Fondue an Heiligabend, mit Mengen pro Person, Dips, Zeitplan und eigener Einkaufsliste).'],
  ['Wochenplan mit Claude', 'Freitags um 12 Uhr (einstellbar) schreibt Claude den Plan für die nächste Woche: mit den Angeboten von Aldi Süd und Lidl, euren Bewertungen, Regeln, Wünschen der Kinder, Gästen, Urlaub, Resten und euren Preisen von den Kassenzetteln. Ihr bekommt eine Push-Nachricht, prüft den Entwurf, tauscht einzelne Tage und gebt ihn frei. Regeln und Modell stellt ihr unter „Gerichte“ ein.'],
  ['Einkaufen', 'Die Liste entsteht aus dem Plan, getrennt nach Großeinkauf und Frischeeinkauf und nach Aldi und Lidl, in der Reihenfolge, in der ihr durch den Laden lauft (unten bei „Liste“: „Reihenfolge im Laden“). „Ich gehe einkaufen“ sagt den anderen Bescheid. Fehlt etwas im Laden, im Einkaufsmodus auf „fehlt“ tippen: dann gibt es „Ersatz?“, „Bei Lidl versuchen“ oder den nächsten Einkauf. Ergänzen geht per Tippen, per Foto oder Screenshot („Zutaten aus Foto“), durch Einfügen mehrerer Zeilen oder per Siri („Per Siri ergänzen“). Unter der Liste stehen „Mehr ergänzen“ (Foto, Immer wieder, Siri) und „Liste“ (neu erstellen, Vorrat, Reihenfolge im Laden). Im Laden hält der „Einkaufsmodus“ den Bildschirm an, zeigt große Häkchen und blendet Erledigtes aus. Was am Ende der Woche nicht abgehakt ist, wandert am Montag automatisch auf die neue Liste („aus KW …“). Gekauftes also immer abhaken. Was der Plan aus dem Vorrat nimmt, fragt die Liste oben ab: „Ist da“ oder „Fehlt“, dann kommt es mit Menge auf die nächste Tour.'],
  ['Gerichte und Rezepte', 'Unter „Gerichte“ steht die Sammlung mit Bewertungen, Nährwerten und Ampel. Neue Rezepte kommen per Foto („Rezept aus Foto“, auch aus Cookidoo), von Hand oder über Claude. Im Kochmodus gibt es einen Schritt pro Seite, Timer und einen Bildschirm, der an bleibt. Unter jedem Schritt steht „Dafür brauchst du“ mit den Mengen für diesen Schritt (bei Gästen schon hochgerechnet), darunter lassen sich alle Zutaten aufklappen. Unten zeigt „Was mögen wir?“ die Lieblinge und Flops des Jahres. Die Sortierung „Günstig“ zeigt die geschätzten Kosten pro Portion.'],
  ['Aufgaben der Kinder', 'Unter „Aufgaben“ bestätigt ihr gemeldete Aufgaben (auch Grundaufgaben, abschaltbar), seht die Minutenkonten und löst Bildschirmzeit ein. „Aufgaben verwalten“ legt Aufgaben, Minuten und Zuständigkeit fest, dort schaltet ihr auch „Grundaufgaben bestätigen“ und „Minuten erst nach den Grundaufgaben“. Abends kommt eine Nachricht, wenn bei den Kindern noch etwas offen ist. Die Uhrzeiten der Erinnerungen stellt ihr dort ebenfalls ein.'],
  ['Spülmaschine', 'Unter „Aufgaben“ im Abschnitt „Spülmaschine“: Grün heißt wird eingeräumt, Gelb läuft, Rot fertig zum Ausräumen. Nur bei Rot können die Kinder „Ausgeräumt“ melden. Bei Gelb wählst du „Fertig in 1 bis 4 Std.“ oder eine Uhrzeit, dann springt die Ampel zu dieser Zeit von selbst auf Rot und die Kinder bekommen eine Nachricht (zwischen 7 und 20:30 Uhr, sonst am nächsten Morgen). Mit deiner Bestätigung springt sie auf Grün.'],
  ['Stall-Ampel', 'Unter „Aufgaben“ im Abschnitt „Meerschweinchen-Stall“ stellt ihr ein, alle wie viele Tage der Stall sauber gemacht wird und wann es zuletzt war. Grün: noch Zeit. Gelb: morgen dran. Rot: heute dran oder überfällig, dann kommt zur ersten Erinnerungszeit der Kinder eine Nachricht. Ab Gelb können die Kinder „Sauber gemacht“ melden, eure Bestätigung oder „Heute sauber gemacht“ startet den Rhythmus neu. Solange die Ampel an ist, steht die Stall-Aufgabe nicht in der Wochenliste.'],
  ['Minuten-Shop', 'Unter „Aufgaben“ öffnet „Minuten-Shop“ die Liste der Belohnungen mit Preis in Minuten. Erst nach dem Speichern sehen die Kinder den Shop. Ein Kauf hält die Minuten fest und landet bei „Zu bestätigen“: „Erledigt“ löst ihn ein, „Zurückbuchen“ gibt die Minuten zurück. Ihr bekommt beim Kauf eine Nachricht, das Kind bei eurer Entscheidung.'],
  ['Küchen-Display', 'Ein Tablet in der Küche zeigt groß Uhr, Abendessen, Ampeln, Termine, die Aufgaben der Kinder und die Einkaufsliste. Einschalten im Familie-Fenster unter „Küchen-Display“ oder mit der Adresse …/?anzeige=kueche. Nur zum Anschauen, der Bildschirm bleibt an, nachts wird es dunkler. Unten „Anzeige beenden“.'],
  ['Tagessieg im Lernplaner', 'Gewinnt das Schulkind im Lernplaner einen Tag, schreibt der Lernplaner Minuten auf sein Konto (voreingestellt 10, einstellbar im Lernplaner unter Eltern, Einstellungen). Sie zählen nicht zum Tageslimit und stehen im Wochenrückblick.'],
  ['Foto als Nachweis', 'Unter „Aufgaben verwalten“ lässt sich bei jeder Aufgabe „Foto als Nachweis“ anhaken. Das Kind macht dann beim Melden ein Foto, ihr seht es unter „Zu bestätigen“ als kleines Bild und könnt es antippen, um es groß anzusehen und dort zu bestätigen. Solche Aufgaben bestätigt ihr immer selbst, auch Grundaufgaben. Die Fotos liegen privat bei Supabase und werden nach 14 Tagen gelöscht.'],
  ['Wochenrückblick', 'Unter „Woche“ bei „Planen“ und sonntags und montags oben in der Woche: Essen mit den Sternen, Herz der Woche, Aufgaben und Minuten der Kinder, Müll, Lernen aus dem Lernplaner, Ausgaben und ob die nächste Woche schon geplant ist. Mit „Woche davor“ blättert ihr zurück. Sonntags um 18:30 Uhr kommt eine Nachricht, die sich im Rückblick abschalten lässt.'],
  ['Müll-Ampel in der Küche', 'Unter „Aufgaben“ schaltet ihr für Plastikmüll und Restmüll die Ampel: einfach auf Rot, Gelb oder Grün tippen. Bei Grün können die Kinder den Eimer nicht melden, bei Gelb und Rot schon („Rausgebracht“, mit den Minuten der Aufgabe „Müll aus der Küche rausbringen“). Bei Rot bekommen die Kinder eine Push-Nachricht, zwischen 7 und 20:30 Uhr, sonst am nächsten Morgen. Bestätigt ihr die Meldung, springt die Ampel von selbst auf Grün.'],
  ['Lernplaner', 'Der Lernplaner (lernen.html) plant Hausaufgaben, Prüfungslernen und Pausen für das Schulkind. Unter „Aufgaben“ zeigt die Karte „Schule“ den Stand des Tages, das Wochenspiel und was als schwer markiert wurde, „Lernplaner öffnen“ führt hinein. Termine aus dem Lernplaner und die Termine der Familie sind dieselben, sie stehen in beiden Apps.'],
  ['Ausgaben', 'Kassenzettel fotografieren, prüfen, speichern. Die App sortiert in Kategorien, lernt aus euren Korrekturen, hakt Gekauftes auf der Einkaufsliste ab und setzt Vorräte auf „da“. Dazu Monatsbudget, Jahresüberblick mit Bio-Anteil und das Preisgedächtnis.'],
  ['Benachrichtigungen', 'Im Familie-Fenster (oben rechts auf euren Namen) schaltet jedes Gerät seine Push-Nachrichten ein: Morgenüberblick, Kochen anfangen, Vorabend, Einkauf, neue Einträge auf der Liste, Bewerten, Tonne, Aufgaben zum Bestätigen, Grundaufgaben der Kinder, die Ampeln für Müll und Spülmaschine, der Wochenrückblick am Sonntag und der Wochenplan von Claude. Die Nachrichten des Lernplaners stellt ihr im Lernplaner unter Einstellungen ein. Dort steht auch, wann die letzte Nachricht angekommen ist. Fehlen Nachrichten auf dem iPhone, in den iOS-Einstellungen unter Mitteilungen und beim Fokus nachsehen.'],
  ['Datensicherung', 'Jeden Sonntag sichert die App alle Daten. Im Familie-Fenster unter „Datensicherung“ lassen sie sich herunterladen oder sofort neu anlegen. „Zurückholen“ holt einzelne Rezepte oder den Plan einer Woche aus einer Sicherung zurück. Bevor ein Entwurf, ein eingefügter Plan oder eine Sicherung übernommen wird, zeigt die App, was sich ändert, und markiert rot, was verloren gehen würde.'],
  ['Wochenbonus', 'Wer an jedem Tag der Woche alle Grundaufgaben erledigt, bekommt am Sonntag Extra-Minuten (voreingestellt 30, einstellbar unter „Aufgaben verwalten“). Die Kinder sehen unter „Aufgaben“ sieben Punkte für die Woche. Urlaubstage zählen nicht mit, und der Bonus zählt nicht zum Tageslimit.'],
  ['Kosten im Blick', 'Über jeder Einkaufstour steht eine Schätzung, sobald es genug Preise aus euren Kassenzetteln gibt. Im Familie-Fenster steht, was die Anfragen an Claude im Monat kosten.'],
  ['Notizen fürs nächste Mal', 'Unter jedem Rezept und am Ende des Kochmodus steht „Notiz fürs nächste Mal“, zum Beispiel „Möhren zu den Erbsen“ oder „Senfsoße dazu“. Die Notiz erscheint beim nächsten Mal im Rezept und am Anfang des Kochmodus, und Claude berücksichtigt sie beim Planen und Einkaufen.'],
  ['Schultage und Kinder-Sperre', 'Bei jeder Aufgabe lässt sich „Nur an Schultagen“ anhaken, dann ruht sie am Wochenende, in den Ferien und an Feiertagen. Im Familie-Fenster sorgt „Kinder wechseln nur mit PIN“ dafür, dass ein Kind nicht ohne die PIN von Mama oder Papa zum anderen Kind wechseln kann.'],
  ['Packungsgrößen', 'Gibt es etwas im Markt nur in einer anderen Größe, im Einkaufsmodus auf „fehlt“ und dann „Andere Größe“ tippen, oder unten bei „Liste“ auf „Packungsgrößen“. Die App fragt dann, ob das Rezept auf 1 oder 2 Packungen umgerechnet wird oder bleibt (der Rest kommt auf „Was muss weg?“). Größen vom Kassenzettel lernt sie von selbst, und Claude plant künftig mit ganzen Packungen.'],
  ['Updates', 'Gibt es eine neue Fassung der App, erscheint unten „Neue Version der App. Tippen zum Laden.“ Ein Tipp genügt. Danach zeigt ein Fenster einmal, was neu ist. Unten in dieser Hilfe öffnet „Was ist neu?“ die Liste jederzeit.'],
  ['Müllabfuhr', 'Die Abholtermine stehen in der App. Gehen sie zu Ende, erscheint ein Hinweis. Dann auf abfuhrkalender.ceb-coburg.de die Kalenderdatei (.ics) für eure Straße laden und im Familie-Fenster oder unter „Aufgaben“ hochladen.'],
  ['Kosten, Saison und Festtage', 'Unter der Woche stehen die geschätzten Kosten der geplanten Abendessen und was vom Monatsbudget übrig ist. In der Einkaufsliste markiert „Saison“ Obst und Gemüse aus der Region, das lässt sich in den Regeln für Claude abschalten. Unter „Festtage“ lässt sich ein Fest vom letzten Jahr mit einem Tipp wieder übernehmen.'],
];

function sheetHelp() {
  const sec = (list, open) => list.map(([t, text], n) => `<details class="hilfe-punkt"${open && n === 0 ? ' open' : ''}><summary>${esc(t)}</summary><p>${esc(text)}</p></details>`).join('');
  const kidFirst = !canPlan();
  return {
    over: 'Hilfe',
    title: 'Was kann die App?',
    body: (kidFirst
      ? `<h3 class="abteilung">Für dich</h3>${sec(HELP_KIDS, true)}<h3 class="abteilung">Was Mama und Papa machen</h3>${sec(HELP_ADULTS, false)}`
      : `<h3 class="abteilung">Für Eltern</h3>${sec(HELP_ADULTS, true)}<h3 class="abteilung">Was die Kinder sehen</h3>${sec(HELP_KIDS, false)}`)
      + `<div class="kasten-text" style="margin-top:16px"><strong>Fehlt etwas oder nervt etwas?</strong>Schreib es auf den Wunschzettel für die App.
        <div class="knopfreihe" style="margin-top:8px"><button class="knopf zweit klein" data-action="neu-zeigen">Was ist neu?</button><button class="knopf zweit klein" data-action="app-wuensche">Wunschzettel öffnen${appWishes().filter((w) => !w.done).length ? ` (${appWishes().filter((w) => !w.done).length})` : ''}</button></div></div>`,
  };
}

/* ---------- Ersatz, wenn im Laden etwas fehlt ---------- */

const dayNotes = () => { const v = KI.settingOf(state.data.settings, 'tagesnotizen'); return v && typeof v === 'object' ? v : {}; };
function dayNoteHtml(day) {
  const t = dayNotes()[day];
  return t ? `<div class="kasten-text tagesnotiz"><strong>Heute anders</strong>${esc(t)}</div>` : '';
}

// Geplante Abendessen der Woche, für die ein Posten gedacht ist.
function itemDays(item) {
  return L.weekDays(item.week_start).map((day) => ({ day, p: planOf(day) })).filter(({ p }) => p && p.dish_id && !p.skipped).filter(({ day, p }) => {
    const dish = dishById(p.dish_id);
    if (!dish) return false;
    if (item.purpose) return item.purpose.toLowerCase().includes(L.shortDish(dish.name).toLowerCase());
    return !!L.purposeOf({ ...item, purpose: '' }, [{ day, dish_id: dish.id }], state.data.dishes);
  }).map(({ day, p }) => ({ day, dish: dishById(p.dish_id) }));
}

function sheetSubstLoading() {
  return { over: 'Einkauf', title: 'Ersatz wird gesucht', body: '<p class="meta">Claude überlegt kurz, was ihr stattdessen nehmen könnt. Das dauert ein paar Sekunden.</p><div class="lade-balken" aria-hidden="true"><span></span></div>' };
}

function sheetSubst() {
  const d = state.substDraft;
  const item = d && state.data.shopping.find((i) => i.id === d.itemId);
  if (!d || !item) return { over: '', title: 'Nicht gefunden', body: '' };
  const days = d.days.map((x) => `${L.WD_SHORT[L.wdIndex(x.day)]} ${L.shortDish(x.dish.name)}`).join(', ');
  return {
    over: `Statt ${item.label}`,
    title: 'Ersatz',
    body: `${days ? `<p class="meta">Gedacht für ${esc(days)}.</p>` : ''}
      <ul class="posten ersatz-liste">${d.res.vorschlaege.map((v, n) => `<li><div class="extra-zeile"><span class="p-text"><span class="p-name">${esc(v.name)}</span>
        <span class="p-menge">${esc([v.menge, v.warum].filter(Boolean).join('. '))}</span></span>
        <button class="knopf ${n ? 'zweit ' : ''}klein" data-action="ersatz-nehmen" data-n="${n}">Nehmen</button></div></li>`).join('')}</ul>
      ${d.res.rezept_hinweis && d.days.length ? `<div class="kasten-text"><strong>Fürs Rezept</strong>${esc(d.res.rezept_hinweis)}
        <label class="schalter" style="margin-top:8px"><input type="checkbox" id="ersatz-notiz" checked> Hinweis am ${esc(d.days.map((x) => L.WD_SHORT[L.wdIndex(x.day)]).join(' und '))} im Tagesfenster und im Kochmodus zeigen</label></div>` : ''}
      <p class="meta">Der Hinweis gilt für den ersten Vorschlag. Bei einem anderen passt ihn Claude nicht eigens an.</p>`,
  };
}

/* ---------- Was muss weg? ---------- */

const leftovers = () => { const v = KI.settingOf(state.data.settings, 'reste'); return Array.isArray(v) ? v : []; };
function saveLeftovers(list) {
  const row = { key: 'reste', value: list, updated_at: new Date().toISOString() };
  commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'reste'), row]; }, () => store.saveSettings([row]));
}
// Gerichte, die einen der Reste verwenden (für „Gericht wählen“).
const LEFT_STOP = new Set(['garten', 'halber', 'halbe', 'halbes', 'becher', 'packung', 'packungen', 'rest', 'reste', 'angebrochen', 'angebrochene', 'angebrochener', 'glas', 'dose', 'stück', 'frisch', 'frische', 'eigene', 'eigenen', 'übrig', 'noch', 'ernte', 'beutel', 'bund', 'viel', 'viele', 'paar']);
function leftoverHits(dish) {
  const names = (dish.ingredients || []).map((g) => String(g.n).toLowerCase());
  return leftovers().filter((x) => {
    const words = String(x.text || '').toLowerCase().split(/[^a-zäöüß]+/).filter((w) => w.length >= 4 && !LEFT_STOP.has(w));
    return words.some((w) => { const stem = w.length > 5 ? w.slice(0, -1) : w; return names.some((n) => n.includes(stem)); });
  }).map((x) => x.text);
}

function leftoverCard() {
  const list = leftovers();
  if (!list.length) return '';
  return `<div class="kasten-text reste"><strong>Muss weg</strong>${esc(list.map((x) => x.text).join(', '))}
    <div class="knopfreihe" style="margin-top:8px"><button class="knopf zweit klein" data-action="reste">Bearbeiten</button></div></div>`;
}

function sheetLeftovers() {
  const list = leftovers();
  return {
    over: 'Wochenplan',
    title: 'Was muss weg?',
    body: `<p class="meta">Reste, Angebrochenes oder Ernte aus dem Garten, zum Beispiel „halber Becher Sahne“ oder „3 Zucchini“. Claude baut es in den nächsten Wochenplan ein und kauft es nicht noch einmal. Beim Planen von Hand zeigt „Gericht wählen“, welche Gerichte es verbrauchen.</p>
      ${list.length ? `<ul class="posten">${list.map((x) => `<li><div class="extra-zeile"><span class="p-text"><span class="p-name">${esc(x.text)}</span><span class="p-menge">${x.ab && x.ab > L.todayISO() ? `ab ${esc(L.WD_SHORT[L.wdIndex(x.ab)])} ${esc(L.fmtShort(x.ab))}` : `seit ${esc(L.fmtShort(String(x.created_at || '').slice(0, 10) || L.todayISO()))}`}${x.person_id && personById(x.person_id) ? `, von ${esc(personById(x.person_id).name)}` : ''}</span></span>
        <button class="knopf zweit klein" data-action="rest-weg" data-id="${esc(x.id)}">Verbraucht</button></div></li>`).join('')}</ul>` : '<p class="meta">Gerade nichts eingetragen.</p>'}
      <form class="dazu" data-form="rest" style="margin-top:12px"><input class="feld" name="text" placeholder="z. B. 3 Zucchini aus dem Garten" aria-label="Was muss weg" autocomplete="off" required><button class="knopf">Dazu</button></form>`,
  };
}

/* ---------- Reihenfolge wie im Laden ---------- */

// Abteilungen in der Reihenfolge, in der die Familie durch den Markt läuft. "Schon im Haus" bleibt am Ende.
function catOrder(shop) {
  const saved = ((KI.settingOf(state.data.settings, 'laufweg') || {})[shop === 'lidl' ? 'lidl' : 'aldi']) || [];
  const base = L.SHOP_CAT_ORDER.filter((c) => c !== 'vorhanden');
  const list = [...saved.filter((c) => base.includes(c)), ...base.filter((c) => !saved.includes(c))];
  return [...list, 'vorhanden'];
}

function sheetRoute() {
  const shops = lidlOn() ? [['', 'Aldi Süd, Coburg-Creidlitz'], ['lidl', 'Lidl, Coburg-Ketschendorf']] : [['', 'Aldi Süd, Coburg-Creidlitz']];
  const block = ([shop, name]) => {
    const list = catOrder(shop).filter((c) => c !== 'vorhanden');
    return `<h3 class="abteilung">${esc(name)}</h3><ol class="laufweg">${list.map((c, n) => `<li><span class="lw-nr">${n + 1}</span><span class="lw-name">${esc(L.SHOP_CATS[c])}</span>
      <button class="knopf zweit klein" data-action="laufweg" data-shop="${shop || 'aldi'}" data-cat="${c}" data-dir="-1" aria-label="${esc(L.SHOP_CATS[c])} nach oben"${n === 0 ? ' disabled' : ''}>↑</button>
      <button class="knopf zweit klein" data-action="laufweg" data-shop="${shop || 'aldi'}" data-cat="${c}" data-dir="1" aria-label="${esc(L.SHOP_CATS[c])} nach unten"${n === list.length - 1 ? ' disabled' : ''}>↓</button></li>`).join('')}</ol>`;
  };
  return {
    over: 'Einkaufsliste',
    title: 'Reihenfolge im Laden',
    body: `<p class="meta">Ordnet die Abteilungen so, wie ihr durch den Markt lauft. Die Einkaufsliste steht dann in genau dieser Reihenfolge.</p>
      ${shops.map(block).join('')}
      <div class="knopfreihe"><button class="knopf zweit" data-action="laufweg-zurueck">Zurücksetzen</button></div>`,
  };
}

/* ---------- Kochmodus ---------- */

// Zeitangaben in einem Schritt, ab einer Minute: „20 Min./100 °C“, „1 Std.“, „90 Sek.“.
function stepTimers(text) {
  const out = [];
  const re = /(\d+(?:[,.]\d+)?)\s*(Sek\.?|Sekunden|Min\.?|Minuten|Std\.?|Stunden)/gi;
  let m;
  while ((m = re.exec(text))) {
    const n = parseFloat(m[1].replace(',', '.'));
    const u = m[2].toLowerCase();
    const sec = Math.round(n * (u.startsWith('sek') ? 1 : u.startsWith('min') ? 60 : 3600));
    if (sec >= 60 && sec <= 6 * 3600 && !out.some((x) => x.sec === sec)) out.push({ sec, label: m[0].replace(/\s+/g, ' ') });
  }
  return out;
}
const fmtTimer = (sec) => { const s = Math.max(0, Math.round(sec)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60; return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(r).padStart(2, '0')}`; };

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ((state.sheet && state.sheet.type === 'kochen') || state.shopMode || state.phase === 'anzeige')) keepAwake(true); });

let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.25, audioCtx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.3);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.3);
    });
  } catch (e) { /* ohne Ton */ }
  try { if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) { /* ohne Vibration */ }
}

// Laufende Timer bleiben auch beim Blättern und nach dem Schließen des Kochmodus bestehen.
let timerTick = null;
function tickTimers() {
  const now = Date.now();
  for (const t of state.timers) {
    if (!t.done && t.end <= now) { t.done = true; beep(); toast(`Timer fertig: ${t.label}`); }
    const el = document.querySelector(`[data-timer="${t.id}"] .t-zeit`);
    if (el) el.textContent = t.done ? 'fertig' : fmtTimer((t.end - now) / 1000);
    const box = document.querySelector(`[data-timer="${t.id}"]`);
    if (box) box.classList.toggle('fertig', !!t.done);
  }
  if (!state.timers.some((t) => !t.done) && timerTick) { clearInterval(timerTick); timerTick = null; }
}

function timerBar() {
  if (!state.timers.length) return '';
  return `<div class="timer-leiste">${state.timers.map((t) => `<div class="timer${t.done ? ' fertig' : ''}" data-timer="${t.id}">
    <span class="t-name">${esc(t.label)}</span><span class="t-zeit">${t.done ? 'fertig' : fmtTimer((t.end - Date.now()) / 1000)}</span>
    <button class="weg" data-action="timer-weg" data-id="${t.id}" aria-label="Timer ${esc(t.label)} beenden">${CROSS}</button></div>`).join('')}</div>`;
}

// Im Kochschritt: die Zutaten dieses Schritts mit Menge (bei Gästen hochgerechnet), darunter alle zum Aufklappen.
const QTY_RE = /^([\d½¼¾⅓⅔,./]+(?:\s*(?:bis|-)\s*[\d½¼¾,./]+)?\s*(?:kg|g|ml|l|EL|TL|Dosen?|Prisen?|Packungen?|Pck\.?|Bund|Gläser|Glas|Scheiben?|Würfel|Kopf|Köpfe|Stück|Becher|Handvoll|Msp\.?|Zehen?)?)\s+(.+)$/;
const ingLine = (text) => { const m = QTY_RE.exec(text); return m ? `<b>${esc(m[1])}</b> ${esc(m[2])}` : esc(text); };
function cookStepIngredients(step, dish, ings) {
  const here = L.stepIngredientIdx(step, dish.ingredients || []).map((i) => ings[i]).filter(Boolean);
  return `${here.length ? `<div class="kasten-text koch-braucht"><strong>Dafür brauchst du</strong><ul>${here.map((x) => `<li>${ingLine(x.text)}</li>`).join('')}</ul></div>` : ''}
    ${ings.length ? `<details class="koch-alle"><summary>Alle Zutaten (${ings.length})</summary><ul>${ings.map((x) => `<li>${ingLine(x.text)}</li>`).join('')}</ul></details>` : ''}`;
}

function sheetCook({ id, day }) {
  const dish = dishById(id) || (state.tempDishes || {})[id];
  if (!dish) return { over: '', title: 'Nicht gefunden', body: '' };
  const steps = dish.steps || [];
  const n = Math.min(Math.max(0, state.cookStep || 0), steps.length);
  const g = day ? guestsOf(day) : 0;
  const base = L.isDinner(dish) ? Math.max(1, Number(dish.servings) || 4) : 4;
  const f = (base + g) / base;
  const ings = (dish.ingredients || []).map((ing, i) => ({ i, text: L.fmtIngredient(g && ing.q != null ? { ...ing, q: L.scaleQty(ing.q, ing.u, f) } : ing) }));
  const body = n === 0
    ? `<p class="meta">${dish.lunchFor ? `Für ${dish.lunchFor} ${dish.lunchFor === 1 ? 'Person' : 'Personen'}. ` : L.isDinner(dish) ? (base > 4 ? `Für etwa ${base + g} Portionen, ${base - 4 > 1 ? `${base - 4} Portionen` : '1 Portion'} bleiben für den nächsten Tag. ` : `Für 4 Personen${g ? ` und ${g === 1 ? '1 Gast' : `${g} Gäste`}` : ''}. `) : ''}Abhaken, was bereitsteht.</p>
      ${recipeNotes(dish.id).length ? `<div class="kasten-text notizen"><strong>Letztes Mal notiert</strong><ul class="notiz-liste">${recipeNotes(dish.id).map((x) => `<li><span class="notiz-text">${esc(x.text)}</span></li>`).join('')}</ul></div>` : ''}
      <div class="zutaten-liste koch-zutaten">${ings.map((x) => `<label class="zutat"><input type="checkbox" data-action="koch-zutat" data-i="${x.i}"${state.cookChecked.includes(x.i) ? ' checked' : ''}><span class="z-text"><span class="z-name">${esc(x.text)}</span></span></label>`).join('')}</div>`
    : `<p class="koch-text">${esc(steps[n - 1])}</p>
      ${cookStepIngredients(steps[n - 1], dish, ings)}
      ${stepTimers(steps[n - 1]).map((t) => `<button class="knopf zweit timer-knopf" data-action="timer" data-sec="${t.sec}" data-label="${esc(`Schritt ${n}: ${t.label}`)}">Timer ${esc(t.label)}</button>`).join('')}
      ${n === steps.length && dishById(dish.id) ? `<div class="koch-notiz">${notesHtml(dish)}</div>` : ''}`;
  return {
    over: dish.name,
    title: n === 0 ? 'Zutaten' : `Schritt ${n} von ${steps.length}`,
    body: `${timerBar()}
      <div class="koch-fortschritt" aria-hidden="true"><span style="width:${Math.round((n / Math.max(1, steps.length)) * 100)}%"></span></div>
      ${day ? dayNoteHtml(day) : ''}
      <div class="koch-inhalt">${body}</div>
      <div class="koch-nav"><button class="knopf zweit" data-action="koch-schritt" data-dir="-1"${n === 0 ? ' disabled' : ''}>Zurück</button>
      ${n < steps.length ? `<button class="knopf" data-action="koch-schritt" data-dir="1">${n === 0 ? 'Los geht’s' : 'Weiter'}</button>` : '<button class="knopf" data-action="zu">Fertig</button>'}</div>
      ${'wakeLock' in navigator ? '<p class="meta unter">Der Bildschirm bleibt an, solange der Kochmodus offen ist.</p>' : ''}`,
  };
}

/* ---------- Datensicherung ---------- */

function backupBlock() {
  if (!canPlan() || store.mode === 'local') return '';
  const list = state.backups;
  const fmt = (n) => { const m = String(n).match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})/); return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}, ${m[4]}:${m[5]} Uhr` : n; };
  const size = (f) => (f.metadata && f.metadata.size ? ` (${Math.max(1, Math.round(f.metadata.size / 1024))} KB)` : '');
  return `<div class="kasten-text" id="sicherung"><strong>Datensicherung</strong>Jeden Sonntag um 3 Uhr sichert die App alle Daten: Rezepte, Bewertungen, Pläne, Aufgaben, Kassenzettel und Einstellungen. Die letzten ${8} Sicherungen bleiben erhalten.
    ${list === undefined ? '' : list === null ? '<p class="meta">Wird geladen …</p>'
      : list.length ? `<ul class="posten sicherungen">${list.map((f) => `<li><div class="extra-zeile"><span class="p-text"><span class="p-name">${esc(fmt(f.name))}</span><span class="p-menge">${esc(size(f))}</span></span>
        <span class="w-knoepfe"><button class="knopf zweit klein" data-action="sicherung-zurueck" data-name="${esc(f.name)}">Zurückholen</button><button class="knopf zweit klein" data-action="sicherung-laden" data-name="${esc(f.name)}">Laden</button></span></div></li>`).join('')}</ul>`
      : '<p class="meta">Noch keine Sicherung vorhanden.</p>'}
    <div class="knopfreihe" style="margin-top:10px">${list === undefined ? '<button class="knopf zweit klein" data-action="sicherungen">Sicherungen anzeigen</button>' : ''}
    <button class="knopf zweit klein" data-action="sicherung-jetzt"${state.backupBusy ? ' disabled' : ''}>${state.backupBusy ? 'Wird gesichert …' : 'Jetzt sichern'}</button></div>
    <p class="meta">„Zurückholen“ holt gezielt einzelne Rezepte oder den Plan einer Woche zurück. Vorher zeigt die App, was sich ändert.</p></div>`;
}

/* ---------- Aus einer Sicherung zurückholen ---------- */

// Rezepte, die in der Sicherung anders sind als jetzt (oder jetzt fehlen), mit kurzer Begründung.
function restoreCandidates(backup) {
  const out = [];
  for (const b of backup.daten.ep_dishes || []) {
    const now = state.data.dishes.find((d) => d.id === b.id);
    if (!now) { out.push({ dish: b, why: 'fehlt jetzt', pre: true }); continue; }
    const bi = (b.ingredients || []).length; const ni = (now.ingredients || []).length;
    const bs = (b.steps || []).length; const ns = (now.steps || []).length;
    const same = JSON.stringify([b.name, b.ingredients, b.steps, b.nutrition]) === JSON.stringify([now.name, now.ingredients, now.steps, now.nutrition]);
    if (same) continue;
    const lost = (bi && ni < bi / 2) || (bs && ns < bs / 2);
    const parts = [];
    if (bi !== ni) parts.push(`damals ${bi}, jetzt ${ni} Zutaten`);
    if (bs !== ns) parts.push(`damals ${bs}, jetzt ${ns} Schritte`);
    if (b.name !== now.name) parts.push(`damals „${b.name}“`);
    out.push({ dish: b, why: parts.join(', ') || 'Rezept seitdem geändert', pre: lost });
  }
  return out.sort((a, b) => Number(b.pre) - Number(a.pre) || a.dish.name.localeCompare(b.dish.name, 'de'));
}
function backupWeeks(backup) {
  const weeks = [...new Set((backup.daten.ep_plan || []).filter((p) => p.dish_id).map((p) => L.mondayOf(String(p.day).slice(0, 10))))];
  return weeks.sort().reverse().slice(0, 12);
}

function sheetRestore() {
  const r = state.restore;
  if (!r) return { over: '', title: 'Sicherung', body: '<p class="meta">Wird geladen …</p>' };
  const cands = restoreCandidates(r.backup);
  const weeks = backupWeeks(r.backup);
  const fmtName = (n) => { const m = String(n).match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : n; };
  return {
    over: `Sicherung vom ${fmtName(r.name)}`,
    title: 'Zurückholen',
    body: `<form class="form" data-form="zurueckholen">
      <h3 class="abteilung">Rezepte</h3>
      ${cands.length ? `<p class="meta">Diese Rezepte sind in der Sicherung anders als jetzt. Vorausgewählt ist, was seitdem verloren gegangen ist.</p>
        ${cands.map((c) => `<label class="schalter"><input type="checkbox" name="rezept" value="${esc(c.dish.id)}"${c.pre ? ' checked' : ''}> ${esc(c.dish.name)} <small>${esc(c.why)}</small></label>`).join('')}`
        : '<p class="meta">Alle Rezepte sind genauso wie in der Sicherung.</p>'}
      <h3 class="abteilung">Wochenplan</h3>
      ${weeks.length ? `<label>Plan dieser Woche zurückholen<select class="feld" name="woche"><option value="">keine Woche</option>${weeks.map((w) => `<option value="${w}">KW ${L.isoWeek(w)}, ${esc(L.fmtRange(w))}</option>`).join('')}</select></label>
        <p class="meta">Holt Gericht, Brotbox und Vorabend-Notiz für jeden Tag der Woche zurück. Steht an einem Tag ein anderes Gericht als damals, kommen auch dessen Bewertungen zurück. Die Einkaufsliste bleibt, wie sie ist.</p>` : '<p class="meta">In der Sicherung steht kein Wochenplan.</p>'}
      <button class="knopf breit">Weiter: Änderungen ansehen</button></form>`,
  };
}

async function openRestore(name) {
  state.restore = null;
  openSheet({ type: 'zurueckholen' });
  try {
    const blob = await store.downloadBackup(name);
    const backup = JSON.parse(await blob.text());
    if (!backup || !backup.daten) throw new Error('Die Datei ist keine Sicherung des Familienplans.');
    state.restore = { name, backup };
  } catch (e) { closeSheet(); toast(e.message || 'Die Sicherung ließ sich nicht lesen.'); return; }
  renderSheet();
}

// Was die Anfragen an Claude kosten. Die Push-Funktion zählt mit und legt es unter "ki_verbrauch" ab.
const AI_KINDS = { wochenplan: 'Wochenplan', entwurf: 'Wochenplan', kassenzettel: 'Kassenzettel', rezept: 'Rezepte aus Fotos', zutaten: 'Zutaten aus Fotos',
  ersatz: 'Ersatz im Laden', fest: 'Festtage', kosten: 'Preise schätzen', mittag: 'Mittagessen', siri: 'Siri', sonstiges: 'Sonstiges' };
const usd = (x) => (Number(x) > 0 && Number(x) < 0.005 ? 'unter 1 Cent' : `${(Number(x) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`);
function aiCostBlock() {
  const all = KI.settingOf(state.data.settings, 'ki_verbrauch');
  const month = HB.monthOf(L.todayISO());
  const prev = HB.addMonths(month, -1);
  const m = all && all[month];
  const p = all && all[prev];
  if (!m && !p) return `<div class="kasten-text"><strong>Claude-Kosten</strong>Ab jetzt zählt die App mit, was die Anfragen an Claude kosten. Die erste Summe steht hier nach dem nächsten Wochenplan oder Kassenzettel.</div>`;
  const kinds = {};
  for (const [k, v] of Object.entries((m && m.arten) || {})) { const label = AI_KINDS[k] || AI_KINDS.sonstiges; kinds[label] = (kinds[label] || 0) + Number(v || 0); }
  const parts = Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${usd(v)}`);
  return `<div class="kasten-text"><strong>Claude-Kosten im ${esc(HB.monthLabel(month).split(' ')[0])}: ${usd(m ? m.usd : 0)}</strong>${m ? `${m.n} ${m.n === 1 ? 'Anfrage' : 'Anfragen'}${parts.length ? `: ${esc(parts.join(', '))}` : ''}.` : 'Noch keine Anfrage in diesem Monat.'}${p ? ` Im ${esc(HB.monthLabel(prev).split(' ')[0])} waren es ${usd(p.usd)}.` : ''}
    <p class="meta">Anthropic rechnet in US-Dollar ab. Gezählt wird ab diesem Update, die Summe ist eine Schätzung aus den Preisen pro Token.</p></div>`;
}

async function loadBackups() {
  state.backups = null;
  renderSheet();
  try { state.backups = await store.listBackups(); } catch (e) { state.backups = undefined; toast(e.message); }
  renderSheet();
}

/* ---------- Aktionen ---------- */

function rate(day, n) {
  const p = planOf(day);
  if (!p || !p.dish_id || p.skipped || day > L.todayISO() || !state.me) return;
  const dish = dishById(p.dish_id);
  const was = stats[dish.id].archived;
  const cur = myRating(day);
  const rest = state.data.ratings.filter((r) => r !== cur);
  if (cur && cur.stars === n) {
    commit(() => { state.data.ratings = rest; }, () => store.deleteRating(day, state.me));
  } else {
    const row = { day, person_id: state.me, dish_id: dish.id, stars: n, updated_at: new Date().toISOString() };
    commit(() => { state.data.ratings = [...rest, row]; }, () => store.saveRating(row));
  }
  const now = stats[dish.id];
  if (!was && now.archived) toast(`${dish.name} ist aussortiert: ${L.fmtStars(now.ruleAvg)} Sterne im Schnitt.`);
  if (was && !now.archived) toast(`${dish.name} ist wieder im Umlauf.`);
}

function rateLunch(day, n) {
  const text = lunchOf(day);
  if (!canRateLunch() || !text || !L.isSchoolDay(day) || day > L.todayISO()) return;
  const cur = lunchRatingsOf(day).find((r) => r.person_id === state.me);
  const others = state.data.lunchRatings.filter((r) => !(r.day === day && r.person_id === state.me));
  if (cur && cur.stars === n) {
    commit(() => { state.data.lunchRatings = others; }, () => store.deleteLunchRating(day, state.me));
  } else {
    const row = { day, person_id: state.me, stars: n, lunchbox: text, updated_at: new Date().toISOString() };
    commit(() => { state.data.lunchRatings = [...others, row]; }, () => store.saveLunchRating(row));
  }
}

async function setDish(day, dishId) {
  const p = planOf(day);
  if (p && p.dish_id === dishId) { openSheet({ type: 'tag', day }); return; }
  const rated = state.data.ratings.some((r) => r.day === day);
  if (rated && !(await ask('Für diesen Tag gibt es schon Bewertungen. Beim Tauschen werden sie gelöscht.', 'Trotzdem tauschen'))) { openSheet({ type: 'tauschen', day }); return; }
  const others = state.data.plan.filter((x) => x.day !== day);
  const keepRow = dishId || (p && p.lunchbox);
  const row = { ...(p || {}), day, dish_id: dishId || null, lunchbox: p ? p.lunchbox || '' : '', skipped: false };
  commit(() => {
    state.data.plan = keepRow ? [...others, row].sort(byDay) : others;
    state.data.ratings = state.data.ratings.filter((r) => r.day !== day);
  }, async () => {
    if (rated) await store.deleteRatingsForDay(day);
    if (keepRow) await store.savePlan([row]); else await store.deletePlan([day]);
  });
  if (dishId) openSheet({ type: 'tag', day }); else closeSheet();
}

function fillWeek() {
  const limits = T.durationLimits(state.data.persons, state.data.events, state.data.attendance, L.weekDays(state.week));
  const skip = L.weekDays(state.week).filter((d) => holidayOf(d));
  const sug = L.planWeek(state.data.dishes, stats, state.data.plan, state.week, limits, skip);
  if (!sug.length) { toast(skip.length === 7 ? 'In dieser Woche ist Urlaub, es gibt nichts zu planen.' : 'Es gibt keine weiteren Gerichte im Umlauf.'); return; }
  const rows = sug.map((s) => {
    const p = planOf(s.day);
    return { day: s.day, dish_id: s.dish_id, lunchbox: p ? p.lunchbox || '' : '', skipped: false };
  });
  const days = rows.map((r) => r.day);
  const hadList = state.data.shopping.some((i) => i.week_start === state.week);
  commit(() => {
    state.data.plan = [...state.data.plan.filter((p) => !days.includes(p.day)), ...rows].sort(byDay);
  }, () => store.savePlan(rows));
  if (!hadList) rebuildShopping(true);
  toast(rows.length === 1 ? '1 Tag geplant.' : `${rows.length} Tage geplant${hadList ? '' : ', Einkaufsliste erstellt'}.`);
}

async function rebuildShopping(silent) {
  const week = state.week;
  const old = state.data.shopping.filter((i) => i.week_start === week && !i.manual);
  if (!silent && old.length && !(await ask('Die Liste wird aus dem Wochenplan neu berechnet. Häkchen gehen dabei verloren. Eigene Einträge und Posten für die Brotboxen bleiben.', 'Neu erstellen'))) return;
  const factors = T.portionFactors(state.data.persons, state.data.events, state.data.attendance, L.weekDays(week), state.data.plan);
  const built = L.buildShopping(week, state.data.plan, state.data.dishes, factors, state.data.pantry, packsAll());
  if (!built.length) { toast('Im Wochenplan steht noch kein Gericht.'); return; }
  const keep = keepNonDinner(old, week);
  // Was ein behaltener Posten schon abdeckt (gleiche Zutat, gleiche Gerichte), kommt nicht doppelt dazu.
  const low = (list) => list.map((u) => u.toLowerCase());
  const covered = (it) => keep.some((k) => L.itemKey(k.label) === L.itemKey(it.label) && low(L.usesOf(it.purpose)).every((u) => low(L.usesOf(k.purpose)).includes(u)));
  // Touren: die der alten Liste, sonst Großeinkauf am Samstag davor und Frischeeinkauf am Mittwoch wie in Claudes Plan.
  // Frisches kommt auf die letzte Tour bis zum ersten Gebrauch, der Rest auf den Großeinkauf.
  const oldTrips = L.tripsOf(old);
  const trips = oldTrips.length > 1 ? oldTrips : KI.shopTrips(week);
  const items = built.filter((it) => !covered(it)).map((it) => ({ ...it, ...L.tripFor(it, trips, week) }));
  const keepIds = new Set(keep.map((k) => k.id));
  const gone = old.filter((i) => !keepIds.has(i.id));
  commit(() => {
    state.data.shopping = [...state.data.shopping.filter((i) => !gone.includes(i)).map((i) => keep.find((k) => k.id === i.id) || i), ...items];
  }, async () => {
    await store.deleteItems(gone.map((i) => i.id));
    await store.saveItems([...keep, ...items]);
  });
  pantryNote(week);
}
// Posten für Brotboxen, Frühstück oder Snacks lassen sich nicht aus den Rezepten berechnen. Beim Neuberechnen bleiben sie,
// samt Häkchen. Steht bei ihnen auch ein Abendessen, das nicht mehr geplant ist, fällt dieser Zweck weg.
function keepNonDinner(old, week) {
  const names = L.dinnerNamesOf(state.data.dishes);
  const planned = new Set(L.weekDays(week).map((d) => {
    const p = planOf(d);
    const dish = p && !p.skipped && p.dish_id ? dishById(p.dish_id) : null;
    return dish ? `${L.shortDish(dish.name)} (${L.WEEKDAYS_SHORT[L.wdIndex(d)]})`.toLowerCase() : null;
  }).filter(Boolean));
  const keep = [];
  for (const i of old) {
    if (i.category === 'vorhanden') continue;
    const uses = L.usesOf(i.purpose);
    if (!uses.some((u) => !L.isDinnerUse(u, names))) continue;
    const left = uses.filter((u) => !L.isDinnerUse(u, names) || planned.has(u.toLowerCase()));
    keep.push(left.length === uses.length ? i : { ...i, purpose: left.join(', ') });
  }
  return keep;
}
// Nach einer neuen Liste: Hinweis, dass etwas aus dem Vorrat kommt und geprüft werden sollte.
function pantryNote(week) {
  const n = pantryAsk(week).length;
  if (n) setTimeout(() => toast(`${n === 1 ? '1 Sache kommt' : `${n} Sachen kommen`} aus dem Vorrat. Bitte oben in der Einkaufsliste bestätigen, ob ${n === 1 ? 'sie' : 'alles'} da ist.`), 1600);
}

// Fühlbare Rückmeldung beim Abhaken. Android kennt navigator.vibrate. Das iPhone (ab iOS 18) gibt beim
// Umschalten eines Schalters selbst einen kleinen Ruck, dafür dient ein unsichtbarer Schalter.
let checkTimer = null;
// Wie die Bibliothek „ios-haptics“: Für jeden Ruck einen frischen, unsichtbaren Schalter im <head> anlegen,
// antippen und wieder entfernen. Das muss direkt im Tipp-Ereignis passieren, sonst bleibt das iPhone still.
function haptic() {
  try {
    if (typeof navigator.vibrate === 'function' && !/iPhone|iPad|iPod/.test(navigator.userAgent)) { navigator.vibrate(12); return; }
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    document.head.removeChild(label);
  } catch (e) { /* ohne Rückmeldung weiter */ }
}

function toggleItem(id) {
  const item = state.data.shopping.find((i) => i.id === id);
  if (!item) return;
  const checked = !item.checked;
  const next = { ...item, checked, missing: checked ? false : !!item.missing, checked_by: checked ? state.me : null, checked_at: checked ? new Date().toISOString() : null };
  commit(() => {
    state.data.shopping = state.data.shopping.map((i) => (i === item ? next : i));
  }, () => store.saveItems([next]));
}

function normalizeDish(raw, existing) {
  const known = L.knownIngredientCats(state.data.dishes);
  const ingredients = (raw.ingredients || []).map((x) => {
    if (typeof x === 'string') return L.parseIngredientLine(x, known);
    const o = Array.isArray(x) ? { q: x[0], u: x[1], n: x[2], c: x[3] } : x;
    if (!o || !o.n) return null;
    const q = typeof o.q === 'number' ? o.q : null;
    return { q, u: o.u || '', n: String(o.n), c: L.SHOP_CATS[o.c] || o.c === 'basis' ? o.c : (known[o.n] || (q == null ? 'basis' : L.guessCat(String(o.n)))) };
  }).filter(Boolean);
  return {
    id: existing ? existing.id : (raw.id || L.uid()),
    name: String(raw.name).trim(),
    category: L.DISH_CATS[raw.category] ? raw.category : 'gemischt',
    duration_min: Math.max(5, parseInt(raw.duration_min, 10) || 30),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    note: raw.note ? String(raw.note) : '',
    favorite: raw.favorite != null ? !!raw.favorite : (existing ? !!existing.favorite : false),
    ingredients,
    steps: (raw.steps || []).map(String).filter(Boolean),
    pause_until: 'pause_until' in raw
      ? (/^\d{4}-\d{2}-\d{2}$/.test(String(raw.pause_until || '')) ? String(raw.pause_until) : null)
      : (existing ? existing.pause_until || null : null),
    prep: 'prep' in raw ? String(raw.prep || '').trim() : (existing ? existing.prep || '' : ''),
    pieces: 'pieces' in raw ? (parseInt(raw.pieces, 10) > 0 ? parseInt(raw.pieces, 10) : null) : (existing ? existing.pieces || null : null),
    servings: 'servings' in raw ? (parseInt(raw.servings, 10) > 4 ? parseInt(raw.servings, 10) : null) : (existing ? existing.servings || null : null),
    nutrition: 'nutrition' in raw ? cleanNutrition(raw.nutrition) : (existing ? existing.nutrition || null : null),
    manual_archived: existing ? !!existing.manual_archived : false,
    rule_from: existing ? existing.rule_from || EPOCH : EPOCH,
  };
}

// Eigene Nährwerte gelten nur, wenn mindestens der Brennwert eingetragen ist.
function cleanNutrition(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const [k] of N.FIELDS) {
    const v = parseFloat(String(raw[k] ?? '').replace(',', '.'));
    if (Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out.kcal > 0 ? out : null;
}

const exportNutrition = (d) => { const v = N.nutrition(d).values; return v ? Object.fromEntries(N.FIELDS.map(([k]) => [k, Number(N.fmtValue(k, v[k]).replace(',', '.'))])) : null; };

function nutritionHtml(dish) {
  const r = N.nutrition(dish);
  if (!r.values) return '';
  const rows = N.FIELDS.map(([k, label, unit]) => `<tr${label.startsWith('davon') ? ' class="davon"' : ''}><th scope="row">${label}</th><td>${N.fmtValue(k, r.values[k], r.source === 'eingetragen')} ${unit}</td></tr>`).join('');
  const note = r.source === 'eingetragen'
    ? 'Von Hand eingetragene Werte.'
    : `Geschätzt aus den Zutaten${dish.pieces ? '' : ', ein Viertel des Rezepts'}. Salz zum Abschmecken ist nicht enthalten.${r.missing.length ? ` Nicht eingerechnet: ${r.missing.join(', ')}.` : ''}`;
  return `<h3>Nährwerte pro ${r.per}</h3>${ampelHtml(dish)}<table class="naehrwerte"><tbody>${rows}</tbody></table><p class="meta">${esc(note)}</p>`;
}

// Ampel: nur für Erwachsene sichtbar, damit Essen für die Kinder nicht in gut und schlecht zerfällt.
const seesAmpel = () => { const me = personById(state.me); return !!me && isAdult(me); };
function ampelHtml(dish) {
  const a = seesAmpel() && N.ampel(dish);
  if (!a) return '';
  const chips = a.items.map((i) => `<li class="ampel-${i.level}"><span class="punkt" aria-hidden="true"></span>${i.label}: ${i.word}${i.key === 'salt' && a.estimated ? '*' : ''}</li>`).join('');
  const plus = a.plus.map((p) => `<li class="ampel-plus"><span class="punkt" aria-hidden="true"></span>${p.label}</li>`).join('');
  return `<ul class="ampel">${chips}${plus}</ul>
    <p class="meta ampel-hinweis">Maßstab für ein Abendessen: bis ein Viertel der Tagesmenge eines Erwachsenen niedrig, bis 40 % mittel, darüber hoch. Viel Eiweiß ab 40 g, viele Ballaststoffe ab 10 g.${a.estimated ? ' *Ohne Salz zum Abschmecken, der echte Wert liegt höher.' : ''}</p>`;
}
function ampelDots(dish) {
  const a = seesAmpel() && N.ampel(dish);
  if (!a) return '';
  const text = a.items.map((i) => `${i.label} ${i.word}`).concat(a.plus.map((p) => p.label)).join(', ');
  return `<span class="ampel-mini" role="img" aria-label="${esc(text)}">${a.items.map((i) => `<span class="punkt ampel-${i.level}"></span>`).join('')}${a.plus.length ? `<span class="plus">${a.plus.map((p) => (p.key === 'protein' ? 'Eiweiß' : 'Ballaststoffe')).join(', ')}</span>` : ''}</span>`;
}

// Was am Vorabend für einen Tag vorzubereiten ist: aus dem Gericht und aus der Notiz zum Tag.
function prepFor(day) {
  const p = planOf(day);
  if (!p) return [];
  const dish = !p.skipped && dishById(p.dish_id);
  return [dish && dish.prep, p.prep].filter(Boolean);
}
function prepBox() {
  const today = L.todayISO();
  const list = prepFor(L.addDays(today, 1));
  if (!list.length || !L.weekDays(state.week).includes(today)) return '';
  return `<div class="kasten-text vorabend"><strong>Heute Abend für morgen</strong>${list.map(esc).join(' ')}</div>`;
}

function runImport(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) {
    throw new Error('Der Text ist unvollständig. Bitte den ganzen Block von der ersten bis zur letzten Klammer kopieren.');
  }
  const dishes = [...state.data.dishes];
  const saved = [];
  const sameName = (a, b) => a.trim().toLowerCase() === String(b || '').trim().toLowerCase();
  for (const raw of obj.dishes || []) {
    if (!raw || !raw.name) continue;
    const n = dishes.findIndex((d) => d.id === raw.id || sameName(d.name, raw.name));
    // Ohne Zutaten und Schritte ist es eine Ergänzung: Nur die genannten Felder ändern sich.
    const partial = !('ingredients' in raw) && !('steps' in raw);
    if (partial && n < 0) continue;
    const dish = normalizeDish(partial ? { ...dishes[n], ...raw } : raw, n >= 0 ? dishes[n] : null);
    if (n >= 0) dishes[n] = dish; else dishes.push(dish);
    saved.push(dish);
  }
  const rows = [];
  let dropped = 0;
  for (const p of obj.plan || []) {
    if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(p.day || '')) continue;
    const old = planOf(p.day);
    // Nur eine Notiz für den Vorabend: Gericht und Brotbox des Tages bleiben, wie sie sind.
    if (!('dish' in p) && !('lunchbox' in p) && 'prep' in p) {
      if (old) rows.push({ ...old, prep: String(p.prep || '') });
      continue;
    }
    // Ohne "dish" bleibt das Gericht, das an dem Tag schon steht.
    const dish = 'dish' in p ? dishes.find((d) => d.id === p.dish || sameName(d.name, p.dish)) : (old ? dishes.find((d) => d.id === old.dish_id) : null);
    if (holidayOf(p.day) && !p.dish) continue;
    const lunch = p.lunchbox && L.isSchoolDay(p.day) && !holidayOf(p.day) ? String(p.lunchbox) : '';
    if (p.lunchbox && !lunch) dropped += 1;
    rows.push({ day: p.day, dish_id: dish ? dish.id : null, lunchbox: lunch, skipped: false, prep: 'prep' in p ? String(p.prep || '') : (old ? old.prep || '' : '') });
  }
  if (!saved.length && !rows.length) throw new Error('In dem Text stehen weder Gerichte noch Tage.');
  const week = /^\d{4}-\d{2}-\d{2}$/.test(obj.week_start || '') ? L.mondayOf(obj.week_start) : (rows[0] ? L.mondayOf(rows[0].day) : state.week);
  // Gleiche Posten (Zwiebel und Zwiebeln, Stk. und Stück) auf derselben Tour stehen nur einmal auf der Liste.
  const items = L.mergeList((obj.shopping || []).filter((s) => s && s.label).map((s, n) => ({
    id: L.uid(), week_start: week, trip: s.trip ? String(s.trip) : 'Einkauf',
    due: /^\d{4}-\d{2}-\d{2}$/.test(String(s.due || '')) ? String(s.due) : null,
    category: L.SHOP_CATS[s.category] ? s.category : 'sonst', label: String(s.label), qty: s.qty ? String(s.qty) : '',
    purpose: s.purpose ? String(s.purpose) : '', missing: false, shop: s.shop === 'lidl' ? 'lidl' : null,
    sort: n, checked: false, checked_by: null, checked_at: null, manual: false,
  })));
  return { dishes, saved, rows, week, items, dropped };
}

/* ---------- Vorschau vor dem Übernehmen ---------- */

// Was eine Übernahme ändern würde. "warn" markiert, was verloren gehen kann.
function importDiff({ dishes, saved, rows, week, items }, opts = {}) {
  const dayLabel = (d) => `${L.WD_SHORT[L.wdIndex(d)]} ${L.fmtShort(d)}`;
  const nameOf = (list, id) => { const d = list.find((x) => x.id === id); return d ? L.shortDish(d.name) : ''; };
  const days = [];
  for (const r of rows) {
    const old = planOf(r.day);
    const before = old && old.dish_id ? nameOf(state.data.dishes, old.dish_id) : '';
    const after = r.dish_id ? nameOf(dishes, r.dish_id) : '';
    const rated = state.data.ratings.filter((x) => x.day === r.day).length;
    if (before === after && (old ? old.dish_id : null) === r.dish_id) {
      if (old && (old.lunchbox || '') !== (r.lunchbox || '')) days.push({ text: `${dayLabel(r.day)}: neue Brotbox` });
      continue;
    }
    if (!before) days.push({ text: `${dayLabel(r.day)}: ${after || 'bleibt leer'}` });
    else if (!after) days.push({ text: `${dayLabel(r.day)}: ${before} wird entfernt, der Tag ist danach leer`, warn: true });
    else if (opts.restoreRatings) days.push({ text: `${dayLabel(r.day)}: ${after} statt ${before}${rated ? ', die Bewertungen des Tages kommen aus der Sicherung' : ''}` });
    else days.push({ text: `${dayLabel(r.day)}: ${after} statt ${before}${rated ? `, ${rated} ${rated === 1 ? 'Bewertung geht' : 'Bewertungen gehen'} verloren` : ''}`, warn: !!rated });
  }
  const recipes = saved.map((d) => {
    const old = state.data.dishes.find((x) => x.id === d.id);
    if (!old) return { text: `Neu: ${d.name}` };
    const ni = (d.ingredients || []).length; const oi = (old.ingredients || []).length;
    const ns = (d.steps || []).length; const os = (old.steps || []).length;
    const lost = (oi && ni < oi / 2) || (os && ns < os / 2);
    const parts = [];
    if (d.name !== old.name) parts.push(`neuer Name „${d.name}“`);
    if (ni !== oi) parts.push(`${ni} statt ${oi} Zutaten`);
    if (ns !== os) parts.push(`${ns} statt ${os} Schritte`);
    if (!parts.length && JSON.stringify(d) !== JSON.stringify(old)) parts.push('Angaben geändert');
    if (!parts.length) return null;
    return { text: `Geändert: ${old.name} (${parts.join(', ')})`, warn: lost };
  }).filter(Boolean);
  const shop = [];
  if (items.length) {
    const old = state.data.shopping.filter((i) => i.week_start === week && !i.manual);
    const done = old.filter((i) => i.checked).length;
    shop.push({ text: old.length ? `Die Einkaufsliste der KW ${L.isoWeek(week)} wird ersetzt: ${items.length} Posten statt ${old.length}. Selbst eingetragene Posten bleiben.` : `Neue Einkaufsliste für KW ${L.isoWeek(week)} mit ${items.length} Posten.`, warn: done > 0 });
    if (done) shop.push({ text: `${done === 1 ? 'Ein schon abgehakter Posten verschwindet' : `${done} schon abgehakte Posten verschwinden`} dabei.`, warn: true });
  } else if (rows.length && !state.data.shopping.some((i) => i.week_start === week)) {
    shop.push({ text: `Die Einkaufsliste für KW ${L.isoWeek(week)} wird aus dem Plan erstellt.` });
  }
  if (opts.rebuild) {
    const old = state.data.shopping.filter((i) => i.week_start === week && !i.manual);
    const done = old.filter((i) => i.checked).length;
    shop.push({ text: `Weil Tage getauscht wurden, wird die Einkaufsliste der KW ${L.isoWeek(week)} aus dem Plan neu berechnet. Selbst eingetragene Posten bleiben.${done ? ` ${done === 1 ? 'Ein abgehakter Posten verschwindet' : `${done} abgehakte Posten verschwinden`} dabei.` : ''}`, warn: done > 0 });
  }
  return { days, recipes, shop, warn: [...days, ...recipes, ...shop].some((x) => x.warn) };
}

function previewImport(result, title, apply, opts = {}) {
  state.preview = { result, title, apply, back: state.sheet, diff: importDiff(result, opts) };
  openSheet({ type: 'vorschau' });
}

function sheetPreview() {
  const pv = state.preview;
  if (!pv) return { over: '', title: 'Nichts zu übernehmen', body: '' };
  const { days, recipes, shop, warn } = pv.diff;
  const list = (title, xs) => (xs.length ? `<h3 class="abteilung">${title}</h3><ul class="vorschau">${xs.map((x) => `<li${x.warn ? ' class="warn"' : ''}>${esc(x.text)}</li>`).join('')}</ul>` : '');
  const none = !days.length && !recipes.length && !shop.length;
  return {
    over: pv.title,
    title: 'Das ändert sich',
    body: `${warn ? '<p class="kasten-text kasten-warn">Rot markiert ist, was dabei verloren geht. Bitte kurz prüfen.</p>' : ''}
      ${none ? '<p class="meta">Am Plan ändert sich nichts.</p>' : ''}
      ${list('Wochenplan', days)}${list('Rezepte', recipes)}${list('Einkaufsliste', shop)}
      <div class="knopfreihe"><button class="knopf" data-action="vorschau-ok">Übernehmen</button><button class="knopf zweit" data-action="vorschau-zurueck">Zurück</button></div>`,
  };
}

function applyImport({ dishes, saved, rows, week, items }) {
  const days = rows.map((r) => r.day);
  const changed = rows.filter((r) => { const p = planOf(r.day); return p && p.dish_id !== r.dish_id; }).map((r) => r.day);
  const oldItems = items.length ? state.data.shopping.filter((i) => i.week_start === week && !i.manual) : [];
  // Selbst eingetragene Posten ohne Einkaufstag (zum Beispiel aus der Vorwoche übernommen) kommen auf die erste Tour der neuen Liste.
  const firstTrip = items.length ? [...items].sort((a, b) => a.sort - b.sort)[0] : null;
  const tripNames = new Set(items.map((i) => i.trip || 'Einkauf'));
  const adopted = firstTrip ? state.data.shopping.filter((i) => i.week_start === week && i.manual && !i.checked && !i.due && !tripNames.has(i.trip || 'Einkauf'))
    .map((i) => ({ ...i, trip: firstTrip.trip, due: firstTrip.due || null })) : [];
  state.week = week;
  state.tab = 'woche';
  commit(() => {
    state.data.dishes = dishes.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    state.data.plan = [...state.data.plan.filter((p) => !days.includes(p.day)), ...rows].sort(byDay);
    state.data.ratings = state.data.ratings.filter((r) => !changed.includes(r.day));
    if (items.length) state.data.shopping = [...state.data.shopping.filter((i) => !oldItems.includes(i)).map((i) => adopted.find((x) => x.id === i.id) || i), ...items];
  }, async () => {
    for (const d of saved) await store.saveDish(d);
    for (const day of changed) await store.deleteRatingsForDay(day);
    await store.savePlan(rows);
    if (items.length) {
      await store.deleteItems(oldItems.map((i) => i.id));
      await store.saveItems([...items, ...adopted]);
    }
  });
  if (!items.length && rows.length && !state.data.shopping.some((i) => i.week_start === week)) rebuildShopping(true);
  else if (items.length) pantryNote(week);
}

// Claudes Einkaufsliste für einen Entwurf, in dem Tage getauscht wurden: Posten nur für die getauschten Gerichte fallen weg,
// die Zutaten der neuen Gerichte kommen dazu. Brotbox, Angebote, Lidl und die Touren bleiben, wie Claude sie geplant hat.
function draftShopping(d, plan, week) {
  const swapped = new Map();
  plan.forEach((p, n) => { if (p.dish !== d.plan[n].dish) swapped.set(p.day, d.plan[n].dish); });
  const oldUses = new Set([...swapped].filter(([, name]) => name).map(([day, name]) => `${L.shortDish(name)} (${L.WEEKDAYS_SHORT[L.wdIndex(day)]})`.toLowerCase()));
  const list = [];
  for (const s of d.shopping || []) {
    const uses = L.usesOf(s.purpose);
    const left = uses.filter((u) => !oldUses.has(u.toLowerCase()));
    if (uses.length && !left.length) continue;
    list.push(left.length === uses.length ? s : { ...s, purpose: left.join(', ') });
  }
  const dishes = [...state.data.dishes, ...(d.dishes || []).filter((g) => !state.data.dishes.some((x) => x.name.toLowerCase() === String(g.name).toLowerCase())).map((g) => normalizeDish(g, null))];
  const rows = plan.filter((p) => swapped.has(p.day) && p.dish).map((p) => {
    const dish = dishes.find((x) => x.name.toLowerCase() === String(p.dish).toLowerCase());
    return dish ? { day: p.day, dish_id: dish.id, skipped: false } : null;
  }).filter(Boolean);
  if (!rows.length) return list;
  const factors = T.portionFactors(state.data.persons, state.data.events, state.data.attendance, L.weekDays(week), state.data.plan);
  const own = L.tripsOf(list);
  const trips = own.length > 1 ? own : KI.shopTrips(week);
  for (const it of L.buildShopping(week, rows, dishes, factors, state.data.pantry, packsAll())) {
    if (it.category === 'vorhanden') continue;
    const t = L.tripFor(it, trips, week);
    list.push({ label: it.label, qty: it.qty, category: it.category, trip: t.trip, due: t.due, purpose: it.purpose, shop: '' });
  }
  return list;
}

function acceptDraft(run, d, obj, result, changed, wish) {
    // Getauschte Tage passt draftShopping in Claudes Liste ein. Nur wenn davon nichts übrig bleibt, rechnet die App aus den Rezepten.
    // Ohne Liste macht das applyImport von selbst.
    const hadList = state.data.shopping.some((i) => i.week_start === obj.week_start && !i.manual);
    applyImport(result);
    if (changed && hadList && !result.items.length) rebuildShopping(true);
    // Wunschessen: Wessen Wunsch Claude eingebaut hat, gilt als erfüllt, die anderen Wünsche der Woche als „diesmal nicht“.
    const wk = obj.week_start;
    if (wishesAll().some((w) => w.week === wk)) {
      const kid = String(d.wunsch || '').trim().toLowerCase();
      saveWishes(wishesAll().map((w) => {
        if (w.week !== wk) return w;
        const p = personById(w.person_id);
        const hit = (kid && p && p.name.toLowerCase() === kid) || wishPlanned(w);
        return { ...w, status: hit ? 'erfuellt' : 'nicht' };
      }));
    }
    // Reste, die beim Start des Entwurfs schon eingetragen waren, hat Claude eingeplant.
    const usedRest = leftovers().filter((x) => x.created_at && x.created_at < run.created_at);
    if (usedRest.length) saveLeftovers(leftovers().filter((x) => !usedRest.includes(x)));
    const next = { ...run, status: 'freigegeben', decided_at: new Date().toISOString(), decided_by: state.me };
    const rows = wish ? [{ key: 'wunsch', value: wish, updated_at: new Date().toISOString() }] : [];
    commit(() => {
      state.data.aiRuns = state.data.aiRuns.map((x) => (x.id === run.id ? next : x));
      if (rows.length) state.data.settings = [...state.data.settings.filter((x) => x.key !== 'wunsch'), ...rows];
    }, async () => { await store.saveRun(next); if (rows.length) await store.saveSettings(rows); });
    closeSheet();
    toast(`Plan für KW ${L.isoWeek(obj.week_start)} freigegeben${result.saved.length ? `, ${result.saved.length} neue ${result.saved.length === 1 ? 'Gericht' : 'Gerichte'} gespeichert` : ''}.`);
  
}

const actions = {
  tab: ({ tab }) => {
    if (state.shopMode && tab !== 'einkauf') { state.shopMode = false; document.documentElement.classList.remove('einkaufsmodus'); keepAwake(false); }
    state.tab = tab; render();
  },
  woche: ({ dir }) => { state.week = L.addDays(state.week, 7 * Number(dir)); render(); },
  'woche-heute': () => { state.week = L.mondayOf(L.todayISO()); render(); },
  tag: ({ day }) => openSheet({ type: 'tag', day }),
  gericht: ({ id }) => openSheet({ type: 'gericht', id }),
  tauschen: ({ day }) => openSheet({ type: 'tauschen', day }),
  'tag-tausch': ({ day }) => openSheet({ type: 'tag-tausch', day }),
  hilfe: () => openSheet({ type: 'hilfe' }),
  packung: ({ id }) => { state.packDraft = null; openSheet({ type: 'packung', id }); },
  packungen: () => openSheet({ type: 'packungen' }),
  'packung-weg': ({ key }) => { const all = { ...packsAll() }; delete all[key]; savePacks(all); renderSheet(); },
  'kinder-sperre': (_, el) => {
    const row = { key: 'geraete', value: { ...(KI.settingOf(state.data.settings, 'geraete') || {}), kinder_sperre: !!el.checked }, updated_at: new Date().toISOString() };
    commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'geraete'), row]; }, () => store.saveSettings([row]));
    toast(el.checked ? 'Kinder wechseln jetzt nur noch mit PIN.' : 'Kinder können wieder frei wechseln.');
  },
  'notiz-weg': ({ dish, id }) => { saveRecipeNotes(dish, recipeNotes(dish).filter((n) => n.id !== id)); renderSheet(); },
  info: ({ key }) => { state.info = { ...(state.info || {}), [key]: !infoOpen(key) }; render(); },
  'vorschau-ok': () => {
    const pv = state.preview;
    state.preview = null;
    if (!pv) return;
    closeSheet();
    pv.apply();
  },
  'vorschau-zurueck': () => {
    const pv = state.preview;
    state.preview = null;
    if (pv && pv.back) openSheet(pv.back); else closeSheet();
  },
  mittag: () => openSheet({ type: 'mittag' }),
  'mittag-kochen': ({ n }) => {
    const v = (state.lunchResult || [])[Number(n)];
    if (!v) return;
    const id = `mittag-${n}`;
    state.tempDishes = { ...(state.tempDishes || {}), [id]: { id, name: v.name, category: 'mittag', lunchFor: Number((state.lunchForm || {}).personen) || 1,
      ingredients: v.zutaten.map((z) => ({ q: null, u: '', n: [z.menge, z.name].filter(Boolean).join(' '), c: 'basis' })), steps: v.schritte } };
    state.cookStep = 0;
    state.cookChecked = [];
    openSheet({ type: 'kochen', id });
    keepAwake(true);
  },
  'mittag-reste': ({ n }) => {
    const v = (state.lunchResult || [])[Number(n)];
    if (!v) return;
    saveLeftovers(leftovers().filter((x) => !v.reste.includes(x.text)));
    v.reste = [];
    renderSheet();
    toast('Abgehakt.');
  },
  'kosten-schaetzen': async () => {
    if (state.costBusy) return;
    state.costBusy = true;
    render();
    try {
      const value = await store.estimateCosts();
      const row = { key: 'kosten', value, updated_at: new Date().toISOString() };
      state.data.settings = [...state.data.settings.filter((x) => x.key !== 'kosten'), row];
      if (store.mode === 'local') await store.saveSettings([row]);
      toast(`Kosten für ${Object.keys(value.gerichte || {}).length} Gerichte geschätzt.`);
    } catch (e) { toast(`Hat nicht geklappt: ${e.message}`); }
    state.costBusy = false;
    render();
  },
  einkaufsmodus: () => {
    state.shopMode = !state.shopMode;
    document.documentElement.classList.toggle('einkaufsmodus', state.shopMode);
    keepAwake(state.shopMode || (state.sheet && state.sheet.type === 'kochen'));
    render();
    window.scrollTo(0, 0);
  },
  'app-wuensche': () => openSheet({ type: 'app-wuensche' }),
  'neu-zeigen': () => openSheet({ type: 'neu' }),
  'app-wunsch-erledigt': ({ id }) => { saveAppWishes(appWishes().map((w) => (w.id === id ? { ...w, done: !w.done } : w))); renderSheet(); },
  'app-wunsch-weg': ({ id }) => {
    const w = appWishes().find((x) => x.id === id);
    if (!w || !(canPlan() || w.person_id === state.me)) return;
    saveAppWishes(appWishes().filter((x) => x.id !== id));
    renderSheet();
  },
  moegen: ({ year }) => openSheet({ type: 'moegen', year: Number(year) || Number(L.todayISO().slice(0, 4)) }),
  feste: () => { state.feastEdit = null; openSheet({ type: 'feste' }); },
  fest: ({ id }) => { state.feastEdit = null; openSheet({ type: 'fest', id }); },
  'fest-bearbeiten': ({ id }) => { state.feastEdit = id; renderSheet(); },
  'fest-wieder': ({ id }) => {
    const f = feastList().find((x) => x.id === id);
    if (!f || !f.plan) return;
    const next = { ...f, id: L.uid(), datum: nextFeastDate(f.datum), vorlage: f.id, listed: false };
    saveFeasts([...feastList(), next]);
    toast(`${f.anlass} am ${L.fmtShort(next.datum)} angelegt, mit dem Plan vom letzten Mal.`);
    openSheet({ type: 'fest', id: next.id });
  },
  'fest-loeschen': async ({ id }) => {
    const f = feastList().find((x) => x.id === id);
    if (!f || !(await ask(`${f.anlass} am ${L.fmtShort(f.datum)} löschen? Einkaufsliste und Wochenplan bleiben, wie sie sind.`, 'Löschen'))) { openSheet({ type: 'fest', id }); return; }
    saveFeasts(feastList().filter((x) => x.id !== id));
    openSheet({ type: 'feste' });
  },
  'fest-liste': async ({ id }) => {
    const f = feastList().find((x) => x.id === id);
    if (!f || !f.plan) return;
    if (f.listed && !(await ask('Die Posten stehen schon auf der Einkaufsliste. Noch einmal dazuschreiben?', 'Dazuschreiben'))) { openSheet({ type: 'fest', id }); return; }
    const now = nowStamp();
    const trips = {
      // Fällt ein Festeinkauf auf einen Sonn- oder Feiertag, rückt er auf den letzten offenen Tag davor.
      vorher: { due: KI.shopDayBack(L.addDays(f.datum, -3), true), name: `Festeinkauf haltbar bis ${L.fmtShort(KI.shopDayBack(L.addDays(f.datum, -3), true))}` },
      frisch: { due: KI.shopDayBack(L.addDays(f.datum, -1)), name: `Festeinkauf frisch am ${L.fmtShort(KI.shopDayBack(L.addDays(f.datum, -1)))}${KI.shortDay(KI.shopDayBack(L.addDays(f.datum, -1))) ? ', Markt schließt mittags' : ''}` },
    };
    const rows = (f.plan.einkauf || []).map((e, n) => {
      const t = trips[e.wann === 'frisch' ? 'frisch' : 'vorher'];
      return {
        id: L.uid(), week_start: L.mondayOf(t.due), trip: t.name, due: t.due, category: L.SHOP_CATS[e.abteilung] ? e.abteilung : 'sonst',
        label: e.name, qty: e.menge || '', sort: 900 + n, checked: false, checked_by: null, checked_at: null, manual: true,
        purpose: `${f.anlass}: ${e.wofuer || f.plan.titel}`, missing: false, added_by: state.me, created_at: now,
      };
    });
    const next = { ...f, listed: true };
    commit(() => {
      state.data.shopping = [...state.data.shopping, ...rows];
      state.data.settings = [...state.data.settings.filter((x) => x.key !== 'feste'), { key: 'feste', value: [...feastList().filter((x) => x.id !== id), next], updated_at: now }];
    }, async () => { await store.saveItems(rows); await store.saveSettings([{ key: 'feste', value: [...feastList().filter((x) => x.id !== id), next], updated_at: now }]); });
    openSheet({ type: 'fest', id });
    toast(`${rows.length} Posten auf die Einkaufsliste gesetzt, verteilt auf zwei Festeinkäufe.`);
  },
  'fest-plan': async ({ id }) => {
    const f = feastList().find((x) => x.id === id);
    if (!f || !f.plan) return;
    const p = planOf(f.datum);
    const other = p && p.dish_id && p.dish_id !== f.dish_id ? dishById(p.dish_id) : null;
    if (other && !(await ask(`Am ${L.fmtShort(f.datum)} steht schon „${other.name}“. Durch das Festessen ersetzen?`, 'Ersetzen'))) { openSheet({ type: 'fest', id }); return; }
    // Rezepte gelten für 4 Personen, die übrigen zählen als Gäste. So stimmen die Mengen im Tagesfenster und im Kochmodus.
    const total = Math.max(1, feastPeople(f));
    const k = 4 / total;
    const conv = (x) => { const o = Array.isArray(x) ? { q: x[0], u: x[1], n: x[2], c: x[3] } : x; return o.q == null ? [null, '', o.n, 'basis'] : [L.scaleQty(o.q, o.u, k), o.u, o.n, o.c]; };
    const parts = [...(f.plan.gerichte || []).map((g) => ({ name: g.name, zutaten: g.zutaten, steps: g.schritte || [] })), ...(f.plan.dips || []).map((d) => ({ name: d.name, zutaten: d.zutaten, steps: [d.zubereitung] }))];
    const old = f.dish_id ? dishById(f.dish_id) : null;
    const dish = normalizeDish({
      name: old ? old.name : (state.data.dishes.some((d) => d.name === f.plan.titel) ? `${f.plan.titel} ${f.datum.slice(0, 4)}` : f.plan.titel),
      category: 'gemischt', duration_min: 120, tags: ['Festtag'],
      note: [`Festessen für ${total} Personen. Die Einkaufsliste dazu kommt aus „Festtage planen“.`, ...(f.plan.mengen || []).map((m) => `${m.was}: ${m.gesamt}`)].join(' '),
      ingredients: parts.flatMap((x) => (x.zutaten || []).map(conv)),
      steps: parts.flatMap((x) => x.steps.filter(Boolean).map((st) => `${x.name}: ${st}`)),
      pause_until: L.addDays(f.datum, 330),
    }, old);
    const row = { ...(p || { day: f.datum, lunchbox: '', skipped: false }), day: f.datum, dish_id: dish.id, guests: Math.max(0, total - 4), skipped: false };
    const next = { ...f, dish_id: dish.id };
    const feastsRow = { key: 'feste', value: [...feastList().filter((x) => x.id !== id), next], updated_at: nowStamp() };
    commit(() => {
      state.data.dishes = [...state.data.dishes.filter((d) => d.id !== dish.id), dish].sort((a, b) => a.name.localeCompare(b.name, 'de'));
      state.data.plan = [...state.data.plan.filter((x) => x.day !== f.datum), row].sort(byDay);
      state.data.settings = [...state.data.settings.filter((x) => x.key !== 'feste'), feastsRow];
    }, async () => { await store.saveDish(dish); await store.savePlan([row]); await store.saveSettings([feastsRow]); });
    openSheet({ type: 'fest', id });
    toast(`Steht am ${L.fmtShort(f.datum)} im Wochenplan, mit Kochmodus und allen Dips.`);
  },
  'laufweg-oeffnen': () => openSheet({ type: 'laufweg' }),
  reste: () => openSheet({ type: 'reste' }),
  'rest-weg': ({ id }) => { saveLeftovers(leftovers().filter((x) => x.id !== id)); renderSheet(); },
  laufweg: ({ shop, cat, dir }) => {
    const key = shop === 'lidl' ? 'lidl' : 'aldi';
    const list = catOrder(key === 'lidl' ? 'lidl' : '').filter((c) => c !== 'vorhanden');
    const i = list.indexOf(cat);
    const j = i + Number(dir);
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const cur = KI.settingOf(state.data.settings, 'laufweg') || {};
    const row = { key: 'laufweg', value: { ...cur, [key]: list }, updated_at: new Date().toISOString() };
    commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'laufweg'), row]; }, () => store.saveSettings([row]));
    renderSheet();
  },
  'laufweg-zurueck': () => {
    const row = { key: 'laufweg', value: {}, updated_at: new Date().toISOString() };
    commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'laufweg'), row]; }, () => store.saveSettings([row]));
    renderSheet();
  },
  kochmodus: ({ id, day }) => {
    state.cookStep = 0;
    state.cookChecked = [];
    openSheet({ type: 'kochen', id, ...(day ? { day } : {}) });
    keepAwake(true);
  },
  'koch-schritt': ({ dir }) => {
    state.cookStep = Math.max(0, (state.cookStep || 0) + Number(dir));
    renderSheet();
    const b = $('.bogen', $('#sheet-root'));
    if (b) b.scrollTop = 0;
  },
  'koch-zutat': ({ i }) => {
    const n = Number(i);
    state.cookChecked = state.cookChecked.includes(n) ? state.cookChecked.filter((x) => x !== n) : [...state.cookChecked, n];
  },
  timer: ({ sec, label }) => {
    state.timers.push({ id: L.uid(), label, end: Date.now() + Number(sec) * 1000, done: false });
    if (!timerTick) timerTick = setInterval(tickTimers, 1000);
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { /* ohne Ton */ }
    renderSheet();
  },
  'timer-weg': ({ id }) => {
    state.timers = state.timers.filter((t) => t.id !== id);
    renderSheet();
  },
  sicherungen: () => loadBackups(),
  'sicherung-jetzt': async () => {
    if (state.backupBusy) return;
    state.backupBusy = true;
    renderSheet();
    try {
      const res = await store.backupNow();
      toast(`Gesichert: ${Object.values(res.anzahl || {}).reduce((a, n) => a + n, 0)} Einträge.`);
      state.backupBusy = false;
      await loadBackups();
    } catch (e) { state.backupBusy = false; renderSheet(); toast(`Hat nicht geklappt: ${e.message}`); }
  },
  'sicherung-zurueck': ({ name }) => openRestore(name),
  'sicherung-laden': async ({ name }) => {
    try {
      const blob = await store.downloadBackup(name);
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name }).catch(() => {});
        return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { toast(e.message); }
  },
  'wunsch-aendern': () => { state.wishEdit = true; render(); const f = $('[data-form="wunsch"] input'); if (f) f.focus(); },
  'wunsch-weg': ({ id }) => {
    const w = wishesAll().find((x) => x.id === id);
    if (!w || !(canPlan() || w.person_id === state.me)) return;
    saveWishes(wishesAll().filter((x) => x.id !== id));
    state.wishEdit = false;
    toast('Wunsch gelöscht.');
  },
  monat: ({ dir }) => {
    const now = HB.monthOf(L.todayISO());
    const next = HB.addMonths(curMonth(), Number(dir) || 0);
    state.month = next > now ? now : next;
    render();
  },
  beleg: ({ id }) => {
    const r = state.data.receipts.find((x) => x.id === id);
    if (!r) return;
    state.receiptDraft = draftOf(r);
    openSheet({ type: 'beleg' });
  },
  'beleg-neu': () => {
    state.receiptDraft = { isNew: true, id: L.uid(), day: L.todayISO(), shop: 'Aldi Süd', total: null, note: '', items: [{ name: '', preis: 0, kategorie: 'Sonstiges' }], before: [{ kategorie: 'Sonstiges' }], matches: [] };
    openSheet({ type: 'beleg' });
  },
  'beleg-posten-neu': () => {
    readReceiptForm($('[data-form="beleg"]'));
    state.receiptDraft.items.push({ name: '', preis: 0, kategorie: 'Sonstiges' });
    state.receiptDraft.before.push({ kategorie: 'Sonstiges' });
    renderSheet();
    const last = $$('.beleg-zeile input[name^="p_name_"]').pop();
    if (last) last.focus();
  },
  'beleg-posten-weg': ({ n }) => {
    readReceiptForm($('[data-form="beleg"]'));
    const i = Number(n);
    state.receiptDraft.items.splice(i, 1);
    state.receiptDraft.before.splice(i, 1);
    renderSheet();
  },
  'beleg-loeschen': async ({ id }) => {
    if (!(await ask('Diesen Kassenzettel aus dem Haushaltsbuch löschen?', 'Löschen'))) { openSheet({ type: 'beleg' }); return; }
    commit(() => { state.data.receipts = state.data.receipts.filter((r) => r.id !== id); }, () => store.deleteReceipts([id]));
    state.receiptDraft = null;
    closeSheet();
    toast('Kassenzettel gelöscht.');
  },
  'haushalt-einstellungen': () => openSheet({ type: 'haushalt' }),
  preise: () => openSheet({ type: 'preise' }),
  jahr: ({ year }) => openSheet({ type: 'jahr', year: Number(year) || Number(L.todayISO().slice(0, 4)) }),
  siri: () => openSheet({ type: 'siri' }),
  'siri-schluessel': async () => {
    if (shortcutKey() && !(await ask('Neuen Schlüssel erzeugen? Die eingerichteten Kurzbefehle brauchen dann den neuen Schlüssel.', 'Neu erzeugen'))) { openSheet({ type: 'siri' }); return; }
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const key = [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 32);
    const row = { key: 'kurzbefehl', value: { schluessel: key }, updated_at: new Date().toISOString() };
    commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'kurzbefehl'), row]; }, () => store.saveSettings([row]));
    openSheet({ type: 'siri' });
  },
  kopieren: ({ ziel }) => {
    const f = $(`#${ziel}`);
    if (!f) return;
    const done = () => toast('Kopiert.');
    const fallback = () => { f.focus(); f.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } toast(ok ? 'Kopiert.' : 'Markiert. Bitte über das Menü kopieren.'); };
    try { navigator.clipboard.writeText(f.value).then(done, fallback); } catch (e) { fallback(); }
  },
  'haushalt-standard': () => { saveHousehold({ kategorien: HB.KATEGORIEN.slice() }); renderSheet(); toast('Kategorien zurückgesetzt.'); },
  'haushalt-vergessen': () => { saveHousehold({ merken: {} }); renderSheet(); },
  'tag-tausch-mit': ({ day, with: other }) => swapDays(day, other),
  waehlen: ({ day, id }) => setDish(day, id || null),
  stern: ({ day, n }) => rate(day, Number(n)),
  ausfall: ({ day }) => {
    const p = planOf(day);
    if (!p) return;
    const next = { ...p, skipped: !p.skipped };
    commit(() => { state.data.plan = state.data.plan.map((x) => (x === p ? next : x)); }, () => store.savePlan([next]));
  },
  'woche-fuellen': () => fillWeek(),
  'liste-bauen': () => rebuildShopping(false),
  haken: ({ id }) => {
    const item = state.data.shopping.find((i) => i.id === id);
    if (item && !item.checked) {
      // Kurz sichtbar lassen, damit der Haken zu sehen ist, dann erst ausblenden.
      haptic();
      clearTimeout(checkTimer);
      state.justChecked = id;
      checkTimer = setTimeout(() => { state.justChecked = null; render(); }, 650);
    }
    toggleItem(id);
  },
  fehlt: ({ id }) => {
    const item = state.data.shopping.find((i) => i.id === id);
    if (!item) return;
    const next = { ...item, missing: !item.missing };
    commit(() => { state.data.shopping = state.data.shopping.map((i) => (i === item ? next : i)); }, () => store.saveItems([next]));
  },
  ersatz: async ({ id }) => {
    const item = state.data.shopping.find((i) => i.id === id);
    if (!item) return;
    const days = itemDays(item);
    openSheet({ type: 'ersatz-laden' });
    try {
      const res = await store.suggestSubstitute({
        posten: item.label, menge: item.qty || '', markt: KI.SHOPS[KI.shopOf(item)],
        gerichte: days.map((x) => ({ name: x.dish.name, tag: L.WD_SHORT[L.wdIndex(x.day)], zutaten: (x.dish.ingredients || []).map((g) => L.fmtIngredient(g)) })),
      });
      state.substDraft = { itemId: id, days, res };
      openSheet({ type: 'ersatz', id });
    } catch (e) {
      closeSheet();
      toast(store.offline ? 'Ohne Internet gibt es keinen Vorschlag.' : `Hat nicht geklappt: ${e.message}`);
    }
  },
  'ersatz-nehmen': ({ n }) => {
    const d = state.substDraft;
    const item = d && state.data.shopping.find((i) => i.id === d.itemId);
    const v = d && d.res.vorschlaege[Number(n)];
    if (!item || !v) return;
    const box = $('#ersatz-notiz');
    const withNote = Number(n) === 0 && box && box.checked && d.res.rezept_hinweis;
    const next = { ...item, label: v.name, qty: [v.menge, `statt ${item.label}`].filter(Boolean).join(', '), missing: false };
    let notesRow = null;
    if (withNote) {
      const cut = L.addDays(L.todayISO(), -14);
      const notes = Object.fromEntries(Object.entries(dayNotes()).filter(([day]) => day >= cut));
      for (const x of d.days) notes[x.day] = [notes[x.day], `${v.name} statt ${item.label}: ${d.res.rezept_hinweis}`].filter(Boolean).join(' ');
      notesRow = { key: 'tagesnotizen', value: notes, updated_at: new Date().toISOString() };
    }
    commit(() => {
      state.data.shopping = state.data.shopping.map((i) => (i.id === item.id ? next : i));
      if (notesRow) state.data.settings = [...state.data.settings.filter((x) => x.key !== 'tagesnotizen'), notesRow];
    }, async () => { await store.saveItems([next]); if (notesRow) await store.saveSettings([notesRow]); });
    state.substDraft = null;
    closeSheet();
    toast(`${v.name} steht jetzt statt ${item.label} auf der Liste.`);
  },
  'fehlt-markt': ({ trip }) => {
    const miss = state.data.shopping.filter((i) => i.week_start === state.week && (i.trip || 'Einkauf') === trip && i.missing && !i.checked);
    if (!miss.length) return;
    const to = miss.every((i) => KI.shopOf(i) === 'lidl') ? '' : 'lidl';
    const day = L.fmtShort(L.todayISO());
    const moved = miss.filter((i) => KI.shopOf(i) !== to).map((i) => ({
      ...i, shop: to || null, missing: false, qty: [i.qty, `am ${day} bei ${KI.SHOPS[KI.shopOf(i)]} nicht bekommen`].filter(Boolean).join(', '),
    }));
    commit(() => { state.data.shopping = state.data.shopping.map((i) => moved.find((m) => m.id === i.id) || i); }, () => store.saveItems(moved));
    toast(`${moved.length === 1 ? '1 Posten steht' : `${moved.length} Posten stehen`} jetzt bei ${KI.SHOPS[to]}.`);
  },
  'fehlt-verschieben': ({ trip }) => {
    const inWeek = state.data.shopping.filter((i) => i.week_start === state.week);
    const trips = [...new Set(inWeek.sort((a, b) => a.sort - b.sort).map((i) => i.trip || 'Einkauf'))];
    const target = nextTrip(trip, trips);
    const sample = inWeek.find((i) => (i.trip || 'Einkauf') === target);
    const maxSort = inWeek.reduce((m, i) => Math.max(m, i.sort || 0), 0);
    const day = L.fmtShort(L.todayISO());
    const moved = inWeek.filter((i) => (i.trip || 'Einkauf') === trip && i.missing && !i.checked).map((i, n) => ({
      ...i, trip: target, missing: false, due: sample ? sample.due || null : null, buyer: sample ? sample.buyer || null : null,
      // Ohne Zieltour entsteht „Nachkauf“ am Ende der Liste.
      sort: sample ? i.sort : maxSort + 1 + n,
      qty: [i.qty, `am ${day} nicht bekommen`].filter(Boolean).join(', '),
    }));
    if (!moved.length) return;
    commit(() => { state.data.shopping = state.data.shopping.map((i) => moved.find((m) => m.id === i.id) || i); }, () => store.saveItems(moved));
    toast(`${moved.length === 1 ? '1 Posten steht' : `${moved.length} Posten stehen`} jetzt bei „${target}“.`);
  },
  'posten-weg': ({ id }) => {
    commit(() => { state.data.shopping = state.data.shopping.filter((i) => i.id !== id); }, () => store.deleteItems([id]));
  },
  erledigte: (_, el) => { state.hideDone = el.checked; render(); },
  'erledigte-loeschen': async () => {
    const gone = state.data.shopping.filter((i) => i.week_start === state.week && i.checked);
    if (!gone.length || !(await ask(`${gone.length} erledigte Einträge werden endgültig von der Liste gelöscht.`, 'Löschen'))) return;
    commit(() => { state.data.shopping = state.data.shopping.filter((i) => !gone.includes(i)); }, () => store.deleteItems(gone.map((i) => i.id)));
  },
  sortieren: ({ sort }) => { state.sort = sort; render(); },
  'gericht-neu': () => openSheet({ type: 'gericht-form', id: '' }),
  'rezept-speichern': ({ edit }) => {
    const dish = recipeDraftDish();
    if (!dish) return;
    commit(() => {
      state.data.dishes = [...state.data.dishes, dish].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }, () => store.saveDish(dish));
    state.recipeDraft = null;
    state.stale = false;
    openSheet(edit ? { type: 'gericht-form', id: dish.id } : { type: 'gericht', id: dish.id });
    toast(`„${dish.name}“ ist in der Sammlung.`);
  },
  'rezept-verwerfen': () => { state.recipeDraft = null; closeSheet(); },
  export: () => openSheet({ type: 'export' }),
  'export-kopieren': () => {
    const text = exportText();
    const fallback = () => {
      const det = $('#export-details');
      if (det) det.open = true;
      const ta = $('#export-text');
      if (ta) { ta.focus(); ta.select(); }
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      toast(ok ? 'Kopiert. Jetzt im Chat mit Claude einfügen.' : 'Der Text ist markiert. Bitte über das Menü kopieren.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Kopiert. Jetzt im Chat mit Claude einfügen.'), fallback);
    } else fallback();
  },
  'export-datei': () => {
    const blob = new Blob([exportText()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `essensplan-auswertung-${L.todayISO()}.txt`;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  },
  'gericht-bearbeiten': ({ id }) => openSheet({ type: 'gericht-form', id }),
  aussortieren: ({ id }) => {
    const dish = dishById(id);
    const next = { ...dish, manual_archived: true };
    commit(() => { state.data.dishes = state.data.dishes.map((d) => (d === dish ? next : d)); }, () => store.saveDish(next));
    toast(`${dish.name} ist aussortiert.`);
  },
  aufnehmen: ({ id }) => {
    const dish = dishById(id);
    const next = { ...dish, manual_archived: false, rule_from: new Date().toISOString() };
    commit(() => { state.data.dishes = state.data.dishes.map((d) => (d === dish ? next : d)); }, () => store.saveDish(next));
    toast(`${dish.name} ist wieder im Umlauf.`);
  },
  import: () => openSheet({ type: 'import' }),
  familie: () => { state.backups = undefined; openSheet({ type: 'familie' }); },
  ich: ({ id }) => requirePin(id, () => {
    state.me = id;
    writeLocal(ME_KEY, id);
    state.phase = 'app';
    render();
    refreshPush(true);
    if (state.fresh) runPending();
    setTimeout(showNews, 600);
  }),
  'brotbox-stern': ({ day, n }) => rateLunch(day, Number(n)),
  termine: () => openSheet({ type: 'termine' }),
  'termin-neu': () => openSheet({ type: 'termin-form', id: '' }),
  'termin-bearbeiten': ({ id }) => openSheet({ type: 'termin-form', id }),
  'termin-loeschen': async ({ id }) => {
    const e = state.data.events.find((x) => x.id === id);
    if (!e || !canPlan()) return;
    if (!(await ask(`Der Termin „${e.title}“ wird gelöscht.`, 'Löschen'))) { openSheet({ type: 'termin-form', id }); return; }
    commit(() => { state.data.events = state.data.events.filter((x) => x.id !== id); }, () => store.deleteEvent(id));
    openSheet({ type: 'termine' });
  },
  vorrat: () => openSheet({ type: 'vorrat' }),
  'vorrat-start': () => {
    const rows = JSON.parse(JSON.stringify(SEED.pantry));
    commit(() => { state.data.pantry = rows; }, () => store.savePantry(rows));
    renderSheet();
  },
  'vorrat-da': ({ id }) => pantryConfirm([id]),
  'entwurf-ergaenzen': () => {
    const moved = splitApply(state.week);
    const added = draftAdd(state.week);
    toast([moved ? `${moved === 1 ? '1 frischer Posten liegt' : `${moved} frische Posten liegen`} jetzt auf dem Frischeeinkauf.` : '',
      added ? `${added === 1 ? '1 Posten steht' : `${added} Posten stehen`} wieder auf der Liste.` : ''].filter(Boolean).join(' '));
  },
  'entwurf-nicht': () => {
    try { const v = (localStorage.getItem(DRAFT_SEEN) || '').split(',').filter((w) => w && w >= L.addDays(L.mondayOf(L.todayISO()), -14)); localStorage.setItem(DRAFT_SEEN, [...v, state.week].join(',')); } catch (e) { /* egal */ }
    render();
  },
  'vorrat-alle-da': () => { const keys = pantryAsk(state.week).map((x) => x.key); pantryConfirm(keys); toast(keys.length === 1 ? 'Danke, ist vermerkt.' : `Danke, alle ${keys.length} sind vermerkt.`); },
  'vorrat-fehlt': ({ id }) => pantryMissing(id),
  'vorrat-ja': ({ id }) => {
    const x = state.data.pantry.find((v) => v.id === id);
    if (!x) return;
    const next = { ...x, have: true, seen_at: L.todayISO() };
    commit(() => { state.data.pantry = state.data.pantry.map((v) => (v.id === id ? next : v)); }, () => store.savePantry([next]));
    renderSheet();
    if (!state.sheet) render();
  },
  'vorrat-umschalten': ({ id }) => {
    const x = state.data.pantry.find((v) => v.id === id);
    if (!x) return;
    const next = { ...x, have: !x.have, ...(!x.have ? { seen_at: L.todayISO() } : {}) };
    const week = state.week;
    const onList = state.data.shopping.some((i) => i.week_start === week && !i.checked && i.label.toLowerCase() === x.label.toLowerCase());
    const add = !next.have && !onList ? [{
      id: L.uid(), week_start: week, trip: (state.data.shopping.find((i) => i.week_start === week) || {}).trip || 'Einkauf',
      category: 'vorrat', label: x.label, qty: 'aus dem Vorrat', sort: 999, checked: false, checked_by: null, checked_at: null, manual: true, added_by: state.me, created_at: nowStamp(),
    }] : [];
    commit(() => {
      state.data.pantry = state.data.pantry.map((v) => (v.id === id ? next : v));
      state.data.shopping = [...state.data.shopping, ...add];
    }, async () => { await store.savePantry([next]); await store.saveItems(add); });
    renderSheet();
    if (add.length) toast(`${x.label} steht jetzt auf der Einkaufsliste.`);
  },
  immer: () => openSheet({ type: 'immer' }),
  urlaub: () => openSheet({ type: 'urlaub' }),
  'urlaub-weg': ({ id }) => {
    const list = KI.holidays(state.data.settings).filter((u) => u.id !== id);
    const row = { key: 'urlaub', value: list, updated_at: new Date().toISOString() };
    commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'urlaub'), row]; }, () => store.saveSettings([row]));
    renderSheet();
  },
  'planer-regeln': () => openSheet({ type: 'regeln' }),
  'planer-start': ({ week }) => startDraft(/^\d{4}-\d{2}-\d{2}$/.test(week || '') ? week : draftTarget(), ''),
  entwurf: ({ id }) => openSheet({ type: 'entwurf', id }),
  'entwurf-verwerfen': async ({ id }) => {
    const run = state.data.aiRuns.find((x) => x.id === id);
    if (!run) return;
    const next = { ...run, status: 'verworfen', decided_at: new Date().toISOString(), decided_by: state.me };
    commit(() => { state.data.aiRuns = state.data.aiRuns.map((x) => (x.id === id ? next : x)); }, () => store.saveRun(next));
    closeSheet();
    toast('Entwurf verworfen.');
  },
  'immer-start': () => {
    const rows = JSON.parse(JSON.stringify(SEED.staples));
    commit(() => { state.data.staples = rows; }, () => store.saveStaples(rows));
    renderSheet();
  },
  'immer-umschalten': ({ id }) => {
    const x = state.data.staples.find((v) => v.id === id);
    if (!x) return;
    const week = state.week;
    const on = stapleOnList(x, week);
    if (on) {
      // Nur herunternehmen, was über „Immer wieder“ oder von Hand dazugekommen ist. Posten aus Rezepten bleiben.
      if (!on.manual) { toast(`${x.label} steht wegen eines Rezepts auf der Liste und bleibt dort.`); return; }
      commit(() => { state.data.shopping = state.data.shopping.filter((i) => i.id !== on.id); }, () => store.deleteItems([on.id]));
      renderSheet();
      return;
    }
    const t = targetTrip(week);
    const maxSort = state.data.shopping.filter((i) => i.week_start === week).reduce((m, i) => Math.max(m, i.sort || 0), 0);
    const item = {
      id: L.uid(), week_start: week, trip: t.trip, due: t.due, buyer: t.buyer, category: x.category || 'sonst', label: x.label, qty: x.qty || '',
      sort: maxSort + 1, checked: false, checked_by: null, checked_at: null, manual: true, added_by: state.me, created_at: nowStamp(), staple_id: x.id, purpose: '', missing: false,
    };
    const next = { ...x, last_added: L.todayISO() };
    commit(() => {
      state.data.shopping = [...state.data.shopping, item];
      state.data.staples = state.data.staples.map((v) => (v.id === id ? next : v));
    }, async () => { await store.saveItems([item]); await store.saveStaples([next]); });
    renderSheet();
  },
  'immer-weg': ({ id }) => {
    commit(() => { state.data.staples = state.data.staples.filter((v) => v.id !== id); }, () => store.deleteStaples([id]));
    renderSheet();
  },
  'vorrat-weg': ({ id }) => {
    commit(() => { state.data.pantry = state.data.pantry.filter((v) => v.id !== id); }, () => store.deletePantry([id]));
    renderSheet();
  },
  'tonnen-ics': () => {
    const blob = new Blob([trashIcs()], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'muelltonnen.ics';
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  },
  aufgabe: ({ id }) => {
    const task = taskById(id);
    if (!task || !isKidMe()) return;
    const item = A.tasksFor(state.data.tasks, state.data.taskLog, state.me, L.todayISO()).fixed.find((f) => f.task.id === id);
    if (!item) return;
    if (item.done && item.done.status === 'offen') {
      commit(() => { state.data.taskLog = state.data.taskLog.filter((e) => e.id !== item.done.id); }, () => store.deleteLog([item.done.id]));
      return;
    }
    if (item.done && item.done.status === 'bestaetigt') {
      if (!task.minutes && !item.done.decided_by) commit(() => { state.data.taskLog = state.data.taskLog.filter((e) => e.id !== item.done.id); }, () => store.deleteLog([item.done.id]));
      else toast('Schon bestätigt.');
      return;
    }
    if (needsFoto(task)) { startFoto(task, item.label); return; }
    logTask(task, item.label);
  },
  extra: ({ id }) => {
    const task = taskById(id);
    if (!task || !isKidMe()) return;
    if (needsFoto(task)) { startFoto(task, task.name); return; }
    logTask(task, task.name);
  },
  'foto-melden': async () => {
    const sh = state.sheet;
    const d = state.fotoDraft;
    if (!sh || sh.type !== 'foto' || !d || d.for !== sh.key || state.fotoBusy) return;
    const task = taskById(sh.task);
    if (!task || !isKidMe()) return;
    const id = sh.id || L.uid();
    state.fotoBusy = true;
    renderSheet();
    try {
      await store.uploadFoto(id, d.data);
    } catch (err) {
      state.fotoBusy = false;
      renderSheet();
      toast(`Das Foto ließ sich nicht senden. ${err.message || ''} Bitte gleich noch einmal versuchen.`);
      return;
    }
    state.fotoBusy = false;
    state.fotoDraft = null;
    (state.fotoLinks = state.fotoLinks || {})[id] = { url: d.url, at: Date.now() };
    closeSheet();
    logTask(task, sh.label, id, { foto: true });
  },
  'foto-gross': ({ id }) => openSheet({ type: 'foto-gross', id }),
  rueckblick: () => openReview(),
  'rueckblick-woche': ({ wert }) => { const w = L.addDays((state.review || {}).week || reviewWeek(), Number(wert) || 0); if (w <= reviewWeek()) openReview(w); },
  'rueckblick-push': () => {
    const cur = KI.settingOf(state.data.settings, 'rueckblick') || {};
    const aus = Array.isArray(cur.aus) ? cur.aus : [];
    const row = { key: 'rueckblick', value: { ...cur, aus: aus.includes(state.me) ? aus.filter((x) => x !== state.me) : [...aus, state.me] }, updated_at: new Date().toISOString() };
    commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'rueckblick'), row]; }, () => store.saveSettings([row]));
    toast(row.value.aus.includes(state.me) ? 'Keine Nachricht mehr zum Wochenrückblick.' : 'Sonntags kommt eine Nachricht zum Wochenrückblick.');
  },
  'foto-ok': ({ id }) => { decide([id], 'bestaetigt'); closeSheet(); },
  'foto-nein': ({ id }) => { decide([id], 'abgelehnt'); closeSheet(); },
  'km-raus': ({ bin }) => {
    const task = A.kmTask(state.data.tasks);
    const x = A.kmView(kmValue(), state.data.taskLog).find((v) => v.bin === bin);
    if (!task || !x || !isKidMe()) return;
    if (!x.canReport) { toast(x.pending ? 'Ist schon gemeldet.' : 'Der Eimer ist grün, gerade nichts zu tun.'); return; }
    if (needsFoto(task)) { startFoto(task, `${task.name}: ${x.name}`, A.kmId(bin, L.uid())); return; }
    logTask(task, `${task.name}: ${x.name}`, A.kmId(bin, L.uid()));
  },
  'st-raus': () => {
    const task = A.stTask(state.data.tasks);
    const v = stNow();
    if (!task || !isKidMe()) return;
    if (!v.canReport) { toast(v.pending ? 'Ist schon gemeldet.' : 'Der Stall ist noch sauber, gerade nichts zu tun.'); return; }
    if (needsFoto(task)) { startFoto(task, task.name, A.stId(L.uid())); return; }
    logTask(task, task.name, A.stId(L.uid()));
  },
  'st-heute': () => {
    const v = stNow();
    if (v.pending) decide([v.pending.id], 'bestaetigt');
    else stSave({ last: L.todayISO(), by: state.me });
    toast('Stall ist sauber. Die Ampel steht auf Grün.');
  },
  'st-aus': () => { stSave({ on: false }); toast('Stall-Ampel ausgeschaltet. Die Aufgabe steht wieder in der Wochenliste.'); },
  shop: () => { state.shopPick = null; openSheet({ type: 'shop' }); },
  'shop-kaufen': ({ id }) => { state.shopPick = id; renderSheet(); },
  'shop-nein': () => { state.shopPick = null; renderSheet(); },
  'shop-ja': ({ id }) => {
    const item = shopNow().items.find((x) => x.id === id);
    const me = personById(state.me);
    if (!item || !me || !isKidMe()) return;
    const acc = A.account(state.data.taskLog, state.me, capOf(me), nowMs(), L.todayISO());
    if (acc.balance < item.cost) { toast(`Dafür fehlen noch ${item.cost - acc.balance} Minuten.`); state.shopPick = null; renderSheet(); return; }
    const now = nowStamp();
    const entry = { id: A.shopId(L.uid()), person_id: state.me, task_id: null, day: L.todayISO(), label: `Minuten-Shop: ${item.name}`, minutes: -item.cost, status: 'offen', created_at: now, decided_by: null, decided_at: null };
    commit(() => { state.data.taskLog = [...state.data.taskLog, entry]; }, () => store.saveLog([entry]));
    state.shopPick = null;
    closeSheet();
    toast(`Gekauft: ${item.name}. Mama oder Papa lösen es ein.`);
  },
  'shop-verwalten': () => openSheet({ type: 'shop-admin' }),
  'anzeige-an': () => {
    try { localStorage.setItem(DISPLAY_KEY, 'kueche'); } catch (e) { /* ohne Speicher gilt es bis zum Neuladen */ }
    display = 'kueche'; closeSheet(); state.phase = 'anzeige'; state.loadedAt = Date.now(); render();
  },
  'anzeige-aus': () => {
    try { localStorage.removeItem(DISPLAY_KEY); } catch (e) { /* egal */ }
    display = null; keepAwake(false); state.phase = personById(state.me) ? 'app' : 'wer'; render();
  },
  'sm-raus': () => {
    const task = A.smTask(state.data.tasks);
    const v = smNow();
    if (!task || !isKidMe()) return;
    if (!v.canReport) { toast(v.pending ? 'Ist schon gemeldet.' : v.stufe === 'gelb' ? 'Die Spülmaschine läuft noch.' : 'Gerade gibt es nichts auszuräumen.'); return; }
    if (needsFoto(task)) { startFoto(task, task.name, A.smId(L.uid())); return; }
    logTask(task, task.name, A.smId(L.uid()));
  },
  'sm-stufe': ({ stufe }) => {
    const cur = A.smState(smValue(), nowMs());
    if (!A.STUFEN.includes(stufe) || cur.stufe === stufe) return;
    smSave(stufe);
    if (stufe === 'rot') {
      const kids = smKids().map((id) => (personById(id) || {}).name).filter(Boolean);
      const n = new Date(nowMs());
      const m = n.getHours() * 60 + n.getMinutes();
      const when = m < KM_PUSH_VON ? 'um 7 Uhr' : m >= KM_PUSH_BIS ? 'morgen um 7 Uhr' : 'gleich';
      toast(`Spülmaschine fertig. ${kids.length ? kids.join(' und ') : 'Die Kinder'} ${kids.length === 1 ? 'bekommt' : 'bekommen'} ${when} eine Nachricht.`);
    } else if (stufe === 'gelb') toast('Läuft. Mit einer Endzeit springt die Ampel dann von selbst auf Rot.');
    else if (A.smPending(state.data.taskLog)) toast('Auf Grün. Die Meldung wartet noch oben auf deine Bestätigung.');
  },
  'sm-bis': ({ wert }) => {
    const min = Number(wert) || 0;
    if (min <= 0) return;
    const bis = new Date(nowMs() + min * 60000).toISOString();
    smSave('gelb', bis);
    toast(`Fertig um ${clockOf(bis)} Uhr. Dann springt die Ampel auf Rot.`);
  },
  'km-stufe': ({ bin, stufe }) => {
    const cur = A.kmState(kmValue());
    if (!cur[bin] || !A.STUFEN.includes(stufe) || cur[bin].stufe === stufe) return;
    kmSave({ [bin]: stufe });
    const name = (A.EIMER.find(([b]) => b === bin) || [])[1];
    if (stufe === 'rot') {
      const kids = kmKids().map((id) => (personById(id) || {}).name).filter(Boolean);
      const n = new Date(nowMs());
      const m = n.getHours() * 60 + n.getMinutes();
      const when = m < KM_PUSH_VON ? 'um 7 Uhr' : m >= KM_PUSH_BIS ? 'morgen um 7 Uhr' : 'gleich';
      toast(`${name} auf Rot. ${kids.length ? kids.join(' und ') : 'Die Kinder'} ${kids.length === 1 ? 'bekommt' : 'bekommen'} ${when} eine Nachricht.`);
    } else if (stufe === 'gruen' && A.kmPending(state.data.taskLog, bin)) {
      toast(`${name} auf Grün. Die Meldung wartet noch oben auf deine Bestätigung.`);
    }
  },
  'log-ok': ({ id }) => decide([id], 'bestaetigt'),
  'log-nein': ({ id }) => decide([id], 'abgelehnt'),
  'log-alle': () => decide(state.data.taskLog.filter((e) => e.status === 'offen' && !lockOf(e).length && !A.isShop(e)).map((e) => e.id), 'bestaetigt'),
  'grund-bestaetigen': () => {
    const row = { key: 'aufgaben', value: { ...(KI.settingOf(state.data.settings, 'aufgaben') || {}), grund_bestaetigen: !basicsConfirm() }, updated_at: new Date().toISOString() };
    commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'aufgaben'), row]; }, () => store.saveSettings([row]));
    renderSheet();
  },
  'grund-zuerst': () => {
    const row = { key: 'aufgaben', value: { ...(KI.settingOf(state.data.settings, 'aufgaben') || {}), grund_zuerst: !basicsFirst() }, updated_at: new Date().toISOString() };
    commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'aufgaben'), row]; }, () => store.saveSettings([row]));
    renderSheet();
  },
  einloesen: ({ id }) => openSheet({ type: 'einloesen', id }),
  'einloesen-wert': ({ n }) => { const f = $('#einloesen-min'); if (f) f.value = n; },
  'aufgaben-liste': () => openSheet({ type: 'aufgaben-liste' }),
  'aufgabe-neu': () => openSheet({ type: 'aufgabe-form', id: '' }),
  'aufgabe-bearbeiten': ({ id }) => openSheet({ type: 'aufgabe-form', id }),
  'aufgaben-start': () => {
    const tasks = JSON.parse(JSON.stringify(SEED_TASKS)).filter((t) => t.who.every((id) => personById(id)));
    const persons = state.data.persons.map((p) => {
      const s = SEED.persons.find((x) => x.id === p.id);
      return s && p.screen_base == null && s.screen_base != null ? { ...p, screen_base: s.screen_base, earn_cap: s.earn_cap } : p;
    });
    commit(() => { state.data.tasks = tasks; state.data.persons = persons; }, async () => { await store.savePersons(persons); await store.saveTasks(tasks); });
    toast(`${tasks.length} Aufgaben eingespielt. Unter „Aufgaben verwalten“ lassen sie sich anpassen.`);
  },
  herz: ({ week, id }) => {
    if (!canRateLunch() || !L.heartOpen(week)) return;
    const mine = myHeart(week);
    const others = state.data.hearts.filter((h) => h !== mine);
    if (mine && mine.dish_id === id) {
      commit(() => { state.data.hearts = others; }, () => store.deleteHeart(week, state.me));
      return;
    }
    const row = { week_start: week, person_id: state.me, dish_id: id, updated_at: new Date().toISOString() };
    commit(() => { state.data.hearts = [...others, row]; }, () => store.saveHeart(row));
    const d = dishById(id);
    toast(`Dein Herz geht an ${d ? d.name : 'dieses Gericht'}.`);
  },
  'pin-aendern': () => openSheet({ type: 'pin', id: state.me, mode: 'neu' }),
  'pin-zuruecksetzen': async ({ id }) => {
    const person = personById(id);
    if (!person || !canPlan()) return;
    if (!(await ask(`Die PIN von ${person.name} wird gelöscht. Beim nächsten Wechsel zu ${person.name} wird eine neue festgelegt.`, 'Zurücksetzen'))) { openSheet({ type: 'familie' }); return; }
    const next = { ...person, pin_hash: null };
    commit(() => { state.data.persons = state.data.persons.map((p) => (p.id === id ? next : p)); }, () => store.savePersons([next]));
    openSheet({ type: 'familie' });
    toast(`PIN von ${person.name} zurückgesetzt.`);
  },
  zu: () => closeSheet(),
  ja: () => answer(true),
  nein: () => answer(false),
  testdatum: (_, el) => {
    const v = el.dataset.wert === 'echt' ? '' : ($('#testdatum') || {}).value || '';
    if (v) { globalThis.ESSENSPLAN_HEUTE = v; writeLocal(TESTDAY_KEY, v); }
    else { delete globalThis.ESSENSPLAN_HEUTE; try { localStorage.removeItem(TESTDAY_KEY); } catch (e) { /* egal */ } }
    state.week = L.mondayOf(L.todayISO());
    closeSheet();
    toast(v ? `Die App tut jetzt so, als wäre ${L.fmtLong(v)}.` : 'Die App nutzt wieder das echte Datum.');
  },
  'neu-laden': () => location.reload(),
  einrichten: async () => {
    state.busy = true; state.error = ''; render();
    try {
      await store.seed();
      state.busy = false;
      await enter();
    } catch (e) {
      state.busy = false;
      state.error = `Das hat nicht geklappt: ${e.message}. Wurde supabase/schema.sql schon ausgeführt?`;
      render();
    }
  },
  'push-an': async (d, el) => {
    if (el) el.disabled = true;
    try {
      const sub = await Push.subscribe();
      await store.savePushSub({ ...sub, person_id: state.me });
      toast('Benachrichtigungen sind eingeschaltet.');
    } catch (e) { toast(e.message); }
    await refreshPush();
  },
  'push-aus': async () => {
    try {
      const ep = await Push.unsubscribe();
      if (ep) await store.deletePushSub(ep);
      toast('Benachrichtigungen sind ausgeschaltet.');
    } catch (e) { toast(e.message); }
    await refreshPush();
  },
  'morgen-ueberblick': () => {
    const me = personById(state.me);
    if (!me) return;
    const next = { ...me, notify_morning: me.notify_morning === false };
    commit(() => { state.data.persons = state.data.persons.map((p) => (p.id === me.id ? next : p)); }, () => store.savePersons([next]));
    toast(next.notify_morning ? 'Morgenüberblick ist eingeschaltet.' : 'Morgenüberblick ist ausgeschaltet.');
  },
  'liste-erinnerung': () => {
    const me = personById(state.me);
    if (!me) return;
    const next = { ...me, notify_list: me.notify_list === false };
    commit(() => { state.data.persons = state.data.persons.map((p) => (p.id === me.id ? next : p)); }, () => store.savePersons([next]));
    toast(next.notify_list ? 'Nachrichten zu neuen Einträgen sind eingeschaltet.' : 'Nachrichten zu neuen Einträgen sind ausgeschaltet.');
  },
  'bewerten-erinnerung': () => {
    const me = personById(state.me);
    if (!me) return;
    const next = { ...me, notify_rating: me.notify_rating === false };
    commit(() => { state.data.persons = state.data.persons.map((p) => (p.id === me.id ? next : p)); }, () => store.savePersons([next]));
    toast(next.notify_rating ? 'Erinnerung ans Bewerten ist eingeschaltet.' : 'Erinnerung ans Bewerten ist ausgeschaltet.');
  },
  'kochen-erinnerung': () => {
    const me = personById(state.me);
    if (!me || !isAdult(me)) return;
    const next = { ...me, notify_cook: me.notify_cook === false };
    commit(() => { state.data.persons = state.data.persons.map((p) => (p.id === me.id ? next : p)); }, () => store.savePersons([next]));
    toast(next.notify_cook ? 'Kocherinnerung ist eingeschaltet.' : 'Kocherinnerung ist ausgeschaltet.');
  },
  'einkauf-uebernehmen': (d, el) => {
    if (!canPlan()) return;
    const trip = d.trip || 'Einkauf';
    const current = state.data.shopping.find((i) => i.week_start === state.week && (i.trip || 'Einkauf') === trip && i.buyer);
    const take = !(current && current.buyer === state.me);
    setBuyer(state.week, trip, take ? state.me : null);
    toast(take ? 'Eingetragen: Du gehst einkaufen.' : 'Du bist ausgetragen.');
  },
  'zur-woche': (d) => { state.week = d.week; render(); window.scrollTo(0, 0); },
  'push-test': async (d, el) => {
    if (el) el.disabled = true;
    try {
      await store.testPush(state.push && state.push.endpoint);
      toast('Testnachricht ist unterwegs.');
    } catch (e) { toast(e.message); }
    if (el) el.disabled = false;
    await refreshPush();
  },
  abmelden: async () => {
    // Abgemeldete Geräte sollen keine Nachrichten mehr bekommen.
    try { const ep = await Push.unsubscribe(); if (ep) await store.deletePushSub(ep); } catch (e) { /* weiter abmelden */ }
    await store.signOut();
    state.sheet = null;
    renderSheet();
    state.phase = 'anmelden';
    state.error = '';
    render();
  },
  'demo-reset': async () => {
    if (!(await ask('Alle Demo-Daten auf diesem Gerät werden gelöscht, die App beginnt mit den Startdaten neu.', 'Zurücksetzen'))) return;
    try { localStorage.removeItem('essensplan.demo.v1'); localStorage.removeItem(ME_KEY); } catch (e) { /* nichts zu löschen */ }
    location.reload();
  },
};

const forms = {
  anmelden: async (fd) => {
    state.busy = true; state.error = ''; render();
    try {
      await store.signIn(String(fd.get('email')).trim(), String(fd.get('password')));
      state.busy = false;
      await enter();
    } catch (e) {
      state.busy = false;
      state.error = e.message;
      state.phase = 'anmelden';
      render();
    }
  },
  einkaufstag: (fd) => {
    const trip = String(fd.get('trip') || 'Einkauf');
    const raw = String(fd.get('due') || '');
    const due = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    const changed = state.data.shopping.filter((i) => i.week_start === state.week && (i.trip || 'Einkauf') === trip).map((i) => ({ ...i, due }));
    if (!changed.length) return;
    const warn = due && KI.shopClosed(due) ? ` Achtung: An dem Tag sind die Märkte zu (${KI.shopHoliday(due) || 'Sonntag'}).` : due && KI.shortDay(due) ? ' An dem Tag schließen die Märkte mittags.' : '';
    commit(() => {
      state.data.shopping = state.data.shopping.map((i) => changed.find((c) => c.id === i.id) || i);
    }, () => store.saveItems(changed));
    toast(due ? `Einkaufstag gespeichert: ${L.fmtShort(due)}.${warn}` : 'Einkaufstag entfernt.');
  },
  notiz: (fd) => {
    const id = String(fd.get('dish') || '');
    const text = String(fd.get('text') || '').trim().slice(0, 200);
    if (!id || !text || !dishById(id)) return;
    saveRecipeNotes(id, [...recipeNotes(id), { id: L.uid(), text, by: state.me, at: new Date().toISOString() }]);
    renderSheet();
    toast('Gemerkt fürs nächste Mal.');
  },
  'packung-neu': (fd) => {
    const name = String(fd.get('name') || '').trim().slice(0, 60);
    const size = P.parseSize(fd.get('groesse'));
    if (!name || !size) { toast('Bitte Produkt und eine Größe wie „400 g“ eingeben.'); return; }
    savePacks({ ...packsAll(), [P.packKey(name)]: { name, q: size.q, u: size.u, markt: '', quelle: 'hand', at: nowStamp() } });
    renderSheet();
  },
  'packung-groesse': (fd) => {
    const id = String(fd.get('id'));
    const item = state.data.shopping.find((i) => i.id === id);
    const size = P.parseSize(fd.get('groesse'));
    if (!item) return;
    if (!size) { toast('Bitte eine Größe wie „400 g“, „1 kg“ oder „6 Stück“ eingeben.'); return; }
    savePacks({ ...packsAll(), [P.packKey(item.label)]: { name: item.label, q: size.q, u: size.u, markt: KI.shopOf(item), quelle: 'hand', at: nowStamp() } });
    const uses = packUses(item);
    const use = uses.length === 1 ? uses[0] : null;
    const need = use ? P.needOf(use.ing) : itemNeed(item);
    const o = need && P.packOptions(need, size);
    if (use && o && !o.fits && canPlan()) { state.packDraft = { id, size, options: o }; renderSheet(); return; }
    // Nur die Menge auf der Liste in Packungen umschreiben.
    const count = need && need.u === size.u ? Math.max(1, Math.ceil(need.q / size.q - 0.001)) : 1;
    const next = { ...item, qty: P.packText(count, size) + (need && need.u === size.u && o && !o.fits ? ` (für ${P.fmtSize(need.q, need.u)})` : ''), missing: false };
    commit(() => { state.data.shopping = state.data.shopping.map((i) => (i.id === id ? next : i)); }, () => store.saveItems([next]));
    closeSheet();
    toast(o && !o.fits && use && !canPlan() ? 'Gemerkt. Ob das Rezept angepasst wird, entscheiden Mama oder Papa.' : `Gemerkt: ${item.label} gibt es in ${P.fmtSize(size.q, size.u)}.`);
  },
  'packung-wahl': (fd) => {
    const d = state.packDraft;
    const item = d && state.data.shopping.find((i) => i.id === d.id);
    const use = item && packUses(item).length === 1 ? packUses(item)[0] : null;
    if (!d || !item || !use) { closeSheet(); return; }
    const wahl = ['a', 'b', 'c'].includes(String(fd.get('wahl'))) ? String(fd.get('wahl')) : d.options.rec || 'c';
    const { size, options: o } = d;
    const { dish, ing, index, day } = use;
    const now = nowStamp();
    const rest = [];
    const rows = [];
    let msg = '';
    let nextDish = null;
    if (wahl === 'c') {
      rows.push({ ...item, qty: P.packText(o.count, size) + ` (für ${P.fmtSize(P.needOf(ing).q, size.u)})`, missing: false });
      if (o.rest > 0 && !['tk', 'vorrat'].includes(ing.c || item.category)) rest.push({ id: L.uid(), text: `${P.fmtSize(o.rest, size.u)} ${ing.n}${P.isFresh(ing.c || item.category) ? ' (frisch: einfrieren oder bald verbrauchen)' : ''}`, person_id: state.me, created_at: now, ab: item.due || day });
      msg = `Rezept bleibt. ${o.rest > 0 ? (['tk', 'vorrat'].includes(ing.c || item.category) ? `${P.fmtSize(o.rest, size.u)} bleiben im Vorrat.` : `${P.fmtSize(o.rest, size.u)} stehen ab dem Einkauf auf „Was muss weg?“.`) : ''}`;
    } else {
      const n = wahl === 'a' ? 1 : 2;
      const f = wahl === 'a' ? o.f1 : o.f2;
      const mainQ = ing.u === 'kg' || ing.u === 'l' ? (n * size.q) / 1000 : n * size.q;
      const ingredients = P.scaleRecipe(dish.ingredients, f, index, mainQ);
      const servings = P.servingsFor(f);
      nextDish = { ...dish, ingredients, servings: servings > 4 ? servings : null };
      rows.push({ ...item, qty: P.packText(n, size), missing: false });
      // Wird das Rezept deutlich größer, kommen die übrigen Zutaten als Zusatzmenge auf dieselbe Tour.
      // Kleine Unterschiede fängt die Einkaufsliste mit ihren aufgerundeten Packungen ohnehin auf.
      if (f > 1.25) {
        let sort = state.data.shopping.filter((i) => i.week_start === item.week_start).reduce((m, i) => Math.max(m, i.sort || 0), 0);
        dish.ingredients.forEach((g, i) => {
          if (i === index || g.c === 'basis' || g.q == null) return;
          const add = Math.round((ingredients[i].q - g.q) * 100) / 100;
          const small = g.u === 'g' || g.u === 'ml' ? add < 30 : add < 1;
          if (!(add > 0) || small) return;
          rows.push({ id: L.uid(), week_start: item.week_start, trip: item.trip, due: item.due || null, buyer: item.buyer || null, category: L.SHOP_CATS[g.c] ? g.c : 'sonst',
            label: g.n, qty: `${L.fmtQty(add, g.u)} zusätzlich`, sort: ++sort, checked: false, checked_by: null, checked_at: null, manual: true, added_by: state.me, created_at: now,
            purpose: `${L.shortDish(dish.name)} (${L.WD_SHORT[L.wdIndex(day)]})`, missing: false, ...(item.shop ? { shop: item.shop } : {}) });
        });
      }
      if (servings > 4) rest.push({ id: L.uid(), text: `etwa ${servings - 4} ${servings - 4 === 1 ? 'Portion' : 'Portionen'} ${L.shortDish(dish.name)}`, person_id: state.me, created_at: now, ab: L.addDays(day, 1) });
      msg = `Rezept auf ${n === 1 ? '1 Packung' : '2 Packungen'} umgerechnet.${rows.length > 1 ? ` ${rows.length - 1} Zusatzmengen stehen auf der Liste.` : ''}${servings > 4 ? ` Die Reste stehen ab ${L.WD_SHORT[L.wdIndex(L.addDays(day, 1))]} auf „Was muss weg?“.` : ''}`;
    }
    commit(() => {
      if (nextDish) state.data.dishes = state.data.dishes.map((x) => (x.id === nextDish.id ? nextDish : x));
      state.data.shopping = [...state.data.shopping.map((i) => rows.find((r) => r.id === i.id) || i), ...rows.filter((r) => !state.data.shopping.some((i) => i.id === r.id))];
    }, async () => {
      if (nextDish) await store.saveDish(nextDish);
      await store.saveItems(rows);
    });
    if (rest.length) saveLeftovers([...leftovers(), ...rest]);
    state.packDraft = null;
    closeSheet();
    toast(msg.trim());
  },
  rest: (fd) => {
    const text = String(fd.get('text') || '').trim().slice(0, 80);
    if (!text) return;
    saveLeftovers([...leftovers(), { id: L.uid(), text, person_id: state.me, created_at: nowStamp() }]);
    renderSheet();
    const f = $('[data-form="rest"] input', $('#sheet-root'));
    if (f) f.focus();
  },
  mittag: async (fd) => {
    state.lunchForm = { personen: Math.min(10, Math.max(1, parseInt(fd.get('personen'), 10) || 1)), minuten: Number(fd.get('minuten')) || 15, wunsch: String(fd.get('wunsch') || '').trim().slice(0, 200) };
    openSheet({ type: 'mittag-laden' });
    try {
      state.lunchResult = await store.suggestLunch({ ...state.lunchForm, kind: !canPlan(), ...lunchContext() });
      openSheet({ type: 'mittag-ergebnis' });
    } catch (e) {
      openSheet({ type: 'mittag' });
      toast(store.offline ? 'Ohne Internet gibt es keine Vorschläge.' : `Hat nicht geklappt: ${e.message}`);
    }
  },
  'app-wunsch': (fd) => {
    const text = String(fd.get('text') || '').trim().slice(0, 200);
    if (!text) return;
    saveAppWishes([...appWishes(), { id: L.uid(), text, person_id: state.me, created_at: nowStamp(), done: false }]);
    renderSheet();
    toast('Notiert, danke!');
  },
  fest: (fd) => {
    const id = String(fd.get('id') || '') || L.uid();
    const old = feastList().find((x) => x.id === id);
    const num = (k) => Math.min(40, Math.max(0, parseInt(fd.get(k), 10) || 0));
    const entry = {
      ...(old || {}), id, anlass: String(fd.get('anlass') || 'Festtag').trim().slice(0, 40), datum: String(fd.get('datum') || ''),
      wunsch: String(fd.get('wunsch') || '').trim().slice(0, 500), erwachsene: num('erwachsene'), kinder: num('kinder'),
      besonderheiten: String(fd.get('besonderheiten') || '').trim().slice(0, 300),
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.datum)) { toast('Bitte ein Datum angeben.'); return; }
    if (!feastPeople(entry)) { toast('Bitte angeben, wie viele Personen mitessen.'); return; }
    saveFeasts([...feastList().filter((x) => x.id !== id), entry]);
    runFeast(entry);
  },
  wunsch: (fd) => {
    const text = String(fd.get('text') || '').trim().slice(0, 80);
    if (!text) return;
    const week = wishWeek();
    const dish = state.data.dishes.find((d) => d.name.toLowerCase() === text.toLowerCase());
    const old = wishesAll().find((w) => w.person_id === state.me && w.week === week);
    const entry = { id: old ? old.id : L.uid(), person_id: state.me, week, text: dish ? dish.name : text, dish_id: dish ? dish.id : null, status: 'offen', created_at: nowStamp() };
    saveWishes([...wishesAll().filter((w) => w.id !== entry.id), entry]);
    state.wishEdit = false;
    toast(`Wunsch für die Woche ab ${L.fmtShort(week)} gespeichert.`);
  },
  zutaten: (fd) => {
    const d = state.ingredientDraft;
    if (!d) return;
    const pick = fd.getAll('nimm').map(Number).map((n) => d.posten[n]).filter(Boolean);
    if (!pick.length) { toast('Nichts ausgewählt.'); return; }
    const trip = String(fd.get('trip') || targetTrip(state.week).trip);
    const weekItems = state.data.shopping.filter((i) => i.week_start === state.week);
    const sample = weekItems.find((i) => (i.trip || 'Einkauf') === trip) || {};
    const maxSort = Math.max(0, ...weekItems.map((i) => i.sort || 0));
    const purpose = String(fd.get('purpose') || '').trim();
    const shop = fd.get('shop') === 'lidl' ? { shop: 'lidl' } : {};
    const now = nowStamp();
    const rows = pick.map((p, n) => ({
      id: L.uid(), week_start: state.week, trip, due: sample.due || null, category: p.abteilung === 'basis' ? 'vorrat' : (L.SHOP_CATS[p.abteilung] ? p.abteilung : 'sonst'),
      label: p.name, qty: p.menge || '', sort: maxSort + 1 + n, checked: false, checked_by: null, checked_at: null, manual: true,
      added_by: state.me, created_at: now, purpose, missing: false, ...shop,
    }));
    commit(() => { state.data.shopping = [...state.data.shopping, ...rows]; }, () => store.saveItems(rows));
    state.ingredientDraft = null;
    state.draft = '';
    closeSheet();
    toast(`${rows.length === 1 ? '1 Posten' : `${rows.length} Posten`} auf „${trip}“ gesetzt.`);
  },
  posten: (fd) => {
    const label = String(fd.get('label') || '').trim();
    if (!label) return;
    const weekItems = state.data.shopping.filter((i) => i.week_start === state.week);
    const last = weekItems.sort((a, b) => a.sort - b.sort)[weekItems.length - 1];
    const item = {
      id: L.uid(), week_start: state.week, trip: last ? last.trip : 'Einkauf', due: last ? last.due || null : null, category: 'sonst', label, qty: '',
      sort: last ? last.sort + 1 : 0, checked: false, checked_by: null, checked_at: null, manual: true, added_by: state.me, created_at: nowStamp(),
      ...(fd.get('shop') === 'lidl' ? { shop: 'lidl' } : {}),
    };
    state.draft = '';
    state.draftShop = fd.get('shop') === 'lidl' ? 'lidl' : '';
    commit(() => { state.data.shopping = [...state.data.shopping, item]; }, () => store.saveItems([item]));
    const input = $('#neu-posten');
    if (input) input.focus();
  },
  vorabend: (fd) => {
    const day = String(fd.get('day'));
    const p = planOf(day);
    const row = { ...(p || { day, dish_id: null, lunchbox: '', skipped: false }), prep: String(fd.get('prep') || '').trim() };
    commit(() => { state.data.plan = [...state.data.plan.filter((x) => x.day !== day), row].sort(byDay); }, () => store.savePlan([row]));
    toast('Notiz für den Vorabend gespeichert.');
  },
  brotbox: (fd) => {
    const day = String(fd.get('day'));
    const p = planOf(day);
    const row = { ...(p || {}), day, dish_id: p ? p.dish_id : null, skipped: p ? !!p.skipped : false, lunchbox: String(fd.get('lunchbox') || '').trim() };
    commit(() => { state.data.plan = [...state.data.plan.filter((x) => x.day !== day), row].sort(byDay); }, () => store.savePlan([row]));
    toast('Brotbox gespeichert.');
  },
  gericht: (fd) => {
    const id = String(fd.get('id') || '');
    const existing = id ? dishById(id) : null;
    const dish = normalizeDish({
      name: fd.get('name'),
      category: fd.get('category'),
      duration_min: fd.get('duration'),
      tags: String(fd.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean),
      note: String(fd.get('note') || '').trim(),
      favorite: fd.get('favorite') === 'on',
      pause_until: String(fd.get('pause_until') || ''),
      prep: String(fd.get('prep') || ''),
      pieces: fd.get('category') === 'brotbox' ? fd.get('pieces') : null,
      nutrition: Object.fromEntries(N.FIELDS.map(([k]) => [k, fd.get(`n_${k}`)])),
      ingredients: String(fd.get('ingredients') || '').split('\n').filter((l) => l.trim()),
      steps: String(fd.get('steps') || '').split('\n').map((l) => l.trim().replace(/^(\d+\s*[.):]|[-–•*])\s*/, '')).filter(Boolean),
    }, existing);
    const servings = Math.max(1, parseInt(fd.get('servings'), 10) || 4);
    if (servings !== 4) {
      dish.ingredients = dish.ingredients.map((x) => ({ ...x, q: L.scaleQty(x.q, x.u, 4 / servings) }));
      dish.note = [dish.note, `Mengen von ${servings} auf 4 Personen umgerechnet.`].filter(Boolean).join(' ');
    }
    commit(() => {
      state.data.dishes = [...state.data.dishes.filter((d) => d.id !== dish.id), dish].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }, () => store.saveDish(dish));
    state.stale = false;
    openSheet({ type: 'gericht', id: dish.id });
    toast('Gericht gespeichert.');
  },
  import: (fd, form) => {
    const box = $('#import-fehler', form);
    try {
      state.importText = String(fd.get('json'));
      const result = runImport(state.importText);
      previewImport(result, 'Plan einfügen', () => {
        state.importText = '';
        applyImport(result);
        closeSheet();
        toast(`Plan übernommen: ${result.saved.length} ${result.saved.length === 1 ? 'Gericht' : 'Gerichte'}, ${result.rows.length} ${result.rows.length === 1 ? 'Tag' : 'Tage'}.${result.dropped ? ` ${result.dropped} ${result.dropped === 1 ? 'Brotbox' : 'Brotboxen'} an schulfreien Tagen weggelassen.` : ''}`);
      });
    } catch (e) {
      box.textContent = e.message;
      box.hidden = false;
    }
  },
  pin: async (fd, form) => {
    const id = String(fd.get('id'));
    const neu = String(fd.get('mode')) === 'neu';
    const pin = String(fd.get('pin1') || '');
    const box = $('#pin-fehler', form);
    const fail = (text) => {
      box.textContent = text;
      box.hidden = false;
      form.querySelectorAll('.pin').forEach((i) => { i.value = ''; });
      $('#pin1', form).focus();
    };
    const person = personById(id);
    if (!person) return;
    if (!/^\d{4}$/.test(pin)) { fail('Die PIN hat genau vier Ziffern.'); return; }
    if (!neu && pinLock > Date.now()) { fail('Zu viele falsche Versuche. In einer Minute geht es wieder.'); return; }
    let hash;
    try { hash = await pinHash(id, pin); } catch (e) { fail(e.message); return; }
    if (String(fd.get('mode')) === 'eltern') {
      // Passt die PIN zu einem der Erwachsenen?
      let ok = false;
      for (const a of state.data.persons.filter((p) => isAdult(p) && p.pin_hash)) {
        try { if (await pinHash(a.id, pin) === a.pin_hash) { ok = true; break; } } catch (e) { /* weiter */ }
      }
      if (!ok) {
        pinFails += 1;
        if (pinFails >= 5) { pinFails = 0; pinLock = Date.now() + 60000; }
        fail('Die PIN stimmt nicht.');
        return;
      }
    } else if (neu) {
      if (pin !== String(fd.get('pin2') || '')) { fail('Die beiden Eingaben stimmen nicht überein.'); return; }
      const next = { ...person, pin_hash: hash };
      commit(() => { state.data.persons = state.data.persons.map((p) => (p.id === id ? next : p)); }, () => store.savePersons([next]));
      toast('PIN gespeichert.');
    } else if (hash !== person.pin_hash) {
      pinFails += 1;
      if (pinFails >= 5) { pinFails = 0; pinLock = Date.now() + 60000; }
      fail('Die PIN stimmt nicht.');
      return;
    }
    pinFails = 0;
    const next = pinNext;
    pinNext = null;
    state.sheet = null;
    renderSheet();
    if (next) next(); else render();
  },
  anwesenheit: (fd) => {
    const day = String(fd.get('day'));
    const set = [];
    const del = [];
    for (const p of state.data.persons) {
      if (!fd.has(`st-${p.id}`)) continue;
      const st = String(fd.get(`st-${p.id}`));
      if (st === 'auto') del.push(p.id);
      else set.push({ day, person_id: p.id, status: st, time: st === 'spaet' ? String(fd.get(`t-${p.id}`) || '19:30') : null });
    }
    // Gäste stehen am Tag im Wochenplan.
    const g = fd.has('gaeste') && canPlan() ? Math.min(20, Math.max(0, parseInt(fd.get('gaeste'), 10) || 0)) : null;
    const p = planOf(day);
    const guestRow = g != null && g !== guestsOf(day) ? { ...(p || { day, dish_id: null, lunchbox: '', skipped: false }), guests: g } : null;
    commit(() => {
      state.data.attendance = [...state.data.attendance.filter((a) => !(a.day === day && (del.includes(a.person_id) || set.some((x) => x.person_id === a.person_id)))), ...set];
      if (guestRow) state.data.plan = [...state.data.plan.filter((x) => x.day !== day), guestRow].sort(byDay);
    }, async () => {
      for (const pid of del) await store.deleteAttendance(day, pid);
      await store.saveAttendance(set);
      if (guestRow) await store.savePlan([guestRow]);
    });
    renderSheet();
    const listed = guestRow && state.data.shopping.some((i) => i.week_start === L.mondayOf(day) && !i.manual);
    toast(`Abendessen am ${L.fmtLong(day)} um ${dinnerOf(day).time}.${listed ? ' Die Einkaufsliste rechnet die Gäste erst ein, wenn ihr sie unter „Einkauf“ neu erstellt.' : ''}`);
  },
  termin: (fd, form) => {
    const id = String(fd.get('id') || '');
    const old = id ? state.data.events.find((x) => x.id === id) : null;
    const box = $('#termin-fehler', form);
    const who = fd.getAll('who').map(String);
    const weekdays = fd.getAll('weekdays').map(Number);
    if (!who.length || !weekdays.length) { box.textContent = 'Bitte mindestens eine Person und einen Tag auswählen.'; box.hidden = false; return; }
    const row = {
      id: old ? old.id : L.uid(),
      sort: old ? old.sort || 0 : state.data.events.length + 1,
      title: String(fd.get('title')).trim(),
      who,
      weekdays,
      start_time: String(fd.get('start_time') || ''),
      end_time: String(fd.get('end_time') || '') || null,
      home_time: String(fd.get('home_time') || '') || null,
      pause_ferien: fd.get('pause_ferien') === 'on',
      valid_from: String(fd.get('valid_from') || '') || null,
      valid_to: String(fd.get('valid_to') || '') || null,
      active: fd.get('active') === 'on',
    };
    commit(() => { state.data.events = [...state.data.events.filter((x) => x.id !== row.id), row]; }, () => store.saveEvents([row]));
    openSheet({ type: 'termine' });
    toast('Termin gespeichert.');
  },
  beleg: (fd, form) => {
    readReceiptForm(form);
    const d = state.receiptDraft;
    const items = d.items.filter((p) => p.name);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.day)) { toast('Bitte ein Datum angeben.'); return; }
    if (!items.length && d.total == null) { toast('Bitte mindestens einen Posten oder den Betrag angeben.'); return; }
    const old = state.data.receipts.find((r) => r.id === d.id);
    const now = new Date().toISOString();
    const row = {
      id: d.id, day: d.day, shop: d.shop, total: d.total != null ? d.total : HB.itemsSum(items),
      items: items.map((p) => ({ text: p.text || '', name: p.name, preis: HB.money(p.preis), kategorie: p.kategorie || 'Sonstiges', ...(p.packung ? { packung: String(p.packung) } : {}) })),
      note: d.note || '', created_by: old ? old.created_by : state.me, created_at: old ? old.created_at : now, updated_at: now,
    };
    const before = d.items.map((p, n) => [p, d.before[n]]).filter(([p]) => p.name).map(([, b]) => b);
    const merken = HB.learnFrom(hbSettings().merken, row.items, before);
    const tick = d.isNew ? (d.checked || []).filter((id) => d.matches.includes(id)) : [];
    // Gekaufte Vorräte stehen danach auf „da“, mit dem Kaufdatum.
    const pIds = HB.matchShopping(row.items, state.data.pantry.map((x) => ({ id: x.id, label: x.label, checked: false })));
    const pantry2 = state.data.pantry.filter((x) => pIds.includes(x.id) && (!x.have || !x.seen_at || x.seen_at < row.day)).map((x) => ({ ...x, have: true, seen_at: row.day }));
    const items2 = state.data.shopping.filter((i) => tick.includes(i.id) && !i.checked).map((i) => ({ ...i, checked: true, checked_by: state.me, checked_at: now, missing: false }));
    commit(() => {
      state.data.receipts = [...state.data.receipts.filter((r) => r.id !== row.id), row];
      if (items2.length) state.data.shopping = state.data.shopping.map((i) => items2.find((x) => x.id === i.id) || i);
      if (pantry2.length) state.data.pantry = state.data.pantry.map((x) => pantry2.find((y) => y.id === x.id) || x);
    }, async () => {
      await store.saveReceipts([row]);
      if (items2.length) await store.saveItems(items2);
      if (pantry2.length) await store.savePantry(pantry2);
    });
    if (merken) saveHousehold({ merken });
    // Packungsgrößen vom Kassenzettel lernen. Was ihr selbst eingetragen habt, bleibt.
    const learned = P.learnFromReceipt(packsAll(), row.items, row.shop, now);
    if (learned.added) savePacks(learned.packs);
    state.receiptDraft = null;
    state.month = HB.monthOf(row.day);
    closeSheet();
    toast(`Kassenzettel gespeichert.${items2.length ? ` ${items2.length === 1 ? '1 Posten' : `${items2.length} Posten`} auf der Einkaufsliste abgehakt.` : ''}${pantry2.length ? ` Im Vorrat steht jetzt: ${pantry2.map((x) => x.label).join(', ')}.` : ''}`);
  },
  haushalt: (fd) => {
    const budget = parseInt(String(fd.get('budget') || '').replace(/\D/g, ''), 10);
    const kategorien = [...new Set(String(fd.get('kategorien') || '').split('\n').map((x) => x.trim()).filter(Boolean))].slice(0, 30);
    saveHousehold({ budget: budget > 0 ? budget : null, kategorien: kategorien.length ? kategorien : HB.KATEGORIEN.slice() });
    closeSheet();
    toast('Gespeichert.');
  },
  urlaub: async (fd) => {
    let von = String(fd.get('von') || '');
    let bis = String(fd.get('bis') || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis)) { toast('Bitte beide Daten angeben.'); return; }
    if (bis < von) [von, bis] = [bis, von];
    const entry = { id: L.uid(), von, bis, name: String(fd.get('name') || '').trim() || 'Urlaub', weg: fd.get('weg') === 'on' };
    const list = [...KI.holidays(state.data.settings), entry];
    const row = { key: 'urlaub', value: list, updated_at: new Date().toISOString() };
    // Schon geplante Abendessen in dem Zeitraum herausnehmen, nach Rückfrage.
    const hit = state.data.plan.filter((p) => p.day >= von && p.day <= bis && (p.dish_id || p.lunchbox));
    let clear = [];
    if (hit.length && await ask(`In dem Zeitraum ${hit.length === 1 ? 'ist schon ein Tag' : `sind schon ${hit.length} Tage`} geplant. Abendessen und Brotboxen dort herausnehmen?`, 'Herausnehmen')) {
      clear = hit.map((p) => ({ ...p, dish_id: null, lunchbox: '', skipped: false, prep: '' }));
    }
    commit(() => {
      state.data.settings = [...state.data.settings.filter((x) => x.key !== 'urlaub'), row];
      if (clear.length) state.data.plan = state.data.plan.map((p) => clear.find((c) => c.day === p.day) || p);
    }, async () => { await store.saveSettings([row]); if (clear.length) await store.savePlan(clear); });
    state.sheet = { type: 'urlaub' };
    renderSheet();
    const weeks = [...new Set(clear.map((p) => L.mondayOf(p.day)))].filter((w) => state.data.shopping.some((i) => i.week_start === w && !i.manual));
    toast(`${entry.name} eingetragen.${weeks.length ? ' Die Einkaufsliste der Woche enthält noch die Zutaten, unter „Einkauf“ lässt sie sich neu berechnen.' : ''}`);
  },
  regeln: (fd) => {
    const int = (k, min, max, def) => { const v = parseInt(fd.get(k), 10); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def; };
    const value = {
      ausschluesse: String(fd.get('ausschluesse') || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean),
      ziele: String(fd.get('ziele') || '').trim(),
      vorlieben: String(fd.get('vorlieben') || '').trim(),
      kochzeit: int('kochzeit', 15, 120, 60),
      neue_rezepte: int('neue_rezepte', 0, 7, 2),
      vegan: int('vegan', 0, 7, 1),
      auto: fd.get('auto') === 'on',
      tag: int('tag', 0, 6, 4),
      zeit: /^\d{2}:\d{2}$/.test(String(fd.get('zeit'))) ? String(fd.get('zeit')) : '12:00',
      modell: KI.MODELS.some(([id]) => id === fd.get('modell')) ? String(fd.get('modell')) : 'claude-sonnet-5-5',
      lidl: fd.get('lidl') === 'on',
      saison: fd.get('saison') === 'on',
    };
    const row = { key: 'regeln', value, updated_at: new Date().toISOString() };
    commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'regeln'), row]; }, () => store.saveSettings([row]));
    closeSheet();
    toast('Regeln gespeichert. Sie gelten ab dem nächsten Entwurf.');
  },
  zurueckholen: (fd) => {
    const r = state.restore;
    if (!r) return;
    const ids = fd.getAll('rezept').map(String);
    const week = String(fd.get('woche') || '');
    if (!ids.length && !week) { toast('Bitte ein Rezept oder eine Woche auswählen.'); return; }
    const fromBackup = (r.backup.daten.ep_dishes || []).filter((d) => ids.includes(d.id));
    const dishes = [...state.data.dishes.filter((d) => !ids.includes(d.id)), ...fromBackup];
    const days = week ? L.weekDays(week) : [];
    const rows = (r.backup.daten.ep_plan || []).filter((p) => days.includes(String(p.day).slice(0, 10))).map((p) => ({ ...p, day: String(p.day).slice(0, 10) }));
    // Ein zurückgeholter Tag braucht sein Gericht: fehlt es jetzt, kommt es aus der Sicherung mit.
    for (const p of rows) {
      if (p.dish_id && !dishes.some((d) => d.id === p.dish_id)) {
        const d = (r.backup.daten.ep_dishes || []).find((x) => x.id === p.dish_id);
        if (d) { dishes.push(d); fromBackup.push(d); }
      }
    }
    const result = { dishes, saved: fromBackup, rows, week: week || state.week, items: [], dropped: 0 };
    // Tage mit anderem Gericht als jetzt: deren Bewertungen kommen ebenfalls aus der Sicherung.
    const swapped = rows.filter((p) => { const now = planOf(p.day); return (now ? now.dish_id : null) !== (p.dish_id || null); }).map((p) => p.day);
    const oldRatings = (r.backup.daten.ep_ratings || []).map((x) => ({ ...x, day: String(x.day).slice(0, 10) })).filter((x) => swapped.includes(x.day));
    previewImport(result, 'Aus der Sicherung', () => {
      const keep = new Set(rows.map((p) => p.day));
      commit(() => {
        state.data.dishes = dishes.sort((a, b) => a.name.localeCompare(b.name, 'de'));
        state.data.plan = [...state.data.plan.filter((p) => !keep.has(p.day)), ...rows].sort(byDay);
        state.data.ratings = [...state.data.ratings.filter((x) => !swapped.includes(x.day)), ...oldRatings];
      }, async () => {
        for (const d of fromBackup) await store.saveDish(d);
        await store.savePlan(rows);
        for (const day of swapped) await store.deleteRatingsForDay(day);
        for (const x of oldRatings) await store.saveRating(x);
      });
      state.restore = null;
      toast(`Zurückgeholt: ${fromBackup.length} ${fromBackup.length === 1 ? 'Rezept' : 'Rezepte'}${rows.length ? `, ${rows.length} Tage der KW ${L.isoWeek(week)}` : ''}.`);
    }, { restoreRatings: true });
  },
  entwurf: (fd) => {
    const run = state.data.aiRuns.find((x) => x.id === String(fd.get('id')));
    if (!run || !run.draft) return;
    const d = run.draft;
    const plan = (d.plan || []).map((p) => ({ ...p, dish: fd.has(`d_${p.day}`) ? String(fd.get(`d_${p.day}`)) : p.dish }));
    const changed = plan.some((p, n) => p.dish !== d.plan[n].dish);
    const used = new Set(plan.map((p) => p.dish.toLowerCase()));
    const obj = {
      week_start: String(run.week_start).slice(0, 10),
      dishes: (d.dishes || []).filter((g) => used.has(String(g.name).toLowerCase())),
      plan: plan.map((p) => ({ day: p.day, dish: p.dish || null, lunchbox: p.lunchbox || '', prep: p.prep || '' })),
      shopping: changed ? draftShopping(d, plan, String(run.week_start).slice(0, 10)) : d.shopping || [],
    };
    let result;
    try { result = runImport(JSON.stringify(obj)); } catch (e) { toast(e.message); return; }
    const wish = String(fd.get('wunsch') || '').trim();
    const rebuild = changed && !result.items.length && state.data.shopping.some((i) => i.week_start === obj.week_start && !i.manual);
    previewImport(result, `Entwurf für KW ${L.isoWeek(obj.week_start)}`, () => acceptDraft(run, d, obj, result, changed, wish), { rebuild });
  },
  'entwurf-neu': (fd) => {
    const run = state.data.aiRuns.find((x) => x.id === String(fd.get('id')));
    if (!run) return;
    closeSheet();
    startDraft(String(run.week_start).slice(0, 10), String(fd.get('wunsch') || '').trim(), true);
  },
  immer: (fd) => {
    const label = String(fd.get('label') || '').trim();
    if (!label) return;
    const category = L.SHOP_CATS[fd.get('category')] ? String(fd.get('category')) : 'sonst';
    const row = { id: L.uid(), label, category, qty: '', sort: Math.max(0, ...state.data.staples.map((x) => x.sort || 0)) + 1, last_added: null };
    commit(() => { state.data.staples = [...state.data.staples, row]; }, () => store.saveStaples([row]));
    renderSheet();
    const f = $('[data-form="immer"] input', $('#sheet-root'));
    if (f) f.focus();
  },
  vorrat: (fd, form) => {
    const label = String(fd.get('label') || '').trim();
    if (!label) return;
    const row = { id: L.uid(), label, have: true, seen_at: L.todayISO(), sort: Math.max(0, ...state.data.pantry.map((x) => x.sort || 0)) + 1 };
    commit(() => { state.data.pantry = [...state.data.pantry, row]; }, () => store.savePantry([row]));
    renderSheet();
    const f = $('[data-form="vorrat"] input', $('#sheet-root'));
    if (f) f.focus();
  },
  einloesen: (fd, form) => {
    const id = String(fd.get('id'));
    const person = personById(id);
    const n = parseInt(fd.get('minutes'), 10);
    const acc = A.account(state.data.taskLog, id, capOf(person), nowMs(), L.todayISO());
    const box = $('#einloesen-fehler', form);
    if (!n || n < 1 || n > acc.balance) { box.textContent = `Es sind ${acc.balance} Minuten verfügbar.`; box.hidden = false; return; }
    const now = nowStamp();
    const entry = { id: L.uid(), person_id: id, task_id: null, day: L.todayISO(), label: 'Bildschirmzeit eingelöst', minutes: -n, status: 'bestaetigt', created_at: now, decided_by: state.me, decided_at: now };
    commit(() => { state.data.taskLog = [...state.data.taskLog, entry]; }, () => store.saveLog([entry]));
    closeSheet();
    toast(`${n} Minuten für ${person.name} abgebucht.`);
  },
  erinnerungen: (fd) => {
    const ok = (v) => (/^\d{2}:\d{2}$/.test(String(v || '')) ? String(v) : '');
    const value = { kind1: ok(fd.get('kind1')), kind2: ok(fd.get('kind2')), eltern: ok(fd.get('eltern')) };
    const row = { key: 'aufgaben', value: { ...(KI.settingOf(state.data.settings, 'aufgaben') || {}), erinnerung: value }, updated_at: new Date().toISOString() };
    commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'aufgaben'), row]; }, () => store.saveSettings([row]));
    toast('Erinnerungen gespeichert.');
    renderSheet();
  },
  stall: (fd) => {
    const tage = Math.max(1, Math.min(60, parseInt(fd.get('tage'), 10) || 7));
    const raw = String(fd.get('last') || '');
    const today = L.todayISO();
    const last = /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
    const was = A.stState(stValue()).on;
    stSave({ on: true, tage, last, by: state.me });
    toast(was ? 'Stall-Ampel gespeichert.' : 'Stall-Ampel ist an.');
  },
  shop: (fd) => {
    const ids = fd.getAll('id').map(String), names = fd.getAll('name').map((x) => String(x).trim()), costs = fd.getAll('cost');
    const items = ids.map((id, i) => ({ id, name: names[i].slice(0, 80), cost: Math.max(1, Math.min(600, parseInt(costs[i], 10) || 0)) }))
      .filter((x, i) => x.name && parseInt(costs[i], 10) > 0);
    const row = { key: 'shop', value: { aus: !fd.get('on'), items }, updated_at: new Date().toISOString() };
    commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'shop'), row]; }, () => store.saveSettings([row]));
    closeSheet();
    toast(items.length ? `Minuten-Shop gespeichert, ${items.length} ${items.length === 1 ? 'Belohnung' : 'Belohnungen'}.` : 'Minuten-Shop ist leer.');
  },
  wochenbonus: (fd) => {
    const n = Math.max(0, Math.min(120, parseInt(fd.get('minuten'), 10) || 0));
    const row = { key: 'aufgaben', value: { ...(KI.settingOf(state.data.settings, 'aufgaben') || {}), wochenbonus: n }, updated_at: new Date().toISOString() };
    commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'aufgaben'), row]; }, () => store.saveSettings([row]));
    toast(n ? `Wochenbonus: ${n} Minuten.` : 'Wochenbonus ausgeschaltet.');
    renderSheet();
  },
  aufgabe: (fd) => {
    const id = String(fd.get('id') || '');
    const old = id ? taskById(id) : null;
    const who = fd.getAll('who').map(String);
    const row = {
      id: old ? old.id : L.uid(),
      sort: old ? old.sort : Math.max(0, ...state.data.tasks.map((t) => t.sort || 0)) + 1,
      name: String(fd.get('name')).trim(),
      minutes: Math.max(0, parseInt(fd.get('minutes'), 10) || 0),
      schedule: A.RHYTHMEN[fd.get('schedule')] ? String(fd.get('schedule')) : 'bedarf',
      who,
      rotate: fd.get('rotate') === 'on' && who.length > 1,
      rot_offset: old ? old.rot_offset || 0 : 0,
      max_per_day: Math.max(1, parseInt(fd.get('max_per_day'), 10) || 1),
      months: fd.getAll('months').map(Number),
      school_only: fd.get('school_only') === 'on',
      note: String(fd.get('note') || '').trim(),
      active: fd.get('active') === 'on',
    };
    commit(() => { state.data.tasks = [...state.data.tasks.filter((t) => t.id !== row.id), row]; }, () => store.saveTasks([row]));
    const wantFoto = fd.get('foto') === 'on';
    const fotos = fotoTasks();
    if (wantFoto !== fotos.includes(row.id)) {
      const srow = { key: 'aufgaben', value: { ...(KI.settingOf(state.data.settings, 'aufgaben') || {}), foto: wantFoto ? [...fotos, row.id] : fotos.filter((x) => x !== row.id) }, updated_at: new Date().toISOString() };
      commit(() => { state.data.settings = [...state.data.settings.filter((x) => x.key !== 'aufgaben'), srow]; }, () => store.saveSettings([srow]));
    }
    openSheet({ type: 'aufgaben-liste' });
    toast('Aufgabe gespeichert.');
  },
  familie: (fd, form) => {
    const edit = canPlan();
    const rows = state.data.persons.map((p) => (edit
      ? {
        ...p,
        name: String(fd.get(`name-${p.id}`) || p.name).trim() || p.name,
        adult: fd.get(`adult-${p.id}`) === 'on',
        ...(fd.has(`base-${p.id}`) ? {
          screen_base: fd.get(`base-${p.id}`) === '' ? null : Math.max(0, parseInt(fd.get(`base-${p.id}`), 10) || 0),
          earn_cap: fd.get(`cap-${p.id}`) === '' ? null : Math.max(0, parseInt(fd.get(`cap-${p.id}`), 10) || 0),
        } : {}),
      }
      : p));
    if (edit && !rows.some(isAdult)) {
      const box = $('#familie-fehler', form);
      box.textContent = 'Mindestens eine Person muss als erwachsen markiert sein.';
      box.hidden = false;
      return;
    }
    const me = String(fd.get('ich') || state.me || '');
    if (edit) commit(() => { state.data.persons = rows; }, () => store.savePersons(rows));
    closeSheet();
    if (me && me !== state.me) {
      requirePin(me, () => {
        state.me = me;
        writeLocal(ME_KEY, me);
        if (personById(state.me)) state.phase = 'app';
        render();
        refreshPush(true);
      });
    }
  },
};

/* ---------- Ereignisse ---------- */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) {
    if (e.target.classList && e.target.classList.contains('schleier')) closeSheet();
    return;
  }
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.tagName !== 'INPUT') e.preventDefault();
  if (ADULT_ACTIONS.has(el.dataset.action) && !canPlan()) { toast(ONLY_ADULTS); return; }
  fn(el.dataset, el);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  if (ADULT_FORMS.has(form.dataset.form) && !canPlan()) { toast(ONLY_ADULTS); return; }
  forms[form.dataset.form](new FormData(form), form);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'neu-posten') state.draft = e.target.value;
  if (e.target.id === 'preis-suche') {
    const q = e.target.value.trim().toLowerCase();
    $$('.preis-zeile').forEach((li) => { li.hidden = !!q && !li.dataset.suche.includes(q); });
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'zutaten-foto') {
    const files = e.target.files;
    readIngredientPhotos(files).finally(() => { e.target.value = ''; });
  }
  if (e.target.id === 'rezept-foto') {
    const files = e.target.files;
    readRecipePhotos(files).finally(() => { e.target.value = ''; });
  }
  if (e.target.id === 'abfuhr-datei') {
    const file = e.target.files && e.target.files[0];
    readAbfuhrFile(file).finally(() => { e.target.value = ''; });
  }
  if (e.target.classList && e.target.classList.contains('sm-zeit') && canPlan()) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(e.target.value || '');
    if (m) {
      const d = new Date(nowMs());
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
      if (d.getTime() <= nowMs()) d.setDate(d.getDate() + 1);
      smSave('gelb', d.toISOString());
      toast(`Fertig um ${m[1].padStart(2, '0')}:${m[2]} Uhr. Dann springt die Ampel auf Rot.`);
    }
  }
  if (e.target.id === 'nachweis-foto') {
    const file = e.target.files && e.target.files[0];
    fotoChosen(file).finally(() => { e.target.value = ''; });
  }
  if (e.target.id === 'beleg-foto') {
    const files = e.target.files;
    readPhotos(files).finally(() => { e.target.value = ''; });
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.sheet) closeSheet();
});
// Mehrere Zeilen ins Ergänzen-Feld eingefügt: als Zutatenliste übernehmen.
document.addEventListener('paste', (e) => {
  if (e.target.id !== 'neu-posten') return;
  const text = (e.clipboardData || window.clipboardData).getData('text') || '';
  if (text.split(/\r?\n/).filter((l) => l.trim()).length < 2) return;
  e.preventDefault();
  const d = pastedIngredients(text);
  if (!d.posten.length) return;
  state.ingredientDraft = d;
  openSheet({ type: 'zutaten' });
});

boot();
