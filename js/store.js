// Datenspeicher. Zwei Varianten mit derselben Schnittstelle:
// SupabaseStore: gemeinsame Datenbank für die ganze Familie.
// LocalStore: Demo-Modus, Daten bleiben nur auf diesem Gerät.

import { SEED } from './seed.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const LOCAL_KEY = 'essensplan.demo.v1';
// Für die Einkaufsliste ohne Netz: letzter geladener Stand und noch nicht übertragene Änderungen.
const CACHE_KEY = 'familienplan.stand.v1';
const OUTBOX_KEY = 'familienplan.ausgang.v1';

const offlineNow = () => typeof navigator !== 'undefined' && navigator.onLine === false;
const isNetError = (e) => offlineNow() || /failed to fetch|load failed|networkerror|network request failed|zeitüberschreitung|retryable/i.test(`${(e && e.name) || ''} ${(e && e.message) || e}`);
// Bei schlechtem Empfang hängen Anfragen lange. Nach 8 Sekunden gilt der Versuch als gescheitert.
function withTimeout(promise, ms = 8000) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Zeitüberschreitung')), ms))]);
}
function readJson(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* voller oder gesperrter Speicher: dann eben ohne */ }
}

// Tabellenname in der Datenbank, Schlüssel im App-Zustand, Sortierung beim Laden.
// Das Präfix ep_ verhindert Namenskonflikte, falls das Supabase-Projekt noch andere Tabellen hat.
const TABLES = [
  ['ep_persons', 'persons', ['sort']],
  ['ep_dishes', 'dishes', ['name']],
  ['ep_plan', 'plan', ['day']],
  ['ep_ratings', 'ratings', ['day', 'person_id']],
  ['ep_shopping', 'shopping', ['week_start', 'sort', 'id']],
  ['ep_lunch_ratings', 'lunchRatings', ['day', 'person_id']],
  ['ep_week_hearts', 'hearts', ['week_start', 'person_id']],
  ['ep_tasks', 'tasks', ['sort', 'id']],
  ['ep_task_log', 'taskLog', ['day', 'created_at']],
  ['ep_events', 'events', ['sort', 'id']],
  ['ep_attendance', 'attendance', ['day', 'person_id']],
  ['ep_pantry', 'pantry', ['sort', 'id']],
  ['ep_staples', 'staples', ['sort', 'id'], true],
  ['ep_settings', 'settings', ['key'], true],
  ['ep_ai_runs', 'aiRuns', ['created_at'], true],
  ['ep_receipts', 'receipts', ['day', 'created_at'], true],
];
// Das vierte Feld markiert Tabellen, die neuer sind als die übrigen. Fehlen sie in der Datenbank noch
// (Schema nicht neu ausgeführt), lädt die App trotzdem, nur ohne diese Daten.

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Die Supabase-Bibliothek ließ sich nicht laden. Besteht eine Internetverbindung?'));
    document.head.append(s);
  });
}

function check({ error }) {
  if (error) throw new Error(error.message || String(error));
}

class SupabaseStore {
  constructor(url, key) {
    this.mode = 'supabase';
    this.url = url;
    this.key = key;
    this.offline = false;
    this.get = () => null;
    this.onStatus = () => {};
  }

  async init() {
    if (!window.supabase) await loadScript(SUPABASE_JS);
    this.sb = window.supabase.createClient(this.url, this.key);
    const hasCache = !!readJson(CACHE_KEY, null);
    let res;
    try { res = await withTimeout(this.sb.auth.getSession()); } catch (e) { res = { data: {}, error: e }; }
    const { data, error } = res;
    // Ohne Netz lässt sich die Anmeldung nicht erneuern. Mit gespeichertem Stand geht es trotzdem weiter.
    if ((error && isNetError(error)) || (!(data && data.session) && offlineNow())) {
      if (hasCache) { this.offline = true; this.watch(); return { signedIn: true }; }
    }
    if (error) throw new Error(error.message);
    this.watch();
    return { signedIn: !!data.session };
  }

  // Stand vom letzten Mal, für den Sofortstart.
  cachedState() { return readJson(CACHE_KEY, null); }

  bind(getter) { this.get = getter; }

  /* ----- Einkaufsliste ohne Netz ----- */

  // Hält den aktuellen Stand auf dem Gerät fest.
  remember(data) {
    const d = data || this.get();
    if (d && Array.isArray(d.dishes) && d.dishes.length) writeJson(CACHE_KEY, d);
  }

  outbox() { return readJson(OUTBOX_KEY, { up: {}, del: [] }); }
  pendingCount() { const o = this.outbox(); return Object.keys(o.up).length + o.del.length; }

  setOffline(v) {
    if (this.offline === v) return;
    this.offline = v;
    this.onStatus();
  }

  // Überträgt wartende Änderungen. Liefert false, wenn es am Netz scheitert, die Änderungen bleiben dann stehen.
  async flush() {
    const o = this.outbox();
    const ups = Object.values(o.up);
    if (!ups.length && !o.del.length) return true;
    try {
      if (ups.length) {
        // Fehlt eine neuere Spalte (schema.sql noch nicht neu ausgeführt), ohne sie speichern.
        let rows = ups;
        for (let n = 0; ; n += 1) {
          try { check(await withTimeout(this.sb.from('ep_shopping').upsert(rows))); break; } catch (e) {
            const col = (String(e.message).match(/'(\w+)' column/) || [])[1];
            if (!col || n >= 3 || !['shop', 'added_by', 'created_at'].includes(col)) throw e;
            rows = rows.map((r) => { const { [col]: _, ...rest } = r; return rest; });
          }
        }
      }
      if (o.del.length) check(await withTimeout(this.sb.from('ep_shopping').delete().in('id', o.del)));
    } catch (e) {
      if (isNetError(e) || /jwt|token/i.test(String(e.message))) { this.offline = true; this.onStatus(); return false; }
      writeJson(OUTBOX_KEY, { up: {}, del: [] });
      this.onStatus();
      throw e;
    }
    // Nur entfernen, was wirklich gesendet wurde. Inzwischen kann Neues dazugekommen sein.
    const now = this.outbox();
    for (const row of ups) if (JSON.stringify(now.up[row.id]) === JSON.stringify(row)) delete now.up[row.id];
    now.del = now.del.filter((id) => !o.del.includes(id));
    writeJson(OUTBOX_KEY, now);
    if (this.offline) { this.offline = false; this.onStatus(); }
    return true;
  }

  watch() {
    if (this.watching) return;
    this.watching = true;
    const retry = () => { if (this.pendingCount() || this.offline) this.flush().then((ok) => { if (ok && this.offline) this.setOffline(false); }).catch(() => {}); };
    window.addEventListener('online', retry);
    window.addEventListener('offline', () => this.setOffline(true));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') retry(); });
    setInterval(() => { if (this.pendingCount()) retry(); }, 20000);
  }

  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message === 'Invalid login credentials'
        ? 'E-Mail oder Passwort stimmen nicht.'
        : error.message);
    }
  }

  async signOut() {
    await this.sb.auth.signOut();
    try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(OUTBOX_KEY); } catch (e) { /* nichts zu löschen */ }
  }

  async loadTable(table) {
    const def = TABLES.find((t) => t[0] === table);
    const size = 1000;
    const rows = [];
    for (let from = 0; ; from += size) {
      let q = this.sb.from(table).select('*');
      for (const col of def[2]) q = q.order(col);
      const { data, error } = await q.range(from, from + size - 1);
      if (error && def[3] && !isNetError(error)) return [];
      if (error) throw new Error(error.message);
      rows.push(...data);
      if (data.length < size) break;
    }
    return rows;
  }

  async loadAll() {
    try {
      // Erst Wartendes übertragen, sonst überschreibt der geladene Stand die eigenen Haken.
      if (!(await this.flush())) throw new Error('Failed to fetch');
      const lists = await withTimeout(Promise.all(TABLES.map((t) => this.loadTable(t[0]))), 15000);
      const out = {};
      TABLES.forEach((t, n) => { out[t[1]] = lists[n]; });
      this.remember(out);
      this.setOffline(false);
      return out;
    } catch (e) {
      const cached = readJson(CACHE_KEY, null);
      if (isNetError(e) && cached) { this.setOffline(true); return cached; }
      throw e;
    }
  }

  // Schlüssel im App-Zustand zu einem Tabellennamen, oder null bei fremden Tabellen.
  stateKey(table) {
    const def = TABLES.find((t) => t[0] === table);
    return def ? def[1] : null;
  }

  async seed() {
    check(await this.sb.from('ep_persons').upsert(SEED.persons));
    check(await this.sb.from('ep_dishes').upsert(SEED.dishes));
    check(await this.sb.from('ep_plan').upsert(SEED.plan));
    check(await this.sb.from('ep_shopping').upsert(SEED.shopping));
    check(await this.sb.from('ep_tasks').upsert(SEED.tasks));
    check(await this.sb.from('ep_pantry').upsert(SEED.pantry));
    await this.sb.from('ep_staples').upsert(SEED.staples);
  }

  async savePersons(rows) { check(await this.sb.from('ep_persons').upsert(rows)); }
  async saveDish(row) {
    const { error } = await this.sb.from('ep_dishes').upsert(row);
    // Ist schema.sql noch nicht neu ausgeführt, fehlt die Spalte "servings": dann ohne sie speichern.
    if (error && /servings/.test(error.message || '')) { const { servings, ...rest } = row; check(await this.sb.from('ep_dishes').upsert(rest)); return; }
    check({ error });
  }
  async savePlan(rows) { if (rows.length) check(await this.sb.from('ep_plan').upsert(rows, { onConflict: 'day' })); }
  async deletePlan(days) { if (days.length) check(await this.sb.from('ep_plan').delete().in('day', days)); }
  async saveRating(row) { check(await this.sb.from('ep_ratings').upsert(row, { onConflict: 'day,person_id' })); }
  async deleteRating(day, personId) {
    check(await this.sb.from('ep_ratings').delete().eq('day', day).eq('person_id', personId));
  }
  async deleteRatingsForDay(day) { check(await this.sb.from('ep_ratings').delete().eq('day', day)); }
  // Änderungen an der Einkaufsliste gehen zuerst in den Ausgang und von dort zur Datenbank.
  // Ohne Netz bleiben sie dort liegen und werden später nachgetragen.
  async saveItems(rows) {
    if (!rows.length) return;
    const o = this.outbox();
    for (const row of rows) { o.up[row.id] = row; }
    o.del = o.del.filter((id) => !rows.some((row) => row.id === id));
    writeJson(OUTBOX_KEY, o);
    this.remember();
    await this.flush();
  }
  async deleteItems(ids) {
    if (!ids.length) return;
    const o = this.outbox();
    for (const id of ids) { delete o.up[id]; if (!o.del.includes(id)) o.del.push(id); }
    writeJson(OUTBOX_KEY, o);
    this.remember();
    await this.flush();
  }
  async saveLunchRating(row) { check(await this.sb.from('ep_lunch_ratings').upsert(row, { onConflict: 'day,person_id' })); }
  async saveEvents(rows) { if (rows.length) check(await this.sb.from('ep_events').upsert(rows)); }
  async deleteEvent(id) { check(await this.sb.from('ep_events').delete().eq('id', id)); }
  async saveAttendance(rows) { if (rows.length) check(await this.sb.from('ep_attendance').upsert(rows, { onConflict: 'day,person_id' })); }
  async deleteAttendance(day, personId) { check(await this.sb.from('ep_attendance').delete().eq('day', day).eq('person_id', personId)); }
  async savePantry(rows) { if (rows.length) check(await this.sb.from('ep_pantry').upsert(rows)); }
  async saveStaples(rows) { if (rows.length) check(await this.sb.from('ep_staples').upsert(rows)); }
  async saveSettings(rows) { if (rows.length) check(await this.sb.from('ep_settings').upsert(rows)); }
  async saveRun(row) { check(await this.sb.from('ep_ai_runs').upsert(row)); }
  async saveReceipts(rows) { if (rows.length) check(await this.sb.from('ep_receipts').upsert(rows)); }
  async deleteReceipts(ids) { if (ids.length) check(await this.sb.from('ep_receipts').delete().in('id', ids)); }
  // Kassenzettel-Foto von Claude auslesen lassen (über die Push-Funktion, dort liegt der API-Schlüssel).
  async readReceipt(photos) { return (await this.readPhotos('kassenzettel', photos)).beleg; }
  // Datensicherung: Liste und Herunterladen aus dem privaten Speicher "sicherung", neu sichern über die Push-Funktion.
  async backupNow() { return this.readPhotos('sicherung', undefined); }
  async suggestLunch(mittag) {
    const { data, error } = await this.sb.functions.invoke('push', { body: { action: 'mittag', mittag } });
    if (!error) return data.mittag;
    let msg = '';
    try { msg = (await error.context.json()).error || ''; } catch (e) { /* keine Antwort der Funktion */ }
    throw new Error(msg || 'Die Funktion bei Supabase antwortet nicht. Ist sie auf dem neuesten Stand?');
  }
  async estimateCosts() {
    const { data, error } = await this.sb.functions.invoke('push', { body: { action: 'kosten' } });
    if (!error) return data.kosten;
    let msg = '';
    try { msg = (await error.context.json()).error || ''; } catch (e) { /* keine Antwort der Funktion */ }
    throw new Error(msg || 'Die Funktion bei Supabase antwortet nicht. Ist sie auf dem neuesten Stand?');
  }
  async planFeast(fest) {
    const { data, error } = await this.sb.functions.invoke('push', { body: { action: 'fest', fest } });
    if (!error) return data.fest;
    let msg = '';
    try { msg = (await error.context.json()).error || ''; } catch (e) { /* keine Antwort der Funktion */ }
    throw new Error(msg || 'Die Funktion bei Supabase antwortet nicht. Ist sie auf dem neuesten Stand?');
  }
  async calendars(tage = 2) {
    const { data, error } = await this.sb.functions.invoke('push', { body: { action: 'kalender', tage } });
    if (!error) return data;
    let msg = '';
    try { msg = (await error.context.json()).error || ''; } catch (e) { /* keine Antwort der Funktion */ }
    throw new Error(msg || 'Die Funktion bei Supabase antwortet nicht. Ist sie auf dem neuesten Stand?');
  }
  async newDish(neu) {
    const { data, error } = await this.sb.functions.invoke('push', { body: { action: 'neues-gericht', neu } });
    if (!error) return data.neu;
    let msg = '';
    try { msg = (await error.context.json()).error || ''; } catch (e) { /* keine Antwort der Funktion */ }
    throw new Error(msg || 'Die Funktion bei Supabase antwortet nicht. Ist sie auf dem neuesten Stand?');
  }
  async suggestSubstitute(payload) {
    const { data, error } = await this.sb.functions.invoke('push', { body: { action: 'ersatz', ...payload } });
    if (!error) return data.ersatz;
    let msg = '';
    try { msg = (await error.context.json()).error || ''; } catch (e) { /* keine Antwort der Funktion */ }
    throw new Error(msg || 'Die Funktion bei Supabase antwortet nicht. Ist sie auf dem neuesten Stand?');
  }
  async listBackups() {
    const { data, error } = await this.sb.storage.from('sicherung').list('', { limit: 50, sortBy: { column: 'name', order: 'desc' } });
    if (error) throw new Error(error.message || 'Die Sicherungen ließen sich nicht laden.');
    return (data || []).filter((f) => String(f.name).startsWith('familienplan-')).sort((a, b) => (a.name < b.name ? 1 : -1));
  }
  async downloadBackup(name) {
    const { data, error } = await this.sb.storage.from('sicherung').download(name);
    if (error) throw new Error(error.message || 'Die Sicherung ließ sich nicht laden.');
    return data;
  }
  // Fotonachweis: Das Foto liegt privat im Speicher, die Eltern bekommen Links für eine Stunde.
  async uploadFoto(id, data) { return this.readPhotos2({ action: 'foto', id, data }); }
  async fotoLinks(ids) { return ((await this.readPhotos2({ action: 'foto-links', ids })) || {}).links || {}; }
  async readPhotos2(body) {
    const { data, error } = await this.sb.functions.invoke('push', { body });
    if (!error) return data;
    let msg = '';
    try { msg = (await error.context.json()).error || ''; } catch (e) { /* keine Antwort der Funktion */ }
    throw new Error(msg || 'Die Funktion bei Supabase antwortet nicht.');
  }
  async readRecipe(photos) { return (await this.readPhotos('rezept', photos)).rezept; }
  async readIngredients(photos) { return (await this.readPhotos('zutaten', photos)).zutaten; }
  async readPhotos(action, photos) {
    const { data, error } = await this.sb.functions.invoke('push', { body: photos ? { action, photos } : { action } });
    if (!error) return data;
    let msg = '';
    try { msg = (await error.context.json()).error || ''; } catch (e) { /* keine Antwort der Funktion */ }
    throw new Error(msg || 'Die Funktion bei Supabase antwortet nicht. Ist sie auf dem neuesten Stand?');
  }
  // Bittet die Push-Funktion, sofort einen Wochenplan-Entwurf zu starten.
  async startDraft(week, wish) {
    const { data, error } = await this.sb.functions.invoke('push', { body: { action: 'entwurf', week, ...(wish ? { wish } : {}) } });
    if (!error) return data;
    let msg = '';
    try { msg = (await error.context.json()).error || ''; } catch (e) { /* keine Antwort der Funktion */ }
    throw new Error(msg || 'Die Funktion bei Supabase antwortet nicht. Ist sie auf dem neuesten Stand?');
  }
  async deleteStaples(ids) { if (ids.length) check(await this.sb.from('ep_staples').delete().in('id', ids)); }
  async deletePantry(ids) { if (ids.length) check(await this.sb.from('ep_pantry').delete().in('id', ids)); }
  async saveTasks(rows) {
    if (!rows.length) return;
    const { error } = await this.sb.from('ep_tasks').upsert(rows);
    // Ist schema.sql noch nicht neu ausgeführt, fehlt die Spalte "school_only": dann ohne sie speichern.
    if (error && /school_only/.test(error.message || '')) { check(await this.sb.from('ep_tasks').upsert(rows.map(({ school_only, ...r }) => r))); return; }
    check({ error });
  }
  async saveLog(rows) { if (rows.length) check(await this.sb.from('ep_task_log').upsert(rows)); }
  async deleteLog(ids) { if (ids.length) check(await this.sb.from('ep_task_log').delete().in('id', ids)); }
  async saveHeart(row) { check(await this.sb.from('ep_week_hearts').upsert(row, { onConflict: 'week_start,person_id' })); }
  async deleteHeart(week, personId) {
    check(await this.sb.from('ep_week_hearts').delete().eq('week_start', week).eq('person_id', personId));
  }
  async deleteLunchRating(day, personId) {
    check(await this.sb.from('ep_lunch_ratings').delete().eq('day', day).eq('person_id', personId));
  }

  // Push: Geräte und Abfuhrtermine für die Supabase-Funktion.
  async savePushSub(row) { check(await this.sb.from('ep_push_subs').upsert(row, { onConflict: 'endpoint' })); }
  // Zustellstatus dieses Geräts. Fehlen die Spalten noch (SQL nicht eingespielt), kommt null zurück.
  async pushSubState(endpoint) {
    let { data, error } = await this.sb.from('ep_push_subs').select('last_ok_at,last_status,last_error,history').eq('endpoint', endpoint).maybeSingle();
    // Ohne die Spalte history (schema.sql noch nicht eingespielt) wenigstens den letzten Stand holen.
    if (error) ({ data, error } = await this.sb.from('ep_push_subs').select('last_ok_at,last_status,last_error').eq('endpoint', endpoint).maybeSingle());
    if (error) return null;
    return data ? { ...data, known: true } : { known: false };
  }
  async deletePushSub(endpoint) { check(await this.sb.from('ep_push_subs').delete().eq('endpoint', endpoint)); }
  // Termine ab einem Tag durch die neue Liste ersetzen (eingelesene Kalenderdatei).
  async replaceAbfuhr(from, rows) {
    check(await this.sb.from('ep_abfuhr').delete().gte('day', from));
    if (rows.length) check(await this.sb.from('ep_abfuhr').upsert(rows, { onConflict: 'day,bin', ignoreDuplicates: true }));
  }
  async syncAbfuhr(rows) {
    if (rows.length) check(await this.sb.from('ep_abfuhr').upsert(rows, { onConflict: 'day,bin', ignoreDuplicates: true }));
  }
  async testPush(endpoint) {
    const { error } = await this.sb.functions.invoke('push', { body: { endpoint } });
    if (!error) return;
    let msg = '';
    try { msg = (await error.context.json()).error || ''; } catch (e) { /* keine Antwort der Funktion */ }
    throw new Error(msg || 'Die Push-Funktion antwortet nicht. Ist sie bei Supabase angelegt und „Verify JWT“ ausgeschaltet?');
  }

  // Meldet Änderungen anderer Geräte. cb bekommt den Tabellennamen.
  onChange(cb) {
    try {
      this.sb.channel('essensplan')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => cb(payload.table))
        .subscribe();
    } catch (e) {
      console.warn('Live-Abgleich nicht verfügbar', e);
    }
  }
}

class LocalStore {
  constructor() {
    this.mode = 'local';
    this.offline = false;
    this.get = () => null;
    this.onStatus = () => {};
  }
  remember() {}
  pendingCount() { return 0; }

  async init() { return { signedIn: true }; }
  bind(getter) { this.get = getter; }

  async loadAll() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* kaputter oder gesperrter Speicher: mit Startdaten weitermachen */ }
    return { persons: [], dishes: [], plan: [], ratings: [], shopping: [], lunchRatings: [], hearts: [], tasks: [], taskLog: [], events: [], attendance: [], pantry: [], staples: [], settings: [], aiRuns: [], receipts: [] };
  }

  async seed() {
    const data = JSON.parse(JSON.stringify(SEED));
    data.ratings = [];
    data.lunchRatings = [];
    data.hearts = [];
    data.taskLog = [];
    data.events = [];
    data.attendance = [];
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch (e) { /* ohne Speicher läuft die Demo nur bis zum Schließen */ }
  }

  save() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(this.get())); } catch (e) { /* siehe oben */ }
  }

  async signIn() {}
  async signOut() {}
  async savePersons() { this.save(); }
  async saveDish() { this.save(); }
  async savePlan() { this.save(); }
  async deletePlan() { this.save(); }
  async saveRating() { this.save(); }
  async deleteRating() { this.save(); }
  async deleteRatingsForDay() { this.save(); }
  async saveItems() { this.save(); }
  async deleteItems() { this.save(); }
  async saveLunchRating() { this.save(); }
  async saveHeart() { this.save(); }
  async saveTasks() { this.save(); }
  async saveEvents() { this.save(); }
  async deleteEvent() { this.save(); }
  async saveAttendance() { this.save(); }
  async deleteAttendance() { this.save(); }
  async savePantry() { this.save(); }
  async saveStaples() { this.save(); }
  async saveSettings() { this.save(); }
  async saveRun() { this.save(); }
  async saveReceipts() { this.save(); }
  async deleteReceipts() { this.save(); }
  async backupNow() { throw new Error('Sicherungen gibt es nur mit der gemeinsamen Datenbank, nicht im Demo-Modus.'); }
  async suggestLunch(m) {
    await new Promise((ok) => setTimeout(ok, 800));
    const n = Number(m && m.personen) || 1;
    return [
      { name: 'Rührei mit Spinat und Vollkorntoast (Beispiel)', minuten: 10, warum: 'Viel Eiweiß aus den Eiern, Gemüse dabei. Beispiel aus dem Demo-Modus.',
        zutaten: [{ menge: `${2 * n} Stück`, name: 'Eier', da: true }, { menge: `${50 * n} g`, name: 'Babyspinat', da: true }, { menge: `${n} Scheiben`, name: 'Vollkorntoast', da: true }],
        schritte: ['Eier verquirlen, salzen.', 'Spinat in etwas Butter zusammenfallen lassen, Eier dazu und bei mittlerer Hitze stocken lassen.', 'Mit Toast servieren.'], reste: [] },
      { name: 'Quark-Bowl mit Obst und Haferflocken', minuten: 5, warum: 'Schnell, kalt, eiweißreich.',
        zutaten: [{ menge: `${200 * n} g`, name: 'Magerquark', da: true }, { menge: `${n}`, name: 'Apfel', da: true }, { menge: `${30 * n} g`, name: 'Haferflocken', da: true }],
        schritte: ['Quark mit etwas Milch glatt rühren.', 'Apfel klein schneiden, mit Haferflocken darüber geben.'], reste: [] },
    ];
  }
  async estimateCosts() {
    await new Promise((ok) => setTimeout(ok, 800));
    const dishes = (this.get() || {}).dishes || [];
    // Demo: grobe Schätzung aus der Zahl der Zutaten.
    return { stand: new Date().toISOString().slice(0, 10), kassenzettel: 0, gerichte: Object.fromEntries(dishes.map((d) => [d.id, Math.round((3 + (d.ingredients || []).filter((g) => g.c !== 'basis').length * 1.1) * 100) / 100])) };
  }
  async planFeast(fest) {
    await new Promise((ok) => setTimeout(ok, 1200));
    const { demoFeast } = await import('./planer.js');
    return demoFeast(fest);
  }
  async calendars() {
    await new Promise((ok) => setTimeout(ok, 500));
    const v = ((this.get() || {}).settings || []).find((x) => x.key === 'kalender');
    const feeds = v && v.value && Array.isArray(v.value.feeds) ? v.value.feeds : [];
    const d = new Date();
    const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const t = iso(d);
    d.setDate(d.getDate() + 1);
    const m = iso(d);
    const f = (i) => (feeds[i] || feeds[0] || { id: 'demo' }).id;
    return {
      stand: new Date().toISOString(),
      tage: feeds.length ? { [t]: [{ titel: 'Frühdienst (Beispiel)', von: '07:00', bis: '15:30', ganztags: false, kalender: f(0) }, { titel: 'Elternabend', von: '19:30', bis: '21:00', ganztags: false, kalender: f(1) }], [m]: [{ titel: 'Geburtstag Oma', von: null, bis: null, ganztags: true, kalender: f(2) }] } : { [t]: [], [m]: [] },
      feeds: feeds.map((x) => ({ id: x.id, ok: true, anzahl: 1 })),
    };
  }
  async newDish(neu) {
    await new Promise((ok) => setTimeout(ok, 900));
    const n = (neu && Array.isArray(neu.abgelehnt) ? neu.abgelehnt.length : 0) + 1;
    return {
      warum: 'Schnell gemacht, viel Eiweiß und mit Gemüse der Saison. Beispiel aus dem Demo-Modus.',
      gericht: {
        name: n === 1 ? 'Ofen-Hähnchen mit Kürbis und Kichererbsen (Beispiel)' : `Linsen-Kokos-Curry mit Reis (Beispiel ${n})`,
        category: n === 1 ? 'gefluegel' : 'vegan', duration_min: 40, tags: ['Schnell'], note: '', prep: '',
        ingredients: n === 1
          ? [[600, 'g', 'Hähnchenbrustfilet', 'fleisch'], [1, '', 'Hokkaido-Kürbis', 'obst'], [1, 'Dose', 'Kichererbsen', 'vorrat'], [1, '', 'rote Zwiebel', 'obst'], [200, 'g', 'Feldsalat', 'obst'], [null, '', '2 EL Olivenöl', 'basis']]
          : [[250, 'g', 'rote Linsen', 'vorrat'], [1, 'Dose', 'Kokosmilch', 'vorrat'], [250, 'g', 'Bio-Reis', 'vorrat'], [200, 'g', 'Babyspinat', 'obst'], [null, '', '1 TL Currypulver', 'basis']],
        steps: ['Ofen auf 200 Grad vorheizen.', 'Alles schneiden und auf dem Blech verteilen.', '25 Minuten backen.'],
      },
    };
  }
  async suggestSubstitute(payload) {
    await new Promise((ok) => setTimeout(ok, 800));
    return {
      vorschlaege: [
        { name: 'Kabeljaufilet, tiefgekühlt', menge: 'gleiche Menge', warum: 'Fest und mild wie Seelachs, gibt es fast immer in der Tiefkühltruhe. (Beispiel aus dem Demo-Modus)' },
        { name: 'Alaska-Seelachsfilet, tiefgekühlt', menge: 'gleiche Menge', warum: 'Sehr ähnlich, etwas dünner geschnitten.' },
      ],
      rezept_hinweis: `Tiefgekühlten Fisch am Vorabend im Kühlschrank auftauen und vor dem Backen trocken tupfen. ${payload && payload.posten ? `(statt ${payload.posten})` : ''}`.trim(),
    };
  }
  async listBackups() { return []; }
  // Demo: Fotos bleiben nur im Speicher dieser Seite.
  async uploadFoto(id, data) { this.fotos = this.fotos || {}; this.fotos[id] = `data:image/jpeg;base64,${data}`; return { name: `${id}.jpg` }; }
  async fotoLinks(ids) { const f = this.fotos || {}; return Object.fromEntries(ids.filter((i) => f[i]).map((i) => [i, f[i]])); }
  async downloadBackup() { throw new Error('Im Demo-Modus gibt es keine Sicherungen.'); }
  async readIngredients() {
    await new Promise((ok) => setTimeout(ok, 1200));
    const { demoIngredients } = await import('./haushalt.js');
    return demoIngredients();
  }
  async readRecipe() {
    await new Promise((ok) => setTimeout(ok, 1200));
    const { demoRecipe } = await import('./haushalt.js');
    return demoRecipe();
  }
  async readReceipt() {
    await new Promise((ok) => setTimeout(ok, 1200));
    const { demoReceipt } = await import('./haushalt.js');
    return demoReceipt();
  }
  async startDraft() { throw new Error('Den Wochenplan mit Claude gibt es nur mit der gemeinsamen Datenbank, nicht im Demo-Modus.'); }
  async deleteStaples() { this.save(); }
  async deletePantry() { this.save(); }
  async saveLog() { this.save(); }
  async deleteLog() { this.save(); }
  async deleteHeart() { this.save(); }
  async deleteLunchRating() { this.save(); }
  async savePushSub() {}
  async deletePushSub() {}
  async syncAbfuhr() {}
  async replaceAbfuhr() {}
  async testPush() { throw new Error('Im Demo-Modus gibt es keine Push-Nachrichten.'); }
  async pushSubState() { return null; }

  onChange(cb) {
    window.addEventListener('storage', (e) => { if (e.key === LOCAL_KEY) cb('all'); });
  }
}

export function createStore(config) {
  const url = (config && config.supabaseUrl || '').trim();
  const key = (config && config.supabaseKey || '').trim();
  if (url.startsWith('https://') && key.length > 20) return new SupabaseStore(url, key);
  return new LocalStore();
}
